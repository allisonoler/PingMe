import { Alert } from "react-native";
import { useCallback, useState } from "react";
import { router } from "expo-router";
import { PingForm, type PingFields } from "../../components/PingForm";
import { supabase } from "../../lib/supabase";
import { useDemo } from "../../lib/demo";
import { PingSent } from "../../components/PingSent";

export default function Create() {
  const { demoMode, createDemoPing } = useDemo();
  const [sent, setSent] = useState(false);
  const finish = useCallback(() => {
    setSent(false);
    router.replace("/my-events");
  }, []);
  async function create(fields: PingFields) {
    if (demoMode) {
      createDemoPing(fields);
      setSent(true);
      return true;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: ping, error } = await supabase
      .from("pings")
      .insert({ ...fields, creator_id: user.id, visibility: "friends" })
      .select("id")
      .single();
    if (error) {
      Alert.alert("Could not create ping", error.message);
      return false;
    }
    void supabase.functions.invoke("notify-ping", {
      body: { pingId: ping.id },
    });
    setSent(true);
    return true;
  }

  return (
    <>
      <PingForm
        title="New ping"
        subtitle="Let friends know what you’re up for."
        submitTitle={demoMode ? "Add demo ping" : "Share ping with friends"}
        footnote={
          demoMode
            ? "Demo only. This ping stays on this device."
            : "Only friends can see this ping."
        }
        onSubmit={create}
      />
      {sent ? <PingSent demoMode={demoMode} onDone={finish} /> : null}
    </>
  );
}
