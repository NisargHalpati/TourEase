const PLACEHOLDER_IMAGE = "assets/travel-placeholder.svg";
const INSPIRATION_RETURN_KEY = "tourease_inspiration_return";
const AUTH_CALLBACK_URL = `${window.location.search}${window.location.hash}`;

const loginPanel = document.getElementById("login-panel");
const profilePanel = document.getElementById("profile-panel");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const profileName = document.getElementById("profile-name");
const profileBio = document.getElementById("profile-bio");
const profileEmail = document.getElementById("profile-email");
const profileAvatar = document.getElementById("profile-avatar");
const profilePostsGrid = document.getElementById("profile-posts-grid");
const authStatus = document.getElementById("auth-status");
const authSubmitButton = document.getElementById("auth-submit-button");
const authModeToggle = document.getElementById("auth-mode-toggle");
const passwordInput = document.getElementById("user-password");
const registrationFields = [...loginForm.querySelectorAll("[data-registration-field]")];
const passwordConfirmInput = document.getElementById("user-password-confirm");
const passwordMismatch = document.getElementById("password-mismatch");
const forgotPasswordLink = document.getElementById("forgot-password-link");
const recoveryRequestPanel = document.getElementById("recovery-request-panel");
const recoveryRequestForm = document.getElementById("recovery-request-form");
const recoveryEmailInput = document.getElementById("recovery-email");
const recoveryRequestButton = document.getElementById("recovery-request-button");
const backToLoginButton = document.getElementById("back-to-login");
const backToInspirationsLink = document.querySelector(".login-back-link");
let authMode = "login";
let currentUser = null;
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

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("is-error", isError);
}

function getLoginRedirectUrl() {
  const url = new URL("login.html", window.location.href);
  // Keep local development's confirmation link on the same origin and port.
  // GitHub Pages project sites need their repository path retained as well.
  return url.href;
}

function getConfirmationCallbackMessage() {
  const [query = "", hash = ""] = AUTH_CALLBACK_URL.split("#", 2);
  const params = new URLSearchParams(query.replace(/^\?/, ""));
  const hashParams = new URLSearchParams(hash);
  const errorCode = params.get("error_code") || hashParams.get("error_code");
  const error = params.get("error") || hashParams.get("error");
  if (errorCode || error) {
    return {
      message: "This confirmation link is invalid or has expired. Request a new confirmation email and try again.",
      isError: true,
    };
  }
  return null;
}

function clearAuthCallbackUrl() {
  if (window.location.search || window.location.hash) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegistration = mode === "register";
  registrationFields.forEach((field) => {
    field.hidden = !isRegistration;
    const input = field.querySelector("input, textarea");
    input.required = isRegistration;
    input.disabled = !isRegistration;
  });
  forgotPasswordLink.hidden = isRegistration;
  passwordMismatch.hidden = true;
  passwordInput.autocomplete = isRegistration ? "new-password" : "current-password";
  authSubmitButton.textContent = isRegistration ? "Create Account" : "Log In";
  authModeToggle.textContent = isRegistration
    ? "I already have an account"
    : "Create an account";
  setAuthStatus("");
}

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    button.setAttribute("aria-pressed", String(!isVisible));
    const fieldName = input.id === "user-password-confirm" ? "confirm password" : "password";
    button.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} ${fieldName}`);
  });
});

passwordConfirmInput.addEventListener("input", () => {
  if (passwordConfirmInput.value === passwordInput.value) {
    passwordMismatch.hidden = true;
  }
});
passwordInput.addEventListener("input", () => {
  if (passwordConfirmInput.value === passwordInput.value) {
    passwordMismatch.hidden = true;
  }
});

function getDisplayName(user, profile = null) {
  const metadataName = user.user_metadata?.display_name;
  return profile?.display_name
    || (typeof metadataName === "string" ? metadataName : "")
    || "Traveler";
}

async function getOrCreateProfile(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (data) {
    return data;
  }

  const metadata = user.user_metadata || {};
  const profile = {
    id: user.id,
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
  return result.data;
}

async function loadProfilePosts(user) {
  profilePostsGrid.replaceChildren(
    createTextElement("p", "profile-loading", "Loading your posts...")
  );

  const { data, error } = await supabaseClient
    .from("posts")
    .select("id, location, caption, image_url, created_at")
    .eq("user_id", user.id)
    .eq("is_starter", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  renderProfilePosts(data || []);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function renderProfilePosts(posts) {
  if (!posts.length) {
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

  const cards = posts.map((post) => {
    const card = document.createElement("article");
    card.className = "profile-post";
    const image = document.createElement("img");
    image.className = "profile-post__image";
    image.src = post.image_url || PLACEHOLDER_IMAGE;
    image.alt = post.location || "Travel photo";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.src = PLACEHOLDER_IMAGE;
    }, { once: true });
    const meta = document.createElement("div");
    meta.className = "profile-post__meta";
    const location = createTextElement(
      "span",
      "profile-post__location",
      post.location || "A hidden corner"
    );
    const caption = createTextElement(
      "p",
      "profile-post__caption",
      post.caption || ""
    );
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
    deleteButton.dataset.deleteProfilePost = post.id;
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete post from ${post.location || "this location"}`);
    actions.append(editLink, deleteButton);
    meta.append(location, caption, actions);
    card.append(image, meta);
    return card;
  });
  profilePostsGrid.replaceChildren(...cards);
}

