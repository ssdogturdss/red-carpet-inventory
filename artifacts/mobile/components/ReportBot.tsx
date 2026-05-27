import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Share, Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reportType?: string | null;
  reportData?: any;
  pdfPending?: boolean;
}

const QUICK_PROMPTS = [
  "Weekly usage summary for all stores",
  "Show me all unacknowledged alerts",
  "Compare chlorine levels across stores",
  "Chlorine trend last 8 weeks",
  "Recent deliveries log",
];

function formatMarkdown(text: string, colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("### ")) {
      elements.push(
        <Text key={i} style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 12, marginBottom: 4 }}>
          {line.slice(4)}
        </Text>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <Text key={i} style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 14, marginBottom: 4 }}>
          {line.slice(3)}
        </Text>
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <Text key={i} style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 6 }}>
          {line.slice(2, -2)}
        </Text>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2);
      elements.push(
        <View key={i} style={{ flexDirection: "row", gap: 6, marginTop: 3 }}>
          <Text style={{ fontSize: 13, color: colors.teal, lineHeight: 20 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 }}>
            {content}
          </Text>
        </View>
      );
    } else if (line.trim() === "") {
      elements.push(<View key={i} style={{ height: 6 }} />);
    } else {
      elements.push(
        <Text key={i} style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20, marginTop: 2 }}>
          {line}
        </Text>
      );
    }
  });

  return elements;
}

function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = Platform.OS === "web" && typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { listening, supported, start, stop };
}

