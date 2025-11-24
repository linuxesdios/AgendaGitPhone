// ========== SUPABASE SYNC - ALTERNATIVA A FIREBASE ==========
// Mantiene la misma estructura de datos pero sin límites de peticiones

// ========== CONFIGURACIÓN GLOBAL ==========
window.supabaseClient = null;
window.currentSyncMethod = localStorage.getItem('syncMethod') || 'firebase';
window.supabaseRealtimeChannel = null;

// ========== CONFIGURACIÓN DE SUPABASE ==========
function getSupabaseConfig() {
  return {
    url: localStorage.getItem('supabase_url') || '',
    key: localStorage.getItem('supabase_key') || '',
    serviceKey: localStorage.getItem('supabase_service_key') || ''
  };
}

function saveSupabaseConfig(url, key, serviceKey = '') {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  if (serviceKey) {
    localStorage.setItem('supabase_service_key', serviceKey);
  }
  console.log('⚡ Configuración de Supabase guardada');
}

// ========== INICIALIZACIÓN DE SUPABASE ==========
async function initSupabase() {
  const config = getSupabaseConfig();

  if (!config.url || !config.key) {
    console.warn('⚠️ Configuración de Supabase incompleta');
    return false;
  }

  try {
    // Usar la librería Supabase cargada desde CDN
    const { createClient } = supabase;
    window.supabaseClient = createClient(config.url, config.key);

    console.log('⚡ Supabase inicializado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error inicializando Supabase:', error);
    return false;
  }
}

// ========== FUNCIONES DE INTERFAZ ==========
function guardarConfigSupabase() {
  const url = document.getElementById('supabase-url').value;
  const key = document.getElementById('supabase-key').value;
  const serviceKey = document.getElementById('supabase-service-key').value;

  if (!url || !key) {
    alert('⚠️ URL y Anon Key son obligatorios');
    return;
  }

  saveSupabaseConfig(url, key, serviceKey);
  showSupabaseStatus('✅ Configuración guardada correctamente', 'success');
}

async function probarConexionSupabase() {
  showSupabaseStatus('🔄 Probando conexión...', 'info');

  const connected = await initSupabase();

  if (connected) {
    try {
      // Probar conexión básica primero
      const { data, error } = await window.supabaseClient
        .from('agenda_data')
        .select('*')
        .limit(1);

      if (error) {
        // Si error es porque la tabla no existe (primera vez)
        if (error.code === 'PGRST116' || error.message.includes('does not exist') || error.message.includes('schema cache')) {
          showSupabaseStatus('🆕 Primera vez detectada - Las tablas no existen todavía', 'info');

          // Preguntar automáticamente si quiere crear las tablas
          const shouldCreate = confirm(
            '🆕 ¡Primera vez usando Supabase!\n\n' +
            'Las tablas de la base de datos no existen todavía.\n' +
            '¿Quieres que las cree automáticamente?\n\n' +
            '✅ Sí - Crear tablas y configurar todo\n' +
            '❌ No - Solo verificar conexión'
          );

          if (shouldCreate) {
            showSupabaseStatus('🛠️ Creando tablas automáticamente...', 'info');
            await crearTablasSupabase();
          } else {
            showSupabaseStatus('✅ Conexión básica exitosa - Click "🛠️ Crear Tablas" cuando estés listo', 'success');
          }
        } else {
          throw error;
        }
      } else {
        showSupabaseStatus('✅ Conexión exitosa - Las tablas ya existen y funcionan', 'success');
      }
    } catch (error) {
      console.error('❌ Error probando conexión:', error);
      showSupabaseStatus('❌ Error de conexión: ' + error.message, 'error');
    }
  } else {
    showSupabaseStatus('❌ No se pudo inicializar Supabase - Verifica URL y Anon Key', 'error');
  }
}

