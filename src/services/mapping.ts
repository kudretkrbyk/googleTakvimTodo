import { Entry, GoogleEvent } from "../types/models";
import { deviceTimezone } from "../utils/dates";
export function fromGoogle(
  event: GoogleEvent,
  calendarId: string,
): Entry | null {
  const start = event.start?.date ?? event.start?.dateTime;
  const end = event.end?.date ?? event.end?.dateTime;
  if (!start || !end) return null;
  const p = event.extendedProperties?.private;
  return {
    id: `${calendarId}:${event.id}`,
    googleId: event.id,
    calendarId,
    title: event.summary ?? "(Başlıksız)",
    start: start.length === 10 ? start : new Date(start).toISOString(),
    end: end.length === 10 ? end : new Date(end).toISOString(),
    allDay: !!event.start?.date,
    timezone: event.start?.timeZone ?? deviceTimezone(),
    recurrence: event.recurrence ?? [],
    kind: p?.source === "sade" && p.type === "task" ? "TASK" : "EVENT",
    completed:
      p?.source === "sade" && p.type === "task" && p.app_completed === "true",
    updatedAt: event.updated ?? new Date().toISOString(),
    remoteUpdatedAt: event.updated ?? null,
    etag: event.etag ?? null,
    syncState: "synced",
    deleted: event.status === "cancelled",
    revision: 0,
    recurringEventId: event.recurringEventId,
    originalStart:
      event.originalStartTime?.date ??
      (event.originalStartTime?.dateTime
        ? new Date(event.originalStartTime.dateTime).toISOString()
        : undefined),
  };
}
export function toGoogle(
  e: Entry,
  existingPrivate: Record<string, string> = {},
): Omit<GoogleEvent, "id"> {
  return {
    summary: e.title,
    start: e.allDay
      ? { date: e.start }
      : { dateTime: e.start, timeZone: e.timezone },
    end: e.allDay ? { date: e.end } : { dateTime: e.end, timeZone: e.timezone },
    ...(e.recurringEventId ? {} : { recurrence: e.recurrence }),
    ...(e.kind === "TASK"
      ? {
          extendedProperties: {
            private: {
              ...existingPrivate,
              source: "sade",
              type: "task",
              app_completed: String(e.completed),
            },
          },
        }
      : {}),
  };
}
