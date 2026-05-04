const form = document.querySelector("#searchForm");
const categoryInput = document.querySelector("#category");
const locationInput = document.querySelector("#location");
const radiusInput = document.querySelector("#radius");
const limitInput = document.querySelector("#limit");
const saveSearchProgressInput = document.querySelector("#saveSearchProgress");
const resultsBody = document.querySelector("#resultsBody");
const statusText = document.querySelector("#statusText");
const exportButton = document.querySelector("#exportCsv");
const exportFormatInput = document.querySelector("#exportFormat");
const countryCodeInput = document.querySelector("#countryCode");
const accountStatus = document.querySelector("#accountStatus");
const adminLink = document.querySelector("#adminLink");
const loginLink = document.querySelector("#loginLink");
const logoutButton = document.querySelector("#logoutButton");
const billingButton = document.querySelector("#billingButton");
const subscriptionNotice = document.querySelector("#subscriptionNotice");

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4173" : "";

const filters = {
  withEmail: document.querySelector("#withEmail"),
  withPhone: document.querySelector("#withPhone"),
  withWebsite: document.querySelector("#withWebsite"),
  withoutWebsite: document.querySelector("#withoutWebsite"),
};

const counters = {
  total: document.querySelector("#totalCount"),
  email: document.querySelector("#emailCount"),
  phone: document.querySelector("#phoneCount"),
  missingWebsite: document.querySelector("#missingWebsiteCount"),
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const BUSINESS_TAG_KEYS = [
  "amenity",
  "shop",
  "office",
  "craft",
  "tourism",
  "healthcare",
  "leisure",
  "club",
  "industrial",
];

const CATEGORY_STOP_WORDS = new Set([
  "agencies",
  "agency",
  "and",
  "business",
  "businesses",
  "client",
  "clients",
  "company",
  "companies",
  "near",
  "nearby",
  "office",
  "service",
  "services",
  "firm",
  "firms",
  "store",
  "the",
]);

const CATEGORY_PRESETS = [
  {
    aliases: ["restaurant", "restaurants", "food", "places to eat"],
    selectors: [
      ["amenity", ["restaurant", "fast_food", "food_court"]],
      ["shop", ["deli", "pastry"]],
    ],
  },
  {
    aliases: ["cafe", "coffee", "coffee shop", "cafes"],
    selectors: [["amenity", ["cafe"]]],
  },
  {
    aliases: ["pizza", "pizzeria"],
    selectors: [["cuisine", ["pizza"]]],
  },
  {
    aliases: ["bar", "pub", "nightlife"],
    selectors: [["amenity", ["bar", "pub", "biergarten", "nightclub"]]],
  },
  {
    aliases: ["dentist", "dentists", "dental"],
    selectors: [
      ["amenity", ["dentist"]],
      ["healthcare", ["dentist"]],
    ],
  },
  {
    aliases: ["doctor", "doctors", "clinic", "medical"],
    selectors: [
      ["amenity", ["clinic", "doctors", "hospital"]],
      ["healthcare", ["clinic", "doctor", "hospital"]],
    ],
  },
  {
    aliases: ["pharmacy", "pharmacies"],
    selectors: [
      ["amenity", ["pharmacy"]],
      ["healthcare", ["pharmacy"]],
    ],
  },
  {
    aliases: ["veterinarian", "vet", "veterinary"],
    selectors: [
      ["amenity", ["veterinary"]],
      ["healthcare", ["veterinary"]],
    ],
  },
  {
    aliases: ["hotel", "hotels", "accommodation"],
    selectors: [["tourism", ["hotel", "motel", "guest_house", "hostel", "apartment"]]],
  },
  {
    aliases: ["lawyer", "lawyers", "law firm", "attorney"],
    selectors: [["office", ["lawyer"]]],
  },
  {
    aliases: ["real estate", "realtor", "estate agent", "property"],
    selectors: [["office", ["estate_agent"]]],
  },
  {
    aliases: ["accountant", "accountants", "bookkeeper", "accounting"],
    selectors: [["office", ["accountant", "tax_advisor"]]],
  },
  {
    aliases: ["insurance", "insurance agency"],
    selectors: [["office", ["insurance"]]],
  },
  {
    aliases: ["marketing", "marketing agency", "advertising", "advertising agency"],
    selectors: [["office", ["advertising_agency"]]],
  },
  {
    aliases: ["architect", "architects", "architecture", "architecture firm"],
    selectors: [["office", ["architect"]]],
  },
  {
    aliases: ["it", "software", "software company", "technology", "tech company"],
    selectors: [["office", ["it"]]],
  },
  {
    aliases: ["bank", "banks"],
    selectors: [["amenity", ["bank"]]],
  },
  {
    aliases: ["gym", "fitness", "fitness centre", "fitness center"],
    selectors: [["leisure", ["fitness_centre", "sports_centre"]]],
  },
  {
    aliases: ["beauty", "beauty salon", "hairdresser", "hair salon"],
    selectors: [["shop", ["beauty", "hairdresser", "cosmetics"]]],
  },
  {
    aliases: ["spa", "massage", "wellness"],
    selectors: [
      ["shop", ["massage", "beauty"]],
      ["leisure", ["spa"]],
    ],
  },
  {
    aliases: ["car repair", "auto repair", "mechanic", "garage"],
    selectors: [
      ["shop", ["car_repair", "tyres", "car_parts"]],
      ["craft", ["mechanic"]],
    ],
  },
  {
    aliases: ["car dealer", "car dealership", "auto dealer"],
    selectors: [["shop", ["car"]]],
  },
  {
    aliases: ["car wash", "carwash"],
    selectors: [["amenity", ["car_wash"]]],
  },
  {
    aliases: ["plumber", "plumbing"],
    selectors: [["craft", ["plumber"]]],
  },
  {
    aliases: ["electrician", "electrical"],
    selectors: [["craft", ["electrician"]]],
  },
  {
    aliases: ["construction", "builder", "builders", "contractor"],
    selectors: [
      ["craft", ["builder", "carpenter", "roofer"]],
      ["office", ["construction_company"]],
    ],
  },
  {
    aliases: ["cleaning", "cleaning service", "laundry", "dry cleaner"],
    selectors: [
      ["shop", ["laundry", "dry_cleaning"]],
      ["craft", ["cleaner"]],
    ],
  },
  {
    aliases: ["bakery", "bakeries"],
    selectors: [["shop", ["bakery", "pastry"]]],
  },
  {
    aliases: ["supermarket", "grocery", "market"],
    selectors: [["shop", ["supermarket", "convenience", "greengrocer"]]],
  },
  {
    aliases: ["clothing", "fashion", "clothes"],
    selectors: [["shop", ["clothes", "fashion", "shoes", "boutique"]]],
  },
  {
    aliases: ["electronics", "phone shop", "mobile phone"],
    selectors: [["shop", ["electronics", "mobile_phone", "computer"]]],
  },
  {
    aliases: ["furniture", "home furniture"],
    selectors: [["shop", ["furniture", "interior_decoration", "kitchen"]]],
  },
  {
    aliases: ["florist", "flowers", "flower shop"],
    selectors: [["shop", ["florist"]]],
  },
  {
    aliases: ["travel", "travel agency", "tour agency"],
    selectors: [
      ["office", ["travel_agent"]],
      ["shop", ["travel_agency"]],
    ],
  },
  {
    aliases: ["school", "education", "training"],
    selectors: [
      ["amenity", ["school", "college", "university", "language_school"]],
      ["office", ["educational_institution"]],
    ],
  },
];

let allResults = [];
let filteredResults = [];
let lastSearchName = "clients";
let saasState = {
  apiAvailable: false,
  stripeConfigured: false,
  user: null,
  plans: [],
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runSearch();
});

