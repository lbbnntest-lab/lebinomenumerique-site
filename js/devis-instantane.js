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
        description: "Besoin spécifique, à partir de 450 €/mois indicatif." }
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
        description: "Projet spécifique, sur devis." }
    ]
  },
  {
    categorie: "Automatisation",
    items: [
      { code: "automatisation_sur_mesure", nom: "Automatisation Sur-Mesure", prixLibre: true, prixDefaut: 1200, recurrent: false,
        description: "Automatisation d'une tâche métier précise, sur devis." }
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

function rendreCatalogueFormulaire() {
  const conteneur = document.getElementById("catalogue-formulaire");
  conteneur.innerHTML = "";

  CATALOGUE_DEVIS.forEach((groupe) => {
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
        libre.appendChild(inputPrix);
        const unite = document.createElement("span");
        unite.textContent = item.recurrent ? " € HT / mois" : " € HT (one-shot)";
        unite.style.marginLeft = "8px";
        unite.style.fontSize = ".85rem";
        unite.style.color = "var(--gris-texte)";
        libre.appendChild(unite);
        corps.appendChild(libre);
      }

      ligne.appendChild(checkbox);
      ligne.appendChild(corps);

      if (!item.prixLibre) {
        const prixEl = document.createElement("div");
        prixEl.className = "devis-item-prix";
        prixEl.innerHTML = formaterEuros(item.prix) + " HT" + (item.recurrent ? "<small><br>/ mois</small>" : "<small><br>one-shot</small>") +
          (item.hebergement ? `<small><br>+ ${item.hebergement} €/mois HT hébergement</small>` : "");
        ligne.appendChild(prixEl);
      }

      bloc.appendChild(ligne);
    });

    conteneur.appendChild(bloc);
  });
}

function lignesSelectionnees() {
  const lignes = [];
  CATALOGUE_DEVIS.forEach((groupe) => {
    groupe.items.forEach((item) => {
      const checkbox = document.getElementById("chk-" + item.code);
      if (checkbox && checkbox.checked) {
        let prix = item.prix;
        if (item.prixLibre) {
          const val = parseFloat(document.getElementById("prix-" + item.code).value);
          prix = isNaN(val) ? 0 : val;
        }
        lignes.push({
          code: item.code,
          nom: item.nom,
          prix: prix,
          recurrent: !!item.recurrent,
          hebergement: item.hebergement || 0,
          bientot: !!item.bientot
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

async function initialiserFormulaire() {
  const session = await requireAuth("connexion.html");
  if (!session) return;

  const sb = window.supabaseClient;
  const { data: commercial } = await sb
    .from("commerciaux")
    .select("nom,prenom,email,code_affiliation")
    .eq("user_id", session.user.id)
    .single();

  if (!commercial) {
    document.getElementById("etat-chargement").textContent =
      "Aucun profil commercial n'est rattaché à ce compte.";
    return;
  }

  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("nav-header").innerHTML = '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="#" onclick="logout()">Se déconnecter</a>';
  document.getElementById("mode-formulaire").style.display = "block";

  rendreCatalogueFormulaire();
  recalculerTotalLive();

  document.getElementById("btn-generer-devis").addEventListener("click", () => {
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
      lignes: lignes
    };
    window.location.hash = "d=" + encoderDevis(devis);
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

  const corpsTable = document.getElementById("d-lignes");
  corpsTable.innerHTML = "";
  devis.lignes.forEach((l) => {
    const tr = document.createElement("tr");
    const tdNom = document.createElement("td");
    const suffixeHebergement = l.hebergement
      ? `<br><small style="color:var(--gris-texte);">+ hébergement ${formaterEuros(l.hebergement)} HT / ${formaterEuros(calculerTTC(l.hebergement))} TTC par mois</small>`
      : "";
    tdNom.innerHTML = l.nom + (l.bientot ? ' <span class="badge-bientot-devis">Bientôt disponible</span>' : "") + suffixeHebergement;
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
    ctaEl.innerHTML = `
      <h4>Cette offre vous intéresse ?</h4>
      <p>Contactez ${devis.commercial.prenom || "votre interlocuteur"} pour finaliser votre projet.</p>
      ${devis.commercial.email ? `<a class="btn btn-primaire" href="mailto:${devis.commercial.email}">Contacter par email</a>` : ""}
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
