// ==================== BOTTOM NAVIGATION (VERSIÓN SIMPLE) ====================

console.log('🚀 bottom-nav.js CARGADO');

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('📱 DOMContentLoaded - Iniciando bottom nav');
  
  // Configurar botones de navegación
  const navButtons = document.querySelectorAll('.nav-item');
  console.log('🔘 Botones encontrados:', navButtons.length);
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      console.log('👆 Click en tab:', tab);
      cambiarTab(tab);
    });
  });
  
  // Escuchar evento de Supabase
  window.addEventListener('supabaseDataLoaded', () => {
    console.log('🎉 Datos de Supabase cargados - Renderizando');
    renderizarTodo();
  });
  
  // Timeout de seguridad
  setTimeout(() => {
    console.log('⏰ Timeout - Renderizando datos');
    console.log('📊 DATOS DISPONIBLES:');
    console.log('  - Críticas:', window.appState?.agenda?.tareas_criticas?.length || 0);
    console.log('  - Citas:', window.appState?.agenda?.citas?.length || 0);
    console.log('  - Listas:', window.configVisual?.listasPersonalizadas?.length || 0);
    renderizarTodo();
  }, 3000);
  
  // Activar tab de críticas por defecto
  setTimeout(() => {
    cambiarTab('criticas');
  }, 100);
});

function cambiarTab(tabName) {
  console.log('🔄 Cambiando a tab:', tabName);
  
  // Actualizar botones
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabName);
  });
  
  // Actualizar contenido
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  
  // Actualizar header
  const icons = { criticas: '🚨', citas: '📅', listas: '📋', mas: '⚡' };
  const titles = { criticas: 'Tareas Críticas', citas: 'Citas', listas: 'Listas', mas: 'Más' };
  
  document.getElementById('current-tab-icon').textContent = icons[tabName];
  document.getElementById('current-tab-title').textContent = titles[tabName];
  
  renderizarTab(tabName);
}

function renderizarTab(tabName) {
  console.log('🎨 Renderizando tab:', tabName);
  if (!tabName) {
    console.warn('⚠️ renderizarTab llamado sin parámetro');
    return;
  }
  
  try {
    if (tabName === 'criticas') {
      console.log('👉 Llamando renderizarCriticasMovil()');
      renderizarCriticasMovil();
    }
    if (tabName === 'citas') renderizarCitasMovil();
    if (tabName === 'listas') renderizarListasMovil();
  } catch (error) {
    console.error('❌ Error en renderizarTab:', error);
  }
}

function renderizarTodo() {
  console.log('🔄 Renderizando todo');
  renderizarCriticasMovil();
  renderizarCitasMovil();
  renderizarListasMovil();
}

