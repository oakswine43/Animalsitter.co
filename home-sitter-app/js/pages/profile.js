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
    if (
      window.PetCareState &&
      typeof window.PetCareState.getCurrentUser === "function"
    ) {
      return window.PetCareState.getCurrentUser();
    }
    return {
      id: null,
      first_name: "",
      last_name: "",
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
    } else {
      if (!window.appState) window.appState = {};
      window.appState.currentUser = user;
    }

    if (typeof window.updateHeaderUser === "function") {
      window.updateHeaderUser();
    }
  }

  function getInitialsFromParts(firstName, lastName, fallbackFull) {
    const source =
      (firstName && `${firstName} ${lastName || ""}`.trim()) ||
      fallbackFull ||
      "";
    if (!source) return "🙂";
    const parts = source.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function applyAvatarFromUser(avatarEl, user) {
    if (!avatarEl || !user) return;

    const url = user.avatar_url || user.photo_url || "";
    const initialsEl = avatarEl.querySelector(".avatar-initials");

    if (url) {
      avatarEl.style.backgroundImage = `url('${url}')`;
      avatarEl.classList.add("has-photo");
      if (initialsEl) initialsEl.style.display = "none";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.classList.remove("has-photo");
      if (initialsEl) {
        initialsEl.textContent = getInitialsFromParts(
          user.first_name,
          user.last_name,
          user.full_name || user.name
        );
        initialsEl.style.display = "flex";
      }
    }
  }

  async function fetchProfileFromApi() {
    const token = getToken();
    if (!token) throw new Error("Not logged in.");

    const res = await fetch(`${getApiBase()}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.user) {
      throw new Error(data.error || "Failed to load profile.");
    }

    let apiUser = data.user;
    if (typeof window.PetCareMapApiUser === "function") {
      apiUser = window.PetCareMapApiUser(apiUser);
    }

    setCurrentUser(apiUser);
    return apiUser;
  }

  async function saveProfileToApi(firstName, lastName, phone) {
    const token = getToken();
    if (!token) throw new Error("Not logged in.");

    const fullName = `${firstName || ""} ${lastName || ""}`.trim();

    const res = await fetch(`${getApiBase()}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.user) {
      throw new Error(data.error || "Server error");
    }

    let apiUser = data.user;
    if (typeof window.PetCareMapApiUser === "function") {
      apiUser = window.PetCareMapApiUser(apiUser);
    }

    setCurrentUser(apiUser);
    return apiUser;
  }

  async function uploadPhoto(file) {
    const token = getToken();
    if (!token) throw new Error("Not logged in.");

    const fd = new FormData();
    fd.append("photo", file);

    const res = await fetch(`${getApiBase()}/profile/photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: fd
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to upload profile photo.");
    }

    const updatedUser = await fetchProfileFromApi();
    return { upload: data, user: updatedUser };
  }

  function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    const user = getCurrentUser();

    const firstName = user.first_name || "";
    const lastName = user.last_name || "";
    const fullName =
      user.full_name ||
      `${firstName} ${lastName}`.trim() ||
      "Guest user";
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
                <span class="avatar-initials">
                  ${getInitialsFromParts(firstName, lastName, fullName)}
                </span>
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
                    <span>First name</span>
                    <input
                      type="text"
                      id="profileFirstNameInput"
                      class="input"
                      value="${firstName}"
                    />
                  </label>
                  <label>
                    <span>Last name</span>
                    <input
                      type="text"
                      id="profileLastNameInput"
                      class="input"
                      value="${lastName}"
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

    const firstNameInput = root.querySelector("#profileFirstNameInput");
    const lastNameInput = root.querySelector("#profileLastNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

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
          const { user: updatedUser } = await uploadPhoto(file);
          applyAvatarFromUser(avatar, updatedUser);
        } catch (err) {
          console.error("Photo upload error:", err);
          alert(err.message || "Failed to upload photo.");
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const newFirst = (firstNameInput.value || "").trim();
        const newLast = (lastNameInput.value || "").trim();
        const newPhone = (phoneInput.value || "").trim();

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saving...";

        try {
          const updatedUser = await saveProfileToApi(newFirst, newLast, newPhone);

          const updatedFull =
            updatedUser.full_name ||
            `${updatedUser.first_name || ""} ${updatedUser.last_name || ""}`.trim();

          summaryName.textContent = updatedFull || "—";
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

    const profileLogoutBtn = root.querySelector("#profileLogoutBtn");
    if (profileLogoutBtn) {
      profileLogoutBtn.addEventListener("click", function () {
        if (typeof window.doLogout === "function") {
          window.doLogout();
        }
      });
    }
  }

  window.renderProfilePage = renderProfilePage;
  window.initProfilePage = function () {
    renderProfilePage();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();