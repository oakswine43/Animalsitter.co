// backend/testBooking.js
const API_BASE = "http://localhost:4000";

async function main() {
  const bookingPayload = {
    client_id: 1,                 // must exist in users table
    sitter_id: 2,                 // must exist in users table
    service_type: "overnight",
    start_time: "2025-02-15 18:00:00",
    end_time: "2025-02-16 10:00:00",
    location: "Client home",
    price_total: 57,
    notes: "Overnight stay for Milo (test script)",
    payment_method: "card",
    currency: "USD"
  };

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bookingPayload)
    });

    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type") || "(none)");

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text();
      console.log("Could not parse JSON:", err.message);
      console.log("Raw response text (first 400 chars):");
      console.log(text.slice(0, 400));
    }

    console.log("Response JSON:", data);
  } catch (err) {
    console.error("REQUEST ERROR:", err);
  }
}

main();
