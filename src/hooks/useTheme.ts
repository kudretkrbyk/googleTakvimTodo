import { useColorScheme } from "react-native";
import { useStore } from "../storage/store";
import { palettes } from "../theme/theme";
export function useTheme() {
  const system = useColorScheme();
  const mode = useStore((s) => s.prefs.theme);
  return palettes[
    (mode === "system" ? system : mode) === "dark" ? "dark" : "light"
  ];
}
