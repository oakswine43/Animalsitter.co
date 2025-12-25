// home-sitter-app/js/pages/profile.js

(function () {
  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "";

  function getCurrentUser() {
    // Prefer PetCareState (what authPage/app.js use)
    if (window.PetCareState && typeof window.PetCareState.getCurrentUser === "function") {
      return window.PetCareState.getCurrentUser();
    }

    // Fallback to appState if present
    const appState = window.appState || {};
    return (
      appState.currentUser ||
      appState.user || {
        id: null,
        full_name: "Guest user",
        role: "guest",
        phone: "000-000-0000",
        email: "",
      }
    );
  }

  function setCurrentUser(user) {
    if (window.PetCareState && typeof window.PetCareState.setCurrentUser === "function") {
      window.PetCareState.setCurrentUser(user);
    } else {
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

  async function uploadProfilePhoto(file, avatarEl, user) {
    if (!API_BASE) {
      console.warn("No API_BASE configured, cannot upload photo.");
      return;
    }

    const token = localStorage.getItem("petcare_token");
    if (!token) {
      console.warn("No auth token found, cannot upload photo.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    try {
      const res = await fetch(`${API_BASE}/profile/photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: do NOT set Content-Type manually; browser will set multipart boundary
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to upload photo.");
      }

      const photoUrl = data.url || data.fullUrl;

      // Update avatar background to the saved URL
      if (photoUrl && avatarEl) {
        avatarEl.style.backgroundImage = `url('${photoUrl}')`;
        avatarEl.classList.add("has-photo");
      }

      // Update current user in state so header + profile use it after refresh
      const updatedUser = {
        ...user,
        avatar_url: photoUrl,
        photo_url: photoUrl,
      };
      setCurrentUser(updatedUser);
    } catch (err) {
      console.error("Photo upload error:", err);
      alert(err.message || "Failed to upload profile photo.");
    }
  }

  function renderProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    const user = getCurrentUser();
    const fullName = user.full_name || user.name || "Guest user";
    const role = (user.role || "guest").toUpperCase();
    const phone = user.phone || "";
    const email = user.email || "";
    const photoUrl = user.avatar_url || user.photo_url || null;

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

    // ---- wires & interactions ----
    const photoInput = root.querySelector("#profilePhotoInput");
    const avatar = root.querySelector("#profileAvatar");
    const form = root.querySelector("#profileForm");
    const saveBtn = root.querySelector("#profileSaveBtn");

    const nameInput = root.querySelector("#profileNameInput");
    const phoneInput = root.querySelector("#profilePhoneInput");

    const summaryName = root.querySelector("#profileSummaryName");
    const summaryRole = root.querySelector("#profileSummaryRole");
    const summaryPhone = root.querySelector("#profileSummaryPhone");

    // If user already has a photo, show it
    if (photoUrl && avatar) {
      avatar.style.backgroundImage = `url('${photoUrl}')`;
      avatar.classList.add("has-photo");
    }

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

        // Local preview immediately
        const reader = new FileReader();
        reader.onload = function (ev) {
          if (avatar) {
            avatar.style.backgroundImage = `url('${ev.target.result}')`;
            avatar.classList.add("has-photo");
          }
        };
        reader.readAsDataURL(file);

        // Upload to backend to persist
        uploadProfilePhoto(file, avatar, user);
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const token = localStorage.getItem("petcare_token");
        if (!API_BASE || !token) {
          console.warn("No API_BASE or auth token; saving only locally.");
        }

        const updatedName = nameInput.value.trim() || fullName;
        const updatedPhone = phoneInput.value.trim();

        // Optimistically update UI + state
        const updatedUser = {
          ...user,
          full_name: updatedName,
          name: updatedName,
          phone: updatedPhone,
        };
        setCurrentUser(updatedUser);

        summaryName.textContent = updatedUser.full_name;
        summaryRole.textContent = (updatedUser.role || role).toUpperCase();
        summaryPhone.textContent = updatedUser.phone || "—";

        // Save to backend
        if (API_BASE && token && user && user.id) {
          try {
            const res = await fetch(`${API_BASE}/profile`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: updatedName,
                phone: updatedPhone,
              }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
              throw new Error(data.error || "Failed to update profile.");
            }

            // Merge any canonical values from backend (e.g., trimmed phone)
            const serverUser = data.user || {};
            const mergedUser = {
              ...updatedUser,
              full_name: serverUser.full_name || updatedUser.full_name,
              phone: serverUser.phone ?? updatedUser.phone,
              avatar_url: serverUser.avatar_url || updatedUser.avatar_url,
              photo_url: serverUser.photo_url || updatedUser.photo_url,
            };
            setCurrentUser(mergedUser);
          } catch (err) {
            console.error("Profile save error:", err);
            alert(err.message || "Failed to save profile.");
          }
        }

        saveBtn.disabled = true;
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saved";

        setTimeout(() => {
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
        }, 1200);
      });
    }

    // Logout button (profile page)
    const profileLogoutBtn = root.querySelector("#profileLogoutBtn");
    if (profileLogoutBtn && typeof window.doLogout === "function") {
      profileLogoutBtn.addEventListener("click", window.doLogout);
    }
  }

  // expose so app.js can call when navigating
  window.renderProfilePage = renderProfilePage;
  window.initProfilePage = renderProfilePage;

  // also render once on load in case profile is the first page opened
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderProfilePage);
  } else {
    renderProfilePage();
  }
})();