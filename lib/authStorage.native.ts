import { SQLiteStorage } from "expo-sqlite/kv-store";
import { createRecoverableStorage } from "./recoverableStorage";

export const authStorage = createRecoverableStorage(() => {
  // Same file/table as Expo's localStorage polyfill, preserving existing logins.
  const storage = new SQLiteStorage("ExpoSQLiteStorage");
  return {
    getItem: (key: string) => storage.getItemSync(key),
    setItem: (key: string, value: string) => storage.setItemSync(key, value),
    removeItem: (key: string) => { storage.removeItemSync(key); },
  };
});
