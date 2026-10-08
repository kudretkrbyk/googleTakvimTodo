import { useEffect } from "react";
import { AppState } from "react-native";
import { useStore } from "../storage/store";
export function useMidnightRefresh() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const midnight = new Date();
      midnight.setHours(24, 0, 1, 0);
      timer = setTimeout(
        () => {
          if (AppState.currentState === "active")
            void useStore
              .getState()
              .reload()
              .catch(() => {});
          schedule();
        },
        Math.max(1000, midnight.getTime() - Date.now()),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
}
