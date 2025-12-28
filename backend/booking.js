if (!stripe_payment_intent_id) {
  return res.status(400).json({ error: "Payment required." });
}
