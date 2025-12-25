// js/pages/profile.js
// Profile page wired to real backend (/profile, /profile/photo)

(function () {
  const TOKEN_KEY = "petcare_token";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (_) {
      return null;
    }
  }

  function getApiBase() {
    return window.API_BASE || window.PETCARE_API_BASE || "";
  }

  function getCurrentUser() {
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      return window.PetCareState.getCurrentUser();
    }
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
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      window.PetCareState.setCurrentUser(user);
    } else {
      // fallback to legacy appState
      if (!window.appState) window.appState = {};
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

  // Make sure avatar URL is absolute (prefix API_BASE if it starts with "/")
  function normalizeAvatarUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${getApiBase()}${url}`;
    return url;
  }

  function applyAvatarFromUser(avatarEl, user) {
    if (!avatarEl || !user) return;

    let url = user.avatar_url || user.photo_url;
    url = normalizeAvatarUrl(url);

    const initialsEl = avatarEl.querySelector(".avatar-initials");
    const displayName = user.full_name || user.name;

    if (url) {
      avatarEl.style.backgroundImage = `url('${url}')`;
      avatarEl.classList.add("has-photo");
      if (initialsEl) initialsEl.style.display = "none";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.classList.remove("has-photo");
      if (initialsEl) {
        initialsEl.textContent = getInitials(displayName);
        initialsEl.style.display = "flex";
      }
    }
  }

  async function saveProfileToApi(fullName, phone) {
    const token = getToken();
    if (!token) {
      throw new Error("Not logged in.");
    }

    const res = await fetch(`${getApiBase()}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        full_name: fullName,
        phone
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Server error");
    }

    const apiUser = data.user;
    if (!apiUser) {
      throw new Error("Bad response from server.");
    }

    // Normalize via shared mapper if present
    let mapped = apiUser;
    if (typeof window.PetCareMapApiUser === "function") {
      mapped = window.PetCareMapApiUser(apiUser);
    } else {
      const full_name2 = apiUser.full_name || apiUser.name || "";
      mapped = {
        id: apiUser.id,
        name: full_name2,
        full_name: full_name2,
        email: apiUser.email || "",
        role: apiUser.role || "client",
        phone: apiUser.phone || "",
        avatar_url: normalizeAvatarUrl(apiUser.avatar_url || apiUser.photo_url || null),
        photo_url: normalizeAvatarUrl(apiUser.photo_url || apiUser.avatar_url || null),
        is_active: apiUser.is_active
      };
    }

    // ensure avatar urls normalized even if mapper didn't
    mapped.avatar_url = normalizeAvatarUrl(mapped.avatar_url || mapped.photo_url);
    mapped.photo_url = mapped.avatar_url || mapped.photo_url;

    setCurrentUser(mapped);
    return mapped;
  }

  async function uploadPhoto(file) {
    const token = getToken();
    if (!token) {
      throw new Error("Not logged in.");
    }

    const fd = new FormData();
    fd.append("photo", file);

    const res = await fetch(`${getApiBase()}/profile/photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
        // do NOT set Content-Type manually for FormData
      },
      body: fd
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to upload profile photo.");
    }

    // data.url is the /uploads/... path; data.fullUrl may be a full URL
    let url = data.fullUrl || data.url || null;
    url = normalizeAvatarUrl(url);

    // Update the current user in state so refresh of profile UI uses new avatar
    const current = getCurrentUser() || {};
    const updated = {
      ...current,
      avatar_url: url,
      photo_url: url
    };
    setCurrentUser(updated);

    return { ...data, normalizedUrl: url };
  }

  function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    const user = getCurrentUser();
    const fullName = user.full_name || user.name || "Guest user";
    const role = (user.role || "guest").toUpperCase();
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

    const avatar = root.querySelector("#profileAvatar");
    const photoInput = root.querySelector("#profilePhotoInput");
    const form = root.querySelector("#profileForm");
    const saveBtn = root.querySelector("#profileSaveBtn");

    const nameInput = root.querySelector("#profileNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

    // Apply existing avatar (from DB / currentUser) if present
    applyAvatarFromUser(avatar, user);

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
      photoInput.addEventListener("change", async function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Show local preview immediately
        const reader = new FileReader();
        reader.onload = function (ev) {
          const dataUrl = ev.target.result;
          avatar.style.backgroundImage = `url('${dataUrl}')`;
          avatar.classList.add("has-photo");
          const initialsEl = avatar.querySelector(".avatar-initials");
          if (initialsEl) initialsEl.style.display = "none";
        };
        reader.readAsDataURL(file);

        try {
          await uploadPhoto(file);
        } catch (err) {
          console.error("Photo upload error:", err);
          alert(err.message || "Failed to upload photo.");
        } finally {
          // allow reselecting same file if needed
          e.target.value = "";
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const newName = (nameInput.value || "").trim() || fullName;
        const newPhone = (phoneInput.value || "").trim();

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saving...";

        try {
          const updatedUser = await saveProfileToApi(newName, newPhone);

          summaryName.textContent =
            updatedUser.full_name || updatedUser.name || newName;
          summaryPhone.textContent = updatedUser.phone || "—";

          saveBtn.textContent = "Saved";
          setTimeout(() => {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
          }, 1200);
        } catch (err) {
          console.error("Profile save error:", err);
          alert(err.message || "Server error");
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
        }
      });
    }

    // Logout button (handled globally too, but wire it here)
    const profileLogoutBtn = root.querySelector("#profileLogoutBtn");
    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener("click", function () {
        if (typeof window.doLogout === "function") {
          window.doLogout();
        }
      });
    }
  }

  // expose so app.js can call when navigating
  window.renderProfilePage = renderProfilePage;
  window.initProfilePage = function () {
    renderProfilePage();
  };

  // also render once on load in case profile is the first page opened
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();