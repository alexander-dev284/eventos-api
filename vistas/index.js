// ATAJO: SELECTORES DOM (ayuda rápida)
const $ = id => document.getElementById(id);

// ESTADO DE LA APLICACIÓN
const state = {
  token: localStorage.getItem('token') || null,
  usuario: JSON.parse(localStorage.getItem('usuario')) || null,
  activeTab: 'asistentes',
  asistentes: [],
  eventos: [],
  registros: [],
  usuarios: [],
  roles: []
};

// Conservar HTML original de la barra lateral para reconstrucciones dinámicas
let ORIGINAL_SIDEBAR_HTML = null;

// CONSTANTES
const API_URL = ''; 

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  setupGlobalEventListeners();
  updateCurrentDate();
  // capturar plantilla original de la barra lateral para restauraciones
  const sidebar = document.querySelector('.sidebar-nav');
  if (sidebar) ORIGINAL_SIDEBAR_HTML = sidebar.innerHTML;
  if (state.token && state.usuario) {
    showDashboard();
  } else {
    showLogin();
  }
});

function setupGlobalEventListeners() {
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.addEventListener('click', (e) => {
      switchTab(e.currentTarget.getAttribute('data-tab'));
    });
  });

  const astForm = $('asistenteForm');
  if (astForm) astForm.addEventListener('submit', handleAsistenteSubmit);
  
  const eveForm = $('eventoForm');
  if (eveForm) eveForm.addEventListener('submit', handleEventoSubmit);

  const usuarioForm = $('usuarioForm');
  if (usuarioForm) usuarioForm.addEventListener('submit', handleUsuarioSubmit);

  const rolForm = $('rolForm');
  if (rolForm) rolForm.addEventListener('submit', handleRolSubmit);

  document.querySelectorAll('#asistenteModal .close-btn, #asistenteModal .btn-secondary').forEach(btn => {
    btn.addEventListener('click', closeAsistenteModal);
  });
  
  document.querySelectorAll('#eventoModal .close-btn, #eventoModal .btn-secondary').forEach(btn => {
    btn.addEventListener('click', closeEventoModal);
  });

  document.querySelectorAll('#usuarioModal .close-btn, #usuarioModal .btn-secondary').forEach(btn => {
    btn.addEventListener('click', closeUsuarioModal);
  });

  document.querySelectorAll('#rolModal .close-btn, #rolModal .btn-secondary').forEach(btn => {
    btn.addEventListener('click', closeRolModal);
  });
}

function updateCurrentDate() {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = $('currentDateStr');
  if (dateStr) dateStr.textContent = new Date().toLocaleDateString('es-ES', options);
}

// NOTIFICACIONES (toasts)
function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  const alertType = type === 'error' ? 'danger' : type;
  toast.className = `alert alert-${alertType} shadow-lg mb-2`;
  toast.style.minWidth = '300px';
  toast.style.maxWidth = '450px';
  toast.innerHTML = `<div class="fw-bold">${title}</div><div class="small">${message}</div>`;
  $('toastContainer')?.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade');
    setTimeout(() => toast.remove(), 150);
  }, 4000);
}

// UTILIDADES DE CARGA (loader)
const toggleLoader = show => $('loadingOverlay')?.classList.toggle('hidden', !show);

// CARGA DE PLANTILLAS (fetch de vistas)
async function loadViewTemplate(viewName) {
  try {
    const headers = state.token ? { 'Authorization': `Bearer ${state.token}` } : {};
    const response = await fetch(`/${viewName}.html`, { headers });
    if (response.status === 401) {
      showToast('Sesión Caducada', 'Inicie sesión de nuevo', 'warning');
      handleLogout();
      throw new Error('No autorizado');
    }
    if (response.status === 403) {
      showToast('Acceso Denegado', 'No tiene permisos para ver esta sección', 'warning');
      throw new Error('Prohibido');
    }
    if (!response.ok) throw new Error(`Error al cargar la plantilla ${viewName}`);
    return await response.text();
  } catch (error) {
    showToast('Error de Interfaz', `No se pudo cargar la vista de ${viewName}`, 'error');
    return `<div class="p-4 text-center text-danger">Error al cargar el contenido de la vista.</div>`;
  }
}

