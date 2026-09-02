// Catalogue des offres "simples" proposables en achat direct depuis le dashboard
// (hors Sur-Mesure, qui passe par une demande de prix, pas un achat direct).
// Volontairement dupliqué du catalogue affiché sur index.html/devis-instantane.js
// plutôt que lu depuis plans_tarifaires : garde l'autorité des prix affichés
// alignée avec le reste du site, la résolution du vrai Price ID Stripe se fait
// côté serveur (workflow 36) à partir du plan_code, jamais du prix envoyé ici.
const OFFRES_SIMPLES_DASHBOARD = [
  { plan_code: "SECRETARIAT_SOCLE", nom: "Gestion Email", prix: 89, description: "Tri automatique de vos emails, relance si téléphone manquant, bilan quotidien.", bientot: false },
  { plan_code: "TEL_ESSENTIEL", nom: "Gestion Appels — Standard", prix: 49, description: "Accueil vocal : répond aux questions, prend les messages ; RDV et réservations enregistrés, vous confirmez.", bientot: false },
  { plan_code: "TEL_PRO", nom: "Gestion Appels — Avancé", prix: 95, description: "Tout Standard, plus transfert d'appel en cas d'urgence et alerte SMS après chaque appel.", bientot: false },
  { plan_code: "TEL_SURMESURE", nom: "Gestion Appels — Sur-mesure", prix: 149, description: "Tout Avancé, plus prise de commande à emporter, rappels sortants, qualification poussée.", bientot: false }
];

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
    .select("statut, raison_sociale")
    .eq("id", utilisateur.compte_client_id)
    .single();

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

  const tbodyAbonnements = document.getElementById("tbody-abonnements");
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
          <td><span class="badge badge-actif">${o.statut}</span></td>
        </tr>`);
  const toutesLignes = [...lignesAbo, ...lignesOptions];
  tbodyAbonnements.innerHTML = toutesLignes.length
    ? toutesLignes.join("")
    : `<tr><td colspan="3">Aucun abonnement actif pour le moment.</td></tr>`;

  // ---------- Ajouter une offre (achat direct de formules simples) ----------
  const codesDejaSouscrits = new Set(listeAbonnements.map(a => a.plans_tarifaires?.code).filter(Boolean));
  const conteneurOffres = document.getElementById("liste-offres-disponibles");
  const messageAjoutOffre = document.getElementById("message-ajout-offre");
  const peutSouscrire = utilisateur.role === "owner" || utilisateur.role === "admin";

  const offresAAfficher = OFFRES_SIMPLES_DASHBOARD.filter(o => !codesDejaSouscrits.has(o.plan_code));

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
  document.getElementById("stat-urgentes").textContent =
    (demandes || []).filter(d => d.urgent && d.statut !== "traite").length;

  const tbodyDemandes = document.getElementById("tbody-demandes");
  tbodyDemandes.innerHTML = (demandes || []).length
    ? demandes.map(d => `
        <tr>
          <td>${new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
          <td>${d.categorie}</td>
          <td>${d.resume || ""}</td>
          <td>${d.contact_prospect || ""}</td>
          <td><span class="badge badge-${d.statut === 'traite' ? 'actif' : 'essai'}">${d.statut}</span></td>
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
            <td>${m.prenom || ""} ${m.nom || ""}</td>
            <td>${m.fonction || "—"}</td>
            <td>${m.email}</td>
            <td>${libelleRole[m.role] || m.role}</td>
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
});
