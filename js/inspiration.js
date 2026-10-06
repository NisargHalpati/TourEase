const USER_POSTS_KEY = "tourease_posts";
const CURRENT_USER_KEY = "tourease_current_user";
const LIKES_KEY = "tourease_likes";
const COMMENTS_KEY = "tourease_comments";
const NOTIFICATIONS_KEY = "tourease_notifications";
const INSPIRATION_RETURN_KEY = "tourease_inspiration_return";
const PLACEHOLDER_IMAGE = "assets/travel-placeholder.svg";

const feedRoot = document.getElementById("inspiration-feed");
const createButton = document.getElementById("create-post-button");
const loginRequiredMessage = document.getElementById("login-required-message");
const memberActions = document.getElementById("inspiration-member-actions");
const accountAvatarImage = document.getElementById("account-avatar-image");
const accountAvatarFallback = document.getElementById("account-avatar-fallback");
const accountUserName = document.getElementById("account-user-name");
const notificationBell = document.getElementById("notification-bell");
const notificationPanel = document.getElementById("notification-panel");
const notificationList = document.getElementById("notification-list");
const markNotificationsReadButton = document.getElementById("mark-notifications-read");
const notificationBellCount = document.getElementById("notification-bell-count");
const modal = document.getElementById("create-post-modal");
const createPostForm = document.getElementById("create-post-form");
const closePostModalButton = document.getElementById("close-post-modal");
const cancelPostButton = document.getElementById("cancel-post-form");
const createPostTitle = document.getElementById("create-post-title");
const submitPostButton = createPostForm.querySelector('button[type="submit"]');
const restoreRequested = new URLSearchParams(window.location.search).get("restore") === "1";
const inspirationParams = new URLSearchParams(window.location.search);
const returnToProfile = inspirationParams.get("returnToProfile") === "1";

if (restoreRequested) {
  window.history.scrollRestoration = "manual";
  window.addEventListener("pagehide", () => {
    window.history.scrollRestoration = "auto";
  }, { once: true });
}

let inspirationReturnState = null;
let hasRestoredInspirationState = false;
let pageHasShown = false;
let editingPostId = null;

window.addEventListener("pageshow", () => {
  pageHasShown = true;
}, { once: true });

if (restoreRequested) {
  try {
    const savedState = window.sessionStorage.getItem(INSPIRATION_RETURN_KEY);
    inspirationReturnState = savedState ? JSON.parse(savedState) : null;
  } catch (error) {
    console.error("Unable to read saved Inspirations state.", error);
  }
}

let defaultPosts = [];

function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw);
    return user && typeof user.name === "string" ? user : null;
  } catch (error) {
    console.error("Unable to read current user.", error);
    return null;
  }
}

function syncAccountActions() {
  const currentUser = getCurrentUser();
  const isLoggedIn = Boolean(currentUser);
  loginRequiredMessage.hidden = isLoggedIn;
  memberActions.hidden = !isLoggedIn;
  notificationBell.hidden = !isLoggedIn;
  if (!isLoggedIn) {
    setNotificationPanelOpen(false);
    return;
  }

  accountUserName.textContent = currentUser.name;
  accountAvatarFallback.textContent = currentUser.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase();
  const avatar = currentUser.profileImage
    || currentUser.avatar
    || currentUser.image
    || currentUser.photoURL;
  const avatarUrl = typeof avatar === "string" ? avatar : avatar?.url;
  accountAvatarImage.hidden = !avatarUrl;
  accountAvatarFallback.hidden = Boolean(avatarUrl);
  if (avatarUrl) {
    accountAvatarImage.src = avatarUrl;
    accountAvatarImage.onerror = () => {
      accountAvatarImage.hidden = true;
      accountAvatarFallback.hidden = false;
    };
  } else {
    accountAvatarImage.removeAttribute("src");
  }
  renderNotifications();
}

