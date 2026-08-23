// Liste des prospects du commercial connecté (Module 1, dashboard de
// prospection terrain, 23/08/2026) — table prospects_devis, quelle que soit
// leur origine (terrain, site, chatbot). Mise à jour du statut en direct,
// même pattern que js/historique-devis.js (RLS self-update, migration 41).

const LIBELLES_STATUT = { nouveau: "Nouveau", contacte: "Contacté", devis_envoye: "Devis envoyé", converti: "Converti", perdu: "Perdu" };
const LIBELLES_SOURCE = { commercial_terrain: "Terrain", site_web: "Site web", chatbot: "Chatbot", flyer: "Flyer" };
const LIBELLES_INTERET = { saas: "Secrétariat virtuel", site_web: "Site web", les_deux: "Les deux" };

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte == null ? "" : String(texte);
  return div.innerHTML;
}

let prospectsChargesEnMemoire = [];
let codeAffiliationActuel = null;

function rendreListe() {
  const filtreStatut = document.getElementById("filtre-statut").value;
  const filtreSource = document.getElementById("filtre-source").value;
  const conteneur = document.getElementById("liste-prospects");

  const items = prospectsChargesEnMemoire.filter((p) =>
    (!filtreStatut || p.statut === filtreStatut) &&
    (!filtreSource || p.source === filtreSource)
  );

  if (items.length === 0) {
    conteneur.innerHTML = '<p class="prospection-vide">Aucun prospect pour l\'instant.</p>';
    return;
  }

  conteneur.innerHTML = "";
  items.forEach((p) => {
    const titre = p.raison_sociale || [p.prenom, p.nom].filter(Boolean).join(" ") || p.email;
    const contact = [p.email, p.telephone].filter(Boolean).join(" · ");
    const dateFormatee = new Date(p.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    const item = document.createElement("div");
    item.className = "prospect-item";
    item.innerHTML = `
      <div class="prospect-item-corps">
        <div class="prospect-item-titre">${echapperHtml(titre)}<span class="etiquette-source">${LIBELLES_SOURCE[p.source] || p.source || "—"}</span></div>
        <div class="prospect-item-meta">
          ${contact ? echapperHtml(contact) + " · " : ""}${LIBELLES_INTERET[p.interet] || p.interet} · reçu le ${dateFormatee}
        </div>
        ${p.message ? `<div class="prospect-item-message">${echapperHtml(p.message)}</div>` : ""}
      </div>
      <div class="prospect-item-actions">
        <select class="statut-${p.statut}" data-id="${p.id}">
          ${Object.entries(LIBELLES_STATUT).map(([val, lib]) =>
            `<option value="${val}" ${p.statut === val ? "selected" : ""}>${lib}</option>`).join("")}
        </select>
        <a class="btn btn-secondaire" href="devis-instantane.html" target="_blank" rel="noopener">Devis instantané</a>
        <a class="btn btn-secondaire" href="devis-saas.html${codeAffiliationActuel ? "?code_affiliation=" + encodeURIComponent(codeAffiliationActuel) : ""}" target="_blank" rel="noopener">Devis SaaS</a>
      </div>
    `;
    conteneur.appendChild(item);

    const select = item.querySelector("select");
    select.addEventListener("change", async () => {
      const nouveauStatut = select.value;
      select.disabled = true;
      const { error } = await window.supabaseClient
        .from("prospects_devis")
        .update({ statut: nouveauStatut })
        .eq("id", p.id);
      select.disabled = false;
      if (error) {
        select.value = p.statut; // revert
        alert("Impossible de mettre à jour le statut — réessayez.");
        console.error(error);
        return;
      }
      p.statut = nouveauStatut;
      select.className = "statut-" + nouveauStatut;
    });
  });
}

async function initialiserProspection() {
  const session = await requireAuth("connexion-commercial.html");
  if (!session) return;

  const sb = window.supabaseClient;
  const { data: commercial } = await sb
    .from("commerciaux")
    .select("id,code_affiliation")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.getElementById("etat-chargement").textContent =
      "Aucun profil commercial n'est rattaché à ce compte.";
    return;
  }
  codeAffiliationActuel = commercial.code_affiliation;

  document.getElementById("nav-header").innerHTML =
    '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="argumentaires.html">Argumentaires</a> <a href="#" onclick="logout()">Se déconnecter</a>';

  const { data: prospects, error } = await sb
    .from("prospects_devis")
    .select("id,raison_sociale,prenom,nom,email,telephone,interet,message,statut,source,created_at")
    .eq("commercial_id", commercial.id)
    .order("created_at", { ascending: false });

  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("liste-prospects").style.display = "block";

  if (error) {
    document.getElementById("liste-prospects").innerHTML =
      '<p class="prospection-vide">Impossible de charger vos prospects pour le moment.</p>';
    console.error(error);
    return;
  }

  prospectsChargesEnMemoire = prospects || [];
  rendreListe();

  document.getElementById("filtre-statut").addEventListener("change", rendreListe);
  document.getElementById("filtre-source").addEventListener("change", rendreListe);
}

document.addEventListener("DOMContentLoaded", initialiserProspection);
