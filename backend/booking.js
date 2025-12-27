      // 3) Payment success – create REAL booking in backend
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

      const bkRes = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: buildAuthJsonHeaders(),
        body: JSON.stringify({
          client_id: preview.client.id,
          sitter_id: preview.sitter.id,
          pet_id: null,
          service_type: preview.service.name || "Pet sitting",
          start_time: toMySqlDateTime(now),
          end_time: toMySqlDateTime(end),
          location: "",
          total_price: preview.pricing.total,   // 👈 changed from price_total → total_price
          notes: `Stripe paymentIntent ${paymentIntent.id}`
        })
      });

      let bkData = {};
      try {
        bkData = await bkRes.json();
      } catch (e) {
        console.warn("Could not parse /bookings JSON:", e);
      }

      console.log("POST /bookings response:", bkRes.status, bkData); // 👈 new debug line

      if (!bkRes.ok) {
        throw new Error(
          (bkData && bkData.error) || "Payment succeeded but booking failed."
        );
      }