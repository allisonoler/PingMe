export type IncomingPing = {
  id: string;
  creator_id: string;
  activity: string;
  description: string | null;
  expires_at: string;
  profiles?: { username: string; display_name?: string | null } | null;
};

export type NotificationPreference = {
  friend_id: string | null;
  activity: string | null;
  enabled: boolean;
};

/** Match global, friend, activity, and combined mute rules. Missing rules allow. */
export function shouldAnnouncePing(
  ping: IncomingPing,
  userId: string,
  preferences: NotificationPreference[],
  now = Date.now(),
): boolean {
  if (
    ping.creator_id === userId ||
    !Number.isFinite(Date.parse(ping.expires_at)) ||
    Date.parse(ping.expires_at) <= now
  )
    return false;
  return !preferences.some(
    (preference) =>
      preference.enabled === false &&
      (preference.friend_id === null ||
        preference.friend_id === ping.creator_id) &&
      (preference.activity === null || preference.activity === ping.activity),
  );
}
