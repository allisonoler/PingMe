import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space } from "../../lib/theme";
import { useDemo } from "../../lib/demo";
import { TextAction } from "../../components/ui";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  const { demoMode, setDemoMode } = useDemo();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      {demoMode ? (
        <View
          style={{
            backgroundColor: colors.canvas,
            paddingHorizontal: space.xl,
            paddingTop: insets.top + space.sm,
            paddingBottom: space.xs,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.sm,
          }}
        >
          <Text
            style={{
              color: colors.green,
              fontSize: 10,
              fontWeight: "600",
              letterSpacing: 0.5,
              flex: 1,
            }}
          >
            DEMO · Sample campus plans
          </Text>
          <TextAction
            label="Exit"
            onPress={() => {
              setDemoMode(false);
              router.replace(session ? "/home" : "/signin");
            }}
          />
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider
        value={{ ...insets, top: demoMode ? 0 : insets.top }}
      >
        <Tabs
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.green,
            tabBarInactiveTintColor: colors.muted,
            // Height is left to react-navigation so it can add the home-indicator
            // inset; hardcoding it previously overrode that.
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.line,
              paddingTop: space.xs,
              ...(Platform.OS === "web"
                ? { height: 60, paddingBottom: space.sm }
                : {}),
            },
            tabBarLabelStyle: {
              fontSize: 11,
              lineHeight: 14,
              fontWeight: "600",
              letterSpacing: 0.2,
            },
            tabBarIcon: ({ color, focused }) => {
              const pair = icons[route.name];
              return (
                <Ionicons
                  name={
                    pair ? (focused ? pair.on : pair.off) : "ellipse-outline"
                  }
                  size={22}
                  color={color as string}
                />
              );
            },
          })}
        >
          <Tabs.Screen name="home" options={{ title: "Pings" }} />
          <Tabs.Screen name="create" options={{ title: "New ping" }} />
          <Tabs.Screen name="friends" options={{ title: "Friends" }} />
          <Tabs.Screen name="settings" options={{ title: "Settings" }} />
        </Tabs>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
