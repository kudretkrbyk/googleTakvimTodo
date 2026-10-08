import React, { useMemo } from "react";
import { SectionList, View, Text, Pressable, StyleSheet } from "react-native";
import { useStore } from "../storage/store";
import { useTheme } from "../hooks/useTheme";
import { expandEntries } from "../utils/recurrence";
import { startDay, dayLabel, timeLabel } from "../utils/dates";
import { Occurrence } from "../types/models";
export function TaskList({
  onEdit,
  onComplete,
  onRefresh,
}: {
  onEdit: (e: Occurrence) => void;
  onComplete: (e: Occurrence) => void;
  onRefresh: () => void;
}) {
  const { entries, prefs, syncing } = useStore();
  const c = useTheme();
  const sections = useMemo(() => {
    const grouped = new Map<string, Occurrence[]>();
    for (const e of expandEntries(entries, prefs.days)) {
      const day = startDay(e.start);
      grouped.set(day, [...(grouped.get(day) ?? []), e]);
    }
    return [...grouped].map(([day, data]) => ({ title: dayLabel(day), data }));
  }, [entries, prefs.days]);
  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.occurrenceKey}
      refreshing={syncing}
      onRefresh={onRefresh}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
      ListEmptyComponent={
        <View style={{ paddingVertical: 80, gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 22 }}>
            Yaklaşan görev yok
          </Text>
          <Text style={{ color: c.muted, fontSize: 16 }}>
            Yeni bir görev ekleyerek başlayabilirsin.
          </Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={[styles.heading, { color: c.muted }]}>
          {section.title.toLocaleUpperCase("tr-TR")}
        </Text>
      )}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderColor: c.line }]}>
          {item.kind === "TASK" ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`${item.title} tamamla`}
              accessibilityState={{ checked: item.completed }}
              onPress={() => onComplete(item)}
              style={styles.checkTouch}
            >
              <View style={[styles.check, { borderColor: c.muted }]} />
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${timeLabel(item.start)} ${item.title}, düzenle`}
            onPress={() => onEdit(item)}
            style={{ flex: 1, paddingVertical: 16, gap: 6 }}
          >
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {item.provider === "google_tasks"
                ? "Google görevi"
                : timeLabel(item.start)}
            </Text>
            <Text style={{ color: c.text, fontSize: 18 }}>{item.title}</Text>
            {(item.recurrence.length > 0 || item.recurringEventId) && (
              <Text style={{ color: c.muted, fontSize: 12 }}>
                ↻ Tekrarlanan {item.kind === "TASK" ? "görev" : "etkinlik"}
              </Text>
            )}
          </Pressable>
          {item.syncState === "sync_error" && (
            <Text
              accessibilityLabel="Değişiklik için inceleme gerekiyor"
              style={{ color: c.danger }}
            >
              !
            </Text>
          )}
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({
  heading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 28,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkTouch: { width: 44, minHeight: 60, justifyContent: "center" },
  check: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 6 },
});
