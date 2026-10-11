// ==============================================================================
// ASARI SAAS CORE - BOOTSTRAPPER MULTI-TENANT UNIVERSAL
// ==============================================================================

// 1. CREDENCIALES GLOBALES (Centralizadas)
const PROJECT_URL = 'https://udvpgthitdxtkicenits.supabase.co';
const PUBLIC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnBndGhpdGR4dGtpY2VuaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5OTYxMzAsImV4cCI6MjEwNDU3MjEzMH0.M6sokWDtgis7wPydD-y9OoMYWQSy1DQaQ08LmNQnbtc';

// Exportamos a window para que los HTML puedan usar la DB sin re-declararla
window.db = supabase.createClient(PROJECT_URL, PUBLIC_KEY);
window.currentTenantId = null;
window.tenantConfigGlobal = null;
window.tenantSlugActivo = 'renmcycf';

// Helper para Tailwind (Convierte HEX a RGB para que funcionen las opacidades bg-wlPrimary/50)
const hexToRgbString = (hex) => {
    if (!hex) return '15 23 42';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return `${parseInt(hex.substring(0,2), 16)} ${parseInt(hex.substring(2,4), 16)} ${parseInt(hex.substring(4,6), 16)}`;
};

// 2. FUNCIÓN UNIVERSAL DE INICIALIZACIÓN
window.initTenant = async function() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const hostname = window.location.hostname;
        
        // A. Buscar en la URL explícitamente (?tenant=remaep)
        let tenantSlug = urlParams.get('tenant');

        // B. Buscar en el subdominio (si tenés dominio propio a futuro)
        if (!tenantSlug) {
            const parts = hostname.split('.');
            if (parts.length > 2 && !hostname.includes('github.io') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
                tenantSlug = parts[0];
            }
        }

        // C. Buscar en la sesión (Magia B2B: Mantiene el tenant vivo aunque cambies de página sin ?tenant=)
        if (!tenantSlug) {
            tenantSlug = sessionStorage.getItem('saas_tenant_slug');
        }

        // D. Fallback absoluto
        if (!tenantSlug) {
            tenantSlug = 'renmcycf';
        }

        console.log("🚀 SaaS Core -> Cargando entorno para:", tenantSlug);

        // Consultar a Supabase
        const { data: tenantConfig, error } = await window.db
            .from('saas_tenants')
            .select('*')
            .eq('slug', tenantSlug)
            .eq('activo', true)
            .maybeSingle();

        if (error || !tenantConfig) throw new Error("Institución no encontrada.");

        // Guardar estado global
        window.currentTenantId = tenantConfig.id;
        window.tenantConfigGlobal = tenantConfig;
        window.tenantSlugActivo = tenantSlug;
        sessionStorage.setItem('saas_tenant_slug', tenantSlug);

        // 3. INYECCIÓN DE BRANDING (Paleta de colores universal)
        document.documentElement.style.setProperty('--wl-primary', hexToRgbString(tenantConfig.color_primario || '#0f172a'));
        document.documentElement.style.setProperty('--wl-secondary', hexToRgbString(tenantConfig.color_secundario || '#d4af37'));
        document.documentElement.style.setProperty('--wl-tertiary', hexToRgbString(tenantConfig.color_terciario || '#1e3a8a'));
        document.documentElement.style.setProperty('--wl-background', hexToRgbString(tenantConfig.color_background || '#f1f5f9'));

        // 4. INYECCIÓN DE TEXTOS GLOBALES
        const institucionNombres = document.querySelectorAll(
            '.wl-institucion-nombre, .wl-institucion-nombre-corto, #wl-institucion-nombre-top, #wl-institucion-nombre-footer, #wl-title-institucion, #sidebar-institucion-nombre, #login-institucion-nombre, #doc-instituto'
        );
        institucionNombres.forEach(el => {
            if (el) el.innerText = tenantConfig.nombre_institucion;
        });

        // Título de la pestaña
        if (document.title.includes('·')) {
            const prefijo = document.title.split('·')[0];
            document.title = `${prefijo} · ${tenantConfig.nombre_institucion}`;
        } else {
            document.title = tenantConfig.nombre_institucion;
        }

        // 5. AUTO-PROPAGACIÓN EN ENLACES (Magia SEO/UX)
        // Agarra todos los links internos (<a>) y les inyecta el ?tenant= dinámicamente.
        document.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            // Solo modificamos enlaces internos (que no vayan a http, mailto, tel o #)
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto') && !href.startsWith('tel')) {
                const url = new URL(link.href);
                url.searchParams.set('tenant', window.tenantSlugActivo);
                link.href = url.toString();
            }
        });

        // Liberar el loader
        document.body.classList.add('ready');
        return tenantConfig;

    } catch (err) {
        console.error("Error Bootstrapper SaaS:", err);
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="font-size: 2rem; margin-bottom: 10px; color: #ef4444;">Error 404</h1>
                    <p>La institución a la que intentas acceder no está registrada o se encuentra inactiva.</p>
                </div>
            </div>`;
    }
};

// Función global para redirecciones por JS (window.location)
window.navegarSaaS = function(paginaDestino) {
    window.location.href = `${paginaDestino}?tenant=${window.tenantSlugActivo}`;
};
