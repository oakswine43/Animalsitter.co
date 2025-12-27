// home-sitter-app/js/app.js
// ============================
// Core app shell + navigation
// ============================

// -----------------------------
// API base – shared for all frontend scripts
// In dev:  http://localhost:4000
// In prod: https://animalsitterco-production.up.railway.app
// -----------------------------
(function () {
  if (!window.API_BASE) {
    const host = window.location.hostname || "";
    const isLocal = host === "localhost" || host === "127.0.0.1";

    window.API_BASE = isLocal
      ? "http://localhost:4000"
      : "https://animalsitterco-production.up.railway.app";
  }

  window.PETCARE_API_BASE = window.API_BASE;
  console.log("[Animalsitter] API_BASE =", window.API_BASE);
})();

const API_BASE = window.API_BASE;

// -----------------------------
// URL normalization helper
// Makes sure /uploads/... becomes a full URL with API_BASE
// -----------------------------
function normalizeAvatarUrl(url) {
  if (!url) return null;

  // Already absolute or data URL
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  // Treat as relative to the backend
  const base = window.API_BASE || window.PETCARE_API_BASE || "";
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedUrl = url.startsWith("/") ? url : `/${url}`;

  return `${trimmedBase}${trimmedUrl}`;
}

/**
 * Shared mapper:
 * Backend returns: id, full_name, first_name, last_name,
 * email, role, phone, photo_url, avatar_url, is_active
 *
 * This version:
 *  - PRESERVES existing avatar if the API doesn’t send one
 *  - Normalizes any relative /uploads/... path to a full URL
 */
window.PetCareMapApiUser = function (apiUser) {
  if (!apiUser) return null;

  // Whatever user is already in state (may be guest / old session)
  const prev =
    window.PetCareState &&
    typeof window.PetCareState.getCurrentUser === "function"
      ? window.PetCareState.getCurrentUser() || {}
      : {};

  // Only reuse avatar if it’s the *same* user
  const sameUser =
    prev && prev.id && apiUser.id && prev.id === apiUser.id;

  const first =
    apiUser.first_name ||
    apiUser.firstName ||
    apiUser.given_name ||
    "";
  const last =
    apiUser.last_name ||
    apiUser.lastName ||
    apiUser.family_name ||
    "";

  const fullName =
    apiUser.full_name ||
    apiUser.name ||
    `${first} ${last}`.trim() ||
    prev.full_name ||
    prev.name ||
    "";

  const avatarFromApi = apiUser.avatar_url || apiUser.photo_url || null;
  const avatarFromPrev =
    sameUser && (prev.avatar_url || prev.photo_url)
      ? prev.avatar_url || prev.photo_url
      : null;

  const rawAvatar = avatarFromApi || avatarFromPrev || null;

  const avatarUrl = normalizeAvatarUrl(rawAvatar);
  const photoUrl = normalizeAvatarUrl(
    apiUser.photo_url ||
      apiUser.avatar_url ||
      avatarFromPrev ||
      rawAvatar
  );

  return {
    // keep any previous fields so we don’t drop data
    ...prev,

    id: apiUser.id ?? prev.id ?? null,
    email: apiUser.email || prev.email || "",
    role: apiUser.role || prev.role || "client",
    phone: apiUser.phone || prev.phone || "",
    is_active:
      typeof apiUser.is_active === "boolean"
        ? apiUser.is_active
        : prev.is_active ?? true,

    full_name: fullName,
    name: fullName,
    first_name: first || prev.first_name || null,
    last_name: last || prev.last_name || null,

    avatar_url: avatarUrl,
    photo_url: photoUrl
  };
};

// -----------------------------
// Header user chip
// -----------------------------
function updateHeaderUser() {
  const user = window.PetCareState?.getCurrentUser?.();
  const pill = document.getElementById("userPill");
  const logoutBtn = document.getElementById("logoutBtn");
  const authBtn = document.getElementById("openAuthBtn");

  if (!pill) return;

  // Guest / not logged in
  if (!user || user.role === "guest") {
    pill.textContent = "Guest";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (authBtn) authBtn.style.display = "inline-flex";
    return;
  }

  const displayName =
    user.name || user.full_name || user.email || "User";
  const role = user.role ? String(user.role).toUpperCase() : "USER";
  pill.textContent = `${displayName} · ${role}`;

  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (authBtn) authBtn.style.display = "none";
}

