function normalizeDate(date) {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function toDateKey(date) {
  const normalized = normalizeDate(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return normalizeDate(new Date(year, month - 1, day));
}

function shiftDateKey(dateKey, delta) {
  const shifted = fromDateKey(dateKey);
  shifted.setDate(shifted.getDate() + delta);
  return toDateKey(shifted);
}

function toMonthKey(date) {
  const normalized = normalizeDate(date);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}`;
}

function fromMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return normalizeDate(new Date(year, month - 1, 1));
}

function shiftMonthKey(monthKey, delta) {
  const shifted = fromMonthKey(monthKey);
  shifted.setMonth(shifted.getMonth() + delta);
  return toMonthKey(shifted);
}

const today = normalizeDate(new Date());
const todayKey = toDateKey(today);
const yesterdayKey = shiftDateKey(todayKey, -1);
const twoDaysAgoKey = shiftDateKey(todayKey, -2);

const templates = {
  hello:
    "<h1>good morning,</h1><p>daily is lil menu bar app that opens your daily markdown note.</p><p>that's pretty much it</p><p>enjoy :)</p>",
  quiet: "<h1>One quiet note</h1><p>open, write, close</p>",
  archive: "<h1>Always yours</h1><p>simple files, no lock-in</p>",
};

const initialNotes = {
  [todayKey]: templates.hello,
  [yesterdayKey]: templates.quiet,
  [twoDaysAgoKey]: templates.archive,
};

const defaultState = {
  panelOpen: true,
  activeMenu: null,
  isCalendarOpen: false,
  isPhotoCreditOpen: false,
  selectedDateKey: todayKey,
  calendarMonthKey: toMonthKey(today),
  notes: { ...initialNotes },
};

const state = {
  ...defaultState,
  notes: { ...initialNotes },
};

const panel = document.getElementById("dailyPanel");
const noteEditor = document.getElementById("noteEditor");
const panelDateTitle = document.getElementById("panelDateTitle");
const calendarPopover = document.getElementById("calendarPopover");
const calendarGrid = document.getElementById("calendarGrid");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const dateToggle = document.getElementById("dateToggle");
const dailyToggle = document.getElementById("dailyToggle");
const statusTooltip = document.getElementById("statusTooltip");
const statusTime = document.getElementById("statusTime");
const photoCreditToggle = document.getElementById("photoCreditToggle");
const photoCreditPopover = document.getElementById("photoCreditPopover");

function formatStatusTime(date) {
  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${monthDay} ${clock}`;
}

function formatHeaderDate(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(fromDateKey(dateKey));
}

function formatMonthLabel(monthKey) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(fromMonthKey(monthKey));
}

function ensureNoteExists(dateKey) {
  if (!(dateKey in state.notes)) {
    state.notes[dateKey] = "";
  }
}

function currentNoteIsEmpty() {
  return noteEditor.textContent.trim().length === 0;
}

function syncEditorEmptyState() {
  noteEditor.classList.toggle("is-empty", currentNoteIsEmpty());
}

function closeMenus() {
  state.activeMenu = null;
  document.querySelectorAll(".menu-slot.is-open").forEach((slot) => {
    slot.classList.remove("is-open");
  });
}

function openMenu(menuName) {
  closeMenus();
  state.activeMenu = menuName;
  const slot = document
    .querySelector(`[data-menu-trigger="${menuName}"]`)
    ?.closest(".menu-slot");

  if (slot) {
    slot.classList.add("is-open");
  }
}

function toggleMenu(menuName) {
  if (state.activeMenu === menuName) {
    closeMenus();
    return;
  }

  openMenu(menuName);
}

function closeCalendar() {
  state.isCalendarOpen = false;
}

function closePhotoCredit() {
  state.isPhotoCreditOpen = false;
}

function setSelectedDate(dateKey) {
  ensureNoteExists(dateKey);
  state.selectedDateKey = dateKey;
  state.calendarMonthKey = toMonthKey(fromDateKey(dateKey));
}

function applyAction(action, dataset) {
  switch (action) {
    case "toggle-panel":
      state.panelOpen = !state.panelOpen;
      if (!state.panelOpen) {
        state.isCalendarOpen = false;
      }
      break;
    case "navigate-date":
      setSelectedDate(shiftDateKey(state.selectedDateKey, Number(dataset.direction || 0)));
      state.panelOpen = true;
      break;
    case "toggle-calendar":
      state.isCalendarOpen = !state.isCalendarOpen;
      break;
    case "toggle-photo-credit":
      state.isPhotoCreditOpen = !state.isPhotoCreditOpen;
      break;
    case "navigate-month":
      state.calendarMonthKey = shiftMonthKey(state.calendarMonthKey, Number(dataset.direction || 0));
      break;
    case "select-date":
      setSelectedDate(dataset.dateKey);
      state.isCalendarOpen = false;
      state.panelOpen = true;
      break;
    default:
      break;
  }

  render();
}

