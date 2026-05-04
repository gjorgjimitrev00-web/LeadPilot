const sampleSearches = [
  {
    category: "Dentists",
    city: "New York",
    results: "428",
    phones: "171",
    noWebsite: "136",
    rows: [
      ["Bright Dental NYC", "No website", "+1..."],
      ["Park Avenue Dental", "Phone found", "+1..."],
      ["Hudson Smile Care", "Email found", "hello@..."],
    ],
  },
  {
    category: "Cafes",
    city: "Austin",
    results: "214",
    phones: "92",
    noWebsite: "64",
    rows: [
      ["Eastside Coffee", "No website", "+1..."],
      ["Congress Cafe", "Phone found", "+1..."],
      ["Roast Lab", "Website listed", "roast..."],
    ],
  },
  {
    category: "Hotels",
    city: "Miami",
    results: "149",
    phones: "77",
    noWebsite: "31",
    rows: [
      ["Ocean Stay", "Website listed", "ocean..."],
      ["Palm Suites", "No website", "+1..."],
      ["Hotel Central", "Email found", "hello@..."],
    ],
  },
];

const API_BASE = window.location.protocol === "file:" ? "http://localhost:4173" : "";
const demoQuery = document.querySelector("#demoQuery");
const demoResults = document.querySelector("#demoResults");
const demoPhones = document.querySelector("#demoPhones");
const demoNoWebsite = document.querySelector("#demoNoWebsite");
const demoRows = document.querySelector("#demoRows");
const navAuthLink = document.querySelector("#navAuthLink");
const navCtaLink = document.querySelector("#navCtaLink");
const sampleButtons = document.querySelectorAll("[data-sample-index]");
const faqItems = document.querySelectorAll(".faq-item");

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.sampleIndex);
    renderSample(index);
  });
});

faqItems.forEach((item) => {
  const button = item.querySelector("button");
  button.addEventListener("click", () => {
    const isOpen = item.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
});

renderSample(0);
updateNavigationForSession();

function renderSample(index) {
  const sample = sampleSearches[index] || sampleSearches[0];
  demoQuery.textContent = `${sample.category} in ${sample.city}`;
  demoResults.textContent = sample.results;
  demoPhones.textContent = sample.phones;
  demoNoWebsite.textContent = sample.noWebsite;
  demoRows.innerHTML = sample.rows
    .map(([name, status, detail]) => `
      <div class="demo-result-row">
        <span>${name}</span>
        <strong>${status}</strong>
        <em>${detail}</em>
      </div>
    `)
    .join("");

  sampleButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.sampleIndex) === index);
  });
}

async function updateNavigationForSession() {
  if (!navAuthLink) return;

  try {
    const response = await fetch(`${API_BASE}/api/me`);
    if (!response.ok) return;

    const data = await response.json();
    if (!data.user) return;

    navAuthLink.textContent = "Dashboard";
    navAuthLink.href = "/app.html";

    if (navCtaLink) {
      navCtaLink.textContent = "Open app";
      navCtaLink.href = "/app.html";
    }
  } catch {
    // Landing navigation still works as a logged-out page if the API is unavailable.
  }
}
