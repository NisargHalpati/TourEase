const INSPIRATION_RETURN_KEY = "tourease_inspiration_return";
const PLACEHOLDER_IMAGE = "assets/travel-placeholder.svg";

const feedRoot = document.getElementById("inspiration-feed");
const createButton = document.getElementById("create-post-button");
const loginRequiredMessage = document.getElementById("login-required-message");
const authStatus = document.getElementById("inspiration-auth-status");
const memberActions = document.getElementById("inspiration-member-actions");
const accountAvatarImage = document.getElementById("account-avatar-image");
const accountAvatarFallback = document.getElementById("account-avatar-fallback");
const accountUserName = document.getElementById("account-user-name");
const notificationBell = document.getElementById("notification-bell");
const notificationPanel = document.getElementById("notification-panel");
const modal = document.getElementById("create-post-modal");
const createPostForm = document.getElementById("create-post-form");
const closePostModalButton = document.getElementById("close-post-modal");
const cancelPostButton = document.getElementById("cancel-post-form");
const createPostTitle = document.getElementById("create-post-title");
const submitPostButton = createPostForm.querySelector('button[type="submit"]');
const inspirationParams = new URLSearchParams(window.location.search);
const restoreRequested = inspirationParams.get("restore") === "1";
const returnToProfile = inspirationParams.get("returnToProfile") === "1";

let currentUser = null;
let currentProfile = null;
let accountErrorMessage = "";
let posts = [];
let likesByPost = new Map();
let commentsByPost = new Map();
let hasRestoredInspirationState = false;
let pageHasShown = false;
let editingPostId = null;
let inspirationReturnState = null;
let feedRequestId = 0;

if (restoreRequested) {
  window.history.scrollRestoration = "manual";
  window.addEventListener("pagehide", () => {
    window.history.scrollRestoration = "auto";
  }, { once: true });

  try {
    const savedState = window.sessionStorage.getItem(INSPIRATION_RETURN_KEY);
    inspirationReturnState = savedState ? JSON.parse(savedState) : null;
  } catch (error) {
    console.error("Unable to read saved Inspirations state.", error);
  }
}

window.addEventListener("pageshow", () => {
  pageHasShown = true;
}, { once: true });

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function createExternalLink(url, text) {
  const link = document.createElement("a");
  link.href = url;
  link.textContent = text;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function getSafeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value, document.baseURI);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch (error) {
    return null;
  }
}

