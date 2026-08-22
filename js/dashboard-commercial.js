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
const ICONES_NIVEAU = { conseiller: "🥉", formateur: "🥈", manager: "🥇", directeur: "💎" };
const LIBELLES_ROLE_VENTE = { conseiller: "Vente directe", formateur: "Override Formateur", manager: "Override Manager" };

// Statut d'une ligne versements_commission -> libellé + classe de badge.
// Remplace l'affichage du statut interne brut (ex. "en_attente") par
// quelque chose de lisible pour le commercial.
const LIBELLES_STATUT_COMMISSION = {
  payee: { texte: "✅ Encaissée", classe: "encaissee" },
  eligible: { texte: "🔓 Débloquée", classe: "debloquee" },
  en_attente: { texte: "⏳ En cours", classe: "attente" },
  annulee: { texte: "❌ Annulée", classe: "annulee" },
  a_recuperer: { texte: "⚠️ À régulariser", classe: "bloquee" },
  bloque_identifiant_manquant: { texte: "🔒 Bloquée (identifiant)", classe: "bloquee" },
  bloque_fraude: { texte: "🔒 Bloquée", classe: "bloquee" },
  bloque_compte_paiement_manquant: { texte: "🔒 Bloquée (paiement)", classe: "bloquee" }
};

const LIBELLES_STATUT_VENTE = {
  active: { texte: "Active", classe: "actif" },
  annulee: { texte: "Annulée", classe: "resilie" },
  remboursee: { texte: "Remboursée", classe: "resilie" }
};

const LIBELLES_CATEGORIE_DEFI = { mini: "Mini-primes", mensuel: "Objectifs mensuels", trimestriel: "Paliers trimestriels" };

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
  const session = await requireAuth("connexion-commercial.html");
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

  // Trois requêtes en parallèle : mes versements (toutes les ventes où je
  // touche une part, quel que soit mon rôle), mes filleuls directs (RLS
  // dédiée, voir 6_patch_hebergement_sites.sql : policy
  // "commerciaux_filleuls_directs"), et les ventes visibles (les miennes +
  // celles de mes filleuls directs sont combinées automatiquement par les
  // policies "ventes_self"/"ventes_filleuls_directs", pas de filtre à poser
  // ici — on sépare les deux groupes après coup côté client).
  const [
    { data: versements, error: erreurVersements },
    { data: filleuls, error: erreurFilleuls },
    { data: ventesVisibles, error: erreurVentes },
    { data: catalogueDefis, error: erreurCatalogueDefis },
    { data: defisObtenus, error: erreurDefisObtenus }
  ] = await Promise.all([
    sb.from("versements_commission")
      .select("*, ventes(code_reference, type_vente, statut_vente, commercial_id)")
      .eq("commercial_id", commercial.id)
      .order("date_eligibilite", { ascending: true }),
    sb.from("commerciaux")
      .select("id,prenom,nom,niveau_mlm")
      .eq("parrain_id", commercial.id),
    sb.from("ventes")
      .select("id,code_reference,montant_contrat_ht,date_vente,statut_vente,commercial_id")
      .order("date_vente", { ascending: false }),
    sb.from("catalogue_defis")
      .select("code,libelle,categorie,montant")
      .eq("actif", true)
      .order("offset_tranche"),
    sb.from("defis_obtenus")
      .select("defi_code,periode,created_at")
      .eq("commercial_id", commercial.id)
      .order("created_at", { ascending: false })
  ]);

  if (erreurVersements) console.error("Erreur chargement versements :", erreurVersements);
  if (erreurFilleuls) console.error("Erreur chargement filleuls :", erreurFilleuls);
  if (erreurVentes) console.error("Erreur chargement ventes :", erreurVentes);
  if (erreurCatalogueDefis) console.error("Erreur chargement catalogue défis :", erreurCatalogueDefis);
  if (erreurDefisObtenus) console.error("Erreur chargement défis obtenus :", erreurDefisObtenus);

  const listeVersements = versements || [];
  const listeFilleuls = filleuls || [];
  const listeVentesVisibles = ventesVisibles || [];
  const mesVentes = listeVentesVisibles.filter(v => v.commercial_id === commercial.id);
  const ventesEquipe = listeVentesVisibles.filter(v => v.commercial_id !== commercial.id);
  document.getElementById("stat-nb-ventes").textContent = mesVentes.length;

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
  afficherDefis(catalogueDefis || [], defisObtenus || []);
  afficherReseau(filleulsAvecVentes);
  afficherCommissionsEnCoursEtRente(listeVersements);
  afficherDetailCommissions(listeVersements);
  afficherHistoriqueVentes(mesVentes);
  afficherActiviteEquipe(ventesEquipe, listeFilleuls);
  afficherAlerteIdentifiant(commercial, listeVersements);
  initialiserFormulaireIdentifiant(commercial);
  initialiserBasculeStatut(commercial);
  afficherEtatStripeConnect(commercial);
});

