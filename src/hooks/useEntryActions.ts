import { Alert } from "react-native";
import { Entry, Occurrence } from "../types/models";
import { useStore } from "../storage/store";
import { occurrenceInstance, completeTask } from "../services/taskService";
import { runSync } from "./useSync";
export function useEntryActions(onEdit: (e: Entry) => void) {
  const canWrite = (e: Entry) => {
    const calendar = useStore
      .getState()
      .calendars.find((c) => c.id === e.calendarId);
    if (calendar && !["owner", "writer"].includes(calendar.accessRole)) {
      Alert.alert(
        "Salt okunur takvim",
        "Bu takvimde değişiklik yapma iznin yok.",
      );
      return false;
    }
    return true;
  };
  const edit = (e: Occurrence) => {
    if (!canWrite(e)) return;
    const open = (entry: Entry) => {
      onEdit(entry);
    };
    if (e.recurrence.length)
      Alert.alert("Tekrarlanan kayıt", "Hangi kaydı düzenlemek istiyorsun?", [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Tüm seri",
          onPress: () => {
            const source = useStore
              .getState()
              .entries.find((v) => v.id === e.sourceId);
            if (source) open(source);
          },
        },
        {
          text: "Sadece bu etkinlik",
          onPress: () => {
            void occurrenceInstance(e)
              .then(open)
              .catch((err) => Alert.alert("Açılamadı", String(err)));
          },
        },
      ]);
    else open(e);
  };
  const complete = (e: Occurrence) => {
    if (!canWrite(e)) return;
    const run = async () => {
      try {
        const target = e.recurrence.length ? await occurrenceInstance(e) : e;
        await completeTask(target);
        await useStore.getState().reload();
        void runSync(true);
      } catch (err) {
        Alert.alert("Tamamlanamadı", String(err));
      }
    };
    void run();
  };

  return { edit, complete };
}
