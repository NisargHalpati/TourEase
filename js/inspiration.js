/**
 * TourEase Inspiration & Community Stories Module
 * Full feed with reliable fallback, State/Category/Difficulty filtering, Lightbox, Bucketlist save, and local persistence.
 */

const INSPIRATION_RETURN_KEY = "tourease_inspiration_return";
const LOCAL_POSTS_KEY = "tourease_local_posts";
const LOCAL_LIKES_KEY = "tourease_local_likes";
const LOCAL_COMMENTS_KEY = "tourease_local_comments";
const PLACEHOLDER_IMAGE = "assets/travel-placeholder.svg";

// Elements
const feedRoot = document.getElementById("inspiration-feed");
const storyCountEl = document.getElementById("inspiration-story-count");
const activeTagsEl = document.getElementById("inspiration-active-tags");
const searchInput = document.getElementById("inspiration-search");
const stateSelect = document.getElementById("insp-state-select");
const vibeChips = document.querySelectorAll(".insp-chip");
const diffPills = document.querySelectorAll(".insp-diff-pill");
const clearFiltersBtn = document.getElementById("clear-inspiration-filters");

// Lightbox Elements
const lightboxModal = document.getElementById("image-lightbox-modal");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxDesc = document.getElementById("lightbox-desc");
const closeLightboxBtn = document.getElementById("close-lightbox");
const lightboxBackdrop = document.getElementById("lightbox-backdrop");

// Create Post Modal Elements
const createButton = document.getElementById("create-post-button");
const heroCreateBtn = document.getElementById("hero-create-btn");
const modal = document.getElementById("create-post-modal");
const createPostForm = document.getElementById("create-post-form");
const closePostModalButton = document.getElementById("close-post-modal");
const cancelPostButton = document.getElementById("cancel-post-form");
const submitPostButton = createPostForm.querySelector('button[type="submit"]');
const postImageInput = document.getElementById("post-image");
const postImageFileInput = document.getElementById("post-image-file");
const postImagePreview = document.getElementById("post-image-preview");
const postImagePreviewImage = document.getElementById("post-image-preview-image");
const postFormStatus = document.getElementById("post-form-status");

// Account Elements
const loginRequiredMessage = document.getElementById("login-required-message");
const authStatus = document.getElementById("inspiration-auth-status");
const memberActions = document.getElementById("inspiration-member-actions");
const accountAvatarImage = document.getElementById("account-avatar-image");
const accountAvatarFallback = document.getElementById("account-avatar-fallback");
const accountUserName = document.getElementById("account-user-name");

// State
let allStories = [];
let filteredStories = [];
let currentUser = null;
let currentProfile = null;
let postImagePreviewUrl = null;
let activeFilters = {
  search: "",
  state: "",
  category: "",
  difficulty: "",
};

// Helper: infer category & difficulty if missing
function inferStoryDetails(caption = "", location = "") {
  const text = (caption + " " + location).toLowerCase();
  let category = "nature";
  let difficulty = "Moderate";

  if (text.includes("beach") || text.includes("sunset") || text.includes("water") || text.includes("slow") || text.includes("coast") || text.includes("goa") || text.includes("kerala")) {
    category = "beach";
    difficulty = "Easy";
  } else if (text.includes("fort") || text.includes("desert") || text.includes("temple") || text.includes("palace") || text.includes("rajasthan") || text.includes("heritage")) {
    category = "heritage";
    difficulty = "Easy";
  } else if (text.includes("ladakh") || text.includes("high") || text.includes("climb") || text.includes("steep") || text.includes("challenging") || text.includes("pass")) {
    category = "mountains";
    difficulty = "Hard";
  } else if (text.includes("road") || text.includes("trip") || text.includes("drive") || text.includes("himachal")) {
    category = "roadtrip";
    difficulty = "Moderate";
  } else if (text.includes("mountain") || text.includes("valley") || text.includes("kashmir") || text.includes("hill")) {
    category = "mountains";
    difficulty = "Moderate";
  } else if (text.includes("rain") || text.includes("cloud") || text.includes("waterfall") || text.includes("mist") || text.includes("meghalaya")) {
    category = "nature";
    difficulty = "Moderate";
  }

  return { category, difficulty };
}

function getSafeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch (error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// Local Storage Helpers
function getLocalPosts() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function saveLocalPost(post) {
  const existing = getLocalPosts();
  existing.unshift(post);
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(existing));
}

