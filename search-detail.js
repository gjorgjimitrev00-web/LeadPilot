const accountStatus = document.querySelector("#accountStatus");
const loginLink = document.querySelector("#loginLink");
const logoutButton = document.querySelector("#logoutButton");
const billingButton = document.querySelector("#billingButton");
const detailNotice = document.querySelector("#detailNotice");
const detailTitle = document.querySelector("#detailTitle");
const detailSubtitle = document.querySelector("#detailSubtitle");
const detailMeta = document.querySelector("#detailMeta");
const runAgainLink = document.querySelector("#runAgainLink");
const savedLeadsBody = document.querySelector("#savedLeadsBody");

const detailLeadCount = document.querySelector("#detailLeadCount");
const detailEmailCount = document.querySelector("#detailEmailCount");
const detailPhoneCount = document.querySelector("#detailPhoneCount");
const detailMissingWebsiteCount = document.querySelector("#detailMissingWebsiteCount");

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
  renderEmpty("Sign in to view this saved search.");
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
    setNotice("Start the SaaS server with npm start and open this page through http://localhost:4173.", true);
    renderEmpty("The backend is offline.");
    return;
  }

  if (!state.user) {
    setNotice("Login or create an account to view this saved search.");
    renderEmpty("Sign in to view this saved search.");
    return;
  }

  await loadSavedSearch();
}

async function loadSavedSearch() {
  const searchKey = new URLSearchParams(window.location.search).get("searchKey");
  if (!searchKey) {
    setNotice("Choose a previous search to view.", true);
    renderEmpty("No saved search was selected.");
    return;
  }

  setNotice("Loading saved leads...");

  try {
    const data = await apiRequest(`/api/saved-search?searchKey=${encodeURIComponent(searchKey)}`);
    renderSearchDetail(data.search);
  } catch (error) {
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

function renderSearchDetail(search) {
  const leads = Array.isArray(search.lastLeads) ? search.lastLeads : [];

  detailTitle.textContent = search.category || "Saved Search";
  detailSubtitle.textContent = `${search.locationDisplayName || search.location || "Saved location"} · ${formatRadius(search.radiusMeters)}`;
  runAgainLink.href = buildRunAgainUrl(search);
  detailMeta.innerHTML = `
    <span class="source-pill">Category: ${escapeHtml(search.category || "-")}</span>
    <span class="source-pill">Location: ${escapeHtml(search.locationDisplayName || search.location || "-")}</span>
    <span class="source-pill">Radius: ${formatRadius(search.radiusMeters)}</span>
    <span class="source-pill">Updated: ${formatDate(search.updatedAt)}</span>
  `;

  renderSummary(leads);
  renderLeads(leads);

  if (leads.length) {
    const leadWord = leads.length === 1 ? "lead" : "leads";
    setNotice(`Showing ${formatNumber(leads.length)} saved ${leadWord} from the last run.`);
  } else {
    setNotice("This search has no stored lead batch yet. Run it again to save viewable results.", true);
  }
}

function renderSummary(leads) {
  detailLeadCount.textContent = formatNumber(leads.length);
  detailEmailCount.textContent = formatNumber(leads.filter((lead) => lead.email).length);
  detailPhoneCount.textContent = formatNumber(leads.filter((lead) => lead.phone).length);
  detailMissingWebsiteCount.textContent = formatNumber(leads.filter((lead) => !leadHasWebsite(lead)).length);
}

function renderLeads(leads) {
  savedLeadsBody.replaceChildren();

  if (!leads.length) {
    renderEmpty("No saved leads yet. Run this search again to store the next visible batch.");
    return;
  }

  for (const lead of leads) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="business-name">
          <strong>${escapeHtml(lead.name || "Untitled business")}</strong>
          ${lead.osmUrl ? `<a class="osm-link" href="${escapeAttribute(lead.osmUrl)}" target="_blank" rel="noreferrer">Open source record</a>` : ""}
        </div>
      </td>
      <td>${renderTags(lead.categories || [])}</td>
      <td>${lead.email ? mailto(lead.email) : emptyValue()}</td>
      <td>${lead.phone ? phoneLink(lead.phone) : emptyValue()}</td>
      <td>${websiteCell(lead)}</td>
      <td>${lead.address ? escapeHtml(lead.address) : emptyValue()}</td>
      <td>${formatDistance(lead.distanceMeters)}</td>
    `;
    savedLeadsBody.append(row);
  }
}

function renderEmpty(message) {
  savedLeadsBody.innerHTML = `
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

function renderTags(items) {
  if (!items.length) return emptyValue();
  return `<div class="tag-list">${items
    .map((item) => `<span class="tag">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function mailto(email) {
  const safeEmail = escapeHtml(email);
  return `<a class="contact-link" href="mailto:${encodeURIComponent(email)}">${safeEmail}</a>`;
}

function phoneLink(phone) {
  const safePhone = escapeHtml(phone);
  const href = String(phone).replace(/[^\d+]/g, "");
  return `<a class="contact-link" href="tel:${href}">${safePhone}</a>`;
}

function websiteCell(lead) {
  const website = String(lead?.website || "").trim();
  if (website) return `<a class="contact-link" href="${escapeAttribute(website)}" target="_blank" rel="noreferrer">Website</a>`;
  if (lead?.hasWebsite) return `<span class="tag good">Listed</span>`;
  return `<span class="tag warn">No listing</span>`;
}

function leadHasWebsite(lead) {
  return Boolean(lead?.hasWebsite || String(lead?.website || "").trim());
}

function emptyValue() {
  return `<span class="muted">-</span>`;
}

function planName(planId) {
  return state.plans.find((plan) => plan.id === planId)?.name || "Paid";
}

function setNotice(message, isError = false) {
  detailNotice.textContent = message;
  detailNotice.classList.toggle("error", isError);
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

function formatDistance(distanceMeters) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) return emptyValue();
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
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

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#039;");
}
