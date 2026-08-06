// Charge l'embed Cal.com (page d'accueil uniquement) seulement si le
// consentement cookies a été donné, car Cal.com dépose des cookies tiers.
// Sans consentement, affiche un espace réservé avec un bouton dédié qui vaut
// acceptation pour cette seule fonctionnalité (évite de laisser un encart
// blanc vide en attendant le choix de l'utilisateur).
(function () {
  const CONTENEUR_ID = "cal-embed";

  function chargerCalCom() {
    const conteneur = document.getElementById(CONTENEUR_ID);
    if (!conteneur || conteneur.dataset.charge === "1") return;
    conteneur.dataset.charge = "1";
    conteneur.classList.remove("cal-embed-placeholder");
    conteneur.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://app.cal.com/embed/embed.js";
    script.onload = function () {
      Cal("init", { origin: "https://cal.com" });
      Cal("inline", {
        elementOrSelector: "#" + CONTENEUR_ID,
        calLink: window.APP_CONFIG.CAL_COM_LINK,
        config: { layout: "month_view" }
      });
    };
    document.body.appendChild(script);
  }

  function afficherPlaceholder() {
    const conteneur = document.getElementById(CONTENEUR_ID);
    if (!conteneur || conteneur.dataset.charge === "1") return;
    conteneur.classList.add("cal-embed-placeholder");
    conteneur.innerHTML =
      "<p>Le calendrier de prise de rendez-vous est fourni par Cal.com, qui dépose des cookies tiers.</p>" +
      '<button type="button" class="btn btn-primaire" id="cal-embed-accepter">Accepter et afficher le calendrier</button>';
    const bouton = document.getElementById("cal-embed-accepter");
    if (bouton) bouton.addEventListener("click", function () { window.setCookieConsent("accepted"); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.getCookieConsent && window.getCookieConsent() === "accepted") {
      chargerCalCom();
    } else {
      afficherPlaceholder();
    }
  });

  window.addEventListener("cookieConsentChange", function (e) {
    if (e.detail.consent === "accepted") {
      chargerCalCom();
    } else {
      const conteneur = document.getElementById(CONTENEUR_ID);
      if (conteneur && conteneur.dataset.charge !== "1") {
        conteneur.classList.add("cal-embed-placeholder");
        conteneur.innerHTML = "<p>Vous avez refusé les cookies non essentiels : le calendrier n'est pas affiché.</p>";
      }
    }
  });
})();
