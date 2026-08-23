// Création rapide d'un prospect rencontré sur le terrain (Module 1,
// dashboard de prospection, 23/08/2026).
//
// Écriture en direct via Supabase (RLS self-insert, migration 41) : le
// commercial ne peut insérer que des lignes où commercial_id = son propre
// id (vérifié par la policy, pas par ce code) — même principe déjà retenu
// pour demandes_changement_statut_juridique (migration 13) et
// devis_prospects (migration 38), plus sûr qu'un webhook n8n recevant un
// commercial_id non vérifié depuis le client.

let commercialActuel = null;

async function initialiserFormulaire() {
  const session = await requireAuth("connexion-commercial.html");
  if (!session) return;

  const sb = window.supabaseClient;
  const { data: commercial } = await sb
    .from("commerciaux")
    .select("id")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.querySelector(".devis-layout").innerHTML =
      "<p>Aucun profil commercial n'est rattaché à ce compte.</p>";
    return;
  }
  commercialActuel = commercial;

  document.getElementById("nav-header").innerHTML =
    '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="prospection-terrain.html">Mes prospects</a> <a href="#" onclick="logout()">Se déconnecter</a>';
}

document.addEventListener("DOMContentLoaded", () => {
  initialiserFormulaire();

  document.getElementById("form-nouveau-prospect").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!commercialActuel) return;

    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Enregistrement...";

    const { error } = await window.supabaseClient.from("prospects_devis").insert({
      commercial_id: commercialActuel.id,
      raison_sociale: document.getElementById("raison_sociale").value.trim() || null,
      prenom: document.getElementById("prenom").value.trim() || null,
      nom: document.getElementById("nom").value.trim() || null,
      email: document.getElementById("email").value.trim(),
      telephone: document.getElementById("telephone").value.trim() || null,
      type_compte: "B2B",
      interet: document.getElementById("interet").value,
      budget_indicatif: document.getElementById("budget_indicatif").value.trim() || null,
      message: document.getElementById("message").value.trim() || null,
      source: "commercial_terrain",
      statut: "nouveau"
    });

    if (error) {
      zoneMessage.innerHTML = `<p class="message-erreur">Erreur lors de l'enregistrement. Réessayez ou contactez le support.</p>`;
      console.error(error);
      btn.disabled = false;
      btn.textContent = "Enregistrer le prospect";
      return;
    }

    window.location.href = "prospection-terrain.html";
  });
});
