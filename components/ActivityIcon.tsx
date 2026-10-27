import type { ComponentProps } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const icons: Record<string, ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  Art: "palette-outline",
  Speech: "microphone-outline",
  Basketball: "basketball",
  Volleyball: "volleyball",
  Soccer: "soccer",
  Football: "football",
  Golf: "golf",
  Tennis: "tennis",
  Gym: "dumbbell",
  Running: "run",
  Walk: "walk",
  Study: "book-open-page-variant-outline",
  Food: "silverware-fork-knife",
  FHE: "home-group",
  Party: "party-popper",
  Other: "creation",
};

/** One activity icon across cards, presets, guest lists, and alerts. */
export function ActivityIcon({ activity, size = 22, color }: {
  activity: string;
  size?: number;
  color: string;
}) {
  if (activity !== "Pickleball") {
    return <MaterialCommunityIcons name={icons[activity] || "creation"} size={size} color={color} accessible={false} />;
  }

  // The bundled icon fonts have no pickleball glyph. Draw its rounded paddle
  // and perforated ball with native shapes so it scales on every platform.
  const unit = size / 24;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessible={false}>
      <View style={{ position: "absolute", left: 5 * unit, top: 0, width: 13 * unit, height: 24 * unit, transform: [{ rotate: "-28deg" }] }}>
        <View style={{ width: 13 * unit, height: 16 * unit, borderRadius: 4 * unit, borderWidth: 1.8 * unit, borderColor: color }} />
        <View style={{ position: "absolute", top: 15 * unit, left: 5 * unit, width: 3 * unit, height: 8 * unit, borderRadius: unit, backgroundColor: color }} />
      </View>
      <View style={{ position: "absolute", right: 0, bottom: unit, width: 9 * unit, height: 9 * unit, borderRadius: 4.5 * unit, borderWidth: 1.4 * unit, borderColor: color }}>
        {[[1.3, 1.3], [4.1, 1.3], [1.3, 4.1], [4.1, 4.1]].map(([left, top], index) => (
          <View key={index} style={{ position: "absolute", left: left * unit, top: top * unit, width: 1.2 * unit, height: 1.2 * unit, borderRadius: unit, backgroundColor: color }} />
        ))}
      </View>
    </View>
  );
}