async function crearTablasSupabase() {
  const connected = await initSupabase();
  if (!connected) {
    showSupabaseStatus('❌ Primero configura Supabase', 'error');
    return;
  }

  showSupabaseStatus('🛠️ Creando estructura de datos...', 'info');

  try {
    // Approach más simple: crear registros directamente
    // Supabase creará la tabla automáticamente con el primer insert si usamos el SQL editor

    // Datos iniciales para todas las colecciones
    const initialData = [
      {
        id: 'tareas',
        data: {
          tareas_criticas: [],
          tareas: [],
          listasPersonalizadas: []
        }
      },
      {
        id: 'citas',
        data: { citas: [] }
      },
      {
        id: 'config',
        data: {
          visual: {},
          funcionales: {},
          opciones: {}
        }
      },
      {
        id: 'notas',
        data: { notas: '' }
      },
      {
        id: 'sentimientos',
        data: { sentimientos: '' }
      },
      {
        id: 'contrasenas',
        data: { lista: [] }
      },
      {
        id: 'historial_eliminados',
        data: { items: [] }
      },
      {
        id: 'historial_tareas',
        data: { items: [] }
      },
      {
        id: 'personas',
        data: { lista: [] }
      },
      {
        id: 'etiquetas',
        data: {}
      },
      {
        id: 'log',
        data: { acciones: [] }
      },
      {
        id: 'salvados',
        data: {}
      }
    ];

    // Insertar cada registro
    for (const record of initialData) {
      try {
        const { error } = await window.supabaseClient
          .from('agenda_data')
          .upsert(record, { onConflict: 'id' });

        if (error && !error.message.includes('does not exist')) {
          console.warn(`⚠️ Error insertando ${record.id}:`, error);
        }
      } catch (itemError) {
        console.warn(`⚠️ Error con ${record.id}:`, itemError);
      }
    }

    // Verificar que al menos uno se insertó correctamente
    const { data: testData, error: testError } = await window.supabaseClient
      .from('agenda_data')
      .select('id')
      .limit(1);

    if (testError) {
      // Si aún hay error, mostrar instrucciones para crear tabla manualmente
      showSupabaseStatus(
        '⚠️ No se puede crear automáticamente. Crea la tabla manualmente: Ve al SQL Editor de Supabase y ejecuta: CREATE TABLE agenda_data (id text PRIMARY KEY, data jsonb, last_updated timestamp DEFAULT now());',
        'error'
      );

      // También mostrar el popup con instrucciones
      alert(
        '🛠️ INSTRUCCIONES PARA CREAR TABLA MANUALMENTE:\n\n' +
        '1. Ve a tu dashboard de Supabase\n' +
        '2. Click en "SQL Editor" en el menú izquierdo\n' +
        '3. Copia y pega este comando:\n\n' +
        'CREATE TABLE agenda_data (\n' +
        '  id text PRIMARY KEY,\n' +
        '  data jsonb,\n' +
        '  last_updated timestamp DEFAULT now()\n' +
        ');\n\n' +
        '4. Click "Run"\n' +
        '5. Vuelve aquí y prueba la conexión de nuevo'
      );
    } else {
      showSupabaseStatus('✅ ¡Estructura creada! Supabase está listo para usar', 'success');
    }
  } catch (error) {
    console.error('❌ Error creando estructura:', error);

    // Instrucciones claras para el usuario
    showSupabaseStatus('⚠️ Crear manualmente - Ver instrucciones en popup', 'error');

    alert(
      '🛠️ CREAR TABLA MANUALMENTE:\n\n' +
      '1. Ve a supabase.com → tu proyecto\n' +
      '2. Click "SQL Editor" (menú izquierdo)\n' +
      '3. Nueva query y pega:\n\n' +
      'CREATE TABLE agenda_data (\n' +
      '  id text PRIMARY KEY,\n' +
      '  data jsonb,\n' +
      '  last_updated timestamp DEFAULT now()\n' +
      ');\n\n' +
      '4. Click "Run"\n' +
      '5. Vuelve aquí y haz click "Probar" de nuevo'
    );
  }
}

// ========== FUNCIONES DE SINCRONIZACIÓN (PARALELAS A FIREBASE) ==========