function renderClock() {
  statusTime.textContent = formatStatusTime(new Date());
}

function renderCalendar() {
  const monthDate = fromMonthKey(state.calendarMonthKey);
  const startDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(startDay);
  gridStart.setDate(1 - startDay.getDay());

  calendarMonthLabel.textContent = formatMonthLabel(state.calendarMonthKey);
  calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(cellDate);
    const isCurrentMonth = cellDate.getMonth() === monthDate.getMonth();
    const hasNote = Boolean(state.notes[dateKey] && state.notes[dateKey].replace(/<[^>]+>/g, "").trim());

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.dataset.action = "select-date";
    button.dataset.dateKey = dateKey;

    if (!isCurrentMonth) {
      button.classList.add("is-outside-month");
    }

    if (dateKey === todayKey) {
      button.classList.add("is-today");
    }

    if (dateKey === state.selectedDateKey) {
      button.classList.add("is-selected");
    }

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(cellDate.getDate());
    button.appendChild(number);

    if (hasNote) {
      const dot = document.createElement("span");
      dot.className = "calendar-day-note-indicator";
      button.appendChild(dot);
    }

    calendarGrid.appendChild(button);
  }
}

function renderEditor(force = false) {
  ensureNoteExists(state.selectedDateKey);
  const nextHtml = state.notes[state.selectedDateKey];
  const needsUpdate =
    force ||
    noteEditor.dataset.noteKey !== state.selectedDateKey ||
    (document.activeElement !== noteEditor && noteEditor.innerHTML !== nextHtml);

  if (needsUpdate) {
    noteEditor.innerHTML = nextHtml;
    noteEditor.dataset.noteKey = state.selectedDateKey;
  }

  syncEditorEmptyState();
}

function render() {
  panel.classList.toggle("is-hidden", !state.panelOpen);

  dailyToggle.classList.toggle("is-active", state.panelOpen);
  statusTooltip.hidden = state.panelOpen;
  dateToggle.classList.toggle("active", state.isCalendarOpen);
  dateToggle.setAttribute("aria-expanded", String(state.isCalendarOpen));
  photoCreditToggle.setAttribute("aria-expanded", String(state.isPhotoCreditOpen));

  calendarPopover.hidden = !state.isCalendarOpen;
  photoCreditPopover.hidden = !state.isPhotoCreditOpen;

  panelDateTitle.textContent = formatHeaderDate(state.selectedDateKey);

  renderClock();
  renderCalendar();
  renderEditor();
}

noteEditor.addEventListener("input", () => {
  state.notes[state.selectedDateKey] = noteEditor.innerHTML;
  syncEditorEmptyState();
});

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const trigger = target.closest("[data-menu-trigger]");
  if (trigger) {
    if (state.isCalendarOpen) {
      closeCalendar();
    }
    if (state.isPhotoCreditOpen) {
      closePhotoCredit();
    }
    toggleMenu(trigger.dataset.menuTrigger);
    render();
    return;
  }

  const actionElement = target.closest("[data-action]");
  if (actionElement) {
    if (!actionElement.closest("#photoCredit") && state.isPhotoCreditOpen) {
      closePhotoCredit();
    }
    applyAction(actionElement.dataset.action, actionElement.dataset);

    if (!actionElement.closest("[data-menu-root]")) {
      closeMenus();
    } else {
      closeMenus();
    }
    return;
  }

  const linkElement = target.closest(".menu-entry[href]");
  if (linkElement) {
    closeMenus();
    return;
  }

  let shouldRender = false;

  if (!target.closest("[data-menu-root]") && state.activeMenu) {
    closeMenus();
    shouldRender = true;
  }

  if (!target.closest("#datePicker") && state.isCalendarOpen) {
    closeCalendar();
    shouldRender = true;
  }

  if (!target.closest("#photoCredit") && state.isPhotoCreditOpen) {
    closePhotoCredit();
    shouldRender = true;
  }

  if (shouldRender) {
    render();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenus();
    closeCalendar();
    closePhotoCredit();
    render();
  }
});

renderEditor(true);
render();
window.setInterval(renderClock, 30000);
