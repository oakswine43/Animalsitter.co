// js/pages/profile.js
(function () {
  const API_BASE =
    window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  function getAuthToken() {
    return (
      localStorage.getItem("petcare_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      ""
    );
  }

  function setStoredUser(user) {
    try {
      localStorage.setItem("petcare_user", JSON.stringify(user));
    } catch (_) {}
  }

  function niceRole(role) {
    const r = String(role || "").toLowerCase();
    if (r === "client") return "Client";
    if (r === "sitter") return "Sitter";
    if (r === "employee") return "Employee";
    if (r === "admin") return "Admin";
    return role || "User";
  }

  function avatarUrl(user) {
    if (!user) return "";
    if (user.avatar_url && user.avatar_url.startsWith("http")) return user.avatar_url;
    if (user.avatar_url) return `${API_BASE}${user.avatar_url}`;
    return "";
  }

  async function fetchProfile() {
    const token = getAuthToken();
    if (!token) throw new Error("Not logged in.");

    const res = await fetch(`${API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load profile.");
    }
    return data.user;
  }

  async function saveProfile({ first_name, last_name, phone }) {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ first_name, last_name, phone })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to save profile.");
    }
    return data.user;
  }

  async function uploadAvatar(file) {
    const token = getAuthToken();
    const fd = new FormData();
    fd.append("photo", file);

    const res = await fetch(`${API_BASE}/profile/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to upload photo.");
    }
    return data;
  }

  function render(root, user) {
    const url = avatarUrl(user);

    root.innerHTML = `
      <div class="section-card" style="display:flex; gap:16px; align-items:flex-start;">
        <div style="width:96px;">
          <div style="
              width:96px;height:96px;border-radius:16px;
              background:#f2f2f2;overflow:hidden;
              display:flex;align-items:center;justify-content:center;
              border:1px solid rgba(0,0,0,0.06);
            ">
            ${
              url
                ? `<img src="${url}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />`
                : `<span class="text-muted" style="font-size:12px;">No photo</span>`
            }
          </div>

          <label class="btn-small-outline" style="display:inline-block;margin-top:8px;cursor:pointer;">
            Upload
            <input id="profileAvatarInput" type="file" accept="image/*" style="display:none;" />
          </label>
          <div id="profileAvatarMsg" class="small text-muted" style="margin-top:6px;"></div>
        </div>

        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:18px;font-weight:700;">
                ${(user.first_name || "Guest")} ${(user.last_name || "")}
              </div>
              <div class="small text-muted">
                ${user.email || ""} • ${niceRole(user.role)}
              </div>
            </div>

            <button id="profileSaveBtn" type="button" class="btn-primary">
              Save changes
            </button>
          </div>

          <div style="margin-top:12px;" class="profile-form-grid">
            <label>
              <span>First name</span>
              <input id="profileFirstName" class="input" value="${user.first_name || ""}" />
            </label>

            <label>
              <span>Last name</span>
              <input id="profileLastName" class="input" value="${user.last_name || ""}" />
            </label>

            <label>
              <span>Phone</span>
              <input id="profilePhone" class="input" value="${user.phone || ""}" placeholder="000-000-0000" />
            </label>

            <label>
              <span>Role</span>
              <input class="input" value="${niceRole(user.role)}" disabled />
            </label>
          </div>

          <div id="profileMsg" class="small text-muted" style="margin-top:10px;"></div>

          <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
            <button id="profileGoSettingsBtn" type="button" class="btn-secondary">
              Manage settings
            </button>
            <button id="profileLogoutBtn2" type="button" class="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function wire(root) {
    const msg = root.querySelector("#profileMsg");
    const avatarMsg = root.querySelector("#profileAvatarMsg");

    function setMsg(text) {
      if (msg) msg.textContent = text || "";
    }
    function setAvatarMsg(text) {
      if (avatarMsg) avatarMsg.textContent = text || "";
    }

    const saveBtn = root.querySelector("#profileSaveBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        setMsg("");
        try {
          const first_name = root.querySelector("#profileFirstName")?.value || "";
          const last_name = root.querySelector("#profileLastName")?.value || "";
          const phone = root.querySelector("#profilePhone")?.value || "";

          const updated = await saveProfile({ first_name, last_name, phone });
          setStoredUser(updated);

          // update top user pill if you have it
          const pill = document.getElementById("userPill");
          if (pill) pill.textContent = `${updated.first_name || "Guest"} ${updated.last_name || ""}`.trim();

          setMsg("Saved ✅");
        } catch (e) {
          console.error(e);
          setMsg(e.message || "Save failed.");
        }
      });
    }

    const avatarInput = root.querySelector("#profileAvatarInput");
    if (avatarInput) {
      avatarInput.addEventListener("change", async () => {
        setAvatarMsg("");
        const file = avatarInput.files && avatarInput.files[0];
        if (!file) return;

        try {
          await uploadAvatar(file);
          setAvatarMsg("Uploaded ✅ Refreshing…");

          // Reload profile view
          window.initProfilePage && window.initProfilePage();
        } catch (e) {
          console.error(e);
          setAvatarMsg(e.message || "Upload failed.");
        }
      });
    }

    const settingsBtn = root.querySelector("#profileGoSettingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        if (window.showPage) window.showPage("settingsPage");
      });
    }

    const logoutBtn = root.querySelector("#profileLogoutBtn2");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        // keep compatible with your existing logout flow
        localStorage.removeItem("petcare_token");
        localStorage.removeItem("token");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("petcare_user");
        localStorage.removeItem("user");
        if (window.showPage) window.showPage("homePage");
        const pill = document.getElementById("userPill");
        if (pill) pill.textContent = "Guest";
      });
    }
  }

  window.initProfilePage = async function initProfilePage() {
    const root = document.getElementById("profileRoot");
    if (!root) return;

    root.innerHTML = `<div class="text-muted">Loading profile…</div>`;

    try {
      const user = await fetchProfile();
      setStoredUser(user);
      render(root, user);
      wire(root);
    } catch (e) {
      console.error("initProfilePage error:", e);
      root.innerHTML = `
        <div class="section-card">
          <h3>Could not load profile</h3>
          <p class="text-muted">${e.message || "Unknown error"}</p>
          <button class="btn-primary" type="button" id="profileRetryBtn">Retry</button>
        </div>
      `;
      const retry = document.getElementById("profileRetryBtn");
      if (retry) retry.addEventListener("click", () => window.initProfilePage());
    }
  };
})();