// WRAPPER PARA PETICIONES A LA API
async function apiRequest(endpoint, options = {}) {
  toggleLoader(true);
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
  };
  const config = {
    ...options,
    headers: { ...headers, ...options.headers }
  };
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    if (response.status === 401) {
      if (state.token) {
        showToast('Sesión Caducada', 'Inicie sesión de nuevo', 'warning');
        handleLogout();
      }
      const data = await response.json();
      throw new Error(data.mensaje || 'No autorizado');
    }
    if (response.status === 403) {
      const data = await response.json();
      showToast('Acceso Denegado', data.mensaje || 'No tiene permisos para esta acción', 'warning');
      const error = new Error(data.mensaje || 'Prohibido');
      error.status = 403;
      toggleLoader(false);
      throw error;
    }
    if (response.status === 204) {
      toggleLoader(false);
      return null;
    }
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.mensaje || 'Error en el servidor');
      error.details = data.errores || null;
      throw error;
    }
    toggleLoader(false);
    return data;
  } catch (error) {
    toggleLoader(false);
    throw error;
  }
}

// INICIO DE SESIÓN / CIERRE DE SESIÓN
async function showLogin() {
  $('loginSection')?.classList.remove('hidden');
  $('appLayout')?.classList.add('hidden');
  const loginHtml = await loadViewTemplate('login');
  const loginSect = $('loginSection');
  if (loginSect) loginSect.innerHTML = loginHtml;
  
  const loginForm = $('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  try {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    state.token = data.token;
    state.usuario = data.usuario;
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    showToast('Sesión Iniciada', `¡Bienvenido, ${data.usuario.username}!`);
    showDashboard();
  } catch (error) {
    showToast('Error de Conexión', error.message, 'error');
  }
}

function handleLogout() {
  state.token = null;
  state.usuario = null;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  showLogin();
}

function showDashboard() {
  const loginSect = $('loginSection');
  if (loginSect) {
    loginSect.classList.add('hidden');
    loginSect.innerHTML = '';
  }
  $('appLayout')?.classList.remove('hidden');
  $('profileName').textContent = state.usuario.username;
  $('profileRole').textContent = state.usuario.rol;
  $('userAvatar').textContent = state.usuario.username.substring(0, 1).toUpperCase();
  configureMenuByRoles();
  
  const authorizedTabs = getAuthorizedTabs();
  if (authorizedTabs.length > 0) switchTab(authorizedTabs[0]);
}

function getAuthorizedTabs() {
  const funciones = (state.usuario && state.usuario.funciones) || [];
  const mapping = {
    'CRUD Asistentes': 'asistentes',
    'CRUD Eventos': 'eventos',
    'Registro Transaccional': 'registros',
    'Reportes': 'reportes',
    'CRUD Usuarios': 'usuarios',
    'CRUD Roles': 'roles'
  };
  const set = new Set();
  funciones.forEach(f => {
    const tab = mapping[f];
    if (tab) set.add(tab);
  });
  if (state.usuario?.rol?.toLowerCase() === 'admin') {
    set.add('usuarios');
    set.add('roles');
  }
  return Array.from(set);
}

