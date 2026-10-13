const SUPABASE_URL = "https://pfzufpdqrlpznxvzpifm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rmHlRMOG2MjpvwD2nlIbXw_pVIHaXtn";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  const message = "Supabase could not load. Check your internet connection and reload the page.";
  const status = document.getElementById("auth-status")
    || document.getElementById("inspiration-feed");
  if (status) {
    status.textContent = message;
    status.classList.add(
      status.id === "auth-status" ? "is-error" : "feed-status",
      "is-error"
    );
  }
  throw new Error("Supabase JS v2 did not load before js/supabase-config.js.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);