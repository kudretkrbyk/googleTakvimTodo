import { Entry, GoogleTask, GoogleTaskList } from "../types/models";
import { googleRequest, ApiError } from "./googleApiClient";
import { tasksListId, toGoogleTaskPatch } from "./googleTasksMapping";
export class GoogleTasksError extends ApiError {
  constructor(status: number, reason?: string) {
    super(status, reason);
    this.name = "GoogleTasksError";
  }
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await googleRequest("tasks", path, init);
  } catch (error) {
    if (error instanceof ApiError)
      throw new GoogleTasksError(error.status, error.reason);
    throw error;
  }
}
const fields = "id,title,due,status,updated,etag,deleted,hidden";
const path = (listId: string, id?: string) =>
  `/lists/${encodeURIComponent(listId)}/tasks${id ? `/${encodeURIComponent(id)}` : ""}`;
export const tasksApi = {
  async lists(): Promise<GoogleTaskList[]> {
    let page: string | undefined;
    const result: GoogleTaskList[] = [];
    do {
      const q = new URLSearchParams({
        maxResults: "100",
        fields: "items(id,title,updated,etag),nextPageToken",
      });
      if (page) q.set("pageToken", page);
      const response = await request<{
        items?: GoogleTaskList[];
        nextPageToken?: string;
      }>(`/users/@me/lists?${q}`);
      result.push(...(response.items ?? []));
      page = response.nextPageToken;
    } while (page);
    return result;
  },
  list(listId: string, updatedMin: string | null, pageToken?: string) {
    // Tasks has no Calendar syncToken. Use updatedMin with pagination and include
    // tombstones + hidden completions so first-party changes reach the local cache.
    const q = new URLSearchParams({
      maxResults: "100",
      showCompleted: "true",
      showDeleted: "true",
      showHidden: "true",
      fields: `items(${fields}),nextPageToken`,
    });
    if (updatedMin) q.set("updatedMin", updatedMin);
    if (pageToken) q.set("pageToken", pageToken);
    return request<{ items?: GoogleTask[]; nextPageToken?: string }>(
      `${path(listId)}?${q}`,
    );
  },
  get: (entry: Entry) =>
    request<GoogleTask>(
      `${path(tasksListId(entry), entry.googleId)}?fields=${fields}`,
    ),
  async write(entry: Entry) {
    const remote = await tasksApi.get(entry);
    const body = toGoogleTaskPatch(entry, remote);
    if (!Object.keys(body).length) return remote;
    return request<GoogleTask>(path(tasksListId(entry), entry.googleId), {
      method: "PATCH",
      headers: entry.etag ? { "If-Match": entry.etag } : {},
      body: JSON.stringify(body),
    });
  },
  remove: (entry: Entry) =>
    request<void>(path(tasksListId(entry), entry.googleId), {
      method: "DELETE",
      headers: entry.etag ? { "If-Match": entry.etag } : {},
    }),
};
export function tasksErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    (error.reason === "SERVICE_DISABLED" ||
      error.reason === "accessNotConfigured")
  )
    return "Google Tasks API kapalı. Google Cloud projesinde etkinleştirip tekrar dene.";
  if (error instanceof ApiError && error.status === 403)
    return "Google görevlerine erişilemedi. Görev iznini yeniden ver ve Google Tasks API’nin açık olduğunu kontrol et.";
  return "Google görevleri şu anda yenilenemedi. Cihazdaki kayıtların korunuyor.";
}
