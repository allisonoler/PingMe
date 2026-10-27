import { Platform } from "react-native";
import { useEffect, useRef, useState } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { colors, radius } from "../lib/theme";
import { nameOf } from "../lib/identity";
import { pingCapacity, pingTitle } from "../lib/pings";

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
        const availability = capacity.limit === null ? "" : ` · ${capacity.total}/${capacity.limit} going · ${capacity.full ? "Full" : `${capacity.remaining} ${capacity.remaining === 1 ? "spot" : "spots"} left`}`;
        return (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
            // A marker title is one string, so nameOf picks the name and falls
            // back to the `@`-prefixed handle rather than a bare username.
            title={`${pingTitle(p)} · ${nameOf(p.profiles)}`}
            description={`${p.location_name || p.description || ""}${availability}`}
            pinColor={capacity.full ? colors.muted : colors.green}
          />
        );
      })}
    </MapView>
  );
}
