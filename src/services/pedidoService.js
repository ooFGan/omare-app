/**
 * pedidoService.js - CRUD de pedidos con Supabase
 * Responsabilidad única: crear, leer, actualizar, listar pedidos y sus líneas
 */

const PedidoService = (() => {
    const supabase = window.supabaseClient;
    const IVA_RATE = 0.21;

    /**
     * Mapea un pedido de base de datos (snake_case) a formato UI (camelCase)
     */
    function mapPedidoToCamelCase(dbPedido) {
        if (!dbPedido) return null;
        return {
            id: dbPedido.id,
            clienteId: dbPedido.cliente_id,
            numeroPedido: dbPedido.numero_pedido,
            fecha: dbPedido.created_at, // O usar fb.fecha si existiera
            subtotal: parseFloat(dbPedido.subtotal),
            iva: parseFloat(dbPedido.iva),
            total: parseFloat(dbPedido.total),
            totalCajas: parseInt(dbPedido.total_cajas),
            estado: 'guardado',
            lineas: (dbPedido.pedido_lineas || []).map(l => ({
                id: l.id,
                pedidoId: l.pedido_id,
                codigoReferencia: l.codigo_referencia,
                descripcion: l.descripcion,
                talla: l.talla,
                unidadesPorCaja: parseInt(l.unidades_por_caja),
                cajas: parseInt(l.cajas),
                cantidad: parseInt(l.cantidad),
                precioUnitario: parseFloat(l.precio_unitario),
                totalLinea: parseFloat(l.total_linea)
            }))
        };
    }

    /**
     * Lee todos los pedidos
     * @returns {Promise<Array<Object>>}
     */
    async function getAll() {
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    pedido_lineas(*)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(mapPedidoToCamelCase);
        } catch (error) {
            console.error('Error obteniendo pedidos:', error);
            return [];
        }
    }

    /**
     * Crea un nuevo pedido para un cliente
     * @param {string} clienteId
     * @param {Array<Object>} lineas - Líneas del pedido (en camelCase)
     * @returns {Promise<{ success: boolean, pedido?: Object, error?: string }>}
     */
    async function crear(clienteId, lineas = []) {
        if (!clienteId) {
            return { success: false, error: 'Se requiere un cliente' };
        }

        try {
            const numeroPedido = await generarNumeroPedido();

            const calculatedLineas = lineas.map(linea => ({
                codigo_referencia: linea.codigoReferencia || '',
                descripcion: linea.descripcion || '',
                talla: linea.talla || '',
                unidades_por_caja: parseInt(linea.unidadesPorCaja || 1),
                cajas: parseInt(linea.cajas || 0),
                cantidad: parseInt(linea.cantidad || 0),
                precio_unitario: parseFloat(linea.precioUnitario || 0),
                total_linea: (parseInt(linea.cantidad || 0)) * parseFloat(linea.precioUnitario || 0)
            }));

            const subtotal = calcularSubtotal(calculatedLineas);
            const iva = calcularIva(subtotal);
            const totalCajas = calcularTotalCajas(calculatedLineas);

            const user = AuthService.getCurrentUser();
            if (!user) throw new Error('Usuario no autenticado');

            const pedidoParams = {
                cliente_id: clienteId,
                numero_pedido: numeroPedido,
                subtotal: subtotal,
                iva: iva,
                total: subtotal + iva,
                total_cajas: totalCajas,
                user_id: user.id
            };

            const { data: pedidoData, error: pedidoError } = await supabase
                .from('pedidos')
                .insert([pedidoParams])
                .select()
                .single();

            if (pedidoError) throw pedidoError;

            if (calculatedLineas.length > 0) {
                const lineasToInsert = calculatedLineas.map(l => ({
                    ...l,
                    pedido_id: pedidoData.id
                }));

                const { error: lineasError } = await supabase
                    .from('pedido_lineas')
                    .insert(lineasToInsert);

                if (lineasError) throw lineasError;
            }

            return { success: true, pedido: await getById(pedidoData.id) };
        } catch (error) {
            console.error('Error creando pedido:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Actualiza un pedido existente con nuevas líneas
     * Opcional implementar con supabase (requiere transaction o delete/insert)
     * Por requerimientos OMARE, al repetir se crea uno nuevo, 
     * no suele editarse el guardado a no ser que sea "borrador" local.
     */
    async function actualizarLineas(pedidoId, lineas) {
        try {
            // Delete current lines
            const { error: deleteError } = await supabase
                .from('pedido_lineas')
                .delete()
                .eq('pedido_id', pedidoId);

            if (deleteError) throw deleteError;

            // Recalculate
            const calculatedLineas = lineas.map(linea => ({
                pedido_id: pedidoId,
                codigo_referencia: linea.codigoReferencia || '',
                descripcion: linea.descripcion || '',
                talla: linea.talla || '',
                unidades_por_caja: parseInt(linea.unidadesPorCaja || 1),
                cajas: parseInt(linea.cajas || 0),
                cantidad: parseInt(linea.cantidad || 0),
                precio_unitario: parseFloat(linea.precioUnitario || 0),
                total_linea: (parseInt(linea.cantidad || 0)) * parseFloat(linea.precioUnitario || 0)
            }));

            const subtotal = calcularSubtotal(calculatedLineas);
            const iva = calcularIva(subtotal);
            const totalCajas = calcularTotalCajas(calculatedLineas);

            // Re-insert new lines
            if (calculatedLineas.length > 0) {
                const { error: insertError } = await supabase
                    .from('pedido_lineas')
                    .insert(calculatedLineas);

                if (insertError) throw insertError;
            }

            // Update totals parent
            const { error: updateError } = await supabase
                .from('pedidos')
                .update({ subtotal, iva, total: subtotal + iva, total_cajas: totalCajas })
                .eq('id', pedidoId);

            if (updateError) throw updateError;

            return { success: true, pedido: await getById(pedidoId) };
        } catch (error) {
            console.error('Error editando pedido:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene los pedidos de un cliente
     * @param {string} clienteId
     * @returns {Promise<Array<Object>>}
     */
    async function getByClienteId(clienteId) {
        if (!clienteId) return [];
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    pedido_lineas(*)
                `)
                .eq('cliente_id', clienteId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return (data || []).map(mapPedidoToCamelCase);
        } catch (error) {
            console.error('Error obteniendo pedidos de cliente:', error);
            return [];
        }
    }

    /**
     * Obtiene un pedido por ID
     * @param {string} pedidoId
     * @returns {Promise<Object|null>}
     */
    async function getById(pedidoId) {
        if (!pedidoId) return null;
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select(`
                    *,
                    pedido_lineas(*)
                `)
                .eq('id', pedidoId)
                .single();

            if (error) throw error;
            return mapPedidoToCamelCase(data);
        } catch (error) {
            console.error('Error obteniendo pedido:', error);
            return null;
        }
    }

    /**
     * Repite un pedido existente (crea uno nuevo con las mismas líneas)
     * @param {string} pedidoId
     * @returns {Promise<{ success: boolean, pedido?: Object, error?: string }>}
     */
    async function repetir(pedidoId) {
        const pedidoOriginal = await getById(pedidoId);
        if (!pedidoOriginal) {
            return { success: false, error: 'Pedido original no encontrado' };
        }

        return await crear(pedidoOriginal.clienteId, pedidoOriginal.lineas);
    }

    /**
     * Elimina un pedido por ID
     * @param {string} pedidoId
     * @returns {Promise<{ success: boolean }>}
     */
    async function eliminar(pedidoId) {
        try {
            const { error } = await supabase
                .from('pedidos')
                .delete()
                .eq('id', pedidoId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error eliminando pedido:', error);
            return { success: false, error: error.message };
        }
    }

    /* ---- Cálculos Internos ---- */

    function calcularSubtotal(lineas) {
        return lineas.reduce((sum, l) => sum + (l.total_linea || 0), 0);
    }

    function calcularIva(subtotal) {
        return subtotal * IVA_RATE;
    }

    function calcularTotalCajas(lineas) {
        return lineas.reduce((sum, l) => sum + (l.cajas || 0), 0);
    }

    async function generarNumeroPedido() {
        const year = new Date().getFullYear();
        const { count, error } = await supabase
            .from('pedidos')
            .select('*', { count: 'exact', head: true });

        const nextOrderIndex = error ? 1 : count + 1;
        return `PED-${year}-${String(nextOrderIndex).padStart(4, '0')}`;
    }

    return {
        getAll,
        crear,
        actualizarLineas,
        getByClienteId,
        getById,
        repetir,
        eliminar,
        IVA_RATE
    };
})();
