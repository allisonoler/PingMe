import type { SessionStorage } from "./recoverableStorage";

// Metro selects authStorage.native.ts on devices. Web keeps browser storage,
// and static rendering never opens a native database or touches window.
export const authStorage: SessionStorage = {
  getItem: (key) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
  removeItem: (key) => { if (typeof window !== "undefined") window.localStorage.removeItem(key); },
};
