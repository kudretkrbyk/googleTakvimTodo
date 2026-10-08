import { NativeModules, Platform } from "react-native";
import { Entry } from "../types/models";
import { widgetSnapshot } from "../utils/widgetData";
interface WidgetBridge {
  update: (json: string, days: number) => Promise<void>;
}
export async function updateWidget(entries: Entry[], days: number) {
  const bridge = NativeModules.TaskWidgetBridge as WidgetBridge | undefined;
  if (Platform.OS !== "android" || !bridge) return;
  try {
    await bridge.update(JSON.stringify(widgetSnapshot(entries)), days);
  } catch (error) {
    console.warn("Widget cache update failed", error);
  } // A native widget failure must not invalidate a committed task.
}
