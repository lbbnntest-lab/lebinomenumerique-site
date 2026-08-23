// Tableau de bord de reporting (Module 6, 23/08/2026) — réutilise les données
// déjà générées par le reste du système (demandes, abonnements, factures),
// aucune nouvelle source de données créée. Affichage uniquement pour l'instant,
// pas encore positionné comme option premium payante (décision de tarification
// en attente, cf. MASTER_PLAN).

// Ordre fixe des couleurs catégorielles (palette validée CVD-safe, dataviz skill)
// — jamais réassignées selon ce qui est présent, toujours le même slot par valeur.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const CATEGORIE_ORDRE = ["SPAM", "DEVIS", "RDV", "SAV", "URGENCE", "FACTURATION", "ADMIN", "AUTRE"];
const CATEGORIE_LABELS = { SPAM: "Spam", DEVIS: "Devis", RDV: "Rendez-vous", SAV: "SAV", URGENCE: "Urgence", FACTURATION: "Facturation", ADMIN: "Administratif", AUTRE: "Autre" };

const CANAL_ORDRE = ["email", "telephone", "chat", "sms"];
const CANAL_LABELS = { email: "Email", telephone: "Téléphone", chat: "Chat", sms: "SMS" };

const STATUT_ORDRE = ["nouveau", "en_cours", "traite", "archive"];
const STATUT_LABELS = { nouveau: "Nouveau", en_cours: "En cours", traite: "Traité", archive: "Archivé" };

function formaterEuros(montant) {
  return Number(montant).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}

function rendreBarresHorizontales(conteneurId, ordre, labels, comptes) {
  const conteneur = document.getElementById(conteneurId);
  const total = Object.values(comptes).reduce((s, v) => s + v, 0);
  const entrees = ordre.filter((k) => comptes[k] > 0);

  if (!total || !entrees.length) {
    conteneur.innerHTML = `<p class="etat-vide-metrique">Aucune donnée sur cette période.</p>`;
    return;
  }

  const max = Math.max(...entrees.map((k) => comptes[k]));
  conteneur.innerHTML = entrees.map((k) => {
    const idx = ordre.indexOf(k);
    const valeur = comptes[k];
    const largeur = Math.max(3, Math.round((valeur / max) * 100));
    return `
      <div class="barre-h-ligne">
        <span class="barre-h-label">${labels[k] || k}</span>
        <div class="barre-h-track"><div class="barre-h-fill" style="width:${largeur}%; background:${SERIES[idx % SERIES.length]};"></div></div>
        <span class="barre-h-valeur">${valeur}</span>
      </div>`;
  }).join("");
}

function rendreBarresMensuelles(conteneurId, moisLabels, valeurs, formateur) {
  const conteneur = document.getElementById(conteneurId);
  const max = Math.max(1, ...valeurs);
  conteneur.innerHTML = moisLabels.map((label, i) => {
    const v = valeurs[i];
    const hauteur = Math.max(2, Math.round((v / max) * 100));
    return `
      <div class="barre-v-item">
        <span class="barre-v-valeur">${v ? formateur(v) : ""}</span>
        <div class="barre-v-fill" style="height:${hauteur}%;"></div>
        <span class="barre-v-mois">${label}</span>
      </div>`;
  }).join("");
}

function derniersMois(n) {
  const mois = [];
  const maintenant = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push({ cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("fr-FR", { month: "short" }) });
  }
  return mois;
}

