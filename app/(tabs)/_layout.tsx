import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space } from "../../lib/theme";

type IconPair = {
  on: keyof typeof Ionicons.glyphMap;
  off: keyof typeof Ionicons.glyphMap;
};

const icons: Record<string, IconPair> = {
  home: { on: "radio", off: "radio-outline" },
  friends: { on: "people", off: "people-outline" },
  create: { on: "add-circle", off: "add-circle-outline" },
  settings: { on: "settings", off: "settings-outline" },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        // Height is left to react-navigation so it can add the home-indicator
        // inset; hardcoding it previously overrode that.
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
          paddingTop: space.xs,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 0.2,
        },
        tabBarIcon: ({ color, focused }) => {
          const pair = icons[route.name];
          return (
            <Ionicons
              name={pair ? (focused ? pair.on : pair.off) : "ellipse-outline"}
              size={22}
              color={color as string}
            />
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Pings" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="create" options={{ title: "New ping" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
