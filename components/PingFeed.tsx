import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { PingMap } from "./PingMap";
import { PingCard } from "./PingCard";
import { AttendeeSheet } from "./AttendeeSheet";
import { UpdatesSheet } from "./UpdatesSheet";
import {
  Button,
  Empty,
  Header,
  Page,
  Row,
  TextAction,
  listContent,
} from "./ui";
import { supabase } from "../lib/supabase";
import { colors, radius, space, type } from "../lib/theme";
import { useDemo } from "../lib/demo";
import { pingCapacity, withContribution, withResponse, type ContributionClaim, type Ping, type PingUpdate } from "../lib/pings";
import { useAuth } from "../lib/auth";

/** Both tabs share loading, realtime updates, and all event actions. */
export function PingFeed({ onlyMine = false }: { onlyMine?: boolean }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const narrow = width < 360;
  const { demoMode, demoPings, setDemoPings } = useDemo();
  const { session } = useAuth();
  const currentUser = demoMode ? "demo-you" : session?.user.id;
  const [pings, setPings] = useState<Ping[]>([]);
  const [refreshing, setRefreshing] = useState(!demoMode);
  const [view, setView] = useState<"list" | "map">("map");
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [attendeePingId, setAttendeePingId] = useState<string | null>(null);
  const [updatesPingId, setUpdatesPingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const generation = useRef(0);
  const mode = useRef(demoMode);
  mode.current = demoMode;
  const load = useCallback(async () => {
    setNow(Date.now());
    const request = ++generation.current;
    if (demoMode) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPings([]);
        return;
      }
      const { data, error } = await supabase
        .from("pings")
        .select(
          "*, profiles!pings_creator_id_fkey(display_name,username), ping_acceptances(user_id,profiles!ping_acceptances_user_id_fkey(username,display_name))",
        )
        .gt("expires_at", new Date().toISOString())
        .order("expires_at");
      if (error) throw error;
      const rows = data || [];
      const [summaries, contributions, eventUpdates] = await Promise.all([
        rows.length
        ? supabase.rpc("get_ping_counts", {
            ping_ids: rows.map((p) => p.id),
          })
        : { data: [] },
        rows.some((p) => p.contribution_requests?.length)
          ? supabase.rpc("get_ping_contributions", { ping_ids: rows.map((p) => p.id) })
          : { data: [], error: null },
        rows.length ? supabase.rpc("get_ping_updates", { ping_ids: rows.map((p) => p.id), per_ping_limit: 1 }) : { data: [], error: null },
      ]);
      const counts = new Map<string, number>();
      for (const item of summaries.data || [])
        counts.set(item.ping_id, item.total);
      const claims = new Map<string, ContributionClaim[]>();
      for (const item of contributions.data || []) {
        claims.set(item.ping_id, [...(claims.get(item.ping_id) || []), item]);
      }
      const updates = new Map<string, PingUpdate[]>();
      for (const item of eventUpdates.data || []) updates.set(item.ping_id, [...(updates.get(item.ping_id) || []), item]);
      if (request !== generation.current || mode.current) return;
      setPings((previous) =>
        rows.map((p) =>
          pending.current.has(p.id)
            ? previous.find((item) => item.id === p.id) || p
            : {
                ...p,
                is_own: p.creator_id === user.id,
                contribution_claims: claims.get(p.id) || [],
                contributions_unavailable: !!contributions.error,
                updates: updates.get(p.id) || [],
                updates_unavailable: !!eventUpdates.error,
                accepted:
                  p.ping_acceptances?.some(
                    (a: { user_id: string }) => a.user_id === user.id,
                  ) || false,
                acceptance_count:
                  counts.get(p.id) ?? p.ping_acceptances?.length ?? 0,
              },
        ),
      );
    } catch (error) {
      if (request === generation.current && !mode.current)
        Alert.alert(
          "Could not load pings",
          error instanceof Error
            ? error.message
            : "Pull to refresh and try again.",
        );
    } finally {
      if (request === generation.current) setRefreshing(false);
    }
  }, [demoMode]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setNotice("");
    if (demoMode) return;
    const channel = supabase
      .channel(onlyMine ? "my-events" : "active-pings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ping_updates" },
        () => { void load(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pings" },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ping_contribution_claims" },
        () => { void load(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ping_acceptances" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, demoMode, onlyMine]);
  async function accept(p: Ping) {
    if (pending.current.has(p.id)) return;
    if (!p.accepted && pingCapacity(p).full) {
      Alert.alert("This ping is full", "Check back for a spot if someone decides they can’t make it.");
      return;
    }
    if (demoMode) {
      setDemoPings((items) =>
        items.map((item) =>
          item.id === p.id
            ? withResponse(item, {
                user_id: "demo-you",
                profiles: { username: "you", display_name: "You" },
              })
            : item,
        ),
      );
      setNotice(
        p.accepted
          ? "You're off the list. Next time!"
          : "You’re in! Find this plan in My Events.",
      );
      return;
    }
    pending.current.add(p.id);
    ++generation.current;
    setBusy(new Set(pending.current));
    setPings((items) =>
      items.map((item) => (item.id === p.id ? withResponse(item) : item)),
    );
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again to respond to this ping.");
      const { error } = p.accepted
        ? await supabase
            .from("ping_acceptances")
            .delete()
            .eq("ping_id", p.id)
            .eq("user_id", user.id)
        : await supabase
            .from("ping_acceptances")
            .insert({ ping_id: p.id, user_id: user.id });
      if (error) throw new Error(error.message);
      setNotice(
        p.accepted
          ? "You're off the list. Next time!"
          : "You’re in! Find this plan in My Events.",
      );
    } catch (error) {
      setPings((items) => items.map((item) => (item.id === p.id ? p : item)));
      Alert.alert(
        "Could not update response",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      pending.current.delete(p.id);
      setBusy(new Set(pending.current));
      void load();
    }
  }
  async function cancel(p: Ping) {
    if (demoMode) {
      setDemoPings((items) => items.filter((item) => item.id !== p.id));
      return;
    }
    const { error } = await supabase.from("pings").delete().eq("id", p.id);
    if (error) Alert.alert("Could not cancel ping", error.message);
    else void load();
  }
  async function claimContribution(p: Ping, label: string) {
    if (pending.current.has(p.id) || !currentUser || (!p.accepted && !p.is_own) || p.contributions_unavailable) return;
    const existing = p.contribution_claims?.find((item) => item.label === label);
    if (existing && existing.user_id !== currentUser) return;
    if (demoMode) {
      setDemoPings((items) => items.map((item) => item.id === p.id
        ? withContribution(item, label, { label, user_id: "demo-you", username: "you", display_name: "You" })
        : item));
      setNotice(existing ? "Item released. Someone else can help." : "You’ve got it. Thanks for helping out!");
      return;
    }
    pending.current.add(p.id);
    setBusy(new Set(pending.current));
    try {
      const { error } = await supabase.rpc("set_contribution_claim", {
        target_ping_id: p.id, item_label: label, should_claim: !existing,
      });
      if (error) throw new Error(error.message);
      if (!mode.current) setNotice(existing ? "Item released. Someone else can help." : "You’ve got it. Thanks for helping out!");
    } catch (error) {
      if (!mode.current) Alert.alert("Could not update contribution", error instanceof Error ? error.message : "Please refresh and try again.");
    } finally {
      pending.current.delete(p.id);
      setBusy(new Set(pending.current));
      void load();
    }
  }
  const visible = (demoMode ? demoPings : pings).filter(
    (p) => new Date(p.expires_at).getTime() > now && (onlyMine ? p.accepted || p.is_own : !p.accepted && !p.is_own),
  );
  if (onlyMine) visible.sort((a, b) =>
    new Date(a.starts_at || a.expires_at).getTime() - new Date(b.starts_at || b.expires_at).getTime(),
  );
  const attendeePing = visible.find((ping) => ping.id === attendeePingId);
  const updatesPing = visible.find((ping) => ping.id === updatesPingId);
  useEffect(() => {
    setAttendeePingId(null);
    setUpdatesPingId(null);
  }, [demoMode]);
  return (
    <Page style={{ flex: 1 }}>
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[listContent, { gap: space.md }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={colors.green}
          />
        }
        ListHeaderComponent={
          onlyMine ? (
            <View>
              <Header
                title="My Events"
                subtitle="Plans you’ve joined or are hosting."
                action={<TextAction label="New ping" icon="add" onPress={() => router.push("/create")} />}
              />
              <Row style={{ marginBottom: space.lg, justifyContent: "flex-end" }}>
                <Text style={type.label}>{visible.length} {visible.length === 1 ? "PLAN" : "PLANS"}</Text>
              </Row>
            </View>
          ) : (
          <View>
            <Row spread style={{ marginBottom: space.lg }}>
              <Row gap={space.sm}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    backgroundColor: colors.forest,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="radio" size={22} color={colors.lime} />
                </View>
                <Text
                  style={{
                    fontSize: 27,
                    fontWeight: "700",
                    letterSpacing: -1,
                    color: colors.ink,
                  }}
                >
                  PingMe
                </Text>
              </Row>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 10,
                  paddingHorizontal: space.md,
                }}
              >
                <TextAction
                  label={view === "list" ? "Map" : "List"}
                  icon={view === "list" ? "map-outline" : "list-outline"}
                  onPress={() => setView(view === "list" ? "map" : "list")}
                />
              </View>
            </Row>
            <Row
              spread
              gap={space.md}
              style={{
                backgroundColor: colors.forest,
                borderRadius: 18,
                padding: space.lg,
                marginBottom: space.xl,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 21,
                    lineHeight: 25,
                    fontWeight: "700",
                    letterSpacing: -0.4,
                    color: colors.surface,
                  }}
                >
                  {"Less group chat.\nMore hanging out."}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    lineHeight: 16,
                    color: "#C7D5BD",
                    marginTop: space.sm,
                  }}
                >
                  Pick a plan. Bring your people.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a new ping"
                onPress={() => router.push("/create")}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  backgroundColor: colors.lime,
                  borderRadius: 12,
                  paddingHorizontal: space.md,
                  flexDirection: "row",
                  gap: space.xs,
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="add" size={17} color={colors.forest} />
                {!narrow ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.forest,
                    }}
                  >
                    New ping
                  </Text>
                ) : null}
              </Pressable>
            </Row>
            <Row spread style={{ marginBottom: space.sm }}>
              <Text style={[type.title, { fontSize: 16 }]}>New pings</Text>
              <View
                style={{
                  backgroundColor: colors.mint,
                  paddingHorizontal: space.sm,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.green,
                  }}
                >
                  {visible.length} active
                </Text>
              </View>
            </Row>
            {view === "map" && visible.length > 0 ? (
              <View style={{ marginBottom: space.lg }}>
                <PingMap pings={visible} />
              </View>
            ) : null}
          </View>
          )
        }
        ListEmptyComponent={
          refreshing ? (
            <View style={{ paddingVertical: space.xxxl }}>
              <ActivityIndicator color={colors.green} accessibilityLabel="Loading events" />
            </View>
          ) : onlyMine ? (
            <Empty icon="calendar-outline" title="No plans yet" description="Join a ping to see it here, or start a plan of your own.">
              <Button title="Explore pings" icon="radio-outline" onPress={() => router.navigate("/home")} />
            </Empty>
          ) : (
          <Empty
            icon="radio-outline"
            title="No new pings"
            description="Check My Events for plans you’ve joined or are hosting."
          >
            <Button
              title="My Events"
              icon="calendar-outline"
              onPress={() => router.navigate("/my-events")}
            />
          </Empty>
          )
        }
        renderItem={({ item: p }) => (
          <PingCard
            ping={p}
            now={now}
            busy={busy.has(p.id)}
            currentUser={currentUser}
            onClaim={(label) => claimContribution(p, label)}
            onRespond={() => accept(p)}
            onEdit={() =>
              router.push({ pathname: "/ping/[id]", params: { id: p.id } })
            }
            onCancel={() => cancel(p)}
            onShowAttendees={() => { setUpdatesPingId(null); setAttendeePingId(p.id); }}
            onShowUpdates={() => { setAttendeePingId(null); setUpdatesPingId(p.id); }}
          />
        )}
      />
      {attendeePing ? (
        <AttendeeSheet
          key={attendeePing.id}
          ping={attendeePing}
          demoMode={demoMode}
          onClose={() => setAttendeePingId(null)}
        />
      ) : null}
      {updatesPing ? <UpdatesSheet key={updatesPing.id} ping={updatesPing} onClose={() => setUpdatesPingId(null)} /> : null}
      {notice ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            top: insets.top + space.lg,
            left: space.lg,
            right: space.lg,
            backgroundColor: colors.ink,
            padding: space.lg,
            borderRadius: radius.md,
          }}
        >
          <Text
            style={[
              type.bodyStrong,
              { color: colors.white, textAlign: "center" },
            ]}
          >
            {notice}
          </Text>
        </View>
      ) : null}
    </Page>
  );
}
