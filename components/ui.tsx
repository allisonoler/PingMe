import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, hit, radius, space, type } from "../lib/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Spacing contract: Button, Card, Field, Chip and Group carry no outer margin.
 * Their container decides the gaps, via Column/Row/Section or a `gap` style.
 */

/** Screen shell. Owns the single horizontal gutter and the top safe-area inset. */
export function Page({ children, style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[s.page, { paddingTop: insets.top + space.lg }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

/** Bottom padding for scrollable content so the last row clears the tab bar. */
export const listContent = { paddingBottom: space.xxxl };

export function Column({
  gap = space.md,
  children,
  style,
  ...props
}: ViewProps & { gap?: number }) {
  return (
    <View style={[{ gap }, style]} {...props}>
      {children}
    </View>
  );
}

export function Row({
  gap = space.sm,
  spread,
  children,
  style,
  ...props
}: ViewProps & { gap?: number; spread?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap },
        spread && { justifyContent: "space-between" },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/** An all-caps section label with its content, on a consistent rhythm. */
export function Section({
  label,
  gap = space.sm,
  children,
  style,
  ...props
}: ViewProps & { label?: string; gap?: number }) {
  return (
    <View style={style} {...props}>
      {label ? (
        <Text style={[type.label, { marginBottom: space.md }]}>{label}</Text>
      ) : null}
      <View style={{ gap }}>{children}</View>
    </View>
  );
}

/**
 * Screen header. The optional action sits on the title's own line so it stays
 * aligned with it, while the subtitle runs full width underneath.
 */
export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.xxl }}>
      <Row spread>
        <Text style={[type.display, { flex: 1 }]}>{title}</Text>
        {action}
      </Row>
      {subtitle ? (
        <Text style={[type.subtitle, { marginTop: space.xs }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

type Variant = "primary" | "secondary" | "danger";

export function Button({
  title,
  icon,
  onPress,
  variant = "primary",
  compact,
  loading,
  disabled,
}: {
  title?: string;
  icon?: IconName;
  onPress: () => void;
  variant?: Variant;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  const blocked = disabled || loading;
  const fg =
    variant === "primary"
      ? colors.white
      : variant === "danger"
        ? colors.red
        : colors.green;
  const pressedBg =
    variant === "primary"
      ? colors.greenPressed
      : variant === "danger"
        ? colors.redSoft
        : colors.mintPressed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === "secondary" && s.buttonSecondary,
        variant === "danger" && s.buttonDanger,
        compact && s.buttonCompact,
        !title && s.buttonIconOnly,
        pressed && { backgroundColor: pressedBg },
        blocked && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={compact ? 15 : 18} color={fg} />
          ) : null}
          {title ? (
            <Text
              style={[type.button, compact && { fontSize: 14 }, { color: fg }]}
            >
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Inline text control: padded and hit-slopped so it is actually tappable. */
export function TextAction({
  label,
  icon,
  onPress,
  tone = "brand",
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  tone?: "brand" | "muted" | "danger";
}) {
  const color =
    tone === "brand"
      ? colors.green
      : tone === "danger"
        ? colors.red
        : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={space.sm}
      style={({ pressed }) => [s.textAction, pressed && { opacity: 0.55 }]}
    >
      {icon ? <Ionicons name={icon} size={15} color={color} /> : null}
      <Text style={[type.bodyStrong, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.muted,
  size = 20,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={space.md}
      style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.5 }]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.placeholder}
      {...props}
      style={[
        s.input,
        props.multiline ? s.inputMultiline : s.inputSingle,
        props.style,
      ]}
    />
  );
}

/** Selectable pill. Bordered when unselected so it reads against `paper`. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        selected && s.chipSelected,
        pressed && {
          backgroundColor: selected ? colors.greenPressed : colors.mint,
        },
      ]}
    >
      <Text style={[s.chipText, selected && { color: colors.white }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Non-interactive pill, for things like a ping's activity. */
export function Badge({ label }: { label: string }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{label}</Text>
    </View>
  );
}

export function Card({ children }: React.PropsWithChildren) {
  return <View style={s.card}>{children}</View>;
}

/** A grouped list: one bordered container, hairline dividers between rows. */
export function Group({ children }: React.PropsWithChildren) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <View style={s.group}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={s.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Full-width row for use inside a Group. */
export function GroupRow({ children, style, ...props }: ViewProps) {
  return (
    <View style={[s.groupRow, style]} {...props}>
      {children}
    </View>
  );
}

export function SwitchRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <GroupRow>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={type.body}>{title}</Text>
        {description ? (
          <Text style={[type.small, { marginTop: space.xs }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.green, false: "#D5DCD7" }}
        thumbColor={colors.white}
        ios_backgroundColor="#D5DCD7"
      />
    </GroupRow>
  );
}

/** Centred empty state. */
export function Empty({
  icon,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  icon: IconName;
  title: string;
  description: string;
}>) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.green} />
      </View>
      <Text style={[type.title, { marginTop: space.lg, textAlign: "center" }]}>
        {title}
      </Text>
      <Text
        style={[
          type.subtitle,
          { marginTop: space.sm, textAlign: "center", maxWidth: 280 },
        ]}
      >
        {description}
      </Text>
      {children ? (
        <View style={{ marginTop: space.xl, alignSelf: "stretch" }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** Small centred note, for the privacy lines at the foot of a screen. */
export function Footnote({ children }: React.PropsWithChildren) {
  return <Text style={[type.small, { textAlign: "center" }]}>{children}</Text>;
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: space.xl,
  },
  button: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  buttonSecondary: { backgroundColor: colors.mint },
  buttonDanger: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#EFD7D7",
  },
  buttonCompact: {
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
  },
  buttonIconOnly: { width: 50, paddingHorizontal: 0 },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.sm,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: colors.ink,
  },
  inputSingle: { height: 50 },
  inputMultiline: {
    minHeight: 96,
    paddingTop: space.md,
    paddingBottom: space.md,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.ink },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.mint,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: "700", color: colors.green },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  group: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: hit + space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
    marginLeft: space.lg,
  },
  empty: {
    alignItems: "center",
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
});