function configureMenuByRoles() {
  const tabs = getAuthorizedTabs();
  const sidebar = document.querySelector('.sidebar-nav');
  if (!sidebar) return;
  // restaurar la estructura original del menú para que los cambios sean idempotentes
  if (ORIGINAL_SIDEBAR_HTML) sidebar.innerHTML = ORIGINAL_SIDEBAR_HTML;

  // eliminar elementos que el usuario no está autorizado a ver
  sidebar.querySelectorAll('li').forEach(li => {
    const tab = li.getAttribute('data-tab');
    if (!tabs.includes(tab)) {
      li.remove();
    }
  });
  // volver a adjuntar escuchas de clic a los elementos restantes (el DOM pudo haber cambiado)
  sidebar.querySelectorAll('li').forEach(item => {
    // eliminar escuchas existentes clonando el nodo para evitar duplicados
    const newItem = item.cloneNode(true);
    item.replaceWith(newItem);
    newItem.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

// CAMBIO DE PESTAÑAS
async function switchTab(tabId) {
  state.activeTab = tabId;
  const authorizedTabs = getAuthorizedTabs();
  if (authorizedTabs.length > 0 && !authorizedTabs.includes(tabId)) {
    showToast('Acceso Denegado', 'No tiene permisos para esta sección', 'warning');
    return;
  }
  document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });
  
  const titles = {
    asistentes: 'Módulo de Asistentes',
    eventos: 'Módulo de Eventos',
    registros: 'Registro Transaccional de Inscripciones',
    reportes: 'Reportes y Estadísticas de Eventos'
  };
  $('viewTitle').textContent = titles[tabId] || 'Panel Principal';
  
  const viewHtml = await loadViewTemplate(tabId);
  $('tabContent').innerHTML = viewHtml;
  setupViewDataAndListeners(tabId);
}

function setupViewDataAndListeners(tabId) {
  if (tabId === 'asistentes') {
    getAsistentes();
    $('searchAsistente')?.addEventListener('input', filterAsistentes);
    $('btnNuevoAsistente')?.addEventListener('click', () => openAsistenteModal());
  } else if (tabId === 'eventos') {
    getEventos();
    $('searchEvento')?.addEventListener('input', filterEventos);
    $('btnNuevoEvento')?.addEventListener('click', () => openEventoModal());
  } else if (tabId === 'registros') {
    populateInscripcionesSelectors();
    $('registroForm')?.addEventListener('submit', handleRegistroSubmit);
  } else if (tabId === 'reportes') {
    getReportes();
    $('btnExportReportes')?.addEventListener('click', exportReportes);
  } else if (tabId === 'usuarios') {
    getUsuarios();
    $('searchUsuario')?.addEventListener('input', filterUsuarios);
    $('btnNuevoUsuario')?.addEventListener('click', () => openUsuarioModal());
    $('usuarioForm')?.addEventListener('submit', handleUsuarioSubmit);
    document.querySelectorAll('#usuarioModal .close-btn, #usuarioModal .btn-secondary').forEach(btn => {
      btn.addEventListener('click', closeUsuarioModal);
    });
  } else if (tabId === 'roles') {
    getRoles();
    $('searchRol')?.addEventListener('input', filterRoles);
    $('btnNuevoRol')?.addEventListener('click', () => openRolModal());
    $('rolForm')?.addEventListener('submit', handleRolSubmit);
    document.querySelectorAll('#rolModal .close-btn, #rolModal .btn-secondary').forEach(btn => {
      btn.addEventListener('click', closeRolModal);
    });
  }
}

// --- CRUD DE USUARIOS ---

async function getUsuarios() {
  try {
    state.usuarios = await apiRequest('/api/usuarios');
    renderUsuarios(state.usuarios);
  } catch (error) {
    showToast('Error al cargar usuarios', error.message, 'error');
  }
}

function renderUsuarios(list) {
  const tableBody = $('usuariosTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">No se encontraron usuarios.</td></tr>`;
    return;
  }
  list.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-4">${user.id}</td>
      <td><strong>${user.username}</strong></td>
      <td>${user.rolNombre}</td>
      <td class="text-end pe-4">
        <button class="btn btn-outline-secondary btn-sm me-1 edit-btn">✏️</button>
        <button class="btn btn-outline-danger btn-sm delete-btn">🗑️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => openUsuarioModal(user.id));
    tr.querySelector('.delete-btn').addEventListener('click', () => deleteUsuario(user.id));
    tableBody.appendChild(tr);
  });
}

function filterUsuarios() {
  const query = $('searchUsuario').value.toLowerCase().trim();
  const filtered = state.usuarios.filter(user => 
    user.username.toLowerCase().includes(query) ||
    user.rolNombre.toLowerCase().includes(query)
  );
  renderUsuarios(filtered);
}