function getLocalLikes() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LIKES_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function setLocalLike(postId, liked) {
  const likes = getLocalLikes();
  if (liked) likes[postId] = true;
  else delete likes[postId];
  localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(likes));
}

function getLocalComments() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_COMMENTS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function addLocalComment(postId, comment) {
  const comments = getLocalComments();
  if (!comments[postId]) comments[postId] = [];
  comments[postId].push(comment);
  localStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(comments));
}

// Lightbox
function openLightbox(imageUrl, title, desc) {
  if (!lightboxModal) return;
  lightboxImage.src = imageUrl;
  lightboxTitle.textContent = title;
  lightboxDesc.textContent = desc;
  lightboxModal.hidden = false;
  lightboxModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!lightboxModal) return;
  lightboxModal.hidden = true;
  lightboxModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

if (closeLightboxBtn) closeLightboxBtn.addEventListener("click", closeLightbox);
if (lightboxBackdrop) lightboxBackdrop.addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightboxModal && !lightboxModal.hidden) {
    closeLightbox();
  }
});

// Like Action
function handleLike(postId, button, countSpan) {
  const story = allStories.find((s) => String(s.id) === String(postId));
  if (!story) return;

  const currentLiked = story.isLiked;
  const newLiked = !currentLiked;
  story.isLiked = newLiked;
  story.likes = Math.max(0, (story.likes || 0) + (newLiked ? 1 : -1));

  button.classList.toggle("is-liked", newLiked);
  countSpan.textContent = String(story.likes);
  setLocalLike(postId, newLiked);

  // If Supabase is connected, optionally sync
  if (window.supabaseClient && currentUser) {
    if (newLiked) {
      window.supabaseClient.from("post_likes").insert({ post_id: postId, user_id: currentUser.id }).catch(() => {});
    } else {
      window.supabaseClient.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUser.id).catch(() => {});
    }
  }
}

// Add Comment Action
function handleAddComment(postId, input, listContainer, countSpan) {
  const text = input.value.trim();
  if (!text) return;

  const story = allStories.find((s) => String(s.id) === String(postId));
  const authorName = currentProfile?.display_name || (currentUser ? "You" : "Fellow Traveler");
  const newComment = {
    id: `comm-${Date.now()}`,
    postId: String(postId),
    author: authorName,
    text,
    date: new Date().toISOString(),
  };

  if (!story.comments) story.comments = [];
  story.comments.push(newComment);
  addLocalComment(postId, newComment);

  const item = document.createElement("div");
  item.className = "comment-item";
  const author = document.createElement("span");
  author.className = "comment-item__author";
  author.textContent = authorName;
  const comment = document.createElement("span");
  comment.className = "comment-item__text";
  comment.textContent = text;
  item.append(author, comment);
  listContainer.appendChild(item);

  input.value = "";
  if (countSpan) countSpan.textContent = String(story.comments.length);
}

