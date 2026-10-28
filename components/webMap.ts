import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { colors } from "../lib/theme";

/**
 * The browser half of the map, shared by `PingMap.web` and `LocationPicker.web`.
 *
 * `react-native-maps` ships Fabric native specs that crash on import under
 * react-native-web, so web cannot reuse the native map at all — it reuses the
 * components' props instead, and this module is what keeps the two web screens
 * agreeing on tiles, pins and place names rather than each inventing their own.
 *
 * Only ever imported from a `.web.tsx` file, so Leaflet's module-level `window`
 * access is never reached by a native bundle.
 */

export type Point = { latitude: number; longitude: number };

/** Leaflet orders a point the other way round from react-native-maps. */
export function latLng(point: Point): L.LatLngExpression {
  return [point.latitude, point.longitude];
}

/** The whole country, for a map opened with nothing to centre on. */
export const WIDE_CENTER: L.LatLngExpression = [39, -98];
export const WIDE_ZOOM = 4;
// Close enough to read street names, and the wider zoom a picker settles at
// when it opens on a guess rather than a chosen point. These stand in for the
// native pair of region deltas, which Leaflet has no equivalent of.
export const CLOSE_ZOOM = 15;
export const NEARBY_ZOOM = 13;

/**
 * OpenStreetMap raster tiles. Free and keyless, which is the whole reason they
 * are here, on the condition that the credit line stays visible — Leaflet draws
 * it into the corner of the map from this attribution string.
 */
export function tiles() {
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
}

/**
 * A pin in one of the app's own colours.
 *
 * Leaflet's stock marker is a pair of PNGs it resolves by URL, which a bundler
 * rewrites and then fails to find; an inline SVG has no such path to lose, and
 * it takes `pinColor` from the native map directly. The anchor sits at the tip
 * so the pin points at its coordinate rather than straddling it.
 */
export function pin(color: string, { shadow = true } = {}) {
  return L.divIcon({
    className: "pingme-pin",
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -34],
    html: `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg" style="display:block${shadow ? ";filter:drop-shadow(0 1px 2px rgba(24,46,37,.45))" : ""}">
      <path d="M13 .9C6.3.9.9 6.3.9 13c0 8.5 10.3 20.5 11 21.3.3.4.9.4 1.2 0 .7-.8 11-12.8 11-21.3C25.1 6.3 19.7.9 13 .9Z" fill="${color}" stroke="${colors.white}" stroke-width="1.8"/>
      <circle cx="13" cy="13" r="4.4" fill="${colors.white}"/>
    </svg>`,
  });
}

/** Escapes a value destined for the `html` of a popup or a pin. */
export function esc(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;"
      : char === "<" ? "&lt;"
      : char === ">" ? "&gt;"
      : char === '"' ? "&quot;"
      : "&#39;",
  );
}

type NominatimPlace = {
  name?: string;
  address?: Record<string, string | undefined>;
};

/**
 * The one line a point is named by, matching `describe()` in the native picker:
 * whatever the geocoder calls the place — a POI name, else the street pair —
 * then the city, so a lone street number still says where in the world it is.
 */
function describe(place: NominatimPlace) {
  const address = place.address || {};
  const primary =
    place.name?.trim() ||
    [address.house_number, address.road].filter(Boolean).join(" ") ||
    address.neighbourhood?.trim() ||
    "";
  const area = (
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.county ||
    address.state ||
    ""
  ).trim();
  // Out in open country the geocoder's name for a point is the county itself,
  // and naming the area after it again reads as a stutter: "Cheyenne County,
  // Cheyenne County". One of the two is the whole answer there.
  if (!primary) return area;
  if (!area || area.toLowerCase() === primary.toLowerCase()) return primary;
  return `${primary}, ${area}`;
}

/**
 * Nominatim stands in for `expo-location`'s reverse geocoder, which is not
 * implemented on web.
 *
 * It is a free, unfunded service, so its usage policy caps a client at one
 * request a second — which is why the picker debounces placements well past the
 * native delay rather than looking up every drag frame. A browser cannot set
 * `User-Agent`, so the `Referer` the browser sends is what identifies the app.
 *
 * Returns "" for anything that fails: a name is a convenience here, and the
 * field is the user's to type either way.
 */
export async function reverseGeocode(
  point: Point,
  signal?: AbortSignal,
): Promise<string> {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(point.latitude),
    lon: String(point.longitude),
    zoom: "18",
    addressdetails: "1",
  });
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${query}`,
      { signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) return "";
    return describe((await response.json()) as NominatimPlace);
  } catch {
    return "";
  }
}

/** The browser's geolocation, promised rather than called back. */
export function locate(options?: PositionOptions): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      reject,
      { timeout: 10000, ...options },
    );
  });
}

/**
 * Whether location is already granted, without asking for it — the web reading
 * of the native picker's rule that opening a map is not itself a reason to
 * prompt. Browsers without the Permissions API report unknown, so they wait for
 * the user to press recentre.
 */
export async function locationGranted() {
  try {
    const status = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    return status?.state === "granted";
  } catch {
    return false;
  }
}
