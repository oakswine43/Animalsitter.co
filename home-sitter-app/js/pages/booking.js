// js/pages/booking.js
// Booking page + confirmation modal + Stripe payment
// FIX: payment input now exists on Book This Sitter page AND the modal.

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
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

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

  function mountCardIfNeeded(mountSelector, errorSelector, which) {
    if (!ensureStripe()) return;

    const mountPoint = $(mountSelector);
    if (!mountPoint) return;

    // Already mounted in this container?
    if (mountPoint.querySelector(".StripeElement")) return;

    // Make sure it has height
    if (!mountPoint.style.minHeight) mountPoint.style.minHeight = "44px";

    // Create and mount
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
    mountCardIfNeeded("#stripe-card-element-page", "#card-errors-page", "page");
  }

  function mountModalPayment() {
    mountCardIfNeeded("#bookingModal #stripe-card-element", "#bookingModal #card-errors", "modal");
  }

  // ---------------------------
  // Booking form preview
  // ---------------------------
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

  function setError(target, msg) {
    const el = $(target);
    if (el) el.textContent = msg || "";
  }

  function setBtnLoading(btnSel, loading, idleText) {
    const btn = $(btnSel);
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? "Processing..." : idleText;
  }

  // ---------------------------
  // Core payment+booking function
  // ---------------------------
  async function payAndCreateBooking(source) {
    // source: "page" | "modal"
    try {
      if (source === "page") setError("#card-errors-page", "");
      if (source === "modal") setError("#bookingModal #card-errors", "");

      const previewExisting = window.PetCareBooking?.preview || {};
      const fromForm = readBookingFormPreview();
      const preview = { ...previewExisting, ...fromForm };

      const normalized = normalizeServiceType(preview.service_type);
      if (!normalized) {
        throw new Error(
          `Invalid service_type. Choose overnight, walk, dropin, or daycare.`
        );
      }
      preview.service_type = normalized;

      // Demo default price if you don't have pricing wired yet
      if (!preview.price_total && !preview.total_price) preview.price_total = 20;

      const total = Number(preview.price_total ?? preview.total_price ?? 0);
      if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid price_total.");

      // Make sure Stripe is mounted where we are paying
      if (source === "page") mountPagePayment();
      if (source === "modal") mountModalPayment();

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

      // 2) Confirm card payment
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

      // 3) Create booking in backend
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

      // Close modal if used
      if (source === "modal") closeModal();

      // Navigate to confirmation page if app nav exists
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
    // Mount booking-page card input whenever page loads
    mountPagePayment();

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

    // Request booking (keeps your old flow -> opens modal)
    $("#bookingPageForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const merged = { ...(window.PetCareBooking.preview || {}), ...readBookingFormPreview() };
      merged.service_type = normalizeServiceType(merged.service_type) || merged.service_type;
      if (!merged.price_total && !merged.total_price) merged.price_total = 20;
      window.PetCareBooking.preview = merged;
      openModal();
    });

    // NEW: Pay directly from booking page
    $("#bookingPayNowBtn")?.addEventListener("click", async () => {
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