// Devis instantané — outil de prospection terrain (dashboard commercial).
//
// Principe : AUCUNE donnée n'est stockée côté serveur. Le devis généré est
// entièrement encodé dans le fragment d'URL (#d=...), jamais envoyé à un
// serveur (le fragment n'est même pas transmis dans les requêtes HTTP) — le
// lien partagé AVEC le prospect contient donc lui-même tout le devis, et
// cette même page sait le relire en mode lecture seule, sans authentification
// (le prospect qui ouvre le lien n'a pas de compte).
//
// Aucune vente n'est créée ici, jamais : c'est un chiffrage à montrer/envoyer,
// pas un raccourci de commande — la commande reste toujours passée par le
// client lui-même en ligne (garde-fou anti-fraude déjà en place ailleurs sur
// ce projet, cf. workflow 04 / auto-affiliation).
//
// Régime TVA — un seul réglage à changer ici si le statut change un jour.
// Valeur actuelle (21/08/2026) : franchise en base (0 = pas de TVA facturée),
// justifiée par un CA à 0€ à ce stade (la micro-entreprise n'est pas encore
// créée) — vrai quelle que soit la forme juridique finale retenue (micro ou
// SASU, la franchise en base dépend du CA, pas de la forme), donc pas besoin
// d'attendre que cette décision soit tranchée pour afficher un devis correct
// aujourd'hui. Tous les prix du catalogue (CATALOGUE_DEVIS ci-dessous) sont
// des montants HT, cohérent avec fiches_produits_services.md.
const TAUX_TVA = 0; // ex: 0.20 pour un régime réel à 20%

function calculerTTC(montantHT) {
  return montantHT * (1 + TAUX_TVA);
}

function mentionTva() {
  return TAUX_TVA === 0
    ? "TVA non applicable, art. 293 B du CGI"
    : `Dont TVA (${Math.round(TAUX_TVA * 100)} %)`;
}

