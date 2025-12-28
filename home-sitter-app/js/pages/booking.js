// js/pages/booking.js
// Booking page + confirmation modal + Stripe payment
// FIX: Booking page payment section existed but Stripe Card input sometimes didn't render.
// Causes: Stripe script blocked/not ready yet, SPA re-render removes iframe, container height = 0.
// Solution: Inject page payment UI, force visible container sizing, and RETRY mounting until Stripe is ready.

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

    // Accept friendly labels too:
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

  function stripeConfigValid() {
    return (
      !!window.Stripe &&
      !!STRIPE_PUBLISHABLE_KEY &&
      !String(STRIPE_PUBLISHABLE_KEY).includes("REPLACE_ME")
    );
  }

  function ensureStripe() {
    if (stripe && elements) return true;

    if (!window.Stripe) return false;
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes("REPLACE_ME")) return false;

    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    elements = stripe.elements();
    return true;
  }

  function setError(sel, msg) {
    const el = $(sel);
    if (el) el.textContent = msg || "";
  }

  function applyCardContainerStyles(el) {
    if (!el) return;
    // Force visible box even before Stripe mounts
    el.style.minHeight = el.style.minHeight || "44px";
    el.style.border = el.style.border || "1px solid rgba(0,0,0,0.15)";
    el.style.borderRadius = el.style.borderRadius || "12px";
    el.style.padding = el.style.padding || "12px";
    el.style.background = el.style.background || "#fff";
  }

  function mountCardIfNeeded(mountSelector, errorSelector, which) {
    const mountPoint = $(mountSelector);
    if (!mountPoint) return false;

    applyCardContainerStyles(mountPoint);

    // Already mounted?
    if (mountPoint.querySelector(".StripeElement")) return true;

    if (!ensureStripe()) return false;

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

    return true;
  }

  // Retry-mount helper (important for SPA + slow/blocked Stripe)
  function retryMount({ mountSelector, errorSelector, which, label }) {
    const mountPoint = $(mountSelector);
    if (mountPoint) applyCardContainerStyles(mountPoint);

    let tries = 0;
    const maxTries = 40; // 40 * 250ms = 10s

    const timer = setInterval(() => {
      tries++;

      const mp = $(mountSelector);
      if (!mp) {
        clearInterval(timer);
        return;
      }

      // If it got mounted, stop retrying
      if (mp.querySelector(".StripeElement")) {
        clearInterval(timer);
        return;
      }

      // If Stripe is ready, try mounting
      if (stripeConfigValid()) {
        try {
          const ok = mountCardIfNeeded(mountSelector, errorSelector, which);
          if (ok && mp.querySelector(".StripeElement")) {
            clearInterval(timer);
            return;
          }
        } catch (e) {
          console.error(`[Booking] ${label} Stripe mount error:`, e);
        }
      }

      // Give up and show a helpful message
      if (tries >= maxTries) {
        clearInterval(timer);

        // If still not mounted, likely blocked by Brave shields/extensions
        if (!mp.querySelector(".StripeElement")) {
          applyCardContainerStyles(mp);
          mp.innerHTML = `
            <div style="font-size:13px; color:#111;">
              <strong>Stripe card form didn’t load.</strong><br/>
              This is usually caused by an ad-blocker / Brave Shields blocking Stripe, or Stripe not loading.
              <div style="margin-top:8px; color:#444;">
                Try: disable Brave Shields for this site (or allow scripts from <em>js.stripe.com</em>), then refresh.
              </div>
            </div>
          `;
        }
      }
    }, 250);
  }

  // -------------------------------------------------------
  // Inject booking-page Payment UI if missing
  // -------------------------------------------------------
  function ensureBookingPagePaymentUI() {
    const form = $("#bookingPageForm");
    if (!form) return;

    // Already exists?
    if ($("#stripe-card-element-page") && $("#bookingPayNowBtn")) {
      retryMount({
        mountSelector: "#stripe-card-element-page",
        errorSelector: "#card-errors-page",
        which: "page",
        label: "Page"
      });
      return;
    }

    const cards = Array.from(form.querySelectorAll(".section-card"));
    const actionsCard =
      cards.find((c) => c.querySelector("button[type='submit']")) || cards[cards.length - 1];

    // Payment card
    if (!$("#stripe-card-element-page")) {
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

      if (actionsCard && actionsCard.parentNode) {
        actionsCard.parentNode.insertBefore(payCard, actionsCard);
      } else {
        form.appendChild(payCard);
      }

      applyCardContainerStyles($("#stripe-card-element-page"));
    }

    // Ensure Confirm & Pay exists
    if (!$("#bookingPayNowBtn")) {
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

    // Try mounting (with retries)
    retryMount({
      mountSelector: "#stripe-card-element-page",
      errorSelector: "#card-errors-page",
      which: "page",
      label: "Page"
    });
  }

  // ---------------------------
  // Modal open/close
  // ---------------------------
  function openModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "block";

    // Retry mount inside modal too
    retryMount({
      mountSelector: "#bookingModal #stripe-card-element",
      errorSelector: "#bookingModal #card-errors",
      which: "modal",
      label: "Modal"
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
      if (source === "page") setError("#card-errors-page", "");
      if (source === "modal") setError("#bookingModal #card-errors", "");

      // Ensure Stripe UI is mounted BEFORE we attempt payment
      if (source === "page") {
        ensureBookingPagePaymentUI();
        retryMount({
          mountSelector: "#stripe-card-element-page",
          errorSelector: "#card-errors-page",
          which: "page",
          label: "Page"
        });
      } else {
        retryMount({
          mountSelector: "#bookingModal #stripe-card-element",
          errorSelector: "#bookingModal #card-errors",
          which: "modal",
          label: "Modal"
        });
      }

      const previewExisting = window.PetCareBooking?.preview || {};
      const fromForm = readBookingFormPreview();
      const preview = { ...previewExisting, ...fromForm };

      const normalized = normalizeServiceType(preview.service_type);
      if (!normalized) {
        throw new Error("Invalid service_type. Choose overnight, walk, dropin, or daycare.");
      }
      preview.service_type = normalized;

      if (!preview.price_total && !preview.total_price) preview.price_total = 20;

      const total = Number(preview.price_total ?? preview.total_price ?? 0);
      if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid price_total.");

      // Make sure Stripe objects exist
      if (!ensureStripe()) {
        throw new Error(
          "Stripe is not available. If you’re using Brave, disable Shields for this site and refresh."
        );
      }

      const cardToUse = source === "page" ? cardElPage : cardElModal;
      if (!cardToUse) {
        throw new Error(
          "Card input didn’t load. Disable ad-block/Brave Shields for this site, then refresh and try again."
        );
      }

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
    ensureBookingPagePaymentUI();

    // Re-check when booking page becomes active (SPA navigation)
    const appSection = $("#appSection");
    if (appSection) {
      const mo = new MutationObserver(() => {
        const bookingPage = $("#bookingPage");
        if (bookingPage && bookingPage.classList.contains("active")) {
          ensureBookingPagePaymentUI();
        }
      });
      mo.observe(appSection, { subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    }

    // Modal buttons
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

    // Request booking -> opens modal (still supported)
    $("#bookingPageForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const merged = { ...(window.PetCareBooking.preview || {}), ...readBookingFormPreview() };
      merged.service_type = normalizeServiceType(merged.service_type) || merged.service_type;
      if (!merged.price_total && !merged.total_price) merged.price_total = 20;
      window.PetCareBooking.preview = merged;
      openModal();
    });

    // Booking page Confirm & Pay
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