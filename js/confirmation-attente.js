// Page d'attente affichée juste après paiement Stripe, tant que l'email n'est
// pas confirmé (requis pour ouvrir une session — cf. décision du 06/08/2026).
// Redirige automatiquement vers le dashboard dès qu'une session existe, y
// compris si la confirmation est cliquée dans un autre onglet (onAuthStateChange
// est notifié via le stockage partagé du même navigateur).

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (session) {
    window.location.href = "dashboard-client.html";
    return;
  }

  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      window.location.href = "dashboard-client.html";
    }
  });

  document.getElementById("btn-renvoyer").addEventListener("click", async () => {
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-renvoyer");
    zoneMessage.innerHTML = "";

    if (!email) {
      zoneMessage.innerHTML = `<p class="message-erreur">Adresse email introuvable — reconnectez-vous depuis la page d'inscription.</p>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Envoi...";
    try {
      const { error } = await window.supabaseClient.auth.resend({ type: "signup", email });
      if (error) throw error;
      zoneMessage.innerHTML = `<p class="message-succes">Email renvoyé — vérifiez votre boîte de réception.</p>`;
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Renvoyer l'email de confirmation";
    }
  });
});
