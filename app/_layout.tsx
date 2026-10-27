import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { colors } from "../lib/theme";
import { DemoProvider } from "../lib/demo";
import { IncomingPingAlerts } from "../components/IncomingPingAlerts";
import { PushSetup } from "../lib/push";

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DemoProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          />
          <PushSetup />
          <IncomingPingAlerts />
        </DemoProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
