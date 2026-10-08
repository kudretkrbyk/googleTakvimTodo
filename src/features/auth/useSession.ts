import { useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  savedAccount,
  savedTasksConnection,
  enableGoogleTasks,
  signIn,
  restoreAuth,
  signOut,
} from "../../services/googleAuthService";
import { repository } from "../../storage/taskRepository";
import {
  useStore,
  savePreferences,
  defaultPreferences,
} from "../../storage/store";
import { Preferences } from "../../types/models";
import { api } from "../../services/googleCalendarService";
import { runSync } from "../../hooks/useSync";
export function useSession() {
  const [connecting, setConnecting] = useState(false);
  const [calendarChoice, setCalendarChoice] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const prefs = await repository.meta("preferences");
        if (prefs)
          useStore.setState({ prefs: JSON.parse(prefs) as Preferences });
        await useStore.getState().reload();
        const account = await savedAccount();
        if (account) {
          try {
            await restoreAuth();
          } catch {
            useStore.setState({ error: "Google hesabını yeniden bağla." });
          }
          useStore.setState({
            account,
            tasksEnabled: await savedTasksConnection(),
          });
        }
      } catch (e) {
        Alert.alert("Başlatılamadı", String(e));
      }
    })();
  }, []);
  async function connect() {
    setConnecting(true);
    try {
      const account = await signIn();
      useStore.setState({
        account,
        tasksEnabled: await savedTasksConnection(),
      });
      const calendars = await api.calendars();
      useStore.setState({ calendars });
      const prefs = useStore.getState().prefs;
      if (prefs.calendarId === "primary") {
        const calendar =
          calendars.find((c) => c.primary) ??
          calendars.find((c) => ["owner", "writer"].includes(c.accessRole));
        if (calendar)
          await savePreferences({ ...prefs, calendarId: calendar.id });
      }
      setCalendarChoice(true);
      void runSync(true);
    } catch (e) {
      Alert.alert("Bağlanamadı", e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }
  async function connectTasks() {
    setConnecting(true);
    try {
      await enableGoogleTasks();
      useStore.setState({ tasksEnabled: true });
      await runSync(true);
    } catch (e) {
      Alert.alert(
        "Görevler bağlanamadı",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setConnecting(false);
    }
  }
  async function disconnect() {
    try {
      const state = useStore.getState();
      if (state.syncing)
        throw new Error("Senkronizasyon tamamlanınca tekrar dene.");
      if (state.entries.some((e) => e.syncState !== "synced"))
        throw new Error(
          "Gönderilmemiş değişiklikler var. Önce senkronize et veya çakışmaları çöz.",
        );
      await signOut();
      useStore.setState({ account: null });
      await repository.clear();
      useStore.setState({
        entries: [],
        calendars: [],
        taskLists: [],
        tasksEnabled: false,
        tasksError: null,
        prefs: defaultPreferences,
        error: null,
        lastSync: null,
      });
      await state.reload();
      return true;
    } catch (e) {
      Alert.alert("Çıkış yapılamadı", String(e));
      return false;
    }
  }
  return {
    connecting,
    calendarChoice,
    setCalendarChoice,
    connect,
    connectTasks,
    disconnect,
  };
}
