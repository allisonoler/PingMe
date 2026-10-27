export type SessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** Reopen a stale native handle once; never treat a storage error as logout. */
export function createRecoverableStorage(open: () => SessionStorage): SessionStorage {
  let storage: SessionStorage | undefined;
  function run<T>(operation: (store: SessionStorage) => T): T {
    try {
      storage ??= open();
      return operation(storage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Access to closed resource")) throw error;
      // Drop only the invalid handle, keeping the database and its session data.
      storage = open();
      return operation(storage);
    }
  }
  return {
    getItem: (key) => run((store) => store.getItem(key)),
    setItem: (key, value) => run((store) => store.setItem(key, value)),
    removeItem: (key) => run((store) => store.removeItem(key)),
  };
}
