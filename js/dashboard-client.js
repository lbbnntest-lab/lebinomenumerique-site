// Catalogue des offres "simples" proposables en achat direct depuis le dashboard
// (hors Sur-Mesure, qui passe par une demande de prix, pas un achat direct).
// Volontairement dupliqué du catalogue affiché sur index.html/devis-instantane.js
// plutôt que lu depuis plans_tarifaires : garde l'autorité des prix affichés
// alignée avec le reste du site, la résolution du vrai Price ID Stripe se fait
// côté serveur (workflow 36) à partir du plan_code, jamais du prix envoyé ici.
// Le Pack Complet NE figure PAS ici : 2 lignes Stripe + coupon + niveau Gestion
// Appels au choix -> il se souscrit depuis inscription.html, pas via l'ajout
// d'offre simple du dashboard (wf36 le rejette explicitement, D13).
const OFFRES_SIMPLES_DASHBOARD = [
  { plan_code: "SECRETARIAT_SOCLE", nom: "Gestion Email", prix: 89, description: "Tri automatique de vos emails, relance si téléphone manquant, bilan quotidien.", bientot: false },
  { plan_code: "TEL_ESSENTIEL", nom: "Gestion Appels — Standard", prix: 89, description: "Accueil vocal : répond aux questions, prend les messages ; RDV et réservations enregistrés, vous confirmez.", bientot: false },
  { plan_code: "TEL_PRO", nom: "Gestion Appels — Avancé", prix: 149, description: "Tout Standard, plus transfert d'appel en cas d'urgence et alerte SMS après chaque appel.", bientot: false },
  { plan_code: "TEL_SURMESURE", nom: "Gestion Appels — Sur-mesure", prix: 199, description: "Tout Avancé, plus prise de commande à emporter, rappels sortants, qualification poussée.", bientot: false }
];

// Si le client a déjà le Pack Complet, Email + Appels sont couverts -> on les masque.
function filtrerOffresPack(offres, codesDejaSouscrits) {
  if (!codesDejaSouscrits.has("PACK_COMPLET")) return offres;
  return offres.filter(o => o.plan_code !== "SECRETARIAT_SOCLE" && !o.plan_code.startsWith("TEL_"));
}

