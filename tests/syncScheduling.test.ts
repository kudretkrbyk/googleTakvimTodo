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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createForegroundSyncHandler } from "../src/sync/syncTriggers";
const runtime = vi.hoisted(() => ({
  state: {
    account: "test@example.com" as string | null,
    syncing: false,
    tasksEnabled: false,
    tasksError: null as string | null,
    error: null as string | null,
    calendars: [],
    prefs: { calendarId: "work", theme: "system", days: 7, widgetDays: 7 },
    reload: vi.fn(async () => {}),
  },
  network: vi.fn(async () => ({ isConnected: true })),
  calendars: vi.fn(async () => [
    { id: "work", summary: "İş", accessRole: "owner" },
  ]),
  engine: vi.fn(async () => {}),
}));
vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: vi.fn() },
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { fetch: runtime.network, addEventListener: vi.fn() },
}));
vi.mock("../src/storage/store", () => ({
  useStore: {
    getState: () => runtime.state,
    setState: (patch: Record<string, unknown>) =>
      Object.assign(runtime.state, patch),
  },
  savePreferences: vi.fn(),
}));
vi.mock("../src/services/googleCalendarService", () => ({
  api: { calendars: runtime.calendars },
}));
vi.mock("../src/sync/syncEngine", () => ({ synchronize: runtime.engine }));
vi.mock("../src/storage/taskRepository", () => ({
  repository: { setMeta: vi.fn(async () => {}), meta: vi.fn(async () => null) },
}));
vi.mock("../src/storage/database", () => ({
  database: async () => ({
    getFirstAsync: async () => ({ due: null }),
    runAsync: async () => {},
  }),
}));
import { runSync } from "../src/hooks/useSync";
beforeEach(() => {
  vi.clearAllMocks();
  runtime.state.account = "test@example.com";
  runtime.state.syncing = false;
  runtime.state.error = null;
  runtime.state.tasksEnabled = false;
  runtime.state.tasksError = null;
  runtime.network.mockResolvedValue({ isConnected: true });
  runtime.engine.mockResolvedValue(undefined);
});
describe("foreground sync triggers", () => {
  it("checks changes on return from Calendar even within a minute", async () => {
    await runSync(true);
    expect(runtime.engine).toHaveBeenCalledTimes(1);
    const foreground = createForegroundSyncHandler(
      () => runSync(true),
      "active",
    );
    foreground("background");
    foreground("active");
    await runSync();
    expect(runtime.engine).toHaveBeenCalledTimes(2);
  });
  it("does not sync repeatedly for duplicate active notifications", () => {
    const refresh = vi.fn(async () => {});
    const handler = createForegroundSyncHandler(refresh, "active");
    handler("active");
    handler("background");
    handler("background");
    expect(refresh).not.toHaveBeenCalled();
    handler("active");
    handler("active");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
describe("sync request scheduling", () => {
  it("coalesces triggers while busy into a follow-up instead of dropping them", async () => {
    let release: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      runtime.engine.mockImplementationOnce(() => {
        resolve();
        return new Promise<void>((done) => {
          release = done;
        });
      });
    });
    const first = runSync(true);
    await started;
    const second = runSync(true);
    const third = runSync(true);
    release();
    await Promise.all([first, second, third]);
    expect(runtime.engine).toHaveBeenCalledTimes(2);
    expect(runtime.state.syncing).toBe(false);
  });
  it("does not call Google while offline", async () => {
    runtime.network.mockResolvedValueOnce({ isConnected: false });
    await runSync(true);
    expect(runtime.calendars).not.toHaveBeenCalled();
    expect(runtime.engine).not.toHaveBeenCalled();
    expect(runtime.state.syncing).toBe(false);
  });
});

it("continues Calendar sync when Tasks API is disabled", async () => {
  runtime.state.tasksEnabled = true;
  nativeTasksApi.lists.mockRejectedValueOnce(new Error("Tasks disabled"));
  await runSync(true);
  expect(runtime.engine).toHaveBeenCalledWith(
    ["work"],
    runtime.state.reload,
    [],
  );
  expect(runtime.state.tasksError).toBe("Görev bağlantısı başarısız");
  expect(runtime.state.error).toBeNull();
});