async function loadRolesForUsuarioSelect() {
  if (!state.roles || state.roles.length === 0) {
    state.roles = await apiRequest('/api/roles');
  }
  const select = $('usuarioRolSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Seleccione un rol --</option>';
  state.roles.forEach(role => {
    const option = document.createElement('option');
    option.value = role.id;
    option.textContent = role.nombre;
    select.appendChild(option);
  });
}

async function openUsuarioModal(id = null) {
  const form = $('usuarioForm');
  if (form) form.reset();
  $('usuarioId').value = '';
  await loadRolesForUsuarioSelect();
  const validId = (id && typeof id !== 'object') ? id : null;
  $('usuarioModalTitle').textContent = validId ? 'Editar Usuario' : 'Crear Usuario';
  if (validId) {
    const user = state.usuarios.find(u => u.id === validId);
    if (user) {
      $('usuarioId').value = user.id;
      $('usuarioUsername').value = user.username;
      $('usuarioPassword').value = '';
      $('usuarioRolSelect').value = user.rolId;
    }
  }
  $('usuarioModal')?.classList.add('active');
}

const closeUsuarioModal = () => $('usuarioModal')?.classList.remove('active');

async function handleUsuarioSubmit(e) {
  e.preventDefault();
  const id = $('usuarioId').value;
  const payload = {
    username: $('usuarioUsername').value.trim(),
    password: $('usuarioPassword').value,
    rolId: parseInt($('usuarioRolSelect').value)
  };
  if (!payload.username || (!id && !payload.password) || !payload.rolId) {
    return showToast('Formulario incompleto', 'Complete usuario, contraseña y rol.', 'warning');
  }
  const isEdit = !!id;
  const endpoint = isEdit ? `/api/usuarios/${id}` : '/api/usuarios';
  const method = isEdit ? 'PUT' : 'POST';
  try {
    await apiRequest(endpoint, { method, body: JSON.stringify(payload) });
    showToast(isEdit ? 'Usuario actualizado' : 'Usuario creado', `El usuario ${payload.username} se guardó correctamente.`);
    closeUsuarioModal();
    getUsuarios();
  } catch (error) {
    showToast('Error al guardar usuario', error.message, 'error');
  }
}

async function deleteUsuario(id) {
  const user = state.usuarios.find(u => u.id === id);
  if (!user) return;
  if (confirm(`¿Confirma eliminación del usuario "${user.username}"?`)) {
    try {
      await apiRequest(`/api/usuarios/${id}`, { method: 'DELETE' });
      showToast('Usuario eliminado', `Se eliminó el usuario ${user.username}.`);
      getUsuarios();
    } catch (error) {
      showToast('Error al eliminar usuario', error.message, 'error');
    }
  }
}

// --- CRUD DE ROLES ---

async function getRoles() {
  try {
    state.roles = await apiRequest('/api/roles');
    renderRoles(state.roles);
  } catch (error) {
    showToast('Error al cargar roles', error.message, 'error');
  }
}

function renderRoles(list) {
  const tableBody = $('rolesTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-4">No se encontraron roles.</td></tr>`;
    return;
  }
  list.forEach(role => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-4">${role.id}</td>
      <td><strong>${role.nombre}</strong></td>
      <td class="text-end pe-4">
        <button class="btn btn-outline-secondary btn-sm me-1 edit-btn">✏️</button>
        <button class="btn btn-outline-danger btn-sm delete-btn">🗑️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => openRolModal(role.id));
    tr.querySelector('.delete-btn').addEventListener('click', () => deleteRol(role.id));
    tableBody.appendChild(tr);
  });
}

function filterRoles() {
  const query = $('searchRol').value.toLowerCase().trim();
  const filtered = state.roles.filter(role => role.nombre.toLowerCase().includes(query));
  renderRoles(filtered);
}

function openRolModal(id = null) {
  const form = $('rolForm');
  if (form) form.reset();
  $('rolId').value = '';
  const validId = (id && typeof id !== 'object') ? id : null;
  $('rolModalTitle').textContent = validId ? 'Editar Rol' : 'Crear Rol';
  if (validId) {
    const role = state.roles.find(r => r.id === validId);
    if (role) {
      $('rolId').value = role.id;
      $('rolNombre').value = role.nombre;
    }
  }
  $('rolModal')?.classList.add('active');
}

const closeRolModal = () => $('rolModal')?.classList.remove('active');

async function handleRolSubmit(e) {
  e.preventDefault();
  const id = $('rolId').value;
  const nombre = $('rolNombre').value.trim();
  if (!nombre) {
    return showToast('Formulario incompleto', 'Ingrese el nombre del rol.', 'warning');
  }
  const isEdit = !!id;
  try {
    await apiRequest(isEdit ? `/api/roles/${id}` : '/api/roles', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre })
    });
    showToast(isEdit ? 'Rol actualizado' : 'Rol creado', `El rol ${nombre} se guardó correctamente.`);
    closeRolModal();
    getRoles();
  } catch (error) {
    showToast('Error al guardar rol', error.message, 'error');
  }
}

async function deleteRol(id) {
  const role = state.roles.find(r => r.id === id);
  if (!role) return;
  if (confirm(`¿Confirma eliminación del rol "${role.nombre}"?`)) {
    try {
      await apiRequest(`/api/roles/${id}`, { method: 'DELETE' });
      showToast('Rol eliminado', `Se eliminó el rol ${role.nombre}.`);
      getRoles();
    } catch (error) {
      showToast('Error al eliminar rol', error.message, 'error');
    }
  }
}

// --- CRUD DE ASISTENTES ---
async function getAsistentes() {
  try {
    state.asistentes = await apiRequest('/api/asistentes');
    renderAsistentes(state.asistentes);
  } catch (error) {
    showToast('Error al cargar asistentes', error.message, 'error');
  }
}

function renderAsistentes(list) {
  const tableBody = $('asistentesTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-4">No se encontraron asistentes.</td></tr>`;
    return;
  }
  list.forEach(asi => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-4">${asi.id}</td>
      <td><strong>${asi.identificacion}</strong></td>
      <td>${asi.nombre}</td>
      <td>${asi.email}</td>
      <td class="text-end pe-4">
        <button class="btn btn-outline-secondary btn-sm me-1 edit-btn">✏️</button>
        <button class="btn btn-outline-danger btn-sm delete-btn">🗑️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => openAsistenteModal(asi.id));
    tr.querySelector('.delete-btn').addEventListener('click', () => deleteAsistente(asi.id));
    tableBody.appendChild(tr);
  });
}

