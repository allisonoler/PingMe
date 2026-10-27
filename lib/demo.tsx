import React, { createContext, useContext, useState } from "react";
import type { Ping } from "./pings";
import type { PingFields } from "../components/PingForm";

export const demoFriends = [
  { id: "demo-emma", username: "emma_j", display_name: "Emma Johnson" },
  { id: "demo-josh", username: "josh_m", display_name: "Josh Miller" },
  { id: "demo-sophie", username: "sophie_k", display_name: "Sophie Kim" },
  { id: "demo-caleb", username: "caleb_w", display_name: "Caleb Wilson" },
];

export function makeDemoPings(now = Date.now()): Ping[] {
  return [
    {
      activity: "Pickleball",
      description: "One more for doubles? We've got an extra paddle.",
      location_name: "Pickleball courts · Provo",
      minutes: 35,
      count: 3,
    },
    {
      activity: "Study",
      description: "Library session, then a snack break. Come grab a seat.",
      location_name: "Harold B. Lee Library",
      minutes: 80,
      count: 2,
    },
    {
      activity: "Volleyball",
      description: "Sunset volleyball. All skill levels welcome!",
      location_name: "Volleyball courts · Provo",
      minutes: 110,
      count: 5,
    },
  ].map((p, index) => ({
    ...p,
    id: `demo-ping-${index}`,
    creator_id: demoFriends[index].id,
    profiles: demoFriends[index],
    latitude: null,
    longitude: null,
    starts_at: new Date(now).toISOString(),
    expires_at: new Date(now + p.minutes * 60_000).toISOString(),
    accepted: false,
    is_own: false,
    acceptance_count: p.count,
    ping_acceptances: Array.from({ length: Math.min(p.count, 4) }, (_, n) => ({
      user_id: demoFriends[n].id,
      profiles: demoFriends[n],
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
