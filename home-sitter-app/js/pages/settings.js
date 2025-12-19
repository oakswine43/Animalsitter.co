// js/pages/settings.js
// Settings page: right-side menu controls the left "Account" card

(function () {
  function getState() {
    return window.PetCareState || null;
  }

  // Views shown in the LEFT card
  const SETTINGS_VIEWS = {
    profile_photo: {
      title: "Change profile photo",
      description:
        "Upload a new photo so people can recognize you in bookings and messages.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>New profile photo</span>
              <input type="file" class="input" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save photo (demo)</button>
          </div>
        </form>
      `,
    },

    profile_name: {
      title: "Update your name",
      description: "Change how your name appears to clients, sitters, and staff.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group">
            <label>
              <span>First name</span>
              <input type="text" class="input" placeholder="First name" />
            </label>
          </div>
          <div class="field-group">
            <label>
              <span>Last name</span>
              <input type="text" class="input" placeholder="Last name" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save name (demo)</button>
          </div>
        </form>
      `,
    },

    profile_email: {
      title: "Update email",
      description:
        "This is where we send booking confirmations, receipts, and account alerts.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>New email</span>
              <input type="email" class="input" placeholder="you@example.com" />
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>Confirm password (for security)</span>
              <input type="password" class="input" placeholder="••••••••" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save email (demo)</button>
          </div>
        </form>
      `,
    },

    profile_phone: {
      title: "Update phone number",
      description:
        "We use your phone number for urgent updates and sitter contact.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Phone number</span>
              <input type="tel" class="input" placeholder="(555) 555-5555" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save phone (demo)</button>
          </div>
        </form>
      `,
    },

    profile_address: {
      title: "Update address",
      description:
        "Your address helps sitters know where they’re going for overnights and drop-ins.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Street address</span>
              <input type="text" class="input" placeholder="Street" />
            </label>
          </div>
          <div class="field-group">
            <label>
              <span>City</span>
              <input type="text" class="input" placeholder="City" />
            </label>
          </div>
          <div class="field-group">
            <label>
              <span>State</span>
              <input type="text" class="input" placeholder="State" />
            </label>
          </div>
          <div class="field-group">
            <label>
              <span>ZIP</span>
              <input type="text" class="input" placeholder="ZIP" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save address (demo)</button>
          </div>
        </form>
      `,
    },

    profile_bio: {
      title: "Update sitter bio",
      description:
        "Especially for sitters: share your experience, training, and what makes you different.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Short bio</span>
              <textarea
                rows="4"
                class="input"
                placeholder="Tell clients about your dog experience, schedule, and home setup."
              ></textarea>
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save bio (demo)</button>
          </div>
        </form>
      `,
    },

    profile_emergency: {
      title: "Update emergency contact",
      description:
        "Optional, but recommended so sitters know who to reach in an emergency.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group">
            <label>
              <span>Contact name</span>
              <input type="text" class="input" placeholder="Name" />
            </label>
          </div>
          <div class="field-group">
            <label>
              <span>Relationship</span>
              <input type="text" class="input" placeholder="Friend, parent, etc." />
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>Phone number</span>
              <input type="tel" class="input" placeholder="(555) 555-5555" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save contact (demo)</button>
          </div>
        </form>
      `,
    },

    login_password: {
      title: "Change password",
      description:
        "Use a strong password you don’t reuse on other websites (demo only).",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Current password</span>
              <input type="password" class="input" placeholder="Current password" />
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>New password</span>
              <input type="password" class="input" placeholder="New password" />
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>Confirm new password</span>
              <input type="password" class="input" placeholder="Repeat new password" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Update password (demo)</button>
          </div>
        </form>
      `,
    },

    login_2fa: {
      title: "Enable 2-factor authentication",
      description:
        "Add an extra layer of security by requiring a code from your phone.",
      body: `
        <p class="text-muted" style="font-size:13px; margin-bottom:8px;">
          In a real app, this is where you’d scan a QR code with an authenticator app
          or confirm your phone number. This demo only shows the layout.
        </p>
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Phone number</span>
              <input type="tel" class="input" placeholder="(555) 555-5555" />
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Turn on 2FA (demo)</button>
          </div>
        </form>
      `,
    },

    notify_push: {
      title: "Push notifications",
      description:
        "Turn mobile / browser push notifications on or off for this account.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" checked />
              <span>Enable push notifications on this device</span>
            </label>
          </div>
          <p class="text-muted" style="font-size:12px; margin-top:4px;">
            In a real app, this would ask the browser or app for notification permission.
          </p>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save (demo)</button>
          </div>
        </form>
      `,
    },

    notify_email: {
      title: "Email notifications",
      description: "Control which emails we send you.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" checked />
              <span>Bookings &amp; schedule changes</span>
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" checked />
              <span>Messages &amp; updates from sitters/clients</span>
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" />
              <span>Product news &amp; occasional tips</span>
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save (demo)</button>
          </div>
        </form>
      `,
    },

    notify_sms: {
      title: "SMS updates",
      description: "Choose whether we text you about important activity.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" />
              <span>Send me SMS updates for time-sensitive changes (demo)</span>
            </label>
          </div>
          <p class="text-muted" style="font-size:12px; margin-top:4px;">
            Carrier rates may apply in a real app.
          </p>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save (demo)</button>
          </div>
        </form>
      `,
    },

    notify_prefs: {
      title: "Notification preferences",
      description:
        "Fine-tune what you hear about bookings, messages, payments, and alerts.",
      body: `
        <form class="form-grid" autocomplete="off">
          <div class="field-group form-grid-full">
            <label>
              <span>Booking alerts</span>
              <select class="input">
                <option>Push + email</option>
                <option>Push only</option>
                <option>Email only</option>
                <option>Off</option>
              </select>
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>Message alerts</span>
              <select class="input">
                <option>Push + email</option>
                <option>Push only</option>
                <option>Email only</option>
                <option>Off</option>
              </select>
            </label>
          </div>
          <div class="field-group form-grid-full">
            <label>
              <span>Payment / payout alerts</span>
              <select class="input">
                <option>Push + email</option>
                <option>Email only</option>
                <option>Off</option>
              </select>
            </label>
          </div>
          <div class="form-grid-full" style="margin-top:8px;">
            <button type="button" class="btn-primary">Save (demo)</button>
          </div>
        </form>
      `,
    },
  };

  // -------------- rendering helpers --------------

  function renderMainView(viewKey) {
    const titleEl = document.getElementById("settingsMainTitle");
    const bodyEl = document.getElementById("settingsMainBody");
    if (!titleEl || !bodyEl) return;

    const view = SETTINGS_VIEWS[viewKey];

    if (!view) {
      titleEl.textContent = "Account";
      bodyEl.innerHTML = `
        <p class="text-muted">
          Select an item on the right (change profile, change password, notifications, etc.)
          to edit those settings here.
        </p>
      `;
      return;
    }

    titleEl.textContent = view.title;
    bodyEl.innerHTML = `
      <p class="text-muted" style="margin-bottom:8px;">
        ${view.description || ""}
      </p>
      ${view.body || ""}
    `;
  }

  function buildRightCard() {
    const card = document.getElementById("settingsRoleCard");
    if (!card) return;

    const state = getState();
    const user =
      state && typeof state.getCurrentUser === "function"
        ? state.getCurrentUser()
        : null;
    const roleLabel = user ? (user.roleLabel || user.role || "User") : "User";

    card.innerHTML = `
      <h2>${roleLabel} settings</h2>

      <ol class="settings-section-list" style="padding-left:16px; font-size:13px;">
        <li style="margin-bottom:10px;">
          <h3>1. Profile Settings</h3>
          <div class="settings-actions" style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
            <button type="button" class="btn-small" data-settings-action="profile_photo">Change profile photo</button>
            <button type="button" class="btn-small" data-settings-action="profile_name">Update name</button>
            <button type="button" class="btn-small" data-settings-action="profile_email">Update email</button>
            <button type="button" class="btn-small" data-settings-action="profile_phone">Update phone number</button>
            <button type="button" class="btn-small" data-settings-action="profile_address">Update address</button>
            <button type="button" class="btn-small" data-settings-action="profile_bio">Update bio (for sitters especially)</button>
            <button type="button" class="btn-small" data-settings-action="profile_emergency">Update emergency contact (optional)</button>
          </div>
        </li>

        <li style="margin-bottom:10px;">
          <h3>2. Login &amp; Security</h3>
          <div class="settings-actions" style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
            <button type="button" class="btn-small" data-settings-action="login_password">Change password</button>
            <button type="button" class="btn-small" data-settings-action="login_2fa">Enable 2-factor authentication</button>
            <button type="button" class="btn-small" data-settings-action="login_devices">See logged-in devices (demo only)</button>
            <button type="button" class="btn-small" data-settings-action="login_logout_all">Log out of all devices (demo)</button>
            <button type="button" class="btn-small" data-settings-action="login_delete">Delete or deactivate account (demo)</button>
          </div>
        </li>

        <li>
          <h3>3. Notification Settings</h3>
          <div class="settings-actions" style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
            <button type="button" class="btn-small" data-settings-action="notify_push">Push notifications (on/off)</button>
            <button type="button" class="btn-small" data-settings-action="notify_email">Email notifications (on/off)</button>
            <button type="button" class="btn-small" data-settings-action="notify_sms">SMS updates (on/off)</button>
            <button type="button" class="btn-small" data-settings-action="notify_prefs">Preferences for bookings, messages, payments, alerts</button>
          </div>
        </li>
      </ol>
    `;
  }

  // -------------- page init --------------

  window.initSettingsPage = function () {
    buildRightCard();
    renderMainView(null); // default text

    const card = document.getElementById("settingsRoleCard");
    if (!card) return;

    // When you click any button on the right, load its view into the left card
    card.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-action]");
      if (!btn) return;
      const key = btn.getAttribute("data-settings-action");
      renderMainView(key);
    });
  };
})();
