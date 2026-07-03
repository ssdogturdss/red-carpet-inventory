import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Platform, TextInput,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { setDefaultHeaders } from "@workspace/api-client-react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const TOKEN_KEY = "rci_user_token_v2";

export interface CurrentUser {
  id: number;
  name: string;
  storeId: number | null;
  storeName: string | null;
  role: string;
}

interface CurrentUserCtx {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserCtx>({
  user: null,
  token: null,
  loading: true,
  logout: async () => {},
});

export function useCurrentUserContext() {
  return useContext(CurrentUserContext);
}

async function fetchMe(token: string): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { "x-user-token": token },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CurrentUser>;
  } catch {
    return null;
  }
}

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function storeToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

interface EmployeeItem {
  id: number;
  name: string;
  storeId: number | null;
  storeName: string | null;
  role: string;
}

function LoginScreen({ onLogin }: { onLogin: (user: CurrentUser, token: string) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedUser, setSelectedUser] = useState<EmployeeItem | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState(false);

  const webTop = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    fetch(`${BASE_URL}/api/auth/users`)
      .then((r) => r.json())
      .then((data: EmployeeItem[]) => setEmployees(data))
      .catch(() => setEmployees([]))
      .finally(() => setLoadingList(false));
  }, []);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) submitPin(next);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const submitPin = async (value: string) => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin: value }),
      });
      const data = (await res.json()) as { success: boolean; token?: string; user?: CurrentUser };
      if (data.success && data.token && data.user) {
        await storeToken(data.token);
        setDefaultHeaders({ "x-user-token": data.token });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onLogin(data.user, data.token);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setPin("");
      }
    } catch {
      setError(true);
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  const digits: [string, string][] = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["", ""], ["0", "+"], ["⌫", ""],
  ];

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.navy },
    inner: { flex: 1, paddingTop: insets.top + webTop },
    header: { alignItems: "center", paddingHorizontal: 32, paddingTop: 32, paddingBottom: 24 },
    logoWrap: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center", justifyContent: "center", marginBottom: 16,
    },
    appLabel: { fontSize: 12, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
    title: { fontSize: 26, color: "#fff", fontFamily: "Inter_700Bold", textAlign: "center" },
    subtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginTop: 6, textAlign: "center" },
    listWrap: { flex: 1, paddingHorizontal: 24 },
    listLabel: { fontSize: 12, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
    employeeCard: {
      backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
      padding: 14, marginBottom: 8,
      flexDirection: "row", alignItems: "center",
    },
    employeeName: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", color: "#fff" },
    employeeStore: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginTop: 2 },
    pinWrap: { alignItems: "center", paddingHorizontal: 32 },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20, alignSelf: "flex-start" },
    backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)" },
    selectedName: { fontSize: 22, color: "#fff", fontFamily: "Inter_700Bold", marginBottom: 4, textAlign: "center" },
    pinHint: { fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginBottom: 24, textAlign: "center" },
    dots: { flexDirection: "row", gap: 14, marginBottom: 8 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    dotFilled: { backgroundColor: colors.teal, borderColor: colors.teal },
    errorText: { fontSize: 13, color: "#f87171", fontFamily: "Inter_500Medium", marginTop: 8, marginBottom: 16, height: 18, textAlign: "center" },
    pad: { width: "100%", maxWidth: 260, marginTop: 16 },
    padRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
    padBtn: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center", justifyContent: "center",
    },
    padBtnText: { fontSize: 26, color: "#fff", fontFamily: "Inter_400Regular" },
    padBtnSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", letterSpacing: 1 },
    loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { textAlign: "center", color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 14, paddingVertical: 24 },
    adminRow: { alignItems: "center", paddingVertical: 24, paddingBottom: insets.bottom + 24 },
    adminLink: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
    adminLinkText: { fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular" },
    adminCard: {
      backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
      borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
      padding: 20, margin: 24,
    },
    adminCardTitle: { fontSize: 16, color: "#fff", fontFamily: "Inter_600SemiBold", marginBottom: 4 },
    adminCardSub: { fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", marginBottom: 16 },
    adminInput: {
      backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
      borderRadius: 10, padding: 12, fontSize: 20, color: "#fff", fontFamily: "Inter_400Regular",
      textAlign: "center", letterSpacing: 8, marginBottom: 12,
    },
    adminErrorText: { fontSize: 13, color: "#f87171", fontFamily: "Inter_500Medium", marginBottom: 12, textAlign: "center" },
    adminBtn: { backgroundColor: colors.teal, borderRadius: 10, padding: 13, alignItems: "center" },
    adminBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
    adminCancelText: { fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
  });

  const handleAdminBypass = async () => {
    try {
      const verifyRes = await fetch(`${BASE_URL}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin }),
      });
      const data = await verifyRes.json() as { success: boolean; error?: string };
      if (verifyRes.ok && data.success) {
        setDefaultHeaders({ "x-admin-pin": adminPin });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onLogin({ id: 0, name: "Admin", storeId: null, storeName: null, role: "admin" }, "__admin__");
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAdminError(true);
      }
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setAdminError(true);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.inner}>
        {adminMode ? (
          <ScrollView contentContainerStyle={{ flex: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
            <View style={s.adminCard}>
              <Text style={s.adminCardTitle}>Admin Access</Text>
              <Text style={s.adminCardSub}>Enter your admin PIN to manage accounts and settings.</Text>
              {adminError && <Text style={s.adminErrorText}>Incorrect PIN. Try again.</Text>}
              <TextInput
                style={s.adminInput}
                value={adminPin}
                onChangeText={(v) => { setAdminPin(v.replace(/\D/g, "").slice(0, 6)); setAdminError(false); }}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                placeholder="••••"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoFocus
              />
              <TouchableOpacity style={s.adminBtn} onPress={handleAdminBypass}>
                <Text style={s.adminBtnText}>Enter Admin Panel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setAdminMode(false); setAdminPin(""); setAdminError(false); }}>
                <Text style={s.adminCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : !selectedUser ? (
          <>
            <View style={s.header}>
              <View style={s.logoWrap}>
                <Feather name="user" size={32} color={colors.teal} />
              </View>
              <Text style={s.appLabel}>Red Carpet Inventory</Text>
              <Text style={s.title}>Who's logging in?</Text>
              <Text style={s.subtitle}>Select your name to continue</Text>
            </View>
            <View style={s.listWrap}>
              <Text style={s.listLabel}>Employees</Text>
              {loadingList ? (
                <ActivityIndicator color={colors.teal} />
              ) : employees.length === 0 ? (
                <Text style={s.emptyText}>No employees yet. Ask your admin to add accounts.</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {employees.map((emp) => (
                    <TouchableOpacity
                      key={emp.id}
                      style={s.employeeCard}
                      onPress={() => { setSelectedUser(emp); setPin(""); setError(false); Haptics.selectionAsync(); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.employeeName}>{emp.name}</Text>
                        {emp.storeName && <Text style={s.employeeStore}>{emp.storeName}</Text>}
                      </View>
                      <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
            <View style={s.adminRow}>
              <TouchableOpacity style={s.adminLink} onPress={() => setAdminMode(true)}>
                <Feather name="settings" size={13} color="rgba(255,255,255,0.3)" />
                <Text style={s.adminLinkText}>Admin access</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={s.pinWrap}>
            <View style={{ height: insets.top + webTop + 16 }} />
            <TouchableOpacity style={s.backBtn} onPress={() => { setSelectedUser(null); setPin(""); setError(false); }}>
              <Feather name="arrow-left" size={16} color="rgba(255,255,255,0.6)" />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={s.selectedName}>{selectedUser.name}</Text>
            <Text style={s.pinHint}>Enter your 4-digit PIN</Text>
            <View style={s.dots}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
              ))}
            </View>
            <Text style={s.errorText}>{error ? "Incorrect PIN. Try again." : ""}</Text>
            {submitting ? (
              <ActivityIndicator color={colors.teal} size="large" />
            ) : (
              <View style={s.pad}>
                {[0, 1, 2, 3].map((row) => (
                  <View key={row} style={s.padRow}>
                    {digits.slice(row * 3, row * 3 + 3).map(([d, sub], col) => (
                      <TouchableOpacity
                        key={col}
                        style={s.padBtn}
                        onPress={() => {
                          if (d === "⌫") handleDelete();
                          else if (d) handleDigit(d);
                        }}
                        disabled={!d}
                        activeOpacity={d ? 0.6 : 1}
                      >
                        {d === "⌫" ? (
                          <Feather name="delete" size={22} color="#fff" />
                        ) : (
                          <>
                            <Text style={s.padBtnText}>{d}</Text>
                            {sub ? <Text style={s.padBtnSub}>{sub}</Text> : null}
                          </>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await getStoredToken();
      if (stored) {
        const me = await fetchMe(stored);
        if (me) {
          setDefaultHeaders({ "x-user-token": stored });
          setUser(me);
          setToken(stored);
        } else {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleLogin = useCallback((loggedUser: CurrentUser, loggedToken: string) => {
    setUser(loggedUser);
    setToken(loggedToken);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: { "x-user-token": token },
        });
      } catch {
        // best-effort
      }
    }
    await clearToken();
    setDefaultHeaders({});
    setUser(null);
    setToken(null);
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#0d9488" size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <CurrentUserContext.Provider value={{ user, token, loading: false, logout }}>
      {children}
    </CurrentUserContext.Provider>
  );
}
