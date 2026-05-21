import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAdminAuth } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export function PinScreen({
  onSuccess,
  title = "Admin Access",
  subtitle = "Enter your PIN to continue",
  insets,
}: {
  onSuccess: (pin: string) => void;
  title?: string;
  subtitle?: string;
  insets: { top: number };
}) {
  const colors = useColors();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const { mutateAsync: authAdmin, isPending } = useAdminAuth();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const handleDigit = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length >= 4) submit(next);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const submit = async (value: string) => {
    const result = await authAdmin({ data: { pin: value } });
    if (result.success) {
      onSuccess(value);
    } else {
      setError(true);
      setPin("");
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.navy },
    inner: {
      flex: 1, alignItems: "center", justifyContent: "center",
      paddingTop: insets.top + webTop, paddingHorizontal: 40,
    },
    lockIcon: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center", justifyContent: "center", marginBottom: 20,
    },
    label: { fontSize: 12, color: colors.tealLight, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
    title: { fontSize: 26, color: "#fff", fontFamily: "Inter_700Bold", marginBottom: 4 },
    subtitle: { fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular", marginBottom: 40 },
    dots: { flexDirection: "row", gap: 14, marginBottom: 8 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
    dotFilled: { backgroundColor: colors.teal, borderColor: colors.teal },
    errorText: { fontSize: 13, color: "#f87171", fontFamily: "Inter_500Medium", marginTop: 8, marginBottom: 16, height: 18 },
    pad: { width: "100%", maxWidth: 260, marginTop: 16 },
    padRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
    padBtn: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center", justifyContent: "center",
    },
    padBtnText: { fontSize: 26, color: "#fff", fontFamily: "Inter_400Regular" },
    padBtnSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "Inter_400Regular", letterSpacing: 1 },
  });

  const digits: [string, string][] = [
    ["1", ""], ["2", "ABC"], ["3", "DEF"],
    ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
    ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
    ["", ""], ["0", "+"], ["⌫", ""],
  ];

  return (
    <View style={s.container}>
      <View style={s.inner}>
        <View style={s.lockIcon}>
          <Feather name="lock" size={32} color={colors.teal} />
        </View>
        <Text style={s.label}>Red Carpet Inventory</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
        <View style={s.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
          ))}
        </View>
        <Text style={s.errorText}>{error ? "Incorrect PIN. Try again." : ""}</Text>
        {isPending ? (
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
    </View>
  );
}
