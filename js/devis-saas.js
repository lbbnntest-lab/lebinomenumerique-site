// Devis Secrétariat Virtuel B2B — Module 2 (23/08/2026), même pattern que
// js/devis.js (devis-site-web.html) : capture publique dans prospects_devis
// via le workflow n8n 07 (générique, déjà réutilisable tel quel), email de
// confirmation + lien Cal.com automatique, attribution commerciale par
// ?code_affiliation=.
//
// Le catalogue (socle + options) n'est jamais codé en dur ici : chargé en
// direct depuis plans_tarifaires/options_produit (lecture publique, RLS),
// pour rester à jour si l'offre change — même principe que argumentaires.js.
// Contrairement à devis-instantane.html (outil de chiffrage zéro-backend
// pour un rendez-vous terrain), cette page crée un vrai prospect en base.

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte == null ? "" : String(texte);
  return div.innerHTML;
}

let socleActuel = null;
let optionsChargees = [];

async function chargerCatalogue() {
  const sb = window.supabaseClient;
  const [{ data: socle }, { data: options }] = await Promise.all([
    sb.from("plans_tarifaires").select("code,nom,prix_mensuel_ht").eq("code", "SECRETARIAT_SOCLE").eq("actif", true).maybeSingle(),
    sb.from("options_produit").select("code,nom,description,prix,type_facturation").eq("produit_parent", "secretariat").eq("actif", true)
  ]);

  socleActuel = socle;
  optionsChargees = options || [];

  const recap = document.getElementById("socle-recap");
  recap.innerHTML = socle
    ? `<strong>${echapperHtml(socle.nom)}</strong> — ${Number(socle.prix_mensuel_ht).toFixed(2)} €/mois<br><span style="font-size:.85rem; color:var(--gris-texte);">Tri automatique de vos emails, relance si téléphone manquant, bilan quotidien.</span>`
    : `<span class="option-bientot">Offre indisponible pour le moment.</span>`;

  const conteneur = document.getElementById("liste-options");
  conteneur.innerHTML = optionsChargees.length
    ? optionsChargees.map(o => `
        <label class="option-ligne">
          <input type="checkbox" data-code="${o.code}" data-nom="${echapperHtml(o.nom)}" data-prix="${o.prix}">
          <span class="option-detail">
            <strong>${echapperHtml(o.nom)}</strong><br>
            <span style="font-size:.85rem; color:var(--gris-texte);">${echapperHtml(o.description || "")}</span>
          </span>
          <span class="option-prix">+${Number(o.prix).toFixed(2)} €/mois</span>
        </label>`).join("")
    : "";
}

function construireLignesDevis() {
  const lignes = [];
  if (socleActuel) {
    lignes.push({ code: socleActuel.code, nom: socleActuel.nom, prix: Number(socleActuel.prix_mensuel_ht), recurrent: true });
  }
  document.querySelectorAll('#liste-options input[type="checkbox"]:checked').forEach(cb => {
    lignes.push({ code: cb.dataset.code, nom: cb.dataset.nom, prix: Number(cb.dataset.prix), recurrent: true });
  });
  return lignes;
}

document.addEventListener("DOMContentLoaded", () => {
  chargerCatalogue();

  const params = new URLSearchParams(window.location.search);
  const codeAffiliation = params.get("code_affiliation");
  if (codeAffiliation) document.getElementById("code_affiliation").value = codeAffiliation;

  const caseRdvPhysique = document.getElementById("rdv_physique_souhaite");
  const champCodePostal = document.getElementById("champ-code-postal-rdv");
  const inputCodePostal = document.getElementById("code_postal_rdv");
  caseRdvPhysique.addEventListener("change", () => {
    champCodePostal.style.display = caseRdvPhysique.checked ? "block" : "none";
    inputCodePostal.required = caseRdvPhysique.checked;
  });

  document.getElementById("form-devis-saas").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Envoi en cours...";

    const payload = {
      interet: "saas",
      prenom: document.getElementById("prenom").value,
      nom: document.getElementById("nom").value,
      email: document.getElementById("email").value,
      telephone: document.getElementById("telephone").value,
      budget_indicatif: document.getElementById("budget_indicatif").value,
      rdv_physique_souhaite: caseRdvPhysique.checked,
      code_postal_rdv: caseRdvPhysique.checked ? inputCodePostal.value : null,
      message: document.getElementById("message").value,
      code_affiliation: document.getElementById("code_affiliation").value || null,
      lignes_devis: construireLignesDevis(),
      source: "site_web"
    };

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/demande-devis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("Erreur lors de l'envoi.");
      zoneMessage.innerHTML = `<p class="message-succes">Merci ! Votre demande est bien reçue, un email vient de vous être envoyé avec un lien pour réserver un appel immédiatement si vous le souhaitez.</p>`;
      document.getElementById("form-devis-saas").reset();
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer ma demande";
    }
  });
});
