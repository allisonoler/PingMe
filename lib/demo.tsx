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

const demoYou = { id: "demo-you", username: "you", display_name: "You" };

type DemoPlan = {
  activity: string;
  title: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  minutes: number;
  count: number;
  max_people: number | null;
  contribution_requests: string[];
  startsIn?: number;
  youHost?: boolean;
  youJoin?: boolean;
  yourContribution?: string;
  friendContribution?: string;
  updates: { author: "host" | "friend" | "you"; body: string }[];
};

export function makeDemoPings(now = Date.now()): Ping[] {
  const plans: DemoPlan[] = [
    {
      activity: "Pickleball",
      title: "One more for doubles?",
      description: "One more for doubles? We've got an extra paddle.",
      location_name: "Pickleball courts · Provo",
      latitude: 40.2635,
      longitude: -111.6783,
      minutes: 35,
      count: 2,
      max_people: 4,
      contribution_requests: ["Extra paddle", "Water"],
      updates: [{ author: "friend", body: "I’ve got the extra paddle. Just bring yourself!" }],
    },
    {
      activity: "Study",
      title: "Study together, snack together",
      description: "Library session, then a snack break. Come grab a seat.",
      location_name: "Harold B. Lee Library",
      latitude: 40.2476,
      longitude: -111.6493,
      minutes: 80,
      count: 2,
      max_people: null,
      contribution_requests: ["Snacks", "Chargers"],
      updates: [{ author: "friend", body: "I’ll bring snacks. Anyone want to quiz each other afterward?" }],
    },
    {
      activity: "Volleyball",
      title: "Sunset volleyball",
      description: "Sunset volleyball. All skill levels welcome!",
      location_name: "Volleyball · Orem",
      latitude: 40.2965,
      longitude: -111.6946,
      minutes: 110,
      count: 5,
      max_people: 6,
      contribution_requests: ["Bring a ball", "Water", "Ride"],
      updates: [{ author: "friend", body: "I’ve got the ball. We can sort out teams when we get there." }],
    },
    {
      activity: "Art",
      title: "Come do art with me",
      description: "Come do art with me! Bring whatever you’re working on. We can swap supplies and teach each other a technique.",
      location_name: "Art hangout · Provo",
      latitude: 40.2346,
      longitude: -111.6594,
      startsIn: 15,
      minutes: 90,
      count: 2,
      max_people: 6,
      contribution_requests: ["Watercolors", "Extra paper", "Share a technique"],
      youHost: true,
      updates: [
        { author: "host", body: "No experience needed. Let’s each share one little technique." },
        { author: "friend", body: "I’ll bring watercolors and extra brushes for anyone who needs them." },
      ],
    },
    {
      activity: "Speech",
      title: "Help me rehearse my pitch",
      description: "Will you listen to me practice my speech? It’s five minutes. I’d love a timer, a little feedback, and a friendly audience.",
      location_name: "Practice circle · Orem",
      latitude: 40.2785,
      longitude: -111.7143,
      startsIn: 30,
      minutes: 45,
      count: 2,
      max_people: 5,
      contribution_requests: ["Time my speech", "Give feedback", "Record a practice run"],
      youJoin: true,
      yourContribution: "Time my speech",
      friendContribution: "Give feedback",
      updates: [
        { author: "host", body: "Could you listen for whether my main idea is clear? Kind, honest feedback welcome." },
        { author: "friend", body: "Happy to listen and share a couple of suggestions." },
        { author: "you", body: "I’ll keep time and give you a one-minute warning." },
      ],
    },
    {
      activity: "Food",
      title: "Let’s make tacos together",
      description: "Let’s make tacos together. I’ve got the filling—bring a topping or help cook, and we’ll make dinner as a team.",
      location_name: "Dinner crew · Provo",
      latitude: 40.2512,
      longitude: -111.6658,
      startsIn: 45,
      minutes: 75,
      count: 1,
      max_people: 6,
      contribution_requests: ["Tortillas", "Salsa", "Help cook"],
      updates: [{ author: "friend", body: "I’ve got tortillas. I can also come a little early to help chop." }],
    },
    {
      activity: "Walk",
      title: "A photo walk with friends",
      description: "Photo walk? Phone cameras welcome. Let’s take turns picking spots and share a few photo tips along the way.",
      location_name: "Photo walk · Provo",
      latitude: 40.2414,
      longitude: -111.6835,
      startsIn: 10,
      minutes: 50,
      count: 1,
      max_people: null,
      contribution_requests: ["Pick the route", "Share photo tips"],
      updates: [{ author: "friend", body: "I’ll pick a short route with a few spots to practice portraits." }],
    },
    {
      activity: "Gym",
      title: "Workout buddy wanted",
      description: "Looking for a workout buddy. Let’s plan a session together, swap tips, and spot each other. Beginners welcome.",
      location_name: "Workout buddies · Orem",
      latitude: 40.2878,
      longitude: -111.6885,
      startsIn: 60,
      minutes: 60,
      count: 0,
      max_people: 2,
      contribution_requests: ["Plan the warm-up", "Share a workout"],
      updates: [{ author: "host", body: "I’m happy to spot or swap workout ideas. We can pick a pace that works for both of us." }],
    },
  ];
  return plans.map((plan, index) => {
    const host = plan.youHost ? demoYou : demoFriends[index % demoFriends.length];
    const friends = Array.from({ length: plan.count - (plan.youJoin ? 1 : 0) }, (_, n) =>
      demoFriends[(index + n + 1) % demoFriends.length],
    );
    const attendees = plan.youJoin ? [...friends, demoYou] : friends;
    const helper = friends[0];
    const startsAt = now + (plan.startsIn || 0) * 60_000;
    return {
      id: `demo-ping-${index}`,
      activity: plan.activity,
      title: plan.title,
      description: plan.description,
      location_name: plan.location_name,
      latitude: plan.latitude,
      longitude: plan.longitude,
      max_people: plan.max_people,
      contribution_requests: plan.contribution_requests,
      creator_id: host.id,
      profiles: host,
      starts_at: new Date(startsAt).toISOString(),
      expires_at: new Date(startsAt + plan.minutes * 60_000).toISOString(),
      accepted: !!plan.youJoin,
      is_own: !!plan.youHost,
      acceptance_count: attendees.length,
      contribution_claims: [
        ...(helper ? [{
          label: plan.friendContribution || plan.contribution_requests[0],
          user_id: helper.id,
          username: helper.username,
          display_name: helper.display_name,
        }] : []),
        ...(plan.yourContribution ? [{
          label: plan.yourContribution,
          user_id: demoYou.id,
          username: demoYou.username,
          display_name: demoYou.display_name,
        }] : []),
      ],
      ping_acceptances: attendees.map((person) => ({ user_id: person.id, profiles: person })),
      updates: plan.updates.map((note, noteIndex) => {
        const author = note.author === "you" ? demoYou : note.author === "friend" ? helper || host : host;
        return {
          id: `demo-ping-${index}-update-${noteIndex}`,
          ping_id: `demo-ping-${index}`,
          user_id: author.id,
          username: author.username,
          display_name: author.display_name,
          body: note.body,
          created_at: new Date(now - (plan.updates.length - noteIndex) * 120_000).toISOString(),
        };
      }).reverse(),
    };
  });
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
