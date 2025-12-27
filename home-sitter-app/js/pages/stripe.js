// home-sitter-app/js/stripe.js
// Frontend Stripe setup (publishable key only)

const STRIPE_PUBLISHABLE_KEY = "pk_test_51QdBreC0JXa2ACwIkINq3urLuWl6mb2VdoSNFQOnyDQL1PcJt8cV2JhyGGVVaue8IZidNC7Vup0ofEOZDsNRRA9P00oN3W3WPQ"; 
// ^ Replace with your real TEST publishable key from Stripe Dashboard

let stripe = null;
let stripeElements = null;
let stripeCardElement = null;

function initStripe() {
  if (!window.Stripe) {
    console.error("Stripe.js not loaded");
    return;
  }

  if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.startsWith("pk_live")) {
    console.warn("Using live key or missing publishable key — make sure this is pk_test_ in dev.");
  }

  stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  stripeElements = stripe.elements();
  window.stripe = stripe;

  console.log("Stripe initialized (frontend).");
}

// Create / mount the card element inside #card-element
function mountStripeCardElement() {
  if (!stripe || !stripeElements) return;

  if (!stripeCardElement) {
    stripeCardElement = stripeElements.create("card");
    const container = document.getElementById("card-element");
    if (container) {
      stripeCardElement.mount("#card-element");
    }
  }
}

window.initStripe = initStripe;
window.mountStripeCardElement = mountStripeCardElement;
window.getStripeCardElement = function () {
  return stripeCardElement;
};