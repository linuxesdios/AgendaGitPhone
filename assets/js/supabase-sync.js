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
      // Probar conexión listando tablas
      const { data, error } = await window.supabaseClient
        .from('agenda_tareas')
        .select('*')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = tabla no existe (está bien)
        throw error;
      }

      showSupabaseStatus('✅ Conexión exitosa con Supabase', 'success');
    } catch (error) {
      console.error('❌ Error probando conexión:', error);
      showSupabaseStatus('❌ Error de conexión: ' + error.message, 'error');
    }
  } else {
    showSupabaseStatus('❌ No se pudo inicializar Supabase', 'error');
  }
}

async function crearTablasSupabase() {
  const connected = await initSupabase();
  if (!connected) {
    showSupabaseStatus('❌ Primero configura Supabase', 'error');
    return;
  }

  showSupabaseStatus('🛠️ Creando tablas...', 'info');

  try {
    // Crear tabla principal con todas las colecciones en un JSONB
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS agenda_data (
        id VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crear índices para mejor performance
      CREATE INDEX IF NOT EXISTS idx_agenda_data_updated ON agenda_data(last_updated);
      CREATE INDEX IF NOT EXISTS idx_agenda_data_gin ON agenda_data USING GIN(data);

      -- Función para actualizar last_updated automáticamente
      CREATE OR REPLACE FUNCTION update_last_updated()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.last_updated = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Trigger para actualizar last_updated
      DROP TRIGGER IF EXISTS trigger_update_last_updated ON agenda_data;
      CREATE TRIGGER trigger_update_last_updated
        BEFORE UPDATE ON agenda_data
        FOR EACH ROW
        EXECUTE FUNCTION update_last_updated();

      -- Insertar registros iniciales si no existen
      INSERT INTO agenda_data (id, data) VALUES
        ('tareas', '{"tareas_criticas": [], "tareas": [], "listasPersonalizadas": []}'),
        ('citas', '{"citas": []}'),
        ('config', '{"visual": {}, "funcionales": {}, "opciones": {}}'),
        ('notas', '{"notas": ""}'),
        ('sentimientos', '{"sentimientos": ""}'),
        ('contrasenas', '{"lista": []}'),
        ('historial_eliminados', '{"items": []}'),
        ('historial_tareas', '{"items": []}'),
        ('personas', '{"lista": []}'),
        ('etiquetas', '{}'),
        ('log', '{"acciones": []}'),
        ('salvados', '{}')
      ON CONFLICT (id) DO NOTHING;
    `;

    const { error } = await window.supabaseClient.rpc('exec_sql', {
      sql: createTableQuery
    });

    if (error) {
      throw error;
    }

    showSupabaseStatus('✅ Tablas creadas correctamente', 'success');
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    showSupabaseStatus('❌ Error creando tablas. Verifica que tengas permisos de admin', 'error');
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