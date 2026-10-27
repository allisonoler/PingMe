import type { IdentityProfile } from "./identity";

export type Ping = {
  id: string;
  activity: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at?: string;
  expires_at: string;
  creator_id: string;
  profiles?: IdentityProfile | null;
  ping_acceptances?: { user_id: string; profiles?: IdentityProfile | null }[];
  accepted?: boolean;
  is_own?: boolean;
  acceptance_count?: number;
};

export const presets = [
  {
    activity: "Pickleball",
    icon: "tennisball-outline",
    description: "Doubles? Grab a paddle and come play.",
    place: "Pickleball courts",
  },
  {
    activity: "Study",
    icon: "book-outline",
    description: "Study break from studying alone. Anyone in?",
    place: "Harold B. Lee Library",
  },
  {
    activity: "Volleyball",
    icon: "basketball-outline",
    description: "Starting a game. All skill levels welcome!",
    place: "Volleyball courts",
  },
] as const;

export function activityIcon(activity: string) {
  if (activity === "Pickleball" || activity === "Tennis")
    return "tennisball-outline";
  if (activity === "Study") return "book-outline";
  if (
    ["Basketball", "Volleyball", "Soccer", "Football", "Golf"].includes(
      activity,
    )
  )
    return "basketball-outline";
  if (["Gym", "Running", "Walk"].includes(activity)) return "fitness-outline";
  if (activity === "Food") return "restaurant-outline";
  return "sparkles-outline";
}

export function timeLeft(expiresAt: string, now: number) {
  const minutes = Math.ceil((new Date(expiresAt).getTime() - now) / 60_000);
  if (minutes <= 0) return "Ended";
  if (minutes < 60) return `Ends in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `Ends in ${hours}h${rest ? ` ${rest}m` : ""}`;
}

export function withResponse(
  ping: Ping,
  responder?: NonNullable<Ping["ping_acceptances"]>[number],
): Ping {
  return {
    ...ping,
    accepted: !ping.accepted,
    ...(responder
      ? {
          ping_acceptances: ping.accepted
            ? (ping.ping_acceptances || []).filter(
                (person) => person.user_id !== responder.user_id,
              )
            : [
                ...(ping.ping_acceptances || []).filter(
                  (person) => person.user_id !== responder.user_id,
                ),
                responder,
              ],
        }
      : {}),
    acceptance_count: Math.max(
      0,
      (ping.acceptance_count || 0) + (ping.accepted ? -1 : 1),
    ),
  };
}
