// Page de confirmation d'email maison (19-20/08/2026) — contourne un
// comportement Supabase où la redirection automatique après clic sur le lien
// de confirmation atterrissait sur la racine du domaine GitHub Pages
// (https://lbbnntest-lab.github.io/) au lieu du sous-dossier du site, malgré
// un Site URL et des Redirect URLs correctement configurés côté Supabase.
// Cause exacte non élucidée (comportement interne à Supabase), contournée en
// pointant le template email directement vers cette page (token_hash + type
// en query params) plutôt que de laisser Supabase gérer la redirection.

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const token_hash = params.get("token_hash");
  const type = params.get("type") || "signup";
  const titre = document.getElementById("titre-confirmation");
  const message = document.getElementById("message-confirmation");

  if (!token_hash) {
    titre.textContent = "Lien invalide";
    message.textContent = "Ce lien de confirmation est incomplet — redemandez un email depuis la page d'inscription.";
    return;
  }

  const { error } = await window.supabaseClient.auth.verifyOtp({ token_hash, type });
  if (error) {
    titre.textContent = "Lien expiré ou déjà utilisé";
    message.innerHTML = `${error.message}<br>Reconnectez-vous ou redemandez un email depuis la <a href="connexion.html">page de connexion</a>.`;
    return;
  }

  titre.textContent = "Email confirmé !";
  message.textContent = "Redirection vers votre espace...";
  setTimeout(() => { window.location.href = "dashboard-client.html"; }, 1200);
});
