import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { PingMap } from "../../components/PingMap";
import { PingCard } from "../../components/PingCard";
import { AttendeeSheet } from "../../components/AttendeeSheet";
import {
  Button,
  Empty,
  Page,
  Row,
  TextAction,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, radius, space, type } from "../../lib/theme";
import { useDemo } from "../../lib/demo";
import { withResponse, type Ping } from "../../lib/pings";

export default function Home() {
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const { demoMode, demoPings, setDemoPings } = useDemo();
  const [pings, setPings] = useState<Ping[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"list" | "map">("map");
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [attendeePingId, setAttendeePingId] = useState<string | null>(null);
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
      const summaries = rows.length
        ? await supabase.rpc("get_ping_counts", {
            ping_ids: rows.map((p) => p.id),
          })
        : { data: [] };
      const counts = new Map<string, number>();
      for (const item of summaries.data || [])
        counts.set(item.ping_id, item.total);
      if (request !== generation.current || mode.current) return;
      setPings((previous) =>
        rows.map((p) =>
          pending.current.has(p.id)
            ? previous.find((item) => item.id === p.id) || p
            : {
                ...p,
                is_own: p.creator_id === user.id,
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
      .channel("active-pings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pings" },
        () => {
          void load();
        },
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
  }, [load, demoMode]);
  async function accept(p: Ping) {
    if (pending.current.has(p.id)) return;
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
          : "You're in. See you there!",
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
      if (error) throw error;
      setNotice(
        p.accepted
          ? "You're off the list. Next time!"
          : "You're in. See you there!",
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
  const visible = (demoMode ? demoPings : pings).filter(
    (p) => new Date(p.expires_at).getTime() > now,
  );
  const attendeePing = visible.find((ping) => ping.id === attendeePingId);
  useEffect(() => {
    setAttendeePingId(null);
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
              <Text style={[type.title, { fontSize: 16 }]}>Around you</Text>
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
            {view === "map" ? (
              <View style={{ marginBottom: space.lg }}>
                <PingMap pings={visible} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Empty
            icon="radio-outline"
            title="It's quiet for now"
            description="Start a ping and invite a friend to join you."
          >
            <Button
              title="Create a ping"
              icon="add"
              onPress={() => router.push("/create")}
            />
          </Empty>
        }
        renderItem={({ item: p }) => (
          <PingCard
            ping={p}
            now={now}
            busy={busy.has(p.id)}
            onRespond={() => accept(p)}
            onEdit={() =>
              router.push({ pathname: "/ping/[id]", params: { id: p.id } })
            }
            onCancel={() => cancel(p)}
            onShowAttendees={() => setAttendeePingId(p.id)}
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
      {notice ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            bottom: space.lg,
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