Object.values(filters).forEach((input) => {
  input.addEventListener("change", () => {
    syncExclusiveWebsiteFilters(input);
    applyFilters();
  });
});

exportButton.addEventListener("click", () => {
  if (!ensureExportAccess()) return;
  exportCsv(filteredResults);
});

exportFormatInput.addEventListener("change", () => {
  updateExportButton();
});

logoutButton?.addEventListener("click", async () => {
  await apiRequest("/api/auth/logout", { method: "POST" });
  saasState.user = null;
  renderSaasState();
  setStatus("Signed out.");
});

billingButton?.addEventListener("click", async () => {
  try {
    const data = await apiRequest("/api/stripe/create-portal-session", { method: "POST" });
    window.location.href = data.url;
  } catch (error) {
    setStatus(error.message, true);
  }
});

prefillSearchFromUrl();
initSaas();

async function initSaas() {
  try {
    const data = await apiRequest("/api/me");
    saasState = {
      apiAvailable: true,
      stripeConfigured: data.stripeConfigured,
      user: data.user,
      plans: data.plans || [],
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setStatus("Checkout complete. Your subscription will activate after Stripe sends the webhook.");
    }
    if (params.get("checkout") === "cancelled") {
      setStatus("Checkout cancelled. You can pick a plan whenever you are ready.");
    }
  } catch {
    saasState.apiAvailable = false;
  }

  renderSaasState();
}

