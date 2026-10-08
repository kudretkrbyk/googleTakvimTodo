import { create } from "zustand";
import { Entry, Calendar, Preferences, GoogleTaskList } from "../types/models";
import { repository } from "./taskRepository";
import { updateWidget } from "../services/widgetService";
interface Data {
  entries: Entry[];
  calendars: Calendar[];
  account: string | null;
  tasksEnabled: boolean;
  tasksError: string | null;
  taskLists: GoogleTaskList[];
  prefs: Preferences;
  syncing: boolean;
  error: string | null;
  lastSync: string | null;
}
interface Store extends Data {
  set: (value: Partial<Data>) => void;
  reload: () => Promise<void>;
}
export const defaultPreferences: Preferences = {
  theme: "system",
  days: 7,
  calendarId: "primary",
  widgetDays: 7,
};
export const useStore = create<Store>((set, get) => ({
  entries: [],
  calendars: [],
  account: null,
  tasksEnabled: false,
  tasksError: null,
  taskLists: [],
  prefs: defaultPreferences,
  syncing: false,
  error: null,
  lastSync: null,
  set: (value) => set(value),
  reload: async () => {
    const entries = await repository.all();
    set({ entries, lastSync: await repository.meta("lastSync") });
    await updateWidget(entries, get().prefs.widgetDays);
  },
}));
export async function savePreferences(prefs: Preferences) {
  await repository.setMeta("preferences", JSON.stringify(prefs));
  useStore.setState({ prefs });
  await updateWidget(useStore.getState().entries, prefs.widgetDays);
}
