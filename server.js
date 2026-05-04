const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  buildSavedSearchKey,
  selectLeadBatch,
} = require("./search-cursor");

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4173);
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_EMAILS = parseAdminEmails(process.env.ADMIN_EMAILS || "");
const COOKIE_OPTIONS = `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${APP_URL.startsWith("https://") ? "; Secure" : ""}`;

const PUBLIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.html", "app.html"],
  ["/admin.html", "admin.html"],
  ["/auth.html", "auth.html"],
  ["/searches.html", "searches.html"],
  ["/search-detail.html", "search-detail.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/admin.js", "admin.js"],
  ["/auth.js", "auth.js"],
  ["/landing.js", "landing.js"],
  ["/lead-filters.js", "lead-filters.js"],
  ["/searches.js", "searches.js"],
  ["/search-detail.js", "search-detail.js"],
]);

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$19/mo",
    searchLimit: 60,
    exportLimit: 60,
    priceEnv: "STRIPE_PRICE_STARTER",
    description: "For solo prospecting and small local campaigns.",
  },
  {
    id: "growth",
    name: "Growth",
    priceLabel: "$39/mo",
    searchLimit: 300,
    exportLimit: 300,
    priceEnv: "STRIPE_PRICE_GROWTH",
    description: "For agencies and growing sales teams.",
  },
  {
    id: "agency",
    name: "Agency",
    priceLabel: "$99/mo",
    searchLimit: 900,
    exportLimit: 900,
    priceEnv: "STRIPE_PRICE_AGENCY",
    description: "For higher-volume client acquisition.",
  },
];

const FREE_LIMIT = 3;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const MAP_SERVICE_HEADERS = {
  Accept: "application/json",
  "User-Agent": "LeadPilot/1.0 (local lead finder; contact: local-development)",
  Referer: APP_URL,
};

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
  { aliases: ["restaurant", "restaurants", "food", "places to eat"], selectors: [["amenity", ["restaurant", "fast_food", "food_court"]], ["shop", ["deli", "pastry"]]] },
  { aliases: ["cafe", "coffee", "coffee shop", "cafes"], selectors: [["amenity", ["cafe"]]] },
  { aliases: ["pizza", "pizzeria"], selectors: [["cuisine", ["pizza"]]] },
  { aliases: ["bar", "pub", "nightlife"], selectors: [["amenity", ["bar", "pub", "biergarten", "nightclub"]]] },
  { aliases: ["dentist", "dentists", "dental"], selectors: [["amenity", ["dentist"]], ["healthcare", ["dentist"]]] },
  { aliases: ["doctor", "doctors", "clinic", "medical"], selectors: [["amenity", ["clinic", "doctors", "hospital"]], ["healthcare", ["clinic", "doctor", "hospital"]]] },
  { aliases: ["pharmacy", "pharmacies"], selectors: [["amenity", ["pharmacy"]], ["healthcare", ["pharmacy"]]] },
  { aliases: ["veterinarian", "vet", "veterinary"], selectors: [["amenity", ["veterinary"]], ["healthcare", ["veterinary"]]] },
  { aliases: ["hotel", "hotels", "accommodation"], selectors: [["tourism", ["hotel", "motel", "guest_house", "hostel", "apartment"]]] },
  { aliases: ["lawyer", "lawyers", "law firm", "attorney"], selectors: [["office", ["lawyer"]]] },
  { aliases: ["real estate", "realtor", "estate agent", "property"], selectors: [["office", ["estate_agent"]]] },
  { aliases: ["accountant", "accountants", "bookkeeper", "accounting"], selectors: [["office", ["accountant", "tax_advisor"]]] },
  { aliases: ["insurance", "insurance agency"], selectors: [["office", ["insurance"]]] },
  { aliases: ["marketing", "marketing agency", "advertising", "advertising agency"], selectors: [["office", ["advertising_agency"]]] },
  { aliases: ["architect", "architects", "architecture", "architecture firm"], selectors: [["office", ["architect"]]] },
  { aliases: ["it", "software", "software company", "technology", "tech company"], selectors: [["office", ["it"]]] },
  { aliases: ["bank", "banks"], selectors: [["amenity", ["bank"]]] },
  { aliases: ["gym", "fitness", "fitness centre", "fitness center"], selectors: [["leisure", ["fitness_centre", "sports_centre"]]] },
  { aliases: ["beauty", "beauty salon", "hairdresser", "hair salon"], selectors: [["shop", ["beauty", "hairdresser", "cosmetics"]]] },
  { aliases: ["spa", "massage", "wellness"], selectors: [["shop", ["massage", "beauty"]], ["leisure", ["spa"]]] },
  { aliases: ["car repair", "auto repair", "mechanic", "garage"], selectors: [["shop", ["car_repair", "tyres", "car_parts"]], ["craft", ["mechanic"]]] },
  { aliases: ["car dealer", "car dealership", "auto dealer"], selectors: [["shop", ["car"]]] },
  { aliases: ["car wash", "carwash"], selectors: [["amenity", ["car_wash"]]] },
  { aliases: ["plumber", "plumbing"], selectors: [["craft", ["plumber"]]] },
  { aliases: ["electrician", "electrical"], selectors: [["craft", ["electrician"]]] },
  { aliases: ["construction", "builder", "builders", "contractor"], selectors: [["craft", ["builder", "carpenter", "roofer"]], ["office", ["construction_company"]]] },
  { aliases: ["cleaning", "cleaning service", "laundry", "dry cleaner"], selectors: [["shop", ["laundry", "dry_cleaning"]], ["craft", ["cleaner"]]] },
  { aliases: ["bakery", "bakeries"], selectors: [["shop", ["bakery", "pastry"]]] },
  { aliases: ["supermarket", "grocery", "market"], selectors: [["shop", ["supermarket", "convenience", "greengrocer"]]] },
  { aliases: ["clothing", "fashion", "clothes"], selectors: [["shop", ["clothes", "fashion", "shoes", "boutique"]]] },
  { aliases: ["electronics", "phone shop", "mobile phone"], selectors: [["shop", ["electronics", "mobile_phone", "computer"]]] },
  { aliases: ["furniture", "home furniture"], selectors: [["shop", ["furniture", "interior_decoration", "kitchen"]]] },
  { aliases: ["florist", "flowers", "flower shop"], selectors: [["shop", ["florist"]]] },
  { aliases: ["travel", "travel agency", "tour agency"], selectors: [["office", ["travel_agent"]], ["shop", ["travel_agency"]]] },
  { aliases: ["school", "education", "training"], selectors: [["amenity", ["school", "college", "university", "language_school"]], ["office", ["educational_institution"]]] },
];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, APP_URL);

    if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
      return await handleStripeWebhook(req, res);
    }

    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }

    return await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: error.message || "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Client Contact Finder SaaS running at ${APP_URL}`);
});

