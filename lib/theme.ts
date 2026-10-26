import { TextStyle } from "react-native";

export const colors = {
  ink: "#17221D",
  // #728078 scored 4.14:1 on white, under the 4.5:1 AA floor for the 12-13px
  // text it is used for. This darkened tone clears AA on both white and paper.
  muted: "#5B6761",
  green: "#236B4E",
  greenPressed: "#1B5339",
  mint: "#E5F3EA",
  mintPressed: "#D6E9DD",
  paper: "#F7F8F5",
  white: "#FFFFFF",
  line: "#E3E9E4",
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

export const type = {
  display: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.ink,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
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
  // All-caps needs positive tracking or it reads as cramped.
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: colors.muted,
  },
  button: { fontSize: 16, fontWeight: "700" },
} satisfies Record<string, TextStyle>;

export const activities = [
  "Coffee",
  "Study",
  "Gym",
  "Food",
  "Walk",
  "Sports",
  "Party",
  "Other",
];
