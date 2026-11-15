/**
 * Shared shell: collapsible side rail + navigation (1 main topic = 1 HTML page).
 */
const NAV_PAGES = {
  home: {
    href: "index.html",
    num: "01",
    title: "Landing Page",
    subs: [
      { href: "index.html", label: "Profile snapshot" },
      { href: "index.html#portfolio-map", label: "Where to go next" },
    ],
  },
  about: {
    href: "about.html",
    num: "02",
    title: "About Me",
    subs: [
      { href: "about.html", label: "Personal statement" },
      { href: "about.html#career", label: "Resume & links" },
    ],
  },
  academic: {
    href: "academic.html",
    num: "03",
    title: "Academic Journey",
    subs: [
      { href: "academic.html#academic-journey", label: "Section overview" },
      { href: "academic.html#signature-works", label: "Supporting assignments" },
      { href: "academic.html#fyp-welcome", label: "FYP welcome" },
      { href: "academic.html#synopsis", label: "Synopsis" },
      { href: "academic.html#project", label: "Project background" },
      { href: "academic.html#progress", label: "Weekly progress" },
      { href: "academic.html#reflection", label: "Reflection" },
      { href: "academic.html#development", label: "System modules" },
      { href: "academic.html#results", label: "Results & charts" },
      { href: "academic.html#evidence", label: "Evidence" },
      { href: "academic.html#recommendations", label: "Future work" },
      { href: "academic.html#conclusion", label: "Conclusion" },
    ],
  },
  internship: {
    href: "internship.html",
    num: "04",
    title: "Deloitte · Industrial Training",
    subs: [
      { href: "internship.html", label: "Section overview" },
      { href: "internship.html#internship-overview", label: "Internship overview" },
      { href: "internship.html#internship-daily", label: "Internship Daily Report" },
      { href: "internship.html#internship-reflection", label: "Overall reflection" },
    ],
  },
};

const currentPage = () => document.body.dataset.page || "home";

