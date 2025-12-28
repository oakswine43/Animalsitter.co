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

  // Only inject a payment block if your page DOESN'T already have one.
  function ensureBookingPaymentBlock() {
    // Your index.html already includes:
    //   <div id="stripe-card-element-page"></div>
    // So do nothing if that exists.
    if ($("stripe-card-element-page")) return;

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

    const cards = form.querySelectorAll(".section-card");
    if (cards.length) {
      cards[cards.length - 1].before(section);
    } else {
      form.appendChild(section);
    }
  }

  function mountStripeOnBookingPage() {
    if (!window.StripeHelpers) return;

    // ✅ Mount into the real booking-page mount point from index.html
    if ($("stripe-card-element-page")) {
      window.StripeHelpers.mountCard("stripe-card-element-page");
      return;
    }

    // Fallback: inject and mount
    ensureBookingPaymentBlock();
    if ($("bookingStripeCardMount")) {
      window.StripeHelpers.mountCard("bookingStripeCardMount");
    }
  }

  function setBookingError(msg) {
    const message = msg || "";

    // booking page’s real error element (index.html)
    const pageErr = $("card-errors-page");
    if (pageErr) pageErr.textContent = message;

    // injected fallback error
    const fallbackErr = $("bookingCardErrors");
    if (fallbackErr) fallbackErr.textContent = message;

    // modal/legacy
    const legacy =
      document.getElementById("card-errors") ||
      document.getElementById("bookingCardErrorsModal");
    if (legacy) legacy.textContent = message;
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
        service_type: service,
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

    if (window.initStripe) window.initStripe();
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

    const token = getAuthToken();
    if (!token) {
      setBookingError("Missing auth token. Please log in again.");
      return;
    }

    const payBtn = $("bookingPayNowBtn");
    if (payBtn) payBtn.disabled = true;

    try {
      // 1) Create PaymentIntent
      const amountCents = Math.round(Number(payload.price_total) * 100);
      const pi = await window.StripeHelpers.createPaymentIntent(
        amountCents,
        `AnimalSitter – ${display.serviceLabel}`
      );

      // 2) Confirm payment
      const paymentIntent = await window.StripeHelpers.confirmCardPayment(pi.clientSecret);

      // 3) Create booking in DB (include payment_intent_id)
      payload.payment_intent_id = paymentIntent?.id || pi.paymentIntentId || null;

      const { res, data } = await fetchJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Booking failed after payment.");
      }

      window.PetCareBooking.booking = data;

      if (window.showPage) window.showPage("bookingConfirmPage");
      if (typeof window.setActivePage === "function") window.setActivePage("bookingConfirmPage");

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
    } catch (err) {
      console.error("Booking payment error:", err);
      setBookingError(err.message || "Payment/booking failed.");
    } finally {
      if (payBtn) payBtn.disabled = false;
    }
  }

  function wireButtons() {
    const form = $("bookingPageForm");
    if (form && !form.__wiredBooking) {
      form.__wiredBooking = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        setBookingError("");
        mountStripeOnBookingPage();
        alert("Review complete. Use “Confirm & Pay” to charge the card and finalize.");
      });
    }

    // ✅ This is your real button ID from index.html
    const payBtn = $("bookingPayNowBtn");
    if (payBtn && !payBtn.__wiredPay) {
      payBtn.__wiredPay = true;
      payBtn.addEventListener("click", handleConfirmAndPay);
    }
  }

  // Public init called by app router when page opens
  window.initBookingPage = function initBookingPage() {
    if (window.initStripe) window.initStripe();
    mountStripeOnBookingPage();
    wireButtons();
  };

  // Mount on first load too
  document.addEventListener("DOMContentLoaded", function () {
    if ($("bookingPage")) {
      if (window.initStripe) window.initStripe();
      mountStripeOnBookingPage();
      wireButtons();
    }
  });
})();