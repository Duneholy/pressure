const API = "";

let projects = [];
let employees = [];
let tasks = [];
let ttTasks = [];
let allTasks = [];
let currentTab = "active";
let currentAppViewMode = "pressure";

const FOCUS_LS_KEY = "the_pressure_focus_task_ids_v1";
const FOCUS_WEEKDAYS_LS_KEY = "the_pressure_focus_task_weekdays_v1";

/** Пн–пт: ключи для хранения и data-атрибутов */
const FOCUS_WEEKDAYS = [
  { key: "mon", label: "пн" },
  { key: "tue", label: "вт" },
  { key: "wed", label: "ср" },
  { key: "thu", label: "чт" },
  { key: "fri", label: "пт" },
  { key: "sat", label: "сб" },
  { key: "sun", label: "вс" },
];

/** Порядок от понедельника к воскресенью; без дней — в конец списка */
const FOCUS_WEEKDAY_SORT_INDEX = Object.fromEntries(FOCUS_WEEKDAYS.map((d, i) => [d.key, i]));
const FOCUS_SORT_NO_DAYS = 99;

const state = {
  selectedProjectId: null,
  ttSelectedProjectId: null,
  ttCurrentTab: "active",
  focusTaskIds: [],
  /** taskId string -> string[] of weekday keys (mon..fri) */
  focusTaskWeekdays: {},
  waitModalTaskId: null,
  waitModalMode: "add",
  waitModalWaitId: null,
  projectModalMode: "create",
  projectModalProjectId: null,
  taskModalMode: "create",
  taskModalTaskId: null,
  confirmCallback: null,
  editingEmployeeId: null,
};

const els = {
  teamContainer: document.getElementById("teamContainer"),
  openNewEmployeeModalBtn: document.getElementById("openNewEmployeeModalBtn"),
  openNewEmployeeFromSettingsBtn: document.getElementById("openNewEmployeeFromSettingsBtn"),
  newEmployeeModal: document.getElementById("newEmployeeModal"),
  authModal: document.getElementById("authModal"),
  authUsersField: document.getElementById("authUsersField"),
  authUsernameSelect: document.getElementById("authUsernameSelect"),
  authUsernameField: document.getElementById("authUsernameField"),
  authUsername: document.getElementById("authUsername"),
  authPassword: document.getElementById("authPassword"),
  authError: document.getElementById("authError"),
  authLoginBtn: document.getElementById("authLoginBtn"),
  authRegisterBtn: document.getElementById("authRegisterBtn"),
  authDeleteBtn: document.getElementById("authDeleteBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  wallOfShame: document.getElementById("wallOfShame"),
  wallSubtitle: document.getElementById("wallSubtitle"),
  projectsList: document.getElementById("projectsList"),
  tasksContainer: document.getElementById("tasksContainer"),
  tasksSub: document.getElementById("tasksSub"),
  openTaskModalBtn: document.getElementById("openTaskModalBtn"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsEmployeeList: document.getElementById("settingsEmployeeList"),
  editEmployeeModal: document.getElementById("editEmployeeModal"),
  editEmployeeSub: document.getElementById("editEmployeeSub"),
  editEmployeeLastName: document.getElementById("editEmployeeLastName"),
  editEmployeeFirstName: document.getElementById("editEmployeeFirstName"),
  editEmployeeDepartment: document.getElementById("editEmployeeDepartment"),
  saveEmployeeBtn: document.getElementById("saveEmployeeBtn"),
  zoneWarnDays: document.getElementById("zoneWarnDays"),
  zoneCritDays: document.getElementById("zoneCritDays"),
  saveZonesBtn: document.getElementById("saveZonesBtn"),
  wallDetailsModal: document.getElementById("wallDetailsModal"),
  wallDetailsSub: document.getElementById("wallDetailsSub"),
  wallDetailsList: document.getElementById("wallDetailsList"),
  llmModal: document.getElementById("llmModal"),
  llmSub: document.getElementById("llmSub"),
  llmText: document.getElementById("llmText"),
  llmCopyBtn: document.getElementById("llmCopyBtn"),
  llmApiKey: document.getElementById("llmApiKey"),
  llmModel: document.getElementById("llmModel"),
  saveLlmBtn: document.getElementById("saveLlmBtn"),
  projectModal: document.getElementById("projectModal"),
  projectModalEyebrow: document.getElementById("projectModalEyebrow"),
  projectModalTitle: document.getElementById("projectModalTitle"),
  projectName: document.getElementById("projectName"),
  projectDescription: document.getElementById("projectDescription"),
  projectLink: document.getElementById("projectLink"),
  projectStatus: document.getElementById("projectStatus"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  deleteProjectBtn: document.getElementById("deleteProjectBtn"),
  taskModal: document.getElementById("taskModal"),
  taskModalEyebrow: document.getElementById("taskModalEyebrow"),
  taskModalTitle: document.getElementById("taskModalTitle"),
  taskTitleInput: document.getElementById("taskTitleInput"),
  taskDescriptionInput: document.getElementById("taskDescriptionInput"),
  taskLinkInput: document.getElementById("taskLinkInput"),
  taskDeadlineInput: document.getElementById("taskDeadlineInput"),
  taskOwnerInput: document.getElementById("taskOwnerInput"),
  taskStatusInput: document.getElementById("taskStatusInput"),
  saveTaskBtn: document.getElementById("saveTaskBtn"),
  waitModal: document.getElementById("waitModal"),
  waitModalEyebrow: document.getElementById("waitModalEyebrow"),
  waitModalTitle: document.getElementById("waitModalTitle"),
  waitModalTaskTitle: document.getElementById("waitModalTaskTitle"),
  waitEmployeeSelect: document.getElementById("waitEmployeeSelect"),
  waitStartedAt: document.getElementById("waitStartedAt"),
  waitComment: document.getElementById("waitComment"),
  saveWaitBtn: document.getElementById("saveWaitBtn"),
  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmBody: document.getElementById("confirmBody"),
  confirmActionBtn: document.getElementById("confirmActionBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  settingsDeleteProfileBtn: document.getElementById("settingsDeleteProfileBtn"),
  viewPressure: document.getElementById("viewPressure"),
  viewTaskTracker: document.getElementById("viewTaskTracker"),
  focusTasksContainer: document.getElementById("focusTasksContainer"),
  openFocusPickerBtn: document.getElementById("openFocusPickerBtn"),
  focusPickerModal: document.getElementById("focusPickerModal"),
  focusPickerList: document.getElementById("focusPickerList"),
  ttProjectsList: document.getElementById("ttProjectsList"),
  ttTasksContainer: document.getElementById("ttTasksContainer"),
  ttTasksSub: document.getElementById("ttTasksSub"),
  ttOpenTaskModalBtn: document.getElementById("ttOpenTaskModalBtn"),
};

document.body.addEventListener(
  "click",
  async (e) => {
    const btn = e.target.closest("button.app-main-tab[data-app-view]");
    if (!btn) return;
    const v = btn.getAttribute("data-app-view");
    if (!v || v === currentAppViewMode) return;
    e.preventDefault();
    setAppView(v);
    try {
      if (v === "task") {
        await loadAllTasks();
        ensureTtProjectSelectionWithinTab();
        renderTtProjectsList();
        setTtTabUi();
        updateTtBacklogHeader();
        await loadTtTasks();
      }
    } catch (err) {
      console.error(err);
      alert("Не удалось загрузить Task tracker: " + (err.message || String(err)));
    }
  },
  false
);

const ZONE_WARN_SEC = 3 * 86400;
const ZONE_CRIT_SEC = 10 * 86400;
let zoneWarnSec = ZONE_WARN_SEC;
let zoneCritSec = ZONE_CRIT_SEC;

const TRASH_SVG = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path>
  <path d="M10 11v6"></path>
  <path d="M14 11v6"></path>
  <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
</svg>`;

function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuration(seconds) {
  const safe = Math.max(0, seconds);
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const hhmmss = [hours, minutes, secs].map((x) => String(x).padStart(2, "0")).join(":");
  return days > 0 ? `${days}d ${hhmmss}` : hhmmss;
}

function formatRating(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function zoneClass(seconds) {
  if (seconds >= zoneCritSec) return "timer-crit";
  if (seconds >= zoneWarnSec) return "timer-warn";
  return "timer-safe";
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.detail || JSON.stringify(data);
    } catch {
      message = await res.text();
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function showAuthError(message) {
  if (!els.authError) return;
  if (!message) {
    els.authError.textContent = "";
    els.authError.classList.add("hidden");
    return;
  }
  els.authError.textContent = message;
  els.authError.classList.remove("hidden");
}

function setAuthVisible(isVisible) {
  if (!els.authModal) return;
  els.authModal.classList.toggle("hidden", !isVisible);
  els.authModal.setAttribute("aria-hidden", String(!isVisible));
  els.logoutBtn?.classList.toggle("hidden", isVisible);
  if (isVisible) {
    loadAuthUsers();
  }
}

async function loadAuthUsers() {
  try {
    const users = await api("/auth/users");
    if (els.authUsernameSelect) {
      els.authUsernameSelect.innerHTML = users.map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.username)}</option>`).join("");
      if (users.length > 0) {
        els.authUsernameSelect.value = users[0].username;
        els.authUsersField.style.display = "block";
        els.authUsernameField.style.display = "none";
      } else {
        els.authUsersField.style.display = "none";
        els.authUsernameField.style.display = "block";
      }
    }
  } catch (err) {
    console.error("Failed to load users:", err);
  }
}

