const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("js/bucketlist.js", "utf8");
const calls = [];
const storage = new Map();
const context = {
  window: {},
  document: { addEventListener() {} },
  localStorage: { getItem(key) { return storage.get(key) ?? null; }, setItem(key, value) { storage.set(key, value); } },
  fetch: async (url) => {
    calls.push(url);
    if (url.includes("21,21")) return { ok: true, json: async () => ({ code: "NoRoute", routes: [] }) };
    if (url.includes("72.96134,20.76957;73.7167,21.8333")) {
      return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 200363.8 }] }) };
    }
    if (url.includes("73.7167,21.8333;72.96134,20.76957")) {
      return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 195712.3 }] }) };
    }
    return { ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 100000 }] }) };
  },
  console: { debug() {}, warn() {} },
  URL,
  setTimeout,
};
vm.runInNewContext(source, context);
const api = context.window.tourEaseBucketlist;
const origin = { name: "Origin", lat: 20, lng: 72 };
const a = { id: "a", name: "A", lat: 21, lng: 73 };
const b = { id: "b", name: "B", lat: 22, lng: 74 };
const c = { id: "c", name: "C", lat: 23, lng: 75 };

test("Billimora to Statue of Unity uses OSRM real route response, one-way", async () => {
  const route = await api.calculateRoute([
    { id: "statue", name: "Statue of Unity", lat: 21.8333, lng: 73.7167 },
  ], { name: "Billimora", lat: 20.76957, lng: 72.96134 });
  assert.equal(route.legs[0].distanceKm, 200.3638);
  assert.equal(route.legs[1].distanceKm, 195.7123);
  assert.equal(route.totalDistanceKm, 396.0761);
  assert.equal(route.legs.length, 2);
  assert.match(calls[0], /72\.96134,20\.76957;73\.7167,21\.8333/);
});

test("two and three destination itineraries add adjacent legs and the return", async () => {
  assert.equal((await api.calculateRoute([a, b], origin)).legs.length, 3);
  assert.equal((await api.calculateRoute([a, b, c], origin)).legs.length, 4);
});

test("reordering and adding/removing destinations rebuilds the itinerary legs", async () => {
  const first = await api.calculateRoute([a, b], origin);
  const reordered = await api.calculateRoute([b, a], origin);
  assert.notEqual(first.legs[0].to.id, reordered.legs[0].to.id);
  assert.equal((await api.calculateRoute([a, b, c], origin)).legs.length, 4);
  assert.equal((await api.calculateRoute([b], origin)).legs.length, 2);
});

test("missing coordinates and unavailable routes invalidate the total", async () => {
  const missing = await api.calculateRoute([{ name: "Unknown" }], origin);
  assert.equal(missing.totalDistanceKm, null);
  const noRoute = await api.calculateRoute([{ name: "No route", lat: 21, lng: 21 }], origin);
  assert.equal(noRoute.totalDistanceKm, null);
});

test("legacy saved Billimora fallback coordinates are migrated to the verified city coordinates", () => {
  storage.set("tourease_starting_point", JSON.stringify({
    name: "Billimora", state: "Custom", lat: 22.9734, lng: 78.6569, isCustom: true,
  }));
  const origin = api.getStartingPoint();
  assert.deepEqual({ lat: origin.lat, lng: origin.lng }, { lat: 20.76957, lng: 72.96134 });
  assert.deepEqual(JSON.parse(storage.get("tourease_starting_point")).lat, 20.76957);
  storage.clear();
});
