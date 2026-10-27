import { useCallback, useState } from "react";
import { Alert, FlatList, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Button,
  Card,
  Column,
  Field,
  Header,
  IconButton,
  Identity,
  Page,
  Row,
  Section,
  TextAction,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { space, type } from "../../lib/theme";
import { handleOf } from "../../lib/identity";
import { demoFriends, useDemo } from "../../lib/demo";

type Profile = { id: string; username: string; display_name: string | null };
type Request = {
  id: string;
  requester_id: string;
  recipient_id: string;
  profiles?: Profile | null;
};
export default function Friends() {
  const { demoMode } = useDemo();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const load = useCallback(async () => {
    if (demoMode) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rels } = await supabase
      .from("friendships")
      .select("requester_id,recipient_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
    const ids = (rels || []).map((r) =>
      r.requester_id === user.id ? r.recipient_id : r.requester_id,
    );
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name")
        .in("id", ids);
      setFriends(data || []);
    } else setFriends([]);
    const { data: req } = await supabase
      .from("friendships")
      .select(
        "id,requester_id,recipient_id,profiles!friendships_requester_id_fkey(id,username,display_name)",
      )
      .eq("recipient_id", user.id)
      .eq("status", "pending");
    setIncoming((req || []) as any);
  }, [demoMode]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function search() {
    const q = term.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data, error } = await supabase.rpc("search_profiles", {
      search_prefix: q,
      page_size: 12,
      page_offset: 0,
    });
    if (error) Alert.alert("Search unavailable", error.message);
    else setResults(data || []);
  }
  async function send(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, recipient_id: id, status: "pending" });
    if (error) Alert.alert("Could not send request", error.message);
    else {
      Alert.alert(
        "Request sent",
        "You’ll see your new friend here when they accept.",
      );
      setResults(results.filter((x) => x.id !== id));
    }
  }
  async function respond(r: Request, yes: boolean) {
    const { error } = yes
      ? await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", r.id)
      : await supabase.from("friendships").delete().eq("id", r.id);
    if (error) Alert.alert("Could not update request", error.message);
    else load();
  }
  function manage(f: Profile) {
    Alert.alert(handleOf(f), "Choose an action", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove friend",
        style: "destructive",
        onPress: async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { error } = await supabase
            .from("friendships")
            .delete()
            .eq("status", "accepted")
            .or(
              `and(requester_id.eq.${user.id},recipient_id.eq.${f.id}),and(requester_id.eq.${f.id},recipient_id.eq.${user.id})`,
            );
          if (error) Alert.alert("Could not remove friend", error.message);
          else load();
        },
      },
      {
        text: "More",
        onPress: () =>
          Alert.alert("Safety and privacy", undefined, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Block",
              style: "destructive",
              onPress: async () => {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user) return;
                const { error } = await supabase
                  .from("blocks")
                  .insert({ blocker_id: user.id, blocked_id: f.id });
                if (error) Alert.alert("Could not block user", error.message);
                else {
                  await supabase
                    .from("friendships")
                    .delete()
                    .or(
                      `and(requester_id.eq.${user.id},recipient_id.eq.${f.id}),and(requester_id.eq.${f.id},recipient_id.eq.${user.id})`,
                    );
                  load();
                }
              },
            },
            {
              text: "Report",
              onPress: () =>
                Alert.alert(`Report ${handleOf(f)}`, undefined, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Spam",
                    onPress: () => report(f, "Spam or unwanted behavior"),
                  },
                  {
                    text: "Safety concern",
                    onPress: () => report(f, "Safety concern"),
                  },
                ]),
            },
          ]),
      },
    ]);
  }
  async function report(f: Profile, reason: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("reports")
      .insert({ reporter_id: user.id, reported_id: f.id, reason });
    if (error) Alert.alert("Could not send report", error.message);
    else Alert.alert("Report sent", "Thanks for helping keep PingMe safe.");
  }
  if (demoMode)
    return (
      <Page style={{ flex: 1 }}>
        <Header
          title="Your people"
          subtitle="Sample friends for your campus demo."
        />
        <FlatList
          data={demoFriends}
          keyExtractor={(friend) => friend.id}
          contentContainerStyle={[listContent, { gap: space.md }]}
          renderItem={({ item, index }) => (
            <Card>
              <Row spread>
                <Identity
                  profile={item}
                  avatar
                  avatarIndex={index}
                  style={{ flex: 1 }}
                />
                <Text style={type.small}>Demo friend</Text>
              </Row>
            </Card>
          )}
        />
      </Page>
    );
  return (
    <Page>
      <Header title="Friends" />
      <Row gap={space.sm} style={{ marginBottom: space.xl }}>
        <Field
          style={{ flex: 1 }}
          value={term}
          onChangeText={setTerm}
          placeholder="Search by username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <Button icon="search" onPress={search} />
      </Row>
      <FlatList
        data={friends}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[listContent, { gap: space.md }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Column gap={space.xl}>
            {incoming.length > 0 ? (
              <Section label="REQUESTS FOR YOU" gap={space.md}>
                {incoming.map((r, i) => (
                  <Card key={r.id}>
                    <Row spread>
                      <Identity
                        profile={r.profiles}
                        note="Wants to connect"
                        avatar
                        avatarIndex={i}
                        style={{ flex: 1 }}
                      />
                      <Row gap={space.sm}>
                        <TextAction
                          label="Decline"
                          tone="muted"
                          onPress={() => respond(r, false)}
                        />
                        <TextAction
                          label="Accept"
                          onPress={() => respond(r, true)}
                        />
                      </Row>
                    </Row>
                  </Card>
                ))}
              </Section>
            ) : null}
            {results.length > 0 ? (
              <Section label="SEARCH RESULTS" gap={space.md}>
                {results.map((p, i) => (
                  <Card key={p.id}>
                    <Row spread>
                      <Identity
                        profile={p}
                        avatar
                        avatarIndex={i}
                        style={{ flex: 1 }}
                      />
                      <TextAction
                        label="Add"
                        icon="person-add-outline"
                        onPress={() => send(p.id)}
                      />
                    </Row>
                  </Card>
                ))}
              </Section>
            ) : null}
            <Text style={type.label}>YOUR FRIENDS · {friends.length}</Text>
          </Column>
        }
        ListEmptyComponent={
          <Text style={type.small}>
            {friends.length
              ? "No more friends to show."
              : "Add friends to see their pings."}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Card>
            <Row spread>
              <Identity
                profile={item}
                avatar
                avatarIndex={index}
                style={{ flex: 1 }}
              />
              <IconButton
                icon="ellipsis-horizontal"
                label={`Manage ${handleOf(item)}`}
                onPress={() => manage(item)}
              />
            </Row>
          </Card>
        )}
      />
    </Page>
  );
}
