/**
 * csvService.js - Servicio para parseo y búsqueda de referencias desde CSV
 * Responsabilidad única: leer, parsear y buscar productos del catálogo CSV
 */

const CsvService = (() => {
  let _productos = [];
  let _loaded = false;

  /**
   * Parsea una cadena CSV manejando campos entrecomillados
   * @param {string} csvText - Contenido del archivo CSV
   * @returns {Array<Object>} - Array de productos parseados
   */
  function parseCsv(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseRow(lines[i]);
      if (row.length >= 3) {
        const referencia = cleanField(row[0]);
        const descripcion = cleanField(row[1]);
        const talla = cleanField(row[2]);
        const unidadesPorCaja = parseInt(cleanField(row[3])) || 1;

        if (referencia && descripcion) {
          results.push({
            referencia,
            descripcion,
            talla,
            unidadesPorCaja,
            // Texto de búsqueda pre-computado para rendimiento
            searchText: `${referencia} ${descripcion} ${talla}`.toLowerCase()
          });
        }
      }
    }

    return results;
  }

  /**
   * Parsea una fila CSV respetando comillas
   */
  function parseRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else if (char !== '\r') {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Limpia un campo de comillas y espacios extra
   */
  function cleanField(field) {
    if (!field) return '';
    return field.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  }

  /**
   * Carga los productos desde el archivo CSV
   * @param {string} csvPath - Ruta al archivo CSV
   */
  async function cargarProductos(csvPath = 'catalogo.csv') {
    try {
      const response = await fetch(csvPath);
      if (!response.ok) {
        throw new Error(`Error cargando CSV: ${response.status}`);
      }
      const text = await response.text();
      _productos = parseCsv(text);
      _loaded = true;
      console.info(`[CsvService] ${_productos.length} productos cargados desde CSV`);
      return _productos;
    } catch (error) {
      console.error('[CsvService] Error al cargar productos:', error);
      _productos = [];
      _loaded = true;
      return [];
    }
  }

  /**
   * Busca productos por referencia o descripción (búsqueda difusa)
   * @param {string} query - Texto a buscar
   * @param {number} maxResults - Máximo de resultados a devolver
   * @returns {Array<Object>} - Productos que coinciden
   */
  function buscarProductos(query, maxResults = 20) {
    if (!query || query.trim().length === 0) return [];

    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    const results = _productos.filter(producto =>
      searchTerms.every(term => producto.searchText.includes(term))
    );

    return results.slice(0, maxResults);
  }

  /**
   * Obtiene todos los productos cargados
   * @returns {Array<Object>}
   */
  function obtenerTodos() {
    return [..._productos];
  }

  /**
   * Verifica si los datos ya se cargaron
   * @returns {boolean}
   */
  function isLoaded() {
    return _loaded;
  }

  /**
   * Obtiene la cantidad total de productos
   * @returns {number}
   */
  function totalProductos() {
    return _productos.length;
  }

  return {
    cargarProductos,
    buscarProductos,
    obtenerTodos,
    isLoaded,
    totalProductos
  };
})();
