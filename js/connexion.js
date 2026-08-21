// Connexion : authentifie via Supabase Auth, puis route vers le bon
// tableau de bord selon le rôle. Les commerciaux ont app_metadata.role =
// "commercial" (défini à la création de leur compte par le workflow 09,
// via l'API Admin service_role — jamais modifiable par le client, contrairement
// à user_metadata) ; tout le reste (pas de rôle défini) est traité comme un client.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Connexion...";

    const email = document.getElementById("email").value.trim();
    const mot_de_passe = document.getElementById("mot_de_passe").value;

    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password: mot_de_passe
      });
      if (error) throw error;

      const role = data.user?.app_metadata?.role;
      window.location.href = role === "commercial" ? "dashboard-commercial.html" : "dashboard-client.html";
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : (err.message || "Une erreur est survenue.")}</p>`;
      btn.disabled = false;
      btn.textContent = "Se connecter";
    }
  });
});
