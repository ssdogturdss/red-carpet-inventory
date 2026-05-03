import React, { useState, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useGetStores, useGetChemicals, useSubmitInventoryCount } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

function getWeekOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}

export default function CountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { mutateAsync: submitCount, isPending: submitting } = useSubmitInventoryCount();

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [submittedBy, setSubmittedBy] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const currentWeek = getWeekOf();

  const selectedStore = stores?.find((s) => s.id === selectedStoreId);

  const handleQuantityChange = useCallback((chemicalId: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [chemicalId]: value }));
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

    try {
      await submitCount({
        data: {
          storeId: selectedStoreId,
          weekOf: currentWeek,
          submittedBy: submittedBy.trim(),
          entries,
        },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries();
      setSubmitted(true);
    } catch {
      Alert.alert("Error", "Failed to submit count. Please try again.");
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSelectedStoreId(null);
    setSubmittedBy("");
    setQuantities({});
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
    headerLabel: {
      fontSize: 12,
      color: colors.tealLight,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    headerTitle: { fontSize: 28, color: "#fff", fontFamily: "Inter_700Bold" },
    headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 4 },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: insets.bottom + 100 + webBottom },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 20,
    },
    storeBtn: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
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
      borderRadius: colors.radius,
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
    storeItemActive: { color: colors.primary },
    nameInput: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    chemicalRow: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    chemicalInfo: { flex: 1 },
    chemicalName: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    chemicalUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    quantityInput: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: 90,
      textAlign: "right",
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 18,
      alignItems: "center",
      marginTop: 24,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
    successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
    successIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#dcfce7",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    successSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginTop: 8 },
    newCountBtn: {
      marginTop: 32,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    newCountBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
          <Text style={styles.headerTitle}>Count Entry</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Count Submitted!</Text>
          <Text style={styles.successSub}>
            Your inventory count for {selectedStore?.name} has been saved. Alerts have been automatically generated if any readings are out of range.
          </Text>
          <TouchableOpacity style={styles.newCountBtn} onPress={handleReset}>
            <Text style={styles.newCountBtnText}>Submit Another Count</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <Text style={styles.headerTitle}>Count Entry</Text>
        <Text style={styles.headerSubtitle}>Week of {currentWeek}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Store</Text>
        <TouchableOpacity
          style={styles.storeBtn}
          onPress={() => setShowStorePicker(!showStorePicker)}
        >
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
                onPress={() => {
                  setSelectedStoreId(store.id);
                  setShowStorePicker(false);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.storeItemText, selectedStoreId === store.id && styles.storeItemActive]}>
                  {store.name}
                </Text>
                {selectedStoreId === store.id && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Your Name</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your name..."
          placeholderTextColor={colors.mutedForeground}
          value={submittedBy}
          onChangeText={setSubmittedBy}
          returnKeyType="done"
        />

        <Text style={styles.sectionTitle}>Chemical Counts ({chemicals?.length ?? 0} chemicals)</Text>
        {(chemicals ?? []).map((chemical) => (
          <View key={chemical.id} style={styles.chemicalRow}>
            <View style={styles.chemicalInfo}>
              <Text style={styles.chemicalName}>{chemical.name}</Text>
              <Text style={styles.chemicalUnit}>{chemical.unit}</Text>
            </View>
            <TextInput
              style={styles.quantityInput}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={quantities[chemical.id] ?? ""}
              onChangeText={(v) => handleQuantityChange(chemical.id, v)}
              returnKeyType="done"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Count</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
