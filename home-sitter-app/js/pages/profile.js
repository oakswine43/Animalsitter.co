// js/pages/profile.js
// Profile page: loads from /profile and saves back to /profile + /profile/photo

(function () {
  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "";

  function getToken() {
    try {
      return localStorage.getItem("petcare_token") || "";
    } catch (_) {
      return "";
    }
  }

  function mapApiUser(apiUser) {
    if (!apiUser) return null;
    if (typeof window.PetCareMapApiUser === "function") {
      return window.PetCareMapApiUser(apiUser);
    }
    return {
      id: apiUser.id,
      name: apiUser.full_name || apiUser.name || "",
      full_name: apiUser.full_name || apiUser.name || "",
      email: apiUser.email || "",
      role: apiUser.role || "client",
      phone: apiUser.phone || "",
      avatar_url: apiUser.avatar_url || apiUser.photo_url || null,
      is_active: apiUser.is_active
    };
  }

  async function loadProfileFromApi() {
    const token = getToken();
    if (!API_BASE || !token) return null;

    try {
      const res = await fetch(`${API_BASE}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.warn("GET /profile failed:", res.status);
        return null;
      }

      const data = await res.json();
      return data.user || null;
    } catch (err) {
      console.error("loadProfileFromApi error:", err);
      return null;
    }
  }

  async function saveProfileToApi(updates) {
    const token = getToken();
    if (!API_BASE || !token) throw new Error("Not logged in");

    const body = {
      full_name: updates.full_name,
      phone: updates.phone
      // avatar_url will be handled by /profile/photo
    };

    const res = await fetch(`${API_BASE}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("PUT /profile failed:", res.status, data);
      throw new Error(data.error || "Server error");
    }

    return data.user;
  }

  async function uploadProfilePhoto(file) {
    const token = getToken();
    if (!API_BASE || !token) throw new Error("Not logged in");

    const formData = new FormData();
    formData.append("photo", file);

    const res = await fetch(`${API_BASE}/profile/photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("POST /profile/photo failed:", res.status, data);
      throw new Error(data.error || "Photo upload failed");
    }

    return data; // { ok, url, fullUrl }
  }

  function buildInitialUser(fallback) {
    const appState = window.appState || {};
    const localUser =
      fallback ||
      appState.currentUser ||
      appState.user ||
      { id: null, full_name: "Guest user", role: "GUEST", phone: "" };

    const fullName = localUser.full_name || localUser.name || "Guest user";
    return {
      ...localUser,
      full_name: fullName,
      name: fullName,
      email: localUser.email || "",
      role: (localUser.role || "GUEST").toUpperCase(),
      phone: localUser.phone || ""
    };
  }

  function getInitials(name) {
    if (!name) return "🙂";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function setCurrentUserGlobal(mappedUser) {
    // Update PetCareState for header + other pages
    try {
      if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
        window.PetCareState.setCurrentUser(mappedUser);
      }
    } catch (e) {
      console.warn("setCurrentUserGlobal failed:", e);
    }

    // Also mirror into window.appState so profile.js getCurrentUser fallback still works
    if (!window.appState) window.appState = {};
    window.appState.currentUser = mappedUser;

    if (typeof window.updateHeaderUser === "function") {
      window.updateHeaderUser();
    }
  }

  async function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    // Try to load from API first so refresh shows DB values
    let apiUser = await loadProfileFromApi();
    let user = buildInitialUser(apiUser ? mapApiUser(apiUser) : null);

    const fullName = user.full_name || user.name || "Guest user";
    const role = (user.role || "GUEST").toUpperCase();
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
              <div class="avatar-large ${user.avatar_url ? "has-photo" : ""}" id="profileAvatar"
                   style="${
                     user.avatar_url
                       ? `background-image: url('${user.avatar_url}');`
                       : ""
                   }">
                ${
                  user.avatar_url
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
    const form = root.querySelector("#profileForm");
    const saveBtn = root.querySelector("#profileSaveBtn");

    const nameInput = root.querySelector("#profileNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

    function openPhotoPicker() {
      if (photoInput) {
        photoInput.click();
      }
    }

    if (avatar) {
      avatar.addEventListener("click", openPhotoPicker);
      const cameraPill = avatar.querySelector(".avatar-camera-pill");
      if (cameraPill) {
        cameraPill.addEventListener("click", function (e) {
          e.stopPropagation();
          openPhotoPicker();
        });
      }
    }

    if (photoInput) {
      photoInput.addEventListener("change", async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          const result = await uploadProfilePhoto(file);
          const url = result.fullUrl || result.url;

          avatar.style.backgroundImage = `url('${url}')`;
          avatar.classList.add("has-photo");
          const initialsEl = avatar.querySelector(".avatar-initials");
          if (initialsEl) initialsEl.remove();

          // Also update global user
          const updatedUser = {
            ...user,
            avatar_url: result.url
          };
          const mapped = mapApiUser(updatedUser);
          setCurrentUserGlobal(mapped);
        } catch (err) {
          console.error(err);
          alert(err.message || "Photo upload failed");
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const newName = nameInput.value.trim();
        const newPhone = phoneInput.value.trim();

        try {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving...";

          const updatedApiUser = await saveProfileToApi({
            full_name: newName,
            phone: newPhone
          });

          const mapped = mapApiUser(updatedApiUser);
          user = mapped;

          summaryName.textContent = mapped.full_name || mapped.name;
          summaryPhone.textContent = mapped.phone || "—";

          setCurrentUserGlobal(mapped);

          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save changes";
          }, 1000);
        } catch (err) {
          console.error("Profile save error:", err);
          alert(err.message || "Server error");
          saveBtn.disabled = false;
          saveBtn.textContent = "Save changes";
        }
      });
    }

    const profileLogoutBtn = root.querySelector("#profileLogoutBtn");
    if (profileLogoutBtn && typeof window.doLogout === "function") {
      profileLogoutBtn.addEventListener("click", window.doLogout);
    }
  }

  window.renderProfilePage = renderProfilePage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();