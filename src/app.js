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

  const CENTRAL_EMAIL = 'pedidos@omare.com';

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
      estadisticas: 'Estadísticas'
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
            <div class="sidebar-nav-item" data-view="catalogo-pdf" id="nav-catalogo">
              <span class="nav-icon">📋</span>
              <span>Catálogo PDF</span>
            </div>
          </nav>

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
          <h3 class="card-header-title">Histórico de Pedidos</h3>
          <span class="badge badge-primary">${pedidos.length}</span>
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
            <button class="btn btn-ghost" id="modal-cliente-cancel">Cancelar</button>
            <button class="btn btn-primary" id="modal-cliente-save">Guardar</button>
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
    const subtotal = pedidoLineas.reduce((sum, l) => sum + (l.totalLinea || 0), 0);
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
    navigateTo('nuevoPedido');
  }

  /**
   * Guarda los cambios de un pedido existente
   */
  async function updatePedido() {
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

  async function enviarPedidoPorEmail(pedidoId, tipo = 'cliente') {
    const pedido = await PedidoService.getById(pedidoId);
    if (!pedido) return;
    const cliente = await ClienteService.getById(pedido.clienteId);

    const isCentral = tipo === 'central';
    const recipient = isCentral ? CENTRAL_EMAIL : (cliente?.email || '');
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

    document.getElementById('btn-email-central')?.addEventListener('click', async () => {
      await enviarPedidoPorEmail(currentPedidoId, 'central');
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
    } else {
      navigateTo('login');
    }
  }

  return { init, navigateTo };
})();

// Arrancar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());
