import { ReactNode, useCallback, useState } from "react";
import { Alert, ScrollView } from "react-native";
import * as Location from "expo-location";
import {
  Button,
  Chip,
  Collapsible,
  Column,
  Field,
  Footnote,
  Group,
  Header,
  OrDivider,
  Page,
  Row,
  Section,
  SwitchRow,
  listContent,
} from "./ui";
import {
  TimeRow,
  TimeWheels,
  addMinutes,
  minutesBetween,
  roundUpToStep,
} from "./TimePicker";
import { activities, defaultActivity, space } from "../lib/theme";

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
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  expires_at: string;
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
  description: string;
  place: string;
  coords: { latitude: number; longitude: number } | null;
  startMin: number;
  endMin: number;
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
      description: "",
      place: "",
      coords: null,
      startMin: start,
      endMin: addMinutes(start, DEFAULT_SPAN),
    };
  }
  return {
    activity: ping.activity,
    description: ping.description || "",
    place: ping.location_name || "",
    coords:
      ping.latitude !== null && ping.longitude !== null
        ? { latitude: ping.latitude, longitude: ping.longitude }
        : null,
    startMin: minutesOfDay(new Date(ping.starts_at)),
    endMin: minutesOfDay(new Date(ping.expires_at)),
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
  const patch = (next: Partial<Values>) =>
    setV((prev) => ({ ...prev, ...next }));

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

  // The switch reads off `coords`, so a refused permission leaves it off
  // without any state of its own.
  async function toggleHere() {
    if (v.coords) {
      patch({ coords: null, place: v.place === HERE ? "" : v.place });
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
      place: HERE,
    });
  }

  async function submit() {
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
    const saved = await onSubmit({
      activity: v.activity,
      description: v.description.trim() || null,
      location_name: v.place.trim() || null,
      latitude: v.coords?.latitude ?? null,
      longitude: v.coords?.longitude ?? null,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
    setBusy(false);
    if (saved && !ping) setV(valuesFrom());
  }

  return (
    <ScrollView
      contentContainerStyle={listContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Page>
        <Header title={title} subtitle={subtitle} action={headerAction} />
        <Column gap={space.xxl}>
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

          <Section label="ADD A NOTE">
            <Field
              value={v.description}
              onChangeText={(description) => patch({ description })}
              placeholder="Anyone want to join?"
              multiline
              maxLength={240}
            />
          </Section>

          <Section label="LOCATION" gap={space.md}>
            <Field
              value={v.place}
              onChangeText={(place) => patch({ place, coords: null })}
              placeholder="Add a place (optional)"
            />
            <OrDivider />
            <Group>
              <SwitchRow
                title="Use my current location"
                value={v.coords !== null}
                onValueChange={toggleHere}
              />
            </Group>
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
  );
}