function getSavedPosts() {
  try {
    const raw = window.localStorage.getItem(USER_POSTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read saved posts.", error);
    return [];
  }
}

function getLikeState() {
  try {
    const raw = window.localStorage.getItem(LIKES_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Unable to read like state.", error);
    return {};
  }
}

function setLikeState(state) {
  window.localStorage.setItem(LIKES_KEY, JSON.stringify(state));
}

function getComments() {
  try {
    const raw = window.localStorage.getItem(COMMENTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read comments.", error);
    return [];
  }
}

function saveComments(comments) {
  window.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
}

function getNotifications() {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to read notifications.", error);
    return [];
  }
}

function getUserNotifications() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return [];
  }
  const email = currentUser.email?.toLocaleLowerCase();
  return getNotifications().filter((notification) => (
    notification.recipientEmail
      ? notification.recipientEmail.toLocaleLowerCase() === email
      : notification.recipient === currentUser.name
  ));
}

function renderNotifications() {
  const notifications = getUserNotifications()
    .sort((first, second) => new Date(second.date) - new Date(first.date));
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  notificationBellCount.hidden = unreadCount === 0;
  notificationBellCount.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  markNotificationsReadButton.disabled = unreadCount === 0;
  notificationList.replaceChildren();

  if (!notifications.length) {
    const empty = document.createElement("p");
    empty.className = "notification-empty";
    empty.textContent = "You’re all caught up.";
    notificationList.append(empty);
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("button");
    item.className = `notification-item${notification.read ? "" : " is-unread"}`;
    item.type = "button";
    item.dataset.notificationId = String(notification.id);
    item.dataset.postId = String(notification.postId);
    item.dataset.notificationType = notification.type;
    const copy = document.createElement("span");
    copy.className = "notification-item__copy";
    const actor = document.createElement("span");
    actor.className = "notification-item__actor";
    actor.textContent = notification.actor || "Someone";
    copy.append(actor, document.createTextNode(` ${notification.message || "interacted with your post"}`));
    const date = document.createElement("time");
    date.className = "notification-item__date";
    date.dateTime = notification.date || "";
    date.textContent = formatRelativeDate(notification.date);
    copy.append(date);
    const indicator = document.createElement("span");
    indicator.className = "notification-item__indicator";
    indicator.setAttribute("aria-hidden", "true");
    item.append(copy, indicator);
    notificationList.append(item);
  });
}

function formatRelativeDate(dateString) {
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return "Recently";
  }
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, unitSeconds] = units.find(([, size]) => Math.abs(seconds) >= size) || units[6];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    .format(Math.round(seconds / unitSeconds), unit);
}

function addNotification(post, currentUser, type) {
  if (!currentUser || !post) {
    return;
  }
  const ownerEmail = post.authorEmail || "";
  const isOwnPost = ownerEmail
    ? ownerEmail.toLocaleLowerCase() === currentUser.email?.toLocaleLowerCase()
    : post.author === currentUser.name;
  if (isOwnPost) {
    return;
  }

  const action = type === "like" ? "liked" : "commented on";
  const notifications = getNotifications();
  notifications.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    recipient: ownerEmail || post.author,
    recipientEmail: ownerEmail,
    recipientName: post.author,
    actor: currentUser.name,
    actorEmail: currentUser.email,
    type,
    postId: post.id,
    message: `${action} your post`,
    date: new Date().toISOString(),
    read: false,
  });
  window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function setNotificationsRead() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return;
  }
  const email = currentUser.email?.toLocaleLowerCase();
  const notifications = getNotifications().map((notification) => {
    const belongsToUser = notification.recipientEmail
      ? notification.recipientEmail.toLocaleLowerCase() === email
      : notification.recipient === currentUser.name;
    return belongsToUser ? { ...notification, read: true } : notification;
  });
  window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  renderNotifications();
}

function markNotificationRead(notificationId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return;
  }
  const email = currentUser.email?.toLocaleLowerCase();
  const notifications = getNotifications().map((notification) => {
    const belongsToUser = notification.recipientEmail
      ? notification.recipientEmail.toLocaleLowerCase() === email
      : notification.recipient === currentUser.name;
    return belongsToUser && String(notification.id) === String(notificationId)
      ? { ...notification, read: true }
      : notification;
  });
  window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  renderNotifications();
}