// Equivalente a extendsClassPull() pero para Supabase
async function supabasePull() {
  if (window.currentSyncMethod !== 'supabase') return;

  const connected = await initSupabase();
  if (!connected) {
    console.warn('⚠️ Supabase no está configurado');
    return;
  }

  try {
    console.log('⚡ ========== SUPABASE PULL ==========');

    // Obtener todas las colecciones en paralelo
    const collections = [
      'tareas', 'citas', 'config', 'notas', 'sentimientos',
      'contrasenas', 'historial_eliminados', 'historial_tareas',
      'personas', 'etiquetas', 'log', 'salvados'
    ];

    const promises = collections.map(async (collection) => {
      const { data, error } = await window.supabaseClient
        .from('agenda_data')
        .select('data')
        .eq('id', collection)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn(`⚠️ Error cargando ${collection}:`, error);
        return { collection, data: null };
      }

      return { collection, data: data?.data || {} };
    });

    const results = await Promise.all(promises);

    // Aplicar datos a las variables globales (igual que Firebase)
    results.forEach(({ collection, data }) => {
      switch (collection) {
        case 'tareas':
          window.tareasData = data;
          if (data.tareas_criticas) window.appState.tareasCriticas = data.tareas_criticas;
          if (data.tareas) window.appState.tareas = data.tareas;
          if (data.listasPersonalizadas) window.configVisual.listasPersonalizadas = data.listasPersonalizadas;
          break;
        case 'citas':
          if (data.citas) window.appState.citas = data.citas;
          break;
        case 'config':
          if (data.visual) window.configVisual = { ...window.configVisual, ...data.visual };
          if (data.funcionales) window.configFuncionales = data.funcionales;
          if (data.opciones) window.configOpciones = data.opciones;
          break;
        case 'notas':
          if (data.notas !== undefined) window.appState.notas = data.notas;
          break;
        case 'sentimientos':
          if (data.sentimientos !== undefined) window.appState.sentimientos = data.sentimientos;
          break;
        case 'contrasenas':
          if (data.lista) window.appState.contrasenas = data.lista;
          break;
        case 'historial_eliminados':
          if (data.items) window.historialEliminados = data.items;
          break;
        case 'historial_tareas':
          if (data.items) window.historialTareas = data.items;
          break;
        case 'personas':
          if (data.lista) window.personasAsignadas = data.lista;
          break;
        case 'etiquetas':
          window.etiquetasData = data;
          break;
        case 'log':
          if (data.acciones) window.logAcciones = data.acciones;
          break;
        case 'salvados':
          window.salvadosData = data;
          break;
      }
    });

    console.log('✅ Pull de Supabase completado');

    // Renderizar interfaz igual que Firebase
    if (typeof renderizarInterfaz === 'function') {
      renderizarInterfaz();
    }

    return true;
  } catch (error) {
    console.error('❌ Error en supabasePull:', error);
    return false;
  }
}

