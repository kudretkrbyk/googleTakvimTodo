import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  secure: new Map<string, string>(),
  configure: vi.fn(),
  scopes: vi.fn(),
  tokens: vi.fn(async () => ({ accessToken: "token" })),
  clear: vi.fn(async () => {}),
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mocks.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mocks.secure.delete(key);
  },
}));
vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: mocks.configure,
    addScopes: mocks.scopes,
    getTokens: mocks.tokens,
    clearCachedAccessToken: mocks.clear,
  },
  isSuccessResponse: (result: { type: string }) => result.type === "success",
}));
import {
  configureAuth,
  enableGoogleTasks,
  savedTasksConnection,
} from "../src/services/googleAuthService";
const scope = "https://www.googleapis.com/auth/tasks";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.secure.clear();
  mocks.secure.set("sade.account", "test@example.com");
});
describe("incremental Tasks permission", () => {
  it("does not request Tasks scope automatically during calendar setup", () => {
    configureAuth();
    expect(mocks.configure.mock.calls[0]![0].scopes).not.toContain(scope);
    expect(mocks.scopes).not.toHaveBeenCalled();
  });
  it("persists capability only after an explicit same-account grant", async () => {
    mocks.scopes.mockResolvedValue({
      type: "success",
      data: { user: { email: "test@example.com" }, scopes: [scope] },
    });
    mocks.secure.set("sade.access", "old-token");
    await enableGoogleTasks();
    expect(mocks.scopes).toHaveBeenCalledWith({ scopes: [scope] });
    expect(mocks.clear).toHaveBeenCalledWith("old-token");
    expect(await savedTasksConnection()).toBe(true);
  });
  it("keeps Calendar session when Tasks consent is cancelled", async () => {
    mocks.scopes.mockResolvedValue({ type: "cancelled" });
    await expect(enableGoogleTasks()).rejects.toThrow("iptal");
    expect(await savedTasksConnection()).toBe(false);
    expect(mocks.secure.get("sade.account")).toBe("test@example.com");
  });
});
