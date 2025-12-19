(function () {
  const API_BASE = window.PETCARE_API_BASE || "http://localhost:4000";

  function showError(msg) {
    const el = document.getElementById("changePasswordError");
    const ok = document.getElementById("changePasswordSuccess");
    if (ok) ok.textContent = "";
    if (!el) return;
    el.style.display = msg ? "block" : "none";
    el.textContent = msg || "";
  }

  function showSuccess(msg) {
    const el = document.getElementById("changePasswordSuccess");
    const err = document.getElementById("changePasswordError");
    if (err) {
      err.style.display = "none";
      err.textContent = "";
    }
    if (el) el.textContent = msg || "";
  }

  async function postJson(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // If you later enforce JWT auth:
        // "Authorization": `Bearer ${localStorage.getItem("petcare_token") || ""}`
      },
      body: JSON.stringify(body || {})
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }
    return data;
  }

  function initFormPrefill() {
    const user = window.PetCareState?.getCurrentUser?.();
    const emailInput = document.getElementById("cpEmail");
    if (emailInput && user?.email) {
      emailInput.value = user.email;
    }
  }

  function bindChangePassword() {
    const form = document.getElementById("changePasswordForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const email = document.getElementById("cpEmail")?.value?.trim();
      const oldPassword = document.getElementById("cpOldPassword")?.value;
      const newPassword = document.getElementById("cpNewPassword")?.value;
      const confirm = document.getElementById("cpConfirmPassword")?.value;

      if (!email || !oldPassword || !newPassword || !confirm) {
        showError("Please fill out all fields.");
        return;
      }

      if (newPassword.length < 6) {
        showError("New password must be at least 6 characters.");
        return;
      }

      if (newPassword !== confirm) {
        showError("New passwords do not match.");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        await postJson("/auth/change-password", {
          email,
          oldPassword,
          newPassword
        });

        showSuccess("Password updated successfully.");

        // Optional: clear fields
        document.getElementById("cpOldPassword").value = "";
        document.getElementById("cpNewPassword").value = "";
        document.getElementById("cpConfirmPassword").value = "";
      } catch (err) {
        showError(err.message || "Failed to change password.");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function initChangePasswordPage() {
    initFormPrefill();
    bindChangePassword();
  }

  window.initChangePasswordPage = initChangePasswordPage;
})();