async function handleApi(req, res, url) {
  if (url.pathname === "/api/me" && req.method === "GET") {
    const user = await getUserFromRequest(req, res);
    return json(res, 200, {
      user: user ? publicUser(user.profile, user.authUser) : null,
      plans: publicPlans(),
      stripeConfigured: hasStripeConfig(),
      supabaseConfigured: hasSupabaseConfig(),
    });
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    if (!hasSupabaseConfig()) return json(res, 503, { error: "Supabase is not configured yet." });
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!isValidEmail(email) || password.length < 8) {
      return json(res, 400, { error: "Use a valid email and a password with at least 8 characters." });
    }

    const data = await supabaseAuthRequest("/signup", {
      method: "POST",
      body: { email, password },
    });

    if (data.user) await ensureProfile(data.user);
    if (data.access_token) setAuthCookies(res, data);

    const profile = data.user ? await getProfile(data.user.id) : null;
    return json(res, 201, {
      user: data.access_token && profile ? publicUser(profile, data.user) : null,
      needsEmailConfirmation: Boolean(data.user && !data.access_token),
      plans: publicPlans(),
      stripeConfigured: hasStripeConfig(),
      supabaseConfigured: hasSupabaseConfig(),
    });
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    if (!hasSupabaseConfig()) return json(res, 503, { error: "Supabase is not configured yet." });
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    const data = await supabaseAuthRequest("/token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    setAuthCookies(res, data);
    const profile = await ensureProfile(data.user);

    return json(res, 200, {
      user: publicUser(profile, data.user),
      plans: publicPlans(),
      stripeConfigured: hasStripeConfig(),
      supabaseConfigured: hasSupabaseConfig(),
    });
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const accessToken = parseCookies(req.headers.cookie || "").ccf_access_token;
    if (accessToken && hasSupabaseConfig()) {
      await supabaseAuthRequest("/logout", {
        method: "POST",
        accessToken,
      }).catch(() => {});
    }
    clearAuthCookies(res);
    return json(res, 200, { ok: true });
  }

  if (url.pathname === "/api/admin/summary" && req.method === "GET") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const [profiles, subscriptions, savedSearches] = await Promise.all([
      listAdminProfiles(),
      listAdminSubscriptions(),
      listAdminSavedSearches(),
    ]);

    return json(res, 200, {
      summary: buildAdminSummary({ profiles, subscriptions, savedSearches }),
      user: publicUser(admin.profile, admin.authUser),
    });
  }

  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const users = await listAdminProfiles();
    return json(res, 200, {
      users: users.map(publicAdminUser),
      user: publicUser(admin.profile, admin.authUser),
    });
  }

  if (url.pathname === "/api/search" && req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;

    let profile = resetUsageIfNeeded(user.profile);
    if (profile !== user.profile) {
      profile = await updateProfile(profile.user_id, profile);
      user.profile = profile;
    }

    if (!canSearch(user.profile)) {
      return json(res, 402, {
        error: "Upgrade to continue searching leads this month.",
        user: publicUser(user.profile, user.authUser),
      });
    }

    const body = await readJson(req);
    const category = clean(body.category);
    const location = clean(body.location);
    const radius = clampNumber(body.radius, 1000, 250000, 3000);
    const limit = Math.min(clampNumber(body.limit, 25, 3000, 50), getPlanLimit(user.profile));

    if (!category || !location) {
      return json(res, 400, { error: "Category and location are required." });
    }

    const saveSearchProgress = body.saveSearchProgress !== false;
    const place = await geocodeLocation(location);
    const searchKey = buildSavedSearchKey({ category, place, radius });
    let savedSearch = null;
    let savedSearchWarning = "";

    if (saveSearchProgress) {
      try {
        savedSearch = await getSavedSearch(user.authUser.id, searchKey);
      } catch (error) {
        savedSearchWarning = "Saved search progress is not set up yet.";
        console.warn(error.message);
      }
    }

    const seenLeadIds = Array.isArray(savedSearch?.seen_lead_ids) ? savedSearch.seen_lead_ids : [];
    const searchDepthLimit = saveSearchProgress && !savedSearchWarning
      ? getSearchDepthLimit(limit, seenLeadIds.length)
      : limit;
    const osmElements = await searchOverpass({ category, place, radius, limit: searchDepthLimit });
    const rankedLeads = dedupeLeads(osmElements.map((element) => parseLead(element, place)).filter(Boolean))
      .sort(compareLeads);
    const batch = saveSearchProgress && !savedSearchWarning
      ? selectLeadBatch({ leads: rankedLeads, seenLeadIds, limit })
      : {
        leads: rankedLeads.slice(0, limit),
        nextSeenLeadIds: [],
        skippedSeenCount: 0,
        reset: false,
        exhausted: rankedLeads.length <= limit,
        availableCount: rankedLeads.length,
        freshCount: rankedLeads.length,
      };

    if (saveSearchProgress && !savedSearchWarning) {
      try {
        await upsertSavedSearch({
          user_id: user.authUser.id,
          search_key: searchKey,
          category,
          location,
          location_display_name: place.displayName,
          radius_meters: radius,
          seen_lead_ids: batch.nextSeenLeadIds,
          last_leads: batch.leads,
          last_result_count: batch.leads.length,
          last_skipped_count: batch.skippedSeenCount,
          reset_count: (savedSearch?.reset_count || 0) + (batch.reset ? 1 : 0),
        });
      } catch (error) {
        savedSearchWarning = "Saved search progress could not be updated.";
        console.warn(error.message);
      }
    }

    user.profile = await updateProfile(user.profile.user_id, {
      searches_used: (user.profile.searches_used || 0) + 1,
      usage_period: user.profile.usage_period,
    });

    return json(res, 200, {
      place,
      leads: batch.leads,
      searchProgress: {
        enabled: saveSearchProgress && !savedSearchWarning,
        requested: saveSearchProgress,
        key: searchKey,
        skippedSeenCount: batch.skippedSeenCount,
        savedCount: batch.nextSeenLeadIds.length,
        availableCount: batch.availableCount,
        freshCount: batch.freshCount,
        reset: batch.reset,
        exhausted: batch.exhausted,
        warning: savedSearchWarning,
      },
      user: publicUser(user.profile, user.authUser),
    });
  }

  if (url.pathname === "/api/saved-searches" && req.method === "GET") {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      const searches = await listSavedSearches(user.authUser.id);
      return json(res, 200, { searches: searches.map(publicSavedSearch) });
    } catch (error) {
      console.warn(error.message);
      return json(res, 503, {
        error: "Previous searches are not set up yet. Run supabase-schema.sql in Supabase, then save a search.",
      });
    }
  }

  if (url.pathname === "/api/saved-search" && req.method === "GET") {
    const user = await requireUser(req, res);
    if (!user) return;

    const searchKey = clean(url.searchParams.get("searchKey"));
    if (!searchKey) return json(res, 400, { error: "Search key is required." });

    try {
      const search = await getSavedSearchByKey(user.authUser.id, searchKey);
      if (!search) return json(res, 404, { error: "Saved search was not found." });
      return json(res, 200, { search: publicSavedSearchDetail(search) });
    } catch (error) {
      console.warn(error.message);
      return json(res, 503, {
        error: "Saved search details are not set up yet. Run supabase-schema.sql in Supabase, then run this search again.",
      });
    }
  }

  if (url.pathname === "/api/stripe/create-checkout-session" && req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!hasStripeConfig()) return json(res, 503, { error: "Stripe is not configured yet." });

    const body = await readJson(req);
    const plan = PLANS.find((item) => item.id === body.planId);
    const priceId = plan ? process.env[plan.priceEnv] : "";
    if (!plan || !priceId) return json(res, 400, { error: "Unknown or unconfigured plan." });

    if (!user.profile.stripe_customer_id) {
      const customer = await stripeRequest("/v1/customers", {
        email: user.authUser.email,
        "metadata[userId]": user.authUser.id,
      });
      user.profile = await updateProfile(user.authUser.id, { stripe_customer_id: customer.id });
    }

    const session = await stripeRequest("/v1/checkout/sessions", {
      mode: "subscription",
      customer: user.profile.stripe_customer_id,
      client_reference_id: user.authUser.id,
      success_url: `${APP_URL}/app.html?checkout=success`,
      cancel_url: `${APP_URL}/app.html?checkout=cancelled`,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "metadata[userId]": user.authUser.id,
      "metadata[planId]": plan.id,
      "subscription_data[metadata][userId]": user.authUser.id,
      "subscription_data[metadata][planId]": plan.id,
      allow_promotion_codes: "true",
    });

    return json(res, 200, { url: session.url });
  }

  if (url.pathname === "/api/stripe/create-portal-session" && req.method === "POST") {
    const user = await requireUser(req, res);
    if (!user) return;
    if (!hasStripeConfig()) return json(res, 503, { error: "Stripe is not configured yet." });
    if (!user.profile.stripe_customer_id) return json(res, 400, { error: "No Stripe customer found yet." });

    const session = await stripeRequest("/v1/billing_portal/sessions", {
      customer: user.profile.stripe_customer_id,
      return_url: `${APP_URL}/app.html`,
    });

    return json(res, 200, { url: session.url });
  }

  return json(res, 404, { error: "Not found." });
}

