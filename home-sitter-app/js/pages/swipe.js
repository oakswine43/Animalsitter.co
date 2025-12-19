// js/pages/swipe.js
// Swipe Sitters + "Your sitter matches" panel

(function () {
  function getState() {
    return window.PetCareState || null;
  }

  // -----------------------------
  // Helpers on PetCareState
  // -----------------------------
  function ensureHelpers() {
    const S = getState();
    if (!S) return;

    // Selected sitter helpers (used by profile page)
    if (typeof S.getSelectedSitterId !== "function") {
      S._selectedSitterId = S._selectedSitterId || null;
      S.setSelectedSitterId = function (id) {
        S._selectedSitterId = id;
      };
      S.getSelectedSitterId = function () {
        return S._selectedSitterId;
      };
    }

    // Match helpers (for "Your sitter matches" list)
    if (!Array.isArray(S._matches)) {
      S._matches = [];
    }
    if (typeof S.addMatch !== "function") {
      S.addMatch = function (sitter) {
        if (!sitter || !sitter.id) return;
        if (!S._matches.find((m) => m.id === sitter.id)) {
          S._matches.push({
            id: sitter.id,
            sitterId: sitter.id,
            sitterName: sitter.name,
          });
        }
      };
    }
    if (typeof S.getMatches !== "function") {
      S.getMatches = function () {
        return S._matches.slice();
      };
    }
  }

  // -----------------------------
  // Render functions
  // -----------------------------
  function renderSwipeShell(root) {
    root.innerHTML = `
      <div class="dashboard-layout">
        <div class="dashboard-card">
          <div class="section-card">
            <h2>Swipe Sitters</h2>
            <p class="page-subtitle">
              Discover nearby sitters. Instead of like / dislike, choose <strong>Select sitter</strong> to add them to your matches.
            </p>

            <div id="swipeCurrentCard"></div>

            <div class="swipe-controls" style="margin-top:10px; display:flex; gap:8px;">
              <button type="button" id="swipeSkipBtn" class="btn-secondary">Skip</button>
              <button type="button" id="swipeSelectBtn" class="btn-primary">Select sitter</button>
            </div>
          </div>
        </div>

        <div class="dashboard-card">
          <div class="section-card">
            <h2>Your sitter matches</h2>
            <p class="text-muted" style="font-size:13px; margin-bottom:6px;">
              After you select a sitter, they appear here so you can view profile, message, or book appointments.
            </p>
            <div id="swipeMatchesList"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSwipeSitterCard(sitter) {
    if (!sitter) {
      return `
        <div class="section-card">
          <p class="text-muted">No more sitters to swipe right now.</p>
        </div>
      `;
    }

    const experience =
      sitter.experienceYears != null
        ? `${sitter.experienceYears}+ years experience`
        : sitter.experience || "Experience not set";

    return `
      <article class="sitter-card" data-sitter-id="${sitter.id}">
        <header class="sitter-card-header">
          <div style="display:flex; gap:10px; align-items:center;">
            <div
              class="avatar-circle"
              style="
                width:56px;
                height:56px;
                border-radius:999px;
                background-image:url('${sitter.avatar || ""}');
                background-size:cover;
                background-position:center;
                background-color:#e5e7eb;
              "
            ></div>
            <div>
              <div style="font-weight:600;">${sitter.name}</div>
              <div style="font-size:12px; color:#6b7280;">
                ${sitter.city || "Location not set"}
                ${sitter.distance ? " · " + sitter.distance : ""}
              </div>
              <div style="font-size:12px; color:#6b7280;">
                ⭐ ${sitter.rating || "New"} (${sitter.reviewsCount || 0} reviews)
              </div>
            </div>
          </div>
        </header>

        <div class="sitter-card-body">
          <p style="font-size:13px; margin-bottom:4px;">
            ${
              sitter.tagline ||
              sitter.bio ||
              "Perfect for high-energy pups that love long walks, runs, and fun."
            }
          </p>
          <p style="font-size:12px; color:#6b7280;">
            ${experience}
          </p>
        </div>
      </article>
    `;
  }

  function renderMatchCard(sitter) {
    const experience =
      sitter.experienceYears != null
        ? `${sitter.experienceYears}+ years experience`
        : sitter.experience || "Experience not set";

    return `
      <article class="sitter-card" data-sitter-id="${sitter.id}">
        <header class="sitter-card-header">
          <div style="display:flex; gap:10px; align-items:center;">
            <div
              class="avatar-circle"
              style="
                width:40px;
                height:40px;
                border-radius:999px;
                background-image:url('${sitter.avatar || ""}');
                background-size:cover;
                background-position:center;
                background-color:#e5e7eb;
              "
            ></div>
            <div>
              <div style="font-weight:600;">${sitter.name}</div>
              <div style="font-size:12px; color:#6b7280;">
                ${sitter.city || "Location not set"}
                ${sitter.distance ? " · " + sitter.distance : ""}
              </div>
              <div style="font-size:12px; color:#6b7280;">
                ⭐ ${sitter.rating || "New"} (${sitter.reviewsCount || 0} reviews)
              </div>
            </div>
          </div>
        </header>

        <div class="sitter-card-body">
          <p style="font-size:13px; margin-bottom:4px;">
            ${
              sitter.tagline ||
              sitter.bio ||
              "Downtown Knoxville • 5+ years • CPR certified • Works from home."
            }
          </p>
          <p style="font-size:12px; color:#6b7280;">
            ${experience}
          </p>
        </div>

        <footer class="sitter-card-footer" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn-small" data-action="view-profile">
            View profile
          </button>
          <button type="button" class="btn-small" data-action="message">
            Message
          </button>
          <button type="button" class="btn-small" data-action="book">
            Book appointment
          </button>
        </footer>
      </article>
    `;
  }

  function renderMatchesList() {
    const S = getState();
    const container = document.getElementById("swipeMatchesList");
    if (!S || !container) return;

    const matches = S.getMatches();
    if (!matches.length) {
      container.innerHTML =
        '<p class="text-muted" style="font-size:13px;">No matches yet. Select a sitter from the left to add them here.</p>';
      return;
    }

    // Map match ids back to sitter objects
    const sitters =
      typeof S.getSitters === "function" ? S.getSitters() : (S.demoSitters || []);
    const sittersById = {};
    sitters.forEach((s) => {
      sittersById[String(s.id)] = s;
    });

    container.innerHTML = matches
      .map((m) => sittersById[String(m.sitterId)] || null)
      .filter(Boolean)
      .map(renderMatchCard)
      .join("");
  }

  // -----------------------------
  // Actions
  // -----------------------------
  function getSittersForSwipe() {
    const S = getState();
    if (!S) return [];
    if (typeof S.getSitters === "function") return S.getSitters();
    if (Array.isArray(S.demoSitters)) return S.demoSitters;
    return [];
  }

  function openProfileForSitterId(sitterId) {
    const S = getState();
    if (!S) return;

    if (typeof S.setSelectedSitterId === "function") {
      S.setSelectedSitterId(sitterId);
    }

    if (typeof window.setActivePage === "function") {
      window.setActivePage("sitterProfilePage");
    } else {
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      const page = document.getElementById("sitterProfilePage");
      if (page) page.classList.add("active");
    }

    if (typeof window.initSitterProfilePage === "function") {
      window.initSitterProfilePage();
    }
  }

  function openBookingForSitterId(sitterId) {
    const S = getState();
    if (!S) return;

    // If you later expose a booking helper, you can hook it here.
    // For now: open the profile page so the user can click "Book sitter".
    openProfileForSitterId(sitterId);
  }

  function handleMatchesClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const card = btn.closest("[data-sitter-id]");
    if (!card) return;

    const sitterId = card.getAttribute("data-sitter-id");
    const action = btn.getAttribute("data-action");

    switch (action) {
      case "view-profile":
        openProfileForSitterId(sitterId);
        break;
      case "message": {
        const S = getState();
        let sitter = null;
        if (S && typeof S.getSitterById === "function") {
          sitter = S.getSitterById(sitterId);
        } else {
          const allSitters = getSittersForSwipe();
          sitter = allSitters.find((s) => String(s.id) === String(sitterId));
        }

        window.__activeChatTarget = {
          type: "sitter",
          id: sitterId,
          name: sitter ? sitter.name : "Sitter",
        };

        if (typeof window.setActivePage === "function") {
          window.setActivePage("messagesPage");
        } else {
          document.querySelectorAll(".page").forEach((p) =>
            p.classList.remove("active")
          );
          const page = document.getElementById("messagesPage");
          if (page) page.classList.add("active");
        }
        break;
      }
      case "book":
        // 👉 This is the one from your screenshot: open the sitter profile to book
        openBookingForSitterId(sitterId);
        break;
      default:
        break;
    }
  }

  // -----------------------------
  // Init
  // -----------------------------
  window.initSwipePage = function () {
    const root = document.getElementById("swipeRoot");
    if (!root) return;

    ensureHelpers();
    renderSwipeShell(root);

    const S = getState();
    const sitters = getSittersForSwipe();
    if (!sitters.length) {
      const currentCard = document.getElementById("swipeCurrentCard");
      if (currentCard) {
        currentCard.innerHTML =
          '<p class="text-muted">No sitters available to swipe right now.</p>';
      }
      return;
    }

    // Track swipe index on state so it persists between visits
    if (typeof S._swipeIndex !== "number") {
      S._swipeIndex = 0;
    }

    function getCurrentSitter() {
      if (!sitters.length) return null;
      const idx = Math.min(Math.max(S._swipeIndex, 0), sitters.length - 1);
      return sitters[idx] || null;
    }

    function renderCurrent() {
      const cardContainer = document.getElementById("swipeCurrentCard");
      if (!cardContainer) return;
      cardContainer.innerHTML = renderSwipeSitterCard(getCurrentSitter());
    }

    function skip() {
      if (!sitters.length) return;
      S._swipeIndex = (S._swipeIndex + 1) % sitters.length;
      renderCurrent();
    }

    function selectCurrent() {
      const sitter = getCurrentSitter();
      if (!sitter) return;
      S.addMatch(sitter);
      S.setSelectedSitterId(sitter.id);
      renderMatchesList();
      // advance to next sitter
      skip();
    }

    // Wire buttons
    const skipBtn = document.getElementById("swipeSkipBtn");
    const selectBtn = document.getElementById("swipeSelectBtn");
    if (skipBtn) skipBtn.addEventListener("click", skip);
    if (selectBtn) selectBtn.addEventListener("click", selectCurrent);

    // Wire matches panel actions
    const matchesList = document.getElementById("swipeMatchesList");
    if (matchesList) {
      matchesList.addEventListener("click", handleMatchesClick);
    }

    // Initial render
    renderCurrent();
    renderMatchesList();
  };
})();
