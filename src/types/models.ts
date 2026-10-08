export type SyncState =
  | "synced"
  | "pending_create"
  | "pending_update"
  | "pending_delete"
  | "sync_error";
export interface Entry {
  provider?: "calendar" | "google_tasks";
  undated?: boolean;
  id: string;
  googleId: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
  recurrence: string[];
  kind: "TASK" | "EVENT";
  completed: boolean;
  updatedAt: string;
  remoteUpdatedAt: string | null;
  etag: string | null;
  syncState: SyncState;
  deleted: boolean;
  revision: number;
  previousCalendarId?: string;
  recurringEventId?: string;
  originalStart?: string;
}
export interface Calendar {
  id: string;
  summary: string;
  accessRole: string;
  primary?: boolean;
}
export interface GoogleEvent {
  id: string;
  summary?: string;
  status?: string;
  updated?: string;
  etag?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  previousCalendarId?: string;
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}
export interface Occurrence extends Entry {
  occurrenceKey: string;
  sourceId: string;
}
export interface Preferences {
  theme: "system" | "light" | "dark";
  days: 7 | 30;
  calendarId: string;
  widgetDays: 7 | 30;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  etag?: string;
}
export interface GoogleTask {
  id: string;
  title?: string;
  due?: string;
  status?: "needsAction" | "completed";
  updated?: string;
  etag?: string;
  deleted?: boolean;
  hidden?: boolean;
}