// Card Renderer
function createStoryCard(story) {
  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.postId = story.id;
  card.id = `story-${story.id}`;

  const initials = (story.author || "T")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isSaved = window.tourEaseBucketlist ? window.tourEaseBucketlist.isSaved(story.id) : false;

  // Format Difficulty Badge
  const diff = story.difficulty || "Moderate";
  const normDiff = diff.toLowerCase();
  let diffBadgeClass = "badge--moderate";
  let diffLabel = `🟡 ${diff}`;
  if (normDiff.includes("easy")) {
    diffBadgeClass = "badge--easy";
    diffLabel = `🟢 ${diff}`;
  } else if (normDiff.includes("hard") || normDiff.includes("difficult")) {
    diffBadgeClass = "badge--hard";
    diffLabel = `🔴 ${diff}`;
  }

  // Format Category
  const categoryLabels = {
    mountains: "🏔️ Mountains",
    beach: "🏖️ Beach",
    heritage: "🏛️ Heritage",
    nature: "🌲 Nature",
    roadtrip: "🎒 Road Trip",
  };
  const vibeLabel = categoryLabels[story.category] || "✈️ Travel";

  const imageUrl = getSafeImageUrl(story.image) || PLACEHOLDER_IMAGE;
  card.innerHTML = `
    <div class="post-card__header">
      <div class="post-user">
        <div class="post-user__avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="post-user__names">
          <span class="post-user__name">${escapeHtml(story.author)}</span>
          <span class="post-user__location">📍 ${escapeHtml(story.location)}</span>
        </div>
      </div>
      <span class="post-date">${formatDisplayDate(story.date)}</span>
    </div>

    <div class="post-card__media" title="Click to view photo full size">
      <img class="post-card__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(story.location)} travel capture" loading="lazy">
      <div class="post-card__badges">
        <span class="post-card__vibe-badge">${vibeLabel}</span>
        <span class="post-card__diff-badge ${diffBadgeClass}">${escapeHtml(diffLabel)}</span>
      </div>
      <button class="story-card__save-btn ${isSaved ? "is-saved" : ""}" type="button" aria-label="${isSaved ? "Remove from saved" : "Save story"}" title="Save story" data-save-id="${escapeHtml(story.id)}">
        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      </button>
    </div>

    <div class="post-actions">
      <button type="button" class="action-button ${story.isLiked ? "is-liked" : ""}" data-like-btn="${escapeHtml(story.id)}" aria-label="Like story">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span class="like-count">${Number.isFinite(Number(story.likes)) ? Math.max(0, Math.trunc(Number(story.likes))) : 0}</span>
      </button>

      <button type="button" class="action-button" data-comment-toggle="${escapeHtml(story.id)}" aria-label="View comments">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="comment-count">${story.comments?.length || 0}</span>
      </button>
    </div>

    <p class="post-caption">${escapeHtml(story.caption)}</p>

    <div class="post-comments" data-comments-box="${escapeHtml(story.id)}">
      <p class="post-comments__title">Comments (${story.comments?.length || 0})</p>
      <div class="comment-list" data-comment-list="${escapeHtml(story.id)}">
        ${(story.comments || []).map((c) => `
          <div class="comment-item">
            <span class="comment-item__author">${escapeHtml(c.author)}</span>
            <span class="comment-item__text">${escapeHtml(c.text)}</span>
          </div>
        `).join("")}
      </div>
      <form class="comment-form" data-comment-form="${escapeHtml(story.id)}">
        <input type="text" placeholder="Add a comment or ask a question..." aria-label="Comment text" required>
        <button type="submit">Post</button>
      </form>
    </div>
  `;

  // Attach event handlers
  const mediaEl = card.querySelector(".post-card__media");
  mediaEl.addEventListener("click", (e) => {
    if (e.target.closest(".story-card__save-btn")) return;
    openLightbox(imageUrl, `${story.location} · by ${story.author}`, story.caption);
  });

  const saveBtn = card.querySelector(".story-card__save-btn");
  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.tourEaseBucketlist) {
      window.tourEaseBucketlist.toggle({
        id: story.id,
        name: `${story.location} (Story)`,
        location: story.location,
        image: story.image,
        category: vibeLabel,
        difficulty: story.difficulty,
        url: `inspiration.html#story-${story.id}`,
        type: "story",
      });
    }
  });

  const likeBtn = card.querySelector("[data-like-btn]");
  const likeCountSpan = card.querySelector(".like-count");
  likeBtn.addEventListener("click", () => {
    handleLike(story.id, likeBtn, likeCountSpan);
  });

  const commentForm = card.querySelector("[data-comment-form]");
  const commentInput = commentForm.querySelector("input");
  const commentList = card.querySelector("[data-comment-list]");
  const commentCountSpan = card.querySelector(".comment-count");
  commentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleAddComment(story.id, commentInput, commentList, commentCountSpan);
  });

  return card;
}

