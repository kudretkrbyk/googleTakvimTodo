import { request } from "./googleCalendarService";
import { fromGoogle } from "./mapping";
import * as Crypto from "expo-crypto";
import { Entry, Occurrence } from "../types/models";
import { repository } from "../storage/taskRepository";
import { deviceTimezone, addDays } from "../utils/dates";
export interface Draft {
  title: string;
  start: string;
  allDay: boolean;
  recurrence: string[];
  calendarId: string;
}
export async function saveTask(draft: Draft, existing?: Entry): Promise<void> {
  if (
    existing?.provider === "google_tasks" &&
    (!draft.allDay ||
      draft.recurrence.length ||
      existing.calendarId !== draft.calendarId)
  )
    throw new Error(
      "Google görevinde başlık ve tarih düzenlenebilir. Saat, tekrar ve listeyi Google Takvim’den değiştir.",
    );
  if (!draft.title.trim()) throw new Error("Görev başlığını yaz.");
  if (existing?.previousCalendarId && existing.calendarId !== draft.calendarId)
    throw new Error("Önce bekleyen takvim taşımasını senkronize et.");
  const id = existing?.googleId ?? Crypto.randomUUID().replace(/-/g, ""); // Hex is valid Calendar base32hex.
  const sameType = existing && existing.allDay === draft.allDay;
  const duration = sameType
    ? new Date(existing.end).getTime() - new Date(existing.start).getTime()
    : 3600000;
  const end = draft.allDay
    ? addDays(
        draft.start,
        sameType ? Math.max(1, Math.round(duration / 86400000)) : 1,
      )
    : new Date(new Date(draft.start).getTime() + duration).toISOString();
  const e: Entry = {
    id: existing?.id ?? `${draft.calendarId}:${id}`,
    googleId: id,
    provider: existing?.provider ?? "calendar",
    undated: false,
    ...draft,
    title: draft.title.trim(),
    end,
    timezone: existing?.timezone ?? deviceTimezone(),
    kind: existing?.kind ?? "TASK",
    completed: existing?.completed ?? false,
    updatedAt: new Date().toISOString(),
    remoteUpdatedAt: existing?.remoteUpdatedAt ?? null,
    etag: existing?.etag ?? null,
    deleted: false,
    syncState: existing?.syncState ?? "pending_create",
    revision: existing?.revision ?? 0,
    previousCalendarId:
      existing?.previousCalendarId ??
      (existing &&
      existing.syncState !== "pending_create" &&
      existing.calendarId !== draft.calendarId
        ? existing.calendarId
        : undefined),
    ...(existing?.recurringEventId
      ? {
          recurringEventId: existing.recurringEventId,
          originalStart: existing.originalStart,
        }
      : {}),
  };
  await repository.save(e, existing ? "update" : "create");
}
export const deleteTask = (e: Entry) =>
  repository.save({ ...e, deleted: true }, "delete");
export const completeTask = (e: Entry) =>
  repository.save({ ...e, completed: !e.completed }, "update");
// Editing an occurrence generates a deterministic exception ID used by Calendar.
// The server instance ID must be obtained from events.instances before editing.
export function isSeries(e: Entry | Occurrence) {
  return e.recurrence.length > 0;
}

export async function occurrenceInstance(e: Occurrence): Promise<Entry> {
  const q = new URLSearchParams({
    timeMin: e.allDay ? `${e.start}T00:00:00Z` : e.start,
    timeMax: e.allDay ? `${e.end}T23:59:59Z` : e.end,
    maxResults: "250",
  });
  const result = await request<{
    items: import("../types/models").GoogleEvent[];
  }>(
    `/calendars/${encodeURIComponent(e.calendarId)}/events/${encodeURIComponent(e.googleId)}/instances?${q}`,
  );
  const event = result.items.find(
    (v) =>
      (v.originalStartTime?.date ??
        (v.originalStartTime?.dateTime
          ? new Date(v.originalStartTime.dateTime).toISOString()
          : "")) === e.start,
  );
  const mapped = event ? fromGoogle(event, e.calendarId) : null;
  if (!mapped)
    throw new Error(
      "Bu tekrar çevrimdışı düzenlenemiyor. Google bağlantısını kontrol et.",
    );
  await repository.remote(mapped);
  return mapped;
}
