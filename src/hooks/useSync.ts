import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useStore, savePreferences } from "../storage/store";
import { synchronize } from "../sync/syncEngine";
import {
  tasksApi,
  GoogleTasksError,
  tasksErrorMessage,
} from "../services/googleTasksService";
import { api } from "../services/googleCalendarService";
import { repository } from "../storage/taskRepository";
import { database } from "../storage/database";
import { Calendar } from "../types/models";
import { createForegroundSyncHandler } from "../sync/syncTriggers";
let lastAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
async function scheduleRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  // Only failed/pending mutations receive a bounded retry, never a Calendar poll.
  const row = await (
    await database()
  ).getFirstAsync<{ due: number | null }>(
    "SELECT MIN(next_attempt) AS due FROM queue WHERE next_attempt<? AND attempts<6",
    Number.MAX_SAFE_INTEGER,
  );
  if (row?.due !== null && row?.due !== undefined)
    retryTimer = setTimeout(
      () => {
        retryTimer = undefined;
        if (AppState.currentState === "active") void runSync(true);
      },
      Math.max(1000, row.due - Date.now()),
    );
}
let activeSync: Promise<void> | null = null;
let followUpRequested = false;
export function runSync(force = false): Promise<void> {
  if (!useStore.getState().account) return Promise.resolve();
  if (activeSync) {
    // Do not lose a foreground/manual/write trigger during an in-flight pull.
    if (force) followUpRequested = true;
    return activeSync;
  }
  if (!force && Date.now() - lastAttempt < 60000) return Promise.resolve();
  activeSync = (async () => {
    let connected = false;
    useStore.setState({ syncing: true, error: null });
    try {
      do {
        followUpRequested = false;
        const connection = await NetInfo.fetch();
        connected = connection.isConnected !== false;
        if (!connected || !useStore.getState().account) break;
        lastAttempt = Date.now();
        try {
          const calendars = await api.calendars();
          useStore.setState({ calendars });
          await repository.setMeta("calendars", JSON.stringify(calendars));
          const prefs = useStore.getState().prefs;
          if (prefs.calendarId === "primary") {
            const calendar =
              calendars.find((c) => c.primary) ??
              calendars.find((c) => ["owner", "writer"].includes(c.accessRole));
            if (calendar)
              await savePreferences({ ...prefs, calendarId: calendar.id });
          }
          let taskListIds: string[] = [];
          if (useStore.getState().tasksEnabled) {
            try {
              const taskLists = await tasksApi.lists();
              taskListIds = taskLists.map((list) => list.id);
              useStore.setState({ taskLists, tasksError: null });
            } catch (error) {
              useStore.setState({ tasksError: tasksErrorMessage(error) });
            }
          }
          await synchronize(
            calendars
              .filter((c) =>
                ["owner", "writer", "reader"].includes(c.accessRole),
              )
              .map((c) => c.id),
            useStore.getState().reload,
            taskListIds,
          );
          useStore.setState({ error: null });
        } catch (error) {
          if (error instanceof GoogleTasksError) {
            useStore.setState({ tasksError: tasksErrorMessage(error) });
          } else
            useStore.setState({
              error:
                "Senkronizasyon şu anda yapılamadı. Değişikliklerin cihazda kayıtlı.",
            });
        }
      } while (followUpRequested && useStore.getState().account);
    } catch {
      useStore.setState({
        error: "Bağlantı kontrol edilemedi. Değişikliklerin cihazda kayıtlı.",
      });
    } finally {
      useStore.setState({ syncing: false });
      if (connected) await scheduleRetry();
    }
  })().finally(() => {
    activeSync = null;
    // A trigger arriving during final cache/retry housekeeping also needs a pass.
    if (followUpRequested && useStore.getState().account) {
      followUpRequested = false;
      return runSync(true);
    }
  });
  return activeSync;
}
export async function manualSync() {
  await (
    await database()
  ).runAsync(
    "UPDATE queue SET next_attempt=0,attempts=0 WHERE next_attempt<?",
    Number.MAX_SAFE_INTEGER,
  );
  await runSync(true);
}
export function useSync() {
  const account = useStore((s) => s.account);
  useEffect(() => {
    if (!account) return;
    void repository.meta("calendars").then((v) => {
      if (v) useStore.setState({ calendars: JSON.parse(v) as Calendar[] });
    });
    void runSync(true);
    // Foreground and reconnection are triggers. No continuous background polling.
    const onForeground = createForegroundSyncHandler(async () => {
      await useStore.getState().reload();
      await runSync(true);
    }, AppState.currentState);
    const state = AppState.addEventListener("change", onForeground);
    const network = NetInfo.addEventListener((s) => {
      if (s.isConnected) void runSync(true);
    });
    return () => {
      state.remove();
      network();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [account]);
  return runSync;
}
