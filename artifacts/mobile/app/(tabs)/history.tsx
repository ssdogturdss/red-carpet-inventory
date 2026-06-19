import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal,
  FlatList, Pressable, TextInput, Alert, KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import { ReportBot } from "@/components/ReportBot";
import { PinScreen } from "@/components/PinScreen";
import Svg, { Polyline, Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInventoryCounts, useGetStores, useGetChemicals,
  useGetOnHand, useAdjustOnHand, useGetReceived, useLogReceived, useDeleteReceived,
  useGetOrders, useCreateOrder, useUpdateOrder, useDeleteOrder,
  useGetChemicalReport, useGetStoreReport, useGetMissingSubmissions,
  useGetPulls, useLogPull, useDeletePull,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type SubTab = "history" | "onhand" | "received" | "orders" | "online" | "reports";

function todayString() {
  return new Date().toISOString().split("T")[0]!;
}
function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type Store = { id: number; name: string; storeNumber: string };
type Chemical = { id: number; name: string; unit: string; thresholdPercent: number };

// ─── Generic Picker Modal ────────────────────────────────────────────────────
function PickerModal<T extends { id: number | undefined; name: string }>({
  visible, title, items, selected, onSelect, onClose, colors, insets,
}: {
  visible: boolean; title: string; items: T[];
  selected: number | undefined; onSelect: (id: number | undefined) => void;
  onClose: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  insets: { bottom: number };
}) {
  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 16, maxHeight: "60%" },
    header: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    option: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + "55" },
    optionText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    optionActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
  });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={colors.foreground} /></TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.id ?? "all")}
            renderItem={({ item }) => {
              const active = item.id === selected;
              return (
                <TouchableOpacity style={s.option} onPress={() => { onSelect(item.id as number | undefined); onClose(); }}>
                  <Text style={[s.optionText, active && s.optionActive]}>{item.name}</Text>
                  {active && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Sub-tab bar ─────────────────────────────────────────────────────────────
function SubTabBar({ active, onChange, colors }: { active: SubTab; onChange: (t: SubTab) => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const tabs: { key: SubTab; label: string; icon: string }[] = [
    { key: "history", label: "History", icon: "clock" },
    { key: "onhand", label: "On Hand", icon: "package" },
    { key: "received", label: "Received", icon: "download" },
    { key: "orders", label: "Orders", icon: "shopping-cart" },
    { key: "online", label: "Online", icon: "droplet" },
    { key: "reports", label: "Reports", icon: "bar-chart-2" },
  ];
  const s = StyleSheet.create({
    bar: { flexDirection: "row", backgroundColor: colors.navy, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
    tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabActive: { borderBottomColor: colors.teal },
    label: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginTop: 3 },
    labelActive: { color: colors.teal },
  });
  return (
    <View style={s.bar}>
      {tabs.map((t) => (
        <TouchableOpacity key={t.key} style={[s.tab, active === t.key && s.tabActive]} onPress={() => onChange(t.key)}>
          <Feather name={t.icon as any} size={17} color={active === t.key ? colors.teal : "rgba(255,255,255,0.5)"} />
          <Text style={[s.label, active === t.key && s.labelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── History Section ─────────────────────────────────────────────────────────
function HistorySection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: stores } = useGetStores();
  const { data: counts, isLoading, refetch } = useGetInventoryCounts({ storeId: selectedStoreId, limit: 200 });
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);
  const storeOptions = [{ id: undefined as number | undefined, name: "All Stores" }, ...(stores ?? [])];
  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    badge: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 10 },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: "hidden" },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
    cardInfo: { flex: 1 },
    storeName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    weekOf: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    entries: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
    entriesTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
    entryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border + "55" },
    entryName: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, flex: 1, marginRight: 8 },
    entryQty: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    entryUnit: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginLeft: 4 },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    notesBox: { marginTop: 10, backgroundColor: colors.secondary, borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
    notesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground },
  });
  return (
    <>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, selectedStoreId !== undefined && s.filterBtnActive]} onPress={() => setPickerOpen(true)}>
          <Feather name="filter" size={14} color={selectedStoreId !== undefined ? colors.primary : colors.mutedForeground} />
          <Text style={[s.filterBtnText, selectedStoreId !== undefined && s.filterBtnTextActive]}>
            {selectedStoreId ? stores?.find((s) => s.id === selectedStoreId)?.name : "All Stores"}
          </Text>
          <Feather name="chevron-down" size={14} color={selectedStoreId !== undefined ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !counts?.length ? (
          <Text style={s.empty}>No submissions found.</Text>
        ) : (
          <>
            <Text style={s.badge}>{counts.length} submission{counts.length !== 1 ? "s" : ""}</Text>
            {(counts as any[]).map((c) => {
              const expanded = expandedId === c.id;
              return (
                <View key={c.id} style={s.card}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => setExpandedId(expanded ? null : c.id)}>
                    <View style={s.cardInfo}>
                      <Text style={s.storeName}>{c.storeName}</Text>
                      <Text style={s.weekOf}>Week of {formatDate(c.weekOf)}</Text>
                      <Text style={s.meta}>By {c.submittedBy} · {formatDateTime(c.submittedAt)}</Text>
                    </View>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  {expanded && c.entries && (
                    <View style={s.entries}>
                      <Text style={s.entriesTitle}>Product Counts</Text>
                      {c.entries.map((e: any, i: number) => (
                        <View key={i} style={s.entryRow}>
                          <Text style={s.entryName}>{e.chemicalName}</Text>
                          <Text style={s.entryQty}>{e.quantity}</Text>
                          <Text style={s.entryUnit}>{e.unit}</Text>
                        </View>
                      ))}
                      {c.notes ? <View style={s.notesBox}><Text style={s.notesText}>{c.notes}</Text></View> : null}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      <PickerModal visible={pickerOpen} title="Filter by Store" items={storeOptions} selected={selectedStoreId}
        onSelect={setSelectedStoreId} onClose={() => setPickerOpen(false)} colors={colors} insets={insets} />
    </>
  );
}

// ─── On Hand Section ─────────────────────────────────────────────────────────
function OnHandSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<number | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<{ chemicalId: number; chemicalName: string; unit: string; quantity: number } | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const { data: stores } = useGetStores();
  const { data: onHand, isLoading, refetch } = useGetOnHand(
    { storeId: storeId! },
    { query: { enabled: !!storeId } as any }
  );
  const { mutateAsync: adjustOnHand } = useAdjustOnHand();
  const storeOptions = [{ id: undefined as number | undefined, name: "Select a store…" }, ...(stores ?? [])];

  const openAdjust = (e: { chemicalId: number; chemicalName: string; unit: string; quantity: number }) => {
    setAdjustEntry(e);
    setAdjustQty(String(e.quantity));
  };

  const submitAdjust = async () => {
    if (!adjustEntry || !storeId) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty < 0) { Alert.alert("Invalid quantity", "Enter a valid number."); return; }
    setAdjusting(true);
    try {
      await adjustOnHand({ data: { storeId, chemicalId: adjustEntry.chemicalId, quantity: qty, unit: adjustEntry.unit } });
      await qc.invalidateQueries();
      setAdjustEntry(null);
    } catch {
      Alert.alert("Error", "Failed to save adjustment.");
    } finally {
      setAdjusting(false);
    }
  };

  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    prompt: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    badge: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 12, textAlign: "center" },
    tableHeader: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: 8, marginBottom: 4 },
    headerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, backgroundColor: colors.card, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
    product: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    qty: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, width: 60, textAlign: "right" },
    unit: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, width: 50, textAlign: "right" },
    editBtn: { marginLeft: 10, padding: 4 },
    modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center" },
    modalCard: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: "86%", gap: 16 },
    modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: -8 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" },
    modalRow: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
    cancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" },
    saveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  });

  const lastUpdated = onHand?.updatedAt ? new Date(onHand.updatedAt) : null;

  return (
    <>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, !!storeId && s.filterBtnActive]} onPress={() => setPickerOpen(true)}>
          <Feather name="map-pin" size={14} color={storeId ? colors.primary : colors.mutedForeground} />
          <Text style={[s.filterBtnText, !!storeId && s.filterBtnTextActive]}>
            {storeId ? stores?.find((st) => st.id === storeId)?.name : "Select a store"}
          </Text>
          <Feather name="chevron-down" size={14} color={storeId ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}>
        {!storeId ? (
          <Text style={s.prompt}>Select a store to view current on-hand quantities.</Text>
        ) : isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !onHand?.entries?.length ? (
          <Text style={s.prompt}>No inventory data found for this store yet. Submit an initial count to set the baseline.</Text>
        ) : (
          <>
            <Text style={s.badge}>
              Running balance · Last updated{" "}
              {lastUpdated
                ? lastUpdated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : "—"}
            </Text>
            <View style={s.tableHeader}>
              <Text style={[s.headerText, { flex: 1 }]}>Product</Text>
              <Text style={[s.headerText, { width: 60, textAlign: "right" }]}>Qty</Text>
              <Text style={[s.headerText, { width: 50, textAlign: "right" }]}>Unit</Text>
              <Text style={[s.headerText, { width: 34, textAlign: "right" }]}> </Text>
            </View>
            {onHand.entries.map((e) => (
              <View key={e.chemicalId} style={s.row}>
                <Text style={s.product}>{e.chemicalName}</Text>
                <Text style={s.qty}>{e.quantity % 1 === 0 ? e.quantity : e.quantity.toFixed(2)}</Text>
                <Text style={s.unit}>{e.unit}</Text>
                <TouchableOpacity style={s.editBtn} onPress={() => openAdjust(e)}>
                  <Feather name="edit-2" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <PickerModal visible={pickerOpen} title="Select Store" items={storeOptions} selected={storeId}
        onSelect={(id) => setStoreId(id)} onClose={() => setPickerOpen(false)} colors={colors} insets={insets} />

      {/* Adjust modal */}
      <Modal visible={!!adjustEntry} transparent animationType="fade" onRequestClose={() => setAdjustEntry(null)}>
        <KeyboardAvoidingView behavior="padding" style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Adjust Inventory</Text>
            <Text style={s.modalSub}>{adjustEntry?.chemicalName} — set current on-hand quantity</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              value={adjustQty}
              onChangeText={setAdjustQty}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <View style={s.modalRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAdjustEntry(null)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={submitAdjust} disabled={adjusting}>
                <Text style={s.saveText}>{adjusting ? "Saving…" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Received Section ────────────────────────────────────────────────────────
function ReceivedSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const qc = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const [storeFilter, setStoreFilter] = useState<number | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storePickOpen, setStorePickOpen] = useState(false);
  const [productPickOpen, setProductPickOpen] = useState(false);
  const [formStore, setFormStore] = useState<number | undefined>();
  const [formProduct, setFormProduct] = useState<number | undefined>();
  const [formQty, setFormQty] = useState("");
  const [formDate, setFormDate] = useState(todayString());
  const [formBy, setFormBy] = useState("");
  const [formPO, setFormPO] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { data: records, isLoading, refetch } = useGetReceived({ storeId: storeFilter, limit: 200 });
  const { mutateAsync: logReceived, isPending: submitting } = useLogReceived();
  const { mutateAsync: deleteRec } = useDeleteReceived();
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);
  const storeOptions = [{ id: undefined as number | undefined, name: "All Stores" }, ...(stores ?? [])];
  const storeFormOptions = stores ?? [];
  const chemOptions = chemicals ?? [];
  const resetForm = () => { setFormStore(undefined); setFormProduct(undefined); setFormQty(""); setFormDate(todayString()); setFormBy(""); setFormPO(""); setFormNotes(""); };
  const handleSubmit = async () => {
    if (!formStore || !formProduct || !formQty || !formDate) {
      Alert.alert("Missing Fields", "Store, product, quantity, and date are required.");
      return;
    }
    await logReceived({ data: { storeId: formStore, chemicalId: formProduct, quantityReceived: parseFloat(formQty), receivedDate: formDate, receivedBy: formBy || undefined, userId: (currentUser && currentUser.id > 0) ? currentUser.id : null, poNumber: formPO || undefined, notes: formNotes || undefined } });
    qc.invalidateQueries();
    resetForm();
    setFormOpen(false);
  };
  const confirmDelete = (id: number) => Alert.alert("Delete Record", "Remove this receipt record?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deleteRec({ receivedId: id }); qc.invalidateQueries(); } },
  ]);
  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9 },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center" },
    info: { flex: 1 },
    product: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    qtyBadge: { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10 },
    qtyText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#16a34a" },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2", marginLeft: 8 },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 8 },
    formHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    formTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    formScroll: { maxHeight: 440 },
    field: { paddingHorizontal: 20, paddingTop: 14 },
    label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerBtnText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerPlaceholder: { color: colors.mutedForeground },
    btnRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18 },
    cancelBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  });
  return (
    <>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, !!storeFilter && s.filterBtnActive]} onPress={() => setFilterOpen(true)}>
          <Feather name="filter" size={14} color={storeFilter ? colors.primary : colors.mutedForeground} />
          <Text style={[s.filterBtnText, !!storeFilter && s.filterBtnTextActive]}>
            {storeFilter ? stores?.find((st) => st.id === storeFilter)?.name : "All Stores"}
          </Text>
          <Feather name="chevron-down" size={14} color={storeFilter ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => setFormOpen(true)}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.addBtnText}>Log Received</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !records?.length ? (
          <Text style={s.empty}>No received inventory logged yet.</Text>
        ) : records.map((r) => (
          <View key={r.id} style={s.card}>
            <View style={s.info}>
              <Text style={s.product}>{r.chemicalName}</Text>
              <Text style={s.meta}>{r.storeName} · {formatDate(r.receivedDate)}{r.receivedBy ? ` · By ${r.receivedBy}` : ""}</Text>
              {r.poNumber ? <Text style={s.meta}>PO: {r.poNumber}</Text> : null}
            </View>
            <View style={s.qtyBadge}>
              <Text style={s.qtyText}>+{r.quantityReceived} {r.unit}</Text>
            </View>
            <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(r.id)}>
              <Feather name="trash-2" size={15} color={colors.critical} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <PickerModal visible={filterOpen} title="Filter by Store" items={storeOptions} selected={storeFilter} onSelect={setStoreFilter} onClose={() => setFilterOpen(false)} colors={colors} insets={insets} />
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => { resetForm(); setFormOpen(false); }}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => { resetForm(); setFormOpen(false); }} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.formHeader}>
              <Text style={s.formTitle}>Log Received Inventory</Text>
              <TouchableOpacity onPress={() => { resetForm(); setFormOpen(false); }}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView style={s.formScroll} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Store</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setStorePickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formStore && s.pickerPlaceholder]}>{formStore ? storeFormOptions.find((s) => s.id === formStore)?.name : "Select store…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Product</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setProductPickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formProduct && s.pickerPlaceholder]}>{formProduct ? chemOptions.find((c) => c.id === formProduct)?.name : "Select product…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Quantity Received (gallons)</Text>
                <TextInput style={s.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Date Received</Text>
                <TextInput style={s.input} value={formDate} onChangeText={setFormDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Received By</Text>
                <TextInput style={s.input} value={formBy} onChangeText={setFormBy} placeholder="Name (optional)" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>PO Number</Text>
                <TextInput style={s.input} value={formPO} onChangeText={setFormPO} placeholder="Optional" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Notes</Text>
                <TextInput style={[s.input, { minHeight: 60 }]} value={formNotes} onChangeText={setFormNotes} placeholder="Optional" placeholderTextColor={colors.mutedForeground} multiline />
              </View>
            </ScrollView>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { resetForm(); setFormOpen(false); }}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitText}>Save Receipt</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PickerModal visible={storePickOpen} title="Select Store" items={storeFormOptions} selected={formStore} onSelect={setFormStore} onClose={() => setStorePickOpen(false)} colors={colors} insets={insets} />
      <PickerModal visible={productPickOpen} title="Select Product" items={chemOptions} selected={formProduct} onSelect={setFormProduct} onClose={() => setProductPickOpen(false)} colors={colors} insets={insets} />
    </>
  );
}

