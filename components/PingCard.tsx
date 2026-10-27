import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Row } from "./ui";
import { activityTone, colors, hit, space } from "../lib/theme";
import { Avatar } from "./Avatar";
import { Contributions } from "./Contributions";
import { nameOf } from "../lib/identity";
import { activityIcon, pingTimeRange, pingTimeStatus, type Ping } from "../lib/pings";

export function PingCard({
  ping: p,
  now,
  busy,
  onRespond,
  onEdit,
  onCancel,
  onShowAttendees,
  currentUser,
  onClaim,
}: {
  ping: Ping;
  now: number;
  busy: boolean;
  onRespond: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onShowAttendees: () => void;
  currentUser?: string;
  onClaim: (label: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useRef(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) reducedMotion.current = value;
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        reducedMotion.current = value;
      },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!p.accepted || reducedMotion.current) return;
    const animation = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 130,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      scale.setValue(1);
    };
  }, [p.accepted, scale]);
  const people = p.ping_acceptances?.slice(0, 3) || [];
  const count = p.acceptance_count || 0;
  const tone = activityTone(p.activity);
  const timeRange = pingTimeRange(p, now);
  return (
    <View style={s.card}>
      <View style={s.content}>
        <Row spread gap={space.sm} style={{ alignItems: "flex-start" }}>
          <Row gap={space.md} style={{ flex: 1 }}>
            <View style={[s.activity, { backgroundColor: tone.background }]}>
              <Ionicons
                name={activityIcon(p.activity)}
                size={22}
                color={tone.ink}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{p.activity}</Text>
              <Text style={s.host} numberOfLines={1}>
                {nameOf(p.profiles)}
                {p.is_own ? " · Your ping" : ""}
              </Text>
            </View>
          </Row>
          <View style={s.expiry}>
            <Text style={s.expiryText}>{pingTimeStatus(p, now)}</Text>
          </View>
        </Row>
        {timeRange ? (
          <Row gap={5} style={{ alignItems: "flex-start" }}>
            <Ionicons name="time-outline" size={15} color={colors.green} style={{ marginTop: 2 }} />
            <Text style={s.schedule}>{timeRange}</Text>
          </Row>
        ) : null}
        {p.description ? (
          <Text style={s.description}>{p.description}</Text>
        ) : null}
        <Row gap={5}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text style={s.location}>
            {p.location_name || "Ask your friend for the spot"}
          </Text>
        </Row>
        <Contributions ping={p} currentUser={currentUser} busy={busy} onClaim={onClaim} />
      </View>
      <Row spread gap={space.sm} style={s.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See who's coming, ${count} going`}
          onPress={onShowAttendees}
          style={({ pressed }) => ({
            minHeight: hit,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Row gap={space.sm}>
            {people.length ? (
              <Row gap={0}>
                {people.map((person, index) => (
                  <Avatar
                    key={person.user_id}
                    profile={person.profiles}
                    index={index}
                    size={26}
                    style={{
                      marginLeft: index ? -5 : 0,
                      borderWidth: 2,
                      borderColor: colors.surfaceAlt,
                    }}
                  />
                ))}
              </Row>
            ) : (
              <Ionicons name="people-outline" size={18} color={colors.green} />
            )}
            <Text style={s.attendees}>
              {count ? `${count} going` : "Be the first"}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={colors.green} />
          </Row>
        </Pressable>
        {p.is_own ? (
          <Row gap={space.xs}>
            <Button
              title="Edit"
              variant="secondary"
              compact
              onPress={onEdit}
              disabled={busy}
            />
            <Button
              title="Cancel"
              variant="secondary"
              compact
              onPress={onCancel}
              disabled={busy}
            />
          </Row>
        ) : (
          <Animated.View style={{ transform: [{ scale }] }}>
            <Button
              title={p.accepted ? "Going" : "I'm in"}
              icon={p.accepted ? "checkmark-circle" : "add"}
              variant={p.accepted ? "secondary" : "primary"}
              compact
              onPress={onRespond}
              disabled={busy}
            />
          </Animated.View>
        )}
      </Row>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: "hidden",
  },
  content: { padding: space.lg, gap: space.md },
  activity: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  host: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 1 },
  expiry: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
  },
  expiryText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  description: { fontSize: 14, lineHeight: 20, color: colors.ink },
  schedule: { fontSize: 13, lineHeight: 19, fontWeight: "600", color: colors.green, flex: 1 },
  location: { fontSize: 12, lineHeight: 17, color: colors.muted, flex: 1 },
  footer: {
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    flexWrap: "wrap",
    rowGap: space.xs,
  },
  attendees: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.green,
  },
});
