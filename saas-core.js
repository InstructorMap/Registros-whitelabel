// ==============================================================================
// ASARI SAAS CORE - BOOTSTRAPPER MULTI-TENANT UNIVERSAL
// ==============================================================================

// 1. CREDENCIALES GLOBALES (Centralizadas)
const PROJECT_URL = 'https://udvpgthitdxtkicenits.supabase.co';
const PUBLIC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnBndGhpdGR4dGtpY2VuaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5OTYxMzAsImV4cCI6MjEwNDU3MjEzMH0.M6sokWDtgis7wPydD-y9OoMYWQSy1DQaQ08LmNQnbtc';

// ==============================================================================
// 1.1 INICIALIZACIÓN GLOBAL DE SUPABASE (Blindada)
// ==============================================================================
// Verifica que el SDK de Supabase esté cargado vía CDN antes de instanciar.
// Si window.db ya existe (por ejemplo, otro script lo inicializó), lo respeta.
if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.error(
        "❌ [ASARI CORE] Supabase SDK no detectado. " +
        "Asegurate de incluir en el HTML, ANTES de este script:\n" +
        '  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
    // No lanzamos throw para no romper la carga del resto de la página.
    // Cualquier intento posterior de window.db.from(...) fallará explícitamente.
} else if (!window.db) {
    try {
        window.db = window.supabase.createClient(PROJECT_URL, PUBLIC_KEY);
        console.log("✅ [ASARI CORE] Cliente Supabase inicializado globalmente.");
    } catch (initErr) {
        console.error("❌ [ASARI CORE] Error al inicializar Supabase:", initErr);
    }
} else {
    console.log("ℹ️ [ASARI CORE] window.db ya estaba definido. Se reutiliza la instancia existente.");
}

// Estado global del tenant (se completa en initTenant)
window.currentTenantId   = null;
window.tenantConfigGlobal = null;
window.tenantSlugActivo  = 'renmcycf';

// Helper para Tailwind (Convierte HEX a RGB para que funcionen las opacidades bg-wlPrimary/50)
const hexToRgbString = (hex) => {
    if (!hex) return '15 23 42';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return `${parseInt(hex.substring(0,2), 16)} ${parseInt(hex.substring(2,4), 16)} ${parseInt(hex.substring(4,6), 16)}`;
};

// Helper para limpiar hostname (quita www.)
const limpiarHostname = (host) => (host || '').replace(/^www\./i, '').toLowerCase().trim();

