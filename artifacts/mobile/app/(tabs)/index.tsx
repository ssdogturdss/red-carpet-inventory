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
import { EmptyState } from "@/components/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

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

function SectionHeader({ icon, label }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 28, marginBottom: 14 }}>
      <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.teal }} />
      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentWeek = getWeekOf();
  const { showOnboarding, completeOnboarding, openOnboarding } = useOnboarding();
  const { queue, isOnline, syncing, syncQueue } = useOfflineQueue();

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
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16 + webTop,
      paddingHorizontal: 20,
      paddingBottom: 22,
      backgroundColor: colors.navy,
    },
    headerSlogan: {
      position: "absolute",
      bottom: 28,
      left: 16,
      right: 16,
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: "rgba(56,189,248,0.35)",
      letterSpacing: 0.5,
      textAlign: "right",
    },
    headerTop: { flexDirection: "row", alignItems: "flex-start" },
    headerTextBlock: { flex: 1 },
    headerLabel: {
      fontSize: 11,
      color: colors.tealLight,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    headerTitle: { fontSize: 30, color: "#ffffff", fontFamily: "Inter_700Bold" },
    headerSubtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    helpBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: insets.bottom + 90 + webBottom, paddingTop: 4 },
    statsRow: { flexDirection: "row", gap: 10 },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statIconRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    statIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    statValue: { fontSize: 30, fontFamily: "Inter_700Bold", color: colors.foreground },
    statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 3 },
    criticalCard: { backgroundColor: colors.criticalSurface, borderColor: colors.criticalBorder },
    criticalValue: { color: colors.critical },
    warningCard: { backgroundColor: colors.warningSurface, borderColor: colors.warningBorder },
    warningValue: { color: colors.warning },
    storesCard: { backgroundColor: colors.tealSurface, borderColor: colors.tealLight },
    storesValue: { color: colors.teal },
    actionRow: { flexDirection: "row", gap: 12 },
    actionBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      gap: 6,
    },
    actionBtnSecondary: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    actionBtnText: { color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 15 },
    actionBtnSub: { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", fontSize: 11 },
    actionBtnTextSecondary: { color: colors.foreground },
    actionBtnSubSecondary: { color: colors.mutedForeground },
    countCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.teal,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    countCardInner: { flex: 1, padding: 14 },
    countStore: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    countWeek: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    countBy: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    countCheck: { paddingRight: 14 },
    storeAlertCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      borderLeftColor: colors.critical,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    storeAlertName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    badgeCritical: { backgroundColor: colors.criticalSurface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
    badgeCriticalText: { color: colors.critical, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    badgeWarning: { backgroundColor: colors.warningSurface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
    badgeWarningText: { color: colors.warning, fontSize: 12, fontFamily: "Inter_600SemiBold" },
    queueCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.offlineSurface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.offlineBorder,
      marginBottom: 4,
    },
    queueText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.offlineText },
    queueSync: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.offlineText },
  });

  return (
    <View style={styles.container}>
      <OnboardingModal visible={showOnboarding} onComplete={completeOnboarding} />

      <OfflineBanner isOnline={isOnline} queueLength={queue.length} syncing={syncing} onSync={syncQueue} />

      <View style={styles.header}>
        <Text style={styles.headerSlogan} numberOfLines={1} adjustsFontSizeToFit>
          Let's get'em clean, dry and shiny!
        </Text>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerLabel}>Red Carpet Inventory</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Week of {formatWeekOf(currentWeek)}</Text>
          </View>
          <TouchableOpacity style={styles.helpBtn} onPress={openOnboarding}>
            <Feather name="help-circle" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Pending queue */}
        {isOnline && queue.length > 0 && (
          <>
            <SectionHeader icon="clock" label="Pending Sync" />
            <TouchableOpacity style={styles.queueCard} onPress={() => syncQueue()}>
              <Feather name="upload-cloud" size={18} color="#92400e" />
              <Text style={styles.queueText}>
                {queue.length} count{queue.length > 1 ? "s" : ""} saved offline — tap to sync now
              </Text>
              <Text style={styles.queueSync}>Sync →</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Quick Actions */}
        <SectionHeader icon="zap" label="Quick Actions" />
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/count")}>
            <Feather name="clipboard" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>New Count</Text>
            <Text style={styles.actionBtnSub}>Enter manually</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <Feather name="camera" size={20} color={colors.foreground} />
            <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>Scan Sheet</Text>
            <Text style={[styles.actionBtnSub, styles.actionBtnSubSecondary]}>AI-powered OCR</Text>
          </TouchableOpacity>
        </View>

        {/* Alert Summary */}
        <SectionHeader icon="bell" label="Alert Summary" />
        {summaryLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.criticalCard]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconBox, { backgroundColor: colors.criticalBorder }]}>
                    <Feather name="alert-circle" size={16} color={colors.critical} />
                  </View>
                </View>
                <Text style={[styles.statValue, styles.criticalValue]}>{summary?.criticalCount ?? 0}</Text>
                <Text style={styles.statLabel}>Critical</Text>
              </View>
              <View style={[styles.statCard, styles.warningCard]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconBox, { backgroundColor: colors.warningBorder }]}>
                    <Feather name="alert-triangle" size={16} color={colors.warning} />
                  </View>
                </View>
                <Text style={[styles.statValue, styles.warningValue]}>{summary?.warningCount ?? 0}</Text>
                <Text style={styles.statLabel}>Warnings</Text>
              </View>
              <View style={[styles.statCard, styles.storesCard]}>
                <View style={styles.statIconRow}>
                  <View style={[styles.statIconBox, { backgroundColor: colors.tealLight }]}>
                    <Feather name="map-pin" size={16} color={colors.teal} />
                  </View>
                </View>
                <Text style={[styles.statValue, styles.storesValue]}>{stores?.length ?? 11}</Text>
                <Text style={styles.statLabel}>Stores</Text>
              </View>
            </View>

            {(summary?.byStore ?? []).length > 0 && (
              <>
                <SectionHeader icon="alert-circle" label="Stores with Alerts" />
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
                        <Text style={styles.badgeWarningText}>{s.unacknowledgedCount - s.criticalCount} warning</Text>
                      </View>
                    )}
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}

        {/* Recent Submissions */}
        <SectionHeader icon="check-circle" label="Recent Submissions" />
        {countsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
        ) : recentCounts && recentCounts.length > 0 ? (
          recentCounts.map((c) => (
            <View key={c.id} style={styles.countCard}>
              <View style={styles.countCardInner}>
                <Text style={styles.countStore}>{c.storeName}</Text>
                <Text style={styles.countWeek}>Week of {formatWeekOf(c.weekOf)}</Text>
                <Text style={styles.countBy}>Submitted by {c.submittedBy}</Text>
              </View>
              <View style={styles.countCheck}>
                <Feather name="check-circle" size={20} color={colors.success} />
              </View>
            </View>
          ))
        ) : (
          <EmptyState
            icon="inbox"
            title="No submissions yet"
            subtitle="When a store submits their weekly count it will appear here. Tap New Count to get started."
            actionLabel="Submit a Count"
            onAction={() => router.push("/(tabs)/count")}
            compact
          />
        )}
      </ScrollView>
    </View>
  );
}
