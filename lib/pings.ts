import type { IdentityProfile } from "./identity";

export type ContributionClaim = {
  label: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
};

export type PingUpdate = {
  id: string;
  ping_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  body: string;
  created_at: string;
};

export function pingTitle(ping: { title?: string | null; activity: string }) {
  return ping.title?.trim() || ping.activity;
}

export function contributionSuggestions(activity: string): string[] {
  if (activity === "Art") return ["Art supplies", "Share a technique", "Snacks"];
  if (activity === "Speech") return ["Time my speech", "Give feedback", "Record a practice run"];
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
  title?: string | null;
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
  /** Total people, including the host. Null/absent means unlimited. */
  max_people?: number | null;
  contribution_requests?: string[];
  contribution_claims?: ContributionClaim[];
  contributions_unavailable?: boolean;
  updates?: PingUpdate[];
  updates_unavailable?: boolean;
};

export function pingCapacity(ping: Pick<Ping, "acceptance_count" | "ping_acceptances" | "max_people">) {
  const total = (ping.acceptance_count ?? ping.ping_acceptances?.length ?? 0) + 1;
  const limit = ping.max_people ?? null;
  return {
    total,
    limit,
    full: limit !== null && total >= limit,
    remaining: limit === null ? null : Math.max(0, limit - total),
  };
}

export const presets = [
  {
    activity: "Pickleball",
    title: "One more for doubles?",
    description: "Doubles? Grab a paddle and come play.",
    place: "Pickleball courts",
  },
  {
    activity: "Study",
    title: "Study together",
    description: "Study break from studying alone. Anyone in?",
    place: "Harold B. Lee Library",
  },
  {
    activity: "Volleyball",
    title: "Volleyball, anyone?",
    description: "Starting a game. All skill levels welcome!",
    place: "Volleyball courts",
  },
] as const;

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
  // Leaving is always allowed, even when every spot is taken.
  if (!ping.accepted && pingCapacity(ping).full) return ping;
  return {
    ...ping,
    accepted: !ping.accepted,
    ...(ping.accepted && responder ? {
      contribution_claims: (ping.contribution_claims || []).filter((claim) => claim.user_id !== responder.user_id),
      updates: (ping.updates || []).filter((update) => update.user_id !== responder.user_id),
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
      (ping.acceptance_count ?? ping.ping_acceptances?.length ?? 0) + (ping.accepted ? -1 : 1),
    ),
  };
}
