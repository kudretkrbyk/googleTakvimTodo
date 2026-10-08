import React, { useEffect, useState } from "react";
import { ScrollView, Text, Alert } from "react-native";
import { useStore, savePreferences } from "../storage/store";
import { useTheme } from "../hooks/useTheme";
import { Button, Choices } from "../components/Controls";
import {
  listConflicts,
  resolveConflict,
  Conflict,
} from "../services/conflictService";
import { ConflictCard } from "../components/ConflictCard";

export function SettingsScreen({
  onConnectTasks,
  connectingTasks,
  onBack,
  onSync,
  onSignOut,
  onReconnect,
}: {
  onConnectTasks: () => void;
  connectingTasks: boolean;
  onBack: () => void;
  onSync: () => void;
  onSignOut: () => void;
  onReconnect: () => void;
}) {
  const c = useTheme();
  const {
    prefs,
    account,
    calendars,
    syncing,
    lastSync,
    tasksEnabled,
    tasksError,
  } = useStore();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const load = async () => setConflicts(await listConflicts());
  useEffect(() => {
    void load().catch((e) => Alert.alert("İnceleme açılamadı", String(e)));
  }, []);
  const resolve = async (item: Conflict, keepLocal: boolean) => {
    try {
      await resolveConflict(item.id, keepLocal);
      await load();
      await useStore.getState().reload();
      onSync();
    } catch (e) {
      Alert.alert("İşlem yapılamadı", String(e));
    }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Text style={{ color: c.text, fontSize: 28, fontWeight: "600" }}>
        Ayarlar
      </Text>
      <Text style={{ color: c.muted }}>Google hesabı</Text>
      <Text style={{ color: c.text, fontSize: 16 }}>{account}</Text>
      <Button
        secondary
        label="Google hesabını yeniden bağla"
        onPress={onReconnect}
      />

      <Button
        secondary
        label={
          connectingTasks
            ? "Bağlanıyor…"
            : tasksEnabled
              ? "Google görev iznini yenile"
              : "Google görevlerini bağla"
        }
        disabled={connectingTasks}
        onPress={onConnectTasks}
      />
      {tasksError && (
        <Text accessibilityRole="alert" style={{ color: c.muted }}>
          {tasksError}
        </Text>
      )}
      <Text style={{ color: c.muted }}>Varsayılan takvim</Text>
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
      <Text style={{ color: c.muted }}>Tema</Text>
      <Choices
        values={[
          { value: "system", label: "Sistem" },
          { value: "light", label: "Açık" },
          { value: "dark", label: "Koyu" },
        ]}
        value={prefs.theme}
        onChange={(theme) =>
          void savePreferences({ ...prefs, theme }).catch((e) =>
            Alert.alert("Kaydedilemedi", String(e)),
          )
        }
      />
      <Text style={{ color: c.muted }}>Varsayılan görünüm</Text>
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
      <Text style={{ color: c.muted }}>Widget varsayılan görünümü</Text>
      <Choices
        values={[
          { value: 7, label: "7 gün" },
          { value: 30, label: "30 gün" },
        ]}
        value={prefs.widgetDays}
        onChange={(widgetDays) =>
          void savePreferences({ ...prefs, widgetDays }).catch((e) =>
            Alert.alert("Kaydedilemedi", String(e)),
          )
        }
      />
      <Text style={{ color: c.muted }}>
        Son senkronizasyon:{" "}
        {lastSync
          ? new Date(lastSync).toLocaleString("tr-TR")
          : "Henüz yapılmadı"}
      </Text>
      <Button
        label={syncing ? "Senkronize ediliyor…" : "Şimdi senkronize et"}
        disabled={syncing}
        onPress={onSync}
      />
      {conflicts.map((item) => (
        <ConflictCard
          key={item.id}
          item={item}
          onResolve={(keepLocal) => void resolve(item, keepLocal)}
        />
      ))}
      <Button secondary label="Geri" onPress={onBack} />
      <Button
        secondary
        label="Çıkış yap"
        onPress={() =>
          Alert.alert(
            "Çıkış yap",
            "Cihazdaki takvim önbelleği temizlenecek. Gönderilmemiş değişikliklerin varsa önce senkronize et.",
            [
              { text: "Vazgeç", style: "cancel" },
              { text: "Çıkış yap", style: "destructive", onPress: onSignOut },
            ],
          )
        }
      />
    </ScrollView>
  );
}
