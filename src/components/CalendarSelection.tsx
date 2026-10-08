import { Modal, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { useStore, savePreferences } from "../storage/store";
import { Button, Choices } from "./Controls";
export function CalendarSelection({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useTheme();
  const { calendars, prefs } = useStore();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: c.background, padding: 24, gap: 24 }}
      >
        <Text style={{ color: c.text, fontSize: 26 }}>
          Varsayılan takvimini seç
        </Text>
        <Choices
          values={calendars
            .filter((v) => ["owner", "writer"].includes(v.accessRole))
            .map((v) => ({ value: v.id, label: v.summary }))}
          value={prefs.calendarId}
          onChange={(calendarId) =>
            void savePreferences({ ...prefs, calendarId }).catch((e) =>
              Alert.alert("Kaydedilemedi", String(e)),
            )
          }
        />
        <Button label="Devam et" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}
