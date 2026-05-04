const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSavedSearchKey,
  selectLeadBatch,
} = require("./search-cursor");

test("buildSavedSearchKey groups the same category, city, and radius consistently", () => {
  const firstKey = buildSavedSearchKey({
    category: "Dental Clinics",
    place: { displayName: "Skopje, Centar, North Macedonia", lat: 41.9962164, lon: 21.4318935 },
    radius: 3000,
  });
  const secondKey = buildSavedSearchKey({
    category: "dental clinics",
    place: { displayName: "Skopje, Centar, North Macedonia", lat: 41.9962, lon: 21.4319 },
    radius: "3000",
  });

  assert.equal(firstKey, secondKey);
});

test("selectLeadBatch skips saved leads and appends newly served ids", () => {
  const leads = [
    { id: "node/1", name: "A" },
    { id: "node/2", name: "B" },
    { id: "node/3", name: "C" },
    { id: "node/4", name: "D" },
  ];

  const batch = selectLeadBatch({
    leads,
    seenLeadIds: ["node/1", "node/2"],
    limit: 2,
  });

  assert.deepEqual(batch.leads.map((lead) => lead.id), ["node/3", "node/4"]);
  assert.deepEqual(batch.nextSeenLeadIds, ["node/1", "node/2", "node/3", "node/4"]);
  assert.equal(batch.skippedSeenCount, 2);
  assert.equal(batch.reset, false);
});

test("selectLeadBatch resets when every current lead was already served", () => {
  const leads = [
    { id: "node/1", name: "A" },
    { id: "node/2", name: "B" },
    { id: "node/3", name: "C" },
  ];

  const batch = selectLeadBatch({
    leads,
    seenLeadIds: ["node/1", "node/2", "node/3"],
    limit: 2,
  });

  assert.deepEqual(batch.leads.map((lead) => lead.id), ["node/1", "node/2"]);
  assert.deepEqual(batch.nextSeenLeadIds, ["node/1", "node/2"]);
  assert.equal(batch.skippedSeenCount, 3);
  assert.equal(batch.reset, true);
});