function renderSaasState() {
  if (!saasState.apiAvailable) {
    accountStatus.textContent = "Backend offline";
    subscriptionNotice.textContent = "Start the SaaS server with npm start and open http://localhost:4173/app.html.";
    adminLink?.classList.add("hidden");
    loginLink.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    billingButton.classList.add("hidden");
    return;
  }

  if (!saasState.user) {
    accountStatus.textContent = "Not signed in";
    subscriptionNotice.textContent = "Login or create an account to run lead searches and exports.";
    adminLink?.classList.add("hidden");
    loginLink.classList.remove("hidden");
    logoutButton.classList.add("hidden");
    billingButton.classList.add("hidden");
    return;
  }

  const user = saasState.user;
  const statusLabel = user.hasActiveSubscription ? `${planName(user.planId)} plan` : "Free trial";
  accountStatus.textContent = `${user.email} · ${statusLabel}`;
  subscriptionNotice.textContent = buildSubscriptionNotice(user);
  adminLink?.classList.toggle("hidden", !user.isAdmin);
  loginLink.classList.add("hidden");
  logoutButton.classList.remove("hidden");
  billingButton.classList.toggle("hidden", !user.hasActiveSubscription);
}

function buildSubscriptionNotice(user) {
  if (user.hasActiveSubscription) {
    return `${user.searchesUsed}/${user.searchLimit} searches used this month. ${user.canSearch ? "Search is available." : "Upgrade to continue searching."}`;
  }

  if (user.trialActive) {
    return `${user.searchesUsed}/${user.searchLimit} searches used today. ${user.trialDaysRemaining} trial day${user.trialDaysRemaining === 1 ? "" : "s"} remaining. ${user.canSearch ? "Search is available." : "Daily trial limit reached."}`;
  }

  return "Trial expired. Upgrade to continue searching.";
}

function ensureSearchAccess() {
  if (!saasState.apiAvailable) {
    setStatus("Start the SaaS server with npm start, then search through http://localhost:4173.", true);
    return false;
  }

  if (!saasState.user) {
    setStatus("Sign in to run lead searches.", true);
    window.location.href = "/auth.html?mode=login";
    return false;
  }

  if (!saasState.user.canSearch) {
    setStatus("Upgrade to continue searching leads.", true);
    return false;
  }

  return true;
}

function ensureExportAccess() {
  if (!saasState.apiAvailable || !saasState.user) {
    setStatus("Sign in before exporting leads.", true);
    window.location.href = "/auth.html?mode=login";
    return false;
  }

  return true;
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

function planName(planId) {
  return saasState.plans.find((plan) => plan.id === planId)?.name || "Paid";
}

function prefillSearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  const location = params.get("location");
  const radius = params.get("radius");
  const limit = params.get("limit");

  if (category) categoryInput.value = category;
  if (location) locationInput.value = location;
  if (radius && hasOption(radiusInput, radius)) radiusInput.value = radius;
  if (limit && hasOption(limitInput, limit)) limitInput.value = limit;
}

function hasOption(select, value) {
  return Array.from(select.options).some((option) => option.value === value);
}

