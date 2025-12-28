// js/pages/booking.js
// Handles booking modal + confirmation flow
// FIX: service_type is ALWAYS forced to one of: overnight | walk | dropin | daycare
// Robust: detects service_type from preview OR booking form select OR modal text on confirm click
// Also robust to duplicate IDs in your HTML.

(function () {
  window.PetCareBooking = window.PetCareBooking || {
    preview: null,
    booking: null
  };

  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  // ----------------------------
  // DOM helpers
  // ----------------------------
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  // Your HTML has duplicate IDs in multiple sections (page + modal),
  // so we always update ALL matches.
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
    } catch (e) {}

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
  // SERVICE TYPE NORMALIZATION (core fix)
  // ----------------------------
  function normalizeServiceType(input) {
    const raw = String(input || "").trim();
    const s = raw.toLowerCase();

    // direct codes
    if (["overnight", "walk", "dropin", "daycare"].includes(s)) return s;

    // common labels / UI variants
    const map = new Map([
      // overnight
      ["overnight sitting", "overnight"],
      ["overnight", "overnight"],
      ["in-home sitting", "overnight"],
      ["in home sitting", "overnight"],
      ["pet sitting", "overnight"],
      ["sitting", "overnight"],
      ["overnight stay", "overnight"],
      ["overnight stays", "overnight"],

      // walk
      ["dog walking", "walk"],
      ["walking", "walk"],
      ["walk", "walk"],
      ["neighborhood walks", "walk"],
      ["walks", "walk"],

      // dropin
      ["drop-in visit", "dropin"],
      ["drop in visit", "dropin"],
      ["drop-in", "dropin"],
      ["drop in", "dropin"],
      ["dropin", "dropin"],
      ["drop-ins", "dropin"],
      ["drop ins", "dropin"],

      // daycare
      ["doggy daycare", "daycare"],
      ["dog daycare", "daycare"],
      ["day care", "daycare"],
      ["daycare", "daycare"],
      ["daycare service", "daycare"]
    ]);

    if (map.has(s)) return map.get(s);

    // If UI includes extra words, match by contains
    for (const [k, v] of map.entries()) {
      if (s.includes(k)) return v;
    }

    return "";
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

  // Detect service type at confirm-time (DOES NOT TRUST preview)
  function detectServiceTypeNow() {
    const preview = window.PetCareBooking?.preview || {};

    const candidates = [];

    // from preview (whatever it currently is)
    candidates.push(preview.service_type);
    candidates.push(preview.service_label);
    candidates.push(preview.service);

    // from booking page dropdown value (best source)
    const sel = $("#bookingService");
    if (sel) {
      candidates.push(sel.value);
      // also include selected option label text
      const opt = sel.options?.[sel.selectedIndex];
      if (opt) candidates.push(opt.textContent);
    }

    // from modal text
    const modalServiceText = $("#bookingServiceName")?.textContent;
    candidates.push(modalServiceText);

    // try normalize each candidate
    for (const c of candidates) {
      const code = normalizeServiceType(c);
      if (code) return { code, source: c };
    }

    return { code: "", source: candidates.filter(Boolean) };
  }

  // ----------------------------
  // State lookups
  // ----------------------------
  function getCurrentUser() {
    const s = window.AppState || window.PetCareState || {};
    return s.currentUser || s.user || s.me || null;
  }

  function getSelectedSitter() {
    const p = window.PetCareBooking?.preview || {};
    if (p.sitter && typeof p.sitter === "object") return p.sitter;

    try {
      const stored = JSON.parse(localStorage.getItem("selectedSitter") || "null");
      if (stored && typeof stored === "object") return stored;
    } catch (e) {}

    const id = Number(localStorage.getItem("selectedSitterId"));
    if (Number.isFinite(id) && id > 0) return { id };

    return null;
  }

  // ----------------------------
  // Stripe Elements
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
  // Modal show/hide
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
  // Read booking page form
  // ----------------------------
  function readBookingPageForm() {
    const form = $("#bookingPageForm");
    if (!form) return null;

    const serviceSelect = $("#bookingService");
    const date = ($("#bookingDate")?.value || "").trim();
    const start = ($("#bookingStart")?.value || "").trim();
    const end = ($("#bookingEnd")?.value || "").trim();

    const serviceValue = serviceSelect ? serviceSelect.value : "";
    const service_type = normalizeServiceType(serviceValue);

    const location = ($("#bookingLocation")?.value || "").trim();
    const pets = ($("#bookingPets")?.value || "").trim();
    const breed = ($("#bookingBreed")?.value || "").trim();
    const notes = ($("#bookingPetNotes")?.value || "").trim();

    const phone = ($("#bookingClientPhone")?.value || "").trim();
    const email = ($("#bookingClientEmail")?.value || "").trim();
    const address = ($("#bookingClientAddress")?.value || "").trim();

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
  // Pricing (basic fallback)
  // ----------------------------
  function computeTotalPrice(preview) {
    const existing = Number(preview?.price_total ?? preview?.total_price ?? NaN);
    if (Number.isFinite(existing) && existing > 0) return existing;

    const base = 25;
    const feeRate = 0.2;
    const fee = base * feeRate;
    return Number((base + fee).toFixed(2));
  }

  // ----------------------------
  // Fill modal and open
  // ----------------------------
  function openBookingModal(preview) {
    const sitter = getSelectedSitter() || {};
    const sitterName =
      preview?.sitter_name ||
      sitter.full_name ||
      `${sitter.first_name || ""} ${sitter.last_name || ""}`.trim() ||
      "Sitter";

    setTextByIdAll("bookingSitterName", sitterName);
    setTextByIdAll("bookingSitterSubtitle", preview?.sitter_subtitle || "Rating · distance");

    // Force service label for display
    const detected = detectServiceTypeNow();
    const code = detected.code || preview.service_type || "";
    const normalized = normalizeServiceType(code) || "";
    preview.service_type = normalized;
    preview.service_label = serviceLabelFromCode(normalized);

    setTextByIdAll("bookingServiceName", preview?.service_label || "Service");

    const user = getCurrentUser();
    const clientName =
      (user && (user.full_name || `${user.first_name || ""} ${user.last_name || ""}`.trim())) ||
      "Guest";
    setTextByIdAll("bookingClientName", clientName);

    const clientEmail = preview?.client?.email || user?.email || "you@example.com";
    setTextByIdAll("bookingClientEmail", clientEmail);

    setTextByIdAll("bookingPetNames", preview?.pets || "Your dog(s) – demo");
    setTextByIdAll("bookingPetBreed", preview?.breed || "Breed / size – demo");

    const policiesHtml = `
      <ul style="margin:0; padding-left:18px;">
        <li><strong>Cancellation:</strong> Free cancellation up to 24 hours before start. 50% after that.</li>
        <li><strong>Meet & greet:</strong> Meet & greet required for all new dogs.</li>
        <li><strong>Aggressive dog policy:</strong> Not able to accept dogs with a history of biting people.</li>
        <li><strong>Extra fees:</strong> Holiday bookings +$10/night. Last-minute bookings (&lt;24h) +$5.</li>
      </ul>
    `;
    setHTMLByIdAll("bookingPolicies", policiesHtml);

    const total = computeTotalPrice(preview);
    setTextByIdAll("bookingTotalPrice", money(total));

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
  // Confirm & Pay
  // ----------------------------
  async function confirmBookingFromModal() {
    try {
      setModalError("");

      const preview = window.PetCareBooking?.preview || {};
      const user = getCurrentUser();
      const sitter = getSelectedSitter();

      // ✅ HARD FIX: detect service type RIGHT NOW
      const detected = detectServiceTypeNow();
      let serviceCode = detected.code;

      // If still not found, default safely (so you stop getting blocked)
      if (!serviceCode) {
        console.warn("[Booking] Could not detect service_type. Candidates:", detected.source);
        serviceCode = "overnight"; // safe fallback
      }

      // Force onto preview
      preview.service_type = serviceCode;
      preview.service_label = serviceLabelFromCode(serviceCode);
      window.PetCareBooking.preview = preview;

      // Debug log (so we can see what it’s actually doing in console)
      console.log("[Booking] service_type final:", preview.service_type, "from:", detected.source);

      const client_id = Number(preview.client_id || user?.id);
      const sitter_id = Number(preview.sitter_id || sitter?.id);

      if (!client_id || !sitter_id) {
        throw new Error("Missing client_id or sitter_id. Please log in and select a sitter again.");
      }

      if (!preview.start_time || !preview.end_time) {
        throw new Error("Start/end time missing. Please fill in date + times.");
      }

      const total = computeTotalPrice(preview);

      // Stripe
      ensureStripeMounted();
      if (!stripe || !card) {
        throw new Error("Stripe is not ready. Please refresh the page.");
      }

      // Create payment intent
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

      // ✅ Create booking in DB with forced service_type code
      const bookingRes = await apiJson("/bookings", {
        method: "POST",
        body: JSON.stringify({
          client_id,
          sitter_id,
          pet_id: preview.pet_id || null,
          service_type: preview.service_type, // ✅ guaranteed code now
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

      if (typeof window.showPage === "function") {
        window.showPage("bookingConfirmPage");
      }

      if (typeof window.renderBookingConfirm === "function") {
        window.renderBookingConfirm(bookingRes);
      } else {
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
  // Wire events
  // ----------------------------
  function wireBookingEvents() {
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

        // Even if service_type failed here, we still allow modal open,
        // because confirm step re-detects and forces it again.
        if (!data.start_time || !data.end_time) {
          alert("Please select a date and start/end time.");
          return;
        }

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

    const closeBtn = $("#bookingModalClose");
    const cancelBtn = $("#bookingModalCancelBtn");
    const editBtn = $("#bookingModalEditBtn");
    const confirmBtn = $("#bookingModalConfirmBtn");

    if (closeBtn) closeBtn.addEventListener("click", hideModal);
    if (cancelBtn) cancelBtn.addEventListener("click", hideModal);
    if (editBtn) editBtn.addEventListener("click", hideModal);
    if (confirmBtn) confirmBtn.addEventListener("click", confirmBookingFromModal);
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireBookingEvents();
    ensureStripeMounted();
  });
})();