async function handleStripeWebhook(req, res) {
  const rawBody = await readRaw(req);
  const signature = req.headers["stripe-signature"];

  if (!STRIPE_WEBHOOK_SECRET) {
    return json(res, 503, { error: "Stripe webhook secret is not configured." });
  }

  if (!verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET)) {
    return json(res, 400, { error: "Invalid Stripe signature." });
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const userId = object.client_reference_id || object.metadata?.userId;
    const planId = object.metadata?.planId || "starter";
    if (userId) {
      await updateProfile(userId, {
        stripe_customer_id: object.customer || "",
        stripe_subscription_id: object.subscription || "",
        subscription_status: "active",
        plan_id: planId,
      });
      await upsertSubscription({
        subscription_id: object.subscription || object.id,
        user_id: userId,
        stripe_customer_id: object.customer || "",
        plan_id: planId,
        status: "active",
        current_period_end: null,
      });
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const priceId = object.items?.data?.[0]?.price?.id;
    const planId = getPlanIdByPrice(priceId) || object.metadata?.planId || "starter";
    const userId = object.metadata?.userId || (await getProfileByCustomer(object.customer))?.user_id;
    if (userId) {
      await updateProfile(userId, {
        stripe_customer_id: object.customer || "",
        stripe_subscription_id: object.id,
        subscription_status: object.status,
        plan_id: planId,
      });
      await upsertSubscription({
        subscription_id: object.id,
        user_id: userId,
        stripe_customer_id: object.customer || "",
        plan_id: planId,
        status: object.status,
        current_period_end: object.current_period_end
          ? new Date(object.current_period_end * 1000).toISOString()
          : null,
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const userId = object.metadata?.userId || (await getProfileByCustomer(object.customer))?.user_id;
    if (userId) {
      await updateProfile(userId, {
        subscription_status: "canceled",
        plan_id: "free",
        stripe_subscription_id: "",
      });
      await upsertSubscription({
        subscription_id: object.id,
        user_id: userId,
        stripe_customer_id: object.customer || "",
        plan_id: "free",
        status: "canceled",
        current_period_end: object.current_period_end
          ? new Date(object.current_period_end * 1000).toISOString()
          : null,
      });
    }
  }

  return json(res, 200, { received: true });
}

async function serveStatic(res, pathname) {
  const filename = PUBLIC_FILES.get(pathname);
  if (!filename) return json(res, 404, { error: "Not found." });

  const filePath = path.join(__dirname, filename);
  const content = await fs.readFile(filePath);
  const ext = path.extname(filename);
  const contentType = ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
  res.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` });
  res.end(content);
}

function publicPlans() {
  return PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceLabel: plan.priceLabel,
    searchLimit: plan.searchLimit,
    exportLimit: plan.exportLimit,
    description: plan.description,
    configured: Boolean(process.env[plan.priceEnv]),
  }));
}

function publicUser(profile, authUser) {
  const currentProfile = resetUsageIfNeeded(profile);
  const isAdmin = isAdminUser(currentProfile, authUser);
  return {
    email: authUser.email || currentProfile.email,
    role: isAdmin ? "admin" : currentProfile.role || "user",
    isAdmin: isAdminUser(currentProfile, authUser),
    planId: currentProfile.plan_id || "free",
    subscriptionStatus: currentProfile.subscription_status || "free",
    searchesUsed: currentProfile.searches_used || 0,
    searchLimit: getPlanLimit(currentProfile),
    hasActiveSubscription: hasActiveSubscription(currentProfile),
    canSearch: canSearch(currentProfile),
  };
}

function setAuthCookies(res, session) {
  const cookies = [];
  if (session.access_token) {
    cookies.push(`ccf_access_token=${encodeURIComponent(session.access_token)}; ${COOKIE_OPTIONS}`);
  }
  if (session.refresh_token) {
    cookies.push(`ccf_refresh_token=${encodeURIComponent(session.refresh_token)}; ${COOKIE_OPTIONS}`);
  }
  res.setHeader("Set-Cookie", cookies);
}

function clearAuthCookies(res) {
  res.setHeader("Set-Cookie", [
    `ccf_access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    `ccf_refresh_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  ]);
}

async function getUserFromRequest(req, res) {
  if (!hasSupabaseConfig()) return null;
  const cookies = parseCookies(req.headers.cookie || "");
  let accessToken = cookies.ccf_access_token;
  const refreshToken = cookies.ccf_refresh_token;
  if (!accessToken && !refreshToken) return null;

  let authUser = accessToken ? await getSupabaseUser(accessToken).catch(() => null) : null;

  if (!authUser && refreshToken) {
    const refreshed = await supabaseAuthRequest("/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }).catch(() => null);

    if (refreshed?.access_token) {
      setAuthCookies(res, refreshed);
      accessToken = refreshed.access_token;
      authUser = refreshed.user || await getSupabaseUser(accessToken).catch(() => null);
    }
  }

  if (!authUser) return null;
  const profile = await ensureProfile(authUser);
  return { authUser, profile, accessToken };
}

async function requireUser(req, res) {
  const user = await getUserFromRequest(req, res);
  if (!user) {
    json(res, 401, { error: "Sign in to continue." });
    return null;
  }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;

  if (!isAdminUser(user.profile, user.authUser)) {
    json(res, 403, { error: "Admin access is required." });
    return null;
  }

  return user;
}

async function getSupabaseUser(accessToken) {
  const data = await supabaseAuthRequest("/user", {
    method: "GET",
    accessToken,
  });
  return data.user || data;
}

async function ensureProfile(authUser) {
  const existing = await getProfile(authUser.id);
  if (existing) return resetUsageIfNeeded(existing);

  const [created] = await supabaseRest("profiles", {
    method: "POST",
    body: defaultProfile(authUser),
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return resetUsageIfNeeded(created);
}

function defaultProfile(authUser) {
  return {
    user_id: authUser.id,
    email: authUser.email || "",
    role: isAdminEmail(authUser.email) ? "admin" : "user",
    plan_id: "free",
    subscription_status: "free",
    stripe_customer_id: "",
    stripe_subscription_id: "",
    searches_used: 0,
    usage_period: currentUsagePeriod(),
    updated_at: new Date().toISOString(),
  };
}

async function getProfile(userId) {
  const rows = await supabaseRest("profiles", {
    query: `user_id=eq.${encodeURIComponent(userId)}&select=*`,
  });
  return rows[0] || null;
}

async function getProfileByCustomer(customerId) {
  const rows = await supabaseRest("profiles", {
    query: `stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=*`,
  });
  return rows[0] || null;
}

async function updateProfile(userId, fields) {
  const [profile] = await supabaseRest("profiles", {
    method: "PATCH",
    query: `user_id=eq.${encodeURIComponent(userId)}`,
    body: {
      ...fields,
      updated_at: new Date().toISOString(),
    },
    prefer: "return=representation",
  });
  return resetUsageIfNeeded(profile);
}

async function listAdminProfiles(limit = 500) {
  return supabaseRest("profiles", {
    query: `select=user_id,email,role,plan_id,subscription_status,stripe_customer_id,stripe_subscription_id,searches_used,usage_period,created_at,updated_at&order=created_at.desc&limit=${limit}`,
  });
}

async function listAdminSubscriptions(limit = 500) {
  return supabaseRest("subscriptions", {
    query: `select=subscription_id,user_id,stripe_customer_id,plan_id,status,current_period_end,created_at,updated_at&order=created_at.desc&limit=${limit}`,
  });
}

async function listAdminSavedSearches(limit = 1000) {
  return supabaseRest("saved_searches", {
    query: `select=user_id,search_key,last_result_count,created_at,updated_at&order=updated_at.desc&limit=${limit}`,
  });
}

function buildAdminSummary({ profiles, subscriptions, savedSearches }) {
  const currentPeriod = currentUsagePeriod();
  const activeProfiles = profiles.filter(hasActiveSubscription);
  const monthlySearches = profiles
    .filter((profile) => profile.usage_period === currentPeriod)
    .reduce((total, profile) => total + Number(profile.searches_used || 0), 0);
  const estimatedMrrCents = activeProfiles.reduce(
    (total, profile) => total + getPlanPriceCents(profile.plan_id),
    0,
  );

  return {
    totalUsers: profiles.length,
    activeSubscriptions: activeProfiles.length,
    freeUsers: profiles.filter((profile) => !hasActiveSubscription(profile)).length,
    monthlySearches,
    savedSearches: savedSearches.length,
    subscriptionRecords: subscriptions.length,
    estimatedMrrCents,
    estimatedMrrLabel: formatCurrency(estimatedMrrCents),
    planBreakdown: buildPlanBreakdown(profiles),
    recentUsers: profiles.slice(0, 8).map(publicAdminUser),
  };
}

function buildPlanBreakdown(profiles) {
  const freeUsers = profiles.filter((profile) => !hasActiveSubscription(profile)).length;
  const paidPlans = PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    users: profiles.filter(
      (profile) => hasActiveSubscription(profile) && profile.plan_id === plan.id,
    ).length,
    searchLimit: plan.searchLimit,
    priceLabel: plan.priceLabel,
  }));

  return [
    { id: "free", name: "Free", users: freeUsers, searchLimit: 50, priceLabel: "$0/mo" },
    ...paidPlans,
  ];
}

function publicAdminUser(profile) {
  const currentProfile = resetUsageIfNeeded(profile);
  const plan = PLANS.find((item) => item.id === currentProfile.plan_id);
  return {
    id: currentProfile.user_id,
    email: currentProfile.email || "",
    role: isAdminEmail(currentProfile.email) ? "admin" : currentProfile.role || "user",
    isAdmin: isAdminUser(currentProfile, { email: currentProfile.email }),
    planId: currentProfile.plan_id || "free",
    planName: plan?.name || (hasActiveSubscription(currentProfile) ? "Paid" : "Free"),
    subscriptionStatus: currentProfile.subscription_status || "free",
    searchesUsed: Number(currentProfile.searches_used || 0),
    searchLimit: getPlanLimit(currentProfile),
    usagePeriod: currentProfile.usage_period || "",
    createdAt: currentProfile.created_at || "",
    updatedAt: currentProfile.updated_at || "",
  };
}

async function upsertSubscription(fields) {
  await supabaseRest("subscriptions", {
    method: "POST",
    body: {
      ...fields,
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

async function getSavedSearch(userId, searchKey) {
  const rows = await supabaseRest("saved_searches", {
    query: `user_id=eq.${encodeURIComponent(userId)}&search_key=eq.${encodeURIComponent(searchKey)}&select=*`,
  });
  return rows[0] || null;
}

async function getSavedSearchByKey(userId, searchKey) {
  const rows = await supabaseRest("saved_searches", {
    query: `user_id=eq.${encodeURIComponent(userId)}&search_key=eq.${encodeURIComponent(searchKey)}&select=search_key,category,location,location_display_name,radius_meters,seen_lead_ids,last_leads,last_result_count,last_skipped_count,reset_count,created_at,updated_at`,
  });
  return rows[0] || null;
}

async function listSavedSearches(userId) {
  return supabaseRest("saved_searches", {
    query: `user_id=eq.${encodeURIComponent(userId)}&select=search_key,category,location,location_display_name,radius_meters,seen_lead_ids,last_result_count,last_skipped_count,reset_count,created_at,updated_at&order=updated_at.desc&limit=100`,
  });
}

function publicSavedSearch(row) {
  const seenLeadIds = Array.isArray(row.seen_lead_ids) ? row.seen_lead_ids : [];
  return {
    searchKey: row.search_key,
    category: row.category || "",
    location: row.location || "",
    locationDisplayName: row.location_display_name || row.location || "",
    radiusMeters: Number(row.radius_meters || 0),
    seenCount: seenLeadIds.length,
    lastResultCount: Number(row.last_result_count || 0),
    lastSkippedCount: Number(row.last_skipped_count || 0),
    resetCount: Number(row.reset_count || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function publicSavedSearchDetail(row) {
  return {
    ...publicSavedSearch(row),
    lastLeads: Array.isArray(row.last_leads) ? row.last_leads : [],
  };
}

async function upsertSavedSearch(fields) {
  await supabaseRest("saved_searches", {
    method: "POST",
    body: {
      ...fields,
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

function hasActiveSubscription(profile) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(profile.subscription_status);
}

function canSearch(profile) {
  const currentProfile = resetUsageIfNeeded(profile);
  return hasActiveSubscription(currentProfile) || (currentProfile.searches_used || 0) < FREE_LIMIT;
}

function getPlanLimit(profile) {
  if (!hasActiveSubscription(profile)) return 50;
  return PLANS.find((plan) => plan.id === profile.plan_id)?.searchLimit || 60;
}

function isAdminUser(profile, authUser) {
  return (profile?.role || "").toLowerCase() === "admin" || isAdminEmail(authUser?.email || profile?.email);
}

function isAdminEmail(email) {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

function parseAdminEmails(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

function getPlanPriceCents(planId) {
  const plan = PLANS.find((item) => item.id === planId);
  const match = plan?.priceLabel.match(/\$(\d+)/);
  return match ? Number(match[1]) * 100 : 0;
}

function formatCurrency(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function resetUsageIfNeeded(profile) {
  const period = currentUsagePeriod();
  if (profile.usage_period !== period) {
    return {
      ...profile,
      usage_period: period,
      searches_used: 0,
    };
  }
  return profile;
}

function currentUsagePeriod() {
  return new Date().toISOString().slice(0, 7);
}

async function supabaseAuthRequest(endpoint, options = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };

  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(`${SUPABASE_URL}/auth/v1${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.msg || data.message || data.error_description || data.error || "Supabase Auth request failed.");
  }

  return data;
}

async function supabaseRest(table, options = {}) {
  const query = options.query ? `?${options.query}` : "";
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  if (options.prefer) headers.Prefer = options.prefer;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return [];
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];

  if (!response.ok) {
    throw new Error(data.message || data.error || "Supabase database request failed.");
  }

  return Array.isArray(data) ? data : [data];
}

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
}