async function ensureAuthenticated() {
  try {
    await api("/auth/me");
    setAuthVisible(false);
    return true;
  } catch {
    setAuthVisible(true);
    return false;
  }
}

function employeeFullName(e) {
  return `${e.last_name} ${e.first_name}`;
}

function statusPill(status) {
  return `<span class="pill pill--${status}">${status}</span>`;
}

function setActiveTabUi() {
  document.querySelectorAll(".project-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
  });
}

function visibleProjects() {
  return projects.filter((p) =>
    currentTab === "active" ? p.status === "active" : p.status === "done" || p.status === "on_hold"
  );
}

function loadFocusFromStorage() {
  try {
    const raw = localStorage.getItem(FOCUS_LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveFocusToStorage() {
  try {
    localStorage.setItem(FOCUS_LS_KEY, JSON.stringify(state.focusTaskIds));
  } catch {}
}

state.focusTaskIds = loadFocusFromStorage();

function loadFocusWeekdaysFromStorage() {
  try {
    const raw = localStorage.getItem(FOCUS_WEEKDAYS_LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const allowed = new Set(FOCUS_WEEKDAYS.map((d) => d.key));
    const out = {};
    for (const [taskId, val] of Object.entries(obj)) {
      if (!taskId) continue;
      const arr = Array.isArray(val) ? val : [];
      const uniq = [...new Set(arr.filter((k) => allowed.has(String(k))))];
      if (uniq.length) out[String(taskId)] = uniq;
    }
    return out;
  } catch {
    return {};
  }
}

function saveFocusWeekdaysToStorage() {
  try {
    localStorage.setItem(FOCUS_WEEKDAYS_LS_KEY, JSON.stringify(state.focusTaskWeekdays));
  } catch {}
}

state.focusTaskWeekdays = loadFocusWeekdaysFromStorage();

function pruneFocusWeekdayKeys() {
  const allowed = new Set(state.focusTaskIds.map(String));
  let dirty = false;
  for (const k of Object.keys(state.focusTaskWeekdays)) {
    if (!allowed.has(k)) {
      delete state.focusTaskWeekdays[k];
      dirty = true;
    }
  }
  if (dirty) saveFocusWeekdaysToStorage();
}

function removeFocusWeekdayEntry(taskId) {
  const id = String(taskId);
  if (state.focusTaskWeekdays[id]) {
    delete state.focusTaskWeekdays[id];
    saveFocusWeekdaysToStorage();
  }
}

function toggleFocusWeekday(taskId, dayKey) {
  const id = String(taskId);
  const allowed = new Set(FOCUS_WEEKDAYS.map((d) => d.key));
  if (!allowed.has(dayKey)) return;
  let arr = state.focusTaskWeekdays[id];
  if (!Array.isArray(arr)) arr = [];
  const i = arr.indexOf(dayKey);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(dayKey);
  if (arr.length) state.focusTaskWeekdays[id] = arr;
  else delete state.focusTaskWeekdays[id];
  saveFocusWeekdaysToStorage();
}

function getTaskById(taskId) {
  const id = String(taskId);
  return (
    tasks.find((t) => String(t.id) === id) ||
    ttTasks.find((t) => String(t.id) === id) ||
    allTasks.find((t) => String(t.id) === id) ||
    null
  );
}

function projectNameById(projectId) {
  return projects.find((p) => p.id === projectId)?.name || "—";
}

function visibleTtProjects() {
  return projects.filter((p) =>
    state.ttCurrentTab === "active" ? p.status === "active" : p.status === "done" || p.status === "on_hold"
  );
}

function ensureTtProjectSelectionWithinTab() {
  const filtered = visibleTtProjects();
  if (!filtered.some((p) => p.id === state.ttSelectedProjectId)) {
    state.ttSelectedProjectId = filtered[0]?.id || null;
  }
}

function setTtTabUi() {
  document.querySelectorAll(".tt-project-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tt-tab") === state.ttCurrentTab);
  });
}

function renderTtProjectsList() {
  if (!els.ttProjectsList) return;
  const filtered = visibleTtProjects();
  if (!filtered.length) {
    els.ttProjectsList.innerHTML = `<div class="empty-state">Проектов в этой вкладке нет</div>`;
    return;
  }
  els.ttProjectsList.innerHTML = filtered
    .map((p) => {
      const desc = p.description ? `<span class="project-row__desc">${escapeHtml(p.description)}</span>` : "";
      const link = p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noreferrer">↗ link</a>` : "";
      const isSelected = p.id === state.ttSelectedProjectId;
      return `
        <div class="project-row ${isSelected ? "selected" : ""}" data-tt-select-project="${p.id}">
          <div class="project-row__main">
            <span class="project-row__name">${escapeHtml(p.name)}</span>
            ${statusPill(p.status)}
            ${link}
            ${desc}
          </div>
          <div class="action-row">
            <button class="btn btn--sm" data-tt-edit-project="${p.id}">Редактировать</button>
          </div>
        </div>`;
    })
    .join("");
}

function updateTtBacklogHeader() {
  if (!els.ttTasksSub || !els.ttOpenTaskModalBtn) return;
  const project = projects.find((p) => p.id === state.ttSelectedProjectId);
  if (!project) {
    els.ttTasksSub.textContent = "Выберите проект, чтобы увидеть его задачи.";
    els.ttOpenTaskModalBtn.disabled = true;
  } else {
    els.ttTasksSub.textContent = `Без отображения ожиданий. Проект: ${project.name}.`;
    els.ttOpenTaskModalBtn.disabled = false;
  }
}

function renderTtTasks() {
  if (!els.ttTasksContainer) return;
  if (!state.ttSelectedProjectId) {
    els.ttTasksContainer.innerHTML = `<div class="empty-state">Сначала выберите проект</div>`;
    return;
  }
  if (!ttTasks.length) {
    els.ttTasksContainer.innerHTML = `<div class="empty-state">Задач нет — нажмите "+ Добавить задачу"</div>`;
    return;
  }
  els.ttTasksContainer.innerHTML = sortTasks(ttTasks).map((t) => renderTaskCard(t, { omitWaits: true })).join("");
  updateTimersOnly();
}

async function loadTtTasks() {
  if (!state.ttSelectedProjectId) {
    ttTasks = [];
    renderTtTasks();
    return;
  }
  ttTasks = await api(`/projects/${state.ttSelectedProjectId}/tasks`);
  renderTtTasks();
}

function focusTaskWeekdaySortRank(task) {
  const tid = String(task.id);
  const days = state.focusTaskWeekdays[tid] || [];
  if (!days.length) return FOCUS_SORT_NO_DAYS;
  let best = FOCUS_SORT_NO_DAYS;
  for (const d of days) {
    const idx = FOCUS_WEEKDAY_SORT_INDEX[d];
    if (idx !== undefined) best = Math.min(best, idx);
  }
  return best === FOCUS_SORT_NO_DAYS ? FOCUS_SORT_NO_DAYS : best;
}

function sortFocusTasksByWeekday(items) {
  return [...items].sort((a, b) => {
    const ra = focusTaskWeekdaySortRank(a);
    const rb = focusTaskWeekdaySortRank(b);
    if (ra !== rb) return ra - rb;
    return String(a.title || "").localeCompare(String(b.title || ""), "ru", { sensitivity: "base" });
  });
}

function pruneFocusIds() {
  const valid = new Set(allTasks.map((t) => String(t.id)));
  const next = state.focusTaskIds.filter((id) => valid.has(String(id)));
  if (next.length !== state.focusTaskIds.length) {
    state.focusTaskIds = next;
    saveFocusToStorage();
  }
  pruneFocusWeekdayKeys();
}

function renderFocusTaskCard(task) {
  const proj = projectNameById(task.project_id);
  const tid = String(task.id);
  const selected = new Set(state.focusTaskWeekdays[tid] || []);
  const linkTrim = task.link != null ? String(task.link).trim() : "";
  const linkBlock = linkTrim
    ? `<div class="focus-task-card__link"><a class="focus-task-card__link-a" href="${escapeHtml(linkTrim)}" target="_blank" rel="noreferrer">↗ Открыть ссылку задачи</a></div>`
    : `<div class="focus-task-card__link"><span class="muted">Ссылки на задачу нет</span></div>`;
  const weekdayRow = FOCUS_WEEKDAYS.map(
    ({ key, label }) => `
      <button type="button" class="focus-weekday-btn${selected.has(key) ? " focus-weekday-btn--on" : ""}"
        data-focus-weekday="${escapeHtml(key)}"
        data-focus-weekday-task="${escapeHtml(tid)}"
        aria-pressed="${selected.has(key) ? "true" : "false"}"
        title="${escapeHtml(label)}">${escapeHtml(label)}</button>`
  ).join("");
  return `
    <article class="focus-task-card" data-focus-task-id="${task.id}" tabindex="0" role="button">
      <button type="button" class="focus-task-card__remove icon-btn" data-remove-focus="${task.id}" aria-label="Убрать из фокуса" title="Убрать из фокуса">×</button>
      <div class="focus-task-card__title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="focus-task-card__desc">${escapeHtml(task.description)}</div>` : ""}
      ${linkBlock}
      <div class="focus-task-card__meta">
        <span>Проект: ${escapeHtml(proj)}</span>
      </div>
      <div class="focus-weekday-row" role="group" aria-label="Дни недели для задачи">
        ${weekdayRow}
      </div>
    </article>
  `;
}

function renderFocus() {
  if (!els.focusTasksContainer) return;
  if (!state.focusTaskIds.length) {
    els.focusTasksContainer.innerHTML = `<div class="empty-state">Добавьте задачи из общего списка — кнопка «+ Добавить в фокус»</div>`;
    return;
  }
  const items = state.focusTaskIds
    .map((id) => allTasks.find((t) => String(t.id) === String(id)))
    .filter(Boolean);
  if (!items.length) {
    els.focusTasksContainer.innerHTML = `<div class="empty-state">Задачи в фокусе устарели — добавьте актуальные</div>`;
    return;
  }
  const sorted = sortFocusTasksByWeekday(items);
  els.focusTasksContainer.innerHTML = sorted.map((t) => renderFocusTaskCard(t)).join("");
}

async function loadAllTasks() {
  try {
    allTasks = await api("/tasks");
  } catch {
    allTasks = [];
  }
  pruneFocusIds();
  renderFocus();
}

function renderFocusPickerList() {
  if (!els.focusPickerList) return;
  const inFocus = new Set(state.focusTaskIds.map(String));
  const available = allTasks.filter((t) => !inFocus.has(String(t.id)));
  if (!available.length) {
    els.focusPickerList.innerHTML = `<div class="empty-state">Нет задач для добавления (все уже в фокусе или список пуст)</div>`;
    return;
  }
  els.focusPickerList.innerHTML = available
    .map((t) => {
      const proj = projectNameById(t.project_id);
      return `
        <button type="button" class="focus-picker-row" data-add-focus-task="${t.id}">
          <div class="focus-picker-row__task">${escapeHtml(t.title)}</div>
          <div class="focus-picker-row__proj">${escapeHtml(proj)}</div>
        </button>`;
    })
    .join("");
}

function setAppView(view) {
  currentAppViewMode = view;
  els.viewPressure?.classList.toggle("hidden", view !== "pressure");
  els.viewTaskTracker?.classList.toggle("hidden", view !== "task");
  document.querySelectorAll(".app-main-tab").forEach((btn) => {
    const tabView = btn.getAttribute("data-app-view");
    const on = tabView === view;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
}

function ensureProjectSelectionWithinTab() {
  const filtered = visibleProjects();
  if (!filtered.some((p) => p.id === state.selectedProjectId)) {
    state.selectedProjectId = filtered[0]?.id || null;
  }
}

function renderProjectsList() {
  const filtered = visibleProjects();
  if (!filtered.length) {
    els.projectsList.innerHTML = `<div class="empty-state">Проектов в этой вкладке нет</div>`;
    return;
  }
  els.projectsList.innerHTML = filtered
    .map((p) => {
      const desc = p.description ? `<span class="project-row__desc">${escapeHtml(p.description)}</span>` : "";
      const link = p.link ? `<a href="${escapeHtml(p.link)}" target="_blank" rel="noreferrer">↗ link</a>` : "";
      const isSelected = p.id === state.selectedProjectId;
      return `
        <div class="project-row ${isSelected ? "selected" : ""}" data-select-project="${p.id}">
          <div class="project-row__main">
            <span class="project-row__name">${escapeHtml(p.name)}</span>
            ${statusPill(p.status)}
            ${link}
            ${desc}
          </div>
          <div class="action-row">
            <button class="btn btn--sm" data-edit-project="${p.id}">Редактировать</button>
          </div>
        </div>`;
    })
    .join("");
}

function updateBacklogHeader() {
  const project = projects.find((p) => p.id === state.selectedProjectId);
  if (!project) {
    els.tasksSub.textContent = "Выберите проект, чтобы увидеть его задачи.";
    els.openTaskModalBtn.disabled = true;
  } else {
    els.tasksSub.textContent = `Активные ожидания подсвечивают, кто блокирует прогресс. Проект: ${project.name}.`;
    els.openTaskModalBtn.disabled = false;
  }
}

function renderTaskCard(task, opts = {}) {
  const omitWaits = Boolean(opts.omitWaits);
  const waits = omitWaits ? [] : task.active_waits || [];
  const waitsHtml = waits
    .map(
      (w) => {
        const ca = w.contact_attempts || 0;
        const skullsHtml = [1, 2, 3]
          .map(
            (n) =>
              `<button class="skull-btn${ca >= n ? " skull-btn--on" : ""}" data-skull-wait="${w.id}" data-skull-n="${n}" title="Попытка связи ${n}" aria-label="Попытка ${n}">☠️</button>`
          )
          .join("");
        return `
      <div class="wait-row">
        <div class="wait-row__name">
          <strong>${escapeHtml(w.employee_name)}</strong>
          <span>${escapeHtml(w.department)}</span>
          ${w.comment ? `<span title="${escapeHtml(w.comment)}">— ${escapeHtml(w.comment)}</span>` : ""}
        </div>
        <div class="wait-row__right">
          <span class="skulls">${skullsHtml}</span>
          <span class="timer" data-started-at="${escapeHtml(w.wait_started_at)}">--:--:--</span>
          <button data-wait-generate="${w.id}" data-employee-name="${escapeHtml(w.employee_name)}" class="btn btn--sm btn--primary wait-generate-btn">Generate Pressure</button>
          <button data-wait-end="${w.id}" class="btn btn--icon btn--sm btn--success" title="Завершить" aria-label="Завершить">✅</button>
          <button data-wait-edit="${w.id}" data-task-id="${task.id}" class="btn btn--icon btn--sm" title="Редактировать" aria-label="Редактировать">✏️</button>
        </div>
      </div>
    `;
      }
    )
    .join("");

  const linkRow = task.link
    ? `<div class="task-link"><a href="${escapeHtml(task.link)}" target="_blank" rel="noreferrer">↗ Открыть ссылку задачи</a></div>`
    : "";
  const ownerAndDeadline = [];
  if (task.owner_employee_name) ownerAndDeadline.push(`Ответственный: ${escapeHtml(task.owner_employee_name)}`);
  if (task.deadline_at) ownerAndDeadline.push(`Дедлайн: ${new Date(task.deadline_at).toLocaleString()}`);
  const ownerDeadlineRow = ownerAndDeadline.length
    ? `<div class="task-meta">${ownerAndDeadline.join(" · ")}</div>`
    : "";
  const doneClass = task.status === "done" ? "task-card--done" : "";
  const waitsBlockHtml =
    !omitWaits && waits.length
      ? `
      <div class="waits-block">
        <div class="waits-block__title">
          <span>Активные ожидания</span>
          <span>${waits.length}/4</span>
        </div>
        ${waitsHtml}
      </div>`
      : "";

  const waitActions = omitWaits
    ? ""
    : `
          <button data-open-wait-modal="${task.id}" class="btn btn--sm">+ Ожидание</button>
          <button data-history="${task.id}" class="btn btn--sm">История</button>`;

  return `
    <article class="task-card ${doneClass}">
      <header class="task-top">
        <div>
          <div class="task-title-row">
            <span class="task-title">${escapeHtml(task.title)}</span>
            ${statusPill(task.status)}
          </div>
          ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ""}
          ${linkRow}
          ${ownerDeadlineRow}
        </div>
        <div class="action-row">
          <button data-edit-task="${task.id}" class="btn btn--sm">Редактировать</button>
          ${waitActions}
          <button data-delete-task="${task.id}" class="icon-btn" aria-label="Удалить задачу" title="Удалить задачу">
            ${TRASH_SVG}
          </button>
        </div>
      </header>
      ${waitsBlockHtml}
      <div data-history-box="${task.id}" class="history-box" hidden></div>
    </article>
  `;
}

function sortTasks(arr) {
  return [...arr].sort((a, b) => {
    const aDone = a.status === "done" ? 1 : 0;
    const bDone = b.status === "done" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return 0;
  });
}

function renderTasks() {
  if (!state.selectedProjectId) {
    els.tasksContainer.innerHTML = `<div class="empty-state">Сначала выберите проект</div>`;
    return;
  }
  if (!tasks.length) {
    els.tasksContainer.innerHTML = `<div class="empty-state">Задач нет — нажмите "+ Добавить задачу"</div>`;
    return;
  }
  els.tasksContainer.innerHTML = sortTasks(tasks).map(renderTaskCard).join("");
  updateTimersOnly();
}

function updateTimersOnly() {
  document.querySelectorAll(".timer[data-started-at]").forEach((el) => {
    const startedAt = new Date(el.dataset.startedAt);
    const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    el.textContent = formatDuration(seconds);
    el.classList.remove("timer-safe", "timer-warn", "timer-crit");
    el.classList.add(zoneClass(seconds));
  });
}

function fillWaitEmployeeSelect(selectedEmployeeId = null) {
  const active = employees.filter((e) => e.active);
  let list = [...active];
  if (selectedEmployeeId) {
    const cur = employees.find((e) => e.id === selectedEmployeeId);
    if (cur && !list.some((e) => e.id === cur.id)) list = [cur, ...list];
  }
  els.waitEmployeeSelect.innerHTML = list.length
    ? list
        .map(
          (e) =>
            `<option value="${e.id}">${escapeHtml(employeeFullName(e))} — ${escapeHtml(e.department)}${e.active ? "" : " (inactive)"}</option>`
        )
        .join("")
    : `<option value="">Нет сотрудников</option>`;
}

function fillTaskOwnerSelect(selectedEmployeeId = null) {
  const active = employees.filter((e) => e.active);
  const options = ['<option value="">Не назначен</option>'];
  options.push(
    ...active.map(
      (e) =>
        `<option value="${e.id}">${escapeHtml(employeeFullName(e))} — ${escapeHtml(e.department)}</option>`
    )
  );
  els.taskOwnerInput.innerHTML = options.join("");
  if (selectedEmployeeId) els.taskOwnerInput.value = selectedEmployeeId;
}

function toDatetimeLocal(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function showModal(el) {
  el.classList.remove("hidden");
}
function hideModal(el) {
  el.classList.add("hidden");
}

function openProjectModalForCreate() {
  state.projectModalMode = "create";
  state.projectModalProjectId = null;
  els.projectModalEyebrow.textContent = "// New project";
  els.projectModalTitle.textContent = "Новый проект";
  els.saveProjectBtn.textContent = "Создать проект";
  els.deleteProjectBtn.classList.add("hidden");
  els.projectName.value = "";
  els.projectDescription.value = "";
  els.projectLink.value = "";
  els.projectStatus.value = "active";
  showModal(els.projectModal);
}

function openProjectModalForEdit(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;
  state.projectModalMode = "edit";
  state.projectModalProjectId = projectId;
  els.projectModalEyebrow.textContent = "// Edit project";
  els.projectModalTitle.textContent = "Редактировать проект";
  els.saveProjectBtn.textContent = "Сохранить";
  els.deleteProjectBtn.classList.remove("hidden");
  els.projectName.value = project.name || "";
  els.projectDescription.value = project.description || "";
  els.projectLink.value = project.link || "";
  els.projectStatus.value = project.status || "active";
  showModal(els.projectModal);
}

function openTaskModalForCreate() {
  const projectId = currentAppViewMode === "task" ? state.ttSelectedProjectId : state.selectedProjectId;
  if (!projectId) return;
  state.taskModalMode = "create";
  state.taskModalTaskId = null;
  els.taskModalEyebrow.textContent = "// New task";
  els.taskModalTitle.textContent = "Новая задача";
  els.saveTaskBtn.textContent = "Создать задачу";
  els.taskTitleInput.value = "";
  els.taskDescriptionInput.value = "";
  els.taskLinkInput.value = "";
  els.taskDeadlineInput.value = "";
  fillTaskOwnerSelect();
  els.taskStatusInput.value = "open";
  showModal(els.taskModal);
}

function openTaskModalForEdit(taskId) {
  const task = getTaskById(taskId);
  if (!task) return;
  state.taskModalMode = "edit";
  state.taskModalTaskId = taskId;
  els.taskModalEyebrow.textContent = "// Edit task";
  els.taskModalTitle.textContent = "Редактировать задачу";
  els.saveTaskBtn.textContent = "Сохранить";
  els.taskTitleInput.value = task.title || "";
  els.taskDescriptionInput.value = task.description || "";
  els.taskLinkInput.value = task.link || "";
  els.taskDeadlineInput.value = task.deadline_at ? toDatetimeLocal(new Date(task.deadline_at)) : "";
  fillTaskOwnerSelect(task.owner_employee_id || null);
  els.taskStatusInput.value = task.status || "open";
  showModal(els.taskModal);
}

function openWaitModal(taskId, mode = "add", waitId = null) {
  state.waitModalTaskId = taskId;
  state.waitModalMode = mode;
  state.waitModalWaitId = waitId;
  const task = getTaskById(taskId);
  els.waitModalTaskTitle.textContent = task ? `Задача: ${task.title}` : "";
  if (mode === "edit" && waitId) {
    els.waitModalEyebrow.textContent = "// Edit wait";
    els.waitModalTitle.textContent = "Редактировать ожидание";
    els.saveWaitBtn.textContent = "Сохранить";
    const w = task?.active_waits?.find((x) => x.id === waitId);
    fillWaitEmployeeSelect(w?.employee_id);
    if (w) {
      els.waitEmployeeSelect.value = w.employee_id;
      els.waitStartedAt.value = toDatetimeLocal(new Date(w.wait_started_at));
      els.waitComment.value = w.comment || "";
    }
  } else {
    els.waitModalEyebrow.textContent = "// Assign waiter";
    els.waitModalTitle.textContent = "Выбрать сотрудника";
    els.saveWaitBtn.textContent = "Сохранить ожидание";
    fillWaitEmployeeSelect();
    els.waitStartedAt.value = toDatetimeLocal(new Date());
    els.waitComment.value = "";
  }
  showModal(els.waitModal);
}

function showConfirm({ title, body, actionLabel = "Удалить", cancelLabel = "Отмена", variant = "danger", onConfirm }) {
  els.confirmTitle.textContent = title;
  els.confirmBody.textContent = body;
  els.confirmActionBtn.textContent = actionLabel;
  if (els.confirmCancelBtn) els.confirmCancelBtn.textContent = cancelLabel;
  state.confirmCallback = onConfirm;
  els.confirmActionBtn.classList.remove("btn--danger", "btn--success", "btn--primary");
  if (variant === "success") els.confirmActionBtn.classList.add("btn--success");
  else if (variant === "primary") els.confirmActionBtn.classList.add("btn--primary");
  else els.confirmActionBtn.classList.add("btn--danger");
  showModal(els.confirmModal);
}

function hideConfirm() {
  state.confirmCallback = null;
  hideModal(els.confirmModal);
}

async function loadProjects() {
  projects = await api("/projects");
  ensureProjectSelectionWithinTab();
  renderProjectsList();
  setActiveTabUi();
  updateBacklogHeader();
  ensureTtProjectSelectionWithinTab();
  renderTtProjectsList();
  setTtTabUi();
  updateTtBacklogHeader();
}
async function loadEmployees() {
  employees = await api("/employees");
}
async function loadTasks() {
  if (!state.selectedProjectId) {
    tasks = [];
    renderTasks();
    return;
  }
  tasks = await api(`/projects/${state.selectedProjectId}/tasks`);
  renderTasks();
}

async function loadWall() {
  const rows = await api("/wall-of-shame");
  if (!rows.length) {
    els.wallOfShame.innerHTML = `<div class="empty-state">Красная зона пуста — все задачи в норме</div>`;
    return;
  }
  els.wallOfShame.innerHTML = rows
    .map(
      (r) => `
      <div class="shame-row" data-wall-employee="${r.employee_id}" data-wall-name="${escapeHtml(r.employee_name)}">
        <span class="dot dot--red" aria-hidden="true"></span>
        <span class="shame-row__name">${escapeHtml(r.employee_name)}</span>
        <span class="timer" data-started-at="${escapeHtml(r.max_delay_started_at)}">--:--:--</span>
        <span class="shame-row__count">${r.tasks_count} task${r.tasks_count === 1 ? "" : "s"}</span>
      </div>`
    )
    .join("");
  updateTimersOnly();
}

function renderTeam(grouped) {
  const depts = Object.entries(grouped || {});
  if (!depts.length) {
    els.teamContainer.innerHTML = `<div class="empty-state">Нет активных сотрудников</div>`;
    return;
  }
  els.teamContainer.innerHTML = depts
    .map(([dept, rows]) => {
      const items = rows
        .map(
          (r) => `
          <div class="team-row" data-team-employee="${r.employee_id}" data-team-name="${escapeHtml(r.employee_name)}">
            <span class="team-row__name">${escapeHtml(r.employee_name)}</span>
            <span class="team-row__meta">${escapeHtml(dept)} · Рейтинг ${formatRating(r.rating)} · ☠️ ${r.skulls_open}/${r.skulls_max || 0}</span>
          </div>
        `
        )
        .join("");
      return `
        <div class="team-dept">
          <div class="team-dept__title">${escapeHtml(dept)}</div>
          <div class="team-dept__list">${items}</div>
        </div>
      `;
    })
    .join("");
}

async function loadTeam() {
  const grouped = await api("/team");
  renderTeam(grouped);
}

async function refreshTaskViews() {
  await loadTasks();
  await loadTtTasks();
  await loadAllTasks();
}

async function refreshAfterTaskDataChange() {
  await refreshTaskViews();
  await loadWall();
  await loadTeam();
}

async function reloadAll() {
  await loadProjects();
  await loadEmployees();
  await loadTasks();
  await loadAllTasks();
  await loadTtTasks();
  await loadWall();
  await loadTeam();
}

function renderSettingsEmployeeList() {
  if (!employees.length) {
    els.settingsEmployeeList.innerHTML = `<div class="empty-state">Сотрудников нет</div>`;
    return;
  }
  els.settingsEmployeeList.innerHTML = employees
    .map(
      (e) => `
      <div class="settings-row">
        <div class="settings-row__main">
          <div class="settings-row__name">${escapeHtml(employeeFullName(e))}</div>
          <div class="settings-row__meta">${escapeHtml(e.department)} · ${e.active ? "active" : "inactive"}</div>
        </div>
        <div class="action-row">
          <button type="button" class="btn btn--sm" data-edit-employee="${e.id}">Редактировать</button>
          <button type="button" class="btn btn--sm" data-toggle-employee="${e.id}" data-current-active="${e.active}">
            ${e.active ? "Деактивировать" : "Активировать"}
          </button>
          <button type="button" class="btn btn--sm btn--danger" data-delete-employee="${e.id}">Удалить</button>
        </div>
      </div>`
    )
    .join("");
}

async function loadZones() {
  try {
    const data = await api("/settings/zones");
    const warnDays = Number(data.warn_days || 3);
    const critDays = Number(data.crit_days || 10);
    zoneWarnSec = warnDays * 86400;
    zoneCritSec = critDays * 86400;
    if (els.zoneWarnDays) els.zoneWarnDays.value = String(warnDays);
    if (els.zoneCritDays) els.zoneCritDays.value = String(critDays);
    if (els.wallSubtitle) {
      els.wallSubtitle.textContent = `Сотрудники с активными ожиданиями ≥ ${critDays} суток. Сортировка: задач → max delay.`;
    }
  } catch {
    // keep defaults
  }
}

async function loadLlmSettings() {
  if (!els.llmApiKey || !els.llmModel) return;
  try {
    const data = await api("/settings/llm");
    els.llmApiKey.value = data.api_key_set ? "********" : ""; // fake display
    els.llmApiKey.dataset.isSet = data.api_key_set ? "true" : "false";
    els.llmModel.value = data.model || "";
  } catch (err) {
    console.error("Failed to load LLM settings", err);
  }
}

document.getElementById("openProjectModalBtn")?.addEventListener("click", openProjectModalForCreate);
els.openTaskModalBtn?.addEventListener("click", openTaskModalForCreate);
els.openNewEmployeeModalBtn?.addEventListener("click", () => showModal(els.newEmployeeModal));
els.openNewEmployeeFromSettingsBtn?.addEventListener("click", () => showModal(els.newEmployeeModal));
els.openSettingsBtn?.addEventListener("click", async () => {
  await loadZones();
  await loadLlmSettings();
  await loadEmployees();
  renderSettingsEmployeeList();
  showModal(els.settingsModal);
});

els.saveZonesBtn?.addEventListener("click", async () => {
  const warnDays = Number(els.zoneWarnDays?.value || 3);
  const critDays = Number(els.zoneCritDays?.value || 10);
  try {
    const updated = await api("/settings/zones", {
      method: "PUT",
      body: JSON.stringify({ warn_days: warnDays, crit_days: critDays }),
    });
    zoneWarnSec = Number(updated.warn_days) * 86400;
    zoneCritSec = Number(updated.crit_days) * 86400;
    if (els.wallSubtitle) {
      els.wallSubtitle.textContent = `Сотрудники с активными ожиданиями ≥ ${updated.crit_days} суток. Сортировка: задач → max delay.`;
    }
    updateTimersOnly();
    await loadWall();
    await loadTeam();
  } catch (err) {
    alert("Не удалось сохранить зоны: " + err.message);
  }
});

els.saveLlmBtn?.addEventListener("click", async () => {
  const apiKeyRaw = els.llmApiKey?.value || "";
  const apiKey = apiKeyRaw === "********" ? undefined : apiKeyRaw.trim();
  const model = els.llmModel?.value?.trim() || "";
  
  const payload = {};
  if (apiKey !== undefined) payload.api_key = apiKey;
  payload.model = model;
  
  try {
    await api("/settings/llm", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    alert("Настройки LLM сохранены");
    await loadLlmSettings();
  } catch (err) {
    alert("Ошибка сохранения LLM: " + err.message);
  }
});

els.settingsDeleteProfileBtn?.addEventListener("click", () => {
  hideModal(els.settingsModal); // Hide settings modal first
  showConfirm({
    title: "Удалить профиль?",
    body: "Вы точно хотите удалить профиль? Вся база данных задач и проектов удалится.",
    actionLabel: "Да",
    cancelLabel: "Нет",
    variant: "danger",
    onConfirm: async () => {
      try {
        const res = await api("/auth/me");
        if (!res || !res.username) return;
        
        // Use a generic password prompt or direct call if password isn't strictly required here 
        // Wait, the API requires password. I will prompt the user to enter it, or just use the existing auth endpoint.
        // Actually, the API requires the password for /auth/users/{username}.
        // The user didn't mention entering a password. Let me modify the API endpoint to optionally skip password check if deleting self?
        // Wait, I will just prompt for password using JS prompt.
        const password = prompt("Введите ваш пароль для подтверждения удаления профиля:");
        if (!password) {
          hideConfirm();
          return;
        }

        await api(`/auth/users/${encodeURIComponent(res.username)}`, {
          method: "DELETE",
          body: JSON.stringify({ password }),
        });
        
        hideConfirm();
        els.logoutBtn?.click(); // Logs out and resets view
      } catch (err) {
        alert("Ошибка удаления профиля: " + err.message);
        hideConfirm();
      }
    },
  });
});

document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.close;
    if (id === "confirmModal") hideConfirm();
    else if (id) hideModal(document.getElementById(id));
  });
});

document.querySelectorAll(".project-tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    currentTab = btn.dataset.tab;
    ensureProjectSelectionWithinTab();
    setActiveTabUi();
    renderProjectsList();
    updateBacklogHeader();
    await loadTasks();
  });
});

els.saveProjectBtn?.addEventListener("click", async () => {
  const name = els.projectName.value.trim();
  if (!name) return alert("Укажите название проекта");
  const payload = {
    name,
    description: els.projectDescription.value.trim() || null,
    link: els.projectLink.value.trim() || null,
    status: els.projectStatus.value,
  };
  try {
    if (state.projectModalMode === "edit" && state.projectModalProjectId) {
      await api(`/projects/${state.projectModalProjectId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await api("/projects", { method: "POST", body: JSON.stringify(payload) });
    }
    hideModal(els.projectModal);
    await reloadAll();
  } catch (err) {
    alert("Не удалось сохранить проект: " + err.message);
  }
});