// Barèmes des offres Sur-Mesure (secretariat_sur_mesure, site_sur_mesure,
// automatisation_sur_mesure ci-dessous) : les montants (taux horaire 75€,
// paliers de volume, prix par fonctionnalité...) sont des valeurs de
// démarrage posées le 21/08/2026, pas encore validées sur des devis réels —
// à ajuster ici au fil de l'expérience terrain. Le prix reste éditable à la
// main dans tous les cas (input "Montant HT"), le barème ne fait que le
// pré-remplir.
const CATALOGUE_DEVIS = [
  {
    categorie: "Secrétariat virtuel",
    items: [
      { code: "gestion_email", nom: "Gestion Email", prix: 89, recurrent: true,
        description: "Tri automatique de vos emails, relance si téléphone manquant, bilan quotidien." },
      { code: "gestion_appels_essentiel", nom: "Gestion Appels — Essentiel", prix: 49, recurrent: true, bientot: true,
        description: "Accueil vocal automatique, prise de message, RDV sous 24h." },
      { code: "gestion_appels_pro", nom: "Gestion Appels — Pro", prix: 95, recurrent: true, bientot: true,
        description: "RDV pris en temps réel pendant l'appel, alertes SMS." },
      { code: "pack_complet", nom: "Pack Complet (Email + Appels Essentiel)", prix: 134.90, recurrent: true, bientot: true,
        description: "Gestion Email + Gestion Appels Essentiel, à prix réduit." },
      { code: "secretariat_sur_mesure", nom: "Secrétariat Sur-Mesure", prixLibre: true, prixDefaut: 450, recurrent: true,
        description: "Besoin spécifique, à partir de 450 €/mois indicatif.",
        bareme: {
          base: 450,
          champs: [
            { type: "radio", id: "volume", label: "Volume mensuel", options: [
                { label: "Standard (jusqu'à 50 emails/appels par semaine)", valeur: 0 },
                { label: "Élevé (50 à 150 par semaine)", valeur: 150 },
                { label: "Très élevé (150+ par semaine)", valeur: 350 }
              ] },
            { type: "radio", id: "couverture", label: "Couverture horaire", options: [
                { label: "Heures ouvrées (9h-18h, jours ouvrés)", valeur: 0 },
                { label: "Soirs + week-ends", valeur: 150 },
                { label: "24/7", valeur: 350 }
              ] }
          ],
          exemples: [
            { label: "Petit commerce, volume standard", valeurs: { volume: "Standard (jusqu'à 50 emails/appels par semaine)", couverture: "Heures ouvrées (9h-18h, jours ouvrés)" } },
            { label: "Activité soutenue, soirs/week-ends", valeurs: { volume: "Élevé (50 à 150 par semaine)", couverture: "Soirs + week-ends" } },
            { label: "Gros volume, couverture totale", valeurs: { volume: "Très élevé (150+ par semaine)", couverture: "24/7" } }
          ]
        } }
    ]
  },
  {
    categorie: "Sites Web",
    items: [
      { code: "site_essentiel", nom: "Site Essentiel", prix: 490, recurrent: false, hebergement: 15,
        description: "Site vitrine — Setup + hébergement 15 €/mois." },
      { code: "site_pro", nom: "Site Pro", prix: 890, recurrent: false, hebergement: 25,
        description: "Site pro multi-pages — Setup + hébergement 25 €/mois." },
      { code: "site_ecommerce", nom: "Site E-commerce", prix: 1490, recurrent: false, hebergement: 45,
        description: "Boutique en ligne jusqu'à 30 produits — Setup + hébergement 45 €/mois." },
      { code: "site_sur_mesure", nom: "Site Sur-Mesure", prixLibre: true, prixDefaut: 3500, recurrent: false,
        description: "Projet spécifique, sur devis.",
        bareme: {
          base: 3500,
          champs: [
            { type: "nombre", id: "pages_supp", label: "Pages supplémentaires (au-delà de 5 incluses)", unite: 150, defaut: 0 },
            { type: "checkbox", id: "multilingue", label: "Site multilingue", valeur: 400 },
            { type: "checkbox", id: "reservation", label: "Prise de RDV en ligne intégrée (Cal.com)", valeur: 200 },
            { type: "checkbox", id: "espace_membre", label: "Espace membre / connexion", valeur: 600 },
            { type: "nombre", id: "heures_dev", label: "Heures de développement sur-mesure additionnelles", unite: 75, defaut: 0 }
          ],
          exemples: [
            { label: "Vitrine simple (artisan, commerçant)", valeurs: { pages_supp: 0, multilingue: false, reservation: false, espace_membre: false, heures_dev: 5 } },
            { label: "Multi-pages avec prise de RDV", valeurs: { pages_supp: 3, multilingue: false, reservation: true, espace_membre: false, heures_dev: 10 } },
            { label: "Espace client, multilingue", valeurs: { pages_supp: 5, multilingue: true, reservation: true, espace_membre: true, heures_dev: 20 } }
          ]
        } },
      { code: "site_chatbot_n1", nom: "Assistant IA du site — Niveau 1 (option)", prix: 29, recurrent: true,
        description: "Chatbot sur le site généré — répond aux questions, capte le contact. Même tarif que le Chatbot marque blanche Niveau 1, sans setup (provisioning automatique)." },
      { code: "site_chatbot_n2", nom: "Assistant IA du site — Niveau 2 (option)", prix: 49, recurrent: true,
        description: "Niveau 1 + prise de RDV (lien Cal.com requis à la commande). Même tarif que le Chatbot marque blanche Niveau 2." },
      { code: "site_chatbot_n3", nom: "Assistant IA du site — Niveau 3 (option)", prix: 89, recurrent: true,
        description: "Niveau 2 + devis auto + alerte urgence (barème configuré par le client après achat). Même tarif que le Chatbot marque blanche Niveau 3." }
    ]
  },
  {
    categorie: "Automatisation",
    items: [
      { code: "automatisation_sur_mesure", nom: "Automatisation Sur-Mesure", prixLibre: true, prixDefaut: 1200, recurrent: false,
        description: "Automatisation d'une tâche métier précise, sur devis.",
        bareme: {
          base: 300,
          champs: [
            { type: "nombre", id: "heures_dev", label: "Heures de développement estimées", unite: 75, defaut: 12 },
            { type: "nombre", id: "outils_tiers", label: "Outils tiers à intégrer (au-delà d'1 inclus)", unite: 300, defaut: 0 },
            { type: "checkbox", id: "temps_reel", label: "Déclenchement temps réel (webhook) plutôt qu'en différé", valeur: 200 },
            { type: "checkbox", id: "dashboard", label: "Tableau de bord de suivi dédié", valeur: 400 }
          ],
          exemples: [
            { label: "Tâche simple, 1 seul outil", valeurs: { heures_dev: 6, outils_tiers: 0, temps_reel: false, dashboard: false } },
            { label: "Plusieurs outils connectés, temps réel", valeurs: { heures_dev: 15, outils_tiers: 2, temps_reel: true, dashboard: false } },
            { label: "Projet complexe avec suivi dédié", valeurs: { heures_dev: 25, outils_tiers: 3, temps_reel: true, dashboard: true } }
          ]
        } }
    ]
  },
  {
    categorie: "Mise en avant Google",
    items: [
      { code: "seo_audit", nom: "Audit de visibilité Google", prix: 390, recurrent: false,
        description: "Audit technique (balises, structure, vitesse), optimisation on-page, sitemap — pour mieux ressortir dans les résultats Google." },
      { code: "seo_suivi", nom: "Suivi mensuel de visibilité", prix: 49, recurrent: true,
        description: "Rapport mensuel de positionnement + suggestions de contenu par IA (pas de rédaction ni de netlinking — à ne pas vendre comme un suivi SEO complet)." }
    ]
  },
  {
    categorie: "Chatbot",
    items: [
      { code: "chatbot_niveau1", nom: "Chatbot — Niveau 1 (questions basiques)", prix: 290, recurrent: false, hebergement: 29, hebergementLabel: "abonnement",
        description: "Répond aux questions fréquentes et infos pratiques sur le site du client — Setup + 29 €/mois." },
      { code: "chatbot_niveau2", nom: "Chatbot — Niveau 2 (+ prise de RDV)", prix: 490, recurrent: false, hebergement: 49, hebergementLabel: "abonnement",
        description: "Tout le Niveau 1, plus prise de rendez-vous intégrée (Cal.com) — Setup + 49 €/mois." },
      { code: "chatbot_niveau3", nom: "Chatbot — Niveau 3 (+ devis + urgence)", prix: 890, recurrent: false, hebergement: 89, hebergementLabel: "abonnement",
        description: "Tout le Niveau 2, plus pré-devis calculé selon le barème du client et contact direct de l'artisan en cas d'urgence détectée — Setup + 89 €/mois." }
    ]
  },
  {
    categorie: "Réseaux sociaux",
    items: [
      { code: "reseaux_sociaux_standard", nom: "Calendrier de posts IA — Standard", prix: 190, recurrent: false, hebergement: 59, hebergementLabel: "abonnement",
        description: "8-12 posts/mois générés par Claude (texte + visuel), photos du client privilégiées à une image générique — Setup + 59 €/mois." },
      { code: "reseaux_sociaux_sur_mesure", nom: "Calendrier de posts IA — Sur-Mesure", prix: 390, recurrent: false, hebergement: 99, hebergementLabel: "abonnement",
        description: "Ligne éditoriale personnalisée à la marque, visuels sur-mesure — Setup + 99 €/mois." }
    ]
  },
  {
    categorie: "Devis en marque blanche",
    items: [
      { code: "devis_mb_starter", nom: "Devis en marque blanche — Starter", prix: 290, recurrent: false, hebergement: 29, hebergementLabel: "abonnement",
        description: "Configurateur de devis à la marque du client, barème simple, 20 devis/mois — Setup + 29 €/mois." },
      { code: "devis_mb_pro", nom: "Devis en marque blanche — Pro", prix: 490, recurrent: false, hebergement: 59, hebergementLabel: "abonnement",
        description: "Devis illimités, PDF téléchargeable pour le prospect — Setup + 59 €/mois." }
    ]
  },
  {
    categorie: "Formation",
    items: [
      { code: "formation_1j", nom: "Formation Entreprise — 1 jour", prix: 1900, recurrent: false,
        description: "Diagnostic + formation IA/automatisation condensés." },
      { code: "formation_3j", nom: "Formation Entreprise — 2-3 jours", prix: 5500, recurrent: false,
        description: "Diagnostic approfondi + formation étalée + accompagnement." }
    ]
  }
];

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte == null ? "" : String(texte);
  return div.innerHTML;
}

function formaterEuros(montant) {
  return montant.toLocaleString("fr-FR", { minimumFractionDigits: montant % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }) + " €";
}

function encoderDevis(devis) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(devis))));
}

function decoderDevis(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch (e) {
    return null;
  }
}

