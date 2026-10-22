const resetStatus = document.getElementById("reset-status");
const resetPanel = document.getElementById("reset-panel");
const retryPanel = document.getElementById("reset-retry-panel");
const successPanel = document.getElementById("reset-success-panel");
const resetForm = document.getElementById("password-reset-form");
const newPasswordInput = document.getElementById("new-password");
const confirmNewPasswordInput = document.getElementById("confirm-new-password");
const resetMismatch = document.getElementById("reset-mismatch");
const resetSubmit = document.getElementById("reset-submit");
const RECOVERY_USER_KEY = "tourease_verified_recovery_user";
let recoveryEventReceived = false;
let recoveryUserId = null;

function setResetStatus(message, isError = false) {
  resetStatus.textContent = message;
  resetStatus.classList.toggle("is-error", isError);
}

function showRetry(message) {
  resetPanel.hidden = true;
  successPanel.hidden = true;
  retryPanel.hidden = false;
  setResetStatus(message, true);
}

function validateRecoverySession(session) {
  if (!session?.user) return Promise.resolve(false);
  return supabaseClient.auth.getUser().then(({ data, error }) => {
    if (error || !data.user || data.user.id !== session.user.id) return false;
    const storedUserId = window.sessionStorage.getItem(RECOVERY_USER_KEY);
    const verifiedByRecoveryEvent = recoveryEventReceived && recoveryUserId === data.user.id;
    const verifiedBeforeRefresh = storedUserId === data.user.id;
    return verifiedByRecoveryEvent || verifiedBeforeRefresh;
  }).catch(() => false);
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" && session?.user) {
    recoveryEventReceived = true;
    recoveryUserId = session.user.id;
    try {
      window.sessionStorage.setItem(RECOVERY_USER_KEY, recoveryUserId);
    } catch (error) {
      console.warn("Unable to preserve the recovery page state for refresh.");
    }
  } else if (event === "SIGNED_OUT") {
    recoveryEventReceived = false;
    recoveryUserId = null;
    try { window.sessionStorage.removeItem(RECOVERY_USER_KEY); } catch (error) { /* Storage may be unavailable. */ }
  }
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    button.setAttribute("aria-pressed", String(!isVisible));
    const name = input.id === "confirm-new-password" ? "confirm password" : "password";
    button.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} ${name}`);
  });
});

function clearMismatchWhenCorrected() {
  if (newPasswordInput.value === confirmNewPasswordInput.value) resetMismatch.hidden = true;
}
newPasswordInput.addEventListener("input", clearMismatchWhenCorrected);
confirmNewPasswordInput.addEventListener("input", clearMismatchWhenCorrected);

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!resetForm.reportValidity()) return;
  if (newPasswordInput.value !== confirmNewPasswordInput.value) {
    resetMismatch.hidden = false;
    confirmNewPasswordInput.focus();
    return;
  }
  resetMismatch.hidden = true;
  resetSubmit.disabled = true;
  setResetStatus("Updating your password...");
  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !await validateRecoverySession(sessionData?.session)) {
      showRetry("Your recovery session is no longer valid. Request another reset email to continue.");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password: newPasswordInput.value });
    if (error) throw error;
    try { window.sessionStorage.removeItem(RECOVERY_USER_KEY); } catch (storageError) { /* Storage may be unavailable. */ }
    resetPanel.hidden = true;
    successPanel.hidden = false;
    setResetStatus("Your password was updated successfully.");
  } catch (error) {
    console.error("Password update failed.", error);
    setResetStatus("We couldn’t update your password. Please request a new reset link and try again.", true);
  } finally {
    resetSubmit.disabled = false;
  }
});

async function initializePasswordReset() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const callbackError = query.has("error") || query.has("error_code") || hash.has("error") || hash.has("error_code");
  if (callbackError) {
    try { window.sessionStorage.removeItem(RECOVERY_USER_KEY); } catch (error) { /* Storage may be unavailable. */ }
    window.history.replaceState({}, document.title, window.location.pathname);
    showRetry("This recovery link is invalid or expired. Request another reset email to continue.");
    return;
  }
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !await validateRecoverySession(data?.session)) {
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      showRetry("We couldn’t verify an active recovery link. Request another reset email to continue.");
      return;
    }
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    resetPanel.hidden = false;
    setResetStatus("");
    newPasswordInput.focus();
  } catch (error) {
    console.error("Unable to verify the password recovery session.", error);
    showRetry("We couldn’t verify an active recovery link. Request another reset email to continue.");
  }
}

void initializePasswordReset();