async function runSearch() {
  const category = categoryInput.value.trim();
  const location = locationInput.value.trim();
  const radius = Number(radiusInput.value);
  const limit = Number(limitInput.value);

  if (!category || !location) return;
  if (!ensureSearchAccess()) return;

  setBusy(true);
  setStatus(`Finding ${category} around ${location} within ${formatRadius(radius)}...`);
  lastSearchName = `${category}-${location}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

  try {
    if (saasState.apiAvailable) {
      const data = await apiRequest("/api/search", {
        method: "POST",
        body: {
          category,
          location,
          radius,
          limit,
          saveSearchProgress: saveSearchProgressInput ? saveSearchProgressInput.checked : true,
        },
      });

      allResults = data.leads || [];
      if (data.user) saasState.user = data.user;
      clearFilters();
      applyFilters();
      renderSaasState();

      const leadWord = allResults.length === 1 ? "lead" : "leads";
      setStatus(buildSearchStatus({ count: allResults.length, leadWord, place: data.place, progress: data.searchProgress }));
      return;
    }

    const place = await geocodeLocation(location);
    const scaleNote =
      radius >= 50000 || limit >= 1000 ? " Larger searches can take a little longer." : "";
    setStatus(`Searching public map data near ${place.displayName}.${scaleNote}`);

    const osmElements = await searchOverpass({
      category,
      place,
      radius,
      limit,
    });

    const parsed = dedupeLeads(osmElements
      .map((element) => parseLead(element, place))
      .filter(Boolean))
      .sort(compareLeads)
      .slice(0, limit);

    allResults = parsed;
    clearFilters();
    applyFilters();

    const leadWord = allResults.length === 1 ? "lead" : "leads";
    const rankingNote = allResults.length ? " Best contact records are shown first." : "";
    setStatus(`Found ${allResults.length} ${leadWord} near ${place.displayName}.${rankingNote}`);
  } catch (error) {
    console.error(error);
    allResults = [];
    filteredResults = [];
    updateCounters([]);
    renderResults([]);
    setStatus(error.message || "Search failed.", true);
  } finally {
    setBusy(false);
  }
}

function buildSearchStatus({ count, leadWord, place, progress }) {
  const base = `Found ${count} ${leadWord} near ${place.displayName}.`;
  if (!progress?.requested) return `${base} Best contact records are shown first.`;
  if (progress.warning) return `${base} ${progress.warning} Best contact records are shown first.`;
  if (progress.reset) {
    return `${base} You reached the end of saved results for this search, so this starts a fresh cycle.`;
  }
  if (progress.skippedSeenCount > 0) {
    return `${base} Showing the next batch and skipping ${progress.skippedSeenCount} already shown lead${progress.skippedSeenCount === 1 ? "" : "s"}.`;
  }
  return `${base} This search is saved, so the next run can show new results.`;
}

async function geocodeLocation(location) {
  const coordinates = parseCoordinates(location);
  if (coordinates) return coordinates;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", location);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Could not reach the location search service.");
  }

  const places = await response.json();
  if (!places.length) {
    throw new Error(`No location found for "${location}".`);
  }

  return {
    lat: Number(places[0].lat),
    lon: Number(places[0].lon),
    displayName: places[0].display_name.split(",").slice(0, 3).join(","),
  };
}

function parseCoordinates(location) {
  const match = location
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

  if (!match) return null;

  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return {
    lat,
    lon,
    displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
}

async function searchOverpass({ category, place, radius, limit }) {
  const plans = buildSearchPlans({ category, place, radius, limit });
  const rawTarget = Math.min(Math.max(limit * 3, 350), 9000);
  const elementsById = new Map();
  let successfulRequests = 0;
  let lastError;

  for (const plan of plans) {
    if (elementsById.size >= rawTarget) break;

    setStatus(
      `Searching ${plan.label} near ${place.displayName}... ${elementsById.size.toLocaleString()} raw matches found.`,
    );

    try {
      const elements = await fetchOverpass(plan.query, plan.timeoutMs);
      successfulRequests += 1;

      for (const element of elements) {
        elementsById.set(`${element.type}/${element.id}`, element);
      }
    } catch (error) {
      lastError = error;
      console.warn(error);
    }
  }

  if (!successfulRequests && lastError) {
    throw new Error(
      "The public map search service is busy or the search is too broad. Try a smaller radius or lower limit.",
    );
  }

  return Array.from(elementsById.values());
}

function buildSearchPlans({ category, place, radius, limit }) {
  const selectorGroups = getSelectorGroups(category);
  if (!selectorGroups.primary.length) {
    throw new Error("Enter a more specific category to search.");
  }

  const radiusSteps = getRadiusSteps(radius, limit);
  const plans = [];

  for (const radiusStep of radiusSteps) {
    plans.push(
      createOverpassPlan({
        label: `${selectorGroups.label} within ${formatRadius(radiusStep)}`,
        selectors: selectorGroups.primary,
        lat: place.lat,
        lon: place.lon,
        radius: radiusStep,
        limit,
        isFallback: false,
      }),
    );
  }

  for (const radiusStep of radiusSteps) {
    if (!selectorGroups.fallback.length) continue;

    plans.push(
      createOverpassPlan({
        label: `keyword fallback within ${formatRadius(radiusStep)}`,
        selectors: selectorGroups.fallback,
        lat: place.lat,
        lon: place.lon,
        radius: radiusStep,
        limit,
        isFallback: true,
      }),
    );
  }

  return plans;
}

function createOverpassPlan({ label, selectors, lat, lon, radius, limit, isFallback }) {
  return {
    label,
    query: buildOverpassQuery({ selectors, lat, lon, radius, limit, isFallback }),
    timeoutMs: getRequestTimeoutMs(radius, limit),
  };
}

function buildOverpassQuery({ selectors, lat, lon, radius, limit, isFallback }) {
  const clauses = [...new Set(selectors)]
    .map((selector) => `nwr(around:${radius},${lat},${lon})["name"]${selector};`)
    .join("\n  ");

  const outputLimit = getOutputLimit(limit, isFallback);
  const timeout = getOverpassTimeoutSeconds(radius, limit);

  return `
[out:json][timeout:${timeout}];
(
  ${clauses}
);
out tags center qt ${outputLimit};
`;
}

function getSelectorGroups(category) {
  const normalized = normalize(category);
  const preset = findCategoryPreset(normalized);
  const keywordSelectors = getKeywordSelectors(normalized);

  if (preset) {
    return {
      label: preset.aliases[0],
      primary: preset.selectors.map(([key, values]) => buildTagValueSelector(key, values)),
      fallback: keywordSelectors,
    };
  }

  return {
    label: "business tags",
    primary: keywordSelectors,
    fallback: getNameFallbackSelectors(normalized),
  };
}

function findCategoryPreset(normalizedCategory) {
  return CATEGORY_PRESETS.find((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      const canUsePartialAlias = normalizedCategory.length >= 4;
      return (
        normalizedCategory === normalizedAlias ||
        normalizedCategory.includes(normalizedAlias) ||
        (canUsePartialAlias && normalizedAlias.includes(normalizedCategory))
      );
    }),
  );
}

function getKeywordSelectors(normalizedCategory) {
  const pattern = getCategoryPattern(normalizedCategory);
  if (!pattern) return [];

  return [
    `[~"^(${BUSINESS_TAG_KEYS.join("|")})$"~"${pattern}",i]`,
    `["name"~"${pattern}",i]`,
    `["brand"~"${pattern}",i]`,
    `["operator"~"${pattern}",i]`,
  ];
}

function getNameFallbackSelectors(normalizedCategory) {
  const pattern = getCategoryPattern(normalizedCategory);
  if (!pattern) return [];

  return [
    `["name"~"${pattern}",i]`,
    `["brand"~"${pattern}",i]`,
    `["operator"~"${pattern}",i]`,
    `["description"~"${pattern}",i]`,
  ];
}

function getCategoryPattern(normalizedCategory) {
  const words = normalizedCategory
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !CATEGORY_STOP_WORDS.has(word))
    .slice(0, 4);

  return words.length ? words.map(escapeOverpassRegex).join("|") : escapeOverpassRegex(normalizedCategory);
}

function buildTagValueSelector(key, values) {
  const valueRegex = values.map(escapeOverpassRegex).join("|");
  return `["${key}"~"^(${valueRegex})$"]`;
}

function getRadiusSteps(radius, limit) {
  const breakpoints = limit > 500 ? [10000, 50000, 100000, 250000] : [3000, 10000, 25000, 50000, 100000, 250000];
  const steps = breakpoints.filter((step) => step < radius);
  steps.push(radius);
  return [...new Set(steps)];
}

function getOutputLimit(limit, isFallback) {
  const requested = Math.max(limit * (isFallback ? 2 : 4), 400);
  return Math.min(requested, isFallback ? 3500 : 12000);
}

function getOverpassTimeoutSeconds(radius, limit) {
  if (radius >= 100000 || limit >= 2000) return 90;
  if (radius >= 50000 || limit >= 1000) return 60;
  return 35;
}

function getRequestTimeoutMs(radius, limit) {
  return (getOverpassTimeoutSeconds(radius, limit) + 12) * 1000;
}

async function fetchOverpass(query, timeoutMs) {
  let lastError;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Data service returned ${response.status}.`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("Search request timed out.") : error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  throw new Error(lastError?.message || "Could not reach the map data service.");
}