function lireHashDevis() {
  const m = window.location.hash.match(/^#d=(.+)$/);
  return m ? decoderDevis(m[1]) : null;
}

// ---------------------------------------------------------------------------
// MODE FORMULAIRE (commercial connecté)
// ---------------------------------------------------------------------------

// Palette identique à celle du moteur de génération de site réel
// (n8n_workflows/32_generation_deploiement_site.json, const COULEURS) —
// l'aperçu visuel ci-dessous doit montrer une couleur que le site livré
// pourra vraiment avoir, pas une couleur inventée pour l'occasion.
// Taux Conseiller de la commission résiduelle (migration 39, niveau Modéré)
// — identique à celui codé dans generer_commission_residuelle(), utilisé ici
// uniquement pour un repère privé affiché au commercial, jamais pour un
// calcul qui affecte réellement un paiement (ça reste le rôle exclusif de la
// fonction SQL). Le book personnel d'un commercial est toujours payé à ce
// taux, quel que soit son niveau MLM (Conseiller/Formateur/Manager) — seules
// les overrides sur l'équipe varient par niveau, hors-sujet ici puisqu'il
// s'agit d'une vente que CE commercial fait lui-même.
const TAUX_CONSEILLER_MARGE = 0.0521;

// Récupère le coût variable mensuel de Gestion Email (SECRETARIAT_SOCLE) et
// affiche un repère privé de commission résiduelle estimée sous cette ligne
// du catalogue — volontairement limité à ce seul produit, le seul dont le
// coût est aujourd'hui mesuré en base (cout_variable_mensuel, migration 39).
// Pour tout le reste, mieux vaut ne rien afficher que deviner un coût.
async function afficherRepereCommissionGestionEmail() {
  const bloc = document.getElementById("repere-prive-gestion_email");
  if (!bloc) return;
  try {
    const { data, error } = await window.supabaseClient
      .from("plans_tarifaires")
      .select("cout_variable_mensuel")
      .eq("code", "SECRETARIAT_SOCLE")
      .single();
    if (error || !data || data.cout_variable_mensuel == null) return; // colonne/migration pas encore en place, on laisse caché
    let itemGestionEmail = null;
    CATALOGUE_DEVIS.forEach((g) => {
      const trouve = g.items.find((i) => i.code === "gestion_email");
      if (trouve) itemGestionEmail = trouve;
    });
    if (!itemGestionEmail) return;
    const marge = itemGestionEmail.prix - data.cout_variable_mensuel;
    if (marge <= 0) return;
    const commissionEstimee = Math.round(marge * TAUX_CONSEILLER_MARGE * 100) / 100;
    bloc.innerHTML = `<span class="badge-prive">Privé</span> Repère : ~${formaterEuros(commissionEstimee)}/mois de commission résiduelle estimée sur votre book (5,21 % de la marge, jamais visible du prospect)`;
    bloc.style.display = "flex";
  } catch (err) {
    // silencieux — le repère reste simplement caché
  }
}

// Repère privé de commission pour le Sur-Mesure (24/08/2026) — le vrai
// barème de commission Sur-Mesure n'est pas encore défini (chantier "nouveau
// modèle de commission en % de marge", voir MASTER_PLAN), donc ce calcul
// applique le taux Conseiller au prix de vente entier (pas à une marge
// connue, contrairement à Gestion Email où le coût réel est en base) —
// volontairement présenté comme un ordre de grandeur, jamais un montant
// engageant, et jamais visible du prospect (uniquement dans le formulaire
// commercial, jamais dans rendreApercu()).
function mettreAJourRepereSurMesure(bloc, montant) {
  if (!bloc || !montant || montant <= 0) return;
  const commissionEstimee = Math.round(montant * TAUX_CONSEILLER_MARGE * 100) / 100;
  bloc.innerHTML = `<span class="badge-prive">Privé</span> Ordre de grandeur : ~${formaterEuros(commissionEstimee)} de commission estimée (barème définitif Sur-Mesure pas encore fixé, jamais visible du prospect)`;
  bloc.style.display = "flex";
}

const COULEURS_SITE = {
  bleu: "#1F6F78", vert: "#2E7D32", rouge: "#B23A2E", orange: "#C9702A",
  jaune: "#C9A227", violet: "#6C4A9C", rose: "#C24F82", noir: "#1A1A1A",
  gris: "#4B5A66", marron: "#6B4A33", turquoise: "#1F9E8F"
};

function rendreApercuSiteHtml(nomEntreprise, tagline, couleurHex) {
  const nom = nomEntreprise || "Votre Entreprise";
  return `
    <div class="devis-apercu-site-hero" style="background-color:${couleurHex};">
      <div class="devis-apercu-site-nav">
        <span>${echapperHtml(nom)}</span>
        <span class="devis-apercu-site-nav-liens">Accueil · Services · Contact</span>
      </div>
      <div class="devis-apercu-site-titre">${echapperHtml(nom)}</div>
      <div class="devis-apercu-site-tagline">${echapperHtml(tagline || "Votre accroche apparaîtra ici")}</div>
      <div class="devis-apercu-site-cta" style="background-color:${couleurHex};">Nous contacter</div>
    </div>
  `;
}

// Recalcule l'aperçu visuel à partir du nom d'entreprise (étape "prospect")
// et des 2 champs propres à cette carte (accroche, couleur). Appelée à
// chaque changement de champ concerné, et à chaque changement d'étape (pour
// rester synchro si le commercial revient modifier le nom de l'entreprise).
function mettreAJourApercuSite() {
  const rendu = document.getElementById("apercu-site-rendu");
  const inputTagline = document.getElementById("site-tagline");
  const selectCouleur = document.getElementById("site-couleur");
  if (!rendu || !inputTagline || !selectCouleur) return;
  const nom = document.getElementById("f-entreprise").value.trim();
  const tagline = inputTagline.value.trim();
  const couleurHex = COULEURS_SITE[selectCouleur.value] || COULEURS_SITE.bleu;
  rendu.innerHTML = rendreApercuSiteHtml(nom, tagline, couleurHex);
}

// Bloc "Aperçu visuel du site" — inséré une seule fois, dans l'étape "Sites
// Web" du catalogue (pas un champ par offre, un seul aperçu pour la
// catégorie entière).
function construireApercuSite() {
  const conteneur = document.createElement("div");
  conteneur.className = "carte-section";

  const titre = document.createElement("h3");
  titre.textContent = "Aperçu visuel du site (optionnel)";
  conteneur.appendChild(titre);

  const sousTitre = document.createElement("p");
  sousTitre.className = "sous-titre-section";
  sousTitre.textContent = "Montrez au prospect, en direct pendant le rendez-vous, à quoi pourrait ressembler son futur site.";
  conteneur.appendChild(sousTitre);

  const champTagline = document.createElement("div");
  champTagline.className = "champ";
  const labelTagline = document.createElement("label");
  labelTagline.setAttribute("for", "site-tagline");
  labelTagline.textContent = "Accroche du site";
  champTagline.appendChild(labelTagline);
  const inputTagline = document.createElement("input");
  inputTagline.type = "text";
  inputTagline.id = "site-tagline";
  inputTagline.placeholder = "Ex: Votre boulangerie artisanale au cœur du quartier";
  inputTagline.addEventListener("input", mettreAJourApercuSite);
  champTagline.appendChild(inputTagline);
  conteneur.appendChild(champTagline);

  const champCouleur = document.createElement("div");
  champCouleur.className = "champ";
  const labelCouleur = document.createElement("label");
  labelCouleur.setAttribute("for", "site-couleur");
  labelCouleur.textContent = "Couleur principale";
  champCouleur.appendChild(labelCouleur);
  const selectCouleur = document.createElement("select");
  selectCouleur.id = "site-couleur";
  Object.keys(COULEURS_SITE).forEach((nomCouleur) => {
    const option = document.createElement("option");
    option.value = nomCouleur;
    option.textContent = nomCouleur.charAt(0).toUpperCase() + nomCouleur.slice(1);
    selectCouleur.appendChild(option);
  });
  selectCouleur.value = "bleu";
  selectCouleur.addEventListener("change", mettreAJourApercuSite);
  champCouleur.appendChild(selectCouleur);
  conteneur.appendChild(champCouleur);

  const rendu = document.createElement("div");
  rendu.id = "apercu-site-rendu";
  rendu.className = "devis-apercu-site-rendu";
  conteneur.appendChild(rendu);

  // Vrai aperçu généré (24/08/2026) : au-delà du carré de couleur ci-dessus,
  // un bouton déclenche une vraie ébauche (texte écrit par Claude, photo
  // Pexels, réellement déployée) — pensé pour être montré en direct au
  // prospect pendant le RDV ("j'ai remarqué que vous n'aviez pas de site,
  // voici une première ébauche"). Même moteur que le chatbot (workflow 19),
  // mais sans sas de validation : le commercial voit et décide en direct.
  const blocReel = document.createElement("div");
  blocReel.className = "devis-apercu-reel";

  const boutonReel = document.createElement("button");
  boutonReel.type = "button";
  boutonReel.className = "btn btn-secondaire";
  boutonReel.id = "btn-apercu-reel";
  boutonReel.textContent = "🚀 Générer un vrai aperçu (bêta)";
  boutonReel.addEventListener("click", genererVraiApercuSite);
  blocReel.appendChild(boutonReel);

  const noteReel = document.createElement("p");
  noteReel.className = "sous-titre-section";
  noteReel.style.marginTop = "6px";
  noteReel.textContent = "Prend 10 à 30 secondes — génère un vrai site en ligne (texte rédigé automatiquement à partir du secteur, photo assortie), à montrer directement sur place.";
  blocReel.appendChild(noteReel);

  const resultatReel = document.createElement("div");
  resultatReel.id = "resultat-apercu-reel";
  blocReel.appendChild(resultatReel);

  conteneur.appendChild(blocReel);

  return conteneur;
}

function packSiteSelectionne() {
  const correspondance = { site_essentiel: "SITE_ESSENTIEL", site_pro: "SITE_PRO", site_ecommerce: "SITE_ECOMMERCE", site_sur_mesure: "SITE_PRO" };
  for (const code of Object.keys(correspondance)) {
    const cb = document.getElementById("chk-" + code);
    if (cb && cb.checked) return correspondance[code];
  }
  return "SITE_PRO";
}

async function genererVraiApercuSite() {
  const bouton = document.getElementById("btn-apercu-reel");
  const zoneResultat = document.getElementById("resultat-apercu-reel");
  const entreprise = document.getElementById("f-entreprise").value.trim();
  if (!entreprise) {
    zoneResultat.innerHTML = '<p class="message-erreur">Renseignez d\'abord le nom de l\'entreprise (étape "Le prospect").</p>';
    return;
  }
  bouton.disabled = true;
  bouton.textContent = "Génération en cours...";
  zoneResultat.innerHTML = "";

  try {
    const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/commercial-generer-apercu-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: sessionCommerciale.access_token,
        business_name: entreprise,
        secteur_activite: document.getElementById("f-secteur").value.trim(),
        contenu_supplementaire: document.getElementById("site-tagline").value.trim(),
        couleur_preferee: document.getElementById("site-couleur").value,
        pack_recommande: packSiteSelectionne()
      })
    });
    if (!resp.ok) throw new Error("Échec de la génération — réessayez dans un instant.");
    const resultat = await resp.json();
    zoneResultat.innerHTML = `
      <p style="margin:10px 0 6px;"><a class="btn btn-primaire" href="${echapperHtml(resultat.url)}" target="_blank" rel="noopener">Ouvrir l'aperçu en plein écran ↗</a></p>
      <iframe src="${echapperHtml(resultat.url)}" class="devis-apercu-reel-iframe" title="Aperçu du site généré" loading="lazy"></iframe>
    `;
  } catch (err) {
    const messageAffiche = (err.message && err.message !== "Failed to fetch") ? err.message : "Impossible de contacter le service de génération — réessayez dans un instant.";
    zoneResultat.innerHTML = `<p class="message-erreur">${echapperHtml(messageAffiche)}</p>`;
  } finally {
    bouton.disabled = false;
    bouton.textContent = "🚀 Générer un vrai aperçu (bêta)";
  }
}