export function ReportBot({ bottomInset, adminPin }: { bottomInset: number; adminPin: string }) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  // On web the tab bar is position:absolute (84px tall) and insets.bottom is 0,
  // so we must add the tab bar height manually to keep the input above it.
  const webTabBarHeight = Platform.OS === "web" ? 84 : 0;
  const [input, setInput] = useState("");

  const [botName, setBotName] = useState("Report Bot");
  const [messages, setMessages] = useState<Message[]>([]);

  // Fetch public bot settings (name + greeting) on mount
  useEffect(() => {
    fetch(`${BASE_URL}/api/bot-settings/public`)
      .then((r) => r.json())
      .then((data) => {
        if (data.botName) setBotName(data.botName);
        setMessages([
          {
            id: "welcome",
            role: "system",
            content: data.greeting ||
              "Hi! I'm your Report Bot. Ask me anything about your chemical inventory — usage trends, alerts, store comparisons, deliveries, and more. I'll pull live data and summarize it for you.",
          },
        ]);
      })
      .catch(() => {
        setMessages([
          {
            id: "welcome",
            role: "system",
            content: "Hi! I'm your Report Bot. Ask me anything about your chemical inventory — usage trends, alerts, store comparisons, deliveries, and more. I'll pull live data and summarize it for you.",
          },
        ]);
      });
  }, []);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  const history = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setLoading(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(`${BASE_URL}/api/reports/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        reportType: data.reportType ?? null,
        reportData: data.reportData ?? null,
        pdfPending: !!(data.reportData && Array.isArray(data.reportData) && data.reportData.length > 0),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I couldn't connect to the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [loading, history, adminPin]);

  const { listening, supported: voiceSupported, start: startListening, stop: stopListening } = useSpeechRecognition(
    useCallback((transcript: string) => {
      setInput(transcript);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, [])
  );

  const downloadPdf = useCallback(async (msg: Message, userQuery: string) => {
    if (!msg.reportData) return;
    setPdfLoading(msg.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const title = userQuery.slice(0, 60) || "Inventory Report";
      const res = await fetch(`${BASE_URL}/api/reports/bot/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
        body: JSON.stringify({
          title,
          summary: msg.content,
          toolName: msg.reportType,
          data: msg.reportData,
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await Linking.openURL(url);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      const shareText = `${userQuery}\n\n${msg.content}`;
      await Share.share({ message: shareText, title: "Inventory Report" });
    } finally {
      setPdfLoading(null);
    }
  }, [adminPin]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 8, gap: 12 },
    welcomeBubble: {
      backgroundColor: colors.navy,
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      padding: 14,
      maxWidth: "88%",
    },
    welcomeText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", lineHeight: 20 },
    botRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
    botAvatar: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.teal,
      alignItems: "center", justifyContent: "center",
      marginBottom: 2,
    },
    botBubble: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userRow: { flexDirection: "row", justifyContent: "flex-end" },
    userBubble: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      borderBottomRightRadius: 4,
      padding: 12,
      maxWidth: "82%",
    },
    userText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#ffffff", lineHeight: 20 },
    pdfBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
      backgroundColor: colors.navy, borderRadius: 8, alignSelf: "flex-start",
    },
    pdfBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ffffff" },
    typingBubble: {
      backgroundColor: colors.card,
      borderRadius: 14, borderBottomLeftRadius: 4,
      padding: 14, borderWidth: 1, borderColor: colors.border,
      flexDirection: "row", gap: 6, alignItems: "center",
    },
    typingText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    quickWrap: {
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    quickLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 },
    quickScroll: { flexDirection: "row", gap: 8 },
    quickChip: {
      paddingHorizontal: 12, paddingVertical: 7,
      backgroundColor: colors.background,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    },
    quickChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground },
    inputArea: {
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingBottom: bottomInset + webTabBarHeight + 10,
    },
    listeningBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 8, paddingHorizontal: 14,
      backgroundColor: colors.teal + "22",
    },
    listeningText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.teal },
    inputRow: {
      flexDirection: "row", alignItems: "flex-end", gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    input: {
      flex: 1, minHeight: 40, maxHeight: 100,
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    micBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center", justifyContent: "center",
    },
    micBtnActive: { backgroundColor: colors.teal },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { backgroundColor: colors.secondary },
  });

  const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "Report";

  return (
    <View style={s.container}>
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <View key={msg.id} style={s.botRow}>
                <View style={s.botAvatar}>
                  <Feather name="zap" size={14} color="#fff" />
                </View>
                <View style={s.welcomeBubble}>
                  <Text style={s.welcomeText}>{msg.content}</Text>
                </View>
              </View>
            );
          }
          if (msg.role === "user") {
            return (
              <View key={msg.id} style={s.userRow}>
                <View style={s.userBubble}>
                  <Text style={s.userText}>{msg.content}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={msg.id} style={s.botRow}>
              <View style={s.botAvatar}>
                <Feather name="zap" size={14} color="#fff" />
              </View>
              <View style={s.botBubble}>
                {formatMarkdown(msg.content, colors)}
                {msg.reportData && Array.isArray(msg.reportData) && msg.reportData.length > 0 && (
                  <TouchableOpacity
                    style={s.pdfBtn}
                    onPress={() => downloadPdf(msg, lastUserText)}
                    disabled={pdfLoading === msg.id}
                  >
                    {pdfLoading === msg.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="file-text" size={14} color="#fff" />
                    )}
                    <Text style={s.pdfBtnText}>
                      {pdfLoading === msg.id ? "Generating PDF…" : `Export PDF (${msg.reportData.length} rows)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={s.botRow}>
            <View style={s.botAvatar}>
              <Feather name="zap" size={14} color="#fff" />
            </View>
            <View style={s.typingBubble}>
              <ActivityIndicator size="small" color={colors.teal} />
              <Text style={s.typingText}>Pulling data…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <View style={s.quickWrap}>
          <Text style={s.quickLabel}>Quick reports</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickScroll}>
            {QUICK_PROMPTS.map((p) => (
              <TouchableOpacity key={p} style={s.quickChip} onPress={() => send(p)}>
                <Text style={s.quickChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={s.inputArea}>
        {listening && (
          <View style={s.listeningBar}>
            <ActivityIndicator size="small" color={colors.teal} />
            <Text style={s.listeningText}>Listening… tap mic to stop</Text>
          </View>
        )}
        <View style={s.inputRow}>
          {voiceSupported && (
            <TouchableOpacity
              style={[s.micBtn, listening && s.micBtnActive]}
              onPress={listening ? stopListening : startListening}
              activeOpacity={0.7}
            >
              <Feather name={listening ? "mic-off" : "mic"} size={18} color={listening ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Ask about your inventory…"
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            blurOnSubmit
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Feather name="send" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
