import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, Modal,
  FlatList, Pressable, TextInput, Alert, KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetInventoryCounts, useGetStores, useGetChemicals,
  useGetOnHand, useGetReceived, useLogReceived, useDeleteReceived,
  useGetOrders, useCreateOrder, useUpdateOrder, useDeleteOrder,
  useGetChemicalReport, useGetStoreReport, useGetMissingSubmissions,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

type SubTab = "history" | "onhand" | "received" | "orders" | "reports";

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
  const [storeId, setStoreId] = useState<number | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: stores } = useGetStores();
  const { data: onHand, isLoading, refetch } = useGetOnHand(
    { storeId: storeId! },
    { query: { enabled: !!storeId } as any }
  );
  const storeOptions = [{ id: undefined as number | undefined, name: "Select a store…" }, ...(stores ?? [])];
  const s = StyleSheet.create({
    filterRow: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    filterBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 14, paddingVertical: 9, alignSelf: "flex-start" },
    filterBtnActive: { borderColor: colors.primary, backgroundColor: colors.tealLight + "22" },
    filterBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    filterBtnTextActive: { color: colors.primary },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: insets.bottom + 90 + webBottom },
    prompt: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 40 },
    weekBadge: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 12, textAlign: "center" },
    tableHeader: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: 8, marginBottom: 4 },
    headerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7 },
    row: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 11, backgroundColor: colors.card, borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
    product: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    qty: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, width: 70, textAlign: "right" },
    unit: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, width: 55, textAlign: "right" },
    empty: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 20 },
  });
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
          <Text style={s.prompt}>No count data found for this store yet.</Text>
        ) : (
          <>
            <Text style={s.weekBadge}>
              Last counted: Week of {onHand.weekOf ? formatDate(onHand.weekOf) : "—"}
            </Text>
            <View style={s.tableHeader}>
              <Text style={[s.headerText, { flex: 1 }]}>Product</Text>
              <Text style={[s.headerText, { width: 70, textAlign: "right" }]}>Qty</Text>
              <Text style={[s.headerText, { width: 55, textAlign: "right" }]}>Unit</Text>
            </View>
            {onHand.entries.map((e) => (
              <View key={e.chemicalId} style={s.row}>
                <Text style={s.product}>{e.chemicalName}</Text>
                <Text style={s.qty}>{e.quantity}</Text>
                <Text style={s.unit}>{e.unit}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <PickerModal visible={pickerOpen} title="Select Store" items={storeOptions} selected={storeId}
        onSelect={(id) => setStoreId(id)} onClose={() => setPickerOpen(false)} colors={colors} insets={insets} />
    </>
  );
}

// ─── Received Section ────────────────────────────────────────────────────────
function ReceivedSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
  const webBottom = Platform.OS === "web" ? 34 : 0;
  const qc = useQueryClient();
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
    await logReceived({ data: { storeId: formStore, chemicalId: formProduct, quantityReceived: parseFloat(formQty), receivedDate: formDate, receivedBy: formBy || undefined, poNumber: formPO || undefined, notes: formNotes || undefined } });
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
    await createOrder({ data: { storeId: formStore, chemicalId: formProduct, quantityOrdered: parseFloat(formQty), orderDate: formDate, expectedDelivery: formDelivery || undefined, poNumber: formPO || undefined, orderedBy: formBy || undefined, notes: formNotes || undefined } });
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

// ─── Reports helpers ──────────────────────────────────────────────────────────
type ReportViewMode = "chemical" | "store";
type SortMode = "name" | "qty-desc" | "qty-asc" | "alert" | "change-desc" | "change-asc";

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

// ─── Reports Section ─────────────────────────────────────────────────────────
function ReportsSection({ colors, insets }: { colors: ReturnType<typeof import("@/hooks/useColors").useColors>; insets: ReturnType<typeof useSafeAreaInsets> }) {
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
    if (viewMode === "chemical") await refetchChem();
    else if (selectedStoreId) await refetchStore();
    setRefreshing(false);
  }, [viewMode, selectedStoreId, refetchChem, refetchStore]);

  const isLoading = viewMode === "chemical" ? chemLoading : storeLoading;

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

  const weekLabel = weekOf ? formatDate(weekOf) : "Latest";
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
    modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 7, borderRadius: 8 },
    modeBtnActive: { backgroundColor: colors.primary },
    modeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground },
    modeBtnTextActive: { color: "#fff" },
    weekNav: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
    weekNavBtn: { paddingHorizontal: 10, paddingVertical: 8 },
    weekNavLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.foreground, paddingHorizontal: 2, minWidth: 52, textAlign: "center" },
    pickerRow: { paddingHorizontal: 12, paddingBottom: 10 },
    pickerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    pickerBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    pickerBtnPlaceholder: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    // ── missing banner ──
    missingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fffbeb", borderBottomWidth: 1, borderBottomColor: "#fde68a", paddingHorizontal: 14, paddingVertical: 11 },
    missingIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center", marginTop: 1 },
    missingBody: { flex: 1 },
    missingTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#92400e" },
    missingSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#b45309", marginTop: 1 },
    missingStore: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#78350f", paddingVertical: 3, borderTopWidth: 1, borderTopColor: "#fde68a", marginTop: 6 },
    missingToggle: { paddingTop: 2 },
    // ── sort bar ──
    sortBarWrap: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    sortBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    sortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
    sortBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sortBtnTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },
    // ── content ──
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: insets.bottom + 90 + webBottom },
    // ── stat cards ──
    summaryRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
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
    row: { flexDirection: "row", alignItems: "center", paddingRight: 12, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 10, marginBottom: 5, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    rowAlert: { borderColor: "#fecaca" },
    rowAccent: { width: 4, alignSelf: "stretch", backgroundColor: colors.border, marginRight: 10 },
    rowAccentAlert: { backgroundColor: "#ef4444" },
    rowName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    rowSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    qtyText: { width: 46, textAlign: "right", fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground },
    qtyNull: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 },
    // ── bar ──
    barWrap: { width: 56, alignItems: "flex-end", paddingLeft: 6 },
    barBg: { width: 48, height: 8, backgroundColor: colors.secondary, borderRadius: 4, overflow: "hidden" },
    barFill: { height: 8, borderRadius: 4 },
    // ── empty ──
    noData: { textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 60 },
    emptyIcon: { alignItems: "center", marginBottom: 12, marginTop: 40 },
  });

  const sortButtons: { key: SortMode; label: string }[] = [
    { key: "name", label: "A–Z" },
    { key: "qty-desc", label: "Qty ↓" },
    { key: "qty-asc", label: "Qty ↑" },
    { key: "alert", label: "⚠ Alerts" },
    { key: "change-desc", label: "↑ Change" },
    { key: "change-asc", label: "↓ Change" },
  ];

  const selectedStoreName = selectedStoreId ? stores?.find((st) => st.id === selectedStoreId)?.name : undefined;

  return (
    <View style={s.outer}>
      {/* Controls: mode toggle + week nav + picker — all in one compact block */}
      <View style={s.controlsWrap}>
        <View style={s.topRow}>
          <View style={s.modeToggle}>
            <TouchableOpacity style={[s.modeBtn, viewMode === "chemical" && s.modeBtnActive]} onPress={() => setViewMode("chemical")}>
              <Feather name="bar-chart-2" size={13} color={viewMode === "chemical" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "chemical" && s.modeBtnTextActive]}>By Chemical</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modeBtn, viewMode === "store" && s.modeBtnActive]} onPress={() => setViewMode("store")}>
              <Feather name="map-pin" size={13} color={viewMode === "store" ? "#fff" : colors.mutedForeground} />
              <Text style={[s.modeBtnText, viewMode === "store" && s.modeBtnTextActive]}>By Store</Text>
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
        <View style={s.pickerRow}>
          {viewMode === "chemical" ? (
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
          ) : (
            <TouchableOpacity style={s.pickerBtn} onPress={() => setStorePickerOpen(true)}>
              <Feather name="map-pin" size={14} color={colors.teal} />
              <Text style={selectedStoreId ? s.pickerBtnText : s.pickerBtnPlaceholder} numberOfLines={1}>
                {selectedStoreName ?? "Select a store…"}
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
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

      {/* Sort pills */}
      <View style={s.sortBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
          {sortButtons.map((btn) => (
            <TouchableOpacity key={btn.key} style={[s.sortBtn, sortMode === btn.key && s.sortBtnActive]} onPress={() => setSortMode(btn.key)}>
              <Text style={[s.sortBtnText, sortMode === btn.key && s.sortBtnTextActive]}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main content */}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
        ) : viewMode === "chemical" ? (
          !chemical ? (
            <View style={s.emptyIcon}>
              <Feather name="bar-chart-2" size={40} color={colors.border} />
              <Text style={s.noData}>No report data yet.</Text>
            </View>
          ) : (
            <>
              {/* Stat cards */}
              {counted.length > 0 && (
                <View style={s.summaryRow}>
                  <View style={[s.statCard, { backgroundColor: "#f0fdfa" }]}>
                    <Text style={[s.statValue, { color: colors.teal }]}>{avg !== null ? avg.toFixed(1) : "—"}</Text>
                    <Text style={[s.statLabel, { color: colors.teal }]}>Avg</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: "#f0fdf4" }]}>
                    <Text style={[s.statValue, { color: "#16a34a" }]}>{maxQty}</Text>
                    <Text style={[s.statLabel, { color: "#16a34a" }]}>High</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: "#fef9f0" }]}>
                    <Text style={[s.statValue, { color: "#d97706" }]}>{minQty}</Text>
                    <Text style={[s.statLabel, { color: "#d97706" }]}>Low</Text>
                  </View>
                  <View style={[s.statCard, { backgroundColor: alertCount > 0 ? "#fef2f2" : "#f0fdfa" }]}>
                    <Text style={[s.statValue, { color: alertCount > 0 ? "#dc2626" : colors.teal }]}>{alertCount}</Text>
                    <Text style={[s.statLabel, { color: alertCount > 0 ? "#dc2626" : colors.teal }]}>Alerts</Text>
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
                    <View style={[s.rowAccent, isAlert && s.rowAccentAlert]} />
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
              <Feather name="map-pin" size={40} color={colors.border} />
              <Text style={s.noData}>Select a store above to view its report.</Text>
            </View>
          ) : !storeReport ? (
            <View style={s.emptyIcon}>
              <Feather name="inbox" size={40} color={colors.border} />
              <Text style={s.noData}>No count data found for this store.</Text>
            </View>
          ) : (
            <>
              {/* Stat cards */}
              {storeReport.weekOf && (() => {
                const chemAlerts = sortedChemicals.filter((c) => c.hasAlert).length;
                return (
                  <View style={s.summaryRow}>
                    <View style={[s.statCard, { backgroundColor: "#f0fdfa" }]}>
                      <Text style={[s.statValue, { color: colors.teal }]}>{sortedChemicals.filter((c) => c.quantity !== null).length}</Text>
                      <Text style={[s.statLabel, { color: colors.teal }]}>Products</Text>
                    </View>
                    <View style={[s.statCard, { backgroundColor: chemAlerts > 0 ? "#fef2f2" : "#f0fdfa" }]}>
                      <Text style={[s.statValue, { color: chemAlerts > 0 ? "#dc2626" : colors.teal }]}>{chemAlerts}</Text>
                      <Text style={[s.statLabel, { color: chemAlerts > 0 ? "#dc2626" : colors.teal }]}>Alerts</Text>
                    </View>
                    <View style={[s.statCard, { flex: 2, backgroundColor: colors.secondary }]}>
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
                    <View style={[s.rowAccent, isAlert && s.rowAccentAlert]} />
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
        {activeTab === "reports" && <ReportsSection colors={colors} insets={insets} />}
      </View>
    </View>
  );
}
