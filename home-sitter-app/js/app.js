// js/app.js
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

/**
 * Optional shared mapper:
 * If authPage.js doesn't expose a global mapper,
 * we define a safe default here.
 *
 * NOTE: backend uses `photo_url`, so we also map that
 * into avatar_url for anything that expects it.
 */
if (!window.PetCareMapApiUser) {
  window.PetCareMapApiUser = function (apiUser) {
    if (!apiUser) return null;
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name || "",
      email: apiUser.email,
      role: apiUser.role,
      phone: apiUser.phone || "",
      is_active: apiUser.is_active,
      avatar_url: apiUser.avatar_url || apiUser.photo_url || null,
      photo_url: apiUser.photo_url || apiUser.avatar_url || null
    };
  };
}

function updateHeaderUser() {
  const user = window.PetCareState?.getCurrentUser?.();
  const pill = document.getElementById("userPill");
  const logoutBtn = document.getElementById("logoutBtn");
  const authBtn = document.getElementById("openAuthBtn");

  if (!pill) return;

  if (!user || user.role === "guest") {
    pill.textContent = "Guest";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (authBtn) authBtn.style.display = "inline-flex";
    return;
  }

  const displayName = user.name || user.email || "User";
  const role = user.role ? String(user.role).toUpperCase() : "USER";
  pill.textContent = `${displayName} · ${role}`;

  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (authBtn) authBtn.style.display = "none";
}

function doLogout() {
  try {
    window.PetCareState?.logout?.();
  } catch (_) {}

  // Clear token if you're using JWT
  try {
    localStorage.removeItem("petcare_token");
  } catch (_) {}

  updateHeaderUser();
  setActivePage("homePage");
}

// SINGLE version of setActivePage
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

  // Optional UX: scroll to top on page switch
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (_) {}

  // Page initializers
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

function setupNav() {
  // Prevent duplicate listeners if initAppShell is ever called again
  if (window.__petcareNavBound) return;
  window.__petcareNavBound = true;

  const links = document.querySelectorAll(".main-nav .nav-link");
  links.forEach((link) => {
    link.addEventListener("click", function () {
      const pageId = this.getAttribute("data-page");
      if (pageId) setActivePage(pageId);
    });
  });

  // Global page jump handler (buttons with data-page-jump)
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

  // Profile page logout button (if present in DOM)
  const profileLogoutBtn = document.getElementById("profileLogoutBtn");
  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener("click", doLogout);
  }
}

/**
 * Restore session from JWT (if present)
 * Requires backend route:
 *  GET /auth/me  with Authorization: Bearer <token>
 */
async function restoreSession() {
  const token = localStorage.getItem("petcare_token");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) return;

    const user = window.PetCareMapApiUser(data.user);

    if (user && window.PetCareState?.setCurrentUser) {
      window.PetCareState.setCurrentUser(user);
    }

    // Make sure header pill updates after restore
    updateHeaderUser();
  } catch {
    // token invalid or server offline -> ignore
  }
}

function initAppShell() {
  const appSection = document.getElementById("appSection");
  if (appSection) appSection.style.display = "block";

  setupNav();
  updateHeaderUser();
  setActivePage("homePage");
}

// Expose globals used by other scripts
window.updateHeaderUser = updateHeaderUser;
window.setActivePage = setActivePage;
window.initAppShell = initAppShell;
window.doLogout = doLogout;
window.restoreSession = restoreSession;

document.addEventListener("DOMContentLoaded", async function () {
  if (window.PetCareState && typeof window.PetCareState.ensureDefaultUser === "function") {
    window.PetCareState.ensureDefaultUser();
  }

  await restoreSession();

  initAppShell();
});
