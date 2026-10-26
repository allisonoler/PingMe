/**
 * The two halves of a person's identity, and the single source of truth for how
 * each is written.
 *
 * `username` is the address: unique, immutable, and the only thing friend search
 * matches on. `display_name` is presentation: optional, free-form, changeable.
 * Keeping the formatting here is what stops the two drifting into each other —
 * a handle rendered without its `@` starts to read like a name.
 */
export type IdentityProfile = {
  username: string;
  display_name?: string | null;
};

/** Mirrors the `username` check constraint in supabase/schema.sql. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_HINT =
  "How friends find you. 3–24 lowercase letters, numbers or underscores.";
export const DISPLAY_NAME_HINT =
  "What friends see on your pings. Change it any time.";
export const DISPLAY_NAME_MAX = 60;

/**
 * Coerces typed input to something the `username` constraint will accept, so
 * the field can only ever hold a storable value. Applied on every keystroke:
 * signup used to lowercase silently on submit, which handed back a different
 * username than the one that was typed.
 */
export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX);
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(input);
}

/** The handle, always carrying its `@`. Empty when there is no profile. */
export function handleOf(profile?: IdentityProfile | null): string {
  return profile?.username ? `@${profile.username}` : "";
}

/**
 * One string for prose and other places that cannot fit two lines. Falls back
 * to the handle — still prefixed, so it stays recognisable as an address rather
 * than passing for a name.
 */
export function nameOf(profile?: IdentityProfile | null): string {
  return profile?.display_name?.trim() || handleOf(profile) || "A friend";
}
