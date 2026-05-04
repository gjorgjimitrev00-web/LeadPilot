const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmit = document.querySelector("#authSubmit");
const authStatus = document.querySelector("#authStatus");
const authTitle = document.querySelector("#authTitle");
const authIntro = document.querySelector("#authIntro");
const signupTab = document.querySelector("#signupTab");
const loginTab = document.querySelector("#loginTab");

const params = new URLSearchParams(window.location.search);
let mode = params.get("mode") === "login" ? "login" : "signup";
const selectedPlan = params.get("plan") || "";

setMode(mode);

signupTab.addEventListener("click", () => setMode("signup"));
loginTab.addEventListener("click", () => setMode("login"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(mode === "signup" ? "Creating account..." : "Signing in...");
  authSubmit.disabled = true;

  try {
    const data = await apiRequest(mode === "signup" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: {
        email: authEmail.value,
        password: authPassword.value,
      },
    });

    if (data.needsEmailConfirmation) {
      setStatus("Check your email to confirm your Supabase account, then come back to login.");
      setMode("login");
      return;
    }

    if (selectedPlan) {
      const checkout = await apiRequest("/api/stripe/create-checkout-session", {
        method: "POST",
        body: { planId: selectedPlan },
      });
      window.location.href = checkout.url;
      return;
    }

    window.location.href = "/app.html";
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    authSubmit.disabled = false;
  }
});

function setMode(nextMode) {
  mode = nextMode;
  const isSignup = mode === "signup";
  authTitle.textContent = isSignup ? "Create your account" : "Welcome back";
  authIntro.textContent = isSignup
    ? "Start with free monthly test searches, then upgrade when you need volume."
    : "Log in to continue searching, exporting, and managing billing.";
  authSubmit.textContent = isSignup ? "Create account" : "Login";
  signupTab.classList.toggle("is-active", isSignup);
  loginTab.classList.toggle("is-active", !isSignup);
}

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.className = isError ? "auth-status error" : "auth-status";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
