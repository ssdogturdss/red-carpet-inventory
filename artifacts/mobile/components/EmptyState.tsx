import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction, compact }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: compact ? 32 : 60, paddingHorizontal: 32 }}>
      <View style={{
        width: compact ? 60 : 80,
        height: compact ? 60 : 80,
        borderRadius: compact ? 30 : 40,
        backgroundColor: colors.secondary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: compact ? 14 : 20,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <Feather name={icon} size={compact ? 26 : 34} color={colors.mutedForeground} />
      </View>
      <Text style={{
        fontSize: compact ? 16 : 18,
        fontFamily: "Inter_700Bold",
        color: colors.foreground,
        textAlign: "center",
        marginBottom: 8,
      }}>
        {title}
      </Text>
      <Text style={{
        fontSize: 14,
        fontFamily: "Inter_400Regular",
        color: colors.mutedForeground,
        textAlign: "center",
        lineHeight: 20,
      }}>
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={{
            marginTop: 20,
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            paddingHorizontal: 24,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
