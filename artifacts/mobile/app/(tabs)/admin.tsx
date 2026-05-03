import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  useGetAlerts,
  useGetAlertsSummary,
  useAcknowledgeAlert,
  useGetStores,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";

function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercent(n: number): string {
  return `${Math.abs(n).toFixed(1)}%`;
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [filterStoreId, setFilterStoreId] = useState<number | undefined>();
  const [filterAcknowledged, setFilterAcknowledged] = useState<boolean>(false);
  const [showStoreFilter, setShowStoreFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: stores } = useGetStores();
  const {
    data: alerts,
    isLoading,
    refetch: refetchAlerts,
  } = useGetAlerts({
    storeId: filterStoreId,
    acknowledged: filterAcknowledged,
    limit: 200,
  });
  const { data: summary, refetch: refetchSummary } = useGetAlertsSummary();
  const { mutateAsync: ackAlert } = useAcknowledgeAlert();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts(), refetchSummary()]);
    setRefreshing(false);
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await ackAlert({ alertId });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries();
    } catch {
      // ignore
    }
  };

  const selectedStore = stores?.find((s) => s.id === filterStoreId);

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
    headerSub: { fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", marginTop: 4 },
    statsBar: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.navyLight,
      gap: 20,
    },
    statItem: { alignItems: "center" },
    statVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
    statLbl: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginTop: 2 },
    criticalVal: { color: "#f87171" },
    warningVal: { color: "#fbbf24" },
    filtersBar: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 10,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterChipTextActive: { color: "#fff" },
    storeDropdown: {
      position: "absolute",
      top: 44,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 100,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    storeDropdownItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
    },
    storeDropdownText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: insets.bottom + 100 + webBottom },
    alertCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderLeftWidth: 4,
    },
    alertCardCritical: { borderColor: "#fecaca", borderLeftColor: colors.critical },
    alertCardWarning: { borderColor: "#fde68a", borderLeftColor: colors.warning },
    alertCardAcknowledged: { borderColor: colors.border, borderLeftColor: colors.border, opacity: 0.6 },
    alertTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
    alertInfo: { flex: 1 },
    alertChemical: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    alertStore: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    alertWeek: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    badgeCritical: {
      backgroundColor: "#fef2f2",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeCriticalText: { color: colors.critical, fontSize: 11, fontFamily: "Inter_700Bold" },
    badgeWarning: {
      backgroundColor: "#fffbeb",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeWarningText: { color: colors.warning, fontSize: 11, fontFamily: "Inter_700Bold" },
    alertStats: { flexDirection: "row", gap: 16, marginBottom: 12 },
    alertStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    alertStatValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    directionBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      alignSelf: "flex-start",
      marginBottom: 12,
    },
    directionOver: { backgroundColor: "#fef2f2" },
    directionUnder: { backgroundColor: "#eff6ff" },
    directionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    directionOverText: { color: colors.critical },
    directionUnderText: { color: "#2563eb" },
    ackBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.secondary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignSelf: "flex-end",
    },
    ackBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    ackedText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    emptyContainer: { alignItems: "center", paddingVertical: 60 },
    emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 16 },
    emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 8, textAlign: "center" },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <Text style={styles.headerTitle}>Alert Center</Text>
        <Text style={styles.headerSub}>
          {summary?.totalUnacknowledged ?? 0} unacknowledged alerts
        </Text>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, styles.criticalVal]}>{summary?.criticalCount ?? 0}</Text>
          <Text style={styles.statLbl}>Critical</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statVal, styles.warningVal]}>{summary?.warningCount ?? 0}</Text>
          <Text style={styles.statLbl}>Warning</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{summary?.totalUnacknowledged ?? 0}</Text>
          <Text style={styles.statLbl}>Total Open</Text>
        </View>
      </View>

      <View style={[styles.filtersBar, { zIndex: 50 }]}>
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            style={[styles.filterChip, filterStoreId !== undefined && styles.filterChipActive]}
            onPress={() => setShowStoreFilter(!showStoreFilter)}
          >
            <Feather
              name="map-pin"
              size={13}
              color={filterStoreId !== undefined ? "#fff" : colors.foreground}
            />
            <Text
              style={[styles.filterChipText, filterStoreId !== undefined && styles.filterChipTextActive]}
            >
              {selectedStore?.name.replace("Store ", "S") ?? "All Stores"}
            </Text>
            <Feather
              name="chevron-down"
              size={13}
              color={filterStoreId !== undefined ? "#fff" : colors.foreground}
            />
          </TouchableOpacity>

          {showStoreFilter && (
            <View style={styles.storeDropdown}>
              <TouchableOpacity
                style={styles.storeDropdownItem}
                onPress={() => { setFilterStoreId(undefined); setShowStoreFilter(false); }}
              >
                <Text style={styles.storeDropdownText}>All Stores</Text>
                {!filterStoreId && <Feather name="check" size={14} color={colors.primary} />}
              </TouchableOpacity>
              {(stores ?? []).map((store, idx) => (
                <TouchableOpacity
                  key={store.id}
                  style={[styles.storeDropdownItem, idx === (stores?.length ?? 0) - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => { setFilterStoreId(store.id); setShowStoreFilter(false); }}
                >
                  <Text style={styles.storeDropdownText}>{store.name}</Text>
                  {filterStoreId === store.id && <Feather name="check" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterChip, filterAcknowledged && styles.filterChipActive]}
          onPress={() => setFilterAcknowledged(!filterAcknowledged)}
        >
          <Feather name="check-circle" size={13} color={filterAcknowledged ? "#fff" : colors.foreground} />
          <Text style={[styles.filterChipText, filterAcknowledged && styles.filterChipTextActive]}>
            Acknowledged
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (alerts ?? []).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="check-circle" size={48} color={colors.success} />
            <Text style={styles.emptyText}>No alerts found</Text>
            <Text style={styles.emptySub}>
              {filterAcknowledged ? "No acknowledged alerts" : "All chemical usage is within normal range"}
            </Text>
          </View>
        ) : (
          (alerts ?? []).map((alert) => (
            <View
              key={alert.id}
              style={[
                styles.alertCard,
                alert.acknowledged && styles.alertCardAcknowledged,
                !alert.acknowledged && alert.severity === "critical" && styles.alertCardCritical,
                !alert.acknowledged && alert.severity === "warning" && styles.alertCardWarning,
              ]}
            >
              <View style={styles.alertTop}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertChemical}>{alert.chemicalName}</Text>
                  <Text style={styles.alertStore}>{alert.storeName}</Text>
                  <Text style={styles.alertWeek}>Week of {formatWeekOf(alert.weekOf)}</Text>
                </View>
                {!alert.acknowledged && alert.severity === "critical" && (
                  <View style={styles.badgeCritical}>
                    <Text style={styles.badgeCriticalText}>CRITICAL</Text>
                  </View>
                )}
                {!alert.acknowledged && alert.severity === "warning" && (
                  <View style={styles.badgeWarning}>
                    <Text style={styles.badgeWarningText}>WARNING</Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.directionBadge,
                  alert.direction === "over" ? styles.directionOver : styles.directionUnder,
                ]}
              >
                <Feather
                  name={alert.direction === "over" ? "trending-down" : "trending-up"}
                  size={14}
                  color={alert.direction === "over" ? colors.critical : "#2563eb"}
                />
                <Text
                  style={[
                    styles.directionText,
                    alert.direction === "over" ? styles.directionOverText : styles.directionUnderText,
                  ]}
                >
                  {alert.direction === "over"
                    ? `${formatPercent(alert.percentChange)} more used than expected`
                    : `${formatPercent(alert.percentChange)} less used than expected`}
                </Text>
              </View>

              <View style={styles.alertStats}>
                <View>
                  <Text style={styles.alertStatLabel}>Previous</Text>
                  <Text style={styles.alertStatValue}>{alert.previousQuantity.toFixed(1)}</Text>
                </View>
                <View>
                  <Text style={styles.alertStatLabel}>Current</Text>
                  <Text style={styles.alertStatValue}>{alert.currentQuantity.toFixed(1)}</Text>
                </View>
                <View>
                  <Text style={styles.alertStatLabel}>Change</Text>
                  <Text style={[styles.alertStatValue, { color: alert.direction === "over" ? colors.critical : "#2563eb" }]}>
                    {alert.percentChange > 0 ? "+" : ""}{formatPercent(alert.percentChange)}
                  </Text>
                </View>
              </View>

              {alert.acknowledged ? (
                <Text style={styles.ackedText}>
                  Acknowledged {alert.acknowledgedAt ? new Date(alert.acknowledgedAt).toLocaleDateString() : ""}
                </Text>
              ) : (
                <TouchableOpacity style={styles.ackBtn} onPress={() => handleAcknowledge(alert.id)}>
                  <Feather name="check" size={14} color={colors.foreground} />
                  <Text style={styles.ackBtnText}>Acknowledge</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
