/* Focusflow: a private, browser-first student planner. Data is stored locally. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STORAGE_KEY = 'focusflow-v1';
const stripTime = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const today = stripTime(new Date());
const dateKey = (date) => {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const addDays = (date, amount) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const formatDate = (date, options = { weekday: 'long', month: 'long', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', options).format(typeof date === 'string' ? new Date(`${date}T12:00:00`) : date);
const formatMonth = (date) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
const minutes = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const timeLabel = (value) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(`2026-01-01T${value}`));
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sampleState = {
  profile: { name: 'Aarav', email: '' },
  settings: { reminders: true, rollover: true },
  tasks: [
    { id: 'task-1', title: 'Review biology flashcards', date: dateKey(today), start: '08:30', end: '09:00', energy: 'easy', reminder: '5', goal: 'Semester sprint', notes: 'Start with the red deck.', status: 'done', notified: false },
    { id: 'task-2', title: 'Finish calculus problem set', date: dateKey(today), start: '11:00', end: '12:15', energy: 'deep', reminder: '10', goal: 'Semester sprint', notes: 'Do questions 7–12. No perfectionism.', status: 'pending', notified: false },
    { id: 'task-3', title: 'Send portfolio draft to Maya', date: dateKey(today), start: '16:30', end: '16:45', energy: 'focus', reminder: '5', goal: 'Build my portfolio', notes: 'Attach the new case study PDF.', status: 'pending', notified: false },
    { id: 'task-4', title: 'Ten-minute room reset', date: dateKey(today), start: '20:30', end: '20:40', energy: 'easy', reminder: '0', goal: 'Daily life', notes: 'Put on one playlist. Stop at ten.', status: 'pending', notified: false },
    { id: 'task-5', title: 'Sketch essay outline', date: dateKey(addDays(today, 1)), start: '09:00', end: '09:35', energy: 'focus', reminder: '5', goal: 'Semester sprint', notes: 'Three claims, then done.', status: 'pending', notified: false },
    { id: 'task-6', title: 'Evening walk', date: dateKey(addDays(today, 1)), start: '18:00', end: '18:25', energy: 'easy', reminder: '0', goal: 'Health & energy', notes: '', status: 'pending', notified: false }
  ],
  goals: [
    { id: 'goal-1', title: 'Show up for finals with a clear head', type: 'long-term', date: dateKey(addDays(today, 94)), why: 'I want to feel proud of steady effort, not rescue missions.', progress: 32 },
    { id: 'goal-2', title: 'Build my design portfolio', type: 'short-term', date: dateKey(addDays(today, 45)), why: 'Two thoughtful case studies are better than twelve half-finished ones.', progress: 48 },
    { id: 'goal-3', title: 'Complete this week’s study blocks', type: 'weekly', date: dateKey(addDays(today, 5)), why: 'Tiny reps make the big work less scary.', progress: 60 },
    { id: 'goal-4', title: 'Finish the one hard thing before lunch', type: 'daily', date: dateKey(today), why: 'A kinder way to stop the scroll-and-stress loop.', progress: 40 }
  ],
  inbox: ['Find two references for history essay', 'Book dentist appointment']
};

let state = loadState();
let activePage = location.hash.replace('#', '') || 'today';
let selectedDate = dateKey(today);
let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
let reminderTimers = [];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.tasks ? saved : structuredClone(sampleState);
  } catch { return structuredClone(sampleState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getTasks(date = null) {
  return state.tasks.filter((task) => !date || task.date === date).sort((a, b) => a.start.localeCompare(b.start));
}
function selectedTasks() { return getTasks(selectedDate); }
function pageTitle() { return activePage.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '); }
function taskDuration(task) { return Math.max(0, minutes(task.end) - minutes(task.start)); }
function tasksDone(tasks) { return tasks.filter(t => t.status === 'done').length; }

function render() {
  migrateOverdueTasks();
  $('#pageRoot').innerHTML = activePage === 'today' ? renderToday()
    : activePage === 'calendar' ? renderCalendar()
    : activePage === 'inbox' ? renderInbox()
    : activePage === 'settings' ? renderSettings()
    : renderGoals(activePage);
  $$('.nav-link[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === activePage));
  $('#profileName').textContent = state.profile.name || 'You';
  $('#inboxCount').textContent = state.inbox.length;
  bindPageEvents();
  scheduleReminders();
}

function renderToday() {
  const tasks = getTasks(dateKey(today));
  const done = tasksDone(tasks);
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const now = new Date();
  const current = tasks.find(t => t.status !== 'done' && minutes(t.start) >= (now.getHours() * 60 + now.getMinutes())) || tasks.find(t => t.status !== 'done');
  return `
    <div class="page-top">
      <div><p class="eyebrow">${formatDate(today, { weekday: 'long' }).toUpperCase()} FLOW</p><h1 class="page-title">Good ${getGreeting()}, ${escapeHtml(state.profile.name || 'there')}.</h1><p class="page-subtitle">One honest plan. One less thing to carry in your head.</p></div>
      <div class="date-pill"><span>◷</span> ${formatDate(today, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </div>
    <div class="today-layout">
      <div>
        <section class="surface today-panel">
          <div class="section-heading"><h2>Today’s promises</h2><span>${done} of ${tasks.length} complete</span></div>
          <div class="progress-track"><span style="width:${percent}%"></span></div>
          <ul class="task-list">${tasks.length ? tasks.map(renderTask).join('') : `<li class="empty-tasks"><strong>Your day is delightfully open.</strong>Add one worthwhile task when you’re ready.</li>`}</ul>
          <button class="add-inline" data-action="add-task" data-date="${dateKey(today)}"><span>+</span> Add a promise to today</button>
        </section>
        <section class="surface tomorrow-strip">
          <span class="tomorrow-icon">↗</span>
          <div><h3>Tomorrow starts tonight.</h3><p>${getTasks(dateKey(addDays(today, 1))).length ? `${getTasks(dateKey(addDays(today, 1))).length} gentle plan${getTasks(dateKey(addDays(today, 1))).length === 1 ? '' : 's'} waiting for you.` : 'Give future-you a tiny head start.'}</p></div>
          <button class="secondary-button" data-action="plan-tomorrow">Plan it <span>→</span></button>
        </section>
      </div>
      <aside class="side-stack">
        <section class="surface focus-card">
          <div class="card-kicker">UP NEXT ${current ? `· ${timeLabel(current.start)}` : ''}</div>
          <h2>${current ? escapeHtml(current.title) : 'You’ve earned a little quiet.'}</h2>
          <p>${current ? (escapeHtml(current.notes) || 'No notes. Keep it simple: start before you feel perfectly ready.') : 'Every promise checked off. Let the day breathe.'}</p>
          ${current ? `<button data-action="start-task" data-id="${current.id}">${current.status === 'started' ? 'In progress · stay with it' : 'Start this now →'}</button>` : ''}
        </section>
        <section class="surface streak-card">
          <p class="mini-heading">YOUR STEADY STREAK</p><div class="streak-line"><strong class="streak-number">4</strong><span>days of showing up</span></div>
          <div class="week-dots">${['M','T','W','T','F','S','S'].map((d,i) => `<div class="weekday ${i < 4 ? 'done' : i === 4 ? 'today' : ''}"><i>${i < 4 ? '✓' : d}</i>${d}</div>`).join('')}</div>
        </section>
        <section class="surface tip-card"><p class="mini-heading">THE 2-MINUTE TRICK</p><h3>Make starting laughably easy.</h3><p>Tell yourself you only need to open the document. Momentum can handle the rest.</p></section>
      </aside>
    </div>`;
}

function renderTask(task) {
  const isDone = task.status === 'done';
  return `<li class="task-item ${isDone ? 'done' : ''}" data-task-row="${task.id}">
    <button class="check ${isDone ? 'completed' : ''}" data-action="complete-task" data-id="${task.id}" aria-label="${isDone ? 'Mark incomplete' : 'Mark complete'}">${isDone ? '✓' : ''}</button>
    <span class="task-time">${timeLabel(task.start)}<br>${timeLabel(task.end)}</span>
    <span class="task-name"><b>${escapeHtml(task.title)}</b><small>${task.status === 'started' ? '● In progress' : escapeHtml(task.notes || task.goal)}</small></span>
    <span class="task-actions"><i class="energy-dot energy-${task.energy}" title="${task.energy} energy"></i>${task.status === 'started' ? `<button class="finish-button" data-action="complete-task" data-id="${task.id}">Finish</button>` : `<span class="goal-tag">${escapeHtml(task.goal)}</span>`}<button class="more-button" data-action="edit-task" data-id="${task.id}" aria-label="Edit task">···</button></span>
  </li>`;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear(); const month = calendarCursor.getMonth();
  const first = new Date(year, month, 1); const gridStart = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const taskCount = getTasks(selectedDate).length;
  return `<div class="page-top"><div><p class="eyebrow">MAKE TIME VISIBLE</p><h1 class="page-title">Your calendar</h1><p class="page-subtitle">Click a day. Give it a purpose. Leave some room to breathe.</p></div><button class="primary-button" data-action="add-task" data-date="${selectedDate}">+ Add a task</button></div>
    <div class="calendar-layout"><section class="surface calendar-panel"><div class="calendar-toolbar"><div class="month-control"><button class="icon-button" data-action="prev-month" aria-label="Previous month">‹</button><h2>${formatMonth(calendarCursor)}</h2><button class="icon-button" data-action="next-month" aria-label="Next month">›</button></div><button class="secondary-button" data-action="go-today">Today</button></div><div class="calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div>${d}</div>`).join('')}</div><div class="calendar-grid">${days.map(d => renderCalendarDay(d, month)).join('')}</div></section>
    <aside class="surface day-detail"><p class="eyebrow">DAY VIEW</p><h2>${formatDate(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })}</h2><p>${taskCount ? `${taskCount} task${taskCount === 1 ? '' : 's'} planned. Future-you approves.` : 'Nothing scheduled. That can be intentional.'}</p><ul class="task-list">${selectedTasks().map(renderTask).join('') || `<li class="empty-tasks"><strong>Space to think.</strong>Put one kind, clear task here.</li>`}</ul><button class="add-inline" data-action="add-task" data-date="${selectedDate}"><span>+</span> Add task</button></aside></div>`;
}
function renderCalendarDay(date, viewedMonth) {
  const key = dateKey(date); const tasks = getTasks(key); const isToday = key === dateKey(today); const selected = key === selectedDate;
  return `<button class="calendar-day ${date.getMonth() !== viewedMonth ? 'muted' : ''} ${selected ? 'selected' : ''} ${tasks.length ? 'has-tasks' : ''}" data-action="select-date" data-date="${key}"><span class="day-number ${isToday ? 'today-number' : ''}">${date.getDate()}</span><span class="day-tasks">${tasks.slice(0, 2).map(t => `<span class="mini-task ${t.energy}">${escapeHtml(t.title)}</span>`).join('')}${tasks.length > 2 ? `<span class="more-tasks">+${tasks.length - 2} more</span>` : ''}</span></button>`;
}

function renderGoals(type) {
  const labels = { daily: ['Daily goals', 'THE NEXT 24 HOURS', 'The right daily goal is small enough to start and meaningful enough to matter.'], weekly: ['Weekly goals', 'THE WEEK, WITH A LITTLE SHAPE', 'Choose a few wins—not a heroic to-do list. The point is direction, not flawless execution.'], 'short-term': ['Short-term goals', 'YOUR NEXT SEASON', 'Turn the next few weeks into small promises you can actually keep.'], 'long-term': ['Long-term vision', 'THE BIGGER WHY', 'This is your north star, not a deadline-shaped stick. Let it guide the smaller choices.'] };
  const [title, eyebrow, description] = labels[type] || labels.daily;
  const goals = state.goals.filter(goal => goal.type === type);
  return `<div class="page-top"><div><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1><p class="page-subtitle">${description}</p></div><button class="primary-button" data-action="add-goal" data-goal-type="${type}">+ Add a goal</button></div>
    <section class="surface goals-hero"><h2>${type === 'daily' ? 'Today counts. Even when it’s imperfect.' : type === 'weekly' ? 'A week with a plan has fewer panic chapters.' : type === 'short-term' ? 'Build a bridge between today and your next win.' : 'You don’t need a five-year plan. You need a direction.'}</h2><p>${type === 'long-term' ? 'Try writing the feeling you want to earn, not only the achievement you want to unlock.' : 'Break a goal into the smallest next move, then put that move on your calendar.'}</p><button class="secondary-button" data-action="add-goal" data-goal-type="${type}">Add your ${type.replace('-', ' ')} focus →</button></section>
    <section class="goals-grid">${goals.length ? goals.map(renderGoal).join('') : `<div class="surface goal-empty"><h3>No goals here yet.</h3><p>Empty is a fine place to begin.</p><button class="primary-button" data-action="add-goal" data-goal-type="${type}">Add a goal</button></div>`}</section>`;
}
function renderGoal(goal) {
  const horizon = goal.type.replace('-', ' ');
  return `<article class="surface goal-card ${goal.type}-card"><span class="goal-type">${horizon}</span><button class="more-button" data-action="edit-goal" data-id="${goal.id}" aria-label="Edit goal">···</button><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.why || 'Make the next step beautifully obvious.')}</p><div class="goal-progress"><div class="progress-track"><span style="width:${goal.progress || 0}%"></span></div></div><div class="goal-meta"><span>${goal.progress || 0}% in motion</span><span>${goal.date ? `by ${formatDate(goal.date, { month: 'short', day: 'numeric' })}` : 'no deadline'}</span></div></article>`;
}

function renderInbox() { return `<div class="page-top"><div><p class="eyebrow">NO THOUGHT LEFT BEHIND</p><h1 class="page-title">Brain dump</h1><p class="page-subtitle">Catch the loose threads now. Decide what they mean later.</p></div></div><div class="inbox-layout"><section class="surface brain-card"><p class="card-kicker">A GENTLER INBOX</p><h2>Get it out of your head.</h2><p>Messy is welcome here. Add a thought, task, or tiny worry—then turn it into a plan when you have the energy.</p><form class="brain-input" id="inboxForm"><input id="inboxInput" placeholder="What’s on your mind?" maxlength="120" required /><button type="submit" aria-label="Add to brain dump">+</button></form></section><section class="surface inbox-panel"><div class="section-heading"><h2>Unsorted thoughts</h2><span>${state.inbox.length} waiting</span></div>${state.inbox.length ? state.inbox.map((item, index) => `<div class="inbox-item"><span>◌</span><p>${escapeHtml(item)}</p><button data-action="plan-inbox" data-index="${index}">Plan it</button><button class="remove-inbox" data-action="remove-inbox" data-index="${index}" aria-label="Remove">×</button></div>`).join('') : `<div class="empty-tasks"><strong>Your mind has some elbow room.</strong>Anything that pops up can land here.</div>`}</section></div>`; }

function renderSettings() { return `<div class="page-top"><div><p class="eyebrow">MAKE IT FEEL LIKE YOURS</p><h1 class="page-title">Settings</h1><p class="page-subtitle">A little setup today, less friction tomorrow.</p></div></div><div class="settings-layout"><section class="surface settings-card"><h2>Reminder style</h2><p>Focusflow can alert you while this site is open. Browser notification permission gives your nudges more reach.</p><div class="settings-row"><div><b>Task reminders</b><small>Notify before each planned start time.</small></div><button class="toggle ${state.settings.reminders ? 'on' : ''}" data-action="toggle-reminders" aria-label="Toggle task reminders"><span></span></button></div><div class="settings-row"><div><b>Automatic rollover</b><small>Unfinished tasks move to tomorrow when you next open Focusflow.</small></div><button class="toggle ${state.settings.rollover ? 'on' : ''}" data-action="toggle-rollover" aria-label="Toggle automatic rollover"><span></span></button></div><div class="settings-row"><div><b>Browser notification permission</b><small id="permissionText">${'Notification' in window ? Notification.permission : 'Not supported by this browser'}.</small></div><button class="secondary-button" data-action="request-notifications">Enable</button></div></section><section class="surface settings-card"><h2>Your profile</h2><p>Focusflow uses your first name to keep the experience personal.</p><form id="profileForm" class="field-line"><input id="profileInput" maxlength="30" value="${escapeHtml(state.profile.name)}" aria-label="First name" /><button class="primary-button">Save</button><button type="button" class="secondary-button" data-action="open-auth">Sign in / sync</button></form></section><section class="surface settings-card"><h2>Demo data</h2><p>Start fresh any time. This only changes this browser.</p><button class="text-button danger" data-action="reset-demo">Reset Focusflow</button></section></div>`; }

function bindPageEvents() {
  $$('[data-action]').forEach(button => button.addEventListener('click', handleAction));
  $('#inboxForm')?.addEventListener('submit', addInbox);
  $('#profileForm')?.addEventListener('submit', saveProfile);
}
function handleAction(event) {
  const el = event.currentTarget; const action = el.dataset.action;
  if (action === 'add-task') openTaskModal(null, el.dataset.date || dateKey(today));
  if (action === 'plan-tomorrow') openTaskModal(null, dateKey(addDays(today, 1)));
  if (action === 'edit-task') openTaskModal(state.tasks.find(t => t.id === el.dataset.id));
  if (action === 'complete-task') completeTask(el.dataset.id);
  if (action === 'start-task') startTask(el.dataset.id);
  if (action === 'select-date') { selectedDate = el.dataset.date; const selected = new Date(`${selectedDate}T12:00:00`); calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1); render(); }
  if (action === 'prev-month') { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); render(); }
  if (action === 'next-month') { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); render(); }
  if (action === 'go-today') { selectedDate = dateKey(today); calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1); render(); }
  if (action === 'add-goal') openGoalModal(null, el.dataset.goalType);
  if (action === 'edit-goal') openGoalModal(state.goals.find(g => g.id === el.dataset.id));
  if (action === 'remove-inbox') { state.inbox.splice(Number(el.dataset.index), 1); saveState(); render(); }
  if (action === 'plan-inbox') { const text = state.inbox[Number(el.dataset.index)]; state.inbox.splice(Number(el.dataset.index), 1); saveState(); openTaskModal({ title: text, date: dateKey(today), start: '17:00', end: '17:30', energy: 'focus', reminder: '5', goal: 'Daily life', notes: '' }); render(); }
  if (action === 'toggle-reminders') { state.settings.reminders = !state.settings.reminders; saveState(); render(); showToast('Reminder setting updated', state.settings.reminders ? 'Your time nudges are on.' : 'Reminders are paused.'); }
  if (action === 'toggle-rollover') { state.settings.rollover = !state.settings.rollover; saveState(); render(); }
  if (action === 'request-notifications') requestNotifications();
  if (action === 'open-auth') openModal('authModal');
  if (action === 'reset-demo') { if (confirm('Reset all Focusflow data in this browser?')) { state = structuredClone(sampleState); saveState(); render(); showToast('Fresh start', 'Your demo plan has been restored.'); } }
}

function openTaskModal(task = null, date = dateKey(today)) {
  const isEdit = task?.id && state.tasks.some(t => t.id === task.id);
  $('#taskModalTitle').textContent = isEdit ? 'Edit your plan' : 'Plan your next move';
  $('#taskModalEyebrow').textContent = isEdit ? 'A LITTLE COURSE CORRECTION' : 'MAKE A LITTLE PROMISE';
  $('#taskId').value = isEdit ? task.id : '';
  $('#taskTitle').value = task?.title || '';
  $('#taskDate').value = task?.date || date;
  $('#taskStart').value = task?.start || '09:00'; $('#taskEnd').value = task?.end || '09:30'; $('#taskEnergy').value = task?.energy || 'focus'; $('#taskReminder').value = task?.reminder || '5'; $('#taskGoal').value = task?.goal || 'Daily life'; $('#taskNotes').value = task?.notes || '';
  $('#deleteTaskButton').hidden = !isEdit;
  openModal('taskModal'); setTimeout(() => $('#taskTitle').focus(), 100);
}
function openGoalModal(goal = null, type = 'daily') {
  $('#goalModalTitle').textContent = goal ? 'Edit your goal' : 'Add a goal'; $('#goalId').value = goal?.id || ''; $('#goalTitle').value = goal?.title || ''; $('#goalType').value = goal?.type || type; $('#goalDate').value = goal?.date || ''; $('#goalWhy').value = goal?.why || ''; openModal('goalModal'); setTimeout(() => $('#goalTitle').focus(), 100);
}
function openModal(id) { const modal = $(`#${id}`); modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal(id) { const modal = $(`#${id}`); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

function submitTask(event) {
  event.preventDefault();
  const values = { id: $('#taskId').value || uid(), title: $('#taskTitle').value.trim(), date: $('#taskDate').value, start: $('#taskStart').value, end: $('#taskEnd').value, energy: $('#taskEnergy').value, reminder: $('#taskReminder').value, goal: $('#taskGoal').value, notes: $('#taskNotes').value.trim() };
  if (minutes(values.end) <= minutes(values.start)) { showToast('Tiny timing issue', 'Finish time needs to be after the start time.'); return; }
  const old = state.tasks.find(t => t.id === values.id); Object.assign(values, { status: old?.status || 'pending', notified: false });
  if (old) Object.assign(old, values); else state.tasks.push(values);
  selectedDate = values.date; saveState(); closeModal('taskModal'); render(); showToast(old ? 'Plan updated' : 'Plan saved', `${values.title} is on your calendar.`);
}
function submitGoal(event) { event.preventDefault(); const id = $('#goalId').value; const existing = state.goals.find(g => g.id === id); const values = { id: id || uid(), title: $('#goalTitle').value.trim(), type: $('#goalType').value, date: $('#goalDate').value, why: $('#goalWhy').value.trim(), progress: existing?.progress || 0 }; if (existing) Object.assign(existing, values); else state.goals.push(values); saveState(); closeModal('goalModal'); activePage = values.type; location.hash = values.type; render(); showToast('Goal in view', 'A little direction goes a long way.'); }
function deleteCurrentTask() { const id = $('#taskId').value; state.tasks = state.tasks.filter(t => t.id !== id); saveState(); closeModal('taskModal'); render(); showToast('Task removed', 'More room for what matters.'); }
function completeTask(id) { const task = state.tasks.find(t => t.id === id); if (!task) return; task.status = task.status === 'done' ? 'pending' : 'done'; saveState(); render(); if (task.status === 'done') showToast('Promise kept ✦', `Nice work. ${task.title} is done.`); }
function startTask(id) { const task = state.tasks.find(t => t.id === id); if (!task) return; task.status = 'started'; saveState(); render(); showToast('You’re underway', `Just the next small step: ${task.title}.`); }
function addInbox(event) { event.preventDefault(); const input = $('#inboxInput'); const value = input.value.trim(); if (!value) return; state.inbox.unshift(value); saveState(); render(); showToast('Caught it', 'Your thought is safely out of your head.'); }
function saveProfile(event) { event.preventDefault(); state.profile.name = $('#profileInput').value.trim() || 'You'; saveState(); render(); showToast('Saved', 'Your Focusflow is feeling more like yours.'); }
function requestNotifications() { if (!('Notification' in window)) { showToast('Not supported here', 'Your browser does not offer system notifications.'); return; } Notification.requestPermission().then(permission => { showToast(permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled', permission === 'granted' ? 'We’ll nudge you when Focusflow is open.' : 'You can still use the in-app reminders.'); render(); }); }

function migrateOverdueTasks() {
  if (!state.settings.rollover) return;
  const currentKey = dateKey(today); let moved = 0;
  state.tasks.forEach(task => { if (task.date < currentKey && task.status !== 'done') { task.date = currentKey; task.status = 'pending'; task.notified = false; task.notes = task.notes ? `${task.notes} · Rolled forward with kindness.` : 'Rolled forward with kindness.'; moved++; } });
  if (moved) { saveState(); setTimeout(() => showToast('A gentler reset', `${moved} unfinished task${moved === 1 ? '' : 's'} moved to today. Choose what still matters.`), 300); }
}
function scheduleReminders() {
  reminderTimers.forEach(clearTimeout); reminderTimers = [];
  const now = Date.now(); const todayKey = dateKey(today);
  const activeTasks = getTasks(todayKey).filter(task => task.status !== 'done');
  if (state.settings.reminders) activeTasks.filter(task => !task.notified).forEach(task => {
      const alertTime = new Date(`${task.date}T${task.start}:00`).getTime() - Number(task.reminder || 0) * 60000;
      const wait = alertTime - now;
      if (wait > 0 && wait < 2147483647) reminderTimers.push(setTimeout(() => notifyTask(task.id), wait));
    });
  // When the deadline passes, gently move an unfinished task to tomorrow.
  if (!state.settings.rollover) return;
  activeTasks.forEach(task => {
    const deadline = new Date(`${task.date}T${task.end}:00`).getTime();
    const wait = deadline - now;
    if (wait > 0 && wait < 2147483647) reminderTimers.push(setTimeout(() => rollTaskAfterDeadline(task.id), wait));
  });
}
function notifyTask(id) { const task = state.tasks.find(t => t.id === id); if (!task || task.status === 'done') return; task.notified = true; saveState(); const body = `${task.title} · planned until ${timeLabel(task.end)}`; if ('Notification' in window && Notification.permission === 'granted') new Notification('Focusflow · It’s time', { body }); showToast('It’s time to begin', body, id); render(); }
function rollTaskAfterDeadline(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || task.status === 'done' || task.date !== dateKey(today)) return;
  task.date = dateKey(addDays(today, 1)); task.status = 'pending'; task.notified = false;
  task.notes = task.notes ? `${task.notes} · Moved forward after its deadline.` : 'Moved forward after its deadline.';
  saveState();
  const body = `${task.title} wasn’t marked complete, so it is waiting for you tomorrow.`;
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Focusflow · gently rescheduled', { body });
  showToast('Not finished? No shame.', body, null, true);
  render();
}
function showToast(title, message, taskId = null, urgent = false) { const toast = document.createElement('div'); toast.className = `toast ${urgent ? 'urgent' : ''}`; toast.innerHTML = `<div class="toast-top"><span class="toast-icon">${urgent ? '!' : '◷'}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(message)}</p></div></div><div class="toast-actions">${taskId ? `<button data-toast-start="${taskId}">Start now</button>` : ''}<button class="toast-dismiss">${taskId ? 'Later' : 'Got it'}</button></div>`; $('#toastStack').append(toast); $('[data-toast-start]', toast)?.addEventListener('click', () => { startTask(taskId); toast.remove(); }); $('.toast-dismiss', toast).addEventListener('click', () => toast.remove()); setTimeout(() => toast.remove(), 10000); }
function getGreeting() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

$('#taskForm').addEventListener('submit', submitTask); $('#goalForm').addEventListener('submit', submitGoal); $('#deleteTaskButton').addEventListener('click', deleteCurrentTask); $('#authForm').addEventListener('submit', event => { event.preventDefault(); state.profile = { name: $('#authName').value.trim() || 'You', email: $('#authEmail').value.trim() }; saveState(); closeModal('authModal'); render(); showToast('You’re in', 'This demo saves your plans in this browser.'); });
$$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop.id); }));
$('#quickPlanButton').addEventListener('click', () => openTaskModal(null, dateKey(addDays(today, 1)))); $('#mobilePlanButton').addEventListener('click', () => openTaskModal(null, dateKey(addDays(today, 1)))); $('#profileButton').addEventListener('click', () => openModal('authModal')); $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
window.addEventListener('hashchange', () => { activePage = location.hash.replace('#', '') || 'today'; if (!['today','calendar','inbox','daily','weekly','short-term','long-term','settings'].includes(activePage)) activePage = 'today'; $('#sidebar').classList.remove('open'); render(); });
window.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop.open').forEach(modal => closeModal(modal.id)); });

render();
