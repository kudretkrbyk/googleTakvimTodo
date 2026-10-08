import React, { useEffect, useState } from "react";
import { StatusBar, Linking, BackHandler } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { EditorScreen } from "./src/screens/EditorScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { CalendarSelection } from "./src/components/CalendarSelection";
import { useStore } from "./src/storage/store";
import { configureAuth } from "./src/services/googleAuthService";
import { useTheme } from "./src/hooks/useTheme";
import { useMidnightRefresh } from "./src/hooks/useMidnightRefresh";
import { useSync, manualSync } from "./src/hooks/useSync";
import { useSession } from "./src/features/auth/useSession";
import { useEntryActions } from "./src/hooks/useEntryActions";
import { Entry } from "./src/types/models";
import { palettes } from "./src/theme/theme";
configureAuth();
export default function App() {
  useMidnightRefresh();
  const c = useTheme();
  const account = useStore((s) => s.account);
  const sync = useSync();
  const session = useSession();
  const [page, setPage] = useState<"home" | "settings" | "editor">("home");
  const [editing, setEditing] = useState<Entry | undefined>();
  const actions = useEntryActions((entry) => {
    setEditing(entry);
    setPage("editor");
  });
  const add = () => {
    setEditing(undefined);
    setPage("editor");
  };
  useEffect(() => {
    const open = (url: string) => {
      if (url === "sade://quick-add" || url.startsWith("sade://quick-add?")) {
        setEditing(undefined);
        setPage("editor");
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) open(url);
    });
    const listener = Linking.addEventListener("url", (e) => open(e.url));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === "home") return false;
      setPage("home");
      return true;
    });
    return () => back.remove();
  }, [page]);
  const done = () => {
    setPage("home");
    void sync(true);
  };
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <StatusBar
          barStyle={c === palettes.dark ? "light-content" : "dark-content"}
        />
        {!account ? (
          <OnboardingScreen
            connecting={session.connecting}
            onConnect={() => void session.connect()}
          />
        ) : page === "editor" ? (
          <EditorScreen
            key={editing?.id ?? "new"}
            entry={editing}
            onDone={done}
          />
        ) : page === "settings" ? (
          <SettingsScreen
            onConnectTasks={() => void session.connectTasks()}
            connectingTasks={session.connecting}
            onBack={() => setPage("home")}
            onSync={() => void manualSync()}
            onReconnect={() => void session.connect()}
            onSignOut={() =>
              void session.disconnect().then((ok) => {
                if (ok) setPage("home");
              })
            }
          />
        ) : (
          <HomeScreen
            onConnectTasks={() => void session.connectTasks()}
            connectingTasks={session.connecting}
            onSettings={() => setPage("settings")}
            onAdd={add}
            onEdit={actions.edit}
            onComplete={actions.complete}
          />
        )}
        <CalendarSelection
          visible={session.calendarChoice}
          onClose={() => session.setCalendarChoice(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
