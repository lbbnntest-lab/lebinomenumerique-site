// Révèle en douceur (fondu + montée) les éléments marqués .au-scroll quand
// ils entrent dans le viewport. Zéro dépendance, dégrade proprement si
// IntersectionObserver n'est pas supporté (tout reste simplement visible).
(function () {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".au-scroll").forEach(function (el) { el.classList.add("visible"); });
    return;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) {
          entree.target.classList.add("visible");
          observateur.unobserve(entree.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".au-scroll").forEach(function (el) { observateur.observe(el); });
  });
})();
