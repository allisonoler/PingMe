import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Row } from "./ui";
import { loadAttendees, type Attendee } from "../lib/attendees";
import { useAuth } from "../lib/auth";
import { nameOf } from "../lib/identity";
import { activityIcon, type Ping } from "../lib/pings";
import { Avatar } from "./Avatar";
import { colors, hit, radius, space, type } from "../lib/theme";

export function AttendeeSheet({
  ping,
  demoMode,
  onClose,
}: {
  ping: Ping;
  demoMode: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [people, setPeople] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(false);
    try {
      const result = await loadAttendees(ping, demoMode);
      if (request.current === current) setPeople(result);
    } catch {
      if (request.current === current) {
        setError(true);
        setPeople([]);
      }
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [ping, demoMode]);
  useEffect(() => {
    void refresh();
    return () => {
      ++request.current;
    };
  }, [refresh]);
  const currentUser = demoMode ? "demo-you" : session?.user.id;
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close attendee list"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.header}>
            <View style={s.handle} />
            <Row gap={space.md}>
              <View style={s.activity}>
                <Ionicons
                  name={activityIcon(ping.activity)}
                  size={22}
                  color={colors.forest}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={s.title}>
                  Who's coming
                </Text>
                <Text style={s.subtitle}>
                  {ping.activity} · {nameOf(ping.profiles)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close attendee list"
                onPress={onClose}
                style={({ pressed }) => [
                  s.close,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.surface} />
              </Pressable>
            </Row>
          </View>
          <View
            style={[
              s.body,
              { paddingBottom: Math.max(insets.bottom, space.lg) },
            ]}
          >
            {loading && !people.length ? (
              <View style={s.loading}>
                <ActivityIndicator
                  color={colors.green}
                  accessibilityLabel="Loading attendees"
                />
              </View>
            ) : error ? (
              <View style={{ gap: space.md, paddingVertical: space.lg }}>
                <Text style={type.body}>
                  Couldn't load the guest list. Please try again.
                </Text>
                <Button
                  title="Try again"
                  variant="secondary"
                  onPress={refresh}
                />
              </View>
            ) : (
              <FlatList
                data={people}
                keyExtractor={(person) => person.user_id}
                style={{ flexGrow: 0 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={loading}
                    onRefresh={refresh}
                    tintColor={colors.green}
                  />
                }
                ListHeaderComponent={
                  <Row spread style={{ marginBottom: space.sm }}>
                    <Text style={s.count}>
                      {people.length}{" "}
                      {people.length === 1 ? "person" : "people"} going
                    </Text>
                    <Ionicons
                      name="people-outline"
                      size={15}
                      color={colors.muted}
                    />
                  </Row>
                }
                ItemSeparatorComponent={() => <View style={s.separator} />}
                ListEmptyComponent={
                  <View style={s.empty}>
                    <Ionicons
                      name="people-outline"
                      size={26}
                      color={colors.green}
                    />
                    <Text style={type.bodyStrong}>Room for the first yes.</Text>
                    <Text style={[type.small, { textAlign: "center" }]}>
                      No one has joined yet. Be the first to make it a plan.
                    </Text>
                  </View>
                }
                renderItem={({ item, index }) => (
                  <Row gap={space.md} style={s.person}>
                    <Avatar profile={item} index={index} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>
                        {nameOf(item)}
                      </Text>
                      {item.username && item.display_name ? (
                        <Text style={s.username} numberOfLines={1}>
                          @{item.username}
                        </Text>
                      ) : null}
                    </View>
                    {item.user_id === currentUser ? (
                      <View style={s.you}>
                        <Text style={s.youText}>You</Text>
                      </View>
                    ) : null}
                  </Row>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,30,22,0.5)",
  },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    backgroundColor: colors.forest,
    paddingHorizontal: space.xl,
    paddingTop: 10,
    paddingBottom: space.lg,
  },
  handle: {
    width: 30,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: "#6B8470",
    alignSelf: "center",
    marginBottom: space.md,
  },
  activity: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.surface,
  },
  subtitle: { fontSize: 11, lineHeight: 16, color: "#D0DDC6", marginTop: 3 },
  close: {
    width: hit,
    height: hit,
    borderRadius: radius.pill,
    backgroundColor: "#2B4D39",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: space.xl, paddingTop: space.md, flexShrink: 1 },
  count: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.muted,
  },
  person: { minHeight: 58, paddingVertical: space.sm },
  name: { fontSize: 14, lineHeight: 19, fontWeight: "600", color: colors.ink },
  username: { fontSize: 11, lineHeight: 16, color: colors.muted },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
    backgroundColor: colors.line,
  },
  you: {
    backgroundColor: colors.mint,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  youText: { fontSize: 11, fontWeight: "600", color: colors.green },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl },
  loading: { padding: space.xxl, alignItems: "center" },
});