// Construit le mini-calculateur d'un barème (radio / checkbox / nombre) et
// retourne l'élément DOM à insérer, plus une fonction recalculer() qui met à
// jour inputPrix.value à partir des champs actuellement sélectionnés.
// inputPrix reste un input number normal : le commercial peut toujours
// écraser la valeur calculée à la main après coup.
function construireBareme(item, inputPrix, repereEl) {
  const conteneur = document.createElement("div");
  conteneur.className = "devis-bareme";

  function recalculer() {
    let total = item.bareme.base;
    item.bareme.champs.forEach((champ) => {
      const elId = "bareme-" + item.code + "-" + champ.id;
      if (champ.type === "radio") {
        const coche = conteneur.querySelector(`input[name="${elId}"]:checked`);
        const option = champ.options.find((o) => o.label === (coche ? coche.value : champ.options[0].label));
        total += option ? option.valeur : 0;
      } else if (champ.type === "checkbox") {
        const el = conteneur.querySelector(`#${CSS.escape(elId)}`);
        if (el && el.checked) total += champ.valeur;
      } else if (champ.type === "nombre") {
        const el = conteneur.querySelector(`#${CSS.escape(elId)}`);
        const n = el ? parseFloat(el.value) || 0 : 0;
        total += n * champ.unite;
      }
    });
    inputPrix.value = total;
    recalculerTotalLive();
    mettreAJourRepereSurMesure(repereEl, total);
  }

  // Exemples pré-remplis (24/08/2026) : pour qu'un commercial qui ne connaît
  // pas la mécanique du Sur-Mesure sache quand même chiffrer correctement —
  // applique un profil type en un clic, reste modifiable ensuite champ par
  // champ. Volontairement des valeurs de départ, pas figées : à ajuster au
  // fil de l'expérience terrain comme le reste du barème.
  if (item.bareme.exemples && item.bareme.exemples.length) {
    const blocExemples = document.createElement("div");
    blocExemples.className = "devis-bareme-exemples";
    const titreExemples = document.createElement("div");
    titreExemples.className = "devis-bareme-titre";
    titreExemples.textContent = "Exemples — pour chiffrer vite si vous ne connaissez pas le besoin en détail";
    blocExemples.appendChild(titreExemples);
    const rangee = document.createElement("div");
    rangee.className = "devis-bareme-exemples-rangee";
    item.bareme.exemples.forEach((exemple) => {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "devis-bareme-exemple-btn";
      bouton.textContent = exemple.label;
      bouton.addEventListener("click", () => {
        item.bareme.champs.forEach((champ) => {
          const elId = "bareme-" + item.code + "-" + champ.id;
          const valeur = exemple.valeurs[champ.id];
          if (valeur === undefined) return;
          if (champ.type === "radio") {
            const radio = conteneur.querySelector(`input[name="${elId}"][value="${CSS.escape(valeur)}"]`);
            if (radio) radio.checked = true;
          } else if (champ.type === "checkbox") {
            const el = conteneur.querySelector(`#${CSS.escape(elId)}`);
            if (el) el.checked = !!valeur;
          } else if (champ.type === "nombre") {
            const el = conteneur.querySelector(`#${CSS.escape(elId)}`);
            if (el) el.value = valeur;
          }
        });
        recalculer();
      });
      rangee.appendChild(bouton);
    });
    blocExemples.appendChild(rangee);
    conteneur.appendChild(blocExemples);
  }

  item.bareme.champs.forEach((champ) => {
    const elId = "bareme-" + item.code + "-" + champ.id;
    const ligneChamp = document.createElement("div");
    ligneChamp.className = "devis-bareme-champ";

    if (champ.type === "radio") {
      const titre = document.createElement("div");
      titre.className = "devis-bareme-titre";
      titre.textContent = champ.label;
      ligneChamp.appendChild(titre);
      champ.options.forEach((option, i) => {
        const wrap = document.createElement("label");
        wrap.className = "devis-bareme-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = elId;
        radio.value = option.label;
        if (i === 0) radio.checked = true;
        radio.addEventListener("change", recalculer);
        wrap.appendChild(radio);
        wrap.appendChild(document.createTextNode(" " + option.label + (option.valeur ? ` (+${option.valeur} €)` : "")));
        ligneChamp.appendChild(wrap);
      });
    } else if (champ.type === "checkbox") {
      const wrap = document.createElement("label");
      wrap.className = "devis-bareme-option";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.id = elId;
      cb.addEventListener("change", recalculer);
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(` ${champ.label} (+${champ.valeur} €)`));
      ligneChamp.appendChild(wrap);
    } else if (champ.type === "nombre") {
      const titre = document.createElement("div");
      titre.className = "devis-bareme-titre";
      titre.textContent = `${champ.label} (× ${champ.unite} €)`;
      ligneChamp.appendChild(titre);
      const inputNombre = document.createElement("input");
      inputNombre.type = "number";
      inputNombre.min = "0";
      inputNombre.step = "1";
      inputNombre.id = elId;
      inputNombre.value = champ.defaut || 0;
      inputNombre.className = "devis-bareme-nombre";
      inputNombre.addEventListener("input", recalculer);
      ligneChamp.appendChild(inputNombre);
    }

    conteneur.appendChild(ligneChamp);
  });

  return { element: conteneur, recalculer };
}

