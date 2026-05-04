const accountStatus = document.querySelector("#accountStatus");
const loginLink = document.querySelector("#loginLink");
const logoutButton = document.querySelector("#logoutButton");
const adminNotice = document.querySelector("#adminNotice");

const totalUsers = document.querySelector("#totalUsers");
const activeSubscriptions = document.querySelector("#activeSubscriptions");
const monthlySearches = document.querySelector("#monthlySearches");
const estimatedMrr = document.querySelector("#estimatedMrr");
const savedSearchesBadge = document.querySelector("#savedSearchesBadge");
const freeUsersBadge = document.querySelector("#freeUsersBadge");
const planBreakdownBody = document.querySelector("#planBreakdownBody");
const recentUsersBody = document.querySelector("#recentUsersBody");
const adminUsersBody = document.querySelector("#adminUsersBody");

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4173" : "";

let state = {
  apiAvailable: false,
  user: null,
};

logoutButton?.addEventListener("click", async () => {
  await apiRequest("/api/auth/logout", { method: "POST" });
  state.user = null;
  renderAccountState();
  renderAdminLocked("Sign in with an admin account to view this page.");
});

init();

async function init() {
  try {
    const data = await apiRequest("/api/me");
    state = {
      apiAvailable: true,
      user: data.user,
    };
  } catch {
    state.apiAvailable = false;
  }

  renderAccountState();

  if (!state.apiAvailable) {
    setNotice("Start the SaaS server with npm start and open http://localhost:4173/admin.html.", true);
    renderAdminLocked("The backend is offline.");
    return;
  }

  if (!state.user) {
    setNotice("Sign in with an admin account to view this page.");
    renderAdminLocked("Sign in with an admin account to view this page.");
    return;
  }

  if (!state.user.isAdmin) {
    setNotice("Your account is not an admin. Add your email to ADMIN_EMAILS or set role = admin in Supabase.", true);
    renderAdminLocked("Admin access is required.");
    return;
  }

  await loadAdminDashboard();
}

async function loadAdminDashboard() {
  setNotice("Loading admin dashboard...");

  try {
    const [summaryData, usersData] = await Promise.all([
      apiRequest("/api/admin/summary"),
      apiRequest("/api/admin/users"),
    ]);

    renderSummary(summaryData.summary);
    renderUsers(usersData.users || []);
    setNotice("Admin dashboard is up to date.");
  } catch (error) {
    setNotice(error.message, true);
    renderAdminLocked(error.message);
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function renderAccountState() {
  if (!state.apiAvailable) {
    accountStatus.textContent = "Backend offline";
    loginLink.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    return;
  }

  if (!state.user) {
    accountStatus.textContent = "Not signed in";
    loginLink.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    return;
  }

  accountStatus.textContent = `${state.user.email} · ${state.user.isAdmin ? "Admin" : "User"}`;
  loginLink.classList.add("hidden");
  logoutButton.classList.remove("hidden");
}

function renderSummary(summary) {
  totalUsers.textContent = formatNumber(summary.totalUsers);
  activeSubscriptions.textContent = formatNumber(summary.activeSubscriptions);
  monthlySearches.textContent = formatNumber(summary.monthlySearches);
  estimatedMrr.textContent = summary.estimatedMrrLabel || "$0";
  savedSearchesBadge.textContent = `${formatNumber(summary.savedSearches)} saved searches`;
  freeUsersBadge.textContent = `${formatNumber(summary.freeUsers)} free users`;

  planBreakdownBody.innerHTML = (summary.planBreakdown || [])
    .map((plan) => `
      <tr>
        <td><strong>${escapeHtml(plan.name)}</strong></td>
        <td>${formatNumber(plan.users)}</td>
        <td>${formatNumber(plan.searchLimit)}</td>
        <td>${escapeHtml(plan.priceLabel)}</td>
      </tr>
    `)
    .join("");

  recentUsersBody.innerHTML = (summary.recentUsers || [])
    .map(renderCompactUserRow)
    .join("") || emptyRow(4, "No users yet.");
}

function renderUsers(users) {
  adminUsersBody.innerHTML = users.map(renderUserRow).join("") || emptyRow(7, "No users yet.");
}

function renderCompactUserRow(user) {
  return `
    <tr>
      <td>${escapeHtml(user.email)}</td>
      <td>${escapeHtml(user.planName)}</td>
      <td>${statusTag(user.subscriptionStatus)}</td>
      <td>${formatNumber(user.searchesUsed)} / ${formatNumber(user.searchLimit)}</td>
    </tr>
  `;
}

function renderUserRow(user) {
  return `
    <tr>
      <td>
        <div class="business-name">
          <strong>${escapeHtml(user.email)}</strong>
          <span class="muted">${escapeHtml(user.id)}</span>
        </div>
      </td>
      <td>${user.isAdmin ? '<span class="tag good">Admin</span>' : '<span class="tag">User</span>'}</td>
      <td>${escapeHtml(user.planName)}</td>
      <td>${statusTag(user.subscriptionStatus)}</td>
      <td>${formatNumber(user.searchesUsed)} / ${formatNumber(user.searchLimit)}</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>${formatDate(user.updatedAt)}</td>
    </tr>
  `;
}

function renderAdminLocked(message) {
  planBreakdownBody.innerHTML = emptyRow(4, message);
  recentUsersBody.innerHTML = emptyRow(4, message);
  adminUsersBody.innerHTML = emptyRow(7, message);
}

function statusTag(status) {
  const normalized = String(status || "free");
  const isActive = normalized === "active" || normalized === "trialing";
  return `<span class="tag ${isActive ? "good" : ""}">${escapeHtml(normalized)}</span>`;
}

function emptyRow(colspan, message) {
  return `
    <tr class="empty-row">
      <td colspan="${colspan}">${escapeHtml(message)}</td>
    </tr>
  `;
}

function setNotice(message, isError = false) {
  adminNotice.textContent = message;
  adminNotice.classList.toggle("error", isError);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