// ==============================================================================
// 2. FUNCIÓN UNIVERSAL DE INICIALIZACIÓN DEL TENANT
// ==============================================================================
window.initTenant = async function() {
    try {
        // Guard clause: si window.db no está disponible, no seguimos
        if (!window.db) {
            throw new Error(
                'El cliente de Supabase no está inicializado. ' +
                'Verificá que el script CDN de @supabase/supabase-js esté cargado antes de saas-core.js.'
            );
        }

        const urlParams  = new URLSearchParams(window.location.search);
        const hostnameRaw = window.location.hostname;
        const hostname    = limpiarHostname(hostnameRaw);

        // Lista de hostings que usan paths en vez de subdominios reales
        const esHostingConPath =
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.includes('github.io') ||
            hostname.includes('vercel.app') ||
            hostname.includes('netlify.app') ||
            hostname.includes('pages.dev');

        let tenantConfig = null;
        let tenantSlug   = null;

        // ─────────────────────────────────────────────────────────────
        // PRIORIDAD 1: Force Mode (?tenant=slug en la URL)
        // ─────────────────────────────────────────────────────────────
        const slugParam = urlParams.get('tenant');
        if (slugParam && slugParam.trim() !== '') {
            tenantSlug = slugParam.trim().toLowerCase();
            console.log("🎯 [P1] Force Mode por query string:", tenantSlug);

            const { data, error } = await window.db
                .from('saas_tenants')
                .select('*')
                .eq('slug', tenantSlug)
                .eq('activo', true)
                .maybeSingle();

            if (error) {
                console.error("❌ Error en consulta por slug:", error);
                throw new Error(`Error de conexión: ${error.message}`);
            }
            tenantConfig = data;
        }

        // ─────────────────────────────────────────────────────────────
        // PRIORIDAD 2: Custom Domain (dominio_personalizado)
        // ─────────────────────────────────────────────────────────────
        if (!tenantConfig && !esHostingConPath && hostname) {
            console.log("🌐 [P2] Buscando tenant por dominio personalizado:", hostname);

            const { data, error } = await window.db
                .from('saas_tenants')
                .select('*')
                .eq('dominio_personalizado', hostname)
                .eq('activo', true)
                .maybeSingle();

            if (error) {
                console.error("❌ Error en consulta por dominio:", error);
                throw new Error(`Error de conexión: ${error.message}`);
            }

            if (data) {
                tenantConfig = data;
                tenantSlug   = data.slug;
                console.log("✅ Tenant encontrado por dominio:", tenantSlug);
            }
        }

        // ─────────────────────────────────────────────────────────────
        // PRIORIDAD 3: Caché (sessionStorage / localStorage)
        // ─────────────────────────────────────────────────────────────
        if (!tenantConfig) {
            const slugCache = sessionStorage.getItem('saas_tenant_slug')
                           || localStorage.getItem('saas_tenant_slug');
            if (slugCache) {
                tenantSlug = slugCache;
                console.log("💾 [P3] Usando slug desde caché:", tenantSlug);

                const { data, error } = await window.db
                    .from('saas_tenants')
                    .select('*')
                    .eq('slug', tenantSlug)
                    .eq('activo', true)
                    .maybeSingle();

                if (error) {
                    console.error("❌ Error en consulta por caché:", error);
                    throw new Error(`Error de conexión: ${error.message}`);
                }
                tenantConfig = data;
            }
        }

        // ─────────────────────────────────────────────────────────────
        // PRIORIDAD 4: Fallback absoluto
        // ─────────────────────────────────────────────────────────────
        if (!tenantConfig) {
            tenantSlug = 'renmcycf';
            console.log("🆘 [P4] Fallback absoluto a:", tenantSlug);

            const { data, error } = await window.db
                .from('saas_tenants')
                .select('*')
                .eq('slug', tenantSlug)
                .eq('activo', true)
                .maybeSingle();

            if (error) throw new Error(`Error de conexión: ${error.message}`);
            tenantConfig = data;
        }

        // ─────────────────────────────────────────────────────────────
        // VALIDACIÓN FINAL
        // ─────────────────────────────────────────────────────────────
        if (!tenantConfig) {
            console.warn("⚠️ Tenant no encontrado. Hostname:", hostname, "| Slug:", tenantSlug);
            throw new Error(`La institución "${tenantSlug || hostname}" no está registrada o se encuentra inactiva.`);
        }

        // Guardar estado global
        window.currentTenantId    = tenantConfig.id;
        window.tenantConfigGlobal = tenantConfig;
        window.tenantSlugActivo   = tenantConfig.slug;
        sessionStorage.setItem('saas_tenant_slug', tenantConfig.slug);
        localStorage.setItem('saas_tenant_slug', tenantConfig.slug);

        // Fallback para HTMLs (por si renmcycf_config aún no existe)
        window._saasTenantFallback = {
            logo_url: tenantConfig.logo_url || null,
            hero_image_url: tenantConfig.hero_image_url || null
        };

        console.log("✅ Tenant cargado:", tenantConfig.nombre_institucion, "| ID:", tenantConfig.id);

        // 3. INYECCIÓN DE BRANDING (Paleta de colores universal)
        document.documentElement.style.setProperty('--wl-primary',    hexToRgbString(tenantConfig.color_primario   || '#0f172a'));
        document.documentElement.style.setProperty('--wl-secondary',  hexToRgbString(tenantConfig.color_secundario || '#d4af37'));
        document.documentElement.style.setProperty('--wl-tertiary',   hexToRgbString(tenantConfig.color_terciario  || '#1e3a8a'));
        document.documentElement.style.setProperty('--wl-background', hexToRgbString(tenantConfig.color_background || '#f1f5f9'));

        // 4. INYECCIÓN DE TEXTOS GLOBALES
        const institucionNombres = document.querySelectorAll(
            '.wl-institucion-nombre, .wl-institucion-nombre-corto, #wl-institucion-nombre-top, ' +
            '#wl-institucion-nombre-footer, #wl-title-institucion, #sidebar-institucion-nombre, ' +
            '#login-institucion-nombre, #doc-instituto, #modal-institucion-nombre'
        );
        institucionNombres.forEach(el => {
            if (el) {
                const texto = tenantConfig.nombre_institucion || 'Registro';
                if (el.classList.contains('wl-institucion-nombre-corto') && texto.length > 20) {
                    el.innerText = texto.substring(0, 18) + '…';
                } else {
                    el.innerText = texto;
                }
            }
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
        // ⚠️ EXCEPCIÓN: No toca enlaces que ya tengan ?tenant= definido ni anchors.
        document.querySelectorAll('a').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto') && !href.startsWith('tel')) {
                try {
                    const url = new URL(link.href);
                    if (!url.searchParams.has('tenant')) {
                        url.searchParams.set('tenant', window.tenantSlugActivo);
                        link.href = url.toString();
                    }
                } catch(e) {
                    console.warn('No se pudo procesar link:', href, e.message);
                }
            }
        });

        // Liberar el loader (para HTMLs que usan body.ready)
        document.body.classList.add('ready');
        return tenantConfig;

    } catch (err) {
        console.error("❌ Error Bootstrapper SaaS:", err);
        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="font-size: 2rem; margin-bottom: 10px; color: #ef4444;">Error 404</h1>
                    <p>${err.message || 'La institución a la que intentas acceder no está registrada o se encuentra inactiva.'}</p>
                </div>
            </div>`;
        return null;
    }
};

// ==============================================================================
// 3. UTILIDADES GLOBALES DE NAVEGACIÓN
// ==============================================================================
// Función global para redirecciones por JS (window.location)
window.navegarSaaS = function(paginaDestino) {
    window.location.href = `${paginaDestino}?tenant=${window.tenantSlugActivo}`;
};
