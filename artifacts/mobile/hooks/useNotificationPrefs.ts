import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NOTIF_MIN_SEVERITY_KEY } from "./usePushNotifications";

const BASE_URL =
  typeof window !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : typeof window !== "undefined"
    ? window.location.origin
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export type MinSeverity = "warning" | "critical";

async function updateTokenSeverity(minSeverity: MinSeverity) {
  if (Platform.OS === "web") return;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await fetch(`${BASE_URL}/api/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS, minSeverity }),
    });
  } catch {
  }
}

export function useNotificationPrefs() {
  const [minSeverity, setMinSeverityState] = useState<MinSeverity>("warning");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_MIN_SEVERITY_KEY).then((saved) => {
      if (saved === "critical") setMinSeverityState("critical");
      setLoaded(true);
    });
  }, []);

  const setMinSeverity = useCallback(async (value: MinSeverity) => {
    setMinSeverityState(value);
    await AsyncStorage.setItem(NOTIF_MIN_SEVERITY_KEY, value);
    await updateTokenSeverity(value);
  }, []);

  return { minSeverity, setMinSeverity, loaded };
}
