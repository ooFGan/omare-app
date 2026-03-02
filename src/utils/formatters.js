/**
 * formatters.js - Utilidades de formateo
 * Responsabilidad única: formatear moneda, fechas y números
 */

const Formatters = (() => {
    /**
     * Formatea un número como moneda EUR
     * @param {number} amount
     * @returns {string}
     */
    function currency(amount) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    /**
     * Formatea una fecha ISO a formato legible
     * @param {string} isoDate
     * @returns {string}
     */
    function date(isoDate) {
        if (!isoDate) return '-';
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(isoDate));
    }

    /**
     * Formatea fecha con hora
     * @param {string} isoDate
     * @returns {string}
     */
    function dateTime(isoDate) {
        if (!isoDate) return '-';
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(isoDate));
    }

    /**
     * Formatea un número con separadores de miles
     * @param {number} num
     * @returns {string}
     */
    function number(num) {
        return new Intl.NumberFormat('es-ES').format(num || 0);
    }

    /**
     * Escapa HTML para prevenir XSS
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return {
        currency,
        date,
        dateTime,
        number,
        escapeHtml
    };
})();
