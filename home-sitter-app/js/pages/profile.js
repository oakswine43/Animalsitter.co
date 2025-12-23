// home-sitter-app/js/pages/profile.js
// Profile page wired to PetCareState, appState, and header pill fallback

(function () {
  // Try to read from PetCareState, then appState, then header pill
  function getCurrentUser() {
    let user = null;

    // 1) Central state (best source)
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      try {
        user = window.PetCareState.getCurrentUser();
      } catch (_) {}
    }

    // 2) Fallback: appState
    if ((!user || !user.id) && window.appState && window.appState.currentUser) {
      user = window.appState.currentUser;
    }

    // 3) Fallback: parse header pill text like "Joshua Admin · ADMIN"
    if (!user || !user.id || user.role === "guest" || user.role === "GUEST") {
      const pill = document.getElementById("userPill");
      if (pill) {
        const raw = (pill.textContent || "").trim();
        // Handle "Name · ROLE" or "Name - ROLE"
        let name = "";
        let role = "guest";

        if (raw && raw.toLowerCase() !== "guest") {
          let parts = raw.split("·");
          if (parts.length === 1) {
            parts = raw.split("-");
          }
          if (parts.length >= 2) {
            name = parts[0].trim();
            role = parts[1].trim().toLowerCase();
          } else {
            name = raw;
          }

          user = {
            id: "header-user",
            name: name || "Guest user",
            full_name: name || "Guest user",
            role: role || "guest",
            email: "",
            phone: ""
          };
        }
      }
    }

    // 4) Final fallback
    if (!user || !user.id) {
      user = {
        id: "guest",
        name: "Guest user",
        full_name: "Guest user",
        role: "guest",
        email: "",
        phone: ""
      };
    }

    return user;
  }

  function setCurrentUser(user) {
    // Save into PetCareState if available
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      try {
        window.PetCareState.setCurrentUser(user);
      } catch (_) {}
    }

    // Mirror into appState
    if (!window.appState) window.appState = {};
    window.appState.currentUser = user;

    // Refresh header pill if helper exists
    if (typeof window.updateHeaderUser === "function") {
      try {
        window.updateHeaderUser();
      } catch (_) {}
    }
  }

  function getInitials(name) {
    if (!name) return "🙂";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function prettyRole(roleKey) {
    if (!roleKey) return "GUEST";
    const r = String(roleKey).toLowerCase();
    if (r === "client") return "CLIENT • Pet parent";
    if (r === "sitter") return "SITTER • Pet caregiver";
    if (r === "employee") return "EMPLOYEE • Support staff";
    if (r === "admin") return "ADMIN";
    return r.toUpperCase();
  }

  function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    const user = getCurrentUser();

    const fullName = user.full_name || user.name || "Guest user";
    const rawRole = user.role || "guest";
    const roleDisplay = prettyRole(rawRole);
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
                      value="${roleDisplay}"
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

                <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
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
              <span id="profileSummaryRole">${roleDisplay}</span>
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
    const cameraPill = root.querySelector(".avatar-camera-pill");

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

    if (avatar) avatar.addEventListener("click", openPhotoPicker);
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
          full_name: (nameInput.value || "").trim() || fullName,
          phone: (phoneInput.value || "").trim() || phone
        };

        setCurrentUser(updated);

        summaryName.textContent = updated.full_name;
        summaryRole.textContent = prettyRole(updated.role || rawRole);
        summaryPhone.textContent = updated.phone || "—";

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

  // Make it callable from app.js
  window.renderProfilePage = renderProfilePage;

  // Render once on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();