// js/pages/sitterProfile.js
// Handles sitter profile view, full-page booking, and booking confirmation

(function () {
  // Helper to store which sitter is selected
  function ensureSelectedSitterHelpers() {
    if (!window.PetCareState) return;
    const S = window.PetCareState;

    if (typeof S.getSelectedSitterId !== "function") {
      S._selectedSitterId = S._selectedSitterId || null;
      S.setSelectedSitterId = function (id) {
        S._selectedSitterId = id;
      };
      S.getSelectedSitterId = function () {
        return S._selectedSitterId;
      };
    }
  }

  // Jump into the sitter profile page
  window.showSitterProfile = function (sitterId) {
    ensureSelectedSitterHelpers();

    if (window.PetCareState && window.PetCareState.setSelectedSitterId) {
      window.PetCareState.setSelectedSitterId(sitterId);
    }

    if (typeof window.setActivePage === "function") {
      window.setActivePage("sitterProfilePage");
    } else {
      const pages = document.querySelectorAll(".page");
      pages.forEach((p) => p.classList.remove("active"));
      const target = document.getElementById("sitterProfilePage");
      if (target) target.classList.add("active");
    }

    if (typeof window.initSitterProfilePage === "function") {
      window.initSitterProfilePage();
    }
  };

  // ==========================
  // Small render helpers
  // ==========================
  function renderList(items, emptyText) {
    if (!items || !items.length) {
      return `<li class="text-muted">${emptyText}</li>`;
    }
    return items.map((x) => `<li>${x}</li>`).join("");
  }

  function renderServices(services) {
    if (!services || !services.length) {
      return `<li class="text-muted">No services listed yet.</li>`;
    }
    return services
      .map((svc) => {
        const icon = svc.icon || "";
        const price = svc.price || "";
        const duration = svc.duration || "";
        const notes = svc.notes || "";
        return `
          <li style="margin-bottom:6px;">
            <strong>${icon} ${svc.name || "Service"}</strong>
            ${price ? " – " + price : ""}
            ${duration ? ` (${duration})` : ""}
            ${notes ? `<br><span class="text-muted">${notes}</span>` : ""}
          </li>
        `;
      })
      .join("");
  }

  function renderReviews(reviews) {
    if (!reviews || !reviews.length) {
      return `<p class="text-muted" style="font-size:13px;">No reviews yet – be the first to book this sitter.</p>`;
    }
    return reviews
      .map((r) => {
        const rating = r.rating != null ? r.rating : "5";
        return `
          <div class="review-item">
            <div class="review-header">
              <span><strong>${r.clientName || "Client"}</strong></span>
              <span class="star">★ ${rating}</span>
            </div>
            <div class="review-body" style="font-size:13px;">
              ${r.comment || ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderGallery(urls) {
    if (!urls || !urls.length) {
      return `<p class="text-muted" style="font-size:13px;">No photos added yet.</p>`;
    }
    return `
      <div class="gallery-grid">
        ${urls
          .map(
            (u) => `
              <div class="gallery-item">
                <div class="gallery-item-img" style="background-image:url('${u}');"></div>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderHomeSetup(homeSetup) {
    if (!homeSetup) {
      return `<p class="text-muted" style="font-size:13px;">Home setup details not added yet.</p>`;
    }
    return `
      <ul style="font-size:13px; padding-left:18px;">
        <li>Fenced yard: <strong>${homeSetup.fencedYard ? "Yes" : "No"}</strong></li>
        <li>Other pets: ${homeSetup.otherPets || "None listed"}</li>
        <li>Dog sizes accepted: ${homeSetup.dogSizesAccepted || "Not specified"}</li>
        <li>Children in home: ${homeSetup.childrenInHome || "Not specified"}</li>
        <li>Crate options: ${homeSetup.crateOptions || "Not specified"}</li>
        <li>Sleeping arrangements: ${homeSetup.sleepingArrangements || "Not specified"}</li>
      </ul>
    `;
  }

  function renderPolicies(policies) {
    if (!policies) {
      return `<p class="text-muted" style="font-size:13px;">No policies added yet.</p>`;
    }
    return `
      <ul style="font-size:13px; padding-left:18px;">
        <li><strong>Cancellation:</strong> ${policies.cancellation || "Not specified"}</li>
        <li><strong>Meet &amp; greet:</strong> ${policies.meetAndGreet || "Not specified"}</li>
        <li><strong>Aggressive dog policy:</strong> ${policies.aggressiveDogs || "Not specified"}</li>
        <li><strong>Extra fees:</strong> ${policies.extraFees || "Not specified"}</li>
      </ul>
    `;
  }

  function renderBadges(badges) {
    if (!badges || !badges.length) return "";
    return `
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
        ${badges.map((b) => `<span class="chip">${b}</span>`).join("")}
      </div>
    `;
  }

  function renderPrompts(prompts) {
    if (!prompts) return "";
    const rows = [];

    if (prompts.favoriteBreed) {
      rows.push(
        `<p><strong>My favorite dog breed is:</strong> ${prompts.favoriteBreed}</p>`
      );
    }
    if (prompts.walkHabit) {
      rows.push(
        `<p><strong>The one thing I always do on a walk:</strong> ${prompts.walkHabit}</p>`
      );
    }
    if (prompts.dogsLoveMeBecause) {
      rows.push(
        `<p><strong>Dogs love me because:</strong> ${prompts.dogsLoveMeBecause}</p>`
      );
    }
    if (prompts.superpower) {
      rows.push(
        `<p><strong>My pet care superpower is:</strong> ${prompts.superpower}</p>`
      );
    }

    if (!rows.length) return "";
    return rows.join("");
  }

  // ===================================
  // Booking + confirmation page state
  // ===================================

  // Last booking info so the confirmation page can show details
  window.__lastBookingForConfirm = null;

  // Attach message + book handlers on sitter profile page
  function attachHeaderActions(root, sitter) {
    if (!root || !sitter) return;

    // Message buttons (top-right + bottom)
    const msgButtons = root.querySelectorAll(".btn-header-message");
    msgButtons.forEach((msgBtn) => {
      msgBtn.addEventListener("click", function () {
        window.__activeChatTarget = {
          type: "sitter",
          id: sitter.id,
          name: sitter.name,
        };

        if (typeof window.setActivePage === "function") {
          window.setActivePage("messagesPage");
        } else {
          alert(`This would open a messages/chat view with ${sitter.name}.`);
        }
      });
    });

    // Book buttons (top-right + “Book now” in Book card)
    const bookButtons = root.querySelectorAll(".btn-header-book");
    bookButtons.forEach((bookBtn) => {
      bookBtn.addEventListener("click", function () {
        ensureSelectedSitterHelpers();
        const state = window.PetCareState;
        if (state && typeof state.setSelectedSitterId === "function") {
          state.setSelectedSitterId(sitter.id);
        }

        // ✅ Prefer the booking MODAL if available
        if (typeof window.openBookingModal === "function") {
          window.openBookingModal(sitter.id);
          return;
        }

        // 🔁 Fallback: full booking page
        if (typeof window.setActivePage === "function") {
          window.setActivePage("bookingPage");
        } else {
          const pages = document.querySelectorAll(".page");
          pages.forEach((p) => p.classList.remove("active"));
          const target = document.getElementById("bookingPage");
          if (target) target.classList.add("active");
        }

        if (typeof window.initBookingPage === "function") {
          window.initBookingPage();
        }
      });
    });
  }

  // ==========================
  // Profile page renderer
  // ==========================
  function renderSitterProfile(root, sitter) {
    if (!root) return;

    if (!sitter) {
      root.innerHTML = `
        <div class="section-card">
          <h1>Sitter profile</h1>
          <p class="text-muted">
            No sitter selected. Go back to <strong>Home</strong> and click “View profile”.
          </p>
          <button class="btn-secondary" data-page-jump="homePage">← Back to Home</button>
        </div>
      `;
      return;
    }

    const firstName = sitter.name ? sitter.name.split(" ")[0] : "this sitter";
    const years =
      sitter.experienceYears != null
        ? `${sitter.experienceYears}+ years experience`
        : sitter.experience != null
        ? `${sitter.experience}+ years experience`
        : "Experience not set yet";

    const availability = sitter.availability || "Availability not set yet.";
    const serviceRadius = sitter.serviceRadius || "";
    const compatibility =
      sitter.compatibilityScore != null ? sitter.compatibilityScore + "%" : null;

    root.innerHTML = `
      <div class="page-header">
        <button class="btn-small" data-page-jump="homePage">← Back to Home</button>
        <h1 style="margin-top:8px;">${sitter.name}</h1>
        <p class="page-subtitle">
          ${sitter.tagline || sitter.bio || "Trusted local dog sitter."}
        </p>
      </div>

      <div class="dashboard-layout">
        <!-- LEFT COLUMN: main profile -->
        <div class="dashboard-card">
          <div class="card-header">
            <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
              <div style="display:flex; gap:12px; align-items:center;">
                <div
                  class="avatar-circle"
                  style="
                    width:64px;
                    height:64px;
                    border-radius:999px;
                    background-image:url('${sitter.avatar || ""}');
                    background-size:cover;
                    background-position:center;
                    background-color:#e5e7eb;
                  "
                ></div>
                <div>
                  <div class="card-title" style="margin-bottom:2px;">
                    ${sitter.name}
                  </div>
                  <div class="card-subtitle">
                    ${sitter.city || "Location not set"} • ⭐ ${sitter.rating || "New"}
                    (${sitter.reviewsCount || 0} reviews)
                  </div>
                  <div style="font-size:12px; margin-top:4px;">
                    ${years}
                    ${sitter.distance ? ` • Within ${sitter.distance} of you` : ""}
                  </div>
                  <div style="font-size:12px; margin-top:2px;">
                    ${availability}
                    ${serviceRadius ? ` • Service area: ${serviceRadius}` : ""}
                  </div>
                  ${
                    compatibility
                      ? `<div style="font-size:12px; margin-top:2px;">
                          Compatibility score with you: <strong>${compatibility}</strong>
                        </div>`
                      : ""
                  }
                  ${renderBadges(sitter.badges)}
                </div>
              </div>

              <!-- Header actions -->
              <div class="sitter-header-actions" style="display:flex; flex-direction:column; gap:6px;">
                <button type="button" class="btn-small btn-header-message">
                  Message sitter
                </button>
                <button type="button" class="btn-small btn-header-book">
                  Book sitter
                </button>
              </div>
            </div>
          </div>

          <div class="section-card">
            <h3>About me</h3>
            <p style="font-size:13px;">
              ${
                sitter.bio ||
                "This sitter hasn’t written a full bio yet, but they’re ready to care for your dog."
              }
            </p>
          </div>

          <div class="section-card">
            <h3>Skills &amp; certifications</h3>
            <ul style="font-size:13px; padding-left:18px;">
              ${renderList(
                sitter.skills,
                "No skills or certifications have been added yet."
              )}
            </ul>
          </div>

          <div class="section-card">
            <h3>Services &amp; pricing</h3>
            <ul style="font-size:13px; padding-left:18px;">
              ${renderServices(sitter.services)}
            </ul>
          </div>

          <div class="section-card">
            <h3>Experience</h3>
            <p style="font-size:13px;">
              ${years}
            </p>
            <ul style="font-size:13px; padding-left:18px; margin-top:4px;">
              <li><strong>Past roles:</strong> ${
                sitter.pastJobs && sitter.pastJobs.length
                  ? sitter.pastJobs.join(", ")
                  : "Not specified"
              }</li>
              <li><strong>Breeds handled:</strong> ${
                sitter.breedsHandled && sitter.breedsHandled.length
                  ? sitter.breedsHandled.join(", ")
                  : "Not specified"
              }</li>
              <li><strong>Special cases:</strong> ${
                sitter.specialCases && sitter.specialCases.length
                  ? sitter.specialCases.join(", ")
                  : "Not specified"
              }</li>
            </ul>
          </div>
        </div>

        <!-- RIGHT COLUMN: photos, home setup, policies, reviews, book -->
        <div class="dashboard-card">
          <div class="section-card">
            <h3>Photos &amp; home setup</h3>
            ${renderGallery(sitter.gallery)}
            <div style="margin-top:8px;">
              ${renderHomeSetup(sitter.homeSetup)}
            </div>
          </div>

          <div class="section-card">
            <h3>Policies</h3>
            ${renderPolicies(sitter.policies)}
          </div>

          <div class="section-card">
            <h3>Availability &amp; calendar</h3>
            <p style="font-size:13px;">
              ${
                sitter.availabilityCalendarNote ||
                "Calendar details not added yet."
              }
            </p>
          </div>

          <div class="section-card">
            <h3>Fun prompts</h3>
            <div style="font-size:13px;">
              ${
                renderPrompts(sitter.prompts) ||
                '<p class="text-muted">This sitter hasn&apos;t answered any prompts yet.</p>'
              }
            </div>
          </div>

          <div class="section-card">
            <h3>Reviews</h3>
            ${renderReviews(sitter.reviews)}
          </div>

          <div class="section-card">
            <h3>Book ${firstName}</h3>
            <p class="text-muted" style="font-size:13px;">
              Request a booking or send a message – we&apos;ll add the request to your dashboard.
            </p>
            <button class="btn-primary btn-header-book" style="margin-top:6px;">
              Book now
            </button>
            <button class="btn-secondary btn-header-message" style="margin-top:6px;">
              Message sitter
            </button>
          </div>
        </div>
      </div>
    `;

    // Attach handlers for Book + Message buttons
    attachHeaderActions(root, sitter);
  }

  // ==========================
  // Booking PAGE (not modal)
  // ==========================
  window.initBookingPage = function () {
    const rootForm = document.getElementById("bookingPageForm");
    const state = window.PetCareState;
    if (!state || !rootForm) return;

    ensureSelectedSitterHelpers();

    const sitterId =
      (state.getSelectedSitterId && state.getSelectedSitterId()) || null;
    const sitter =
      sitterId && typeof state.getSitterById === "function"
        ? state.getSitterById(sitterId)
        : null;

    // Fill sitter summary on booking page
    const avatarEl = document.getElementById("bookingSitterAvatar");
    const nameEl = document.getElementById("bookingSitterName");
    const ratingEl = document.getElementById("bookingSitterRating");
    const distanceEl = document.getElementById("bookingSitterDistance");

    if (sitter) {
      if (avatarEl) {
        avatarEl.style.backgroundImage = sitter.avatar
          ? "url('" + sitter.avatar + "')"
          : "none";
      }
      if (nameEl) nameEl.textContent = sitter.name || "Sitter";
      if (ratingEl)
        ratingEl.textContent =
          "★ " + (sitter.rating != null ? sitter.rating : "New");
      if (distanceEl)
        distanceEl.textContent = sitter.distance
          ? sitter.distance + " away"
          : "Nearby";
    } else {
      if (nameEl) nameEl.textContent = "Sitter";
      if (ratingEl) ratingEl.textContent = "★ New";
      if (distanceEl) distanceEl.textContent = "Nearby";
    }

    // Pre-fill client email if logged in
    if (state.getCurrentUser) {
      const user = state.getCurrentUser();
      if (user && user.email) {
        const emailInput = document.getElementById("bookingClientEmail");
        if (emailInput) emailInput.value = user.email;
      }
    }

    // Only wire submit once
    if (rootForm.__wiredBookingPage) return;
    rootForm.__wiredBookingPage = true;

    rootForm.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!window.PetCareState || !window.PetCareState.getCurrentUser) {
        alert("No logged-in user found.");
        return;
      }
      const user = window.PetCareState.getCurrentUser();
      if (!user) {
        alert("Please sign in to book an appointment.");
        return;
      }
      if (user.role !== "client") {
        alert("Only clients can book appointments in this demo.");
        return;
      }

      const state = window.PetCareState;
      const sitterId =
        state.getSelectedSitterId && state.getSelectedSitterId();
      const sitter =
        sitterId && state.getSitterById ? state.getSitterById(sitterId) : null;

      if (!sitter) {
        alert("Sitter not found in state.");
        return;
      }

      // Collect form values (same ids as before)
      const bookingData = {
        service: document.getElementById("bookingService").value,
        date: document.getElementById("bookingDate").value,
        start: document.getElementById("bookingStart").value,
        end: document.getElementById("bookingEnd").value,
        location: document.getElementById("bookingLocation").value,
        pets: document.getElementById("bookingPets").value,
        breed: document.getElementById("bookingBreed").value,
        petNotes: document.getElementById("bookingPetNotes").value,
        clientPhone: document.getElementById("bookingClientPhone").value,
        clientEmail: document.getElementById("bookingClientEmail").value,
        clientAddress: document.getElementById("bookingClientAddress").value,
      };

      let booking = null;

      if (typeof state.createBooking === "function") {
        booking = state.createBooking({
          id: "b-" + Date.now(),
          clientId: user.id,
          clientName: user.name,
          sitterId: sitter.id,
          sitterName: sitter.name,
          requestedDate: bookingData.date || "Soon",
          status: "Pending",
          details:
            "Booking via booking page. Service: " +
            bookingData.service +
            ". Notes: " +
            bookingData.petNotes,
          extra: bookingData,
        });
      } else if (typeof state.createAppointment === "function") {
        booking = state.createAppointment(user, sitter, {
          date: bookingData.date || "Soon",
          details:
            "Booking via booking page. Service: " +
            bookingData.service +
            ". Notes: " +
            bookingData.petNotes,
        });
      }

      window.__lastBookingForConfirm = {
        booking: booking,
        sitter: sitter,
        client: user,
        form: bookingData,
      };

      if (typeof window.setActivePage === "function") {
        window.setActivePage("bookingConfirmPage");
      } else {
        const pages = document.querySelectorAll(".page");
        pages.forEach((p) => p.classList.remove("active"));
        const target = document.getElementById("bookingConfirmPage");
        if (target) target.classList.add("active");
      }

      if (typeof window.initBookingConfirmPage === "function") {
        window.initBookingConfirmPage();
      }
    });
  };

  // ==========================
  // Booking confirmation page
  // ==========================
  function buildTodoChecklistHTML() {
    return `
      <div class="section-card">
        <h2>🔔 Before Your Booking Starts</h2>
        <p class="page-subtitle" style="margin-bottom:8px;">
          Keep everything smooth and safe by completing these steps.
        </p>

        <ul class="booking-todo-list" style="list-style:none; padding-left:0; font-size:13px;">
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add dog instructions (feeding, walks, routines)</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Upload vet records / vaccination proof</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add emergency contact</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add home access instructions (door code, parking, alarm)</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add medication info (if needed)</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Tell your sitter about behavior notes</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Enable location sharing (for walks / drop-ins)</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Upload your dog’s photo</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add an optional meet &amp; greet time</span>
            </label>
          </li>
          <li class="todo-item">
            <label>
              <input type="checkbox" />
              <span>Add calendar reminder</span>
            </label>
          </li>
        </ul>
      </div>
    `;
  }

  window.initBookingConfirmPage = function () {
    const root = document.getElementById("bookingConfirmRoot");
    if (!root) return;

    const data = window.__lastBookingForConfirm;
    if (!data || !data.booking || !data.sitter || !data.client) {
      root.innerHTML = `
        <div class="section-card">
          <h1>Booking confirmed</h1>
          <p class="text-muted">
            Your booking details could not be loaded, but you can view requests on your dashboard.
          </p>
          <button class="btn-primary" data-page-jump="dashboardPage">Go to dashboard</button>
        </div>
      `;
      return;
    }

    const { booking, sitter, client, form } = data;

    root.innerHTML = `
      <div class="page-header">
        <h1>Booking confirmed</h1>
        <p class="page-subtitle">
          Your request with <strong>${sitter.name}</strong> has been created. Status:
          <strong>${booking.status || "Pending"}</strong>
        </p>
      </div>

      <div class="dashboard-layout">
        <div class="dashboard-card">
          <div class="section-card">
            <h3>Booking summary</h3>
            <p style="font-size:13px;">
              <strong>Service:</strong> ${form.service || "Overnight sitting"}<br />
              <strong>Date:</strong> ${form.date || "Soon"}<br />
              <strong>Time:</strong> ${form.start || "--"} – ${form.end || "--"}<br />
              <strong>Location:</strong> ${form.location || "Not specified"}<br />
              <strong>Sitter:</strong> ${sitter.name}<br />
              <strong>Client:</strong> ${client.name}
            </p>
          </div>

          <div class="section-card">
            <h3>Pet details</h3>
            <p style="font-size:13px;">
              <strong>Pets:</strong> ${form.pets || "Not specified"}<br />
              <strong>Breed / size:</strong> ${form.breed || "Not specified"}<br />
              <strong>Notes:</strong> ${form.petNotes || "No special notes added yet."}
            </p>
          </div>

          <div class="section-card">
            <h3>Your info</h3>
            <p style="font-size:13px;">
              <strong>Phone:</strong> ${form.clientPhone || "Not provided"}<br />
              <strong>Email:</strong> ${form.clientEmail || "Not provided"}<br />
              <strong>Address:</strong> ${form.clientAddress || "Not provided"}
            </p>
          </div>

          <div class="section-card">
            <button class="btn-primary" data-page-jump="dashboardPage">
              View this booking on your dashboard
            </button>
          </div>
        </div>

        <div class="dashboard-card">
          ${buildTodoChecklistHTML()}
        </div>
      </div>
    `;

    // Simple green highlight when checklist items are checked
    const checkboxes = root.querySelectorAll(
      ".booking-todo-list input[type='checkbox']"
    );
    checkboxes.forEach((cb) => {
      cb.addEventListener("change", function () {
        const li = this.closest(".todo-item");
        if (!li) return;
        if (this.checked) {
          li.classList.add("done");
        } else {
          li.classList.remove("done");
        }
      });
    });
  };

  // ==========================================================
  // OPTIONAL: Kodecolor-style sitter profile renderer
  // (not used unless you call it)
  // ==========================================================
  function renderSitterProfileKode(root, sitter) {
    if (!root) return;

    if (!sitter) {
      // Keep your existing empty-state behavior
      renderSitterProfile(root, sitter);
      return;
    }

    // Normalize sitter shape for the shared renderer
    const normalized = {
      ...sitter,
      role: sitter.role || "sitter",
      full_name: sitter.full_name || sitter.name,
      rating: sitter.rating || sitter.avg_rating || 0,
    };

    // Clear and render the "clean profile"
    root.innerHTML = "";

    if (typeof window.PetCareBuildProfileView === "function") {
      const view = window.PetCareBuildProfileView(normalized, {
        brandName: "PetCare Portal",
        mode: "public",
        showMessageButton: true,
      });
      root.appendChild(view);
    } else {
      // If shared renderer not loaded for any reason, fallback
      renderSitterProfile(root, sitter);
      return;
    }

    // Add your existing booking/message buttons so attachHeaderActions still works
    const firstName = sitter.name ? sitter.name.split(" ")[0] : "this sitter";

    const actionsCard = document.createElement("div");
    actionsCard.className = "section-card";
    actionsCard.innerHTML = `
      <h3>Book ${firstName}</h3>
      <p class="text-muted" style="font-size:13px;">
        Request a booking or send a message – we&apos;ll add the request to your dashboard.
      </p>
      <button class="btn-primary btn-header-book" style="margin-top:6px;">
        Book now
      </button>
      <button class="btn-secondary btn-header-message" style="margin-top:6px;">
        Message sitter
      </button>
    `;
    root.appendChild(actionsCard);

    // Reuse your existing handlers
    attachHeaderActions(root, sitter);
  }

  // ====================================
  // Page initializers – called by app.js
  // ====================================
  window.initSitterProfilePage = function () {
    const root = document.getElementById("sitterProfileRoot");
    if (!root) return;

    ensureSelectedSitterHelpers();

    const state = window.PetCareState;
    if (!state || typeof state.getSitterById !== "function") {
      root.innerHTML =
        "<p class='text-muted'>State not ready. Make sure state.js is loaded.</p>";
      return;
    }

    const sitterId =
      (state.getSelectedSitterId && state.getSelectedSitterId()) || null;
    const sitter = sitterId ? state.getSitterById(sitterId) : null;

    renderSitterProfile(root, sitter);
    // If you ever want to use the Kode-style renderer instead:
    // renderSitterProfileKode(root, sitter);
  };
})();