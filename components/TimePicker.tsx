import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, type } from "../lib/theme";

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

/** Times are held as minutes since midnight, so arithmetic needs no Date. */
export const MINUTE_STEP = 5;
const DAY = 24 * 60;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const PERIODS = [0, 1]; // 0 = AM, 1 = PM

// How many times a circular column's list is laid end to end so it can be
// scrolled past its "end" and land back at the start. Odd, so there is a middle
// copy to rest in with equal spare copies buffering either side — enough that a
// flick, or several before the silent recenter catches up, cannot run a short
// list off the edge.
const REPEAT = 9;

/** "9:05 AM", the form every time in the app reads as. */
export function formatTimeLabel(minutes: number) {
  const m = ((minutes % DAY) + DAY) % DAY;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Minutes since midnight for `date`, rounded up to the next step. */
export function roundUpToStep(date: Date, step = MINUTE_STEP) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return (Math.ceil(mins / step) * step) % DAY;
}

export function addMinutes(minutes: number, delta: number) {
  return (((minutes + delta) % DAY) + DAY) % DAY;
}

/** How long from `from` to `to`, counting past midnight if it has to. */
export function minutesBetween(from: number, to: number) {
  return (((to - from) % DAY) + DAY) % DAY;
}

interface WheelProps {
  items: number[];
  /** Index into `items` of the value showing, not the value itself. */
  index: number;
  renderLabel: (item: number) => string;
  onSettle: (item: number) => void;
  /** Wraps past either end — hour and minute, but not AM/PM. */
  circular?: boolean;
}