// ---------- Navigation par panneaux (une section visible à la fois) ----------
(function () {
  function activerPanneau(nom) {
    const panneaux = [...document.querySelectorAll(".dash-panel")];
    if (!panneaux.some(p => p.dataset.panel === nom)) nom = "apercu";
    panneaux.forEach(p => { p.hidden = p.dataset.panel !== nom; });
    document.querySelectorAll(".dash-sidebar button[data-panel]").forEach(b =>
      b.classList.toggle("actif", b.dataset.panel === nom));
    if (location.hash.slice(1) !== nom) history.replaceState(null, "", "#" + nom);
    // Sur mobile la nav est horizontale : amener l'onglet actif dans la vue.
    document.querySelector(".dash-sidebar button.actif")?.scrollIntoView({ block: "nearest", inline: "center" });
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", (e) => {
    const cible = e.target.closest("button[data-panel]");
    if (!cible) return;
    e.preventDefault();
    activerPanneau(cible.dataset.panel);
  });
  window.addEventListener("hashchange", () => activerPanneau(location.hash.slice(1) || "apercu"));
  document.addEventListener("DOMContentLoaded", () => activerPanneau(location.hash.slice(1) || "apercu"));
})();

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth("connexion.html");
  if (!session) return;

  const sb = window.supabaseClient;

  // Le compte client rattaché à l'utilisateur connecté (RLS restreint déjà
  // la lecture au compte de l'utilisateur, cf. utilisateurs_comptes)
  const { data: utilisateur } = await sb
    .from("utilisateurs_comptes")
    .select("compte_client_id, prenom, role")
    .eq("id", session.user.id)
    .single();

  if (!utilisateur) return;

  document.getElementById("titre-bienvenue").textContent = `Bienvenue ${utilisateur.prenom || ""}`;

  const { data: compte } = await sb
    .from("comptes_clients")
    .select("statut, raison_sociale, siret, secteur_activite, telephone")
    .eq("id", utilisateur.compte_client_id)
    .single();

  // Bouton « Créer mon site » (panneau Ajouter un service) : renvoie vers le
  // checkout site web avec les infos du compte pré-remplies. Le rattachement à
  // l'espace se fait par l'email (upsert on_conflict email dans wf14).
  const lienCreerSite = document.getElementById("lien-creer-site");
  if (lienCreerSite) {
    const p = new URLSearchParams({
      email: session.user.email || "",
      raison_sociale: compte?.raison_sociale || "",
      siret: compte?.siret || "",
      secteur_activite: compte?.secteur_activite || "",
      telephone: compte?.telephone || "",
      prenom: utilisateur.prenom || ""
    });
    lienCreerSite.href = "checkout-siteweb.html?" + p.toString();
  }

  // Un client peut avoir PLUSIEURS abonnements actifs en même temps (le plan
  // SaaS et l'hébergement d'un site web sont deux abonnements distincts
  // depuis 6_patch_hebergement_sites.sql) — on récupère donc un tableau, pas
  // une ligne unique.
  const { data: abonnementsActifs } = await sb
    .from("abonnements")
    .select("cycle_facturation, statut, plans_tarifaires(nom, code, nb_utilisateurs_inclus)")
    .eq("compte_client_id", utilisateur.compte_client_id)
    .eq("statut", "actif");

  const listeAbonnements = abonnementsActifs || [];

  // Les services récurrents achetés en option (Visibilité suivi, Chatbot, options
  // téléphonie…) ne sont pas dans `abonnements` mais dans `options_actives`
  // (abonnement_id null) — ils sont pourtant facturés chaque mois par Stripe.
  // On les affiche dans le même tableau pour que le client voie ce qu'il paie.
  const { data: optionsRecurrentes } = await sb
    .from("options_actives")
    .select("statut, quantite, options_produit!inner(nom, code, type_facturation)")
    .eq("compte_client_id", utilisateur.compte_client_id)
    .eq("statut", "active")
    .eq("options_produit.type_facturation", "recurrent");

  const listeOptionsRecurrentes = optionsRecurrentes || [];

  const nomsActifs = [
    ...listeAbonnements.map(a => a.plans_tarifaires?.nom).filter(Boolean),
    ...listeOptionsRecurrentes.map(o => o.options_produit?.nom).filter(Boolean)
  ];

  document.getElementById("stat-statut").textContent = compte?.statut || "—";
  document.getElementById("stat-plan").textContent = nomsActifs.length ? nomsActifs.join(" + ") : "Aucun";

  // `abonnements.statut` est en français ('actif'/'résilié'...) mais `options_actives.statut`
  // utilise 'active'/'annulee' (contrainte de la table depuis l'origine, migration 29) — on
  // ne traduit qu'à l'affichage, jamais la valeur stockée (des dizaines de workflows la lisent
  // et l'écrivent telle quelle).
  const libelleStatutOption = (s) => (s === "active" ? "actif" : s === "annulee" ? "annulé" : s);
  const lignesAbo = listeAbonnements.map(a => `
        <tr>
          <td>${a.plans_tarifaires?.nom || "—"}</td>
          <td>${a.cycle_facturation === "annuel" ? "Annuel" : "Mensuel"}</td>
          <td><span class="badge badge-actif">${a.statut}</span></td>
        </tr>`);
  const lignesOptions = listeOptionsRecurrentes.map(o => `
        <tr>
          <td>${o.options_produit?.nom || "—"}${o.quantite > 1 ? ` ×${o.quantite}` : ""}</td>
          <td>Mensuel</td>
          <td><span class="badge badge-actif">${libelleStatutOption(o.statut)}</span></td>
        </tr>`);
  const toutesLignes = [...lignesAbo, ...lignesOptions];
  const htmlAbos = toutesLignes.length
    ? toutesLignes.join("")
    : `<tr><td colspan="3">Aucun abonnement actif pour le moment.</td></tr>`;
  // La table des abonnements est affichée à deux endroits (Vue d'ensemble + Abonnement & factures).
  ["tbody-abonnements", "tbody-abonnements-2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = htmlAbos;
  });

  // ---------- Ajouter une offre (achat direct de formules simples) ----------
  const codesDejaSouscrits = new Set(listeAbonnements.map(a => a.plans_tarifaires?.code).filter(Boolean));
  const conteneurOffres = document.getElementById("liste-offres-disponibles");
  const messageAjoutOffre = document.getElementById("message-ajout-offre");
  const peutSouscrire = utilisateur.role === "owner" || utilisateur.role === "admin";

  const offresAAfficher = filtrerOffresPack(
    OFFRES_SIMPLES_DASHBOARD.filter(o => !codesDejaSouscrits.has(o.plan_code)),
    codesDejaSouscrits
  );

  conteneurOffres.innerHTML = offresAAfficher.length
    ? offresAAfficher.map(o => `
        <div class="carte-offre-dashboard">
          <h4>${o.nom}${o.bientot ? ' <span class="badge badge-bientot">Bientôt disponible</span>' : ""}</h4>
          <div class="desc-offre">${o.description}</div>
          <div class="prix-offre">${o.prix} € HT/mois</div>
          ${o.bientot
            ? `<button class="btn btn-secondaire" disabled>Bientôt disponible</button>`
            : peutSouscrire
              ? `<button class="btn btn-primaire" data-plan-code="${o.plan_code}">Souscrire</button>`
              : `<p class="sous-titre-section" style="margin:0;">Seul le propriétaire ou un administrateur peut souscrire.</p>`}
        </div>`).join("")
    : `<p class="sous-titre-section">Aucune offre supplémentaire disponible pour le moment — vous êtes déjà abonné à tout ce qui est proposable aujourd'hui.</p>`;

  conteneurOffres.querySelectorAll("button[data-plan-code]").forEach(btn => {
    btn.addEventListener("click", async () => {
      messageAjoutOffre.innerHTML = "";
      btn.disabled = true;
      btn.textContent = "Redirection vers le paiement...";
      try {
        const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/dashboard-ajouter-offre`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
            plan_code: btn.dataset.planCode,
            cycle_facturation: "mensuel"
          })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
        window.location.href = result.checkout_url;
      } catch (err) {
        messageAjoutOffre.innerHTML = `<p class="message-erreur">${err.message}</p>`;
        btn.disabled = false;
        btn.textContent = "Souscrire";
      }
    });
  });

  // ---------- Visibilité renforcée (SEO + GEO) : ajout self-service ----------
  const blocVisibilite = document.getElementById("bloc-visibilite");
  const blocVisibiliteActif = document.getElementById("bloc-visibilite-actif");
  const btnVisibilite = document.getElementById("btn-visibilite");
  const messageVisibilite = document.getElementById("message-visibilite");

  if (blocVisibilite && btnVisibilite) {
    // options_actives : RLS restreint déjà au compte de l'utilisateur
    const { data: optionsVisibilite } = await sb
      .from("options_actives")
      .select("statut, options_produit!inner(produit_parent)")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "active")
      .eq("options_produit.produit_parent", "visibilite");

    if ((optionsVisibilite || []).length > 0) {
      blocVisibilite.style.display = "none";
      if (blocVisibiliteActif) blocVisibiliteActif.style.display = "block";
    } else if (!peutSouscrire) {
      btnVisibilite.disabled = true;
      messageVisibilite.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut souscrire.</span>`;
    } else {
      btnVisibilite.addEventListener("click", async () => {
        messageVisibilite.innerHTML = "";
        btnVisibilite.disabled = true;
        btnVisibilite.textContent = "Redirection vers le paiement...";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/visibilite-ajouter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              formule: document.getElementById("visibilite-formule").value
            })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
          window.location.href = result.checkout_url;
        } catch (err) {
          messageVisibilite.innerHTML = `<p class="message-erreur">${err.message}</p>`;
          btnVisibilite.disabled = false;
          btnVisibilite.textContent = "Souscrire";
        }
      });
    }
  }

  // ---------- Portail de facturation Stripe (gérer / résilier) ----------
  const btnPortail = document.getElementById("btn-portail");
  const messagePortail = document.getElementById("message-portail");
  if (btnPortail) {
    btnPortail.addEventListener("click", async () => {
      messagePortail.textContent = "";
      btnPortail.disabled = true;
      btnPortail.textContent = "Ouverture…";
      try {
        const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/portail-facturation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: session.access_token })
        });
        const result = await resp.json();
        if (!resp.ok || !result.url) throw new Error(result.erreur || "Impossible d'ouvrir le portail.");
        window.location.href = result.url;
      } catch (err) {
        messagePortail.innerHTML = `<span class="message-erreur">${err.message}</span>`;
        btnPortail.disabled = false;
        btnPortail.textContent = "Gérer mon abonnement / résilier";
      }
    });
  }

  // ---------- Chatbot pour votre site : ajout self-service ----------
  const blocChatbot = document.getElementById("bloc-chatbot");
  const blocChatbotActif = document.getElementById("bloc-chatbot-actif");
  const btnChatbot = document.getElementById("btn-chatbot");
  const messageChatbot = document.getElementById("message-chatbot");
  const chatbotNiveau = document.getElementById("chatbot-niveau");
  const chatbotChampCalcom = document.getElementById("chatbot-champ-calcom");
  const chatbotChampUrgence = document.getElementById("chatbot-champ-urgence");
  const chatbotCalcom = document.getElementById("chatbot-calcom");

  if (blocChatbot && btnChatbot) {
    document.getElementById("chatbot-nom").value = compte?.raison_sociale || "";

    const majNiveauChatbot = () => {
      const n = parseInt(chatbotNiveau.value, 10);
      chatbotChampCalcom.classList.toggle("hidden", n < 2);
      chatbotChampUrgence.classList.toggle("hidden", n < 3);
    };
    majNiveauChatbot();
    chatbotNiveau.addEventListener("change", majNiveauChatbot);

    const { data: optionsChatbot } = await sb
      .from("options_actives")
      .select("statut, options_produit!inner(produit_parent)")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "active")
      .eq("options_produit.produit_parent", "chatbot");

    if ((optionsChatbot || []).length > 0) {
      blocChatbot.style.display = "none";
      if (blocChatbotActif) blocChatbotActif.style.display = "block";
    } else if (!peutSouscrire) {
      btnChatbot.disabled = true;
      messageChatbot.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut souscrire.</span>`;
    } else {
      btnChatbot.addEventListener("click", async () => {
        const n = parseInt(chatbotNiveau.value, 10);
        if (n >= 2 && !chatbotCalcom.value.trim()) {
          messageChatbot.innerHTML = `<p class="message-erreur">Le Niveau ${n} nécessite un lien Cal.com.</p>`;
          return;
        }
        messageChatbot.innerHTML = "";
        btnChatbot.disabled = true;
        btnChatbot.textContent = "Redirection vers le paiement...";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/chatbot-mb-ajouter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              niveau: n,
              nom_entreprise: document.getElementById("chatbot-nom").value.trim() || null,
              couleur_widget: document.getElementById("chatbot-couleur").value,
              cal_com_link: n >= 2 ? chatbotCalcom.value.trim() : null,
              contact_urgence_email: n >= 3 ? (document.getElementById("chatbot-urgence").value.trim() || null) : null
            })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
          window.location.href = result.checkout_url;
        } catch (err) {
          messageChatbot.innerHTML = `<p class="message-erreur">${err.message}</p>`;
          btnChatbot.disabled = false;
          btnChatbot.textContent = "Souscrire";
        }
      });
    }
  }

  // ---------- Configurateur de devis marque blanche : ajout self-service ----------
  const blocDevisMb = document.getElementById("bloc-devis-mb");
  const blocDevisMbActif = document.getElementById("bloc-devis-mb-actif");
  const btnDevisMb = document.getElementById("btn-devismb");
  const messageDevisMb = document.getElementById("message-devismb");

  if (blocDevisMb && btnDevisMb) {
    document.getElementById("devismb-nom").value = compte?.raison_sociale || "";
    document.getElementById("devismb-email-leads").value = utilisateur?.email || compte?.email || "";

    const { data: optionsDevisMb } = await sb
      .from("options_actives")
      .select("statut, options_produit!inner(produit_parent)")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "active")
      .eq("options_produit.produit_parent", "devis_mb");

    if ((optionsDevisMb || []).length > 0) {
      blocDevisMb.style.display = "none";
      if (blocDevisMbActif) blocDevisMbActif.style.display = "block";
    } else if (!peutSouscrire) {
      btnDevisMb.disabled = true;
      messageDevisMb.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut souscrire.</span>`;
    } else {
      btnDevisMb.addEventListener("click", async () => {
        messageDevisMb.innerHTML = "";
        btnDevisMb.disabled = true;
        btnDevisMb.textContent = "Redirection vers le paiement...";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/devis-mb-ajouter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              formule: document.getElementById("devismb-formule").value,
              nom_entreprise: document.getElementById("devismb-nom").value.trim() || null,
              couleur_principale: document.getElementById("devismb-couleur").value,
              email_notification_leads: document.getElementById("devismb-email-leads").value.trim() || null
            })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
          window.location.href = result.checkout_url;
        } catch (err) {
          messageDevisMb.innerHTML = `<p class="message-erreur">${err.message}</p>`;
          btnDevisMb.disabled = false;
          btnDevisMb.textContent = "Souscrire";
        }
      });
    }
  }

  // ---------- Réseaux sociaux (calendrier de posts) : ajout self-service ----------
  const blocReseaux = document.getElementById("bloc-reseaux");
  const blocReseauxActif = document.getElementById("bloc-reseaux-actif");
  const btnReseaux = document.getElementById("btn-reseaux");
  const messageReseaux = document.getElementById("message-reseaux");

  if (blocReseaux && btnReseaux) {
    document.getElementById("reseaux-secteur").value = compte?.secteur_activite || "";

    const { data: optionsReseaux } = await sb
      .from("options_actives")
      .select("statut, options_produit!inner(produit_parent)")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "active")
      .eq("options_produit.produit_parent", "reseaux_sociaux");

    if ((optionsReseaux || []).length > 0) {
      blocReseaux.style.display = "none";
      if (blocReseauxActif) blocReseauxActif.style.display = "block";
    } else if (!peutSouscrire) {
      btnReseaux.disabled = true;
      messageReseaux.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut souscrire.</span>`;
    } else {
      btnReseaux.addEventListener("click", async () => {
        messageReseaux.innerHTML = "";
        const reseaux = Array.from(document.querySelectorAll(".reseaux-cible:checked")).map((c) => c.value);
        if (reseaux.length === 0) {
          messageReseaux.innerHTML = `<p class="message-erreur">Choisissez au moins un réseau.</p>`;
          return;
        }
        btnReseaux.disabled = true;
        btnReseaux.textContent = "Redirection vers le paiement...";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/reseaux-ajouter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              formule: document.getElementById("reseaux-formule").value,
              secteur_activite: document.getElementById("reseaux-secteur").value.trim() || null,
              reseaux_cibles: reseaux,
              nb_posts_mois: parseInt(document.getElementById("reseaux-nb-posts").value, 10)
            })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
          window.location.href = result.checkout_url;
        } catch (err) {
          messageReseaux.innerHTML = `<p class="message-erreur">${err.message}</p>`;
          btnReseaux.disabled = false;
          btnReseaux.textContent = "Souscrire";
        }
      });
    }
  }

  // ---------- Options Gestion Email : ajout / upgrade self-service (wf71) ----------
  const dashBlocVolume = document.getElementById("dash-bloc-volume");
  const aGestionEmail = codesDejaSouscrits.has("SECRETARIAT_SOCLE") || codesDejaSouscrits.has("PACK_COMPLET");

  if (dashBlocVolume && aGestionEmail) {
    dashBlocVolume.hidden = false;
    const codesOptActives = new Set(
      listeOptionsRecurrentes.map(o => o.options_produit?.code).filter(Boolean)
    );

    // Envoie une demande à wf71 : redirige vers Stripe (ajout) ou recharge (upgrade in-place).
    const soumettreOption = async (action, btn, msgEl) => {
      msgEl.innerHTML = "";
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Traitement…";
      try {
        const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/secretariat-volume-ajouter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: session.access_token, action })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.erreur || "Échec de la demande.");
        if (result.checkout_url) {
          window.location.href = result.checkout_url;
        } else {
          msgEl.innerHTML = `<p class="message-succes">${result.message || "C'est fait."} La page va se recharger.</p>`;
          setTimeout(() => window.location.reload(), 1800);
        }
      } catch (err) {
        msgEl.innerHTML = `<p class="message-erreur">${err.message}</p>`;
        btn.disabled = false;
        btn.textContent = label;
      }
    };

    // Palier de volume (400 / 1200, upgrade only)
    const blocVolume = document.getElementById("bloc-volume");
    const blocVolumeActif = document.getElementById("bloc-volume-actif");
    const btnVolume = document.getElementById("btn-volume");
    const messageVolume = document.getElementById("message-volume");
    const selectVolume = document.getElementById("volume-palier");
    const palierActuel = [...codesOptActives].find(c => c.startsWith("SECRETARIAT_VOLUME_")) || null;

    if (palierActuel === "SECRETARIAT_VOLUME_1200") {
      blocVolume.style.display = "none";
      blocVolumeActif.style.display = "block";
      blocVolumeActif.innerHTML = 'Palier actuel : <strong>Volume ++</strong> (1450 demandes/mois) — palier maximum. Pour repasser à un palier inférieur ou retirer l\'option, utilisez le portail de facturation (<button class="btn-lien" data-panel="facturation" style="all:unset; cursor:pointer; color:var(--bleu-primaire); text-decoration:underline;">Abonnement &amp; factures</button>).';
    } else {
      if (palierActuel === "SECRETARIAT_VOLUME_400") {
        const opt400 = selectVolume.querySelector('option[value="volume_400"]');
        if (opt400) opt400.remove();
        blocVolume.querySelector(".desc-offre").textContent =
          "Palier actuel : Volume + (650 demandes/mois). Vous pouvez passer à Volume ++ — l'ajustement de facturation est calculé au prorata.";
        btnVolume.textContent = "Passer à Volume ++";
      }
      if (!peutSouscrire) {
        btnVolume.disabled = true;
        messageVolume.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut modifier les options.</span>`;
      } else {
        btnVolume.addEventListener("click", () => soumettreOption(selectVolume.value, btnVolume, messageVolume));
      }
    }

    // Options simples : Envoi géré, Gestion des rendez-vous (Cal.com)
    [
      { code: "SECRETARIAT_ENVOI_GERE", action: "envoi_gere", bloc: "bloc-envoigere", btn: "btn-envoigere", msg: "message-envoigere", actif: "bloc-envoigere-actif" },
      { code: "SECRETARIAT_RDV_CALCOM", action: "rdv_calcom", bloc: "bloc-rdvcalcom", btn: "btn-rdvcalcom", msg: "message-rdvcalcom", actif: "bloc-rdvcalcom-actif" }
    ].forEach(o => {
      const bloc = document.getElementById(o.bloc);
      const btn = document.getElementById(o.btn);
      const msg = document.getElementById(o.msg);
      const actifEl = document.getElementById(o.actif);
      if (!bloc || !btn) return;
      if (codesOptActives.has(o.code)) {
        bloc.style.display = "none";
        if (actifEl) actifEl.style.display = "block";
      } else if (!peutSouscrire) {
        btn.disabled = true;
        msg.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut modifier les options.</span>`;
      } else {
        btn.addEventListener("click", () => soumettreOption(o.action, btn, msg));
      }
    });
  }

  // ---------- Onboarding personnalisé Gestion Email : achat one-shot (wf72) ----------
  const dashBlocOnboardingPerso = document.getElementById("dash-bloc-onboarding-perso");
  const blocOnboardingPerso = document.getElementById("bloc-onboarding-perso");
  const blocOnboardingPersoActif = document.getElementById("bloc-onboarding-perso-actif");
  const btnOnboardingPerso = document.getElementById("btn-onboarding-perso");
  const messageOnboardingPerso = document.getElementById("message-onboarding-perso");

  if (dashBlocOnboardingPerso && btnOnboardingPerso && aGestionEmail) {
    dashBlocOnboardingPerso.hidden = false;
    const { data: optionsOnboardingPerso } = await sb
      .from("options_actives")
      .select("statut, options_produit!inner(code)")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("options_produit.code", "SECRETARIAT_ONBOARDING_PERSO");

    if ((optionsOnboardingPerso || []).some(o => o.statut === "active")) {
      blocOnboardingPerso.style.display = "none";
      blocOnboardingPersoActif.style.display = "block";
    } else if (!peutSouscrire) {
      btnOnboardingPerso.disabled = true;
      messageOnboardingPerso.innerHTML = `<span class="sous-titre-section">Seul le propriétaire ou un administrateur peut souscrire.</span>`;
    } else {
      btnOnboardingPerso.addEventListener("click", async () => {
        messageOnboardingPerso.innerHTML = "";
        btnOnboardingPerso.disabled = true;
        btnOnboardingPerso.textContent = "Redirection vers le paiement...";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/onboarding-perso-ajouter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.erreur || "Échec de la souscription.");
          window.location.href = result.checkout_url;
        } catch (err) {
          messageOnboardingPerso.innerHTML = `<p class="message-erreur">${err.message}</p>`;
          btnOnboardingPerso.disabled = false;
          btnOnboardingPerso.textContent = "Souscrire";
        }
      });
    }
  }

  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const { data: demandes } = await sb
    .from("demandes")
    .select("*")
    .eq("compte_client_id", utilisateur.compte_client_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const demandesMois = (demandes || []).filter(d => new Date(d.created_at) >= debutMois);
  document.getElementById("stat-demandes-mois").textContent = demandesMois.length;
  const urgentesEnAttente = (demandes || []).filter(d => d.urgent && d.statut !== "traite" && d.statut !== "archive");
  document.getElementById("stat-urgentes").textContent = urgentesEnAttente.length;

  // Bandeau rouge en tête de « Mes demandes » : les urgences non traitées, épinglées.
  const bandeau = document.getElementById("bandeau-urgentes");
  const listeUrg = document.getElementById("liste-urgentes");
  if (bandeau && listeUrg) {
    if (urgentesEnAttente.length) {
      listeUrg.innerHTML = urgentesEnAttente.map(d =>
        `<li>${echapperHtmlDevis(d.resume || "Demande urgente")}${d.contact_prospect ? ` — <small>${echapperHtmlDevis(d.contact_prospect)}</small>` : ""}</li>`
      ).join("");
      bandeau.hidden = false;
    } else {
      bandeau.hidden = true;
    }
  }

  // Échappement obligatoire : resume / contact_prospect / categorie sont extraits
  // par l'IA du CONTENU d'un email entrant (donc contrôlables par un tiers) —
  // sans échappement, un email piégé = XSS stocké dans le dashboard du client.
  const tbodyDemandes = document.getElementById("tbody-demandes");
  tbodyDemandes.innerHTML = (demandes || []).length
    ? demandes.map(d => `
        <tr${d.suspect ? ' class="ligne-suspecte"' : ""}>
          <td>${new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
          <td>${d.suspect ? "⚠️ Suspect" : echapperHtmlDevis(d.categorie)}</td>
          <td>${echapperHtmlDevis(d.resume || "")}${d.suspect && d.motif_suspect ? `<br><small style="color:#b23a2e;">Email potentiellement frauduleux : ${echapperHtmlDevis(d.motif_suspect)}. Ne répondez pas et ne cliquez sur aucun lien sans vérifier.</small>` : ""}</td>
          <td>${echapperHtmlDevis(d.contact_prospect || "")}</td>
          <td><span class="badge badge-${d.statut === 'traite' ? 'actif' : 'essai'}">${echapperHtmlDevis(d.statut)}</span></td>
        </tr>`).join("")
    : `<tr><td colspan="5">Aucune demande pour le moment.</td></tr>`;

  const { data: factures } = await sb
    .from("factures")
    .select("*")
    .eq("compte_client_id", utilisateur.compte_client_id)
    .order("date_emission", { ascending: false })
    .limit(12);

  const tbodyFactures = document.getElementById("tbody-factures");
  tbodyFactures.innerHTML = (factures || []).length
    ? factures.map(f => `
        <tr>
          <td>${new Date(f.date_emission).toLocaleDateString("fr-FR")}</td>
          <td>${Number(f.montant_ttc).toFixed(2)} €</td>
          <td><span class="badge badge-${f.statut === 'payee' ? 'actif' : 'suspendu'}">${f.statut}</span></td>
          <td>${f.pdf_url ? `<a href="${f.pdf_url}" target="_blank">Télécharger</a>` : "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="4">Aucune facture pour le moment.</td></tr>`;

  // ---------- Mon équipe (multi-utilisateurs B2B) ----------
  const libelleRole = { owner: "Propriétaire", admin: "Administrateur", membre: "Membre" };

  // Plan SaaS (B2B_*/B2C_*) parmi les abonnements actifs — un compte peut aussi
  // avoir un abonnement Hébergement en parallèle, qui n'a pas de siège pertinent.
  const planSaas = listeAbonnements.find(a => {
    const code = a.plans_tarifaires?.code || "";
    return code.startsWith("B2B_") || code.startsWith("B2C_");
  });
  const limiteSieges = planSaas?.plans_tarifaires?.nb_utilisateurs_inclus ?? 1;

  async function chargerEquipe() {
    const { data: equipe } = await sb
      .from("utilisateurs_comptes")
      .select("nom, prenom, fonction, email, role")
      .eq("compte_client_id", utilisateur.compte_client_id);

    const membres = equipe || [];
    document.getElementById("texte-sieges").textContent =
      `${membres.length} / ${limiteSieges} utilisateur${limiteSieges > 1 ? "s" : ""} inclus dans votre plan`;

    document.getElementById("tbody-equipe").innerHTML = membres.length
      ? membres.map(m => `
          <tr>
            <td>${echapperHtmlDevis(m.prenom || "")} ${echapperHtmlDevis(m.nom || "")}</td>
            <td>${m.fonction ? echapperHtmlDevis(m.fonction) : "—"}</td>
            <td>${echapperHtmlDevis(m.email)}</td>
            <td>${echapperHtmlDevis(libelleRole[m.role] || m.role)}</td>
          </tr>`).join("")
      : `<tr><td colspan="4">Aucun utilisateur.</td></tr>`;

    return membres.length;
  }

  // "Mes devis" (Module 5, 23/08/2026) : inclut les devis pré-vente créés en
  // discutant avec le chatbot (source = 'chatbot'), Sur-Mesure compris — un
  // devis Sur-Mesure généré par le chatbot a necessite_validation_humaine = true
  // (prix estimé par barème déterministe, pas un prix ferme du chatbot).
  async function chargerMesDevis() {
    const conteneur = document.getElementById("liste-mes-devis");
    const { data: devis, error } = await sb
      .from("prospects_devis")
      .select("id, interet, message, lignes_devis, necessite_validation_humaine, statut, source, created_at")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .order("created_at", { ascending: false });

    if (error) {
      conteneur.innerHTML = `<p class="etat-vide">Impossible de charger vos devis pour le moment.</p>`;
      console.error(error);
      return;
    }

    const liste = devis || [];
    if (!liste.length) {
      conteneur.innerHTML = `<p class="etat-vide">Aucun devis pour le moment.</p>`;
      return;
    }

    conteneur.innerHTML = liste.map((d) => {
      const dateFormatee = new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      const lignes = Array.isArray(d.lignes_devis) ? d.lignes_devis : [];
      const total = lignes.reduce((s, l) => s + (Number(l.prix) || 0), 0);
      return `
        <div class="carte-devis">
          <div class="carte-devis-entete">
            <span class="carte-devis-titre">${d.message ? echapperHtmlDevis(d.message) : (d.interet === "site_web" ? "Devis site web" : "Devis secrétariat/automatisation")}${d.necessite_validation_humaine ? '<span class="badge-en-attente-validation">Estimation — en attente de confirmation</span>' : ""}</span>
            <span class="carte-devis-meta">${dateFormatee}</span>
          </div>
          ${lignes.length ? lignes.map(l => `
            <div class="carte-devis-ligne">
              <span>${echapperHtmlDevis(l.nom)}${l.detail ? `<small>${echapperHtmlDevis(l.detail)}</small>` : ""}</span>
              <span>${Number(l.prix).toFixed(0)} €${l.recurrent ? "/mois" : ""}</span>
            </div>`).join("") : `<p class="carte-devis-meta">En cours de chiffrage par un conseiller.</p>`}
        </div>`;
    }).join("");
  }

  function echapperHtmlDevis(texte) {
    const div = document.createElement("div");
    div.textContent = texte == null ? "" : String(texte);
    return div.innerHTML;
  }

  // "Devis pré-remplis à valider" : les brouillons chiffrés automatiquement à
  // partir d'un email classé DEVIS (wf61), en attente de validation. RLS
  // autorise la lecture des siens ; les actions (envoyer / rejeter) passent
  // par wf62 (JWT vérifié côté serveur), pas d'update RLS direct.
  const LIBELLES_STATUT_BROUILLON = { en_attente: "En attente", envoye: "Envoyé", rejete: "Rejeté" };

  async function chargerDevisBrouillons() {
    const section = document.getElementById("devis-brouillons");
    const conteneur = document.getElementById("liste-devis-brouillons");
    const histoBloc = document.getElementById("historique-devis-brouillons-bloc");
    const histo = document.getElementById("historique-devis-brouillons");
    if (!section || !conteneur) return;

    const { data, error } = await sb
      .from("devis_email_brouillons")
      .select("id, nom_prospect, email_prospect, telephone_prospect, total, detail, pdf_url, statut, created_at, updated_at")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .order("created_at", { ascending: false });

    if (error) { console.error(error); return; }
    const tous = data || [];
    if (!tous.length) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");

    const dateFr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    const enAttente = tous.filter((b) => b.statut === "en_attente");

    conteneur.innerHTML = enAttente.length ? enAttente.map((b) => {
      const contact = [b.email_prospect, b.telephone_prospect].filter(Boolean).map(echapperHtmlDevis).join(" · ");
      return `
        <div class="carte-devis" data-brouillon-id="${b.id}">
          <div class="carte-devis-entete">
            <span class="carte-devis-titre">${b.nom_prospect ? echapperHtmlDevis(b.nom_prospect) : "Prospect"}</span>
            <span class="carte-devis-meta">${dateFr(b.created_at)}</span>
          </div>
          ${contact ? `<div class="carte-devis-ligne"><span><small>${contact}</small></span></div>` : ""}
          ${b.detail ? `<div class="carte-devis-ligne"><span>${echapperHtmlDevis(b.detail)}</span></div>` : ""}
          <div class="carte-devis-ligne"><span><strong>Total</strong></span><span><strong>${Number(b.total).toFixed(2).replace(".", ",")} €</strong></span></div>
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <a class="btn btn-secondaire" href="${encodeURI(b.pdf_url)}" target="_blank" rel="noopener">Voir le PDF</a>
            <button class="btn btn-primaire btn-brouillon-envoyer" data-id="${b.id}">Envoyer au prospect</button>
            <button class="btn btn-ghost-danger btn-brouillon-rejeter" data-id="${b.id}">Rejeter</button>
            <span class="message-brouillon" style="font-size:.85rem;"></span>
          </div>
        </div>`;
    }).join("") : `<p class="etat-vide">Aucun devis en attente de validation.</p>`;

    if (histoBloc && histo) {
      histoBloc.classList.remove("hidden");
      histo.innerHTML = `
        <table>
          <thead><tr><th>Date</th><th>Prospect</th><th>Total</th><th>Statut</th><th>PDF</th></tr></thead>
          <tbody>${tous.map((b) => `
            <tr>
              <td>${dateFr(b.created_at)}</td>
              <td>${b.nom_prospect ? echapperHtmlDevis(b.nom_prospect) : "—"}${b.email_prospect ? `<br><small style="color:var(--gris-texte)">${echapperHtmlDevis(b.email_prospect)}</small>` : ""}</td>
              <td>${Number(b.total).toFixed(2).replace(".", ",")} €</td>
              <td><span class="badge-devis badge-devis-${b.statut}">${LIBELLES_STATUT_BROUILLON[b.statut] || b.statut}</span></td>
              <td><a href="${encodeURI(b.pdf_url)}" target="_blank" rel="noopener">Voir</a></td>
            </tr>`).join("")}</tbody>
        </table>`;
    }
  }

  async function actionBrouillon(carte, id, action, btn) {
    const msg = carte.querySelector(".message-brouillon");
    const boutons = carte.querySelectorAll("button");
    if (action === "envoyer" && !window.confirm("Envoyer ce devis au prospect par email, à votre nom ?")) return;
    if (action === "rejeter" && !window.confirm("Rejeter ce devis pré-rempli ?")) return;
    boutons.forEach((b) => (b.disabled = true));
    if (msg) msg.textContent = action === "envoyer" ? "Envoi..." : "Traitement...";
    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/devis-email-brouillon-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: session.access_token, brouillon_id: id, action }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.erreur || "Action impossible.");
      carte.style.opacity = "0.5";
      if (msg) msg.textContent = action === "envoyer" ? "Devis envoyé au prospect." : "Devis rejeté.";
      setTimeout(chargerDevisBrouillons, 1200);
    } catch (err) {
      if (msg) msg.textContent = err.message || "Erreur.";
      boutons.forEach((b) => (b.disabled = false));
    }
  }

  document.getElementById("liste-devis-brouillons").addEventListener("click", (e) => {
    const envoyer = e.target.closest(".btn-brouillon-envoyer");
    const rejeter = e.target.closest(".btn-brouillon-rejeter");
    const cible = envoyer || rejeter;
    if (!cible) return;
    const carte = cible.closest("[data-brouillon-id]");
    actionBrouillon(carte, cible.dataset.id, envoyer ? "envoyer" : "rejeter", cible);
  });

  // ---------- Réponses à valider (brouillons préparés par wf66) ----------
  async function chargerReponsesAValider() {
    const conteneur = document.getElementById("liste-reponses");
    const badge = document.getElementById("badge-reponses");
    if (!conteneur) return;
    const { data, error } = await sb
      .from("reponses_preparees")
      .select("id, categorie, destinataire, objet, corps, created_at")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "brouillon")
      .order("created_at", { ascending: false });
    if (error) { console.error(error); conteneur.innerHTML = `<p class="aide">Impossible de charger les réponses.</p>`; return; }
    const tous = data || [];
    if (badge) { badge.textContent = tous.length; badge.hidden = tous.length === 0; }
    const dateFr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    conteneur.innerHTML = tous.length ? tous.map((r) => `
      <div class="carte-devis" data-reponse-id="${r.id}" style="margin-bottom:16px;">
        <div class="carte-devis-entete">
          <span class="carte-devis-titre">${echapperHtmlDevis(r.categorie || "")} — à : ${echapperHtmlDevis(r.destinataire || "destinataire inconnu")}</span>
          <span class="carte-devis-meta">${dateFr(r.created_at)}</span>
        </div>
        <input class="rep-objet" value="${echapperHtmlDevis(r.objet || "")}" style="width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font:inherit; margin:8px 0; box-sizing:border-box;">
        <textarea class="rep-corps" rows="8" style="width:100%; padding:9px 11px; border:1px solid #cbd5e1; border-radius:8px; font:inherit; box-sizing:border-box;">${echapperHtmlDevis(r.corps || "")}</textarea>
        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-primaire rep-envoyer" data-id="${r.id}">Envoyer</button>
          <button class="btn btn-secondaire rep-enregistrer" data-id="${r.id}">Enregistrer les modifications</button>
          <button class="btn btn-ghost-danger rep-annuler" data-id="${r.id}">Annuler</button>
          <span class="rep-msg" style="font-size:.85rem;"></span>
        </div>
      </div>`).join("") : `<p class="etat-vide">Aucune réponse en attente. Les brouillons apparaissent ici dès qu'un email nécessite une réponse.</p>`;
  }

  async function actionReponse(carte, id, action, extra) {
    const msg = carte.querySelector(".rep-msg");
    const boutons = carte.querySelectorAll("button");
    if (action === "envoyer" && !window.confirm("Envoyer cette réponse au destinataire, en votre nom ?")) return;
    if (action === "annuler" && !window.confirm("Annuler ce brouillon ? Il ne sera pas envoyé.")) return;
    boutons.forEach((b) => (b.disabled = true));
    if (msg) msg.textContent = "…";
    const routes = { envoyer: "reponse-envoyer", enregistrer: "reponse-modifier", annuler: "reponse-annuler" };
    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/${routes[action]}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ access_token: session.access_token, id }, extra || {})),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || data.erreur || "Action impossible.");
      if (action === "enregistrer") { if (msg) { msg.style.color = "#2E7D32"; msg.textContent = "Enregistré ✓"; } boutons.forEach((b) => (b.disabled = false)); return; }
      carte.style.opacity = "0.5";
      if (msg) msg.textContent = action === "envoyer" ? "Réponse envoyée." : "Brouillon annulé.";
      setTimeout(chargerReponsesAValider, 1200);
    } catch (err) {
      if (msg) { msg.style.color = "#B23A2E"; msg.textContent = err.message || "Erreur."; }
      boutons.forEach((b) => (b.disabled = false));
    }
  }

  document.getElementById("liste-reponses").addEventListener("click", (e) => {
    const btn = e.target.closest(".rep-envoyer, .rep-enregistrer, .rep-annuler");
    if (!btn) return;
    const carte = btn.closest("[data-reponse-id]");
    const action = btn.classList.contains("rep-envoyer") ? "envoyer"
      : btn.classList.contains("rep-enregistrer") ? "enregistrer" : "annuler";
    const extra = (action === "enregistrer" || action === "envoyer")
      ? { objet: carte.querySelector(".rep-objet").value, corps: carte.querySelector(".rep-corps").value }
      : null;
    actionReponse(carte, btn.dataset.id, action, extra);
  });

  // "Mes contenus" (produit Réseaux sociaux, cadré le 24/08/2026) : n'affiché
  // que si le client a une configuration de calendrier social (pas tous les
  // clients n'ont acheté ce produit). Le client peut uploader ses propres
  // photos (privilégiées par Claude à la génération) et valider chaque post
  // avant de le publier lui-même (publication manuelle, pas d'API sociale).
  let calendrierSocialId = null;
  let photosClientDisponibles = []; // rafraîchi par chargerMesPhotos(), réutilisé par l'éditeur de post

  const LIBELLES_STATUT_POST = {
    en_attente_validation: { texte: "En attente de validation", classe: "attente" },
    a_publier: { texte: "À publier", classe: "a-publier" },
    publie: { texte: "Publié", classe: "publie" }
  };

  // Le client peut modifier le texte et/ou remplacer la photo (Pexels ou une
  // autre photo client) d'un post avant de le valider — utile s'il aime le
  // texte généré mais préfère mettre sa propre photo. Pas de restriction de
  // colonnes côté RLS (la policy autorise déjà toute mise à jour sur ses
  // propres posts), donc aucun changement backend nécessaire.
  function rendreEditeurPost(p) {
    const optionsPhotos = photosClientDisponibles.map((photo) => `
      <img src="${photo.url_publique}" class="photo-selectionnable${photo.id === p.photo_client_id ? " selectionnee" : ""}"
           data-photo-id="${photo.id}" data-photo-url="${photo.url_publique}" title="${photo.description ? echapperHtmlDevis(photo.description) : ""}">
    `).join("");
    return `
      <div class="zone-edition-post hidden" data-edition-id="${p.id}">
        <textarea class="edition-texte" rows="4">${echapperHtmlDevis(p.texte_post)}</textarea>
        <label class="carte-devis-meta" style="display:block; margin-top:8px;">Heure de publication
          <input type="time" class="edition-heure" value="${p.heure_publication_prevue ? p.heure_publication_prevue.slice(0, 5) : ""}" style="display:block; margin-top:4px;">
        </label>
        <p class="carte-devis-meta" style="margin-top:8px;">Choisir une photo (optionnel) :</p>
        <div class="grille-photos-edition">
          <div class="photo-option-aucune${!p.photo_client_id ? " selectionnee" : ""}" data-photo-id="" data-photo-url="">Pas de photo perso</div>
          ${optionsPhotos}
        </div>
        <button class="btn btn-primaire btn-enregistrer-edition" data-id="${p.id}" style="margin-top:10px;">Enregistrer</button>
        <button class="btn-lien btn-annuler-edition" data-id="${p.id}" style="margin-left:10px;">Annuler</button>
      </div>`;
  }

  async function chargerMesPosts() {
    const conteneur = document.getElementById("liste-mes-posts-sociaux");
    const { data: posts, error } = await sb
      .from("posts_calendrier_social")
      .select("id, date_publication_prevue, heure_publication_prevue, texte_post, image_url, photo_client_id, statut")
      .eq("calendrier_id", calendrierSocialId)
      .order("date_publication_prevue", { ascending: true });

    if (error) {
      conteneur.innerHTML = `<p class="etat-vide">Impossible de charger vos posts pour le moment.</p>`;
      console.error(error);
      return;
    }

    const liste = posts || [];
    if (!liste.length) {
      conteneur.innerHTML = `<p class="etat-vide">Aucun post généré pour le moment — votre calendrier arrive bientôt.</p>`;
      return;
    }

    conteneur.innerHTML = liste.map((p) => {
      const dateFormatee = new Date(p.date_publication_prevue).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      const heureFormatee = p.heure_publication_prevue ? ` à ${p.heure_publication_prevue.slice(0, 5)}` : "";
      const statutInfo = LIBELLES_STATUT_POST[p.statut] || { texte: p.statut, classe: "attente" };
      let boutons = "";
      if (p.statut === "en_attente_validation") {
        boutons = `<button class="btn btn-secondaire btn-valider-post" data-id="${p.id}" style="margin-top:10px;">Valider ce post</button>`;
      } else if (p.statut === "a_publier") {
        boutons = `<button class="btn btn-secondaire btn-marquer-publie" data-id="${p.id}" style="margin-top:10px;">Marquer comme publié</button>`;
      }
      if (p.statut !== "publie") {
        boutons += `<button class="btn btn-secondaire btn-modifier-post" data-id="${p.id}" style="margin-top:10px; margin-left:10px;">Modifier</button>`;
      }
      return `
        <div class="carte-post-social">
          ${p.image_url ? `<img src="${p.image_url}" alt="">` : ""}
          <div class="contenu-post">
            <div class="carte-devis-meta">${dateFormatee}${heureFormatee}<span class="badge-statut-post ${statutInfo.classe}">${statutInfo.texte}</span></div>
            <p class="texte-post">${echapperHtmlDevis(p.texte_post)}</p>
            ${boutons}
            ${p.statut !== "publie" ? rendreEditeurPost(p) : ""}
          </div>
        </div>`;
    }).join("");

    conteneur.querySelectorAll(".btn-valider-post").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await sb.from("posts_calendrier_social").update({ statut: "a_publier" }).eq("id", btn.dataset.id);
        await chargerMesPosts();
      });
    });
    conteneur.querySelectorAll(".btn-marquer-publie").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await sb.from("posts_calendrier_social").update({ statut: "publie" }).eq("id", btn.dataset.id);
        await chargerMesPosts();
      });
    });
    conteneur.querySelectorAll(".btn-modifier-post").forEach((btn) => {
      btn.addEventListener("click", () => {
        conteneur.querySelector(`.zone-edition-post[data-edition-id="${btn.dataset.id}"]`)?.classList.toggle("hidden");
      });
    });
    conteneur.querySelectorAll(".btn-annuler-edition").forEach((btn) => {
      btn.addEventListener("click", () => {
        conteneur.querySelector(`.zone-edition-post[data-edition-id="${btn.dataset.id}"]`)?.classList.add("hidden");
      });
    });
    conteneur.querySelectorAll(".zone-edition-post").forEach((zone) => {
      zone.querySelectorAll(".photo-selectionnable, .photo-option-aucune").forEach((el) => {
        el.addEventListener("click", () => {
          zone.querySelectorAll(".photo-selectionnable, .photo-option-aucune").forEach((autre) => autre.classList.remove("selectionnee"));
          el.classList.add("selectionnee");
        });
      });
    });
    conteneur.querySelectorAll(".btn-enregistrer-edition").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const zone = conteneur.querySelector(`.zone-edition-post[data-edition-id="${btn.dataset.id}"]`);
        const nouveauTexte = zone.querySelector(".edition-texte").value.trim();
        const nouvelleHeure = zone.querySelector(".edition-heure").value || null;
        const elementSelectionne = zone.querySelector(".photo-selectionnable.selectionnee, .photo-option-aucune.selectionnee");
        if (!nouveauTexte) return;

        btn.disabled = true;
        btn.textContent = "Enregistrement...";
        await sb.from("posts_calendrier_social").update({
          texte_post: nouveauTexte,
          heure_publication_prevue: nouvelleHeure,
          photo_client_id: elementSelectionne?.dataset.photoId || null,
          image_url: elementSelectionne?.dataset.photoUrl || null
        }).eq("id", btn.dataset.id);
        await chargerMesPosts();
      });
    });
  }

  async function chargerMesPhotos() {
    const conteneur = document.getElementById("grille-photos-uploadees");
    const { data: photos } = await sb
      .from("photos_calendrier_social")
      .select("id, url_publique, description, utilisee")
      .eq("calendrier_id", calendrierSocialId)
      .order("created_at", { ascending: false });

    photosClientDisponibles = photos || [];
    conteneur.innerHTML = photosClientDisponibles.map((p) => `<img src="${p.url_publique}" title="${p.description ? echapperHtmlDevis(p.description) : ""}${p.utilisee ? " (déjà utilisée)" : ""}" style="${p.utilisee ? "opacity:.5;" : ""}">`).join("");
  }

  async function chargerMesContenus() {
    const { data: calendrier } = await sb
      .from("calendriers_sociaux_clients")
      .select("id")
      .eq("compte_client_id", utilisateur.compte_client_id)
      .eq("statut", "actif")
      .limit(1)
      .maybeSingle();

    if (!calendrier) return; // Produit non souscrit — section reste masquée.

    calendrierSocialId = calendrier.id;
    document.getElementById("contenus").classList.remove("hidden");
    await chargerMesPhotos(); // doit se charger avant les posts : leur éditeur affiche la liste des photos disponibles
    await chargerMesPosts();
  }

  function fichierEnBase64(fichier) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(lecteur.result);
      lecteur.onerror = reject;
      lecteur.readAsDataURL(fichier);
    });
  }

  document.getElementById("btn-uploader-photo").addEventListener("click", async () => {
    const messageEl = document.getElementById("message-upload-photo");
    const inputFichier = document.getElementById("upload-photo-fichier");
    const inputDescription = document.getElementById("upload-photo-description");
    const btn = document.getElementById("btn-uploader-photo");
    messageEl.textContent = "";

    if (!calendrierSocialId) return;
    const fichier = inputFichier.files[0];
    if (!fichier) {
      messageEl.innerHTML = `<span class="message-erreur">Choisissez une photo d'abord.</span>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Envoi en cours...";

    try {
      const imageBase64 = await fichierEnBase64(fichier);
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/client-calendrier-social-upload-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          calendrier_id: calendrierSocialId,
          image_base64: imageBase64,
          nom_fichier: fichier.name,
          description: inputDescription.value || null
        })
      });
      if (!resp.ok) throw new Error("Échec de l'envoi de la photo.");
      messageEl.innerHTML = `<span class="message-succes">Photo envoyée !</span>`;
      inputFichier.value = "";
      inputDescription.value = "";
      await chargerMesPhotos();
      await chargerMesPosts(); // les éditeurs de post doivent proposer la photo qui vient d'être ajoutée
    } catch (err) {
      messageEl.innerHTML = `<span class="message-erreur">${err.message || "Une erreur est survenue."}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer la photo";
    }
  });

  const nbMembres = await chargerEquipe();
  await chargerMesDevis();
  await chargerDevisBrouillons();
  await chargerReponsesAValider();
  await chargerMesContenus();

  // Seuls le propriétaire et les administrateurs peuvent inviter
  const blocInviter = document.getElementById("bloc-inviter");
  if (utilisateur.role === "owner" || utilisateur.role === "admin") {
    blocInviter.classList.remove("hidden");
  }

  document.getElementById("form-inviter-utilisateur").addEventListener("submit", async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById("message-invitation");
    const btn = document.getElementById("btn-inviter");
    messageEl.innerHTML = "";
    btn.disabled = true;
    btn.textContent = "Envoi...";

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/inviter-utilisateur-compte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          prenom: document.getElementById("invite-prenom").value,
          nom: document.getElementById("invite-nom").value,
          fonction: document.getElementById("invite-fonction").value || null,
          email: document.getElementById("invite-email").value
        })
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.erreur || "Échec de l'invitation.");

      messageEl.innerHTML = `<p class="message-succes">Invitation envoyée avec succès.</p>`;
      document.getElementById("form-inviter-utilisateur").reset();
      await chargerEquipe();
    } catch (err) {
      messageEl.innerHTML = `<p class="message-erreur">${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer l'invitation";
    }
  });

  // ---------- Panneau « Mon site » (lien live + demande de modif) ----------
  // Lecture et écriture via wf63 (webhooks JWT) : sites_generes est une table
  // 100 % interne, jamais lue en direct depuis le navigateur.
  const FORMULE_SITE = {
    SITE_ESSENTIEL: "Site Essentiel", SITE_PRO: "Site Pro", SITE_ECOMMERCE: "Site E-commerce"
  };
  const STATUT_DEMANDE = {
    nouveau: "Reçue", en_cours: "En cours de traitement", traite: "Traitée", rejete: "Refusée"
  };
  function escHtmlSite(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function chargerMonSite() {
    const zone = document.getElementById("mon-site-contenu");
    if (!zone) return;
    let data;
    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/mon-site-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: session.access_token })
      });
      data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Chargement impossible.");
    } catch (err) {
      zone.innerHTML = `<p class="message-erreur">${escHtmlSite(err.message)}</p>`;
      return;
    }

    const site = data.site;
    const demandes = Array.isArray(data.demandes) ? data.demandes : [];
    const demandeOuverte = demandes.some(d => d.statut === "nouveau" || d.statut === "en_cours");

    if (!site) {
      zone.innerHTML = `<div class="dash-bloc">
        <p>Vous n'avez pas encore de site web.</p>
        <p><button class="btn btn-primaire" data-panel="offres">Créer mon site</button></p>
      </div>`;
      return;
    }

    const formule = FORMULE_SITE[site.code_reference] || site.code_reference;
    const boutonVoir = site.url_publique
      ? `<p style="margin:12px 0;">
           <a class="btn btn-primaire" href="${escHtmlSite(site.url_publique)}" target="_blank" rel="noopener">Voir mon site ↗</a>
         </p>
         <p class="aide" style="word-break:break-all;">${escHtmlSite(site.url_publique)}</p>`
      : "";
    let blocEtat;
    if (site.statut === "genere_attente_validation") {
      blocEtat = `<p><strong>${escHtmlSite(formule)}</strong> — en ligne</p>
        <p class="aide">Une modification est en cours de traitement par notre équipe. Votre site reste accessible pendant ce temps.</p>
        ${boutonVoir}`;
    } else if (site.url_publique) {
      blocEtat = `<p><strong>${escHtmlSite(formule)}</strong> — en ligne</p>${boutonVoir}`;
    } else {
      blocEtat = `<p><strong>${escHtmlSite(formule)}</strong> — en préparation.</p>`;
    }

    const blocFormulaire = demandeOuverte
      ? `<p class="aide">Une demande de modification est en cours de traitement — nous revenons vers vous rapidement. Vous pourrez en envoyer une nouvelle une fois celle-ci close.</p>`
      : `<div class="champ">
           <label for="site-modif-message">Que souhaitez-vous changer ?</label>
           <textarea id="site-modif-message" rows="4" maxlength="4000" placeholder="Ex : corriger les horaires du samedi, remplacer la photo d'accueil, ajouter le menu enfant…"></textarea>
         </div>
         <button class="btn btn-secondaire" id="btn-site-modif" type="button">Envoyer la demande</button>
         <p id="message-site-modif" style="margin-top:8px;"></p>`;

    const lignesHisto = demandes.length
      ? demandes.map(d => `<tr>
          <td>${new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
          <td>${escHtmlSite(d.message)}</td>
          <td><span class="badge badge-${d.statut === "traite" ? "actif" : "essai"}">${STATUT_DEMANDE[d.statut] || d.statut}</span></td>
          <td>${escHtmlSite(d.reponse_interne || "")}</td>
        </tr>`).join("")
      : `<tr><td colspan="4">Aucune demande pour le moment.</td></tr>`;

    zone.innerHTML = `
      <div class="dash-bloc">${blocEtat}</div>
      <div class="dash-bloc">
        <h3>Demander une modification</h3>
        <p class="aide">Décrivez ce que vous voulez changer. Nous appliquons la modification et vous prévenons quand c'est en ligne. Une demande à la fois.</p>
        ${blocFormulaire}
      </div>
      <div class="dash-bloc">
        <h3>Historique de mes demandes</h3>
        <table class="donnees">
          <thead><tr><th>Date</th><th>Demande</th><th>Statut</th><th>Réponse</th></tr></thead>
          <tbody>${lignesHisto}</tbody>
        </table>
      </div>`;

    const btnModif = document.getElementById("btn-site-modif");
    if (btnModif) {
      btnModif.addEventListener("click", async () => {
        const message = document.getElementById("site-modif-message").value.trim();
        const msgEl = document.getElementById("message-site-modif");
        if (message.length < 5) {
          msgEl.innerHTML = `<span class="message-erreur">Merci de décrire la modification souhaitée.</span>`;
          return;
        }
        btnModif.disabled = true;
        btnModif.textContent = "Envoi…";
        try {
          const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/mon-site-demande-modif`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: session.access_token, message })
          });
          const result = await resp.json();
          if (!resp.ok || !result.ok) throw new Error(result.error || "Envoi impossible.");
          msgEl.innerHTML = `<span class="message-succes">${escHtmlSite(result.message || "Demande transmise.")}</span>`;
          await chargerMonSite();
        } catch (err) {
          msgEl.innerHTML = `<span class="message-erreur">${escHtmlSite(err.message)}</span>`;
          btnModif.disabled = false;
          btnModif.textContent = "Envoyer la demande";
        }
      });
    }
  }

  await chargerMonSite();
});