function toggleNotificationPanel() {
  setNotificationPanelOpen(notificationPanel.hidden);
}

function setNotificationPanelOpen(isOpen) {
  notificationPanel.hidden = !isOpen;
  notificationBell.setAttribute("aria-expanded", String(isOpen));
}

function createPlaceholderImage() {
  return PLACEHOLDER_IMAGE;
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizePost(post, isUserPost = false) {
  const author = post.author || "TourEase";
  const caption = post.caption || post.description || "";
  const image = post.image || PLACEHOLDER_IMAGE;
  const location = post.location || "India";
  const date = post.date || new Date().toISOString();

  return {
    id: post.id,
    author,
    authorEmail: post.authorEmail,
    caption,
    image,
    location,
    date,
    likes: Number(post.likes ?? 0),
    comments: Array.isArray(post.comments) ? post.comments : [],
    isUserPost,
  };
}

function isPostOwner(post, currentUser) {
  if (!post.isUserPost || !currentUser) {
    return false;
  }
  if (post.authorEmail) {
    return post.authorEmail.toLocaleLowerCase() === currentUser.email?.toLocaleLowerCase();
  }
  return post.author === currentUser.name;
}

function getPosts() {
  const savedPosts = getSavedPosts().map((post) => normalizePost(post, true));
  const seedPosts = defaultPosts.map((post) => normalizePost(post, false));

  const sorted = [...savedPosts, ...seedPosts].sort((postA, postB) => {
    const rankA = postA.isUserPost ? 0 : 1;
    const rankB = postB.isUserPost ? 0 : 1;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return new Date(postB.date) - new Date(postA.date);
  });

  return sorted;
}

function renderFeed() {
  const posts = getPosts();
  const likeState = getLikeState();
  const savedComments = getComments();

  if (!posts.length) {
    feedRoot.innerHTML = '<article class="post-card"><div class="post-caption">No stories to show yet.</div></article>';
    restoreInspirationState();
    return;
  }

  feedRoot.innerHTML = posts
    .map((post) => {
      const defaultComments = Array.isArray(post.comments) ? post.comments : [];
      const comments = [
        ...defaultComments,
        ...savedComments.filter((comment) => String(comment.postId) === String(post.id)),
      ];
      const isLiked = Boolean(likeState[post.id]);
      const visibleLikeCount = post.likes + (isLiked ? 1 : 0);
      const commentCount = comments.length;
      const initials = post.author
        .split(" ")
        .map((name) => name[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return `
        <article class="post-card" data-post-id="${post.id}">
          <div class="post-card__header">
            <div class="post-user">
              <div class="post-user__avatar" aria-hidden="true">${initials}</div>
              <div class="post-user__names">
                <span class="post-user__name">${post.author}</span>
                <span class="post-user__location">${post.location}</span>
              </div>
            </div>
            <span class="post-date">${formatDisplayDate(post.date)}</span>
          </div>

          <div class="post-card__media">
            ${post.image ? `<img class="post-card__image" src="${post.image}" alt="${post.location || "Travel"} scene" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}';">` : `<div class="post-card__placeholder">A journey waiting to be captured.</div>`}
          </div>

          <div class="post-actions">
            <button class="action-button ${isLiked ? "is-liked" : ""}" type="button" data-like-id="${post.id}" aria-label="Like this post">
              <span aria-hidden="true">${isLiked ? "♥" : "♡"}</span>
              <span class="action-button__count">${visibleLikeCount}</span>
            </button>
            <button class="action-button" type="button" data-comment-toggle="${post.id}" aria-label="Comment on this post">
              <span aria-hidden="true">💬</span>
              <span class="action-button__count">${commentCount}</span>
            </button>
          </div>

          <p class="post-caption"><span class="post-caption__author">${post.author}</span> ${post.caption}</p>

          <div class="post-comments" data-comments-panel="${post.id}">
            <p class="post-comments__title">Comments</p>
            <div class="comment-list">
              ${comments.length ? comments.map((comment) => `
                <div class="comment-item">
                  <div class="comment-item__meta">
                    <span class="comment-item__author">${comment.author}</span>
                    <span>${formatDisplayDate(comment.date)}</span>
                  </div>
                  <p class="comment-item__text">${comment.text}</p>
                </div>
              `).join("") : '<p class="comment-item__text">No comments yet. Start the conversation.</p>'}
            </div>

            <div class="comment-form">
              <input type="text" maxlength="200" placeholder="Write a comment..." data-comment-input="${post.id}">
              <button type="button" class="btn btn-primary" data-comment-submit="${post.id}">Post</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  restoreInspirationState();
}

function restoreInspirationState() {
  if (!restoreRequested || hasRestoredInspirationState) {
    return;
  }

  hasRestoredInspirationState = true;
  const validState = inspirationReturnState
    && Number.isFinite(inspirationReturnState.scrollY)
    && inspirationReturnState.scrollY >= 0;

  if (validState) {
    const openCommentIds = Array.isArray(inspirationReturnState.openCommentIds)
      ? inspirationReturnState.openCommentIds
      : [];
    openCommentIds.forEach((postId) => {
      document.querySelector(`[data-comments-panel="${postId}"]`)?.classList.add("is-open");
    });

    const cards = [...feedRoot.querySelectorAll(".post-card")];
    const anchorCard = cards.find(
      (card) => card.dataset.postId === inspirationReturnState.postId
    );
    const restorePosition = () => {
      const targetPosition = anchorCard && Number.isFinite(inspirationReturnState.postTop)
        ? window.scrollY
          + anchorCard.getBoundingClientRect().top
          - inspirationReturnState.postTop
        : inspirationReturnState.scrollY;
      window.scrollTo({ top: targetPosition, behavior: "instant" });
    };
    const precedingImages = anchorCard
      ? cards
        .slice(0, cards.indexOf(anchorCard))
        .flatMap((card) => [...card.querySelectorAll("img")])
      : [];
    precedingImages.forEach((image) => {
      const cleanup = () => {
        window.clearTimeout(cleanupTimer);
        image.removeEventListener("load", reposition);
        image.removeEventListener("error", reposition);
      };
      const reposition = (event) => {
        window.requestAnimationFrame(restorePosition);
        if (event.type === "load") {
          cleanup();
        }
      };
      const cleanupTimer = window.setTimeout(cleanup, 5000);
      image.addEventListener("load", reposition);
      image.addEventListener("error", reposition);
      image.loading = "eager";
      if (image.complete && image.naturalWidth > 0) {
        cleanup();
      }
    });
    const restoreAfterLoad = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(restorePosition);
      });
      window.setTimeout(restorePosition, 250);
    };

    restorePosition();
    if (pageHasShown) {
      restoreAfterLoad();
    } else {
      window.addEventListener("pageshow", restoreAfterLoad, { once: true });
    }
  } else {
    window.history.scrollRestoration = "auto";
  }

  try {
    window.sessionStorage.removeItem(INSPIRATION_RETURN_KEY);
  } catch (error) {
    console.error("Unable to clear saved Inspirations state.", error);
  }

  const cleanUrl = new URL(window.location.href);
  if (cleanUrl.searchParams.has("restore")) {
    cleanUrl.searchParams.delete("restore");
    window.history.replaceState(
      window.history.state,
      "",
      `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`
    );
  }
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  if (
    destination.origin !== window.location.origin
    || !destination.pathname.endsWith("/login.html")
  ) {
    return;
  }

  const visibleCard = [...feedRoot.querySelectorAll(".post-card")]
    .find((card) => card.getBoundingClientRect().bottom > 0);
  const state = {
    scrollY: window.scrollY,
    postId: visibleCard?.dataset.postId || null,
    postTop: visibleCard?.getBoundingClientRect().top ?? null,
    openCommentIds: [...feedRoot.querySelectorAll(".post-comments.is-open")]
      .map((panel) => panel.dataset.commentsPanel),
  };

  try {
    window.sessionStorage.setItem(INSPIRATION_RETURN_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to save Inspirations state before opening Login.", error);
  }
});

function toggleComments(postId) {
  const panel = document.querySelector(`[data-comments-panel="${postId}"]`);
  if (!panel) {
    return;
  }

  panel.classList.toggle("is-open");
}

function addComment(postId, text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return;
  }

  const currentUser = getCurrentUser();
  const comments = getComments();
  const comment = {
    id: Date.now(),
    postId,
    author: currentUser?.name || "Guest",
    authorEmail: currentUser?.email,
    text: trimmed,
    date: new Date().toISOString(),
  };
  comments.push(comment);

  saveComments(comments);
  const post = getSavedPosts().find((savedPost) => String(savedPost.id) === String(postId));
  if (currentUser && post) {
    addNotification(post, currentUser, "comment");
  }
  renderNotifications();
  renderFeed();
}

