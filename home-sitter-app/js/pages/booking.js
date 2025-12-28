// js/pages/booking.js
// Handles the booking modal + booking confirmation flow
// Fix: ALWAYS send service_type as one of: overnight | walk | dropin | daycare
// Also handles duplicate IDs (bookingSitterName/Avatar exist in page + modal) by updating ALL matches.

(function () {
  window.PetCareBooking = window.PetCareBooking || {
    preview: null,
    booking: null
  };

  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  // ----------------------------
  // Small helpers
  // ----------------------------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  // Update all elements that share the same id (your HTML has duplicates)
  function setTextByIdAll(id, text) {
    const safe = String(text ?? "");
    $all(`#${CSS.escape(id)}`).forEach((el) => (el.textContent = safe));
  }
  function setHTMLByIdAll(id, html) {
    $all(`#${CSS.escape(id)}`).forEach((el) => (el.innerHTML = html));
  }

  function money(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "$0.00";
    return `$${num.toFixed(2)}`;
  }

  async function apiJson(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // ignore
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ----------------------------
  // SERVICE TYPE NORMALIZATION (THIS FIXES YOUR ERROR)
  // ----------------------------
  function normalizeServiceType(input) {
    const raw = String(input || "").trim();
    const s = raw.toLowerCase();

    // direct codes
    if (["overnight", "walk", "dropin", "daycare"].includes(s)) return s;

    // label variants that your UI uses
    // (add more here anytime you introduce new wording)
    const map = new Map([
      ["overnight sitting", "overnight"],
      ["overnight", "overnight"],
      ["in-home sitting", "overnight"], // common modal label
      ["sitting", "overnight"],
      ["pet sitting", "overnight"],

      ["dog walking", "walk"],
      ["walking", "walk"],
      ["walk", "walk"],

      ["drop-in visit", "dropin"],
      ["drop in visit", "dropin"],
      ["drop-in", "dropin"],
      ["drop in", "dropin"],
      ["dropin", "dropin"],

      ["doggy daycare", "daycare"],
      ["day care", "daycare"],
      ["daycare", "daycare"]
    ]);

    if (map.has(s)) return map.get(s);

    // Sometimes text includes extra words like "Service: Dog walking"
    for (const [k, v] of map.entries()) {
      if (s.includes(k)) return v;
    }

    return ""; // invalid
  }

  function serviceLabelFromCode(code) {
    switch (code) {
      case "overnight":
        return "Overnight sitting";
      case "walk":
        return "Dog walking";
      case "dropin":
        return "Drop-in visit";
      case "daycare":
        return "Doggy daycare";
      default:
        return String(code || "Service");
    }
  }

  // ----------------------------
  // State lookups (robust)
  // ----------------------------
  function getCurrentUser() {
    // Try common shapes from state.js
    const s = window.AppState || window.PetCareState || {};
    return s.currentUser || s.user || s.me || null;
  }

  function getSelectedSitter() {
    // Try preview first
    const p = window.PetCareBooking?.preview || {};
    if (p.sitter && typeof p.sitter === "object") return p.sitter;

    // Try storage
    try {
      const stored = JSON.parse(localStorage.getItem("selectedSitter") || "null");
      if (stored && typeof stored === "object") return stored;
    } catch (e) {
      // ignore
    }

    // Try id-only storage
    const id = Number(localStorage.getItem("selectedSitterId"));
    if (Number.isFinite(id) && id > 0) return { id };

    return null;
  }

  // ----------------------------
  // Stripe (Elements) — minimal + compatible
  // ----------------------------
  let stripe = null;
  let elements = null;
  let card = null;

  function ensureStripeMounted() {
    if (!window.Stripe) {
      console.warn("[Booking] Stripe.js not loaded.");
      return;
    }

    const key = window.STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn("[Booking] STRIPE_PUBLISHABLE_KEY missing.");
      return;
    }

    if (!stripe) stripe = window.Stripe(key);
    if (!elements) elements = stripe.elements();

    if (!card) {
      card = elements.create("card", { hidePostalCode: true });
      const mountEl = $("#stripe-card-element");
      if (mountEl) card.mount(mountEl);

      card.on("change", function (event) {
        const displayError = $("#card-errors");
        if (!displayError) return;
        displayError.textContent = event.error ? event.error.message : "";
      });
    }
  }

  // ----------------------------
  // UI: open/close modal
  // ----------------------------
  function showModal() {
    const modal = $("#bookingModal");
    if (modal) modal.style.display = "block";
  }

  function hideModal() {
    const modal = $("#bookingModal");
    if (modal) modal.style.display = "none";
  }

  function setModalError(msg) {
    const el = $("#card-errors");
    if (el) el.textContent = msg ? String(msg) : "";
  }

  // ----------------------------
  // Build preview from booking page form
  // ----------------------------
  function readBookingPageForm() {
    const form = $("#bookingPageForm");
    if (!form) return null;

    const serviceSelect = $("#bookingService");
    const date = ($("#bookingDate")?.value || "").trim();
    const start = ($("#bookingStart")?.value || "").trim();
    const end = ($("#bookingEnd")?.value || "").trim();

    // IMPORTANT: use .value not label text
    const serviceValue = serviceSelect ? serviceSelect.value : "";
    const service_type = normalizeServiceType(serviceValue);

    const location = ($("#bookingLocation")?.value || "").trim();
    const pets = ($("#bookingPets")?.value || "").trim();
    const breed = ($("#bookingBreed")?.value || "").trim();
    const notes = ($("#bookingPetNotes")?.value || "").trim();

    const phone = ($("#bookingClientPhone")?.value || "").trim();
    const email = ($("#bookingClientEmail")?.value || "").trim();
    const address = ($("#bookingClientAddress")?.value || "").trim();

    // convert date + time into a datetime string the backend can store
    // Format: YYYY-MM-DDTHH:MM:00 (works well in MySQL datetime if parsed)
    const start_time = date && start ? `${date}T${start}:00` : "";
    const end_time = date && end ? `${date}T${end}:00` : "";

    return {
      service_type,
      service_label: serviceLabelFromCode(service_type),
      date,
      start,
      end,
      start_time,
      end_time,
      location,
      pets,
      breed,
      notes,
      client: { phone, email, address }
    };
  }

  // ----------------------------
  // Pricing (keep simple + consistent)
  // If your sitterprofile.js already sets price_total in preview, we use it.
  // ----------------------------
  function computeTotalPrice(preview) {
    // If something already set a price, keep it
    const existing =
      Number(preview?.price_total ?? preview?.total_price ?? NaN);
    if (Number.isFinite(existing) && existing > 0) return existing;

    // fallback demo pricing (so Stripe amount isn't 0)
    // You can replace this with your real sitter pricing later.
    const base = 25;
    const feeRate = 0.2;
    const fee = base * feeRate;
    return Number((base + fee).toFixed(2));
  }

  // ----------------------------
  // Fill modal from preview + open it
  // ----------------------------
  function openBookingModal(preview) {
    const sitter = getSelectedSitter() || {};
    const sitterName =
      preview?.sitter_name ||
      sitter.full_name ||
      `${sitter.first_name || ""} ${sitter.last_name || ""}`.trim() ||
      "Sitter";

    // show sitter info in BOTH page + modal duplicates
    setTextByIdAll("bookingSitterName", sitterName);

    // subtitle / badges
    const subtitle =
      preview?.sitter_subtitle || "Rating · distance";
    setTextByIdAll("bookingSitterSubtitle", subtitle);

    // service name
    setTextByIdAll("bookingServiceName", preview?.service_label || "Service");

    // client info
    const user = getCurrentUser();
    const clientName =
      (user && (user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim())) ||
      "Guest";
    setTextByIdAll("bookingClientName", clientName);

    const clientEmail =
      preview?.client?.email ||
      (user && user.email) ||
      "you@example.com";
    setTextByIdAll("bookingClientEmail", clientEmail);

    // pet info (modal)
    setTextByIdAll("bookingPetNames", preview?.pets || "Your dog(s) – demo");
    setTextByIdAll("bookingPetBreed", preview?.breed || "Breed / size – demo");

    // policies
    const policiesHtml = `
      <ul style="margin:0; padding-left:18px;">
        <li><strong>Cancellation:</strong> Free cancellation up to 24 hours before start. 50% after that.</li>
        <li><strong>Meet & greet:</strong> Meet & greet required for all new dogs.</li>
        <li><strong>Aggressive dog policy:</strong> Not able to accept dogs with a history of biting people.</li>
        <li><strong>Extra fees:</strong> Holiday bookings +$10/night. Last-minute bookings (&lt;24h) +$5.</li>
      </ul>
    `;
    setHTMLByIdAll("bookingPolicies", policiesHtml);

    // price breakdown
    const total = computeTotalPrice(preview);
    setTextByIdAll("bookingTotalPrice", money(total));

    // simple breakdown numbers (optional)
    const base = Number((total / 1.2).toFixed(2));
    const fee = Number((total - base).toFixed(2));
    setTextByIdAll("bookingLine1Label", "Base service");
    setTextByIdAll("bookingLine1Price", money(base));
    setTextByIdAll("bookingLine2Label", "Extra pet");
    setTextByIdAll("bookingLine2Price", money(0));
    setTextByIdAll("bookingLine3Price", money(fee));

    setModalError("");
    ensureStripeMounted();
    showModal();
  }

  // ----------------------------
  // Confirm & Pay flow
  // ----------------------------
  async function confirmBookingFromModal() {
    try {
      setModalError("");

      const preview = window.PetCareBooking?.preview;
      if (!preview) throw new Error("Booking preview missing. Please try again.");

      // ✅ FINAL service_type enforcement
      const normalized = normalizeServiceType(preview.service_type);
      if (!normalized) {
        throw new Error(
          "Invalid service_type. Use overnight / walk / dropin / daycare (or the normal labels like 'Dog walking')."
        );
      }
      preview.service_type = normalized;
      preview.service_label = serviceLabelFromCode(normalized);

      const user = getCurrentUser();
      const sitter = getSelectedSitter();

      const client_id = Number(preview.client_id || user?.id);
      const sitter_id = Number(preview.sitter_id || sitter?.id);

      if (!client_id || !sitter_id) {
        throw new Error("Missing client_id or sitter_id. Please log in and select a sitter again.");
      }

      if (!preview.start_time || !preview.end_time) {
        throw new Error("Start/end time missing. Please fill in date + times.");
      }

      const total = computeTotalPrice(preview);

      // Stripe payment (PaymentIntent)
      if (!stripe || !card) ensureStripeMounted();
      if (!stripe || !card) {
        throw new Error("Stripe is not ready. Please refresh the page.");
      }

      // Create payment intent on backend (amount in cents)
      const amountCents = Math.round(total * 100);

      const pi = await apiJson("/stripe/create-payment-intent", {
        method: "POST",
        body: JSON.stringify({
          amount: amountCents,
          currency: "usd",
          description: `AnimalSitter booking (${preview.service_label})`
        })
      });

      const clientSecret = pi?.clientSecret;
      if (!clientSecret) throw new Error("Payment intent missing client secret.");

      const billingName =
        $("#bookingClientName")?.textContent?.trim() ||
        user?.full_name ||
        "Guest";
      const billingEmail =
        $("#bookingClientEmail")?.textContent?.trim() ||
        user?.email ||
        "";

      const confirmResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: billingName,
            email: billingEmail
          }
        }
      });

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || "Payment failed.");
      }

      // Create booking in DB
      const bookingRes = await apiJson("/bookings", {
        method: "POST",
        body: JSON.stringify({
          client_id,
          sitter_id,
          pet_id: preview.pet_id || null,
          service_type: preview.service_type, // ✅ code, not label
          start_time: preview.start_time,
          end_time: preview.end_time,
          location: preview.location || null,
          price_total: total,
          notes: preview.notes || null,
          payment_method: "card",
          currency: "USD"
        })
      });

      window.PetCareBooking.booking = bookingRes;
      hideModal();

      // If your app.js has page navigation helpers, try to go to confirm page
      if (typeof window.showPage === "function") {
        window.showPage("bookingConfirmPage");
      } else {
        // fallback: simple alert
        alert("Booking created!");
      }

      // If you have a confirm page renderer, call it
      if (typeof window.renderBookingConfirm === "function") {
        window.renderBookingConfirm(bookingRes);
      } else {
        // fallback: write basic confirm
        const root = $("#bookingConfirmRoot");
        if (root) {
          root.innerHTML = `
            <h2>Booking confirmed ✅</h2>
            <p><strong>Service:</strong> ${serviceLabelFromCode(preview.service_type)}</p>
            <p><strong>Total:</strong> ${money(total)}</p>
            <p><strong>Booking ID:</strong> ${bookingRes.booking_id || bookingRes.id || ""}</p>
          `;
        }
      }
    } catch (err) {
      console.error("Booking payment error:", err);
      setModalError(err.message || "Booking failed.");
    }
  }

  // ----------------------------
  // Wire up events
  // ----------------------------
  function wireBookingEvents() {
    // Booking page submit -> create preview -> open modal
    const form = $("#bookingPageForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        const sitter = getSelectedSitter();
        const user = getCurrentUser();

        const data = readBookingPageForm();

        if (!data) {
          alert("Booking form not found.");
          return;
        }

        if (!data.service_type) {
          alert(
            "Service type is invalid. Please choose: Overnight / Walk / Drop-in / Daycare."
          );
          return;
        }
        if (!data.start_time || !data.end_time) {
          alert("Please select a date and start/end time.");
          return;
        }

        // Build preview (store ids so POST /bookings has what it needs)
        window.PetCareBooking.preview = {
          ...data,
          client_id: user?.id || null,
          sitter_id: sitter?.id || null,
          sitter_name:
            sitter?.full_name ||
            `${sitter?.first_name || ""} ${sitter?.last_name || ""}`.trim() ||
            "Sitter",
          price_total: window.PetCareBooking?.preview?.price_total || null
        };

        openBookingModal(window.PetCareBooking.preview);
      });
    }

    // Modal close buttons
    const closeBtn = $("#bookingModalClose");
    const cancelBtn = $("#bookingModalCancelBtn");
    if (closeBtn) closeBtn.addEventListener("click", hideModal);
    if (cancelBtn) cancelBtn.addEventListener("click", hideModal);

    // Edit details -> just close modal so user can edit form
    const editBtn = $("#bookingModalEditBtn");
    if (editBtn) editBtn.addEventListener("click", hideModal);

    // Confirm & Pay
    const confirmBtn = $("#bookingModalConfirmBtn");
    if (confirmBtn) confirmBtn.addEventListener("click", confirmBookingFromModal);
  }

  // Init on DOM ready
  document.addEventListener("DOMContentLoaded", function () {
    wireBookingEvents();

    // If modal is opened by another script, still ensure Stripe is ready
    ensureStripeMounted();
  });
})();