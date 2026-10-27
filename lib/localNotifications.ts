import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { IosAuthorizationStatus } from "expo-notifications/build/NotificationPermissions.types";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";

export async function scheduleDemoPing(): Promise<void> {
  if (Platform.OS === "web")
    throw new Error("Open PingMe on your phone to try a local notification.");

  const requiredModules = [
    "ExpoNotificationPermissionsModule",
    "ExpoNotificationScheduler",
    "ExpoNotificationsHandlerModule",
  ];
  if (requiredModules.some((name) => !requireOptionalNativeModule(name)))
    throw new Error(
      "This app is missing local notification support. Update Expo Go to a compatible version, or rebuild and reinstall PingMe.",
    );

  // SDK 58's package entry point also loads remote-push modules that Expo Go
  // may not contain. Keep this demo limited to the local notification APIs.
  const [permissions, scheduler, handler] = await Promise.all([
    import("expo-notifications/build/NotificationPermissions"),
    import("expo-notifications/build/scheduleNotificationAsync"),
    import("expo-notifications/build/NotificationsHandler"),
  ]);

  const allowed = (
    permission: Awaited<ReturnType<typeof permissions.getPermissionsAsync>>,
  ) =>
    permission.granted ||
    permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  let permission = await permissions.getPermissionsAsync();
  if (!allowed(permission) && permission.canAskAgain)
    permission = await permissions.requestPermissionsAsync();
  if (!allowed(permission))
    throw new Error(
      "Allow notifications for PingMe or Expo Go in your phone settings, then try again.",
    );

  handler.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

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