els.deleteProjectBtn?.addEventListener("click", () => {
  if (state.projectModalMode !== "edit" || !state.projectModalProjectId) return;
  const project = projects.find((p) => p.id === state.projectModalProjectId);
  showConfirm({
    title: "Удалить проект?",
    body: `Проект «${project?.name || ""}» и все его задачи и ожидания будут удалены без возможности восстановить.`,
    actionLabel: "Удалить проект",
    onConfirm: async () => {
      try {
        await api(`/projects/${state.projectModalProjectId}`, { method: "DELETE" });
        if (state.selectedProjectId === state.projectModalProjectId) state.selectedProjectId = null;
        if (state.ttSelectedProjectId === state.projectModalProjectId) state.ttSelectedProjectId = null;
        hideConfirm();
        hideModal(els.projectModal);
        await reloadAll();
      } catch (err) {
        alert("Не удалось удалить проект: " + err.message);
      }
    },
  });
});

els.saveTaskBtn?.addEventListener("click", async () => {
  const title = els.taskTitleInput.value.trim();
  if (!title) return alert("Укажите название задачи");
  const payload = {
    title,
    description: els.taskDescriptionInput.value.trim() || null,
    link: els.taskLinkInput.value.trim() || null,
    deadline_at: els.taskDeadlineInput.value ? new Date(els.taskDeadlineInput.value).toISOString() : null,
    owner_employee_id: els.taskOwnerInput.value || null,
    status: els.taskStatusInput.value,
  };
  try {
    if (state.taskModalMode === "edit" && state.taskModalTaskId) {
      await api(`/tasks/${state.taskModalTaskId}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      const projectIdForCreate = currentAppViewMode === "task" ? state.ttSelectedProjectId : state.selectedProjectId;
      await api("/tasks", { method: "POST", body: JSON.stringify({ ...payload, project_id: projectIdForCreate }) });
    }
    hideModal(els.taskModal);
    await refreshAfterTaskDataChange();
  } catch (err) {
    alert("Не удалось сохранить задачу: " + err.message);
  }
});

document.getElementById("createEmployeeInModalBtn")?.addEventListener("click", async () => {
  const last_name = document.getElementById("newEmployeeLastName").value.trim();
  const first_name = document.getElementById("newEmployeeFirstName").value.trim();
  const department = document.getElementById("newEmployeeDepartment").value.trim();
  if (!last_name || !first_name || !department) return alert("Заполните фамилию, имя и отдел");
  try {
    const employee = await api("/employees", {
      method: "POST",
      body: JSON.stringify({ last_name, first_name, department }),
    });
    await loadEmployees();
    fillWaitEmployeeSelect(employee.id);
    fillTaskOwnerSelect(employee.id);
    els.waitEmployeeSelect.value = employee.id;
    renderSettingsEmployeeList();
    hideModal(els.newEmployeeModal);
    document.getElementById("newEmployeeLastName").value = "";
    document.getElementById("newEmployeeFirstName").value = "";
    document.getElementById("newEmployeeDepartment").value = "";
  } catch (err) {
    alert("Не удалось добавить сотрудника: " + err.message);
  }
});

els.saveWaitBtn?.addEventListener("click", async () => {
  const taskId = state.waitModalTaskId;
  const employeeId = els.waitEmployeeSelect.value;
  const startedAt = els.waitStartedAt.value;
  if (!taskId || !employeeId || !startedAt) return alert("Выберите сотрудника и время");
  const comment = els.waitComment.value.trim() || null;
  try {
    if (state.waitModalMode === "edit" && state.waitModalWaitId) {
      await api(`/waits/${state.waitModalWaitId}`, {
        method: "PATCH",
        body: JSON.stringify({
          employee_id: employeeId,
          wait_started_at: new Date(startedAt).toISOString(),
          comment,
        }),
      });
    } else {
      await api(`/tasks/${taskId}/waits`, {
        method: "POST",
        body: JSON.stringify({
          employee_id: employeeId,
          wait_started_at: new Date(startedAt).toISOString(),
          comment,
        }),
      });
    }
    hideModal(els.waitModal);
    await refreshAfterTaskDataChange();
  } catch (err) {
    alert("Ошибка сохранения ожидания: " + err.message);
  }
});

els.confirmActionBtn?.addEventListener("click", async () => {
  const cb = state.confirmCallback;
  if (cb) await cb();
});

async function handleTaskListClick(e, tasksRef) {
  const editBtn = e.target.closest("[data-edit-task]");
  if (editBtn) return openTaskModalForEdit(editBtn.dataset.editTask);
  const deleteBtn = e.target.closest("[data-delete-task]");
  if (deleteBtn) {
    const taskId = deleteBtn.dataset.deleteTask;
    const task = getTaskById(taskId);
    showConfirm({
      title: "Удалить задачу?",
      body: `Задача «${task?.title || ""}» и все ее ожидания будут удалены без возможности восстановить.`,
      actionLabel: "Удалить задачу",
      onConfirm: async () => {
        try {
          await api(`/tasks/${taskId}`, { method: "DELETE" });
          hideConfirm();
          state.focusTaskIds = state.focusTaskIds.filter((x) => String(x) !== String(taskId));
          saveFocusToStorage();
          removeFocusWeekdayEntry(taskId);
          renderFocus();
          await refreshAfterTaskDataChange();
        } catch (err) {
          alert("Не удалось удалить задачу: " + err.message);
        }
      },
    });
    return;
  }
  const skullBtn = e.target.closest("[data-skull-wait]");
  if (skullBtn) {
    const waitId = skullBtn.dataset.skullWait;
    const n = parseInt(skullBtn.dataset.skullN, 10);
    const task = tasksRef.find((t) => t.active_waits && t.active_waits.some((w) => w.id === waitId));
    const wait = task?.active_waits?.find((w) => w.id === waitId);
    const current = wait?.contact_attempts || 0;
    const newCount = current >= n ? n - 1 : n;
    await api(`/waits/${waitId}`, {
      method: "PATCH",
      body: JSON.stringify({ contact_attempts: newCount }),
    });
    await refreshTaskViews();
    await loadTeam();
    return;
  }
  const openWaitBtn = e.target.closest("[data-open-wait-modal]");
  if (openWaitBtn) return openWaitModal(openWaitBtn.dataset.openWaitModal, "add");
  const waitEndBtn = e.target.closest("[data-wait-end]");
  if (waitEndBtn) {
    const waitId = waitEndBtn.dataset.waitEnd;
    const task = tasksRef.find((t) => t.active_waits?.some((w) => w.id === waitId));
    const wait = task?.active_waits?.find((w) => w.id === waitId);
    const who = wait?.employee_name ? ` (${wait.employee_name})` : "";
    showConfirm({
      title: "Завершить ожидание?",
      body: `Ожидание${who} будет завершено, таймер остановится. Это действие нельзя отменить.`,
      actionLabel: "Завершить ожидание",
      variant: "success",
      onConfirm: async () => {
        try {
          await api(`/waits/${waitId}/end`, { method: "POST", body: JSON.stringify({ end_reason: "answered" }) });
          hideConfirm();
          await refreshAfterTaskDataChange();
        } catch (err) {
          alert("Не удалось завершить ожидание: " + err.message);
        }
      },
    });
    return;
  }
  const waitEditBtn = e.target.closest("[data-wait-edit]");
  if (waitEditBtn) return openWaitModal(waitEditBtn.dataset.taskId, "edit", waitEditBtn.dataset.waitEdit);
  const waitGenerateBtn = e.target.closest("[data-wait-generate]");
  if (waitGenerateBtn) {
    const waitId = waitGenerateBtn.dataset.waitGenerate;
    const who = waitGenerateBtn.dataset.employeeName || "";
    try {
      const data = await api(`/waits/${waitId}/generate-message`, { method: "POST" });
      els.llmSub.textContent = who ? `Для: ${who}` : "";
      els.llmText.value = data.message || "";
      showModal(els.llmModal);
    } catch (err) {
      alert("Не удалось сгенерировать сообщение: " + err.message);
    }
    return;
  }
  const historyBtn = e.target.closest("[data-history]");
  if (historyBtn) {
    const taskId = historyBtn.dataset.history;
    const history = await api(`/tasks/${taskId}/wait-history`);
    const box = e.currentTarget.querySelector(`[data-history-box="${taskId}"]`);
    if (!box) return;
    if (!history.length) {
      box.textContent = "История пуста";
      box.hidden = false;
      return;
    }
    box.innerHTML = history
      .map((h) => {
        const end = h.wait_ended_at ? new Date(h.wait_ended_at).toLocaleString() : "active";
        const durationSec = h.duration_seconds ?? Math.max(0, Math.floor((Date.now() - new Date(h.wait_started_at).getTime()) / 1000));
        const cmt = h.comment ? ` — ${escapeHtml(h.comment)}` : "";
        return `- ${escapeHtml(h.employee_name)}: ${new Date(h.wait_started_at).toLocaleString()} → ${escapeHtml(end)} (${formatDuration(durationSec)})${cmt}`;
      })
      .join("<br/>");
    box.hidden = false;
  }
}

els.projectsList?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-project]");
  if (editBtn) {
    e.stopPropagation();
    openProjectModalForEdit(editBtn.dataset.editProject);
    return;
  }
  const row = e.target.closest("[data-select-project]");
  if (row) {
    state.selectedProjectId = row.dataset.selectProject;
    renderProjectsList();
    updateBacklogHeader();
    await loadTasks();
  }
});

els.tasksContainer?.addEventListener("click", (e) => handleTaskListClick(e, tasks));
els.ttTasksContainer?.addEventListener("click", (e) => handleTaskListClick(e, ttTasks));

document.getElementById("ttOpenProjectModalBtn")?.addEventListener("click", openProjectModalForCreate);
els.ttOpenTaskModalBtn?.addEventListener("click", openTaskModalForCreate);

els.ttProjectsList?.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-tt-edit-project]");
  if (editBtn) {
    e.stopPropagation();
    openProjectModalForEdit(editBtn.dataset.ttEditProject);
    return;
  }
  const row = e.target.closest("[data-tt-select-project]");
  if (row) {
    state.ttSelectedProjectId = row.dataset.ttSelectProject;
    renderTtProjectsList();
    updateTtBacklogHeader();
    await loadTtTasks();
  }
});

document.querySelectorAll(".tt-project-tab").forEach((btn) => {
  btn.addEventListener("click", async () => {
    state.ttCurrentTab = btn.getAttribute("data-tt-tab");
    ensureTtProjectSelectionWithinTab();
    setTtTabUi();
    renderTtProjectsList();
    updateTtBacklogHeader();
    await loadTtTasks();
  });
});

els.openFocusPickerBtn?.addEventListener("click", () => {
  renderFocusPickerList();
  showModal(els.focusPickerModal);
});

els.focusPickerList?.addEventListener("click", (e) => {
  const row = e.target.closest("[data-add-focus-task]");
  if (!row) return;
  const id = row.dataset.addFocusTask;
  if (state.focusTaskIds.some((x) => String(x) === String(id))) return;
  state.focusTaskIds.push(String(id));
  saveFocusToStorage();
  renderFocus();
  renderFocusPickerList();
});

els.focusTasksContainer?.addEventListener("click", (e) => {
  if (e.target.closest(".focus-task-card__link-a")) {
    e.stopPropagation();
    return;
  }
  const wd = e.target.closest("[data-focus-weekday]");
  if (wd) {
    e.stopPropagation();
    e.preventDefault();
    const day = wd.getAttribute("data-focus-weekday");
    const taskId = wd.getAttribute("data-focus-weekday-task");
    if (day && taskId) {
      toggleFocusWeekday(taskId, day);
      renderFocus();
    }
    return;
  }
  const rm = e.target.closest("[data-remove-focus]");
  if (rm) {
    e.stopPropagation();
    const id = rm.dataset.removeFocus;
    state.focusTaskIds = state.focusTaskIds.filter((x) => String(x) !== String(id));
    saveFocusToStorage();
    removeFocusWeekdayEntry(id);
    renderFocus();
    return;
  }
  const card = e.target.closest("[data-focus-task-id]");
  if (card && !e.target.closest(".focus-task-card__remove")) {
    openTaskModalForEdit(card.dataset.focusTaskId);
  }
});

els.focusTasksContainer?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.closest("[data-focus-weekday]")) return;
  const card = e.target.closest("[data-focus-task-id]");
  if (!card) return;
  e.preventDefault();
  openTaskModalForEdit(card.dataset.focusTaskId);
});

els.settingsEmployeeList?.addEventListener("click", (e) => {
  const del = e.target.closest("[data-delete-employee]");
  if (del) {
    const employeeId = del.dataset.deleteEmployee;
    const emp = employees.find((x) => x.id === employeeId);
    showConfirm({
      title: "Удалить сотрудника?",
      body: `Будет удалён «${emp ? employeeFullName(emp) : ""}» и все записи ожиданий, где он указан.`,
      actionLabel: "Удалить сотрудника",
      onConfirm: async () => {
        try {
          await api(`/employees/${employeeId}`, { method: "DELETE" });
          hideConfirm();
          await loadEmployees();
          renderSettingsEmployeeList();
          await refreshAfterTaskDataChange();
        } catch (err) {
          alert("Не удалось удалить сотрудника: " + err.message);
        }
      },
    });
    return;
  }
  const toggle = e.target.closest("[data-toggle-employee]");
  if (toggle) {
    const employeeId = toggle.dataset.toggleEmployee;
    const curActive = toggle.dataset.currentActive === "true";
    api(`/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify({ active: !curActive }) })
      .then(async () => {
        await loadEmployees();
        renderSettingsEmployeeList();
        await refreshAfterTaskDataChange();
      })
      .catch((err) => alert("Не удалось изменить статус сотрудника: " + err.message));
    return;
  }
  const editBtn = e.target.closest("[data-edit-employee]");
  if (editBtn) {
    const employeeId = editBtn.dataset.editEmployee;
    const emp = employees.find((x) => x.id === employeeId);
    if (!emp) return;
    state.editingEmployeeId = employeeId;
    els.editEmployeeSub.textContent = employeeFullName(emp);
    els.editEmployeeLastName.value = emp.last_name || "";
    els.editEmployeeFirstName.value = emp.first_name || "";
    els.editEmployeeDepartment.value = emp.department || "";
    showModal(els.editEmployeeModal);
  }
});

