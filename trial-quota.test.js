const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("new users get a 3 day trial with 3 daily searches", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const schema = fs.readFileSync("supabase-schema.sql", "utf8");

  assert.match(server, /const TRIAL_DAYS = 3/);
  assert.match(server, /const TRIAL_DAILY_SEARCH_LIMIT = 3/);
  assert.match(server, /trial_started_at: now\.toISOString\(\)/);
  assert.match(server, /trial_ends_at: addDays\(now, TRIAL_DAYS\)\.toISOString\(\)/);
  assert.match(server, /daily_searches_used: 0/);
  assert.match(server, /daily_usage_date: currentUsageDate\(\)/);

  assert.match(schema, /trial_started_at timestamptz/);
  assert.match(schema, /trial_ends_at timestamptz/);
  assert.match(schema, /daily_searches_used integer not null default 0/);
  assert.match(schema, /daily_usage_date text/);
});

test("search access is enforced by daily trial and monthly paid quotas", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /isTrialActive\(currentProfile\)/);
  assert.match(server, /daily_searches_used \|\| 0\) < TRIAL_DAILY_SEARCH_LIMIT/);
  assert.match(server, /searches_used \|\| 0\) < getPaidSearchLimit\(currentProfile\)/);
  assert.match(server, /daily_searches_used: \(user\.profile\.daily_searches_used \|\| 0\) \+ 1/);
  assert.match(server, /searches_used: \(user\.profile\.searches_used \|\| 0\) \+ 1/);
});

test("browser dashboard shows daily trial messaging", () => {
  const script = fs.readFileSync("app.js", "utf8");

  assert.match(script, /user\.trialActive/);
  assert.match(script, /user\.trialDaysRemaining/);
  assert.match(script, /searches used today/);
  assert.match(script, /Trial expired/);
});