function rendreCatalogueFormulaire() {
  const conteneur = document.getElementById("catalogue-formulaire");
  conteneur.innerHTML = "";

  CATALOGUE_DEVIS.forEach((groupe, indexGroupe) => {
    const etape = document.createElement("div");
    etape.className = "devis-etape";
    etape.id = "etape-cat-" + indexGroupe;
    etape.style.display = "none";

    const bloc = document.createElement("div");
    bloc.className = "devis-categorie carte-section";
    const titre = document.createElement("h3");
    titre.textContent = groupe.categorie;
    bloc.appendChild(titre);

    groupe.items.forEach((item) => {
      const ligne = document.createElement("div");
      ligne.className = "devis-item";
      ligne.dataset.code = item.code;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "chk-" + item.code;
      checkbox.addEventListener("change", () => {
        ligne.classList.toggle("selectionne", checkbox.checked);
        recalculerTotalLive();
      });

      const corps = document.createElement("div");
      corps.className = "devis-item-corps";

      const titreLigne = document.createElement("div");
      titreLigne.className = "devis-item-titre";
      titreLigne.innerHTML = `<label for="chk-${item.code}" style="cursor:pointer;">${item.nom}</label>` +
        (item.bientot ? ' <span class="badge-bientot-devis">Bientôt disponible</span>' : "");
      corps.appendChild(titreLigne);

      const desc = document.createElement("div");
      desc.className = "devis-item-desc";
      desc.textContent = item.description;
      corps.appendChild(desc);

      if (item.code === "gestion_email") {
        const repere = document.createElement("div");
        repere.className = "devis-repere-prive";
        repere.id = "repere-prive-gestion_email";
        repere.style.display = "none"; // affiché uniquement une fois le coût réel récupéré
        corps.appendChild(repere);
      }

      let repereSurMesure = null;
      if (item.bareme) {
        repereSurMesure = document.createElement("div");
        repereSurMesure.className = "devis-repere-prive";
        repereSurMesure.style.display = "none"; // affiché dès le premier calcul du barème
        corps.appendChild(repereSurMesure);
      }

      if (item.prixLibre) {
        const libre = document.createElement("div");
        libre.className = "devis-item-libre actif";

        const inputPrix = document.createElement("input");
        inputPrix.type = "number";
        inputPrix.min = "0";
        inputPrix.step = "1";
        inputPrix.value = item.prixDefaut || "";
        inputPrix.placeholder = "Montant HT en €";
        inputPrix.id = "prix-" + item.code;
        inputPrix.addEventListener("input", recalculerTotalLive);

        if (item.bareme) {
          const { element: baremeEl, recalculer: recalculerBareme } = construireBareme(item, inputPrix, repereSurMesure);
          libre.appendChild(baremeEl);
          const labelPrix = document.createElement("div");
          labelPrix.className = "devis-bareme-titre";
          labelPrix.textContent = "Prix calculé — ajustable manuellement si besoin";
          libre.appendChild(labelPrix);
          recalculerBareme();
        }

        libre.appendChild(inputPrix);
        const unite = document.createElement("span");
        unite.textContent = item.recurrent ? " € HT / mois" : " € HT (one-shot)";
        unite.style.marginLeft = "8px";
        unite.style.fontSize = ".85rem";
        unite.style.color = "var(--gris-texte)";
        libre.appendChild(unite);

        const descLibre = document.createElement("textarea");
        descLibre.className = "devis-item-desc-perso";
        descLibre.id = "desc-" + item.code;
        descLibre.rows = 2;
        descLibre.placeholder = "Décris précisément ce qui est inclus pour ce prospect (affiché sur le devis) — sinon la description générique ci-dessus sera utilisée.";
        libre.appendChild(descLibre);

        corps.appendChild(libre);
      }

      ligne.appendChild(checkbox);
      ligne.appendChild(corps);

      if (!item.prixLibre) {
        const prixEl = document.createElement("div");
        prixEl.className = "devis-item-prix";
        prixEl.innerHTML = formaterEuros(item.prix) + " HT" + (item.recurrent ? "<small><br>/ mois</small>" : "<small><br>one-shot</small>") +
          (item.hebergement ? `<small><br>+ ${item.hebergement} €/mois HT ${item.hebergementLabel || "hébergement"}</small>` : "");
        ligne.appendChild(prixEl);
      }

      bloc.appendChild(ligne);
    });

    etape.appendChild(bloc);
    if (groupe.categorie === "Sites Web") {
      etape.appendChild(construireApercuSite());
    }
    conteneur.appendChild(etape);
  });

  mettreAJourApercuSite();
}

