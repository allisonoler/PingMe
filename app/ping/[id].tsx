import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PingForm, type PingFields } from "../../components/PingForm";
import { Header, Page, TextAction } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors, space } from "../../lib/theme";
import { useDemo } from "../../lib/demo";

const COLUMNS =
  "creator_id,activity,description,location_name,latitude,longitude,starts_at,expires_at";

/** Back to wherever this was opened from, or the feed on a cold deep link. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/home");
}

export default function EditPing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { demoMode, demoPings, setDemoPings } = useDemo();
  const [ping, setPing] = useState<PingFields | null>(null);

  useEffect(() => {
    let live = true;
    if (demoMode) {
      const sample = demoPings.find((item) => item.id === id && item.is_own);
      if (!sample) {
        leave();
        return;
      }
      setPing({
        ...sample,
        starts_at: sample.starts_at || new Date().toISOString(),
      });
      return;
    }
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("pings")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (!live) return;
      // RLS already hides pings that have expired or belong to someone the
      // viewer cannot see; the creator check is what turns a friend's ping into
      // a message rather than a form whose save would be rejected.
      if (error || !data || data.creator_id !== user?.id) {
        Alert.alert(
          "Ping unavailable",
          "It may have ended, been cancelled, or belong to someone else.",
        );
        leave();
        return;
      }
      setPing(data);
    })();
    return () => {
      live = false;
    };
  }, [id, demoMode, demoPings]);

  async function save(fields: PingFields) {
    if (demoMode) {
      setDemoPings((items) =>
        items.map((item) =>
          item.id === id && item.is_own ? { ...item, ...fields } : item,
        ),
      );
      leave();
      return true;
    }
    const { error } = await supabase.from("pings").update(fields).eq("id", id);
    if (error) {
      Alert.alert("Could not save changes", error.message);
      return false;
    }
    // Friends were told once, when the ping went out; an edit updates the feed
    // through Realtime rather than sending another push.
    leave();
    return true;
  }

  if (!ping)
    return (
      <Page>
        <Header title="Edit ping" />
        <View style={{ paddingTop: space.xxl }}>
          <ActivityIndicator color={colors.green} />
        </View>
      </Page>
    );

  return (
    <PingForm
      title={demoMode ? "Edit demo ping" : "Edit ping"}
      subtitle={
        demoMode
          ? "Try a different plan for your walkthrough."
          : "Change the details and your friends will see the update."
      }
      headerAction={<TextAction label="Cancel" tone="muted" onPress={leave} />}
      submitTitle="Save changes"
      footnote={
        demoMode
          ? "Demo only. Changes stay on this device."
          : "Everyone who said they’re in stays in."
      }
      ping={ping}
      onSubmit={save}
    />
  );
}
