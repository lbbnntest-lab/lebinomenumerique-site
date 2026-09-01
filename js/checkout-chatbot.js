// Parcours d'achat self-service du chatbot vendu seul (Lot 1, 31/08/2026).
// Envoie la demande à wf52 (webhook chatbot-mb-checkout) qui renvoie l'URL Stripe.
// Le compte client + la config chatbots_clients sont créés après paiement par
// la branche Stripe de wf52. Voir MASTER_PLAN.md §E-ter.
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const niveauParam = params.get("niveau");
  const codeAffiliationParam = params.get("code_affiliation");

  const selectNiveau = document.getElementById("niveau");
  const champCalcom = document.getElementById("champ-calcom");
  const champUrgence = document.getElementById("champ-urgence");
  const noteN3 = document.getElementById("note-n3");
  const inputCalcom = document.getElementById("cal_com_link");

  if (niveauParam && ["1", "2", "3"].includes(niveauParam)) selectNiveau.value = niveauParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  function majNiveau() {
    const n = parseInt(selectNiveau.value, 10);
    champCalcom.classList.toggle("hidden", n < 2);
    champUrgence.classList.toggle("hidden", n < 3);
    noteN3.classList.toggle("hidden", n < 3);
  }
  majNiveau();
  selectNiveau.addEventListener("change", majNiveau);

  document.getElementById("form-checkout-chatbot").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";

    const niveau = parseInt(selectNiveau.value, 10);
    const lienCalcom = inputCalcom.value.trim();
    if (niveau >= 2 && !lienCalcom) {
      zoneMessage.innerHTML = `<p class="message-erreur">Le Niveau ${niveau} nécessite un lien Cal.com pour la prise de rendez-vous.</p>`;
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
