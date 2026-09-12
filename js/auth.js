// Logique du formulaire d'inscription : pré-remplissage du plan depuis
// l'URL, création du compte Supabase Auth puis appel du workflow n8n
// d'onboarding qui renvoie l'URL de paiement Stripe. B2B uniquement — le
// B2C a été retiré du formulaire (Module 3, 23/08/2026, voir migration 42).

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get("plan");
  // Briques à la carte optionnelles (catalogue B2B "socle + briques", 19/08/2026),
  // ex. ?briques=SECRETARIAT_UTILISATEUR_SUPP,SECRETARIAT_SUPPORT_PRIORITAIRE — voir
  // frontend_saas/index.html section #plans-b2b pour la construction du lien.
  // SECRETARIAT_EXPORT_AIRTABLE retirée du catalogue vendable (07/09/2026) :
  // trop niche pour la cible, redirigée vers "Automatisation sur mesure".
  const briquesCodes = (params.get("briques") || "").split(",").map(s => s.trim()).filter(Boolean);
  // Code d'affiliation d'un commercial (lien de parrainage généré par
  // dashboard-commercial.js : inscription.html?code_affiliation=XXX) —
  // pré-rempli ici comme devis.js/checkout-siteweb.js le font déjà pour ce
  // même paramètre, sinon le champ reste vide malgré le lien.
  const codeAffiliationParam = params.get("code_affiliation");
  // Pack Complet : niveau de Gestion Appels choisi sur gestion-appels.html#pack
  // (?tel_niveau=TEL_ESSENTIEL|TEL_PRO|TEL_SURMESURE), Standard par défaut si absent.
  const NIVEAU_TEL = { TEL_ESSENTIEL: 1, TEL_PRO: 2, TEL_SURMESURE: 3 };
  const telNiveauCode = params.get("tel_niveau") || "TEL_ESSENTIEL";

  const planInput = document.getElementById("plan");

  if (planParam) planInput.value = planParam;
  if (codeAffiliationParam) document.getElementById("code_affiliation").value = codeAffiliationParam;

  const LIBELLE_BRIQUE = {
    SECRETARIAT_UTILISATEUR_SUPP: "Utilisateur supplémentaire (+15 €/mois)",
    SECRETARIAT_SUPPORT_PRIORITAIRE: "Support prioritaire, réponse sous 24h (+12 €/mois)",
    SECRETARIAT_VOLUME_400: "Volume + : +400 demandes/mois (+29 €/mois)",
    SECRETARIAT_VOLUME_1200: "Volume ++ : +1200 demandes/mois (+59 €/mois)",
    SECRETARIAT_ENVOI_GERE: "Envoi géré : on envoie les réponses en votre nom (+29 €/mois)",
    SECRETARIAT_RDV_CALCOM: "Gestion des rendez-vous (Cal.com) (+19 €/mois)",
    SECRETARIAT_ONBOARDING_PERSO: "Onboarding personnalisé (149 € HT, une fois)",
    DEVIS_MB_SUIVI_STARTER: "Configurateur de devis (+29 €/mois, installation offerte)"
  };
  if (briquesCodes.length) {
    const champ = document.getElementById("champ-briques");
    const recap = document.getElementById("briques-recap");
    if (champ && recap) {
      champ.style.display = "";
      recap.textContent = briquesCodes.map(c => LIBELLE_BRIQUE[c] || c).join(" · ");
    }
  }

  // Résumé de l'offre choisie (étape 1 du wizard).
  const LIBELLE_PLAN = {
    SECRETARIAT_SOCLE: "Gestion Email — 89 €/mois (250 demandes/mois incluses)",
    PACK_COMPLET: "Pack Complet — Gestion Email + Gestion Appels, 168 €/mois (−10 € de remise)",
    TEL_ESSENTIEL: "Gestion Appels — Standard, 89 €/mois",
    TEL_PRO: "Gestion Appels — Avancé, 149 €/mois",
    TEL_SURMESURE: "Gestion Appels — Sur-Mesure, 199 €/mois"
  };
  const resume = document.getElementById("wiz-offre-resume");
  if (resume) {
    resume.innerHTML = "<strong>Votre abonnement</strong><br>" +
      (LIBELLE_PLAN[planInput.value] || planInput.value || "Abonnement Le Binôme Numérique");
  }

  // SECRETARIAT_SOCLE, ses briques et les plans TEL_* n'ont qu'un Price ID
  // mensuel pour l'instant (voir config.js) — masquer le choix de cycle.
  if (planInput.value === "SECRETARIAT_SOCLE" || planInput.value === "PACK_COMPLET" || planInput.value.startsWith("TEL_")) {
    const cycle = document.getElementById("cycle_facturation");
    cycle.value = "mensuel";
    cycle.closest(".champ").classList.add("hidden");
  }

  window.wizardRecap = function () {
    const lignes = [
      { k: "Abonnement", v: LIBELLE_PLAN[planInput.value] || planInput.value || "—" }
    ];
    if (briquesCodes.length) {
      lignes.push({ k: "Options", v: briquesCodes.map(c => (LIBELLE_BRIQUE[c] || c).replace(/\s*\(.*\)$/, "")).join(", ") });
    }
    const cycleEl = document.getElementById("cycle_facturation");
    if (cycleEl && !cycleEl.closest(".champ").classList.contains("hidden")) {
      lignes.push({ k: "Facturation", v: cycleEl.selectedOptions[0].text });
    }
    lignes.push({ k: "Entreprise", v: document.getElementById("raison_sociale").value.trim() || "—" });
    lignes.push({ k: "Email", v: document.getElementById("email").value.trim() || "—" });
    return {
      lignes: lignes,
      note: "Vous serez redirigé vers le paiement sécurisé Stripe. Un email de confirmation vous sera envoyé."
    };
  };

  const formInscription = document.getElementById("form-inscription");
  formInscription.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zoneMessage = document.getElementById("zone-message");
    const btn = formInscription.querySelector(".wiz-payer") || document.getElementById("btn-submit");
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
      let authUserId = authData?.user?.id || null;
      if (authError) {
        // « Déjà inscrit » = bloquant (le client doit se connecter, pas repayer).
        if (/already registered|already exists|user_already_exists/i.test(authError.message || "")) throw authError;
        // Toute autre erreur de signUp (typiquement l'envoi de l'email de
        // confirmation qui échoue côté Supabase — limite de débit du SMTP par
        // défaut, service email indispo) NE DOIT JAMAIS bloquer le paiement :
        // wf08 crée le compte auth côté serveur de toute façon, et le lien
        // « définir votre mot de passe » part par Mailjet (wf08), pas par Supabase.
        // authUserId garde l'id si Supabase a quand même créé le compte (email
        // seul en échec) — wf08 le liera ; sinon il reste null et wf08 crée le
        // compte serveur. Les deux cas sont gérés par la branche IF de wf08.
        console.warn("signUp non bloquant, on poursuit le paiement :", authError.message);
      }

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
        // Pack Complet = une session Stripe à 2 lignes : socle (Gestion Email) +
        // le niveau Gestion Appels choisi (Standard par défaut). wf01 ajoute
        // pack_tel_price_id en 2e ligne + applique la remise Pack (coupon), wf08
        // provisionne les deux (abonnement PACK_COMPLET + config téléphonique
        // au niveau indiqué par pack_tel_niveau, plutôt que Standard pour tous).
        stripe_price_id: planInput.value === "PACK_COMPLET"
          ? window.APP_CONFIG.STRIPE_PRICES.SECRETARIAT_SOCLE?.mensuel
          : window.APP_CONFIG.STRIPE_PRICES[planInput.value]?.[document.getElementById("cycle_facturation").value],
        pack_tel_price_id: planInput.value === "PACK_COMPLET"
          ? window.APP_CONFIG.STRIPE_PRICES[telNiveauCode]?.mensuel : null,
        pack_tel_niveau: planInput.value === "PACK_COMPLET"
          ? (NIVEAU_TEL[telNiveauCode] || 1) : null,
        // Briques à la carte (catalogue B2B "socle + briques") : chaque code est
        // résolu vers son Price ID mensuel — pas de cycle trimestriel/annuel pour
        // l'instant sur les briques, voir config.js.
        // .mensuel pour les briques récurrentes ; repli sur .one_shot pour une brique ponctuelle
        // (ex. Onboarding personnalisé) — Stripe accepte 1 prix non récurrent mélangé aux lignes
        // récurrentes d'une session mode=subscription (déjà utilisé par wf14 : setup + hébergement).
        briques: briquesCodes
          .map(code => {
            const prix = window.APP_CONFIG.STRIPE_PRICES[code] || {};
            return { code, stripe_price_id: prix.mensuel || prix.one_shot };
          })
          .filter(b => b.stripe_price_id),
        auth_user_id: authUserId
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
