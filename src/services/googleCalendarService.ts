import { Calendar, GoogleEvent, Entry } from "../types/models";
import { googleRequest, ApiError } from "./googleApiClient";
export { ApiError };
import { toGoogle } from "./mapping";
export function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  return googleRequest("calendar", path, init, retry);
}
const path = (calendar: string, id?: string) =>
  `/calendars/${encodeURIComponent(calendar)}/events${id ? `/${encodeURIComponent(id)}` : ""}`;
export const api = {
  async calendars(): Promise<Calendar[]> {
    let page: string | undefined;
    const items: Calendar[] = [];
    do {
      const query = new URLSearchParams({
        fields: "items(id,summary,accessRole,primary),nextPageToken",
      });
      if (page) query.set("pageToken", page);
      const r = await request<{ items?: Calendar[]; nextPageToken?: string }>(
        `/users/me/calendarList?${query}`,
      );
      items.push(...(r.items ?? []));
      page = r.nextPageToken;
    } while (page);
    return items;
  },
  get: (calendar: string, id: string) =>
    request<GoogleEvent>(path(calendar, id)),
  async write(e: Entry, create: boolean) {
    let existing: GoogleEvent | undefined;
    if (!create) existing = await api.get(e.calendarId, e.googleId);
    const body = {
      ...toGoogle(e, existing?.extendedProperties?.private),
      ...(create ? { id: e.googleId } : {}),
    };
    // PATCH preserves reminders, attachments and all unrelated Calendar metadata.
    return request<GoogleEvent>(
      path(e.calendarId, create ? undefined : e.googleId),
      {
        method: create ? "POST" : "PATCH",
        headers:
          !create && (e.etag ?? existing?.etag)
            ? { "If-Match": (e.etag ?? existing?.etag)! }
            : {},
        body: JSON.stringify(body),
      },
    );
  },
  move: (e: Entry) =>
    request<GoogleEvent>(
      `${path(e.previousCalendarId!, e.googleId)}/move?destination=${encodeURIComponent(e.calendarId)}`,
      { method: "POST", headers: e.etag ? { "If-Match": e.etag } : {} },
    ),
  remove: (e: Entry) =>
    request<void>(path(e.calendarId, e.googleId), {
      method: "DELETE",
      headers: e.etag ? { "If-Match": e.etag } : {},
    }),
  list(calendar: string, syncToken: string | null, pageToken?: string) {
    // Identical query parameters for full and incremental sync. No timeMin/orderBy
    // restrictions: recurrence masters and cancellations must reach the cache.
    const q = new URLSearchParams({
      singleEvents: "false",
      showDeleted: "true",
      maxResults: "2500",
      fields:
        "items(id,summary,status,updated,etag,start,end,recurrence,recurringEventId,originalStartTime,extendedProperties/private),nextPageToken,nextSyncToken",
    });
    if (syncToken) q.set("syncToken", syncToken);
    if (pageToken) q.set("pageToken", pageToken);
    return request<{
      items?: GoogleEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    }>(`${path(calendar)}?${q}`);
  },
};
