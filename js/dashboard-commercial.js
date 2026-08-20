// Seuils de promotion MLM — DOIVENT rester synchronisés avec les constantes
// seuil_ventes_formateur / seuil_filleuls_formateurs_manager de la fonction
// evaluer_promotions_mlm() dans 34_refonte_progression_mlm.sql (remplace la
// version de 5_patch_mlm_reseau.sql : Formateur -> Manager se déclenche
// désormais sur 3 filleuls directs devenus eux-mêmes Formateur, plus sur leur
// volume de ventes). La décision de promotion réelle est calculée côté
// serveur (trigger SQL) ; ces valeurs ne servent ici qu'à afficher une jauge
// de progression.
const SEUIL_VENTES_FORMATEUR = 10;
const SEUIL_FILLEULS_FORMATEURS_MANAGER = 3;
const NIVEAUX_COMPTANT_COMME_FORMATEUR = ["formateur", "manager", "directeur"];

const LIBELLES_NIVEAU = { conseiller: "Conseiller", formateur: "Formateur", manager: "Manager", directeur: "Directeur" };
const LIBELLES_ROLE_VENTE = { conseiller: "Vente directe", formateur: "Override Formateur", manager: "Override Manager" };
const BADGE_PAR_STATUT = { payee: "actif", eligible: "essai", en_attente: "essai", annulee: "resilie", a_recuperer: "resilie", bloque_identifiant_manquant: "resilie", bloque_fraude: "resilie" };

// DOIT rester synchronisé avec la constante JOURS_GRACE_IDENTITE du workflow 04
// (n8n_workflows/04_commission_commerciaux.json) — voir migrations 10 et 12,
// l'analyse légale COO (statut VDI, pas de seuil en €).
const JOURS_GRACE_IDENTITE = 30;

