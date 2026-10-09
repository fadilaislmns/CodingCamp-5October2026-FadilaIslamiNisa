/* ============================================================
   TODO LIST LIFE DASHBOARD — app.js
   Vanilla JS only. No external libraries.
   ============================================================ */

'use strict';

/* ============================================================
   SECTION 1 — GREETING
   Handles clock, date, dynamic greeting, and editable username.
   ============================================================ */

// DOM references
const userGreetingEl = document.getElementById('user-greeting');
const userNameEl     = document.getElementById('user-name');
const currentTimeEl  = document.getElementById('current-time');
const currentDateEl  = document.getElementById('current-date');

/**
 * Returns a "Good Morning / Afternoon / Evening / Night" string
 * based on the current hour.
 */
function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return 'Good Morning,';
  if (hour >= 12 && hour < 17) return 'Good Afternoon,';
  if (hour >= 17 && hour < 21) return 'Good Evening,';
  return 'Good Night,';
}

/** Pads a number to two digits. */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Updates the clock and greeting display once. */
function updateClock() {
  const now  = new Date();
  const h    = now.getHours();
  const m    = now.getMinutes();
  const s    = now.getSeconds();

  // Time: HH:MM:SS
  currentTimeEl.textContent = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;

  // Date: full weekday, month day, year
  currentDateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });

  // Greeting
  userGreetingEl.textContent = getGreeting(h);
}

/** Loads the username from LocalStorage; falls back to "Friend". */
function loadUsername() {
  try {
    const stored = localStorage.getItem('dashboard_username');
    userNameEl.textContent = stored ? stored : 'Friend';
  } catch (e) {
    userNameEl.textContent = 'Friend';
  }
}

/** Saves the username to LocalStorage on blur. */
function saveUsername() {
  try {
    localStorage.setItem('dashboard_username', userNameEl.textContent.trim() || 'Friend');
  } catch (e) {
    // LocalStorage unavailable — continue gracefully
  }
}

/** Prevent newlines in the contenteditable name field. */
userNameEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    userNameEl.blur();
  }
});

userNameEl.addEventListener('blur', saveUsername);

// Kick off the clock
updateClock();
setInterval(updateClock, 1000);
loadUsername();


/* ============================================================
   SECTION 2 — FOCUS TIMER
   25-minute countdown with start / pause / reset controls
   and a Web Audio API beep on completion.
   ============================================================ */

// DOM references
const timerDisplayEl = document.getElementById('timer-display');
const timerRingEl    = document.getElementById('timer-ring');
const btnStart       = document.getElementById('btn-start');
const btnStop        = document.getElementById('btn-stop');
const btnReset       = document.getElementById('btn-reset');

const TIMER_TOTAL = 25 * 60; // 1500 seconds

let timerSeconds  = TIMER_TOTAL;
let timerInterval = null;   // holds the setInterval reference
let timerRunning  = false;

/** Renders the current timerSeconds value as MM:SS in #timer-display. */
function renderTimer() {
  const mins = Math.floor(timerSeconds / 60);
  const secs = timerSeconds % 60;
  timerDisplayEl.textContent = `${pad2(mins)}:${pad2(secs)}`;
}

/**
 * Plays a short beep using the Web Audio API.
 * No audio files required — uses a pure oscillator.
 */
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx  = new AudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type      = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);          // A5
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {
    // Web Audio not available — skip beep silently
  }
}

/** Called every second while the timer is running. */
function timerTick() {
  timerSeconds -= 1;
  renderTimer();

  if (timerSeconds <= 0) {
    // Timer finished
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning  = false;
    timerRingEl.classList.remove('running');
    btnStart.textContent = 'Start';

    playBeep();
    // Small delay so the alert doesn't interrupt the final render
    setTimeout(() => {
      alert('⏰ Focus session complete! Take a break.');
    }, 100);
  }
}

// Start / resume
btnStart.addEventListener('click', function () {
  if (timerRunning) return; // already running
  if (timerSeconds <= 0) return; // already done

  timerRunning = true;
  timerInterval = setInterval(timerTick, 1000);
  timerRingEl.classList.add('running');
  btnStart.textContent = 'Running…';
});

// Pause
btnStop.addEventListener('click', function () {
  if (!timerRunning) return;
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerRingEl.classList.remove('running');
  btnStart.textContent = 'Resume';
});

