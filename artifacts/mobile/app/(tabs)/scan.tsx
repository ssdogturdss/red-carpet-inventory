import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  useGetStores,
  useGetChemicals,
  useScanInventorySheet,
  useSubmitInventoryCount,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

function getWeekOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}

interface ScannedEntry {
  chemicalId: number;
  chemicalName: string;
  quantity: number;
  confidence: "high" | "medium" | "low";
  edited?: boolean;
}

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { mutateAsync: scanSheet, isPending: scanning } = useScanInventorySheet();
  const { mutateAsync: submitCount, isPending: submitting } = useSubmitInventoryCount();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [rawText, setRawText] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [submittedBy, setSubmittedBy] = useState("");
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<"capture" | "review" | "confirm">("capture");

  const selectedStore = stores?.find((s) => s.id === selectedStoreId);
  const currentWeek = getWeekOf();

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera Permission", "Camera access is needed to scan count sheets.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        base64: false,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        base64: false,
      });
    }

    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setImageUri(uri);

    // Convert to base64 and scan
    await processScan(uri);
  };

  const processScan = async (uri: string) => {
    try {
      let base64: string;
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.readAsDataURL(blob);
        });
      } else {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        base64 = b64;
      }

      const chemList = (chemicals ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        unit: c.unit,
      }));

      const result = await scanSheet({
        data: { imageBase64: base64, chemicals: chemList },
      });

      setEntries(
        (result.entries ?? []).map((e) => ({
          chemicalId: e.chemicalId,
          chemicalName: e.chemicalName,
          quantity: e.quantity,
          confidence: e.confidence as "high" | "medium" | "low",
        }))
      );
      setRawText(result.rawText ?? "");
      setStep("review");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Scan Failed", "Could not process the image. Please try again or enter counts manually.");
    }
  };

  const updateQuantity = (chemicalId: number, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.chemicalId === chemicalId
          ? { ...e, quantity: parseFloat(value) || 0, edited: true, confidence: "high" }
          : e
      )
    );
  };

  const handleSubmit = async () => {
    if (!selectedStoreId) {
      Alert.alert("Select Store", "Please select your store.");
      return;
    }
    if (!submittedBy.trim()) {
      Alert.alert("Enter Name", "Please enter your name.");
      return;
    }

    try {
      await submitCount({
        data: {
          storeId: selectedStoreId,
          weekOf: currentWeek,
          submittedBy: submittedBy.trim(),
          entries: entries.map((e) => ({ chemicalId: e.chemicalId, quantity: e.quantity })),
        },
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries();
      setSubmitted(true);
    } catch {
      Alert.alert("Error", "Failed to submit count.");
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setStep("capture");
    setImageUri(null);
    setEntries([]);
    setRawText("");
    setSelectedStoreId(null);
    setSubmittedBy("");
  };

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
    headerSub: { fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 4 },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: insets.bottom + 100 + webBottom },
    captureArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    captureIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.tealLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    captureTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8, textAlign: "center" },
    captureSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 20, marginBottom: 32 },
    captureBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      paddingHorizontal: 28,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
      minWidth: 220,
      justifyContent: "center",
    },
    captureBtnSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    captureBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
    captureBtnTextSecondary: { color: colors.foreground },
    previewImage: { width: "100%", height: 200, borderRadius: colors.radius, marginBottom: 20 },
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
      marginTop: 8,
    },
    storeBtnText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: colors.foreground },
    storeBtnPlaceholder: { color: colors.mutedForeground },
    storeList: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    storeItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    storeItemText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
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
    entryRow: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    entryHighBorder: { borderColor: colors.border },
    entryMediumBorder: { borderColor: colors.warning },
    entryLowBorder: { borderColor: "#fca5a5" },
    entryInfo: { flex: 1 },
    entryName: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    entryConfidence: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    confHigh: { color: colors.success },
    confMedium: { color: colors.warning },
    confLow: { color: colors.critical },
    qtyInput: {
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
    submitBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
    backBtn: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      alignItems: "center",
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnText: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" },
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
    newScanBtn: {
      marginTop: 32,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    newScanBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    scanningOverlay: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 16,
    },
    scanningText: { fontSize: 16, fontFamily: "Inter_500Medium", color: colors.foreground },
    scanningSubText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" },
  });

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
          <Text style={styles.headerTitle}>Scan Sheet</Text>
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check" size={40} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Count Submitted!</Text>
          <Text style={styles.successSub}>
            Scanned and submitted count for {selectedStore?.name}. Alerts generated if any readings are out of range.
          </Text>
          <TouchableOpacity style={styles.newScanBtn} onPress={handleReset}>
            <Text style={styles.newScanBtnText}>Scan Another Sheet</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <Text style={styles.headerTitle}>Scan Sheet</Text>
        <Text style={styles.headerSub}>
          {step === "capture" ? "Take a photo of your count sheet" : `Reviewing ${entries.length} chemicals`}
        </Text>
      </View>

      {step === "capture" && (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { flex: 1 }]}>
          {scanning ? (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.scanningText}>Analyzing your count sheet...</Text>
              <Text style={styles.scanningSubText}>AI is reading the chemical quantities from your photo</Text>
            </View>
          ) : (
            <View style={styles.captureArea}>
              <View style={styles.captureIcon}>
                <Feather name="camera" size={40} color={colors.teal} />
              </View>
              <Text style={styles.captureTitle}>Scan Count Sheet</Text>
              <Text style={styles.captureSub}>
                Take a clear photo of your paper count sheet and the AI will automatically extract all chemical quantities.
              </Text>
              <TouchableOpacity style={styles.captureBtn} onPress={() => pickImage(true)}>
                <Feather name="camera" size={20} color="#fff" />
                <Text style={styles.captureBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureBtn, styles.captureBtnSecondary]}
                onPress={() => pickImage(false)}
              >
                <Feather name="image" size={20} color={colors.foreground} />
                <Text style={[styles.captureBtnText, styles.captureBtnTextSecondary]}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {step === "review" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />}

          <Text style={styles.sectionTitle}>Store</Text>
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
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setShowStorePicker(false);
                  }}
                >
                  <Text style={styles.storeItemText}>{store.name}</Text>
                  {selectedStoreId === store.id && <Feather name="check" size={16} color={colors.primary} />}
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
          />

          <Text style={styles.sectionTitle}>
            Extracted Counts — Review &amp; Edit
          </Text>
          {entries.map((entry) => (
            <View
              key={entry.chemicalId}
              style={[
                styles.entryRow,
                entry.confidence === "high" && styles.entryHighBorder,
                entry.confidence === "medium" && styles.entryMediumBorder,
                entry.confidence === "low" && styles.entryLowBorder,
              ]}
            >
              <View style={styles.entryInfo}>
                <Text style={styles.entryName}>{entry.chemicalName}</Text>
                <Text style={[
                  styles.entryConfidence,
                  entry.confidence === "high" && styles.confHigh,
                  entry.confidence === "medium" && styles.confMedium,
                  entry.confidence === "low" && styles.confLow,
                ]}>
                  {entry.edited ? "Edited" : `${entry.confidence} confidence`}
                </Text>
              </View>
              <TextInput
                style={styles.qtyInput}
                value={String(entry.quantity)}
                keyboardType="decimal-pad"
                onChangeText={(v) => updateQuantity(entry.chemicalId, v)}
                returnKeyType="done"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Count</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => setStep("capture")}>
            <Text style={styles.backBtnText}>Scan Again</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}
