import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui";
import { colors, radius, space, type } from "../lib/theme";

/** Mounted only after saving succeeds; closing it returns to the feed. */
export function PingSent({ demoMode, onDone }: { demoMode: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(onDone, 1800);
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => true).then((reduce) => {
      if (!active) return;
      if (reduce) {
        progress.setValue(1);
        pop.setValue(1);
        return;
      }
      const useNativeDriver = Platform.OS !== "web";
      animation = Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver }),
        Animated.spring(pop, { toValue: 1, friction: 7, tension: 100, useNativeDriver }),
      ]);
      animation.start();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      animation?.stop();
    };
  }, [onDone, pop, progress]);

  return (
    <Modal transparent animationType="none" onRequestClose={onDone} statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={s.card} accessibilityViewIsModal>
          <View style={s.signal} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[0, 1].map((index) => (
              <Animated.View key={index} style={[s.ring, {
                opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] }),
                transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.7 + index * 0.65] }) }],
              }]} />
            ))}
            <Animated.View style={[s.icon, {
              opacity: pop,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
            }]}>
              <Ionicons name="radio" size={36} color={colors.lime} />
              <View style={s.check}><Ionicons name="checkmark" size={15} color={colors.forest} /></View>
            </Animated.View>
          </View>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[type.display, s.center]}>
            {demoMode ? "Demo ping is ready" : "Your ping is out"}
          </Text>
          <Text style={[type.subtitle, s.center]}>
            {demoMode ? "Your plan is in the demo feed." : "Your plan is shared with friends. Let the hangout begin."}
          </Text>
          <Button title="See pings" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(24,46,37,0.45)", justifyContent: "center", padding: space.xxl },
  card: { alignSelf: "center", width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xxl, gap: space.lg },
  center: { textAlign: "center" },
  signal: { height: 150, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.green },
  icon: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" },
  check: { position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.lime, borderWidth: 3, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
