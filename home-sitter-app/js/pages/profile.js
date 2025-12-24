// js/pages/profile.js
// Profile page wired to PetCareState / backend user

(function () {
  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "";

  function getCurrentUser() {
    if (
      window.PetCareState &&
      typeof window.PetCareState.getCurrentUser === "function"
    ) {
      return window.PetCareState.getCurrentUser();
    }

    // fallback guest
    return {
      id: null,
      full_name: "Guest user",
      name: "Guest user",
      role: "guest",
      email: "",
      phone: ""
    };
  }

  function setCurrentUser(user) {
    if (
      window.PetCareState &&
      typeof window.PetCareState.setCurrentUser === "function"
    ) {
      window.PetCareState.setCurrentUser(user);
    }
  }

  function getInitials(name) {
    if (!name) return "🙂";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  // Optional: try to persist to backend (best-effort, safe to fail silently)
  async function saveProfileToBackend(updated) {
    const token = localStorage.getItem("petcare_token");
    if (!token || !API_BASE) return;

    try {
      // adjust endpoint if your backend uses a different route
      await fetch(`${API_BASE}/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: updated.full_name,
          phone: updated.phone
        })
      });
    } catch (err) {
      console.warn("[Profile] Failed to sync with backend:", err);
    }
  }

  function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    const user = getCurrentUser();

    const fullName = user.full_name || user.name || "Guest user";
    const roleKey = (user.role || "guest").toUpperCase();
    const phone = user.phone || "";
    const email = user.email || "";

    root.innerHTML = `
      <div class="profile-layout">
        <div class="section-card profile-main-card">
          <div class="section-header">
            <h1>Your profile</h1>
            <p>
              Update your name, photo, and contact info so sitters and clients
              know who they’re working with.
            </p>
          </div>

          <div class="profile-body">
            <!-- LEFT: avatar / photo -->
            <div class="profile-photo-column">
              <div class="avatar-large has-photo" id="profileAvatar">
                ${
                  user.photo_url || user.avatar_url
                    ? `<div class="avatar-img" style="background-image:url('${user.photo_url || user.avatar_url}')"></div>`
                    : `<span class="avatar-initials">${getInitials(fullName)}</span>`
                }
                <div class="avatar-camera-pill">
                  <span>📷</span>
                  <span>Change</span>
                </div>
              </div>
              <p class="profile-photo-text">
                Add a clear photo of yourself. This helps pet parents recognize you
                at pick-ups and drop-offs.
              </p>
              <input
                type="file"
                accept="image/*"
                id="profilePhotoInput"
                hidden
              />
            </div>

            <!-- RIGHT: form -->
            <div class="profile-form-column">
              <form id="profileForm" class="auth-form">
                <div class="profile-form-grid">
                  <label>
                    <span>Full name</span>
                    <input
                      type="text"
                      id="profileNameInput"
                      class="input"
                      value="${fullName}"
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <input
                      type="text"
                      id="profileRoleInput"
                      class="input"
                      value="${roleKey}"
                      disabled
                    />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input
                      type="tel"
                      id="profilePhoneInput"
                      class="input"
                      value="${phone}"
                      placeholder="000-000-0000"
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      id="profileEmailInput"
                      class="input"
                      value="${email}"
                      placeholder="you@example.com"
                      disabled
                    />
                  </label>
                </div>

                <div style="margin-top: 16px; display: flex; gap: 8px;">
                  <button
                    type="submit"
                    class="btn-primary"
                    id="profileSaveBtn"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    id="profileManageSettingsBtn"
                    data-page-jump="settingsPage"
                  >
                    Manage settings
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    id="profileLogoutBtn"
                  >
                    Logout
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- SUMMARY -->
          <div class="profile-summary-row">
            <div>
              <strong>Name:</strong>
              <span id="profileSummaryName">${fullName}</span>
            </div>
            <div>
              <strong>Role:</strong>
              <span id="profileSummaryRole">${roleKey}</span>
            </div>
            <div>
              <strong>Phone:</strong>
              <span id="profileSummaryPhone">${phone || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // ---- wires & interactions ----
    const photoInput = root.querySelector("#profilePhotoInput");
    const avatar = root.querySelector("#profileAvatar");
    const form = root.querySelector("#profileForm");
    const saveBtn = root.querySelector("#profileSaveBtn");

    const nameInput = root.querySelector("#profileNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryRole = root.querySelector("#profileSummaryRole");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

    function openPhotoPicker() {
      if (photoInput) photoInput.click();
    }

    if (avatar) {
      avatar.addEventListener("click", openPhotoPicker);
    }
    const cameraPill = root.querySelector(".avatar-camera-pill");
    if (cameraPill) {
      cameraPill.addEventListener("click", function (e) {
        e.stopPropagation();
        openPhotoPicker();
      });
    }

    if (photoInput) {
      photoInput.addEventListener("change", function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (ev) {
          const dataUrl = ev.target.result;
          avatar.style.backgroundImage = `url('${dataUrl}')`;
          avatar.classList.add("has-photo");
        };
        reader.readAsDataURL(file);
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const updatedFullName = nameInput.value.trim() || fullName;
        const updatedPhone = phoneInput.value.trim();

        const updatedUser = {
          ...user,
          full_name: updatedFullName,
          name: updatedFullName,
          phone: updatedPhone
        };

        setCurrentUser(updatedUser);

        summaryName.textContent = updatedFullName;
        summaryRole.textContent = (updatedUser.role || roleKey).toUpperCase();
        summaryPhone.textContent = updatedPhone || "—";

        if (typeof window.updateHeaderUser === "function") {
          window.updateHeaderUser();
        }

        if (saveBtn) {
          const originalText = saveBtn.textContent;
          saveBtn.disabled = true;
          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
          }, 1200);
        }

        // Best-effort backend sync
        await saveProfileToBackend(updatedUser);
      });
    }

    // Logout button on profile card uses same handler as global
    const profileLogoutBtn = root.querySelector("#profileLogoutBtn");
    if (profileLogoutBtn && typeof window.doLogout === "function") {
      profileLogoutBtn.addEventListener("click", window.doLogout);
    }
  }

  // Expose so app.js can call when navigating
  window.initProfilePage = function () {
    renderProfilePage();
  };

  // Also render once on load in case profile is first page opened
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();