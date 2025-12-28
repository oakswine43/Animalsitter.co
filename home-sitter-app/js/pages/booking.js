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
      localStorage.getItem("petcare_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      ""
    );
  }

  function getCurrentUser() {
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

  function ensureBookingPaymentBlock() {
    // Inject a Payment section on the booking page (below "Your info")
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

  function mountStripeOnBookingPage() {
    if (!window.StripeHelpers) return;
    ensureBookingPaymentBlock();
    // Try mount
    window.StripeHelpers.mountCard("bookingStripeCardMount");
  }

  function setBookingError(msg) {
    const el = $("bookingCardErrors");
    if (el) el.textContent = msg || "";
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function buildBookingPayload() {
    const user = getCurrentUser();
    const clientId = user?.id || user?.user?.id || null;

    const sitterId =
      window.PetCareBooking?.preview?.sitter_id ||
      window.PetCareBooking?.preview?.id ||
      window.PetCareBooking?.sitter_id ||
      null;

    const serviceRaw = $("bookingService")?.value || "";
    const service = normalizeServiceType(serviceRaw);

    const date = $("bookingDate")?.value || "";
    const start = $("bookingStart")?.value || "";
    const end = $("bookingEnd")?.value || "";

    const startIso = toISO(date, start);
    const endIso = toISO(date, end);

    const location = $("bookingLocation")?.value || "";
    const pets = $("bookingPets")?.value || "";
    const breed = $("bookingBreed")?.value || "";
    const notes = $("bookingPetNotes")?.value || "";

    const clientPhone = $("bookingClientPhone")?.value || "";
    const clientEmail = $("bookingClientEmail")?.value || "";
    const clientAddress = $("bookingClientAddress")?.value || "";

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
      return { ok: false, error: "Please choose date, start time, and end time." };
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
      display: { base, serviceFee, total, serviceLabel: humanServiceLabel(service) }
    };
  }

  async function handleConfirmAndPay(e) {
    if (e) e.preventDefault();
    setBookingError("");

    // Ensure stripe is mounted right now
    mountStripeOnBookingPage();

    if (window.StripeHelpers?.isStripeBlocked?.()) {
      setBookingError(
        "Stripe is blocked (Brave Shields/ad blocker). Disable Shields for this site and refresh."
      );
      return;
    }

    const built = buildBookingPayload();
    if (!built.ok) {
      setBookingError(built.error);
      return;
    }

    const { payload, display } = built;

    try {
      // 1) Create PaymentIntent
      const amountCents = Math.round(Number(payload.price_total) * 100);
      const pi = await window.StripeHelpers.createPaymentIntent(
        amountCents,
        `AnimalSitter – ${display.serviceLabel}`
      );

      // 2) Confirm payment with card element
      const paymentIntent = await window.StripeHelpers.confirmCardPayment(pi.clientSecret);

      // 3) Create booking in DB (include payment_intent_id)
      payload.payment_intent_id = paymentIntent?.id || pi.paymentIntentId || null;

      const { res, data } = await fetchJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Booking failed after payment.");
      }

      // success UI
      window.PetCareBooking.booking = data;

      // If you have a confirm page renderer, jump there
      if (window.showPage) {
        window.showPage("bookingConfirmPage");
      }

      const root = document.getElementById("bookingConfirmRoot");
      if (root) {
        root.innerHTML = `
          <h2>Booking confirmed ✅</h2>
          <p class="text-muted">Payment succeeded and your booking was created.</p>
          <div style="margin-top:10px;" class="section-card">
            <div><strong>Service:</strong> ${display.serviceLabel}</div>
            <div><strong>Total:</strong> $${Number(payload.price_total).toFixed(2)}</div>
            <div><strong>Booking ID:</strong> ${data.booking_id}</div>
            <div><strong>PaymentIntent:</strong> ${payload.payment_intent_id || "n/a"}</div>
          </div>
          <button type="button" class="btn-primary" style="margin-top:10px;"
            onclick="window.showPage && window.showPage('dashboardPage')">
            Go to Dashboard
          </button>
        `;
      }
    } catch (err) {
      console.error("Booking payment error:", err);
      setBookingError(err.message || "Payment/booking failed.");
    }
  }

  function wireButtons() {
    const form = $("bookingPageForm");
    if (form && !form.__wiredBooking) {
      form.__wiredBooking = true;

      // Add a secondary "Confirm & Pay" button if your HTML doesn’t already have one
      // (Your screenshot shows it exists already; this will not duplicate.)
      form.addEventListener("submit", function (e) {
        // Keep “Request booking” as a “review” action (no payment),
        // but you can change this later.
        e.preventDefault();
        setBookingError("");
        mountStripeOnBookingPage();
        alert("Review complete. Use “Confirm & Pay” to charge the card and finalize.");
      });
    }

    // If you have a dedicated Confirm & Pay button on the page, bind it
    const confirmBtn =
      document.getElementById("confirmPayBtn") ||
      document.querySelector('button.btn-primary[type="button"][data-action="confirm-pay"]') ||
      document.querySelector("button.btn-primary.btn-lg[data-action='confirm-pay']");

    // Your UI shows a “Confirm & Pay” button but we don’t know its id,
    // so we also bind by text as a fallback:
    const allButtons = Array.from(document.querySelectorAll("button"));
    const fallbackConfirm = allButtons.find((b) =>
      (b.textContent || "").trim().toLowerCase() === "confirm & pay"
    );

    const btn = confirmBtn || fallbackConfirm;
    if (btn && !btn.__wiredPay) {
      btn.__wiredPay = true;
      btn.addEventListener("click", handleConfirmAndPay);
    }
  }

  // Public init called by app router when page opens
  window.initBookingPage = function initBookingPage() {
    // Payment needs Stripe ready
    if (window.initStripe) window.initStripe();
    mountStripeOnBookingPage();
    wireButtons();
  };

  // Also attempt to mount after DOM ready (first load)
  document.addEventListener("DOMContentLoaded", function () {
    // only if booking page exists in DOM
    if ($("bookingPage")) {
      if (window.initStripe) window.initStripe();
    }
  });
})();