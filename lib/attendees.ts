import { supabase } from "./supabase";
import type { Ping } from "./pings";

export type Attendee = {
  user_id: string;
  username: string;
  display_name: string | null;
};

export async function loadAttendees(
  ping: Ping,
  demoMode: boolean,
): Promise<Attendee[]> {
  if (demoMode)
    return (ping.ping_acceptances || []).map((person) => ({
      user_id: person.user_id,
      username: person.profiles?.username || "",
      display_name: person.profiles?.display_name || null,
    }));
  const { data, error } = await supabase.rpc("get_ping_attendees", {
    target_ping_id: ping.id,
  });
  if (!error) return data || [];
  // Older databases already let hosts read their full guest list. Keep that
  // working until the RPC is applied, without showing friends a partial list.
  if (error.code === "PGRST202" && ping.is_own) {
    const { data: rows, error: readError } = await supabase
      .from("ping_acceptances")
      .select(
        "user_id,profiles!ping_acceptances_user_id_fkey(username,display_name)",
      )
      .eq("ping_id", ping.id);
    if (readError) throw readError;
    return (rows || []).map((row) => {
      const profile = row.profiles as unknown as {
        username: string;
        display_name: string | null;
      } | null;
      return {
        user_id: row.user_id,
        username: profile?.username || "",
        display_name: profile?.display_name || null,
      };
    });
  }
  throw error;
}
