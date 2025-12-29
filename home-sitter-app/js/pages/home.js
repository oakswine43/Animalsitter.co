// js/pages/home.js
// Handles the Home page Pup Gallery: load posts, likes, comments

(function () {
  const gridId = "homeGalleryGrid";
  const resultsListId = "homeResultsList";

  function safeText(v) {
    return String(v == null ? "" : v);
  }

  function pickServiceLabel(s) {
    const services = s.services || s.service_types || s.service_type || [];
    const arr = Array.isArray(services) ? services : [services].filter(Boolean);
    if (!arr.length) return "Walks • Drop-ins • Overnight";
    return arr
      .map((x) => safeText(x).replace(/_/g, " "))
      .slice(0, 3)
      .join(" • ");
  }

  function renderSitterCard(s) {
    const card = document.createElement("div");
    card.className = "frontpage-sitter-card";

    const name = s.name || s.full_name || "Sitter";
    const city = s.city || s.location || "Nearby";
    const rating = s.rating != null ? s.rating : "New";
    const price = s.price || s.rate || null;
    const avatar = s.avatar_url || s.photo_url || s.avatar || "";

    card.innerHTML = `
      <div class="fp-sitter-row">
        <div class="fp-sitter-avatar" style="${avatar ? `background-image:url('${avatar}')` : ""}"></div>
        <div style="flex:1;">
          <div class="fp-sitter-name">${safeText(name)}</div>
          <div class="fp-sitter-meta">${safeText(city)} • ★ ${safeText(rating)}</div>
          <div class="fp-sitter-services">${pickServiceLabel(s)}</div>
        </div>
        <div class="fp-sitter-right">
          <div class="fp-sitter-price">${price ? `$${safeText(price)}` : ""}</div>
          <button type="button" class="btn-small">View</button>
        </div>
      </div>
    `;

    card.querySelector("button")?.addEventListener("click", () => {
      try {
        if (window.PetCareState?.ui) window.PetCareState.ui.selectedSitterId = s.id;
        window.PetCareBooking = window.PetCareBooking || {};
        window.PetCareBooking.preview = s;
      } catch (_) {}

      if (typeof window.setActivePage === "function") window.setActivePage("sitterProfilePage");
      if (typeof window.showPage === "function") window.showPage("sitterProfilePage");
    });

    return card;
  }

  function renderHomeResults() {
    const list = document.getElementById(resultsListId);
    if (!list) return;

    const sitters =
      (window.PetCareState && typeof window.PetCareState.getSitters === "function"
        ? window.PetCareState.getSitters()
        : []) || [];

    const arr = Array.isArray(sitters) ? sitters : [];
    if (!arr.length) {
      list.innerHTML = `<div class="text-muted">No sitters loaded yet.</div>`;
      return;
    }

    list.innerHTML = "";
    arr.slice(0, 10).forEach((s) => list.appendChild(renderSitterCard(s)));
  }

  async function tryRefreshSitters() {
    try {
      if (window.PetCareState?.refreshSittersFromApi) {
        await window.PetCareState.refreshSittersFromApi();
      }
    } catch (e) {
      console.warn("Home: refreshSittersFromApi failed", e);
    }
  }

  function wireHomeSearch() {
    const btn = document.getElementById("homeSearchBtn");
    if (!btn || btn.__wired) return;
    btn.__wired = true;

    btn.addEventListener("click", async () => {
      if (typeof window.setActivePage === "function") window.setActivePage("swipePage");
      if (typeof window.showPage === "function") window.showPage("swipePage");
    });
  }

  function getCurrentUserName() {
    try {
      const user = window.PetCareState?.getCurrentUser?.();
      if (!user || user.role === "guest") return "Guest";
      return user.name || user.email || "Someone";
    } catch {
      return "Someone";
    }
  }

  function renderPostCard(post) {
    const comments = post.comments || [];
    const likes = post.likes_count || 0;

    const wrapper = document.createElement("div");
    wrapper.className = "gallery-item";
    wrapper.dataset.postId = post.id;

    const imgDiv = document.createElement("div");
    imgDiv.className = "gallery-item-img";
    if (post.image_url) {
      imgDiv.style.backgroundImage = `url('${post.image_url}')`;
    }

    const bodyDiv = document.createElement("div");
    bodyDiv.className = "gallery-item-body";

    const meta = document.createElement("div");
    meta.className = "gallery-item-meta";
    meta.textContent = `Posted by ${post.author_name}`;

    const caption = document.createElement("div");
    caption.className = "gallery-item-caption";
    caption.textContent = post.caption || "";

    const footer = document.createElement("div");
    footer.className = "gallery-item-footer";

    const likeSpan = document.createElement("span");
    likeSpan.className = "gallery-likes";
    likeSpan.textContent = `❤️ ${likes} • 💬 ${comments.length}`;
    likeSpan.style.cursor = "pointer";
    likeSpan.title = "Click to like";

    const subtle = document.createElement("span");
    subtle.className = "text-muted";
    subtle.textContent = "Pup gallery";

    footer.appendChild(likeSpan);
    footer.appendChild(subtle);

    const commentsBox = document.createElement("div");
    commentsBox.className = "gallery-comments-box";

    if (comments.length) {
      const list = document.createElement("div");
      list.className = "gallery-comments-list";

      comments.forEach((c) => {
        const row = document.createElement("div");
        row.className = "gallery-comment-row";

        const who = document.createElement("strong");
        who.textContent = c.author_name + ": ";

        const text = document.createElement("span");
        text.textContent = c.body;

        row.appendChild(who);
        row.appendChild(text);
        list.appendChild(row);
      });

      commentsBox.appendChild(list);
    }

    const form = document.createElement("form");
    form.className = "gallery-comment-form";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Add a comment…";

    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "btn-small";
    btn.textContent = "Post";

    form.appendChild(input);
    form.appendChild(btn);

    commentsBox.appendChild(form);

    bodyDiv.appendChild(meta);
    bodyDiv.appendChild(caption);
    bodyDiv.appendChild(footer);
    bodyDiv.appendChild(commentsBox);

    wrapper.appendChild(imgDiv);
    wrapper.appendChild(bodyDiv);

    likeSpan.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/posts/${post.id}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          alert("Failed to like this post.");
          return;
        }

        const newLikes = data.likes ?? (likes + 1);
        likeSpan.textContent = `❤️ ${newLikes} • 💬 ${comments.length}`;
      } catch (err) {
        console.error("GALLERY_LIKE_CLIENT_ERROR:", err);
        alert("Failed to like this post (network error).");
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const authorName = getCurrentUserName();

      try {
        const res = await fetch(`${API_BASE}/gallery/posts/${post.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorName, body: text })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          alert("Failed to post comment.");
          return;
        }

        const c = data.comment;
        let list = commentsBox.querySelector(".gallery-comments-list");
        if (!list) {
          list = document.createElement("div");
          list.className = "gallery-comments-list";
          commentsBox.insertBefore(list, form);
        }

        const row = document.createElement("div");
        row.className = "gallery-comment-row";

        const who = document.createElement("strong");
        who.textContent = c.author_name + ": ";

        const t = document.createElement("span");
        t.textContent = c.body;

        row.appendChild(who);
        row.appendChild(t);
        list.appendChild(row);

        const newCount = list.querySelectorAll(".gallery-comment-row").length;
        const currentLikesText = likeSpan.textContent.split("•")[0].trim();
        likeSpan.textContent = `${currentLikesText} • 💬 ${newCount}`;

        input.value = "";
      } catch (err) {
        console.error("GALLERY_COMMENT_CLIENT_ERROR:", err);
        alert("Failed to add comment (network error).");
      }
    });

    return wrapper;
  }

  async function loadPupGallery() {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = `<p class="text-muted">Loading pup gallery…</p>`;

    try {
      const res = await fetch(`${API_BASE}/gallery/posts`);
      if (!res.ok) {
        grid.innerHTML = `<p class="text-error">Failed to load pup gallery.</p>`;
        return;
      }

      const data = await res.json().catch(() => ({}));
      const posts = data.posts || [];
      if (!posts.length) {
        grid.innerHTML = `<p class="text-muted">No pup posts yet.</p>`;
        return;
      }

      grid.innerHTML = "";
      posts.forEach((p) => grid.appendChild(renderPostCard(p)));
    } catch (err) {
      console.error("GALLERY_CLIENT_ERROR:", err);
      grid.innerHTML = `<p class="text-error">Failed to load pup gallery (network error).</p>`;
    }
  }

  window.initHomePage = async function () {
    wireHomeSearch();
    await tryRefreshSitters();
    renderHomeResults();
    loadPupGallery();
  };
})();
