const nativeTasksApi = vi.hoisted(() => ({
  list: vi.fn(),
  lists: vi.fn(),
  get: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/services/googleTasksService", () => ({
  tasksApi: nativeTasksApi,
  GoogleTasksError: class extends Error {},
  tasksErrorMessage: () => "Görev bağlantısı başarısız",
}));
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "../src/storage/migrations";
import { Entry } from "../src/types/models";
const holder = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock("../src/storage/database", () => ({
  database: async () => {
    const db = holder.db!;
    const adapter = {
      runAsync: async (sql: string, ...args: (string | number | null)[]) =>
        db.prepare(sql).run(...args),
      getFirstAsync: async (sql: string, ...args: (string | number | null)[]) =>
        db.prepare(sql).get(...args) ?? null,
      getAllAsync: async (sql: string, ...args: (string | number | null)[]) =>
        db.prepare(sql).all(...args),
      execAsync: async (sql: string) => db.exec(sql),
      withExclusiveTransactionAsync: async (
        fn: (tx: unknown) => Promise<void>,
      ) => {
        db.exec("BEGIN");
        try {
          await fn(adapter);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    };
    return adapter;
  },
}));
import { repository } from "../src/storage/taskRepository";
import { claim } from "../src/sync/syncQueue";
const entry: Entry = {
  id: "local",
  googleId: "abcdef",
  calendarId: "primary",
  title: "Görev",
  start: "2026-10-07",
  end: "2026-10-08",
  allDay: true,
  timezone: "Europe/Istanbul",
  recurrence: [],
  kind: "TASK",
  completed: false,
  updatedAt: "2026-10-07T10:00:00Z",
  remoteUpdatedAt: null,
  etag: null,
  syncState: "pending_create",
  deleted: false,
  revision: 0,
};
beforeEach(() => {
  holder.db?.close();
  holder.db = new DatabaseSync(":memory:");
  for (const migration of migrations) holder.db.exec(migration);
});
describe("durable local-first queue using real SQLite", () => {
  it("atomically saves entry and queue and coalesces offline edits", async () => {
    await repository.save({ ...entry }, "create");
    await repository.save({ ...entry, title: "Yeni başlık" }, "update");
    expect((await repository.get(entry.id))?.revision).toBe(2);
    expect(
      holder.db!.prepare("SELECT operation FROM queue").get()?.operation,
    ).toBe("create");
  });
  it("drops unsent create followed by delete without contacting Google", async () => {
    await repository.save({ ...entry }, "create");
    await repository.save({ ...entry, deleted: true }, "delete");
    expect(await repository.get(entry.id)).toBeNull();
    expect(holder.db!.prepare("SELECT COUNT(*) AS n FROM queue").get()?.n).toBe(
      0,
    );
  });
  it("retains delete when create may already be in flight", async () => {
    await repository.save({ ...entry }, "create");
    await claim(entry.id);
    await repository.save({ ...entry, deleted: true }, "delete");
    expect((await repository.get(entry.id))?.deleted).toBe(true);
    expect(
      holder.db!.prepare("SELECT operation FROM queue").get()?.operation,
    ).toBe("delete");
  });
  it("does not overwrite edits made during network upload", async () => {
    await repository.save({ ...entry }, "create");
    const sent = await claim(entry.id);
    await repository.save({ ...entry, title: "Son değişiklik" }, "update");
    await repository.acknowledge(entry.id, sent!.revision, {
      ...entry,
      etag: "remote1",
      remoteUpdatedAt: "2026-10-07T10:10:00Z",
      syncState: "synced",
    });
    const local = await repository.get(entry.id);
    expect(local?.title).toBe("Son değişiklik");
    expect(local?.etag).toBe("remote1");
    expect(local?.syncState).toBe("pending_update");
    expect(
      holder.db!.prepare("SELECT operation FROM queue").get()?.operation,
    ).toBe("update");
  });
  it("clears queue only when exact uploaded revision is acknowledged", async () => {
    await repository.save({ ...entry }, "create");
    const sent = await claim(entry.id);
    await repository.acknowledge(entry.id, sent!.revision, {
      ...entry,
      syncState: "synced",
      etag: "v1",
    });
    expect((await repository.get(entry.id))?.syncState).toBe("synced");
    expect(holder.db!.prepare("SELECT COUNT(*) AS n FROM queue").get()?.n).toBe(
      0,
    );
  });
});

const remoteApi = vi.hoisted(() => ({
  get: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  move: vi.fn(),
}));
vi.mock("../src/services/googleCalendarService", () => ({
  api: remoteApi,
  ApiError: class extends Error {
    constructor(public status: number) {
      super(`HTTP ${status}`);
    }
  },
}));
import { synchronize } from "../src/sync/syncEngine";
import { ApiError } from "../src/services/googleCalendarService";
const remoteEvent = {
  id: "abcdef",
  summary: "Görev",
  start: { date: "2026-10-07" },
  end: { date: "2026-10-08" },
  updated: "2026-10-07T10:00:00Z",
  etag: "v1",
  extendedProperties: {
    private: { source: "sade", type: "task", app_completed: "false" },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  remoteApi.list.mockResolvedValue({ items: [], nextSyncToken: "token1" });
  remoteApi.write.mockResolvedValue(remoteEvent);
  remoteApi.get.mockResolvedValue(remoteEvent);
});
describe("sync engine integration with real cache and mocked Google transport", () => {
  it("uploads offline creates and acknowledges their queue", async () => {
    await repository.save({ ...entry }, "create");
    await synchronize([], async () => {});
    expect(remoteApi.write).toHaveBeenCalledOnce();
    expect((await repository.get(entry.id))?.syncState).toBe("synced");
    expect(holder.db!.prepare("SELECT COUNT(*) AS n FROM queue").get()?.n).toBe(
      0,
    );
  });
  it("does not advance sync token before final page", async () => {
    remoteApi.list
      .mockResolvedValueOnce({ items: [remoteEvent], nextPageToken: "page2" })
      .mockImplementationOnce(async () => {
        expect(await repository.meta("sync:primary")).toBeNull();
        return { items: [], nextSyncToken: "final" };
      });
    await synchronize(["primary"], async () => {});
    expect(remoteApi.list).toHaveBeenNthCalledWith(2, "primary", null, "page2");
    expect(await repository.meta("sync:primary")).toBe("final");
  });
  it("resets expired sync token without erasing pending offline edits", async () => {
    await repository.save({ ...entry, googleId: "offline" }, "create");
    holder
      .db!.prepare("UPDATE queue SET next_attempt=?")
      .run(Number.MAX_SAFE_INTEGER);
    await repository.setMeta("sync:primary", "expired");
    remoteApi.list
      .mockRejectedValueOnce(new ApiError(410))
      .mockResolvedValueOnce({ items: [], nextSyncToken: "new" });
    await synchronize(["primary"], async () => {});
    expect((await repository.get(entry.id))?.title).toBe("Görev");
    expect(await repository.meta("sync:primary")).toBe("new");
  });
  it("applies cancelled events and preserves minimal recurrence exceptions", async () => {
    await repository.remote({ ...entry, syncState: "synced" });
    remoteApi.list.mockResolvedValue({
      items: [
        { id: entry.googleId, status: "cancelled" },
        {
          id: "exception",
          status: "cancelled",
          recurringEventId: "series",
          originalStartTime: { date: "2026-10-09" },
        },
      ],
      nextSyncToken: "new",
    });
    await synchronize(["primary"], async () => {});
    expect((await repository.get(entry.id))?.deleted).toBe(true);
    expect(
      (await repository.all()).find((e) => e.googleId === "exception")
        ?.originalStart,
    ).toBe("2026-10-09");
  });
  it("holds both versions instead of overwriting a Google conflict", async () => {
    await repository.save(
      { ...entry, etag: "v0", remoteUpdatedAt: "2026-10-06T10:00:00Z" },
      "update",
    );
    await synchronize([], async () => {});
    expect(remoteApi.write).not.toHaveBeenCalled();
    expect(
      holder.db!.prepare("SELECT COUNT(*) AS n FROM conflicts").get()?.n,
    ).toBe(1);
    expect((await repository.get(entry.id))?.syncState).toBe("sync_error");
  });
  it("keeps queue and reloads local UI after transport failure", async () => {
    await repository.save({ ...entry }, "create");
    remoteApi.write.mockRejectedValueOnce(new Error("offline"));
    const changed = vi.fn(async () => {});
    await expect(synchronize([], changed)).rejects.toThrow("offline");
    expect(changed).toHaveBeenCalledOnce();
    expect((await repository.get(entry.id))?.syncState).toBe("pending_create");
    expect(
      holder.db!.prepare("SELECT attempts FROM queue").get()?.attempts,
    ).toBe(1);
  });
  it("does not lose a newer local payload on a retried create returning 409", async () => {
    await repository.save({ ...entry, title: "Son başlık" }, "create");
    remoteApi.write.mockRejectedValueOnce(new ApiError(409));
    await synchronize([], async () => {});
    expect((await repository.get(entry.id))?.title).toBe("Son başlık");
    expect((await repository.get(entry.id))?.syncState).toBe("sync_error");
  });
});

vi.mock("expo-crypto", () => ({
  randomUUID: () => "11223344-5566-7788-9900-aabbccddeeff",
}));
import {
  listConflicts,
  resolveConflict,
} from "../src/services/conflictService";
describe("conflict resolution and claim races", () => {
  it("claims the current queue operation instead of a stale sync snapshot", async () => {
    await repository.save({ ...entry }, "create");
    await claim(entry.id);
    await repository.save({ ...entry, deleted: true }, "delete");
    expect((await claim(entry.id))?.queueOperation).toBe("delete");
  });
  it("does not claim a conflict-paused queue record", async () => {
    await repository.save({ ...entry }, "create");
    holder
      .db!.prepare("UPDATE queue SET next_attempt=?")
      .run(Number.MAX_SAFE_INTEGER);
    expect(await claim(entry.id)).toBeNull();
  });
  it("atomically keeps remote conflict choice and clears outbox", async () => {
    await repository.save({ ...entry, etag: "old" }, "update");
    await synchronize([], async () => {});
    const conflicts = await listConflicts();
    expect(conflicts).toHaveLength(1);
    await resolveConflict(conflicts[0]!.id, false);
    expect((await repository.get(entry.id))?.title).toBe("Görev");
    expect((await repository.get(entry.id))?.syncState).toBe("synced");
    expect(await listConflicts()).toHaveLength(0);
    expect(holder.db!.prepare("SELECT COUNT(*) AS n FROM queue").get()?.n).toBe(
      0,
    );
  });
  it("keeps the latest device data with a refreshed etag and queued update", async () => {
    await repository.save({ ...entry, title: "Yerel", etag: "old" }, "update");
    await synchronize([], async () => {});
    const conflict = (await listConflicts())[0]!;
    await resolveConflict(conflict.id, true);
    const local = await repository.get(entry.id);
    expect(local?.title).toBe("Yerel");
    expect(local?.etag).toBe("v1");
    expect(local?.syncState).toBe("pending_update");
    expect(
      holder.db!.prepare("SELECT operation FROM queue").get()?.operation,
    ).toBe("update");
  });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Google to local incremental changes", () => {
  it("imports an external event and applies later changes and deletion", async () => {
    await repository.setMeta("sync:primary", "before");
    remoteApi.list.mockResolvedValueOnce({
      items: [
        {
          ...remoteEvent,
          id: "external",
          summary: "Google’dan eklendi",
          extendedProperties: undefined,
        },
      ],
      nextSyncToken: "created",
    });
    await synchronize(["primary"], async () => {});
    let local = (await repository.all()).find((e) => e.googleId === "external");
    expect(local?.title).toBe("Google’dan eklendi");
    expect(local?.kind).toBe("EVENT");
    remoteApi.list.mockResolvedValueOnce({
      items: [
        {
          ...remoteEvent,
          id: "external",
          summary: "Google’da değişti",
          etag: "v2",
          extendedProperties: undefined,
        },
      ],
      nextSyncToken: "updated",
    });
    await synchronize(["primary"], async () => {});
    local = (await repository.all()).find((e) => e.googleId === "external");
    expect(local?.title).toBe("Google’da değişti");
    expect(remoteApi.list).toHaveBeenLastCalledWith(
      "primary",
      "created",
      undefined,
    );
    remoteApi.list.mockResolvedValueOnce({
      items: [{ id: "external", status: "cancelled", etag: "v3" }],
      nextSyncToken: "deleted",
    });
    await synchronize(["primary"], async () => {});
    expect((await repository.get(local!.id))?.deleted).toBe(true);
  });
  it("pulls healthy calendars when another calendar is no longer readable", async () => {
    remoteApi.list.mockImplementation(async (calendar: string) => {
      if (calendar === "blocked") throw new ApiError(403);
      return {
        items: [
          { ...remoteEvent, id: "incoming", extendedProperties: undefined },
        ],
        nextSyncToken: "healthy-token",
      };
    });
    await expect(
      synchronize(["blocked", "healthy"], async () => {}),
    ).rejects.toThrow();
    expect(
      (await repository.all()).find((e) => e.googleId === "incoming")
        ?.calendarId,
    ).toBe("healthy");
    expect(await repository.meta("sync:healthy")).toBe("healthy-token");
  });
  it("pulls incoming events even if a queued write is forbidden", async () => {
    await repository.save({ ...entry }, "create");
    remoteApi.write.mockRejectedValueOnce(new ApiError(403));
    remoteApi.list.mockResolvedValueOnce({
      items: [
        { ...remoteEvent, id: "incoming", extendedProperties: undefined },
      ],
      nextSyncToken: "next",
    });
    await expect(synchronize(["primary"], async () => {})).rejects.toThrow();
    expect(
      (await repository.all()).find((e) => e.googleId === "incoming")?.kind,
    ).toBe("EVENT");
    expect((await repository.get(entry.id))?.syncState).toBe("pending_create");
  });
});

describe("Google Tasks synchronization", () => {
  const task = {
    id: "task1",
    title: "Google'dan",
    due: "2030-10-07T00:00:00.000Z",
    updated: "2026-10-07T12:00:00.000Z",
    etag: "task-etag",
    status: "needsAction" as const,
  };
  beforeEach(() => {
    nativeTasksApi.list.mockReset();
    nativeTasksApi.get.mockResolvedValue(task);
    nativeTasksApi.write.mockResolvedValue({ ...task, status: "completed" });
  });
  it("imports Tasks independently of Calendar and follows all pages", async () => {
    nativeTasksApi.list
      .mockResolvedValueOnce({ items: [task], nextPageToken: "next" })
      .mockResolvedValueOnce({ items: [{ ...task, id: "task2" }] });
    await synchronize([], async () => {}, ["list1"]);
    expect(
      (await repository.all()).filter((e) => e.provider === "google_tasks"),
    ).toHaveLength(2);
    expect(nativeTasksApi.list).toHaveBeenNthCalledWith(
      2,
      "list1",
      null,
      "next",
    );
    expect(await repository.meta("tasksUpdated:list1")).toBe(task.updated);
    nativeTasksApi.list.mockResolvedValue({ items: [] });
    await synchronize([], async () => {}, ["list1"]);
    expect(nativeTasksApi.list).toHaveBeenLastCalledWith(
      "list1",
      "2026-10-07T11:59:59.000Z",
      undefined,
    );
  });
  it("does not advance its watermark when a later page fails", async () => {
    nativeTasksApi.list
      .mockResolvedValueOnce({ items: [task], nextPageToken: "next" })
      .mockRejectedValueOnce(new Error("offline"));
    await expect(synchronize([], async () => {}, ["list1"])).rejects.toThrow(
      "offline",
    );
    expect(await repository.meta("tasksUpdated:list1")).toBeNull();
  });
  it("uploads completion to Tasks rather than Calendar", async () => {
    nativeTasksApi.list.mockResolvedValue({ items: [task] });
    await synchronize([], async () => {}, ["list1"]);
    const local = (await repository.all())[0]!;
    await repository.save({ ...local, completed: true }, "update");
    remoteApi.write.mockClear();
    await synchronize([], async () => {});
    expect(nativeTasksApi.write).toHaveBeenCalled();
    expect(remoteApi.write).not.toHaveBeenCalled();
    expect((await repository.get(local.id))?.completed).toBe(true);
  });
  it("imports external completion and skips newly undated tasks", async () => {
    nativeTasksApi.list.mockResolvedValue({
      items: [task, { ...task, id: "undated", due: undefined }],
    });
    await synchronize([], async () => {}, ["list1"]);
    expect(await repository.all()).toHaveLength(1);
    nativeTasksApi.list.mockResolvedValue({
      items: [
        {
          ...task,
          status: "completed",
          hidden: true,
          updated: "2026-10-07T13:00:00.000Z",
        },
      ],
    });
    await synchronize([], async () => {}, ["list1"]);
    expect((await repository.all())[0]?.completed).toBe(true);
  });
});
