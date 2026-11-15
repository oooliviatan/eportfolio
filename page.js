const revealElements = document.querySelectorAll(
  ".content-card, .icon-card, .timeline-card, .module-card, .document-card, .achievement-grid article, .highlight-card, .recommendation-card, .gallery-item, .poster-frame, .challenge-solution-card, .architecture-diagram, .flowchart, .results-figure, .overview-panel, .overview-field-card, .daily-log-panel, .logbook-entry, .profile-card, .dashboard-card--showcase, .preview-chip"
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" },
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
