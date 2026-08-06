document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const codeReferenceParam = params.get("pack");
  const codeAffiliationParam = params.get("code_affiliation");

  const selectPack = document.getElementById("code_reference");
  const selectType = document.getElementById("type_compte");
  const champsB2B = document.getElementById("champs-b2b");
  const champsCatalogue = document.getElementById("champs-catalogue");
  const listeProduits = document.getElementById("liste-produits");
  const btnAjouterProduit = document.getElementById("btn-ajouter-produit");
  const MAX_PRODUITS = 30;

  if (codeReferenceParam) selectPack.value = codeReferenceParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  function toggleChampsB2B() {
    champsB2B.classList.toggle("hidden", selectType.value !== "B2B");
    document.getElementById("siret").required = selectType.value === "B2B";
  }
  toggleChampsB2B();
  selectType.addEventListener("change", toggleChampsB2B);

  function ajouterLigneProduit() {
    if (listeProduits.children.length >= MAX_PRODUITS) return;
    const ligne = document.createElement("div");
    ligne.className = "ligne-produit";
    ligne.style.cssText = "display:grid; grid-template-columns:2fr 1fr 2fr 2fr auto; gap:8px; margin-bottom:10px; align-items:center;";
    ligne.innerHTML = `
      <input type="text" class="produit-nom" placeholder="Nom du produit" required>
      <input type="number" class="produit-prix" placeholder="Prix €" min="0" step="0.01" required>
      <input type="text" class="produit-description" placeholder="Description">
      <input type="url" class="produit-image" placeholder="Lien photo (optionnel)">
      <button type="button" class="btn-supprimer-produit" title="Supprimer" style="background:none; border:none; color:var(--rouge-alerte); font-size:1.2rem; cursor:pointer;">&times;</button>
    `;
    ligne.querySelector(".btn-supprimer-produit").addEventListener("click", () => ligne.remove());
    listeProduits.appendChild(ligne);
  }

  function toggleChampsCatalogue() {
    const estEcommerce = selectPack.value === "SITE_ECOMMERCE";
    champsCatalogue.classList.toggle("hidden", !estEcommerce);
    if (estEcommerce && listeProduits.children.length === 0) {
      ajouterLigneProduit();
      ajouterLigneProduit();
      ajouterLigneProduit();
    }
  }
  toggleChampsCatalogue();
  selectPack.addEventListener("change", toggleChampsCatalogue);
  btnAjouterProduit.addEventListener("click", ajouterLigneProduit);

  function collecterProduits() {
    if (selectPack.value !== "SITE_ECOMMERCE") return [];
    return Array.from(listeProduits.querySelectorAll(".ligne-produit"))
      .map((ligne) => ({
        nom: ligne.querySelector(".produit-nom").value.trim(),
        prix: parseFloat(ligne.querySelector(".produit-prix").value) || 0,
        description: ligne.querySelector(".produit-description").value.trim() || null,
        image_url: ligne.querySelector(".produit-image").value.trim() || null
      }))
      .filter((p) => p.nom);
  }

  document.getElementById("form-checkout-siteweb").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Préparation du paiement...";

    const payload = {
      code_reference: selectPack.value,
      type_compte: selectType.value,
      raison_sociale: document.getElementById("raison_sociale")?.value || null,
      siret: document.getElementById("siret")?.value || null,
      secteur_activite: document.getElementById("secteur_activite")?.value || null,
      prenom: document.getElementById("prenom").value,
      nom: document.getElementById("nom").value,
      email: document.getElementById("email").value,
      telephone: document.getElementById("telephone").value,
      code_affiliation: document.getElementById("code_affiliation").value || null,
      couleur_preferee: document.getElementById("couleur_preferee").value || null,
      contenu_supplementaire: document.getElementById("contenu_supplementaire").value.trim() || null,
      logo_url: document.getElementById("logo_url").value.trim() || null,
      photos_url: document.getElementById("photos_url").value.trim() || null,
      produits: collecterProduits()
    };

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/demande-checkout-siteweb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("Le service de paiement a renvoyé une erreur.");
      const result = await resp.json();

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        throw new Error("Aucune URL de paiement reçue.");
      }
    } catch (err) {
      zoneMessage.innerHTML = `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
      btn.disabled = false;
      btn.textContent = "Continuer vers le paiement";
    }
  });
});
