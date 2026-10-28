import { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import L from "leaflet";
import { Button, Column, Field, IconButton, Row } from "./ui";
import { colors, radius, space, type } from "../lib/theme";
import {
  CLOSE_ZOOM,
  NEARBY_ZOOM,
  WIDE_CENTER,
  WIDE_ZOOM,
  latLng,
  locate,
  locationGranted,
  pin,
  reverseGeocode,
  tiles,
  type Point,
} from "./webMap";

/** What the picker hands back: a point, and the name to show it under. */
export type PickedPlace = {
  latitude: number;
  longitude: number;
  name: string;
};

// Nominatim's usage policy caps a client at a request a second, so a drag
// across half a city costs one lookup rather than one per frame. Twice the
// native delay, for a geocoder that is free and asks to be used gently.
const LOOKUP_DELAY = 700;

/** Identifies a point, so one placement's name can be tied to the exact spot. */
function keyOf(point: Point) {
  return `${point.latitude},${point.longitude}`;
}

/**
 * Full-screen map for choosing where a ping is happening, on web.
 *
 * Carries the same contract and the same behaviour as the native picker —
 * clicking the map drops the pin, dragging it adjusts, a typed name is the
 * user's to keep, and the geocoder only ever fills a name nobody chose — over
 * Leaflet and OpenStreetMap rather than `react-native-maps`, which cannot be
 * imported under react-native-web at all.
 *
 * The one native behaviour with no web counterpart is Android's POI tap: OSM
 * raster tiles are pictures, with no feature layer underneath to name. Clicking
 * a labelled place still drops a pin there, and the geocoder usually comes back
 * with that same label.
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
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [point, setPoint] = useState<Point | null>(initial ?? null);
  const [label, setLabel] = useState(initialName?.trim() || "");
  // A label the user typed is theirs to keep, for good: the geocoder stops
  // overwriting it however far the pin then moves.
  const [typed, setTyped] = useState(!!initialName?.trim());
  // A point already named outright skips the lookup for that one point, rather
  // than locking the field — a later click elsewhere is still named normally.
  const [named, setNamed] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [notice, setNotice] = useState("");
  // Setting the point from a drag must not move the pin again underneath the
  // hand that is dragging it, so the marker effect skips its own echo.
  const dragged = useRef<string | null>(null);

  function place(next: Point, name?: string) {
    setNotice("");
    setPoint(next);
    if (name?.trim()) {
      setLabel(name.trim());
      setNamed(keyOf(next));
    }
  }

  // Create the map once. The camera is driven imperatively from here on, so a
  // re-render mid-gesture cannot yank it back to where the pin started.
  useEffect(() => {
    if (!host.current || map.current) return;
    const instance = L.map(host.current, {
      center: initial ? latLng(initial) : WIDE_CENTER,
      zoom: initial ? CLOSE_ZOOM : WIDE_ZOOM,
      zoomControl: true,
    });
    tiles().addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) =>
      place({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
    );
    map.current = instance;
    // The modal animates in, so the container is still mid-transition when
    // Leaflet first measures it; remeasuring after settles the tile grid.
    const settle = setTimeout(() => instance.invalidateSize(), 250);
    return () => {
      clearTimeout(settle);
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // Read once, as on native: `initial` is the opening camera, not a binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened without a point, start the camera near the user rather than on the
  // whole country — but only off a permission already granted, since opening a
  // map is not itself a reason to ask for one.
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    (async () => {
      if (!(await locationGranted()) || cancelled) return;
      try {
        const here = await locate({ maximumAge: 300000 });
        if (cancelled) return;
        map.current?.setView(latLng(here), NEARBY_ZOOM, { animate: true });
      } catch {
        // No position to be had; the wide view stands.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the one pin in step with the point, creating it on first placement.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!point) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker(latLng(point), {
        icon: pin(colors.green),
        draggable: true,
        keyboard: true,
        alt: "The spot for this ping — drag to adjust",
      })
        .on("dragend", () => {
          const at = marker.current!.getLatLng();
          const next = { latitude: at.lat, longitude: at.lng };
          dragged.current = keyOf(next);
          setNotice("");
          setPoint(next);
        })
        .addTo(instance);
      return;
    }
    if (dragged.current === keyOf(point)) {
      dragged.current = null;
      return;
    }
    marker.current.setLatLng(latLng(point));
  }, [point]);

  // Name the pin from the point, unless the name is already someone's choice.
  useEffect(() => {
    // Typing into the field ends the lookup mid-flight, so the spinner state
    // is cleared on the way out rather than left on for the rest of the modal.
    if (!point || typed || keyOf(point) === named) {
      setLooking(false);
      return;
    }
    const abort = new AbortController();
    setLooking(true);
    const timer = setTimeout(async () => {
      const guess = await reverseGeocode(point, abort.signal);
      if (abort.signal.aborted) return;
      if (guess) setLabel(guess);
      setLooking(false);
    }, LOOKUP_DELAY);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [point?.latitude, point?.longitude, typed, named]);

  // Always brings the camera back to the user; moves the pin only when there
  // isn't one, so it can't undo a pin that was placed deliberately.
  async function recenter() {
    try {
      const here = await locate();
      map.current?.setView(latLng(here), CLOSE_ZOOM, { animate: true });
      if (point) setNotice("");
      else place(here);
    } catch (error) {
      const denied =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as GeolocationPositionError).code === 1;
      setNotice(
        denied
          ? "Location is off, so click the map to drop a pin instead."
          : "Could not read your location just now.",
      );
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
          <div
            ref={host}
            style={{
              position: "absolute",
              inset: 0,
              isolation: "isolate",
              backgroundColor: colors.surfaceAlt,
              fontSize: type.small.fontSize,
              cursor: "crosshair",
            }}
            aria-label="Map — click to place the pin for this ping"
          />
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
                : "Click the map to drop a pin."}
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
  recenter: {
    position: "absolute",
    right: space.lg,
    bottom: space.lg,
    zIndex: 1000,
  },
  tray: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
