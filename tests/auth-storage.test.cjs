const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, Error, console,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected import: ${name}`);
      return dependencies[name];
    },
    ...globals,
  });
  return exports;
}

const { createRecoverableStorage } = load("lib/recoverableStorage.ts");

for (const operation of ["getItem", "setItem", "removeItem"]) {
  test(`${operation} reopens a closed handle without losing stored sessions`, () => {
    const disk = new Map([["session", "existing-token"]]);
    let opens = 0;
    let closed = false;
    const storage = createRecoverableStorage(() => {
      opens++;
      const generation = opens;
      function check() {
        if (closed && generation === 1) throw new Error("Access to closed resource");
      }
      return {
        getItem(key) { check(); return disk.get(key) ?? null; },
        setItem(key, value) { check(); disk.set(key, value); },
        removeItem(key) { check(); disk.delete(key); },
      };
    });
    assert.equal(storage.getItem("session"), "existing-token");
    closed = true;
    if (operation === "getItem") assert.equal(storage.getItem("session"), "existing-token");
    if (operation === "setItem") {
      storage.setItem("session", "refreshed-token");
      assert.equal(storage.getItem("session"), "refreshed-token");
    }
    if (operation === "removeItem") {
      storage.removeItem("session");
      assert.equal(storage.getItem("session"), null);
    }
    assert.equal(opens, 2);
  });
}

test("unrelated storage failures propagate instead of silently signing out", () => {
  let opens = 0;
  const error = new Error("disk I/O error");
  const storage = createRecoverableStorage(() => {
    opens++;
    return { getItem() { throw error; } };
  });
  assert.throws(() => storage.getItem("session"), (actual) => actual === error);
  assert.equal(opens, 1);
});

test("closed-handle recovery retries once, then reports a persistent failure", () => {
  let opens = 0;
  const storage = createRecoverableStorage(() => {
    opens++;
    return { getItem() { throw new Error("Access to closed resource"); } };
  });
  assert.throws(() => storage.getItem("session"), /Access to closed resource/);
  assert.equal(opens, 2);
});

test("native adapter preserves the old Expo storage file and session keys", () => {
  const files = [];
  const disk = new Map([["sb-project-auth-token", "saved-session"]]);
  const { authStorage } = load("lib/authStorage.native.ts", {
    "./recoverableStorage": { createRecoverableStorage },
    "expo-sqlite/kv-store": {
      SQLiteStorage: class {
        constructor(file) { files.push(file); }
        getItemSync(key) { return disk.get(key) ?? null; }
        setItemSync(key, value) { disk.set(key, value); }
        removeItemSync(key) { disk.delete(key); }
      },
    },
  });
  assert.equal(authStorage.getItem("sb-project-auth-token"), "saved-session");
  authStorage.setItem("sb-project-auth-token", "new-session");
  assert.equal(disk.get("sb-project-auth-token"), "new-session");
  authStorage.removeItem("sb-project-auth-token");
  assert.equal(disk.has("sb-project-auth-token"), false);
  assert.deepEqual(files, ["ExpoSQLiteStorage"]);
});

test("web uses browser storage and static rendering never accesses window", () => {
  const server = load("lib/authStorage.ts").authStorage;
  assert.equal(server.getItem("session"), null);
  server.setItem("session", "server-value");
  server.removeItem("session");
  const disk = new Map();
  const web = load("lib/authStorage.ts", {}, { window: { localStorage: {
    getItem: (key) => disk.get(key) ?? null,
    setItem: (key, value) => disk.set(key, value),
    removeItem: (key) => disk.delete(key),
  } } }).authStorage;
  web.setItem("session", "browser-value");
  assert.equal(web.getItem("session"), "browser-value");
  web.removeItem("session");
  assert.equal(web.getItem("session"), null);
});

test("Fast Refresh reuses one native Supabase client", () => {
  const runtime = {};
  let clients = 0;
  const dependencies = {
    "react-native-url-polyfill/auto": {},
    "react-native": { Platform: { OS: "ios" } },
    "./authStorage": { authStorage: {} },
    "@supabase/supabase-js": { createClient: () => { clients++; return { auth: {} }; } },
  };
  const globals = { globalThis: runtime, process: { env: {} } };
  const first = load("lib/supabase.ts", dependencies, globals).supabase;
  const second = load("lib/supabase.ts", dependencies, globals).supabase;
  assert.equal(first, second);
  assert.equal(clients, 1);
});

test("a pending refresh start cannot race past cleanup after Fast Refresh", async () => {
  const runtime = {};
  const calls = [];
  let finishStart;
  const started = new Promise((resolve) => { finishStart = resolve; });
  const dependencies = {
    "react-native-url-polyfill/auto": {},
    "react-native": { Platform: { OS: "ios" } },
    "./authStorage": { authStorage: {} },
    "@supabase/supabase-js": { createClient: () => ({ auth: {
      startAutoRefresh: async () => { await started; calls.push("start"); },
      stopAutoRefresh: async () => { calls.push("stop"); },
    } }) },
  };
  const globals = { globalThis: runtime, process: { env: {} } };
  const first = load("lib/supabase.ts", dependencies, globals);
  const start = first.setAuthRefreshActive(true);
  const reloaded = load("lib/supabase.ts", dependencies, globals);
  const stop = reloaded.setAuthRefreshActive(false);
  await new Promise(setImmediate);
  assert.deepEqual(calls, []);
  finishStart();
  await Promise.all([start, stop]);
  assert.deepEqual(calls, ["start", "stop"]);
});

function mountAuth(getSession) {
  let cleanup;
  let changeState;
  let authEvent;
  const refresh = [];
  const updates = [];
  const warnings = [];
  const removed = [];
  const { AuthProvider } = load("lib/auth.tsx", {
    react: {
      createContext: () => ({ Provider: {} }),
      useState: () => [null, (value) => updates.push(value)],
      useEffect: (effect) => { cleanup = effect(); },
    },
    "react/jsx-runtime": { jsx: () => null },
    "react-native": {
      Platform: { OS: "ios" },
      AppState: {
        currentState: "active",
        addEventListener: (_name, callback) => {
          changeState = callback;
          return { remove: () => removed.push("app-state") };
        },
      },
    },
    "./supabase": { configured: true,
      setAuthRefreshActive: async (active) => { refresh.push(active ? "start" : "stop"); },
      supabase: { auth: {
      getSession,
      onAuthStateChange: (callback) => {
        authEvent = callback;
        return { data: { subscription: { unsubscribe: () => removed.push("auth") } } };
      },
      startAutoRefresh: async () => { refresh.push("start"); },
      stopAutoRefresh: async () => { refresh.push("stop"); },
    } } },
  }, { console: { warn: (...args) => warnings.push(args) } });
  AuthProvider({ children: null });
  return { cleanup, changeState, authEvent, refresh, updates, warnings, removed };
}

test("native auth refresh follows foreground/background and cleans up listeners", async () => {
  const mounted = mountAuth(async () => ({ data: { session: null }, error: null }));
  mounted.changeState("background");
  mounted.changeState("active");
  mounted.cleanup();
  await new Promise(setImmediate);
  assert.deepEqual(mounted.refresh, ["start", "stop", "start", "stop"]);
  assert.deepEqual(mounted.removed, ["auth", "app-state"]);
});

test("failed session restoration is caught and loading finishes", async () => {
  const mounted = mountAuth(async () => { throw new Error("storage unavailable"); });
  await new Promise(setImmediate);
  assert.equal(mounted.warnings.length, 1);
  assert.equal(mounted.updates.at(-1), false);
  mounted.cleanup();
});

test("late session and auth callbacks cannot update an unmounted provider", async () => {
  let resolve;
  const session = new Promise((done) => { resolve = done; });
  const mounted = mountAuth(() => session);
  mounted.cleanup();
  mounted.authEvent("SIGNED_IN", { user: { id: "test-user" } });
  resolve({ data: { session: { user: { id: "test-user" } } }, error: null });
  await new Promise(setImmediate);
  assert.deepEqual(mounted.updates, []);
});
