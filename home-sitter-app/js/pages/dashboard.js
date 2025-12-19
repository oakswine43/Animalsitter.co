// js/pages/dashboard.js
(function () {
  const API_BASE = window.PETCARE_API_BASE || "http://localhost:4000";

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function getToken() {
    try {
      return localStorage.getItem("petcare_token");
    } catch {
      return null;
    }
  }

  async function fetchJson(path) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ---------------------------------------------------------
  // Admin Dashboard UI (layout-first; data can be wired later)
  // ---------------------------------------------------------

  function renderKpiCards() {
    const grid = el("div", { class: "admin-kpi-grid" });

    const cards = [
      { label: "Revenue (MTD)", value: "$—", trend: "—" },
      { label: "Active Bookings", value: "—", trend: "—" },
      { label: "New Signups (7d)", value: "—", trend: "—" },
      { label: "Active Sitters", value: "—", trend: "—" }
    ];

    cards.forEach((c) => {
      grid.appendChild(
        el("div", { class: "admin-kpi-card" }, [
          el("div", { class: "admin-kpi-label" }, c.label),
          el("div", { class: "admin-kpi-value" }, c.value),
          el("div", { class: "admin-kpi-trend" }, `Trend: ${c.trend}`)
        ])
      );
    });

    return grid;
  }

  function renderChartsRow() {
    const row = el("div", { class: "admin-charts-row" });

    const salesCard = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Operations Overview"),
        el("span", { class: "muted" }, "Bookings, revenue, fulfillment")
      ]),
      el("div", { class: "admin-chart-placeholder" }, "Chart placeholder")
    ]);

    const trafficCard = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Traffic & Acquisition"),
        el("span", { class: "muted" }, "Direct, search, referral, social")
      ]),
      el("div", { class: "admin-chart-placeholder circle" }, "Donut placeholder")
    ]);

    row.appendChild(salesCard);
    row.appendChild(trafficCard);
    return row;
  }

  function renderTwoColumnLists() {
    const row = el("div", { class: "admin-two-col" });

    // Left: Alerts/Risk + Recent Activity
    const left = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Alerts & Risk Queue"),
        el("span", { class: "muted" }, "Priority items requiring attention")
      ]),
      el("ul", { class: "admin-list" }, [
        el("li", {}, "High-priority reports"),
        el("li", {}, "Payment failures / chargebacks"),
        el("li", {}, "Suspicious accounts or fraud flags"),
        el("li", {}, "Service incidents"),
        el("li", {}, "Negative review spikes")
      ]),
      el("hr", { class: "admin-divider" }),
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Recent Activity"),
        el("span", { class: "muted" }, "Live operational events")
      ]),
      el("ul", { class: "admin-list" }, [
        el("li", {}, "New booking created"),
        el("li", {}, "New sitter application"),
        el("li", {}, "User password reset"),
        el("li", {}, "Refund processed"),
        el("li", {}, "Policy update published")
      ])
    ]);

    // Right: Quick Actions
    const right = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Quick Actions"),
        el("span", { class: "muted" }, "Owner-level shortcuts")
      ]),
      el("div", { class: "admin-actions" }, [
        el("button", { class: "btn-secondary", type: "button" }, "Approve sitter applications"),
        el("button", { class: "btn-secondary", type: "button" }, "Issue refund / credit"),
        el("button", { class: "btn-secondary", type: "button" }, "Broadcast announcement"),
        el("button", { class: "btn-secondary", type: "button" }, "Assign support tickets"),
        el("button", { class: "btn-secondary", type: "button" }, "View audit logs")
      ])
    ]);

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function renderAdminCapabilities() {
    // This is the professional organized list version of what you wrote.
    return el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Owner / Admin Control Center"),
        el("span", { class: "muted" }, "Full platform administration and oversight")
      ]),

      el("div", { class: "admin-cap-grid" }, [
        sectionBlock("1. Full User & Role Control", [
          "View, search, and filter all users",
          "Create, edit, disable, and reactivate accounts",
          "Assign roles (owner/super admin, admin, employee, sitter, client)",
          "Verify identities (if supported)",
          "Handle disputes and appeals",
          "Impersonation mode (safe, logged) for troubleshooting"
        ]),

        sectionBlock("2. Platform-wide Data", [
          "All bookings and service orders",
          "All messages (privacy-safe, access by policy)",
          "All reviews and ratings",
          "All incidents and reports"
        ]),

        sectionBlock("3. Listings / Services Management", [
          "Approve or deny sitter profiles",
          "Edit or remove listings that violate policies",
          "Manage categories, service types, add-ons",
          "Control availability rules and cancellation policies",
          "Apply pricing rules where applicable"
        ]),

        sectionBlock("4. Payments & Finance", [
          "View revenue, payouts, refunds, chargebacks",
          "Adjust platform fees and commission rates",
          "Manage promotions and credits",
          "Export financial reports",
          "Integrations overview (Stripe/PayPal/etc.)"
        ]),

        sectionBlock("5. Support Tools", [
          "Ticketing view",
          "User history timeline (bookings, payments, flags)",
          "Preset responses/macros",
          "Escalation controls for employees"
        ]),

        sectionBlock("6. Content & Policy Management", [
          "Terms, privacy, safety policies",
          "FAQ and help center content",
          "Site-wide announcements"
        ]),

        sectionBlock("7. System Configuration", [
          "Feature flags",
          "Email/SMS templates",
          "Geo settings and travel radius rules",
          "Notification logic",
          "Search and ranking rules"
        ]),

        sectionBlock("8. Analytics & Growth", [
          "User acquisition metrics",
          "Conversion funnels",
          "Retention and churn",
          "Service quality by region",
          "A/B testing results"
        ]),

        sectionBlock("9. Security & Compliance", [
          "Audit logs for every admin action",
          "Access logs",
          "Permission management",
          "2FA enforcement",
          "Data export/import controls",
          "Backup/restore visibility"
        ]),

        sectionBlock("Owner-grade Premium Views", [
          "Business health score",
          "Weekly digest panel",
          "Forecasting (next 7/30 days)",
          "Churn risk list",
          "Audit trail viewer with filters"
        ])
      ])
    ]);
  }

  function sectionBlock(title, bullets) {
    return el("div", { class: "admin-cap-card" }, [
      el("h4", {}, title),
      el("ul", { class: "admin-list compact" }, bullets.map((b) => el("li", {}, b)))
    ]);
  }

  function renderAdminDashboard(root) {
    root.innerHTML = "";

    root.appendChild(el("div", { class: "admin-page-header" }, [
      el("h1", {}, "Admin Dashboard"),
      el("p", { class: "muted" },
        "High-level KPIs, operational oversight, and full platform controls.")
    ]));

    root.appendChild(renderKpiCards());
    root.appendChild(renderChartsRow());
    root.appendChild(renderTwoColumnLists());
    root.appendChild(renderAdminCapabilities());
  }

  // ---------------------------------------------------------
  // Client Dashboard UI (added without removing anything)
  // ---------------------------------------------------------

  function renderClientMapCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Nearby Sitters Map"),
        el("span", { class: "muted" }, "Live location preview")
      ]),
      el("div", { class: "client-map-placeholder" }, [
        el("div", { class: "map-pin-labels" }, [
          el("div", { class: "map-pin" }, "Downtown hotspot"),
          el("div", { class: "map-pin" }, "Park meetups"),
          el("div", { class: "map-pin" }, "Quiet neighborhood")
        ])
      ])
    ]);
  }

  function renderClientSittersCard() {
    const sitters = window.PetCareState?.getSitters?.() || [];

    const list = el("div", { class: "client-sitter-list" });

    if (!sitters.length) {
      list.appendChild(el("div", { class: "muted" }, "No sitters available yet."));
    } else {
      sitters.slice(0, 6).forEach((s) => {
        list.appendChild(
          el("div", { class: "client-sitter-card" }, [
            el("div", {
              class: "client-sitter-avatar",
              style: `background-image:url('${s.avatar || ""}')`
            }),
            el("div", { class: "client-sitter-body" }, [
              el("div", { class: "client-sitter-name" }, s.name || "Sitter"),
              el("div", { class: "client-sitter-meta" },
                `${s.city || "Nearby"} • ${s.distance || "—"} • ★ ${s.rating || "New"}`),
              el("div", { class: "client-sitter-tagline muted" },
                s.tagline || "Profile coming soon.")
            ]),
            el("div", { class: "client-sitter-actions" }, [
              el("button", {
                class: "btn-small",
                type: "button",
                "data-page-jump": "sitterProfilePage",
                "data-sitter-id": s.id
              }, "View")
            ])
          ])
        );
      });
    }

    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Recommended Sitters"),
        el("span", { class: "muted" }, "Based on location and preferences")
      ]),
      list
    ]);
  }

  function renderClientHistoryCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Sitter History"),
        el("span", { class: "muted" }, "Past bookings and favorites")
      ]),
      el("ul", { class: "client-list" }, [
        el("li", {}, "Past booking history (coming soon)"),
        el("li", {}, "Repeat sitter stats"),
        el("li", {}, "Saved/favorited sitters")
      ])
    ]);
  }

  function renderClientMessagesCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Messages"),
        el("span", { class: "muted" }, "Your sitter conversations")
      ]),
      el("div", { class: "client-empty muted" },
        "Messages will appear here once wired to the API.")
    ]);
  }

  function renderClientUpdatesCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Sitter Updates"),
        el("span", { class: "muted" }, "Photos, check-ins, status")
      ]),
      el("ul", { class: "client-list" }, [
        el("li", {}, "Photo updates from active sitters"),
        el("li", {}, "Visit notes and care logs"),
        el("li", {}, "Arrival/departure confirmations")
      ])
    ]);
  }

  function renderClientCalendarCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Upcoming Bookings"),
        el("span", { class: "muted" }, "Your schedule overview")
      ]),
      el("div", { class: "client-calendar-mini" }, [
        el("div", { class: "client-calendar-header" }, [
          el("strong", {}, "Calendar"),
          el("span", { class: "muted" }, "Client-managed")
        ]),
        el("div", { class: "client-calendar-grid" }, [
          el("div", { class: "client-calendar-day muted" }, "Mon"),
          el("div", { class: "client-calendar-day muted" }, "Tue"),
          el("div", { class: "client-calendar-day muted" }, "Wed"),
          el("div", { class: "client-calendar-day muted" }, "Thu"),
          el("div", { class: "client-calendar-day muted" }, "Fri"),
          el("div", { class: "client-calendar-day muted" }, "Sat"),
          el("div", { class: "client-calendar-day muted" }, "Sun"),
          ...Array.from({ length: 28 }).map((_, i) =>
            el("div", { class: "client-calendar-cell" }, String(i + 1))
          )
        ]),
        el("div", { class: "client-calendar-footer muted" },
          "This will connect to real bookings later.")
      ])
    ]);
  }

  function renderClientDashboard(root) {
    root.innerHTML = "";

    root.appendChild(el("div", { class: "client-page-header" }, [
      el("h1", {}, "Client Dashboard"),
      el("p", { class: "muted" },
        "Your hub for nearby sitters, booking history, messages, and upcoming appointments.")
    ]));

    const layout = el("div", { class: "client-dashboard-grid" });

    const left = el("div", { class: "client-col-left" }, [
      renderClientMapCard(),
      renderClientSittersCard(),
      renderClientHistoryCard()
    ]);

    const right = el("div", { class: "client-col-right" }, [
      renderClientMessagesCard(),
      renderClientUpdatesCard(),
      renderClientCalendarCard()
    ]);

    layout.appendChild(left);
    layout.appendChild(right);
    root.appendChild(layout);

    // Keep your existing navigation pattern
    root.querySelectorAll("[data-sitter-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-sitter-id");
        if (id && window.PetCareState?.setSelectedSitterId) {
          window.PetCareState.setSelectedSitterId(id);
        }
      });
    });
  }

  // ---------------------------------------------------------
  // Existing fallback
  // ---------------------------------------------------------

  function renderNonAdmin(root, role) {
    root.innerHTML = "";
    root.appendChild(
      el("div", { class: "section-card" }, [
        el("h2", {}, "Dashboard"),
        el("p", { class: "muted" },
          role
            ? `You are logged in as ${role}. Your personalized dashboard will appear here.`
            : "Log in to see your personalized dashboard.")
      ])
    );
  }

  // ---------------------------------------------------------
  // Init (updated routing without deleting anything)
  // ---------------------------------------------------------

  function initDashboardPage() {
    const root = document.getElementById("dashboardRoot");
    if (!root) return;

    const user = window.PetCareState?.getCurrentUser?.();
    const role = user?.role;

    if (role === "admin") {
      renderAdminDashboard(root);
      return;
    }

    if (role === "client") {
      renderClientDashboard(root);
      return;
    }

    renderNonAdmin(root, role);
  }

  window.initDashboardPage = initDashboardPage;
})();
// js/pages/dashboard.js
(function () {
  const API_BASE = window.PETCARE_API_BASE || "http://localhost:4000";

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function getToken() {
    try {
      return localStorage.getItem("petcare_token");
    } catch {
      return null;
    }
  }

  async function fetchJson(path) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ---------------------------------------------------------
  // Admin Dashboard UI (layout-first; data can be wired later)
  // ---------------------------------------------------------

  function renderKpiCards() {
    const grid = el("div", { class: "admin-kpi-grid" });

    const cards = [
      { label: "Revenue (MTD)", value: "$—", trend: "—" },
      { label: "Active Bookings", value: "—", trend: "—" },
      { label: "New Signups (7d)", value: "—", trend: "—" },
      { label: "Active Sitters", value: "—", trend: "—" }
    ];

    cards.forEach((c) => {
      grid.appendChild(
        el("div", { class: "admin-kpi-card" }, [
          el("div", { class: "admin-kpi-label" }, c.label),
          el("div", { class: "admin-kpi-value" }, c.value),
          el("div", { class: "admin-kpi-trend" }, `Trend: ${c.trend}`)
        ])
      );
    });

    return grid;
  }

  function renderChartsRow() {
    const row = el("div", { class: "admin-charts-row" });

    const salesCard = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Operations Overview"),
        el("span", { class: "muted" }, "Bookings, revenue, fulfillment")
      ]),
      el("div", { class: "admin-chart-placeholder" }, "Chart placeholder")
    ]);

    const trafficCard = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Traffic & Acquisition"),
        el("span", { class: "muted" }, "Direct, search, referral, social")
      ]),
      el("div", { class: "admin-chart-placeholder circle" }, "Donut placeholder")
    ]);

    row.appendChild(salesCard);
    row.appendChild(trafficCard);
    return row;
  }

  function renderTwoColumnLists() {
    const row = el("div", { class: "admin-two-col" });

    // Left: Alerts/Risk + Recent Activity
    const left = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Alerts & Risk Queue"),
        el("span", { class: "muted" }, "Priority items requiring attention")
      ]),
      el("ul", { class: "admin-list" }, [
        el("li", {}, "High-priority reports"),
        el("li", {}, "Payment failures / chargebacks"),
        el("li", {}, "Suspicious accounts or fraud flags"),
        el("li", {}, "Service incidents"),
        el("li", {}, "Negative review spikes")
      ]),
      el("hr", { class: "admin-divider" }),
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Recent Activity"),
        el("span", { class: "muted" }, "Live operational events")
      ]),
      el("ul", { class: "admin-list" }, [
        el("li", {}, "New booking created"),
        el("li", {}, "New sitter application"),
        el("li", {}, "User password reset"),
        el("li", {}, "Refund processed"),
        el("li", {}, "Policy update published")
      ])
    ]);

    // Right: Quick Actions
    const right = el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Quick Actions"),
        el("span", { class: "muted" }, "Owner-level shortcuts")
      ]),
      el("div", { class: "admin-actions" }, [
        el("button", { class: "btn-secondary", type: "button" }, "Approve sitter applications"),
        el("button", { class: "btn-secondary", type: "button" }, "Issue refund / credit"),
        el("button", { class: "btn-secondary", type: "button" }, "Broadcast announcement"),
        el("button", { class: "btn-secondary", type: "button" }, "Assign support tickets"),
        el("button", { class: "btn-secondary", type: "button" }, "View audit logs")
      ])
    ]);

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function renderAdminCapabilities() {
    // This is the professional organized list version of what you wrote.
    return el("div", { class: "admin-panel" }, [
      el("div", { class: "admin-panel-header" }, [
        el("h3", {}, "Owner / Admin Control Center"),
        el("span", { class: "muted" }, "Full platform administration and oversight")
      ]),

      el("div", { class: "admin-cap-grid" }, [
        sectionBlock("1. Full User & Role Control", [
          "View, search, and filter all users",
          "Create, edit, disable, and reactivate accounts",
          "Assign roles (owner/super admin, admin, employee, sitter, client)",
          "Verify identities (if supported)",
          "Handle disputes and appeals",
          "Impersonation mode (safe, logged) for troubleshooting"
        ]),

        sectionBlock("2. Platform-wide Data", [
          "All bookings and service orders",
          "All messages (privacy-safe, access by policy)",
          "All reviews and ratings",
          "All incidents and reports"
        ]),

        sectionBlock("3. Listings / Services Management", [
          "Approve or deny sitter profiles",
          "Edit or remove listings that violate policies",
          "Manage categories, service types, add-ons",
          "Control availability rules and cancellation policies",
          "Apply pricing rules where applicable"
        ]),

        sectionBlock("4. Payments & Finance", [
          "View revenue, payouts, refunds, chargebacks",
          "Adjust platform fees and commission rates",
          "Manage promotions and credits",
          "Export financial reports",
          "Integrations overview (Stripe/PayPal/etc.)"
        ]),

        sectionBlock("5. Support Tools", [
          "Ticketing view",
          "User history timeline (bookings, payments, flags)",
          "Preset responses/macros",
          "Escalation controls for employees"
        ]),

        sectionBlock("6. Content & Policy Management", [
          "Terms, privacy, safety policies",
          "FAQ and help center content",
          "Site-wide announcements"
        ]),

        sectionBlock("7. System Configuration", [
          "Feature flags",
          "Email/SMS templates",
          "Geo settings and travel radius rules",
          "Notification logic",
          "Search and ranking rules"
        ]),

        sectionBlock("8. Analytics & Growth", [
          "User acquisition metrics",
          "Conversion funnels",
          "Retention and churn",
          "Service quality by region",
          "A/B testing results"
        ]),

        sectionBlock("9. Security & Compliance", [
          "Audit logs for every admin action",
          "Access logs",
          "Permission management",
          "2FA enforcement",
          "Data export/import controls",
          "Backup/restore visibility"
        ]),

        sectionBlock("Owner-grade Premium Views", [
          "Business health score",
          "Weekly digest panel",
          "Forecasting (next 7/30 days)",
          "Churn risk list",
          "Audit trail viewer with filters"
        ])
      ])
    ]);
  }

  function sectionBlock(title, bullets) {
    return el("div", { class: "admin-cap-card" }, [
      el("h4", {}, title),
      el("ul", { class: "admin-list compact" }, bullets.map((b) => el("li", {}, b)))
    ]);
  }

  function renderAdminDashboard(root) {
    root.innerHTML = "";

    root.appendChild(el("div", { class: "admin-page-header" }, [
      el("h1", {}, "Admin Dashboard"),
      el("p", { class: "muted" },
        "High-level KPIs, operational oversight, and full platform controls.")
    ]));

    root.appendChild(renderKpiCards());
    root.appendChild(renderChartsRow());
    root.appendChild(renderTwoColumnLists());
    root.appendChild(renderAdminCapabilities());
  }

  // ---------------------------------------------------------
  // Client Dashboard UI (added without removing anything)
  // ---------------------------------------------------------

  function renderClientMapCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Nearby Sitters Map"),
        el("span", { class: "muted" }, "Live location preview")
      ]),
      el("div", { class: "client-map-placeholder" }, [
        el("div", { class: "map-pin-labels" }, [
          el("div", { class: "map-pin" }, "Downtown hotspot"),
          el("div", { class: "map-pin" }, "Park meetups"),
          el("div", { class: "map-pin" }, "Quiet neighborhood")
        ])
      ])
    ]);
  }

  function renderClientSittersCard() {
    const sitters = window.PetCareState?.getSitters?.() || [];

    const list = el("div", { class: "client-sitter-list" });

    if (!sitters.length) {
      list.appendChild(el("div", { class: "muted" }, "No sitters available yet."));
    } else {
      sitters.slice(0, 6).forEach((s) => {
        list.appendChild(
          el("div", { class: "client-sitter-card" }, [
            el("div", {
              class: "client-sitter-avatar",
              style: `background-image:url('${s.avatar || ""}')`
            }),
            el("div", { class: "client-sitter-body" }, [
              el("div", { class: "client-sitter-name" }, s.name || "Sitter"),
              el("div", { class: "client-sitter-meta" },
                `${s.city || "Nearby"} • ${s.distance || "—"} • ★ ${s.rating || "New"}`),
              el("div", { class: "client-sitter-tagline muted" },
                s.tagline || "Profile coming soon.")
            ]),
            el("div", { class: "client-sitter-actions" }, [
              el("button", {
                class: "btn-small",
                type: "button",
                "data-page-jump": "sitterProfilePage",
                "data-sitter-id": s.id
              }, "View")
            ])
          ])
        );
      });
    }

    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Recommended Sitters"),
        el("span", { class: "muted" }, "Based on location and preferences")
      ]),
      list
    ]);
  }

  function renderClientHistoryCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Sitter History"),
        el("span", { class: "muted" }, "Past bookings and favorites")
      ]),
      el("ul", { class: "client-list" }, [
        el("li", {}, "Past booking history (coming soon)"),
        el("li", {}, "Repeat sitter stats"),
        el("li", {}, "Saved/favorited sitters")
      ])
    ]);
  }

  function renderClientMessagesCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Messages"),
        el("span", { class: "muted" }, "Your sitter conversations")
      ]),
      el("div", { class: "client-empty muted" },
        "Messages will appear here once wired to the API.")
    ]);
  }

  function renderClientUpdatesCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Sitter Updates"),
        el("span", { class: "muted" }, "Photos, check-ins, status")
      ]),
      el("ul", { class: "client-list" }, [
        el("li", {}, "Photo updates from active sitters"),
        el("li", {}, "Visit notes and care logs"),
        el("li", {}, "Arrival/departure confirmations")
      ])
    ]);
  }

  function renderClientCalendarCard() {
    return el("div", { class: "client-panel" }, [
      el("div", { class: "client-panel-header" }, [
        el("h3", {}, "Upcoming Bookings"),
        el("span", { class: "muted" }, "Your schedule overview")
      ]),
      el("div", { class: "client-calendar-mini" }, [
        el("div", { class: "client-calendar-header" }, [
          el("strong", {}, "Calendar"),
          el("span", { class: "muted" }, "Client-managed")
        ]),
        el("div", { class: "client-calendar-grid" }, [
          el("div", { class: "client-calendar-day muted" }, "Mon"),
          el("div", { class: "client-calendar-day muted" }, "Tue"),
          el("div", { class: "client-calendar-day muted" }, "Wed"),
          el("div", { class: "client-calendar-day muted" }, "Thu"),
          el("div", { class: "client-calendar-day muted" }, "Fri"),
          el("div", { class: "client-calendar-day muted" }, "Sat"),
          el("div", { class: "client-calendar-day muted" }, "Sun"),
          ...Array.from({ length: 28 }).map((_, i) =>
            el("div", { class: "client-calendar-cell" }, String(i + 1))
          )
        ]),
        el("div", { class: "client-calendar-footer muted" },
          "This will connect to real bookings later.")
      ])
    ]);
  }

  function renderClientDashboard(root) {
    root.innerHTML = "";

    root.appendChild(el("div", { class: "client-page-header" }, [
      el("h1", {}, "Client Dashboard"),
      el("p", { class: "muted" },
        "Your hub for nearby sitters, booking history, messages, and upcoming appointments.")
    ]));

    const layout = el("div", { class: "client-dashboard-grid" });

    const left = el("div", { class: "client-col-left" }, [
      renderClientMapCard(),
      renderClientSittersCard(),
      renderClientHistoryCard()
    ]);

    const right = el("div", { class: "client-col-right" }, [
      renderClientMessagesCard(),
      renderClientUpdatesCard(),
      renderClientCalendarCard()
    ]);

    layout.appendChild(left);
    layout.appendChild(right);
    root.appendChild(layout);

    // Keep your existing navigation pattern
    root.querySelectorAll("[data-sitter-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-sitter-id");
        if (id && window.PetCareState?.setSelectedSitterId) {
          window.PetCareState.setSelectedSitterId(id);
        }
      });
    });
  }

  // ---------------------------------------------------------
  // Existing fallback
  // ---------------------------------------------------------

  function renderNonAdmin(root, role) {
    root.innerHTML = "";
    root.appendChild(
      el("div", { class: "section-card" }, [
        el("h2", {}, "Dashboard"),
        el("p", { class: "muted" },
          role
            ? `You are logged in as ${role}. Your personalized dashboard will appear here.`
            : "Log in to see your personalized dashboard.")
      ])
    );
  }

  // ---------------------------------------------------------
  // Init (updated routing without deleting anything)
  // ---------------------------------------------------------

  function initDashboardPage() {
    const root = document.getElementById("dashboardRoot");
    if (!root) return;

    const user = window.PetCareState?.getCurrentUser?.();
    const role = user?.role;

    if (role === "admin") {
      renderAdminDashboard(root);
      return;
    }

    if (role === "client") {
      renderClientDashboard(root);
      return;
    }

    renderNonAdmin(root, role);
  }

  window.initDashboardPage = initDashboardPage;
})();
