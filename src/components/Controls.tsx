import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  StyleSheet,
  TextInputProps,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? c.surface : c.accent,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? c.text : c.accentText,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.muted, fontSize: 14 }}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[
          styles.input,
          { backgroundColor: c.surface, color: c.text, borderColor: c.line },
        ]}
      />
    </View>
  );
}
export function Choices<T extends string | number>({
  values,
  value,
  onChange,
}: {
  values: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={styles.choices}>
      {values.map((v) => (
        <Pressable
          key={v.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === v.value }}
          onPress={() => onChange(v.value)}
          style={[
            styles.choice,
            { backgroundColor: value === v.value ? c.accent : c.surface },
          ]}
        >
          <Text
            style={{
              color: value === v.value ? c.accentText : c.text,
              fontSize: 14,
            }}
          >
            {v.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 50,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 17,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