els.saveEmployeeBtn?.addEventListener("click", async () => {
  const employeeId = state.editingEmployeeId;
  if (!employeeId) return;
  try {
    await api(`/employees/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({
        last_name: els.editEmployeeLastName.value.trim(),
        first_name: els.editEmployeeFirstName.value.trim(),
        department: els.editEmployeeDepartment.value.trim(),
      }),
    });
    hideModal(els.editEmployeeModal);
    state.editingEmployeeId = null;
    await loadEmployees();
    renderSettingsEmployeeList();
    await refreshAfterTaskDataChange();
  } catch (err) {
    alert("Не удалось сохранить сотрудника: " + err.message);
  }
});

els.wallOfShame?.addEventListener("click", async (e) => {
  const row = e.target.closest("[data-wall-employee]");
  if (!row) return;
  const employeeId = row.dataset.wallEmployee;
  const employeeName = row.dataset.wallName;
  try {
    const details = await api(`/wall-of-shame/${employeeId}/tasks`);
    document.getElementById("wallDetailsTitle").textContent = "Задачи сотрудника в красной зоне";
    els.wallDetailsSub.textContent = employeeName;
    if (!details.length) {
      els.wallDetailsList.innerHTML = `<div class="empty-state">Нет задач в красной зоне</div>`;
    } else {
      els.wallDetailsList.innerHTML = details
        .map(
          (d) => `
          <div class="settings-row settings-row--wall">
             <div class="settings-row__main">
               <div class="settings-row__name">${escapeHtml(d.task_title)}</div>
               <div class="settings-row__meta settings-row__meta--wall">
                <span class="timer ${zoneClass(d.elapsed_seconds)}" data-started-at="${escapeHtml(d.wait_started_at)}">--:--:--</span>
                ${d.comment ? `<span class="wall-comment">${escapeHtml(d.comment)}</span>` : ""}
              </div>
             </div>
           </div>`
        )
        .join("");
      updateTimersOnly();
    }
    showModal(els.wallDetailsModal);
  } catch (err) {
    alert("Не удалось получить задачи сотрудника: " + err.message);
  }
});

els.teamContainer?.addEventListener("click", async (e) => {
  const row = e.target.closest("[data-team-employee]");
  if (!row) return;
  const employeeId = row.dataset.teamEmployee;
  const employeeName = row.dataset.teamName;
  try {
    const details = await api(`/team/${employeeId}/tasks`);
    document.getElementById("wallDetailsTitle").textContent = "Задачи сотрудника в работе";
    els.wallDetailsSub.textContent = employeeName;
    if (!details.length) {
      els.wallDetailsList.innerHTML = `<div class="empty-state">У сотрудника нет активных ожиданий</div>`;
    } else {
      const byProject = details.reduce((acc, d) => {
        const key = d.project_name || "Без проекта";
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
      }, {});
      els.wallDetailsList.innerHTML = Object.entries(byProject)
        .map(
          ([project, items]) => `
          <div class="settings-row">
            <div class="settings-row__main">
              <div class="settings-row__name">${escapeHtml(project)}</div>
              <div class="settings-row__meta">${items
                .map((d) => `- ${escapeHtml(d.task_title)}${d.comment ? ` (${escapeHtml(d.comment)})` : ""}`)
                .join("<br/>")}</div>
            </div>
          </div>`
        )
        .join("");
    }
    showModal(els.wallDetailsModal);
  } catch (err) {
    alert("Не удалось получить задачи сотрудника: " + err.message);
  }
});

document.addEventListener("click", (e) => {
  const visibleModals = [...document.querySelectorAll(".modal:not(.hidden)")];
  if (!visibleModals.length) return;
  const topModal = visibleModals[visibleModals.length - 1];
  if (topModal.id === "authModal") return; // Auth modal is unclosable this way

  if (e.target === topModal) {
    if (topModal === els.confirmModal) hideConfirm();
    else hideModal(topModal);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const visibleModals = [...document.querySelectorAll(".modal:not(.hidden)")];
    if (!visibleModals.length) return;
    const topModal = visibleModals[visibleModals.length - 1];
    if (topModal.id === "authModal") return; // Auth modal is unclosable this way

    if (topModal === els.confirmModal) hideConfirm();
    else hideModal(topModal);
  }
});

els.llmCopyBtn?.addEventListener("click", async () => {
  const text = els.llmText.value || "";
  if (!text) return;
  await navigator.clipboard.writeText(text).catch(() => {});
});

document.querySelectorAll(".auth-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.authTab;
    document.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("active", b === btn));
    
    if (tab === "login") {
      if (els.authUsernameSelect && els.authUsernameSelect.options.length > 0) {
        els.authUsersField.style.display = "block";
        els.authUsernameField.style.display = "none";
      } else {
        els.authUsersField.style.display = "none";
        els.authUsernameField.style.display = "block";
      }
      els.authLoginBtn.classList.remove("hidden");
      els.authRegisterBtn.classList.add("hidden");
      els.authDeleteBtn.classList.add("hidden");
    } else {
      els.authUsersField.style.display = "none";
      els.authUsernameField.style.display = "block";
      els.authLoginBtn.classList.add("hidden");
      els.authRegisterBtn.classList.remove("hidden");
      els.authDeleteBtn.classList.add("hidden");
    }
    showAuthError("");
  });
});

els.authLoginBtn?.addEventListener("click", async () => {
  const isSelectVisible = els.authUsersField.style.display !== "none";
  const username = isSelectVisible ? els.authUsernameSelect.value : (els.authUsername?.value || "").trim();
  const password = els.authPassword?.value || "";
  
  if (!username || !password) {
    showAuthError("Укажите логин и пароль");
    return;
  }
  showAuthError("");
  try {
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    els.authPassword.value = "";
    setAuthVisible(false);
    await loadZones();
    await loadLlmSettings();
    await reloadAll();
  } catch (err) {
    showAuthError(err.message || "Ошибка входа");
  }
});

els.authRegisterBtn?.addEventListener("click", async () => {
  const username = (els.authUsername?.value || "").trim();
  const password = els.authPassword?.value || "";
  
  if (!username || !password) {
    showAuthError("Укажите логин и пароль");
    return;
  }
  showAuthError("");
  try {
    await api("/auth/users", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    // Auto-login
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    els.authPassword.value = "";
    els.authUsername.value = "";
    setAuthVisible(false);
    await loadZones();
    await loadLlmSettings();
    await reloadAll();
  } catch (err) {
    showAuthError(err.message || "Ошибка регистрации");
  }
});

els.authDeleteBtn?.addEventListener("click", async () => {
  const isSelectVisible = els.authUsersField.style.display !== "none";
  const username = isSelectVisible ? els.authUsernameSelect.value : (els.authUsername?.value || "").trim();
  const password = els.authPassword?.value || "";
  
  if (!username || !password) {
    showAuthError("Для удаления аккаунта укажите пароль");
    return;
  }
  
  showConfirm({
    title: "Удалить пользователя?",
    body: `Аккаунт «${username}» и все его данные будут удалены навсегда. Отменить нельзя.`,
    actionLabel: "Удалить навсегда",
    onConfirm: async () => {
      try {
        await api(`/auth/users/${encodeURIComponent(username)}`, {
          method: "DELETE",
          body: JSON.stringify({ password }),
        });
        hideConfirm();
        els.authPassword.value = "";
        els.authUsername.value = "";
        showAuthError("Аккаунт удалён");
        await loadAuthUsers();
      } catch (err) {
        showAuthError(err.message || "Не удалось удалить пользователя");
        hideConfirm();
      }
    },
  });
});

els.authPassword?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (!els.authLoginBtn.classList.contains("hidden")) {
      els.authLoginBtn?.click();
    } else {
      els.authRegisterBtn?.click();
    }
  }
});

els.logoutBtn?.addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {}
  setAuthVisible(true);
  projects = [];
  employees = [];
  tasks = [];
  ttTasks = [];
  allTasks = [];
  state.selectedProjectId = null;
  state.ttSelectedProjectId = null;
  state.ttCurrentTab = "active";
  renderProjectsList();
  renderTasks();
  renderTtProjectsList();
  renderTtTasks();
  renderFocus();
  els.wallOfShame.innerHTML = `<div class="empty-state">Выполни вход для доступа к данным</div>`;
});

setInterval(updateTimersOnly, 1000);
setInterval(() => loadWall().catch(() => {}), 30000);

ensureAuthenticated().then((ok) => {
  if (!ok) return;
  loadZones().finally(() => {
    reloadAll().catch((err) => {
      alert("Ошибка загрузки: " + err.message);
    });
  });
});

// reloadAll().catch((err) => {
//   alert("Ошибка загрузки: " + err.message);
// });
