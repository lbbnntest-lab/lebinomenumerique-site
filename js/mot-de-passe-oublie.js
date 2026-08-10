// Demande de réinitialisation de mot de passe : envoie l'email Supabase
// contenant le lien vers reset-password.html (où le nouveau mot de passe
// est effectivement défini).

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-oubli").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Envoi...";

    const email = document.getElementById("email").value.trim();
    const redirectTo = new URL("reset-password.html", window.location.href).href;

    try {
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      zoneMessage.innerHTML = `<p class="message-succes">Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.</p>`;
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer le lien";
    }
  });
});
