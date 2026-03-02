/**
 * app.js - Aplicación principal OMARE Proformas
 * Responsabilidad: enrutamiento SPA, renderizado de vistas y coordinación entre servicios
 */

const App = (() => {
  // Estado de la aplicación
  let currentView = 'login';
  let currentClienteId = null;
  let currentPedidoId = null;
  let currentEditingPedidoId = null; // null = crear nuevo, string = editar pedido existente
  let pedidoLineas = []; // Líneas del pedido en edición
  let _importPreviewClientes = []; // Clientes pendientes de confirmar importación

  // Correos de Central: se muestra un selector al hacer clic en "Enviar a Central"
  const CENTRAL_EMAILS = ['pedidos@omare.com', 'ventas@omare.com'];

  /* ================================================
     ROUTER / NAVEGACIÓN
     ================================================ */

  function navigateTo(view, params = {}) {
    currentView = view;
    currentClienteId = params.clienteId || currentClienteId;
    currentPedidoId = params.pedidoId || null;

    // Verificar autenticación
    if (view !== 'login' && !AuthService.isAuthenticated()) {
      currentView = 'login';
    }

    render();
    updateSidebarActive();
  }

  function updateSidebarActive() {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === currentView);
    });
  }

  /* ================================================
     RENDER PRINCIPAL
     ================================================ */

  async function render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    if (currentView === 'login') {
      appEl.innerHTML = renderLoginView();
      attachLoginEvents();
      return;
    }

    try {
      const content = await getViewContent();
      appEl.innerHTML = renderAppLayout(content);
      attachSidebarEvents();
      attachViewEvents();
    } catch (error) {
      console.error('Error rendering view:', error);
      appEl.innerHTML = renderAppLayout('<div class="empty-state">Error cargando la vista</div>');
      attachSidebarEvents();
    }
  }

  function renderAppLayout(content) {
    const user = AuthService.getCurrentUser();
    const viewTitles = {
      clientes: 'Clientes',
      clienteDetalle: 'Detalle de Cliente',
      nuevoPedido: 'Nuevo Pedido',
      verPedido: 'Ver Pedido',
      estadisticas: 'Estadísticas',
      datos: 'Importar / Exportar'
    };

    return `
      <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="sidebar-brand-logo">O</div>
            <div class="sidebar-brand-text">OMAR<span>E</span></div>
          </div>

          <nav class="sidebar-nav">
            <div class="sidebar-nav-item ${currentView === 'clientes' ? 'active' : ''}" data-view="clientes">
              <span class="nav-icon">👥</span>
              <span>Clientes</span>
            </div>
            <div class="sidebar-nav-item ${currentView === 'estadisticas' ? 'active' : ''}" data-view="estadisticas">
              <span class="nav-icon">📊</span>
              <span>Estadísticas</span>
            </div>
            <div class="sidebar-nav-item ${currentView === 'campanyas' ? 'active' : ''}" data-view="campanyas">
              <span class="nav-icon">📣</span>
              <span>Campañas</span>
            </div>
            <div class="sidebar-nav-item ${currentView === 'datos' ? 'active' : ''}" data-view="datos">
              <span class="nav-icon">📂</span>
              <span>Mis Datos</span>
            </div>
            <div class="sidebar-nav-item" data-view="catalogo-pdf" id="nav-catalogo">
              <span class="nav-icon">📋</span>
              <span>Catálogo PDF</span>
            </div>
          </nav>

          <!-- Buscador Global -->
          <div class="sidebar-search" id="sidebar-search-container">
            <div class="sidebar-search-input-wrap">
              <span class="sidebar-search-icon">&#x1F50D;</span>
              <input type="text" id="global-search-input" placeholder="Buscar..." autocomplete="off">
            </div>
            <div class="global-search-results" id="global-search-results"></div>
          </div>

          <div class="sidebar-user">
            <div class="sidebar-user-avatar">${(user?.name || 'U')[0]}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${Formatters.escapeHtml(user?.name || 'Usuario')}</div>
              <div class="sidebar-user-role">${Formatters.escapeHtml(user?.role || 'Comercial')}</div>
            </div>
            <button class="sidebar-logout-btn" id="btn-logout" title="Cerrar sesión">🚪</button>
          </div>
        </aside>

        <!-- Overlay mobile -->
        <div class="sidebar-overlay" id="sidebar-overlay"></div>

        <!-- Main Content -->
        <main class="main-content">
          <header class="top-header">
            <div>
              <button class="mobile-menu-toggle" id="btn-mobile-menu">☰</button>
              <span class="header-title">${viewTitles[currentView] || 'OMARE'}</span>
            </div>
            <div class="header-actions">
              <!-- Acciones de header según vista -->
            </div>
          </header>

          <div class="page-content" id="page-content">
            ${content}
          </div>
        </main>
      </div>
    `;
  }

  async function getViewContent() {
    switch (currentView) {
      case 'clientes': return await renderClientesView();
      case 'clienteDetalle': return await renderClienteDetalleView();
      case 'nuevoPedido': return await renderNuevoPedidoView();
      case 'verPedido': return await renderVerPedidoView();
      case 'estadisticas': return await renderEstadisticasView();
      case 'campanyas': return await renderCampanyasView();
      case 'datos': return await renderDatosView();
      default: return await renderClientesView();
    }
  }

  /* ================================================
     LOGIN VIEW
     ================================================ */

  function renderLoginView() {
    return `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">O</div>
          <h1 class="login-title">OMARE</h1>
          <p class="login-subtitle">Sistema de Proformas y Pedidos</p>

          <form class="login-form" id="login-form">
            <div class="login-error" id="login-error"></div>

            <div class="form-group">
              <label class="form-label" for="login-email">Email</label>
              <input type="email" class="form-input" id="login-email"
                     placeholder="ejemplo@omare.com" autocomplete="email" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">Contraseña</label>
              <input type="password" class="form-input" id="login-password"
                     placeholder="••••••••" autocomplete="current-password" required>
            </div>

            <div class="form-group" id="group-confirm-password" style="display:none;">
              <label class="form-label" for="login-password-confirm">Repetir Contraseña</label>
              <input type="password" class="form-input" id="login-password-confirm"
                     placeholder="••••••••" autocomplete="new-password">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-auth">Iniciar Sesión</button>
            <div style="text-align:center; margin-top:1rem;">
               <a href="#" id="toggle-auth-mode" style="color:var(--color-primary);text-decoration:none;font-size:0.875rem;">¿No tienes cuenta? Regístrate</a>
            </div>
            
            <input type="hidden" id="auth-mode" value="login">
          </form>
        </div>
      </div>
    `;
  }

  function attachLoginEvents() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const modeInput = document.getElementById('auth-mode');
    const toggleAuth = document.getElementById('toggle-auth-mode');
    const btnSubmit = document.getElementById('btn-submit-auth');
    const groupConfirm = document.getElementById('group-confirm-password');
    const inputConfirm = document.getElementById('login-password-confirm');
    const errorEl = document.getElementById('login-error');

    if (toggleAuth) {
      toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        errorEl.classList.remove('visible'); // Limpiar errores al cambiar
        if (modeInput.value === 'login') {
          modeInput.value = 'register';
          btnSubmit.textContent = 'Crear Cuenta';
          toggleAuth.textContent = '¿Ya tienes cuenta? Inicia sesión';
          groupConfirm.style.display = 'block';
          inputConfirm.setAttribute('required', 'true');
        } else {
          modeInput.value = 'login';
          btnSubmit.textContent = 'Iniciar Sesión';
          toggleAuth.textContent = '¿No tienes cuenta? Regístrate';
          groupConfirm.style.display = 'none';
          inputConfirm.removeAttribute('required');
        }
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.classList.remove('visible');
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const isRegister = document.getElementById('auth-mode').value === 'register';

      if (isRegister) {
        const confirmPassword = inputConfirm.value;
        if (password !== confirmPassword) {
          errorEl.textContent = 'Las contraseñas no coinciden';
          errorEl.classList.add('visible');
          return;
        }
      }

      const prevText = btnSubmit.textContent;

      btnSubmit.textContent = 'Procesando...';
      btnSubmit.disabled = true;

      const result = isRegister
        ? await AuthService.register(email, password)
        : await AuthService.login(email, password);

      btnSubmit.textContent = prevText;
      btnSubmit.disabled = false;

      if (result.success) {
        if (isRegister && result.requiresEmailConfirmation) {
          Toast.show('🎉 Cuenta creada. Revise su correo (y la carpeta de Spam) para confirmarla antes de iniciar sesión.');
          // Regresar al modo login
          modeInput.value = 'login';
          btnSubmit.textContent = 'Iniciar Sesión';
          toggleAuth.textContent = '¿No tienes cuenta? Regístrate';
          groupConfirm.style.display = 'none';
          inputConfirm.removeAttribute('required');
          document.getElementById('login-password').value = '';
          inputConfirm.value = '';
        } else {
          Toast.show('Sesión iniciada correctamente');
          navigateTo('clientes');
        }
      } else {
        errorEl.textContent = result.error;
        errorEl.classList.add('visible');
      }
    });
  }

  /* ================================================
     CLIENTES VIEW
     ================================================ */

  async function renderClientesView() {
    const clientes = await ClienteService.getAll();
    const clientesCardsHtml = await Promise.all(clientes.map(c => renderClienteCard(c)));

    const clientesHtml = clientes.length > 0
      ? `<div class="clients-grid">
           ${clientesCardsHtml.join('')}
         </div>`
      : `<div class="empty-state">
           <div class="empty-state-icon">👥</div>
           <div class="empty-state-title">No hay clientes</div>
           <div class="empty-state-desc">Crea tu primer cliente para empezar a generar pedidos</div>
         </div>`;

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Clientes</h1>
          <p class="page-subtitle">${clientes.length} cliente(s) registrado(s)</p>
        </div>
        <div style="display:flex;gap:var(--spacing-md);align-items:center;flex-wrap:wrap;">
          <div class="search-container">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-input search-input" id="search-clientes"
                   placeholder="Buscar cliente...">
          </div>
          <button class="btn btn-primary" id="btn-nuevo-cliente">
            <span>➕</span> <span class="btn-text">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      ${clientesHtml}

      <!-- Modal Crear/Editar Cliente -->
      <div class="modal-overlay" id="modal-cliente">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-cliente-title">Nuevo Cliente</h2>
            <button class="modal-close" id="modal-cliente-close">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="cliente-edit-id">
            <div class="form-group">
              <label class="form-label" for="cliente-nombre">Nombre *</label>
              <input type="text" class="form-input" id="cliente-nombre" placeholder="Nombre del cliente">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-direccion">Dirección</label>
              <input type="text" class="form-input" id="cliente-direccion" placeholder="Dirección">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-email">Email</label>
              <input type="email" class="form-input" id="cliente-email" placeholder="ejemplo@correo.com">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-telefono">Teléfono</label>
              <input type="text" class="form-input" id="cliente-telefono" placeholder="Teléfono">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-observaciones">Observaciones</label>
              <textarea class="form-textarea" id="cliente-observaciones" placeholder="Observaciones..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" id="modal-cliente-cancel">Cancelar</button>
            <button class="btn btn-primary" id="modal-cliente-save">Guardar Cliente</button>
          </div>
        </div>
      </div>
    `;
  }

  async function renderClienteCard(cliente) {
    const pedidos = await PedidoService.getByClienteId(cliente.id);
    return `
      <div class="client-card" data-cliente-id="${cliente.id}">
        <div class="client-card-name">${Formatters.escapeHtml(cliente.nombre)}</div>
        ${cliente.email ? `<div class="client-card-info">✉️ ${Formatters.escapeHtml(cliente.email)}</div>` : ''}
        ${cliente.telefono ? `<div class="client-card-info">📞 ${Formatters.escapeHtml(cliente.telefono)}</div>` : ''}
        ${cliente.direccion ? `<div class="client-card-info">📍 ${Formatters.escapeHtml(cliente.direccion)}</div>` : ''}
        <div class="client-card-footer">
          <span class="badge badge-primary">${pedidos.length} pedido(s)</span>
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted)">
            ${Formatters.date(cliente.createdAt)}
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza un badge de color según el estado del pedido
   */
  function renderEstadoBadge(estado) {
    const config = {
      pendiente: { label: 'Pendiente', cls: 'badge-estado-pendiente' },
      confirmado: { label: 'Confirmado', cls: 'badge-estado-confirmado' },
      enviado: { label: 'Enviado', cls: 'badge-estado-enviado' },
      facturado: { label: 'Facturado', cls: 'badge-estado-facturado' }
    };
    const { label, cls } = config[estado] || { label: estado, cls: '' };
    return `<span class="badge-estado ${cls}">${label}</span>`;
  }

  /* ================================================
     CLIENTE DETALLE VIEW (Histórico)
     ================================================ */

  async function renderClienteDetalleView() {
    const cliente = await ClienteService.getById(currentClienteId);
    if (!cliente) return '<div class="empty-state"><div class="empty-state-title">Cliente no encontrado</div></div>';

    const pedidos = await PedidoService.getByClienteId(cliente.id);

    const pedidosHtml = pedidos.length > 0
      ? `<div class="table-container">
           <table class="data-table">
             <thead>
               <tr>
                 <th>Nº Pedido</th>
                 <th>Fecha</th>
                 <th>Estado</th>
                 <th>Productos</th>
                 <th>Total</th>
                 <th>Acciones</th>
               </tr>
             </thead>
             <tbody>
               ${pedidos.map(p => `
                 <tr>
                   <td><strong>${Formatters.escapeHtml(p.numeroPedido)}</strong></td>
                   <td>${Formatters.date(p.fecha)}</td>
                   <td>${renderEstadoBadge(p.estado)}</td>
                   <td>${p.lineas?.length || 0} líneas</td>
                   <td><strong>${Formatters.currency(p.total)}</strong></td>
                   <td>
                     <div class="cell-actions">
                       <button class="btn btn-sm btn-ghost" data-action="ver-pedido" data-pedido-id="${p.id}" title="Ver">👁️</button>
                       <button class="btn btn-sm btn-ghost" data-action="editar-pedido" data-pedido-id="${p.id}" title="Editar">✏️</button>
                        <button class="btn btn-sm btn-ghost" data-action="pdf-pedido" data-pedido-id="${p.id}" title="PDF">📄</button>
                       <button class="btn btn-sm btn-ghost" data-action="repetir-pedido" data-pedido-id="${p.id}" title="Repetir">🔄</button>
                       <button class="btn btn-sm btn-danger" data-action="eliminar-pedido" data-pedido-id="${p.id}" title="Eliminar">🗑️</button>
                     </div>
                   </td>
                 </tr>
               `).join('')}
             </tbody>
           </table>
         </div>`
      : `<div class="empty-state">
           <div class="empty-state-icon">📦</div>
           <div class="empty-state-title">Sin pedidos</div>
           <div class="empty-state-desc">Crea el primer pedido para este cliente</div>
         </div>`;

    return `
      <div class="page-header">
        <div>
          <button class="btn btn-ghost" id="btn-back-clientes">← Volver a Clientes</button>
          <h1 class="page-title" style="margin-top:var(--spacing-sm)">${Formatters.escapeHtml(cliente.nombre)}</h1>
          ${cliente.email ? `<p class="page-subtitle">✉️ ${Formatters.escapeHtml(cliente.email)}</p>` : ''}
          ${cliente.direccion ? `<p class="page-subtitle">📍 ${Formatters.escapeHtml(cliente.direccion)}</p>` : ''}
          ${cliente.telefono ? `<p class="page-subtitle">📞 ${Formatters.escapeHtml(cliente.telefono)}</p>` : ''}
          ${cliente.observaciones ? `<p class="page-subtitle">📝 ${Formatters.escapeHtml(cliente.observaciones)}</p>` : ''}
        </div>
        <div style="display:flex;gap:var(--spacing-md)">
          <button class="btn btn-outline" id="btn-editar-cliente">✏️ Editar</button>
          <button class="btn btn-primary" id="btn-nuevo-pedido">➕ Nuevo Pedido</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:center;gap:var(--spacing-md)">
            <h3 class="card-header-title">Histórico de Pedidos</h3>
            <span class="badge badge-primary">${pedidos.length}</span>
          </div>
          ${pedidos.length > 0 ? `<button class="btn btn-outline btn-sm" id="btn-exportar-excel-cliente">📊 Exportar Excel</button>` : ''}
        </div>
        <div class="card-body" style="padding:0">
          ${pedidosHtml}
        </div>
      </div>

      <!-- Modal Editar Cliente -->
      <div class="modal-overlay" id="modal-cliente">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Editar Cliente</h2>
            <button class="modal-close" id="modal-cliente-close">✕</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="cliente-edit-id" value="${cliente.id}">
            <div class="form-group">
              <label class="form-label" for="cliente-nombre">Nombre *</label>
              <input type="text" class="form-input" id="cliente-nombre" value="${Formatters.escapeHtml(cliente.nombre)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-direccion">Dirección</label>
              <input type="text" class="form-input" id="cliente-direccion" value="${Formatters.escapeHtml(cliente.direccion)}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-email">Email</label>
              <input type="email" class="form-input" id="cliente-email" value="${Formatters.escapeHtml(cliente.email || '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-telefono">Teléfono</label>
              <input type="text" class="form-input" id="cliente-telefono" value="${Formatters.escapeHtml(cliente.telefono || '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cliente-observaciones">Observaciones</label>
              <textarea class="form-textarea" id="cliente-observaciones">${Formatters.escapeHtml(cliente.observaciones)}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
              <button class="btn btn-danger" id="modal-cliente-eliminar">🗑️ Eliminar Cliente</button>
              <div style="display:flex;gap:var(--spacing-md)">
                <button class="btn btn-ghost" id="modal-cliente-cancel">Cancelar</button>
                <button class="btn btn-primary" id="modal-cliente-save">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ================================================
     NUEVO PEDIDO VIEW
     ================================================ */

  async function renderNuevoPedidoView() {
    const isEditMode = currentEditingPedidoId !== null;
    const cliente = await ClienteService.getById(currentClienteId);
    if (!cliente) return '<div class="empty-state"><div class="empty-state-title">Seleccione un cliente</div></div>';

    const today = Formatters.date(new Date().toISOString());
    const totals = calculateTotals();

    return `
      <!-- Barra superior del pedido -->
      <div class="pedido-top-bar">
        <div class="pedido-top-bar-title">${isEditMode ? '✏️ Editando Pedido' : 'OMARE - Proforma de Pedidos'}</div>
        <div class="pedido-top-bar-actions">
          <button class="btn btn-outline" id="btn-abrir-catalogo">
            📋 <span class="btn-text">Abrir Catálogo</span>
          </button>
          ${!isEditMode ? `<button class="btn btn-success" id="btn-generar-pdf" ${pedidoLineas.length === 0 ? 'disabled' : ''}>
            📄 <span class="btn-text">Generar Pedido PDF</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Info del Cliente -->
      <div class="pedido-client-info">
        <div>
          <div class="pedido-client-name">👤 ${Formatters.escapeHtml(cliente.nombre)}</div>
          ${cliente.direccion ? `<div style="font-size:var(--font-size-sm);color:var(--color-text-muted)">📍 ${Formatters.escapeHtml(cliente.direccion)}</div>` : ''}
        </div>
        <div class="pedido-client-date">📅 ${today}</div>
      </div>

      <!-- Layout Principal: Tabla + Resumen -->
      <div class="pedido-layout">
        <!-- Columna Izquierda: Buscador + Tabla -->
        <div>
          <!-- Buscador de Productos -->
          <div class="pedido-search-section">
            <label class="form-label" style="margin-bottom:var(--spacing-sm);display:block">Buscar Producto:</label>
            <div class="search-container">
              <span class="search-icon">🔍</span>
              <input type="text" class="form-input search-input" id="search-productos"
                     placeholder="Escriba referencia o descripción..." autocomplete="off">
              <div class="search-results-dropdown" id="search-results"></div>
            </div>
          </div>

          <!-- Tabla de Líneas del Pedido -->
          <div class="pedido-table-section">
            <table class="data-table" id="tabla-pedido">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Descripción</th>
                  <th>Talla</th>
                  <th>Uds/Cj</th>
                  <th>Cajas</th>
                  <th>Total Uds</th>
                  <th>Precio Ud</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="pedido-lineas-body">
                ${pedidoLineas.length > 0
        ? pedidoLineas.map((l, i) => renderPedidoLineaRow(l, i)).join('')
        : `<tr><td colspan="9">
                       <div class="empty-state" style="padding:var(--spacing-2xl)">
                         <div class="empty-state-icon">📦</div>
                         <div class="empty-state-title">Sin productos</div>
                         <div class="empty-state-desc">Use el buscador para añadir productos</div>
                       </div>
                     </td></tr>`}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Columna Derecha: Resumen -->
        <div>
          <div class="order-summary">
            <div class="order-summary-header">Resumen Pedido</div>
            <div class="order-summary-body">
              <div class="order-summary-row">
                <span class="label">Base Imponible:</span>
                <span class="value" id="summary-subtotal">${Formatters.currency(totals.subtotal)}</span>
              </div>
              <div class="order-summary-row" style="align-items:center">
                <span class="label">Descuento (%):</span>
                <input type="number" id="input-descuento" min="0" max="100" step="0.5"
                  value="${pedidoLineas._descuento || 0}" style="width:70px;text-align:right;padding:2px 6px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-size:var(--font-size-sm)">
              </div>
              <div class="order-summary-row">
                <span class="label">IVA (21%):</span>
                <span class="value" id="summary-iva">${Formatters.currency(totals.iva)}</span>
              </div>
              <div class="order-summary-row">
                <span class="label">Total Cajas:</span>
                <span class="value" id="summary-cajas">${totals.totalCajas}</span>
              </div>
              <div class="order-summary-row total">
                <span class="label">TOTAL:</span>
                <span class="value" id="summary-total">${Formatters.currency(totals.total)}</span>
              </div>
            </div>
            <div class="order-summary-actions">
              <button class="btn btn-primary btn-lg" id="btn-guardar-pedido" ${pedidoLineas.length === 0 ? 'disabled' : ''}>
                ${isEditMode ? '✏️ Guardar Cambios' : '💾 Guardar Pedido'}
              </button>
              <button class="btn btn-ghost" id="btn-cancelar-pedido">← Volver al Cliente</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPedidoLineaRow(linea, index) {
    return `
      <tr data-index="${index}">
        <td><strong>${Formatters.escapeHtml(linea.codigoReferencia)}</strong></td>
        <td>${Formatters.escapeHtml(linea.descripcion)}</td>
        <td>${Formatters.escapeHtml(linea.talla)}</td>
        <td style="text-align:center">${linea.unidadesPorCaja}</td>
        <td>
          <div class="quantity-control">
            <input type="number" value="${linea.cajas}" min="0"
                   class="input-cajas" data-index="${index}"
                   data-field="cajas" aria-label="Cajas">
          </div>
        </td>
        <td style="text-align:center;font-weight:var(--font-weight-semibold)" data-total-uds="${index}">
          ${linea.cantidad}
        </td>
        <td>
          <input type="number" value="${linea.precioUnitario}" min="0" step="0.01"
                 class="price-input" data-index="${index}"
                 data-field="precioUnitario" aria-label="Precio unitario">
        </td>
        <td style="text-align:right;font-weight:var(--font-weight-semibold);" data-subtotal="${index}">
          ${Formatters.currency(linea.totalLinea)}
        </td>
        <td>
          <button class="btn btn-sm btn-danger" data-action="remove-line" data-index="${index}" title="Eliminar">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }

  /* ================================================
     VER PEDIDO VIEW (Read-only)
     ================================================ */

  async function renderVerPedidoView() {
    const pedido = await PedidoService.getById(currentPedidoId);
    if (!pedido) return '<div class="empty-state"><div class="empty-state-title">Pedido no encontrado</div></div>';

    const cliente = await ClienteService.getById(pedido.clienteId);

    return `
      <div class="pedido-detail-header">
        <div>
          <button class="btn btn-ghost" id="btn-back-cliente-detalle">← Volver</button>
          <h1 class="page-title" style="margin-top:var(--spacing-sm)">${Formatters.escapeHtml(pedido.numeroPedido)}</h1>
          <p class="page-subtitle">📅 ${Formatters.date(pedido.fecha)} · 👤 ${Formatters.escapeHtml(cliente?.nombre || 'Sin cliente')}</p>
        </div>
        <div style="display:flex;gap:var(--spacing-md);flex-wrap:wrap">
          <button class="btn btn-outline" id="btn-email-cliente" data-pedido-id="${pedido.id}">✉️ Enviar al Cliente</button>
          <button class="btn btn-outline" id="btn-email-central" data-pedido-id="${pedido.id}">🏢 Enviar a Central</button>
          <button class="btn btn-outline" id="btn-pdf-ver-pedido" data-pedido-id="${pedido.id}">📄 Descargar PDF</button>
          <button class="btn btn-warning" id="btn-editar-pedido" data-pedido-id="${pedido.id}">✏️ Editar Pedido</button>
          <button class="btn btn-primary" id="btn-repetir-ver-pedido" data-pedido-id="${pedido.id}">🔄 Repetir Pedido</button>
        </div>
      </div>

      <div class="pedido-layout">
        <div>
          <div class="pedido-table-section">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Descripción</th>
                  <th>Talla</th>
                  <th>Uds/Cj</th>
                  <th>Cajas</th>
                  <th>Total Uds</th>
                  <th>Precio Ud</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${(pedido.lineas || []).map(l => `
                  <tr>
                    <td><strong>${Formatters.escapeHtml(l.codigoReferencia)}</strong></td>
                    <td>${Formatters.escapeHtml(l.descripcion)}</td>
                    <td>${Formatters.escapeHtml(l.talla)}</td>
                    <td style="text-align:center">${l.unidadesPorCaja}</td>
                    <td style="text-align:center">${l.cajas}</td>
                    <td style="text-align:center">${l.cantidad}</td>
                    <td style="text-align:right">${Formatters.currency(l.precioUnitario)}</td>
                    <td style="text-align:right;font-weight:var(--font-weight-semibold)">${Formatters.currency(l.totalLinea)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div class="order-summary">
            <div class="order-summary-header">Resumen Pedido</div>
            <div class="order-summary-body">
              <div class="order-summary-row">
                <span class="label">Base Imponible:</span>
                <span class="value">${Formatters.currency(pedido.subtotal)}</span>
              </div>
              <div class="order-summary-row">
                <span class="label">IVA (21%):</span>
                <span class="value">${Formatters.currency(pedido.iva)}</span>
              </div>
              <div class="order-summary-row">
                <span class="label">Total Cajas:</span>
                <span class="value">${pedido.totalCajas}</span>
              </div>
              <div class="order-summary-row total">
                <span class="label">TOTAL:</span>
                <span class="value">${Formatters.currency(pedido.total)}</span>
              </div>

              <!-- Selector de Estado -->
              <div class="order-summary-row" style="margin-top:var(--spacing-lg);flex-direction:column;align-items:flex-start;gap:var(--spacing-xs)">
                <span class="label">Estado del pedido:</span>
                <select id="select-estado-pedido" class="form-select" style="width:100%">
                  <option value="pendiente"  ${pedido.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                  <option value="confirmado" ${pedido.estado === 'confirmado' ? 'selected' : ''}>✅ Confirmado</option>
                  <option value="enviado"    ${pedido.estado === 'enviado' ? 'selected' : ''}>🚚 Enviado</option>
                  <option value="facturado"  ${pedido.estado === 'facturado' ? 'selected' : ''}>🧾 Facturado</option>
                </select>
              </div>

              <!-- Notas Internas -->
              <div class="order-summary-row" style="flex-direction:column;align-items:flex-start;gap:var(--spacing-xs)">
                <span class="label">📝 Notas internas:</span>
                <textarea id="textarea-notas-pedido" class="form-textarea" style="width:100%;min-height:80px;font-size:var(--font-size-sm)"
                  placeholder="Añade notas sobre este pedido...">${Formatters.escapeHtml(pedido.notas || '')}</textarea>
                <button class="btn btn-outline btn-sm" id="btn-guardar-notas" style="align-self:flex-end">💾 Guardar notas</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ================================================
     CÁLCULOS
     ================================================ */

  function calculateTotals() {
    const subtotalBruto = pedidoLineas.reduce((sum, l) => sum + (l.totalLinea || 0), 0);
    // Leer el descuento del input (si existe en el DOM; si no, del array)
    const descuentoEl = document.getElementById('input-descuento');
    const descuento = descuentoEl ? (parseFloat(descuentoEl.value) || 0) : (pedidoLineas._descuento || 0);
    const subtotal = subtotalBruto * (1 - descuento / 100);
    const iva = subtotal * PedidoService.IVA_RATE;
    const totalCajas = pedidoLineas.reduce((sum, l) => sum + (l.cajas || 0), 0);
    return {
      subtotal,
      iva,
      total: subtotal + iva,
      totalCajas
    };
  }

  function updateSummary() {
    const totals = calculateTotals();
    const el = (id) => document.getElementById(id);
    if (el('summary-subtotal')) el('summary-subtotal').textContent = Formatters.currency(totals.subtotal);
    if (el('summary-iva')) el('summary-iva').textContent = Formatters.currency(totals.iva);
    if (el('summary-total')) el('summary-total').textContent = Formatters.currency(totals.total);
    if (el('summary-cajas')) el('summary-cajas').textContent = totals.totalCajas;

    // Habilitar/deshabilitar botones
    const hasItems = pedidoLineas.length > 0;
    const btnGuardar = el('btn-guardar-pedido');
    const btnPdf = el('btn-generar-pdf');
    if (btnGuardar) btnGuardar.disabled = !hasItems;
    if (btnPdf) btnPdf.disabled = !hasItems;
  }

  function recalcLinea(index) {
    const linea = pedidoLineas[index];
    if (!linea) return;

    linea.cantidad = linea.cajas * linea.unidadesPorCaja;
    linea.totalLinea = linea.cantidad * linea.precioUnitario;

    // Actualizar celdas individuales sin re-renderizar
    const totalUdsCell = document.querySelector(`[data-total-uds="${index}"]`);
    const subtotalCell = document.querySelector(`[data-subtotal="${index}"]`);

    if (totalUdsCell) totalUdsCell.textContent = linea.cantidad;
    if (subtotalCell) subtotalCell.textContent = Formatters.currency(linea.totalLinea);

    updateSummary();
  }

  /* ================================================
     EVENT HANDLERS
     ================================================ */

  function attachSidebarEvents() {
    // Navegación sidebar
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view === 'catalogo-pdf') {
          window.open('CATALOGO-OMARE_2025.pdf', '_blank');
        } else {
          navigateTo(view);
        }
      });
    });

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        await AuthService.logout();
        navigateTo('login');
        Toast.show('Sesión cerrada');
      });
    }

    // Buscador Global
    const globalSearch = document.getElementById('global-search-input');
    const globalResults = document.getElementById('global-search-results');
    if (globalSearch && globalResults) {
      let debounceTimer = null;

      globalSearch.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const query = globalSearch.value.trim();
          if (query.length < 2) {
            globalResults.classList.remove('active');
            return;
          }

          // Buscar clientes y pedidos en paralelo
          const [clientes, pedidos] = await Promise.all([
            ClienteService.buscar(query),
            PedidoService.getAll()
          ]);

          const pedidosFiltrados = pedidos.filter(p =>
            p.numeroPedido.toLowerCase().includes(query.toLowerCase())
          );

          let html = '';
          clientes.slice(0, 4).forEach(c => {
            html += `<div class="global-result-item" data-type="cliente" data-id="${c.id}">
              <span class="global-result-icon">👤</span>
              <span class="global-result-text">${Formatters.escapeHtml(c.nombre)}</span>
              <span class="global-result-type">Cliente</span>
            </div>`;
          });
          pedidosFiltrados.slice(0, 4).forEach(p => {
            html += `<div class="global-result-item" data-type="pedido" data-id="${p.id}" data-cliente-id="${p.clienteId}">
              <span class="global-result-icon">📦</span>
              <span class="global-result-text">${Formatters.escapeHtml(p.numeroPedido)}</span>
              <span class="global-result-type">${Formatters.currency(p.total)}</span>
            </div>`;
          });

          if (!html) {
            html = '<div class="global-result-item" style="color:var(--color-text-muted);justify-content:center">Sin resultados</div>';
          }

          globalResults.innerHTML = html;
          globalResults.classList.add('active');

          // Click en resultado
          globalResults.querySelectorAll('.global-result-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              globalResults.classList.remove('active');
              globalSearch.value = '';
              if (item.dataset.type === 'cliente') {
                navigateTo('clienteDetalle', { clienteId: item.dataset.id });
              } else {
                navigateTo('verPedido', { pedidoId: item.dataset.id, clienteId: item.dataset.clienteId });
              }
            });
          });
        }, 250);
      });

      // Cerrar al hacer click fuera
      document.addEventListener('click', (e) => {
        if (!globalSearch.contains(e.target) && !globalResults.contains(e.target)) {
          globalResults.classList.remove('active');
        }
      });
    }

    // Mobile menu
    const btnMobile = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (btnMobile && sidebar) {
      btnMobile.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('active');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        overlay.classList.remove('active');
      });
    }
  }

  function attachViewEvents() {
    switch (currentView) {
      case 'clientes':
        attachClientesEvents();
        break;
      case 'clienteDetalle':
        attachClienteDetalleEvents();
        break;
      case 'nuevoPedido':
        attachNuevoPedidoEvents();
        break;
      case 'verPedido':
        attachVerPedidoEvents();
        break;
      case 'estadisticas':
        attachEstadisticasEvents();
        break;
      case 'campanyas':
        attachCampanyasEvents();
        break;
      case 'datos':
        attachDatosEvents();
        break;
    }
  }

  /* ---- Clientes Events ---- */
  function attachClientesEvents() {
    // Búsqueda de clientes
    const searchInput = document.getElementById('search-clientes');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const query = e.target.value;
          const clientes = await ClienteService.buscar(query);
          const grid = document.querySelector('.clients-grid');
          if (grid) {
            const clientesCardsHtml = await Promise.all(clientes.map(c => renderClienteCard(c)));
            grid.innerHTML = clientesCardsHtml.join('');
            attachClienteCardClicks();
          }
        }, 300);
      });
    }

    // Nuevo cliente
    const btnNuevo = document.getElementById('btn-nuevo-cliente');
    if (btnNuevo) {
      btnNuevo.addEventListener('click', () => {
        document.getElementById('cliente-edit-id').value = '';
        document.getElementById('cliente-nombre').value = '';
        document.getElementById('cliente-email').value = '';
        document.getElementById('cliente-direccion').value = '';
        document.getElementById('cliente-telefono').value = '';
        document.getElementById('cliente-observaciones').value = '';
        document.getElementById('modal-cliente-title').textContent = 'Nuevo Cliente';
        showModal('modal-cliente');
      });
    }

    // Modal eventos
    attachModalClienteEvents();

    // Click en tarjeta
    attachClienteCardClicks();
  }

  function attachClienteCardClicks() {
    document.querySelectorAll('.client-card').forEach(card => {
      card.addEventListener('click', () => {
        navigateTo('clienteDetalle', { clienteId: card.dataset.clienteId });
      });
    });
  }

  function attachModalClienteEvents() {
    const modal = document.getElementById('modal-cliente');
    if (!modal) return;

    const close = () => hideModal('modal-cliente');

    document.getElementById('modal-cliente-close')?.addEventListener('click', close);
    document.getElementById('modal-cliente-cancel')?.addEventListener('click', close);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    document.getElementById('modal-cliente-save')?.addEventListener('click', async () => {
      const id = document.getElementById('cliente-edit-id')?.value;
      const data = {
        nombre: document.getElementById('cliente-nombre').value,
        email: document.getElementById('cliente-email').value,
        direccion: document.getElementById('cliente-direccion').value,
        telefono: document.getElementById('cliente-telefono').value,
        observaciones: document.getElementById('cliente-observaciones').value
      };

      const result = id
        ? await ClienteService.actualizar(id, data)
        : await ClienteService.crear(data);

      if (result.success) {
        Toast.show(id ? 'Cliente actualizado' : 'Cliente creado');
        close();
        if (currentView === 'clienteDetalle') {
          navigateTo('clienteDetalle', { clienteId: result.cliente.id });
        } else {
          navigateTo('clientes');
        }
      } else {
        Toast.show(result.error, 'error');
      }
    });

    // Eliminar cliente (solo visible en modo editar)
    document.getElementById('modal-cliente-eliminar')?.addEventListener('click', async () => {
      const id = document.getElementById('cliente-edit-id')?.value;
      if (!id) return;
      if (!confirm('¿Seguro que deseas eliminar este cliente? Se eliminarán también todos sus pedidos.')) return;
      const result = await ClienteService.eliminar(id);
      if (result.success) {
        hideModal('modal-cliente');
        Toast.show('Cliente eliminado correctamente');
        navigateTo('clientes');
      } else {
        Toast.show(result.error, 'error');
      }
    });
  }

  /* ---- Cliente Detalle Events ---- */
  function attachClienteDetalleEvents() {
    document.getElementById('btn-back-clientes')?.addEventListener('click', () => {
      navigateTo('clientes');
    });

    document.getElementById('btn-editar-cliente')?.addEventListener('click', () => {
      showModal('modal-cliente');
    });

    document.getElementById('btn-nuevo-pedido')?.addEventListener('click', () => {
      pedidoLineas = [];
      navigateTo('nuevoPedido');
    });

    attachModalClienteEvents();

    // Acciones de pedido en el histórico
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const pedidoId = btn.dataset.pedidoId;

        switch (action) {
          case 'ver-pedido':
            navigateTo('verPedido', { pedidoId });
            break;
          case 'editar-pedido':
            await startEditPedido(pedidoId);
            break;
          case 'pdf-pedido':
            await generatePdfForPedido(pedidoId);
            break;
          case 'repetir-pedido':
            await repeatPedido(pedidoId);
            break;
          case 'eliminar-pedido':
            if (confirm('¿Eliminar este pedido?')) {
              await PedidoService.eliminar(pedidoId);
              Toast.show('Pedido eliminado');
              navigateTo('clienteDetalle');
            }
            break;
        }
      });
    });

    // Exportar pedidos del cliente a Excel
    document.getElementById('btn-exportar-excel-cliente')?.addEventListener('click', async () => {
      const cliente = await ClienteService.getById(currentClienteId);
      const pedidos = await PedidoService.getByClienteId(currentClienteId);
      ExcelExporter.exportarPedidos(pedidos, `pedidos_${(cliente?.nombre || 'cliente').replace(/\s+/g, '_')}`, cliente);
      Toast.show('Exportando Excel...');
    });
  }

  /* ---- Nuevo Pedido Events ---- */
  function attachNuevoPedidoEvents() {
    // Abrir Catálogo
    document.getElementById('btn-abrir-catalogo')?.addEventListener('click', () => {
      window.open('CATALOGO-OMARE_2025.pdf', '_blank');
    });

    // Buscador de productos con navegación por teclado
    const searchInput = document.getElementById('search-productos');
    const dropdown = document.getElementById('search-results');

    if (searchInput && dropdown) {
      let debounceTimer = null;
      let currentResults = [];   // Resultados actuales de la búsqueda
      let selectedIndex = -1;    // Índice del item seleccionado con teclado

      /**
       * Actualiza la clase .highlighted en los items del dropdown
       */
      function updateHighlight() {
        const items = dropdown.querySelectorAll('.search-result-item[data-ref]');
        items.forEach((item, i) => {
          item.classList.toggle('highlighted', i === selectedIndex);
        });
        // Scroll automático para mantener visible el item seleccionado
        const highlighted = dropdown.querySelector('.search-result-item.highlighted');
        if (highlighted) {
          highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }

      /**
       * Selecciona el producto del índice actual y lo añade al pedido
       */
      function selectCurrentItem() {
        if (selectedIndex >= 0 && selectedIndex < currentResults.length) {
          addProductToOrder(currentResults[selectedIndex]);
          searchInput.value = '';
          dropdown.classList.remove('active');
          currentResults = [];
          selectedIndex = -1;
        }
      }

      /**
       * Renderiza los resultados en el dropdown y resetea la selección
       */
      function renderDropdownResults(results) {
        currentResults = results;
        selectedIndex = -1;

        if (results.length > 0) {
          dropdown.innerHTML = results.map(p => `
              <div class="search-result-item" data-ref="${Formatters.escapeHtml(p.referencia)}">
                <span class="search-result-ref">${Formatters.escapeHtml(p.referencia)}</span>
                <span class="search-result-desc">${Formatters.escapeHtml(p.descripcion)}</span>
                <span class="search-result-size">${Formatters.escapeHtml(p.talla)}</span>
              </div>
            `).join('');
          dropdown.classList.add('active');

          // Click en cada resultado
          dropdown.querySelectorAll('.search-result-item').forEach((item, i) => {
            item.addEventListener('click', () => {
              const producto = results.find(r => r.referencia === item.dataset.ref);
              if (producto) {
                addProductToOrder(producto);
                searchInput.value = '';
                dropdown.classList.remove('active');
                currentResults = [];
                selectedIndex = -1;
              }
            });
            // Hover también actualiza el highlight visual
            item.addEventListener('mouseenter', () => {
              selectedIndex = i;
              updateHighlight();
            });
          });
        } else {
          dropdown.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--color-text-muted)">Sin resultados</div>';
          dropdown.classList.add('active');
        }
      }

      // Evento de escritura: busca productos con debounce
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const query = e.target.value.trim();
          if (query.length < 2) {
            dropdown.classList.remove('active');
            currentResults = [];
            selectedIndex = -1;
            return;
          }
          const results = CsvService.buscarProductos(query);
          renderDropdownResults(results);
        }, 200);
      });

      // Navegación por teclado: ↑ ↓ Enter Escape
      searchInput.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('active') || currentResults.length === 0) return;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % currentResults.length;
            updateHighlight();
            break;

          case 'ArrowUp':
            e.preventDefault();
            selectedIndex = selectedIndex <= 0
              ? currentResults.length - 1
              : selectedIndex - 1;
            updateHighlight();
            break;

          case 'Enter':
            e.preventDefault();
            selectCurrentItem();
            break;

          case 'Escape':
            e.preventDefault();
            dropdown.classList.remove('active');
            currentResults = [];
            selectedIndex = -1;
            break;
        }
      });

      // Cerrar dropdown al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
          currentResults = [];
          selectedIndex = -1;
        }
      });
    }

    // Eventos de la tabla de líneas
    attachLineaEvents();

    // Generar PDF
    document.getElementById('btn-generar-pdf')?.addEventListener('click', () => {
      savePedidoAndGeneratePdf();
    });

    // Guardar Pedido
    document.getElementById('btn-guardar-pedido')?.addEventListener('click', async () => {
      await savePedido();
    });

    // Cancelar / Volver
    document.getElementById('btn-cancelar-pedido')?.addEventListener('click', () => {
      if (pedidoLineas.length > 0 && !confirm('¿Desea salir sin guardar?')) return;
      pedidoLineas = [];
      currentEditingPedidoId = null;
      navigateTo('clienteDetalle');
    });

    // Recalcular resumen al cambiar el descuento
    document.getElementById('input-descuento')?.addEventListener('input', updateSummary);
  }

  function attachLineaEvents() {
    // Inputs de cajas y precios
    document.querySelectorAll('.input-cajas, .price-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        const value = parseFloat(e.target.value) || 0;

        if (pedidoLineas[index]) {
          pedidoLineas[index][field] = value;
          if (field === 'cajas') {
            pedidoLineas[index].cantidad = value * pedidoLineas[index].unidadesPorCaja;
          }
          recalcLinea(index);
        }
      });
    });

    // Eliminar línea
    document.querySelectorAll('[data-action="remove-line"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        pedidoLineas.splice(index, 1);
        refreshPedidoTable();
      });
    });
  }

  function addProductToOrder(producto) {
    pedidoLineas.push({
      codigoReferencia: producto.referencia,
      descripcion: producto.descripcion,
      talla: producto.talla,
      unidadesPorCaja: producto.unidadesPorCaja,
      cajas: 1,
      cantidad: producto.unidadesPorCaja,
      precioUnitario: 0,
      totalLinea: 0
    });

    refreshPedidoTable();
    Toast.show(`${producto.referencia} añadido`);
  }

  function refreshPedidoTable() {
    const tbody = document.getElementById('pedido-lineas-body');
    if (!tbody) return;

    if (pedidoLineas.length > 0) {
      tbody.innerHTML = pedidoLineas.map((l, i) => renderPedidoLineaRow(l, i)).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="9">
        <div class="empty-state" style="padding:var(--spacing-2xl)">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-title">Sin productos</div>
          <div class="empty-state-desc">Use el buscador para añadir productos</div>
        </div>
      </td></tr>`;
    }

    attachLineaEvents();
    updateSummary();
  }

  async function savePedido() {
    if (pedidoLineas.length === 0) {
      Toast.show('Añade al menos un producto', 'error');
      return;
    }

    if (currentEditingPedidoId) {
      await updatePedido();
      return;
    }

    const descuento = parseFloat(document.getElementById('input-descuento')?.value || 0);
    pedidoLineas._descuento = descuento;
    const result = await PedidoService.crear(currentClienteId, pedidoLineas);
    if (result.success) {
      Toast.show(`Pedido ${result.pedido.numeroPedido} guardado`);
      pedidoLineas = [];
      navigateTo('clienteDetalle');
    } else {
      Toast.show(result.error, 'error');
    }
  }

  async function savePedidoAndGeneratePdf() {
    if (pedidoLineas.length === 0) {
      Toast.show('Añade al menos un producto', 'error');
      return;
    }

    if (currentEditingPedidoId) {
      await updatePedido();
      return;
    }

    const descuento = parseFloat(document.getElementById('input-descuento')?.value || 0);
    pedidoLineas._descuento = descuento;
    const result = await PedidoService.crear(currentClienteId, pedidoLineas);
    if (result.success) {
      const cliente = await ClienteService.getById(currentClienteId);
      Toast.show(`Generando PDF para ${result.pedido.numeroPedido}...`, 'success');
      await PdfGenerator.generarPedidoPdf(result.pedido, cliente);
      pedidoLineas = [];
      navigateTo('clienteDetalle');
    } else {
      Toast.show(result.error, 'error');
    }
  }

  /**
   * Carga un pedido existente en el formulario de edición
   * @param {string} pedidoId
   */
  async function startEditPedido(pedidoId) {
    const pedido = await PedidoService.getById(pedidoId);
    if (!pedido) {
      Toast.show('No se pudo cargar el pedido', 'error');
      return;
    }
    currentEditingPedidoId = pedidoId;
    currentClienteId = pedido.clienteId;
    // Cargar las líneas existentes en el estado de edición
    pedidoLineas = pedido.lineas.map(l => ({ ...l }));
    pedidoLineas._descuento = pedido.descuento || 0; // Restaurar descuento del pedido al editar
    navigateTo('nuevoPedido');
  }

  /**
   * Guarda los cambios de un pedido existente
   */
  async function updatePedido() {
    const descuento = parseFloat(document.getElementById('input-descuento')?.value || 0);
    pedidoLineas._descuento = descuento;
    const result = await PedidoService.actualizarLineas(currentEditingPedidoId, pedidoLineas);
    if (result.success) {
      Toast.show(`Pedido ${result.pedido.numeroPedido} actualizado`);
      const pedidoEditadoId = currentEditingPedidoId;
      pedidoLineas = [];
      currentEditingPedidoId = null;
      navigateTo('verPedido', { pedidoId: pedidoEditadoId });
    } else {
      Toast.show(result.error, 'error');
    }
  }

  async function generatePdfForPedido(pedidoId) {
    const pedido = await PedidoService.getById(pedidoId);
    if (!pedido) return;
    const cliente = await ClienteService.getById(pedido.clienteId);
    Toast.show('Generando PDF...', 'success');
    await PdfGenerator.generarPedidoPdf(pedido, cliente || { nombre: 'Sin cliente' });
  }

  async function enviarPedidoPorEmail(pedidoId, tipo = 'cliente', customCentralEmail = null) {
    const pedido = await PedidoService.getById(pedidoId);
    if (!pedido) return;
    const cliente = await ClienteService.getById(pedido.clienteId);

    const isCentral = tipo === 'central';
    const recipient = isCentral ? (customCentralEmail || CENTRAL_EMAILS[0]) : (cliente?.email || '');
    const subject = isCentral
      ? `NUEVO PEDIDO: ${pedido.numeroPedido} - ${cliente?.nombre || 'S/N'}`
      : `Proforma de Pedido ${pedido.numeroPedido} - OMARE`;

    let body = isCentral
      ? `Hola Central,\n\nSe ha generado un nuevo pedido para su preparación:\n\n`
      : `Hola ${cliente?.nombre || 'Cliente'},\n\nAquí tienes los detalles de tu pedido ${pedido.numeroPedido} realizado el ${Formatters.date(pedido.fecha)}:\n\n`;

    (pedido.lineas || []).forEach(l => {
      body += `- ${l.codigoReferencia} | ${l.descripcion} (${l.talla}): ${l.cajas} cj x ${Formatters.currency(l.precioUnitario)} = ${Formatters.currency(l.totalLinea)}\n`;
    });

    body += `\nTotal Cajas: ${pedido.totalCajas}`;
    if (pedido.descuento > 0) {
      body += `\nDescuento aplicado: ${pedido.descuento}%`;
    }
    body += `\nBase Imponible: ${Formatters.currency(pedido.subtotal)}`;
    body += `\nIVA (21%): ${Formatters.currency(pedido.iva)}`;
    body += `\nTOTAL: ${Formatters.currency(pedido.total)}`;

    if (isCentral) {
      body += `\n\nCliente: ${cliente?.nombre || 'S/N'}`;
      body += `\nDirección: ${cliente?.direccion || 'S/N'}`;
      body += `\nTeléfono: ${cliente?.telefono || 'S/N'}`;
    }

    body += `\n\nGracias.\nOMARE`;

    const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    Toast.show(`Abriendo correo para ${isCentral ? 'Central' : 'Cliente'}...`);
  }

  /**
   * Muestra un modal para elegir a cuál correo de Central se envía el pedido
   * @param {string} pedidoId
   */
  function showCentralEmailPickerModal(pedidoId) {
    const existing = document.getElementById('modal-central-email');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-central-email';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <h2 class="modal-title">🏢 Enviar a Central</h2>
          <button class="modal-close" id="modal-central-close">✕</button>
        </div>
        <div class="modal-body" style="gap:var(--spacing-md)">
          <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);margin-bottom:var(--spacing-xs)">
            ¿A qué correo de Central envías este pedido?
          </p>
          ${CENTRAL_EMAILS.map(email => `
            <button class="central-email-option" data-email="${email}">
              <span style="font-size:1.2rem">📬</span>
              <span>${email}</span>
            </button>
          `).join('')}
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="btn-central-cancel">Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('modal-central-close')?.addEventListener('click', close);
    document.getElementById('btn-central-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelectorAll('.central-email-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectedEmail = btn.dataset.email;
        close();
        await enviarPedidoPorEmail(pedidoId, 'central', selectedEmail);
      });
    });
  }

  async function repeatPedido(pedidoId) {
    const result = await PedidoService.repetir(pedidoId);
    if (result.success) {
      Toast.show(`Pedido repetido: ${result.pedido.numeroPedido}`);
      navigateTo('clienteDetalle');
    } else {
      Toast.show(result.error, 'error');
    }
  }

  /* ---- Ver Pedido Events ---- */
  function attachVerPedidoEvents() {
    document.getElementById('btn-back-cliente-detalle')?.addEventListener('click', () => {
      navigateTo('clienteDetalle');
    });

    document.getElementById('btn-email-cliente')?.addEventListener('click', async () => {
      await enviarPedidoPorEmail(currentPedidoId, 'cliente');
    });

    document.getElementById('btn-email-central')?.addEventListener('click', () => {
      showCentralEmailPickerModal(currentPedidoId);
    });

    document.getElementById('btn-pdf-ver-pedido')?.addEventListener('click', async () => {
      await generatePdfForPedido(currentPedidoId);
    });

    document.getElementById('btn-editar-pedido')?.addEventListener('click', async () => {
      await startEditPedido(currentPedidoId);
    });

    document.getElementById('btn-repetir-ver-pedido')?.addEventListener('click', async () => {
      await repeatPedido(currentPedidoId);
    });

    // Selector de estado — guarda automáticamente al cambiar
    document.getElementById('select-estado-pedido')?.addEventListener('change', async (e) => {
      const nuevoEstado = e.target.value;
      const result = await PedidoService.actualizarEstado(currentPedidoId, nuevoEstado);
      if (result.success) {
        Toast.show(`Estado actualizado: ${nuevoEstado}`);
      } else {
        Toast.show(result.error, 'error');
      }
    });

    // Guardar notas
    document.getElementById('btn-guardar-notas')?.addEventListener('click', async () => {
      const notas = document.getElementById('textarea-notas-pedido')?.value || '';
      const result = await PedidoService.actualizarNotas(currentPedidoId, notas);
      if (result.success) {
        Toast.show('Notas guardadas');
      } else {
        Toast.show(result.error, 'error');
      }
    });
  }

  /* ================================================
     MODAL HELPERS
     ================================================ */

  function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
  }

  function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  }

  /* ================================================
     ESTADÍSTICAS VIEW
     ================================================ */

  let currentStatsPeriod = 'all'; // Período activo de filtro

  /**
   * Filtra pedidos por período temporal.
   * Retorna solo los pedidos cuya fecha esté dentro del período.
   */
  function filterPedidosByPeriod(pedidos, period) {
    if (period === 'all') return pedidos;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start;
    switch (period) {
      case 'day':
        start = startOfDay;
        break;
      case 'week': {
        const dayOfWeek = now.getDay() || 7; // lunes = 1
        start = new Date(startOfDay);
        start.setDate(start.getDate() - (dayOfWeek - 1));
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return pedidos;
    }

    return pedidos.filter(p => new Date(p.fecha) >= start);
  }

  /**
   * Calcula todas las estadísticas a partir de los pedidos filtrados.
   */
  async function computeEstadisticas(period) {
    const allPedidos = await PedidoService.getAll();
    const pedidos = filterPedidosByPeriod(allPedidos, period);

    // KPIs globales
    const totalVentas = pedidos.reduce((s, p) => s + (p.total || 0), 0);
    const totalPedidos = pedidos.length;
    const totalCajas = pedidos.reduce((s, p) => s + (p.totalCajas || 0), 0);
    const clientesUnicos = new Set(pedidos.map(p => p.clienteId)).size;

    // Top clientes por total facturado
    const clienteTotals = {};
    const clientePedidoCount = {};
    pedidos.forEach(p => {
      const id = p.clienteId;
      clienteTotals[id] = (clienteTotals[id] || 0) + (p.total || 0);
      clientePedidoCount[id] = (clientePedidoCount[id] || 0) + 1;
    });

    const topClientesRaw = Object.entries(clienteTotals).map(([id, total]) => ({ id, total }));
    const topClientesPromises = topClientesRaw.map(async ({ id, total }) => {
      const cliente = await ClienteService.getById(id);
      return {
        nombre: cliente ? cliente.nombre : 'Cliente eliminado',
        total,
        pedidos: clientePedidoCount[id] || 0
      };
    });

    let topClientes = await Promise.all(topClientesPromises);
    topClientes = topClientes.sort((a, b) => b.total - a.total).slice(0, 10);

    // Top productos por unidades vendidas
    const productoTotals = {};
    pedidos.forEach(p => {
      (p.lineas || []).forEach(l => {
        const key = l.codigoReferencia;
        if (!productoTotals[key]) {
          productoTotals[key] = {
            referencia: l.codigoReferencia,
            descripcion: l.descripcion,
            talla: l.talla || '',
            totalUnidades: 0,
            totalCajas: 0,
            totalImporte: 0
          };
        }
        productoTotals[key].totalUnidades += (l.cantidad || 0);
        productoTotals[key].totalCajas += (l.cajas || 0);
        productoTotals[key].totalImporte += (l.totalLinea || 0);
      });
    });

    const topProductos = Object.values(productoTotals)
      .sort((a, b) => b.totalUnidades - a.totalUnidades)
      .slice(0, 10);

    return {
      totalVentas,
      totalPedidos,
      totalCajas,
      clientesUnicos,
      topClientes,
      topProductos
    };
  }

  async function renderEstadisticasView() {
    const stats = await computeEstadisticas(currentStatsPeriod);
    const periodLabels = {
      day: 'Hoy',
      week: 'Esta Semana',
      month: 'Este Mes',
      year: 'Este Año',
      all: 'Todo'
    };

    const maxClienteTotal = stats.topClientes.length > 0 ? stats.topClientes[0].total : 1;
    const maxProductoUds = stats.topProductos.length > 0 ? stats.topProductos[0].totalUnidades : 1;

    function medalClass(index) {
      if (index === 0) return 'gold';
      if (index === 1) return 'silver';
      if (index === 2) return 'bronze';
      return '';
    }

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Estadísticas</h1>
          <p class="page-subtitle">Panel de análisis de ventas — ${periodLabels[currentStatsPeriod]}</p>
        </div>
      </div>

      <!-- Filtros de período -->
      <div class="stats-filters">
        ${Object.entries(periodLabels).map(([key, label]) => `
          <button class="stats-filter-btn ${currentStatsPeriod === key ? 'active' : ''}" data-period="${key}">
            ${label}
          </button>
        `).join('')}
      </div>

      <!-- KPIs -->
      <div class="stats-summary-grid">
        <div class="stats-summary-card">
          <div class="stats-summary-card-icon">💰</div>
          <div class="stats-summary-card-value">${Formatters.currency(stats.totalVentas)}</div>
          <div class="stats-summary-card-label">Total Facturado</div>
        </div>
        <div class="stats-summary-card green">
          <div class="stats-summary-card-icon">📦</div>
          <div class="stats-summary-card-value">${stats.totalPedidos}</div>
          <div class="stats-summary-card-label">Pedidos</div>
        </div>
        <div class="stats-summary-card blue">
          <div class="stats-summary-card-icon">📋</div>
          <div class="stats-summary-card-value">${stats.totalCajas}</div>
          <div class="stats-summary-card-label">Total Cajas</div>
        </div>
        <div class="stats-summary-card orange">
          <div class="stats-summary-card-icon">👥</div>
          <div class="stats-summary-card-value">${stats.clientesUnicos}</div>
          <div class="stats-summary-card-label">Clientes Activos</div>
        </div>
      </div>

      <!-- Rankings -->
      <div class="stats-sections-grid">
        <!-- Top Clientes -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-header-title">🏆 Top Clientes</h3>
            <span class="badge badge-primary">por facturación</span>
          </div>
          <div class="card-body">
            ${stats.topClientes.length > 0 ? `
              <ul class="ranking-list">
                ${stats.topClientes.map((c, i) => `
                  <li class="ranking-item">
                    <div class="ranking-position ${medalClass(i)}">${i + 1}</div>
                    <div class="ranking-bar-container">
                      <div class="ranking-name">${Formatters.escapeHtml(c.nombre)}</div>
                      <div class="ranking-bar-bg">
                        <div class="ranking-bar-fill" style="width:${Math.round((c.total / maxClienteTotal) * 100)}%"></div>
                      </div>
                    </div>
                    <div style="text-align:right">
                      <div class="ranking-value">${Formatters.currency(c.total)}</div>
                      <div class="ranking-detail">${c.pedidos} pedido(s)</div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : `
              <div class="empty-state" style="padding:var(--spacing-xl)">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-title">Sin datos</div>
                <div class="empty-state-desc">No hay pedidos en el período seleccionado</div>
              </div>
            `}
          </div>
        </div>

        <!-- Top Productos -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-header-title">📦 Top Productos</h3>
            <span class="badge badge-primary">por unidades</span>
          </div>
          <div class="card-body">
            ${stats.topProductos.length > 0 ? `
              <ul class="ranking-list">
                ${stats.topProductos.map((p, i) => `
                  <li class="ranking-item">
                    <div class="ranking-position ${medalClass(i)}">${i + 1}</div>
                    <div class="ranking-bar-container">
                      <div class="ranking-name" title="${Formatters.escapeHtml(p.descripcion)}">${Formatters.escapeHtml(p.referencia)}</div>
                      <div class="ranking-bar-bg">
                        <div class="ranking-bar-fill" style="width:${Math.round((p.totalUnidades / maxProductoUds) * 100)}%"></div>
                      </div>
                    </div>
                    <div style="text-align:right">
                      <div class="ranking-value">${p.totalUnidades} uds</div>
                      <div class="ranking-detail">${p.totalCajas} cj · ${Formatters.currency(p.totalImporte)}</div>
                    </div>
                  </li>
                `).join('')}
              </ul>
            ` : `
              <div class="empty-state" style="padding:var(--spacing-xl)">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-title">Sin datos</div>
                <div class="empty-state-desc">No hay pedidos en el período seleccionado</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function attachEstadisticasEvents() {
    document.querySelectorAll('.stats-filter-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        currentStatsPeriod = btn.dataset.period;
        // Re-render solo el contenido de la página, no el layout completo
        const pageContent = document.getElementById('page-content');
        if (pageContent) {
          pageContent.innerHTML = await renderEstadisticasView();
          attachEstadisticasEvents();
        }
      });
    });
  }


  /* ================================================
     CAMPAÑAS VIEW — Ofertas y Recordatorios
     ================================================ */

  async function renderCampanyasView() {
    const clientes = await ClienteService.getAll();
    const pedidos = await PedidoService.getAll();

    // Calcular última compra por cliente
    const ultimaCompraPor = {};
    pedidos.forEach(p => {
      const prev = ultimaCompraPor[p.clienteId];
      const fecha = new Date(p.fecha);
      if (!prev || fecha > prev) ultimaCompraPor[p.clienteId] = fecha;
    });

    const ahora = new Date();
    const clientesConActividad = clientes.map(c => ({
      ...c,
      ultimaCompra: ultimaCompraPor[c.id] || null,
      diasInactivo: ultimaCompraPor[c.id]
        ? Math.floor((ahora - ultimaCompraPor[c.id]) / 86400000)
        : 9999
    }));

    const clientesHtml = clientesConActividad.map(c => `
      <div class="cliente-seleccion-item" data-cliente-id="${c.id}">
        <input type="checkbox" class="chk-cliente-oferta" data-email="${Formatters.escapeHtml(c.email || '')}" data-nombre="${Formatters.escapeHtml(c.nombre)}">
        <span class="cliente-seleccion-nombre">${Formatters.escapeHtml(c.nombre)}</span>
        <span class="cliente-seleccion-meta">${c.email ? Formatters.escapeHtml(c.email) : '<em>Sin email</em>'}</span>
      </div>
    `).join('');

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">📣 Campañas</h1>
          <p class="page-subtitle">Comunica ofertas o envía recordatorios a tus clientes</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="campanyas-tabs">
        <button class="campanya-tab active" data-tab="ofertas">🏷️ Ofertas & Promociones</button>
        <button class="campanya-tab" data-tab="recordatorios">🔔 Recordatorios de Inactividad</button>
      </div>

      <!-- ===== TAB OFERTAS ===== -->
      <div class="campanya-panel active" id="tab-ofertas">
        <div class="campanya-grid">

          <!-- Columna izquierda: Selección de clientes -->
          <div class="campanya-card">
            <div class="campanya-card-title">👤 Seleccionar destinatarios</div>
            <div class="seleccion-actions">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="chk-todos-oferta"> Seleccionar todos
              </label>
              <span id="oferta-seleccionados-count">0 seleccionados</span>
            </div>
            <div class="clientes-seleccion" id="lista-clientes-oferta">
              ${clientesHtml}
            </div>
          </div>

          <!-- Columna derecha: Redactar email -->
          <div class="campanya-card">
            <div class="campanya-card-title">✉️ Redactar email</div>
            <div class="form-group">
              <label class="form-label">Asunto</label>
              <input type="text" class="form-input" id="oferta-asunto"
                value="🏷️ Oferta especial OMARE — ¡No te la pierdas!">
            </div>
            <div class="form-group">
              <label class="form-label">Cuerpo del mensaje</label>
              <textarea class="email-preview" id="oferta-cuerpo">Buenos días,

Nos complace comunicarle que tenemos una oferta especial disponible para usted.

[Describa aquí la oferta, artículos en promoción, precios especiales, etc.]

Puede consultar nuestro catálogo completo y descargarlo desde:
https://www.omare.com/wp-content/uploads/2025/01/CATALOGO-OMARE_2025.pdf

Estamos a su disposición para cualquier consulta.

Un saludo,
Equipo OMARE</textarea>
            </div>
            <button class="btn btn-primary" id="btn-enviar-oferta" style="width:100%">
              📤 Abrir correo con destinatarios seleccionados
            </button>
          </div>
        </div>
      </div>

      <!-- ===== TAB RECORDATORIOS ===== -->
      <div class="campanya-panel" id="tab-recordatorios">
        <div class="campanya-grid">

          <!-- Columna izquierda: Filtro + clientes inactivos -->
          <div class="campanya-card">
            <div class="campanya-card-title">⏱️ Filtrar clientes inactivos</div>
            <div class="inactivity-filter">
              <button class="inactivity-btn active" data-dias="7">1 semana</button>
              <button class="inactivity-btn" data-dias="30">1 mes</button>
              <button class="inactivity-btn" data-dias="90">+3 meses</button>
              <button class="inactivity-btn" data-dias="9999">Sin compras</button>
            </div>
            <div class="seleccion-actions">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" id="chk-todos-recordatorio"> Seleccionar todos
              </label>
              <span id="recordatorio-seleccionados-count">0 seleccionados</span>
            </div>
            <div class="clientes-seleccion" id="lista-clientes-recordatorio">
              <div class="clientes-empty">Selecciona un filtro para ver clientes</div>
            </div>
          </div>

          <!-- Columna derecha: Plantilla recordatorio -->
          <div class="campanya-card">
            <div class="campanya-card-title">✉️ Plantilla de recordatorio</div>
            <div class="form-group">
              <label class="form-label">Asunto</label>
              <input type="text" class="form-input" id="recordatorio-asunto"
                value="OMARE — Le echamos de menos 👋">
            </div>
            <div class="form-group">
              <label class="form-label">Cuerpo del mensaje</label>
              <textarea class="email-preview" id="recordatorio-cuerpo">Buenos días,

En OMARE seguimos a su disposición y nos gustaría recordarle que estamos aquí para atenderle.

Consulte nuestro catálogo con las últimas novedades y descárguelo desde:
https://www.omare.com/wp-content/uploads/2025/01/CATALOGO-OMARE_2025.pdf

No dude en contactarnos para realizar su próximo pedido. Estaremos encantados de atenderle.

Un saludo,
Equipo OMARE</textarea>
            </div>
            <button class="btn btn-primary" id="btn-enviar-recordatorio" style="width:100%">
              📤 Enviar recordatorio a seleccionados
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ---- Campañas Events ---- */
  function attachCampanyasEvents() {
    // ---- Tabs ----
    document.querySelectorAll('.campanya-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.campanya-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.campanya-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
      });
    });

    // ---- Helper: contar seleccionados y actualizar badge ----
    function actualizarContadorSeleccion(listaId, badgeId) {
      const total = document.querySelectorAll(`#${listaId} .chk-cliente-oferta:checked,#${listaId} .chk-cliente-recordatorio:checked`).length;
      const badge = document.getElementById(badgeId);
      if (badge) badge.textContent = `${total} seleccionados`;
    }

    // ---- OFERTAS: Seleccionar todos ----
    document.getElementById('chk-todos-oferta')?.addEventListener('change', (e) => {
      document.querySelectorAll('#lista-clientes-oferta .chk-cliente-oferta').forEach(chk => {
        chk.checked = e.target.checked;
      });
      actualizarContadorSeleccion('lista-clientes-oferta', 'oferta-seleccionados-count');
    });

    document.getElementById('lista-clientes-oferta')?.addEventListener('change', () => {
      actualizarContadorSeleccion('lista-clientes-oferta', 'oferta-seleccionados-count');
    });

    // ---- OFERTAS: Enviar ----
    document.getElementById('btn-enviar-oferta')?.addEventListener('click', () => {
      const seleccionados = [...document.querySelectorAll('#lista-clientes-oferta .chk-cliente-oferta:checked')];
      const emails = seleccionados.map(c => c.dataset.email).filter(Boolean);
      if (emails.length === 0) {
        Toast.show('Selecciona al menos un cliente con email', 'error');
        return;
      }
      const asunto = document.getElementById('oferta-asunto')?.value || '';
      const cuerpo = document.getElementById('oferta-cuerpo')?.value || '';
      const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(mailto);
      Toast.show(`Correo preparado para ${emails.length} cliente(s)`);
    });

    // ---- RECORDATORIOS: Filtro de inactividad ----
    const clientesData = []; // será poblado al filtrar
    document.querySelectorAll('.inactivity-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.inactivity-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const diasMinimos = parseInt(btn.dataset.dias);
        const clientes = await ClienteService.getAll();
        const pedidos = await PedidoService.getAll();

        const ahora = new Date();
        const ultimaCompraPor = {};
        pedidos.forEach(p => {
          const prev = ultimaCompraPor[p.clienteId];
          const fecha = new Date(p.fecha);
          if (!prev || fecha > prev) ultimaCompraPor[p.clienteId] = fecha;
        });

        const inactivos = clientes.filter(c => {
          const ultima = ultimaCompraPor[c.id];
          if (!ultima) return true; // nunca ha comprado
          const dias = Math.floor((ahora - ultima) / 86400000);
          return dias >= diasMinimos;
        }).sort((a, b) => {
          const da = ultimaCompraPor[a.id] ? (ahora - ultimaCompraPor[a.id]) : Infinity;
          const db = ultimaCompraPor[b.id] ? (ahora - ultimaCompraPor[b.id]) : Infinity;
          return db - da;
        });

        const lista = document.getElementById('lista-clientes-recordatorio');
        if (!lista) return;

        if (inactivos.length === 0) {
          lista.innerHTML = `<div class="clientes-empty">No hay clientes inactivos con ese criterio</div>`;
          return;
        }

        lista.innerHTML = inactivos.map(c => {
          const ultima = ultimaCompraPor[c.id];
          const label = ultima
            ? `Última compra: ${Formatters.date(ultima)}`
            : 'Sin historial de compras';
          return `<div class="cliente-seleccion-item">
            <input type="checkbox" class="chk-cliente-recordatorio" data-email="${Formatters.escapeHtml(c.email || '')}" data-nombre="${Formatters.escapeHtml(c.nombre)}">
            <span class="cliente-seleccion-nombre">${Formatters.escapeHtml(c.nombre)}</span>
            <span class="cliente-seleccion-meta">${label}</span>
          </div>`;
        }).join('');

        // Re-wire checkboxes del recordatorio
        lista.addEventListener('change', () => {
          actualizarContadorSeleccion('lista-clientes-recordatorio', 'recordatorio-seleccionados-count');
        });

        actualizarContadorSeleccion('lista-clientes-recordatorio', 'recordatorio-seleccionados-count');
      });
    });

    // ---- RECORDATORIOS: Seleccionar todos ----
    document.getElementById('chk-todos-recordatorio')?.addEventListener('change', (e) => {
      document.querySelectorAll('#lista-clientes-recordatorio .chk-cliente-recordatorio').forEach(chk => {
        chk.checked = e.target.checked;
      });
      actualizarContadorSeleccion('lista-clientes-recordatorio', 'recordatorio-seleccionados-count');
    });

    // ---- RECORDATORIOS: Enviar ----
    document.getElementById('btn-enviar-recordatorio')?.addEventListener('click', () => {
      const seleccionados = [...document.querySelectorAll('#lista-clientes-recordatorio .chk-cliente-recordatorio:checked')];
      const emails = seleccionados.map(c => c.dataset.email).filter(Boolean);
      if (emails.length === 0) {
        Toast.show('Selecciona al menos un cliente con email', 'error');
        return;
      }
      const asunto = document.getElementById('recordatorio-asunto')?.value || '';
      const cuerpo = document.getElementById('recordatorio-cuerpo')?.value || '';
      const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(mailto);
      Toast.show(`Recordatorio preparado para ${emails.length} cliente(s)`);
    });
  }

  /* ================================================
     MIS DATOS — Importar / Exportar Clientes
     ================================================ */

  async function renderDatosView() {
    const clientes = await ClienteService.getAll();

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">Mis Datos</h1>
          <p class="page-subtitle">Exporta una copia de seguridad de tus clientes o importa nuevos desde un archivo</p>
        </div>
      </div>

      <div class="datos-grid">

        <!-- Exportar -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-header-title">📥 Exportar Clientes</h3>
          </div>
          <div class="card-body">
            <p style="color:var(--color-text-muted);margin-bottom:var(--spacing-md);line-height:1.6">
              Tienes <strong>${clientes.length} cliente(s)</strong> registrados. Descarga un archivo
              con todos sus datos (Nombre, Email, Dirección, Teléfono, Observaciones).
              Puedes usar este mismo archivo para importarlos de nuevo si fuera necesario.
            </p>
            <div style="display:flex;gap:var(--spacing-md);flex-wrap:wrap">
              <button class="btn btn-primary" id="btn-exportar-clientes-excel" ${clientes.length === 0 ? 'disabled' : ''}>
                📥 Descargar Excel (.xlsx)
              </button>
              <button class="btn btn-outline" id="btn-exportar-clientes-csv" ${clientes.length === 0 ? 'disabled' : ''}>
                📄 Descargar CSV (.csv)
              </button>
            </div>
            ${clientes.length === 0 ? `<p style="margin-top:var(--spacing-md);color:var(--color-text-muted);font-size:var(--font-size-sm)">Crea clientes para poder exportarlos.</p>` : ''}
          </div>
        </div>

        <!-- Importar -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-header-title">📤 Importar Clientes</h3>
          </div>
          <div class="card-body">
            <p style="color:var(--color-text-muted);margin-bottom:var(--spacing-md);line-height:1.6">
              Sube un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con tus clientes.
              Los que ya existan (mismo nombre) serán omitidos; los nuevos se crearán automáticamente.
            </p>
            <div class="import-drop-zone" id="import-drop-zone">
              <div class="import-drop-icon">📁</div>
              <div class="import-drop-text">Arrastra tu archivo aquí</div>
              <div class="import-drop-sub">o</div>
              <label class="btn btn-outline" style="cursor:pointer;margin-top:var(--spacing-sm)">
                Seleccionar archivo
                <input type="file" id="input-import-file" accept=".xlsx,.csv" style="display:none">
              </label>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:var(--spacing-md)">
                Columnas requeridas: <strong>Nombre</strong> · opcionales: Email, Dirección, Teléfono, Observaciones
              </div>
            </div>
            <div id="import-results" style="margin-top:var(--spacing-lg)"></div>
          </div>
        </div>

      </div>
    `;
  }

  function attachDatosEvents() {
    // Exportar Excel
    document.getElementById('btn-exportar-clientes-excel')?.addEventListener('click', async () => {
      await exportarClientesExcel();
    });

    // Exportar CSV
    document.getElementById('btn-exportar-clientes-csv')?.addEventListener('click', async () => {
      await exportarClientesCsv();
    });

    // Input de archivo
    const fileInput = document.getElementById('input-import-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processImportFile(file);
      });
    }

    // Drag & Drop
    const dropZone = document.getElementById('import-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processImportFile(file);
      });
    }
  }

  /**
   * Exporta todos los clientes a Excel (.xlsx)
   */
  async function exportarClientesExcel() {
    if (!window.XLSX) {
      Toast.show('Librería Excel no disponible', 'error');
      return;
    }
    const clientes = await ClienteService.getAll();
    if (clientes.length === 0) return;

    const filas = clientes.map(c => ({
      'Nombre': c.nombre || '',
      'Email': c.email || '',
      'Dirección': c.direccion || '',
      'Teléfono': c.telefono || '',
      'Observaciones': c.observaciones || ''
    }));

    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 18 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `clientes_OMARE_${fecha}.xlsx`);
    Toast.show(`${clientes.length} cliente(s) exportados`);
    localStorage.setItem('omare_last_backup_reminder', Date.now().toString());
  }

  /**
   * Exporta todos los clientes a CSV (.csv)
   */
  async function exportarClientesCsv() {
    const clientes = await ClienteService.getAll();
    if (clientes.length === 0) return;

    const escapeCsv = (val) => `"${(val || '').replace(/"/g, '""')}"`;
    const headers = ['Nombre', 'Email', 'Dirección', 'Teléfono', 'Observaciones'];
    const rows = clientes.map(c => [
      escapeCsv(c.nombre),
      escapeCsv(c.email),
      escapeCsv(c.direccion),
      escapeCsv(c.telefono),
      escapeCsv(c.observaciones)
    ].join(','));

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n'); // BOM para Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `clientes_OMARE_${fecha}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    Toast.show(`${clientes.length} cliente(s) exportados en CSV`);
    localStorage.setItem('omare_last_backup_reminder', Date.now().toString());
  }

  /**
   * Lee el archivo subido (.xlsx o .csv) y muestra la previsualización
   */
  async function processImportFile(file) {
    const resultsEl = document.getElementById('import-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = `<div style="text-align:center;padding:var(--spacing-xl)"><div class="spinner"></div><p style="color:var(--color-text-muted);margin-top:var(--spacing-md)">Leyendo archivo...</p></div>`;

    try {
      let rows = [];
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'csv') {
        const text = await file.text();
        rows = parseCsvParaImport(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (!window.XLSX) { Toast.show('Librería Excel no disponible', 'error'); return; }
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      } else {
        Toast.show('Formato no soportado. Usa .xlsx o .csv', 'error');
        resultsEl.innerHTML = '';
        return;
      }

      if (rows.length === 0) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-state-title">El archivo está vacío o no tiene datos reconocibles</div></div>`;
        return;
      }

      showImportPreview(rows, resultsEl);

    } catch (err) {
      console.error('[Import] Error leyendo archivo:', err);
      resultsEl.innerHTML = `<div style="color:var(--color-danger);padding:var(--spacing-md)">❌ Error al leer el archivo: ${Formatters.escapeHtml(err.message)}</div>`;
    }
  }

  /**
   * Parser CSV simple que soporta campos entrecomillados y BOM
   */
  function parseCsvParaImport(text) {
    // Eliminar BOM si existe
    const clean = text.replace(/^\uFEFF/, '');
    const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim()); current = '';
        } else { current += ch; }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
    return lines.slice(1).map(line => {
      const vals = parseRow(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  }

  /**
   * Normaliza columnas del archivo (acepta variantes en español/inglés)
   */
  function normalizarFilaCliente(row) {
    const get = (...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().trim() === k.toLowerCase());
        if (found && row[found]) return row[found].trim();
      }
      return '';
    };
    return {
      nombre: get('nombre', 'name', 'client', 'cliente'),
      email: get('email', 'correo', 'mail', 'e-mail'),
      direccion: get('dirección', 'direccion', 'address', 'direccón'),
      telefono: get('teléfono', 'telefono', 'phone', 'tel'),
      observaciones: get('observaciones', 'notes', 'notas', 'comentarios')
    };
  }

  /**
   * Muestra previsualización de clientes a importar con botón de confirmación
   */
  function showImportPreview(rows, resultsEl) {
    const clientes = rows.map(normalizarFilaCliente).filter(c => c.nombre.length > 0);
    if (clientes.length === 0) {
      resultsEl.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">No se encontraron clientes válidos</div>
        <div class="empty-state-desc">Asegúrate de que el archivo tiene una columna "Nombre"</div>
      </div>`;
      return;
    }

    _importPreviewClientes = clientes;

    resultsEl.innerHTML = `
      <div class="card" style="margin-top:0">
        <div class="card-header">
          <h3 class="card-header-title">Vista previa — ${clientes.length} cliente(s) encontrado(s)</h3>
        </div>
        <div class="card-body" style="padding:0">
          <div class="table-container" style="max-height:220px;overflow-y:auto">
            <table class="data-table">
              <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th></tr></thead>
              <tbody>
                ${clientes.slice(0, 15).map(c => `
                  <tr>
                    <td>${Formatters.escapeHtml(c.nombre)}</td>
                    <td>${Formatters.escapeHtml(c.email)}</td>
                    <td>${Formatters.escapeHtml(c.telefono)}</td>
                  </tr>
                `).join('')}
                ${clientes.length > 15 ? `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">... y ${clientes.length - 15} más</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          <div style="padding:var(--spacing-lg);display:flex;gap:var(--spacing-md);justify-content:flex-end">
            <button class="btn btn-ghost" id="btn-cancelar-import">Cancelar</button>
            <button class="btn btn-primary" id="btn-confirmar-import">✓ Importar ${clientes.length} cliente(s)</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-cancelar-import')?.addEventListener('click', () => {
      resultsEl.innerHTML = '';
      _importPreviewClientes = [];
      const fi = document.getElementById('input-import-file');
      if (fi) fi.value = '';
    });

    document.getElementById('btn-confirmar-import')?.addEventListener('click', async () => {
      await executeImport(_importPreviewClientes, resultsEl);
    });
  }

  /**
   * Crea los clientes nuevos, omitiendo los que ya existen por nombre
   */
  async function executeImport(clientes, resultsEl) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:var(--spacing-xl)"><div class="spinner"></div><p style="color:var(--color-text-muted);margin-top:var(--spacing-md)">Importando ${clientes.length} clientes...</p></div>`;

    const existentes = await ClienteService.getAll();
    const nombresExistentes = new Set(existentes.map(c => c.nombre.toLowerCase().trim()));

    const nuevos = clientes.filter(c => !nombresExistentes.has(c.nombre.toLowerCase().trim()));
    const omitidos = clientes.length - nuevos.length;

    let creados = 0;
    let errores = 0;
    for (const cliente of nuevos) {
      const result = await ClienteService.crear(cliente);
      if (result.success) { creados++; } else { errores++; }
    }

    _importPreviewClientes = [];

    resultsEl.innerHTML = `
      <div class="card" style="margin-top:0">
        <div class="card-body">
          <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);margin-bottom:var(--spacing-md)">
            ✅ Importación completada
          </div>
          <div style="display:flex;gap:var(--spacing-xl);margin-bottom:var(--spacing-lg)">
            <div><strong style="font-size:var(--font-size-xl)">${creados}</strong><br><span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">creados</span></div>
            <div><strong style="font-size:var(--font-size-xl)">${omitidos}</strong><br><span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">ya existían</span></div>
            ${errores > 0 ? `<div><strong style="font-size:var(--font-size-xl);color:var(--color-danger)">${errores}</strong><br><span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">errores</span></div>` : ''}
          </div>
          <button class="btn btn-outline" id="btn-ir-clientes-import">Ir a Clientes</button>
        </div>
      </div>
    `;

    document.getElementById('btn-ir-clientes-import')?.addEventListener('click', () => navigateTo('clientes'));
    Toast.show(`Importación: ${creados} cliente(s) creados`);
  }

  /* ================================================
     RECORDATORIO MENSUAL DE BACKUP
     ================================================ */

  /**
   * Comprueba si han pasado ≥30 días desde el último recordatorio.
   * Si es así y hay clientes, muestra el modal de backup.
   */
  async function checkMonthlyBackupReminder() {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const last = parseInt(localStorage.getItem('omare_last_backup_reminder') || '0');
    if (Date.now() - last < THIRTY_DAYS_MS) return;

    const clientes = await ClienteService.getAll();
    if (clientes.length === 0) return;

    showBackupReminderModal(clientes.length);
  }

  function showBackupReminderModal(totalClientes) {
    // Evitar duplicados si se llama varias veces
    if (document.getElementById('modal-backup-reminder')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-backup-reminder';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-header">
          <h2 class="modal-title">🔔 Recordatorio mensual</h2>
        </div>
        <div class="modal-body">
          <p style="color:var(--color-text-muted);line-height:1.6">
            Ha pasado más de un mes desde tu última copia de seguridad.
            Tienes <strong>${totalClientes} cliente(s)</strong> registrados.
          </p>
          <p style="color:var(--color-text-muted);line-height:1.6;margin-top:var(--spacing-md)">
            ¿Quieres descargar una copia actualizada de seguridad de todos tus clientes?
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="btn-reminder-no">No, gracias</button>
          <button class="btn btn-primary" id="btn-reminder-si">📥 Sí, descargar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.remove();
      localStorage.setItem('omare_last_backup_reminder', Date.now().toString());
    };

    document.getElementById('btn-reminder-no')?.addEventListener('click', close);
    document.getElementById('btn-reminder-si')?.addEventListener('click', async () => {
      close();
      await exportarClientesExcel();
    });
  }

  /* ================================================
     INICIALIZACIÓN
     ================================================ */

  async function init() {
    // Inicializar Auth de Supabase
    await AuthService.init();

    // Cargar catálogo CSV
    await CsvService.cargarProductos('catalogo.csv');
    console.info(`[App] Iniciado. ${CsvService.totalProductos()} productos cargados.`);

    // Verificar autenticación
    if (AuthService.isAuthenticated()) {
      navigateTo('clientes');
      // Recordatorio mensual de copia de seguridad (no bloquea la UI)
      checkMonthlyBackupReminder();
    } else {
      navigateTo('login');
    }
  }

  return { init, navigateTo };
})();

// Arrancar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());
