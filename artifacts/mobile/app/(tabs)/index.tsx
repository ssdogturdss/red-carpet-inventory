import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetAlertsSummary, useGetStores, useGetInventoryCounts } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function getWeekOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0]!;
}

function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentWeek = getWeekOf();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useGetAlertsSummary();
  const { data: stores } = useGetStores();
  const { data: recentCounts, isLoading: countsLoading, refetch: refetchCounts } = useGetInventoryCounts({ limit: 5 });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSummary(), refetchCounts()]);
    setRefreshing(false);
  }, [refetchSummary, refetchCounts]);

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
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
    headerSubtitle: {
      fontSize: 14,
      color: "rgba(255,255,255,0.6)",
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: insets.bottom + 90 + webBottom,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 12,
      marginTop: 24,
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    statLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
    },
    criticalCard: {
      backgroundColor: "#fef2f2",
      borderColor: "#fecaca",
    },
    criticalValue: {
      color: colors.critical,
    },
    warningCard: {
      backgroundColor: "#fffbeb",
      borderColor: "#fde68a",
    },
    warningValue: {
      color: colors.warning,
    },
    countCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    countInfo: {
      flex: 1,
    },
    countStore: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    countWeek: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    countBy: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    actionBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 16,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    actionBtnSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    actionBtnTextSecondary: {
      color: colors.foreground,
    },
    emptyText: {
      textAlign: "center",
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      paddingVertical: 20,
    },
    storeAlertCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    storeAlertName: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    badgeCritical: {
      backgroundColor: "#fef2f2",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginLeft: 8,
    },
    badgeCriticalText: {
      color: colors.critical,
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    badgeWarning: {
      backgroundColor: "#fffbeb",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginLeft: 8,
    },
    badgeWarningText: {
      color: colors.warning,
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>Week of {formatWeekOf(currentWeek)}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/count")}>
            <Feather name="clipboard" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>New Count</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Feather name="camera" size={18} color={colors.foreground} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Scan Sheet</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Alert Summary</Text>
        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.criticalCard]}>
                <Text style={[styles.statValue, styles.criticalValue]}>
                  {summary?.criticalCount ?? 0}
                </Text>
                <Text style={styles.statLabel}>Critical</Text>
              </View>
              <View style={[styles.statCard, styles.warningCard]}>
                <Text style={[styles.statValue, styles.warningValue]}>
                  {summary?.warningCount ?? 0}
                </Text>
                <Text style={styles.statLabel}>Warnings</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stores?.length ?? 11}</Text>
                <Text style={styles.statLabel}>Stores</Text>
              </View>
            </View>

            {(summary?.byStore ?? []).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Stores with Alerts</Text>
                {summary?.byStore.map((s) => (
                  <TouchableOpacity
                    key={s.storeId}
                    style={styles.storeAlertCard}
                    onPress={() => router.push("/(tabs)/admin")}
                  >
                    <Text style={styles.storeAlertName}>{s.storeName}</Text>
                    {s.criticalCount > 0 && (
                      <View style={styles.badgeCritical}>
                        <Text style={styles.badgeCriticalText}>{s.criticalCount} critical</Text>
                      </View>
                    )}
                    {s.unacknowledgedCount - s.criticalCount > 0 && (
                      <View style={styles.badgeWarning}>
                        <Text style={styles.badgeWarningText}>
                          {s.unacknowledgedCount - s.criticalCount} warning
                        </Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Recent Submissions</Text>
        {countsLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : recentCounts && recentCounts.length > 0 ? (
          recentCounts.map((c) => (
            <View key={c.id} style={styles.countCard}>
              <View style={styles.countInfo}>
                <Text style={styles.countStore}>{c.storeName}</Text>
                <Text style={styles.countWeek}>Week of {formatWeekOf(c.weekOf)}</Text>
                <Text style={styles.countBy}>By {c.submittedBy}</Text>
              </View>
              <Feather name="check-circle" size={20} color={colors.success} />
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No submissions yet this week</Text>
        )}
      </ScrollView>
    </View>
  );
}
