// Parcours d'achat self-service du Calendrier de posts réseaux sociaux (09/09/2026, C3).
// Envoie la demande à wf69 (webhook reseaux-checkout) qui renvoie l'URL Stripe.
// Le compte client + la config calendriers_sociaux_clients sont créés après
// paiement par la branche Stripe de wf69. Modèle : checkout-devis-mb.js.
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const formuleParam = params.get("formule");

  const selectFormule = document.getElementById("formule");
  if (formuleParam && ["standard", "sur_mesure"].includes(formuleParam)) selectFormule.value = formuleParam;

  document.getElementById("form-checkout-reseaux").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";

    const reseaux = Array.from(document.querySelectorAll(".reseau:checked")).map((c) => c.value);
    if (reseaux.length === 0) {
      zoneMessage.innerHTML = `<p class="message-erreur">Choisissez au moins un réseau.</p>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Préparation du paiement...";

    const payload = {
      formule: selectFormule.value,
      nom_entreprise: document.getElementById("nom_entreprise").value.trim(),
      secteur_activite: document.getElementById("secteur_activite").value.trim(),
      ton: document.getElementById("ton").value.trim() || null,
      reseaux_cibles: reseaux,
      nb_posts_mois: parseInt(document.getElementById("nb_posts_mois").value, 10),
      prenom: document.getElementById("prenom").value.trim(),
      nom: document.getElementById("nom").value.trim(),
      email: document.getElementById("email").value.trim(),
      telephone: document.getElementById("telephone").value.trim() || null,
      raison_sociale: document.getElementById("raison_sociale").value.trim() || null,
      siret: document.getElementById("siret").value.replace(/\s/g, "") || null,
      type_compte: "B2B"
    };

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/reseaux-checkout`, {
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
