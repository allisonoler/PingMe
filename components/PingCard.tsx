import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Identity, Row } from "./ui";
import { colors, radius, space, type } from "../lib/theme";
import { nameOf } from "../lib/identity";
import { activityIcon, timeLeft, type Ping } from "../lib/pings";

export function PingCard({
  ping: p,
  now,
  busy,
  onRespond,
  onEdit,
  onCancel,
}: {
  ping: Ping;
  now: number;
  busy: boolean;
  onRespond: () => void;
  onEdit: () => void;
  onCancel: () => void;
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
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
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
  return (
    <Card>
      <Row spread style={{ flexWrap: "wrap", rowGap: space.sm }}>
        <Row
          style={{
            backgroundColor: colors.mint,
            borderRadius: radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Ionicons
            name={activityIcon(p.activity)}
            size={17}
            color={colors.green}
          />
          <Text
            style={[type.small, { color: colors.green, fontWeight: "700" }]}
          >
            {p.activity}
          </Text>
        </Row>
        <Row gap={4}>
          <Ionicons name="time-outline" size={14} color={colors.muted} />
          <Text style={type.small}>{timeLeft(p.expires_at, now)}</Text>
        </Row>
      </Row>
      <Identity
        profile={p.profiles}
        size="title"
        style={{ marginTop: space.lg }}
      />
      {p.description ? (
        <Text style={[type.body, { marginTop: space.sm }]}>
          {p.description}
        </Text>
      ) : null}
      <Row gap={space.xs} style={{ marginTop: space.md }}>
        <Ionicons name="location-outline" size={15} color={colors.muted} />
        <Text style={[type.small, { flex: 1 }]}>
          {p.location_name || "Ask your friend for the spot"}
        </Text>
      </Row>
      {p.is_own && p.ping_acceptances?.length ? (
        <Text
          style={[type.small, { color: colors.green, marginTop: space.sm }]}
        >
          Going:{" "}
          {p.ping_acceptances
            .map((person) => nameOf(person.profiles))
            .join(", ")}
        </Text>
      ) : null}
      <View
        style={{
          height: 1,
          backgroundColor: colors.line,
          marginVertical: space.lg,
        }}
      />
      <Row spread style={{ flexWrap: "wrap", rowGap: space.md }}>
        <Row gap={space.sm} accessibilityLabel={`${count} going`}>
          {people.length ? (
            <Row gap={0}>
              {people.map((person, index) => (
                <View
                  key={person.user_id}
                  style={{
                    width: 29,
                    height: 29,
                    borderRadius: 15,
                    marginLeft: index ? -7 : 0,
                    borderWidth: 2,
                    borderColor: colors.white,
                    backgroundColor: index % 2 ? "#E8EDF7" : colors.mint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: colors.ink,
                    }}
                  >
                    {nameOf(person.profiles)
                      .replace(/^@/, "")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase()}
                  </Text>
                </View>
              ))}
            </Row>
          ) : (
            <Ionicons name="people-outline" size={18} color={colors.muted} />
          )}
          <Text style={[type.small, { fontWeight: "600" }]}>
            {count ? `${count} going` : "Be the first"}
          </Text>
        </Row>
        {p.is_own ? (
          <Row>
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
              title={p.accepted ? "You're going" : "I'm in"}
              icon={p.accepted ? "checkmark-circle" : "add"}
              variant={p.accepted ? "secondary" : "primary"}
              compact
              onPress={onRespond}
              disabled={busy}
            />
          </Animated.View>
        )}
      </Row>
    </Card>
  );
}
