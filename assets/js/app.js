// ========== ESTADO GLOBAL ==========
const appState = {
  agenda: {
    fecha: new Date().toISOString().slice(0, 10),
    dia_semana: '',
    tareas_criticas: [],
    tareas: [],
    notas: '',
    sentimientos: '',
    citas: [],
    personas: []
  },
  calendar: {
    currentDate: new Date(),
    selectedDate: null
  },
  sync: {
    autoSaveTimer: null,
    saveQueue: [],
    isSaving: false
  },
  ui: {
    tareaSeleccionada: null,
    tareaEditando: null,
    criticaEditando: null,
    mostrarLargoPlazo: true
  },
  filtros: {
    criticas: {
      estado: '',
      fecha: '',
      persona: '',
      etiqueta: ''
    },
    tareas: {
      estado: '',
      fecha: '',
      persona: '',
      etiqueta: ''
    }
  }
};

// ========== CONFIGURACIÓN EXTENDSCLASS ==========
// Compatibilidad con Firebase
function getExtendsClassConfig() {
  return { configured: true };
}

// ========== DETECCIÓN DE DISPOSITIVO ==========
const isMobile = () => {
  return window.innerWidth <= 1024 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
};

const isTabletOrMobile = () => {
  return window.innerWidth <= 1024 && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
};

const isDesktop = () => {
  return !isMobile() && window.matchMedia('(pointer: fine)').matches;
};

// ========== INICIALIZACIÓN PRINCIPAL ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('Iniciando aplicación...');
  window.appStartTime = Date.now();
  
  // Aplicar clases adaptativas
  document.body.classList.add(isMobile() ? 'mobile-device' : 'desktop-device');
  
  // Cargar configuración visual guardada
  cargarConfigVisual();
  
  // Cargar configuración de opciones
  cargarConfigOpciones();
  
  actualizarFecha();
  initializeCalendar();
  renderCalendar();
  
  // Renderizar estado inicial (puede estar vacío)
  renderizar();

  // Firebase se inicializa automáticamente en sincronizacion-simple.js
  
  // Inicializar calendario integrado si está visible
  setTimeout(() => {
    const calendarioIntegrado = document.getElementById('calendario-citas-integrado');
    if (calendarioIntegrado && calendarioIntegrado.style.display === 'block') {
      if (typeof initializeCalendarioIntegrado === 'function') {
        initializeCalendarioIntegrado();
      }
    }
  }, 500);
  
  // Listener optimizado para cambios en notas
  const notasEl = document.getElementById('notas-texto');
  if (notasEl) {
    const optimizedHandler = debounce(() => {
      appState.agenda.notas = notasEl.value;
      autoResizeTextarea(notasEl);
      autoCapitalize(notasEl);
      scheduleAutoSave();
    }, 300);
    
    notasEl.addEventListener('input', optimizedHandler);
    autoResizeTextarea(notasEl);
  }
  
  // Listener optimizado para cambios en sentimientos
  const sentimientosEl = document.getElementById('sentimientos-texto');
  if (sentimientosEl) {
    const optimizedHandler = debounce(() => {
      appState.agenda.sentimientos = sentimientosEl.value;
      guardarSentimiento(sentimientosEl.value);
      autoResizeTextarea(sentimientosEl);
      autoCapitalize(sentimientosEl);
      scheduleAutoSave();
    }, 300);
    
    sentimientosEl.addEventListener('input', optimizedHandler);
    autoResizeTextarea(sentimientosEl);
  }
  
  // Configurar auto-capitalización
  setupAutoCapitalize();
  
  // Configurar header colapsable en móvil
  if (isMobile()) {
    const headerCenter = document.querySelector('.header-center');
    let headerTimer;
    
    const collapseHeader = () => {
      headerCenter.classList.add('collapsed');
    };
    
    const expandHeader = () => {
      headerCenter.classList.remove('collapsed');
      clearTimeout(headerTimer);
      headerTimer = setTimeout(collapseHeader, 5000);
    };
    
    headerCenter.addEventListener('click', expandHeader);
    
    // Auto-colapsar después de 5 segundos
    headerTimer = setTimeout(collapseHeader, 5000);
  }
  
  // Firebase maneja la sincronización automática
});

function actualizarFecha() {
  const hoy = new Date();
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('fecha-actual').textContent = hoy.toLocaleDateString('es-ES', opciones);
}

