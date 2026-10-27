import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { authStorage } from "./authStorage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
const clientUrl = url || "https://placeholder.supabase.co";
const clientKey = key || "placeholder-key";
const runtime = globalThis as typeof globalThis & {
  __pingMeSupabase?: { url: string; key: string; client: SupabaseClient; refreshTask?: Promise<void> };
};
// Fast Refresh must not leave multiple native auth clients refreshing the same
// session. Avoid a global cache during server rendering on web.
const cacheClient = Platform.OS !== "web" || typeof window !== "undefined";
const previous = cacheClient ? runtime.__pingMeSupabase : undefined;
const reusable = previous?.url === clientUrl && previous?.key === clientKey;
if (previous && !reusable) {
  void previous.client.auth.stopAutoRefresh().catch((error) => console.warn("Could not stop previous auth refresh", error));
}
export const supabase = reusable ? previous.client : createClient(
  clientUrl,
  clientKey,
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

const clientState = reusable ? previous : { url: clientUrl, key: clientKey, client: supabase, refreshTask: Promise.resolve() };
if (cacheClient) runtime.__pingMeSupabase = clientState;

/** Keep async starts/stops ordered, including across Fast Refresh remounts. */
export function setAuthRefreshActive(active: boolean): Promise<void> {
  const task = (clientState.refreshTask ?? Promise.resolve()).catch(() => {}).then(() =>
    active ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
  );
  clientState.refreshTask = task;
  return task;
}