// Render Feed
function renderFeed() {
  if (!feedRoot) return;

  const q = activeFilters.search.toLowerCase();
  const stateF = activeFilters.state.toLowerCase();
  const catF = activeFilters.category.toLowerCase();
  const diffF = activeFilters.difficulty.toLowerCase();

  filteredStories = allStories.filter((s) => {
    // Search
    if (q) {
      const haystack = `${s.caption} ${s.location} ${s.author}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    // State
    if (stateF) {
      const loc = (s.location || "").toLowerCase();
      if (!loc.includes(stateF)) return false;
    }
    // Category
    if (catF) {
      if ((s.category || "").toLowerCase() !== catF) return false;
    }
    // Difficulty
    if (diffF) {
      const storyDiff = (s.difficulty || "").toLowerCase();
      if (diffF === "easy" && !storyDiff.includes("easy")) return false;
      if (diffF === "moderate" && !storyDiff.includes("moderate")) return false;
      if (diffF === "hard" && !storyDiff.includes("hard") && !storyDiff.includes("difficult")) return false;
    }
    return true;
  });

  feedRoot.innerHTML = "";
  if (!filteredStories.length) {
    feedRoot.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; color: var(--color-text-secondary);">
        <p style="font-size: 1.25rem; font-weight: 700; color: var(--color-text); margin: 0 0 0.5rem;">No stories found matching your filters</p>
        <p style="margin: 0 0 1.25rem;">Try choosing another state, category, or difficulty level.</p>
        <button id="reset-feed-btn" class="btn btn-secondary" type="button">Reset All Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById("reset-feed-btn");
    if (resetBtn) resetBtn.addEventListener("click", clearAllFilters);
  } else {
    filteredStories.forEach((story) => {
      feedRoot.appendChild(createStoryCard(story));
    });
  }

  // Update counter
  if (storyCountEl) {
    storyCountEl.textContent = `Showing ${filteredStories.length} ${filteredStories.length === 1 ? "story" : "community stories"}`;
  }

  // Update active tags
  renderActiveTags();
}

function renderActiveTags() {
  if (!activeTagsEl) return;
  activeTagsEl.innerHTML = "";

  if (activeFilters.search) {
    createTagChip(`Search: "${activeFilters.search}"`, () => {
      activeFilters.search = "";
      if (searchInput) searchInput.value = "";
      renderFeed();
    });
  }
  if (activeFilters.state) {
    createTagChip(`State: ${activeFilters.state}`, () => {
      activeFilters.state = "";
      if (stateSelect) stateSelect.value = "";
      renderFeed();
    });
  }
  if (activeFilters.category) {
    createTagChip(`Category: ${activeFilters.category}`, () => {
      activeFilters.category = "";
      vibeChips.forEach((c) => c.classList.toggle("is-active", c.dataset.vibe === ""));
      renderFeed();
    });
  }
  if (activeFilters.difficulty) {
    let diffName = activeFilters.difficulty;
    if (diffName === "easy") diffName = "🟢 Easy";
    else if (diffName === "moderate") diffName = "🟡 Moderate";
    else if (diffName === "hard") diffName = "🔴 Hard";
    createTagChip(`Difficulty: ${diffName}`, () => {
      activeFilters.difficulty = "";
      diffPills.forEach((p) => p.classList.toggle("is-active", p.dataset.inspDiff === ""));
      renderFeed();
    });
  }
}

function createTagChip(label, onRemove) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "insp-tag-chip";
  chip.append(document.createTextNode(`${label} `));
  const closeIcon = document.createElement("span");
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "✕";
  chip.append(closeIcon);
  chip.addEventListener("click", onRemove);
  activeTagsEl.appendChild(chip);
}

function clearAllFilters() {
  activeFilters = { search: "", state: "", category: "", difficulty: "" };
  if (searchInput) searchInput.value = "";
  if (stateSelect) stateSelect.value = "";
  vibeChips.forEach((c) => c.classList.toggle("is-active", c.dataset.vibe === ""));
  diffPills.forEach((p) => p.classList.toggle("is-active", p.dataset.inspDiff === ""));
  renderFeed();
}

// Setup Feed Filter Listeners
function setupFilterListeners() {
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeFilters.search = searchInput.value.trim();
      renderFeed();
    });
  }

  if (stateSelect) {
    stateSelect.addEventListener("change", () => {
      activeFilters.state = stateSelect.value;
      renderFeed();
    });
  }

  vibeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      vibeChips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeFilters.category = chip.dataset.vibe || "";
      renderFeed();
    });
  });

  diffPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      diffPills.forEach((p) => p.classList.remove("is-active"));
      pill.classList.add("is-active");
      activeFilters.difficulty = pill.dataset.inspDiff || "";
      renderFeed();
    });
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", clearAllFilters);
  }
}

// Load Stories from Supabase or Fallback to JSON
async function loadFeed() {
  if (storyCountEl) storyCountEl.textContent = "Loading community stories...";
  const localLikes = getLocalLikes();
  const localComments = getLocalComments();
  const localPosts = getLocalPosts();

  let remotePosts = [];

  // Attempt Supabase fetch
  if (window.supabaseClient) {
    try {
      const { data, error } = await window.supabaseClient
        .from("posts")
        .select("id, user_id, author_name, location, caption, image_url, created_at, is_starter")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        remotePosts = data.map((row) => {
          const details = inferStoryDetails(row.caption, row.location);
          return {
            id: String(row.id),
            author: row.author_name || "Traveler",
            location: row.location || "India",
            caption: row.caption || "",
            image: getSafeImageUrl(row.image_url) || PLACEHOLDER_IMAGE,
            date: row.created_at,
            category: details.category,
            difficulty: details.difficulty,
            likes: 15,
            comments: [],
            isLiked: Boolean(localLikes[String(row.id)]),
          };
        });
      }
    } catch (e) {
      console.warn("Supabase fetch skipped, loading local & starter posts.", e);
    }
  }

  // Fallback to starter posts if remote empty
  if (!remotePosts.length) {
    try {
      const res = await fetch("data/posts.json");
      if (res.ok) {
        const starterData = await res.json();
        remotePosts = starterData.map((p) => {
          const details = inferStoryDetails(p.caption, p.location);
          return {
            id: String(p.id),
            author: p.author || "Traveler",
            location: p.location || "India",
            caption: p.caption || "",
            image: getSafeImageUrl(p.image) || PLACEHOLDER_IMAGE,
            date: p.date || new Date().toISOString(),
            category: details.category,
            difficulty: details.difficulty,
            likes: p.likes || 24,
            comments: (p.comments || []).map((c) => ({
              id: String(c.id),
              author: c.author,
              text: c.text,
              date: c.date,
            })),
            isLiked: Boolean(localLikes[String(p.id)]),
          };
        });
      }
    } catch (err) {
      console.warn("Unable to fetch starter posts.json", err);
    }
  }

  // Merge with locally created posts
  const mappedLocal = localPosts.map((p) => ({
    ...p,
    id: String(p.id),
    image: getSafeImageUrl(p.image) || PLACEHOLDER_IMAGE,
    likes: p.likes || 1,
    comments: p.comments || [],
    isLiked: Boolean(localLikes[String(p.id)]),
  }));

  // Merge extra local comments
  allStories = [...mappedLocal, ...remotePosts].map((story) => {
    const extraComments = localComments[story.id] || [];
    return {
      ...story,
      comments: [...(story.comments || []), ...extraComments],
    };
  });

  renderFeed();
}

// Modal handling
function openModal() {
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  createPostForm.reset();
  if (postImagePreviewUrl) {
    URL.revokeObjectURL(postImagePreviewUrl);
    postImagePreviewUrl = null;
  }
  submitPostButton.disabled = false;
  submitPostButton.textContent = "Share Post";
  if (postImagePreview) postImagePreview.hidden = true;
  if (postFormStatus) postFormStatus.hidden = true;
}

if (closePostModalButton) closePostModalButton.addEventListener("click", closeModal);
if (cancelPostButton) cancelPostButton.addEventListener("click", closeModal);
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target.dataset.closeModal === "true") closeModal();
  });
}
if (createButton) createButton.addEventListener("click", openModal);
if (heroCreateBtn) heroCreateBtn.addEventListener("click", openModal);

// Image File Preview
if (postImageFileInput) {
  postImageFileInput.addEventListener("change", () => {
    const file = postImageFileInput.files?.[0];
    if (file) {
      postImageInput.value = "";
      if (postImagePreviewUrl) URL.revokeObjectURL(postImagePreviewUrl);
      postImagePreviewUrl = URL.createObjectURL(file);
      postImagePreviewImage.src = postImagePreviewUrl;
      postImagePreview.hidden = false;
    }
  });
}

const removeImgBtn = document.getElementById("remove-post-image");
if (removeImgBtn) {
  removeImgBtn.addEventListener("click", () => {
    postImageFileInput.value = "";
    if (postImagePreviewUrl) {
      URL.revokeObjectURL(postImagePreviewUrl);
      postImagePreviewUrl = null;
    }
    postImagePreview.hidden = true;
  });
}

// Form Submit: Save Story
createPostForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const caption = document.getElementById("post-caption").value.trim();
  const location = document.getElementById("post-location").value.trim() || "India";
  const state = document.getElementById("post-state")?.value || "";
  const category = document.getElementById("post-category")?.value || "mountains";
  const difficulty = document.getElementById("post-difficulty")?.value || "Moderate";
  const imageFile = postImageFileInput.files?.[0] || null;
  const providedImageUrl = postImageInput.value.trim();
  let imageUrl = providedImageUrl
    ? getSafeImageUrl(providedImageUrl)
    : "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

  if (!caption) {
    postFormStatus.textContent = "Please enter a caption for your story.";
    postFormStatus.hidden = false;
    postFormStatus.classList.add("is-error");
    return;
  }

  if (providedImageUrl && !imageUrl) {
    postFormStatus.textContent = "Enter a valid HTTP or HTTPS image URL.";
    postFormStatus.hidden = false;
    postFormStatus.classList.add("is-error");
    return;
  }

  const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
  if (imageFile && (!allowedImageTypes.has(imageFile.type) || imageFile.size > 5 * 1024 * 1024)) {
    postFormStatus.textContent = "Choose a JPEG, PNG, WebP, GIF, or AVIF image no larger than 5 MB.";
    postFormStatus.hidden = false;
    postFormStatus.classList.add("is-error");
    return;
  }

  if (imageFile && (!currentUser || !window.supabaseClient)) {
    postFormStatus.textContent = "Log in to upload an image. You can still share a post with an image URL.";
    postFormStatus.hidden = false;
    postFormStatus.classList.add("is-error");
    return;
  }

  submitPostButton.disabled = true;
  submitPostButton.textContent = imageFile ? "Uploading image..." : "Sharing...";

  const authorName = currentProfile?.display_name || (currentUser ? "You" : "Community Traveler");
  const fullLocation = state && !location.toLowerCase().includes(state.toLowerCase()) ? `${location}, ${state}` : location;

  const newPost = {
    id: `local-${Date.now()}`,
    author: authorName,
    location: fullLocation,
    caption,
    image: imageUrl,
    date: new Date().toISOString(),
    category,
    difficulty,
    likes: 1,
    comments: [],
    isUserPost: true,
  };

  let uploadedImagePath = null;
  try {
    if (imageFile) {
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/avif": "avif",
      }[imageFile.type];
      uploadedImagePath = `${currentUser.id}/${window.crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await window.supabaseClient.storage
        .from("inspiration-images")
        .upload(uploadedImagePath, imageFile, { contentType: imageFile.type, upsert: false });
      if (uploadError) throw uploadError;
      const publicUrl = window.supabaseClient.storage
        .from("inspiration-images")
        .getPublicUrl(uploadedImagePath).data.publicUrl;
      imageUrl = getSafeImageUrl(publicUrl);
      if (!imageUrl) throw new Error("The uploaded image URL could not be verified.");
    }

    if (window.supabaseClient && currentUser) {
      const { error } = await window.supabaseClient.from("posts").insert({
        id: window.crypto.randomUUID(),
        user_id: currentUser.id,
        author_name: authorName,
        location: fullLocation,
        caption,
        image_url: imageUrl,
        created_at: newPost.date,
        is_starter: false,
      });
      if (error) throw error;
      await loadFeed();
    } else {
      newPost.image = imageUrl;
      saveLocalPost(newPost);
      allStories.unshift(newPost);
      renderFeed();
    }
    closeModal();
  } catch (error) {
    if (uploadedImagePath) {
      try {
        await window.supabaseClient.storage.from("inspiration-images").remove([uploadedImagePath]);
      } catch (cleanupError) {
        console.warn("Unable to remove the image after its post failed to save.", cleanupError);
      }
    }
    postFormStatus.textContent = error.message || "Your post could not be shared. Please try again.";
    postFormStatus.hidden = false;
    postFormStatus.classList.add("is-error");
    submitPostButton.disabled = false;
    submitPostButton.textContent = "Share Post";
  }
});

// Auth / Profile Status Sync
async function syncAuth() {
  if (!window.supabaseClient) return;
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    currentUser = session?.user || null;

    if (currentUser) {
      if (loginRequiredMessage) loginRequiredMessage.hidden = true;
      if (memberActions) memberActions.hidden = false;
      const { data } = await window.supabaseClient
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", currentUser.id)
        .maybeSingle();

      currentProfile = data || { display_name: currentUser.user_metadata?.display_name || "Traveler" };
      if (accountUserName) accountUserName.textContent = currentProfile.display_name;
      if (accountAvatarFallback) {
        accountAvatarFallback.textContent = (currentProfile.display_name || "T")[0].toUpperCase();
      }
      if (currentProfile.avatar_url && accountAvatarImage) {
        accountAvatarImage.src = currentProfile.avatar_url;
        accountAvatarImage.hidden = false;
        if (accountAvatarFallback) accountAvatarFallback.hidden = true;
      }
    } else {
      if (loginRequiredMessage) loginRequiredMessage.hidden = false;
      if (memberActions) memberActions.hidden = true;
    }
  } catch (e) {
    console.warn("Supabase auth check error", e);
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupFilterListeners();
  void syncAuth();
  void loadFeed();
});
