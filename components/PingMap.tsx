import { Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { radius } from "../lib/theme";
import { nameOf } from "../lib/identity";

export type MapPing = {
  id: string;
  activity: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  profiles?: { display_name: string | null; username: string } | null;
};
export function PingMap({ pings }: { pings: MapPing[] }) {
  const located = pings.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  const first = located[0];
  return (
    <MapView
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={{ height: 250, borderRadius: radius.lg }}
      initialRegion={{
        latitude: first?.latitude ?? 39,
        longitude: first?.longitude ?? -98,
        latitudeDelta: first ? 0.12 : 24,
        longitudeDelta: first ? 0.12 : 24,
      }}
    >
      {located.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
          // A marker title is one string, so nameOf picks the name and falls
          // back to the `@`-prefixed handle rather than a bare username.
          title={`${nameOf(p.profiles)} · ${p.activity}`}
          description={p.location_name || p.description || ""}
        />
      ))}
    </MapView>
  );
}