function getImageAttribution(imageUrl) {
  const credits = {
    "https://upload.wikimedia.org/wikipedia/commons/b/b8/Kumarakom.JPG": {
      author: "Sulfis",
      authorUrl: "https://commons.wikimedia.org/wiki/User:Sulfis",
      workTitle: "Kumarakom.JPG",
      fileUrl: "https://commons.wikimedia.org/wiki/File:Kumarakom.JPG",
    },
    "https://upload.wikimedia.org/wikipedia/commons/f/f6/Pahalgam_Valley.jpg": {
      author: "KennyOMG",
      authorUrl: "https://commons.wikimedia.org/wiki/User:KennyOMG",
      workTitle: "Pahalgam Valley.jpg",
      fileUrl: "https://commons.wikimedia.org/wiki/File:Pahalgam_Valley.jpg",
    },
  };
  return credits[imageUrl] || null;
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

function showFeedMessage(message, isError = false, includeRetry = false) {
  let status = feedRoot.querySelector("[data-feed-message]");
  if (!status) {
    status = createTextElement("p", "feed-status", "");
    status.dataset.feedMessage = "true";
    feedRoot.prepend(status);
  }
  status.classList.toggle("is-error", isError);
  status.replaceChildren(document.createTextNode(message));

  if (includeRetry) {
    const retryButton = createTextElement("button", "feed-retry", "Try again");
    retryButton.type = "button";
    retryButton.addEventListener("click", () => {
      void loadFeed();
    }, { once: true });
    status.append(document.createTextNode(" "), retryButton);
  }
}

function normalizePost(row) {
  return {
    id: String(row.id),
    userId: row.user_id,
    author: typeof row.author_name === "string" && row.author_name
      ? row.author_name
      : "Traveler",
    caption: typeof row.caption === "string" ? row.caption : "",
    image: getSafeImageUrl(row.image_url) || PLACEHOLDER_IMAGE,
    location: typeof row.location === "string" && row.location
      ? row.location
      : "India",
    date: row.created_at,
    isStarter: row.is_starter === true,
    isUserPost: row.is_starter !== true
      && Boolean(row.user_id)
      && row.user_id === currentUser?.id,
  };
}

function getPostComments(postId) {
  return commentsByPost.get(postId) || [];
}

function getPostLikes(postId) {
  return likesByPost.get(postId) || [];
}

function syncAccountActions() {
  const isLoggedIn = Boolean(currentUser);
  loginRequiredMessage.hidden = isLoggedIn;
  memberActions.hidden = !isLoggedIn;
  notificationBell.hidden = true;
  notificationPanel.hidden = true;
  authStatus.textContent = accountErrorMessage;
  authStatus.hidden = !accountErrorMessage;

  if (!isLoggedIn) {
    accountUserName.textContent = "";
    accountAvatarImage.hidden = true;
    accountAvatarImage.removeAttribute("src");
    accountAvatarFallback.hidden = false;
    accountAvatarFallback.textContent = "";
    return;
  }

  accountUserName.textContent = currentProfile?.display_name
    || currentUser.user_metadata?.display_name
    || "Traveler";
  accountAvatarFallback.textContent = accountUserName.textContent
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase();
  const avatarUrl = getSafeImageUrl(currentProfile?.avatar_url);
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
}

async function loadCurrentProfile() {
  currentProfile = null;
  accountErrorMessage = "";
  if (!currentUser) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, bio, avatar_url")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data) {
    currentProfile = data;
    return;
  }

  const metadata = currentUser.user_metadata || {};
  const profile = {
    id: currentUser.id,
    display_name: typeof metadata.display_name === "string" && metadata.display_name.trim()
      ? metadata.display_name.trim()
      : "Traveler",
    bio: typeof metadata.bio === "string" ? metadata.bio.trim() : "",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
  const result = await supabaseClient
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("id, display_name, bio, avatar_url")
    .single();

  if (result.error) {
    throw result.error;
  }
  currentProfile = result.data;
}

function renderFeed() {
  const sortedPosts = [...posts].sort((first, second) => {
    if (first.isStarter !== second.isStarter) {
      return first.isStarter ? 1 : -1;
    }
    return new Date(second.date) - new Date(first.date);
  });

  if (!sortedPosts.length) {
    feedRoot.replaceChildren(
      createTextElement("p", "feed-status", "No stories to show yet.")
    );
    restoreInspirationState();
    return;
  }

  const cards = sortedPosts.map((post) => {
    const comments = getPostComments(post.id);
    const likes = getPostLikes(post.id);
    const isLiked = Boolean(currentUser && likes.some((like) => like.user_id === currentUser.id));
    const initials = post.author
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const card = document.createElement("article");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const header = document.createElement("div");
    header.className = "post-card__header";
    const user = document.createElement("div");
    user.className = "post-user";
    const avatar = createTextElement("div", "post-user__avatar", initials);
    avatar.setAttribute("aria-hidden", "true");
    const names = document.createElement("div");
    names.className = "post-user__names";
    names.append(
      createTextElement("span", "post-user__name", post.author),
      createTextElement("span", "post-user__location", post.location)
    );
    user.append(avatar, names);
    header.append(
      user,
      createTextElement("span", "post-date", formatDisplayDate(post.date))
    );
    card.append(header);

    const media = document.createElement("div");
    media.className = "post-card__media";
    const image = document.createElement("img");
    image.className = "post-card__image";
    image.src = post.image;
    image.alt = `${post.location || "Travel"} scene`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = PLACEHOLDER_IMAGE;
    }, { once: true });
    media.append(image);
    const attribution = getImageAttribution(post.image);
    if (attribution) {
      const credit = document.createElement("p");
      credit.className = "post-card__image-credit";
      credit.append(
        document.createTextNode("Photo by "),
        createExternalLink(attribution.authorUrl, attribution.author),
        document.createTextNode(" - "),
        createExternalLink(attribution.fileUrl, attribution.workTitle),
        document.createTextNode(" on Wikimedia Commons, licensed under "),
        createExternalLink(
          "https://creativecommons.org/licenses/by-sa/3.0/",
          "CC BY-SA 3.0"
        )
      );
      media.append(credit);
    }
    card.append(media);

    const actions = document.createElement("div");
    actions.className = "post-actions";
    const likeButton = document.createElement("button");
    likeButton.className = `action-button${isLiked ? " is-liked" : ""}`;
    likeButton.type = "button";
    likeButton.dataset.likeId = post.id;
    likeButton.setAttribute("aria-label", isLiked ? "Unlike this post" : "Like this post");
    const likeIcon = createTextElement("span", "", isLiked ? "♥" : "♡");
    likeIcon.setAttribute("aria-hidden", "true");
    likeButton.append(
      likeIcon,
      createTextElement("span", "action-button__count", String(likes.length))
    );
    const commentButton = document.createElement("button");
    commentButton.className = "action-button";
    commentButton.type = "button";
    commentButton.dataset.commentToggle = post.id;
    commentButton.setAttribute("aria-label", "Comment on this post");
    const commentIcon = createTextElement("span", "", "💬");
    commentIcon.setAttribute("aria-hidden", "true");
    commentButton.append(
      commentIcon,
      createTextElement("span", "action-button__count", String(comments.length))
    );
    actions.append(likeButton, commentButton);
    card.append(actions);

    const caption = document.createElement("p");
    caption.className = "post-caption";
    caption.append(createTextElement("span", "post-caption__author", post.author));
    caption.append(document.createTextNode(` ${post.caption}`));
    card.append(caption);

    const commentsPanel = document.createElement("div");
    commentsPanel.className = "post-comments";
    commentsPanel.dataset.commentsPanel = post.id;
    commentsPanel.append(createTextElement("p", "post-comments__title", "Comments"));
    const commentList = document.createElement("div");
    commentList.className = "comment-list";
    if (comments.length) {
      comments.forEach((comment) => {
        const commentItem = document.createElement("div");
        commentItem.className = "comment-item";
        const meta = document.createElement("div");
        meta.className = "comment-item__meta";
        meta.append(
          createTextElement("span", "comment-item__author", comment.author),
          createTextElement("span", "", formatDisplayDate(comment.created_at))
        );
        commentItem.append(
          meta,
          createTextElement("p", "comment-item__text", comment.content)
        );
        commentList.append(commentItem);
      });
    } else {
      commentList.append(
        createTextElement("p", "comment-item__text", "No comments yet. Start the conversation.")
      );
    }
    commentsPanel.append(commentList);

    const commentForm = document.createElement("div");
    commentForm.className = "comment-form";
    const commentInput = document.createElement("input");
    commentInput.type = "text";
    commentInput.maxLength = 200;
    commentInput.placeholder = "Write a comment...";
    commentInput.dataset.commentInput = post.id;
    commentInput.setAttribute("aria-label", `Write a comment on ${post.author}'s post`);
    const commentSubmit = createTextElement("button", "btn btn-primary", "Post");
    commentSubmit.type = "button";
    commentSubmit.dataset.commentSubmit = post.id;
    commentForm.append(commentInput, commentSubmit);
    commentsPanel.append(commentForm);
    card.append(commentsPanel);
    return card;
  });
  feedRoot.replaceChildren(...cards);
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
      const panel = [...feedRoot.querySelectorAll("[data-comments-panel]")]
        .find((element) => element.dataset.commentsPanel === String(postId));
      panel?.classList.add("is-open");
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
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const link = target.closest("a[href]");
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
  const panel = [...feedRoot.querySelectorAll("[data-comments-panel]")]
    .find((element) => element.dataset.commentsPanel === String(postId));
  panel?.classList.toggle("is-open");
}

