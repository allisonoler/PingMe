import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { supabase } from "../lib/supabase";
import { nameOf } from "../lib/identity";
import { shouldAnnouncePing, type IncomingPing } from "../lib/incomingPings";
import {
  ensureIncomingPingNotifications,
  notifyIncomingPing,
} from "../lib/localNotifications";
import { ActivityIcon } from "./ActivityIcon";
import { pingTitle } from "../lib/pings";
import { colors, hit, radius, space, type } from "../lib/theme";

/**
 * Friend pings arrive over Realtime, so this works in Expo Go and on web where
 * remote push does not exist. One subscription feeds two destinations: the
 * in-app banner while someone is looking at the app, and a local notification
 * while they are not. The subscription deliberately outlives the foreground —
 * the moment it is torn down the tray fallback has nothing left to fire on.
 */
export function IncomingPingAlerts() {
  const { session, configured } = useAuth();
  const { demoMode } = useDemo();
  const userId = session?.user.id;
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [queue, setQueue] = useState<IncomingPing[]>([]);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state !== "active") setQueue([]);
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    seen.current.clear();
    setQueue([]);
  }, [userId, demoMode]);
  useEffect(() => {
    if (!userId || !configured || demoMode) return;
    let cancelled = false;
    const pending = new Set<string>();
    void ensureIncomingPingNotifications();
    async function announce(id: unknown) {
      if (typeof id !== "string" || seen.current.has(id) || pending.has(id))
        return;
      pending.add(id);
      try {
        // Re-read under RLS: don't trust an event's contents or show pings that
        // were deleted, expired, or became inaccessible after the event.
        const { data: ping, error } = await supabase
          .from("pings")
          .select(
            "id,creator_id,activity,title,description,expires_at,profiles!pings_creator_id_fkey(username,display_name)",
          )
          .eq("id", id)
          .maybeSingle();
        if (error || !ping || ping.creator_id === userId) return;
        const { data: preferences, error: preferenceError } = await supabase
          .from("notification_preferences")
          .select("friend_id,activity,enabled")
          .eq("user_id", userId!);
        // Fail closed if mute preferences cannot be checked.
        if (preferenceError || cancelled) return;
        const incoming = ping as unknown as IncomingPing;
        if (!shouldAnnouncePing(incoming, userId!, preferences || [])) return;
        seen.current.add(id);
        if (seen.current.size > 200)
          seen.current.delete(seen.current.values().next().value!);
        // Read live rather than from `active`: this closure is not re-created
        // when the app changes state, and the two destinations are exclusive.
        if (AppState.currentState === "active")
          setQueue((items) => [...items, incoming].slice(-5));
        else
          await notifyIncomingPing({
            id: incoming.id,
            title: pingTitle(incoming),
            body: `${nameOf(incoming.profiles)} · ${incoming.description || "Anyone in? Tap to see the plan."}`,
          });
      } catch {
        // A reconnect or transient request failure must not interrupt the app.
      } finally {
        pending.delete(id);
      }
    }
    const channel = supabase
      .channel(`incoming-ping-alerts:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pings" },
        (payload) => {
          void announce(payload.new.id);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, configured, demoMode]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(
      () => setQueue((items) => items.filter((item) => item.id !== current.id)),
      9000,
    );
    return () => clearTimeout(timer);
  }, [current?.id]);
  if (!current || !active || demoMode || !userId) return null;
  const dismiss = () =>
    setQueue((items) => items.filter((item) => item.id !== current.id));
  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          position: "absolute",
          top: insets.top + space.sm,
          left: space.lg,
          right: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.green,
          padding: space.md,
          elevation: 12,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${nameOf(current.profiles)} sent a ping: ${pingTitle(current)}. View pings.`}
          onPress={() => {
            dismiss();
            router.push("/home");
          }}
          style={{
            flex: 1,
            minHeight: hit,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
          }}
        >
          <ActivityIcon
            activity={current.activity}
            color={colors.white}
            size={26}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[type.label, { color: "#CDEAD8", fontSize: 10 }]}>
              NEW FRIEND PING
            </Text>
            <Text
              style={[type.bodyStrong, { color: colors.white }]}
            >
              {pingTitle(current)}
            </Text>
            <Text
              style={[type.small, { color: colors.white }]}
              numberOfLines={2}
            >
              {nameOf(current.profiles)} · {current.description || "Anyone in? Tap to see the plan."}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss ping alert"
          onPress={dismiss}
          style={{
            width: hit,
            height: hit,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={22} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}
