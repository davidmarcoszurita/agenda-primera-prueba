const { url, anonKey } = window.__SUPABASE_CONFIG__ || {};
if (!url || !anonKey) {
  document.body.innerHTML =
    '<p style="padding:2rem;font-family:sans-serif">Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY como variables de entorno del servicio.</p>';
  throw new Error('Supabase no configurado');
}
const supabase = window.supabase.createClient(url, anonKey);

// --- Estado ---
let currentUser = null;
let viewMonth = new Date();
let selectedDate = new Date();
let monthEventDays = new Set(); // días del mes con al menos un evento
let editingId = null;

// --- Elementos ---
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSub = document.getElementById('auth-sub');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle');
const authError = document.getElementById('auth-error');
let authMode = 'login';

const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

const miniCalGrid = document.getElementById('mini-cal-grid');
const miniCalLabel = document.getElementById('mini-cal-label');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const todayBtn = document.getElementById('today-btn');

const selectedDateLabel = document.getElementById('selected-date-label');
const eventList = document.getElementById('event-list');
const emptyState = document.getElementById('empty-state');
const newEventBtn = document.getElementById('new-event-btn');
const emptyAddBtn = document.getElementById('empty-add-btn');

const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const modalTitle = document.getElementById('modal-title');
const eventError = document.getElementById('event-error');
const deleteEventBtn = document.getElementById('delete-event-btn');
const cancelEventBtn = document.getElementById('cancel-event-btn');

// --- Auth ---
authToggle.addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  authTitle.textContent = authMode === 'login' ? 'Entrar' : 'Crear cuenta';
  authSub.textContent =
    authMode === 'login'
      ? 'Tu agenda personal, en un solo lugar.'
      : 'Crea tu cuenta para empezar a anotar.';
  authSubmit.textContent = authMode === 'login' ? 'Entrar' : 'Crear cuenta';
  authToggle.textContent =
    authMode === 'login' ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Entra';
  authError.hidden = true;
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.hidden = true;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const { error } =
    authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

  if (error) {
    authError.textContent = error.message;
    authError.hidden = false;
    return;
  }

  if (authMode === 'signup') {
    authError.textContent =
      'Cuenta creada. Si tu proyecto exige confirmar el correo, revisa tu bandeja antes de entrar.';
    authError.hidden = false;
    authError.style.color = 'var(--sage)';
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  if (currentUser) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    userEmailEl.textContent = currentUser.email;
    renderMiniCalendar();
    loadEventsForSelectedDate();
  } else {
    appScreen.hidden = true;
    authScreen.hidden = false;
  }
});