// Equivalente a guardarJSON() pero para Supabase
async function supabasePush(isAutomatic = false) {
  if (window.currentSyncMethod !== 'supabase') return;

  const connected = await initSupabase();
  if (!connected) {
    console.warn('⚠️ Supabase no está configurado');
    return;
  }

  try {
    const logPrefix = isAutomatic ? '🔄 [AUTO-SYNC SUPABASE]' : '💾 [MANUAL SYNC SUPABASE]';
    console.log(`${logPrefix} Iniciando...`);

    // Preparar datos usando la misma estructura que Firebase
    const updates = [
      {
        id: 'tareas',
        data: {
          tareas_criticas: window.appState.tareasCriticas || [],
          tareas: window.appState.tareas || [],
          listasPersonalizadas: window.configVisual?.listasPersonalizadas || []
        }
      },
      {
        id: 'citas',
        data: { citas: window.appState.citas || [] }
      },
      {
        id: 'config',
        data: {
          visual: window.configVisual || {},
          funcionales: window.configFuncionales || {},
          opciones: window.configOpciones || {}
        }
      },
      {
        id: 'notas',
        data: { notas: window.appState.notas || '' }
      },
      {
        id: 'sentimientos',
        data: { sentimientos: window.appState.sentimientos || '' }
      },
      {
        id: 'contrasenas',
        data: { lista: window.appState.contrasenas || [] }
      },
      {
        id: 'historial_eliminados',
        data: { items: window.historialEliminados || [] }
      },
      {
        id: 'historial_tareas',
        data: { items: window.historialTareas || [] }
      },
      {
        id: 'personas',
        data: { lista: window.personasAsignadas || [] }
      },
      {
        id: 'etiquetas',
        data: window.etiquetasData || {}
      },
      {
        id: 'log',
        data: { acciones: window.logAcciones || [] }
      }
    ];

    // Hacer upserts (insert o update)
    const promises = updates.map(({ id, data }) =>
      window.supabaseClient
        .from('agenda_data')
        .upsert({ id, data }, { onConflict: 'id' })
    );

    await Promise.all(promises);

    console.log(`${logPrefix} ✅ Completado`);
    return true;
  } catch (error) {
    console.error('❌ Error en supabasePush:', error);
    return false;
  }
}

// ========== FUNCIONES DE CAMBIO DE MÉTODO ==========
function cambiarMetodoSync(metodo) {
  window.currentSyncMethod = metodo;
  localStorage.setItem('syncMethod', metodo);

  // Actualizar interfaz
  const statusCurrent = document.getElementById('sync-current');
  const realtimeStatus = document.getElementById('realtime-status');

  if (metodo === 'firebase') {
    statusCurrent.textContent = '🔥 Usando Firebase';
    realtimeStatus.textContent = '❌ Desactivado';
    stopSupabaseRealtime();
  } else {
    statusCurrent.textContent = '⚡ Usando Supabase';
    realtimeStatus.textContent = '✅ Activado';
    startSupabaseRealtime();
  }

  console.log(`🔄 Método de sincronización cambiado a: ${metodo}`);
}

// ========== REAL-TIME CON SUPABASE ==========
async function startSupabaseRealtime() {
  const connected = await initSupabase();
  if (!connected || window.currentSyncMethod !== 'supabase') return;

  try {
    // Crear canal de real-time
    window.supabaseRealtimeChannel = window.supabaseClient
      .channel('agenda-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_data'
        },
        (payload) => {
          console.log('🔄 Cambio real-time detectado:', payload);
          // Actualizar datos automáticamente
          setTimeout(() => supabasePull(), 100);
        }
      )
      .subscribe();

    console.log('✅ Real-time de Supabase activado');
  } catch (error) {
    console.error('❌ Error activando real-time:', error);
  }
}

function stopSupabaseRealtime() {
  if (window.supabaseRealtimeChannel) {
    window.supabaseClient.removeChannel(window.supabaseRealtimeChannel);
    window.supabaseRealtimeChannel = null;
    console.log('🔇 Real-time de Supabase desactivado');
  }
}

// ========== UTILIDADES ==========
function showSupabaseStatus(message, type) {
  const statusDiv = document.getElementById('supabase-status');
  if (!statusDiv) return;

  const colors = {
    success: '#28a745',
    error: '#dc3545',
    info: '#007bff'
  };

  statusDiv.style.display = 'block';
  statusDiv.style.color = colors[type] || '#333';
  statusDiv.textContent = message;

  // Auto-ocultar después de 5 segundos si es éxito
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}

// ========== INTEGRACIÓN CON EL SISTEMA EXISTENTE ==========

// Sobrescribir funciones globales para soportar ambos métodos
const originalGuardarJSON = window.guardarJSON;
window.guardarJSON = async function(isAutomatic = false) {
  if (window.currentSyncMethod === 'supabase') {
    return await supabasePush(isAutomatic);
  } else {
    return originalGuardarJSON ? originalGuardarJSON(isAutomatic) : false;
  }
};

