import { useCallback, useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useFocusEffect, router } from "expo-router";
import * as Device from "expo-device";
import {
  Button,
  Card,
  Column,
  Field,
  Footnote,
  Group,
  Header,
  Identity,
  LockedField,
  Page,
  Section,
  SwitchRow,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { activities, space, type } from "../../lib/theme";
import { DISPLAY_NAME_MAX, type IdentityProfile } from "../../lib/identity";
import { scheduleDemoPing } from "../../lib/localNotifications";
import { resolvePushToken, setPushOptOut } from "../../lib/push";
import { useDemo } from "../../lib/demo";

type Pref = {
  friend_id: string | null;
  activity: string | null;
  enabled: boolean;
};

export default function Settings() {
  const { demoMode, setDemoMode, resetDemo } = useDemo();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [friends, setFriends] = useState<(IdentityProfile & { id: string })[]>(
    [],
  );
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  async function sendDemoPing() {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await scheduleDemoPing();
      Alert.alert(
        "Demo ping scheduled",
        "Your sample ping will arrive in about 10 seconds. Go to your home screen now to see the notification.",
      );
    } catch (error) {
      Alert.alert(
        "Could not schedule demo ping",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setDemoBusy(false);
    }
  }
  const load = useCallback(async () => {
    if (demoMode) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("username,display_name")
      .eq("id", user.id)
      .maybeSingle();
    setUsername(profile?.username || "");
    setDisplayName(profile?.display_name || "");
    const { data: p } = await supabase
      .from("notification_preferences")
      .select("friend_id,activity,enabled")
      .eq("user_id", user.id);
    setPrefs(p || []);
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
    }
    // On means *this* device is registered, so it is keyed on the token rather
    // than on the user having some other phone subscribed.
    const setup = await resolvePushToken(false);
    if ("token" in setup) {
      const { count } = await supabase
        .from("push_devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("token", setup.token);
      setPushOn(!!count);
    } else setPushOn(false);
  }, [demoMode]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function toggle(friend_id: string | null, activity: string | null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const current = prefs.find(
      (p) => p.friend_id === friend_id && p.activity === activity,
    );
    const enabled = current ? !current.enabled : false;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, friend_id, activity, enabled },
        { onConflict: "user_id,friend_id,activity" },
      );
    if (error) Alert.alert("Could not save preference", error.message);
    else load();
  }
  const value = (fid: string | null, act: string | null) =>
    prefs.find((p) => p.friend_id === fid && p.activity === act)?.enabled ??
    true;
  async function signOut() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user)
      await supabase.from("push_devices").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    router.replace("/signin");
  }
  async function saveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    if (error) Alert.alert("Could not save profile", error.message);
    else Alert.alert("Profile saved");
  }
  async function togglePush() {
    if (pushBusy) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        const setup = await resolvePushToken(false);
        const rows = supabase
          .from("push_devices")
          .delete()
          .eq("user_id", user.id);
        // Normally this drops one row and leaves the user's other devices
        // subscribed. With no token to match on there is no way to tell them
        // apart, so turning it off has to mean all of them.
        const { error } =
          "token" in setup ? await rows.eq("token", setup.token) : await rows;
        if (error)
          Alert.alert("Could not turn off notifications", error.message);
        else {
          setPushOptOut(true);
          setPushOn(false);
        }
        return;
      }
      const setup = await resolvePushToken(true);
      if ("problem" in setup) {
        Alert.alert("Remote push unavailable", setup.problem);
        return;
      }
      const { error } = await supabase.from("push_devices").upsert(
        {
          user_id: user.id,
          token: setup.token,
          platform: Device.osName === "iOS" ? "ios" : "android",
        },
        { onConflict: "token" },
      );
      if (error) Alert.alert("Could not register device", error.message);
      else {
        setPushOptOut(false);
        setPushOn(true);
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function deleteAccount() {
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your profile, friendships, pings and responses.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("delete_my_account");
            if (error) Alert.alert("Could not delete account", error.message);
            else {
              await supabase.auth.signOut();
              router.replace("/signin");
            }
          },
        },
      ],
    );
  }
  if (demoMode)
    return (
      <ScrollView contentContainerStyle={listContent}>
        <Page>
          <Header
            title="Demo settings"
            subtitle="Everything you need for the walkthrough."
          />
          <Column gap={space.xxl}>
            <Card>
              <Column>
                <Text style={type.body}>
                  Host an art hangout, help time a speech, or fill the last
                  pickleball spot. My Events has your plans and contributions.
                  Everything stays on this device.
                </Text>
                <Button title="Open My Events" icon="calendar-outline" variant="secondary" onPress={() => router.navigate("/my-events")} />
                <Button
                  title="Reset demo"
                  variant="secondary"
                  onPress={() => {
                    resetDemo();
                    router.replace("/home");
                  }}
                />
              </Column>
            </Card>
            <Card>
              <Column>
                <Text style={type.title}>Try the notification</Text>
                <Text style={type.small}>
                  A pickleball invite on this phone in about 10 seconds.
                </Text>
                <Button
                  title="Send demo ping"
                  onPress={sendDemoPing}
                  loading={demoBusy}
                />
              </Column>
            </Card>
            <Footnote>
              Use Exit in the demo banner to return to your account.
            </Footnote>
          </Column>
        </Page>
      </ScrollView>
    );
  return (
    <ScrollView
      contentContainerStyle={listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Page>
        <Header title="Settings" subtitle="Tune who and what you hear about." />
        <Column gap={space.xxl}>
          <Section label="HACKATHON DEMO">
            <Group>
              <SwitchRow
                title="Demo mode"
                value={demoMode}
                onValueChange={() => {
                  setDemoMode(true);
                  router.replace("/home");
                }}
              />
            </Group>
            <Footnote>
              Explore sample friends and pings without changing your account.
            </Footnote>
          </Section>
          <Section>
            <Card>
              {/* The locked handle sits directly above the editable name: the
                  pair shows which half is identity and which is presentation
                  without either one having to explain itself. */}
              <Column gap={space.lg}>
                <LockedField
                  label="Username"
                  value={`@${username || "username"}`}
                />
                <Field
                  label="Display name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Full name"
                  maxLength={DISPLAY_NAME_MAX}
                />
                <Button
                  title="Save profile"
                  variant="secondary"
                  onPress={saveProfile}
                />
              </Column>
            </Card>
          </Section>

          <Section>
            <Group>
              <SwitchRow
                title="Remote push notifications"
                value={pushOn}
                onValueChange={togglePush}
              />
            </Group>
            <Footnote>
              Remote push requires a PingMe build. To try a notification in Expo
              Go, use Send demo ping below.
            </Footnote>
          </Section>

          <Section label="TRY A DEMO PING">
            <Card>
              <Column gap={space.md}>
                <Text style={type.small}>
                  Preview a sample ping on this phone. It arrives in about 10
                  seconds, even if you leave the app.
                </Text>
                <Button
                  title="Send demo ping"
                  variant="secondary"
                  onPress={sendDemoPing}
                  loading={demoBusy}
                />
                <Footnote>
                  This is a local demo notification. It does not send a ping to
                  your friends.
                </Footnote>
              </Column>
            </Card>
          </Section>

          <Section label="PING NOTIFICATIONS">
            <Footnote>
              New friend pings show an alert while PingMe is open and online.
              These preferences apply to both live alerts and remote push.
            </Footnote>
            <Group>
              <SwitchRow
                title="All friend pings"
                value={value(null, null)}
                onValueChange={() => toggle(null, null)}
              />
            </Group>
          </Section>

          <Section label="MUTE BY FRIEND">
            {friends.length ? (
              <Group>
                {friends.map((f) => (
                  <SwitchRow
                    key={f.id}
                    title={<Identity profile={f} />}
                    value={value(f.id, null)}
                    onValueChange={() => toggle(f.id, null)}
                  />
                ))}
              </Group>
            ) : (
              <Text style={type.small}>
                Add friends to mute them individually.
              </Text>
            )}
          </Section>

          <Section label="MUTE BY ACTIVITY">
            <Group>
              {activities.map((a) => (
                <SwitchRow
                  key={a}
                  title={a}
                  value={value(null, a)}
                  onValueChange={() => toggle(null, a)}
                />
              ))}
            </Group>
          </Section>

          <Column gap={space.md}>
            <Button title="Sign out" variant="secondary" onPress={signOut} />
            <Button
              title="Delete account"
              variant="danger"
              onPress={deleteAccount}
            />
            <Footnote>PingMe · Privacy first, plans second</Footnote>
          </Column>
        </Column>
      </Page>
    </ScrollView>
  );
}
