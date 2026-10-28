import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { IosAuthorizationStatus } from "expo-notifications/build/NotificationPermissions.types";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";
import { pushOptedOut, resolvePushToken } from "./push";

/**
 * Local notifications are the half of expo-notifications that Expo Go still
 * ships: remote push was removed from Expo Go in SDK 53, but scheduling a
 * notification on the device you are already running on never left. That makes
 * this the only way a ping can reach the tray without an EAS build.
 */

/** Scheduling needs all three; a build missing any of them gets no tray entry. */
const LOCAL_MODULES = [
  "ExpoNotificationPermissionsModule",
  "ExpoNotificationScheduler",
  "ExpoNotificationsHandlerModule",
];

function hasLocalModules(): boolean {
  return (
    Platform.OS !== "web" &&
    LOCAL_MODULES.every((name) => !!requireOptionalNativeModule(name))
  );
}

type PermissionState = "granted" | "denied" | "unavailable";

/**
 * SDK 58's package entry point also loads remote-push modules that Expo Go does
 * not contain, so every import here names a single build file instead.
 */
async function localPermission(prompt: boolean): Promise<PermissionState> {
  if (!hasLocalModules()) return "unavailable";
  try {
    const permissions = await import(
      "expo-notifications/build/NotificationPermissions"
    );
    const allowed = (
      permission: Awaited<ReturnType<typeof permissions.getPermissionsAsync>>,
    ) =>
      permission.granted ||
      permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    let permission = await permissions.getPermissionsAsync();
    if (!allowed(permission) && prompt && permission.canAskAgain)
      permission = await permissions.requestPermissionsAsync();
    return allowed(permission) ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

async function setForegroundHandler(): Promise<void> {
  const handler = await import("expo-notifications/build/NotificationsHandler");
  handler.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function scheduleDemoPing(): Promise<void> {
  if (Platform.OS === "web")
    throw new Error("Open PingMe on your phone to try a local notification.");
  if (!hasLocalModules())
    throw new Error(
      "This app is missing local notification support. Update Expo Go to a compatible version, or rebuild and reinstall PingMe.",
    );
  const permission = await localPermission(true);
  if (permission === "unavailable")
    throw new Error(
      "Notification support did not load. Fully close and reopen PingMe, then try again.",
    );
  if (permission !== "granted")
    throw new Error(
      "Allow notifications for PingMe or Expo Go in your phone settings, then try again.",
    );

  await setForegroundHandler();
  const scheduler = await import(
    "expo-notifications/build/scheduleNotificationAsync"
  );
  await scheduler.scheduleNotificationAsync({
    identifier: "pingme-demo",
    content: {
      title: "Who's up for pickleball? 🏓",
      body: "Meet at the courts in 10 minutes? Open PingMe to make a plan.",
      sound: "default",
      data: { demo: true },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
      repeats: false,
      // Without a channel ID, Expo creates/uses its default high-importance
      // channel. Avoid the custom-channel API, which fails in this Expo Go build.
    },
  });
}

/**
 * Whether a friend's ping needs to be raised locally. A build that can hold an
 * Expo push token already gets the real thing from notify-ping, and firing a
 * local copy beside it would show every ping twice. Someone who turned the
 * Settings switch off asked for neither.
 */
async function needsLocalFallback(): Promise<boolean> {
  if (pushOptedOut()) return false;
  return "problem" in (await resolvePushToken(false));
}

/**
 * Asked for once per launch, from the foreground, and only where the fallback
 * is the only delivery there is: a permission dialog cannot be shown from the
 * background, so waiting until the first ping arrives would be waiting forever.
 * Builds with working remote push keep the explicit Settings switch instead.
 */
let permissionAsked = false;

export async function ensureIncomingPingNotifications(): Promise<void> {
  if (permissionAsked || !hasLocalModules()) return;
  permissionAsked = true;
  try {
    if (!(await needsLocalFallback())) return;
    await localPermission(true);
  } catch {
    // Nothing here is worth interrupting a screen that is merely being opened.
  }
}

/**
 * Puts a friend's ping in the tray from the device that received the Realtime
 * event, for the stretch where the app is backgrounded but its JavaScript is
 * still alive. Once the OS suspends the process the websocket goes with it, so
 * this reaches further than the in-app banner but is not remote push.
 */
export async function notifyIncomingPing(ping: {
  id: string;
  title: string;
  body: string;
}): Promise<void> {
  try {
    if (!(await needsLocalFallback())) return;
    // Never prompt from here: this runs while the app is out of the foreground.
    if ((await localPermission(false)) !== "granted") return;
    const scheduler = await import(
      "expo-notifications/build/scheduleNotificationAsync"
    );
    await scheduler.scheduleNotificationAsync({
      // Re-scheduling one ping replaces its notification rather than stacking a
      // duplicate, should a Realtime reconnect replay the insert.
      identifier: `pingme-ping-${ping.id}`,
      content: {
        title: ping.title,
        body: ping.body,
        sound: "default",
        // Matches the remote payload, so the tap listener in push.ts routes
        // both kinds of notification the same way.
        data: { pingId: ping.id },
      },
      trigger: null,
    });
  } catch {
    // A missed notification is never worth an unhandled rejection in a listener.
  }
}
