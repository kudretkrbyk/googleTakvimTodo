import { Entry, GoogleTask } from "../types/models";
import { addDays, deviceTimezone } from "../utils/dates";
export const tasksCalendarId = (listId: string) => `gtasks:${listId}`;
export function tasksListId(entry: Entry): string {
  if (
    entry.provider !== "google_tasks" ||
    !entry.calendarId.startsWith("gtasks:")
  )
    throw new Error("Google görev listesi bulunamadı.");
  return entry.calendarId.slice(7);
}
// Tasks due is a civil DATE even though Google encodes it as RFC3339. Never
// convert it to the device timezone: UTC midnight would become yesterday in UTC-.
// Tasks API exposes neither scheduled time nor recurrence, so do not invent them.
export function fromGoogleTask(task: GoogleTask, listId: string): Entry {
  const date = task.due?.slice(0, 10) ?? "";
  return {
    id: `${tasksCalendarId(listId)}:${task.id}`,
    googleId: task.id,
    calendarId: tasksCalendarId(listId),
    provider: "google_tasks",
    undated: !date,
    title: task.title ?? "(Başlıksız)",
    start: date,
    end: date ? addDays(date, 1) : "",
    allDay: true,
    timezone: deviceTimezone(),
    recurrence: [],
    kind: "TASK",
    completed: task.status === "completed" || !!task.hidden,
    updatedAt: task.updated ?? new Date().toISOString(),
    remoteUpdatedAt: task.updated ?? null,
    etag: task.etag ?? null,
    syncState: "synced",
    deleted: !!task.deleted,
    revision: 0,
  };
}
export function toGoogleTaskPatch(entry: Entry, remote: GoogleTask) {
  const body: {
    title?: string;
    due?: string | null;
    status?: string;
    completed?: null;
  } = {};
  if (entry.title !== (remote.title ?? "(Başlıksız)")) body.title = entry.title;
  if (entry.start !== (remote.due?.slice(0, 10) ?? ""))
    body.due = entry.start ? `${entry.start}T00:00:00.000Z` : null;
  if (entry.completed !== (remote.status === "completed")) {
    body.status = entry.completed ? "completed" : "needsAction";
    if (!entry.completed) body.completed = null;
  }
  // PATCH only changed supported fields. Notes, native scheduling, parent/order
  // and any Google-side recurrence are not overwritten for a title/completion edit.
  return body;
}
