import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { nameOf, type IdentityProfile } from "../lib/identity";
import { avatarTones } from "../lib/theme";

export function Avatar({
  profile,
  index = 0,
  size = 34,
  style,
}: {
  profile?: IdentityProfile | null;
  index?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = avatarTones[index % avatarTones.length];
  const initials = nameOf(profile)
    .replace(/^@/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          backgroundColor: tone.background,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.33),
          fontWeight: "700",
          color: tone.ink,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
