// Bulle de chat flottante — envoie chaque message au workflow n8n
// "06_chatbot_IA_site" et affiche la réponse. Zéro dépendance externe.

(function () {
  const sessionId = "sess_" + Math.random().toString(36).slice(2);
  let authUserId = null; // rempli après création de compte inline (chantier "compte obligatoire", 19/08/2026)

  function creerWidget() {
    const bulle = document.createElement("button");
    bulle.id = "chatbot-bulle";
    bulle.textContent = "💬";
    bulle.setAttribute("aria-label", "Ouvrir le chat");

    const panneau = document.createElement("div");
    panneau.id = "chatbot-panneau";
    panneau.className = "hidden";
    panneau.innerHTML = `
      <div id="chatbot-header">
        <span>Une question ? On répond 24/7</span>
        <button id="chatbot-fermer" aria-label="Fermer">✕</button>
      </div>
      <div id="chatbot-messages"></div>
      <form id="chatbot-form">
        <input type="text" id="chatbot-input" placeholder="Écrivez votre question..." autocomplete="off" required>
        <button type="submit">Envoyer</button>
      </form>
    `;

    document.body.appendChild(bulle);
    document.body.appendChild(panneau);

    ajouterMessage("assistant", "Bonjour ! Je suis là pour répondre à vos questions sur nos offres (secrétariat virtuel, création de site web). Tout se passe en ligne par défaut, mais un rendez-vous en personne reste possible sur demande. Comment puis-je vous aider ?");

    bulle.addEventListener("click", () => panneau.classList.toggle("hidden"));
    document.getElementById("chatbot-fermer").addEventListener("click", () => panneau.classList.add("hidden"));

    document.getElementById("chatbot-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("chatbot-input");
      const message = input.value.trim();
      if (!message) return;
      ajouterMessage("utilisateur", message);
      input.value = "";
      await envoyerMessage(message);
    });
  }

  // Envoie un message au workflow (utilisé par le formulaire ET après création
  // de compte inline, où le message est synthétique). N'affiche pas la bulle
  // "utilisateur" elle-même — l'appelant s'en charge quand c'est pertinent.
  async function envoyerMessage(message) {
    const idLoading = ajouterMessage("assistant", "...");
    try {
      const payload = { message, session_id: sessionId };
      if (authUserId) payload.auth_user_id = authUserId;

      const resp = await fetch(`${window.APP_CONFIG.N8N_BASE_URL}/chatbot-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      document.getElementById(idLoading).textContent = data.reponse || "Un conseiller va revenir vers vous rapidement.";

      // Compte obligatoire avant aperçu (anti-abus, 19/08/2026) : le workflow
      // demande la création d'un compte avant de continuer.
      if (data.compte_demande && !authUserId) {
        afficherFormulaireCompte();
      }
    } catch (err) {
      document.getElementById(idLoading).textContent = "Oups, une erreur est survenue. Réservez plutôt un appel gratuit via le bouton en haut de page !";
    }
  }

  // Petit formulaire de création de compte affiché directement dans le fil de
  // discussion, sans quitter le widget — le compte Supabase Auth est créé
  // côté navigateur (même mécanisme que inscription.html), puis son id est
  // transmis au workflow pour débloquer la suite (génération de démo).
  function afficherFormulaireCompte() {
    if (!window.supabaseClient) {
      ajouterMessage("assistant", "La création de compte n'est pas disponible sur cette page pour le moment — écrivez-moi votre email et un conseiller vous recontactera.");
      return;
    }
    const zone = document.getElementById("chatbot-messages");
    const conteneur = document.createElement("div");
    conteneur.className = "chatbot-msg chatbot-msg-assistant chatbot-form-compte";
    conteneur.innerHTML = `
      <div class="champ" style="margin-bottom:8px;">
        <input type="email" placeholder="Votre email" class="cbf-email" required style="width:100%;">
      </div>
      <div class="champ" style="margin-bottom:8px;">
        <input type="password" placeholder="Mot de passe (8 caractères min.)" class="cbf-password" minlength="8" required style="width:100%;">
      </div>
      <button type="button" class="btn btn-primaire cbf-submit" style="width:100%; padding:8px;">Créer mon compte</button>
      <p class="cbf-erreur" style="color:#c0392b; font-size:.8rem; margin-top:6px;"></p>
    `;
    zone.appendChild(conteneur);
    zone.scrollTop = zone.scrollHeight;

    conteneur.querySelector(".cbf-submit").addEventListener("click", async () => {
      const email = conteneur.querySelector(".cbf-email").value.trim();
      const password = conteneur.querySelector(".cbf-password").value;
      const erreurEl = conteneur.querySelector(".cbf-erreur");
      erreurEl.textContent = "";
      if (!email || password.length < 8) {
        erreurEl.textContent = "Email et mot de passe (8 caractères min.) requis.";
        return;
      }
      const boutonSubmit = conteneur.querySelector(".cbf-submit");
      boutonSubmit.disabled = true;
      boutonSubmit.textContent = "Création en cours...";

      try {
        // emailRedirectTo explicite (19-20/08/2026) : voir auth.js pour le
        // détail du bug de redirection sans ce paramètre.
        const { data, error } = await window.supabaseClient.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: "https://lbbnntest-lab.github.io/lebinomenumerique-site/confirmation-attente.html" }
        });
        if (error) throw error;
        authUserId = data.user?.id || null;
        conteneur.remove();
        ajouterMessage("utilisateur", "J'ai créé mon compte, on continue !");
        await envoyerMessage("[compte créé]");
      } catch (err) {
        boutonSubmit.disabled = false;
        boutonSubmit.textContent = "Créer mon compte";
        const dejaInscrit = /already registered|already exists|user_already_exists/i.test(err.message || "");
        erreurEl.textContent = dejaInscrit
          ? "Cet email a déjà un compte — connectez-vous via la page Connexion, puis revenez discuter ici."
          : (err.message || "Une erreur est survenue.");
      }
    });
  }

  let compteur = 0;
  function ajouterMessage(role, texte) {
    const id = "msg-" + (compteur++);
    const zone = document.getElementById("chatbot-messages");
    const bulle = document.createElement("div");
    bulle.id = id;
    bulle.className = "chatbot-msg chatbot-msg-" + role;
    bulle.textContent = texte;
    zone.appendChild(bulle);
    zone.scrollTop = zone.scrollHeight;
    return id;
  }

  // Survol d'une offre (carte tarifaire) : ouvre le chat et donne un détail
  // contextuel sur cette offre précise. Délai de 700ms avant déclenchement
  // (annulé si la souris repart avant, pour ne pas se déclencher au simple
  // passage en scrollant) et une seule fois par carte et par visite, pour
  // ne pas être envahissant.
  const cartesDejaSignalees = new WeakSet();
  function configurerSurvolOffres(panneau) {
    const cartes = document.querySelectorAll(".carte-plan[data-chatbot-detail]");
    cartes.forEach((carte) => {
      let minuteur = null;
      carte.addEventListener("mouseenter", () => {
        if (cartesDejaSignalees.has(carte)) return;
        minuteur = setTimeout(() => {
          cartesDejaSignalees.add(carte);
          panneau.classList.remove("hidden");
          const nomOffre = carte.querySelector("h3")?.textContent || "cette offre";
          ajouterMessage("assistant", `À propos de « ${nomOffre} » : ${carte.dataset.chatbotDetail}`);
        }, 700);
      });
      carte.addEventListener("mouseleave", () => {
        if (minuteur) clearTimeout(minuteur);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    creerWidget();
    configurerSurvolOffres(document.getElementById("chatbot-panneau"));
  });
})();