function afficherNiveau(niveau) {
  const el = document.getElementById("badge-niveau");
  el.textContent = `${ICONES_NIVEAU[niveau] || ""} ${LIBELLES_NIVEAU[niveau] || niveau}`;
  el.className = "badge-niveau badge-niveau-" + niveau;
}

function afficherProgression(niveau, ventesPerso, filleuls) {
  const barre = document.getElementById("barre-progression");
  const texte = document.getElementById("texte-progression");
  const titre = document.getElementById("titre-objectif");

  // Illumine les paliers déjà franchis / en cours sur la frise en bas de la
  // jauge (icônes en couleur au lieu de grisées, palier en cours qui pulse).
  const ordre = ["conseiller", "formateur", "manager"];
  const indexActuel = ordre.indexOf(niveau === "directeur" ? "manager" : niveau);
  ordre.forEach((palier, i) => {
    const el = document.getElementById("palier-" + palier);
    if (!el) return;
    el.classList.toggle("atteint", i < indexActuel || niveau === "manager" || niveau === "directeur");
    el.classList.toggle("actif", i === indexActuel && niveau !== "manager" && niveau !== "directeur");
  });

  if (niveau === "manager" || niveau === "directeur") {
    barre.style.width = "100%";
    titre.textContent = niveau === "directeur"
      ? "Niveau Directeur — le sommet du réseau"
      : "Niveau Manager atteint !";
    texte.textContent = "Vous touchez un override sur toute votre équipe. La suite : continuez à faire grandir votre réseau.";
    return;
  }

  if (niveau === "formateur") {
    const nbFilleulsFormateurs = filleuls.filter(f => NIVEAUX_COMPTANT_COMME_FORMATEUR.includes(f.niveau_mlm)).length;
    const restants = Math.max(0, SEUIL_FILLEULS_FORMATEURS_MANAGER - nbFilleulsFormateurs);
    const pct = Math.min(100, Math.round((nbFilleulsFormateurs / SEUIL_FILLEULS_FORMATEURS_MANAGER) * 100));
    barre.style.width = pct + "%";
    titre.textContent = "Prochain palier : Manager 🥇";
    texte.textContent = restants > 0
      ? `Plus que ${restants} filleul${restants > 1 ? "s" : ""} à faire passer Formateur pour débloquer Manager (${nbFilleulsFormateurs}/${SEUIL_FILLEULS_FORMATEURS_MANAGER})`
      : "Objectif atteint — la promotion se déclenche automatiquement à la prochaine vente de votre équipe.";
    return;
  }

  // conseiller (niveau de départ)
  const restantes = Math.max(0, SEUIL_VENTES_FORMATEUR - ventesPerso);
  const pct = Math.min(100, Math.round((ventesPerso / SEUIL_VENTES_FORMATEUR) * 100));
  barre.style.width = pct + "%";
  titre.textContent = "Prochain palier : Formateur 🥈";
  texte.textContent = restantes > 0
    ? `Plus que ${restantes} vente${restantes > 1 ? "s" : ""} pour débloquer Formateur (${ventesPerso}/${SEUIL_VENTES_FORMATEUR})`
    : "Objectif atteint — la promotion se déclenche automatiquement à votre prochaine vente.";
}