// Reset
btnReset.addEventListener('click', function () {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning  = false;
  timerSeconds  = TIMER_TOTAL;
  timerRingEl.classList.remove('running');
  btnStart.textContent = 'Start';
  renderTimer();
});

// Initial render
renderTimer();


/* ============================================================
   SECTION 3 — TO-DO LIST
   CRUD tasks with filter (all / active / completed), stored in
   LocalStorage under key "dashboard_todos".
   ============================================================ */

// DOM references
const todoInputEl  = document.getElementById('todo-input');
const btnAddTodo   = document.getElementById('btn-add-todo');
const todoListEl   = document.getElementById('todo-list');
const taskCountEl  = document.getElementById('task-count');
const filterTabs   = document.querySelectorAll('.filter-tab');

const LS_TODOS = 'dashboard_todos';

let todos         = [];   // array of { id, text, completed }
let currentFilter = 'all';

/** Reads todos from LocalStorage. Returns an array (never throws). */
function loadTodos() {
  try {
    const raw = localStorage.getItem(LS_TODOS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/** Persists the current todos array to LocalStorage. */
function saveTodos() {
  try {
    localStorage.setItem(LS_TODOS, JSON.stringify(todos));
  } catch (e) {
    // Fail silently
  }
}

/**
 * Renders the todo list according to the current filter.
 * Also updates the task count badge.
 */
function renderTodos() {
  // Filter tasks
  const visible = todos.filter(function (task) {
    if (currentFilter === 'active')    return !task.completed;
    if (currentFilter === 'completed') return  task.completed;
    return true; // 'all'
  });

  // Update task count (always shows active tasks, not filtered count)
  const activeCount = todos.filter(function (t) { return !t.completed; }).length;
  taskCountEl.textContent = activeCount === 1
    ? '1 task remaining'
    : `${activeCount} tasks remaining`;

  // Clear list
  todoListEl.innerHTML = '';

  // Build items
  visible.forEach(function (task) {
    const li = document.createElement('li');

    // Checkbox
    const checkbox    = document.createElement('input');
    checkbox.type     = 'checkbox';
    checkbox.checked  = task.completed;
    checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', function () {
      toggleTodo(task.id);
    });

    // Text span
    const textSpan = document.createElement('span');
    textSpan.className  = 'task-text' + (task.completed ? ' completed-text' : '');
    textSpan.textContent = task.text;

    // Edit button
    const btnEdit = document.createElement('button');
    btnEdit.type      = 'button';
    btnEdit.className = 'btn-task btn-edit';
    btnEdit.textContent = 'Edit';
    btnEdit.setAttribute('aria-label', `Edit task: ${task.text}`);
    btnEdit.addEventListener('click', function () {
      startEditTodo(li, task);
    });

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.type      = 'button';
    btnDelete.className = 'btn-task btn-delete';
    btnDelete.textContent = 'Delete';
    btnDelete.setAttribute('aria-label', `Delete task: ${task.text}`);
    btnDelete.addEventListener('click', function () {
      deleteTodo(task.id);
    });

    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(btnEdit);
    li.appendChild(btnDelete);

    todoListEl.appendChild(li);

    // Trigger fade-in animation for newly appended items
    // requestAnimationFrame ensures the class is added after paint
    requestAnimationFrame(function () {
      li.classList.add('task-enter');
    });
  });
}

/**
 * Switches a task list item into inline edit mode.
 * Replaces the text span with an input; adds a Save button.
 */
function startEditTodo(li, task) {
  // Replace text span with an input
  const oldSpan = li.querySelector('.task-text');
  const oldEdit = li.querySelector('.btn-edit');

  const editInput    = document.createElement('input');
  editInput.type     = 'text';
  editInput.value    = task.text;
  editInput.className = 'task-edit-input';
  editInput.setAttribute('aria-label', 'Edit task text');

  li.replaceChild(editInput, oldSpan);

  // Replace Edit button with Save button
  const saveBtn       = document.createElement('button');
  saveBtn.type        = 'button';
  saveBtn.className   = 'btn-task btn-save';
  saveBtn.textContent = 'Save';
  saveBtn.setAttribute('aria-label', 'Save edited task');

  li.replaceChild(saveBtn, oldEdit);
  editInput.focus();

  // Save handler
  function doSave() {
    const newText = editInput.value.trim();
    if (!newText) return; // don't allow empty
    task.text = newText;
    saveTodos();
    renderTodos();
  }

  saveBtn.addEventListener('click', doSave);
  editInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSave();
    if (e.key === 'Escape') renderTodos(); // cancel edit
  });
}

