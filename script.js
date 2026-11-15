/* Industrial Training editor (live sync with data/daily-reports.json) */

const STORAGE_KEY = "internship-data-v1";
const API_URL = "/api/internship-data";
const AUTO_SAVE_MS = 700;
const POLL_MS = 1500;
const INTERNSHIP_START = "2026-08-03";
const MS_PER_DAY = 86400000;

const ENTRY_PLACEHOLDER =
  "Describe daily activities and work completed in one or two sentences.";

const AUTO_GROW_MIN_PX = 72;

const autoGrowTextarea = (textarea) => {
  if (!textarea || textarea.tagName !== "TEXTAREA") return;
  textarea.style.height = "auto";
  const height = Math.max(AUTO_GROW_MIN_PX, textarea.scrollHeight);
  textarea.style.height = `${height}px`;
};

const refreshAllAutoGrowTextareas = () => {
  if (!internshipEditor) return;
  internshipEditor
    .querySelectorAll(".overview-field-surface textarea, .logbook-entry-body")
    .forEach((textarea) => autoGrowTextarea(textarea));
};

const scheduleAutoGrowTextareas = () => {
  refreshAllAutoGrowTextareas();
  requestAnimationFrame(refreshAllAutoGrowTextareas);
};

const parseISODate = (iso) => new Date(`${iso}T12:00:00`);

const ordinalDay = (day) => {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
};

const formatLogbookDate = (iso) => {
  if (!iso) return "Date not set";
  const d = parseISODate(iso);
  const month = d.toLocaleDateString("en-MY", { month: "long" });
  return `${ordinalDay(d.getDate())} ${month}, ${d.getFullYear()}`;
};

const formatWeekdayLong = (iso) => {
  if (!iso) return "";
  return parseISODate(iso).toLocaleDateString("en-MY", { weekday: "long" });
};

const MONTH_THEMES = {
  "2026-08": "Onboarding and Project Understanding",
  "2026-09": "Geospatial Development and Agent Implementation",
  "2026-10": "Costing, HLD and Workflow Integration",
  "2026-11": "Final Review",
};

const monthKeyFromISO = (iso) => (iso ? iso.slice(0, 7) : "");

const formatMonthNavLabel = (key) => {
  const d = parseISODate(`${key}-01`);
  return d.toLocaleDateString("en-MY", { month: "long" }).toUpperCase();
};

const formatMonthTitle = (key) => {
  const d = parseISODate(`${key}-01`);
  const month = d.toLocaleDateString("en-MY", { month: "long" });
  return `${month} ${d.getFullYear()}`;
};

const entryFromReport = (report) => {
  if (report.entry?.trim()) return report.entry.trim();
  const blocks = [];
  if (report.tasks?.trim()) blocks.push(report.tasks.trim());
  const addSection = (label, value) => {
    if (value?.trim()) blocks.push(`${label}\n${value.trim()}`);
  };
  addSection("Skills applied", report.skills);
  addSection("Challenges", report.challenges);
  addSection("Key learning", report.learning);
  addSection("Next working day", report.nextFocus);
  return blocks.join("\n\n");
};

const reportHasContent = (report) => Boolean(entryFromReport(report).trim());

const normalizeReport = (report) => ({
  id: report.id,
  date: report.date,
  entry: entryFromReport(report),
  ...(report.image ? { image: report.image, imageAlt: report.imageAlt || "" } : {}),
});

const updateChunkStatus = (card) => {
  const meta = card.querySelector(".daily-status-badge");
  const body = card.querySelector('[data-field="entry"]');
  if (!meta || !body) return;
  const filled = Boolean(body.value.trim());
  meta.textContent = filled ? "Recorded" : "Pending";
  meta.classList.toggle("is-recorded", filled);
};

