// home-sitter-app/js/pages/profile.js

(function () {
  function getCurrentUser() {
    const appState = window.appState || {};
    return (
      appState.currentUser ||
      appState.user || {
        id: null,
        full_name: "Guest user",
        role: "GUEST",
        phone: "000-000-0000",
      }
    );
  }

  function setCurrentUser(user) {
    if (!window.appState) window.appState = {};
    window.appState.currentUser = user;
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
    const role = (user.role || "GUEST").toUpperCase();
    const phone = user.phone || "000-000-0000";

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
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <input
                      type="text"
                      id="profileRoleInput"
                      class="input"
                      value="${role}"
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
                      value="${user.email || ""}"
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
              <span id="profileSummaryRole">${role}</span>
            </div>
            <div>
              <strong>Phone:</strong>
              <span id="profileSummaryPhone">${phone}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // ---- wires & interactions ----
    const photoInput = root.querySelector("#profilePhotoInput");
    const avatar = root.querySelector("#profileAvatar");
    const saveBtn = root.querySelector("#profileSaveBtn");
    const form = root.querySelector("#profileForm");

    const nameInput = root.querySelector("#profileNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryRole = root.querySelector("#profileSummaryRole");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

    function openPhotoPicker() {
      if (photoInput) {
        photoInput.click();
      }
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

        const updated = {
          ...user,
          full_name: nameInput.value.trim() || fullName,
          phone: phoneInput.value.trim() || phone,
        };

        setCurrentUser(updated);

        summaryName.textContent = updated.full_name;
        summaryRole.textContent = (updated.role || role).toUpperCase();
        summaryPhone.textContent = updated.phone || "—";

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saved";

        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
        }, 1200);
      });
    }

    // Logout still handled by global logout handler (in app.js/auth)
    // because we kept the id="profileLogoutBtn"
  }

  // expose so app.js can call when navigating
  window.renderProfilePage = renderProfilePage;

  // also render once on load in case profile is the first page opened
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();
