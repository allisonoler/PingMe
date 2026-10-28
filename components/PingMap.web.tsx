import { useEffect, useRef } from "react";
import L from "leaflet";
import { colors, radius, type } from "../lib/theme";
import { nameOf } from "../lib/identity";
import { openInMaps, pingCapacity, pingTitle } from "../lib/pings";
import { esc, latLng, pin, tiles, WIDE_CENTER, WIDE_ZOOM } from "./webMap";

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

// The native callout's text styles, as inline CSS. A Leaflet popup is real DOM
// rather than a view tree, so it cannot take a StyleSheet — reading the same
// tokens is what keeps the two maps looking like one app.
const popupCss = {
  title: `margin:0;font-size:14px;line-height:19px;font-weight:700;color:${colors.ink}`,
  meta: `margin:0;font-size:12px;line-height:16px;color:${colors.muted}`,
  link: `margin:0;font-size:13px;line-height:18px;font-weight:600;color:${colors.green};text-decoration:underline`,
  hint: `margin:0;font-size:11px;line-height:15px;color:${colors.muted}`,
};

/**
 * The web map, built on Leaflet over OpenStreetMap tiles.
 *
 * Mirrors the native `PingMap`: the same props, the same green-or-muted pins,
 * and a popup that is a single link to the point in Maps rather than a panel
 * with a link inside it. Leaflet is driven imperatively, so the map is created
 * once and the pins are redrawn as the feed changes under it.
 */
export function PingMap({ pings }: { pings: MapPing[] }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const located = pings.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  // Data can arrive after the map mounts, and a new ping can land in a feed
  // already on screen. Serialising the points is what lets the camera and the
  // pins both follow the feed without refitting on every unrelated re-render.
  const signature = JSON.stringify(
    located.map((p) => [p.id, p.latitude, p.longitude, pingCapacity(p).full]),
  );

  useEffect(() => {
    if (!host.current || map.current) return;
    const instance = L.map(host.current, {
      center: WIDE_CENTER,
      zoom: WIDE_ZOOM,
      // A map inside a scrolling feed should not swallow the page's scroll.
      // Ctrl-scroll still zooms, which is what Leaflet prompts for.
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    tiles().addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const pins = layer.current;
    if (!instance || !pins) return;
    pins.clearLayers();

    for (const p of located) {
      const capacity = pingCapacity(p);
      const point = { latitude: p.latitude!, longitude: p.longitude! };
      const availability =
        capacity.limit === null
          ? null
          : `${capacity.total}/${capacity.limit} going · ${capacity.full ? "Full" : `${capacity.remaining} ${capacity.remaining === 1 ? "spot" : "spots"} left`}`;
      // The host's own words for the place when there are any, so the link
      // reads as the spot rather than as a pair of numbers.
      const address =
        p.location_name?.trim() ||
        p.description?.trim() ||
        `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;

      const body = document.createElement("div");
      body.setAttribute("role", "link");
      body.tabIndex = 0;
      body.setAttribute("aria-label", `Open ${address} in Maps`);
      body.style.cssText =
        `display:flex;flex-direction:column;gap:2px;width:200px;cursor:pointer;outline-offset:3px`;
      body.innerHTML = `
        <p style="${popupCss.title}">${esc(`${pingTitle(p)} · ${nameOf(p.profiles)}`)}</p>
        ${availability ? `<p style="${popupCss.meta}">${esc(availability)}</p>` : ""}
        <p style="${popupCss.link}">${esc(address)}</p>
        <p style="${popupCss.hint}">Click to open in Maps</p>`;
      // The whole popup is the link, as on native, where an Android callout is
      // a flat snapshot that no child view can receive a press through.
      const open = () => openInMaps(point, p.location_name);
      body.addEventListener("click", open);
      body.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });

      L.marker(latLng(point), {
        icon: pin(capacity.full ? colors.muted : colors.green),
        title: `${pingTitle(p)} · ${nameOf(p.profiles)}`,
        alt: `${pingTitle(p)} at ${address}`,
      })
        .bindPopup(body, { closeButton: true, maxWidth: 240 })
        .addTo(pins);
    }

    const points = located.map((p) => latLng({
      latitude: p.latitude!, longitude: p.longitude!,
    }));
    if (!points.length) return;
    if (points.length === 1) {
      instance.setView(points[0], 13);
    } else {
      instance.fitBounds(L.latLngBounds(points), {
        padding: [40, 40],
        animate: false,
      });
    }
    // `located` is rebuilt every render; `signature` is what actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div
      ref={host}
      style={{
        height: 250,
        borderRadius: radius.lg,
        overflow: "hidden",
        // Leaflet's own panes sit at z-index 400+; keeping the map in its own
        // stacking context stops them from rising over the app's sheets.
        isolation: "isolate",
        backgroundColor: colors.surfaceAlt,
        border: `1px solid ${colors.line}`,
        // Matches the muted caption size the rest of the feed uses, so the
        // tile credit does not shout from the corner.
        fontSize: type.small.fontSize,
      }}
      aria-label={
        located.length
          ? `Map of ${located.length} ${located.length === 1 ? "ping" : "pings"}`
          : "Map with no located pings"
      }
    />
  );
}

