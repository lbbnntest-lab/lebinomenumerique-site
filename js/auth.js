// Logique du formulaire d'inscription : pré-remplissage du plan depuis
// l'URL, création du compte Supabase Auth puis appel du workflow n8n
// d'onboarding qui renvoie l'URL de paiement Stripe. B2B uniquement — le
// B2C a été retiré du formulaire (Module 3, 23/08/2026, voir migration 42).

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get("plan");
  // Briques à la carte optionnelles (catalogue B2B "socle + briques", 19/08/2026),
  // ex. ?briques=SECRETARIAT_UTILISATEUR_SUPP,SECRETARIAT_EXPORT_AIRTABLE — voir
  // frontend_saas/index.html section #plans-b2b pour la construction du lien.
  const briquesCodes = (params.get("briques") || "").split(",").map(s => s.trim()).filter(Boolean);
  // Code d'affiliation d'un commercial (lien de parrainage généré par
  // dashboard-commercial.js : inscription.html?code_affiliation=XXX) —
  // pré-rempli ici comme devis.js/checkout-siteweb.js le font déjà pour ce
  // même paramètre, sinon le champ reste vide malgré le lien.
  const codeAffiliationParam = params.get("code_affiliation");

  const planInput = document.getElementById("plan");

  if (planParam) planInput.value = planParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  if (briquesCodes.length) {
    const recap = document.createElement("p");
    recap.style.cssText = "color:var(--gris-texte); font-size:.85rem; margin-top:-8px;";
    recap.textContent = "Options sélectionnées : " + briquesCodes.map(c =>
      ({ SECRETARIAT_UTILISATEUR_SUPP: "Utilisateur supplémentaire (+15€/mois)",
         SECRETARIAT_EXPORT_AIRTABLE: "Export Airtable (+19€/mois)",
         SECRETARIAT_SUPPORT_PRIORITAIRE: "Support prioritaire (+12€/mois)" }[c] || c)
    ).join(", ");
    planInput.insertAdjacentElement("afterend", recap);
  }

  // SECRETARIAT_SOCLE et ses briques n'ont qu'un Price ID mensuel pour l'instant
  // (voir config.js) — masquer le choix de cycle pour éviter d'envoyer un
  // stripe_price_id undefined si l'utilisateur choisit trimestriel/annuel.
  if (planInput.value === "SECRETARIAT_SOCLE") {
    const cycle = document.getElementById("cycle_facturation");
    cycle.value = "mensuel";
    cycle.closest(".champ").classList.add("hidden");
  }

  document.getElementById("form-inscription").addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = document.getElementById("btn-submit");
    zoneMessage.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Création du compte...";

    const type_compte = "B2B";
    const email = document.getElementById("email").value.trim();
    const mot_de_passe = document.getElementById("mot_de_passe").value;

    try {
      // 1. Création du compte d'authentification Supabase — emailRedirectTo
      // explicite (19-20/08/2026) : sans ça, Supabase utilise par défaut
      // l'origine de la page (window.location.origin), qui pour un site
      // GitHub Pages de projet ne contient jamais le sous-dossier du repo —
      // le lien de confirmation atterrissait donc sur une page 404.
      const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
        email,
        password: mot_de_passe,
        options: { emailRedirectTo: "https://lbbnntest-lab.github.io/lebinomenumerique-site/confirmation-attente.html" }
      });
      if (authError) throw authError;

      // 2. Création du compte client + session Stripe via n8n (service_role
      //    côté serveur, jamais exposé au navigateur)
      const payload = {
        type_compte,
        raison_sociale: document.getElementById("raison_sociale")?.value || null,
        siret: document.getElementById("siret")?.value || null,
        secteur_activite: document.getElementById("secteur_activite")?.value || null,
        nom: document.getElementById("nom").value,
        prenom: document.getElementById("prenom").value,
        fonction: document.getElementById("fonction").value || null,
        email,
        telephone: document.getElementById("telephone").value,
        code_affiliation: document.getElementById("code_affiliation").value || null,
        cycle_facturation: document.getElementById("cycle_facturation").value,
        plan_code: planInput.value,
        stripe_price_id: window.APP_CONFIG.STRIPE_PRICES[planInput.value]?.[document.getElementById("cycle_facturation").value],
        // Briques à la carte (catalogue B2B "socle + briques") : chaque code est
        // résolu vers son Price ID mensuel — pas de cycle trimestriel/annuel pour
        // l'instant sur les briques, voir config.js.
        briques: briquesCodes
          .map(code => ({ code, stripe_price_id: window.APP_CONFIG.STRIPE_PRICES[code]?.mensuel }))
          .filter(b => b.stripe_price_id),
        auth_user_id: authData.user?.id || null
      };

      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/inscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error("Le service d'inscription a renvoyé une erreur.");
      const result = await resp.json();

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        zoneMessage.innerHTML = `<p class="message-succes">Compte créé ! Vérifiez votre email pour confirmer votre inscription.</p>`;
      }
    } catch (err) {
      const dejaInscrit = /already registered|already exists|user_already_exists/i.test(err.message || "");
      zoneMessage.innerHTML = dejaInscrit
        ? `<p class="message-erreur">Cette adresse email est déjà associée à un compte. <a href="connexion.html">Connectez-vous</a> ou utilisez <a href="mot-de-passe-oublie.html">Mot de passe oublié</a> si besoin.</p>`
        : `<p class="message-erreur">${err.message || "Une erreur est survenue."}</p>`;
      btn.disabled = false;
      btn.textContent = "Continuer vers le paiement";
    }
  });
});
