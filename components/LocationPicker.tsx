import { useEffect, useRef, useState } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
  type PoiClickEvent,
  type Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Button, Column, Field, IconButton, Row } from "./ui";
import { colors, radius, space, type } from "../lib/theme";

/** What the picker hands back: a point, and the name to show it under. */
export type PickedPlace = {
  latitude: number;
  longitude: number;
  name: string;
};

type Point = { latitude: number; longitude: number };

// Close enough to read street names once a pin is down, and the wider zoom the
// camera settles at when it opens on a guess rather than a chosen point.
const CLOSE = 0.01;
const NEARBY = 0.04;
// The whole country, for a picker opened with nothing at all to centre on.
const WIDE = {
  latitude: 39,
  longitude: -98,
  latitudeDelta: 24,
  longitudeDelta: 24,
};
// The OS geocoder is hit on every placement, so a drag across half a city
// doesn't fire a lookup per frame.
const LOOKUP_DELAY = 350;

/**
 * The OS geocoder's reading of a point, as one line.
 *
 * `name` is whatever it considers primary — a POI on iOS, usually a street
 * address on Android — and the street pair stands in when it comes back bare.
 * The city follows, so a lone street number still says where in the world it is.
 */
function describe(place?: Location.LocationGeocodedAddress) {
  if (!place) return "";
  const primary =
    place.name?.trim() ||
    [place.streetNumber, place.street].filter(Boolean).join(" ");
  const area =
    place.city?.trim() || place.subregion?.trim() || place.region?.trim();
  return [primary, area].filter(Boolean).join(", ");
}

function regionAt(point: Point, delta: number): Region {
  return { ...point, latitudeDelta: delta, longitudeDelta: delta };
}

/** Identifies a point, so one placement's name can be tied to the exact spot. */
function keyOf(point: Point) {
  return `${point.latitude},${point.longitude}`;
}

/**
 * Full-screen map for choosing where a ping is happening, mounted only while
 * open so the map view is released along with it.
 *
 * The caller owns nothing but the result: the picker holds the pin and the label
 * together for as long as it is up, because the label is mostly the geocoder's
 * answer about the pin and only sometimes the user's own words. Tapping the map
 * drops the pin, dragging it adjusts, and on Android tapping a labelled place
 * names it outright — `onPoiClick` fires instead of `onPress` there, and simply
 * never fires on the Apple provider iOS uses.
 */
export function LocationPicker({
  initial,
  initialName,
  onCancel,
  onPick,
}: {
  /** The ping's current point, if it already has one. */
  initial?: Point | null;
  initialName?: string;
  onCancel: () => void;
  onPick: (place: PickedPlace) => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [point, setPoint] = useState<Point | null>(initial ?? null);
  const [label, setLabel] = useState(initialName?.trim() || "");
  // A label the user typed is theirs to keep, for good: the geocoder stops
  // overwriting it however far the pin then moves.
  const [typed, setTyped] = useState(!!initialName?.trim());
  // A POI tap arrives with the name the map itself prints, which beats anything
  // the geocoder would say about that same point — so the lookup skips that one
  // point rather than locking the field, and a later tap elsewhere is still
  // named normally.
  const [named, setNamed] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  // Drops the answer to a lookup that a later placement has already replaced.
  const lookup = useRef(0);

  // Read once: the camera is driven imperatively from here on, so a re-render
  // mid-gesture can't yank it back to where the pin started.
  const [opening] = useState<Region>(() =>
    initial ? regionAt(initial, CLOSE) : WIDE,
  );

  // Opened without a point, start the camera near the user rather than on the
  // whole country — but only off a permission already granted, since opening a
  // map is not itself a reason to ask for one.
  useEffect(() => {
    if (initial || !ready) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getLastKnownPositionAsync({});
        if (!pos || cancelled) return;
        map.current?.animateToRegion(
          regionAt(
            { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            NEARBY,
          ),
          400,
        );
      } catch {
        // No last position to be had; the wide view stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, ready]);

  // Name the pin from the point, unless the name is already someone's choice.
  useEffect(() => {
    if (!point || typed || keyOf(point) === named) return;
    const seq = ++lookup.current;
    setLooking(true);
    const timer = setTimeout(async () => {
      try {
        const [found] = await Location.reverseGeocodeAsync(point);
        if (seq !== lookup.current) return;
        const guess = describe(found);
        if (guess) setLabel(guess);
      } catch {
        // Geocoding is a convenience. Failing it leaves the label to the user.
      } finally {
        if (seq === lookup.current) setLooking(false);
      }
    }, LOOKUP_DELAY);
    return () => clearTimeout(timer);
  }, [point?.latitude, point?.longitude, typed, named]);

  function place(next: Point, name?: string) {
    setNotice("");
    setPoint(next);
    if (name?.trim()) {
      setLabel(name.trim());
      setNamed(keyOf(next));
    }
  }

  // Always brings the camera back to the user; moves the pin only when there
  // isn't one, so it can't undo a pin that was placed deliberately.
  async function recenter() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setNotice("Location is off, so tap the map to drop a pin instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const here = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      map.current?.animateToRegion(regionAt(here, CLOSE), 400);
      if (point) setNotice("");
      else place(here);
    } catch {
      setNotice("Could not read your location just now.");
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <Row spread style={s.header}>
          <IconButton
            icon="close"
            label="Cancel"
            onPress={onCancel}
            size={24}
          />
          <Text style={type.title}>Pick a spot</Text>
          {/* Balances the close button so the title stays centred. */}
          <View style={s.headerSpacer} />
        </Row>

        <View style={s.mapWrap}>
          <MapView
            ref={map}
            onMapReady={() => setReady(true)}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={StyleSheet.absoluteFill}
            initialRegion={opening}
            onPress={(e: MapPressEvent) => place(e.nativeEvent.coordinate)}
            onPoiClick={(e: PoiClickEvent) =>
              place(e.nativeEvent.coordinate, e.nativeEvent.name)
            }
          >
            {point ? (
              <Marker
                coordinate={point}
                draggable
                onDragEnd={(e: MarkerDragStartEndEvent) =>
                  setPoint(e.nativeEvent.coordinate)
                }
                pinColor={colors.green}
              />
            ) : null}
          </MapView>
          <View style={s.recenter}>
            <Button icon="locate" onPress={recenter} variant="secondary" />
          </View>
        </View>

        <Column
          gap={space.md}
          style={[s.tray, { paddingBottom: insets.bottom + space.lg }]}
        >
          <Field
            label="What is this place called?"
            value={label}
            onChangeText={(next) => {
              setLabel(next);
              setTyped(true);
            }}
            placeholder={
              looking ? "Looking up the address…" : "Lincoln Park courts"
            }
            maxLength={80}
          />
          <Text style={type.small}>
            {notice
              ? notice
              : point
                ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · drag the pin to adjust`
                : "Tap the map to drop a pin."}
          </Text>
          <Button
            title="Use this spot"
            disabled={!point}
            onPress={() => point && onPick({ ...point, name: label.trim() })}
          />
        </Column>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: space.lg, paddingVertical: space.md },
  headerSpacer: { width: 32 },
  mapWrap: { flex: 1, overflow: "hidden" },
  recenter: { position: "absolute", right: space.lg, bottom: space.lg },
  tray: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