function lignesSelectionnees() {
  const lignes = [];
  CATALOGUE_DEVIS.forEach((groupe) => {
    groupe.items.forEach((item) => {
      const checkbox = document.getElementById("chk-" + item.code);
      if (checkbox && checkbox.checked) {
        let prix = item.prix;
        let description = item.description;
        if (item.prixLibre) {
          const val = parseFloat(document.getElementById("prix-" + item.code).value);
          prix = isNaN(val) ? 0 : val;
          const descEl = document.getElementById("desc-" + item.code);
          const descVal = descEl ? descEl.value.trim() : "";
          if (descVal) description = descVal;
        }
        lignes.push({
          code: item.code,
          nom: item.nom,
          prix: prix,
          recurrent: !!item.recurrent,
          hebergement: item.hebergement || 0,
          hebergementLabel: item.hebergementLabel || "hébergement",
          bientot: !!item.bientot,
          description: description
        });
      }
    });
  });
  return lignes;
}

function calculerTotaux(lignes) {
  let totalPonctuel = 0, totalRecurrent = 0;
  lignes.forEach((l) => {
    if (l.recurrent) totalRecurrent += l.prix;
    else totalPonctuel += l.prix;
    if (l.hebergement) totalRecurrent += l.hebergement;
  });
  return { totalPonctuel, totalRecurrent };
}

function recalculerTotalLive() {
  const { totalPonctuel, totalRecurrent } = calculerTotaux(lignesSelectionnees());
  document.getElementById("total-recurrent-live").textContent = formaterEuros(totalRecurrent) + " HT/mois";
  document.getElementById("total-ponctuel-live").textContent = formaterEuros(totalPonctuel) + " HT";
}

// ---------------------------------------------------------------------------
// Navigation par étapes (une catégorie du catalogue par écran, plutôt qu'une
// seule longue page à scroller) — étapes : "prospect", une par catégorie de
// CATALOGUE_DEVIS, puis "recap".
// ---------------------------------------------------------------------------

let ETAPES = [];
let etapeActuelle = 0;
let sessionCommerciale = null; // rempli par initialiserFormulaire, utilisé par genererVraiApercuSite

function construireListeEtapes() {
  ETAPES = ["prospect", ...CATALOGUE_DEVIS.map((g, i) => "cat-" + i), "recap"];
}

function elementEtape(id) {
  if (id === "prospect") return document.getElementById("etape-prospect");
  if (id === "recap") return document.getElementById("etape-recap");
  return document.getElementById("etape-" + id);
}

function libelleEtape(id) {
  if (id === "prospect") return "Le prospect";
  if (id === "recap") return "Récapitulatif";
  return CATALOGUE_DEVIS[parseInt(id.split("-")[1], 10)].categorie;
}

function rendreRecap() {
  const lignes = lignesSelectionnees();
  const conteneur = document.getElementById("recap-lignes");
  if (lignes.length === 0) {
    conteneur.innerHTML = '<p class="sous-titre-section">Aucune offre sélectionnée pour l\'instant — revenez en arrière pour en choisir.</p>';
    return;
  }
  conteneur.innerHTML = lignes.map((l) => `
    <div class="devis-recap-item">
      <div class="devis-item-corps">
        <div class="devis-item-titre">${echapperHtml(l.nom)}${l.bientot ? ' <span class="badge-bientot-devis">Bientôt disponible</span>' : ""}</div>
        ${l.description ? `<div class="devis-item-desc">${echapperHtml(l.description)}</div>` : ""}
      </div>
      <div class="devis-item-prix">${formaterEuros(l.prix)} HT${l.recurrent ? "<small><br>/ mois</small>" : "<small><br>one-shot</small>"}</div>
    </div>
  `).join("");
}

