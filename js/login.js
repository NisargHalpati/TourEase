const CURRENT_USER_KEY = "tourease_current_user";
const USER_POSTS_KEY = "tourease_posts";
const LIKES_KEY = "tourease_likes";
const COMMENTS_KEY = "tourease_comments";
const PLACEHOLDER_IMAGE = "assets/travel-placeholder.svg";
const INSPIRATION_RETURN_KEY = "tourease_inspiration_return";

const loginPanel = document.getElementById("login-panel");
const profilePanel = document.getElementById("profile-panel");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const profileName = document.getElementById("profile-name");
const profileBio = document.getElementById("profile-bio");
const profileEmail = document.getElementById("profile-email");
const profileAvatar = document.getElementById("profile-avatar");
const profilePostsGrid = document.getElementById("profile-posts-grid");
const backToInspirationsLink = document.querySelector(".login-back-link");
let returningToInspirations = false;

backToInspirationsLink?.addEventListener("click", () => {
  returningToInspirations = true;
});

window.addEventListener("pagehide", () => {
  if (returningToInspirations) {
    return;
  }

  try {
    window.sessionStorage.removeItem(INSPIRATION_RETURN_KEY);
  } catch (error) {
    console.error("Unable to clear abandoned Inspirations state.", error);
  }
});

function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw);
    if (!user || typeof user.name !== "string") {
      return null;
    }
    return user;
  } catch (error) {
    console.error("Unable to read current user.", error);
    return null;
  }
}

function setCurrentUser(user) {
  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
  window.localStorage.removeItem(CURRENT_USER_KEY);
}

function getUserPosts() {
  try {
    const raw = window.localStorage.getItem(USER_POSTS_KEY);
    if (!raw) {
      return [];
    }
    const posts = JSON.parse(raw);
    return Array.isArray(posts) ? posts : [];
  } catch (error) {
    console.error("Unable to read user posts.", error);
    return [];
  }
}

function belongsToCurrentUser(post, currentUser) {
  if (post.authorEmail) {
    return post.authorEmail.toLocaleLowerCase() === currentUser.email?.toLocaleLowerCase();
  }
  return post.author === currentUser.name;
}

function readPostComments() {
  try {
    const raw = window.localStorage.getItem(COMMENTS_KEY);
    const comments = raw ? JSON.parse(raw) : [];
    return Array.isArray(comments) ? comments : [];
  } catch (error) {
    console.error("Unable to read comments.", error);
    return [];
  }
}

function readPostLikes() {
  try {
    const raw = window.localStorage.getItem(LIKES_KEY);
    const likes = raw ? JSON.parse(raw) : {};
    return likes && typeof likes === "object" ? likes : {};
  } catch (error) {
    console.error("Unable to read likes.", error);
    return {};
  }
}

function deletePost(postId) {
  const currentUser = getCurrentUser();
  const posts = getUserPosts();
  const postIndex = posts.findIndex((post) => String(post.id) === String(postId));
  const post = posts[postIndex];
  if (!currentUser || !post || !belongsToCurrentUser(post, currentUser)) {
    console.error("Unable to delete post: it is missing or is not owned by the current user.");
    renderProfile();
    return;
  }
  if (!window.confirm("Are you sure you want to delete this post?")) {
    return;
  }

  posts.splice(postIndex, 1);
  window.localStorage.setItem(USER_POSTS_KEY, JSON.stringify(posts));
  window.localStorage.setItem(
    COMMENTS_KEY,
    JSON.stringify(readPostComments().filter((comment) => (
      String(comment.postId) !== String(postId)
    )))
  );
  const likes = readPostLikes();
  delete likes[postId];
  window.localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
  renderProfile();
}

function renderProfile() {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    loginPanel.hidden = false;
    profilePanel.hidden = true;
    return;
  }

  loginPanel.hidden = true;
  profilePanel.hidden = false;

  const initials = currentUser.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  profileName.textContent = currentUser.name;
  profileBio.textContent = currentUser.bio;
  profileEmail.textContent = currentUser.email;
  profileAvatar.textContent = initials;

  const userPosts = getUserPosts()
    .filter((post) => belongsToCurrentUser(post, currentUser))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!userPosts.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-profile";
    const message = document.createElement("p");
    message.textContent = "No posts yet. Share your first journey with the TourEase community.";
    const createLink = document.createElement("a");
    createLink.className = "btn btn-secondary";
    createLink.href = "inspiration.html?create=1&returnToProfile=1";
    createLink.textContent = "Create Post";
    emptyState.append(message, createLink);
    profilePostsGrid.replaceChildren(emptyState);
    return;
  }

  const cards = userPosts.map((post) => {
    const card = document.createElement("article");
    card.className = "profile-post";
    const image = document.createElement("img");
    image.className = "profile-post__image";
    image.src = post.image || PLACEHOLDER_IMAGE;
    image.alt = post.location || "Travel photo";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = PLACEHOLDER_IMAGE;
    }, { once: true });
    const meta = document.createElement("div");
    meta.className = "profile-post__meta";
    const location = document.createElement("span");
    location.className = "profile-post__location";
    location.textContent = post.location || "A hidden corner";
    const caption = document.createElement("p");
    caption.className = "profile-post__caption";
    caption.textContent = post.caption || "";
    const actions = document.createElement("div");
    actions.className = "profile-post__actions";
    const editLink = document.createElement("a");
    editLink.className = "profile-post__action";
    const editUrl = new URL("inspiration.html", window.location.href);
    editUrl.searchParams.set("editPost", post.id);
    editUrl.searchParams.set("returnToProfile", "1");
    editLink.href = `${editUrl.pathname.split("/").pop()}${editUrl.search}`;
    editLink.textContent = "Edit";
    editLink.setAttribute("aria-label", `Edit post from ${post.location || "this location"}`);
    const deleteButton = document.createElement("button");
    deleteButton.className = "profile-post__action profile-post__action--delete";
    deleteButton.type = "button";
    deleteButton.dataset.deleteProfilePost = String(post.id);
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete post from ${post.location || "this location"}`);
    actions.append(editLink, deleteButton);
    meta.append(location, caption, actions);
    card.append(image, meta);
    return card;
  });
  profilePostsGrid.replaceChildren(...cards);
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const bio = String(formData.get("bio") || "").trim();

  if (!name || !email || !bio) {
    return;
  }

  setCurrentUser({ name, email, bio });
  loginForm.reset();
  renderProfile();
});

logoutButton.addEventListener("click", () => {
  clearCurrentUser();
  renderProfile();
});

profilePostsGrid.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-profile-post]");
  if (deleteButton) {
    deletePost(deleteButton.dataset.deleteProfilePost);
  }
});

window.addEventListener("storage", (event) => {
  if ([CURRENT_USER_KEY, USER_POSTS_KEY].includes(event.key)) {
    renderProfile();
  }
});
window.addEventListener("pageshow", renderProfile);

renderProfile();