// ========== UTILIDADES ==========
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function escapeXml(text) {
  return escapeHtml(text);
}

function mostrarAlerta(mensaje, tipo) {
  // Crear toast notification
  const toast = document.createElement('div');
  toast.className = `toast-notification ${tipo}`;
  toast.textContent = mensaje;
  
  document.body.appendChild(toast);
  
  // Mostrar con animación
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Ocultar y eliminar
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// ========== FUNCIONES DE FECHA ==========
function esFechaHoy(fecha) {
  if (!fecha) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return fecha === hoy;
}

function esFechaPasada(fecha) {
  if (!fecha) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return fecha < hoy;
}

function esLargoPlazo(fecha) {
  if (!fecha) return false;
  const hoy = new Date();
  const fechaTarea = new Date(fecha);
  const diferenciaDias = Math.ceil((fechaTarea - hoy) / (1000 * 60 * 60 * 24));
  return diferenciaDias > 15;
}

// ========== AUTO-RESIZE TEXTAREA ==========
function autoResizeTextarea(textarea) {
  if (!textarea) return;
  
  // Resetear altura para calcular correctamente
  textarea.style.height = 'auto';
  
  // Calcular nueva altura basada en el contenido
  const scrollHeight = textarea.scrollHeight;
  const minHeight = 60; // min-height del CSS
  const maxHeight = 300; // max-height del CSS
  
  // Si no hay contenido, usar altura mínima
  if (!textarea.value.trim()) {
    textarea.style.height = minHeight + 'px';
    return;
  }
  
  // Ajustar altura entre min y max
  const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
  textarea.style.height = newHeight + 'px';
}

// ========== AUTO-CAPITALIZE ==========
function autoCapitalize(input) {
  const cursorPos = input.selectionStart;
  const value = input.value;
  
  // Solo capitalizar la primera letra del texto completo
  if (value.length > 0 && cursorPos === 1) {
    const newValue = value[0].toUpperCase() + value.substring(1);
    input.value = newValue;
    input.setSelectionRange(cursorPos, cursorPos);
  }
}

function setupAutoCapitalize() {
  // Aplicar a todos los inputs de texto y textareas
  document.querySelectorAll('input[type="text"], textarea, #cita-descripcion').forEach(input => {
    input.addEventListener('input', () => autoCapitalize(input));
  });
}

// ========== AUTO-SAVE ==========
function scheduleAutoSave() {
  // Auto-guardado con Firebase cada 5 segundos después de cambios
  if (appState.sync.autoSaveTimer) clearTimeout(appState.sync.autoSaveTimer);
  appState.sync.autoSaveTimer = setTimeout(() => {
    guardarJSON(true);
  }, 5000);
}

// Cerrar modal al hacer clic fuera
window.onclick = (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
};

function cargarConfigOpciones() {
  const config = JSON.parse(localStorage.getItem('config-opciones') || '{}');
  // Aplicar configuración por defecto si no existe
  if (!localStorage.getItem('config-opciones')) {
    const configDefault = {
      forzarFecha: false,
      sinTactil: false,
      mostrarTodo: false,
      botonesBorrar: false
    };
    localStorage.setItem('config-opciones', JSON.stringify(configDefault));
  }
}

function cargarConfigVisual() {
  const config = JSON.parse(localStorage.getItem('config-visual') || '{}');
  console.log('📊 Cargando configuración visual:', config);
  
  const tema = config.tema || 'verde';
  document.body.classList.remove('tema-verde', 'tema-azul', 'tema-amarillo', 'tema-oscuro');
  document.body.classList.add('tema-' + tema);
  
  // Actualizar título si hay nombre configurado
  const nombre = config.nombre || 'Pablo';
  const titulo = document.getElementById('titulo-agenda');
  if (titulo) {
    titulo.textContent = '🧠 Agenda de ' + nombre + ' 😊';
  }
  
  // Mostrar/ocultar secciones
  const mostrarNotas = config.mostrarNotas !== false;
  const mostrarSentimientos = config.mostrarSentimientos !== false;
  const seccionNotas = document.getElementById('seccion-notas');
  const seccionSentimientos = document.getElementById('seccion-sentimientos');
  if (seccionNotas) seccionNotas.style.display = mostrarNotas ? 'block' : 'none';
  if (seccionSentimientos) seccionSentimientos.style.display = mostrarSentimientos ? 'block' : 'none';
  
  // Configurar visualización del calendario de citas
  const calendarioCitas = config.calendarioCitas || 'boton';
  const btnCalendario = document.getElementById('btn-calendario-citas');
  const calendarioIntegrado = document.getElementById('calendario-citas-integrado');
  
  console.log('📅 Modo calendario:', calendarioCitas);
  
  if (calendarioCitas === 'integrado') {
    if (btnCalendario) btnCalendario.style.display = 'none';
    if (calendarioIntegrado) calendarioIntegrado.style.display = 'block';
  } else {
    if (btnCalendario) btnCalendario.style.display = 'inline-block';
    if (calendarioIntegrado) calendarioIntegrado.style.display = 'none';
  }
}

// Hacer funciones disponibles globalmente para compatibilidad
window.appState = appState;
window.getExtendsClassConfig = getExtendsClassConfig;
window.isMobile = isMobile;
window.isTabletOrMobile = isTabletOrMobile;
window.isDesktop = isDesktop;
window.debounce = debounce;
window.escapeHtml = escapeHtml;
window.escapeXml = escapeXml;
window.mostrarAlerta = mostrarAlerta;
window.esFechaHoy = esFechaHoy;
window.esFechaPasada = esFechaPasada;
window.esLargoPlazo = esLargoPlazo;
window.autoResizeTextarea = autoResizeTextarea;
window.autoCapitalize = autoCapitalize;
window.setupAutoCapitalize = setupAutoCapitalize;
window.scheduleAutoSave = scheduleAutoSave;
window.cargarConfigOpciones = cargarConfigOpciones;
window.cargarConfigVisual = cargarConfigVisual;


// ========== CONFIGURACIÓN VISUAL ==========
function guardarConfigVisualPanel() {
  const config = {
    tema: document.getElementById('config-tema-select')?.value || 'verde',
    nombre: document.getElementById('config-nombre-input')?.value || 'Pablo',
    modoVisualizacion: document.getElementById('config-modo-visualizacion')?.value || 'estado',
    popupCelebracion: document.getElementById('config-popup-celebracion')?.checked !== false,
    mostrarNotas: document.getElementById('config-mostrar-notas')?.checked !== false,
    mostrarSentimientos: document.getElementById('config-mostrar-sentimientos')?.checked !== false,
    calendarioCitas: document.getElementById('config-calendario-citas')?.value || 'boton',
    frases: document.getElementById('config-frases-motivacionales')?.value.split('\n').filter(f => f.trim()) || []
  };
  
  console.log('💾 Guardando configuración visual:', config);
  localStorage.setItem('config-visual', JSON.stringify(config));
  
  // Aplicar configuración inmediatamente
  cargarConfigVisual();
  
  // Sincronizar con Firebase
  if (typeof guardarConfigEnFirebase === 'function') {
    console.log('🔥 Sincronizando con Firebase...');
    guardarConfigEnFirebase();
  } else {
    console.warn('⚠️ guardarConfigEnFirebase no disponible');
  }
  
  mostrarAlerta('✅ Configuración visual guardada', 'success');
}

function switchTab(tabName) {
  // Ocultar todos los contenidos
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Desactivar todos los botones
  document.querySelectorAll('.config-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Activar el tab seleccionado
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  // Activar el botón correspondiente
  event.target.classList.add('active');
  
  // Cargar datos específicos del tab
  if (tabName === 'visual') {
    cargarConfigVisualEnFormulario();
  } else if (tabName === 'funcionales') {
    cargarConfigFuncionalesEnFormulario();
  } else if (tabName === 'etiquetas') {
    if (typeof cargarListaEtiquetas === 'function') {
      cargarListaEtiquetas();
    }
  } else if (tabName === 'personas') {
    if (typeof cargarListaPersonas === 'function') {
      cargarListaPersonas();
    }
  } else if (tabName === 'backups') {
    if (typeof cargarListaSalvados === 'function') {
      cargarListaSalvados();
    }
  } else if (tabName === 'log') {
    if (typeof cargarLog === 'function') {
      cargarLog();
    }
  }
}

function cargarConfigVisualEnFormulario() {
  const config = JSON.parse(localStorage.getItem('config-visual') || '{}');
  console.log('📝 Cargando configuración visual en formulario:', config);
  
  const temaSelect = document.getElementById('config-tema-select');
  if (temaSelect) temaSelect.value = config.tema || 'verde';
  
  const nombreInput = document.getElementById('config-nombre-input');
  if (nombreInput) nombreInput.value = config.nombre || 'Pablo';
  
  const modoVisualizacion = document.getElementById('config-modo-visualizacion');
  if (modoVisualizacion) modoVisualizacion.value = config.modoVisualizacion || 'estado';
  
  const popupCelebracion = document.getElementById('config-popup-celebracion');
  if (popupCelebracion) popupCelebracion.checked = config.popupCelebracion !== false;
  
  const mostrarNotas = document.getElementById('config-mostrar-notas');
  if (mostrarNotas) mostrarNotas.checked = config.mostrarNotas !== false;
  
  const mostrarSentimientos = document.getElementById('config-mostrar-sentimientos');
  if (mostrarSentimientos) mostrarSentimientos.checked = config.mostrarSentimientos !== false;
  
  const calendarioCitas = document.getElementById('config-calendario-citas');
  if (calendarioCitas) {
    calendarioCitas.value = config.calendarioCitas || 'boton';
    console.log('📅 Calendario citas configurado como:', calendarioCitas.value);
  }
  
  const frasesMotivacionales = document.getElementById('config-frases-motivacionales');
  if (frasesMotivacionales) frasesMotivacionales.value = (config.frases || []).join('\n');
}

function cargarConfigFuncionalesEnFormulario() {
  const config = JSON.parse(localStorage.getItem('config-funcionales') || '{}');
  
  const fechaObligatoria = document.getElementById('config-fecha-obligatoria');
  if (fechaObligatoria) fechaObligatoria.checked = config.fechaObligatoria || false;
  
  const confirmacionBorrar = document.getElementById('config-confirmacion-borrar');
  if (confirmacionBorrar) confirmacionBorrar.checked = config.confirmacionBorrar !== false;
  
  const autoMayuscula = document.getElementById('config-auto-mayuscula');
  if (autoMayuscula) autoMayuscula.checked = config.autoMayuscula !== false;
  
  const popupDiario = document.getElementById('config-popup-diario');
  if (popupDiario) popupDiario.checked = config.popupDiario || false;
  
  const notificacionesActivas = document.getElementById('config-notificaciones-activas');
  if (notificacionesActivas) notificacionesActivas.checked = config.notificacionesActivas || false;
  
  const notif1Dia = document.getElementById('config-notif-1-dia');
  if (notif1Dia) notif1Dia.checked = config.notif1Dia || false;
  
  const notif2Horas = document.getElementById('config-notif-2-horas');
  if (notif2Horas) notif2Horas.checked = config.notif2Horas || false;
  
  const notif30Min = document.getElementById('config-notif-30-min');
  if (notif30Min) notif30Min.checked = config.notif30Min || false;
}

function guardarConfigFuncionales() {
  const config = {
    fechaObligatoria: document.getElementById('config-fecha-obligatoria')?.checked || false,
    confirmacionBorrar: document.getElementById('config-confirmacion-borrar')?.checked !== false,
    autoMayuscula: document.getElementById('config-auto-mayuscula')?.checked !== false,
    popupDiario: document.getElementById('config-popup-diario')?.checked || false,
    notificacionesActivas: document.getElementById('config-notificaciones-activas')?.checked || false,
    notif1Dia: document.getElementById('config-notif-1-dia')?.checked || false,
    notif2Horas: document.getElementById('config-notif-2-horas')?.checked || false,
    notif30Min: document.getElementById('config-notif-30-min')?.checked || false
  };
  
  localStorage.setItem('config-funcionales', JSON.stringify(config));
  
  // Sincronizar con Firebase si está disponible
  if (typeof guardarConfigEnFirebase === 'function') {
    guardarConfigEnFirebase();
  }
  
  mostrarAlerta('✅ Configuración funcional guardada', 'success');
}

function toggleConfigFloating() {
  abrirModal('modal-config');
  // Cargar configuración visual por defecto
  cargarConfigVisualEnFormulario();
}

window.guardarConfigVisualPanel = guardarConfigVisualPanel;
window.switchTab = switchTab;
window.cargarConfigVisualEnFormulario = cargarConfigVisualEnFormulario;
window.cargarConfigFuncionalesEnFormulario = cargarConfigFuncionalesEnFormulario;
window.guardarConfigFuncionales = guardarConfigFuncionales;
window.toggleConfigFloating = toggleConfigFloating;