function allerEtape(index) {
  etapeActuelle = Math.max(0, Math.min(index, ETAPES.length - 1));
  ETAPES.forEach((id, i) => {
    const el = elementEtape(id);
    if (el) el.style.display = i === etapeActuelle ? "block" : "none";
  });
  document.getElementById("devis-progression").textContent =
    `Étape ${etapeActuelle + 1}/${ETAPES.length} — ${libelleEtape(ETAPES[etapeActuelle])}`;
  document.getElementById("btn-precedent").style.visibility = etapeActuelle === 0 ? "hidden" : "visible";
  const dernierePage = etapeActuelle === ETAPES.length - 1;
  document.getElementById("btn-suivant").style.display = dernierePage ? "none" : "inline-block";
  document.getElementById("btn-generer-devis").style.display = dernierePage ? "inline-block" : "none";
  document.getElementById("message-formulaire").innerHTML = "";
  mettreAJourApercuSite(); // reste synchro si le nom d'entreprise a été modifié entre-temps
  if (dernierePage) rendreRecap();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function initialiserFormulaire() {
  const session = await requireAuth("connexion-commercial.html");
  if (!session) return;
  sessionCommerciale = session;

  const sb = window.supabaseClient;
  const { data: commercial } = await sb
    .from("commerciaux")
    .select("id,nom,prenom,email,code_affiliation")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.getElementById("etat-chargement").textContent =
      "Aucun profil commercial n'est rattaché à ce compte.";
    return;
  }

  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("nav-header").innerHTML = '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="historique-devis.html">Historique des devis</a> <a href="#" onclick="logout()">Se déconnecter</a>';
  document.getElementById("mode-formulaire").style.display = "block";

  rendreCatalogueFormulaire();
  recalculerTotalLive();
  construireListeEtapes();
  allerEtape(0);
  afficherRepereCommissionGestionEmail();

  document.getElementById("btn-precedent").addEventListener("click", () => allerEtape(etapeActuelle - 1));
  document.getElementById("btn-suivant").addEventListener("click", () => {
    if (ETAPES[etapeActuelle] === "prospect") {
      const entreprise = document.getElementById("f-entreprise").value.trim();
      if (!entreprise) {
        document.getElementById("message-formulaire").innerHTML = '<span class="message-erreur">Le nom de l\'entreprise est requis.</span>';
        return;
      }
    }
    allerEtape(etapeActuelle + 1);
  });

  document.getElementById("btn-generer-devis").addEventListener("click", async () => {
    const lignes = lignesSelectionnees();
    const messageEl = document.getElementById("message-formulaire");
    if (lignes.length === 0) {
      messageEl.innerHTML = '<span class="message-erreur">Sélectionnez au moins une offre.</span>';
      return;
    }
    const entreprise = document.getElementById("f-entreprise").value.trim();
    if (!entreprise) {
      messageEl.innerHTML = '<span class="message-erreur">Le nom de l\'entreprise est requis.</span>';
      return;
    }
    const devis = {
      v: 1,
      date: new Date().toISOString().slice(0, 10),
      commercial: {
        nom: commercial.nom,
        prenom: commercial.prenom,
        email: commercial.email,
        code_affiliation: commercial.code_affiliation
      },
      prospect: {
        entreprise: entreprise,
        contact: document.getElementById("f-contact").value.trim(),
        secteur: document.getElementById("f-secteur").value.trim()
      },
      lignes: lignes,
      previsualisationSite: {
        tagline: document.getElementById("site-tagline").value.trim(),
        couleur: document.getElementById("site-couleur").value
      }
    };
    const hash = encoderDevis(devis);

    // Historique — best-effort : un échec d'écriture n'empêche jamais
    // d'afficher/envoyer le devis, il manquera juste dans l'historique.
    try {
      await sb.from("devis_prospects").insert({
        commercial_id: commercial.id,
        prospect_entreprise: entreprise,
        devis_hash: hash
      });
    } catch (err) {
      // silencieux, non bloquant
    }

    window.location.hash = "d=" + hash;
    window.location.reload();
  });
}

// ---------------------------------------------------------------------------
// MODE APERÇU (partagé, pas d'authentification requise)
// ---------------------------------------------------------------------------

