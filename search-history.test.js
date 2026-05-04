const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("dashboard links to a dedicated previous searches page", () => {
  const html = fs.readFileSync("app.html", "utf8");

  assert.match(html, /href="\/searches\.html"/);
  assert.match(html, /Previous searches/);
});

test("previous searches page has saved-search table and script", () => {
  const html = fs.readFileSync("searches.html", "utf8");

  for (const requiredText of [
    "Previous Searches",
    'id="savedSearchesBody"',
    'id="savedSearchCount"',
    'src="./searches.js"',
    "New search",
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("previous searches script loads saved searches and builds dashboard prefill links", () => {
  const script = fs.readFileSync("searches.js", "utf8");

  assert.match(script, /\/api\/saved-searches/);
  assert.match(script, /search-detail\.html/);
  assert.match(script, /new URL\("app\.html", window\.location\.href\)/);
  assert.match(script, /searchParams\.set\("category"/);
  assert.match(script, /searchParams\.set\("location"/);
  assert.match(script, /searchParams\.set\("radius"/);
  assert.match(script, />View</);
});

test("server exposes saved searches API and static page assets", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /\["\/searches\.html", "searches\.html"\]/);
  assert.match(server, /\["\/searches\.js", "searches\.js"\]/);
  assert.match(server, /\["\/search-detail\.html", "search-detail\.html"\]/);
  assert.match(server, /\["\/search-detail\.js", "search-detail\.js"\]/);
  assert.match(server, /url\.pathname === "\/api\/saved-searches"/);
  assert.match(server, /url\.pathname === "\/api\/saved-search"/);
  assert.match(server, /listSavedSearches/);
  assert.match(server, /getSavedSearchByKey/);
  assert.match(server, /publicSavedSearch/);
  assert.match(server, /last_leads: batch\.leads/);
});

test("dashboard reads prefill search params from previous search links", () => {
  const appScript = fs.readFileSync("app.js", "utf8");

  assert.match(appScript, /prefillSearchFromUrl\(\)/);
  assert.match(appScript, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(appScript, /params\.get\("category"\)/);
  assert.match(appScript, /params\.get\("location"\)/);
});

test("saved search detail page renders stored leads", () => {
  const html = fs.readFileSync("search-detail.html", "utf8");
  const script = fs.readFileSync("search-detail.js", "utf8");

  for (const requiredText of [
    "Saved Search",
    'id="savedLeadsBody"',
    'id="detailTitle"',
    'src="./search-detail.js"',
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(script, /\/api\/saved-search/);
  assert.match(script, /searchKey/);
  assert.match(script, /lastLeads/);
  assert.match(script, /renderLeads/);
});

test("supabase schema stores last leads for saved-search viewing", () => {
  const schema = fs.readFileSync("supabase-schema.sql", "utf8");

  assert.match(schema, /last_leads jsonb not null default '\[\]'::jsonb/);
  assert.match(schema, /alter table public\.saved_searches\s+add column if not exists last_leads/);
});
