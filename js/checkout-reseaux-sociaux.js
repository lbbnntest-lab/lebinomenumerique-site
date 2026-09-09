// Parcours d'achat self-service du Calendrier de posts réseaux sociaux (09/09/2026, C3).
// Envoie la demande à wf69 (webhook reseaux-checkout) qui renvoie l'URL Stripe.
// Le compte client + la config calendriers_sociaux_clients sont créés après
// paiement par la branche Stripe de wf69. Présentation : js/wizard.js.
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const formuleParam = params.get("formule");

  const form = document.getElementById("form-checkout-reseaux");
  const selectFormule = document.getElementById("formule");
  if (formuleParam && ["standard", "sur_mesure"].includes(formuleParam)) selectFormule.value = formuleParam;

  const reseauxCoches = () =>
    Array.from(document.querySelectorAll(".reseau:checked")).map((c) => c.value);

  const NOM_RESEAU = {
    facebook: "Facebook", instagram: "Instagram",
    linkedin: "LinkedIn", google_business: "Google Business"
  };

  // Récapitulatif affiché à la dernière étape du wizard.
  window.wizardRecap = function () {
    const surMesure = selectFormule.value === "sur_mesure";
    const setup = surMesure ? 390 : 190;
    const mensuel = surMesure ? 149 : 89;
    const reseaux = reseauxCoches().map((r) => NOM_RESEAU[r] || r).join(", ") || "—";
    return {
      lignes: [
        { k: "Formule", v: surMesure ? "Sur-Mesure" : "Standard" },
        { k: "Posts / mois", v: document.getElementById("nb_posts_mois").value },
        { k: "Réseaux ciblés", v: reseaux },
        { k: "Entreprise", v: document.getElementById("nom_entreprise").value.trim() || "—" },
        { k: "Secteur", v: document.getElementById("secteur_activite").value.trim() || "—" },
        { k: "Email", v: document.getElementById("email").value.trim() || "—" },
        { k: "Installation (une fois)", v: setup + " €" },
        { k: "Abonnement", v: mensuel + " € / mois" }
      ],
      total: setup + " €",
      totalLabel: "À régler maintenant",
      note: "Puis " + mensuel + " € / mois. Votre premier calendrier est généré juste après le paiement."
    };
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = form.querySelector(".wiz-payer");
    zoneMessage.innerHTML = "";

    const reseaux = reseauxCoches();
    if (reseaux.length === 0) {
      zoneMessage.innerHTML = `<p class="message-erreur">Choisissez au moins un réseau (étape « Votre offre »).</p>`;
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