function rendreApercu(devis) {
  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("nav-header").innerHTML = "";
  document.getElementById("mode-apercu").style.display = "block";

  const dateFormatee = new Date(devis.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  document.getElementById("d-date").textContent = dateFormatee;
  document.getElementById("d-entreprise").textContent = devis.prospect.entreprise || "—";
  document.getElementById("d-contact").textContent = [devis.prospect.contact, devis.prospect.secteur].filter(Boolean).join(" · ");
  document.getElementById("d-commercial-nom").textContent = (devis.commercial.prenom || "") + " " + (devis.commercial.nom || "");
  document.getElementById("d-commercial-email").textContent = devis.commercial.email || "";

  const blocApercuSite = document.getElementById("d-apercu-site");
  if (devis.previsualisationSite && devis.previsualisationSite.tagline) {
    const couleurHex = COULEURS_SITE[devis.previsualisationSite.couleur] || COULEURS_SITE.bleu;
    blocApercuSite.innerHTML = rendreApercuSiteHtml(devis.prospect.entreprise, devis.previsualisationSite.tagline, couleurHex);
    blocApercuSite.style.display = "block";
  } else {
    blocApercuSite.style.display = "none";
  }

  const corpsTable = document.getElementById("d-lignes");
  corpsTable.innerHTML = "";
  devis.lignes.forEach((l) => {
    const tr = document.createElement("tr");
    const tdNom = document.createElement("td");
    const suffixeHebergement = l.hebergement
      ? `<br><small style="color:var(--gris-texte);">+ ${l.hebergementLabel || "hébergement"} ${formaterEuros(l.hebergement)} HT / ${formaterEuros(calculerTTC(l.hebergement))} TTC par mois</small>`
      : "";
    const descriptionHtml = l.description ? `<br><small style="color:var(--gris-texte);">${echapperHtml(l.description)}</small>` : "";
    tdNom.innerHTML = echapperHtml(l.nom) + (l.bientot ? ' <span class="badge-bientot-devis">Bientôt disponible</span>' : "") + descriptionHtml + suffixeHebergement;
    const tdHt = document.createElement("td");
    tdHt.className = "montant";
    tdHt.textContent = formaterEuros(l.prix) + (l.recurrent ? "/mois" : " (one-shot)");
    const tdTtc = document.createElement("td");
    tdTtc.className = "montant";
    tdTtc.textContent = formaterEuros(calculerTTC(l.prix)) + (l.recurrent ? "/mois" : " (one-shot)");
    tr.appendChild(tdNom);
    tr.appendChild(tdHt);
    tr.appendChild(tdTtc);
    corpsTable.appendChild(tr);
  });

  const { totalPonctuel, totalRecurrent } = calculerTotaux(devis.lignes);
  const premierMoisHt = totalPonctuel + totalRecurrent;
  document.getElementById("d-total-ponctuel-ht").textContent = formaterEuros(totalPonctuel);
  document.getElementById("d-total-ponctuel-ttc").textContent = formaterEuros(calculerTTC(totalPonctuel));
  document.getElementById("d-total-recurrent-ht").textContent = formaterEuros(totalRecurrent) + "/mois";
  document.getElementById("d-total-recurrent-ttc").textContent = formaterEuros(calculerTTC(totalRecurrent)) + "/mois";
  document.getElementById("d-total-premier-mois-ht").textContent = formaterEuros(premierMoisHt);
  document.getElementById("d-total-premier-mois-ttc").textContent = formaterEuros(calculerTTC(premierMoisHt));
  document.getElementById("d-mention-tva").textContent = mentionTva();

  // CTA : lien direct uniquement pour le cas le plus simple et le plus sûr
  // (Gestion Email seule, déjà commandable en self-service) — tout le reste
  // (offres "bientôt disponible", sur-mesure, plusieurs offres combinées)
  // renvoie vers le commercial plutôt que vers un lien de commande qui
  // n'existe pas encore pour ce mélange.
  const ctaEl = document.getElementById("devis-cta");
  const uniquementGestionEmail = devis.lignes.length === 1 && devis.lignes[0].code === "gestion_email";
  if (uniquementGestionEmail) {
    const lienInscription = `inscription.html?code_affiliation=${encodeURIComponent(devis.commercial.code_affiliation)}&type=B2B&plan=SECRETARIAT_SOCLE`;
    ctaEl.innerHTML = `
      <h4>Prêt à démarrer ?</h4>
      <p>La commande se passe en ligne, en quelques minutes, directement par vous.</p>
      <a class="btn btn-primaire" href="${lienInscription}">Démarrer maintenant</a>
    `;
  } else {
    // Le lien mailto: ne fait rien de visible si l'appareil n'a pas de
    // logiciel mail par défaut configuré — l'email est donc aussi affiché en
    // clair, copiable à la main dans ce cas.
    ctaEl.innerHTML = `
      <h4>Cette offre vous intéresse ?</h4>
      <p>Contactez ${echapperHtml(devis.commercial.prenom || "votre interlocuteur")} pour finaliser votre projet.</p>
      ${devis.commercial.email ? `
        <a class="btn btn-primaire" href="mailto:${echapperHtml(devis.commercial.email)}">Contacter par email</a>
        <p style="margin-top:8px; font-size:.88rem; color:var(--gris-texte);">Ou écrivez directement à : ${echapperHtml(devis.commercial.email)}</p>
      ` : ""}
    `;
  }

  document.title = `Devis ${devis.prospect.entreprise || ""} — Le Binôme Numérique`;

  initialiserBlocCreationAcces(devis);
}

// ---------------------------------------------------------------------------
// Création d'accès client (compte de connexion vide, sans vente ni
// abonnement) — visible uniquement si une session commerciale existe encore
// dans CE navigateur (juste après avoir généré le devis). Un prospect qui
// ouvre le lien reçu n'a pas de session : le bloc reste caché pour lui. La
// vraie protection est côté serveur (vérification JWT dans le workflow 35).
async function initialiserBlocCreationAcces(devis) {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session) return; // pas de session dans ce navigateur, on laisse caché

  const bloc = document.getElementById("bloc-creation-acces");
  bloc.style.display = "block";

  const blocEmail = document.getElementById("bloc-envoyer-email");
  blocEmail.style.display = "block";
  document.getElementById("btn-envoyer-email").addEventListener("click", async () => {
    const messageEl = document.getElementById("message-envoyer-email");
    const btn = document.getElementById("btn-envoyer-email");
    messageEl.innerHTML = "";

    const email = document.getElementById("ee-email").value.trim();
    if (!email) {
      messageEl.innerHTML = '<span class="message-erreur">L\'email du destinataire est requis.</span>';
      return;
    }

    btn.disabled = true;
    btn.textContent = "Envoi...";

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/commercial-envoyer-devis-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          email_destinataire: email,
          prospect: { entreprise: devis.prospect.entreprise || null },
          lignes: devis.lignes.map((l) => ({ nom: l.nom, prix: l.prix, recurrent: l.recurrent }))
        })
      });
      if (!resp.ok) {
        const texteErreur = await resp.text();
        throw new Error(texteErreur || "Échec de l'envoi.");
      }
      messageEl.innerHTML = `<span class="message-succes">Devis envoyé à ${email}.</span>`;
      document.getElementById("ee-email").value = "";
    } catch (err) {
      messageEl.innerHTML = `<span class="message-erreur">${err.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Envoyer le devis";
    }
  });

  document.getElementById("btn-creer-acces").addEventListener("click", async () => {
    const messageEl = document.getElementById("message-creation-acces");
    const btn = document.getElementById("btn-creer-acces");
    messageEl.innerHTML = "";

    const email = document.getElementById("ac-email").value.trim();
    const prenom = document.getElementById("ac-prenom").value.trim();
    const nom = document.getElementById("ac-nom").value.trim();
    const siret = document.getElementById("ac-siret").value.trim();
    const telephone = document.getElementById("ac-telephone").value.trim();

    if (!email || !prenom || !nom) {
      messageEl.innerHTML = '<span class="message-erreur">Email, prénom et nom sont requis.</span>';
      return;
    }
    if (!/^\d{14}$/.test(siret)) {
      messageEl.innerHTML = '<span class="message-erreur">Le SIRET doit contenir exactement 14 chiffres.</span>';
      return;
    }

    btn.disabled = true;
    btn.textContent = "Création...";

    try {
      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/commercial-creer-acces-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          email, prenom, nom, siret, telephone,
          raison_sociale: devis.prospect.entreprise || null,
          secteur_activite: devis.prospect.secteur || null
        })
      });
      if (!resp.ok) {
        const texteErreur = await resp.text();
        throw new Error(texteErreur || "Échec de la création.");
      }
      messageEl.innerHTML = `<span class="message-succes">Accès créé — un email a été envoyé à ${email} pour définir son mot de passe.</span>`;
      document.getElementById("ac-email").value = "";
      document.getElementById("ac-prenom").value = "";
      document.getElementById("ac-nom").value = "";
      document.getElementById("ac-siret").value = "";
      document.getElementById("ac-telephone").value = "";
    } catch (err) {
      messageEl.innerHTML = `<span class="message-erreur">${err.message}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Créer l'accès";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const devisPartage = lireHashDevis();
  if (devisPartage) {
    rendreApercu(devisPartage);
  } else {
    initialiserFormulaire();
  }
});