async function showProfile(user) {
  currentUser = user;
  loginPanel.hidden = true;
  profilePanel.hidden = false;
  setAuthStatus("Loading your profile...");
  profileName.textContent = getDisplayName(user);
  profileBio.textContent = "";
  profileEmail.textContent = user.email || "";
  profileAvatar.textContent = profileName.textContent
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  try {
    const profile = await getOrCreateProfile(user);
    profileName.textContent = getDisplayName(user, profile);
    profileBio.textContent = profile.bio || "";
    profileAvatar.textContent = profileName.textContent
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    await loadProfilePosts(user);
    setAuthStatus("");
  } catch (error) {
    console.error("Unable to load the Supabase profile.", error);
    profilePostsGrid.replaceChildren(
      createTextElement("p", "profile-error", "Your profile or posts could not be loaded. Please try again.")
    );
    setAuthStatus(`Unable to load your profile: ${error.message}`, true);
  }
}

function showLoginForm() {
  currentUser = null;
  profilePanel.hidden = true;
  loginPanel.hidden = false;
  recoveryRequestPanel.hidden = true;
  setAuthStatus("");
  setAuthMode("login");
}

forgotPasswordLink.addEventListener("click", () => {
  loginPanel.hidden = true;
  recoveryRequestPanel.hidden = false;
  recoveryEmailInput.value = document.getElementById("user-email").value.trim();
  setAuthStatus("");
  recoveryEmailInput.focus();
});

backToLoginButton.addEventListener("click", () => {
  recoveryRequestPanel.hidden = true;
  loginPanel.hidden = false;
  setAuthStatus("");
  document.getElementById("user-email").focus();
});

recoveryRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recoveryRequestForm.reportValidity()) return;
  recoveryRequestButton.disabled = true;
  backToLoginButton.disabled = true;
  setAuthStatus("Sending your reset link...");
  try {
    const redirectTo = new URL("password-reset.html", window.location.href).href;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      recoveryEmailInput.value.trim().toLowerCase(),
      { redirectTo }
    );
    if (error) throw error;
    setAuthStatus("If an account uses that email address, a password reset link is on its way. Check your inbox and spam or junk folder.");
  } catch (error) {
    console.error("Password reset request failed.", error);
    setAuthStatus("We couldn’t send a reset link right now. Please try again later.", true);
  } finally {
    recoveryRequestButton.disabled = false;
    backToLoginButton.disabled = false;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) {
    return;
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const passwordConfirmation = String(formData.get("password-confirm") || "");
  if (authMode === "register" && password !== passwordConfirmation) {
    passwordMismatch.hidden = false;
    passwordConfirmInput.focus();
    return;
  }
  passwordMismatch.hidden = true;
  authSubmitButton.disabled = true;
  authModeToggle.disabled = true;
  setAuthStatus(authMode === "register" ? "Creating your account..." : "Signing in...");

  try {
    if (authMode === "register") {
      const displayName = String(formData.get("name") || "").trim();
      const bio = String(formData.get("bio") || "").trim();
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getLoginRedirectUrl(),
          data: {
            display_name: displayName,
            bio,
          },
        },
      });
      if (error) {
        throw error;
      }

      if (!data.session || !data.user) {
        loginForm.reset();
        document.getElementById("user-email").value = email;
        setAuthMode("login");
        setAuthStatus("Check your email for a confirmation link, then log in.");
        return;
      }

      loginForm.reset();
      await showProfile(data.user);
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
    loginForm.reset();
    await showProfile(data.user);
  } catch (error) {
    console.error("Authentication request failed.", error);
    setAuthStatus(error.message || "Authentication failed. Please try again.", true);
  } finally {
    authSubmitButton.disabled = false;
    authModeToggle.disabled = false;
  }
});

