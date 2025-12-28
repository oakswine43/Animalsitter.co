// js/pages/booking.js
// Handles the booking modal + booking confirmation flow
// FIX: robust service_type normalization so it always becomes:
// overnight | walk | dropin | daycare
// Also: scopes DOM queries to the modal to avoid duplicate-id problems.

(function () {
  window.PetCareBooking = window.PetCareBooking || { preview: null, booking: null };

  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";
  const STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || "pk_test_REPLACE_ME";

  // ---------------------------
  // Helpers
  // ---------------------------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function getAuthToken() {
    // Support multiple token keys since your project evolved
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
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );
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

  function money(n) {
    const num = Number(n || 0);
    return `$${num.toFixed(2)}`;
  }

  // ---------------------------
  // service_type normalization (THE FIX)
  // ---------------------------
  function normalizeServiceType(input) {
    const raw = (input ?? "").toString().trim();
    if (!raw) return null;

    const lower = raw.toLowerCase().trim();

    // Already-correct enum values
    if (["overnight", "walk", "dropin", "daycare"].includes(lower)) return lower;

    // Common UI labels
    // IMPORTANT: accept lots of variants so the UI can say whatever
    const map = [
      { keys: ["overnight sitting", "overnight", "in-home sitting", "in home sitting", "sitting", "pet sitting"], value: "overnight" },
      { keys: ["walk", "walking", "dog walk", "dog walking", "neighborhood walks"], value: "walk" },
      { keys: ["dropin", "drop-in", "drop in", "drop-in visit", "drop in visit", "visit"], value: "dropin" },
      { keys: ["daycare", "doggy daycare", "dog daycare"], value: "daycare" }
    ];

    for (const row of map) {
      if (row.keys.some((k) => lower === k)) return row.value;
    }

    // Keyword fallback (covers “Walking”, “Boarding”, etc.)
    if (lower.includes("walk")) return "walk";
    if (lower.includes("drop")) return "dropin";
    if (lower.includes("daycare")) return "daycare";
    if (lower.includes("sit")) return "overnight";

    return null;
  }

  function serviceLabelFromEnum(enumVal) {
    switch (enumVal) {
      case "overnight":
        return "Overnight sitting";
      case "walk":
        return "Dog walking";
      case "dropin":
        return "Drop-in visit";
      case "daycare":
        return "Doggy daycare";
      default:
        return "Pet care";
    }
  }

  // ---------------------------
  // Stripe (card element in modal)
  // ---------------------------
  let stripe = null;
  let elements = null;
  let cardEl = null;

  function ensureStripe() {
    if (stripe && elements) return;

    if (!window.Stripe) {
      console.warn("[Booking] Stripe.js not loaded.");
      return;
    }
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes("REPLACE_ME")) {
      console.warn("[Booking] STRIPE_PUBLISHABLE_KEY missing/placeholder.");
      return;
    }

    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    elements = stripe.elements();
  }

  function mountCard() {
    ensureStripe();
    if (!stripe || !elements) return;

    const modal = $("#bookingModal");
    if (!modal) return;

    const mountPoint = $("#stripe-card-element", modal);
    if (!mountPoint) return;

    if (cardEl) return; // already mounted

    cardEl = elements.create("card", {
      hidePostalCode: true
    });
    cardEl.mount(mountPoint);

    const errBox = $("#card-errors", modal);
    if (errBox) errBox.textContent = "";

    cardEl.on("change", (event) => {
      if (!errBox) return;
      errBox.textContent = event.error ? event.error.message : "";
    });
  }

  // ---------------------------
  // Modal UI
  // ---------------------------
  function openModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "block";
    mountCard();
  }

  function closeModal() {
    const modal = $("#bookingModal");
    if (!modal) return;
    modal.style.display = "none";
  }

  function setModalError(msg) {
    const modal = $("#bookingModal");
    if (!modal) return;
    const errBox = $("#card-errors", modal);
    if (errBox) errBox.textContent = msg || "";
  }

  function setConfirmButtonLoading(isLoading) {
    const modal = $("#bookingModal");
    if (!modal) return;

    const btn = $("#bookingModalConfirmBtn", modal);
    if (!btn) return;

    btn.disabled = !!isLoading;
    btn.textContent = isLoading ? "Processing..." : "Confirm & Pay";
  }

  // ---------------------------
  // Build preview from booking page form
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

    const clientPhone = ($("#bookingClientPhone")?.value || "").trim();
    const clientEmail = ($("#bookingClientEmail")?.value || "").trim();
    const clientAddress = ($("#bookingClientAddress")?.value || "").trim();

    // Create ISO datetimes if date + time exist
    let startISO = "";
    let endISO = "";
    if (date && start) startISO = new Date(`${date}T${start}`).toISOString();
    if (date && end) endISO = new Date(`${date}T${end}`).toISOString();

    return {
      service_type: serviceVal, // we normalize later
      date,
      start_time: startISO || start || "",
      end_time: endISO || end || "",
      location,
      pets,
      breed,
      notes,
      clientPhone,
      clientEmail,
      clientAddress
    };
  }

  // ---------------------------
  // Populate modal UI from preview
  // ---------------------------
  function renderModalFromPreview(preview) {
    const modal = $("#bookingModal");
    if (!modal) return;

    // Sitter fields (scope to modal to avoid duplicate IDs)
    const sitterNameEl = $("#bookingSitterName", modal);
    const sitterSubtitleEl = $("#bookingSitterSubtitle", modal);
    const sitterBadgesEl = $("#bookingSitterBadges", modal);

    const serviceNameEl = $("#bookingServiceName", modal);

    const totalEl = $("#bookingTotalPrice", modal);
    const line1Label = $("#bookingLine1Label", modal);
    const line1Price = $("#bookingLine1Price", modal);
    const line2Label = $("#bookingLine2Label", modal);
    const line2Price = $("#bookingLine2Price", modal);
    const line3Price = $("#bookingLine3Price", modal);

    const clientNameEl = $("#bookingClientName", modal);
    const clientEmailEl = $("#bookingClientEmail", modal);

    // Pet summary
    const petNamesEl = $("#bookingPetNames", modal);
    const petBreedEl = $("#bookingPetBreed", modal);

    // Policies
    const policiesEl = $("#bookingPolicies", modal);

    // Sitter rendering (best-effort)
    const sitter = preview?.sitter || {};
    const sitterName = sitter.full_name || [sitter.first_name, sitter.last_name].filter(Boolean).join(" ").trim() || "Sitter";
    if (sitterNameEl) sitterNameEl.textContent = sitterName;

    const rating = sitter.rating ? `★ ${sitter.rating}` : "★ New";
    const distance = sitter.distance ? `${sitter.distance}` : "Nearby";
    if (sitterSubtitleEl) sitterSubtitleEl.textContent = `${rating} · ${distance}`;

    if (sitterBadgesEl) {
      sitterBadgesEl.innerHTML = "";
      (sitter.badges || ["Background checked", "Fast replies"]).forEach((b) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = b;
        sitterBadgesEl.appendChild(chip);
      });
    }

    // Service normalization
    const normalized = normalizeServiceType(preview?.service_type);
    const finalServiceEnum = normalized || "overnight"; // safe fallback
    if (serviceNameEl) serviceNameEl.textContent = serviceLabelFromEnum(finalServiceEnum);

    // Pricing (use preview total if provided, else default)
    const total = Number(preview?.price_total ?? preview?.total_price ?? 0) || 0;
    const serviceFee = Number((total * 0.1).toFixed(2)); // simple display fee (frontend only)
    const base = Number((total - serviceFee).toFixed(2));

    if (totalEl) totalEl.textContent = money(total);
    if (line1Label) line1Label.textContent = "Base service";
    if (line1Price) line1Price.textContent = money(base);
    if (line2Label) line2Label.textContent = "Extras";
    if (line2Price) line2Price.textContent = money(0);
    if (line3Price) line3Price.textContent = money(serviceFee);

    // Client info
    const user = window.PetCareState?.user || null;
    const fullName = user?.full_name || user?.name || "Guest";
    const email = user?.email || preview?.clientEmail || "you@example.com";

    if (clientNameEl) clientNameEl.textContent = fullName;
    if (clientEmailEl) clientEmailEl.textContent = email;

    // Pet info
    if (petNamesEl) petNamesEl.textContent = preview?.pets || "Your dog(s) – demo";
    if (petBreedEl) petBreedEl.textContent = preview?.breed || "Breed / size – demo";

    // Policies
    if (policiesEl) {
      const items = preview?.policies || [
        "Cancellation: Free cancellation up to 24 hours before start. 50% after that.",
        "Meet & greet: Meet & greet required for all new dogs.",
        "Aggressive dog policy: Not able to accept dogs with a history of biting people.",
        "Extra fees: Holiday bookings +$10/night. Last-minute bookings (<24h) +$5."
      ];
      policiesEl.innerHTML = items
        .map((t) => `<div style="margin-bottom:6px;">• ${t}</div>`)
        .join("");
    }
  }

  // ---------------------------
  // Confirm + Pay flow
  // ---------------------------
  async function confirmBookingFromModal() {
    try {
      setModalError("");
      setConfirmButtonLoading(true);

      const preview = window.PetCareBooking?.preview || {};
      if (!preview) throw new Error("No booking preview found.");

      // Normalize service_type reliably
      const normalizedService = normalizeServiceType(preview.service_type);
      if (!normalizedService) {
        // Don’t hard-fail like before — just give a useful error
        throw new Error(
          `Invalid service_type: "${preview.service_type}". Please choose: overnight, walk, dropin, or daycare.`
        );
      }

      const total = Number(preview.price_total ?? preview.total_price ?? preview.price ?? 0);
      if (!Number.isFinite(total) || total <= 0) {
        throw new Error("Invalid total price. Please try again.");
      }

      // Stripe must be configured
      ensureStripe();
      if (!stripe || !cardEl) {
        throw new Error("Stripe card form is not ready. Refresh and try again.");
      }

      // 1) Create payment intent on backend
      const amountCents = Math.round(total * 100);
      const intent = await apiFetch("/stripe/create-payment-intent", {
        method: "POST",
        body: {
          amount: amountCents,
          currency: "usd",
          description: `AnimalSitter booking (${normalizedService})`
        }
      });

      const clientSecret = intent?.clientSecret;
      if (!clientSecret) throw new Error("Missing Stripe client secret.");

      // 2) Confirm card payment in Stripe
      const billingName =
        window.PetCareState?.user?.full_name ||
        window.PetCareState?.user?.name ||
        "Guest";

      const billingEmail =
        window.PetCareState?.user?.email ||
        preview.clientEmail ||
        "you@example.com";

      const confirmResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardEl,
          billing_details: {
            name: billingName,
            email: billingEmail
          }
        }
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || "Payment failed. Please try again.");
      }

      if (!confirmResult.paymentIntent || confirmResult.paymentIntent.status !== "succeeded") {
        throw new Error("Payment did not complete. Please try again.");
      }

      // 3) Create booking in DB
      // NOTE: your backend currently requires client_id and sitter_id
      // We support either the logged-in user ID or preview fields.
      const clientId =
        window.PetCareState?.user?.id ||
        preview.client_id ||
        preview.clientId;

      const sitterId =
        preview.sitter_id ||
        preview.sitterId ||
        preview?.sitter?.id;

      if (!clientId || !sitterId) {
        throw new Error("Missing client_id or sitter_id. Make sure you are logged in and selected a sitter.");
      }

      const bookingPayload = {
        client_id: clientId,
        sitter_id: sitterId,
        pet_id: preview.pet_id || null,
        service_type: normalizedService,
        start_time: preview.start_time,
        end_time: preview.end_time,
        location: preview.location || null,
        price_total: total,
        notes: preview.notes || null,
        payment_method: "card",
        currency: "USD",
        stripe_payment_intent_id: confirmResult.paymentIntent.id
      };

      const created = await apiFetch("/bookings", { method: "POST", body: bookingPayload });

      window.PetCareBooking.booking = created;
      closeModal();

      // Optionally jump to confirmation page if your app.js supports it
      if (window.PetCareApp?.navigate) {
        window.PetCareApp.navigate("bookingConfirmPage");
      }

      // If you have a confirmation renderer, let it run
      if (window.PetCareBooking?.renderConfirmation) {
        window.PetCareBooking.renderConfirmation(created);
      }
    } catch (err) {
      console.error("Booking payment error:", err);
      setModalError(err.message || "Something went wrong.");
    } finally {
      setConfirmButtonLoading(false);
    }
  }

  // ---------------------------
  // Wire up events
  // ---------------------------
  function bindEvents() {
    const modal = $("#bookingModal");
    if (modal) {
      // close
      $("#bookingModalClose", modal)?.addEventListener("click", closeModal);
      $("#bookingModalCancelBtn", modal)?.addEventListener("click", closeModal);

      // edit
      $("#bookingModalEditBtn", modal)?.addEventListener("click", () => {
        // Just close modal so user can edit the booking page form
        closeModal();
      });

      // confirm
      $("#bookingModalConfirmBtn", modal)?.addEventListener("click", confirmBookingFromModal);

      // backdrop click closes
      $(".booking-modal-backdrop", modal)?.addEventListener("click", closeModal);
    }

    // Booking page form -> open modal
    const bookingForm = $("#bookingPageForm");
    if (bookingForm) {
      bookingForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // Build preview from the form + whatever sitterProfile.js put in PetCareBooking.preview
        const existing = window.PetCareBooking?.preview || {};
        const fromForm = readBookingFormPreview();

        // IMPORTANT: always store normalized enum or original (we normalize later too)
        const merged = {
          ...existing,
          ...fromForm
        };

        // Normalize right now so the modal shows the correct service
        const normalized = normalizeServiceType(merged.service_type);
        merged.service_type = normalized || merged.service_type;

        // If you calculate price elsewhere, keep it.
        // If not present, add a small demo price so Stripe can run.
        if (!merged.price_total && !merged.total_price) merged.price_total = 20;

        window.PetCareBooking.preview = merged;

        renderModalFromPreview(merged);
        openModal();
      });
    }
  }

  // Public helpers in case other pages call them
  window.PetCareBooking.open = function (preview) {
    if (preview) window.PetCareBooking.preview = preview;
    renderModalFromPreview(window.PetCareBooking.preview || {});
    openModal();
  };

  window.PetCareBooking.close = closeModal;

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
  });
})();