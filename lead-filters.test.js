const test = require("node:test");
const assert = require("node:assert/strict");

const {
  filterLeads,
  leadHasWebsite,
} = require("./lead-filters");

test("leadHasWebsite treats either hasWebsite or website as a website signal", () => {
  assert.equal(leadHasWebsite({ hasWebsite: true, website: "" }), true);
  assert.equal(leadHasWebsite({ hasWebsite: false, website: "https://example.com" }), true);
  assert.equal(leadHasWebsite({ hasWebsite: false, website: "" }), false);
  assert.equal(leadHasWebsite({ website: "   " }), false);
});

test("filterLeads with withoutWebsite only returns leads without websites", () => {
  const leads = [
    { name: "No Site", hasWebsite: false, website: "" },
    { name: "Boolean Site", hasWebsite: true, website: "" },
    { name: "Url Site", website: "https://example.com" },
    { name: "Missing Boolean", website: "" },
  ];

  const filtered = filterLeads(leads, {
    withEmail: false,
    withPhone: false,
    withWebsite: false,
    withoutWebsite: true,
  });

  assert.deepEqual(filtered.map((lead) => lead.name), ["No Site", "Missing Boolean"]);
});

test("filterLeads keeps website filters mutually exact", () => {
  const leads = [
    { name: "No Site", website: "" },
    { name: "Has Site", website: "https://example.com" },
  ];

  assert.deepEqual(filterLeads(leads, { withWebsite: true }).map((lead) => lead.name), ["Has Site"]);
  assert.deepEqual(filterLeads(leads, { withoutWebsite: true }).map((lead) => lead.name), ["No Site"]);
});