function showLoginRequired() {
  loginRequiredMessage.hidden = false;
}

async function toggleLike(postId, button) {
  if (!currentUser) {
    showLoginRequired();
    return;
  }

  button.disabled = true;
  try {
    const existingLike = getPostLikes(postId)
      .some((like) => like.user_id === currentUser.id);
    const result = existingLike
      ? await supabaseClient
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUser.id)
      : await supabaseClient
        .from("post_likes")
        .upsert(
          {
            post_id: postId,
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
          },
          { onConflict: "post_id,user_id", ignoreDuplicates: true }
        );
    if (result.error) {
      throw result.error;
    }
    await loadFeed();
  } catch (error) {
    console.error("Unable to update post like.", error);
    showFeedMessage(`Unable to update your like: ${error.message}`, true);
    button.disabled = false;
  }
}

async function addComment(postId, text, button = null) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return false;
  }
  if (!currentUser) {
    showLoginRequired();
    return false;
  }

  if (button) {
    button.disabled = true;
  }
  try {
    const { error } = await supabaseClient
      .from("comments")
      .insert({
        id: window.crypto.randomUUID(),
        post_id: postId,
        user_id: currentUser.id,
        content: trimmed,
        created_at: new Date().toISOString(),
      });
    if (error) {
      throw error;
    }
    await loadFeed();
    return true;
  } catch (error) {
    console.error("Unable to post comment.", error);
    showFeedMessage(`Unable to post your comment: ${error.message}`, true);
    return false;
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function openModal(post = null) {
  editingPostId = post ? post.id : null;
  createPostTitle.textContent = post ? "Edit Post" : "Create Post";
  submitPostButton.textContent = post ? "Save Changes" : "Share Post";
  if (post) {
    document.getElementById("post-image").value = post.image_url || "";
    document.getElementById("post-caption").value = post.caption || "";
    document.getElementById("post-location").value = post.location || "";
  } else {
    createPostForm.reset();
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("post-image").focus();
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

async function handleCreatePostSubmit(event) {
  event.preventDefault();
  if (!currentUser) {
    closeModal();
    showLoginRequired();
    return;
  }

  const formData = new FormData(createPostForm);
  const image = String(formData.get("image") || "").trim();
  const caption = String(formData.get("caption") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const imageInput = document.getElementById("post-image");
  imageInput.setCustomValidity(
    image && !getSafeImageUrl(image)
      ? "Enter an HTTP or HTTPS image URL."
      : ""
  );
  if (!createPostForm.reportValidity() || !image || !caption) {
    return;
  }
  if (!currentProfile) {
    showFeedMessage("Your profile is not available yet. Please try again after reloading.", true);
    return;
  }
  if (!window.crypto?.randomUUID) {
    showFeedMessage("This browser cannot securely create post identifiers.", true);
    return;
  }

  submitPostButton.disabled = true;
  try {
    const postValues = {
      author_name: currentProfile.display_name,
      location: location || "A hidden corner",
      caption,
      image_url: image,
      is_starter: false,
    };
    if (editingPostId) {
      const { data, error } = await supabaseClient
        .from("posts")
        .update(postValues)
        .eq("id", editingPostId)
        .eq("user_id", currentUser.id)
        .eq("is_starter", false)
        .select("id");
      if (error) {
        throw error;
      }
      if (!data.length) {
        throw new Error("The post was not found or is no longer yours to edit.");
      }
    } else {
      const { error } = await supabaseClient
        .from("posts")
        .insert({
          id: window.crypto.randomUUID(),
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
          ...postValues,
        });
      if (error) {
        throw error;
      }
    }

    closeModal();
    if (returnToProfile) {
      window.location.href = "login.html";
      return;
    }
    await loadFeed();
  } catch (error) {
    console.error("Unable to save post.", error);
    showFeedMessage(`Unable to save your post: ${error.message}`, true);
  } finally {
    submitPostButton.disabled = false;
  }
}

async function openRequestedPostForm() {
  if (inspirationParams.get("create") === "1") {
    if (!currentUser) {
      showLoginRequired();
      return;
    }
    openModal();
    return;
  }

  const requestedPostId = inspirationParams.get("editPost");
  if (!requestedPostId) {
    return;
  }
  if (!currentUser) {
    showLoginRequired();
    return;
  }

  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, user_id, author_name, location, caption, image_url, created_at, is_starter")
    .eq("id", requestedPostId)
    .eq("user_id", currentUser.id)
    .eq("is_starter", false)
    .maybeSingle();
  if (error) {
    console.error("Unable to load the requested post.", error);
    showFeedMessage(`Unable to load this post: ${error.message}`, true);
    return;
  }
  if (!data) {
    showFeedMessage("This post is not available for editing.", true);
    return;
  }
  openModal(data);
}

async function loadFeed() {
  const requestId = ++feedRequestId;
  if (!posts.length) {
    showFeedMessage("Loading stories...");
  }

  try {
    const [postsResult, likesResult, commentsResult] = await Promise.all([
      supabaseClient
        .from("posts")
        .select("id, user_id, author_name, location, caption, image_url, created_at, is_starter")
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("post_likes")
        .select("post_id, user_id"),
      supabaseClient
        .from("comments")
        .select("id, post_id, user_id, content, created_at")
        .order("created_at", { ascending: true }),
    ]);
    if (postsResult.error) {
      throw postsResult.error;
    }
    if (likesResult.error) {
      throw likesResult.error;
    }
    if (commentsResult.error) {
      throw commentsResult.error;
    }

    const commentUserIds = [...new Set((commentsResult.data || []).map((comment) => comment.user_id))];
    let profilesByUser = new Map();
    if (commentUserIds.length) {
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, display_name")
        .in("id", commentUserIds);
      if (error) {
        throw error;
      }
      profilesByUser = new Map((data || []).map((profile) => [profile.id, profile.display_name]));
    }
    if (requestId !== feedRequestId) {
      return;
    }

    posts = (postsResult.data || []).map(normalizePost);
    likesByPost = new Map();
    (likesResult.data || []).forEach((like) => {
      const postLikes = likesByPost.get(like.post_id) || [];
      postLikes.push(like);
      likesByPost.set(like.post_id, postLikes);
    });
    commentsByPost = new Map();
    (commentsResult.data || []).forEach((comment) => {
      const postComments = commentsByPost.get(comment.post_id) || [];
      postComments.push({
        ...comment,
        author: profilesByUser.get(comment.user_id) || "Traveler",
      });
      commentsByPost.set(comment.post_id, postComments);
    });
    renderFeed();
  } catch (error) {
    console.error("Unable to load the Inspirations feed.", error);
    if (requestId === feedRequestId) {
      feedRoot.replaceChildren();
      showFeedMessage(
        `Unable to load stories: ${error.message}`,
        true,
        true
      );
    }
  }
}

createButton.addEventListener("click", () => {
  if (!currentUser) {
    showLoginRequired();
    return;
  }
  loginRequiredMessage.hidden = true;
  openModal();
});

closePostModalButton.addEventListener("click", dismissModal);
cancelPostButton.addEventListener("click", dismissModal);
modal.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.dataset.closeModal === "true") {
    dismissModal();
  }
});
createPostForm.addEventListener("submit", handleCreatePostSubmit);

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

feedRoot.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const likeButton = target.closest("[data-like-id]");
  if (likeButton) {
    await toggleLike(likeButton.dataset.likeId, likeButton);
    return;
  }

  const commentToggle = target.closest("[data-comment-toggle]");
  if (commentToggle) {
    toggleComments(commentToggle.dataset.commentToggle);
    return;
  }

  const commentSubmit = target.closest("[data-comment-submit]");
  if (commentSubmit) {
    const postId = commentSubmit.dataset.commentSubmit;
    const input = [...feedRoot.querySelectorAll("[data-comment-input]")]
      .find((element) => element.dataset.commentInput === postId);
    if (input && await addComment(postId, input.value, commentSubmit)) {
      input.value = "";
    }
  }
});

feedRoot.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || !(event.target instanceof Element)) {
    return;
  }
  const input = event.target.closest("[data-comment-input]");
  if (input && await addComment(input.dataset.commentInput, input.value)) {
    input.value = "";
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
    return;
  }
  window.setTimeout(async () => {
    currentUser = session?.user || null;
    try {
      await loadCurrentProfile();
    } catch (error) {
      console.error("Unable to load the current profile.", error);
      accountErrorMessage = `Unable to load your profile: ${error.message}`;
    }
    syncAccountActions();
    await loadFeed();
  }, 0);
});

async function initializeFeed() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }
    currentUser = data.session?.user || null;
    try {
      await loadCurrentProfile();
    } catch (profileError) {
      console.error("Unable to load the current profile.", profileError);
      accountErrorMessage = `Unable to load your profile: ${profileError.message}`;
    }
  } catch (error) {
    console.error("Unable to restore the Supabase session.", error);
    accountErrorMessage = `Unable to check your session: ${error.message}`;
  }

  syncAccountActions();
  await loadFeed();
  await openRequestedPostForm();
}

void initializeFeed();
