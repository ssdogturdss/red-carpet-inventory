import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useGetStores, useGetChemicals, useSubmitInventoryCount } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";
import { useOfflineQueue, isNetworkError } from "@/hooks/useOfflineQueue";
import { useDraft } from "@/hooks/useDraft";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function getWeekOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}

function formatWeekOf(weekOf: string): string {
  const dt = new Date(weekOf + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDraftAge(savedAt: number): string {
  const mins = Math.round((Date.now() - savedAt) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function CountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isOnline, queue, syncing, syncResult, syncQueue, addToQueue, refresh } = useOfflineQueue();
  const { pendingDraft, draftChecked, scheduleSave, discardDraft, clearOnSubmit } = useDraft();
  const { user: currentUser, logout: signOut } = useCurrentUser();

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { mutateAsync: submitCount } = useSubmitInventoryCount();

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [submittedBy, setSubmittedBy] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [weekOf, setWeekOf] = useState(getWeekOf());
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasInteracted = useRef(false);

  const currentWeek = getWeekOf();
  const selectedStore = stores?.find((s) => s.id === selectedStoreId);
  const totalChemicals = chemicals?.length ?? 0;
  const filledCount = (chemicals ?? []).filter((c) => {
    const v = quantities[c.id] ?? "";
    return v.trim() !== "" && parseFloat(v) > 0;
  }).length;
  const progressPct = totalChemicals > 0 ? filledCount / totalChemicals : 0;

  useEffect(() => {
    if (currentUser && !submittedBy && !hasInteracted.current) {
      setSubmittedBy(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!draftChecked || !pendingDraft) return;
    const storeName = pendingDraft.storeName || "unknown store";
    const age = formatDraftAge(pendingDraft.savedAt);
    Alert.alert(
      "Restore Draft?",
      `You have an unsaved count for ${storeName} from ${age}. Restore it?`,
      [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardDraft(),
        },
        {
          text: "Restore",
          onPress: () => {
            if (pendingDraft.storeId !== null) setSelectedStoreId(pendingDraft.storeId);
            setSubmittedBy(pendingDraft.submittedBy);
            setQuantities(pendingDraft.quantities);
            setNotes(pendingDraft.notes);
            if (pendingDraft.weekOf) setWeekOf(pendingDraft.weekOf);
            hasInteracted.current = true;
          },
        },
      ]
    );
  }, [draftChecked]);

  useEffect(() => {
    if (!hasInteracted.current) return;
    const storeName = stores?.find((s) => s.id === selectedStoreId)?.name ?? "";
    scheduleSave({
      storeId: selectedStoreId,
      storeName,
      weekOf,
      submittedBy,
      quantities,
      notes,
    });
  }, [selectedStoreId, submittedBy, quantities, notes, weekOf]);

  const handleQuantityChange = useCallback((chemicalId: number, value: string) => {
    hasInteracted.current = true;
    setQuantities((prev) => ({ ...prev, [chemicalId]: value }));
  }, []);

  const handleStoreSelect = useCallback((storeId: number) => {
    hasInteracted.current = true;
    setSelectedStoreId(storeId);
    setShowStorePicker(false);
    Haptics.selectionAsync();
  }, []);

  const handleSubmittedByChange = useCallback((v: string) => {
    hasInteracted.current = true;
    setSubmittedBy(v);
  }, []);

  const handleNotesChange = useCallback((v: string) => {
    hasInteracted.current = true;
    setNotes(v);
  }, []);

  const handleSubmit = async () => {
    if (!selectedStoreId) {
      Alert.alert("Select Store", "Please select your store before submitting.");
      return;
    }
    if (!submittedBy.trim()) {
      Alert.alert("Enter Name", "Please enter your name before submitting.");
      return;
    }

    const entries = (chemicals ?? []).map((c) => ({
      chemicalId: c.id,
      quantity: parseFloat(quantities[c.id] ?? "0") || 0,
    }));

    const submitData = {
      storeId: selectedStoreId,
      weekOf,
      submittedBy: submittedBy.trim(),
      userId: (currentUser && currentUser.id > 0) ? currentUser.id : null,
      notes: notes.trim() || null,
      entries,
    };

    setSubmitting(true);
    try {
      await Promise.race([
        submitCount({ data: submitData }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Network timeout: server did not respond")), 25000)
        ),
      ]);
      await clearOnSubmit();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries();
      setSubmitted(true);
    } catch (e) {
      if (isNetworkError(e)) {
        Alert.alert(
          "Can't Reach Server",
          "The server didn't respond. Save this count locally and it will sync automatically when you're back online.",
          [
            { text: "Discard", style: "destructive" },
            {
              text: "Save Offline",
              onPress: async () => {
                await addToQueue({
                  storeId: selectedStoreId,
                  storeName: selectedStore?.name ?? "Unknown",
                  weekOf: currentWeek,
                  submittedBy: submitData.submittedBy,
                  notes: submitData.notes,
                  entries,
                });
                await clearOnSubmit();
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setSavedOffline(true);
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", "Failed to submit count. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSavedOffline(false);
    setSelectedStoreId(null);
    setSubmittedBy("");
    setQuantities({});
    setNotes("");
    hasInteracted.current = false;
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16 + webTop,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: colors.navy,
    },
    headerLabel: { fontSize: 11, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
    headerTitle: { fontSize: 30, color: "#fff", fontFamily: "Inter_700Bold" },
    headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginTop: 4 },
    progressWrap: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    progressLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    progressCount: { fontSize: 12, fontFamily: "Inter_700Bold", color: filledCount === totalChemicals && totalChemicals > 0 ? colors.success : colors.primary },
    progressTrack: { height: 5, backgroundColor: colors.secondary, borderRadius: 3, overflow: "hidden" },
    progressFill: {
      height: 5,
      borderRadius: 3,
      backgroundColor: filledCount === totalChemicals && totalChemicals > 0 ? colors.success : colors.primary,
      width: `${Math.round(progressPct * 100)}%`,
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: insets.bottom + 100 + webBottom },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 20,
    },
    sectionLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 },
    sectionDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 10 },
    dividerAccent: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.teal },
    storeBtn: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    storeBtnText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground },
    storeBtnPlaceholder: { color: colors.mutedForeground },
    storeList: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
      overflow: "hidden",
    },
    storeItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    storeItemText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    storeItemActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    nameInput: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    chemicalRow: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    chemicalRowFilled: { borderColor: colors.teal + "60", backgroundColor: colors.tealSurface },
    chemicalInfo: { flex: 1 },
    chemicalName: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    chemicalUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    quantityInput: {
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: 90,
      textAlign: "right",
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      borderWidth: 1,
      borderColor: "transparent",
    },
    quantityInputFilled: { borderColor: colors.teal + "80", backgroundColor: colors.tealSurface },
    notesInput: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      minHeight: 90,
      textAlignVertical: "top",
    },
    notesHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 6 },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      padding: 18,
      alignItems: "center",
      marginTop: 24,
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
    successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
    successIcon: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.successSurface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      borderWidth: 3,
      borderColor: colors.successBorder,
    },
    successTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    successSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginTop: 10, lineHeight: 22 },
    successStore: { fontFamily: "Inter_600SemiBold", color: colors.foreground },
    newCountBtn: {
      marginTop: 32,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    newCountBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
    offlineSuccessIcon: { backgroundColor: colors.offlineSurface, borderColor: colors.offlineBorder },
  });

  if (submitted || savedOffline) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
          <Text style={styles.headerTitle}>Count Entry</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, savedOffline && styles.offlineSuccessIcon]}>
            <Feather name={savedOffline ? "clock" : "check"} size={44} color={savedOffline ? "#92400e" : colors.success} />
          </View>
          <Text style={styles.successTitle}>
            {savedOffline ? "Saved Offline" : "Count Submitted!"}
          </Text>
          <Text style={styles.successSub}>
            {savedOffline
              ? `Count for ${selectedStore?.name} saved locally. It will sync automatically when you're back online.`
              : <>Your count for <Text style={styles.successStore}>{selectedStore?.name}</Text> has been saved. Alerts fire automatically if any readings are out of range.</>
            }
          </Text>
          <TouchableOpacity style={styles.newCountBtn} onPress={handleReset}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.newCountBtnText}>Submit Another Count</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner isOnline={isOnline} queueLength={queue.length} syncing={syncing} syncResult={syncResult} onSync={syncQueue} />
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Text style={styles.headerTitle}>Count Entry</Text>
          {currentUser && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Sign Out", `Sign out as ${currentUser.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign Out", style: "destructive", onPress: () => signOut() },
                ]);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 4 }}
            >
              <Feather name="log-out" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular" }}>{currentUser.name}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerSubtitle}>Week of {formatWeekOf(currentWeek)}</Text>
      </View>

      {/* Progress bar */}
      {totalChemicals > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Chemicals filled</Text>
            <Text style={styles.progressCount}>{filledCount} / {totalChemicals}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionDivider}>
          <View style={styles.dividerAccent} />
          <Text style={styles.sectionLabel}>Store</Text>
        </View>
        <TouchableOpacity style={styles.storeBtn} onPress={() => setShowStorePicker(!showStorePicker)}>
          <Text style={[styles.storeBtnText, !selectedStore && styles.storeBtnPlaceholder]}>
            {selectedStore?.name ?? "Select your store..."}
          </Text>
          <Feather name={showStorePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {showStorePicker && (
          <View style={styles.storeList}>
            {(stores ?? []).map((store, idx) => (
              <TouchableOpacity
                key={store.id}
                style={[styles.storeItem, idx === (stores?.length ?? 0) - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleStoreSelect(store.id)}
              >
                <Text style={[styles.storeItemText, selectedStoreId === store.id && styles.storeItemActive]}>
                  {store.name}
                </Text>
                {selectedStoreId === store.id && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.sectionDivider}>
          <View style={styles.dividerAccent} />
          <Text style={styles.sectionLabel}>Your Name</Text>
        </View>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your name..."
          placeholderTextColor={colors.mutedForeground}
          value={submittedBy}
          onChangeText={handleSubmittedByChange}
          returnKeyType="done"
        />

        <View style={styles.sectionDivider}>
          <View style={styles.dividerAccent} />
          <Text style={styles.sectionLabel}>Chemicals ({filledCount}/{totalChemicals} filled)</Text>
        </View>
        {(chemicals ?? []).map((chemical) => {
          const val = quantities[chemical.id] ?? "";
          const filled = val.trim() !== "" && parseFloat(val) > 0;
          return (
            <View key={chemical.id} style={[styles.chemicalRow, filled && styles.chemicalRowFilled]}>
              <View style={styles.chemicalInfo}>
                <Text style={styles.chemicalName}>{chemical.name}</Text>
                <Text style={styles.chemicalUnit}>{chemical.unit}</Text>
              </View>
              {filled && <Feather name="check-circle" size={14} color={colors.teal} style={{ marginRight: 8 }} />}
              <TextInput
                style={[styles.quantityInput, filled && styles.quantityInputFilled]}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={val}
                onChangeText={(v) => handleQuantityChange(chemical.id, v)}
                returnKeyType="done"
              />
            </View>
          );
        })}

        <View style={styles.sectionDivider}>
          <View style={styles.dividerAccent} />
          <Text style={styles.sectionLabel}>Notes (optional)</Text>
        </View>
        <TextInput
          style={styles.notesInput}
          placeholder="Add observations, special conditions, or instructions..."
          placeholderTextColor={colors.mutedForeground}
          value={notes}
          onChangeText={handleNotesChange}
          multiline
          numberOfLines={4}
          returnKeyType="default"
        />
        <Text style={styles.notesHint}>Notes are saved with the submission for future reference.</Text>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={isOnline ? "send" : "upload-cloud"} size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Count</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
