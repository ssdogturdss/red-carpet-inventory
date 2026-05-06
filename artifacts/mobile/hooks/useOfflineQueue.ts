import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@rci_offline_queue_v1";

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
    msg.includes("Failed to fetch")
  );
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedCount[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const q = await getQueue();
    setQueue(q);
  }, []);

  const checkConnectivity = useCallback(async () => {
    try {
      const resp = await fetch("/api/healthz", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(3000) });
      setIsOnline(resp.ok);
      return resp.ok;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
    checkConnectivity();
    intervalRef.current = setInterval(async () => {
      const online = await checkConnectivity();
      if (online) {
        const q = await getQueue();
        if (q.length > 0) syncQueue(q);
      }
    }, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const syncQueue = useCallback(async (items?: QueuedCount[]) => {
    const toSync = items ?? await getQueue();
    if (!toSync.length || syncing) return;
    setSyncing(true);
    for (const item of toSync) {
      try {
        const resp = await fetch("/api/inventory/counts", {
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
        if (resp.ok) await removeFromQueue(item.id);
      } catch {
        break;
      }
    }
    await refresh();
    setSyncing(false);
  }, [syncing, refresh]);

  const addToQueue = useCallback(async (item: Omit<QueuedCount, "id" | "timestamp">) => {
    await enqueueCount(item);
    await refresh();
  }, [refresh]);

  return { queue, isOnline, syncing, syncQueue, addToQueue, refresh, checkConnectivity };
}
