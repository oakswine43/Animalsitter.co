// js/stripe.js
(function () {
  const PUBLISHABLE =
    window.STRIPE_PUBLISHABLE_KEY ||
    "pk_test_51QdBreC0JXa2ACwIkINq3urLuWl6mb2VdoSNFQOnyDQL1PcJt8cV2JhyGGVVaue8IZidNC7Vup0ofEOZDsNRRA9P00oN3W3WPQ";

  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  const StripeState = {
    stripe: null,
    elements: null,
    card: null,
    mountedTo: null,
    isReady: false
  };

  function isStripeBlocked() {
    return typeof window.Stripe !== "function";
  }

  function setCardError(msg) {
    const el =
      document.getElementById("card-errors") ||
      document.getElementById("card-errors-page") ||
      document.getElementById("bookingCardErrors") ||
      document.getElementById("bookingCardErrorsModal");

    if (el) el.textContent = msg || "";
  }

  function ensureStripeInstance() {
    if (StripeState.stripe) return StripeState.stripe;

    if (isStripeBlocked()) {
      return null;
    }

    StripeState.stripe = window.Stripe(PUBLISHABLE);
    StripeState.elements = StripeState.stripe.elements();
    StripeState.card = StripeState.elements.create("card", { hidePostalCode: true });

    StripeState.isReady = true;
    return StripeState.stripe;
  }

  function mountCard(containerId) {
    const stripe = ensureStripeInstance();
    const container = document.getElementById(containerId);

    if (!container) return { ok: false, reason: "missing_container" };

    if (!stripe) {
      container.innerHTML = `
        <div class="small text-muted" style="line-height:1.4;">
          <strong>Stripe card form didn’t load.</strong><br/>
          This is usually caused by an ad-blocker / Brave Shields blocking Stripe, or Stripe not loading.<br/>
          Try: disable Brave Shields for this site (or allow scripts from <code>js.stripe.com</code>), then refresh.
        </div>
      `;
      return { ok: false, reason: "stripe_blocked" };
    }

    if (StripeState.card && StripeState.mountedTo && StripeState.mountedTo !== containerId) {
      try {
        StripeState.card.unmount();
      } catch (_) {}
      StripeState.mountedTo = null;
    }

    if (StripeState.mountedTo === containerId) return { ok: true };

    container.innerHTML = "";
    StripeState.card.mount(`#${containerId}`);
    StripeState.mountedTo = containerId;
    setCardError("");
    return { ok: true };
  }

  function unmountCard() {
    if (!StripeState.card) return;
    try {
      StripeState.card.unmount();
    } catch (_) {}
    StripeState.mountedTo = null;
  }

  async function createPaymentIntent(amountCents, description) {
    const stripe = ensureStripeInstance();
    if (!stripe) throw new Error("Stripe is blocked or not loaded.");

    const amount = Number(amountCents);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid amount for payment intent.");
    }

    const res = await fetch(`${API_BASE}/stripe/create-payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount),
        currency: "usd",
        description: description || "AnimalSitter booking"
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.clientSecret) {
      throw new Error(data.error || "Failed to create payment intent.");
    }

    return data;
  }

  async function confirmCardPayment(clientSecret) {
    const stripe = ensureStripeInstance();
    if (!stripe) throw new Error("Stripe is blocked or not loaded.");
    if (!StripeState.card) throw new Error("Card element is not mounted.");

    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: StripeState.card }
    });

    if (result.error) {
      throw new Error(result.error.message || "Payment failed.");
    }

    return result.paymentIntent;
  }

  // Public API (matches your booking.js usage)
  window.initStripe = function initStripe() {
    ensureStripeInstance();
    return StripeState.isReady;
  };

  window.StripeHelpers = {
    mountCard,
    unmountCard,
    createPaymentIntent,
    confirmCardPayment,
    isStripeBlocked
  };
})();
