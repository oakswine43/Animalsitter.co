// js/pages/profileShared.js
// Shared helpers + renderer for the profile page
// Layout: left = account overview + photo, right = edit form,
// bottom = basic info + info & history.

(function () {
  const API_BASE = window.API_BASE || "http://localhost:4000";

  function getAuthHeaders() {
    const token = localStorage.getItem("petcare_token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function showError(msg) {
    const banner = document.getElementById("profileErrorBanner");
    if (!banner) return;
    banner.textContent = msg;
    banner.style.display = "block";
  }

  function clearError() {
    const banner = document.getElementById("profileErrorBanner");
    if (!banner) return;
    banner.textContent = "";
    banner.style.display = "none";
  }

  // -----------------------------
  // Build the UI skeleton
  // -----------------------------
  function renderProfileLayout(root) {
    root.innerHTML = `
      <div class="profile-layout">
        <!-- TOP ROW: overview + edit -->
        <div class="profile-main-row">
          <!-- LEFT: ACCOUNT OVERVIEW -->
          <div class="profile-card account-overview-card">
            <div class="profile-card-header">
              <span class="status-dot status-online"></span>
              <span>Account overview</span>
            </div>

            <div class="profile-photo-box" id="profilePhotoBox"></div>

            <button type="button" class="btn-secondary" id="changePhotoBtn">
              Change photo
            </button>
            <input type="file" id="profilePhotoInput" accept="image/*" style="display:none;" />
          </div>

          <!-- RIGHT: EDIT -->
          <div class="profile-card profile-edit-card">
            <div class="profile-header-row">
              <div>
                <div id="profileDisplayName" class="profile-display-name">
                  your name
                </div>
                <div class="profile-header-subtitle">
                  Update your basic account details. More fields can be added later.
                </div>
              </div>
              <span id="profileRolePill" class="role-pill">USER</span>
            </div>

            <div id="profileErrorBanner" class="profile-error-banner" style="display:none;"></div>

            <form id="profileForm" class="profile-form">
              <label class="profile-field">
                <span>Full name</span>
                <input type="text" id="profileNameInput" class="input" />
              </label>

              <label class="profile-field">
                <span>Phone</span>
                <input type="text" id="profilePhoneInput" class="input" />
              </label>

              <button type="submit" class="btn-primary" id="profileSaveBtn">
                Save changes
              </button>
            </form>
          </div>
        </div>

        <!-- BOTTOM ROW: basic info + history -->
        <div class="profile-main-row profile-main-row-bottom">
          <div class="profile-card">
            <h3 class="profile-card-title">Basic info</h3>
            <div id="profileBasicInfo" class="profile-basic-info"></div>
          </div>

          <div class="profile-card">
            <h3 class="profile-card-title">Info &amp; history</h3>
            <p class="text-muted">
              Later this can show a short bio, booking history, and notes.
              For now this is just a display area.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // -----------------------------
  // Load profile data from backend
  // -----------------------------
  async function loadProfileData() {
    try {
      clearError();
      console.log("[PROFILE] GET", `${API_BASE}/profile`);

      const res = await fetch(`${API_BASE}/profile`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        }
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.user) {
        console.warn("[PROFILE] GET failed", res.status, data);
        showError(`Failed to load profile: Status ${res.status}`);
      }

      // fall back to local state if server didn't return anything
      const apiUser = data.user || window.PetCareState?.getCurrentUser?.();
      const user = window.PetCareMapApiUser(apiUser);

      if (!user) return null;

      // Update global state if we did get fresh user
      if (data.user && window.PetCareState?.setCurrentUser) {
        window.PetCareState.setCurrentUser(user);
      }

      return user;
    } catch (err) {
      console.error("[PROFILE] GET error", err);
      showError("Failed to load profile.");
      return null;
    }
  }

  // -----------------------------
  // Save profile (name + phone)
  // -----------------------------
  async function saveProfile(payload) {
    try {
      clearError();
      console.log("[PROFILE] PUT", `${API_BASE}/profile`, payload);

      const res = await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.user) {
        console.warn("[PROFILE] PUT failed", res.status, data);
        showError(`Failed to update profile: Status ${res.status}`);
        return null;
      }

      const user = window.PetCareMapApiUser(data.user);
      if (user && window.PetCareState?.setCurrentUser) {
        window.PetCareState.setCurrentUser(user);
      }
      return user;
    } catch (err) {
      console.error("[PROFILE] PUT error", err);
      showError("Failed to update profile.");
      return null;
    }
  }

  // -----------------------------
  // Upload photo
  // -----------------------------
  async function uploadProfilePhoto(file) {
    try {
      clearError();
      const formData = new FormData();
      formData.append("photo", file);

      console.log("[PROFILE] POST", `${API_BASE}/profile/photo`);

      const res = await fetch(`${API_BASE}/profile/photo`, {
        method: "POST",
        headers: {
          ...getAuthHeaders()
          // don't set Content-Type, browser will add boundary
        },
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.fullUrl) {
        console.warn("[PROFILE] PHOTO failed", res.status, data);
        showError(`Failed to upload profile photo (Status ${res.status}).`);
        return null;
      }

      return data.fullUrl;
    } catch (err) {
      console.error("[PROFILE] PHOTO error", err);
      showError("Failed to upload profile photo.");
      return null;
    }
  }

  // -----------------------------
  // Main entry: build UI + wire events
  // -----------------------------
  async function loadProfileIntoUI() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    renderProfileLayout(root);

    const photoBox = document.getElementById("profilePhotoBox");
    const changePhotoBtn = document.getElementById("changePhotoBtn");
    const photoInput = document.getElementById("profilePhotoInput");

    const displayNameEl = document.getElementById("profileDisplayName");
    const rolePillEl = document.getElementById("profileRolePill");
    const nameInput = document.getElementById("profileNameInput");
    const phoneInput = document.getElementById("profilePhoneInput");
    const basicInfo = document.getElementById("profileBasicInfo");
    const form = document.getElementById("profileForm");

    // 1) Load initial data
    const user = await loadProfileData();
    if (user) {
      displayNameEl.textContent = user.name || "your name";
      rolePillEl.textContent = (user.role || "USER").toUpperCase();
      nameInput.value = user.name || "";
      phoneInput.value = user.phone || "";
      basicInfo.innerHTML = `
        <div><strong>Name:</strong> ${user.name || "Your name"}</div>
        <div><strong>Role:</strong> ${(user.role || "user").toUpperCase()}</div>
        <div><strong>Phone:</strong> ${user.phone || "Not set"}</div>
      `;

      if (user.photo_url || user.avatar_url) {
        photoBox.style.backgroundImage =
          `url(${user.photo_url || user.avatar_url})`;
      } else {
        photoBox.style.backgroundImage = "none";
      }
    } else {
      basicInfo.innerHTML = `
        <p class="text-muted">No user loaded. Try logging in again.</p>
      `;
    }

    // 2) Save changes
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const newUser = await saveProfile({
          name: nameInput.value.trim(),
          phone: phoneInput.value.trim()
        });

        if (!newUser) return;

        displayNameEl.textContent = newUser.name || "your name";
        basicInfo.innerHTML = `
          <div><strong>Name:</strong> ${newUser.name || "Your name"}</div>
          <div><strong>Role:</strong> ${(newUser.role || "user").toUpperCase()}</div>
          <div><strong>Phone:</strong> ${newUser.phone || "Not set"}</div>
        `;
      });
    }

    // 3) Change photo
    if (changePhotoBtn && photoInput) {
      changePhotoBtn.addEventListener("click", () => {
        photoInput.click();
      });

      photoInput.addEventListener("change", async () => {
        if (!photoInput.files || !photoInput.files[0]) return;

        const url = await uploadProfilePhoto(photoInput.files[0]);
        if (!url) {
          photoInput.value = "";
          return;
        }

        photoBox.style.backgroundImage = `url(${url})`;

        const cur = window.PetCareState?.getCurrentUser?.();
        if (cur && window.PetCareState?.setCurrentUser) {
          window.PetCareState.setCurrentUser({
            ...cur,
            photo_url: url,
            avatar_url: url
          });
        }

        photoInput.value = "";
      });
    }
  }

  // expose for profile.js
  window.PetCareProfile = { loadProfileIntoUI };
})();