function afficherDefis(catalogue, obtenus) {
  const codesObtenus = new Set(obtenus.map(d => d.defi_code));
  const parCategorie = { mini: [], mensuel: [], trimestriel: [] };
  catalogue.forEach(d => { if (parCategorie[d.categorie]) parCategorie[d.categorie].push(d); });

  const grille = document.getElementById("grille-defis");
  grille.innerHTML = Object.keys(LIBELLES_CATEGORIE_DEFI).map(cat => {
    const defis = parCategorie[cat] || [];
    if (!defis.length) return "";
    return `
      <div class="defi-carte">
        <h4>${LIBELLES_CATEGORIE_DEFI[cat]}</h4>
        ${defis.map(d => {
          const obtenu = codesObtenus.has(d.code);
          return `<div class="defi-item${obtenu ? " defi-obtenu" : ""}">
            <span class="defi-nom">${obtenu ? "✅ " : ""}${d.libelle}</span>
            <span class="defi-montant">${Number(d.montant).toFixed(0)} €</span>
          </div>`;
        }).join("")}
      </div>`;
  }).join("");

  const libelleParCode = {};
  catalogue.forEach(d => { libelleParCode[d.code] = { libelle: d.libelle, montant: d.montant }; });

  const conteneur = document.getElementById("liste-defis-obtenus");
  conteneur.innerHTML = obtenus.length
    ? obtenus.slice(0, 10).map(o => {
        const info = libelleParCode[o.defi_code] || { libelle: o.defi_code, montant: 0 };
        return `
          <div class="ligne-versement-a-venir quete-debloquee">
            <div><strong>${info.libelle}</strong><span class="delai-versement">${new Date(o.created_at).toLocaleDateString("fr-FR")}</span></div>
            <div class="montant-versement">${Number(info.montant).toFixed(2)} €</div>
          </div>`;
      }).join("")
    : `<p class="etat-vide">Aucun défi obtenu pour le moment — ils se débloquent automatiquement selon votre activité.</p>`;
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
      <td><span class="badge-niveau badge-niveau-${f.niveau_mlm} badge-niveau-petit">${ICONES_NIVEAU[f.niveau_mlm] || ""} ${LIBELLES_NIVEAU[f.niveau_mlm] || f.niveau_mlm}</span></td>
      <td>${f.nb_ventes_actives}</td>
    </tr>`).join("");
}

function afficherCommissionsEnCoursEtRente(versements) {
  const enAttente = versements.filter(v => v.statut === "en_attente" || v.statut === "eligible");
  const encaissees = versements.filter(v => v.statut === "payee");

  document.getElementById("pipeline-en-attente").textContent =
    enAttente.reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";
  document.getElementById("pipeline-encaisse").textContent =
    encaissees.reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";

  // Vesting initial (nouveaux contrats) : les échéances pas encore débloquées,
  // regroupées par date d'éligibilité (J+14/J+44/J+74 réels de chaque vente).
  const enAttenteVesting = enAttente.filter(v => v.type_versement !== "residuel");
  const parDate = {};
  enAttenteVesting.forEach(v => {
    const d = v.date_eligibilite;
    if (!parDate[d]) parDate[d] = { date: d, montant: 0, nb: 0 };
    parDate[d].montant += Number(v.montant);
    parDate[d].nb += 1;
  });
  const prochains = Object.values(parDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);

  const conteneurVesting = document.getElementById("liste-prochains-versements");
  conteneurVesting.innerHTML = prochains.length
    ? prochains.map(p => {
        const dateEligibilite = new Date(p.date);
        const joursRestants = Math.ceil((dateEligibilite - aujourdhui) / (1000 * 60 * 60 * 24));
        const debloque = joursRestants <= 0;
        const libelleDelai = debloque ? "🔓 Débloquée" : `⏳ dans ${joursRestants} j`;
        return `
          <div class="ligne-versement-a-venir${debloque ? " quete-debloquee" : ""}">
            <div>
              <strong>${dateEligibilite.toLocaleDateString("fr-FR")}</strong>
              <span class="delai-versement">${libelleDelai}</span>
            </div>
            <div class="montant-versement">
              ${p.montant.toFixed(2)} € <span class="nb-tranches">(${p.nb} échéance${p.nb > 1 ? "s" : ""})</span>
            </div>
          </div>`;
      }).join("")
    : `<p class="etat-vide">Aucune commission en cours de déblocage pour le moment.</p>`;

  // Rente active : pour chaque abonnement qui a déjà généré au moins une
  // ligne résiduelle, on affiche le montant du DERNIER mois généré (= le
  // rythme mensuel actuel de cette rente) plutôt que de sommer tout
  // l'historique, qui mélangerait plusieurs mois différents.
  const residuelParVente = {};
  versements.filter(v => v.type_versement === "residuel").forEach(v => {
    const existant = residuelParVente[v.vente_id];
    if (!existant || v.numero_tranche > existant.numero_tranche) {
      residuelParVente[v.vente_id] = {
        vente_id: v.vente_id,
        numero_tranche: v.numero_tranche,
        montant: Number(v.montant),
        code_reference: v.ventes?.code_reference || "—"
      };
    }
  });
  const rentes = Object.values(residuelParVente);
  const totalRenteMensuelle = rentes.reduce((s, r) => s + r.montant, 0);
  document.getElementById("rente-mensuelle-active").textContent = totalRenteMensuelle.toFixed(2) + " € / mois";

  const conteneurRente = document.getElementById("liste-rente-active");
  conteneurRente.innerHTML = rentes.length
    ? rentes.map(r => `
        <div class="ligne-versement-a-venir quete-debloquee">
          <div><strong>${r.code_reference}</strong><span class="delai-versement">abonnement actif</span></div>
          <div class="montant-versement">${r.montant.toFixed(2)} € <span class="nb-tranches">/ mois</span></div>
        </div>`).join("")
    : `<p class="etat-vide">Aucune rente active pour le moment — elle démarre une fois le vesting initial d'un abonnement terminé.</p>`;
}

