import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Platform, Modal,
  Pressable, RefreshControl, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminAuth,
  useGetAlerts, useGetAlertsSummary, useAcknowledgeAlert, useDeleteAlert,
  useGetStores, useUpdateStore, useDeleteStore,
  useGetChemicals, useUpdateChemical, useDeleteChemical,
  useGetInventoryCounts, useDeleteInventoryCount,
  useGetNotificationContacts, useCreateNotificationContact,
  useUpdateNotificationContact, useDeleteNotificationContact,
  useTestNotificationContact, useGetNotificationStatus,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { EmptyState } from "@/components/EmptyState";
import { PinScreen } from "@/components/PinScreen";

type Section = "alerts" | "stores" | "products" | "counts" | "notifications";

function formatWeekOf(weekOf: string) {
  const d = new Date(weekOf + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────
function EditModal({
  visible, title, fields, onSave, onClose, saving, colors, insets,
}: {
  visible: boolean;
  title: string;
  fields: { label: string; key: string; value: string; numeric?: boolean }[];
  onSave: (values: Record<string, string>) => void;
  onClose: () => void;
  saving: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  insets: { bottom: number };
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = f.value;
    setValues(initial);
  }, [visible]);

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 8 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    fieldBlock: { paddingHorizontal: 20, paddingTop: 16 },
    fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
    fieldInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    btnRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 20 },
    cancelBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
          </View>
          {fields.map((f) => (
            <View key={f.key} style={s.fieldBlock}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput
                style={s.fieldInput}
                value={values[f.key] ?? ""}
                onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                keyboardType={f.numeric ? "decimal-pad" : "default"}
                autoCapitalize="none"
              />
            </View>
          ))}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={() => onSave(values)} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Alerts Section ──────────────────────────────────────────────────────────
function AlertsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: { bottom: number } }) {
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState<number | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const { data: stores } = useGetStores();
  const { data: alerts, isLoading, refetch } = useGetAlerts({ storeId: storeFilter, limit: 200 });
  const { mutateAsync: acknowledge } = useAcknowledgeAlert();
  const { mutateAsync: deleteAlert } = useDeleteAlert();
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const confirmDelete = (id: number) => Alert.alert("Delete Alert", "Remove this alert permanently?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deleteAlert({ alertId: id }); qc.invalidateQueries(); } },
  ]);

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 80 + webBottom },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    chipTextActive: { color: "#fff" },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14 },
    row: { flexDirection: "row", alignItems: "flex-start" },
    info: { flex: 1 },
    store: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    chemical: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    week: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
    badgeCritical: { backgroundColor: colors.criticalSurface },
    badgeWarning: { backgroundColor: colors.warningSurface },
    badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    btnRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    ackBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
    ackBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    delBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.criticalSurface, alignItems: "center" },
    ackBtnDone: { backgroundColor: colors.successSurface },
    ackBtnDoneText: { color: colors.success },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
  });

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.chip, !storeFilter && s.chipActive]} onPress={() => setStoreFilter(undefined)}>
          <Text style={[s.chipText, !storeFilter && s.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {(stores ?? []).map((st) => (
          <TouchableOpacity key={st.id} style={[s.chip, storeFilter === st.id && s.chipActive]} onPress={() => setStoreFilter(st.id)}>
            <Text style={[s.chipText, storeFilter === st.id && s.chipTextActive]}>{st.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !alerts?.length ? (
        <EmptyState icon="bell-off" title="No alerts" subtitle="When chemical levels deviate from normal you'll see alerts here. All stores look good!" compact />
      ) : alerts.map((a) => (
        <View key={a.id} style={s.card}>
          <View style={s.row}>
            <View style={s.info}>
              <Text style={s.store}>{a.storeName}</Text>
              <Text style={s.chemical}>{a.chemicalName} · {a.direction === "over" ? "▲" : "▼"} {Math.abs(a.percentChange).toFixed(1)}%</Text>
              <Text style={s.week}>Week of {formatWeekOf(a.weekOf)}</Text>
            </View>
            <View style={[s.badge, a.severity === "critical" ? s.badgeCritical : s.badgeWarning]}>
              <Text style={[s.badgeText, { color: a.severity === "critical" ? colors.critical : colors.warning }]}>
                {a.severity}
              </Text>
            </View>
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.ackBtn, a.acknowledged && s.ackBtnDone]}
              onPress={async () => {
                if (!a.acknowledged) {
                  await acknowledge({ alertId: a.id });
                  qc.invalidateQueries();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }}
            >
              <Feather name={a.acknowledged ? "check-circle" : "circle"} size={15} color={a.acknowledged ? colors.success : colors.mutedForeground} />
              <Text style={[s.ackBtnText, a.acknowledged && s.ackBtnDoneText]}>{a.acknowledged ? "Acknowledged" : "Acknowledge"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(a.id)}>
              <Feather name="trash-2" size={16} color={colors.critical} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Stores Section ──────────────────────────────────────────────────────────
function StoresSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: { bottom: number } }) {
  const qc = useQueryClient();
  const { data: stores, isLoading, refetch } = useGetStores();
  const { mutateAsync: updateStore, isPending: updating } = useUpdateStore();
  const { mutateAsync: deleteStore } = useDeleteStore();
  const [editTarget, setEditTarget] = useState<{ id: number; name: string; storeNumber: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const confirmDelete = (id: number, name: string) => Alert.alert(
    "Delete Store",
    `Delete "${name}"? This will permanently remove all its counts and alerts.`,
    [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await deleteStore({ storeId: id }); qc.invalidateQueries(); } }]
  );

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 80 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center" },
    info: { flex: 1 },
    name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    number: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    actions: { flexDirection: "row", gap: 10 },
    editBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.secondary },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
  });

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : !stores?.length ? (
          <EmptyState icon="map-pin" title="No stores" subtitle="Add stores via the database seed or contact your administrator." compact />
        ) : stores.map((st) => (
          <View key={st.id} style={s.card}>
            <View style={s.info}>
              <Text style={s.name}>{st.name}</Text>
              <Text style={s.number}>Store #{st.storeNumber}</Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.editBtn} onPress={() => setEditTarget({ id: st.id, name: st.name, storeNumber: st.storeNumber })}>
                <Feather name="edit-2" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(st.id, st.name)}>
                <Feather name="trash-2" size={16} color={colors.critical} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <EditModal
        visible={!!editTarget}
        title="Edit Store"
        fields={[
          { label: "Name", key: "name", value: editTarget?.name ?? "" },
          { label: "Store Number", key: "storeNumber", value: editTarget?.storeNumber ?? "" },
        ]}
        saving={updating}
        colors={colors}
        insets={insets}
        onClose={() => setEditTarget(null)}
        onSave={async (vals) => {
          if (!editTarget) return;
          await updateStore({ storeId: editTarget.id, data: { name: vals["name"], storeNumber: vals["storeNumber"] } });
          qc.invalidateQueries();
          setEditTarget(null);
        }}
      />
    </>
  );
}

// ─── Products Section ────────────────────────────────────────────────────────
function ProductsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: { bottom: number } }) {
  const qc = useQueryClient();
  const { data: chemicals, isLoading, refetch } = useGetChemicals();
  const { mutateAsync: updateChemical, isPending: updating } = useUpdateChemical();
  const { mutateAsync: deleteChemical } = useDeleteChemical();
  const [editTarget, setEditTarget] = useState<{ id: number; name: string; unit: string; thresholdPercent: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const confirmDelete = (id: number, name: string) => Alert.alert(
    "Delete Product",
    `Delete "${name}"? This will remove it from all future counts.`,
    [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await deleteChemical({ chemicalId: id }); qc.invalidateQueries(); } }]
  );

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 80 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center" },
    info: { flex: 1 },
    name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    actions: { flexDirection: "row", gap: 10 },
    editBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.secondary },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
  });

  return (
    <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : !chemicals?.length ? (
          <EmptyState icon="droplet" title="No products" subtitle="Chemical products appear here once seeded. Contact your administrator to add products." compact />
        ) : chemicals.map((c) => (
          <View key={c.id} style={s.card}>
            <View style={s.info}>
              <Text style={s.name}>{c.name}</Text>
              <Text style={s.meta}>{c.unit} · Alert threshold: {c.thresholdPercent}%</Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.editBtn} onPress={() => setEditTarget({ id: c.id, name: c.name, unit: c.unit, thresholdPercent: c.thresholdPercent })}>
                <Feather name="edit-2" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(c.id, c.name)}>
                <Feather name="trash-2" size={16} color={colors.critical} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <EditModal
        visible={!!editTarget}
        title="Edit Product"
        fields={[
          { label: "Product Name", key: "name", value: editTarget?.name ?? "" },
          { label: "Unit", key: "unit", value: editTarget?.unit ?? "" },
          { label: "Alert Threshold (%)", key: "thresholdPercent", value: String(editTarget?.thresholdPercent ?? ""), numeric: true },
        ]}
        saving={updating}
        colors={colors}
        insets={insets}
        onClose={() => setEditTarget(null)}
        onSave={async (vals) => {
          if (!editTarget) return;
          await updateChemical({
            chemicalId: editTarget.id,
            data: {
              name: vals["name"],
              unit: vals["unit"],
              thresholdPercent: parseFloat(vals["thresholdPercent"] ?? "30") || 30,
            },
          });
          qc.invalidateQueries();
          setEditTarget(null);
        }}
      />
    </>
  );
}