// -----------------------------
// Logout
// -----------------------------
function doLogout() {
  try {
    window.PetCareState?.logout?.();
  } catch (_) {}

  try {
    localStorage.removeItem("petcare_token");
  } catch (_) {}

  updateHeaderUser();
  setActivePage("homePage");
}

// -----------------------------
// Page navigation
// -----------------------------
function setActivePage(pageId) {
  const pages = document.querySelectorAll(".page");
  pages.forEach((p) => p.classList.remove("active"));

  const target = document.getElementById(pageId);
  if (target) target.classList.add("active");

  const links = document.querySelectorAll(".main-nav .nav-link");
  links.forEach((l) => {
    const linkPage = l.getAttribute("data-page");
    l.classList.toggle("active", linkPage === pageId);
  });

  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (_) {}

  if (pageId === "homePage" && typeof window.initHomePage === "function") {
    window.initHomePage();
  }
  if (pageId === "dashboardPage" && typeof window.initDashboardPage === "function") {
    window.initDashboardPage();
  }
  if (pageId === "swipePage" && typeof window.initSwipePage === "function") {
    window.initSwipePage();
  }
  if (pageId === "dogsPage" && typeof window.initDogsPage === "function") {
    window.initDogsPage();
  }
  if (pageId === "messagesPage" && typeof window.initMessagesPage === "function") {
    window.initMessagesPage();
  }
  if (pageId === "settingsPage" && typeof window.initSettingsPage === "function") {
    window.initSettingsPage();
  }
  if (pageId === "sitterProfilePage" && typeof window.initSitterProfilePage === "function") {
    window.initSitterProfilePage();
  }
  if (pageId === "bookingPage" && typeof window.initBookingPage === "function") {
    window.initBookingPage();
  }
  if (pageId === "bookingConfirmPage" && typeof window.initBookingConfirmPage === "function") {
    window.initBookingConfirmPage();
  }
  if (pageId === "authPage" && typeof window.initAuthPage === "function") {
    window.initAuthPage();
  }
  if (pageId === "profilePage" && typeof window.initProfilePage === "function") {
    window.initProfilePage();
  }
}

// -----------------------------
// Nav wiring
// -----------------------------
function setupNav() {
  if (window.__petcareNavBound) return;
  window.__petcareNavBound = true;

  const links = document.querySelectorAll(".main-nav .nav-link");
  links.forEach((link) => {
    link.addEventListener("click", function () {
      const pageId = this.getAttribute("data-page");
      if (pageId) setActivePage(pageId);
    });
  });

  document.body.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-page-jump]");
    if (!btn) return;
    const pageId = btn.getAttribute("data-page-jump");
    if (pageId) setActivePage(pageId);
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", doLogout);
  }

  const profileLogoutBtn = document.getElementById("profileLogoutBtn");
  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", doLogout);
  }
}

// -----------------------------
// Restore session from JWT
// Uses /profile so we always get latest user info
// -----------------------------
async function restoreSession() {
  const token = localStorage.getItem("petcare_token");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) return;

    const user = window.PetCareMapApiUser(data.user);

    if (user && window.PetCareState?.setCurrentUser) {
      window.PetCareState.setCurrentUser(user);
    }

    updateHeaderUser();
  } catch (err) {
    console.warn("restoreSession error:", err);
  }
}

// -----------------------------
// App bootstrap
// -----------------------------
function initAppShell() {
  const appSection = document.getElementById("appSection");
  if (appSection) appSection.style.display = "block";

  setupNav();
  updateHeaderUser();
  setActivePage("homePage");
}

window.updateHeaderUser = updateHeaderUser;
window.setActivePage = setActivePage;
window.initAppShell = initAppShell;
window.doLogout = doLogout;
window.restoreSession = restoreSession;

document.addEventListener("DOMContentLoaded", async function () {
  if (
    window.PetCareState &&
    typeof window.PetCareState.ensureDefaultUser === "function"
  ) {
    window.PetCareState.ensureDefaultUser();
  }

  await restoreSession();
  initAppShell();
});