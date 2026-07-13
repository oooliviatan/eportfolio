const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const navLinks = [...document.querySelectorAll(".navbar a")];

menuToggle.addEventListener("click", () => {
  const isOpen = navbar.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    navbar.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

const sections = [...document.querySelectorAll("main section[id]")];

const setActiveLink = () => {
  const scrollPosition = window.scrollY + 130;
  let currentSection = "home";

  sections.forEach((section) => {
    if (scrollPosition >= section.offsetTop) {
      currentSection = section.id;
    }
  });

  navLinks.forEach((link) => {
    link.classList.toggle(
      "active",
      link.getAttribute("href") === `#${currentSection}`
    );
  });
};

window.addEventListener("scroll", setActiveLink);
setActiveLink();

const header = document.querySelector(".site-header");
window.addEventListener("scroll", () => {
  header.classList.toggle("scrolled", window.scrollY > 40);
});

const revealElements = document.querySelectorAll(
  ".content-card, .icon-card, .timeline-card, .module-card, .document-card, .achievement-grid article, .highlight-card, .recommendation-card, .gallery-item, .poster-frame, .challenge-solution-card, .architecture-diagram, .flowchart"
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 450, easing: "ease-out", fill: "forwards" }
        );
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealElements.forEach((element) => observer.observe(element));