function renderizarCriticasMovil() {
  try {
    console.log('🚨 Renderizando críticas - INICIO');
    const container = document.getElementById('lista-criticas-movil');
    if (!container) {
      console.error('❌ Contenedor lista-criticas-movil NO encontrado');
      return;
    }
    
    const tareas = window.appState?.agenda?.tareas_criticas || [];
    const activas = tareas.filter(t => !t.completada);
    console.log('📊 Tareas críticas:', tareas.length, 'Activas:', activas.length);
  
    if (activas.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">No hay tareas críticas<br><small>Crea una nueva con el botón +</small></div></div>';
      return;
    }
  
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
  
    container.innerHTML = activas.map(t => {
      let alertaHtml = '';
      if (t.fecha_fin) {
        const [year, month, day] = t.fecha_fin.split('-').map(Number);
        const fechaTarea = new Date(year, month - 1, day);
        fechaTarea.setHours(0, 0, 0, 0);
        
        if (fechaTarea < hoy) {
          alertaHtml = '<div style="background:#ffcdd2;color:#ff1744;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️⚠️⚠️ Fecha pasada</div>';
        } else if (fechaTarea.getTime() === hoy.getTime()) {
          alertaHtml = '<div style="background:#fff9c4;color:#f57f17;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️ Para hoy</div>';
        }
      }
      
      return `
      <div class="task-card">
        <div class="task-main">
          <span class="task-icon">🚨</span>
          <div class="task-content-area">
            <div class="task-title">${t.titulo || 'Sin título'}</div>
            <div class="task-meta">
              ${t.fecha_fin ? `<span class="task-meta-item">📅 ${t.fecha_fin}</span>` : ''}
              ${t.persona ? `<span class="task-meta-item">👤 ${t.persona}</span>` : ''}
              ${t.etiqueta ? `<span class="task-meta-item">🏷️ ${t.etiqueta}</span>` : ''}
            </div>
            ${alertaHtml}
          </div>
          <div class="task-buttons">
            <button class="task-btn btn-edit" data-id="${t.id}" title="Editar">✏️</button>
            <button class="task-btn btn-delete" data-id="${t.id}" title="Eliminar">🗑️</button>
          </div>
        </div>
        <div class="task-actions">
          <button class="action-btn btn-postpone" data-id="${t.id}" style="width:100%;">Posponer/Delegar</button>
        </div>
      </div>
    `;
    }).join('');
    
    // Agregar event listeners
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => editarTareaCritica(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => eliminarTareaCritica(btn.dataset.id));
    });
    container.querySelectorAll('.btn-postpone').forEach(btn => {
      btn.addEventListener('click', () => abrirModalMigrarCritica(btn.dataset.id));
    });
  
    console.log('✅ Críticas renderizadas:', activas.length);
  } catch (error) {
    console.error('❌ ERROR en renderizarCriticas:', error);
  }
}

