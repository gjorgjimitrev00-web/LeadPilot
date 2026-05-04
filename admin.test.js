const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("admin dashboard assets and routes are registered", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const html = fs.readFileSync("admin.html", "utf8");
  const script = fs.readFileSync("admin.js", "utf8");

  assert.match(server, /\["\/admin\.html", "admin\.html"\]/);
  assert.match(server, /\["\/admin\.js", "admin\.js"\]/);
  assert.match(html, /Admin Dashboard/);
  assert.match(html, /id="adminUsersBody"/);
  assert.match(html, /src="\.\/admin\.js"/);
  assert.match(script, /\/api\/admin\/summary/);
  assert.match(script, /\/api\/admin\/users/);
});

test("admin APIs require admin users and expose summaries", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /ADMIN_EMAILS/);
  assert.match(server, /requireAdmin/);
  assert.match(server, /url\.pathname === "\/api\/admin\/summary"/);
  assert.match(server, /url\.pathname === "\/api\/admin\/users"/);
  assert.match(server, /buildAdminSummary/);
  assert.match(server, /publicAdminUser/);
});

test("profiles schema supports admin roles", () => {
  const schema = fs.readFileSync("supabase-schema.sql", "utf8");
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(schema, /role text not null default 'user'/);
  assert.match(schema, /alter table public\.profiles\s+add column if not exists role/);
  assert.match(server, /role: isAdminEmail/);
  assert.match(server, /isAdmin: isAdminUser/);
});

test("dashboard shows admin link only for admin users", () => {
  const html = fs.readFileSync("app.html", "utf8");
  const script = fs.readFileSync("app.js", "utf8");

  assert.match(html, /id="adminLink"/);
  assert.match(html, /href="\/admin\.html"/);
  assert.match(script, /adminLink/);
  assert.match(script, /user\.isAdmin/);
});
