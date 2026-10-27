import { ReactNode, useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Chip,
  Collapsible,
  Column,
  Field,
  Footnote,
  Group,
  GroupRow,
  Header,
  Page,
  Row,
  Section,
  SwitchRow,
  TextAction,
  listContent,
} from "./ui";
import { LocationPicker, type PickedPlace } from "./LocationPicker";
import {
  TimeRow,
  TimeWheels,
  addMinutes,
  minutesBetween,
  roundUpToStep,
} from "./TimePicker";
import { activities, colors, defaultActivity, space, type } from "../lib/theme";
import { contributionSuggestions, presets } from "../lib/pings";
import { ActivityIcon } from "./ActivityIcon";

const DEFAULT_SPAN = 60;
// The place name the coordinates come with, so turning the switch back off
// knows whether the field still holds its own name.
const HERE = "My current location";
// A start a few minutes old still counts as today: the default start is the
// next five-minute mark, and it can tick past while the ping is being written.
const GRACE_MIN = 10;

/** The `pings` columns the form reads from, and writes back to. */
export type PingFields = {
  activity: string;
  title: string | null;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  expires_at: string;
  contribution_requests: string[];
  max_people: number | null;
};

/** Midnight-relative `minutes` as a real date, `days` from today. */
function timeToday(minutes: number, days = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setMinutes(minutes);
  return d;
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

type Values = {
  activity: string;
  title: string;
  description: string;
  place: string;
  coords: { latitude: number; longitude: number } | null;
  /**
   * Where `coords` came from, which the two controls that set it need to tell
   * apart: the switch reads as on only for its own reading, so a pin dropped on
   * the map doesn't light it up and claim the ping is where the host is standing.
   */
  from: "here" | "map" | null;
  startMin: number;
  endMin: number;
  contributions: string[];
  limitEnabled: boolean;
  peopleLimit: string;
};

/**
 * What the form opens on: an existing ping's own values, or — for a new one —
 * the next five minutes, running for an hour from there.
 */
function valuesFrom(ping?: PingFields): Values {
  if (!ping) {
    const start = roundUpToStep(new Date());
    return {
      activity: defaultActivity,
      title: "",
      description: "",
      place: "",
      coords: null,
      from: null,
      startMin: start,
      endMin: addMinutes(start, DEFAULT_SPAN),
      contributions: [],
      limitEnabled: false,
      peopleLimit: "4",
    };
  }
  return {
    activity: ping.activity,
    title: ping.title || "",
    description: ping.description || "",
    place: ping.location_name || "",
    coords:
      ping.latitude !== null && ping.longitude !== null
        ? { latitude: ping.latitude, longitude: ping.longitude }
        : null,
    // A saved point is just a point: nothing records that it was once read off
    // the host's own position, so an edit reopens it as a pin.
    from:
      ping.latitude !== null && ping.longitude !== null ? "map" : null,
    startMin: minutesOfDay(new Date(ping.starts_at)),
    endMin: minutesOfDay(new Date(ping.expires_at)),
    contributions: ping.contribution_requests || [],
    limitEnabled: ping.max_people != null,
    peopleLimit: String(ping.max_people ?? 4),
  };
}

/**
 * The two clock readings as a real window.
 *
 * A clock time that has already gone by today is read as tomorrow's, so picking
 * 8 AM in the evening schedules a ping rather than a dead one. The end is then
 * the first time it comes round after the start, which is both how a window
 * runs past midnight and why it always fits inside the 24 hours the pings table
 * allows.
 *
 * An edit that leaves the start reading alone keeps the exact instant it
 * already had, so a ping already running stays running instead of being pushed
 * to tomorrow. Moving the start is treated as a fresh pick.
 */
function resolveWindow(startMin: number, endMin: number, existing?: Date) {
  const today = timeToday(startMin);
  const startsAt =
    existing && minutesOfDay(existing) === startMin
      ? existing
      : today.getTime() < Date.now() - GRACE_MIN * 60_000
        ? timeToday(startMin, 1)
        : today;
  return {
    startsAt,
    expiresAt: new Date(
      startsAt.getTime() + minutesBetween(startMin, endMin) * 60_000,
    ),
  };
}

/**
 * The ping composer, shared by the create tab and the edit screen. The caller
 * owns the write and whatever follows it; the form owns the fields, the time
 * window and the validation of it. Resolving `onSubmit` to true means the write
 * went through — a new ping's form then clears itself, since the create tab
 * stays mounted behind the feed it hands off to.
 */
export function PingForm({
  title,
  subtitle,
  headerAction,
  submitTitle,
  footnote,
  ping,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  submitTitle: string;
  footnote?: ReactNode;
  /** The ping being edited; absent when composing a new one. */
  ping?: PingFields;
  onSubmit: (fields: PingFields) => Promise<boolean>;
}) {
  const [v, setV] = useState<Values>(() => valuesFrom(ping));
  // Which row's panel is open, and which one the panel is still showing while
  // it animates shut — without the second, the wheels would flip to the other
  // time on the way out and close on the wrong number.
  const [openRow, setOpenRow] = useState<"start" | "end" | null>(null);
  const [elevated, setElevated] = useState<"start" | "end">("start");
  const [busy, setBusy] = useState(false);
  const [contribution, setContribution] = useState("");
  const [picking, setPicking] = useState(false);
  const patch = (next: Partial<Values>) =>
    setV((prev) => ({ ...prev, ...next }));

  function addContribution(value: string) {
    const label = value.trim();
    if (!label || v.contributions.length >= 6 || v.contributions.some((item) => item.toLowerCase() === label.toLowerCase())) return;
    patch({ contributions: [...v.contributions, label] });
    setContribution("");
  }

  function toggleRow(row: "start" | "end") {
    setElevated(row);
    setOpenRow(openRow === row ? null : row);
  }

  // Moving the start carries the end with it, so the window keeps the length it
  // already had instead of collapsing or inverting. Both wheel callbacks are
  // stable, so settling a column never hands the wheels a fresh identity.
  const changeStart = useCallback(
    (next: number) =>
      setV((prev) => ({
        ...prev,
        startMin: next,
        endMin: addMinutes(
          next,
          minutesBetween(prev.startMin, prev.endMin) || DEFAULT_SPAN,
        ),
      })),
    [],
  );
  const changeEnd = useCallback(
    (endMin: number) => setV((prev) => ({ ...prev, endMin })),
    [],
  );

  // The switch reads off `from`, so a refused permission leaves it off without
  // any state of its own, and a pin dropped on the map leaves it alone.
  async function toggleHere() {
    if (v.from === "here") {
      patch({ coords: null, from: null, place: v.place === HERE ? "" : v.place });
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location not enabled", "You can still add a place by name.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    patch({
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      },
      from: "here",
      place: HERE,
    });
  }

  // The picker owns the pin and its name together while it is open, so what
  // comes back replaces both. A name left empty there clears the field rather
  // than stranding the previous place's name on a new point.
  function pickPlace(picked: PickedPlace) {
    patch({
      coords: { latitude: picked.latitude, longitude: picked.longitude },
      from: "map",
      place: picked.name,
    });
    setPicking(false);
  }

  function clearPlace() {
    patch({ coords: null, from: null, place: v.place === HERE ? "" : v.place });
  }

  async function submit() {
    if (busy) return;
    const maxPeople = v.limitEnabled ? Number(v.peopleLimit) : null;
    if (maxPeople !== null && (!/^\d+$/.test(v.peopleLimit) || !Number.isInteger(maxPeople) || maxPeople < 2 || maxPeople > 1000)) {
      Alert.alert("Check the people limit", "Choose a whole number from 2 to 1,000, including yourself.");
      return;
    }
    if (contribution.trim()) {
      Alert.alert("Add your contribution", "Tap Add to include the item, or clear it before sharing.");
      return;
    }
    if (v.startMin === v.endMin) {
      Alert.alert(
        "Check the times",
        "Pick an end time that is different from the start.",
      );
      return;
    }
    const { startsAt, expiresAt } = resolveWindow(
      v.startMin,
      v.endMin,
      ping ? new Date(ping.starts_at) : undefined,
    );
    if (expiresAt <= new Date()) {
      Alert.alert("Check the times", "That window has already passed.");
      return;
    }

    setBusy(true);
    try {
      const saved = await onSubmit({
        activity: v.activity,
        title: v.title.trim() || null,
        description: v.description.trim() || null,
        location_name: v.place.trim() || null,
        latitude: v.coords?.latitude ?? null,
        longitude: v.coords?.longitude ?? null,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        contribution_requests: v.contributions,
        max_people: maxPeople,
      });
      if (saved && !ping) setV(valuesFrom());
    } catch (error) {
      Alert.alert("Could not save ping", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Page>
          <Header title={title} subtitle={subtitle} action={headerAction} />
          <Column gap={space.xxl}>
            {!ping ? (
              <Section label="MAKE A QUICK PLAN">
                <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
                  {presets.map((preset) => (
                    <Button
                      key={preset.activity}
                      title={preset.activity}
                      icon={<ActivityIcon activity={preset.activity} size={15} color={colors.green} />}
                      variant="secondary"
                      compact
                      onPress={() =>
                        patch({
                          activity: preset.activity,
                          title: preset.title,
                          description: preset.description,
                          place: preset.place,
                          coords: null,
                          from: null,
                        })
                      }
                    />
                  ))}
                </Row>
              </Section>
            ) : null}
            <Section>
              <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
                {activities.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={v.activity === a}
                    onPress={() => patch({ activity: a })}
                  />
                ))}
              </Row>
            </Section>

            <Section label="GIVE IT A TITLE">
              <Field value={v.title} onChangeText={(title) => patch({ title: title.replace(/[\r\n]+/g, " ") })} placeholder="e.g. Come do art with me" maxLength={80} />
              <Text style={type.small}>Optional. The activity name is used if you leave this blank.</Text>
            </Section>

            <Section label="ADD A NOTE">
              <Field
                value={v.description}
                onChangeText={(description) => patch({ description })}
                placeholder="Anyone want to join?"
                multiline
                maxLength={240}
              />
            </Section>

            <Section label="PEOPLE" gap={space.md}>
              <Group>
                <SwitchRow title="Limit the number of people" value={v.limitEnabled} onValueChange={() => patch({ limitEnabled: !v.limitEnabled })} />
              </Group>
              {v.limitEnabled ? (
                <>
                  <Field label="People limit" hint="Includes you as the host. Spots reopen when someone leaves." value={v.peopleLimit} onChangeText={(peopleLimit) => patch({ peopleLimit: peopleLimit.replace(/[^0-9]/g, "") })} keyboardType="number-pad" maxLength={4} />
                  <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
                    {[4, 6, 8, 12].map((limit) => (
                      <Chip key={limit} label={String(limit)} selected={v.peopleLimit === String(limit)} onPress={() => patch({ peopleLimit: String(limit) })} />
                    ))}
                  </Row>
                </>
              ) : <Text style={type.small}>No limit. All your friends are welcome to join.</Text>}
            </Section>

            <Section label="HELP MAKE IT HAPPEN" gap={space.md}>
              <Text style={type.small}>Ask for a few things friends can bring or help with. Optional, up to 6 items.</Text>
              {v.contributions.map((label) => (
                <Row key={label} spread gap={space.md}>
                  <Text style={[type.bodyStrong, { flex: 1 }]}>{label}</Text>
                  <TextAction label="Remove" tone="muted" onPress={() => patch({ contributions: v.contributions.filter((item) => item !== label) })} />
                </Row>
              ))}
              {v.contributions.length < 6 ? (
                <>
                  <Row gap={space.sm} style={{ flexWrap: "wrap" }}>
                    {contributionSuggestions(v.activity).filter((label) => !v.contributions.some((item) => item.toLowerCase() === label.toLowerCase())).map((label) => (
                      <Button key={label} title={label} icon="add" compact variant="secondary" onPress={() => addContribution(label)} />
                    ))}
                  </Row>
                  <Row gap={space.sm}>
                    <Field style={{ flex: 1 }} value={contribution} onChangeText={setContribution} placeholder="Something else?" maxLength={40} returnKeyType="done" onSubmitEditing={() => addContribution(contribution)} />
                    <Button title="Add" onPress={() => addContribution(contribution)} disabled={!contribution.trim() || v.contributions.some((item) => item.toLowerCase() === contribution.trim().toLowerCase())} />
                  </Row>
                </>
              ) : null}
              {ping ? <Text style={type.small}>Removing an item releases its claim.</Text> : null}
            </Section>

            <Section label="LOCATION" gap={space.md}>
              {/* Renaming the place keeps the point: the name is what friends
                  read, the point is what puts the ping on the map, and a ping
                  wants both — so these stack rather than sitting either side of
                  an "or" the way the name and the switch used to. */}
              <Field
                value={v.place}
                onChangeText={(place) => patch({ place })}
                placeholder="Add a place (optional)"
                hint="Friends read the name. Pin it below to put it on the map too."
              />
              <Group>
                <GroupRow
                  onPress={() => setPicking(true)}
                  accessibilityLabel={
                    v.coords ? "Change the spot on the map" : "Pin a spot on the map"
                  }
                >
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Text style={type.body}>
                      {v.from === "map" ? "Spot pinned on the map" : "Pin a spot on the map"}
                    </Text>
                    <Text style={[type.small, { marginTop: space.xs }]}>
                      {v.coords
                        ? `${v.coords.latitude.toFixed(4)}, ${v.coords.longitude.toFixed(4)}`
                        : "Somewhere other than where you are now"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </GroupRow>
                <SwitchRow
                  title="Use my current location"
                  value={v.from === "here"}
                  onValueChange={toggleHere}
                />
              </Group>
              {v.coords ? (
                <Row>
                  <TextAction label="Remove the pin" tone="muted" onPress={clearPlace} />
                </Row>
              ) : null}
            </Section>

            <Section gap={space.md}>
              <Row gap={space.md}>
                <TimeRow
                  label="STARTS"
                  minutes={v.startMin}
                  open={openRow === "start"}
                  onPress={() => toggleRow("start")}
                />
                <TimeRow
                  label="ENDS"
                  minutes={v.endMin}
                  open={openRow === "end"}
                  onPress={() => toggleRow("end")}
                />
              </Row>
              <Collapsible open={openRow !== null}>
                <TimeWheels
                  minutes={elevated === "start" ? v.startMin : v.endMin}
                  onChange={elevated === "start" ? changeStart : changeEnd}
                />
              </Collapsible>
            </Section>

            <Column gap={space.md}>
              <Button title={submitTitle} onPress={submit} loading={busy} />
              {footnote ? <Footnote>{footnote}</Footnote> : null}
            </Column>
          </Column>
        </Page>
      </ScrollView>
      {/* Mounted only while open, so the map view is torn down with it and the
          camera reads the ping's current point afresh on every open. */}
      {picking ? (
        <LocationPicker
          initial={v.coords}
          initialName={v.place === HERE ? "" : v.place}
          onCancel={() => setPicking(false)}
          onPick={pickPlace}
        />
      ) : null}
    </>
  );
}