// One spinning column. Uncontrolled while a finger is on it — a prop update
// mid-drag would fight the gesture — and only re-synced from `index` once the
// drag and its momentum have finished.
//
// A circular column renders `items` repeated REPEAT times and always settles
// back onto the middle copy. The repeats either side are what let a flick cross
// the seam (55 -> 0, or 12 -> 1) instead of thudding into a hard stop; the
// recenter is a plain jump onto a row showing the same value, so it reads as
// having kept spinning rather than as a reset.
function Wheel({ items, index, renderLabel, onSettle, circular }: WheelProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const isTouching = useRef(false);
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recenterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMount = useRef(false);
  const middleStart = circular ? Math.floor(REPEAT / 2) * items.length : 0;
  const displayItems = useMemo(
    () =>
      circular ? Array.from({ length: REPEAT }, () => items).flat() : items,
    [items, circular],
  );

  useEffect(() => {
    if (isTouching.current) return;
    scrollRef.current?.scrollTo({
      y: (middleStart + index) * ITEM_HEIGHT,
      animated: didMount.current,
    });
    didMount.current = true;
    // Only the first render and changes from outside should move the wheel;
    // re-running on every render would fight the user's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(
    () => () => {
      if (dragTimer.current) clearTimeout(dragTimer.current);
      if (recenterTimer.current) clearTimeout(recenterTimer.current);
    },
    [],
  );

  const settleAt = useCallback(
    (y: number) => {
      isTouching.current = false;
      const rawIdx = Math.max(
        0,
        Math.min(displayItems.length - 1, Math.round(y / ITEM_HEIGHT)),
      );
      const logical = ((rawIdx % items.length) + items.length) % items.length;
      scrollRef.current?.scrollTo({ y: rawIdx * ITEM_HEIGHT, animated: true });
      if (logical !== index) onSettle(items[logical]);

      if (circular) {
        const canonicalIdx = middleStart + logical;
        if (canonicalIdx !== rawIdx) {
          // Waits out the snap above so it is not cut short. The jump itself is
          // instant, onto a row holding the value the snap was headed for.
          recenterTimer.current = setTimeout(() => {
            if (isTouching.current) return;
            scrollRef.current?.scrollTo({
              y: canonicalIdx * ITEM_HEIGHT,
              animated: false,
            });
          }, 300);
        }
      }
    },
    [items, index, onSettle, circular, middleStart, displayItems.length],
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={s.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: PAD }}
      onScrollBeginDrag={() => {
        isTouching.current = true;
        if (dragTimer.current) clearTimeout(dragTimer.current);
        if (recenterTimer.current) clearTimeout(recenterTimer.current);
      }}
      onScrollEndDrag={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        // A release with no flick behind it never starts momentum, so nothing
        // would commit. The timer covers that; momentum beginning cancels it.
        const y = e.nativeEvent.contentOffset.y;
        dragTimer.current = setTimeout(() => settleAt(y), 120);
      }}
      onMomentumScrollBegin={() => {
        if (dragTimer.current) clearTimeout(dragTimer.current);
      }}
      onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
        settleAt(e.nativeEvent.contentOffset.y)
      }
    >
      {displayItems.map((item, i) => (
        <View key={i} style={s.item}>
          <Text
            style={[s.itemText, i % items.length === index && s.itemSelected]}
          >
            {renderLabel(item)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * The classic spinner: hour, minute in 5-minute steps, and AM/PM. Hour and
 * minute wrap continuously (55 rolls to 0, 12 rolls to 1); AM/PM is only ever
 * the two values, so it stays a bounded column. Each column commits on its own
 * the moment it settles, so there is no separate "Done" — closing the panel is
 * the caller's job.
 */
export function TimeWheels({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 || 12;
  const period = h24 < 12 ? 0 : 1;
  // Defensive only: the wheel always writes a multiple of the step, but a value
  // seeded from elsewhere might not be.
  const mins = (Math.round((minutes % 60) / MINUTE_STEP) * MINUTE_STEP) % 60;

  const commit = useCallback(
    (hour12: number, m: number, p: number) =>
      onChange(((hour12 % 12) + p * 12) * 60 + m),
    [onChange],
  );

  return (
    <View style={s.panel}>
      {/* Drawn before the columns and left at the default stacking order, so
          the rows paint over it: as a sibling with a raised zIndex it covered
          the very value it marks. */}
      <View style={s.window} pointerEvents="none" />
      <Wheel
        items={HOURS_12}
        index={h12 - 1}
        renderLabel={(h) => String(h)}
        onSettle={(h) => commit(h, mins, period)}
        circular
      />
      <Wheel
        items={MINUTES}
        index={mins / MINUTE_STEP}
        renderLabel={(m) => String(m).padStart(2, "0")}
        onSettle={(m) => commit(h12, m, period)}
        circular
      />
      <Wheel
        items={PERIODS}
        index={period}
        renderLabel={(p) => (p ? "PM" : "AM")}
        onSettle={(p) => commit(h12, mins, p)}
      />
    </View>
  );
}

/**
 * The row a `TimeWheels` panel hangs off: its label, the time it currently
 * holds, and a chevron that states whether the panel below is open.
 */
export function TimeRow({
  label,
  minutes,
  open,
  onPress,
}: {
  label: string;
  minutes: number;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <View style={s.rowWrap}>
      <Text style={[type.label, { marginBottom: space.sm }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${formatTimeLabel(minutes)}`}
        onPress={onPress}
        style={({ pressed }) => [
          s.row,
          open && { borderColor: colors.green },
          pressed && { backgroundColor: colors.canvas },
        ]}
      >
        <Text style={type.body}>{formatTimeLabel(minutes)}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  rowWrap: { flex: 1 },
  // Reads as a field, like the place and note inputs on the same screen.
  row: {
    height: 50,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  panel: {
    flexDirection: "row",
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  // A band marking the middle row, bracketed by two hairlines the way a native
  // picker draws its window. It sits behind the columns, which are transparent,
  // so the selected value still reads on top of it.
  window: {
    position: "absolute",
    left: 0,
    right: 0,
    top: PAD,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.mint,
  },
  wheel: { flex: 1 },
  item: { height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 17, color: colors.muted },
  itemSelected: { color: colors.ink, fontWeight: "700" },
});
