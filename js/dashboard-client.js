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
    .select("statut")
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

  document.getElementById("stat-statut").textContent = compte?.statut || "—";
  document.getElementById("stat-plan").textContent = listeAbonnements.length
    ? listeAbonnements.map(a => a.plans_tarifaires?.nom).filter(Boolean).join(" + ")
    : "Aucun";

  const tbodyAbonnements = document.getElementById("tbody-abonnements");
  tbodyAbonnements.innerHTML = listeAbonnements.length
    ? listeAbonnements.map(a => `
        <tr>
          <td>${a.plans_tarifaires?.nom || "—"}</td>
          <td>${a.cycle_facturation === "annuel" ? "Annuel" : "Mensuel"}</td>
          <td><span class="badge badge-actif">${a.statut}</span></td>
        </tr>`).join("")
    : `<tr><td colspan="3">Aucun abonnement actif pour le moment.</td></tr>`;

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
      .select("nom, prenom, email, role")
      .eq("compte_client_id", utilisateur.compte_client_id);

    const membres = equipe || [];
    document.getElementById("texte-sieges").textContent =
      `${membres.length} / ${limiteSieges} utilisateur${limiteSieges > 1 ? "s" : ""} inclus dans votre plan`;

    document.getElementById("tbody-equipe").innerHTML = membres.length
      ? membres.map(m => `
          <tr>
            <td>${m.prenom || ""} ${m.nom || ""}</td>
            <td>${m.email}</td>
            <td>${libelleRole[m.role] || m.role}</td>
          </tr>`).join("")
      : `<tr><td colspan="3">Aucun utilisateur.</td></tr>`;

    return membres.length;
  }

  const nbMembres = await chargerEquipe();

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
