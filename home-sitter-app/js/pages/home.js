// js/pages/home.js
// Handles the Home page Pup Gallery: load posts, likes, comments

(function () {
  const API_BASE = window.API_BASE || window.PETCARE_API_BASE || "http://localhost:4000";

  const gridId = "homeGalleryGrid";

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

    // Meta line: "Posted by Chris & Milo"
    const meta = document.createElement("div");
    meta.className = "gallery-item-meta";
    meta.textContent = `Posted by ${post.author_name}`;

    // Caption
    const caption = document.createElement("div");
    caption.className = "gallery-item-caption";
    caption.textContent = post.caption || "";

    // Footer with likes + quick stats
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

    // Comments list
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

    // Add-comment form
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

    // Put together
    bodyDiv.appendChild(meta);
    bodyDiv.appendChild(caption);
    bodyDiv.appendChild(footer);
    bodyDiv.appendChild(commentsBox);

    wrapper.appendChild(imgDiv);
    wrapper.appendChild(bodyDiv);

    // Wire up like click
    likeSpan.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/posts/${post.id}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });

        const data = await res.json().catch(() => ({}));
        console.log("Like response for post", post.id, data);

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

    // Wire up comment form submit
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
        console.log("Comment response for post", post.id, data);

        if (!res.ok || !data.ok) {
          alert("Failed to post comment.");
          return;
        }

        // Append new comment to the list
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

        // Update likes/comments label
        const newCount = list.querySelectorAll(".gallery-comment-row").length;
        const currentLikesText = likeSpan.textContent.split("•")[0].trim(); // "❤️ 3"
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
      console.log("Loading gallery from:", `${API_BASE}/gallery/posts`);
      const res = await fetch(`${API_BASE}/gallery/posts`);

      // If HTTP error
      if (!res.ok) {
        let extra = "";
        try {
          const errData = await res.json();
          console.log("Gallery error payload:", errData);
          if (errData && errData.error) extra = ` (${errData.error})`;
        } catch (_) {}

        grid.innerHTML = `<p class="text-error">Failed to load pup gallery.${extra}</p>`;
        return;
      }

      const data = await res.json().catch(() => null);
      console.log("Gallery data:", data);

      if (!data || !Array.isArray(data.posts)) {
        grid.innerHTML = `<p class="text-error">Failed to load pup gallery (bad response shape).</p>`;
        return;
      }

      const posts = data.posts;
      if (!posts.length) {
        grid.innerHTML = `<p class="text-muted">No pup posts yet. Be the first to share!</p>`;
        return;
      }

      grid.innerHTML = "";
      posts.forEach((post) => {
        const card = renderPostCard(post);
        grid.appendChild(card);
      });
    } catch (err) {
      console.error("HOME_GALLERY_FETCH_ERROR:", err);
      grid.innerHTML = `<p class="text-error">Failed to load pup gallery (network error).</p>`;
    }
  }

function renderFeaturedSitters() {
  const grid = document.getElementById("homeSitterGrid");
  if (!grid) return;

  const sitters =
    (window.PetCareState && typeof window.PetCareState.getSitters === "function"
      ? window.PetCareState.getSitters()
      : []) || [];

  const list = Array.isArray(sitters) ? sitters.slice(0, 6) : [];
  if (!list.length) {
    grid.innerHTML = `<p class="text-muted">No sitters loaded yet.</p>`;
    return;
  }

  grid.innerHTML = "";
  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "mini-card";
    const avatar = s.avatar || s.avatar_url || "";
    const name = s.name || "Sitter";
    const city = s.city || "";
    const rating = s.rating != null ? String(s.rating) : "5.0";
    const distance = s.distance || "";

    card.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center;">
        <div class="mini-avatar" style="${avatar ? `background-image:url('${avatar}')` : ""}"></div>
        <div style="flex:1;">
          <div style="font-weight:700; line-height:1.2;">${name}</div>
          <div class="small text-muted">${city} ${distance ? `• ${distance}` : ""}</div>
          <div class="small">★ ${rating}</div>
        </div>
        <button type="button" class="btn-small">View</button>
      </div>
    `;

    card.querySelector("button")?.addEventListener("click", () => {
      try {
        if (window.PetCareState?.ui) window.PetCareState.ui.selectedSitterId = s.id;
      } catch (_) {}
      if (typeof window.setActivePage === "function") window.setActivePage("swipePage");
    });

    grid.appendChild(card);
  });
}

  // Expose init for app.js
  window.initHomePage = function () {
    renderFeaturedSitters();
    loadPupGallery();
  };
})();