const originalExtendsClassPull = window.extendsClassPull;
window.extendsClassPull = async function() {
  if (window.currentSyncMethod === 'supabase') {
    return await supabasePull();
  } else {
    return originalExtendsClassPull ? originalExtendsClassPull() : false;
  }
};

// ========== CARGAR CONFIGURACIÓN EN FORMULARIOS ==========
function cargarConfigSupabaseEnFormulario() {
  const config = getSupabaseConfig();
  const urlField = document.getElementById('supabase-url');
  const keyField = document.getElementById('supabase-key');
  const serviceKeyField = document.getElementById('supabase-service-key');

  if (urlField && config.url) urlField.value = config.url;
  if (keyField && config.key) keyField.value = config.key;
  if (serviceKeyField && config.serviceKey) serviceKeyField.value = config.serviceKey;

  // Detectar si es primera vez usando Supabase
  detectarPrimeraVezSupabase();
}

function detectarPrimeraVezSupabase() {
  const config = getSupabaseConfig();
  const hasSeenSupabaseHelp = localStorage.getItem('supabase_help_shown');

  // Si no tiene configuración Y nunca ha visto la ayuda
  if (!config.url && !hasSeenSupabaseHelp) {
    // Marcar que ya vio la ayuda
    localStorage.setItem('supabase_help_shown', 'true');

    // Mostrar ayuda después de un pequeño delay para que cargue la interfaz
    setTimeout(() => {
      mostrarAyudaPrimeraVez();
    }, 500);
  }
}

function mostrarAyudaPrimeraVez() {
  const shouldShow = confirm(
    '🎉 ¡Bienvenido a Supabase!\n\n' +
    'Supabase es la alternativa moderna a Firebase con:\n' +
    '✅ ILIMITADAS peticiones (vs 50K/día Firebase)\n' +
    '✅ Real-time automático\n' +
    '✅ Más rápido y mejor dashboard\n\n' +
    '¿Quieres una guía rápida de 2 minutos para configurarlo?\n\n' +
    'Click "Aceptar" para ver los pasos\n' +
    'Click "Cancelar" para configurar después'
  );

  if (shouldShow) {
    mostrarGuiaRapidaSupabase();
  }
}

function mostrarGuiaRapidaSupabase() {
  alert(
    '🚀 GUÍA RÁPIDA SUPABASE (2 minutos):\n\n' +
    '1️⃣ Ve a supabase.com → "Start your project"\n' +
    '2️⃣ Registrarte (GitHub recomendado)\n' +
    '3️⃣ "New project":\n' +
    '   • Name: agenda-pablo\n' +
    '   • Password: (genera una segura)\n' +
    '   • Region: (la más cercana)\n' +
    '4️⃣ Espera ~2 min que se cree\n' +
    '5️⃣ Settings → API → Copia URL y anon key\n' +
    '6️⃣ Vuelve aquí y pega los datos\n' +
    '7️⃣ Click "Probar" (te preguntará si crear tablas)\n\n' +
    '¡Y listo! Real-time sin límites 🎉'
  );
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración guardada
  cargarConfigSupabaseEnFormulario();

  // Inicializar si ya hay configuración
  const config = getSupabaseConfig();
  if (config.url && config.key) {
    await initSupabase();
  }

  // Activar método seleccionado
  const currentMethod = localStorage.getItem('syncMethod') || 'firebase';
  document.querySelector(`input[value="${currentMethod}"]`).checked = true;
  cambiarMetodoSync(currentMethod);

  console.log('⚡ Supabase Sync inicializado');
});

// ========== EXPORTS GLOBALES ==========
window.guardarConfigSupabase = guardarConfigSupabase;
window.probarConexionSupabase = probarConexionSupabase;
window.crearTablasSupabase = crearTablasSupabase;
window.cambiarMetodoSync = cambiarMetodoSync;
window.supabasePull = supabasePull;
window.supabasePush = supabasePush;
window.initSupabase = initSupabase;
window.cargarConfigSupabaseEnFormulario = cargarConfigSupabaseEnFormulario;