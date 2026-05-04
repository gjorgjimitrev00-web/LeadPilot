const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("landing page includes interactive sales sections", () => {
  const html = fs.readFileSync("index.html", "utf8");

  for (const requiredText of [
    'id="live-demo"',
    'id="workflow"',
    'id="data"',
    'id="audience"',
    'id="saved-searches"',
    'id="faq"',
    'src="./landing.js"',
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("landing page uses customer-facing proof, New York saved-search copy, and dollar pricing", () => {
  const html = fs.readFileSync("index.html", "utf8");

  assert.doesNotMatch(html, /Supabase login/i);
  assert.doesNotMatch(html, /Stripe subscriptions/i);
  assert.match(html, /Email \+ phone extraction/);
  assert.match(html, /No-website opportunities/);
  assert.match(html, /Search dentists in New York/);
  assert.match(html, /\$19\/mo/);
  assert.match(html, /\$39\/mo/);
  assert.match(html, /\$99\/mo/);
  assert.match(html, /id="navAuthLink"/);
});

test("landing script exposes sample search data and FAQ behavior", () => {
  const script = fs.readFileSync("landing.js", "utf8");

  assert.match(script, /const sampleSearches = \[/);
  assert.match(script, /data-sample-index/);
  assert.match(script, /faq-item/);
  assert.match(script, /navAuthLink/);
  assert.match(script, /Dashboard/);
});
