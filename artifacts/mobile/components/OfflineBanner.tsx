import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import colors from "@/constants/colors";

const c = colors.light;

interface OfflineBannerProps {
  isOnline: boolean;
  queueLength: number;
  syncing: boolean;
  onSync: () => void;
}

export function OfflineBanner({ isOnline, queueLength, syncing, onSync }: OfflineBannerProps) {
  const insets = useSafeAreaInsets();

  if (isOnline && queueLength === 0) return null;

  if (!isOnline) {
    return (
      <View style={[s.banner, s.offline, { paddingTop: insets.top > 0 ? 0 : 0 }]}>
        <Feather name="wifi-off" size={14} color="#fff" />
        <Text style={s.text}>
          You're offline — counts will be saved locally and synced automatically.
          {queueLength > 0 ? ` (${queueLength} pending)` : ""}
        </Text>
      </View>
    );
  }

  if (queueLength > 0) {
    return (
      <View style={[s.banner, s.pending]}>
        <Feather name="clock" size={14} color={c.offlineText} />
        <Text style={[s.text, { color: c.offlineText }]}>{queueLength} count{queueLength > 1 ? "s" : ""} waiting to sync</Text>
        <TouchableOpacity style={s.syncBtn} onPress={onSync} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator size="small" color={c.offlineText} />
          ) : (
            <Text style={s.syncBtnText}>Sync now</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    zIndex: 100,
  },
  offline: {
    backgroundColor: c.navyLight,
  },
  pending: {
    backgroundColor: c.offlineSurface,
    borderBottomWidth: 1,
    borderBottomColor: c.offlineBorder,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#fff",
    lineHeight: 17,
  },
  syncBtn: {
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: "center",
  },
  syncBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: c.offlineText,
  },
});
