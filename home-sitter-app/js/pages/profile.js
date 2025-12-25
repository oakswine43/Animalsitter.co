// home-sitter-app/js/pages/profile.js
(function () {
  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "";

  function getCurrentUser() {
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      return window.PetCareState.getCurrentUser();
    }
    return {
      id: null,
      full_name: "Guest user",
      name: "Guest user",
      role: "guest",
      phone: "",
      email: ""
    };
  }

  function setCurrentUser(user) {
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      window.PetCareState.setCurrentUser(user);
    } else {
      window.appState = window.appState || {};
      window.appState.currentUser = user;
    }

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
    const role = (user.role || "guest").toUpperCase();
    const phone = user.phone || "";
    const email = user.email || "";
    const avatarUrl = user.avatar_url || user.photo_url || "";

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
              <div class="avatar-large ${avatarUrl ? "has-photo" : ""}" id="profileAvatar" ${
                avatarUrl ? `style="background-image:url('${avatarUrl}')"` : ""
              }>
                ${
                  avatarUrl
                    ? ""
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
              <span id="profileSummaryRole">${role}</span>
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

    // NOTE: right now this only changes the preview.
    // Persisting the actual image would require an upload endpoint.
    if (photoInput && avatar) {
      photoInput.addEventListener("change", function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (ev) {
          const dataUrl = ev.target.result;
          avatar.style.backgroundImage = `url('${dataUrl}')`;
          avatar.classList.add("has-photo");
          const initialsEl = avatar.querySelector(".avatar-initials");
          if (initialsEl) initialsEl.remove();
        };
        reader.readAsDataURL(file);
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const updated = {
          ...user,
          full_name: nameInput.value.trim() || fullName,
          phone: phoneInput.value.trim()
        };

        const token = localStorage.getItem("petcare_token");

        try {
          saveBtn.disabled = true;
          const originalText = saveBtn.textContent;
          saveBtn.textContent = "Saving...";

          const res = await fetch(`${API_BASE}/auth/me`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              full_name: updated.full_name,
              phone: updated.phone || ""
              // avatar_url: could be sent later when you store image URLs
            })
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok || !data.user) {
            console.error("Profile update error:", data);
            alert(data.error || "Failed to update profile.");
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            return;
          }

          // Normalize user from API
          const apiUser = data.user;
          const mapped =
            typeof window.PetCareMapApiUser === "function"
              ? window.PetCareMapApiUser(apiUser)
              : {
                  id: apiUser.id,
                  name: apiUser.full_name || apiUser.name || "",
                  full_name: apiUser.full_name || apiUser.name || "",
                  email: apiUser.email,
                  role: apiUser.role,
                  phone: apiUser.phone || "",
                  avatar_url: apiUser.avatar_url || null
                };

          // Save to global state + header
          setCurrentUser(mapped);

          // Update summary
          summaryName.textContent = mapped.full_name;
          summaryRole.textContent = (mapped.role || role).toUpperCase();
          summaryPhone.textContent = mapped.phone || "—";

          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
          }, 1200);
        } catch (err) {
          console.error("Profile update error:", err);
          alert("Error updating profile. Please try again.");
          saveBtn.disabled = false;
          saveBtn.textContent = "Save changes";
        }
      });
    }

    // Logout button here still uses global doLogout from app.js
    const logoutBtn = root.querySelector("#profileLogoutBtn");
    if (logoutBtn && typeof window.doLogout === "function") {
      logoutBtn.addEventListener("click", window.doLogout);
    }
  }

  // expose so app.js can call when navigating
  window.initProfilePage = renderProfilePage;

  // also render once on load in case profile is the first page opened
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();