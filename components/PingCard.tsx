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
import { activityTone, colors, hit, space, type } from "../lib/theme";
import { Avatar } from "./Avatar";
import { Contributions } from "./Contributions";
import { ActivityIcon } from "./ActivityIcon";
import { nameOf } from "../lib/identity";
import { openInMaps, pingCapacity, pingTitle, pingTimeRange, pingTimeStatus, pointOf, type Ping } from "../lib/pings";

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
  onShowUpdates,
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
  onShowUpdates: () => void;
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
  const capacity = pingCapacity(p);
  const count = capacity.total;
  const tone = activityTone(p.activity);
  const timeRange = pingTimeRange(p, now);
  const point = pointOf(p);
  // The badge is a clock icon plus a bare duration, so the spoken label says
  // what that duration measures.
  const expiry = pingTimeStatus(p, now);
  const expiryLabel = /^(Ended|Starts in)/.test(expiry)
    ? expiry
    : `${expiry} left`;

  return (
    <View style={s.card}>
      <View style={s.content}>
        <Row spread gap={space.sm}>
          <Row gap={space.md} style={{ flex: 1, minWidth: 0 }}>
            <View style={[s.activity, { backgroundColor: tone.background }]}>
              <ActivityIcon
                activity={p.activity}
                size={22}
                color={tone.ink}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {p.title?.trim() ? <Text style={s.category} numberOfLines={1}>{p.activity}</Text> : null}
              <Text style={s.host} numberOfLines={1}>
                {p.is_own ? "You · Hosting" : nameOf(p.profiles)}
              </Text>
            </View>
          </Row>
          <View style={s.expiry} accessible accessibilityLabel={expiryLabel}>
            <Ionicons name="time-outline" size={11} color={colors.muted} />
            <Text style={s.expiryText}>{expiry}</Text>
          </View>
        </Row>
        <Text style={s.title}>{pingTitle(p)}</Text>
        {timeRange ? (
          <Row gap={5} style={{ alignItems: "flex-start" }}>
            <Ionicons name="calendar-outline" size={15} color={colors.green} style={{ marginTop: 2 }} />
            <Text style={s.schedule}>{timeRange}</Text>
          </Row>
        ) : null}
        {capacity.limit !== null ? (
          <View style={{ alignSelf: "flex-start", backgroundColor: capacity.full ? colors.mint : colors.surfaceAlt, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: 6 }}>
            <Text style={{ color: colors.green, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>
              {capacity.full ? "Full" : `${capacity.remaining} ${capacity.remaining === 1 ? "spot" : "spots"} left`}
              {p.accepted ? " · You’re going" : ""}
            </Text>
          </View>
        ) : null}
        {p.description ? (
          <Text style={s.description}>{p.description}</Text>
        ) : null}
        {point ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${p.location_name || "the spot"} in Maps`}
            onPress={() => point && openInMaps(point, p.location_name)}
            hitSlop={space.sm}
            style={({ pressed }) => [s.locationRow, pressed && { opacity: 0.55 }]}
          >
            <Ionicons name="location" size={13} color={colors.green} />
            <Text style={s.locationLink} numberOfLines={1}>
              {p.location_name || "See the spot"}
            </Text>
            <Ionicons name="open-outline" size={12} color={colors.green} />
          </Pressable>
        ) : p.location_name ? (
          <Row gap={5}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <Text style={s.location}>{p.location_name}</Text>
          </Row>
        ) : null}
        <Contributions ping={p} currentUser={currentUser} busy={busy} onClaim={onClaim} />
        <Pressable accessibilityRole="button" accessibilityLabel={`View updates for ${pingTitle(p)}`} onPress={onShowUpdates} style={({ pressed }) => ({ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md, gap: space.xs, minHeight: hit, opacity: pressed ? 0.6 : 1 })}>
          <Row spread>
            <Row><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.green} /><Text style={type.fieldLabel}>Updates</Text></Row>
            <Ionicons name="chevron-forward" size={14} color={colors.green} />
          </Row>
          {p.updates_unavailable ? <Text style={type.small}>Refresh to load updates.</Text> : p.updates?.[0] ? <Text numberOfLines={2} style={type.small}>{nameOf(p.updates[0])}: {p.updates[0].body}</Text> : null}
        </Pressable>
      </View>
      <Row spread gap={space.sm} style={s.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See who's coming, ${count}${capacity.limit !== null ? ` of ${capacity.limit}` : ""} going, including the host`}
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
              {capacity.limit !== null ? `${count}/${capacity.limit} going` : `${count} going`}
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
              title={p.accepted ? "Leave" : capacity.full ? "Full" : "I'm in"}
              icon={p.accepted ? "exit-outline" : capacity.full ? "people" : "add"}
              variant={p.accepted ? "secondary" : "primary"}
              compact
              onPress={onRespond}
              disabled={busy || (!p.accepted && capacity.full)}
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
    flexShrink: 0,
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.ink,
  },
  category: { fontSize: 12, lineHeight: 17, fontWeight: "600", color: colors.ink },
  host: { fontSize: 12, lineHeight: 17, color: colors.muted },
  expiry: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
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
  // The plain row is one line of muted text, so the tappable version carries
  // the vertical padding it needs to be a real target on its own.
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: space.xs,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  // Stated in full rather than layered over `location`, whose `flex: 1` sets a
  // zero basis: shrinking that back down without growth would collapse the text
  // to no width at all.
  locationLink: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.green,
    fontWeight: "700",
    flexShrink: 1,
  },
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
