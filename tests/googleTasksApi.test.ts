import { beforeEach, describe, expect, it, vi } from "vitest";
const token = vi.hoisted(() => vi.fn(async () => "test-token"));
vi.mock("../src/services/googleAuthService", () => ({ accessToken: token }));
import {
  tasksApi,
  GoogleTasksError,
  tasksErrorMessage,
} from "../src/services/googleTasksService";
import { fromGoogleTask } from "../src/services/googleTasksMapping";
const transport = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", transport);
});
describe("Google Tasks API transport", () => {
  it("includes hidden completions, tombstones, cursor and server watermark", async () => {
    transport.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] })),
    );
    await tasksApi.list("a/b", "2026-10-07T12:00:00Z", "page");
    const url = new URL(transport.mock.calls[0]![0]);
    expect(url.origin).toBe("https://tasks.googleapis.com");
    expect(url.pathname).toBe("/tasks/v1/lists/a%2Fb/tasks");
    for (const key of ["showHidden", "showDeleted", "showCompleted"])
      expect(url.searchParams.get(key)).toBe("true");
    expect(url.searchParams.get("updatedMin")).toBe("2026-10-07T12:00:00Z");
    expect(url.searchParams.get("pageToken")).toBe("page");
  });
  it("refreshes an expired token once and returns an actionable API-disabled error", async () => {
    transport
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { details: [{ reason: "SERVICE_DISABLED" }] },
          }),
          { status: 403 },
        ),
      );
    let error: unknown;
    try {
      await tasksApi.lists();
    } catch (e) {
      error = e;
    }
    expect(token).toHaveBeenCalledWith(true);
    expect(error).toBeInstanceOf(GoogleTasksError);
    expect(tasksErrorMessage(error)).toContain("Google Tasks API kapalı");
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("sends a conditional minimal completion PATCH", async () => {
    const task = {
      id: "task",
      title: "Başlık",
      due: "2030-10-07T00:00:00Z",
      etag: "etag",
      status: "needsAction" as const,
    };
    transport
      .mockResolvedValueOnce(new Response(JSON.stringify(task)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...task, status: "completed" })),
      );
    await tasksApi.write({ ...fromGoogleTask(task, "list"), completed: true });
    const request = transport.mock.calls[1]![1];
    expect(request.method).toBe("PATCH");
    expect(request.headers["If-Match"]).toBe("etag");
    expect(JSON.parse(request.body)).toEqual({ status: "completed" });
  });
});