function filterAsistentes() {
  const query = $('searchAsistente').value.toLowerCase().trim();
  const filtered = state.asistentes.filter(asi => 
    asi.nombre.toLowerCase().includes(query) || 
    asi.identificacion.toLowerCase().includes(query) || 
    asi.email.toLowerCase().includes(query)
  );
  renderAsistentes(filtered);
}

function openAsistenteModal(id = null) {
  const form = $('asistenteForm');
  if (form) form.reset();
  $('asistenteId').value = '';
  const validId = (id && typeof id !== 'object') ? id : null;
  $('asistenteModalTitle').textContent = validId ? 'Editar Asistente' : 'Crear Nuevo Asistente';
  if (validId) {
    const asi = state.asistentes.find(a => a.id === validId);
    if (asi) {
      $('asistenteId').value = asi.id;
      $('asiIdentificacion').value = asi.identificacion;
      $('asiNombre').value = asi.nombre;
      $('asiEmail').value = asi.email;
    }
  }
  $('asistenteModal')?.classList.add('active');
}

const closeAsistenteModal = () => $('asistenteModal')?.classList.remove('active');

async function handleAsistenteSubmit(e) {
  e.preventDefault();
  const id = $('asistenteId').value;
  const payload = {
    identificacion: $('asiIdentificacion').value.trim(),
    nombre: $('asiNombre').value.trim(),
    email: $('asiEmail').value.trim()
  };
  const isEdit = !!id;
  try {
    await apiRequest(isEdit ? `/api/asistentes/${id}` : '/api/asistentes', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    showToast(isEdit ? 'Asistente Actualizado' : 'Asistente Creado', `Se guardó correctamente a ${payload.nombre}`);
    closeAsistenteModal();
    getAsistentes();
  } catch (error) {
    showToast('Error al guardar asistente', error.message, 'error');
  }
}

async function deleteAsistente(id) {
  const asi = state.asistentes.find(a => a.id === id);
  if (!asi) return;
  if (confirm(`¿Está seguro de eliminar al asistente "${asi.nombre}"?`)) {
    try {
      await apiRequest(`/api/asistentes/${id}`, { method: 'DELETE' });
      showToast('Asistente Elimino', `Se removió correctamente.`);
      getAsistentes();
    } catch (error) {
      showToast('Conflicto al eliminar', error.message, 'error');
    }
  }
}

// --- CRUD DE EVENTOS ---
async function getEventos() {
  try {
    const res = await apiRequest('/api/eventos?limit=100');
    state.eventos = res.data;
    renderEventos(state.eventos);
  } catch (error) {
    showToast('Error al cargar eventos', error.message, 'error');
  }
}

function renderEventos(list) {
  const tableBody = $('eventosTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';
  if (list.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-4">No se encontraron eventos.</td></tr>`;
    return;
  }
  list.forEach(eve => {
    const isPast = new Date(eve.fecha_inicio) < new Date();
    const badgeClass = isPast ? 'bg-danger-subtle text-danger border border-danger border-opacity-10' : 'bg-success-subtle text-success border border-success border-opacity-10';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-4">${eve.id}</td>
      <td><strong>${eve.nombre}</strong></td>
      <td>${formatDateTime(eve.fecha_inicio)}</td>
      <td>${eve.capacidad} personas</td>
      <td>${eve.ubicacion || 'No definida'}</td>
      <td><span class="badge ${badgeClass}">${isPast ? 'Finalizado' : 'Activo'}</span></td>
      <td class="text-end pe-4">
        <button class="btn btn-outline-secondary btn-sm me-1 edit-btn">✏️</button>
        <button class="btn btn-outline-danger btn-sm delete-btn">🗑️</button>
      </td>
    `;
    tr.querySelector('.edit-btn').addEventListener('click', () => openEventoModal(eve.id));
    tr.querySelector('.delete-btn').addEventListener('click', () => deleteEvento(eve.id));
    tableBody.appendChild(tr);
  });
}

function filterEventos() {
  const query = $('searchEvento').value.toLowerCase().trim();
  const filtered = state.eventos.filter(eve => 
    eve.nombre.toLowerCase().includes(query) || 
    eve.ubicacion.toLowerCase().includes(query)
  );
  renderEventos(filtered);
}

function openEventoModal(id = null) {
  const form = $('eventoForm');
  if (form) form.reset();
  $('eventoId').value = '';
  const validId = (id && typeof id !== 'object') ? id : null;
  $('eventoModalTitle').textContent = validId ? 'Editar Evento' : 'Crear Nuevo Evento';
  if (validId) {
    const eve = state.eventos.find(e => e.id === validId);
    if (eve) {
      $('eventoId').value = eve.id;
      $('eveNombre').value = eve.nombre;
      if ($('eveFechaInicio')) {
        const date = new Date(eve.fecha_inicio);
        const tzOffset = date.getTimezoneOffset() * 60000;
        $('eveFechaInicio').value = new Date(date - tzOffset).toISOString().slice(0, 16);
      }
      $('eveCapacidad').value = eve.capacidad;
      $('eveUbicacion').value = eve.ubicacion || '';
    }
  }
  $('eventoModal')?.classList.add('active');
}

const closeEventoModal = () => $('eventoModal')?.classList.remove('active');

async function handleEventoSubmit(e) {
  e.preventDefault();
  const id = $('eventoId').value;
  const payload = {
    nombre: $('eveNombre').value.trim(),
    fecha_inicio: $('eveFechaInicio').value,
    capacidad: parseInt($('eveCapacidad').value),
    ubicacion: $('eveUbicacion').value.trim()
  };
  const isEdit = !!id;
  try {
    await apiRequest(isEdit ? `/api/eventos/${id}` : '/api/eventos', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    showToast(isEdit ? 'Evento Actualizado' : 'Evento Creado', `Se guardó correctamente "${payload.nombre}"`);
    closeEventoModal();
    getEventos();
  } catch (error) {
    showToast('Error al guardar evento', error.message, 'error');
  }
}

async function deleteEvento(id) {
  const eve = state.eventos.find(e => e.id === id);
  if (!eve) return;
  if (confirm(`¿Está seguro de eliminar el evento "${eve.nombre}"?`)) {
    try {
      // Si el usuario actual es admin, permitir forzar eliminación de eventos con inscripciones
      const forceParam = (state.usuario && state.usuario.rol && state.usuario.rol.toLowerCase() === 'admin') ? '?force=true' : '';
      await apiRequest(`/api/eventos/${id}${forceParam}`, { method: 'DELETE' });
      showToast('Evento Eliminado', `Se removió el evento correctamente.`);
      getEventos();
    } catch (error) {
      showToast('Conflicto al eliminar', error.message, 'error');
    }
  }
}

// --- INSCRIPCIONES (TRANSACCIONAL) ---
async function populateInscripcionesSelectors() {
  const selectAsistente = $('regAsistenteSelect');
  const checkboxList = $('regEventosCheckboxList');
  if (!selectAsistente || !checkboxList) return;
  try {
    const [asistentesRes, eventosRes] = await Promise.all([
      apiRequest('/api/asistentes'),
      apiRequest('/api/eventos?limit=100')
    ]);
    state.asistentes = asistentesRes;
    state.eventos = eventosRes.data;
    
    selectAsistente.innerHTML = '<option value="">-- Seleccione un asistente --</option>';
    state.asistentes.forEach(asi => {
      const option = document.createElement('option');
      option.value = asi.id;
      option.textContent = `${asi.nombre} (${asi.identificacion})`;
      selectAsistente.appendChild(option);
    });
    
    checkboxList.innerHTML = '';
    const activeEvents = state.eventos.filter(eve => new Date(eve.fecha_inicio) >= new Date());
    if (activeEvents.length === 0) {
      checkboxList.innerHTML = `<div class="text-center text-secondary py-3">No hay eventos activos programados a futuro.</div>`;
    } else {
      activeEvents.forEach(eve => {
        const div = document.createElement('div');
        div.className = 'form-check d-flex align-items-start gap-2 p-2 border-bottom border-secondary-subtle';
        div.innerHTML = `
          <input class="form-check-input ms-0 me-2" type="checkbox" name="registrosEventos" id="chkEve${eve.id}" value="${eve.id}">
          <label class="form-check-label flex-grow-1 cursor-pointer" for="chkEve${eve.id}">
            <div class="fw-bold text-white small">${eve.nombre}</div>
            <div class="text-secondary" style="font-size: 0.75rem;">📅 ${formatDateTime(eve.fecha_inicio)} | 📍 ${eve.ubicacion || 'Por definir'} | 👥 Capacidad: ${eve.capacidad}</div>
          </label>
        `;
        checkboxList.appendChild(div);
      });
    }
    getRecentRegistrations();
  } catch (error) {
    showToast('Error de carga', 'No se pudieron inicializar los selectores de inscripción.', 'error');
  }
}

async function getRecentRegistrations() {
  try {
    const res = await apiRequest('/api/registros?limit=10');
    state.registros = res.data;
    renderRecentRegistrations(state.registros);
  } catch (error) {
    showToast('Error al cargar historial', error.message, 'error');
  }
}

function renderRecentRegistrations(list) {
  const container = $('registrosListContainer');
  if (!container) return;
  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = `<div class="text-center text-secondary py-4">No se registran inscripciones recientes.</div>`;
    return;
  }
  list.forEach(reg => {
    const item = document.createElement('div');
    item.className = 'p-3 border border-secondary-subtle rounded-3 bg-dark bg-opacity-25 d-flex flex-column gap-2';
    const badgesHtml = reg.asistencias.map(ast => 
      `<span class="badge bg-success-subtle text-success border border-success border-opacity-10" style="font-size: 0.7rem;">${ast.evento_nombre}</span>`
    ).join(' ');
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span class="fw-bold text-white small">${reg.asistente_nombre}</span>
        <span class="text-secondary" style="font-size: 0.75rem;">${formatDateTime(reg.fecha)}</span>
      </div>
      <div class="small text-secondary" style="font-size: 0.8rem;">C.I. ${reg.asistente_identificacion}</div>
      <div class="d-flex flex-wrap gap-1">${badgesHtml}</div>
      <div class="text-end">
        <button class="btn btn-outline-danger btn-sm py-1 px-2 cancel-btn" style="font-size: 0.75rem;">Anular</button>
      </div>
    `;
    item.querySelector('.cancel-btn').addEventListener('click', () => cancelRegistration(reg.id));
    container.appendChild(item);
  });
}

async function handleRegistroSubmit(e) {
  e.preventDefault();
  const selectAsistente = $('regAsistenteSelect');
  const checkedBoxes = document.querySelectorAll('input[name="registrosEventos"]:checked');
  if (!selectAsistente.value) return showToast('Formulario Incompleto', 'Seleccione un asistente.', 'warning');
  if (checkedBoxes.length === 0) return showToast('Formulario Incompleto', 'Seleccione al menos un evento.', 'warning');
  const payload = {
    asi_id: parseInt(selectAsistente.value),
    eventos: Array.from(checkedBoxes).map(cb => parseInt(cb.value))
  };
  try {
    await apiRequest('/api/registros', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Inscripción Registrada', 'Se procesó la inscripción transaccional correctamente.');
    populateInscripcionesSelectors();
  } catch (error) {
    if (error.details && Array.isArray(error.details)) {
      const errorMsg = error.details.map(d => `• ${d.evento || 'Evento'}: ${d.error}`).join('\n');
      alert(`La inscripción falló y se revirtieron todos los cambios (ROLLBACK):\n\n${errorMsg}`);
    } else {
      showToast('Fallo Transaccional', error.message, 'error');
    }
  }
}

async function cancelRegistration(id) {
  if (confirm('¿Está seguro de anular esta inscripción? Esta acción revertirá la cabecera y el detalle de asistencia.')) {
    try {
      await apiRequest(`/api/registros/${id}`, { method: 'DELETE' });
      showToast('Registro Anulado', 'Inscripción y asistencias eliminadas correctamente.');
      populateInscripcionesSelectors();
    } catch (error) {
      showToast('Fallo al anular', error.message, 'error');
    }
  }
}

// --- REPORTES ---
async function getReportes() {
  try {
    const res = await apiRequest('/api/reportes/inscripciones');
    renderReportes(res.data);
  } catch (error) {
    showToast('Error al cargar reportes', error.message, 'error');
  }
}

async function exportReportes() {
  try {
    if (!state.token) throw new Error('No autorizado');
    const response = await fetch(`${API_URL}/api/reportes/inscripciones?export=xlsx`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });

    if (response.status === 401) {
      showToast('Sesión Caducada', 'Inicie sesión de nuevo', 'warning');
      handleLogout();
      return;
    }
    if (response.status === 403) {
      const payload = await response.json().catch(() => null);
      showToast('Acceso Denegado', payload?.mensaje || 'No tiene permisos para exportar', 'warning');
      return;
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.mensaje || 'Error al exportar reportes');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inscripciones-reportes.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Exportación descargada', 'El archivo CSV se descargó correctamente.', 'success');
  } catch (error) {
    showToast('Error de exportación', error.message, 'error');
  }
}

function renderReportes(reportes) {
  const statsContainer = $('statsSummaryContainer');
  const tableBody = $('reportesTableBody');
  if (!statsContainer || !tableBody) return;
  
  const totalEventos = reportes.length;
  let totalInscritos = 0, totalCapacidad = 0;
  reportes.forEach(rep => {
    totalInscritos += rep.inscritos_reales || 0;
    totalCapacidad += rep.capacidad_total || 0;
  });
  const avgOcupacion = totalCapacidad > 0 ? ((totalInscritos / totalCapacidad) * 100).toFixed(1) : 0;
  
  statsContainer.innerHTML = `
    <div class="col">
      <div class="card border border-secondary-subtle bg-body-tertiary shadow p-4 d-flex flex-column gap-2 h-100">
        <span class="text-secondary small text-uppercase fw-semibold tracking-wider">Total de Eventos</span>
        <span class="fs-2 fw-extrabold text-white">${totalEventos}</span>
      </div>
    </div>
    <div class="col">
      <div class="card border border-secondary-subtle bg-body-tertiary shadow p-4 d-flex flex-column gap-2 h-100">
        <span class="text-secondary small text-uppercase fw-semibold tracking-wider">Inscritos Totales</span>
        <span class="fs-2 fw-extrabold text-primary">${totalInscritos}</span>
      </div>
    </div>
    <div class="col">
      <div class="card border border-secondary-subtle bg-body-tertiary shadow p-4 d-flex flex-column gap-2 h-100">
        <span class="text-secondary small text-uppercase fw-semibold tracking-wider">Capacidad Total</span>
        <span class="fs-2 fw-extrabold text-white">${totalCapacidad}</span>
      </div>
    </div>
    <div class="col">
      <div class="card border border-secondary-subtle bg-body-tertiary shadow p-4 d-flex flex-column gap-2 h-100">
        <span class="text-secondary small text-uppercase fw-semibold tracking-wider">Llenado Promedio</span>
        <span class="fs-2 fw-extrabold text-success mb-1">${avgOcupacion}%</span>
        <div class="progress" role="progressbar" aria-valuenow="${avgOcupacion}" aria-valuemin="0" aria-valuemax="100" style="height: 6px;">
          <div class="progress-bar bg-success" style="width: ${avgOcupacion}%"></div>
        </div>
      </div>
    </div>
  `;
  
  tableBody.innerHTML = '';
  if (reportes.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-4">No hay registros ni reportes de eventos.</td></tr>`;
    return;
  }
  reportes.forEach(rep => {
    const ocupacion = rep.porcentaje_ocupacion || 0;
    let badgeClass = 'bg-success-subtle text-success border border-success border-opacity-10';
    if (ocupacion >= 90) badgeClass = 'bg-danger-subtle text-danger border border-danger border-opacity-10';
    else if (ocupacion >= 50) badgeClass = 'bg-warning-subtle text-warning border border-warning border-opacity-10';
    
    let asistentesHtml = '<span class="text-secondary small">Sin inscritos</span>';
    if (rep.asistentes && rep.asistentes.length > 0) {
      asistentesHtml = `
        <select class="form-select form-select-sm" style="max-width: 200px;">
          <option>Ver inscritos (${rep.asistentes.length})</option>
          ${rep.asistentes.map(a => `<option disabled>${a.asistente_nombre} (${a.asistente_identificacion})</option>`).join('')}
        </select>
      `;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ps-4"><strong>${rep.evento_nombre}</strong></td>
      <td>${formatDateTime(rep.evento_fecha_inicio)}</td>
      <td>${rep.capacidad_total}</td>
      <td>${rep.inscritos_reales}</td>
      <td>${rep.cupos_disponibles}</td>
      <td><span class="badge ${badgeClass}">${ocupacion}%</span></td>
      <td class="pe-4">${asistentesHtml}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// FUNCIONES AUXILIARES
function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + 
         date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// EXPORT TO WINDOW FOR DYNAMIC EVENT ATTACHMENTS
window.openAsistenteModal = openAsistenteModal;
window.closeAsistenteModal = closeAsistenteModal;
window.editAsistente = openAsistenteModal;
window.deleteAsistente = deleteAsistente;
window.openEventoModal = openEventoModal;
window.closeEventoModal = closeEventoModal;
window.editEvento = openEventoModal;
window.deleteEvento = deleteEvento;
window.cancelRegistration = cancelRegistration;
window.openUsuarioModal = openUsuarioModal;
window.closeUsuarioModal = closeUsuarioModal;
window.editUsuario = openUsuarioModal;
window.deleteUsuario = deleteUsuario;
window.openRolModal = openRolModal;
window.closeRolModal = closeRolModal;
window.editRol = openRolModal;
window.deleteRol = deleteRol;
