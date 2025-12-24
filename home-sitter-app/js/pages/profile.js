// home-sitter-app/js/pages/profile.js
// Profile page wired to backend user + PetCareState

(function () {
  const TOKEN_KEY = "petcare_token";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function hasApiBase() {
    return typeof window.API_BASE === "string" && window.API_BASE.length > 0;
  }

  async function fetchUserFromApi() {
    if (!hasApiBase()) return null;
    const token = getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${window.API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.warn("[profile] /auth/me status:", res.status);
        return null;
      }

      const data = await res.json().catch(() => null);
      if (!data) return null;

      // some backends return { user }, some return user directly
      const apiUser = data.user || data;
      return apiUser || null;
    } catch (err) {
      console.warn("[profile] failed to fetch /auth/me", err);
      return null;
    }
  }

  async function saveProfileToApi(payload) {
    if (!hasApiBase()) return null;
    const token = getToken();
    if (!token) return null;

    const res = await fetch(`${window.API_BASE}/me/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload || {})
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data && data.error) || "Failed to save profile.";
      throw new Error(msg);
    }
    return data && (data.user || data);
  }

  function mapApiUser(apiUser) {
    if (!apiUser) return null;
    const fullName = apiUser.full_name || apiUser.name || "";

    return {
      id: apiUser.id,
      name: fullName,
      full_name: fullName,
      email: apiUser.email || "",
      role: apiUser.role || "client",
      phone: apiUser.phone || "",
      is_active: apiUser.is_active
    };
  }

  function getUserFromState() {
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      return window.PetCareState.getCurrentUser() || null;
    }
    return null;
  }

  function setUserInState(user) {
    if (
      window.PetCareState &&
      typeof window.PetCareState.setCurrentUser === "function" &&
      user
    ) {
      window.PetCareState.setCurrentUser(user);
    }
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
    if (r === "client") return "CLIENT";
    if (r === "sitter") return "SITTER";
    if (r === "employee") return "EMPLOYEE";
    if (r === "admin") return "ADMIN";
    return r.toUpperCase();
  }

  function renderProfile(root, user) {
    const fullName = user.full_name || user.name || "Guest user";
    const rawRole = user.role || "guest";
    const phone = user.phone || "";
    const email = user.email || "";

    const roleDisplay = prettyRole(rawRole);

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

                <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
                  <button type="submit" class="btn-primary" id="profileSaveBtn">
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

    // ---- hooks ----
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
      cameraPill.addEventListener("click", (e) => {
        e.stopPropagation();
        openPhotoPicker();
      });
    }

    if (photoInput) {
      photoInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          avatar.style.backgroundImage = `url('${dataUrl}')`;
          avatar.classList.add("has-photo");
        };
        reader.readAsDataURL(file);
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const updatedPayload = {
          full_name: (nameInput.value || "").trim(),
          phone: (phoneInput.value || "").trim()
        };

        // optimistic UI update
        let updatedUser = {
          ...user,
          full_name: updatedPayload.full_name || fullName,
          name: updatedPayload.full_name || fullName,
          phone: updatedPayload.phone || phone
        };

        try {
          const apiUser = await saveProfileToApi(updatedPayload);
          if (apiUser) {
            updatedUser = mapApiUser(apiUser);
          }
        } catch (err) {
          console.warn("[profile] save failed:", err);
          // we still keep optimistic update
        }

        setUserInState(updatedUser);

        summaryName.textContent = updatedUser.full_name;
        summaryRole.textContent = prettyRole(updatedUser.role || user.role);
        summaryPhone.textContent = updatedUser.phone || "—";

        if (saveBtn) {
          saveBtn.disabled = true;
          const original = saveBtn.textContent;
          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = original;
          }, 1200);
        }
      });
    }

    // logout button still uses global handler in app.js via id="profileLogoutBtn"
  }

  async function initProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    // 1) try backend /auth/me
    let user = null;
    const apiUser = await fetchUserFromApi();
    if (apiUser) {
      user = mapApiUser(apiUser);
      setUserInState(user);
    } else {
      // 2) fallback to whatever PetCareState has (maybe from login)
      user = getUserFromState() || {
        id: "guest",
        full_name: "Guest user",
        name: "Guest user",
        role: "guest",
        email: "",
        phone: ""
      };
    }

    renderProfile(root, user);
  }

  // expose for router
  window.renderProfilePage = initProfilePage;

  // render when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfilePage);
  } else {
    initProfilePage();
  }
})();