import type { IdentityProfile } from "./identity";

export type ContributionClaim = {
  label: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
};

export function contributionSuggestions(activity: string): string[] {
  if (activity === "Pickleball" || activity === "Tennis") return ["Extra paddle", "Balls", "Water"];
  if (activity === "Volleyball" || activity === "Basketball" || activity === "Soccer" || activity === "Football") return ["Bring a ball", "Water", "Ride"];
  if (activity === "Study") return ["Snacks", "Study notes", "Chargers"];
  return ["Snacks", "Drinks", "Ride"];
}

/** Demo updates follow the same ownership rules as the claim RPC. */
export function withContribution(ping: Ping, label: string, person: ContributionClaim): Ping {
  if ((!ping.accepted && !ping.is_own) || !person.user_id || new Date(ping.expires_at).getTime() <= Date.now()) return ping;
  if (!(ping.contribution_requests || []).includes(label)) return ping;
  const claims = ping.contribution_claims || [];
  const existing = claims.find((claim) => claim.label === label);
  if (existing && existing.user_id !== person.user_id) return ping;
  return {
    ...ping,
    contribution_claims: existing
      ? claims.filter((claim) => claim.label !== label)
      : [...claims, { ...person, label }],
  };
}

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
  contribution_requests?: string[];
  contribution_claims?: ContributionClaim[];
  contributions_unavailable?: boolean;
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

/** Calendar labels use local dates, including across daylight-saving changes. */
export function pingTimeRange(ping: Pick<Ping, "starts_at" | "expires_at">, now: number) {
  if (!ping.starts_at) return null;
  const start = new Date(ping.starts_at);
  const end = new Date(ping.expires_at);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = (date: Date) =>
    date.toDateString() === today.toDateString()
      ? "Today"
      : date.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const clock = (date: Date) => date.toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit",
  });
  const endDay = start.toDateString() === end.toDateString() ? "" : `${day(end)}, `;
  return `${day(start)} · ${clock(start)} – ${endDay}${clock(end)}`;
}

export function pingTimeStatus(ping: Pick<Ping, "starts_at" | "expires_at">, now: number) {
  if (new Date(ping.expires_at).getTime() <= now) return "Ended";
  const minutes = ping.starts_at
    ? Math.ceil((new Date(ping.starts_at).getTime() - now) / 60_000)
    : 0;
  if (minutes > 0) {
    if (minutes < 60) return `Starts in ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `Starts in ${hours}h${rest ? ` ${rest}m` : ""}`;
  }
  return timeLeft(ping.expires_at, now);
}

export function withResponse(
  ping: Ping,
  responder?: NonNullable<Ping["ping_acceptances"]>[number],
): Ping {
  return {
    ...ping,
    accepted: !ping.accepted,
    ...(ping.accepted && responder ? {
      contribution_claims: (ping.contribution_claims || []).filter((claim) => claim.user_id !== responder.user_id),
    } : {}),
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
