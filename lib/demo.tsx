import React, { createContext, useContext, useState } from "react";
import type { Ping } from "./pings";
import type { PingFields } from "../components/PingForm";

export const demoFriends = [
  { id: "demo-emma", username: "emma_j", display_name: "Emma Johnson" },
  { id: "demo-josh", username: "josh_m", display_name: "Josh Miller" },
  { id: "demo-sophie", username: "sophie_k", display_name: "Sophie Kim" },
  { id: "demo-caleb", username: "caleb_w", display_name: "Caleb Wilson" },
  { id: "demo-maddie", username: "maddie_t", display_name: "Maddie Taylor" },
  { id: "demo-ethan", username: "ethan_b", display_name: "Ethan Brooks" },
];

export function makeDemoPings(now = Date.now()): Ping[] {
  return [
    {
      activity: "Pickleball",
      description: "One more for doubles? We've got an extra paddle.",
      location_name: "Pickleball courts · Provo",
      latitude: 40.2635,
      longitude: -111.6783,
      minutes: 35,
      count: 3,
      contribution_requests: ["Extra paddle", "Water"],
    },
    {
      activity: "Study",
      description: "Library session, then a snack break. Come grab a seat.",
      location_name: "Harold B. Lee Library",
      latitude: 40.2476,
      longitude: -111.6493,
      minutes: 80,
      count: 2,
      contribution_requests: ["Snacks", "Chargers"],
    },
    {
      activity: "Volleyball",
      description: "Sunset volleyball. All skill levels welcome!",
      location_name: "Volleyball · Orem",
      latitude: 40.2965,
      longitude: -111.6946,
      minutes: 110,
      count: 5,
      contribution_requests: ["Bring a ball", "Water", "Ride"],
    },
  ].map((p, index) => ({
    ...p,
    id: `demo-ping-${index}`,
    creator_id: demoFriends[index].id,
    profiles: demoFriends[index],
    starts_at: new Date(now).toISOString(),
    expires_at: new Date(now + p.minutes * 60_000).toISOString(),
    accepted: false,
    is_own: false,
    acceptance_count: p.count,
    contribution_claims: [{
      label: p.contribution_requests[0],
      user_id: demoFriends[(index + 1) % demoFriends.length].id,
      username: demoFriends[(index + 1) % demoFriends.length].username,
      display_name: demoFriends[(index + 1) % demoFriends.length].display_name,
    }],
    ping_acceptances: Array.from({ length: p.count }, (_, n) => ({
      user_id: demoFriends[(index + n + 1) % demoFriends.length].id,
      profiles: demoFriends[(index + n + 1) % demoFriends.length],
    })),
  }));
}

const DemoContext = createContext<{
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  demoPings: Ping[];
  setDemoPings: React.Dispatch<React.SetStateAction<Ping[]>>;
  resetDemo: () => void;
  createDemoPing: (fields: PingFields) => void;
} | null>(null);

export function DemoProvider({ children }: React.PropsWithChildren) {
  const [demoMode, setEnabled] = useState(false);
  const [demoPings, setDemoPings] = useState(makeDemoPings);
  const resetDemo = () => setDemoPings(makeDemoPings());
  const setDemoMode = (enabled: boolean) => {
    if (enabled) resetDemo();
    setEnabled(enabled);
  };
  const createDemoPing = (fields: PingFields) =>
    setDemoPings((pings) => [
      {
        ...fields,
        id: `demo-own-${Date.now()}`,
        creator_id: "demo-you",
        is_own: true,
        profiles: { username: "you", display_name: "You" },
        acceptance_count: 0,
        ping_acceptances: [],
      },
      ...pings,
    ]);
  return (
    <DemoContext.Provider
      value={{
        demoMode,
        setDemoMode,
        demoPings,
        setDemoPings,
        resetDemo,
        createDemoPing,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider is missing");
  return value;
}