// ─── Orders Section ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pending: { label: "Pending", bg: "#fef9c3", color: "#854d0e", icon: "clock" },
  received: { label: "Received", bg: "#dcfce7", color: "#166534", icon: "check-circle" },
  cancelled: { label: "Cancelled", bg: "#f3f4f6", color: "#6b7280", icon: "x-circle" },
};

function OrdersSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const qc = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const [storeFilter, setStoreFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storePickOpen, setStorePickOpen] = useState(false);
  const [productPickOpen, setProductPickOpen] = useState(false);
  const [formStore, setFormStore] = useState<number | undefined>();
  const [formProduct, setFormProduct] = useState<number | undefined>();
  const [formQty, setFormQty] = useState("");
  const [formDate, setFormDate] = useState(todayString());
  const [formDelivery, setFormDelivery] = useState("");
  const [formPO, setFormPO] = useState("");
  const [formBy, setFormBy] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { data: orders, isLoading, refetch } = useGetOrders({ storeId: storeFilter, status: statusFilter, limit: 200 });
  const { mutateAsync: createOrder, isPending: submitting } = useCreateOrder();
  const { mutateAsync: updateOrder } = useUpdateOrder();
  const { mutateAsync: deleteOrder } = useDeleteOrder();
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);
  const storeOptions = [{ id: undefined as number | undefined, name: "All Stores" }, ...(stores ?? [])];
  const storeFormOptions = stores ?? [];
  const chemOptions = chemicals ?? [];
  const resetForm = () => { setFormStore(undefined); setFormProduct(undefined); setFormQty(""); setFormDate(todayString()); setFormDelivery(""); setFormPO(""); setFormBy(""); setFormNotes(""); };
  const handleSubmit = async () => {
    if (!formStore || !formProduct || !formQty || !formDate) { Alert.alert("Missing Fields", "Store, product, quantity, and order date are required."); return; }
    await createOrder({ data: { storeId: formStore, chemicalId: formProduct, quantityOrdered: parseFloat(formQty), orderDate: formDate, expectedDelivery: formDelivery || undefined, poNumber: formPO || undefined, orderedBy: formBy || undefined, userId: (currentUser && currentUser.id > 0) ? currentUser.id : null, notes: formNotes || undefined } });
    qc.invalidateQueries();
    resetForm();
    setFormOpen(false);
  };
  const handleStatusChange = (id: number, status: string) => {
    Alert.alert("Update Status", `Mark this order as ${status}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: async () => { await updateOrder({ orderId: id, data: { status } }); qc.invalidateQueries(); } },
    ]);
  };
  const confirmDelete = (id: number) => Alert.alert("Delete Order", "Remove this order permanently?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deleteOrder({ orderId: id }); qc.invalidateQueries(); } },
  ]);
  const statusOptions = [
    { id: undefined as any, name: "All Statuses" },
    { id: "pending" as any, name: "Pending" },
    { id: "received" as any, name: "Received" },
    { id: "cancelled" as any, name: "Cancelled" },
  ];
  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    filterBtns: { flexDirection: "row", gap: 8 },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8 },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8 },
    addBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14 },
    row1: { flexDirection: "row", alignItems: "flex-start" },
    info: { flex: 1 },
    product: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
    badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 },
    actionBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 8 },
    formHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    formTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    formScroll: { maxHeight: 460 },
    field: { paddingHorizontal: 20, paddingTop: 14 },
    label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerBtnText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerPlaceholder: { color: colors.mutedForeground },
    btnRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18 },
    cancelBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  });
  return (
    <>
      <View style={s.filterRow}>
        <View style={s.filterBtns}>
          <TouchableOpacity style={[s.filterBtn, !!storeFilter && s.filterBtnActive]} onPress={() => setFilterOpen(true)}>
            <Feather name="map-pin" size={13} color={storeFilter ? colors.primary : colors.mutedForeground} />
            <Text style={[s.filterBtnText, !!storeFilter && s.filterBtnTextActive]}>{storeFilter ? stores?.find((st) => st.id === storeFilter)?.name : "Store"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filterBtn, !!statusFilter && s.filterBtnActive]} onPress={() => {
            Alert.alert("Filter by Status", "", [
              { text: "All", onPress: () => setStatusFilter(undefined) },
              { text: "Pending", onPress: () => setStatusFilter("pending") },
              { text: "Received", onPress: () => setStatusFilter("received") },
              { text: "Cancelled", onPress: () => setStatusFilter("cancelled") },
              { text: "Cancel", style: "cancel" },
            ]);
          }}>
            <Text style={[s.filterBtnText, !!statusFilter && s.filterBtnTextActive]}>{statusFilter ? STATUS_CONFIG[statusFilter]?.label : "Status"}</Text>
            <Feather name="chevron-down" size={13} color={statusFilter ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setFormOpen(true)}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={s.addBtnText}>New Order</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !orders?.length ? (
          <Text style={s.empty}>No orders found.</Text>
        ) : orders.map((o) => {
          const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG["pending"]!;
          const canUpdateStatus = o.status === "pending";
          return (
            <View key={o.id} style={s.card}>
              <View style={s.row1}>
                <View style={s.info}>
                  <Text style={s.product}>{o.chemicalName}</Text>
                  <Text style={s.meta}>{o.storeName} · {o.quantityOrdered} {o.unit}</Text>
                  <Text style={s.meta}>Ordered: {formatDate(o.orderDate)}{o.expectedDelivery ? ` · ETA: ${formatDate(o.expectedDelivery)}` : ""}</Text>
                  {o.poNumber ? <Text style={s.meta}>PO: {o.poNumber}</Text> : null}
                  {o.orderedBy ? <Text style={s.meta}>By: {o.orderedBy}</Text> : null}
                </View>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Feather name={cfg.icon as any} size={12} color={cfg.color} />
                  <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <View style={s.actions}>
                {canUpdateStatus && (
                  <>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#dcfce7", flex: 2 }]} onPress={() => handleStatusChange(o.id, "received")}>
                      <Feather name="check-circle" size={14} color="#16a34a" />
                      <Text style={[s.actionBtnText, { color: "#16a34a" }]}>Mark Received</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.secondary }]} onPress={() => handleStatusChange(o.id, "cancelled")}>
                      <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(o.id)}>
                  <Feather name="trash-2" size={15} color={colors.critical} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <PickerModal visible={filterOpen} title="Filter by Store" items={storeOptions} selected={storeFilter} onSelect={setStoreFilter} onClose={() => setFilterOpen(false)} colors={colors} insets={insets} />
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => { resetForm(); setFormOpen(false); }}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => { resetForm(); setFormOpen(false); }} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.formHeader}>
              <Text style={s.formTitle}>Place Chemical Order</Text>
              <TouchableOpacity onPress={() => { resetForm(); setFormOpen(false); }}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView style={s.formScroll} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Store</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setStorePickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formStore && s.pickerPlaceholder]}>{formStore ? storeFormOptions.find((s) => s.id === formStore)?.name : "Select store…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Product</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setProductPickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formProduct && s.pickerPlaceholder]}>{formProduct ? chemOptions.find((c) => c.id === formProduct)?.name : "Select product…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Quantity Ordered (gallons)</Text>
                <TextInput style={s.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Order Date</Text>
                <TextInput style={s.input} value={formDate} onChangeText={setFormDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Expected Delivery</Text>
                <TextInput style={s.input} value={formDelivery} onChangeText={setFormDelivery} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>PO Number</Text>
                <TextInput style={s.input} value={formPO} onChangeText={setFormPO} placeholder="Optional" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Ordered By</Text>
                <TextInput style={s.input} value={formBy} onChangeText={setFormBy} placeholder="Name (optional)" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Notes</Text>
                <TextInput style={[s.input, { minHeight: 60 }]} value={formNotes} onChangeText={setFormNotes} placeholder="Optional" placeholderTextColor={colors.mutedForeground} multiline />
              </View>
            </ScrollView>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { resetForm(); setFormOpen(false); }}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitText}>Place Order</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PickerModal visible={storePickOpen} title="Select Store" items={storeFormOptions} selected={formStore} onSelect={setFormStore} onClose={() => setStorePickOpen(false)} colors={colors} insets={insets} />
      <PickerModal visible={productPickOpen} title="Select Product" items={chemOptions} selected={formProduct} onSelect={setFormProduct} onClose={() => setProductPickOpen(false)} colors={colors} insets={insets} />
    </>
  );
}

// ─── Online Log Section ───────────────────────────────────────────────────────
function nowISOLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OnlineSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const qc = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const [storeFilter, setStoreFilter] = useState<number | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storePickOpen, setStorePickOpen] = useState(false);
  const [productPickOpen, setProductPickOpen] = useState(false);
  const [formStore, setFormStore] = useState<number | undefined>();
  const [formProduct, setFormProduct] = useState<number | undefined>();
  const [formQty, setFormQty] = useState("");
  const [formPulledAt, setFormPulledAt] = useState(nowISOLocal());
  const [formInitials, setFormInitials] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const { data: stores } = useGetStores();
  const { data: chemicals } = useGetChemicals();
  const { data: records, isLoading, refetch } = useGetPulls({ storeId: storeFilter, limit: 300 });
  const { mutateAsync: logPull, isPending: submitting } = useLogPull();
  const { mutateAsync: deletePull } = useDeletePull();
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);
  const storeOptions = [{ id: undefined as number | undefined, name: "All Stores" }, ...(stores ?? [])];
  const storeFormOptions = stores ?? [];
  const chemOptions = chemicals ?? [];
  const resetForm = () => {
    setFormStore(undefined); setFormProduct(undefined); setFormQty("");
    setFormPulledAt(nowISOLocal()); setFormInitials(""); setFormNotes("");
  };
  const handleSubmit = async () => {
    if (!formStore || !formProduct || !formQty || !formInitials.trim()) {
      Alert.alert("Missing Fields", "Store, product, quantity, and initials are required.");
      return;
    }
    await logPull({
      data: {
        storeId: formStore,
        chemicalId: formProduct,
        quantity: parseFloat(formQty),
        pulledAt: formPulledAt ? new Date(formPulledAt).toISOString() : undefined,
        initials: formInitials.trim().toUpperCase(),
        userId: (currentUser && currentUser.id > 0) ? currentUser.id : null,
        notes: formNotes || undefined,
      },
    });
    qc.invalidateQueries();
    resetForm();
    setFormOpen(false);
  };
  const confirmDelete = (id: number) => Alert.alert("Delete Entry", "Remove this pull log entry?", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { await deletePull({ pullId: id }); qc.invalidateQueries(); } },
  ]);
  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9 },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    card: { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, marginBottom: 10, padding: 14, flexDirection: "row", alignItems: "center" },
    info: { flex: 1 },
    product: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    qtyBadge: { backgroundColor: "#e0f2fe", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10, alignItems: "center" },
    qtyText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#0369a1" },
    initBadge: { backgroundColor: colors.navy + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6 },
    initText: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.navy },
    delBtn: { padding: 8, borderRadius: 8, backgroundColor: "#fef2f2", marginLeft: 8 },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 8 },
    formHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    formTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    formScroll: { maxHeight: 440 },
    field: { paddingHorizontal: 20, paddingTop: 14 },
    label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
    input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerBtnText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground },
    pickerPlaceholder: { color: colors.mutedForeground },
    btnRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18 },
    cancelBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    submitBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: colors.radius, padding: 14, alignItems: "center" },
    submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  });
  return (
    <>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, !!storeFilter && s.filterBtnActive]} onPress={() => setFilterOpen(true)}>
          <Feather name="filter" size={14} color={storeFilter ? colors.primary : colors.mutedForeground} />
          <Text style={[s.filterBtnText, !!storeFilter && s.filterBtnTextActive]}>
            {storeFilter ? stores?.find((st) => st.id === storeFilter)?.name : "All Stores"}
          </Text>
          <Feather name="chevron-down" size={14} color={storeFilter ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setFormOpen(true); }}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.addBtnText}>Log Pull</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : !records?.length ? (
          <Text style={s.empty}>No pull-to-online entries logged yet.</Text>
        ) : records.map((r) => (
          <View key={r.id} style={s.card}>
            <View style={s.info}>
              <Text style={s.product}>{r.chemicalName}</Text>
              <Text style={s.meta}>{r.storeName} · {formatDateTime(r.pulledAt)}</Text>
              {r.notes ? <Text style={s.meta}>{r.notes}</Text> : null}
            </View>
            <View style={s.qtyBadge}>
              <Text style={s.qtyText}>{r.quantity} {r.unit}</Text>
            </View>
            <View style={s.initBadge}>
              <Text style={s.initText}>{r.initials}</Text>
            </View>
            <TouchableOpacity style={s.delBtn} onPress={() => confirmDelete(r.id)}>
              <Feather name="trash-2" size={15} color={colors.critical} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <PickerModal visible={filterOpen} title="Filter by Store" items={storeOptions} selected={storeFilter} onSelect={setStoreFilter} onClose={() => setFilterOpen(false)} colors={colors} insets={insets} />
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => { resetForm(); setFormOpen(false); }}>
        <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={{ flex: 1 }} onPress={() => { resetForm(); setFormOpen(false); }} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.formHeader}>
              <Text style={s.formTitle}>Log Chemical Pull to Online</Text>
              <TouchableOpacity onPress={() => { resetForm(); setFormOpen(false); }}><Feather name="x" size={20} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <ScrollView style={s.formScroll} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Store</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setStorePickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formStore && s.pickerPlaceholder]}>{formStore ? storeFormOptions.find((st) => st.id === formStore)?.name : "Select store…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Chemical</Text>
                <TouchableOpacity style={s.pickerBtn} onPress={() => setProductPickOpen(true)}>
                  <Text style={[s.pickerBtnText, !formProduct && s.pickerPlaceholder]}>{formProduct ? chemOptions.find((c) => c.id === formProduct)?.name : "Select chemical…"}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={s.field}>
                <Text style={s.label}>Quantity</Text>
                <TextInput style={s.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Date & Time Pulled</Text>
                <TextInput style={s.input} value={formPulledAt} onChangeText={setFormPulledAt} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Initials</Text>
                <TextInput style={s.input} value={formInitials} onChangeText={setFormInitials} placeholder="e.g. JD" placeholderTextColor={colors.mutedForeground} maxLength={6} autoCapitalize="characters" />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Notes (optional)</Text>
                <TextInput style={[s.input, { minHeight: 60 }]} value={formNotes} onChangeText={setFormNotes} placeholder="Optional" placeholderTextColor={colors.mutedForeground} multiline />
              </View>
            </ScrollView>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { resetForm(); setFormOpen(false); }}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitText}>Save Entry</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PickerModal visible={storePickOpen} title="Select Store" items={storeFormOptions} selected={formStore} onSelect={setFormStore} onClose={() => setStorePickOpen(false)} colors={colors} insets={insets} />
      <PickerModal visible={productPickOpen} title="Select Chemical" items={chemOptions} selected={formProduct} onSelect={setFormProduct} onClose={() => setProductPickOpen(false)} colors={colors} insets={insets} />
    </>
  );
}

// ─── Reports helpers ──────────────────────────────────────────────────────────
type ReportViewMode = "chemical" | "store" | "heatmap" | "diverge" | "grid" | "usage";
type SortMode = "name" | "qty-desc" | "qty-asc" | "alert" | "change-desc" | "change-asc" | "usage-desc" | "usage-asc";

function getMondayStr(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0]!;
}
function addWeeks(weekStr: string, n: number): string {
  const d = new Date(weekStr + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split("T")[0]!;
}
function ChangeBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) {
    return (
      <View style={{ width: 58, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8" }}>—</Text>
      </View>
    );
  }
  const up = pct >= 0;
  const bg = up ? "#fef2f2" : "#f0fdf4";
  const fg = up ? "#dc2626" : "#16a34a";
  return (
    <View style={{ width: 58, alignItems: "flex-end" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 }}>
        <Feather name={up ? "trending-up" : "trending-down"} size={9} color={fg} />
        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: fg }}>{Math.abs(pct).toFixed(1)}%</Text>
      </View>
    </View>
  );
}

// ─── Trend Sparkline ─────────────────────────────────────────────────────────
interface TrendPoint { weekOf: string; totalQuantity: number; storeCount: number }

function useTrend(chemicalId: number | undefined) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!chemicalId) return;
    setLoading(true);
    fetch(`/api/reports/trend?chemicalId=${chemicalId}&weeks=8`)
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [chemicalId]);
  return { data, loading };
}

function TrendSparkline({
  chemicalId, unit, colors,
}: {
  chemicalId: number;
  unit: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const { data, loading } = useTrend(chemicalId);
  const { width: screenW } = useWindowDimensions();
  const cardPad = 28; // 12 card padding × 2 + 4 outer margin
  const W = Math.max(200, screenW - cardPad - 28);
  const H = 72;
  const PAD = 10;

  if (loading) {
    return (
      <View style={{ height: 40, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }
  if (data.length < 2) return null;

  const vals = data.map((d) => d.totalQuantity);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.totalQuantity - minV) / range) * (H - PAD * 2),
    ...d,
  }));

  const polylinePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  const trending = last.totalQuantity >= prev.totalQuantity;
  const trendColor = trending ? "#16a34a" : "#dc2626";
  const trendBg = trending ? "#f0fdf4" : "#fef2f2";
  const shortWeek = (w: string) => {
    const d = new Date(w + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const pctChange = prev.totalQuantity !== 0
    ? ((last.totalQuantity - prev.totalQuantity) / prev.totalQuantity * 100).toFixed(1)
    : null;

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.9 }}>
          {data.length}-Week Trend · All Stores
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: trendBg, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Feather name={trending ? "trending-up" : "trending-down"} size={11} color={trendColor} />
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: trendColor }}>
            {pctChange !== null ? `${trending ? "+" : ""}${pctChange}%` : last.totalQuantity.toFixed(1)}
          </Text>
        </View>
      </View>
      <Svg width={W} height={H}>
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.teal}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === pts.length - 1 ? 5 : 3}
            fill={i === pts.length - 1 ? colors.teal : colors.card}
            stroke={colors.teal}
            strokeWidth="2"
          />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{shortWeek(data[0]!.weekOf)}</Text>
        <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: colors.primary }}>
          {last.totalQuantity.toFixed(1)} {unit} · {shortWeek(data[data.length - 1]!.weekOf)}
        </Text>
      </View>
    </View>
  );
}

// ─── Diverging Bar Chart ──────────────────────────────────────────────────────
function DivergingChart({
  chemReport, selectedChemIdx, colors,
}: {
  chemReport: ChemReportItem[] | undefined;
  selectedChemIdx: number;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const chemical = chemReport?.[selectedChemIdx];
  if (!chemical) {
    return (
      <View style={{ alignItems: "center", paddingTop: 60 }}>
        <Feather name="activity" size={44} color={colors.border} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, textAlign: "center" }}>
          No data for this week yet.
        </Text>
      </View>
    );
  }

  const stores = chemical.stores as { storeId: number; storeName: string; latestQuantity: number | null }[];
  const counted = stores.filter((s) => s.latestQuantity !== null);
  if (counted.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingTop: 60 }}>
        <Feather name="inbox" size={44} color={colors.border} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, textAlign: "center" }}>
          No counts recorded yet.
        </Text>
      </View>
    );
  }

  const avg = counted.reduce((sum, s) => sum + s.latestQuantity!, 0) / counted.length;

  const withDiff = stores.map((s) => ({
    ...s,
    diff: s.latestQuantity !== null ? s.latestQuantity - avg : null,
    pct: s.latestQuantity !== null && avg !== 0 ? ((s.latestQuantity - avg) / avg) * 100 : null,
  }));

  const sorted = [...withDiff].sort((a, b) => (b.diff ?? -999999) - (a.diff ?? -999999));
  const maxAbsDiff = Math.max(...withDiff.filter((s) => s.diff !== null).map((s) => Math.abs(s.diff!)), 0.001);
  const aboveCount = withDiff.filter((s) => s.diff !== null && s.diff > 0).length;
  const belowCount = withDiff.filter((s) => s.diff !== null && s.diff < 0).length;

  const NAME_W = 86;
  const HALF = 98;
  const CHART_W = HALF * 2;
  const VAL_W = 62;
  const BAR_H = 26;
  const ABOVE_COLOR = "#ef4444";
  const BELOW_COLOR = "#0d9488";

  const shortName = (name: string) => {
    const num = name.match(/\d+/)?.[0];
    const tail = name.replace(/Store\s*/i, "").replace(/\d+\s*/g, "").trim().split(/\s+/)[0] ?? "";
    return num ? `#${num} ${tail}`.trim() : (tail || name.slice(0, 10));
  };

  return (
    <View>
      {/* Chemical hero card */}
      <View style={{ backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(13,148,136,0.25)", alignItems: "center", justifyContent: "center" }}>
          <Feather name="activity" size={18} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>{chemical.chemicalName}</Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.tealLight, marginTop: 2 }}>
            Deviation from {counted.length}-store average · {chemical.unit}
          </Text>
        </View>
        <View style={{ backgroundColor: "rgba(13,148,136,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.teal }}>{avg.toFixed(1)}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: colors.tealLight, textTransform: "uppercase", letterSpacing: 0.5 }}>avg</Text>
        </View>
      </View>

      {/* Stat cards */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: "#fef2f2", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#fecaca" }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#dc2626" }}>{aboveCount}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>Above avg</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#bbf7d0" }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: "#16a34a" }}>{belowCount}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>Below avg</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.secondary, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground }}>{counted.length}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 }}>Stores</Text>
        </View>
      </View>

      {/* Column labels */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <View style={{ width: NAME_W }} />
        <Text style={{ width: HALF, textAlign: "right", fontSize: 9, fontFamily: "Inter_700Bold", color: BELOW_COLOR, letterSpacing: 0.5 }}>← BELOW AVG</Text>
        <View style={{ width: 2 }} />
        <Text style={{ width: HALF, textAlign: "left", paddingLeft: 4, fontSize: 9, fontFamily: "Inter_700Bold", color: ABOVE_COLOR, letterSpacing: 0.5 }}>ABOVE AVG →</Text>
        <View style={{ width: VAL_W }} />
      </View>

      {/* Bars */}
      {sorted.map((s) => {
        const hasDiff = s.diff !== null;
        const barWidth = hasDiff ? Math.round((Math.abs(s.diff!) / maxAbsDiff) * (HALF - 4)) : 0;
        const isAbove = hasDiff && s.diff! > 0;
        const isExact = hasDiff && s.diff === 0;
        const barColor = isAbove ? ABOVE_COLOR : BELOW_COLOR;
        const diffLabel = hasDiff
          ? `${isAbove ? "+" : ""}${s.diff!.toFixed(1)}`
          : "—";
        const pctLabel = s.pct !== null ? `${s.pct! >= 0 ? "+" : ""}${s.pct!.toFixed(0)}%` : "";

        return (
          <View key={s.storeId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            {/* Store name */}
            <Text style={{ width: NAME_W, fontSize: 11, fontFamily: "Inter_600SemiBold", color: hasDiff ? colors.foreground : colors.mutedForeground, paddingRight: 4 }} numberOfLines={1}>
              {shortName(s.storeName)}
            </Text>

            {/* Left (below avg) half */}
            <View style={{ width: HALF, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
              {hasDiff && !isAbove && !isExact && (
                <View style={{ width: barWidth, height: BAR_H, backgroundColor: BELOW_COLOR, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
              )}
            </View>

            {/* Center line */}
            <View style={{ width: 2, height: BAR_H + 4, backgroundColor: colors.border }} />

            {/* Right (above avg) half */}
            <View style={{ width: HALF, flexDirection: "row", alignItems: "center" }}>
              {hasDiff && isAbove && (
                <View style={{ width: barWidth, height: BAR_H, backgroundColor: ABOVE_COLOR, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
              )}
              {hasDiff && isExact && (
                <View style={{ width: 4, height: BAR_H, backgroundColor: colors.border, borderRadius: 2 }} />
              )}
            </View>

            {/* Value + pct */}
            <View style={{ width: VAL_W, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: !hasDiff ? colors.mutedForeground : isAbove ? "#dc2626" : "#0d9488" }}>
                {diffLabel}
              </Text>
              {pctLabel ? (
                <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{pctLabel}</Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {/* Average label */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ width: NAME_W }} />
        <View style={{ width: CHART_W + 2, alignItems: "center" }}>
          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
            ─── avg = {avg.toFixed(2)} {chemical.unit} ───
          </Text>
        </View>
        <View style={{ width: VAL_W }} />
      </View>

      {/* Note */}
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 8, lineHeight: 14 }}>
        Bars show deviation from the {counted.length}-store average. Red = above, teal = below.
      </Text>
    </View>
  );
}

// ─── Heatmap View ────────────────────────────────────────────────────────────
type ChemReportItem = {
  chemicalId: number;
  chemicalName: string;
  unit: string;
  alertThresholdPercent: number;
  stores: {
    storeId: number;
    storeName: string;
    latestQuantity: number | null;
    previousQuantity?: number | null;
    weekOf?: string | null;
    changePercent?: number | null;
    hasAlert?: boolean;
  }[];
};

function heatTealColor(ratio: number): string {
  if (ratio <= 0) return "#f1f5f9";
  const stops: [number, number, number][] = [
    [240, 253, 250],
    [153, 246, 228],
    [45, 212, 191],
    [13, 148, 136],
    [15, 118, 110],
  ];
  const idx = ratio * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(Math.ceil(idx), stops.length - 1);
  const t = idx - lo;
  const r = Math.round(stops[lo]![0] + (stops[hi]![0] - stops[lo]![0]) * t);
  const g = Math.round(stops[lo]![1] + (stops[hi]![1] - stops[lo]![1]) * t);
  const b = Math.round(stops[lo]![2] + (stops[hi]![2] - stops[lo]![2]) * t);
  return `rgb(${r},${g},${b})`;
}

function fmtQty(n: number): string {
  return n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function HeatmapView({
  chemReport, weekLabel, colors,
}: {
  chemReport: ChemReportItem[] | undefined;
  weekLabel: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const chemList = chemReport ?? [];
  const storeList = chemList[0]?.stores ?? [];

  if (!chemList.length || !storeList.length) {
    return (
      <View style={{ alignItems: "center", paddingTop: 60 }}>
        <Feather name="grid" size={44} color={colors.border} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, textAlign: "center" }}>
          No data for this week yet.
        </Text>
      </View>
    );
  }

  const CELL_W = 42;
  const NAME_W = 82;
  const TOTAL_W = 50;
  const CELL_H = 36;
  const HEADER_H = 72;

  const colMaxes = chemList.map((c) => {
    const vals = c.stores.filter((s) => s.latestQuantity != null).map((s) => s.latestQuantity!);
    return vals.length ? Math.max(...vals) : 0;
  });

  const storeTotals = storeList.map((st) =>
    chemList.reduce((sum, chem) => {
      const s = chem.stores.find((s) => s.storeId === st.storeId);
      return sum + (s?.latestQuantity ?? 0);
    }, 0)
  );

  const chemTotals = chemList.map((chem) =>
    chem.stores.reduce((sum, s) => sum + (s.latestQuantity ?? 0), 0)
  );
  const grandTotal = storeTotals.reduce((a, b) => a + b, 0);
  const chemTotalMax = Math.max(...chemTotals.filter((t) => t > 0), 1);

  const abbrev = (name: string) => {
    const w = name.trim().split(/\s+/);
    if (w.length === 1) return name.slice(0, 6);
    if (w.length === 2) return `${w[0]!.slice(0, 4)} ${w[1]!.slice(0, 3)}`;
    return w.map((x) => x[0]).join("").slice(0, 5).toUpperCase();
  };

  const shortStore = (name: string) => {
    const m = name.match(/\d+/);
    const num = m ? `#${m[0]}` : "";
    const words = name.replace(/Store\s*/i, "").replace(/\d+/, "").trim().split(/\s+/);
    const label = words[0] ?? "";
    return num ? `${num} ${label}`.trim() : label || name.slice(0, 8);
  };

  return (
    <View>
      {/* Week label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Feather name="calendar" size={13} color={colors.mutedForeground} />
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
          {weekLabel === "This Week" ? "Latest week on record" : `Week of ${weekLabel}`}
        </Text>
      </View>

      {/* The matrix — scrolls horizontally */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Chemical header row */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
            <View style={{ width: NAME_W }} />
            {chemList.map((c, ci) => (
              <View key={ci} style={{ width: CELL_W, height: HEADER_H, alignItems: "center", justifyContent: "flex-end", paddingBottom: 5 }}>
                <View style={{ transform: [{ rotate: "-55deg" }], width: 70, overflow: "visible" }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, whiteSpace: "nowrap" } as any} numberOfLines={1}>
                    {abbrev(c.chemicalName)}
                  </Text>
                </View>
              </View>
            ))}
            <View style={{ width: TOTAL_W, height: HEADER_H, alignItems: "center", justifyContent: "flex-end", paddingBottom: 5 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: colors.foreground }}>Total</Text>
            </View>
          </View>

          {/* Store rows */}
          {storeList.map((st, ri) => {
            const stTotal = storeTotals[ri] ?? 0;
            return (
              <View key={st.storeId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                <View style={{ width: NAME_W, paddingRight: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>
                    {shortStore(st.storeName)}
                  </Text>
                </View>
                {chemList.map((chem, ci) => {
                  const sd = chem.stores.find((s) => s.storeId === st.storeId);
                  const qty = sd?.latestQuantity ?? null;
                  const ratio = qty != null && colMaxes[ci]! > 0 ? qty / colMaxes[ci]! : 0;
                  const bg = qty == null ? "#f8fafc" : heatTealColor(ratio);
                  const fg = ratio > 0.55 ? "#fff" : "#0f172a";
                  return (
                    <View key={ci} style={{ width: CELL_W - 2, height: CELL_H - 2, borderRadius: 5, backgroundColor: bg, alignItems: "center", justifyContent: "center", margin: 1 }}>
                      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: qty == null ? "#cbd5e1" : fg }}>
                        {qty == null ? "—" : fmtQty(qty)}
                      </Text>
                    </View>
                  );
                })}
                {/* Row total */}
                <View style={{ width: TOTAL_W - 2, height: CELL_H - 2, borderRadius: 5, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", margin: 1, marginLeft: 3 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(stTotal)}</Text>
                </View>
              </View>
            );
          })}

          {/* Totals row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ width: NAME_W, paddingRight: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>Total</Text>
            </View>
            {chemTotals.map((t, i) => {
              const ratio = chemTotalMax > 0 ? t / chemTotalMax : 0;
              return (
                <View key={i} style={{ width: CELL_W - 2, height: CELL_H - 6, borderRadius: 5, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", margin: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(t)}</Text>
                </View>
              );
            })}
            {/* Grand total */}
            <View style={{ width: TOTAL_W - 2, height: CELL_H - 6, borderRadius: 5, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", margin: 1, marginLeft: 3 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(grandTotal)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 16, flexWrap: "wrap" }}>
        <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginRight: 2 }}>Low</Text>
        {[0.1, 0.25, 0.45, 0.65, 0.85].map((r, i) => (
          <View key={i} style={{ width: 22, height: 14, borderRadius: 3, backgroundColor: heatTealColor(r) }} />
        ))}
        <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginLeft: 2 }}>High</Text>
        <View style={{ width: 22, height: 14, borderRadius: 3, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: colors.border, marginLeft: 8 }} />
        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>No count</Text>
      </View>

      {/* Note */}
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 8 }}>
        Color intensity is per-chemical (each column scaled independently).
      </Text>
    </View>
  );
}

// ─── Usage Report ─────────────────────────────────────────────────────────────
function UsageView({
  chemReport, selectedStoreId, sortMode, weekLabel, colors,
}: {
  chemReport: ChemReportItem[] | undefined;
  selectedStoreId: number | undefined;
  sortMode: SortMode;
  weekLabel: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  if (!chemReport?.length) {
    return (
      <View style={{ alignItems: "center", paddingTop: 60 }}>
        <Feather name="trending-down" size={44} color={colors.border} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, textAlign: "center", lineHeight: 20 }}>
          No data yet.{"\n"}Submit a count to see usage.
        </Text>
      </View>
    );
  }

  type UsageRow = {
    chemicalId: number;
    chemicalName: string;
    unit: string;
    prevTotal: number | null;
    currTotal: number | null;
    usage: number | null;
    pctConsumed: number | null;
    hasAlert: boolean;
  };

  const rows: UsageRow[] = chemReport.map((chem) => {
    const storeData = selectedStoreId
      ? chem.stores.filter((s) => s.storeId === selectedStoreId)
      : chem.stores;
    // Only compare stores that have BOTH a current and previous count.
    // Mixing different store sets would produce meaningless totals.
    const withBoth = storeData.filter((s) => s.previousQuantity !== null && s.latestQuantity !== null);
    const prevTotal = withBoth.length > 0 ? withBoth.reduce((sum, s) => sum + s.previousQuantity!, 0) : null;
    const currTotal = withBoth.length > 0 ? withBoth.reduce((sum, s) => sum + s.latestQuantity!, 0) : null;
    const usage = prevTotal !== null && currTotal !== null ? prevTotal - currTotal : null;
    const pctConsumed = usage !== null && prevTotal !== null && prevTotal > 0
      ? Math.round((usage / prevTotal) * 1000) / 10 : null;
    return {
      chemicalId: chem.chemicalId,
      chemicalName: chem.chemicalName,
      unit: chem.unit,
      prevTotal,
      currTotal,
      usage,
      pctConsumed,
      hasAlert: storeData.some((s) => s.hasAlert),
    };
  });

  const sorted = [...rows].sort((a, b) => {
    switch (sortMode) {
      case "usage-desc": return (b.usage ?? -999999) - (a.usage ?? -999999);
      case "usage-asc":  return (a.usage ?? 999999) - (b.usage ?? 999999);
      case "alert":      return (b.hasAlert ? 1 : 0) - (a.hasAlert ? 1 : 0);
      case "qty-desc":   return (b.currTotal ?? -1) - (a.currTotal ?? -1);
      case "qty-asc":    return (a.currTotal ?? 999999) - (b.currTotal ?? 999999);
      default:           return a.chemicalName.localeCompare(b.chemicalName);
    }
  });

  const totalUsage = rows.reduce((sum, r) => sum + (r.usage ?? 0), 0);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.usage ?? 0)));

  return (
    <View>
      {/* Hero summary card */}
      <View style={{ backgroundColor: colors.navy, borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(13,148,136,0.25)", alignItems: "center", justifyContent: "center" }}>
          <Feather name="trending-down" size={20} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" }}>Usage Since Prior Count</Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(94,234,212,0.85)", marginTop: 2 }}>
            {weekLabel === "This Week" ? "Latest week on record" : `Week of ${weekLabel}`}
            {selectedStoreId ? " · 1 store" : " · all stores combined"}
          </Text>
        </View>
        <View style={{ backgroundColor: "rgba(13,148,136,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#2dd4bf" }}>
            {totalUsage < 0 ? `-${fmtQty(Math.abs(totalUsage))}` : fmtQty(totalUsage)}
          </Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(94,234,212,0.8)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            total used
          </Text>
        </View>
      </View>

      {/* Column headers */}
      <View style={{ flexDirection: "row", paddingHorizontal: 4, paddingBottom: 6 }}>
        <Text style={{ flex: 1, fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 }}>Chemical</Text>
        <Text style={{ width: 52, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 }}>Prior</Text>
        <Text style={{ width: 52, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 }}>Now</Text>
        <Text style={{ width: 62, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 }}>Used</Text>
      </View>

      {/* Chemical rows */}
      {sorted.map((row) => {
        const isGain   = row.usage !== null && row.usage < 0;
        const barPct   = maxAbs > 0 && row.usage !== null ? Math.abs(row.usage) / maxAbs : 0;
        const barColor = row.hasAlert ? "#dc2626" : isGain ? "#7c3aed" : row.usage !== null && row.usage > 0 ? colors.teal : colors.border;
        const accentColor = row.hasAlert ? "#ef4444" : isGain ? "#7c3aed" : row.usage !== null && row.usage > 0 ? colors.teal : colors.border;

        return (
          <View
            key={row.chemicalId}
            style={{ backgroundColor: row.hasAlert ? "#fff5f5" : colors.card, borderRadius: 10, marginBottom: 5, borderWidth: 1, borderColor: row.hasAlert ? "#fecaca" : colors.border, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 12, paddingVertical: 11 }}>
              <View style={{ width: 4, alignSelf: "stretch", backgroundColor: accentColor, marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>
                  {row.chemicalName}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                  {row.unit}
                  {row.pctConsumed !== null
                    ? `  ·  ${Math.abs(row.pctConsumed)}% ${row.pctConsumed >= 0 ? "consumed" : "restocked"}`
                    : ""}
                </Text>
              </View>
              <Text style={{ width: 52, textAlign: "right", fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {row.prevTotal !== null ? fmtQty(row.prevTotal) : "—"}
              </Text>
              <Text style={{ width: 52, textAlign: "right", fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}>
                {row.currTotal !== null ? fmtQty(row.currTotal) : "—"}
              </Text>
              <Text style={{ width: 62, textAlign: "right", fontSize: 15, fontFamily: "Inter_700Bold", color: barColor }}>
                {row.usage === null ? "—" : row.usage === 0 ? "0" : isGain ? `-${fmtQty(Math.abs(row.usage))}` : `+${fmtQty(row.usage)}`}
              </Text>
            </View>
            {row.usage !== null && (
              <View style={{ height: 3, backgroundColor: colors.secondary }}>
                <View style={{ height: 3, width: `${Math.round(barPct * 100)}%`, backgroundColor: barColor, opacity: 0.65 }} />
              </View>
            )}
          </View>
        );
      })}

      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, lineHeight: 15 }}>
        Usage = prior count minus current count. Teal = consumed. Purple = restocked above prior level. Red = alert triggered.
      </Text>
    </View>
  );
}

function GridView({
  chemReport, weekLabel, colors,
}: {
  chemReport: ChemReportItem[] | undefined;
  weekLabel: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const allChemList = chemReport ?? [];
  const [hiddenChems, setHiddenChems] = useState<Set<number>>(new Set());

  const toggleChem = (id: number) =>
    setHiddenChems((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const chemList = allChemList.filter((c) => !hiddenChems.has(c.chemicalId));
  const storeList = allChemList[0]?.stores ?? [];

  if (!allChemList.length || !storeList.length) {
    return (
      <View style={{ alignItems: "center", paddingTop: 60 }}>
        <Feather name="layout" size={44} color={colors.border} />
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, textAlign: "center", lineHeight: 20 }}>
          No data for this week yet.{"\n"}Submit a count to see the full grid.
        </Text>
      </View>
    );
  }

  if (chemList.length === 0) {
    return (
      <>
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>
            Hide chemicals ({hiddenChems.size} hidden)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity onPress={() => setHiddenChems(new Set())} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.primary }}>
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" }}>Show All</Text>
              </TouchableOpacity>
              {allChemList.map((c) => (
                <TouchableOpacity key={c.chemicalId} onPress={() => toggleChem(c.chemicalId)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{abbrev(c.chemicalName)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <Feather name="eye-off" size={36} color={colors.border} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 10 }}>All chemicals hidden. Tap chips above to show.</Text>
        </View>
      </>
    );
  }

  const CELL_W = 44;
  const NAME_W = 86;
  const TOTAL_W = 50;
  const CELL_H = 40;
  const HEADER_H = 90;

  const storeTotals = storeList.map((st) =>
    chemList.reduce((sum, chem) => {
      const s = chem.stores.find((s) => s.storeId === st.storeId);
      return sum + (s?.latestQuantity ?? 0);
    }, 0)
  );
  const chemTotals = chemList.map((chem) =>
    chem.stores.reduce((sum, s) => sum + (s.latestQuantity ?? 0), 0)
  );
  const grandTotal = storeTotals.reduce((a, b) => a + b, 0);

  const abbrev = (name: string) => {
    const w = name.trim().split(/\s+/);
    if (w.length === 1) return name.slice(0, 7);
    if (w.length === 2) return `${w[0]!.slice(0, 4)} ${w[1]!.slice(0, 3)}`;
    return w.map((x) => x[0]).join("").slice(0, 5).toUpperCase();
  };
  const shortStore = (name: string) => {
    const m = name.match(/\d+/);
    const num = m ? `#${m[0]}` : "";
    const words = name.replace(/Store\s*/i, "").replace(/\d+/, "").trim().split(/\s+/);
    const label = words[0] ?? "";
    return num ? `${num} ${label}`.trim() : label || name.slice(0, 8);
  };

  const getCellColors = (
    qty: number | null,
    hasAlert: boolean,
    changePercent: number | null,
    threshold: number
  ): { bg: string; fg: string; border: string } => {
    if (qty === null) return { bg: "#f8fafc", fg: "#cbd5e1", border: "#e2e8f0" };
    if (!hasAlert) return { bg: colors.card, fg: colors.foreground, border: colors.border };
    const absPct = Math.abs(changePercent ?? threshold);
    if (absPct >= threshold * 2) return { bg: "#fee2e2", fg: "#dc2626", border: "#fecaca" };
    return { bg: "#fefce8", fg: "#ca8a04", border: "#fde68a" };
  };

  return (
    <View>
      {/* Week label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Feather name="calendar" size={13} color={colors.mutedForeground} />
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
          {weekLabel === "This Week" ? "Latest week on record" : `Week of ${weekLabel}`}
        </Text>
      </View>

      {/* Chemical filter chips */}
      <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>
          Hide chemicals ({hiddenChems.size} hidden)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {hiddenChems.size > 0 && (
              <TouchableOpacity
                onPress={() => setHiddenChems(new Set())}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.primary }}
              >
                <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" }}>Show All</Text>
              </TouchableOpacity>
            )}
            {allChemList.map((c) => {
              const hidden = hiddenChems.has(c.chemicalId);
              return (
                <TouchableOpacity
                  key={c.chemicalId}
                  onPress={() => toggleChem(c.chemicalId)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: hidden ? colors.secondary : colors.card, borderWidth: 1, borderColor: hidden ? colors.border : colors.primary + "60" }}
                >
                  <Text style={{ fontSize: 10, fontFamily: hidden ? "Inter_400Regular" : "Inter_600SemiBold", color: hidden ? colors.mutedForeground : colors.primary }}>
                    {abbrev(c.chemicalName)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {[
          { bg: colors.card, border: colors.border, label: "Normal" },
          { bg: "#fefce8", border: "#fde68a", label: "Warning" },
          { bg: "#fee2e2", border: "#fecaca", label: "Critical" },
          { bg: "#f8fafc", border: "#e2e8f0", label: "No count" },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: item.bg, borderWidth: 1, borderColor: item.border }} />
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Matrix — scrolls horizontally */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Chemical header row */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 3 }}>
            <View style={{ width: NAME_W }} />
            {chemList.map((c, ci) => (
              <View key={ci} style={{ width: CELL_W, height: HEADER_H, alignItems: "center", justifyContent: "flex-end", paddingBottom: 5, overflow: "visible", zIndex: 10 }}>
                <View style={{ transform: [{ rotate: "-55deg" }], width: 80, overflow: "visible", alignItems: "flex-start" }}>
                  <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }} numberOfLines={2}>
                    {c.chemicalName}
                  </Text>
                </View>
              </View>
            ))}
            <View style={{ width: TOTAL_W, height: HEADER_H, alignItems: "center", justifyContent: "flex-end", paddingBottom: 5, marginLeft: 3 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: colors.foreground }}>Total</Text>
            </View>
          </View>

          {/* Store rows */}
          {storeList.map((st, ri) => {
            const stTotal = storeTotals[ri] ?? 0;
            return (
              <View key={st.storeId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                <View style={{ width: NAME_W, paddingRight: 6 }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground }} numberOfLines={1}>
                    {shortStore(st.storeName)}
                  </Text>
                </View>
                {chemList.map((chem, ci) => {
                  const sd = chem.stores.find((s) => s.storeId === st.storeId);
                  const qty = sd?.latestQuantity ?? null;
                  const cell = getCellColors(qty, sd?.hasAlert ?? false, sd?.changePercent ?? null, chem.alertThresholdPercent);
                  const fontSize = qty !== null && qty >= 10000 ? 8 : qty !== null && qty >= 1000 ? 9 : 11;
                  return (
                    <View key={ci} style={{ width: CELL_W - 2, height: CELL_H - 2, borderRadius: 5, backgroundColor: cell.bg, borderWidth: 1, borderColor: cell.border, alignItems: "center", justifyContent: "center", margin: 1 }}>
                      <Text style={{ fontSize, fontFamily: qty === null ? "Inter_400Regular" : "Inter_700Bold", color: cell.fg }}>
                        {qty === null ? "—" : fmtQty(qty)}
                      </Text>
                    </View>
                  );
                })}
                {/* Row total */}
                <View style={{ width: TOTAL_W - 2, height: CELL_H - 2, borderRadius: 5, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", margin: 1, marginLeft: 4 }}>
                  <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(stTotal)}</Text>
                </View>
              </View>
            );
          })}

          {/* Totals footer row */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 5, paddingTop: 5, borderTopWidth: 1.5, borderTopColor: colors.border }}>
            <View style={{ width: NAME_W, paddingRight: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground }}>Totals</Text>
            </View>
            {chemTotals.map((t, i) => (
              <View key={i} style={{ width: CELL_W - 2, height: CELL_H - 6, borderRadius: 5, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", margin: 1 }}>
                <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(t)}</Text>
              </View>
            ))}
            <View style={{ width: TOTAL_W - 2, height: CELL_H - 6, borderRadius: 5, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", margin: 1, marginLeft: 4 }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_700Bold", color: "#fff" }}>{fmtQty(grandTotal)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Caption */}
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 10, lineHeight: 14 }}>
        Shows latest count per store. Yellow = warning alert, red = critical alert (change exceeds threshold × 2). Scroll right to see all {chemList.length} chemicals.
      </Text>
    </View>
  );
}

// ─── Reports Section — PIN-gated, Bot + Analytics toggle ─────────────────────
const BASE_API = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function ReportsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [mode, setMode] = useState<"bot" | "analytics">("bot");
  const [botLabel, setBotLabel] = useState("Report Bot");

  useEffect(() => {
    fetch(`${BASE_API}/api/bot-settings/public`)
      .then((r) => r.json())
      .then((d) => { if (d.botName) setBotLabel(d.botName); })
      .catch(() => {});
  }, []);

  if (!adminPin) {
    return (
      <PinScreen
        title="Reports Access"
        subtitle="Enter your admin PIN to view reports"
        insets={{ top: insets.top }}
        onSuccess={(pin) => setAdminPin(pin)}
      />
    );
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    toggle: {
      flexDirection: "row", backgroundColor: colors.card,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      padding: 10, gap: 8,
    },
    toggleBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 8, borderRadius: 10,
      backgroundColor: colors.secondary,
    },
    toggleBtnActive: { backgroundColor: colors.primary },
    toggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    toggleTextActive: { color: "#fff" },
  });

  return (
    <View style={s.container}>
      <View style={s.toggle}>
        <TouchableOpacity style={[s.toggleBtn, mode === "bot" && s.toggleBtnActive]} onPress={() => setMode("bot")}>
          <Feather name="zap" size={14} color={mode === "bot" ? "#fff" : colors.mutedForeground} />
          <Text style={[s.toggleText, mode === "bot" && s.toggleTextActive]}>{botLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleBtn, mode === "analytics" && s.toggleBtnActive]} onPress={() => setMode("analytics")}>
          <Feather name="bar-chart-2" size={14} color={mode === "analytics" ? "#fff" : colors.mutedForeground} />
          <Text style={[s.toggleText, mode === "analytics" && s.toggleTextActive]}>Analytics</Text>
        </TouchableOpacity>
      </View>
      {mode === "bot"
        ? <ReportBot bottomInset={insets.bottom} adminPin={adminPin} />
        : <AnalyticsSection colors={colors} insets={insets} />
      }
    </View>
  );
}

// ─── Analytics Section (charts/tables view) ──────────────────────────────────
function AnalyticsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const [viewMode, setViewMode] = useState<ReportViewMode>("chemical");
  const [selectedChemIdx, setSelectedChemIdx] = useState(0);
  const [selectedStoreId, setSelectedStoreId] = useState<number | undefined>();
  const [weekOf, setWeekOf] = useState<string | undefined>();
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [chemPickerOpen, setChemPickerOpen] = useState(false);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [missingExpanded, setMissingExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentWeek = getMondayStr();

  const { data: stores } = useGetStores();
  const { data: chemReport, isLoading: chemLoading, refetch: refetchChem } = useGetChemicalReport(weekOf ? { weekOf } : {});
  const { data: storeReport, isLoading: storeLoading, refetch: refetchStore } = useGetStoreReport(
    selectedStoreId!,
    weekOf ? { weekOf } : {},
    { query: { enabled: !!selectedStoreId } as any }
  );
  const { data: missing } = useGetMissingSubmissions();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewMode === "store" && selectedStoreId) await refetchStore();
    else await refetchChem();
    setRefreshing(false);
  }, [viewMode, selectedStoreId, refetchChem, refetchStore]);

  const isLoading = viewMode === "store" ? storeLoading : chemLoading;

  const chemical = chemReport?.[selectedChemIdx];
  const chemOptions = (chemReport ?? []).map((c, i) => ({ id: i, name: c.chemicalName }));
  const storeOptions = [{ id: undefined as number | undefined, name: "Select a store…" }, ...(stores ?? [])];

  const sortedStores = [...(chemical?.stores ?? [])].sort((a, b) => {
    switch (sortMode) {
      case "qty-desc": return (b.latestQuantity ?? -1) - (a.latestQuantity ?? -1);
      case "qty-asc": return (a.latestQuantity ?? 999999) - (b.latestQuantity ?? 999999);
      case "alert": return (b.hasAlert ? 1 : 0) - (a.hasAlert ? 1 : 0);
      case "change-desc": return (b.changePercent ?? -999) - (a.changePercent ?? -999);
      case "change-asc": return (a.changePercent ?? 999) - (b.changePercent ?? 999);
      default: return a.storeName.localeCompare(b.storeName);
    }
  });

  const sortedChemicals = [...(storeReport?.chemicals ?? [])].sort((a, b) => {
    switch (sortMode) {
      case "qty-desc": return (b.quantity ?? -1) - (a.quantity ?? -1);
      case "qty-asc": return (a.quantity ?? 999999) - (b.quantity ?? 999999);
      case "alert": return (b.hasAlert ? 1 : 0) - (a.hasAlert ? 1 : 0);
      case "change-desc": return (b.changePercent ?? -999) - (a.changePercent ?? -999);
      case "change-asc": return (a.changePercent ?? 999) - (b.changePercent ?? 999);
      default: return a.chemicalName.localeCompare(b.chemicalName);
    }
  });

  const counted = sortedStores.filter((s) => s.latestQuantity !== null);
  const avg = counted.length ? counted.reduce((sum, s) => sum + (s.latestQuantity ?? 0), 0) / counted.length : null;
  const maxQty = counted.length ? Math.max(...counted.map((s) => s.latestQuantity ?? 0)) : 0;
  const minQty = counted.length ? Math.min(...counted.map((s) => s.latestQuantity ?? 0)) : 0;
  const alertCount = sortedStores.filter((st) => st.hasAlert).length;

  const weekLabel = weekOf ? formatDate(weekOf) : "This Week";
  const canGoForward = !!weekOf && weekOf < currentWeek;
  const handleWeekBack = () => setWeekOf(addWeeks(weekOf ?? currentWeek, -1));
  const handleWeekForward = () => {
    if (!weekOf) return;
    const next = addWeeks(weekOf, 1);
    setWeekOf(next >= currentWeek ? undefined : next);
  };

  const getBarColor = (qty: number | null | undefined) => {
    if (qty == null) return colors.border;
    if (avg === null || maxQty === 0) return colors.teal;
    const ratio = qty / maxQty;
    if (ratio < 0.25) return "#ef4444";
    if (ratio < 0.5) return "#f59e0b";
    return colors.teal;
  };

  const s = StyleSheet.create({
    outer: { flex: 1 },
    // ── top controls ──
    controlsWrap: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    topRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
    modeToggle: { flex: 1, flexDirection: "row", backgroundColor: colors.secondary, borderRadius: 10, padding: 3 },
    modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8 },
    modeBtnActive: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
    modeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    modeBtnTextActive: { color: "#fff" },
    weekNav: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
    weekNavBtn: { paddingHorizontal: 10, paddingVertical: 9 },
    weekNavLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground, paddingHorizontal: 2, minWidth: 48, textAlign: "center" },
    pickerRow: { paddingHorizontal: 12, paddingBottom: 10 },
    pickerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
    pickerBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    pickerBtnPlaceholder: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    // ── missing banner ──
    missingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fffbeb", borderBottomWidth: 1, borderBottomColor: "#fde68a", paddingHorizontal: 14, paddingVertical: 11 },
    missingIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center", marginTop: 1 },
    missingBody: { flex: 1 },
    missingTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#92400e" },
    missingSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#b45309", marginTop: 1 },
    missingStore: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#78350f", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#fde68a", marginTop: 6 },
    missingToggle: { paddingTop: 2 },
    // ── sort bar ──
    sortBarWrap: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    sortBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    sortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    sortBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sortBtnTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },
    // ── content ──
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: insets.bottom + 90 + webBottom },
    // ── hero card ──
    heroCard: { backgroundColor: colors.navy, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 },
    heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(13,148,136,0.25)", alignItems: "center", justifyContent: "center" },
    heroName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
    heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(94,234,212,0.9)", marginTop: 2 },
    heroBadge: { backgroundColor: "rgba(13,148,136,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: "center" },
    heroBadgeVal: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#2dd4bf" },
    heroBadgeLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(94,234,212,0.8)", textTransform: "uppercase", letterSpacing: 0.5 },
    // ── stat cards ──
    summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2, borderWidth: 1 },
    statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
    statLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
    // ── section heading ──
    sectionHeading: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 6 },
    sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.foreground, flex: 1 },
    sectionUnit: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    // ── table ──
    tableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 },
    thName: { flex: 1, fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    thQty: { width: 46, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    thChange: { width: 62, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    thBar: { width: 56, textAlign: "right", fontSize: 10, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    // ── rows ──
    row: { flexDirection: "row", alignItems: "center", paddingRight: 12, paddingVertical: 11, backgroundColor: colors.card, borderRadius: 10, marginBottom: 5, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    rowAlert: { borderColor: "#fecaca", backgroundColor: "#fff5f5" },
    rowAccent: { width: 4, alignSelf: "stretch", backgroundColor: colors.border, marginRight: 10 },
    rowAccentAlert: { backgroundColor: "#ef4444" },
    rowAccentGood: { backgroundColor: colors.teal },
    rowName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    rowSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    qtyText: { width: 50, textAlign: "right", fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground },
    qtyNull: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 },
    // ── bar ──
    barWrap: { width: 56, alignItems: "flex-end", paddingLeft: 6 },
    barBg: { width: 48, height: 8, backgroundColor: colors.secondary, borderRadius: 4, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4 },
    // ── empty ──
    noData: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 20 },
    emptyIcon: { alignItems: "center", marginBottom: 8, marginTop: 48 },
    emptyText: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 10, lineHeight: 20 },
  });

  const sortButtons: { key: SortMode; label: string }[] = viewMode === "usage"
    ? [
        { key: "name",        label: "A–Z" },
        { key: "usage-desc",  label: "Most Used" },
        { key: "usage-asc",   label: "Least Used" },
        { key: "alert",       label: "⚠ Alerts" },
        { key: "qty-desc",    label: "On Hand ↓" },
        { key: "qty-asc",     label: "On Hand ↑" },
      ]
    : [
        { key: "name",        label: "A–Z" },
        { key: "qty-desc",    label: "Qty ↓" },
        { key: "qty-asc",     label: "Qty ↑" },
        { key: "alert",       label: "⚠ Alerts" },
        { key: "change-desc", label: "↑ Change" },
        { key: "change-asc",  label: "↓ Change" },
      ];

  const selectedStoreName = selectedStoreId ? stores?.find((st) => st.id === selectedStoreId)?.name : undefined;

  return (
    <View style={s.outer}>
      {/* Controls: mode toggle + week nav + picker — all in one compact block */}
      <View style={s.controlsWrap}>
        <View style={s.topRow}>
          <View style={s.modeToggle}>
            <TouchableOpacity style={[s.modeBtn, viewMode === "chemical" && s.modeBtnActive]} onPress={() => setViewMode("chemical")}>
              <Feather name="bar-chart-2" size={11} color={viewMode === "chemical" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "chemical" && s.modeBtnTextActive]}>Chem</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "store" && s.modeBtnActive]} onPress={() => setViewMode("store")}>
              <Feather name="map-pin" size={11} color={viewMode === "store" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "store" && s.modeBtnTextActive]}>Store</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "diverge" && s.modeBtnActive]} onPress={() => setViewMode("diverge")}>
              <Feather name="activity" size={11} color={viewMode === "diverge" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "diverge" && s.modeBtnTextActive]}>± Avg</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "heatmap" && s.modeBtnActive]} onPress={() => setViewMode("heatmap")}>
              <Feather name="grid" size={11} color={viewMode === "heatmap" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "heatmap" && s.modeBtnTextActive]}>Heat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "grid" && s.modeBtnActive]} onPress={() => setViewMode("grid")}>
              <Feather name="layout" size={11} color={viewMode === "grid" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "grid" && s.modeBtnTextActive]}>Grid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "usage" && s.modeBtnActive]} onPress={() => setViewMode("usage")}>
              <Feather name="trending-down" size={11} color={viewMode === "usage" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "usage" && s.modeBtnTextActive]}>Usage</Text>
            </TouchableOpacity>
          </View>
          <View style={s.weekNav}>
            <TouchableOpacity style={s.weekNavBtn} onPress={handleWeekBack}>
              <Feather name="chevron-left" size={14} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.weekNavLabel}>{weekLabel}</Text>
            <TouchableOpacity style={s.weekNavBtn} onPress={handleWeekForward} disabled={!canGoForward}>
              <Feather name="chevron-right" size={14} color={canGoForward ? colors.foreground : colors.border} />
            </TouchableOpacity>
          </View>
        </View>
        {viewMode !== "heatmap" && viewMode !== "grid" && (
          <View style={s.pickerRow}>
            {viewMode === "store" || viewMode === "usage" ? (
              <TouchableOpacity style={s.pickerBtn} onPress={() => setStorePickerOpen(true)}>
                <Feather name="map-pin" size={14} color={colors.teal} />
                <Text style={selectedStoreId ? s.pickerBtnText : s.pickerBtnPlaceholder} numberOfLines={1}>
                  {selectedStoreName ?? (viewMode === "usage" ? "All stores (tap to filter)" : "Select a store…")}
                </Text>
                {viewMode === "usage" && selectedStoreId && (
                  <TouchableOpacity onPress={() => setSelectedStoreId(undefined)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.pickerBtn} onPress={() => setChemPickerOpen(true)}>
                <Feather name="droplet" size={14} color={colors.teal} />
                <Text style={chemical ? s.pickerBtnText : s.pickerBtnPlaceholder} numberOfLines={1}>
                  {chemical?.chemicalName ?? "Select a chemical…"}
                </Text>
                {chemical && (
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{chemical.unit}</Text>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Missing submissions banner */}
      {(missing?.length ?? 0) > 0 && (
        <TouchableOpacity style={s.missingBanner} onPress={() => setMissingExpanded((v) => !v)} activeOpacity={0.85}>
          <View style={s.missingIconWrap}>
            <Feather name="alert-triangle" size={14} color="#d97706" />
          </View>
          <View style={s.missingBody}>
            <Text style={s.missingTitle}>{missing!.length} store{missing!.length !== 1 ? "s" : ""} missing this week</Text>
            <Text style={s.missingSubtitle}>{missingExpanded ? "Tap to collapse" : "Tap to see which stores"}</Text>
            {missingExpanded && missing!.map((m) => (
              <Text key={m.storeId} style={s.missingStore}>
                {m.storeName}
                {m.weeksSinceLast ? `  ·  ${m.weeksSinceLast}w overdue` : m.lastSubmittedWeekOf ? `  ·  last ${formatDate(m.lastSubmittedWeekOf)}` : "  ·  never submitted"}
              </Text>
            ))}
          </View>
          <View style={s.missingToggle}>
            <Feather name={missingExpanded ? "chevron-up" : "chevron-down"} size={16} color="#d97706" />
          </View>
        </TouchableOpacity>
      )}

      {/* CSV Export button — shown in grid, heatmap, and diverge modes */}
      {(viewMode === "grid" || viewMode === "heatmap" || viewMode === "diverge") && (
        <TouchableOpacity
          onPress={() => {
            const base = typeof window !== "undefined" ? window.location.origin : `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
            const url = viewMode === "grid"
              ? `${base}/api/export/grid-csv${weekOf ? `?weekOf=${weekOf}` : ""}`
              : `${base}/api/export/csv${weekOf ? `?weekOf=${weekOf}` : ""}`;
            if (typeof window !== "undefined") {
              window.open(url, "_blank");
            } else {
              import("expo-linking").then(({ openURL }) => openURL(url));
            }
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.navy, alignSelf: "flex-start" }}
        >
          <Feather name="download" size={13} color="#fff" />
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
            Export {viewMode === "grid" ? "Grid" : "Data"} CSV
          </Text>
        </TouchableOpacity>
      )}

      {/* Sort pills — hidden in heatmap and diverge modes */}
      {viewMode !== "heatmap" && viewMode !== "diverge" && viewMode !== "grid" && (
        <View style={s.sortBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
            {sortButtons.map((btn) => (
              <TouchableOpacity key={btn.key} style={[s.sortBtn, sortMode === btn.key && s.sortBtnActive]} onPress={() => setSortMode(btn.key)}>
                <Text style={[s.sortBtnText, sortMode === btn.key && s.sortBtnTextActive]}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main content */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : viewMode === "usage" ? (
          <UsageView chemReport={chemReport as ChemReportItem[] | undefined} selectedStoreId={selectedStoreId} sortMode={sortMode} weekLabel={weekLabel} colors={colors} />
        ) : viewMode === "heatmap" ? (
          <HeatmapView chemReport={chemReport as ChemReportItem[] | undefined} weekLabel={weekLabel} colors={colors} />
        ) : viewMode === "grid" ? (
          <GridView chemReport={chemReport as ChemReportItem[] | undefined} weekLabel={weekLabel} colors={colors} />
        ) : viewMode === "diverge" ? (
          <DivergingChart chemReport={chemReport as ChemReportItem[] | undefined} selectedChemIdx={selectedChemIdx} colors={colors} />
        ) : viewMode === "chemical" ? (
          !chemical ? (
            <View style={s.emptyIcon}>
              <Feather name="bar-chart-2" size={44} color={colors.border} />
              <Text style={s.emptyText}>No report data yet.{"\n"}Submit a count to see analytics here.</Text>
            </View>
          ) : (
            <>
              {/* Chemical hero card */}
              <View style={s.heroCard}>
                <View style={s.heroIcon}>
                  <Feather name="droplet" size={20} color={colors.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroName}>{chemical.chemicalName}</Text>
                  <Text style={s.heroSub}>
                    {chemical.unit} · threshold {chemical.alertThresholdPercent ?? "—"}%
                  </Text>
                </View>
                {avg !== null && (
                  <View style={s.heroBadge}>
                    <Text style={s.heroBadgeVal}>{avg.toFixed(1)}</Text>
                    <Text style={s.heroBadgeLabel}>avg</Text>
                  </View>
                )}
              </View>

              {/* 8-week sparkline trend */}
              <TrendSparkline chemicalId={chemical.chemicalId} unit={chemical.unit} colors={colors} />

              {/* Stat cards */}
              {counted.length > 0 && (
                <View style={s.summaryRow}>
                  <View style={[s.statCard, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                    <Text style={[s.statValue, { color: "#16a34a" }]}>{maxQty}</Text>
                    <Text style={[s.statLabel, { color: "#16a34a" }]}>High</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: "#fef9f0", borderColor: "#fed7aa" }]}>
                    <Text style={[s.statValue, { color: "#d97706" }]}>{minQty}</Text>
                    <Text style={[s.statLabel, { color: "#d97706" }]}>Low</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: alertCount > 0 ? "#fef2f2" : "#f0fdfa", borderColor: alertCount > 0 ? "#fecaca" : "#99f6e4" }]}>
                    <Text style={[s.statValue, { color: alertCount > 0 ? "#dc2626" : colors.teal }]}>{alertCount}</Text>
                    <Text style={[s.statLabel, { color: alertCount > 0 ? "#dc2626" : colors.teal }]}>Alerts</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[s.statValue, { color: colors.foreground }]}>{counted.length}</Text>
                    <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Stores</Text>
                  </View>
                </View>
              )}

              {/* Table header */}
              <View style={s.tableHeader}>
                <View style={{ width: 4, marginRight: 10 }} />
                <Text style={s.thName}>Store</Text>
                <Text style={s.thQty}>Qty</Text>
                <Text style={s.thChange}>Chg</Text>
                <Text style={s.thBar}>Level</Text>
              </View>

              {sortedStores.map((st) => {
                const barWidth = maxQty > 0 && st.latestQuantity != null ? Math.round((st.latestQuantity / maxQty) * 48) : 0;
                const isAlert = st.hasAlert;
                return (
                  <View key={st.storeId} style={[s.row, isAlert && s.rowAlert]}>
                    <View style={[s.rowAccent, isAlert ? s.rowAccentAlert : s.rowAccentGood]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName}>{st.storeName}</Text>
                      <Text style={s.rowSub}>{st.weekOf ? formatDate(st.weekOf) : "No count yet"}</Text>
                    </View>
                    <Text style={[s.qtyText, st.latestQuantity === null && s.qtyNull]}>
                      {st.latestQuantity !== null ? st.latestQuantity : "—"}
                    </Text>
                    <ChangeBadge pct={st.changePercent} />
                    <View style={s.barWrap}>
                      <View style={s.barBg}>
                        <View style={[s.barFill, { width: barWidth, backgroundColor: getBarColor(st.latestQuantity) }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )
        ) : (
          !selectedStoreId ? (
            <View style={s.emptyIcon}>
              <Feather name="map-pin" size={44} color={colors.border} />
              <Text style={s.emptyText}>Select a store above{"\n"}to view its chemical report.</Text>
            </View>
          ) : !storeReport ? (
            <View style={s.emptyIcon}>
              <Feather name="inbox" size={44} color={colors.border} />
              <Text style={s.emptyText}>No count data found for this store yet.</Text>
            </View>
          ) : (
            <>
              {/* Store hero card */}
              <View style={s.heroCard}>
                <View style={s.heroIcon}>
                  <Feather name="map-pin" size={20} color={colors.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroName}>{selectedStoreName}</Text>
                  <Text style={s.heroSub}>
                    {storeReport.weekOf ? `Latest: ${formatDate(storeReport.weekOf)}` : "Store Report"}
                  </Text>
                </View>
                <View style={s.heroBadge}>
                  <Text style={s.heroBadgeVal}>{sortedChemicals.filter((c) => c.quantity !== null).length}</Text>
                  <Text style={s.heroBadgeLabel}>chems</Text>
                </View>
              </View>

              {/* Stat cards */}
              {storeReport.weekOf && (() => {
                const chemAlerts = sortedChemicals.filter((c) => c.hasAlert).length;
                return (
                  <View style={s.summaryRow}>
                    <View style={[s.statCard, { backgroundColor: "#f0fdfa", borderColor: "#99f6e4" }]}>
                      <Text style={[s.statValue, { color: colors.teal }]}>{sortedChemicals.filter((c) => c.quantity !== null).length}</Text>
                      <Text style={[s.statLabel, { color: colors.teal }]}>Products</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: chemAlerts > 0 ? "#fef2f2" : "#f0fdfa", borderColor: chemAlerts > 0 ? "#fecaca" : "#99f6e4" }]}>
                      <Text style={[s.statValue, { color: chemAlerts > 0 ? "#dc2626" : colors.teal }]}>{chemAlerts}</Text>
                      <Text style={[s.statLabel, { color: chemAlerts > 0 ? "#dc2626" : colors.teal }]}>Alerts</Text>
                    </View>
                    <View style={[s.statCard, { flex: 2, backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <Text style={[s.statValue, { fontSize: 13, color: colors.foreground }]}>{formatDate(storeReport.weekOf)}</Text>
                      <Text style={[s.statLabel, { color: colors.mutedForeground }]}>Latest Week</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Table header */}
              <View style={s.tableHeader}>
                <View style={{ width: 4, marginRight: 10 }} />
                <Text style={s.thName}>Chemical</Text>
                <Text style={s.thQty}>Qty</Text>
                <Text style={s.thChange}>Chg</Text>
              </View>

              {sortedChemicals.map((c) => {
                const isAlert = c.hasAlert;
                return (
                  <View key={c.chemicalId} style={[s.row, isAlert && s.rowAlert]}>
                    <View style={[s.rowAccent, isAlert ? s.rowAccentAlert : s.rowAccentGood]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName}>{c.chemicalName}</Text>
                      <Text style={s.rowSub}>{c.unit}</Text>
                    </View>
                    <Text style={[s.qtyText, c.quantity === null && s.qtyNull]}>
                      {c.quantity !== null ? c.quantity : "—"}
                    </Text>
                    <ChangeBadge pct={c.changePercent} />
                  </View>
                );
              })}
            </>
          )
        )}
      </ScrollView>

      <PickerModal visible={chemPickerOpen} title="Select Chemical" items={chemOptions} selected={selectedChemIdx}
        onSelect={(id) => { if (id !== undefined) setSelectedChemIdx(id); }} onClose={() => setChemPickerOpen(false)} colors={colors} insets={insets} />
      <PickerModal visible={storePickerOpen} title="Select Store" items={storeOptions} selected={selectedStoreId}
        onSelect={(id) => setSelectedStoreId(id)} onClose={() => setStorePickerOpen(false)} colors={colors} insets={insets} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function InventoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const [activeTab, setActiveTab] = useState<SubTab>("history");

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: insets.top + 16 + webTop, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.navy },
    headerLabel: { fontSize: 12, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
    headerTitle: { fontSize: 28, color: "#fff", fontFamily: "Inter_700Bold" },
    content: { flex: 1 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerLabel}>Red Carpet Inventory</Text>
        <Text style={s.headerTitle}>Inventory</Text>
      </View>
      <SubTabBar active={activeTab} onChange={setActiveTab} colors={colors} />
      <View style={s.content}>
        {activeTab === "history" && <HistorySection colors={colors} insets={insets} />}
        {activeTab === "onhand" && <OnHandSection colors={colors} insets={insets} />}
        {activeTab === "received" && <ReceivedSection colors={colors} insets={insets} />}
        {activeTab === "orders" && <OrdersSection colors={colors} insets={insets} />}
        {activeTab === "online" && <OnlineSection colors={colors} insets={insets} />}
        {activeTab === "reports" && <ReportsSection colors={colors} insets={insets} />}
      </View>
    </View>
  );
}
