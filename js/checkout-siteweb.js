document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const codeReferenceParam = params.get("pack");
  const codeAffiliationParam = params.get("code_affiliation");

  const selectPack = document.getElementById("code_reference");
  const champsCatalogue = document.getElementById("champs-catalogue");
  const listeProduits = document.getElementById("liste-produits");
  const btnAjouterProduit = document.getElementById("btn-ajouter-produit");
  const MAX_PRODUITS = 30;

  const optionChatbotNiveau = document.getElementById("option_chatbot_niveau");
  const champChatbotCalcom = document.getElementById("champ-chatbot-calcom");
  const noteChatbotN3 = document.getElementById("note-chatbot-n3");
  optionChatbotNiveau.addEventListener("change", () => {
    const niveau = parseInt(optionChatbotNiveau.value, 10);
    champChatbotCalcom.classList.toggle("hidden", niveau < 2);
    noteChatbotN3.classList.toggle("hidden", niveau < 3);
  });

  if (codeReferenceParam) selectPack.value = codeReferenceParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

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

  const listeAvis = document.getElementById("liste-avis");
  const btnAjouterAvis = document.getElementById("btn-ajouter-avis");
  const MAX_AVIS = 3;

  function ajouterLigneAvis() {
    if (listeAvis.children.length >= MAX_AVIS) return;
    const ligne = document.createElement("div");
    ligne.className = "ligne-avis";
    ligne.style.cssText = "display:grid; grid-template-columns:1fr 2fr auto; gap:8px; margin-bottom:10px; align-items:center;";
    ligne.innerHTML = `
      <input type="text" class="avis-auteur" placeholder="Nom du client">
      <input type="text" class="avis-texte" placeholder="Texte de l'avis">
      <button type="button" class="btn-supprimer-avis" title="Supprimer" style="background:none; border:none; color:var(--rouge-alerte); font-size:1.2rem; cursor:pointer;">&times;</button>
    `;
    ligne.querySelector(".btn-supprimer-avis").addEventListener("click", () => ligne.remove());
    listeAvis.appendChild(ligne);
  }
  btnAjouterAvis.addEventListener("click", ajouterLigneAvis);

  function collecterAvis() {
    return Array.from(listeAvis.querySelectorAll(".ligne-avis"))
      .map((ligne) => ({
        auteur: ligne.querySelector(".avis-auteur").value.trim(),
        texte: ligne.querySelector(".avis-texte").value.trim()
      }))
      .filter((a) => a.auteur && a.texte);
  }

  document.getElementById("form-checkout-siteweb").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Préparation du paiement...";

    const niveauChatbot = parseInt(optionChatbotNiveau.value, 10);
    const lienCalComChatbot = document.getElementById("chatbot_cal_com_link").value.trim();
    if (niveauChatbot >= 2 && !lienCalComChatbot) {
      zoneMessage.innerHTML = `<p class="message-erreur">Le Niveau ${niveauChatbot} de l'assistant IA nécessite un lien Cal.com pour la prise de RDV.</p>`;
      btn.disabled = false;
      btn.textContent = "Continuer vers le paiement";
      return;
    }

    const payload = {
      code_reference: selectPack.value,
      type_compte: "B2B",
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
      nom_dirigeant: document.getElementById("nom_dirigeant").value.trim() || null,
      histoire_entreprise: document.getElementById("histoire_entreprise").value.trim() || null,
      differenciateur: document.getElementById("differenciateur").value.trim() || null,
      zone_intervention: document.getElementById("zone_intervention").value.trim() || null,
      horaires: document.getElementById("horaires").value.trim() || null,
      logo_url: document.getElementById("logo_url").value.trim() || null,
      photos_url: document.getElementById("photos_url").value.trim() || null,
      avis_clients: collecterAvis(),
      produits: collecterProduits(),
      option_chatbot_niveau: niveauChatbot,
      chatbot_cal_com_link: niveauChatbot >= 2 ? lienCalComChatbot : null
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
