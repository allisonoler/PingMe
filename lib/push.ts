import { useEffect } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { router } from "expo-router";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { useAuth } from "./auth";
import { authStorage } from "./authStorage";
import { supabase } from "./supabase";
import { colors } from "./theme";

/**
 * Remote push lives behind the same defensive loading as the local demo: the JS
 * package can be newer than the installed native app, and Expo Go ships none of
 * these modules at all. Every entry point here degrades to a no-op rather than
 * throwing, because a missing notification is never worth crashing a screen.
 */

/** Must match the `channelId` that the notify-ping function sends. */
export const PINGS_CHANNEL_ID = "pings";

function hasModules(...names: string[]): boolean {
  return (
    Platform.OS !== "web" &&
    names.every((name) => !!requireOptionalNativeModule(name))
  );
}

/**
 * This device's Expo push token, or the reason there isn't one. A switch has to
 * show the current state before anyone touches it, so this runs on load too —
 * hence `prompt`: only the switch may raise the OS permission dialog, never a
 * screen that is merely being looked at.
 */
export async function resolvePushToken(
  prompt: boolean,
): Promise<{ token: string } | { problem: string }> {
  if (!Device.isDevice)
    return {
      problem:
        "Push notifications require a physical device and an EAS development or production build.",
    };
  if (
    Constants.executionEnvironment === "storeClient" ||
    Constants.appOwnership === "expo" ||
    requireOptionalNativeModule("ExpoGo")
  )
    return {
      problem:
        "Remote push needs a PingMe development or production build. For the local demo, tap Send demo ping below.",
    };
  // The JS package can be newer than the installed native app. Check before
  // importing any notification code.
  if (
    !hasModules(
      "ExpoPushTokenManager",
      "ExpoNotificationPermissionsModule",
      "NotificationsServerRegistrationModule",
    )
  )
    return {
      problem:
        "This build does not include the required notification modules. Rebuild and reinstall PingMe to enable push notifications.",
    };
  try {
    // Avoid the package entry point: it eagerly loads unrelated native modules
    // and can leave partially initialized exports after a failed import.
    const permissions = await import(
      "expo-notifications/build/NotificationPermissions"
    );
    if (
      typeof permissions.getPermissionsAsync !== "function" ||
      typeof permissions.requestPermissionsAsync !== "function"
    )
      return {
        problem:
          "Notification support did not load. Fully close and reopen PingMe, then try Send demo ping for the local demo.",
      };
    // Android 13+ only shows the POST_NOTIFICATIONS prompt once the channel is
    // in place, and a token is useless without somewhere to deliver it.
    await ensurePingsChannel();
    let status = (await permissions.getPermissionsAsync()).status;
    if (status !== "granted" && prompt)
      status = (await permissions.requestPermissionsAsync()).status;
    if (status !== "granted")
      return {
        problem: "Enable notifications for PingMe in your device settings.",
      };
    const projectId =
      Constants.easConfig?.projectId ||
      Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId)
      return {
        problem:
          "Set your EAS project ID in app.json before registering this device.",
      };
    const { getExpoPushTokenAsync } = await import(
      "expo-notifications/build/getExpoPushTokenAsync"
    );
    return { token: (await getExpoPushTokenAsync({ projectId })).data };
  } catch (error) {
    return {
      problem:
        error instanceof Error
          ? error.message
          : "Use an EAS development build to enable remote notifications.",
    };
  }
}

/**
 * Android 8+ drops any notification addressed to a channel that does not exist,
 * so this has to run before the first push arrives — not when Settings is
 * opened, which a friend who only ever receives pings may never do.
 */
export async function ensurePingsChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!hasModules("ExpoNotificationChannelManager")) return;
  try {
    const { setNotificationChannelAsync } = await import(
      "expo-notifications/build/setNotificationChannelAsync"
    );
    await setNotificationChannelAsync(PINGS_CHANNEL_ID, {
      name: "Friend pings",
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.green,
    });
  } catch {
    // An un-created channel costs delivery on Android, but it must never stop
    // the app from starting.
  }
}

/**
 * Turning the Settings switch off deletes the device row, so without a record
 * of that choice the next launch would silently re-register and the switch
 * would not stick. The flag is per-device, which is exactly the scope of the
 * switch itself.
 */
const OPT_OUT_KEY = "pingme.push.optOut";

export function setPushOptOut(optedOut: boolean): void {
  try {
    if (optedOut) authStorage.setItem(OPT_OUT_KEY, "1");
    else authStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage is best-effort; a lost flag only costs a re-registration.
  }
}

/**
 * Read by the local fallback too: turning the switch off is a decision about
 * notifications, not about the transport that happens to carry them.
 */
export function pushOptedOut(): boolean {
  try {
    return authStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Registers this device for the signed-in user, quietly. Settings keeps the
 * explicit switch for turning push back off; this only covers the common case
 * of someone who granted permission once and would never think to re-opt in.
 */
export async function registerPushDevice(userId: string): Promise<void> {
  if (pushOptedOut()) return;
  const setup = await resolvePushToken(false);
  if ("problem" in setup) return;
  await supabase.from("push_devices").upsert(
    {
      user_id: userId,
      token: setup.token,
      platform: Device.osName === "iOS" ? "ios" : "android",
    },
    { onConflict: "token" },
  );
}

/**
 * Foreground display plus tap routing. Pushes carry `pingId`, but `/ping/[id]`
 * is the creator-only edit screen, so a recipient goes to the feed — the same
 * place the in-app banner sends them.
 */
export function useNotificationRouting(): void {
  useEffect(() => {
    if (!hasModules("ExpoNotificationsEmitter", "ExpoNotificationsHandlerModule"))
      return;
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;
    (async () => {
      try {
        await ensurePingsChannel();
        const [handler, emitter] = await Promise.all([
          import("expo-notifications/build/NotificationsHandler"),
          import("expo-notifications/build/NotificationsEmitter"),
        ]);
        if (cancelled) return;
        handler.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        subscription = emitter.addNotificationResponseReceivedListener(
          (response) => {
            const { pingId } =
              response.notification.request.content.data ?? {};
            if (typeof pingId === "string") router.push("/home");
          },
        );
      } catch {
        // Leaves pushes delivered but silent in the foreground; still better
        // than an unhandled rejection at the root of the tree.
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
}

/**
 * Mounted once under the providers: creates the channel, handles foreground
 * display and taps, and keeps this device's token registered for whoever is
 * signed in. Renders nothing.
 */
export function PushSetup(): null {
  const { session, configured } = useAuth();
  const userId = session?.user.id;
  useNotificationRouting();
  useEffect(() => {
    if (!userId || !configured) return;
    void registerPushDevice(userId);
  }, [userId, configured]);
  return null;
}
