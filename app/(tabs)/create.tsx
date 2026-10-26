import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import {
  Button,
  Chip,
  Column,
  Field,
  Footnote,
  Header,
  Page,
  Row,
  Section,
  listContent,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { activities, space } from "../../lib/theme";

const DURATIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 480, label: "8 hours" },
];

export default function Create() {
  const [activity, setActivity] = useState("Coffee");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [minutes, setMinutes] = useState(120);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  async function addPlace() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location not enabled", "You can still add a place by name.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    setPlace("My current location");
  }
  async function submit() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }
    const { data: ping, error } = await supabase
      .from("pings")
      .insert({
        creator_id: user.id,
        activity,
        description: description.trim() || null,
        location_name: place.trim() || null,
        ...(coords || {}),
        starts_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + minutes * 60000).toISOString(),
        visibility: "friends",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) Alert.alert("Could not create ping", error.message);
    else {
      void supabase.functions.invoke("notify-ping", {
        body: { pingId: ping.id },
      });
      setDescription("");
      router.replace("/home");
    }
  }
  return (
    <ScrollView
      contentContainerStyle={listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Page>
        <Header
          title="New ping"
          subtitle="Let friends know what you’re up for."
        />
        <Column gap={space.xxl}>
          <Section label="WHAT ARE YOU DOING?">
            <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
              {activities.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  selected={activity === a}
                  onPress={() => setActivity(a)}
                />
              ))}
            </Row>
          </Section>

          <Section label="ADD A NOTE">
            <Field
              value={description}
              onChangeText={setDescription}
              placeholder="Anyone want to join?"
              multiline
              maxLength={240}
            />
          </Section>

          <Section label="WHERE?" gap={space.md}>
            <Field
              value={place}
              onChangeText={(v) => {
                setPlace(v);
                setCoords(null);
              }}
              placeholder="Add a place (optional)"
            />
            <Button
              title={coords ? "Location added" : "Use my current location"}
              icon={coords ? "checkmark" : "navigate-outline"}
              variant="secondary"
              onPress={addPlace}
            />
          </Section>

          <Section label="HOW LONG?">
            <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
              {DURATIONS.map((d) => (
                <Chip
                  key={d.minutes}
                  label={d.label}
                  selected={minutes === d.minutes}
                  onPress={() => setMinutes(d.minutes)}
                />
              ))}
            </Row>
          </Section>

          <Column gap={space.md}>
            <Button
              title="Share ping with friends"
              onPress={submit}
              loading={busy}
            />
            <Footnote>
              Only friends can see this ping. Location is optional.
            </Footnote>
          </Column>
        </Column>
      </Page>
    </ScrollView>
  );
}
