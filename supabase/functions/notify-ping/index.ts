import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(jwt);
  if (authError || !user)
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const body = await req.json().catch(() => ({}));
  if (typeof body.pingId !== "string")
    return new Response(JSON.stringify({ error: "invalid_ping_id" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const { data: ping } = await admin
    .from("pings")
    .select("id,creator_id,activity,description,expires_at")
    .eq("id", body.pingId)
    .maybeSingle();
  if (
    !ping ||
    ping.creator_id !== user.id ||
    new Date(ping.expires_at).getTime() <= Date.now()
  )
    return new Response(JSON.stringify({ error: "ping_not_found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const { data: relations } = await admin
    .from("friendships")
    .select("requester_id,recipient_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
  const friendIds = (relations || []).map((r) =>
    r.requester_id === user.id ? r.recipient_id : r.requester_id,
  );
  if (!friendIds.length)
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id,friend_id,activity,enabled")
    .in("user_id", friendIds);
  const { data: blocks } = await admin
    .from("blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
  const blocked = new Set(
    (blocks || []).flatMap((b) =>
      b.blocker_id === user.id ? [b.blocked_id] : [b.blocker_id],
    ),
  );
  const opted = friendIds.filter((id) => {
    if (blocked.has(id)) return false;
    const own = (prefs || []).filter((p) => p.user_id === id);
    return [
      own.find((p) => p.friend_id === null && p.activity === null),
      own.find((p) => p.friend_id === user.id && p.activity === null),
      own.find((p) => p.friend_id === null && p.activity === ping.activity),
    ].every((p) => p?.enabled !== false);
  });
  if (!opted.length)
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  const { data: devices } = await admin
    .from("push_devices")
    .select("token,user_id")
    .in("user_id", opted);
  const messages = (devices || []).map((d) => ({
    to: d.token,
    sound: "default",
    title: `${ping.activity} with a friend`,
    body: ping.description || "Tap to see the details and join in.",
    data: { pingId: ping.id },
    channelId: "pings",
  }));
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (response.ok) sent += messages.slice(i, i + 100).length;
  }
  return new Response(JSON.stringify({ sent }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
