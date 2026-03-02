/**
 * pdfGenerator.js - Generador robusto de PDF de pedidos
 * Requiere: jsPDF + jspdf-autotable (se cargan automáticamente si no existen)
 */

const PdfGenerator = (() => {

    /* ==============================
       Helpers internos seguros
    ============================== */

    function safeDate(dateValue) {
        try {
            const d = new Date(dateValue);
            return isNaN(d) ? '-' :
                d.toLocaleDateString('es-ES');
        } catch {
            return '-';
        }
    }

    function safeCurrency(value) {
        const number = Number(value) || 0;
        return number.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR'
        });
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
            document.head.appendChild(script);
        });
    }

    async function ensureLibraries() {

        // Si ya existen, salir
        if (window.jspdf?.jsPDF && window.jspdf.jsPDF.API.autoTable) {
            return window.jspdf.jsPDF;
        }

        // Cargar jsPDF
        if (!window.jspdf?.jsPDF) {
            await loadScript('https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js');
        }

        // Cargar autoTable
        if (!window.jspdf?.jsPDF?.API?.autoTable) {
            await loadScript('https://unpkg.com/jspdf-autotable@3.8.3/dist/jspdf.plugin.autotable.min.js');
        }

        if (!window.jspdf?.jsPDF) {
            throw new Error('jsPDF no está disponible');
        }

        return window.jspdf.jsPDF;
    }

    /* ==============================
       Función principal
    ============================== */

    async function generarPedidoPdf(pedido = {}, cliente = {}) {

        try {

            const JsPDF = await ensureLibraries();
            const doc = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

            if (typeof doc.autoTable !== 'function') {
                throw new Error('jspdf-autotable no se cargó correctamente');
            }

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            let y = margin;

            /* ==============================
               HEADER
            ============================== */

            doc.setFillColor(228, 0, 58);
            doc.rect(0, 0, pageWidth, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text('OMARE', margin, 18);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Proforma de Pedido', margin, 27);

            doc.setFontSize(11);
            doc.text(`Nº ${pedido.numeroPedido || 'S/N'}`, pageWidth - margin, 18, { align: 'right' });

            doc.setFontSize(9);
            doc.text(`Fecha: ${safeDate(pedido.fecha)}`, pageWidth - margin, 27, { align: 'right' });

            y = 45;

            /* ==============================
               CLIENTE
            ============================== */

            doc.setTextColor(20, 20, 20);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Datos del Cliente', margin, y);
            y += 7;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');

            const clienteInfo = [
                `Nombre: ${cliente.nombre || '-'}`,
                `Dirección: ${cliente.direccion || '-'}`,
                `Teléfono: ${cliente.telefono || '-'}`
            ];

            clienteInfo.forEach(line => {
                doc.text(line, margin, y);
                y += 5;
            });

            y += 5;

            /* ==============================
               TABLA PRODUCTOS
            ============================== */

            const headers = [[
                'Ref.',
                'Descripción',
                'Talla',
                'Uds/Cj',
                'Cajas',
                'Total Uds',
                'Precio Ud',
                'Subtotal'
            ]];

            const rows = Array.isArray(pedido.lineas) && pedido.lineas.length
                ? pedido.lineas.map(l => [
                    l.codigoReferencia || '',
                    l.descripcion || '',
                    l.talla || '',
                    l.unidadesPorCaja || 0,
                    l.cajas || 0,
                    l.cantidad || 0,
                    safeCurrency(l.precioUnitario),
                    safeCurrency(l.totalLinea)
                ])
                : [['', 'Sin productos', '', '', '', '', '', '']];

            doc.autoTable({
                head: headers,
                body: rows,
                startY: y,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                },
                headStyles: {
                    fillColor: [228, 0, 58],
                    textColor: 255
                },
                columnStyles: {
                    0: { cellWidth: 15 }, // Ref
                    1: { cellWidth: 'auto' }, // Descripción (flexible)
                    2: { cellWidth: 12 }, // Talla
                    3: { cellWidth: 12, halign: 'center' }, // Uds/Cj
                    4: { cellWidth: 12, halign: 'center' }, // Cajas
                    5: { cellWidth: 12, halign: 'center' }, // Total Uds
                    6: { cellWidth: 20, halign: 'right' }, // Precio Ud
                    7: { cellWidth: 20, halign: 'right' }, // Subtotal
                },
                margin: { left: margin, right: margin }
            });

            y = doc.lastAutoTable.finalY + 10;

            /* ==============================
               RESUMEN
            ============================== */

            const summaryX = pageWidth - margin - 70;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            // Mostrar descuento si existe
            if (pedido.descuento > 0) {
                const subtotalBruto = pedido.subtotal / (1 - pedido.descuento / 100);
                const importeDto = subtotalBruto - pedido.subtotal;

                doc.text('Subtotal:', summaryX, y);
                doc.text(safeCurrency(subtotalBruto), pageWidth - margin, y, { align: 'right' });
                y += 6;

                doc.setTextColor(200, 0, 0);
                doc.text(`Descuento (${pedido.descuento}%):`, summaryX, y);
                doc.text(`-${safeCurrency(importeDto)}`, pageWidth - margin, y, { align: 'right' });
                doc.setTextColor(20, 20, 20);
                y += 6;
            }

            doc.text('Base Imponible:', summaryX, y);
            doc.text(safeCurrency(pedido.subtotal), pageWidth - margin, y, { align: 'right' });
            y += 6;

            doc.text('IVA (21%):', summaryX, y);
            doc.text(safeCurrency(pedido.iva), pageWidth - margin, y, { align: 'right' });
            y += 6;

            doc.text('Total Cajas:', summaryX, y);
            doc.text(String(pedido.totalCajas || 0), pageWidth - margin, y, { align: 'right' });
            y += 10;

            doc.setFillColor(228, 0, 58);
            doc.roundedRect(summaryX - 2, y - 6, 72, 12, 2, 2, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);

            doc.text('TOTAL:', summaryX + 2, y + 2);
            doc.text(safeCurrency(pedido.total), pageWidth - margin - 2, y + 2, { align: 'right' });

            /* ==============================
               FOOTER
            ============================== */

            doc.setTextColor(150);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(
                'Documento generado por OMARE - Sistema de Proformas',
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );

            /* ==============================
               GUARDAR
            ============================== */

            const filename = `Proforma_${pedido.numeroPedido || 'borrador'}_${safeDate(pedido.fecha)}`
                .replace(/[\/\\\s]/g, '_') + '.pdf';

            console.info(`[PdfGenerator] Iniciando descarga: ${filename}`);

            try {
                // Intento estándar
                doc.save(filename);
                console.info('[PdfGenerator] PDF guardado vía doc.save()');
            } catch (saveError) {
                console.warn('[PdfGenerator] doc.save() falló, intentando fallback manual:', saveError);
                // Fallback robusto (blob + link)
                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 100);
                console.info('[PdfGenerator] PDF guardado vía fallback manual');
            }

        } catch (error) {
            console.error('[PdfGenerator] Error crítico generando PDF:', error);
            alert('Error al generar el PDF. Revisa la consola para más detalles.');
        }
    }

    return {
        generarPedidoPdf
    };

})();