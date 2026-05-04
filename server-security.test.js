const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("stripe webhooks require a configured signing secret", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /if \(!STRIPE_WEBHOOK_SECRET\)/);
  assert.match(server, /Stripe webhook secret is not configured/);
});

test("stripe signature verification rejects mismatched signature lengths before timing comparison", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /Buffer\.byteLength\(signature\)/);
  assert.match(server, /Buffer\.byteLength\(expected\)/);
  assert.match(server, /return false/);
});

test("environment example keeps server secrets as placeholders", () => {
  const example = fs.readFileSync(".env.example", "utf8");

  assert.match(example, /SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key/);
  assert.match(example, /ADMIN_EMAILS=you@example\.com/);
  assert.doesNotMatch(example, /eyJ/);
});
