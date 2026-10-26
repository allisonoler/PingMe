import { Text } from "react-native";
import { Card } from "./ui";
import { type } from "../lib/theme";

// Web stub: react-native-maps ships Fabric native specs that crash on import under react-native-web.
export function PingMap(_props: { pings: unknown[] }) {
  return (
    <Card>
      <Text style={type.body}>
        Map view is available in the iOS and Android apps.
      </Text>
    </Card>
  );
}
