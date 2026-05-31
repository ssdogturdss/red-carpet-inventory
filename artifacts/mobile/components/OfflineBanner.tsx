import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";
import type { SyncResult } from "@/hooks/useOfflineQueue";

const c = colors.light;

interface OfflineBannerProps {
  isOnline: boolean;
  queueLength: number;
  syncing: boolean;
  syncResult?: SyncResult;
  onSync: () => void;
}

export function OfflineBanner({ isOnline, queueLength, syncing, syncResult, onSync }: OfflineBannerProps) {
  if (syncResult === "success") {
    return (
      <View style={[s.banner, s.success]}>
        <Feather name="check-circle" size={14} color={c.success} />
        <Text style={[s.text, { color: c.success }]}>All counts synced successfully ✓</Text>
      </View>
    );
  }

  if (syncResult === "error") {
    return (
      <View style={[s.banner, s.error]}>
        <Feather name="alert-circle" size={14} color={c.critical} />
        <Text style={[s.text, { color: c.critical }]}>Sync failed — will retry when online</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={[s.banner, s.offline]}>
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
        <Text style={[s.text, { color: c.offlineText }]}>
          {queueLength} count{queueLength > 1 ? "s" : ""} waiting to sync
        </Text>
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
  offline: { backgroundColor: c.navyLight },
  pending: {
    backgroundColor: c.offlineSurface,
    borderBottomWidth: 1,
    borderBottomColor: c.offlineBorder,
  },
  success: {
    backgroundColor: c.successSurface,
    borderBottomWidth: 1,
    borderBottomColor: c.successBorder,
  },
  error: {
    backgroundColor: c.criticalSurface,
    borderBottomWidth: 1,
    borderBottomColor: c.criticalBorder,
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