function toggleLike(postId) {
  const currentLikes = getLikeState();
  const isLiked = Boolean(currentLikes[postId]);
  const currentUser = getCurrentUser();

  if (isLiked) {
    delete currentLikes[postId];
  } else {
    currentLikes[postId] = true;
    const post = getSavedPosts().find((savedPost) => String(savedPost.id) === String(postId));
    if (currentUser && post) {
      addNotification(post, currentUser, "like");
    }
  }

  setLikeState(currentLikes);
  renderNotifications();
  renderFeed();
}

function openModal(post = null) {
  editingPostId = post ? post.id : null;
  createPostTitle.textContent = post ? "Edit Post" : "Create Post";
  submitPostButton.textContent = post ? "Save Changes" : "Share Post";
  if (post) {
    document.getElementById("post-image").value = post.image || "";
    document.getElementById("post-caption").value = post.caption || "";
    document.getElementById("post-location").value = post.location || "";
  } else {
    createPostForm.reset();
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  const targetInput = document.getElementById("post-image");
  targetInput.focus();
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  createPostForm.reset();
  editingPostId = null;
  createPostTitle.textContent = "Create Post";
  submitPostButton.textContent = "Share Post";
}

function dismissModal() {
  closeModal();
  if (returnToProfile) {
    window.location.href = "login.html";
  }
}

function handleCreatePostSubmit(event) {
  event.preventDefault();

  const currentUser = getCurrentUser();
  if (!currentUser) {
    closeModal();
    loginRequiredMessage.hidden = false;
    return;
  }

  const formData = new FormData(createPostForm);
  const image = String(formData.get("image") || "").trim();
  const caption = String(formData.get("caption") || "").trim();
  const location = String(formData.get("location") || "").trim();

  if (!image || !caption) {
    return;
  }

  if (editingPostId !== null) {
    const savedPosts = getSavedPosts();
    const postIndex = savedPosts.findIndex(
      (post) => String(post.id) === String(editingPostId)
    );
    const existingPost = savedPosts[postIndex];
    if (!existingPost || !isPostOwner(normalizePost(existingPost, true), currentUser)) {
      console.error("Unable to edit post: it is missing or is no longer owned by the current user.");
      closeModal();
      renderFeed();
      return;
    }

    savedPosts[postIndex] = {
      ...existingPost,
      image,
      caption,
      location: location || "A hidden corner",
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(USER_POSTS_KEY, JSON.stringify(savedPosts));
    closeModal();
    if (returnToProfile) {
      window.location.href = "login.html";
      return;
    }
    renderFeed();
    return;
  }

  const newPost = {
    id: Date.now(),
    author: currentUser.name,
    authorEmail: currentUser.email,
    image,
    caption,
    location: location || "A hidden corner",
    date: new Date().toISOString(),
    likes: 0,
    comments: [],
  };

  const savedPosts = getSavedPosts();
  savedPosts.unshift(newPost);
  window.localStorage.setItem(USER_POSTS_KEY, JSON.stringify(savedPosts));

  closeModal();
  if (returnToProfile) {
    window.location.href = "login.html";
    return;
  }
  renderFeed();
}

function openRequestedPostForm() {
  if (inspirationParams.get("create") === "1") {
    if (!getCurrentUser()) {
      loginRequiredMessage.hidden = false;
      return;
    }
    openModal();
    return;
  }

  const requestedPostId = inspirationParams.get("editPost");
  if (!requestedPostId) {
    return;
  }
  const currentUser = getCurrentUser();
  const post = getSavedPosts().find(
    (savedPost) => String(savedPost.id) === requestedPostId
  );
  if (!post || !isPostOwner(normalizePost(post, true), currentUser)) {
    console.error("Unable to edit post: it is missing or is not owned by the current user.");
    loginRequiredMessage.hidden = false;
    return;
  }
  openModal(normalizePost(post, true));
}

createButton.addEventListener("click", () => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    loginRequiredMessage.hidden = false;
    return;
  }

  loginRequiredMessage.hidden = true;
  openModal();
});

