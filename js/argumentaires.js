// Bibliothèque de scripts d'approche + argumentaires par offre (Module 1,
// dashboard de prospection terrain, 23/08/2026) — table templates_argumentaire
// (migration 41), lecture ouverte à tout commercial actif (RLS).
//
// La liste des offres n'est pas codée en dur : elle est chargée depuis les
// tables catalogue déjà existantes (plans_tarifaires, services_ponctuels,
// options_produit) pour rester automatiquement à jour si une offre change.

const LIBELLES_TYPE_CONTENU = {
  script_approche: "Script d'approche",
  argumentaire: "Argumentaire",
  reponse_objection: "Réponses aux objections"
};

function echapperHtml(texte) {
  const div = document.createElement("div");
  div.textContent = texte == null ? "" : String(texte);
  return div.innerHTML;
}

async function chargerCatalogueOffres() {
  const sb = window.supabaseClient;
  const [{ data: plans }, { data: services }, { data: options }] = await Promise.all([
    sb.from("plans_tarifaires").select("code,nom").eq("cible", "B2B").eq("actif", true),
    sb.from("services_ponctuels").select("code,nom").eq("actif", true),
    sb.from("options_produit").select("code,nom,produit_parent").eq("actif", true)
  ]);

  const select = document.getElementById("offre");
  const groupes = [
    { titre: "SaaS B2B", items: (plans || []).map(p => ({ code: p.code, nom: p.nom })) },
    { titre: "Sites Web", items: (services || []).map(s => ({ code: s.code, nom: s.nom })) },
    { titre: "Options", items: (options || []).map(o => ({ code: o.code, nom: o.nom })) }
  ];

  select.innerHTML = groupes.map(g => {
    if (!g.items.length) return "";
    return `<optgroup label="${g.titre}">${g.items.map(i => `<option value="${i.code}">${echapperHtml(i.nom)}</option>`).join("")}</optgroup>`;
  }).join("");

  if (select.options.length) {
    select.selectedIndex = 0;
    return select.value;
  }
  return null;
}

async function chargerArgumentaires(offreCode) {
  const conteneur = document.getElementById("contenu-argumentaires");
  if (!offreCode) {
    conteneur.innerHTML = '<p class="argumentaire-vide">Aucune offre disponible.</p>';
    return;
  }

  const { data: templates, error } = await window.supabaseClient
    .from("templates_argumentaire")
    .select("type_contenu,titre,contenu,ordre")
    .eq("offre_code", offreCode)
    .eq("actif", true)
    .order("ordre", { ascending: true });

  if (error) {
    conteneur.innerHTML = '<p class="argumentaire-vide">Impossible de charger le contenu pour le moment.</p>';
    console.error(error);
    return;
  }

  if (!templates || templates.length === 0) {
    conteneur.innerHTML = '<p class="argumentaire-vide">Aucun script ou argumentaire enregistré pour cette offre pour l\'instant.</p>';
    return;
  }

  conteneur.innerHTML = Object.keys(LIBELLES_TYPE_CONTENU).map(type => {
    const items = templates.filter(t => t.type_contenu === type);
    if (!items.length) return "";
    return `
      <div class="argumentaire-section">
        <h4>${LIBELLES_TYPE_CONTENU[type]}</h4>
        ${items.map(t => `
          <div class="argumentaire-carte">
            <h5>${echapperHtml(t.titre)}</h5>
            <p>${echapperHtml(t.contenu)}</p>
          </div>`).join("")}
      </div>`;
  }).join("");
}

async function initialiserArgumentaires() {
  const session = await requireAuth("connexion-commercial.html");
  if (!session) return;

  document.getElementById("nav-header").innerHTML =
    '<a href="dashboard-commercial.html">Tableau de bord</a> <a href="prospection-terrain.html">Mes prospects</a> <a href="#" onclick="logout()">Se déconnecter</a>';

  const offreParDefaut = await chargerCatalogueOffres();

  document.getElementById("etat-chargement").style.display = "none";
  document.getElementById("contenu-argumentaires").style.display = "block";

  await chargerArgumentaires(offreParDefaut);

  document.getElementById("offre").addEventListener("change", (e) => chargerArgumentaires(e.target.value));
}

document.addEventListener("DOMContentLoaded", initialiserArgumentaires);
