import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const script = await readFile(new URL("../sw.js", import.meta.url), "utf8");

function loadWorker(fetchImpl) {
  const listeners = {};
  const entries = new Map();
  const keyOf = request => typeof request === "string" ? request : request.url;
  const cache = {
    addAll: async () => {},
    match: async request => entries.get(keyOf(request)) || null,
    put: async (request, response) => entries.set(keyOf(request), response.clone())
  };
  const self = {
    location: { origin: "https://example.test" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (name, handler) => { listeners[name] = handler; }
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true
  };
  runInNewContext(script, { self, caches, fetch: fetchImpl, URL, Response });
  return { listeners, cache };
}

async function fetchResponse(worker, request) {
  let responsePromise;
  worker.listeners.fetch({ request, respondWith: promise => { responsePromise = promise; } });
  return responsePromise;
}

test("service worker returns fresh network resources and updates the cache", async () => {
  const worker = loadWorker(async () => new Response("fresh", { status: 200 }));
  const request = { method: "GET", url: "https://example.test/app.js", mode: "cors" };
  const response = await fetchResponse(worker, request);
  assert.equal(await response.text(), "fresh");
  assert.equal(await (await worker.cache.match(request)).text(), "fresh");
});

test("service worker uses the cached app shell only for offline navigation", async () => {
  const worker = loadWorker(async () => { throw new Error("offline"); });
  await worker.cache.put("./index.html", new Response("app shell", { status: 200 }));

  const navigation = await fetchResponse(worker, { method: "GET", url: "https://example.test/", mode: "navigate" });
  assert.equal(await navigation.text(), "app shell");

  const asset = await fetchResponse(worker, { method: "GET", url: "https://example.test/missing.js", mode: "cors" });
  assert.equal(asset.status, 503);
  assert.match(await asset.text(), /ressource n’est pas disponible hors connexion/i);
});
