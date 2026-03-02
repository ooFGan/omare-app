/**
 * authService.js - Servicio de autenticación con Supabase
 * Responsabilidad única: gestionar login, logout y estado de sesión
 */

const AuthService = (() => {
    const supabase = window.supabaseClient;
    let currentUser = null;

    /**
     * Inicializa el estado de autenticación recuperando la sesión actual
     */
    async function init() {
        try {
            const { data } = await supabase.auth.getSession();
            currentUser = data.session?.user || null;

            supabase.auth.onAuthStateChange((event, session) => {
                currentUser = session?.user || null;
            });
        } catch (error) {
            console.error('Error inicializando auth:', error);
        }
    }

    /**
     * Intenta hacer login con credenciales
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ success: boolean, error?: string, user?: Object }>}
     */
    async function login(email, password) {
        if (!email || !password) {
            return { success: false, error: 'Introduzca email y contraseña' };
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return { success: false, error: 'Credenciales incorrectas' };
            }

            currentUser = data.user;
            return { success: true, user: getCurrentUser() };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Intenta registrar un nuevo usuario
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ success: boolean, error?: string, user?: Object, requiresEmailConfirmation?: boolean }>}
     */
    async function register(email, password) {
        if (!email || !password) {
            return { success: false, error: 'Introduzca email y contraseña' };
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                return { success: false, error: 'Error al registrar: ' + error.message };
            }

            // Supabase por defecto requiere confirmación de email.
            // Si data.session es null, significa que la cuenta se creó pero requiere confirmar el email antes de hacer login.
            if (!data.session) {
                // No hay sesión activa, el usuario debe verificar su correo o el administrador debe desactivar la confirmación de email.
                return {
                    success: true,
                    user: null,
                    requiresEmailConfirmation: true
                };
            }

            currentUser = data.session.user;
            return { success: true, user: getCurrentUser(), requiresEmailConfirmation: false };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Cierra la sesión actual
     */
    async function logout() {
        await supabase.auth.signOut();
        currentUser = null;
    }

    /**
     * Obtiene la sesión actual si existe
     * @returns {Object|null}
     */
    function getCurrentUser() {
        if (!currentUser) return null;

        return {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.user_metadata?.name || currentUser.email.split('@')[0],
            role: currentUser.user_metadata?.role || 'Comercial'
        };
    }

    /**
     * Verifica si hay sesión activa
     * @returns {boolean}
     */
    function isAuthenticated() {
        return currentUser !== null;
    }

    return {
        init,
        login,
        register,
        logout,
        getCurrentUser,
        isAuthenticated
    };
})();
