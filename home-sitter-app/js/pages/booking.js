// js/pages/booking.js
// Handles the booking modal + full booking confirmation page with To-Do checklist
// Now wired to Stripe + backend /bookings so sitters & clients can see real bookings.

(function () {
  window.PetCareBooking = {
    preview: null, // used in modal
    booking: null  // confirmed booking
  };

  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  // -----------------------------------
  // Stripe frontend setup (card element)
  // -----------------------------------
  // IMPORTANT: set your publishable key, e.g. in a script tag:
  //   <script>window.STRIPE_PUBLISHABLE_KEY = "pk_test_123...";</script>
  const STRIPE_PUBLISHABLE_KEY =
    window.STRIPE_PUBLISHABLE_KEY || "pk_test_REPLACE_ME";

  let stripeCardElement = null;

  function mountStripeCardElement() {
    // Already mounted
    if (stripeCardElement) return;

    if (!window.Stripe) {
      console.warn("[Booking] Stripe.js not loaded on page.");
      return;
    }

    if (
      !STRIPE_PUBLISHABLE_KEY ||
      STRIPE_PUBLISHABLE_KEY === "pk_test_REPLACE_ME"
    ) {
      console.warn(
        "[Booking] Set window.STRIPE_PUBLISHABLE_KEY to your real publishable key."
      );
      return;
    }

    // Create global Stripe instance if needed
    if (!window.stripe) {
      window.stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    }

    const elements = window.stripe.elements();
    stripeCardElement = elements.create("card", {
      hidePostalCode: false
    });

    const mountNode = document.getElementById("stripe-card-element");
    if (!mountNode) {
      console.warn("[Booking] #stripe-card-element not found in DOM.");
      return;
    }

    stripeCardElement.mount(mountNode);

    // Expose for confirmBookingFromModal()
    window.getStripeCardElement = () => stripeCardElement;
  }

  // Called by ensureStripeCardMounted()
  window.mountStripeCardElement = mountStripeCardElement;

  // ----------------------
  // Helpers & auth headers
  // ----------------------

  // Small util to parse a price like "$40" -> 40
  function parsePrice(str) {
    if (!str) return 0;
    const n = parseFloat(String(str).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function formatCurrency(amount) {
    return "$" + Number(amount || 0).toFixed(2);
  }

  function getToken() {
    try {
      return localStorage.getItem("petcare_token");
    } catch {
      return null;
    }
  }

  function buildAuthJsonHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  function toMySqlDateTime(d) {
    // "YYYY-MM-DD HH:MM:SS"
    return d.toISOString().slice(0, 19).replace("T", " ");
  }

  // Ensure Stripe card element is mounted
  function ensureStripeCardMounted() {
    if (!window.mountStripeCardElement) return;
    window.mountStripeCardElement();
  }

  // ----------------------
  // Booking modal
  // ----------------------

  // Open modal for a given sitter
  window.openBookingModal = function (sitterId) {
    const S = window.PetCareState;
    if (!S || typeof S.getSitterById !== "function") {
      alert("State not ready for booking.");
      return;
    }

    const sitter = S.getSitterById(sitterId);
    if (!sitter) {
      alert("Could not find sitter.");
      return;
    }

    const user = S.getCurrentUser && S.getCurrentUser();
    if (!user || user.role !== "client") {
      alert("Please log in as a client to book.");
      return;
    }

    // Pick first service as default
    const primaryService =
      (sitter.services && sitter.services[0]) || {
        name: "In-Home Sitting",
        price: "$40",
        duration: "Overnight stay"
      };

    const basePrice = parsePrice(primaryService.price);
    const extraDog = 10; // demo value
    const serviceFee = 2; // demo value
    const total = basePrice + extraDog + serviceFee;

    // Save preview info
    window.PetCareBooking.preview = {
      sitter,
      client: user,
      service: primaryService,
      pricing: {
        basePrice,
        extraDog,
        serviceFee,
        total
      }
    };

    // Fill modal fields
    const modal = document.getElementById("bookingModal");
    if (!modal) return;

    const nameEl = document.getElementById("bookingSitterName");
    const subtitleEl = document.getElementById("bookingSitterSubtitle");
    const avatarEl = document.getElementById("bookingSitterAvatar");
    const badgesEl = document.getElementById("bookingSitterBadges");
    const svcNameEl = document.getElementById("bookingServiceName");
    const line1LabelEl = document.getElementById("bookingLine1Label");
    const line1PriceEl = document.getElementById("bookingLine1Price");
    const line2LabelEl = document.getElementById("bookingLine2Label");
    const line2PriceEl = document.getElementById("bookingLine2Price");
    const line3PriceEl = document.getElementById("bookingLine3Price");
    const totalPriceEl = document.getElementById("bookingTotalPrice");
    const clientNameEl = document.getElementById("bookingClientName");
    const clientEmailEl = document.getElementById("bookingClientEmail");
    const policiesEl = document.getElementById("bookingPolicies");

    if (nameEl) nameEl.textContent = sitter.name;
    if (subtitleEl) {
      const dist = sitter.distance ? ` • Within ${sitter.distance} of you` : "";
      subtitleEl.textContent = `⭐ ${sitter.rating || "New"} (${
        sitter.reviewsCount || 0
      } reviews)${dist}`;
    }
    if (avatarEl) {
      avatarEl.style.backgroundImage = sitter.avatar
        ? `url('${sitter.avatar}')`
        : "none";
    }
    if (badgesEl) {
      if (sitter.badges && sitter.badges.length) {
        badgesEl.innerHTML = sitter.badges
          .map((b) => `<span class="chip">${b}</span>`)
          .join(" ");
      } else {
        badgesEl.textContent = "";
      }
    }

    if (svcNameEl) svcNameEl.textContent = primaryService.name || "Service";
    if (line1LabelEl)
      line1LabelEl.textContent = primaryService.name || "Base service";
    if (line1PriceEl) line1PriceEl.textContent = primaryService.price || "$0";
    if (line2LabelEl) line2LabelEl.textContent = "Extra dog (demo)";
    if (line2PriceEl)
      line2PriceEl.textContent = extraDog
        ? formatCurrency(extraDog)
        : "$0.00";
    if (line3PriceEl)
      line3PriceEl.textContent = serviceFee
        ? formatCurrency(serviceFee)
        : "$2.00";
    if (totalPriceEl) totalPriceEl.textContent = formatCurrency(total);

    if (clientNameEl) clientNameEl.textContent = user.name || "Client";
    if (clientEmailEl) clientEmailEl.textContent = user.email || "";

    if (policiesEl) {
      const p = sitter.policies || {};
      policiesEl.innerHTML = `
        <ul style="padding-left:18px;">
          <li><strong>Cancellation:</strong> ${
            p.cancellation || "Not specified"
          }</li>
          <li><strong>Meet &amp; greet:</strong> ${
            p.meetAndGreet || "Recommended"
          }</li>
          <li><strong>Aggressive dog policy:</strong> ${
            p.aggressiveDogs || "Not specified"
          }</li>
          <li><strong>Extra fees:</strong> ${
            p.extraFees || "Not specified"
          }</li>
        </ul>
      `;
    }

    // Pet info demo placeholders (later you can pull from PetCareState.getPets)
    const petNamesEl = document.getElementById("bookingPetNames");
    const petBreedEl = document.getElementById("bookingPetBreed");
    const petFeedingEl = document.getElementById("bookingPetFeeding");
    const petBehaviorEl = document.getElementById("bookingPetBehavior");
    const petMedicationEl = document.getElementById("bookingPetMedication");
    const petWalksEl = document.getElementById("bookingPetWalks");

    if (petNamesEl) petNamesEl.textContent = "Your dog(s) – demo";
    if (petBreedEl) petBreedEl.textContent = "Breed / size – demo";
    if (petFeedingEl) petFeedingEl.textContent = "Feeding: Not set (demo)";
    if (petBehaviorEl) petBehaviorEl.textContent = "Behavior: Not set (demo)";
    if (petMedicationEl)
      petMedicationEl.textContent = "Medication: Not set (demo)";
    if (petWalksEl)
      petWalksEl.textContent = "Walk schedule: Not set (demo)";

    // Show modal
    modal.style.display = "flex";

    // Mount Stripe card input
    ensureStripeCardMounted();
  };

  function closeBookingModal() {
    const modal = document.getElementById("bookingModal");
    if (modal) modal.style.display = "none";
  }

  // -------------------------------------------------
  // Confirm booking + process Stripe payment + POST /bookings
  // -------------------------------------------------
  async function confirmBookingFromModal() {
    const preview = window.PetCareBooking.preview;
    if (!preview) {
      closeBookingModal();
      return;
    }

    const S = window.PetCareState;
    if (!S) {
      closeBookingModal();
      return;
    }

    const btn = document.getElementById("bookingModalConfirmBtn");
    const errorEl = document.getElementById("card-errors");
    const cardElement = window.getStripeCardElement
      ? window.getStripeCardElement()
      : null;

    if (!window.stripe || !cardElement) {
      if (errorEl) {
        errorEl.textContent =
          "Payment form not ready. Please refresh the page.";
      }
      return;
    }

    try {
      if (errorEl) errorEl.textContent = "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Processing...";
      }

      // 1) Create PaymentIntent on backend (amount in cents)
      const total = preview.pricing.total;
      const amountCents = Math.round(total * 100);

      const piRes = await fetch(
        `${API_BASE}/stripe/create-payment-intent`,
        {
          method: "POST",
          headers: buildAuthJsonHeaders(),
          body: JSON.stringify({
            amount: amountCents,
            currency: "usd",
            description: `Booking with ${preview.sitter.name}`
          })
        }
      );

      const piData = await piRes.json().catch(() => ({}));
      if (!piRes.ok || !piData.clientSecret) {
        throw new Error(piData.error || "Failed to start payment.");
      }

      const clientSecret = piData.clientSecret;

      // 2) Confirm the card payment (Stripe.js)
      const { error, paymentIntent } = await window.stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: preview.client.name || undefined,
              email: preview.client.email || undefined
            }
          }
        }
      );

      if (error) {
        throw new Error(error.message || "Payment failed.");
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        throw new Error("Payment did not complete.");
      }

      // 3) Payment success – create REAL booking in backend
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

      const bkRes = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: buildAuthJsonHeaders(),
        body: JSON.stringify({
          client_id: preview.client.id,
          sitter_id: preview.sitter.id,
          pet_id: null,
          service_type: preview.service.name || "Pet sitting",
          start_time: toMySqlDateTime(now),
          end_time: toMySqlDateTime(end),
          location: "",
          price_total: preview.pricing.total,
          notes: `Stripe paymentIntent ${paymentIntent.id}`
        })
      });

      const bkData = await bkRes.json().catch(() => ({}));
      if (!bkRes.ok || !bkData.ok) {
        throw new Error(
          bkData.error || "Payment succeeded but booking failed."
        );
      }

      // 4) Build local booking object for state + booking page
      const bookingObj = {
        id: bkData.booking_id || "b-" + Date.now(),
        clientId: bkData.client_id || preview.client.id,
        sitterId: bkData.sitter_id || preview.sitter.id,
        clientName: preview.client.name,
        sitterName: preview.sitter.name,
        serviceName: bkData.service_type || preview.service.name,
        requestedDate: new Date().toLocaleString(),
        status: "Confirmed & Paid",
        details:
          "Total: " +
          formatCurrency(bkData.total_price || preview.pricing.total) +
          (bkData.platform_fee != null
            ? ` • Platform fee: ${formatCurrency(
                bkData.platform_fee
              )} • Sitter payout: ${formatCurrency(
                bkData.sitter_payout || 0
              )}`
            : ""),
        paymentIntentId: paymentIntent.id,
        totalPaid: bkData.total_price || preview.pricing.total,
        commissionRate: bkData.commission_rate,
        platformFee: bkData.platform_fee,
        sitterPayout: bkData.sitter_payout
      };

      if (typeof S.createBooking === "function") {
        S.createBooking(bookingObj);
      }

      // Optionally sync with backend bookings
      if (typeof S.refreshBookingsFromApi === "function") {
        try {
          await S.refreshBookingsFromApi();
        } catch (e) {
          console.warn("refreshBookingsFromApi failed:", e);
        }
      }

      window.PetCareBooking.booking = bookingObj;
      closeBookingModal();

      if (typeof window.setActivePage === "function") {
        window.setActivePage("bookingPage");
      }
    } catch (err) {
      console.error("Booking payment error:", err);
      if (errorEl) {
        errorEl.textContent =
          err.message || "Payment error, please try again.";
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Confirm & Pay";
      }
    }
  }

  // -------------------------
  // Booking confirmation page
  // -------------------------

  // Render the “Before Your Booking Starts” To-Do checklist
  function renderBookingChecklist(root) {
    const booking = window.PetCareBooking.booking;
    if (!booking) {
      root.innerHTML = `
        <div class="section-card">
          <h1>Booking</h1>
          <p class="text-muted">
            No booking found. Go back to a sitter profile and click <strong>Book sitter</strong>.
          </p>
          <button class="btn-secondary" data-page-jump="homePage">← Back to Home</button>
        </div>
      `;
      return;
    }

    const sitterName = booking.sitterName || "your sitter";

    const checklistItems = [
      {
        id: "todo-instructions",
        title: "Add dog instructions",
        details:
          "Feeding schedule, walking schedule, routines, and bedtime habits."
      },
      {
        id: "todo-vet-records",
        title: "Upload vet records / vaccination proof",
        details: "Rabies, DHPP, Bordetella, or your local requirements."
      },
      {
        id: "todo-emergency-contact",
        title: "Add emergency contact",
        details: "Name, phone, relationship — in case we cannot reach you."
      },
      {
        id: "todo-home-access",
        title: "Add home access instructions",
        details: "Door code, key location, parking details, alarm info."
      },
      {
        id: "todo-medication",
        title: "Add medication info (if needed)",
        details:
          "Medication name, dosage, times, and how to give it."
      },
      {
        id: "todo-behavior",
        title: "Tell your sitter about any behavior notes",
        details:
          "Aggression triggers, anxiety, reactions to dogs/children, separation issues."
      },
      {
        id: "todo-location-share",
        title: "Enable location sharing (for walks / drop-ins)",
        details: "Optional but useful for live walk tracking."
      },
      {
        id: "todo-dog-photo",
        title: "Upload your dog's photo",
        details: `Helps ${sitterName} recognize your dog quickly.`
      },
      {
        id: "todo-meet-greet",
        title: "Add a meet & greet time",
        details: "Optional 15-minute intro to align expectations."
      },
      {
        id: "todo-calendar-reminder",
        title: "Add calendar reminder",
        details: "So you never forget pickup or drop-off times."
      }
    ];

    root.innerHTML = `
      <div class="page-header">
        <button class="btn-small" data-page-jump="homePage">← Back to Home</button>
        <h1 style="margin-top:8px;">Booking confirmed</h1>
        <p class="page-subtitle">
          You’re booked with <strong>${sitterName}</strong> for <strong>${
      booking.serviceName || "pet sitting"
    }</strong>.
        </p>
      </div>

      <div class="dashboard-layout">
        <div class="dashboard-card">
          <div class="section-card">
            <h3>Booking details</h3>
            <p style="font-size:13px;">
              <strong>Sitter:</strong> ${sitterName}<br/>
              <strong>Status:</strong> ${booking.status}<br/>
              <strong>When:</strong> ${
                booking.requestedDate || "Not set"
              }<br/>
              <strong>Notes:</strong> ${booking.details}
            </p>
          </div>

          <div class="section-card">
            <h3>🔔 Before your booking starts</h3>
            <p class="text-muted" style="font-size:12px;">
              Use this checklist to keep everything safe and smooth for you and your dog.
            </p>

            <ul style="list-style:none; padding-left:0; margin-top:8px;" id="bookingChecklistList">
              ${checklistItems
                .map(
                  (item) => `
                <li
                  data-checklist-id="${item.id}"
                  style="
                    border:1px solid #e5e7eb;
                    border-radius:8px;
                    padding:8px 10px;
                    margin-bottom:8px;
                    display:flex;
                    align-items:flex-start;
                    gap:8px;
                    font-size:13px;
                    cursor:pointer;
                  "
                >
                  <input type="checkbox" style="margin-top:3px;" />
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span><strong>${item.title}</strong></span>
                      <span style="font-size:12px; color:#6b7280;">›</span>
                    </div>
                    <div class="text-muted" style="font-size:12px; margin-top:2px;">
                      ${item.details}
                    </div>
                  </div>
                </li>
              `
                )
                .join("")}
            </ul>
          </div>
        </div>

        <div class="dashboard-card">
          <div class="section-card">
            <h3>Next steps</h3>
            <p style="font-size:13px;">
              • You can message <strong>${sitterName}</strong> anytime from the Messages tab.<br/>
              • Make sure your contact info and address are up to date in Settings.<br/>
              • In a real app, you’d see live status updates here.
            </p>
            <button class="btn-secondary" data-page-jump="messagesPage" style="margin-top:6px;">
              Message your sitter
            </button>
          </div>
        </div>
      </div>
    `;

    // Interactive checklist: turn card green when checkbox is checked
    const list = document.getElementById("bookingChecklistList");
    if (list) {
      list.addEventListener("change", function (e) {
        const li = e.target.closest("li[data-checklist-id]");
        if (!li) return;
        if (e.target.checked) {
          li.style.backgroundColor = "#ecfdf5"; // light green
          li.style.borderColor = "#22c55e";
        } else {
          li.style.backgroundColor = "#ffffff";
          li.style.borderColor = "#e5e7eb";
        }
      });
    }
  }

  // Public init for booking page
  window.initBookingPage = function () {
    const root = document.getElementById("bookingPageRoot");
    if (!root) return;
    renderBookingChecklist(root);
  };

  // Wire modal buttons once DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    const closeBtn = document.getElementById("bookingModalClose");
    const cancelBtn = document.getElementById("bookingModalCancelBtn");
    const confirmBtn = document.getElementById("bookingModalConfirmBtn");
    const editBtn = document.getElementById("bookingModalEditBtn");

    if (closeBtn) closeBtn.addEventListener("click", closeBookingModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeBookingModal);

    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        confirmBookingFromModal();
      });
    }

    if (editBtn) {
      editBtn.addEventListener("click", function () {
        // For now, just close and show a message.
        closeBookingModal();
        alert(
          "Edit flow not implemented yet. In a future version this can change times, pets, etc."
        );
      });
    }
  });
})();