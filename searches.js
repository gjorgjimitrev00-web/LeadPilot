const accountStatus = document.querySelector("#accountStatus");
const loginLink = document.querySelector("#loginLink");
const logoutButton = document.querySelector("#logoutButton");
const billingButton = document.querySelector("#billingButton");
const searchesNotice = document.querySelector("#searchesNotice");
const savedSearchesBody = document.querySelector("#savedSearchesBody");

const savedSearchCount = document.querySelector("#savedSearchCount");
const seenLeadCount = document.querySelector("#seenLeadCount");
const lastBatchCount = document.querySelector("#lastBatchCount");
const resetCount = document.querySelector("#resetCount");

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4173" : "";

let state = {
  apiAvailable: false,
  user: null,
  plans: [],
};

logoutButton?.addEventListener("click", async () => {
  await apiRequest("/api/auth/logout", { method: "POST" });
  state.user = null;
  renderAccountState();
  renderEmpty("Sign in to view previous searches.");
});

billingButton?.addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/stripe/create-portal-session", { method: "POST" });
    window.location.href = data.url;
  } catch (error) {
    setNotice(error.message, true);
  }
});

init();

async function init() {
  try {
    const data = await apiRequest("/api/me");
    state = {
      apiAvailable: true,
      user: data.user,
      plans: data.plans || [],
    };
  } catch {
    state.apiAvailable = false;
  }

  renderAccountState();

  if (!state.apiAvailable) {
    setNotice("Start the SaaS server with npm start and open http://localhost:4173/searches.html.", true);
    renderEmpty("The backend is offline.");
    return;
  }

  if (!state.user) {
    setNotice("Login or create an account to view previous searches.");
    renderEmpty("Sign in to view previous searches.");
    return;
  }

  await loadSavedSearches();
}

async function loadSavedSearches() {
  setNotice("Loading your saved searches...");

  try {
    const data = await apiRequest("/api/saved-searches");
    const searches = data.searches || [];
    renderSummary(searches);
    renderSearches(searches);

    const searchWord = searches.length === 1 ? "saved search" : "saved searches";
    setNotice(searches.length ? `Showing ${searches.length} ${searchWord}.` : "No saved searches yet.");
  } catch (error) {
    renderSummary([]);
    renderEmpty(error.message);
    setNotice(error.message, true);
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
    billingButton.classList.add("hidden");
    return;
  }

  if (!state.user) {
    accountStatus.textContent = "Not signed in";
    loginLink.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    billingButton.classList.add("hidden");
    return;
  }

  const label = state.user.hasActiveSubscription ? `${planName(state.user.planId)} plan` : "Free trial";
  accountStatus.textContent = `${state.user.email} · ${label}`;
  loginLink.classList.add("hidden");
  logoutButton.classList.remove("hidden");
  billingButton.classList.toggle("hidden", !state.user.hasActiveSubscription);
}

function renderSummary(searches) {
  savedSearchCount.textContent = String(searches.length);
  seenLeadCount.textContent = formatNumber(sum(searches, "seenCount"));
  lastBatchCount.textContent = formatNumber(sum(searches, "lastResultCount"));
  resetCount.textContent = formatNumber(sum(searches, "resetCount"));
}

function renderSearches(searches) {
  if (!searches.length) {
    renderEmpty("No previous searches yet. Run a dashboard search with progress saving enabled.");
    return;
  }

  savedSearchesBody.innerHTML = searches.map(renderSearchRow).join("");
}

function renderSearchRow(search) {
  const runUrl = buildRunAgainUrl(search);
  const viewUrl = buildViewUrl(search);
  const skippedCopy = search.lastSkippedCount
    ? `<span class="muted">${formatNumber(search.lastSkippedCount)} skipped as already shown</span>`
    : `<span class="muted">No skipped leads last run</span>`;

  return `
    <tr>
      <td>
        <div class="business-name">
          <strong>${escapeHtml(search.category || "Untitled search")}</strong>
          <span class="muted">${escapeHtml(search.searchKey || "Saved lead search")}</span>
        </div>
      </td>
      <td>${escapeHtml(search.locationDisplayName || search.location || "-")}</td>
      <td>${formatRadius(search.radiusMeters)}</td>
      <td>${formatNumber(search.seenCount)}</td>
      <td>
        <div class="saved-batch">
          <strong>${formatNumber(search.lastResultCount)} results</strong>
          ${skippedCopy}
        </div>
      </td>
      <td>${formatDate(search.updatedAt)}</td>
      <td>
        <div class="row-actions">
          <a class="mini-action" href="${viewUrl}">View</a>
          <a class="mini-action mini-action-secondary" href="${runUrl}">Run again</a>
        </div>
      </td>
    </tr>
  `;
}

function renderEmpty(message) {
  savedSearchesBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="7">${escapeHtml(message)}</td>
    </tr>
  `;
}

function buildRunAgainUrl(search) {
  const url = new URL("app.html", window.location.href);
  if (search.category) url.searchParams.set("category", search.category);
  if (search.location) url.searchParams.set("location", search.location);
  if (search.radiusMeters) url.searchParams.set("radius", String(search.radiusMeters));
  return url.href;
}

function buildViewUrl(search) {
  const url = new URL("search-detail.html", window.location.href);
  if (search.searchKey) url.searchParams.set("searchKey", search.searchKey);
  return url.href;
}

function planName(planId) {
  return state.plans.find((plan) => plan.id === planId)?.name || "Paid";
}

function setNotice(message, isError = false) {
  searchesNotice.textContent = message;
  searchesNotice.classList.toggle("error", isError);
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatRadius(radiusMeters) {
  const radius = Number(radiusMeters || 0);
  if (!radius) return "-";
  if (radius >= 1000) return `${formatNumber(radius / 1000)} km`;
  return `${formatNumber(radius)} m`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