/** Adds a new task from the input field. */
function addTodo() {
  const text = todoInputEl.value.trim();
  if (!text) return;

  const task = {
    id:        Date.now(),
    text:      text,
    completed: false,
  };

  todos.push(task);
  saveTodos();
  renderTodos();
  todoInputEl.value = '';
  todoInputEl.focus();
}

/** Toggles the completed state of a task by id. */
function toggleTodo(id) {
  const task = todos.find(function (t) { return t.id === id; });
  if (task) {
    task.completed = !task.completed;
    saveTodos();
    renderTodos();
  }
}

/** Deletes a task by id. */
function deleteTodo(id) {
  todos = todos.filter(function (t) { return t.id !== id; });
  saveTodos();
  renderTodos();
}

// Event listeners
btnAddTodo.addEventListener('click', addTodo);

todoInputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addTodo();
});

filterTabs.forEach(function (tab) {
  tab.addEventListener('click', function () {
    currentFilter = tab.dataset.filter;

    // Update active tab styling and aria-selected
    filterTabs.forEach(function (t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    renderTodos();
  });
});

// Initial load
todos = loadTodos();
renderTodos();


/* ============================================================
   SECTION 4 — QUICK LINKS
   Bookmark cards stored in LocalStorage under "dashboard_links".
   Pre-populated with defaults on first load.
   ============================================================ */

// DOM references
const linksGridEl   = document.getElementById('links-grid');
const linkNameInput = document.getElementById('link-name-input');
const linkUrlInput  = document.getElementById('link-url-input');
const btnAddLink    = document.getElementById('btn-add-link');

const LS_LINKS = 'dashboard_links';

const DEFAULT_LINKS = [
  { id: 1, name: 'Google',  url: 'https://www.google.com' },
  { id: 2, name: 'YouTube', url: 'https://www.youtube.com' },
  { id: 3, name: 'GitHub',  url: 'https://www.github.com' },
];

let links = []; // array of { id, name, url }

/** Reads links from LocalStorage. Returns null if key is absent. */
function loadLinks() {
  try {
    const raw = localStorage.getItem(LS_LINKS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/** Persists the current links array to LocalStorage. */
function saveLinks() {
  try {
    localStorage.setItem(LS_LINKS, JSON.stringify(links));
  } catch (e) {
    // Fail silently
  }
}

/** Ensures URL has a protocol; prepends https:// if missing. */
function normalizeUrl(url) {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  return url;
}

/** Renders all link cards into #links-grid. */
function renderLinks() {
  linksGridEl.innerHTML = '';

  links.forEach(function (link) {
    const wrapper = document.createElement('div');
    wrapper.className = 'link-card';
    wrapper.setAttribute('role', 'listitem');

    const anchor   = document.createElement('a');
    anchor.href    = link.url;
    anchor.target  = '_blank';
    anchor.rel     = 'noopener noreferrer';
    anchor.textContent = link.name;
    anchor.title   = link.url;

    const delBtn   = document.createElement('button');
    delBtn.type    = 'button';
    delBtn.className = 'btn-delete-link';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', `Delete link: ${link.name}`);
    delBtn.addEventListener('click', function () {
      deleteLink(link.id);
    });

    wrapper.appendChild(anchor);
    wrapper.appendChild(delBtn);
    linksGridEl.appendChild(wrapper);
  });
}

/** Adds a new link from the input fields. */
function addLink() {
  const name = linkNameInput.value.trim();
  const rawUrl = linkUrlInput.value.trim();

  if (!name || !rawUrl) return;

  const url = normalizeUrl(rawUrl);

  const link = {
    id:   Date.now(),
    name: name,
    url:  url,
  };

  links.push(link);
  saveLinks();
  renderLinks();

  linkNameInput.value = '';
  linkUrlInput.value  = '';
  linkNameInput.focus();
}

/** Deletes a link by id. */
function deleteLink(id) {
  links = links.filter(function (l) { return l.id !== id; });
  saveLinks();
  renderLinks();
}

// Event listeners
btnAddLink.addEventListener('click', addLink);

linkUrlInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addLink();
});

// Initial load — use defaults if LocalStorage is empty
const storedLinks = loadLinks();
if (storedLinks !== null) {
  links = storedLinks;
} else {
  links = DEFAULT_LINKS.slice(); // shallow copy
  saveLinks();
}
renderLinks();
