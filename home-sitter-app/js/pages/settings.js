// js/pages/settings.js
// Settings page – simple 3-section layout (Account / Preferences / Notifications)

(function () {
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
      email: "",
      role: "guest",
      phone: ""
    };
  }

  function renderSettingsLayout(container) {
    const user = getCurrentUser();

    const first = user.first_name || "";
    const last = user.last_name || "";
    const displayName =
      first ||
      user.full_name ||
      user.name ||
      "Guest user";
    const email = user.email || "";
    const role = (user.role || "guest").toUpperCase();

    container.innerHTML = `
      <div class="settings-layout">
        <!-- LEFT: Account -->
        <div class="section-card settings-card">
          <div class="section-header">
            <h1>Account</h1>
            <p>Basic account info linked to your profile.</p>
          </div>

          <div class="settings-section-body">
            <div class="settings-field">
              <label>Name</label>
              <div class="settings-value">
                ${first && last ? `${first} ${last}` : displayName}
              </div>
            </div>

            <div class="settings-field">
              <label>Email</label>
              <div class="settings-value">${email || "—"}</div>
            </div>

            <div class="settings-field">
              <label>Role</label>
              <div class="settings-value">${role}</div>
            </div>

            <div class="settings-field">
              <label>Phone</label>
              <div class="settings-value">${user.phone || "—"}</div>
            </div>

            <button
              type="button"
              class="btn-secondary"
              data-page-jump="profilePage"
              style="margin-top: 16px;"
            >
              Manage profile
            </button>
          </div>
        </div>

        <!-- MIDDLE: Preferences -->
        <div class="section-card settings-card">
          <div class="section-header">
            <h2>Preferences</h2>
            <p>Customize how the app feels for you.</p>
          </div>

          <div class="settings-section-body">
            <div class="settings-toggle-row">
              <div>
                <div class="settings-toggle-title">Dark mode</div>
                <div class="settings-toggle-subtitle">
                  Visual only in this demo (no backend yet).
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settingsDarkModeToggle" disabled />
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-toggle-row">
              <div>
                <div class="settings-toggle-title">Show sitter hotspots on map</div>
                <div class="settings-toggle-subtitle">
                  Highlights high-activity sitter areas on the home map.
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settingsHotspotsToggle" checked />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- RIGHT: Notifications -->
        <div class="section-card settings-card">
          <div class="section-header">
            <h2>Notifications</h2>
            <p>Control when we ping you about pets and bookings.</p>
          </div>

          <div class="settings-section-body">
            <div class="settings-toggle-row">
              <div>
                <div class="settings-toggle-title">Booking updates</div>
                <div class="settings-toggle-subtitle">
                  New requests, changes, and cancellations.
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settingsBookingToggle" checked />
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-toggle-row">
              <div>
                <div class="settings-toggle-title">Messages</div>
                <div class="settings-toggle-subtitle">
                  When clients or sitters send you a new message.
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settingsMessagesToggle" checked />
                <span class="slider round"></span>
              </label>
            </div>

            <div class="settings-toggle-row">
              <div>
                <div class="settings-toggle-title">Promos & tips</div>
                <div class="settings-toggle-subtitle">
                  Occasional tips and product updates.
                </div>
              </div>
              <label class="switch">
                <input type="checkbox" id="settingsTipsToggle" />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function initSettingsPage() {
    // Try to find a good root to render into:
    const container =
      document.getElementById("settingsRoot") ||
      document.getElementById("settingsMainBody") ||
      document.getElementById("settingsPage");

    if (!container) return;

    renderSettingsLayout(container);
  }

  // expose for app.js
  window.initSettingsPage = initSettingsPage;

  // also render if user lands directly on settings
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSettingsPage);
  } else {
    initSettingsPage();
  }
})();
