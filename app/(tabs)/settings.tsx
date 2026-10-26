import { useCallback, useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { useFocusEffect, router } from "expo-router";
import * as Device from "expo-device";
import Constants from "expo-constants";
import {
  Button,
  Card,
  Column,
  Field,
  Footnote,
  Group,
  Header,
  Page,
  Section,
  SwitchRow,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { activities, space, type } from "../../lib/theme";

type Pref = {
  friend_id: string | null;
  activity: string | null;
  enabled: boolean;
};
export default function Settings() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [friends, setFriends] = useState<{ id: string; username: string }[]>(
    [],
  );
  const load = useCallback(async () => {
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
        .select("id,username")
        .in("id", ids);
      setFriends(data || []);
    }
  }, []);
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
  async function enablePush() {
    if (!Device.isDevice) {
      Alert.alert(
        "Use a device",
        "Push notifications require a physical device and an EAS development or production build.",
      );
      return;
    }
    if (Constants.executionEnvironment === "storeClient") {
      Alert.alert(
        "Development build needed",
        "Expo Go on Android does not support remote push notifications. Create an EAS development build to enable push.",
      );
      return;
    }
    try {
      const Notifications = await import("expo-notifications");
      let status = (await Notifications.getPermissionsAsync()).status;
      if (status !== "granted")
        status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") {
        Alert.alert(
          "Notifications are off",
          "Enable notifications for PingMe in your device settings.",
        );
        return;
      }
      const projectId =
        Constants.easConfig?.projectId ||
        Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        Alert.alert(
          "EAS project needed",
          "Set your EAS project ID in app.json before registering this device.",
        );
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
        .data;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("push_devices").upsert(
          {
            user_id: user.id,
            token,
            platform: Device.osName === "iOS" ? "ios" : "android",
          },
          { onConflict: "token" },
        );
        if (error) Alert.alert("Could not register device", error.message);
        else
          Alert.alert(
            "Notifications enabled",
            "You’ll receive pings from friends who match your preferences.",
          );
      }
    } catch (error) {
      Alert.alert(
        "Push setup unavailable",
        error instanceof Error
          ? error.message
          : "Use an EAS development build to enable remote notifications.",
      );
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
  return (
    <ScrollView
      contentContainerStyle={listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Page>
        <Header title="Settings" subtitle="Tune who and what you hear about." />
        <Column gap={space.xxl}>
          <Section label={`YOUR PROFILE · @${username || "username"}`}>
            <Card>
              <Column gap={space.md}>
                <Field
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display name"
                  maxLength={60}
                />
                <Text style={type.small}>
                  Your pings are visible to accepted friends only.
                </Text>
                <Button
                  title="Save profile"
                  variant="secondary"
                  onPress={saveProfile}
                />
              </Column>
            </Card>
          </Section>

          <Section label="PUSH NOTIFICATIONS">
            <Button
              title="Enable push notifications"
              icon="notifications-outline"
              variant="secondary"
              onPress={enablePush}
            />
          </Section>

          <Section label="PING NOTIFICATIONS">
            <Group>
              <SwitchRow
                title="All friend pings"
                description="Default on. Turn off to mute all activity."
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
                    title={`@${f.username}`}
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
