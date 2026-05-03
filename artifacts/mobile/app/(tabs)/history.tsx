import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetInventoryCounts, useGetStores } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Count = {
  id: number;
  storeId: number;
  storeName: string;
  weekOf: string;
  submittedBy: string;
  submittedAt: string;
  entries: { chemicalName: string; quantity: number; unit: string }[];
};

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: stores } = useGetStores();
  const { data: counts, isLoading, refetch } = useGetInventoryCounts({
    storeId: selectedStoreId,
    limit: 200,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const selectedStoreName = selectedStoreId
    ? stores?.find((s) => s.id === selectedStoreId)?.name ?? "Store"
    : "All Stores";

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
    headerTitle: {
      fontSize: 28,
      color: "#ffffff",
      fontFamily: "Inter_700Bold",
    },
    filterRow: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignSelf: "flex-start",
    },
    filterBtnText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    filterBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.tealLight + "22",
    },
    filterBtnActiveText: { color: colors.primary },
    scroll: { flex: 1 },
    scrollContent: {
      padding: 16,
      paddingBottom: insets.bottom + 90 + webBottom,
    },
    emptyText: {
      textAlign: "center",
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      paddingVertical: 40,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
    },
    cardInfo: { flex: 1 },
    storeName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    weekOf: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    submittedMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    chevron: { marginLeft: 12 },
    entriesList: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 8,
    },
    entriesTitle: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    entryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "66",
    },
    entryName: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      flex: 1,
      marginRight: 8,
    },
    entryQty: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    entryUnit: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginLeft: 4,
    },
    countBadge: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginTop: 6,
      marginBottom: 2,
    },
    // modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: insets.bottom + 16,
      maxHeight: "60%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      flex: 1,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    modalOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + "55",
    },
    modalOptionText: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    modalOptionTextActive: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      {/* Filter bar */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, selectedStoreId !== undefined && styles.filterBtnActive]}
          onPress={() => setStorePickerOpen(true)}
        >
          <Feather
            name="filter"
            size={15}
            color={selectedStoreId !== undefined ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.filterBtnText, selectedStoreId !== undefined && styles.filterBtnActiveText]}>
            {selectedStoreName}
          </Text>
          <Feather
            name="chevron-down"
            size={15}
            color={selectedStoreId !== undefined ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !counts || counts.length === 0 ? (
          <Text style={styles.emptyText}>No submissions found.</Text>
        ) : (
          <>
            <Text style={styles.countBadge}>{counts.length} submission{counts.length !== 1 ? "s" : ""}</Text>
            {(counts as Count[]).map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <View key={c.id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : c.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardInfo}>
                      <Text style={styles.storeName}>{c.storeName}</Text>
                      <Text style={styles.weekOf}>Week of {formatWeekOf(c.weekOf)}</Text>
                      <Text style={styles.submittedMeta}>
                        By {c.submittedBy} · {formatDateTime(c.submittedAt)}
                      </Text>
                    </View>
                    <Feather
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.mutedForeground}
                      style={styles.chevron}
                    />
                  </TouchableOpacity>

                  {isExpanded && c.entries && (
                    <View style={styles.entriesList}>
                      <Text style={styles.entriesTitle}>Product Counts</Text>
                      {c.entries.map((entry, idx) => (
                        <View key={idx} style={styles.entryRow}>
                          <Text style={styles.entryName}>{entry.chemicalName}</Text>
                          <Text style={styles.entryQty}>{entry.quantity}</Text>
                          <Text style={styles.entryUnit}>{entry.unit}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Store picker modal */}
      <Modal visible={storePickerOpen} transparent animationType="slide" onRequestClose={() => setStorePickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setStorePickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Store</Text>
              <TouchableOpacity onPress={() => setStorePickerOpen(false)}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: undefined, name: "All Stores" }, ...(stores ?? [])] as { id: number | undefined; name: string }[]}
              keyExtractor={(item) => String(item.id ?? "all")}
              renderItem={({ item }) => {
                const isActive = item.id === selectedStoreId;
                return (
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedStoreId(item.id as number | undefined);
                      setStorePickerOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, isActive && styles.modalOptionTextActive]}>
                      {item.name}
                    </Text>
                    {isActive && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
