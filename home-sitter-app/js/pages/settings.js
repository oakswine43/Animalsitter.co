// js/pages/settings.js
// Settings page: left nav, right content (like your screenshot)

(function () {
  function getState() {
    return window.PetCareState || null;
  }

  // ------------- VIEWS SHOWN ON THE RIGHT -------------
  const SETTINGS_VIEWS = {
    profile_photo: {
      title: "Profile photo",
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
      title: "Name",
      description:
        "Change how your name appears to clients, sitters, and staff.",
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
      title: "Email",
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
      title: "Phone number",
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
      title: "Address",
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
      title: "Sitter bio",
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
      title: "Emergency contact",
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
      title: "Password",
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
      title: "Two-factor authentication",
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
  };

  // Left-nav structure (what appears in the list)
  const SETTINGS_GROUPS = [
    {
      heading: "Profile",
      items: [
        { key: "profile_photo", label: "Profile photo" },
        { key: "profile_name", label: "Name" },
        { key: "profile_email", label: "Email" },
        { key: "profile_phone", label: "Phone number" },
        { key: "profile_address", label: "Address" },
        { key: "profile_bio", label: "Sitter bio" },
        { key: "profile_emergency", label: "Emergency contact" },
      ],
    },
    {
      heading: "Login & Security",
      items: [
        { key: "login_password", label: "Password" },
        { key: "login_2fa", label: "Two-factor authentication" },
      ],
    },
    {
      heading: "Notifications",
      items: [
        { key: "notify_push", label: "Push notifications" },
        { key: "notify_email", label: "Email notifications" },
        { key: "notify_sms", label: "SMS updates" },
      ],
    },
  ];

  // -------------- rendering helpers --------------

  function renderMainView(viewKey) {
    const titleEl = document.getElementById("settingsContentTitle");
    const bodyEl = document.getElementById("settingsContentBody");
    if (!titleEl || !bodyEl) return;

    const view = viewKey ? SETTINGS_VIEWS[viewKey] : null;

    if (!view) {
      titleEl.textContent = "Account settings";
      bodyEl.innerHTML = `
        <p class="text-muted">
          Choose a setting on the left to manage your profile, security, or notifications.
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

    // highlight active nav item
    const nav = document.getElementById("settingsNavCard");
    if (!nav) return;
    const buttons = nav.querySelectorAll("[data-settings-key]");
    buttons.forEach((btn) => {
      const key = btn.getAttribute("data-settings-key");
      btn.classList.toggle("settings-nav-item-active", key === viewKey);
    });
  }

  function buildLeftNav() {
    const navCard = document.getElementById("settingsNavCard");
    const navList = document.getElementById("settingsNavList");
    if (!navCard || !navList) return;

    const state = getState();
    const user =
      state && typeof state.getCurrentUser === "function"
        ? state.getCurrentUser()
        : null;

    const displayName =
      (user && (user.name || user.full_name || user.email)) || "Your account";

    // Top header in nav
    navCard.querySelector(".settings-nav-header").innerHTML = `
      <div class="settings-nav-initial-circle">
        ${displayName.charAt(0).toUpperCase()}
      </div>
      <div class="settings-nav-user">
        <div class="settings-nav-name">${displayName}</div>
        <div class="settings-nav-role small text-muted">${
          user?.role ? user.role.toUpperCase() : "GUEST"
        }</div>
      </div>
    `;

    // Grouped list
    navList.innerHTML = SETTINGS_GROUPS.map(
      (group) => `
      <li class="settings-nav-section">
        <div class="settings-nav-heading">${group.heading}</div>
        <ul class="settings-nav-items">
          ${group.items
            .map(
              (item) => `
            <li>
              <button
                type="button"
                class="settings-nav-item"
                data-settings-key="${item.key}"
              >
                ${item.label}
              </button>
            </li>
          `
            )
            .join("")}
        </ul>
      </li>
    `
    ).join("");
  }

  // -------------- page init --------------

  window.initSettingsPage = function () {
    buildLeftNav();
    renderMainView(null); // default intro text

    const navCard = document.getElementById("settingsNavCard");
    if (!navCard) return;

    // click in left nav → update right card
    navCard.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-settings-key]");
      if (!btn) return;
      const key = btn.getAttribute("data-settings-key");
      renderMainView(key);
    });
  };
})();
