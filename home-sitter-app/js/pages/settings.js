// js/pages/settings.js
// New Settings layout: left sidebar + right detail panel (Apple-style)

(function () {
  const VIEW_CONFIGS = [
    {
      id: "security_password",
      group: "Security",
      label: "Password & Security",
      default: true,
      title: "Password & Security",
      subtitle:
        "Manage how you sign in to AnimalSitter and keep your account protected.",
      rows: [
        {
          id: "security_login_alerts",
          title: "Login alerts",
          subtitle:
            "Get an email when your account signs in from a new browser or device.",
          enabled: true,
        },
        {
          id: "security_2fa",
          title: "Two-factor authentication",
          subtitle:
            "Add an extra step so a code from your phone is required to log in.",
          enabled: false,
        },
        {
          id: "security_recovery",
          title: "Account recovery",
          subtitle:
            "Make sure your email and phone number are up to date for password resets.",
          enabled: true,
        },
      ],
    },
    {
      id: "security_devices",
      group: "Security",
      label: "Devices & sessions",
      title: "Devices & Sessions",
      subtitle:
        "See where you’re currently signed in and sign out of devices you don’t recognize.",
      rows: [
        {
          id: "security_devices_overview",
          title: "Active sessions",
          subtitle:
            "Review browsers and devices that are currently logged into your account (demo only).",
          enabled: true,
        },
        {
          id: "security_logout_all",
          title: "Log out of all devices",
          subtitle:
            "Sign out everywhere except this browser if you think someone else may have access.",
          enabled: false,
        },
      ],
    },
    {
      id: "notify_general",
      group: "Notifications",
      label: "Notifications",
      title: "Notification Settings",
      subtitle:
        "Choose how you’d like to hear about bookings, messages, and account updates.",
      rows: [
        {
          id: "notify_bookings",
          title: "Booking updates",
          subtitle:
            "Alerts when a sitter accepts, changes, or cancels a booking.",
          enabled: true,
        },
        {
          id: "notify_messages",
          title: "Messages",
          subtitle: "New chat messages from sitters and clients.",
          enabled: true,
        },
        {
          id: "notify_marketing",
          title: "News & tips",
          subtitle:
            "Occasional product updates, offers, and pet care tips from AnimalSitter.",
          enabled: false,
        },
      ],
    },
    {
      id: "notify_sms",
      group: "Notifications",
      label: "Text messages",
      title: "SMS Updates",
      subtitle:
        "Decide if we should text you about time-sensitive activity like last-minute changes.",
      rows: [
        {
          id: "notify_sms_critical",
          title: "Critical booking alerts",
          subtitle: "Texts for last-minute sitter changes, emergencies, or issues.",
          enabled: true,
        },
        {
          id: "notify_sms_general",
          title: "General SMS updates",
          subtitle:
            "Reminders and confirmations by text (demo only – no real messages are sent).",
          enabled: false,
        },
      ],
    },
  ];

  const GROUP_ORDER = ["Security", "Notifications"];

  function getState() {
    return window.PetCareState || null;
  }

  function groupViews() {
    const byGroup = {};
    for (const view of VIEW_CONFIGS) {
      const group = view.group || "Other";
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(view);
    }
    // keep order inside each group as defined above
    return byGroup;
  }

  function renderSidebar(activeId) {
    const sidebar = document.getElementById("settingsSidebar");
    if (!sidebar) return;

    const grouped = groupViews();

    let html = "";
    GROUP_ORDER.forEach((groupName) => {
      const views = grouped[groupName];
      if (!views || views.length === 0) return;

      html += `
        <div class="settings-sidebar-group">
          <div class="settings-sidebar-group-title">${groupName}</div>
          <ul class="settings-nav-list">
      `;

      views.forEach((view) => {
        const isActive = view.id === activeId;
        html += `
          <li
            class="settings-nav-item ${isActive ? "is-active" : ""}"
            data-settings-view="${view.id}"
          >
            <span class="settings-nav-label">${view.label}</span>
          </li>
        `;
      });

      html += `</ul></div>`;
    });

    sidebar.innerHTML = html;
  }

  function renderDetail(viewId) {
    const mainTitleEl = document.getElementById("settingsMainTitle");
    const mainSubtitleEl = document.getElementById("settingsMainSubtitle");
    const bodyEl = document.getElementById("settingsMainBody");

    if (!mainTitleEl || !mainSubtitleEl || !bodyEl) return;

    const view =
      VIEW_CONFIGS.find((v) => v.id === viewId) ||
      VIEW_CONFIGS.find((v) => v.default) ||
      VIEW_CONFIGS[0];

    mainTitleEl.textContent = view.title;
    mainSubtitleEl.textContent = view.subtitle || "";

    const rowsHtml = (view.rows || [])
      .map(
        (row) => `
        <div class="settings-detail-row">
          <div>
            <div class="settings-row-title">${row.title}</div>
            <div class="settings-row-subtitle">${row.subtitle || ""}</div>
          </div>
          <button
            type="button"
            class="toggle-switch ${row.enabled ? "toggle-on" : ""}"
            data-toggle-id="${row.id}"
          >
            <span class="toggle-thumb"></span>
          </button>
        </div>
      `
      )
      .join("");

    bodyEl.innerHTML = `
      <div class="settings-detail-list">
        ${rowsHtml || "<p class='text-muted small'>No settings in this section yet.</p>"}
      </div>
    `;
  }

  function setActiveView(viewId) {
    renderSidebar(viewId);
    renderDetail(viewId);
  }

  function updateCustomerLabel() {
    const label = document.getElementById("settingsUserLabel");
    if (!label) return;

    const state = getState();
    const user =
      state && typeof state.getCurrentUser === "function"
        ? state.getCurrentUser()
        : null;

    const name =
      (user && (user.name || user.full_name || user.email)) || "Guest";
    label.textContent = `Customer: ${name}`;
  }

  // Public init called from app.js when settingsPage is shown
  window.initSettingsPage = function () {
    updateCustomerLabel();

    const defaultView =
      VIEW_CONFIGS.find((v) => v.default) || VIEW_CONFIGS[0];

    setActiveView(defaultView.id);

    const sidebar = document.getElementById("settingsSidebar");
    if (!sidebar || sidebar.__settingsBound) return;

    sidebar.__settingsBound = true;

    sidebar.addEventListener("click", (e) => {
      const item = e.target.closest("[data-settings-view]");
      if (!item) return;
      const viewId = item.getAttribute("data-settings-view");
      if (!viewId) return;
      setActiveView(viewId);
    });
  };
})();