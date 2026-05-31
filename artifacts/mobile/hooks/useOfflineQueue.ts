import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";

const QUEUE_KEY = "@rci_offline_queue_v1";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface QueuedCount {
  id: string;
  timestamp: number;
  storeId: number;
  storeName: string;
  weekOf: string;
  submittedBy: string;
  notes: string | null;
  entries: { chemicalId: number; quantity: number }[];
}

export async function enqueueCount(item: Omit<QueuedCount, "id" | "timestamp">): Promise<void> {
  const existing = await getQueue();
  const queued: QueuedCount = { ...item, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() };
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, queued]));
}

export async function getQueue(): Promise<QueuedCount[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const existing = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing.filter((q) => q.id !== id)));
}

export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const msg = (e as Error)?.message ?? "";
  return (
    msg.includes("Network request failed") ||
    msg.includes("fetch") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("timeout") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError")
  );
}

async function pingServer(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/api/healthz`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export type SyncResult = "success" | "error" | null;

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedCount[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult>(null);
  const syncingRef = useRef(false);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const q = await getQueue();
    setQueue(q);
    return q;
  }, []);

  const showResult = useCallback((result: SyncResult) => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setSyncResult(result);
    resultTimer.current = setTimeout(() => setSyncResult(null), 3500);
  }, []);

  const doSync = useCallback(async (items: QueuedCount[]) => {
    if (!items.length || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    let failed = false;
    for (const item of items) {
      try {
        const resp = await fetch(`${BASE_URL}/api/inventory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: item.storeId,
            weekOf: item.weekOf,
            submittedBy: item.submittedBy,
            notes: item.notes,
            entries: item.entries,
          }),
        });
        if (resp.ok) {
          await removeFromQueue(item.id);
        } else {
          failed = true;
          break;
        }
      } catch {
        failed = true;
        break;
      }
    }
    const remaining = await refresh();
    syncingRef.current = false;
    setSyncing(false);
    showResult(failed || remaining.length > 0 ? "error" : "success");
  }, [refresh, showResult]);

  const syncQueue = useCallback(async () => {
    const items = await getQueue();
    await doSync(items);
  }, [doSync]);

  const addToQueue = useCallback(async (item: Omit<QueuedCount, "id" | "timestamp">) => {
    await enqueueCount(item);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();

    if (Platform.OS === "web") {
      const handleOnline = () => {
        setIsOnline(true);
        refresh().then((q) => { if (q.length > 0) doSync(q); });
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      setIsOnline(navigator.onLine);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    } else {
      const unsubscribe = NetInfo.addEventListener((state) => {
        const connected = !!(state.isConnected && state.isInternetReachable !== false);
        setIsOnline(connected);
        if (connected) {
          pingServer().then((reachable) => {
            if (reachable) {
              refresh().then((q) => { if (q.length > 0) doSync(q); });
            }
          });
        }
      });

      NetInfo.fetch().then((state) => {
        setIsOnline(!!(state.isConnected && state.isInternetReachable !== false));
      });

      return unsubscribe;
    }
  }, []);

  return { queue, isOnline, syncing, syncResult, syncQueue, addToQueue, refresh };
}
