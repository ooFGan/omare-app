/**
 * clienteService.js - CRUD de clientes con Supabase
 * Responsabilidad única: crear, leer, actualizar, listar y buscar clientes
 */

const ClienteService = (() => {
    const supabase = window.supabaseClient;
    /**
     * Lee todos los clientes de la base de datos
     * @returns {Promise<Array<Object>>}
     */
    async function getAll() {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('nombre');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo clientes:', error);
            return [];
        }
    }

    /**
     * Crea un nuevo cliente
     * @param {{ nombre: string, email?: string, direccion?: string, telefono?: string, observaciones?: string }} dataObj
     * @returns {Promise<{ success: boolean, error?: string, cliente?: Object }>}
     */
    async function crear(dataObj) {
        if (!dataObj.nombre || dataObj.nombre.trim().length === 0) {
            return { success: false, error: 'El nombre del cliente es obligatorio' };
        }

        const clienteParams = {
            nombre: dataObj.nombre.trim(),
            email: (dataObj.email || '').trim(),
            direccion: (dataObj.direccion || '').trim(),
            telefono: (dataObj.telefono || '').trim(),
            observaciones: (dataObj.observaciones || '').trim()
        };

        try {
            const { data, error } = await supabase
                .from('clientes')
                .insert([clienteParams])
                .select()
                .single();

            if (error) throw error;
            return { success: true, cliente: data };
        } catch (error) {
            console.error('Error creando cliente:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Actualiza un cliente existente
     * @param {string} id - ID del cliente
     * @param {Object} dataObj - Campos a actualizar
     * @returns {Promise<{ success: boolean, error?: string, cliente?: Object }>}
     */
    async function actualizar(id, dataObj) {
        if (!dataObj.nombre || dataObj.nombre.trim().length === 0) {
            return { success: false, error: 'El nombre del cliente es obligatorio' };
        }

        const clienteParams = {
            nombre: dataObj.nombre.trim(),
            email: (dataObj.email || '').trim(),
            direccion: (dataObj.direccion || '').trim(),
            telefono: (dataObj.telefono || '').trim(),
            observaciones: (dataObj.observaciones || '').trim()
        };

        try {
            const { data, error } = await supabase
                .from('clientes')
                .update(clienteParams)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, cliente: data };
        } catch (error) {
            console.error('Error actualizando cliente:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtiene un cliente por ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async function getById(id) {
        if (!id) return null;
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error obteniendo cliente:', error);
            return null;
        }
    }

    /**
     * Busca clientes por nombre
     * @param {string} query
     * @returns {Promise<Array<Object>>}
     */
    async function buscar(query) {
        if (!query || query.trim().length === 0) return await getAll();

        try {
            const searchTerm = `%${query.trim()}%`;
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .ilike('nombre', searchTerm)
                .order('nombre');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error buscando clientes:', error);
            return [];
        }
    }

    /**
     * Elimina un cliente por ID
     * @param {string} id
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async function eliminar(id) {
        try {
            const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error eliminando cliente:', error);
            return { success: false, error: error.message };
        }
    }

    return {
        getAll,
        crear,
        actualizar,
        getById,
        buscar,
        eliminar
    };
})();
