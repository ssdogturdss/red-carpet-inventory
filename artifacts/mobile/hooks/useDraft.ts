import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "@rci_draft_v1";

export interface CountDraft {
  storeId: number | null;
  storeName: string;
  submittedBy: string;
  quantities: Record<number, string>;
  notes: string;
  savedAt: number;
}

export async function saveDraftRaw(draft: Omit<CountDraft, "savedAt">): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export async function loadDraftRaw(): Promise<CountDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CountDraft;
    if (!parsed.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearDraftRaw(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

const DEBOUNCE_MS = 800;

export function useDraft() {
  const [pendingDraft, setPendingDraft] = useState<CountDraft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDraftRaw().then((d) => {
      setPendingDraft(d);
      setDraftChecked(true);
    });
  }, []);

  const scheduleSave = useCallback(
    (draft: Omit<CountDraft, "savedAt">) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDraftRaw(draft).catch(() => {});
      }, DEBOUNCE_MS);
    },
    []
  );

  const discardDraft = useCallback(async () => {
    setPendingDraft(null);
    await clearDraftRaw();
  }, []);

  const clearOnSubmit = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPendingDraft(null);
    await clearDraftRaw();
  }, []);

  return { pendingDraft, draftChecked, scheduleSave, discardDraft, clearOnSubmit };
}
