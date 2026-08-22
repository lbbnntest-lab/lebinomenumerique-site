// Connexion commerciale — page séparée de connexion.html (22/08/2026, décision
// sécurité/discrétion) : jamais liée depuis le site public, URL communiquée
// directement aux commerciaux. Rejette explicitement tout compte sans
// app_metadata.role = "commercial" (défini uniquement côté serveur, workflow 09
// via l'API Admin service_role — jamais falsifiable par le client).

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
      if (role !== "commercial") {
        await window.supabaseClient.auth.signOut();
        throw new Error("Ce compte n'est pas un compte commercial. Connectez-vous depuis l'espace client.");
      }
      window.location.href = "dashboard-commercial.html";
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : (err.message || "Une erreur est survenue.")}</p>`;
      btn.disabled = false;
      btn.textContent = "Se connecter";
    }
  });
});
