import { api, ApiError } from "../services/googleCalendarService";
import { fromGoogle, toGoogle } from "../services/mapping";
import { repository } from "../storage/taskRepository";
import { database } from "../storage/database";
import { Entry, GoogleEvent } from "../types/models";
import { pending, backoff, claim } from "./syncQueue";
import { recordConflict, applyRemoteEntry } from "./remoteCache";
import { tasksApi } from "../services/googleTasksService";
import { fromGoogleTask, tasksListId } from "../services/googleTasksMapping";
import { pullGoogleTasks } from "./tasksSync";
import { conflictDecision } from "./conflictResolver";
let running: Promise<void> | null = null;
export function synchronize(
  calendarIds: string[],
  changed: () => Promise<void>,
  taskListIds: string[] = [],
): Promise<void> {
  return (running ??= execute(calendarIds, changed, taskListIds).finally(() => {
    running = null;
  }));
}
async function execute(
  calendarIds: string[],
  changed: () => Promise<void>,
  taskListIds: string[],
) {
  let firstError: unknown;
  try {
    for (const item of await pending()) {
      const entry = await claim(item.entry_id);
      if (!entry) continue;
      item.operation = entry.queueOperation;
      const nativeTask = entry.provider === "google_tasks";
      try {
        if (item.operation !== "create") {
          let remote;
          try {
            remote = nativeTask
              ? fromGoogleTask(await tasksApi.get(entry), tasksListId(entry))
              : fromGoogle(
                  await api.get(
                    entry.previousCalendarId ?? entry.calendarId,
                    entry.googleId,
                  ),
                  entry.previousCalendarId ?? entry.calendarId,
                );
          } catch (error) {
            if (!(
              error instanceof ApiError && [404, 410].includes(error.status)
            ))
              throw error;
            remote = {
              ...entry,
              deleted: true,
              etag: null,
              remoteUpdatedAt: null,
              syncState: "synced" as const,
            };
          }
          if (remote?.deleted && item.operation === "delete") {
            await repository.acknowledge(entry.id, entry.revision, null);
            continue;
          }
          if (remote && conflictDecision(entry, remote) === "conflict") {
            await recordConflict(entry, remote);
            continue;
          }
          if (remote && !entry.etag) entry.etag = remote.etag;
        }
        if (entry.previousCalendarId) {
          let moved;
          try {
            moved = await api.move(entry);
          } catch (error) {
            if (error instanceof ApiError && [404, 410].includes(error.status))
              moved = await api.get(entry.calendarId, entry.googleId);
            else throw error;
          }
          const remote = fromGoogle(moved, entry.calendarId);
          if (!remote) throw new Error("Takvim taşıması tamamlanamadı.");
          await repository.markMoved(entry.id, remote);
          entry.previousCalendarId = undefined;
          entry.etag = remote.etag;
          entry.remoteUpdatedAt = remote.remoteUpdatedAt;
        }
        if (item.operation === "delete") {
          try {
            if (nativeTask) await tasksApi.remove(entry);
            else await api.remove(entry);
          } catch (error) {
            if (!(
              error instanceof ApiError && [404, 410].includes(error.status)
            ))
              throw error;
          }
          await repository.acknowledge(entry.id, entry.revision, null);
        } else {
          if (nativeTask) {
            if (item.operation === "create")
              throw new ApiError(400, "native_tasks_create_not_supported");
            const remote = fromGoogleTask(
              await tasksApi.write(entry),
              tasksListId(entry),
            );
            await repository.acknowledge(entry.id, entry.revision, remote);
            continue;
          }
          let event;
          try {
            event = await api.write(entry, item.operation === "create");
          } catch (error) {
            // Client-generated base32hex IDs make a retried POST idempotent.
            if (
              item.operation === "create" &&
              error instanceof ApiError &&
              error.status === 409
            ) {
              event = await api.get(entry.calendarId, entry.googleId);
              const remote = fromGoogle(event, entry.calendarId);
              if (!remote)
                throw new Error("Etkinlik bulunamadı.", { cause: error });
              if (
                JSON.stringify(toGoogle(entry)) !==
                JSON.stringify(toGoogle(remote))
              ) {
                await recordConflict(entry, remote);
                continue;
              }
            } else throw error;
          }
          const remote = fromGoogle(event, entry.calendarId);
          if (!remote) throw new Error("Google etkinliği eksik.");
          await repository.acknowledge(entry.id, entry.revision, remote);
        }
      } catch (error) {
        await (
          await database()
        ).runAsync(
          "UPDATE queue SET in_flight=0 WHERE entry_id=?",
          item.entry_id,
        );
        await backoff(item);
        // A bad event/removed calendar must not prevent reading healthy calendars.
        // Transport/auth failures still stop immediately to avoid futile requests.
        if (
          !(error instanceof ApiError) ||
          ![400, 403, 404, 409, 410, 412].includes(error.status)
        )
          throw error;
        firstError ??= error;
      }
    }
    for (const calendarId of calendarIds) {
      try {
        await pull(calendarId);
      } catch (error) {
        if (!(error instanceof ApiError) || ![403, 404].includes(error.status))
          throw error;
        firstError ??= error;
      }
    }
    for (const listId of taskListIds) {
      try {
        await pullGoogleTasks(listId);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
    await repository.setMeta("lastSync", new Date().toISOString());
  } finally {
    await changed();
  }
}
async function pull(calendarId: string, reset = false): Promise<void> {
  const token = reset ? null : await repository.meta(`sync:${calendarId}`);
  const seen = new Set<string>();
  let page: string | undefined;
  let next: string | undefined;
  try {
    do {
      const response = await api.list(calendarId, token, page);
      for (const event of response.items ?? []) {
        seen.add(event.id);
        await mergeRemote(event, calendarId);
      }
      page = response.nextPageToken;
      next = response.nextSyncToken;
    } while (page);
    // A 410 resets only remote cache records, preserving offline edits and queue.
    if (!token)
      for (const e of await repository.all())
        if (
          e.calendarId === calendarId &&
          e.syncState === "synced" &&
          !seen.has(e.googleId)
        )
          await (
            await database()
          ).runAsync("DELETE FROM entries WHERE id=? AND state='synced'", e.id);
    if (next) await repository.setMeta(`sync:${calendarId}`, next);
  } catch (error) {
    if (!reset && error instanceof ApiError && error.status === 410)
      return pull(calendarId, true);
    throw error;
  }
}

async function mergeRemote(event: GoogleEvent, calendarId: string) {
  const db = await database();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ data: string }>(
      "SELECT data FROM entries WHERE calendar_id=? AND google_id=?",
      calendarId,
      event.id,
    );
    const local = row ? (JSON.parse(row.data) as Entry) : null;
    const remote =
      fromGoogle(event, calendarId) ??
      (local && event.status === "cancelled"
        ? {
            ...local,
            deleted: true,
            syncState: "synced" as const,
            etag: event.etag ?? null,
            remoteUpdatedAt: event.updated ?? null,
          }
        : null);
    if (!remote) {
      if (
        event.status === "cancelled" &&
        event.recurringEventId &&
        event.originalStartTime
      ) {
        const original =
          event.originalStartTime.date ?? event.originalStartTime.dateTime;
        if (original) {
          const cancelled: Entry = {
            id: `${calendarId}:${event.id}`,
            calendarId,
            googleId: event.id,
            title: "",
            start:
              original.length === 10
                ? original
                : new Date(original).toISOString(),
            end: original,
            allDay: original.length === 10,
            timezone: "UTC",
            recurrence: [],
            kind: "EVENT",
            completed: false,
            updatedAt: event.updated ?? new Date().toISOString(),
            remoteUpdatedAt: event.updated ?? null,
            etag: event.etag ?? null,
            syncState: "synced",
            deleted: true,
            revision: 0,
            recurringEventId: event.recurringEventId,
            originalStart:
              original.length === 10
                ? original
                : new Date(original).toISOString(),
          };
          await tx.runAsync(
            "INSERT OR REPLACE INTO entries VALUES(?,?,?,?,?,?)",
            cancelled.id,
            calendarId,
            event.id,
            JSON.stringify(cancelled),
            "synced",
            0,
          );
        }
      }
      return;
    }
    await applyRemoteEntry(tx, remote, local);
  });
}
