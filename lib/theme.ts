import { TextStyle } from "react-native";

export const colors = {
  ink: "#182E25",
  // #728078 scored 4.14:1 on white, under the 4.5:1 AA floor for the 12-13px
  // text it is used for. This darkened tone clears AA on both white and canvas.
  muted: "#59665B",
  green: "#23583E",
  greenPressed: "#19412E",
  mint: "#E1EACD",
  mintPressed: "#D2DEB8",
  canvas: "#EAEDE4",
  surface: "#F8F9F3",
  surfaceAlt: "#EFF2E8",
  forest: "#193D2C",
  lime: "#D9EC9B",
  white: "#FFFFFF",
  line: "#D8DFD1",
  orange: "#F4A261",
  red: "#C94C4C",
  redSoft: "#FBEEEE",
  placeholder: "#8B978F",
};

// A 4px grid. Every margin, padding and gap in the app reads from here so the
// vertical rhythm stays consistent instead of drifting between screens.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

// Minimum comfortable touch target.
export const hit = 44;

export const avatarTones = [
  { background: "#DFE8C7", ink: "#34512C" },
  { background: "#E8DECD", ink: "#665137" },
  { background: "#E4DEED", ink: "#5A4774" },
];

export function activityTone(activity: string) {
  if (activity === "Study") return avatarTones[2];
  if (activity === "Food" || activity === "FHE") return avatarTones[1];
  return avatarTones[0];
}

export const type = {
  display: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.ink,
  },
  subtitle: { fontSize: 15, lineHeight: 21, color: colors.muted },
  body: { fontSize: 15, lineHeight: 22, color: colors.ink },
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  small: { fontSize: 13, lineHeight: 18, color: colors.muted },
  // A handle is an address, not a name, so it never borrows the ink colour or
  // the weight of the display name it sits under. `handleLarge` is for the one
  // case where a handle stands alone in a name's slot: same size, still muted,
  // still unmistakably the other thing.
  handle: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: colors.muted,
  },
  handleLarge: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 0.2,
    color: colors.muted,
  },
  // Field labels are sentence case; the all-caps `label` stays with Sections so
  // the two levels of heading don't collapse into one.
  fieldLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  // All-caps needs positive tracking or it reads as cramped.
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: colors.muted,
  },
  button: { fontSize: 16, fontWeight: "700" },
} satisfies Record<string, TextStyle>;

// Grouped by category, alphabetical inside each group, with the catch-all last.
// Fitness sits next to sports so the active options read as one run of chips.
// Kept in step with the `activity` check constraints in supabase/schema.sql.
const HANGOUTS = ["FHE", "Food", "Party", "Study"];
const FITNESS = ["Gym", "Running", "Walk"];
const SPORTS = [
  "Basketball",
  "Football",
  "Golf",
  "Pickleball",
  "Soccer",
  "Tennis",
  "Volleyball",
];

export const activities = [...HANGOUTS, ...FITNESS, ...SPORTS, "Other"];

/** Pre-selected on the create screen, so reordering the list above can't move it. */
export const defaultActivity = "Food";