authModeToggle.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "register" : "login");
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  setAuthStatus("Signing out...");
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      throw error;
    }
    showLoginForm();
  } catch (error) {
    console.error("Unable to sign out.", error);
    setAuthStatus(`Unable to sign out: ${error.message}`, true);
  } finally {
    logoutButton.disabled = false;
  }
});

profilePostsGrid.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-delete-profile-post]");
  if (!deleteButton || !currentUser || deleteButton.disabled) {
    return;
  }
  if (!window.confirm("Are you sure you want to delete this post?")) {
    return;
  }

  deleteButton.disabled = true;
  setAuthStatus("Deleting your post...");
  try {
    const { data: postToDelete, error: lookupError } = await supabaseClient
      .from("posts")
      .select("image_url")
      .eq("id", deleteButton.dataset.deleteProfilePost)
      .eq("user_id", currentUser.id)
      .eq("is_starter", false)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!postToDelete) throw new Error("The post was not found or is no longer yours to delete.");
    const { data, error } = await supabaseClient
      .from("posts")
      .delete()
      .eq("id", deleteButton.dataset.deleteProfilePost)
      .eq("user_id", currentUser.id)
      .eq("is_starter", false)
      .select("id");
    if (error) {
      throw error;
    }
    if (!data.length) {
      throw new Error("The post was not found or is no longer yours to delete.");
    }
    const ownedImagePath = getOwnedInspirationImagePath(postToDelete.image_url, currentUser.id);
    let imageCleanupFailed = false;
    if (ownedImagePath) {
      try {
        const { error: storageError } = await supabaseClient.storage
          .from("inspiration-images")
          .remove([ownedImagePath]);
        if (storageError) throw storageError;
      } catch (storageError) {
        imageCleanupFailed = true;
        console.error("Post was deleted, but its uploaded image could not be removed.", storageError);
      }
    }
    await loadProfilePosts(currentUser);
    setAuthStatus(imageCleanupFailed
      ? "Post deleted. Its image could not be removed from storage; please try cleanup later."
      : "");
  } catch (error) {
    console.error("Unable to delete post.", error);
    setAuthStatus(`Unable to delete your post: ${error.message}`, true);
    deleteButton.disabled = false;
  }
});

function getOwnedInspirationImagePath(imageUrl, userId) {
  if (typeof imageUrl !== "string") return null;
  try {
    const url = new URL(imageUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.origin !== new URL(SUPABASE_URL).origin) return null;
    const marker = "/storage/v1/object/public/inspiration-images/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const path = decodeURIComponent(url.pathname.slice(index + marker.length));
    return path.startsWith(`${userId}/`) ? path : null;
  } catch (error) {
    return null;
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
    return;
  }
  window.setTimeout(() => {
    if (session?.user && session.user.id !== currentUser?.id) {
      void showProfile(session.user);
    } else if (!session?.user && currentUser) {
      showLoginForm();
    }
  }, 0);
});

async function initializeLoginPage() {
  if (new URLSearchParams(window.location.search).get("recover") === "1") {
    clearAuthCallbackUrl();
    showLoginForm();
    loginPanel.hidden = true;
    recoveryRequestPanel.hidden = false;
    recoveryEmailInput.focus();
    return;
  }
  const callbackMessage = getConfirmationCallbackMessage();
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      throw error;
    }
    if (data.session?.user) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError) {
        throw userError;
      }
      const user = userData.user;
      const wasConfirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);
      const arrivedFromCallback = Boolean(AUTH_CALLBACK_URL);
      clearAuthCallbackUrl();
      await showProfile(user || data.session.user);
      let profileNotice = "";
      try {
        profileNotice = window.sessionStorage.getItem("tourease_profile_notice") || "";
        window.sessionStorage.removeItem("tourease_profile_notice");
      } catch (storageError) {
        console.error("Unable to read the post confirmation message.", storageError);
      }
      if (profileNotice) {
        setAuthStatus(profileNotice);
      } else if (callbackMessage?.isError) {
        setAuthStatus(callbackMessage.message, true);
      } else if (wasConfirmed && arrivedFromCallback) {
        setAuthStatus("Email verified successfully. You can now log in.");
      }
    } else {
      clearAuthCallbackUrl();
      showLoginForm();
      if (callbackMessage) {
        setAuthStatus(callbackMessage.message, callbackMessage.isError);
      }
    }
  } catch (error) {
    console.error("Unable to restore the Supabase session.", error);
    clearAuthCallbackUrl();
    showLoginForm();
    setAuthStatus(
      callbackMessage?.message
        || (AUTH_CALLBACK_URL
          ? "This confirmation link is invalid or has expired. Request a new confirmation email and try again."
          : `Unable to check your session: ${error.message}`),
      true
    );
  }
}

setAuthMode("login");
void initializeLoginPage();
