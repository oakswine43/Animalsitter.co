// js/pages/profile.js
// Full layout + logic for the Profile page
// Left: account overview + photo
// Right: edit form
// Bottom: basic info + info/history

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

  // ---------- UI layout ----------
  function renderProfileLayout(root) {
    root.innerHTML = `
      <div class="profile-layout">
        <!-- TOP: overview + edit -->
        <div class="profile-main-row">
          <!-- LEFT: overview -->
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

          <!-- RIGHT: edit -->
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

        <!-- BOTTOM: basic info + history -->
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

  // ---------- API calls ----------
  async function fetchProfile() {
    try {
      clearError();
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

      const apiUser = data.user || window.PetCareState?.getCurrentUser?.();
      const user = window.PetCareMapApiUser
        ? window.PetCareMapApiUser(apiUser)
        : apiUser;

      if (user && data.user && window.PetCareState?.setCurrentUser) {
        window.PetCareState.setCurrentUser(user);
      }

      return user;
    } catch (err) {
      console.error("[PROFILE] GET error", err);
      showError("Failed to load profile.");
      return null;
    }
  }

  async function saveProfile(payload) {
    try {
      clearError();
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

      const user = window.PetCareMapApiUser
        ? window.PetCareMapApiUser(data.user)
        : data.user;

      if (user && window.PetCareState?.setCurrentUser) {
        window.PetCareState.setCurrentUser(user);
      }

      if (window.updateHeaderUser) window.updateHeaderUser();

      return user;
    } catch (err) {
      console.error("[PROFILE] PUT error", err);
      showError("Failed to update profile.");
      return null;
    }
  }

  async function uploadPhoto(file) {
    try {
      clearError();
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch(`${API_BASE}/profile/photo`, {
        method: "POST",
        headers: {
          ...getAuthHeaders()
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

  // ---------- init + wiring ----------
  async function initProfilePage() {
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

    // 1) Load user
    const user = await fetchProfile();
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
      }
    } else {
      basicInfo.innerHTML = `
        <p class="text-muted">No user loaded. Try logging in again.</p>
      `;
    }

    // 2) Save form
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
      changePhotoBtn.addEventListener("click", () => photoInput.click());

      photoInput.addEventListener("change", async () => {
        if (!photoInput.files || !photoInput.files[0]) return;
        const url = await uploadPhoto(photoInput.files[0]);
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

  // make available to app.js
  window.initProfilePage = initProfilePage;
})();
