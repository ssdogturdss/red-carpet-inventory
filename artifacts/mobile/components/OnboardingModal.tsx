import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Dimensions, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

interface Step {
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  bg: string;
  title: string;
  body: string;
  tip: string;
}

const STEPS: Step[] = [
  {
    icon: "bar-chart-2",
    color: "#0d9488",
    bg: "#f0fdfa",
    title: "Welcome to Red Carpet Inventory",
    body: "Track chemical levels across all 11 stores on a weekly basis. This app keeps every store accountable and alerts you when something's off.",
    tip: "Start on the Dashboard to see your store health at a glance.",
  },
  {
    icon: "clipboard",
    color: "#2563eb",
    bg: "#eff6ff",
    title: "Submitting Weekly Counts",
    body: "Go to Count Entry, pick your store, enter your name, and fill in the quantity for each of the 23 chemicals. Hit Submit — alerts fire automatically if anything is out of range.",
    tip: "The progress bar at the top tracks how many chemicals you've filled in.",
  },
  {
    icon: "camera",
    color: "#7c3aed",
    bg: "#f5f3ff",
    title: "Scan a Paper Sheet",
    body: "Already have a paper count sheet? Head to Scan Sheet, take a clear photo, and the AI reads every quantity automatically. Review and correct any low-confidence values before submitting.",
    tip: "Good lighting and a flat surface give the best scan results.",
  },
  {
    icon: "archive",
    color: "#0f172a",
    bg: "#f8fafc",
    title: "Reports & Inventory Hub",
    body: "The Inventory tab gives you four views: History (past submissions), On Hand (current stock by store), and Reports with chemical trends, store comparisons, a heat map, and a deviation chart.",
    tip: "Use the ± Avg mode in Reports to instantly spot which stores are outliers for any chemical.",
  },
  {
    icon: "shield",
    color: "#dc2626",
    bg: "#fef2f2",
    title: "Admin Panel",
    body: "Tap Admin and enter your PIN (default: 1234) to manage alerts, stores, products, and contacts. You can acknowledge or delete alerts, and configure email/SMS notifications.",
    tip: "Change the admin PIN via the ADMIN_PIN server environment variable.",
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      setTimeout(() => setStep(0), 400);
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
    setTimeout(() => setStep(0), 400);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={[s.overlay, { paddingTop: insets.top + webTop, paddingBottom: insets.bottom + 20 }]}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[s.dot, i === step && s.dotActive, { backgroundColor: i === step ? current.color : colors.border }]} />
              ))}
            </View>
            <TouchableOpacity onPress={handleSkip} style={s.skipBtn}>
              <Text style={[s.skipText, { color: colors.mutedForeground }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Illustration */}
          <View style={[s.iconWrap, { backgroundColor: current.bg }]}>
            <View style={[s.iconCircle, { backgroundColor: current.color + "22", borderColor: current.color + "33" }]}>
              <Feather name={current.icon} size={52} color={current.color} />
            </View>
          </View>

          {/* Content */}
          <View style={s.content}>
            <Text style={[s.stepLabel, { color: current.color }]}>Step {step + 1} of {STEPS.length}</Text>
            <Text style={[s.title, { color: colors.foreground }]}>{current.title}</Text>
            <Text style={[s.body, { color: colors.mutedForeground }]}>{current.body}</Text>

            {/* Tip */}
            <View style={[s.tipBox, { backgroundColor: current.bg, borderColor: current.color + "33" }]}>
              <Feather name="zap" size={13} color={current.color} />
              <Text style={[s.tipText, { color: current.color }]}>{current.tip}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            {step > 0 && (
              <TouchableOpacity style={[s.backBtn, { borderColor: colors.border }]} onPress={() => setStep((s) => s - 1)}>
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: current.color, flex: 1 }]}
              onPress={handleNext}
            >
              <Text style={s.nextBtnText}>{isLast ? "Get Started" : "Next"}</Text>
              {!isLast && <Feather name="chevron-right" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 0,
  },
  dots: { flex: 1, flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  skipBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  skipText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    marginTop: 16,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    marginBottom: 18,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  backBtn: {
    width: 48,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
