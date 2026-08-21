// Historique des devis instantanés — liste les devis générés par ce
// commercial (table devis_prospects, migration 38), permet de changer leur
// statut de suivi, et de rouvrir le devis d'origine pour le relancer.
//
// Le contenu réel d'un devis (lignes, prix, contact) n'est jamais dupliqué
// ici : `devis_hash` est le même fragment que celui utilisé dans le lien
// envoyé au prospect (devis-instantane.html#d=...), décodé à la volée pour
// l'affichage — voir decoderDevis() ci-dessous, copie volontairement minimale
// de celle de js/devis-instantane.js (ce fichier n'est pas chargé sur cette
// page, qui n'a pas le DOM du formulaire de devis).

function decoderDevis(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    return null;
  }
}

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte == null ? "" : String(texte);
  return div.innerHTML;
}

function formaterEuros(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: montant % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + " €";
}

function calculerTotaux(lignes) {
  let totalPonctuel = 0, totalRecurrent = 0;
  (lignes || []).forEach((l) => {
    if (l.recurrent) totalRecurrent += l.prix;
    else totalPonctuel += l.prix;
    if (l.hebergement) totalRecurrent += l.hebergement;
  });
  return { totalPonctuel, totalRecurrent };
}

const LIBELLES_STATUT = { envoye: "Envoyé", relance: "Relancé", gagne: "Gagné", perdu: "Perdu" };

let devisChargesEnMemoire = [];

function rendreListe(filtreStatut) {
  const conteneur = document.getElementById("liste-devis");
  const items = devisChargesEnMemoire.filter((d) => !filtreStatut || d.statut === filtreStatut);

  if (items.length === 0) {
    conteneur.innerHTML = '<p class="historique-vide">Aucun devis pour l\'instant.</p>';
    return;
  }

  conteneur.innerHTML = "";
  items.forEach((d) => {
    const devis = decoderDevis(d.devis_hash);
    const { totalPonctuel, totalRecurrent } = devis ? calculerTotaux(devis.lignes) : { totalPonctuel: 0, totalRecurrent: 0 };
    const dateFormatee = new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const contact = devis ? [devis.prospect.contact, devis.prospect.secteur].filter(Boolean).join(" · ") : "";
    const nbOffres = devis ? devis.lignes.length : 0;

    const item = document.createElement("div");
    item.className = "historique-item";
    item.innerHTML = `
      <div class="historique-item-corps">
        <div class="historique-item-titre">${echapperHtml(d.prospect_entreprise)}</div>
        <div class="historique-item-meta">
          ${contact ? echapperHtml(contact) + " · " : ""}${nbOffres} offre${nbOffres > 1 ? "s" : ""} ·
          ${formaterEuros(totalPonctuel)} ponctuel · ${formaterEuros(totalRecurrent)}/mois ·
          généré le ${dateFormatee}
        </div>
      </div>
      <div class="historique-item-actions">
        <select class="statut-${d.statut}" data-id="${d.id}">
          <option value="envoye" ${d.statut === "envoye" ? "selected" : ""}>Envoyé</option>
          <option value="relance" ${d.statut === "relance" ? "selected" : ""}>Relancé</option>
          <option value="gagne" ${d.statut === "gagne" ? "selected" : ""}>Gagné</option>
          <option value="perdu" ${d.statut === "perdu" ? "selected" : ""}>Perdu</option>
        </select>
        <a class="btn btn-secondaire" href="devis-instantane.html#d=${encodeURIComponent(d.devis_hash)}" target="_blank" rel="noopener">Rouvrir</a>
      </div>
    `;
    conteneur.appendChild(item);

    const select = item.querySelector("select");
    select.addEventListener("change", async () => {
      const nouveauStatut = select.value;
      select.disabled = true;
      const { error } = await window.supabaseClient
        .from("devis_prospects")
        .update({ statut: nouveauStatut })
        .eq("id", d.id);
      select.disabled = false;
      if (error) {
        select.value = d.statut; // revert
        alert("Impossible de mettre à jour le statut — réessayez.");
        return;
      }
      d.statut = nouveauStatut;
      select.className = "statut-" + nouveauStatut;
      const filtreActuel = document.getElementById("filtre-statut").value;
      if (filtreActuel) rendreListe(filtreActuel); // fait disparaître la ligne si elle ne correspond plus au filtre
    });
  });
}

async function initialiserHistorique() {
  const session = await requireAuth("connexion.html");
  if (!session) return;

  const sb = window.supabaseClient;
  const { data: commercial } = await sb
    .from("commerciaux")
    .select("id")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.getElementById("etat-chargement").textContent =
      "Aucun profil commercial n'est rattaché à ce compte.";
    return;
  }

  document.getElementById("nav-header").innerHTML =
    '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="devis-instantane.html">Nouveau devis</a> <a href="#" onclick="logout()">Se déconnecter</a>';

  const { data: devis, error } = await sb
    .from("devis_prospects")
    .select("id,prospect_entreprise,devis_hash,statut,created_at")
    .eq("commercial_id", commercial.id)
    .order("created_at", { ascending: false });

  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("liste-devis").style.display = "block";

  if (error) {
    document.getElementById("liste-devis").innerHTML =
      '<p class="historique-vide">Impossible de charger l\'historique pour le moment.</p>';
    return;
  }

  devisChargesEnMemoire = devis || [];
  rendreListe("");

  document.getElementById("filtre-statut").addEventListener("change", (e) => rendreListe(e.target.value));
}

document.addEventListener("DOMContentLoaded", initialiserHistorique);