function afficherDetailCommissions(versements) {
  document.getElementById("stat-commissions-attente").textContent =
    versements.filter(v => v.statut === "en_attente" || v.statut === "eligible")
      .reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";
  document.getElementById("stat-commissions-payees").textContent =
    versements.filter(v => v.statut === "payee")
      .reduce((s, v) => s + Number(v.montant), 0).toFixed(2) + " €";

  const tbody = document.getElementById("tbody-ventes");
  tbody.innerHTML = versements.length
    ? versements.slice().sort((a, b) => b.date_eligibilite.localeCompare(a.date_eligibilite)).map(v => {
        const statutCommission = LIBELLES_STATUT_COMMISSION[v.statut] || { texte: v.statut, classe: "attente" };
        const estResiduel = v.type_versement === "residuel";
        return `
        <tr>
          <td>${v.ventes?.code_reference || "—"}</td>
          <td>
            Échéance ${v.numero_tranche}<br>
            <span class="etiquette-niveau">${LIBELLES_ROLE_VENTE[v.niveau_mlm] || ""}</span>
            ${estResiduel ? '<span class="etiquette-residuel">🔁 Rente mensuelle</span>' : ""}
          </td>
          <td>${Number(v.montant).toFixed(2)} €</td>
          <td>${new Date(v.date_eligibilite).toLocaleDateString("fr-FR")}</td>
          <td><span class="badge badge-quete-${statutCommission.classe}">${statutCommission.texte}</span></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="5">Aucune commission enregistrée pour le moment — votre première vente en générera une.</td></tr>`;
}

function afficherHistoriqueVentes(ventes) {
  const tbody = document.getElementById("tbody-historique-ventes");
  tbody.innerHTML = ventes.length
    ? ventes.map(v => {
        const statutVente = LIBELLES_STATUT_VENTE[v.statut_vente] || { texte: v.statut_vente, classe: "essai" };
        return `
        <tr>
          <td>${new Date(v.date_vente).toLocaleDateString("fr-FR")}</td>
          <td>${v.code_reference}</td>
          <td>${Number(v.montant_contrat_ht).toFixed(2)} €</td>
          <td><span class="badge badge-${statutVente.classe}">${statutVente.texte}</span></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="4">Aucune vente enregistrée pour le moment.</td></tr>`;
}

function afficherActiviteEquipe(ventes, filleuls) {
  const tbody = document.getElementById("tbody-activite-equipe");
  const nomParFilleul = {};
  filleuls.forEach(f => { nomParFilleul[f.id] = `${f.prenom} ${f.nom}`; });

  tbody.innerHTML = ventes.length
    ? ventes.slice(0, 20).map(v => `
        <tr>
          <td>${new Date(v.date_vente).toLocaleDateString("fr-FR")}</td>
          <td>${nomParFilleul[v.commercial_id] || "—"}</td>
          <td>${v.code_reference}</td>
          <td>${Number(v.montant_contrat_ht).toFixed(2)} €</td>
        </tr>`).join("")
    : `<tr><td colspan="4">Aucune vente dans votre équipe pour le moment.</td></tr>`;
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
