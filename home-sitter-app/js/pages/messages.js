// js/pages/messages.js
(function () {
  function initMessagesPage() {
    const el = document.getElementById("messagesContent");
    if (!el) return;
    el.textContent = "Messaging UI coming soon…";
  }
  window.initMessagesPage = initMessagesPage;
})();
// js/pages/messages.js
// Role-aware Messages page that shows profiles + a simple chat panel

(function () {
  function buildConversationList(user, state) {
    const users = state.getUsers ? state.getUsers() : [];
    const sitters = state.getSitters ? state.getSitters() : [];
    const bookings = state.getBookings ? state.getBookings() : [];

    let partners = [];

    if (user && user.role === "client") {
      // Clients see sitters they can message
      partners = sitters;
    } else if (user && user.role === "sitter") {
      // Sitters see clients they've had bookings with
      const clientIds = new Set(
        bookings
          .filter((b) => b.sitterId === user.id)
          .map((b) => b.clientId)
          .filter(Boolean)
      );
      partners = users.filter(
        (u) => u.role === "client" && clientIds.has(u.id)
      );
      // If no bookings yet, show all clients as potential contacts
      if (partners.length === 0) {
        partners = users.filter((u) => u.role === "client");
      }
    } else if (user && (user.role === "employee" || user.role === "admin")) {
      // Employee/Admin see all sitters + clients
      const sitterUsers = users.filter((u) => u.role === "sitter");
      const clientUsers = users.filter((u) => u.role === "client");
      partners = sitterUsers.concat(clientUsers);
    } else {
      // Guests see sitters as demo
      partners = sitters;
    }

    // Remove self if somehow included
    partners = partners.filter((p) => !user || p.id !== user.id);

    if (!partners.length) {
      return {
        html: `<p class="text-muted" style="font-size:13px;">
          No conversations yet. Once you book someone, they’ll appear here.
        </p>`,
      };
    }

    const html = `
      <div class="simple-list">
        ${partners
          .map((p) => {
            // If this is a sitter profile from sitterProfiles:
            const isProfile = !!p.tagline || !!p.city || !!p.rating;
            const isSitter = isProfile || p.role === "sitter";

            const name = p.name || "Unknown user";
            const roleLabel = p.role
              ? p.role.charAt(0).toUpperCase() + p.role.slice(1)
              : isSitter
              ? "Sitter"
              : "Client";

            const subtitle = isProfile
              ? `${p.city || "Location not set"} • ⭐ ${
                  p.rating || "New"
                } (${p.reviewsCount || 0} reviews)`
              : `${roleLabel}${p.email ? " • " + p.email : ""}`;

            const tagline = isProfile
              ? p.tagline
              : "Tap to open this conversation";

            return `
              <div
                class="simple-list-item convo-item"
                data-partner-id="${p.id}"
              >
                <div style="display:flex; gap:10px; align-items:flex-start;">
                  <div
                    class="avatar-circle"
                    style="
                      width:32px;
                      height:32px;
                      border-radius:999px;
                      background:#e5e7eb;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      font-size:13px;
                      font-weight:600;
                    "
                  >
                    ${name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;">${name}</div>
                    <div class="text-muted" style="font-size:12px;">
                      ${subtitle}
                    </div>
                    <div style="font-size:12px; margin-top:2px;">
                      ${tagline}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    return { html };
  }

  function renderChatPanel(partner, user, state) {
    const chatPanel = document.getElementById("chatPanel");
    if (!chatPanel || !partner) return;

    const isSitter =
      partner.role === "sitter" || !!partner.tagline || !!partner.rating;

    const headerSubtitle = isSitter
      ? partner.city
        ? `${partner.city} • Sitter`
        : "Sitter"
      : partner.email
      ? `Client • ${partner.email}`
      : "Client";

    const introLine = isSitter
      ? "Ask questions, share your dog's routine, and request updates during bookings."
      : "Coordinate key exchange, timing, and any last-minute changes.";

    chatPanel.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-title">Chat with ${partner.name || "User"}</div>
          <div class="card-subtitle">
            ${headerSubtitle || "Conversation"}
          </div>
        </div>
        <span class="chip">${user && user.role ? user.role : "Guest"}</span>
      </div>

      <div class="section-card" style="margin-top:10px;">
        <p class="text-muted" style="font-size:12px; margin-top:0;">
          ${introLine}
        </p>

        <div
          id="messageThread"
          style="
            border-radius: 12px;
            border: 1px solid rgba(226,232,240,0.9);
            padding: 10px;
            max-height: 220px;
            overflow-y: auto;
            font-size: 13px;
            background: #f9fafb;
            margin-bottom: 8px;
          "
        >
          <div><strong>You:</strong> Hey ${
            partner.name?.split(" ")[0] || ""
          }, just wanted to check in about my dog.</div>
          <div><strong>${partner.name || "Sitter"}:</strong> Sounds good! Let me know feeding times and any special care I should know about 🐾</div>
        </div>

        <div style="display:flex; gap:8px;">
          <input
            type="text"
            id="messageInput"
            class="input"
            placeholder="Type a message..."
            style="flex:1;"
          />
          <button type="button" class="btn-primary" id="sendMessageBtn">
            Send
          </button>
        </div>

        <p class="text-muted" style="font-size:11px; margin-top:6px;">
          (Demo only) Messages aren’t stored yet – this is just a UI preview.
        </p>
      </div>
    `;

    // Fake "send" so it feels alive
    const sendBtn = document.getElementById("sendMessageBtn");
    const input = document.getElementById("messageInput");
    const thread = document.getElementById("messageThread");

    if (sendBtn && input && thread) {
      sendBtn.addEventListener("click", () => {
        const text = input.value.trim();
        if (!text) return;
        const safeName = user && user.name ? user.name.split(" ")[0] : "You";
        const div = document.createElement("div");
        div.innerHTML = `<strong>${safeName}:</strong> ${text}`;
        thread.appendChild(div);
        thread.scrollTop = thread.scrollHeight;
        input.value = "";
      });
    }
  }

  window.initMessagesPage = function () {
    const page = document.getElementById("messagesPage");
    if (!page) return;

    const state = window.PetCareState;
    if (!state || typeof state.getCurrentUser !== "function") {
      page.innerHTML = `
        <h1>Messages</h1>
        <p class="page-subtitle">All your sitter conversations in one place.</p>
        <div class="section-card">
          <p class="text-muted">State is not ready. Make sure state.js is loaded before messages.js.</p>
        </div>
      `;
      return;
    }

    const user = state.getCurrentUser() || { role: "guest", name: "Guest" };

    const { html: convoListHtml } = buildConversationList(user, state);

    page.innerHTML = `
      <h1>Messages</h1>
      <p class="page-subtitle">
        All your conversations in one place – works for clients, sitters, employees, and admins.
      </p>

      <div class="dashboard-layout" id="messagesLayout">
        <!-- Left: conversation list -->
        <div class="dashboard-card">
          <div class="card-header">
            <div>
              <div class="card-title">Conversations</div>
              <div class="card-subtitle">
                ${
                  user.role === "client"
                    ? "Sitters you can message about bookings and care instructions."
                    : user.role === "sitter"
                    ? "Clients you’ve worked with or can coordinate with."
                    : user.role === "employee" || user.role === "admin"
                    ? "Clients and sitters you can reach for support and safety checks."
                    : "Preview of sitters you could chat with after signing up."
                }
              </div>
            </div>
          </div>
          <div id="conversationList" style="margin-top:8px;">
            ${convoListHtml}
          </div>
        </div>

        <!-- Right: chat panel -->
        <div class="dashboard-card" id="chatPanel">
          <div class="card-header">
            <div>
              <div class="card-title">Select a conversation</div>
              <div class="card-subtitle">
                Choose a profile on the left to open a message thread.
              </div>
            </div>
          </div>
          <div class="section-card" style="margin-top:10px;">
            <p class="text-muted" style="font-size:13px; margin-top:0;">
              When you select a sitter or client, their profile details will appear here with a chat window.
            </p>
            <ul class="text-muted" style="font-size:12px; padding-left:18px; margin-top:6px;">
              <li>Clients can message sitters about care instructions and timing.</li>
              <li>Sitters can send photo updates and ask clarifying questions.</li>
              <li>Employees/Admin can reach out for safety, disputes, and support.</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    // Wire click on conversation items
    const convoListEl = document.getElementById("conversationList");
    if (convoListEl) {
      convoListEl.addEventListener("click", function (e) {
        const item = e.target.closest(".convo-item");
        if (!item) return;

        const partnerId = item.getAttribute("data-partner-id");
        if (!partnerId) return;

        // Try sitter profile first
        let partner =
          (state.getSitterById && state.getSitterById(partnerId)) || null;

        if (!partner) {
          // Then fall back to generic user
          const users = state.getUsers ? state.getUsers() : [];
          partner = users.find((u) => u.id === partnerId) || null;
        }

        if (!partner) return;

        renderChatPanel(partner, user, state);
      });
    }
  };
})();
