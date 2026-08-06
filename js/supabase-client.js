// Client Supabase partagé — chargé après le SDK CDN et config.js
window.supabaseClient = supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

async function requireAuth(redirectTo) {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = redirectTo || "index.html";
    return null;
  }
  return session;
}

async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "index.html";
}
