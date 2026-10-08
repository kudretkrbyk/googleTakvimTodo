import { View, Text } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { Button } from "../components/Controls";
export function OnboardingScreen({
  connecting,
  onConnect,
}: {
  connecting: boolean;
  onConnect: () => void;
}) {
  const c = useTheme();
  return (
    <View style={{ flex: 1, padding: 28, justifyContent: "center", gap: 24 }}>
      <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>
        SADE
      </Text>
      <Text style={{ color: c.text, fontSize: 36, fontWeight: "600" }}>
        Görevlerini daha sade yönet.
      </Text>
      <Text style={{ color: c.muted, fontSize: 18, lineHeight: 28 }}>
        Google Takvim’inle senkronize et. Planların her zaman yanında.
      </Text>
      <Button
        label={connecting ? "Bağlanıyor…" : "Google ile devam et"}
        disabled={connecting}
        onPress={onConnect}
      />
    </View>
  );
}