function parseLead(element, place) {
  const tags = element.tags || {};
  const name = clean(tags.name);
  if (!name) return null;

  const lat = Number(element.lat ?? element.center?.lat);
  const lon = Number(element.lon ?? element.center?.lon);
  const categories = extractCategories(tags);
  const email = firstTag(tags, ["contact:email", "email", "operator:email"]);
  const phone = firstTag(tags, [
    "contact:phone",
    "phone",
    "contact:mobile",
    "mobile",
    "phone:mobile",
    "contact:whatsapp",
    "operator:phone",
  ]);
  const website = normalizeWebsite(firstTag(tags, ["contact:website", "website", "url", "official_website"]));
  const address = buildAddress(tags);

  return {
    id: `${element.type}/${element.id}`,
    name,
    categories,
    email,
    phone,
    website,
    hasWebsite: Boolean(website),
    address,
    lat,
    lon,
    distanceMeters: Number.isFinite(lat) && Number.isFinite(lon)
      ? haversineMeters(place.lat, place.lon, lat, lon)
      : Number.POSITIVE_INFINITY,
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

function dedupeLeads(leads) {
  const seen = new Set();
  return leads.filter((lead) => {
    const key = `${normalize(lead.name)}|${lead.address || `${lead.lat},${lead.lon}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareLeads(a, b) {
  return (
    getLeadScore(b) - getLeadScore(a) ||
    a.distanceMeters - b.distanceMeters ||
    a.name.localeCompare(b.name)
  );
}

function getLeadScore(lead) {
  let score = 0;
  if (lead.phone) score += 4;
  if (lead.email) score += 4;
  if (lead.website) score += 2;
  if (lead.address) score += 1;
  if (lead.categories.length) score += 1;
  return score;
}

function extractCategories(tags) {
  const keys = [...BUSINESS_TAG_KEYS, "cuisine"];
  return keys
    .map((key) => tags[key])
    .filter(Boolean)
    .map((value) => String(value).replace(/_/g, " "));
}

function firstTag(tags, keys) {
  for (const key of keys) {
    const value = clean(tags[key]);
    if (value) return value;
  }
  return "";
}

function buildAddress(tags) {
  const streetLine = [tags["addr:street"], tags["addr:housenumber"]]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const cityLine = [tags["addr:postcode"], tags["addr:city"]]
    .map(clean)
    .filter(Boolean)
    .join(" ");

  return [streetLine, cityLine].filter(Boolean).join(", ");
}

function normalizeWebsite(url) {
  const cleaned = clean(url);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}

function applyFilters() {
  filteredResults = window.LeadFilters.filterLeads(allResults, {
    withEmail: filters.withEmail.checked,
    withPhone: filters.withPhone.checked,
    withWebsite: filters.withWebsite.checked,
    withoutWebsite: filters.withoutWebsite.checked,
  });

  updateCounters(filteredResults);
  renderResults(filteredResults);
  exportButton.disabled = filteredResults.length === 0;
  updateExportButton();
}

function syncExclusiveWebsiteFilters(changedInput) {
  if (changedInput === filters.withWebsite && filters.withWebsite.checked) {
    filters.withoutWebsite.checked = false;
  }

  if (changedInput === filters.withoutWebsite && filters.withoutWebsite.checked) {
    filters.withWebsite.checked = false;
  }
}

function clearFilters() {
  Object.values(filters).forEach((input) => {
    input.checked = false;
  });
}

function updateCounters(leads) {
  counters.total.textContent = leads.length;
  counters.email.textContent = leads.filter((lead) => lead.email).length;
  counters.phone.textContent = leads.filter((lead) => lead.phone).length;
  counters.missingWebsite.textContent = leads.filter((lead) => !window.LeadFilters.leadHasWebsite(lead)).length;
}

function renderResults(leads) {
  resultsBody.replaceChildren();

  if (!leads.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    row.innerHTML = `<td colspan="7">${allResults.length ? "No leads match the active filters." : "No leads found yet."}</td>`;
    resultsBody.append(row);
    return;
  }

  for (const lead of leads) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="business-name">
          <strong>${escapeHtml(lead.name)}</strong>
          <a class="osm-link" href="${lead.osmUrl}" target="_blank" rel="noreferrer">Open source record</a>
        </div>
      </td>
      <td>${renderTags(lead.categories)}</td>
      <td>${lead.email ? mailto(lead.email) : emptyValue()}</td>
      <td>${lead.phone ? phoneLink(lead.phone) : emptyValue()}</td>
      <td>${websiteCell(lead)}</td>
      <td>${lead.address ? escapeHtml(lead.address) : emptyValue()}</td>
      <td>${formatDistance(lead.distanceMeters)}</td>
    `;
    resultsBody.append(row);
  }
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
  const href = phone.replace(/[^\d+]/g, "");
  return `<a class="contact-link" href="tel:${href}">${safePhone}</a>`;
}

function websiteCell(lead) {
  if (!lead.website) {
    return `<span class="tag warn">No listing</span>`;
  }

  return `<a class="contact-link" href="${escapeAttribute(lead.website)}" target="_blank" rel="noreferrer">Website</a>`;
}

function emptyValue() {
  return `<span class="muted">-</span>`;
}

function exportCsv(leads) {
  const exportData = exportFormatInput.value === "quo" ? buildQuoCsv(leads) : buildLeadCsv(leads);
  const csv = [exportData.headers, ...exportData.rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix = exportFormatInput.value === "quo" ? "quo-contacts" : "lead-list";
  link.href = url;
  link.download = `${lastSearchName || "client-leads"}-${suffix}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildLeadCsv(leads) {
  const headers = [
    "Business",
    "Category",
    "Email",
    "Phone",
    "Website listed",
    "Website",
    "Address",
    "Distance km",
    "Source",
  ];

  const rows = leads.map((lead) => [
    lead.name,
    lead.categories.join("; "),
    lead.email,
    lead.phone,
    lead.hasWebsite ? "Yes" : "No",
    lead.website,
    lead.address,
    Number.isFinite(lead.distanceMeters) ? (lead.distanceMeters / 1000).toFixed(2) : "",
    lead.osmUrl,
  ]);

  return { headers, rows };
}

function buildQuoCsv(leads) {
  const headers = [
    "First Name",
    "Last Name",
    "Company",
    "Title",
    "Phone",
    "Email",
    "Website",
    "Location",
    "Lead Category",
    "Website Listed",
    "Source URL",
    "Notes",
  ];

  const rows = leads.slice(0, 3000).map((lead) => [
    lead.name,
    "",
    lead.name,
    "Business lead",
    normalizePhoneForQuo(lead.phone),
    lead.email,
    lead.website,
    lead.address,
    lead.categories.join("; "),
    lead.hasWebsite ? "Yes" : "No",
    lead.osmUrl,
    buildQuoNotes(lead),
  ]);

  return { headers, rows };
}

function buildQuoNotes(lead) {
  const notes = [
    "Imported from Client Contact Finder.",
    `Website listed: ${lead.hasWebsite ? "Yes" : "No"}.`,
  ];

  if (Number.isFinite(lead.distanceMeters)) {
    notes.push(`Distance from search center: ${(lead.distanceMeters / 1000).toFixed(2)} km.`);
  }

  return notes.join(" ");
}

function normalizePhoneForQuo(phone) {
  const cleaned = clean(phone);
  if (!cleaned) return "";

  const compact = cleaned.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;

  const countryCode = countryCodeInput.value.trim().replace(/[^\d+]/g, "");
  const countryDigits = countryCode.replace(/^\+/, "");
  if (compact.startsWith("00")) return `+${compact.replace(/^00+/, "")}`;
  if (!countryDigits) return compact;
  if (compact.startsWith(countryDigits)) return `+${compact}`;

  const localNumber = compact.replace(/^0+/, "");
  return `+${countryDigits}${localNumber}`;
}

function updateExportButton() {
  const prefix = exportFormatInput.value === "quo" ? "Export Quo CSV" : "Export CSV";
  exportButton.innerHTML = `<span class="export-icon" aria-hidden="true"></span> ${prefix}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function setBusy(isBusy) {
  form.querySelector("button").disabled = isBusy;
  form.querySelector("button").innerHTML = isBusy
    ? `<span aria-hidden="true">...</span> Searching`
    : `<span class="search-icon" aria-hidden="true"></span> Find clients`;
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.className = isError ? "error" : "";
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return emptyValue();
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatRadius(meters) {
  if (meters < 1000) return `${meters} m`;
  return `${Number(meters / 1000).toLocaleString()} km`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(value) {
  return String(value || "").trim();
}

function escapeOverpassRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
