import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Entry } from "../types/models";
import { useTheme } from "../hooks/useTheme";
import { useStore } from "../storage/store";
import { Button, Field, Choices } from "../components/Controls";
import { dateKey, startDay, toStart, timeLabel } from "../utils/dates";
import { recurrenceRule, weekdays } from "../utils/recurrence";
import { saveTask, deleteTask } from "../services/taskService";
export function EditorScreen({
  entry,
  onDone,
}: {
  entry?: Entry;
  onDone: () => void;
}) {
  const c = useTheme();
  const nativeTask = entry?.provider === "google_tasks";
  const { prefs, calendars, taskLists } = useStore();
  const [title, setTitle] = useState(entry?.title ?? "");
  const [date, setDate] = useState(
    entry ? startDay(entry.start) : dateKey(new Date()),
  );
  const [time, setTime] = useState(
    entry && !entry.allDay ? timeLabel(entry.start) : "",
  );
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [mode, setMode] = useState(
    entry?.recurrence.length ? "preserve" : "none",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [calendar, setCalendar] = useState(
    entry?.calendarId ?? prefs.calendarId,
  );
  const [busy, setBusy] = useState(false);
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", {
    weekday: "long",
  });
  const save = async () => {
    setBusy(true);
    try {
      await saveTask(
        {
          title,
          start: toStart(date, time),
          allDay: !time,
          recurrence:
            mode === "preserve"
              ? (entry?.recurrence ?? [])
              : recurrenceRule(mode, date, selected),
          calendarId: calendar,
        },
        entry,
      );
      await useStore.getState().reload();
      onDone();
    } catch (e) {
      Alert.alert(
        "Kaydedilemedi",
        e instanceof Error ? e.message : "Tekrar dene.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 22 }}
      >
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>
          {entry ? "Düzenle" : "Yeni görev"}
        </Text>
        <Field
          label="Ne yapacaksın?"
          value={title}
          onChangeText={setTitle}
          autoFocus={!entry}
          maxLength={nativeTask ? 1024 : 250}
        />
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted }}>Tarih</Text>
          <Button
            secondary
            label={new Date(`${date}T12:00:00`).toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            onPress={() => setPicker("date")}
          />
        </View>
        {!nativeTask && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted }}>Saat (isteğe bağlı)</Text>
            <Button
              secondary
              label={time || "Tüm gün"}
              onPress={() => setPicker("time")}
            />
            {!!time && (
              <Button
                secondary
                label="Saati kaldır"
                onPress={() => setTime("")}
              />
            )}
          </View>
        )}
        {picker && (
          <DateTimePicker
            value={new Date(`${date}T${time || "09:00"}:00`)}
            mode={picker}
            is24Hour
            onChange={(event, value) => {
              setPicker(null);
              if (event.type === "set" && value) {
                if (picker === "date") setDate(dateKey(value));
                else
                  setTime(
                    `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`,
                  );
              }
            }}
          />
        )}
        {!nativeTask && !entry?.recurringEventId && (
          <>
            <Text style={{ color: c.muted }}>Tekrarlansın mı?</Text>
            <Choices
              values={[
                { value: "none", label: "Hayır" },
                { value: "daily", label: "Her gün" },
                { value: "weekdays", label: "Hafta içi" },
                { value: "weekends", label: "Hafta sonu" },
                { value: "weekly", label: `Her ${weekday}` },
                { value: "custom", label: "Özel" },
                ...(entry?.recurrence.length
                  ? [{ value: "preserve", label: "Mevcut tekrar" }]
                  : []),
              ]}
              value={mode}
              onChange={setMode}
            />
          </>
        )}
        {mode === "custom" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {weekdays.map((d, i) => (
              <Button
                key={d}
                secondary={!selected.includes(d)}
                label={["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][i]!}
                onPress={() =>
                  setSelected(
                    selected.includes(d)
                      ? selected.filter((v) => v !== d)
                      : [...selected, d],
                  )
                }
              />
            ))}
          </View>
        )}
        {nativeTask ? (
          <Text style={{ color: c.muted }}>
            Google görevi ·{" "}
            {taskLists.find((list) => `gtasks:${list.id}` === entry?.calendarId)
              ?.title ?? "Görevler"}
          </Text>
        ) : (
          <>
            <Text style={{ color: c.muted }}>Takvim</Text>
            <Choices
              values={calendars
                .filter((v) => ["owner", "writer"].includes(v.accessRole))
                .map((v) => ({ value: v.id, label: v.summary }))}
              value={calendar}
              onChange={setCalendar}
            />
          </>
        )}
        <Button
          label={busy ? "Kaydediliyor…" : "Kaydet"}
          disabled={busy}
          onPress={() => void save()}
        />
        <Button secondary label="Vazgeç" onPress={onDone} />
        {entry && (
          <Button
            secondary
            label="Sil"
            onPress={() =>
              Alert.alert(
                "Kaydı sil",
                entry.recurrence.length
                  ? "Tüm seri silinecek."
                  : "Bu kayıt silinecek.",
                [
                  { text: "Vazgeç", style: "cancel" },
                  {
                    text: "Sil",
                    style: "destructive",
                    onPress: () => {
                      void deleteTask(entry)
                        .then(() => useStore.getState().reload())
                        .then(onDone)
                        .catch((e) => Alert.alert("Silinemedi", String(e)));
                    },
                  },
                ],
              )
            }
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
