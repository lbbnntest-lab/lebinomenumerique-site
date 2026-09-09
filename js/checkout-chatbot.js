// Parcours d'achat self-service du chatbot vendu seul (Lot 1, 31/08/2026).
// Envoie la demande à wf52 (webhook chatbot-mb-checkout) qui renvoie l'URL Stripe.
// Le compte client + la config chatbots_clients sont créés après paiement par
// la branche Stripe de wf52. Présentation : js/wizard.js.
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const niveauParam = params.get("niveau");
  const codeAffiliationParam = params.get("code_affiliation");

  const form = document.getElementById("form-checkout-chatbot");
  const selectNiveau = document.getElementById("niveau");
  const champCalcom = document.getElementById("champ-calcom");
  const champUrgence = document.getElementById("champ-urgence");
  const noteN3 = document.getElementById("note-n3");
  const inputCalcom = document.getElementById("cal_com_link");

  if (niveauParam && ["1", "2", "3"].includes(niveauParam)) selectNiveau.value = niveauParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  const PRIX = { 1: [390, 29], 2: [590, 49], 3: [1190, 89] };

  function majNiveau() {
    const n = parseInt(selectNiveau.value, 10);
    champCalcom.classList.toggle("hidden", n < 2);
    champUrgence.classList.toggle("hidden", n < 3);
    noteN3.classList.toggle("hidden", n < 3);
  }
  majNiveau();
  selectNiveau.addEventListener("change", majNiveau);

  // Étapes : 0 offre · 1 assistant · 2 coordonnées · 3 récap.
  window.wizardValiderEtape = function (idx) {
    if (idx === 1) {
      const n = parseInt(selectNiveau.value, 10);
      if (n >= 2 && !inputCalcom.value.trim()) {
        return `Le Niveau ${n} nécessite un lien Cal.com pour la prise de rendez-vous.`;
      }
    }
    return true;
  };

  window.wizardRecap = function () {
    const n = parseInt(selectNiveau.value, 10);
    const [setup, mensuel] = PRIX[n] || PRIX[1];
    return {
      lignes: [
        { k: "Formule", v: "Chatbot Niveau " + n },
        { k: "Couleur du widget", v: document.getElementById("couleur_widget").selectedOptions[0].text },
        { k: "Assistant de", v: document.getElementById("nom_entreprise").value.trim() || "—" },
        { k: "Email", v: document.getElementById("email").value.trim() || "—" },
        { k: "Installation (une fois)", v: setup + " €" },
        { k: "Abonnement", v: mensuel + " € / mois" }
      ],
      total: setup + " €",
      totalLabel: "À régler maintenant",
      note: "Puis " + mensuel + " € / mois. Après le paiement, vous recevez la ligne de code à coller sur votre site."
    };
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = form.querySelector(".wiz-payer");
    zoneMessage.innerHTML = "";

    const niveau = parseInt(selectNiveau.value, 10);
    const lienCalcom = inputCalcom.value.trim();
    if (niveau >= 2 && !lienCalcom) {
      zoneMessage.innerHTML = `<p class="message-erreur">Le Niveau ${niveau} nécessite un lien Cal.com (étape « Votre assistant »).</p>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Préparation du paiement...";

    const payload = {
      niveau,
      nom_entreprise: document.getElementById("nom_entreprise").value.trim(),
      secteur_activite: document.getElementById("secteur_activite").value.trim() || null,
      ton: document.getElementById("ton").value.trim() || null,
      message_accueil: document.getElementById("message_accueil").value.trim() || null,
      couleur_widget: document.getElementById("couleur_widget").value,
      cal_com_link: niveau >= 2 ? lienCalcom : null,
      contact_urgence_email: niveau >= 3 ? (document.getElementById("contact_urgence_email").value.trim() || null) : null,
      prenom: document.getElementById("prenom").value.trim(),
      nom: document.getElementById("nom").value.trim(),
      email: document.getElementById("email").value.trim(),
      telephone: document.getElementById("telephone").value.trim() || null,
      raison_sociale: document.getElementById("raison_sociale").value.trim() || null,
      siret: document.getElementById("siret").value.replace(/\s/g, "") || null,
      type_compte: "B2B",
      code_affiliation: document.getElementById("code_affiliation").value.trim() || null
    };

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/chatbot-mb-checkout`, {
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