closePostModalButton.addEventListener("click", dismissModal);
cancelPostButton.addEventListener("click", dismissModal);
modal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    dismissModal();
  }
});
createPostForm.addEventListener("submit", handleCreatePostSubmit);
notificationBell.addEventListener("click", toggleNotificationPanel);
markNotificationsReadButton.addEventListener("click", setNotificationsRead);
notificationList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-notification-id]");
  if (!item) {
    return;
  }

  markNotificationRead(item.dataset.notificationId);
  setNotificationPanelOpen(false);
  const postCard = [...feedRoot.querySelectorAll(".post-card")]
    .find((card) => card.dataset.postId === item.dataset.postId);
  if (!postCard) {
    return;
  }
  if (item.dataset.notificationType === "comment") {
    postCard.querySelector(".post-comments")?.classList.add("is-open");
  }
  postCard.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
});
document.addEventListener("click", (event) => {
  if (
    !notificationPanel.hidden
    && !event.target.closest("#inspiration-notifications")
  ) {
    setNotificationPanelOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !notificationPanel.hidden) {
    setNotificationPanelOpen(false);
    notificationBell.focus();
  }
});

window.addEventListener("storage", (event) => {
  if ([CURRENT_USER_KEY, NOTIFICATIONS_KEY].includes(event.key)) {
    syncAccountActions();
  }
});
window.addEventListener("pageshow", syncAccountActions);
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) {
    return;
  }

  try {
    window.sessionStorage.removeItem(INSPIRATION_RETURN_KEY);
  } catch (error) {
    console.error("Unable to clear saved Inspirations state.", error);
  }
});

feedRoot.addEventListener("click", (event) => {
  const likeButton = event.target.closest("[data-like-id]");
  if (likeButton) {
    toggleLike(likeButton.dataset.likeId);
    return;
  }

  const commentToggle = event.target.closest("[data-comment-toggle]");
  if (commentToggle) {
    toggleComments(commentToggle.dataset.commentToggle);
    return;
  }

  const commentSubmit = event.target.closest("[data-comment-submit]");
  if (commentSubmit) {
    const postId = commentSubmit.dataset.commentSubmit;
    const input = document.querySelector(`[data-comment-input="${postId}"]`);
    if (input) {
      addComment(postId, input.value);
      input.value = "";
    }
  }
});

feedRoot.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  const target = event.target.closest("[data-comment-input]");
  if (target) {
    addComment(target.dataset.commentInput, target.value);
    target.value = "";
  }
});

async function loadSeedPosts() {
  try {
    const response = await fetch("data/posts.json");
    if (!response.ok) {
      throw new Error("Unable to load posts");
    }

    defaultPosts = await response.json();
  } catch (error) {
    console.error("Unable to load default posts.", error);
    defaultPosts = [];
  }

  renderFeed();
  openRequestedPostForm();
}

syncAccountActions();
loadSeedPosts();
