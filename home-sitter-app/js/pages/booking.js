// js/pages/booking.js
// Booking page + confirmation modal + Stripe payment
// FIX: Booking page payment section was missing because booking UI is often rendered/overwritten by JS.
// This file now INJECTS the payment UI into the booking page form automatically and mounts Stripe there.

(function () {
  window.PetCareBooking = window.PetCareBooking || { preview: null, booking: null };

  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";
  const STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || "pk_test_REPLACE_ME";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function getAuthToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("jwt") ||
      localStorage.getItem("petcare_token") ||
      ""
    );
  }

  async function apiFetch(path, opts = {}) {
    const token = getAuthToken();
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ---------------------------------------
  // Normalize service_type for backend enum
  // ---------------------------------------
  function normalizeServiceType(input) {
    const raw = (input ?? "").toString().trim();
    if (!raw) return null;

    const lower = raw.toLowerCase().trim();
    if (["overnight", "walk", "dropin", "daycare"].includes(lower)) return lower;

    if (lower.includes("walk")) return "walk";
    if (lower.includes("drop")) return "dropin";
    if (lower.includes("daycare")) return "daycare";
    if (lower.includes("sit")) return "overnight";

    return null;
  }

  // ---------------------------
  // Stripe (two mount points)
  // ---------------------------
  let stripe = null;
  let elements = null;

  let cardElPage = null;
  let cardElModal = null;

  function ensureStripe() {
    if (stripe && elements) return true;

    if (!window.Stripe) {
      console.warn("[Booking] Stripe.js not loaded.");
      return false;
    }
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes("REPLACE_ME")) {
      console.warn("[Booking] Missing Stripe publishable key.");
      return false;
    }

    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    elements = stripe.elements();
    return true;
  }

  function setError(targetSelector, msg) {
    const el = $(targetSelector);
    if (el) el.textContent = msg || "";
  }

  function mountCardIfNeeded(mountSelector, errorSelector, which) {
    if (!ensureStripe()) return;

    const mountPoint = $(mountSelector);
    if (!mountPoint) return;

    // Already mounted?
    if (mountPoint.querySelector(".StripeElement")) return;

    // Ensure the container has height
    if (!mountPoint.style.minHeight) mountPoint.style.minHeight = "44px";

    const card = elements.create("card", { hidePostalCode: true });
    card.mount(mountPoint);

    const errBox = $(errorSelector);
    if (errBox) errBox.textContent = "";

    card.on("change", (event) => {
      const e = $(errorSelector);
      if (!e) return;
      e.textContent = event.error ? event.error.message : "";
    });

    if (which === "page") cardElPage = card;
    if (which === "modal") cardElModal = card;
  }

  function mountPagePayment() {
    // Booking page card element
    mountCardIfNeeded("#stripe-card-element-page", "#card-errors-page", "page");
  }

  function mountModalPayment() {
    // Modal card element
    mountCardIfNeeded("#bookingModal #stripe-card-element", "#bookingModal #card-errors", "modal");
  }

  // -------------------------------------------------------
  // IMPORTANT FIX: Inject booking-page Payment UI if missing
  // -------------------------------------------------------
  function ensureBookingPagePaymentUI() {
    const form = $("#bookingPageForm");
    if (!form) return;

    // If payment UI already exists, just mount Stripe and exit
    if ($("#stripe-card-element-page") && $("#bookingPayNowBtn")) {
      // mount after a tick (sometimes page is toggled visible after render)
      setTimeout(() => mountPagePayment(), 50);
      return;
    }

    // Find the last "actions" card (the card that contains buttons)
    const cards = Array.from(form.querySelectorAll(".section-card"));
    const actionsCard =
      cards.find((c) => c.querySelector("button[type='submit']")) || cards[cards.length - 1];

    // 1) Create payment card if it doesn't exist
    if (!$("#stripe-card-element-page")) {
      const payCard = document.createElement("div");
      payCard.className = "section-card";
      payCard.id = "bookingPagePaymentCard";
      payCard.innerHTML = `
        <h3>Payment</h3>
        <p class="small text-muted">Enter your card details below (Stripe test mode).</p>
        <div id="stripe-card-element-page" class="stripe-card-element"></div>
        <div id="card-errors-page" class="card-errors small text-muted"></div>
      `;

      // Insert payment card right before the actions card
      if (actionsCard && actionsCard.parentNode) {
        actionsCard.parentNode.insertBefore(payCard, actionsCard);
      } else {
        form.appendChild(payCard);
      }
    }

    // 2) Ensure "Confirm & Pay" button exists on booking page
    if (!$("#bookingPayNowBtn")) {
      if (actionsCard) {
        const submitBtn = actionsCard.querySelector("button[type='submit']");
        const backBtn = actionsCard.querySelector("button.btn-secondary, button[data-page-jump]");

        const payBtn = document.createElement("button");
        payBtn.type = "button";
        payBtn.id = "bookingPayNowBtn";
        payBtn.className = "btn-primary";
        payBtn.style.marginLeft = "8px";
        payBtn.textContent = "Confirm & Pay";

        // Put it next to Request booking
        if (submitBtn && submitBtn.parentNode) {
          submitBtn.insertAdjacentElement("afterend", payBtn);
        } else if (backBtn && backBtn.parentNode) {
          backBtn.parentNode.insertBefore(payBtn, backBtn);
        } else {
          actionsCard.appendChild(payBtn);
        }
      }
    }

    // Mount Stripe after DOM insertion
    setTimeout(() => mountPagePayment(), 50);
  }

  // -----------------------------------
  // Booking form -> preview (modal flow)
  // -----------------------------------
  function readBookingFormPreview() {
    const serviceVal = ($("#bookingService")?.value || "").trim();
    const date = ($("#bookingDate")?.value || "").trim();
    const start = ($("#bookingStart")?.value || "").trim();
    const end = ($("#bookingEnd")?.value || "").trim();
    const location = ($("#bookingLocation")?.value || "").trim();

    const pets = ($("#bookingPets")?.value || "").trim();
    const breed = ($("#bookingBreed")?.value || "").trim();
    const notes = ($("#bookingPetNotes")?.value || "").trim();

    const clientEmail = ($("#bookingClientEmail")?.value || "").trim();

    let startISO = "";
    let endISO = "";
    if (date && start) startISO = new Date(`${date}T${start}`).toISOString();
    if (date && end) endISO = new Date(`${date}T${end}`).toISOString();

    return {
      service_type: serviceVal,
      start_time: startISO || start || "",
      end_time: endISO || end || "",
      location,
      pets,
      breed,
      notes,
      clientEmail
    };
  }

  // ---------------------------
  // Modal open/close
  // ---------------------------
  function openModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "block";
    requestAnimationFrame(() => {
      mountModalPayment();
    });
  }

  function closeModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  function setBtnLoading(btnSel, loading, idleText) {
    const btn = $(btnSel);
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? "Processing..." : idleText;
  }

  // ---------------------------
  // Core pay + create booking
  // ---------------------------
  async function payAndCreateBooking(source) {
    try {
      if (source === "page") setError("#card-errors-page", "");
      if (source === "modal") setError("#bookingModal #card-errors", "");

      const previewExisting = window.PetCareBooking?.preview || {};
      const fromForm = readBookingFormPreview();
      const preview = { ...previewExisting, ...fromForm };

      const normalized = normalizeServiceType(preview.service_type);
      if (!normalized) {
        throw new Error("Invalid service_type. Choose overnight, walk, dropin, or daycare.");
      }
      preview.service_type = normalized;

      // Demo price fallback if not wired yet
      if (!preview.price_total && !preview.total_price) preview.price_total = 20;

      const total = Number(preview.price_total ?? preview.total_price ?? 0);
      if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid price_total.");

      // Make sure Stripe is mounted where we're paying
      if (source === "page") {
        ensureBookingPagePaymentUI();
        mountPagePayment();
      }
      if (source === "modal") {
        mountModalPayment();
      }

      const cardToUse = source === "page" ? cardElPage : cardElModal;
      if (!stripe || !cardToUse) throw new Error("Payment form is not ready. Refresh and try again.");

      // 1) Create payment intent
      const amountCents = Math.round(total * 100);
      const intent = await apiFetch("/stripe/create-payment-intent", {
        method: "POST",
        body: {
          amount: amountCents,
          currency: "usd",
          description: `AnimalSitter booking (${normalized})`
        }
      });

      const clientSecret = intent?.clientSecret;
      if (!clientSecret) throw new Error("Missing Stripe client secret.");

      const billingName =
        window.PetCareState?.user?.full_name ||
        window.PetCareState?.user?.name ||
        "Guest";

      const billingEmail =
        window.PetCareState?.user?.email ||
        preview.clientEmail ||
        "you@example.com";

      // 2) Confirm payment
      const confirmResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardToUse,
          billing_details: { name: billingName, email: billingEmail }
        }
      });

      if (confirmResult.error) throw new Error(confirmResult.error.message || "Payment failed.");
      if (!confirmResult.paymentIntent || confirmResult.paymentIntent.status !== "succeeded") {
        throw new Error("Payment did not complete.");
      }

      // 3) Create booking
      const clientId = window.PetCareState?.user?.id || preview.client_id || preview.clientId;
      const sitterId = preview.sitter_id || preview.sitterId || preview?.sitter?.id;

      if (!clientId || !sitterId) {
        throw new Error("Missing client_id or sitter_id. Log in and select a sitter.");
      }

      const created = await apiFetch("/bookings", {
        method: "POST",
        body: {
          client_id: clientId,
          sitter_id: sitterId,
          pet_id: preview.pet_id || null,
          service_type: normalized,
          start_time: preview.start_time,
          end_time: preview.end_time,
          location: preview.location || null,
          price_total: total,
          notes: preview.notes || null,
          payment_method: "card",
          currency: "USD",
          stripe_payment_intent_id: confirmResult.paymentIntent.id
        }
      });

      window.PetCareBooking.preview = preview;
      window.PetCareBooking.booking = created;

      if (source === "modal") closeModal();

      if (window.PetCareApp?.navigate) window.PetCareApp.navigate("bookingConfirmPage");
      if (window.PetCareBooking?.renderConfirmation) window.PetCareBooking.renderConfirmation(created);

      return created;
    } catch (err) {
      console.error("Booking payment error:", err);

      if (source === "page") setError("#card-errors-page", err.message || "Something went wrong.");
      if (source === "modal") setError("#bookingModal #card-errors", err.message || "Something went wrong.");
      throw err;
    }
  }

  // ---------------------------
  // Bind UI
  // ---------------------------
  function bindEvents() {
    // Always ensure booking page payment UI exists
    ensureBookingPagePaymentUI();

    // Re-check when the booking page becomes visible (your app swaps pages)
    const appSection = $("#appSection");
    if (appSection) {
      const mo = new MutationObserver(() => {
        // When bookingPage gets 'active', re-inject and mount
        const bookingPage = $("#bookingPage");
        if (bookingPage && bookingPage.classList.contains("active")) {
          ensureBookingPagePaymentUI();
        }
      });
      mo.observe(appSection, { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }

    // Modal events
    $("#bookingModalClose")?.addEventListener("click", closeModal);
    $("#bookingModalCancelBtn")?.addEventListener("click", closeModal);
    $("#bookingModalEditBtn")?.addEventListener("click", closeModal);
    $(".booking-modal-backdrop")?.addEventListener("click", closeModal);

    $("#bookingModalConfirmBtn")?.addEventListener("click", async () => {
      setBtnLoading("#bookingModalConfirmBtn", true, "Confirm & Pay");
      try {
        await payAndCreateBooking("modal");
      } finally {
        setBtnLoading("#bookingModalConfirmBtn", false, "Confirm & Pay");
      }
    });

    // Request booking -> opens modal
    $("#bookingPageForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const merged = { ...(window.PetCareBooking.preview || {}), ...readBookingFormPreview() };
      merged.service_type = normalizeServiceType(merged.service_type) || merged.service_type;
      if (!merged.price_total && !merged.total_price) merged.price_total = 20;
      window.PetCareBooking.preview = merged;
      openModal();
    });

    // Booking page "Confirm & Pay"
    document.addEventListener("click", async (e) => {
      const t = e.target;
      if (!t) return;
      if (t.id !== "bookingPayNowBtn") return;

      setBtnLoading("#bookingPayNowBtn", true, "Confirm & Pay");
      try {
        await payAndCreateBooking("page");
      } finally {
        setBtnLoading("#bookingPayNowBtn", false, "Confirm & Pay");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
  });
})();