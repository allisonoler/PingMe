import React from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, hit, radius, space, type } from "../lib/theme";
import { handleOf, type IdentityProfile } from "../lib/identity";

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
      style={[s.page, { paddingTop: insets.top + space.md }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Content-container style for a scrollable screen. The bottom padding lets the
 * last row clear the tab bar; `flexGrow` keeps a short screen filling the
 * viewport so a centred `Page` still centres. The background is repeated here
 * because screens that nest `Page` inside the ScrollView leave this padding
 * strip outside `Page` entirely, and without it the gap falls through to
 * whatever the navigator paints its scene with rather than our own canvas.
 */
export const listContent = {
  flexGrow: 1,
  paddingBottom: space.xxxl,
  backgroundColor: colors.canvas,
};

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
    <View style={{ marginBottom: space.xl }}>
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

/**
 * Label and supporting copy for a field. Shared with LockedField so an editable
 * value and a fixed one can sit in a stack and read as the same kind of thing.
 *
 * `error` replaces `hint` rather than stacking under it: the rule and the
 * complaint about the rule are the same sentence, so showing both says it twice.
 */
function FieldFrame({
  label,
  hint,
  error,
  children,
  style,
}: React.PropsWithChildren<{
  label?: string;
  hint?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  if (!label && !hint && !error && !style) return <>{children}</>;
  return (
    <View style={[{ gap: space.sm }, style]}>
      {label ? <Text style={type.fieldLabel}>{label}</Text> : null}
      {children}
      {error ? (
        <Text style={[type.small, { color: colors.red }]}>{error}</Text>
      ) : hint ? (
        <Text style={type.small}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Text input. `label`/`hint` name what the value is *for* rather than leaving a
 * placeholder to carry it, and `prefix` pins an affix inside the box — an `@`
 * makes a username read as a handle while it is being typed.
 *
 * `style` lands on the outermost node, so layout props still apply whether or
 * not a label wraps the input.
 */
export function Field({
  label,
  hint,
  error,
  prefix,
  style,
  multiline,
  ...props
}: Omit<TextInputProps, "style"> & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FieldFrame label={label} hint={hint} error={error} style={style}>
      {prefix ? (
        // The border moves to the wrapper so the affix sits inside the field.
        <View style={[s.input, s.inputSingle, s.affixed]}>
          <Text style={s.affix}>{prefix}</Text>
          <TextInput
            placeholderTextColor={colors.placeholder}
            {...props}
            style={s.affixInput}
          />
        </View>
      ) : (
        <TextInput
          placeholderTextColor={colors.placeholder}
          multiline={multiline}
          {...props}
          style={[s.input, multiline ? s.inputMultiline : s.inputSingle]}
        />
      )}
    </FieldFrame>
  );
}

/**
 * A value shaped like a field but fixed, for things the account is keyed on.
 * Sat directly above the editable field it is confused with, the pair carries
 * the distinction on its own: one is locked, one is not.
 */
export function LockedField({
  label,
  value,
  hint,
}: {
  label?: string;
  value: string;
  hint?: string;
}) {
  return (
    <FieldFrame label={label} hint={hint}>
      <View style={[s.input, s.inputSingle, s.locked]}>
        <Text style={[type.handle, { flex: 1 }]} numberOfLines={1}>
          {value}
        </Text>
        <Ionicons name="lock-closed" size={13} color={colors.muted} />
      </View>
    </FieldFrame>
  );
}

/**
 * The one place a name and a handle are rendered together, so a person looks
 * the same on every screen. The display name is the heading; the handle always
 * follows it in the muted handle style. With no display name set the handle
 * stands alone in the heading's place but keeps the handle styling, so it never
 * passes for a name the person hasn't chosen.
 */
export function Identity({
  profile,
  size = "body",
  note,
  style,
}: {
  profile?: IdentityProfile | null;
  size?: "body" | "title";
  note?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const name = profile?.display_name?.trim();
  const handle = handleOf(profile);
  return (
    <View style={style}>
      {name || !handle ? (
        <Text
          style={size === "title" ? type.title : type.bodyStrong}
          numberOfLines={1}
        >
          {name || "A friend"}
        </Text>
      ) : null}
      {handle ? (
        <Text
          style={name || size === "body" ? type.handle : type.handleLarge}
          numberOfLines={1}
        >
          {handle}
        </Text>
      ) : null}
      {note ? (
        <Text style={[type.small, { marginTop: space.xs }]}>{note}</Text>
      ) : null}
    </View>
  );
}

/**
 * Password input with a toggle that reveals what has been typed. The border
 * lives on the wrapper so the eye button sits inside the field.
 */
export function PasswordField({
  label,
  hint,
  style,
  ...props
}: Omit<TextInputProps, "style"> & {
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [shown, setShown] = React.useState(false);
  return (
    <FieldFrame label={label} hint={hint} style={style}>
      <View style={[s.input, s.inputSingle, s.password]}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          secureTextEntry={!shown}
          style={s.passwordInput}
        />
        <IconButton
          icon={shown ? "eye-off-outline" : "eye-outline"}
          label={shown ? "Hide password" : "Show password"}
          onPress={() => setShown(!shown)}
        />
      </View>
    </FieldFrame>
  );
}

// Measured out of flow; see Collapsible's doc comment for why that matters.
const COLLAPSIBLE_CONTENT: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
};

/**
 * Animates a panel open and shut in the flow of the page, for controls that
 * belong to the row above them — a picker that floated would tear away from the
 * value it edits. The rows below get pushed down either way, so the push is
 * animated rather than instant.
 *
 * `height: "auto"` cannot be animated, so the content is measured and the
 * container animated between 0 and that height. On the first open there is one
 * frame at height 0 while `onLayout` reports back; overflow is hidden, so that
 * frame shows nothing instead of flashing the panel full height.
 *
 * The content is **absolutely positioned**, which is load-bearing. Measured in
 * normal flow it would be measured inside a box this component has just clamped
 * to 0, so the child's height would depend on the number being derived from it
 * and could come back as 0 — pinning the panel shut for good. Out of flow, its
 * height is only ever its own content's, so the first `onLayout` is the truth.
 */
export function Collapsible({
  open,
  children,
  style,
}: React.PropsWithChildren<{
  open: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const [mounted, setMounted] = React.useState(open);
  const [contentHeight, setContentHeight] = React.useState(0);
  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  React.useEffect(() => {
    // Height cannot run on the native driver, so this animates on the JS
    // thread. Fine at this size: it drives one view, not a list.
    if (open && contentHeight > 0) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: false,
      }).start();
    } else if (!open && mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contentHeight]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[
        {
          overflow: "hidden",
          opacity: anim,
          // outputRange is read at render, so content that changes height while
          // open just re-interpolates.
          height: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight],
          }),
        },
        style,
      ]}
    >
      <View
        style={COLLAPSIBLE_CONTENT}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** Separates two alternatives, like typing a place or using your location. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <Row gap={space.md} style={{ alignItems: "center" }}>
      <View style={s.rule} />
      <Text style={type.small}>{label}</Text>
      <View style={s.rule} />
    </Row>
  );
}

/** Selectable pill. Bordered when unselected so it reads against `canvas`. */
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

/** `title` takes a node so rows about a person can hand it an Identity. */
export function SwitchRow({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string | React.ReactNode;
  description?: string;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <GroupRow>
      <View style={{ flex: 1, paddingRight: space.md }}>
        {typeof title === "string" ? (
          <Text style={type.body}>{title}</Text>
        ) : (
          title
        )}
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
    backgroundColor: colors.canvas,
    paddingHorizontal: space.xl,
  },
  button: {
    height: 46,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#EFD7D7",
  },
  buttonCompact: {
    height: hit,
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
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: colors.ink,
  },
  inputSingle: { height: 50 },
  affixed: { flexDirection: "row", alignItems: "center" },
  affix: { fontSize: 16, color: colors.muted },
  affixInput: { flex: 1, height: "100%", fontSize: 16, color: colors.ink },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.canvas,
  },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  password: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingRight: space.sm,
  },
  passwordInput: { flex: 1, height: "100%", fontSize: 16, color: colors.ink },
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
  },
  group: {
    backgroundColor: colors.surface,
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
