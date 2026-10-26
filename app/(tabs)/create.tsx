import { Alert } from "react-native";
import { router } from "expo-router";
import { PingForm, type PingFields } from "../../components/PingForm";
import { supabase } from "../../lib/supabase";

export default function Create() {
  async function create(fields: PingFields) {
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
    router.replace("/home");
    return true;
  }

  return (
    <PingForm
      title="New ping"
      subtitle="Let friends know what you’re up for."
      submitTitle="Share ping with friends"
      footnote="Only friends can see this ping."
      onSubmit={create}
    />
  );
}