// --- Calendario mini ---
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function renderMiniCalendar() {
  miniCalLabel.textContent = `${MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  miniCalGrid.innerHTML = '';
  DOW.forEach((d) => {
    const el = document.createElement('span');
    el.className = 'dow';
    el.textContent = d;
    miniCalGrid.appendChild(el);
  });

  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes = 0
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);

  await loadMonthEventDays();

  const today = new Date();
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const btn = document.createElement('button');
    btn.textContent = d.getDate();
    if (d.getMonth() !== viewMonth.getMonth()) btn.classList.add('other-month');
    if (sameDay(d, today)) btn.classList.add('today');
    if (sameDay(d, selectedDate)) btn.classList.add('selected');
    if (monthEventDays.has(dateKey(d))) btn.classList.add('has-events');
    btn.addEventListener('click', () => {
      selectedDate = d;
      if (d.getMonth() !== viewMonth.getMonth()) {
        viewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        renderMiniCalendar();
      } else {
        highlightSelected();
      }
      loadEventsForSelectedDate();
    });
    miniCalGrid.appendChild(btn);
  }
}

function highlightSelected() {
  [...miniCalGrid.querySelectorAll('button')].forEach((b) => b.classList.remove('selected'));
  const today = new Date();
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const idx = Math.round((selectedDate - gridStart) / 86400000) + 7; // +7 por la fila de nombres de días
  const btn = miniCalGrid.children[idx];
  if (btn && btn.tagName === 'BUTTON') btn.classList.add('selected');
}

async function loadMonthEventDays() {
  if (!currentUser) return;
  const rangeStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 21);
  const rangeEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 10);
  const { data, error } = await supabase
    .from('events')
    .select('start_time')
    .gte('start_time', rangeStart.toISOString())
    .lte('start_time', rangeEnd.toISOString());
  monthEventDays = new Set();
  if (!error && data) {
    data.forEach((row) => monthEventDays.add(dateKey(new Date(row.start_time))));
  }
}

prevMonthBtn.addEventListener('click', () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  renderMiniCalendar();
});
nextMonthBtn.addEventListener('click', () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  renderMiniCalendar();
});
todayBtn.addEventListener('click', () => {
  selectedDate = new Date();
  viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderMiniCalendar();
  loadEventsForSelectedDate();
});

// --- Lista de eventos del día ---
async function loadEventsForSelectedDate() {
  selectedDateLabel.textContent = selectedDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const dayStart = new Date(selectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(selectedDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .order('start_time', { ascending: true });

  eventList.innerHTML = '';
  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  data.forEach((ev) => {
    const li = document.createElement('li');
    li.className = 'event-item';
    const start = new Date(ev.start_time);
    const end = ev.end_time ? new Date(ev.end_time) : null;
    const timeStr = end
      ? `${fmtTime(start)} – ${fmtTime(end)}`
      : fmtTime(start);
    li.innerHTML = `
      <div class="event-time">${timeStr}</div>
      <h3 class="event-title"></h3>
      <p class="event-notes"></p>
    `;
    li.querySelector('.event-title').textContent = ev.title;
    li.querySelector('.event-notes').textContent = ev.description || '';
    li.addEventListener('click', () => openModal(ev));
    eventList.appendChild(li);
  });
}

function fmtTime(d) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// --- Modal de evento ---
function openModal(ev) {
  eventError.hidden = true;
  eventForm.reset();
  if (ev) {
    editingId = ev.id;
    modalTitle.textContent = 'Editar evento';
    deleteEventBtn.hidden = false;
    document.getElementById('event-title').value = ev.title;
    document.getElementById('event-notes').value = ev.description || '';
    const start = new Date(ev.start_time);
    document.getElementById('event-date').value = dateKey(start);
    document.getElementById('event-start').value = fmtTime(start).replace(/\s/g, '');
    if (ev.end_time) {
      document.getElementById('event-end').value = fmtTime(new Date(ev.end_time)).replace(/\s/g, '');
    }
  } else {
    editingId = null;
    modalTitle.textContent = 'Nuevo evento';
    deleteEventBtn.hidden = true;
    document.getElementById('event-date').value = dateKey(selectedDate);
  }
  eventModal.hidden = false;
}

function closeModal() {
  eventModal.hidden = true;
  editingId = null;
}

newEventBtn.addEventListener('click', () => openModal(null));
emptyAddBtn.addEventListener('click', () => openModal(null));
cancelEventBtn.addEventListener('click', closeModal);

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  eventError.hidden = true;

  const title = document.getElementById('event-title').value.trim();
  const notes = document.getElementById('event-notes').value.trim();
  const dateVal = document.getElementById('event-date').value;
  const startVal = document.getElementById('event-start').value;
  const endVal = document.getElementById('event-end').value;

  const startTime = new Date(`${dateVal}T${startVal}`);
  const endTime = endVal ? new Date(`${dateVal}T${endVal}`) : null;

  const payload = {
    title,
    description: notes || null,
    start_time: startTime.toISOString(),
    end_time: endTime ? endTime.toISOString() : null,
    user_id: currentUser.id
  };

  const query = editingId
    ? supabase.from('events').update(payload).eq('id', editingId)
    : supabase.from('events').insert(payload);

  const { error } = await query;
  if (error) {
    eventError.textContent = error.message;
    eventError.hidden = false;
    return;
  }

  closeModal();
  await renderMiniCalendar();
  await loadEventsForSelectedDate();
});

deleteEventBtn.addEventListener('click', async () => {
  if (!editingId) return;
  const { error } = await supabase.from('events').delete().eq('id', editingId);
  if (error) {
    eventError.textContent = error.message;
    eventError.hidden = false;
    return;
  }
  closeModal();
  await renderMiniCalendar();
  await loadEventsForSelectedDate();
});

// --- Arranque ---
(async function init() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
  if (currentUser) {
    authScreen.hidden = true;
    appScreen.hidden = false;
    userEmailEl.textContent = currentUser.email;
    await renderMiniCalendar();
    await loadEventsForSelectedDate();
  }
})();
