import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, IconButton, Row, TextAction } from "./ui";
import { useAuth } from "../lib/auth";
import { useDemo } from "../lib/demo";
import { nameOf } from "../lib/identity";
import { pingTitle, type Ping, type PingUpdate } from "../lib/pings";
import { supabase } from "../lib/supabase";
import { colors, radius, space, type } from "../lib/theme";

export function UpdatesSheet({ ping, onClose }: { ping: Ping; onClose: () => void }) {
  const { demoMode, setDemoPings } = useDemo();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const currentUser = demoMode ? "demo-you" : session?.user.id;
  const [updates, setUpdates] = useState<PingUpdate[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef(0);
  const alive = useRef(true);
  const canPost = !!currentUser && (ping.is_own || ping.accepted);
  const visible = demoMode ? ping.updates || [] : updates;

  const refresh = useCallback(async () => {
    if (demoMode) return;
    const current = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const { data, error: readError } = await supabase.rpc("get_ping_updates", { ping_ids: [ping.id], per_ping_limit: 50 });
      if (readError) throw new Error(readError.message);
      if (alive.current && current === request.current) setUpdates(data || []);
    } catch {
      if (alive.current && current === request.current) setError(true);
    } finally {
      if (alive.current && current === request.current) setLoading(false);
    }
  }, [demoMode, ping.id]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    if (demoMode) return () => { alive.current = false; };
    // Unfiltered change events also catch deletions, whose payload is only an ID.
    const channel = supabase.channel(`ping-updates:${ping.id}`).on("postgres_changes", {
      event: "*", schema: "public", table: "ping_updates",
    }, () => { void refresh(); }).subscribe();
    return () => {
      alive.current = false;
      ++request.current;
      void supabase.removeChannel(channel);
    };
  }, [demoMode, ping.id, refresh]);

  async function post() {
    const body = draft.trim();
    if (!canPost || !body || body.length > 200 || pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (demoMode) {
        const update: PingUpdate = {
          id: `demo-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ping_id: ping.id, user_id: "demo-you", username: "you", display_name: "You",
          body, created_at: new Date().toISOString(),
        };
        setDemoPings((items) => items.map((item) => item.id === ping.id ? { ...item, updates: [update, ...(item.updates || [])] } : item));
      } else {
        const { error: postError } = await supabase.rpc("post_ping_update", { target_ping_id: ping.id, update_body: body });
        if (postError) throw new Error(postError.message);
        if (alive.current) await refresh();
      }
      if (alive.current) setDraft("");
    } catch (postError) {
      if (alive.current) Alert.alert("Could not post update", postError instanceof Error ? postError.message : "Please try again.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function remove(update: PingUpdate) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (demoMode) {
        setDemoPings((items) => items.map((item) => item.id === ping.id ? { ...item, updates: (item.updates || []).filter((entry) => entry.id !== update.id) } : item));
      } else {
        const { error: deleteError } = await supabase.rpc("delete_ping_update", { target_update_id: update.id });
        if (deleteError) throw new Error(deleteError.message);
        if (alive.current) await refresh();
      }
    } catch (deleteError) {
      if (alive.current) Alert.alert("Could not delete update", deleteError instanceof Error ? deleteError.message : "Please try again.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,46,37,0.45)" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close event updates" onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
        <View accessibilityViewIsModal style={{ height: "80%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.xl, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.lg }}>
          <Row spread gap={space.md}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={type.title}>Updates</Text>
              <Text style={type.small} numberOfLines={2}>{pingTitle(ping)}</Text>
            </View>
            <IconButton icon="close" label="Close event updates" onPress={onClose} />
          </Row>
          {error ? (
            <Row spread><Text style={[type.small, { flex: 1 }]}>Updates couldn’t load.</Text><TextAction label="Try again" onPress={refresh} /></Row>
          ) : null}
          <FlatList
            style={{ flex: 1 }}
            data={visible}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space.lg, paddingBottom: space.md }}
            refreshControl={!demoMode ? <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.green} /> : undefined}
            ListEmptyComponent={loading ? <ActivityIndicator color={colors.green} accessibilityLabel="Loading updates" /> : !error ? <Text style={type.small}>No updates yet.</Text> : undefined}
            renderItem={({ item }) => (
              <View style={{ gap: space.xs }}>
                <Row spread gap={space.sm}>
                  <Text style={[type.bodyStrong, { flex: 1 }]}>{item.user_id === currentUser ? "You" : nameOf(item)}{item.user_id === ping.creator_id ? " · Host" : ""}</Text>
                  {(item.user_id === currentUser || ping.is_own) ? <Button title="Delete" compact variant="secondary" disabled={busy} onPress={() => remove(item)} /> : null}
                </Row>
                <Text style={type.body}>{item.body}</Text>
                <Text style={type.small}>{new Date(item.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
              </View>
            )}
          />
          {visible.length >= 50 && !demoMode ? <Text style={type.small}>Showing the latest 50 updates.</Text> : null}
          {canPost ? (
            <View style={{ gap: space.sm }}>
              <Field value={draft} onChangeText={setDraft} multiline maxLength={200} editable={!busy} placeholder="I’ll bring extra brushes…" accessibilityLabel="Write an event update" />
              <Row spread><Text style={type.small}>{draft.length}/200</Text><Button title="Post" icon="send-outline" onPress={post} loading={busy} disabled={!draft.trim()} /></Row>
            </View>
          ) : <Text style={type.small}>Join this ping to post an update.</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