// Le champ demandé dépend du statut juridique choisi à la candidature
// (Tally, workflow 09) — jamais modifiable en self-service (migration 12).
const CONFIG_IDENTIFIANT = {
  vdi: {
    label: "Numéro de sécurité sociale (15 chiffres)",
    placeholder: "Ex : 123456789012345",
    maxlength: 15,
    regex: /^[0-9]{15}$/,
    erreurFormat: "Le numéro de sécurité sociale doit contenir exactement 15 chiffres.",
    colonne: "numero_secu_sociale",
    libelleCourt: "numéro de sécurité sociale",
    messageDejaRenseigne: "✓ Numéro enregistré et chiffré.",
    messageEnregistre: "Numéro enregistré et chiffré. Vos prochaines vérifications de commission en tiendront compte.",
    sousTitre: "En tant que Vendeur à Domicile Indépendant (VDI), c'est Le Binôme Numérique qui déclare et verse vos cotisations sociales à l'URSSAF — ce numéro nous est indispensable pour le faire. Il n'est jamais réaffiché en clair une fois enregistré, et stocké chiffré."
  },
  auto_entrepreneur: {
    label: "Numéro de SIRET (14 chiffres)",
    placeholder: "Ex : 12345678900012",
    maxlength: 14,
    regex: /^[0-9]{14}$/,
    erreurFormat: "Le SIRET doit contenir exactement 14 chiffres.",
    colonne: "siret",
    libelleCourt: "SIRET",
    messageDejaRenseigne: "✓ SIRET enregistré.",
    messageEnregistre: "SIRET enregistré. Vos prochaines vérifications de commission en tiendront compte.",
    sousTitre: "En tant qu'auto-entrepreneur, vous déclarez et versez vous-même vos cotisations sociales — ce SIRET nous permet de vérifier votre immatriculation avant de vous verser une commission."
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth("connexion.html");
  if (!session) return;

  const sb = window.supabaseClient;

  const { data: commercial } = await sb
    .from("commerciaux")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.querySelector(".dash-main").innerHTML =
      "<p>Aucun profil commercial n'est rattaché à ce compte. Contactez l'administrateur.</p>";
    return;
  }

  document.getElementById("titre-bienvenue").textContent = `Bienvenue ${commercial.prenom}`;
  document.getElementById("stat-code").textContent = commercial.code_affiliation;
  document.getElementById("lien-parrainage").value =
    `https://lebinomenumerique.fr/inscription.html?code_affiliation=${commercial.code_affiliation}`;

  afficherNiveau(commercial.niveau_mlm);

  // Deux requêtes en parallèle : mes versements (toutes les ventes où je touche
  // une part, quel que soit mon rôle) et mes filleuls directs (RLS dédiée,
  // voir 6_patch_hebergement_sites.sql : policy "commerciaux_filleuls_directs").
  const [{ data: versements, error: erreurVersements }, { data: filleuls, error: erreurFilleuls }] = await Promise.all([
    sb.from("versements_commission")
      .select("*, ventes(code_reference, type_vente, statut_vente, commercial_id)")
      .eq("commercial_id", commercial.id)
      .order("date_eligibilite", { ascending: true }),
    sb.from("commerciaux")
      .select("id,prenom,nom,niveau_mlm")
      .eq("parrain_id", commercial.id)
  ]);

  if (erreurVersements) console.error("Erreur chargement versements :", erreurVersements);
  if (erreurFilleuls) console.error("Erreur chargement filleuls :", erreurFilleuls);

  const listeVersements = versements || [];
  const listeFilleuls = filleuls || [];

  // Ventes actives personnelles (mon rôle = Conseiller sur mes propres ventes).
  const ventesPersoActives = new Set(
    listeVersements
      .filter(v => v.niveau_mlm === "conseiller" && v.ventes?.statut_vente === "active")
      .map(v => v.vente_id)
  ).size;

  // Ventes actives par filleul, déduites de mes propres overrides Formateur —
  // évite une requête par filleul. Légèrement approximatif si une vente d'un
  // filleul a été exclue pour fraude (voir workflow 04) ; l'autorité finale
  // reste toujours le calcul serveur, jamais cet affichage.
  const ventesParFilleul = {};
  listeVersements
    .filter(v => v.niveau_mlm === "formateur" && v.ventes?.statut_vente === "active")
    .forEach(v => {
      const filleulId = v.ventes.commercial_id;
      if (!ventesParFilleul[filleulId]) ventesParFilleul[filleulId] = new Set();
      ventesParFilleul[filleulId].add(v.vente_id);
    });

  const filleulsAvecVentes = listeFilleuls.map(f => ({
    ...f,
    nb_ventes_actives: ventesParFilleul[f.id] ? ventesParFilleul[f.id].size : 0
  }));

  afficherProgression(commercial.niveau_mlm, ventesPersoActives, filleulsAvecVentes);
  afficherReseau(filleulsAvecVentes);
  afficherPipeline(listeVersements);
  afficherStatsEtHistorique(listeVersements);
  afficherAlerteIdentifiant(commercial, listeVersements);
  initialiserFormulaireIdentifiant(commercial);
  initialiserBasculeStatut(commercial);
  afficherEtatStripeConnect(commercial);
});

function afficherNiveau(niveau) {
  const el = document.getElementById("badge-niveau");
  el.textContent = LIBELLES_NIVEAU[niveau] || niveau;
  el.className = "badge-niveau badge-niveau-" + niveau;
}

function afficherProgression(niveau, ventesPerso, filleuls) {
  const barre = document.getElementById("barre-progression");
  const texte = document.getElementById("texte-progression");
  const titre = document.getElementById("titre-objectif");

  if (niveau === "manager") {
    barre.style.width = "100%";
    titre.textContent = "Statut Manager — niveau maximum atteint";
    texte.textContent = "Vous touchez un override sur toute votre équipe. Continuez à développer votre réseau !";
    return;
  }

  if (niveau === "formateur") {
    const nbFilleulsFormateurs = filleuls.filter(f => NIVEAUX_COMPTANT_COMME_FORMATEUR.includes(f.niveau_mlm)).length;
    const pct = Math.min(100, Math.round((nbFilleulsFormateurs / SEUIL_FILLEULS_FORMATEURS_MANAGER) * 100));
    barre.style.width = pct + "%";
    titre.textContent = "Statut Formateur — Objectif Manager";
    texte.textContent = `${nbFilleulsFormateurs}/${SEUIL_FILLEULS_FORMATEURS_MANAGER} filleuls devenus Formateur`;
    return;
  }

  // conseiller (niveau de départ)
  const pct = Math.min(100, Math.round((ventesPerso / SEUIL_VENTES_FORMATEUR) * 100));
  barre.style.width = pct + "%";
  titre.textContent = "Statut Conseiller — Objectif Formateur";
  texte.textContent = `${ventesPerso}/${SEUIL_VENTES_FORMATEUR} ventes validées`;
}