// ─── Counts Section ──────────────────────────────────────────────────────────
function CountsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: { bottom: number } }) {
  const qc = useQueryClient();
  const { data: counts, isLoading, refetch } = useGetInventoryCounts({ limit: 200 });
  const { mutateAsync: deleteCount } = useDeleteInventoryCount();
  const [refreshing, setRefreshing] = useState(false);
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const confirmDelete = (id: number, storeName: string, weekOf: string) => Alert.alert(
    "Delete Submission",
    `Delete the count for ${storeName} (Week of ${formatWeekOf(weekOf)})? This cannot be undone.`,
    [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await deleteCount({ countId: id }); qc.invalidateQueries(); } }]
  );

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 80 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center" },
    info: { flex: 1 },
    store: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
  });

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !counts?.length ? (
        <Text style={s.empty}>No submissions found.</Text>
      ) : counts.map((c) => (
        <View key={c.id} style={s.card}>
          <View style={s.info}>
            <Text style={s.store}>{c.storeName}</Text>
            <Text style={s.meta}>Week of {formatWeekOf(c.weekOf)} · By {c.submittedBy}</Text>
          </View>
          <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(c.id, c.storeName, c.weekOf)}>
            <Feather name="trash-2" size={16} color={colors.critical} />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────
function NotificationsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: { bottom: number } }) {
  const qc = useQueryClient();
  const { data: contacts, isLoading, refetch } = useGetNotificationContacts();
  const { data: status } = useGetNotificationStatus();
  const { data: stores } = useGetStores();
  const { mutateAsync: createContact, isPending: creating } = useCreateNotificationContact();
  const { mutateAsync: updateContact, isPending: updatingContact } = useUpdateNotificationContact();
  const { mutateAsync: deleteContact } = useDeleteNotificationContact();
  const { mutateAsync: testContact } = useTestNotificationContact();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: number; email: string; phone: string; label: string;
    storeId: number | null; severity: string; active: boolean;
  } | null>(null);
  const [form, setForm] = useState({ email: "", phone: "", label: "", storeId: "", severity: "all", active: true });
  const webBottom = Platform.OS === "web" ? 34 : 0;

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const resetForm = () => setForm({ email: "", phone: "", label: "", storeId: "", severity: "all", active: true });

  const handleAdd = async () => {
    if (!form.email.trim() && !form.phone.trim()) {
      Alert.alert("Missing fields", "Enter at least an email address or phone number.");
      return;
    }
    if (!form.label.trim()) {
      Alert.alert("Missing fields", "Label is required.");
      return;
    }
    await createContact({
      data: {
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        label: form.label.trim(),
        storeId: form.storeId ? parseInt(form.storeId) : null,
        severity: form.severity as "all" | "warning" | "critical",
        active: form.active,
      },
    });
    qc.invalidateQueries();
    resetForm();
    setShowAdd(false);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    await updateContact({
      id: editTarget.id,
      data: {
        email: editTarget.email || null,
        phone: editTarget.phone || null,
        label: editTarget.label,
        storeId: editTarget.storeId,
        severity: editTarget.severity as "all" | "warning" | "critical",
        active: editTarget.active,
      },
    });
    qc.invalidateQueries();
    setEditTarget(null);
  };

  const handleDelete = (id: number, label: string) => Alert.alert(
    "Remove Contact",
    `Remove "${label}" from notifications?`,
    [{ text: "Cancel", style: "cancel" }, {
      text: "Remove", style: "destructive",
      onPress: async () => { await deleteContact({ id }); qc.invalidateQueries(); },
    }]
  );

  const handleTest = async (id: number, label: string) => {
    try {
      await testContact({ id });
      Alert.alert("Test Sent", `A test notification was sent to "${label}".`);
    } catch {
      Alert.alert("Failed", "Could not send test notification. Check your credentials.");
    }
  };

  const severityColor = (sev: string) =>
    sev === "critical" ? colors.critical : sev === "warning" ? colors.warning : colors.teal;

  const s = StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 80 + webBottom },
    statusBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border,
      padding: 12, marginBottom: 14,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    addBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: colors.radius,
      padding: 13, marginBottom: 14, justifyContent: "center",
    },
    addBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
    card: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14,
    },
    cardRow: { flexDirection: "row", alignItems: "flex-start" },
    cardInfo: { flex: 1 },
    cardLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    cardPhone: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    cardBadgeRow: { flexDirection: "row", gap: 6, marginTop: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
    testBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.secondary, borderRadius: 8, paddingVertical: 8,
    },
    testBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    editBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.secondary },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    formCard: {
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14,
    },
    formTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 14 },
    fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
    fieldInput: {
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: colors.radius, padding: 11, fontSize: 15,
      fontFamily: "Inter_400Regular", color: colors.foreground, marginBottom: 12,
    },
    segRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    segBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center" },
    segBtnActive: { backgroundColor: colors.primary },
    segBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    segBtnTextActive: { color: "#fff" },
    toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.secondary },
    toggleBtnOn: { backgroundColor: colors.primary },
    toggleBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    toggleBtnOnText: { color: "#fff" },
    formBtnRow: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 12, alignItems: "center" },
    cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, padding: 12, alignItems: "center" },
    saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
    storePickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    storeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    storeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    storeChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground },
    storeChipTextActive: { color: "#fff" },
  });

  const ContactForm = ({
    values, onChange, onSave, onCancel, saving, title,
  }: {
    values: { email: string; phone: string; label: string; storeId: string | null; severity: string; active: boolean };
    onChange: (key: string, val: any) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    title: string;
  }) => (
    <View style={s.formCard}>
      <Text style={s.formTitle}>{title}</Text>
      <Text style={s.fieldLabel}>Label</Text>
      <TextInput
        style={s.fieldInput} value={values.label}
        onChangeText={(v) => onChange("label", v)}
        placeholder="e.g. Store Manager" placeholderTextColor={colors.mutedForeground}
      />
      <Text style={s.fieldLabel}>Email Address (optional)</Text>
      <TextInput
        style={s.fieldInput} value={values.email}
        onChangeText={(v) => onChange("email", v)}
        placeholder="alerts@example.com" placeholderTextColor={colors.mutedForeground}
        keyboardType="email-address"
      />
      <Text style={s.fieldLabel}>Phone Number for SMS (optional)</Text>
      <TextInput
        style={s.fieldInput} value={values.phone}
        onChangeText={(v) => onChange("phone", v)}
        placeholder="+15551234567" placeholderTextColor={colors.mutedForeground}
        keyboardType="phone-pad"
      />
      <Text style={s.fieldLabel}>Store (optional — blank = all stores)</Text>
      <View style={s.storePickerRow}>
        <TouchableOpacity
          style={[s.storeChip, (!values.storeId) && s.storeChipActive]}
          onPress={() => onChange("storeId", null)}
        >
          <Text style={[s.storeChipText, (!values.storeId) && s.storeChipTextActive]}>All</Text>
        </TouchableOpacity>
        {(stores ?? []).map((st) => (
          <TouchableOpacity
            key={st.id}
            style={[s.storeChip, values.storeId === String(st.id) && s.storeChipActive]}
            onPress={() => onChange("storeId", String(st.id))}
          >
            <Text style={[s.storeChipText, values.storeId === String(st.id) && s.storeChipTextActive]}>{st.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.fieldLabel}>Alert Severity</Text>
      <View style={s.segRow}>
        {(["all", "warning", "critical"] as const).map((sev) => (
          <TouchableOpacity
            key={sev}
            style={[s.segBtn, values.severity === sev && s.segBtnActive]}
            onPress={() => onChange("severity", sev)}
          >
            <Text style={[s.segBtnText, values.severity === sev && s.segBtnTextActive]}>
              {sev.charAt(0).toUpperCase() + sev.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Active</Text>
        <TouchableOpacity
          style={[s.toggleBtn, values.active && s.toggleBtnOn]}
          onPress={() => onChange("active", !values.active)}
        >
          <Text style={[s.toggleBtnText, values.active && s.toggleBtnOnText]}>{values.active ? "ON" : "OFF"}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.formBtnRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={s.statusBanner}>
        <View style={[s.statusDot, { backgroundColor: status?.emailConfigured ? "#22c55e" : "#94a3b8" }]} />
        <Text style={s.statusText}>
          {status?.emailConfigured ? "Email (SMTP) configured and active" : "Email not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM"}
        </Text>
      </View>
      <View style={[s.statusBanner, { marginBottom: 14 }]}>
        <View style={[s.statusDot, { backgroundColor: status?.smsConfigured ? "#22c55e" : "#94a3b8" }]} />
        <Text style={s.statusText}>
          {status?.smsConfigured ? "SMS (Twilio) configured and active" : "SMS not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"}
        </Text>
      </View>

      {showAdd ? (
        <ContactForm
          title="Add Notification Contact"
          values={{ ...form, storeId: form.storeId || null }}
          onChange={(key, val) => setForm((prev) => ({ ...prev, [key]: val }))}
          onSave={handleAdd}
          onCancel={() => { setShowAdd(false); resetForm(); }}
          saving={creating}
        />
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>Add Notification Contact</Text>
        </TouchableOpacity>
      )}

      {editTarget && (
        <ContactForm
          title="Edit Notification Contact"
          values={{
            email: editTarget.email,
            phone: editTarget.phone,
            label: editTarget.label,
            storeId: editTarget.storeId ? String(editTarget.storeId) : null,
            severity: editTarget.severity,
            active: editTarget.active,
          }}
          onChange={(key, val) => setEditTarget((prev) => prev ? { ...prev, [key]: val } : prev)}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
          saving={updatingContact}
        />
      )}

      {isLoading ? <ActivityIndicator color={colors.primary} /> : !(contacts ?? []).length ? (
        <Text style={s.empty}>No notification contacts configured.</Text>
      ) : (contacts ?? []).map((c) => (
        <View key={c.id} style={s.card}>
          <View style={s.cardRow}>
            <View style={s.cardInfo}>
              <Text style={s.cardLabel}>{c.label}</Text>
              {c.email ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Feather name="mail" size={12} color={colors.mutedForeground} />
                  <Text style={s.cardPhone}>{c.email}</Text>
                </View>
              ) : null}
              {c.phone ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <Feather name="message-square" size={12} color={colors.mutedForeground} />
                  <Text style={s.cardPhone}>{c.phone}</Text>
                </View>
              ) : null}
              <Text style={s.cardMeta}>{c.storeName ? `Store: ${c.storeName}` : "All stores"}</Text>
            </View>
          </View>
          <View style={s.cardBadgeRow}>
            <View style={[s.badge, { backgroundColor: severityColor(c.severity) + "22" }]}>
              <Text style={[s.badgeText, { color: severityColor(c.severity) }]}>{c.severity}</Text>
            </View>
            {c.email ? (
              <View style={[s.badge, { backgroundColor: "#e0f2fe" }]}>
                <Text style={[s.badgeText, { color: "#0284c7" }]}>Email</Text>
              </View>
            ) : null}
            {c.phone ? (
              <View style={[s.badge, { backgroundColor: "#f0fdf4" }]}>
                <Text style={[s.badgeText, { color: "#16a34a" }]}>SMS</Text>
              </View>
            ) : null}
            <View style={[s.badge, { backgroundColor: c.active ? "#dcfce7" : "#f1f5f9" }]}>
              <Text style={[s.badgeText, { color: c.active ? "#16a34a" : colors.mutedForeground }]}>
                {c.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
          <View style={s.cardActions}>
            <TouchableOpacity style={s.testBtn} onPress={() => handleTest(c.id, c.label)}>
              <Feather name="send" size={14} color={colors.foreground} />
              <Text style={s.testBtnText}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => setEditTarget({
                id: c.id,
                email: c.email ?? "",
                phone: c.phone ?? "",
                label: c.label,
                storeId: c.storeId ?? null,
                severity: c.severity,
                active: c.active,
              })}
            >
              <Feather name="edit-2" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.delBtn} onPress={() => handleDelete(c.id, c.label)}>
              <Feather name="trash-2" size={16} color={colors.critical} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Admin Screen ───────────────────────────────────────────────────────
export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [authenticated, setAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("alerts");
  const webTop = Platform.OS === "web" ? 67 : 0;

  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} insets={{ top: insets.top }} />;
  }

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: "alerts", label: "Alerts", icon: "alert-triangle" },
    { key: "stores", label: "Stores", icon: "map-pin" },
    { key: "products", label: "Products", icon: "package" },
    { key: "counts", label: "Counts", icon: "clipboard" },
    { key: "notifications", label: "Notify", icon: "bell" },
  ];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16 + webTop,
      paddingHorizontal: 20, paddingBottom: 16,
      backgroundColor: colors.navy,
    },
    headerTop: { flexDirection: "row", alignItems: "center" },
    headerLabel: { fontSize: 12, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
    headerTitle: { fontSize: 26, color: "#fff", fontFamily: "Inter_700Bold", flex: 1 },
    lockBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)" },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.navy,
      paddingHorizontal: 16,
      paddingBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: colors.teal },
    tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginTop: 3 },
    tabTextActive: { color: colors.teal },
    content: { flex: 1 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerLabel}>Red Carpet Inventory</Text>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>Admin Panel</Text>
          <TouchableOpacity style={s.lockBtn} onPress={() => setAuthenticated(false)}>
            <Feather name="lock" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.tabBar}>
        {sections.map((sec) => (
          <TouchableOpacity key={sec.key} style={[s.tab, activeSection === sec.key && s.tabActive]} onPress={() => setActiveSection(sec.key)}>
            <Feather name={sec.icon as any} size={18} color={activeSection === sec.key ? colors.teal : "rgba(255,255,255,0.5)"} />
            <Text style={[s.tabText, activeSection === sec.key && s.tabTextActive]}>{sec.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.content}>
        {activeSection === "alerts" && <AlertsSection colors={colors} insets={insets} />}
        {activeSection === "stores" && <StoresSection colors={colors} insets={insets} />}
        {activeSection === "products" && <ProductsSection colors={colors} insets={insets} />}
        {activeSection === "counts" && <CountsSection colors={colors} insets={insets} />}
        {activeSection === "notifications" && <NotificationsSection colors={colors} insets={insets} />}
      </View>
    </View>
  );
}
