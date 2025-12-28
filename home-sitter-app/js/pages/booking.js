// js/pages/booking.js
(function () {
  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  // Exposed state (kept compatible with your existing code style)
  window.PetCareBooking = window.PetCareBooking || {
    preview: null,
    booking: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getAuthToken() {
    // supports multiple possible storage keys
    return (
      localStorage.getItem("petcare_jwt") ||
      localStorage.getItem("petcare_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  }

  function getCurrentUser() {
    // Prefer PetCareState if available (it is the app’s canonical user source)
    try {
      if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
        const u = window.PetCareState.getCurrentUser();
        if (u && u.id && u.role && u.role !== "guest") return u;
      }
    } catch (_) {}

    // Fallback to localStorage keys used elsewhere
    try {
      const u =
        localStorage.getItem("petcare_user") ||
        localStorage.getItem("user") ||
        "";
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  function getSelectedSitterId() {
    // Try several sources so we work with both “page booking” and “modal booking”
    const fromPreview =
      window.PetCareBooking?.preview?.sitter_id ||
      window.PetCareBooking?.preview?.id ||
      window.PetCareBooking?.sitter_id ||
      null;

    if (fromPreview) return fromPreview;

    try {
      if (
        window.PetCareState &&
        window.PetCareState.getUi &&
        typeof window.PetCareState.getUi === "function"
      ) {
        const ui = window.PetCareState.getUi();
        if (ui && ui.selectedSitterId) return ui.selectedSitterId;
      }
    } catch (_) {}

    // Some builds store selected sitter id directly:
    try {
      if (
        window.PetCareState &&
        typeof window.PetCareState.getSelectedSitterId === "function"
      ) {
        const sid = window.PetCareState.getSelectedSitterId();
        if (sid) return sid;
      }
    } catch (_) {}

    return null;
  }

  function normalizeServiceType(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const v = raw.toLowerCase();

    if (["overnight", "walk", "dropin", "daycare"].includes(v)) return v;

    if (v.includes("overnight")) return "overnight";
    if (v.includes("drop")) return "dropin";
    if (v.includes("walk")) return "walk";
    if (v.includes("daycare") || v.includes("day care")) return "daycare";

    return null;
  }

  function humanServiceLabel(code) {
    switch (code) {
      case "overnight":
        return "Overnight sitting";
      case "dropin":
        return "Drop-in visit";
      case "walk":
        return "Dog walking";
      case "daycare":
        return "Doggy daycare";
      default:
        return "Pet care";
    }
  }

  function priceForService(code) {
    // simple starter pricing
    switch (code) {
      case "overnight":
        return 40;
      case "dropin":
        return 20;
      case "walk":
        return 15;
      case "daycare":
        return 35;
      default:
        return 25;
    }
  }

  function toISO(dateStr, timeStr) {
    // dateStr: YYYY-MM-DD, timeStr: HH:MM
    if (!dateStr || !timeStr) return null;
    const d = new Date(`${dateStr}T${timeStr}:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // ---------- Stripe mount helpers ----------

  function ensureBookingPaymentBlock() {
    // If the page already includes a Stripe mount, do nothing.
    // Booking page uses: #stripe-card-element-page (per your HTML).
    if ($("stripe-card-element-page")) return;

    // Otherwise, inject a fallback Payment section on the booking page (below "Your info")
    const form = $("bookingPageForm");
    if (!form) return;

    if ($("bookingPaymentSection")) return;

    const section = document.createElement("div");
    section.className = "section-card";
    section.id = "bookingPaymentSection";
    section.innerHTML = `
      <h3>Payment</h3>
      <p class="text-muted" style="font-size:13px;">
        Enter your card details below (Stripe test mode).
      </p>

      <div id="bookingStripeCardMount" class="stripe-card-element"></div>
      <div id="bookingCardErrors" class="card-errors small text-muted" style="margin-top:6px;"></div>

      <div class="small text-muted" style="margin-top:6px;">
        Tip: If the card box doesn't appear, Brave Shields / an ad blocker may be blocking Stripe.
      </div>
    `;

    // Insert before the final action buttons card (last .section-card)
    const cards = form.querySelectorAll(".section-card");
    if (cards.length) {
      cards[cards.length - 1].before(section);
    } else {
      form.appendChild(section);
    }
  }

  function mountStripeCardInto(containerId) {
    if (!window.StripeHelpers) return false;
    const container = document.getElementById(containerId);
    if (!container) return false;

    try {
      window.StripeHelpers.mountCard(containerId);
      return true;
    } catch (err) {
      console.warn("Stripe mount error:", err);
      return false;
    }
  }

  function mountStripeOnBookingPage() {
    if (!window.StripeHelpers) return;

    // Prefer the booking page’s existing mount point
    if (mountStripeCardInto("stripe-card-element-page")) return;

    // If not present, ensure fallback block exists and mount into it
    ensureBookingPaymentBlock();
    mountStripeCardInto("bookingStripeCardMount");
  }

  function mountStripeOnBookingModal() {
    if (!window.StripeHelpers) return;

    // Booking modal payment tab uses #stripe-card-element (per your HTML)
    mountStripeCardInto("stripe-card-element");
  }

  // ---------- Error display helpers ----------

  function setBookingError(msg) {
    const message = msg || "";

    // Try all known error containers used across your UI
    const ids = [
      "bookingCardErrors",        // injected fallback
      "card-errors-page",         // booking page markup
      "card-errors",              // modal markup / older
      "bookingCardErrorsModal"    // optional
    ];

    let wrote = false;
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = message;
        wrote = true;
      }
    });

    // If nothing exists yet, do nothing silently (no alert spam)
    return wrote;
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function getValFromIds(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const v = el.value;
      if (v != null) return v;
    }
    return "";
  }

  function buildBookingPayload(source /* "page" | "modal" */) {
    const user = getCurrentUser();
    const clientId = user?.id || user?.user?.id || null;

    const sitterId = getSelectedSitterId();

    // Support both Page IDs and Modal IDs (so this works from sitter booking modal too)
    const serviceRaw =
      source === "modal"
        ? getValFromIds(["bookingModalService", "bookingService"])
        : getValFromIds(["bookingService", "bookingModalService"]);

    const service = normalizeServiceType(serviceRaw);

    const date =
      source === "modal"
        ? getValFromIds(["bookingModalDate", "bookingDate"])
        : getValFromIds(["bookingDate", "bookingModalDate"]);

    const start =
      source === "modal"
        ? getValFromIds(["bookingModalStart", "bookingStart"])
        : getValFromIds(["bookingStart", "bookingModalStart"]);

    const end =
      source === "modal"
        ? getValFromIds(["bookingModalEnd", "bookingEnd"])
        : getValFromIds(["bookingEnd", "bookingModalEnd"]);

    const startIso = toISO(date, start);
    const endIso = toISO(date, end);

    const location =
      source === "modal"
        ? getValFromIds(["bookingModalLocation", "bookingLocation"])
        : getValFromIds(["bookingLocation", "bookingModalLocation"]);

    const pets =
      source === "modal"
        ? getValFromIds(["bookingModalPets", "bookingPets"])
        : getValFromIds(["bookingPets", "bookingModalPets"]);

    const breed =
      source === "modal"
        ? getValFromIds(["bookingModalBreed", "bookingBreed"])
        : getValFromIds(["bookingBreed", "bookingModalBreed"]);

    const notes =
      source === "modal"
        ? getValFromIds(["bookingModalPetNotes", "bookingPetNotes"])
        : getValFromIds(["bookingPetNotes", "bookingModalPetNotes"]);

    const clientPhone =
      source === "modal"
        ? getValFromIds(["bookingModalClientPhone", "bookingClientPhone"])
        : getValFromIds(["bookingClientPhone", "bookingModalClientPhone"]);

    const clientEmail =
      source === "modal"
        ? getValFromIds(["bookingModalClientEmail", "bookingClientEmail"])
        : getValFromIds(["bookingClientEmail", "bookingModalClientEmail"]);

    const clientAddress =
      source === "modal"
        ? getValFromIds(["bookingModalClientAddress", "bookingClientAddress"])
        : getValFromIds(["bookingClientAddress", "bookingModalClientAddress"]);

    if (!clientId) {
      return { ok: false, error: "You must be logged in as a client to book." };
    }
    if (!sitterId) {
      return { ok: false, error: "Missing sitter_id (select a sitter first)." };
    }
    if (!service) {
      return {
        ok: false,
        error:
          "Invalid service_type. Use overnight / walk / dropin / daycare (or normal labels)."
      };
    }
    if (!startIso || !endIso) {
      return {
        ok: false,
        error: "Please choose date, start time, and end time."
      };
    }

    const base = priceForService(service);
    const serviceFee = Math.round(base * 0.2 * 100) / 100;
    const total = Math.round((base + serviceFee) * 100) / 100;

    const combinedNotes = [
      notes ? `Pet notes: ${notes}` : "",
      pets ? `Pets: ${pets}` : "",
      breed ? `Breed/size: ${breed}` : "",
      clientPhone ? `Phone: ${clientPhone}` : "",
      clientEmail ? `Email: ${clientEmail}` : "",
      clientAddress ? `Address: ${clientAddress}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    return {
      ok: true,
      payload: {
        client_id: clientId,
        sitter_id: sitterId,
        pet_id: null,
        service_type: service, // normalized enum
        start_time: startIso,
        end_time: endIso,
        location: location || null,
        price_total: total,
        notes: combinedNotes || null,
        payment_method: "card",
        currency: "USD"
      },
      display: {
        base,
        serviceFee,
        total,
        serviceLabel: humanServiceLabel(service)
      }
    };
  }

  async function handleConfirmAndPay(source /* "page" | "modal" */, e) {
    if (e) e.preventDefault();
    setBookingError("");

    // Ensure stripe is mounted right now
    if (window.initStripe) window.initStripe();
    if (source === "modal") {
      mountStripeOnBookingModal();
    } else {
      mountStripeOnBookingPage();
    }

    if (window.StripeHelpers?.isStripeBlocked?.()) {
      setBookingError(
        "Stripe is blocked (Brave Shields/ad blocker). Disable Shields for this site and refresh."
      );
      return;
    }

    const built = buildBookingPayload(source);
    if (!built.ok) {
      setBookingError(built.error);
      return;
    }

    const { payload, display } = built;

    const token = getAuthToken();
    if (!token) {
      setBookingError("You’re not authenticated (missing token). Please log in again.");
      return;
    }

    // Disable button to prevent double charges
    const disableBtn = (btn, disabled) => {
      if (!btn) return;
      try {
        btn.disabled = !!disabled;
        btn.setAttribute("aria-disabled", disabled ? "true" : "false");
      } catch (_) {}
    };

    const activeBtn =
      source === "modal"
        ? $("bookingModalConfirmBtn")
        : $("bookingPayNowBtn") ||
          document.getElementById("confirmPayBtn") ||
          document.querySelector('button.btn-primary[type="button"][data-action="confirm-pay"]') ||
          document.querySelector("button.btn-primary.btn-lg[data-action='confirm-pay']");

    disableBtn(activeBtn, true);

    try {
      // 1) Create PaymentIntent
      const amountCents = Math.round(Number(payload.price_total) * 100);

      const pi = await window.StripeHelpers.createPaymentIntent(
        amountCents,
        `AnimalSitter – ${display.serviceLabel}`
      );

      // 2) Confirm payment with card element
      const paymentIntent = await window.StripeHelpers.confirmCardPayment(
        pi.clientSecret
      );

      // 3) Create booking in DB (include payment_intent_id)
      payload.payment_intent_id = paymentIntent?.id || pi.paymentIntentId || null;

      const { res, data } = await fetchJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Booking failed after payment.");
      }

      // success UI
      window.PetCareBooking.booking = data;

      // Refresh local bookings list if the state helper exists
      try {
        if (window.PetCareState?.refreshBookingsFromApi) {
          await window.PetCareState.refreshBookingsFromApi(token);
        }
      } catch (_) {}

      // If you have a confirm page renderer, jump there
      if (window.showPage) {
        window.showPage("bookingConfirmPage");
      } else if (typeof window.setActivePage === "function") {
        window.setActivePage("bookingConfirmPage");
      }

      const root = document.getElementById("bookingConfirmRoot");
      if (root) {
        root.innerHTML = `
          <h2>Booking confirmed ✅</h2>
          <p class="text-muted">Payment succeeded and your booking was created.</p>
          <div style="margin-top:10px;" class="section-card">
            <div><strong>Service:</strong> ${display.serviceLabel}</div>
            <div><strong>Total:</strong> $${Number(payload.price_total).toFixed(2)}</div>
            <div><strong>Booking ID:</strong> ${data.booking_id || data.id || "n/a"}</div>
            <div><strong>PaymentIntent:</strong> ${payload.payment_intent_id || "n/a"}</div>
          </div>
          <button type="button" class="btn-primary" style="margin-top:10px;"
            onclick="(window.showPage && window.showPage('dashboardPage')) || (window.setActivePage && window.setActivePage('dashboardPage'))">
            Go to Dashboard
          </button>
        `;
      }

      // Close modal if we were booking from modal
      if (source === "modal") {
        const modal = $("bookingModal");
        if (modal) {
          modal.classList.remove("active");
          modal.style.display = "none";
        }
      }
    } catch (err) {
      console.error("Booking payment error:", err);
      setBookingError(err.message || "Payment/booking failed.");
    } finally {
      disableBtn(activeBtn, false);
    }
  }

  function wireButtons() {
    // Booking page form (optional)
    const form = $("bookingPageForm");
    if (form && !form.__wiredBooking) {
      form.__wiredBooking = true;

      // If user submits the form, we treat it as "review" and remind to pay
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        setBookingError("");
        mountStripeOnBookingPage();
        alert(
          "Review complete. Click “Pay Now” / “Confirm & Pay” to charge the card and finalize."
        );
      });
    }

    // Booking page pay button
    const payNowBtn = $("bookingPayNowBtn");
    if (payNowBtn && !payNowBtn.__wiredPayNow) {
      payNowBtn.__wiredPayNow = true;
      payNowBtn.addEventListener("click", function (e) {
        handleConfirmAndPay("page", e);
      });
    }

    // Confirm & Pay button (page fallbacks)
    const confirmBtn =
      document.getElementById("confirmPayBtn") ||
      document.querySelector('button.btn-primary[type="button"][data-action="confirm-pay"]') ||
      document.querySelector("button.btn-primary.btn-lg[data-action='confirm-pay']");

    // Fallback by text
    const allButtons = Array.from(document.querySelectorAll("button"));
    const fallbackConfirm = allButtons.find(
      (b) => (b.textContent || "").trim().toLowerCase() === "confirm & pay"
    );

    const btn = confirmBtn || fallbackConfirm;
    if (btn && !btn.__wiredPay) {
      btn.__wiredPay = true;
      btn.addEventListener("click", function (e) {
        handleConfirmAndPay("page", e);
      });
    }

    // Booking modal confirm button
    const modalConfirm = $("bookingModalConfirmBtn");
    if (modalConfirm && !modalConfirm.__wiredModalPay) {
      modalConfirm.__wiredModalPay = true;
      modalConfirm.addEventListener("click", function (e) {
        handleConfirmAndPay("modal", e);
      });
    }
  }

  // Public init called by app router when page opens
  window.initBookingPage = function initBookingPage() {
    // Payment needs Stripe ready
    if (window.initStripe) window.initStripe();

    // Mount for booking page
    mountStripeOnBookingPage();

    // Also mount for booking modal if it exists (sitter -> book flow)
    mountStripeOnBookingModal();

    wireButtons();
  };

  // Also attempt to mount after DOM ready (first load)
  document.addEventListener("DOMContentLoaded", function () {
    // Initialize stripe if either booking page or booking modal exists
    if ($("bookingPage") || $("bookingModal")) {
      if (window.initStripe) window.initStripe();
      mountStripeOnBookingPage();
      mountStripeOnBookingModal();
      wireButtons();
    }
  });
})();