const internOrg = document.getElementById("internOrg");
const internshipEditor = document.querySelector(".internship-editor");
const dailyReportsList = document.getElementById("dailyReportsList");
const logbookMonthNav = document.getElementById("logbookMonthNav");
const logbookMonthTitle = document.getElementById("logbookMonthTitle");
const logbookMonthTheme = document.getElementById("logbookMonthTheme");
const logbookMonthStat = document.getElementById("logbookMonthStat");
const addDailyReportBtn = document.getElementById("addDailyReport");
const saveInternshipBtn = document.getElementById("saveInternshipData");
const reloadInternshipBtn = document.getElementById("reloadInternshipData");
const saveStatus = document.getElementById("saveStatus");
const saveHint = document.getElementById("saveHint");

let internshipState = {
  overview: {},
  dailyReports: [],
};
let activeLogbookMonth = "2026-08";
let knownFileRevision = null;
let serverConnected = false;
let isDirty = false;
let saveInFlight = false;
let autoSaveTimer = null;
let isApplyingRemote = false;

const newReportId = () =>
  `day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const setSaveStatus = (message, isError = false) => {
  if (!saveStatus) return;
  saveStatus.textContent = message;
  saveStatus.classList.toggle("error", isError);
};

const showSaveHint = (message) => {
  if (!saveHint) return;
  saveHint.hidden = false;
  saveHint.textContent = message;
};

const stripMeta = (data) => ({
  overview: data.overview ?? {},
  dailyReports: (Array.isArray(data.dailyReports) ? data.dailyReports : []).map(
    normalizeReport
  ),
});

const readOverviewFromForm = () => ({
  organizationProfile: internOrg?.value.trim() ?? "",
  role: document.getElementById("internRole")?.value.trim() ?? "",
  responsibilities: document.getElementById("internResp")?.value.trim() ?? "",
  achievements: document.getElementById("internAchieve")?.value.trim() ?? "",
  skillsApplied: document.getElementById("internSkillsApplied")?.value.trim() ?? "",
  skillsGained: document.getElementById("internSkillsGained")?.value.trim() ?? "",
});

const writeOverviewToForm = (overview) => {
  const fields = [
    ["internOrg", "organizationProfile"],
    ["internRole", "role"],
    ["internResp", "responsibilities"],
    ["internAchieve", "achievements"],
    ["internSkillsApplied", "skillsApplied"],
    ["internSkillsGained", "skillsGained"],
  ];
  fields.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = overview[key] ?? "";
  });
};

const mergeDomIntoReports = (reports) => {
  if (!dailyReportsList) return reports;
  const patch = new Map();
  dailyReportsList.querySelectorAll(".daily-report-card[data-id]").forEach((card) => {
    patch.set(card.dataset.id, {
      entry: card.querySelector('[data-field="entry"]')?.value ?? "",
      date: card.querySelector('[data-field="date"]')?.value ?? "",
    });
  });
  return reports.map((report) => {
    const dom = patch.get(report.id);
    if (!dom) return report;
    return {
      id: report.id,
      date: dom.date || report.date,
      entry: dom.entry,
    };
  });
};

const readReportsFromDom = () => mergeDomIntoReports(internshipState.dailyReports);

const getMonthKeys = (reports) =>
  [...new Set(reports.map((r) => monthKeyFromISO(r.date)).filter(Boolean))].sort();

const pickDefaultMonth = (reports) => {
  const keys = getMonthKeys(reports);
  if (!keys.length) return "2026-08";
  const todayKey = monthKeyFromISO(todayISO());
  if (keys.includes(todayKey)) return todayKey;
  const withContent = reports.filter((r) => reportHasContent(r));
  if (withContent.length) {
    return monthKeyFromISO(withContent[withContent.length - 1].date);
  }
  return keys[0];
};

const renderMonthNav = (reports) => {
  if (!logbookMonthNav) return;
  const keys = getMonthKeys(reports);
  if (!keys.includes(activeLogbookMonth) && keys.length) {
    activeLogbookMonth = keys[0];
  }
  logbookMonthNav.innerHTML = keys
    .map(
      (key) =>
        `<button type="button" class="logbook-month-pill${
          key === activeLogbookMonth ? " is-active" : ""
        }" data-month="${key}">${formatMonthNavLabel(key)}</button>`
    )
    .join("");

  logbookMonthNav.querySelectorAll("[data-month]").forEach((btn) => {
    btn.addEventListener("click", () => {
      internshipState.dailyReports = mergeDomIntoReports(internshipState.dailyReports);
      activeLogbookMonth = btn.dataset.month ?? activeLogbookMonth;
      renderDailyReports(internshipState.dailyReports);
      playBorderSweep(logbookMonthNav.querySelector(".logbook-month-pill.is-active"));
    });
  });
};

