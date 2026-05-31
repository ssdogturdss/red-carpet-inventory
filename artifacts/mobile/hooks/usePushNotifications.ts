import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NOTIF_MIN_SEVERITY_KEY = "@rci_notif_min_severity";

const BASE_URL =
  typeof window !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : typeof window !== "undefined"
    ? window.location.origin
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

async function registerToken(minSeverity: string = "warning") {
  if (Platform.OS === "web") return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  try {
    await fetch(`${BASE_URL}/api/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS, minSeverity }),
    });
  } catch {
  }
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_MIN_SEVERITY_KEY).then((saved) => {
      registerToken(saved ?? "warning");
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      try {
        // Navigate to admin tab and signal it to show the Alerts section
        router.navigate({
          pathname: "/(tabs)/admin",
          params: { fromNotification: "1" },
        } as Parameters<typeof router.navigate>[0]);
      } catch {
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
