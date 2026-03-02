/**
 * excelExporter.js - Utilidad para exportar datos a Excel usando SheetJS
 * Responsabilidad única: convertir arrays de datos a archivos .xlsx descargables
 */

const ExcelExporter = (() => {

    /**
     * Exporta pedidos a Excel
     * @param {Array<Object>} pedidos - Array de pedidos mapeados a camelCase
     * @param {string} filename - Nombre del archivo sin extensión
     * @param {Object|null} cliente - Si se filtra por cliente, incluir su nombre en la cabecera
     */
    function exportarPedidos(pedidos, filename = 'pedidos', cliente = null) {
        if (!window.XLSX) {
            console.error('SheetJS no cargado');
            return;
        }

        const filas = pedidos.map(p => ({
            'Nº Pedido': p.numeroPedido,
            'Fecha': new Date(p.fecha).toLocaleDateString('es-ES'),
            'Cliente': p.clienteNombre || cliente?.nombre || '',
            'Estado': p.estado || 'pendiente',
            'Subtotal (€)': parseFloat(p.subtotal).toFixed(2),
            'Descuento (%)': parseFloat(p.descuento || 0).toFixed(2),
            'IVA (€)': parseFloat(p.iva).toFixed(2),
            'Total (€)': parseFloat(p.total).toFixed(2),
            'Total Cajas': p.totalCajas || 0,
            'Notas': p.notas || ''
        }));

        const ws = XLSX.utils.json_to_sheet(filas);

        // Ajustar anchos de columna
        ws['!cols'] = [
            { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 12 },
            { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
            { wch: 12 }, { wch: 40 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pedidos');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    /**
     * Exporta las líneas de un pedido específico a Excel
     * @param {Object} pedido - Pedido con sus líneas
     * @param {string} clienteNombre
     */
    function exportarLineasPedido(pedido, clienteNombre = '') {
        if (!window.XLSX) return;

        const filas = (pedido.lineas || []).map(l => ({
            'Referencia': l.codigoReferencia,
            'Descripción': l.descripcion,
            'Talla': l.talla,
            'Uds/Caja': l.unidadesPorCaja,
            'Cajas': l.cajas,
            'Total Uds': l.cantidad,
            'Precio Ud (€)': parseFloat(l.precioUnitario).toFixed(2),
            'Subtotal (€)': parseFloat(l.totalLinea).toFixed(2)
        }));

        // Añadir fila de totales
        filas.push({});
        filas.push({
            'Referencia': 'RESUMEN',
            'Cajas': pedido.totalCajas,
            'Subtotal (€)': parseFloat(pedido.subtotal).toFixed(2),
            'Precio Ud (€)': `IVA: ${parseFloat(pedido.iva).toFixed(2)} €`,
            'Total Uds': pedido.descuento > 0 ? `Dto: ${pedido.descuento}%` : '',
            'Total Uds ': `TOTAL: ${parseFloat(pedido.total).toFixed(2)} €`
        });

        const ws = XLSX.utils.json_to_sheet(filas);
        ws['!cols'] = [
            { wch: 16 }, { wch: 35 }, { wch: 8 }, { wch: 8 },
            { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, pedido.numeroPedido);

        const safeNombre = (clienteNombre || 'cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        XLSX.writeFile(wb, `${pedido.numeroPedido}_${safeNombre}.xlsx`);
    }

    return { exportarPedidos, exportarLineasPedido };
})();