async function stripeRequest(endpoint, fields) {
  const response = await fetch(`https://api.stripe.com${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe request failed.");
  }

  return data;
}

function hasStripeConfig() {
  return Boolean(STRIPE_SECRET_KEY && PLANS.some((plan) => process.env[plan.priceEnv]));
}

function getPlanIdByPrice(priceId) {
  return PLANS.find((plan) => process.env[plan.priceEnv] === priceId)?.id || "";
}

function verifyStripeSignature(body, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => part.split("=")));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body.toString("utf8")}`)
    .digest("hex");

  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function geocodeLocation(location) {
  const coordinates = parseCoordinates(location);
  if (coordinates) return coordinates;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", location);

  let response;
  try {
    response = await fetch(url.toString(), { headers: MAP_SERVICE_HEADERS });
  } catch (error) {
    throw new Error("Could not reach the location search service.");
  }
  if (!response.ok) throw new Error("Could not reach the location search service.");

  const places = await response.json();
  if (!places.length) throw new Error(`No location found for "${location}".`);

  return {
    lat: Number(places[0].lat),
    lon: Number(places[0].lon),
    displayName: places[0].display_name.split(",").slice(0, 3).join(","),
  };
}

function parseCoordinates(location) {
  const match = clean(location).match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
}

async function searchOverpass({ category, place, radius, limit }) {
  const plans = buildSearchPlans({ category, place, radius, limit });
  const rawTarget = Math.min(Math.max(limit * 3, 350), 9000);
  const elementsById = new Map();
  let successfulRequests = 0;
  let lastError;

  for (const plan of plans) {
    if (elementsById.size >= rawTarget) break;
    try {
      const elements = await fetchOverpass(plan.query, plan.timeoutMs);
      successfulRequests += 1;
      for (const element of elements) elementsById.set(`${element.type}/${element.id}`, element);
    } catch (error) {
      lastError = error;
      console.warn(error.message);
    }
  }

  if (!successfulRequests && lastError) {
    throw new Error("The public map search service is busy or the search is too broad.");
  }

  return Array.from(elementsById.values());
}

function buildSearchPlans({ category, place, radius, limit }) {
  const selectorGroups = getSelectorGroups(category);
  if (!selectorGroups.primary.length) throw new Error("Enter a more specific category to search.");

  const radiusSteps = getRadiusSteps(radius, limit);
  const plans = [];

  for (const radiusStep of radiusSteps) {
    plans.push(createOverpassPlan({
      label: `${selectorGroups.label} within ${formatRadius(radiusStep)}`,
      selectors: selectorGroups.primary,
      lat: place.lat,
      lon: place.lon,
      radius: radiusStep,
      limit,
      isFallback: false,
    }));
  }

  for (const radiusStep of radiusSteps) {
    if (!selectorGroups.fallback.length) continue;
    plans.push(createOverpassPlan({
      label: `keyword fallback within ${formatRadius(radiusStep)}`,
      selectors: selectorGroups.fallback,
      lat: place.lat,
      lon: place.lon,
      radius: radiusStep,
      limit,
      isFallback: true,
    }));
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
  return `[out:json][timeout:${timeout}];\n(\n  ${clauses}\n);\nout tags center qt ${outputLimit};`;
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
  return { label: "business tags", primary: keywordSelectors, fallback: getNameFallbackSelectors(normalized) };
}

function findCategoryPreset(normalizedCategory) {
  return CATEGORY_PRESETS.find((item) =>
    item.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      const canUsePartialAlias = normalizedCategory.length >= 4;
      return normalizedCategory === normalizedAlias ||
        normalizedCategory.includes(normalizedAlias) ||
        (canUsePartialAlias && normalizedAlias.includes(normalizedCategory));
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
  return [`["name"~"${pattern}",i]`, `["brand"~"${pattern}",i]`, `["operator"~"${pattern}",i]`, `["description"~"${pattern}",i]`];
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

function getSearchDepthLimit(limit, seenCount) {
  const requested = Number(limit) || 50;
  const previouslyServed = Math.max(0, Number(seenCount) || 0);
  return Math.min(Math.max(requested + previouslyServed + 100, requested), 5000);
}

async function fetchOverpass(query, timeoutMs) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...MAP_SERVICE_HEADERS,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Data service returned ${response.status}.`);
      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("Search request timed out.") : error;
    } finally {
      clearTimeout(timer);
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
  const phone = firstTag(tags, ["contact:phone", "phone", "contact:mobile", "mobile", "phone:mobile", "contact:whatsapp", "operator:phone"]);
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
    distanceMeters: Number.isFinite(lat) && Number.isFinite(lon) ? haversineMeters(place.lat, place.lon, lat, lon) : Number.POSITIVE_INFINITY,
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
  return getLeadScore(b) - getLeadScore(a) || a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name);
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
  return [...BUSINESS_TAG_KEYS, "cuisine"]
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
  const streetLine = [tags["addr:street"], tags["addr:housenumber"]].map(clean).filter(Boolean).join(" ");
  const cityLine = [tags["addr:postcode"], tags["addr:city"]].map(clean).filter(Boolean).join(" ");
  return [streetLine, cityLine].filter(Boolean).join(", ");
}

function normalizeWebsite(url) {
  const cleaned = clean(url);
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
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
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(cookieHeader.split(";").filter(Boolean).map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, decodeURIComponent(rest.join("="))];
  }));
}

function readJson(req) {
  return readRaw(req).then((raw) => raw.length ? JSON.parse(raw.toString("utf8")) : {});
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(value) {
  return String(value || "").trim();
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeOverpassRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function loadEnvFile(filePath) {
  try {
    const content = require("node:fs").readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional; production hosts usually provide real environment variables.
  }
}