function afficherReseau(filleuls) {
  const tbody = document.getElementById("tbody-reseau");

  if (!filleuls.length) {
    tbody.innerHTML = `<tr><td colspan="3">Vous n'avez pas encore de filleul. Partagez votre lien de parrainage pour commencer à construire votre équipe.</td></tr>`;
    return;
  }

  tbody.innerHTML = filleuls.map(f => `
    <tr>
      <td>${f.prenom} ${f.nom}</td>
      <td><span class="badge-niveau badge-niveau-${f.niveau_mlm} badge-niveau-petit">${LIBELLES_NIVEAU[f.niveau_mlm] || f.niveau_mlm}</span></td>
      <td>${f.nb_ventes_actives}</td>
    </tr>`).join("");
}

function afficherPipeline(versements) {
  const enAttente = versements.filter(v => v.statut === "en_attente" || v.statut === "eligible");
  const encaissees = versements.filter(v => v.statut === "payee");

  const totalEnAttente = enAttente.reduce((s, v) => s + Number(v.montant), 0);
  const totalEncaisse = encaissees.reduce((s, v) => s + Number(v.montant), 0);

  document.getElementById("pipeline-en-attente").textContent = totalEnAttente.toFixed(2) + " €";
  document.getElementById("pipeline-encaisse").textContent = totalEncaisse.toFixed(2) + " €";

  // Regroupe les tranches à venir par date d'éligibilité (J+14/J+44/J+74 réels de chaque vente).
  const parDate = {};
  enAttente.forEach(v => {
    const d = v.date_eligibilite;
    if (!parDate[d]) parDate[d] = { date: d, montant: 0, nb: 0 };
    parDate[d].montant += Number(v.montant);
    parDate[d].nb += 1;
  });

  const prochains = Object.values(parDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const conteneur = document.getElementById("liste-prochains-versements");
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  conteneur.innerHTML = prochains.length
    ? prochains.map(p => {
        const dateEligibilite = new Date(p.date);
        const joursRestants = Math.ceil((dateEligibilite - aujourdhui) / (1000 * 60 * 60 * 24));
        const libelleDelai = joursRestants <= 0 ? "Débloqué" : `dans ${joursRestants} j`;
        return `
          <div class="ligne-versement-a-venir">
            <div>
              <strong>${dateEligibilite.toLocaleDateString("fr-FR")}</strong>
              <span class="delai-versement">${libelleDelai}</span>
            </div>
            <div class="montant-versement">
              ${p.montant.toFixed(2)} € <span class="nb-tranches">(${p.nb} tranche${p.nb > 1 ? "s" : ""})</span>
            </div>
          </div>`;
      }).join("")
    : `<p class="etat-vide">Aucun versement en attente pour le moment.</p>`;
}

function afficherStatsEtHistorique(versements) {
  const venteIds = new Set(versements.map(v => v.vente_id));
  document.getElementById("stat-nb-ventes").textContent = venteIds.size;
  document.getElementById("stat-commissions-attente").textContent =
    versements.filter(v => v.statut === "en_attente" || v.statut === "eligible")
      .reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";
  document.getElementById("stat-commissions-payees").textContent =
    versements.filter(v => v.statut === "payee")
      .reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";

  const tbody = document.getElementById("tbody-ventes");
  tbody.innerHTML = versements.length
    ? versements.slice().sort((a, b) => b.date_eligibilite.localeCompare(a.date_eligibilite)).map(v => `
        <tr>
          <td>${v.ventes?.code_reference || "—"}</td>
          <td>Tranche ${v.numero_tranche}<br><span class="etiquette-niveau">${LIBELLES_ROLE_VENTE[v.niveau_mlm] || ""}</span></td>
          <td>${Number(v.montant).toFixed(2)} €</td>
          <td>${new Date(v.date_eligibilite).toLocaleDateString("fr-FR")}</td>
          <td><span class="badge badge-${BADGE_PAR_STATUT[v.statut] || "essai"}">${v.statut}</span></td>
        </tr>`).join("")
    : `<tr><td colspan="5">Aucune commission enregistrée pour le moment.</td></tr>`;
}

function afficherAlerteIdentifiant(commercial, versements) {
  const banniere = document.getElementById("alerte-siret");
  const config = CONFIG_IDENTIFIANT[commercial.statut_juridique] || CONFIG_IDENTIFIANT.vdi;

  if (commercial.identifiant_juridique_renseigne) {
    banniere.classList.add("hidden");
    return;
  }

  const joursDepuisRecrutement = Math.floor((Date.now() - new Date(commercial.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const aDesCommissionsBloquees = versements.some(v => v.statut === "bloque_identifiant_manquant");
  const delaiDepasse = joursDepuisRecrutement > JOURS_GRACE_IDENTITE;

  banniere.classList.remove("hidden");

  if (aDesCommissionsBloquees || delaiDepasse) {
    banniere.className = "alerte-bandeau alerte-bandeau-danger";
    banniere.textContent = `Action Requise : délai de tolérance dépassé, ${config.libelleCourt} obligatoire pour débloquer vos commissions en attente.`;
  } else {
    const joursRestants = JOURS_GRACE_IDENTITE - joursDepuisRecrutement;
    banniere.className = "alerte-bandeau alerte-bandeau-info";
    banniere.textContent = `Pensez à renseigner votre ${config.libelleCourt} dans les ${joursRestants} prochain(s) jour(s) pour continuer à percevoir vos commissions sans interruption.`;
  }
}

// Le champ affiché (libellé, format, colonne cible) dépend du statut_juridique
// choisi une fois pour toutes à la candidature — jamais modifiable ici. Une
// fois renseigné, on ne réaffiche jamais le champ de saisie (le NIR est
// chiffré côté base ; le SIRET n'est pas sensible mais on garde le même
// comportement pour rester cohérent).
let configIdentifiantActif = null;

function initialiserFormulaireIdentifiant(commercial) {
  const config = CONFIG_IDENTIFIANT[commercial.statut_juridique] || CONFIG_IDENTIFIANT.vdi;
  configIdentifiantActif = config;

  document.getElementById("titre-identifiant").textContent =
    commercial.statut_juridique === "auto_entrepreneur" ? "Mon SIRET" : "Mon numéro de sécurité sociale";
  document.getElementById("sous-titre-identifiant").innerHTML =
    `${config.sousTitre} Voir vos <a href="cgv.html#apporteurs-affaires">CGV Apporteur d'affaires</a>.`;
  document.getElementById("label-identifiant").textContent = config.label;
  const champ = document.getElementById("input-identifiant");
  champ.placeholder = config.placeholder;
  champ.maxLength = config.maxlength;
  document.getElementById("message-deja-renseigne").textContent = config.messageDejaRenseigne;

  afficherEtatFormulaireIdentifiant(commercial.identifiant_juridique_renseigne);
}

function afficherEtatFormulaireIdentifiant(dejaRenseigne) {
  document.getElementById("identifiant-deja-renseigne").classList.toggle("hidden", !dejaRenseigne);
  document.getElementById("identifiant-formulaire").classList.toggle("hidden", dejaRenseigne);
  document.getElementById("btn-identifiant").classList.toggle("hidden", dejaRenseigne);
}

async function enregistrerIdentifiant() {
  const config = configIdentifiantActif;
  const champ = document.getElementById("input-identifiant");
  const messageEl = document.getElementById("message-identifiant");
  const valeur = champ.value.trim();

  if (!config.regex.test(valeur)) {
    messageEl.textContent = config.erreurFormat;
    messageEl.className = "message-erreur";
    return;
  }

  const sb = window.supabaseClient;
  const { data: { session } } = await sb.auth.getSession();
  const { error } = await sb.from("commerciaux").update({ [config.colonne]: valeur }).eq("user_id", session.user.id);
  champ.value = ""; // jamais laissé en clair dans le DOM, y compris en cas d'erreur réseau

  if (error) {
    messageEl.textContent = "Erreur lors de l'enregistrement. Réessayez ou contactez le support.";
    messageEl.className = "message-erreur";
    console.error(error);
    return;
  }

  messageEl.textContent = config.messageEnregistre;
  messageEl.className = "message-succes";
  document.getElementById("alerte-siret").classList.add("hidden");
  afficherEtatFormulaireIdentifiant(true);
}

// Le statut juridique lui-même reste verrouillé (migration 12) — un
// commercial ne peut que DÉPOSER une demande, jamais changer directement.
// Création en direct via Supabase (RLS self-insert, migration 13) : plus
// sûr qu'un webhook n8n recevant un commercial_id non vérifié depuis le
// client. n8n n'intervient qu'ensuite, pour notifier le fondateur.
let commercialActuel = null;

async function initialiserBasculeStatut(commercial) {
  commercialActuel = commercial;
  const autreStatut = commercial.statut_juridique === "vdi" ? "auto_entrepreneur" : "vdi";
  const libelleAutreStatut = autreStatut === "auto_entrepreneur" ? "Auto-entrepreneur" : "VDI";

  const sb = window.supabaseClient;
  const { data: demandes } = await sb
    .from("demandes_changement_statut_juridique")
    .select("id")
    .eq("commercial_id", commercial.id)
    .eq("statut", "en_attente")
    .limit(1);

  const texteEl = document.getElementById("texte-bascule-statut");
  const btnEl = document.getElementById("btn-demander-bascule");

  if (demandes && demandes.length > 0) {
    texteEl.textContent = "Une demande de bascule est en attente de validation par le fondateur.";
    btnEl.classList.add("hidden");
  } else {
    texteEl.textContent = "Vous souhaitez changer de statut juridique ?";
    btnEl.textContent = `Demander la bascule vers ${libelleAutreStatut}`;
    btnEl.classList.remove("hidden");
  }
}

async function demanderBasculeStatut() {
  const messageEl = document.getElementById("message-bascule");
  const commercial = commercialActuel;
  const autreStatut = commercial.statut_juridique === "vdi" ? "auto_entrepreneur" : "vdi";

  // Web Crypto API — cryptographiquement sûr, pas besoin de passer par n8n
  // pour ce jeton (utilisé ensuite comme lien d'approbation à usage unique).
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  const sb = window.supabaseClient;
  const { data, error } = await sb
    .from("demandes_changement_statut_juridique")
    .insert({
      commercial_id: commercial.id,
      statut_juridique_actuel: commercial.statut_juridique,
      statut_juridique_demande: autreStatut,
      token_validation: token
    })
    .select()
    .single();

  if (error) {
    messageEl.textContent = "Erreur lors de la demande (une demande est peut-être déjà en cours). Réessayez ou contactez le support.";
    messageEl.className = "message-erreur";
    console.error(error);
    return;
  }

  // Best-effort : la demande est déjà enregistrée même si cet appel échoue —
  // le fondateur peut toujours la retrouver manuellement en base.
  try {
    await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/notifier-demande-bascule-statut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demande_id: data.id })
    });
  } catch (e) {
    console.error("Notification fondateur non envoyée :", e);
  }

  messageEl.textContent = "Demande envoyée. Le fondateur doit la valider avant que le changement prenne effet.";
  messageEl.className = "message-succes";
  document.getElementById("btn-demander-bascule").classList.add("hidden");
  document.getElementById("texte-bascule-statut").textContent = "Une demande de bascule est en attente de validation par le fondateur.";
}

