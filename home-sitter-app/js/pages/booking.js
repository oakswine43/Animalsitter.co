// js/pages/booking.js
// Booking page + confirmation modal + Stripe payment
// FIX: Stripe Element was being unmounted/replaced in SPA updates, causing:
// "We could not retrieve data from the specified Element... still mounted."
// Solution: create each Stripe Element ONCE, mount/unmount safely, never overwrite mount DOM.

(function () {
  window.PetCareBooking = window.PetCareBooking || { preview: null, booking: null };

  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";
  const STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || "pk_test_REPLACE_ME";

  // -----------------------
  // Small helpers
  // -----------------------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    // offsetParent is null when display:none or not in layout (except fixed)
    if (el.offsetParent === null && style.position !== "fixed") return false;
    return true;
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

    // Friendly labels (UI)
    if (lower.includes("walk")) return "walk";
    if (lower.includes("drop")) return "dropin";
    if (lower.includes("daycare")) return "daycare";
    if (lower.includes("sit")) return "overnight";

    return null;
  }

  // ---------------------------
  // Stripe (safe mount/unmount)
  // ---------------------------
  let stripe = null;
  let elements = null;

  let cardPage = null;
  let cardModal = null;

  let mountedPageSelector = null;
  let mountedModalSelector = null;

  let mountingPage = false;
  let mountingModal = false;

  function stripeReady() {
    return !!window.Stripe && !!STRIPE_PUBLISHABLE_KEY && !String(STRIPE_PUBLISHABLE_KEY).includes("REPLACE_ME");
  }

  function ensureStripe() {
    if (stripe && elements) return true;
    if (!stripeReady()) return false;

    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    elements = stripe.elements();
    return true;
  }

  function applyCardContainerStyles(el) {
    if (!el) return;
    el.style.minHeight = "48px";
    el.style.border = "1px solid rgba(0,0,0,0.15)";
    el.style.borderRadius = "12px";
    el.style.padding = "12px";
    el.style.background = "#fff";
  }

  function setText(sel, txt) {
    const el = $(sel);
    if (!el) return;
    el.textContent = txt || "";
  }

  function hasStripeIframe(mountEl) {
    if (!mountEl) return false;
    return !!mountEl.querySelector("iframe");
  }

  // Create each element ONCE
  function ensureCardInstances() {
    if (!ensureStripe()) return false;

    if (!cardPage) {
      cardPage = elements.create("card", { hidePostalCode: true });
      cardPage.on("change", (e) => {
        const msg = e && e.error ? e.error.message : "";
        setText("#card-errors-page", msg);
      });
    }

    if (!cardModal) {
      cardModal = elements.create("card", { hidePostalCode: true });
      cardModal.on("change", (e) => {
        const msg = e && e.error ? e.error.message : "";
        setText("#bookingModal #card-errors", msg);
      });
    }

    return true;
  }

  // Mount/unmount safely (PAGE)
  function mountPageCard() {
    const bookingPage = $("#bookingPage");
    const mountEl = $("#stripe-card-element-page");

    if (!bookingPage || !mountEl) return false;
    if (!bookingPage.classList.contains("active") || !isVisible(mountEl)) return false;

    applyCardContainerStyles(mountEl);

    if (!ensureCardInstances()) return false;
    if (mountingPage) return false;

    // If already mounted here and iframe exists, done.
    if (mountedPageSelector === "#stripe-card-element-page" && hasStripeIframe(mountEl)) return true;

    mountingPage = true;
    try {
      // If it was mounted elsewhere previously, unmount first
      try {
        if (mountedPageSelector && cardPage) cardPage.unmount();
      } catch (_) {}

      // Clear old iframe remnants (DON'T replace whole container, just empty)
      mountEl.innerHTML = "";
      cardPage.mount(mountEl);

      mountedPageSelector = "#stripe-card-element-page";
      setText("#card-errors-page", "");
      return true;
    } catch (err) {
      console.error("[Booking] Page card mount failed:", err);
      setText(
        "#card-errors-page",
        "Stripe card form didn’t load. If you’re using Brave/Adblock, allow js.stripe.com then refresh."
      );
      return false;
    } finally {
      mountingPage = false;
    }
  }

  // Mount/unmount safely (MODAL)
  function mountModalCard() {
    const modal = $("#bookingModal");
    const mountEl = $("#bookingModal #stripe-card-element");

    if (!modal || !mountEl) return false;
    if (modal.style.display === "none" || !isVisible(mountEl)) return false;

    applyCardContainerStyles(mountEl);

    if (!ensureCardInstances()) return false;
    if (mountingModal) return false;

    if (mountedModalSelector === "#bookingModal #stripe-card-element" && hasStripeIframe(mountEl)) return true;

    mountingModal = true;
    try {
      try {
        if (mountedModalSelector && cardModal) cardModal.unmount();
      } catch (_) {}

      mountEl.innerHTML = "";
      cardModal.mount(mountEl);

      mountedModalSelector = "#bookingModal #stripe-card-element";
      setText("#bookingModal #card-errors", "");
      return true;
    } catch (err) {
      console.error("[Booking] Modal card mount failed:", err);
      setText(
        "#bookingModal #card-errors",
        "Stripe card form didn’t load. If you’re using Brave/Adblock, allow js.stripe.com then refresh."
      );
      return false;
    } finally {
      mountingModal = false;
    }
  }

  // Retry mount (without destroying DOM)
  function retryMount(which) {
    let tries = 0;
    const max = 40; // 10s
    const tick = () => {
      tries++;

      if (!stripeReady()) {
        if (tries < max) return setTimeout(tick, 250);
        // Stripe not present
        if (which === "page") {
          setText(
            "#card-errors-page",
            "Stripe didn’t load. If Brave Shields is on, allow js.stripe.com then refresh."
          );
        } else {
          setText(
            "#bookingModal #card-errors",
            "Stripe didn’t load. If Brave Shields is on, allow js.stripe.com then refresh."
          );
        }
        return;
      }

      const ok = which === "page" ? mountPageCard() : mountModalCard();
      const mountEl = which === "page" ? $("#stripe-card-element-page") : $("#bookingModal #stripe-card-element");

      if (ok && hasStripeIframe(mountEl)) return; // success

      if (tries < max) return setTimeout(tick, 250);

      // final message (no DOM overwrite)
      if (which === "page") {
        setText(
          "#card-errors-page",
          "Stripe card form didn’t mount. Try disabling Brave Shields/Adblock for this site and refresh."
        );
      } else {
        setText(
          "#bookingModal #card-errors",
          "Stripe card form didn’t mount. Try disabling Brave Shields/Adblock for this site and refresh."
        );
      }
    };

    tick();
  }

  // -------------------------------------------------------
  // Ensure booking-page Payment UI exists
  // -------------------------------------------------------
  function ensureBookingPagePaymentUI() {
    const form = $("#bookingPageForm");
    if (!form) return;

    // Payment card missing? add it.
    if (!$("#bookingPagePaymentCard")) {
      const payCard = document.createElement("div");
      payCard.className = "section-card";
      payCard.id = "bookingPagePaymentCard";
      payCard.innerHTML = `
        <h3>Payment</h3>
        <p class="small text-muted">Enter your card details below (Stripe test mode).</p>
        <div id="stripe-card-element-page" class="stripe-card-element"></div>
        <div id="card-errors-page" class="card-errors small text-muted"></div>
        <div class="small text-muted" style="margin-top:8px;">
          Tip: You can also click “Request booking” to review everything in the confirmation modal.
        </div>
      `;

      // Insert before the final actions card (the one containing submit)
      const cards = Array.from(form.querySelectorAll(".section-card"));
      const actionsCard =
        cards.find((c) => c.querySelector("button[type='submit']")) || cards[cards.length - 1];

      if (actionsCard && actionsCard.parentNode) {
        actionsCard.parentNode.insertBefore(payCard, actionsCard);
      } else {
        form.appendChild(payCard);
      }
    }

    // Ensure Confirm & Pay button exists on page
    if (!$("#bookingPayNowBtn")) {
      const cards = Array.from(form.querySelectorAll(".section-card"));
      const actionsCard =
        cards.find((c) => c.querySelector("button[type='submit']")) || cards[cards.length - 1];

      if (actionsCard) {
        const submitBtn = actionsCard.querySelector("button[type='submit']");
        const payBtn = document.createElement("button");
        payBtn.type = "button";
        payBtn.id = "bookingPayNowBtn";
        payBtn.className = "btn-primary";
        payBtn.style.marginLeft = "8px";
        payBtn.textContent = "Confirm & Pay";

        if (submitBtn) submitBtn.insertAdjacentElement("afterend", payBtn);
        else actionsCard.appendChild(payBtn);
      }
    }

    // Style mount box and mount Stripe
    applyCardContainerStyles($("#stripe-card-element-page"));
    retryMount("page");
  }

  // ---------------------------
  // Modal open/close
  // ---------------------------
  function openModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "block";
    applyCardContainerStyles($("#bookingModal #stripe-card-element"));
    retryMount("modal");
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
  // Pay + create booking
  // ---------------------------
  async function payAndCreateBooking(source) {
    try {
      if (source === "page") setText("#card-errors-page", "");
      if (source === "modal") setText("#bookingModal #card-errors", "");

      // Make sure Stripe and elements exist
      if (!ensureCardInstances()) {
        throw new Error("Stripe is not available. Allow js.stripe.com (Brave/Adblock), then refresh.");
      }

      // Ensure the Element is mounted and visible right now
      if (source === "page") {
        mountPageCard();
        const el = $("#stripe-card-element-page");
        if (!hasStripeIframe(el)) throw new Error("Card form isn’t mounted. Refresh and try again.");
      } else {
        mountModalCard();
        const el = $("#bookingModal #stripe-card-element");
        if (!hasStripeIframe(el)) throw new Error("Card form isn’t mounted. Refresh and try again.");
      }

      const previewExisting = window.PetCareBooking?.preview || {};
      const fromForm = readBookingFormPreview();
      const preview = { ...previewExisting, ...fromForm };

      const normalized = normalizeServiceType(preview.service_type);
      if (!normalized) {
        throw new Error("Invalid service_type. Choose overnight, walk, dropin, or daycare.");
      }
      preview.service_type = normalized;

      // default demo price if not set
      if (!preview.price_total && !preview.total_price) preview.price_total = 20;

      const total = Number(preview.price_total ?? preview.total_price ?? 0);
      if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid price_total.");

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
      const cardToUse = source === "page" ? cardPage : cardModal;

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

      if (source === "page") setText("#card-errors-page", err.message || "Something went wrong.");
      if (source === "modal") setText("#bookingModal #card-errors", err.message || "Something went wrong.");

      throw err;
    }
  }

  // ---------------------------
  // Bind UI
  // ---------------------------
  function bindEvents() {
    ensureBookingPagePaymentUI();

    // Watch SPA navigation: when booking page becomes active, remount
    const appSection = $("#appSection");
    if (appSection) {
      const mo = new MutationObserver(() => {
        const bookingPage = $("#bookingPage");
        if (bookingPage && bookingPage.classList.contains("active")) {
          ensureBookingPagePaymentUI();
          mountPageCard();
        }
      });
      mo.observe(appSection, { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }

    // Modal close controls
    $("#bookingModalClose")?.addEventListener("click", closeModal);
    $("#bookingModalCancelBtn")?.addEventListener("click", closeModal);
    $("#bookingModalEditBtn")?.addEventListener("click", closeModal);
    $(".booking-modal-backdrop")?.addEventListener("click", closeModal);

    // Modal pay
    $("#bookingModalConfirmBtn")?.addEventListener("click", async () => {
      setBtnLoading("#bookingModalConfirmBtn", true, "Confirm & Pay");
      try {
        await payAndCreateBooking("modal");
      } finally {
        setBtnLoading("#bookingModalConfirmBtn", false, "Confirm & Pay");
      }
    });

    // Request booking -> open modal
    $("#bookingPageForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const merged = { ...(window.PetCareBooking.preview || {}), ...readBookingFormPreview() };
      merged.service_type = normalizeServiceType(merged.service_type) || merged.service_type;
      if (!merged.price_total && !merged.total_price) merged.price_total = 20;
      window.PetCareBooking.preview = merged;
      openModal();
    });

    // Page Confirm & Pay
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