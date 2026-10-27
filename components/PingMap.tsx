import { Platform, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState } from "react";
import MapView, { Callout, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { colors, radius, space, type } from "../lib/theme";
import { nameOf } from "../lib/identity";
import { openInMaps, pingCapacity, pingTitle } from "../lib/pings";

export type MapPing = {
  id: string;
  activity: string;
  title?: string | null;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  max_people?: number | null;
  acceptance_count?: number;
  profiles?: { display_name?: string | null; username: string } | null;
};
export function PingMap({ pings }: { pings: MapPing[] }) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const located = pings.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  const first = located[0];
  // Data can arrive after the map mounts. Fit all pins instead of leaving the
  // camera on the initial empty region or centering only the first friend.
  const coordinates = JSON.stringify(located.map((p) => ({
    latitude: p.latitude!, longitude: p.longitude!,
  })));
  useEffect(() => {
    if (!ready) return;
    const points: { latitude: number; longitude: number }[] = JSON.parse(coordinates);
    if (!points.length) return;
    if (points.length === 1) {
      map.current?.animateToRegion({ ...points[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }, 300);
    } else {
      map.current?.fitToCoordinates(points, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }
  }, [coordinates, ready]);
  return (
    <MapView
      ref={map}
      onMapReady={() => setReady(true)}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={{ height: 250, borderRadius: radius.lg }}
      initialRegion={{
        latitude: first?.latitude ?? 39,
        longitude: first?.longitude ?? -98,
        latitudeDelta: first ? 0.12 : 24,
        longitudeDelta: first ? 0.12 : 24,
      }}
    >
      {located.map((p) => {
        const capacity = pingCapacity(p);
        const point = { latitude: p.latitude!, longitude: p.longitude! };
        const availability = capacity.limit === null ? null : `${capacity.total}/${capacity.limit} going · ${capacity.full ? "Full" : `${capacity.remaining} ${capacity.remaining === 1 ? "spot" : "spots"} left`}`;
        // The host's own words for the place when there are any, so the link
        // reads as the spot rather than as a pair of numbers.
        const address = p.location_name?.trim() || p.description?.trim() ||
          `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
        return (
          <Marker
            key={p.id}
            coordinate={point}
            // Android draws a callout as a flat snapshot, so a press inside it
            // never reaches a child view. The marker-level handler fires on
            // both platforms, which is why the whole callout is the link.
            onCalloutPress={() => openInMaps(point, p.location_name)}
            pinColor={capacity.full ? colors.muted : colors.green}
          >
            <Callout
              style={s.callout}
              accessibilityLabel={`Open ${address} in Maps`}
            >
              <Text style={s.title} numberOfLines={2}>
                {`${pingTitle(p)} · ${nameOf(p.profiles)}`}
              </Text>
              {availability ? (
                <Text style={s.meta} numberOfLines={1}>{availability}</Text>
              ) : null}
              <Text style={s.link} numberOfLines={2}>{address}</Text>
              <Text style={s.hint}>Tap to open in Maps</Text>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

// Icon fonts and images inside an Android callout can come out blank, since the
// callout is rasterised before they finish loading. Underline carries the link
// instead of an icon, and the hint line says where the tap goes.
const s = StyleSheet.create({
  callout: { width: 220, paddingVertical: space.xs, gap: 2 },
  title: { ...type.bodyStrong, fontSize: 14, lineHeight: 19 },
  meta: { ...type.small, fontSize: 12, lineHeight: 16 },
  link: {
    ...type.small,
    fontSize: 13,
    lineHeight: 18,
    color: colors.green,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  hint: { ...type.small, fontSize: 11, lineHeight: 15 },
});