// Stripe Connect Express : le compte peut déjà exister (onboarding démarré ou
// terminé) — dans tous les cas, un nouveau lien Stripe permet de reprendre là
// où le commercial s'était arrêté ou de mettre à jour ses informations.
function afficherEtatStripeConnect(commercial) {
  // commercial.paiement_configure (booléen non sensible) — l'IBAN et
  // l'identifiant Stripe Connect réels vivent dans commerciaux_paiement,
  // jamais lisibles depuis le frontend (migration 26, correction sécurité).
  const btn = document.getElementById("btn-configurer-versements");
  btn.textContent = commercial.paiement_configure
    ? "Mettre à jour mes informations de paiement"
    : "Configurer mes versements";
}

async function configurerVersementsStripe() {
  const btn = document.getElementById("btn-configurer-versements");
  const messageEl = document.getElementById("message-stripe-connect");
  btn.disabled = true;
  const texteOriginal = btn.textContent;
  btn.textContent = "Préparation...";
  messageEl.textContent = "";

  try {
    const sb = window.supabaseClient;
    const { data: { session } } = await sb.auth.getSession();
    const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/demander-lien-stripe-connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: session.access_token })
    });
    const result = await resp.json();
    if (!resp.ok || !result.url) throw new Error(result.erreur || "Impossible de générer le lien Stripe.");
    window.location.href = result.url;
  } catch (err) {
    messageEl.textContent = err.message || "Une erreur est survenue.";
    messageEl.className = "message-erreur";
    btn.disabled = false;
    btn.textContent = texteOriginal;
  }
}

function copierLien() {
  const champ = document.getElementById("lien-parrainage");
  champ.select();
  navigator.clipboard.writeText(champ.value);
}
