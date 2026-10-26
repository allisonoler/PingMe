import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, Text, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PingMap } from "../../components/PingMap";
import {
  Badge,
  Button,
  Card,
  Empty,
  Header,
  Identity,
  Page,
  Row,
  TextAction,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, space, type } from "../../lib/theme";
import { nameOf } from "../../lib/identity";

type Ping = {
  id: string;
  activity: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  expires_at: string;
  creator_id: string;
  profiles?: { display_name: string | null; username: string } | null;
  ping_acceptances?: {
    user_id: string;
    profiles?: { display_name: string | null; username: string } | null;
  }[];
  accepted?: boolean;
  is_own?: boolean;
  acceptance_count?: number;
};
export default function Home() {
  const [pings, setPings] = useState<Ping[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const load = useCallback(async () => {
    setRefreshing(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("pings")
      .select(
        "*, profiles!pings_creator_id_fkey(display_name,username), ping_acceptances(user_id,profiles!ping_acceptances_user_id_fkey(username,display_name))",
      )
      .gt("expires_at", new Date().toISOString())
      .order("expires_at");
    if (error) Alert.alert("Could not load pings", error.message);
    else {
      const rows = data || [];
      const summaries = rows.length
        ? await supabase.rpc("get_ping_counts", {
            ping_ids: rows.map((p: any) => p.id),
          })
        : { data: [] };
      const counts = new Map<string, number>();
      for (const x of summaries.data || []) counts.set(x.ping_id, x.total);
      setPings(
        rows.map((p: any) => ({
          ...p,
          profiles: p.profiles,
          is_own: p.creator_id === user?.id,
          accepted:
            p.ping_acceptances?.some((a: any) => a.user_id === user?.id) ||
            false,
          acceptance_count: counts.get(p.id) || 0,
        })),
      );
    }
    setRefreshing(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    const channel = supabase
      .channel("active-pings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pings" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ping_acceptances" },
        () => load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);
  async function accept(p: Ping) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = p.accepted
      ? await supabase
          .from("ping_acceptances")
          .delete()
          .eq("ping_id", p.id)
          .eq("user_id", user.id)
      : await supabase
          .from("ping_acceptances")
          .insert({ ping_id: p.id, user_id: user.id });
    if (error) Alert.alert("Could not update response", error.message);
    else load();
  }
  async function cancel(p: Ping) {
    const { error } = await supabase.from("pings").delete().eq("id", p.id);
    if (error) Alert.alert("Could not cancel ping", error.message);
    else load();
  }
  return (
    <Page>
      <Header
        title="Around you"
        subtitle="See what your people are up to."
        action={
          <TextAction
            label={view === "list" ? "Map" : "List"}
            icon={view === "list" ? "map-outline" : "list-outline"}
            onPress={() => setView(view === "list" ? "map" : "list")}
          />
        }
      />
      {view === "map" ? (
        <View style={{ marginBottom: space.lg }}>
          <PingMap pings={pings} />
        </View>
      ) : null}
      <FlatList
        data={pings}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[listContent, { gap: space.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor={colors.green}
          />
        }
        ListEmptyComponent={
          <Empty
            icon="radio-outline"
            title="It’s quiet for now"
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
          <Card>
            <Row spread>
              <Badge label={p.activity} />
              <Text style={type.small}>
                until{" "}
                {new Date(p.expires_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </Row>
            <Identity
              profile={p.profiles}
              size="title"
              style={{ marginTop: space.md }}
            />
            {p.description ? (
              <Text style={[type.body, { marginTop: space.xs }]}>
                {p.description}
              </Text>
            ) : null}
            <Row gap={space.xs} style={{ marginTop: space.sm }}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.muted}
              />
              <Text style={[type.small, { flex: 1 }]}>
                {p.location_name || "No place added"}
              </Text>
            </Row>
            {p.is_own && p.ping_acceptances?.length ? (
              <Text
                style={[
                  type.small,
                  { color: colors.green, marginTop: space.sm },
                ]}
              >
                Going:{" "}
                {p.ping_acceptances.map((a) => nameOf(a.profiles)).join(", ")}
              </Text>
            ) : null}
            <Row spread style={{ marginTop: space.lg }}>
              <Text style={type.small}>{p.acceptance_count || 0} going</Text>
              {p.is_own ? (
                <Row gap={space.sm}>
                  <Button
                    title="Edit"
                    icon="create-outline"
                    variant="secondary"
                    compact
                    onPress={() =>
                      router.push({
                        pathname: "/ping/[id]",
                        params: { id: p.id },
                      })
                    }
                  />
                  <Button
                    title="Cancel"
                    variant="secondary"
                    compact
                    onPress={() => cancel(p)}
                  />
                </Row>
              ) : (
                <Button
                  title={p.accepted ? "Going" : "I’m in"}
                  icon={p.accepted ? "checkmark" : undefined}
                  variant={p.accepted ? "secondary" : "primary"}
                  compact
                  onPress={() => accept(p)}
                />
              )}
            </Row>
          </Card>
        )}
      />
    </Page>
  );
}
