import { tasksApi } from "../services/googleTasksService";
import {
  fromGoogleTask,
  tasksCalendarId,
} from "../services/googleTasksMapping";
import { repository } from "../storage/taskRepository";
import { database } from "../storage/database";
import { Entry } from "../types/models";
import { applyRemoteEntry } from "./remoteCache";
export async function pullGoogleTasks(listId: string) {
  const key = `tasksUpdated:${listId}`;
  const watermark = await repository.meta(key);
  // Use SERVER update timestamps, not the device clock. A one-second overlap
  // prevents losing changes exactly on the previous timestamp boundary.
  const updatedMin = watermark
    ? new Date(new Date(watermark).getTime() - 1000).toISOString()
    : null;
  let latest = watermark;
  let page: string | undefined;
  const seen = new Set<string>();
  do {
    const response = await tasksApi.list(listId, updatedMin, page);
    for (const task of response.items ?? []) {
      seen.add(task.id);
      if (task.updated) {
        const stamp = new Date(task.updated).toISOString();
        if (!latest || stamp > latest) latest = stamp;
      }
      await (
        await database()
      ).withExclusiveTransactionAsync(async (tx) => {
        const row = await tx.getFirstAsync<{ data: string }>(
          "SELECT data FROM entries WHERE calendar_id=? AND google_id=?",
          tasksCalendarId(listId),
          task.id,
        );
        const local = row ? (JSON.parse(row.data) as Entry) : null;
        const remote = fromGoogleTask(task, listId);
        if (local && !task.due && (task.deleted || remote.completed)) {
          remote.start = local.start;
          remote.end = local.end;
          remote.undated = local.undated;
        }
        await applyRemoteEntry(tx, remote, local);
      });
    }
    page = response.nextPageToken;
  } while (page);
  if (!watermark) {
    // First full collection refresh removes only clean records; offline edits stay.
    for (const entry of await repository.all())
      if (
        entry.provider === "google_tasks" &&
        entry.calendarId === tasksCalendarId(listId) &&
        entry.syncState === "synced" &&
        !seen.has(entry.googleId)
      ) {
        await (
          await database()
        ).runAsync(
          "DELETE FROM entries WHERE id=? AND state='synced'",
          entry.id,
        );
      }
  }
  if (latest) await repository.setMeta(key, latest); // Advance only after every page commits.
}
