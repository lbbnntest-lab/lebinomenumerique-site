// Page atteinte via le lien "recovery" envoyé par Supabase Auth (depuis
// mot-de-passe-oublie.html). Le SDK Supabase détecte automatiquement le
// token présent dans l'URL (#access_token=...&type=recovery) et ouvre une
// session temporaire suffisante pour appeler updateUser({password}).

document.addEventListener("DOMContentLoaded", () => {
  const zoneIntro = document.getElementById("zone-intro");
  const form = document.getElementById("form-reset");
  const zoneMessage = document.getElementById("zone-message");
  let lienValide = false;

  function marquerLienInvalide() {
    if (lienValide) return;
    zoneIntro.innerHTML = `<span class="message-erreur">Lien invalide ou expiré. <a href="mot-de-passe-oublie.html">Redemander un lien</a>.</span>`;
    form.style.display = "none";
  }

  function marquerLienValide() {
    lienValide = true;
    form.style.display = "";
  }

  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || session) marquerLienValide();
  });

  window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) marquerLienValide();
    else setTimeout(() => { if (!lienValide) marquerLienInvalide(); }, 1500);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    zoneMessage.innerHTML = "";
    const btn = document.getElementById("btn-submit");

    const motDePasse = document.getElementById("mot_de_passe").value;
    const confirmation = document.getElementById("mot_de_passe_confirmation").value;
    if (motDePasse !== confirmation) {
      zoneMessage.innerHTML = `<p class="message-erreur">Les deux mots de passe ne correspondent pas.</p>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Enregistrement...";
    try {
      const { error } = await window.supabaseClient.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      zoneMessage.innerHTML = `<p class="message-succes">Mot de passe mis à jour — redirection...</p>`;
      setTimeout(() => { window.location.href = "dashboard-client.html"; }, 1500);
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
      btn.disabled = false;
      btn.textContent = "Valider";
    }
  });
});