function renderizarCitasMovil() {
  console.log('📅 Renderizando citas');
  const container = document.getElementById('lista-citas-movil');
  if (!container) {
    console.error('❌ Contenedor lista-citas-movil NO encontrado');
    return;
  }
  
  const citas = window.appState?.agenda?.citas || [];
  console.log('📊 Citas:', citas.length);
  
  if (citas.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">No hay citas<br><small>Crea una nueva con el botón 📅</small></div></div>';
    return;
  }
  
  container.innerHTML = citas.map(c => {
    const fechaStr = Array.isArray(c.fecha) ? `${c.fecha[2]}/${c.fecha[1]}/${c.fecha[0]}` : c.fecha;
    return `
      <div class="task-card">
        <div class="task-main">
          <span class="task-icon">📅</span>
          <div class="task-content-area">
            <div class="task-title">${c.nombre || 'Sin título'}</div>
            <div class="task-meta">
              ${fechaStr ? `<span class="task-meta-item">📅 ${fechaStr}</span>` : ''}
              ${c.hora ? `<span class="task-meta-item">⏰ ${c.hora}</span>` : ''}
              ${c.lugar ? `<span class="task-meta-item">📍 ${c.lugar}</span>` : ''}
              ${c.etiqueta ? `<span class="task-meta-item">🏷️ ${c.etiqueta}</span>` : ''}
            </div>
          </div>
          <div class="task-buttons">
            <button class="task-btn btn-edit" onclick="editarCita('${c.id}')" title="Editar">✏️</button>
            <button class="task-btn btn-delete" onclick="eliminarCita('${c.id}')" title="Eliminar">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  console.log('✅ Citas renderizadas');
}

function renderizarListasMovil() {
  console.log('📋 Renderizando listas');
  const container = document.getElementById('listas-personalizadas-movil');
  if (!container) {
    console.error('❌ Contenedor listas-personalizadas-movil NO encontrado');
    return;
  }
  
  const listas = window.configVisual?.listasPersonalizadas || [];
  console.log('📊 Listas encontradas:', listas.length);
  
  if (listas.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No hay listas personalizadas<br><small>Crea una en Configuración</small></div></div>';
    return;
  }
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  let html = '';
  let totalTareas = 0;
  
  listas.forEach(lista => {
    const tareas = lista.tareas || [];
    const activas = tareas.filter(t => !t.completada);
    totalTareas += activas.length;
    
    html += `
      <div style="background:${lista.color || '#667eea'};padding:16px;margin-bottom:12px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);color:white;">
        <div style="font-size:18px;font-weight:600;margin-bottom:8px;">${lista.emoji || '📝'} ${lista.nombre}</div>
        <div style="font-size:13px;opacity:0.9;">📊 ${activas.length} tareas activas</div>
      </div>
    `;
    
    activas.forEach(tarea => {
      let fechaStr = '';
      let alertaHtml = '';
      
      if (tarea.fecha) {
        if (Array.isArray(tarea.fecha)) {
          fechaStr = `${tarea.fecha[2]}/${tarea.fecha[1]}/${tarea.fecha[0]}`;
          const fechaTarea = new Date(tarea.fecha[0], tarea.fecha[1] - 1, tarea.fecha[2]);
          fechaTarea.setHours(0, 0, 0, 0);
          
          if (fechaTarea < hoy) {
            alertaHtml = '<div style="background:#ffcdd2;color:#ff1744;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️⚠️⚠️ Fecha pasada</div>';
          } else if (fechaTarea.getTime() === hoy.getTime()) {
            alertaHtml = '<div style="background:#fff9c4;color:#f57f17;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️ Para hoy</div>';
          }
        } else if (typeof tarea.fecha === 'string') {
          fechaStr = tarea.fecha;
          // Intentar parsear diferentes formatos
          let fechaTarea;
          if (tarea.fecha.includes('-')) {
            const [year, month, day] = tarea.fecha.split('-').map(Number);
            fechaTarea = new Date(year, month - 1, day);
          } else if (tarea.fecha.includes('/')) {
            const parts = tarea.fecha.split('/');
            if (parts[2]?.length === 4) {
              fechaTarea = new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }
          
          if (fechaTarea) {
            fechaTarea.setHours(0, 0, 0, 0);
            if (fechaTarea < hoy) {
              alertaHtml = '<div style="background:#ffcdd2;color:#ff1744;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️⚠️⚠️ Fecha pasada</div>';
            } else if (fechaTarea.getTime() === hoy.getTime()) {
              alertaHtml = '<div style="background:#fff9c4;color:#f57f17;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin-top:8px;">⚠️ Para hoy</div>';
            }
          }
        }
      }
      
      html += `
        <div class="task-card" style="margin-left:20px;border-left:4px solid ${lista.color || '#667eea'};">
          <div class="task-main">
            <span class="task-icon">${lista.emoji || '📝'}</span>
            <div class="task-content-area">
              <div class="task-title">${tarea.texto || 'Sin título'}</div>
              <div class="task-meta">
                ${fechaStr ? `<span class="task-meta-item">📅 ${fechaStr}</span>` : ''}
                ${tarea.persona ? `<span class="task-meta-item">👤 ${tarea.persona}</span>` : ''}
                ${tarea.etiqueta ? `<span class="task-meta-item">🏷️ ${tarea.etiqueta}</span>` : ''}
              </div>
              ${alertaHtml}
            </div>
            <div class="task-buttons">
              <button class="task-btn btn-edit" onclick="editarTareaLista('${lista.id}', ${tarea.id})" title="Editar">✏️</button>
              <button class="task-btn btn-delete" onclick="eliminarTareaLista('${lista.id}', ${tarea.id})" title="Eliminar">🗑️</button>
            </div>
          </div>
          <div class="task-actions">
            <button class="action-btn btn-postpone" onclick="abrirModalMigrarLista('${lista.id}', ${tarea.id})" style="width:100%;">Posponer/Delegar</button>
          </div>
        </div>
      `;
    });
  });
  
  container.innerHTML = html;
  console.log('✅ Listas renderizadas:', listas.length, 'listas con', totalTareas, 'tareas');
}

// ==================== FUNCIONES AUXILIARES PARA TAREAS CRÍTICAS ====================

function completarTareaCritica(id) {
  const tarea = window.appState.agenda.tareas_criticas.find(t => t.id === id);
  if (!tarea) return;
  
  tarea.completada = true;
  tarea.fecha_completada = new Date().toISOString();
  guardarJSON();
  renderizarCriticasMovil();
  mostrarAlerta('✅ Tarea completada', 'success');
}

function eliminarTareaCritica(id) {
  if (confirm('¿Eliminar esta tarea crítica?')) {
    window.appState.agenda.tareas_criticas = window.appState.agenda.tareas_criticas.filter(t => t.id !== id);
    guardarJSON();
    renderizarCriticasMovil();
    mostrarAlerta('🗑️ Tarea eliminada', 'info');
  }
}

function editarTareaCritica(id) {
  const tarea = window.appState.agenda.tareas_criticas.find(t => t.id === id);
  if (!tarea) return;
  
  const nuevoTitulo = prompt('Editar título:', tarea.titulo);
  if (nuevoTitulo && nuevoTitulo.trim()) {
    tarea.titulo = nuevoTitulo.trim();
    guardarJSON();
    renderizarCriticasMovil();
    mostrarAlerta('✏️ Tarea actualizada', 'success');
  }
}

function abrirModalMigrarCritica(id) {
  window.tareaActualMigrar = { id, tipo: 'critica' };
  abrirModal('modal-migrar');
}

// ==================== FUNCIONES AUXILIARES PARA CITAS ====================

function eliminarCita(id) {
  if (confirm('¿Eliminar esta cita?')) {
    window.appState.agenda.citas = window.appState.agenda.citas.filter(c => c.id != id);
    guardarJSON();
    renderizarCitasMovil();
    mostrarAlerta('🗑️ Cita eliminada', 'info');
  }
}

function editarCita(id) {
  const cita = window.appState.agenda.citas.find(c => c.id == id);
  if (!cita) return;
  
  const nuevoNombre = prompt('Editar cita:', cita.nombre);
  if (nuevoNombre && nuevoNombre.trim()) {
    cita.nombre = nuevoNombre.trim();
    guardarJSON();
    renderizarCitasMovil();
    mostrarAlerta('✏️ Cita actualizada', 'success');
  }
}

// ==================== FUNCIONES AUXILIARES PARA LISTAS PERSONALIZADAS ====================

function completarTareaLista(listaId, tareaId) {
  const lista = window.configVisual.listasPersonalizadas.find(l => l.id === listaId);
  if (!lista) return;
  
  const tarea = lista.tareas.find(t => t.id == tareaId);
  if (!tarea) return;
  
  tarea.completada = true;
  tarea.fecha_completada = new Date().toISOString();
  guardarJSON();
  renderizarListasMovil();
  mostrarAlerta('✅ Tarea completada', 'success');
}

function eliminarTareaLista(listaId, tareaId) {
  if (confirm('¿Eliminar esta tarea?')) {
    const lista = window.configVisual.listasPersonalizadas.find(l => l.id === listaId);
    if (!lista) return;
    
    lista.tareas = lista.tareas.filter(t => t.id != tareaId);
    guardarJSON();
    renderizarListasMovil();
    mostrarAlerta('🗑️ Tarea eliminada', 'info');
  }
}

function editarTareaLista(listaId, tareaId) {
  const lista = window.configVisual.listasPersonalizadas.find(l => l.id === listaId);
  if (!lista) return;
  
  const tarea = lista.tareas.find(t => t.id == tareaId);
  if (!tarea) return;
  
  const nuevoTexto = prompt('Editar tarea:', tarea.texto);
  if (nuevoTexto && nuevoTexto.trim()) {
    tarea.texto = nuevoTexto.trim();
    guardarJSON();
    renderizarListasMovil();
    mostrarAlerta('✏️ Tarea actualizada', 'success');
  }
}

function abrirModalMigrarLista(listaId, tareaId) {
  window.tareaActualMigrar = { listaId, tareaId, tipo: 'lista' };
  abrirModal('modal-migrar');
}

console.log('✅ bottom-nav.js COMPLETAMENTE CARGADO');