const buildSidebar = () => {
  const page = currentPage();
  const groups = Object.entries(NAV_PAGES)
    .map(([key, item]) => {
      const isActive = key === page;
      const subs = item.subs
        .map(
          (sub) =>
            `<a href="${sub.href}"${isActive ? ' data-in-page="true"' : ""}>${sub.label}</a>`
        )
        .join("");
      const extraClass = key === "internship" ? " nav-group-deloitte" : "";
      return `
        <div class="nav-group${extraClass}${isActive ? " is-active is-open" : ""}" data-nav-group="${key}">
          <a class="rail-link${isActive ? " active" : ""}" href="${item.href}" title="${item.title}">
            <span class="nav-num">${item.num}</span>
          </a>
          <button type="button" class="nav-group-trigger" aria-expanded="${isActive ? "true" : "false"}">
            <span class="nav-group-label"><span class="nav-num">${item.num}</span><span class="nav-title">${item.title}</span></span>
            <span class="nav-chevron" aria-hidden="true"></span>
          </button>
          <div class="nav-sublist">${subs}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="nav-rail-wrapper" id="navRailWrapper">
      <aside class="site-sidebar" id="siteSidebar" aria-label="Portfolio navigation">
        <a class="sidebar-brand" href="index.html">
          <img class="brand-mark" src="assets/profile.jpg" alt="Tan Qian Han" width="42" height="42" decoding="async" />
          <span class="sidebar-brand-text">
            <strong>Tan Qian Han</strong>
            <small>Industrial Training · UUM</small>
          </span>
        </a>
        <p class="sidebar-rubric">SQQXK4966 E-Portfolio</p>
        <nav class="sidebar-nav" id="sidebarNav">${groups}</nav>
      </aside>
    </div>
    <div class="sidebar-backdrop" id="sidebarBackdrop" hidden></div>`;
};

const initLayout = () => {
  const shell = document.getElementById("appShell");
  if (!shell) return;

  shell.insertAdjacentHTML("afterbegin", buildSidebar());

  const menuToggle = document.getElementById("menuToggle");
  const siteSidebar = document.getElementById("siteSidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const navRailWrapper = document.getElementById("navRailWrapper");
  const navGroups = [...document.querySelectorAll(".nav-group")];

  let collapseTimer = null;

  const openNavGroup = (group) => {
    navGroups.forEach((g) => {
      g.classList.remove("is-open");
      g.querySelector(".nav-group-trigger")?.setAttribute("aria-expanded", "false");
    });
    group.classList.add("is-open");
    group.querySelector(".nav-group-trigger")?.setAttribute("aria-expanded", "true");
  };

  const restoreActiveGroup = () => {
    navGroups.forEach((g) => {
      g.classList.remove("is-open");
      g.querySelector(".nav-group-trigger")?.setAttribute("aria-expanded", "false");
    });
    const active = navGroups.find((g) => g.classList.contains("is-active"));
    if (active) openNavGroup(active);
  };

  const setExpanded = (on) => {
    clearTimeout(collapseTimer);
    if (on) {
      shell.classList.add("nav-expanded");
      siteSidebar?.classList.add("is-expanded");
      navRailWrapper?.classList.add("is-expanded");
      return;
    }
    collapseTimer = setTimeout(() => {
      shell.classList.remove("nav-expanded");
      siteSidebar?.classList.remove("is-expanded");
      navRailWrapper?.classList.remove("is-expanded");
      restoreActiveGroup();
    }, 150);
  };

  const closeMobileSidebar = () => {
    siteSidebar?.classList.remove("open");
    sidebarBackdrop?.setAttribute("hidden", "");
    menuToggle?.setAttribute("aria-expanded", "false");
  };

  menuToggle?.addEventListener("click", () => {
    const open = !siteSidebar?.classList.contains("open");
    siteSidebar?.classList.toggle("open", open);
    if (open) sidebarBackdrop?.removeAttribute("hidden");
    else sidebarBackdrop?.setAttribute("hidden", "");
    menuToggle?.setAttribute("aria-expanded", String(open));
  });

  sidebarBackdrop?.addEventListener("click", closeMobileSidebar);

  navRailWrapper?.addEventListener("mouseenter", () => {
    setExpanded(true);
    if (!navGroups.some((g) => g.classList.contains("is-open"))) {
      restoreActiveGroup();
    }
  });

  navRailWrapper?.addEventListener("mouseleave", () => {
    setExpanded(false);
  });

  navGroups.forEach((group) => {
    const trigger = group.querySelector(".nav-group-trigger");
    const rail = group.querySelector(".rail-link");

    const onGroupEnter = () => {
      setExpanded(true);
      openNavGroup(group);
    };

    group.addEventListener("mouseenter", onGroupEnter);
    rail?.addEventListener("focus", onGroupEnter);

    trigger?.addEventListener("click", (event) => {
      event.preventDefault();
      setExpanded(true);
      openNavGroup(group);
    });
  });

  [...document.querySelectorAll(".nav-sublist a")].forEach((link) =>
    link.addEventListener("click", closeMobileSidebar)
  );

  restoreActiveGroup();

  if (document.body.dataset.page === "academic" || document.body.dataset.page === "internship") {
    initInPageScrollSpy();
  }
};

const initInPageScrollSpy = () => {
  const targets = [
    ...document.querySelectorAll("main section[id], main .nav-anchor[id], main header[id]"),
  ];
  if (!targets.length) return;

  const highlight = () => {
    const y = window.scrollY + 100;
    let currentId = targets[0].id;
    targets.forEach((el) => {
      if (y >= el.offsetTop - 8) currentId = el.id;
    });
    document.querySelectorAll(".nav-sublist a[data-in-page]").forEach((link) => {
      const hash = link.getAttribute("href")?.split("#")[1];
      link.classList.toggle("active", hash === currentId);
    });
  };

  window.addEventListener("scroll", highlight);
  highlight();
};

document.addEventListener("DOMContentLoaded", initLayout);
