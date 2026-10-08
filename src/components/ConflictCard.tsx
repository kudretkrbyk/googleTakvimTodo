import { View, Text } from "react-native";
import { Entry } from "../types/models";
import { Conflict } from "../services/conflictService";
import { useTheme } from "../hooks/useTheme";
import { dayLabel, startDay, timeLabel } from "../utils/dates";
import { Button } from "./Controls";
export function ConflictCard({
  item,
  onResolve,
}: {
  item: Conflict;
  onResolve: (keepLocal: boolean) => void;
}) {
  const c = useTheme();
  const local = JSON.parse(item.local_data) as Entry;
  const remote = JSON.parse(item.remote_data) as Entry;
  const version = (entry: Entry, label: string) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 17 }}>{entry.title}</Text>
      <Text style={{ color: c.muted }}>
        {entry.deleted
          ? "Silindi"
          : entry.undated
            ? "Tarihsiz"
            : `${dayLabel(startDay(entry.start))} · ${timeLabel(entry.start)}${entry.completed ? " · Tamamlandı" : ""}`}
      </Text>
    </View>
  );
  return (
    <View
      style={{
        backgroundColor: c.surface,
        padding: 16,
        gap: 16,
        borderRadius: 12,
      }}
    >
      <Text style={{ color: c.text, fontWeight: "600" }}>
        İki farklı değişiklik var
      </Text>
      {version(local, "Bu cihaz")}
      {version(
        remote,
        remote.provider === "google_tasks" ? "Google Tasks" : "Google Takvim",
      )}
      <Button
        label="Cihazdaki değişikliği kullan"
        onPress={() => onResolve(true)}
      />
      <Button
        secondary
        label="Google’daki değişikliği kullan"
        onPress={() => onResolve(false)}
      />
    </View>
  );
}