const createReportCard = (report, dayNumber) => {
  const entry = entryFromReport(report);
  const dateISO = report.date || todayISO();
  const dayLabel = `Day ${dayNumber}`;

  const item = document.createElement("article");
  item.className = "logbook-timeline-item";

  item.innerHTML = `
    <div class="logbook-timeline-marker" aria-hidden="true">${escapeHtml(dayLabel)}</div>
    <details class="logbook-entry">
      <summary class="logbook-entry-head">
        <div class="logbook-entry-meta">
          <p class="logbook-entry-weekday">${escapeHtml(formatWeekdayLong(dateISO))}</p>
          <p class="logbook-entry-date">${escapeHtml(formatLogbookDate(dateISO))}</p>
        </div>
        <span class="logbook-expand" aria-hidden="true"></span>
      </summary>
      <div class="logbook-entry-content">
        <p class="logbook-activities-label">Daily activities</p>
        <p class="logbook-activities-text">${escapeHtml(entry)}</p>
        ${
          report.image
            ? `<img class="logbook-entry-photo" src="${escapeHtml(report.image)}" alt="${escapeHtml(report.imageAlt || "Daily report photo")}">`
            : ""
        }
      </div>
    </details>
  `;

  const details = item.querySelector("details");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover) {
    item.addEventListener("mouseenter", () => {
      details.open = true;
    });
    item.addEventListener("mouseleave", () => {
      details.open = false;
    });
  }

  return item;
};

const renderDailyReports = (reports) => {
  if (!dailyReportsList) return;

  renderMonthNav(reports);

  const monthReports = reports
    .filter((r) => monthKeyFromISO(r.date) === activeLogbookMonth)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (logbookMonthTitle) {
    logbookMonthTitle.textContent = activeLogbookMonth
      ? formatMonthTitle(activeLogbookMonth)
      : "Internship Daily Report";
  }

  if (logbookMonthTheme) {
    logbookMonthTheme.textContent = MONTH_THEMES[activeLogbookMonth] ?? "";
  }

  if (logbookMonthStat) {
    const monthTotal = reports.filter((r) => monthKeyFromISO(r.date) === activeLogbookMonth).length;
    logbookMonthStat.textContent =
      monthTotal > 0
        ? `${monthTotal} working ${monthTotal === 1 ? "day" : "days"} · move over a day to read the activity`
        : "No entries for this month";
  }

  dailyReportsList.innerHTML = "";
  if (!monthReports.length) {
    dailyReportsList.innerHTML =
      '<p class="logbook-empty">No daily entries for this month.</p>';
    return;
  }

  const ordered = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  const dayNumberByDate = new Map(ordered.map((report, index) => [report.date, index + 1]));

  monthReports.forEach((report) => {
    dailyReportsList.appendChild(
      createReportCard(report, dayNumberByDate.get(report.date) || 1)
    );
  });
};

const collectStateFromForm = () => ({
  overview: readOverviewFromForm(),
  dailyReports: internshipState.dailyReports,
});

const applyState = (data, { fromRemote = false } = {}) => {
  isApplyingRemote = fromRemote;
  internshipState = stripMeta(data);
  if (fromRemote || !getMonthKeys(internshipState.dailyReports).includes(activeLogbookMonth)) {
    activeLogbookMonth = pickDefaultMonth(internshipState.dailyReports);
  }
  writeOverviewToForm(internshipState.overview);
  renderDailyReports(internshipState.dailyReports);
  scheduleAutoGrowTextareas();
  isApplyingRemote = false;
  if (fromRemote) {
    isDirty = false;
  }
};

