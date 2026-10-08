import { View, Text, Alert } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { useStore, savePreferences } from "../storage/store";
import { Button, Choices } from "../components/Controls";
import { TaskList } from "../components/TaskList";
import { Occurrence } from "../types/models";
import { manualSync } from "../hooks/useSync";
export function HomeScreen({
  onConnectTasks,
  connectingTasks,
  onSettings,
  onAdd,
  onEdit,
  onComplete,
}: {
  onConnectTasks: () => void;
  connectingTasks: boolean;
  onSettings: () => void;
  onAdd: () => void;
  onEdit: (e: Occurrence) => void;
  onComplete: (e: Occurrence) => void;
}) {
  const c = useTheme();
  const { prefs, error, tasksEnabled, tasksError } = useStore();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: c.text, fontSize: 30, fontWeight: "600" }}>
          Görevler
        </Text>
        <Button secondary label="Ayarlar" onPress={onSettings} />
      </View>
      <Button secondary label="＋ Yeni görev ekle" onPress={onAdd} />
      {!tasksEnabled && (
        <Button
          secondary
          label={connectingTasks ? "Bağlanıyor…" : "Google görevlerini bağla"}
          disabled={connectingTasks}
          onPress={onConnectTasks}
        />
      )}
      {tasksError && (
        <Text accessibilityRole="alert" style={{ color: c.muted }}>
          {tasksError}
        </Text>
      )}
      <Choices
        values={[
          { value: 7, label: "7 gün" },
          { value: 30, label: "30 gün" },
        ]}
        value={prefs.days}
        onChange={(days) =>
          void savePreferences({ ...prefs, days }).catch((e) =>
            Alert.alert("Kaydedilemedi", String(e)),
          )
        }
      />
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ color: c.muted, fontSize: 13 }}
        >
          {error}
        </Text>
      )}
      <TaskList
        onEdit={onEdit}
        onComplete={onComplete}
        onRefresh={() => void manualSync()}
      />
    </View>
  );
}
