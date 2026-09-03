// Parcours d'achat self-service du Devis marque blanche vendu seul (03/09/2026).
// Envoie la demande à wf59 (webhook devis-mb-checkout) qui renvoie l'URL Stripe.
// Le compte client + la config devis_marque_blanche_clients sont créés après
// paiement par la branche Stripe de wf59. Modèle : checkout-chatbot.js.
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const formuleParam = params.get("formule");
  const codeAffiliationParam = params.get("code_affiliation") || params.get("code");

  const selectFormule = document.getElementById("formule");
  if (formuleParam && ["starter", "pro"].includes(formuleParam)) selectFormule.value = formuleParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  document.getElementById("form-checkout-devis-mb").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Préparation du paiement...";

    const payload = {
      formule: selectFormule.value,
      nom_entreprise: document.getElementById("nom_entreprise").value.trim(),
      couleur_principale: document.getElementById("couleur_principale").value,
      email_notification_leads: document.getElementById("email_notification_leads").value.trim(),
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
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/devis-mb-checkout`, {
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
