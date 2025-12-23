// home-sitter-app/js/pages/profile.js
// Profile page wired to PetCareState so it uses the real logged-in user.

(function () {
  function getCurrentUser() {
    // Prefer central PetCareState (localStorage + backend auth)
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      return window.PetCareState.getCurrentUser();
    }

    // Fallback to any old appState if it exists
    const appState = window.appState || {};
    return (
      appState.currentUser ||
      appState.user || {
        id: "guest",
        name: "Guest user",
        role: "guest",
        email: "",
        phone: ""
      }
    );
  }

  function setCurrentUser(user) {
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      window.PetCareState.setCurrentUser(user);
    }

    // Keep legacy appState in sync so nothing else breaks
    window.appState = window.appState || {};
    window.appState.currentUser = user;

    // Refresh header pill if that helper exists
    if (typeof window.updateHeaderUser === "function") {
      window.updateHeaderUser();
    }
  }

  function getInitials(name) {
    if (!name) return "🙂";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
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
        <div class="profile-body">
          <!-- LEFT: avatar / photo -->
          <div class="profile-photo-column">
            <div class="avatar-large" id="profileAvatar">
              <span class="avatar-initials">${getInitials(fullName)}</span>
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
                    autocomplete="name"
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
                    autocomplete="tel"
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
                    autocomplete="email"
                    disabled
                  />
                </label>
              </div>

              <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
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
    `;

    // -------- wire up interactions --------

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
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        const updatedName = nameInput.value.trim() || fullName;
        const updatedPhone = phoneInput.value.trim();

        const updatedUser = {
          ...user,
          full_name: updatedName,
          name: updatedName,
          phone: updatedPhone
        };

        setCurrentUser(updatedUser);

        summaryName.textContent = updatedUser.full_name;
        summaryRole.textContent = (updatedUser.role || roleKey).toUpperCase();
        summaryPhone.textContent = updatedUser.phone || "—";

        if (saveBtn) {
          saveBtn.disabled = true;
          const originalText = saveBtn.textContent;
          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
          }, 1200);
        }
      });
    }
  }

  // Let app.js call this when navigating
  window.renderProfilePage = renderProfilePage;

  // Render on load (in case Profile is opened directly)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();