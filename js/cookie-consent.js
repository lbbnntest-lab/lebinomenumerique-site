// Bandeau de consentement cookies. Une seule catégorie non-essentielle existe
// aujourd'hui sur le site (l'embed Cal.com, voir cal-embed-gated.js) — Supabase
// Auth et le chatbot ne stockent rien qui nécessite un consentement (session
// applicative demandée par l'utilisateur lui-même). Un choix global accepter/
// refuser suffit donc tant qu'une seule finalité tierce existe.
(function () {
  const CLE_CONSENTEMENT = "lbn_cookie_consent";

  function consentementActuel() {
    return window.localStorage.getItem(CLE_CONSENTEMENT);
  }

  function definirConsentement(valeur) {
    window.localStorage.setItem(CLE_CONSENTEMENT, valeur);
    masquerBandeau();
    window.dispatchEvent(new CustomEvent("cookieConsentChange", { detail: { consent: valeur } }));
  }

  function masquerBandeau() {
    const banniere = document.getElementById("cookie-banner");
    if (banniere) banniere.remove();
  }

  function afficherBandeau() {
    masquerBandeau();
    const banniere = document.createElement("div");
    banniere.id = "cookie-banner";
    banniere.className = "cookie-banner";
    banniere.setAttribute("role", "dialog");
    banniere.setAttribute("aria-label", "Consentement aux cookies");
    banniere.innerHTML =
      '<p class="cookie-banner__texte">' +
      "Nous utilisons uniquement des cookies nécessaires au fonctionnement du site (connexion à votre compte). " +
      "Le calendrier de prise de rendez-vous (Cal.com) dépose des cookies tiers et ne se charge que si vous l'acceptez. " +
      '<a href="mentions-legales.html">En savoir plus</a>.</p>' +
      '<div class="cookie-banner__actions">' +
      '<button type="button" class="btn btn-secondaire" data-action="refuser">Refuser</button>' +
      '<button type="button" class="btn btn-primaire" data-action="accepter">Tout accepter</button>' +
      "</div>";
    document.body.appendChild(banniere);
    banniere.querySelector('[data-action="accepter"]').addEventListener("click", function () {
      definirConsentement("accepted");
    });
    banniere.querySelector('[data-action="refuser"]').addEventListener("click", function () {
      definirConsentement("declined");
    });
  }

  function ajouterLienGestion() {
    const pied = document.querySelector("footer.site");
    if (!pied || document.getElementById("gerer-cookies-lien")) return;
    const lien = document.createElement("button");
    lien.type = "button";
    lien.id = "gerer-cookies-lien";
    lien.className = "cookie-banner-lien";
    lien.textContent = "Gérer les cookies";
    pied.append(" · ");
    pied.appendChild(lien);
    lien.addEventListener("click", afficherBandeau);
  }

  window.getCookieConsent = consentementActuel;
  window.setCookieConsent = definirConsentement;
  window.reopenCookieBanner = afficherBandeau;

  document.addEventListener("DOMContentLoaded", function () {
    ajouterLienGestion();
    if (!consentementActuel()) afficherBandeau();
  });
})();
