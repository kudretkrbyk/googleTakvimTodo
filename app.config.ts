import { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Sade",
  slug: "sade-calendar",
  version: "1.0.0",
  scheme: "sade",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  android: {
    package: "com.sade.calendar",
    permissions: ["android.permission.RECEIVE_BOOT_COMPLETED"],
    allowBackup: false,
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.VIBRATE",
    ],
  },
  ios: { bundleIdentifier: "com.sade.calendar" },
  plugins: [
    "expo-dev-client",
    "expo-sqlite",
    "expo-secure-store",
    "expo-localization",
    "@react-native-community/datetimepicker",
    ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
      ? [
          [
            "@react-native-google-signin/google-signin",
            {
              iosUrlScheme: `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "")}`,
            },
          ] as [string, Record<string, string>],
        ]
      : ["@react-native-google-signin/google-signin"]),
    "./plugins/withTaskWidget",
    "./plugins/withReleaseSigning",
  ],
  extra: {},
};
export default config;
