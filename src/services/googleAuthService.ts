import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";
const sessionKey = "sade.account";
// Android Play Services owns the renewable credential; no OAuth client secret or
// backend refresh-token exchange is shipped. Access tokens stay in SecureStore.
export function configureAuth() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    ],
  });
}
export async function signIn(): Promise<string> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
    throw new Error(
      "Google OAuth yapılandırması eksik. README kurulum adımlarını tamamla.",
    );
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result))
    throw new Error("Google bağlantısı iptal edildi.");
  const previous = await savedAccount();
  if (previous && previous !== result.data.user.email) {
    await GoogleSignin.signOut();
    throw new Error("Farklı hesaba geçmeden önce mevcut hesaptan çıkış yap.");
  }
  await SecureStore.setItemAsync(sessionKey, result.data.user.email);
  await accessToken();
  return result.data.user.email;
}
export const savedAccount = () => SecureStore.getItemAsync(sessionKey);
export async function accessToken(force = false): Promise<string> {
  if (force) {
    const old = await SecureStore.getItemAsync("sade.access");
    if (old) await GoogleSignin.clearCachedAccessToken(old);
  }
  const { accessToken: token } = await GoogleSignin.getTokens();
  await SecureStore.setItemAsync("sade.access", token);
  return token;
}
export async function restoreAuth() {
  const result = await GoogleSignin.signInSilently();
  if (result.type !== "success")
    throw new Error("Google hesabını yeniden bağla.");
}
export async function signOut() {
  await GoogleSignin.signOut();
  await SecureStore.deleteItemAsync(sessionKey);
  await SecureStore.deleteItemAsync("sade.tasks");
  await SecureStore.deleteItemAsync("sade.access");
}

const tasksScope = "https://www.googleapis.com/auth/tasks";
export const savedTasksConnection = async () =>
  (await SecureStore.getItemAsync("sade.tasks")) === "enabled";
export async function enableGoogleTasks() {
  const account = await savedAccount();
  if (!account) throw new Error("Önce Google hesabını bağla.");
  const result = await GoogleSignin.addScopes({ scopes: [tasksScope] });
  if (!result || !isSuccessResponse(result))
    throw new Error("Görev izni iptal edildi.");
  if (
    result.data.user.email !== account ||
    !result.data.scopes.includes(tasksScope)
  )
    throw new Error("Aynı Google hesabına görev izni ver.");
  await accessToken(true);
  await SecureStore.setItemAsync("sade.tasks", "enabled");
}