const saveToLocalStorage = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const loadFromLocalStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const scheduleAutoSave = () => {
  if (isApplyingRemote) return;
  isDirty = true;
  setSaveStatus("Editing…");
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveInternshipData({ auto: true });
  }, AUTO_SAVE_MS);
};

const loadReportFile = async () => {
  const response = await fetch("data/daily-reports.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Report file unavailable");
  return response.json();
};

const loadInternshipData = async ({ force = false } = {}) => {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("API unavailable");
    const data = await response.json();
    if (!force && isDirty) {
      setSaveStatus("You have unsaved edits — Save now or Reload to load file", true);
      return;
    }
    applyState(data, { fromRemote: true });
    knownFileRevision = data.meta?.fileRevision ?? null;
    serverConnected = true;
    saveToLocalStorage(stripMeta(data));
    showSaveHint(
      "Live sync on — browser edits auto-save to data/daily-reports.json; file edits refresh here every ~1.5 s."
    );
    setSaveStatus("Synced");
    return true;
  } catch {
    serverConnected = false;
    try {
      const data = await loadReportFile();
      applyState(data, { fromRemote: true });
      return true;
    } catch {
      const cached = loadFromLocalStorage();
      if (cached) applyState(cached, { fromRemote: true });
      return false;
    }
  }
};

const saveInternshipData = async ({ auto = false } = {}) => {
  if (saveInFlight) return;
  clearTimeout(autoSaveTimer);
  const payload = collectStateFromForm();
  internshipState = payload;
  saveToLocalStorage(payload);
  saveInFlight = true;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Save failed");
    }
    knownFileRevision = result.fileRevision ?? knownFileRevision;
    serverConnected = true;
    isDirty = false;
    setSaveStatus(auto ? "Auto-saved to file" : "Saved to file");
  } catch {
    setSaveStatus(
      auto
        ? "Auto-save failed — is server.py running?"
        : "Saved in browser only (start server.py)",
      true
    );
  } finally {
    saveInFlight = false;
  }
};

const pollFileSync = async () => {
  if (!serverConnected || saveInFlight || isApplyingRemote) return;
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const rev = data.meta?.fileRevision;
    if (rev == null || rev === knownFileRevision) return;

    if (isDirty) {
      setSaveStatus("File changed on disk — click Reload to load it", true);
      return;
    }

    applyState(data, { fromRemote: true });
    knownFileRevision = rev;
    saveToLocalStorage(stripMeta(data));
    setSaveStatus("Updated from file");
  } catch {
    serverConnected = false;
  }
};

if (internshipEditor) {
  internshipEditor.addEventListener("input", (event) => {
    if (event.target.matches(".overview-field-surface textarea")) {
      autoGrowTextarea(event.target);
    }
  });
  window.addEventListener("resize", () => scheduleAutoGrowTextareas());
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => scheduleAutoGrowTextareas());
  }
}

const initHeroMotion = () => {
  const hero = document.querySelector(".deloitte-hero");
  const stage = document.querySelector(".deloitte-hero-stage");
  if (!hero || !stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const onScroll = () => {
    const shift = Math.min(window.scrollY, 280);
    document.documentElement.style.setProperty("--scroll-shift", `${shift}px`);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
};

if (document.getElementById("dailyReportsList")) {
  initHeroMotion();
  loadInternshipData();
}

const BORDER_SWEEP_SELECTOR = ".org-fact-list p, .org-identity, .role-facts p, .overview-field-card, .intern-kpi, .logbook-entry";

const playBorderSweep = (el) => {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.querySelector(":scope > .border-runner")?.remove();
  const runner = document.createElement("span");
  runner.className = "border-runner";
  runner.setAttribute("aria-hidden", "true");
  el.appendChild(runner);
  runner.addEventListener("animationend", () => runner.remove(), { once: true });
};

if (document.body.dataset.page === "internship") {
  document.addEventListener("click", (event) => {
    const el = event.target.closest(BORDER_SWEEP_SELECTOR);
    if (!el) return;
    playBorderSweep(el);
  });
}