async function initialiserReporting() {
  const session = await requireAuth("connexion.html");
  if (!session) return;

  const sb = window.supabaseClient;

  const { data: utilisateur } = await sb
    .from("utilisateurs_comptes")
    .select("compte_client_id")
    .eq("id", session.user.id)
    .single();

  if (!utilisateur) return;

  document.getElementById("nav-header").innerHTML =
    '<a href="dashboard-client.html">Tableau de bord</a> <a href="#" onclick="logout()">Se déconnecter</a>';

  const compteClientId = utilisateur.compte_client_id;

  async function chargerDonnees(joursPeriode) {
    const depuis = new Date();
    depuis.setDate(depuis.getDate() - joursPeriode);

    const [{ data: demandes }, { data: abonnements }, { data: factures }] = await Promise.all([
      sb.from("demandes")
        .select("categorie, canal, urgent, statut, quota_atteint, created_at")
        .eq("compte_client_id", compteClientId)
        .gte("created_at", depuis.toISOString()),
      sb.from("abonnements")
        .select("plans_tarifaires(quota_demandes_mensuelles)")
        .eq("compte_client_id", compteClientId)
        .eq("statut", "actif"),
      sb.from("factures")
        .select("montant_ttc, date_paiement, created_at")
        .eq("compte_client_id", compteClientId)
    ]);

    return { demandes: demandes || [], abonnements: abonnements || [], factures: factures || [] };
  }

  function afficher({ demandes, abonnements, factures }) {
    // --- Stat tuiles ---
    const total = demandes.length;
    const nbUrgentes = demandes.filter((d) => d.urgent).length;
    const nbTraitees = demandes.filter((d) => d.statut === "traite" || d.statut === "archive").length;
    document.getElementById("stat-total-demandes").textContent = total;
    document.getElementById("stat-taux-urgence").textContent = total ? Math.round((nbUrgentes / total) * 100) + " %" : "—";
    document.getElementById("stat-taux-traite").textContent = total ? Math.round((nbTraitees / total) * 100) + " %" : "—";

    // --- Volume mensuel (6 derniers mois, indépendant du filtre période) ---
    const mois6 = derniersMois(6);
    const comptesParMois = {};
    demandes.forEach((d) => {
      const cle = d.created_at.slice(0, 7);
      comptesParMois[cle] = (comptesParMois[cle] || 0) + 1;
    });
    rendreBarresMensuelles("chart-volume", mois6.map((m) => m.label), mois6.map((m) => comptesParMois[m.cle] || 0), (v) => String(v));

    // --- Répartition catégorie / canal / statut ---
    const comptesCategorie = {};
    const comptesCanal = {};
    const comptesStatut = {};
    demandes.forEach((d) => {
      comptesCategorie[d.categorie] = (comptesCategorie[d.categorie] || 0) + 1;
      comptesCanal[d.canal] = (comptesCanal[d.canal] || 0) + 1;
      comptesStatut[d.statut] = (comptesStatut[d.statut] || 0) + 1;
    });
    rendreBarresHorizontales("chart-categorie", CATEGORIE_ORDRE, CATEGORIE_LABELS, comptesCategorie);
    rendreBarresHorizontales("chart-canal", CANAL_ORDRE, CANAL_LABELS, comptesCanal);
    rendreBarresHorizontales("chart-statut", STATUT_ORDRE, STATUT_LABELS, comptesStatut);

    // --- Usage du quota (mois en cours, indépendant du filtre période) ---
    const quotaInclus = abonnements[0]?.plans_tarifaires?.quota_demandes_mensuelles ?? null;
    const debutMoisCourant = new Date();
    debutMoisCourant.setDate(1);
    debutMoisCourant.setHours(0, 0, 0, 0);
    const demandesMoisCourant = demandes.filter((d) => new Date(d.created_at) >= debutMoisCourant).length;
    const quotaFill = document.getElementById("quota-fill");
    const quotaTexte = document.getElementById("quota-texte");
    const quotaDetail = document.getElementById("quota-detail");
    if (quotaInclus == null) {
      quotaFill.style.width = "0%";
      quotaTexte.textContent = "";
      quotaDetail.textContent = `${demandesMoisCourant} demande(s) ce mois-ci — quota illimité sur votre plan.`;
    } else {
      const pct = Math.min(100, Math.round((demandesMoisCourant / quotaInclus) * 100));
      quotaFill.style.width = pct + "%";
      quotaFill.classList.toggle("quota-plein", demandesMoisCourant >= quotaInclus);
      quotaTexte.textContent = pct >= 15 ? pct + " %" : "";
      quotaDetail.textContent = `${demandesMoisCourant} / ${quotaInclus} demandes incluses ce mois-ci.` +
        (demandesMoisCourant > quotaInclus ? " Au-delà, facturé au mois suivant (jamais de blocage)." : "");
    }

    // --- Facturation (6 derniers mois) ---
    const facturesParMois = {};
    factures.forEach((f) => {
      const date = f.date_paiement || f.created_at;
      if (!date) return;
      const cle = date.slice(0, 7);
      facturesParMois[cle] = (facturesParMois[cle] || 0) + Number(f.montant_ttc || 0);
    });
    rendreBarresMensuelles("chart-facturation", mois6.map((m) => m.label), mois6.map((m) => Math.round(facturesParMois[m.cle] || 0)), formaterEuros);

    const totalFacturePeriode = factures
      .filter((f) => new Date(f.date_paiement || f.created_at) >= new Date(Date.now() - Number(document.getElementById("filtre-periode").value) * 86400000))
      .reduce((s, f) => s + Number(f.montant_ttc || 0), 0);
    document.getElementById("stat-facture-periode").textContent = formaterEuros(totalFacturePeriode);
  }

  async function rafraichir() {
    const jours = Number(document.getElementById("filtre-periode").value);
    const donnees = await chargerDonnees(jours);
    document.getElementById("etat-chargement").style.display = "none";
    document.getElementById("contenu-reporting").style.display = "block";
    afficher(donnees);
  }

  document.getElementById("filtre-periode").addEventListener("change", rafraichir);
  await rafraichir();
}

document.addEventListener("DOMContentLoaded", initialiserReporting);
