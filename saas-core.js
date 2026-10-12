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
        // ⚠️ CRÍTICO: Excluimos GitHub Pages, Vercel, Netlify y otros hostings
        // que usan paths en vez de subdominios reales
        if (!tenantSlug) {
            const esHostingConPath = hostname.includes('github.io') || 
                                     hostname.includes('vercel.app') || 
                                     hostname.includes('netlify.app') ||
                                     hostname.includes('pages.dev') ||
                                     hostname === 'localhost' || 
                                     hostname === '127.0.0.1';
            
            if (!esHostingConPath) {
                const parts = hostname.split('.');
                if (parts.length > 2) {
                    tenantSlug = parts[0];
                }
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

        if (error) {
            console.error("❌ Error en consulta:", error);
            throw new Error(`Error de conexión: ${error.message}`);
        }

        if (!tenantConfig) {
            console.warn("⚠️ Tenant no encontrado:", tenantSlug);
            throw new Error(`La institución "${tenantSlug}" no está registrada o se encuentra inactiva.`);
        }

        // Guardar estado global
        window.currentTenantId = tenantConfig.id;
        window.tenantConfigGlobal = tenantConfig;
        window.tenantSlugActivo = tenantSlug;
        sessionStorage.setItem('saas_tenant_slug', tenantSlug);

        // ✅ EXPONER FALLBACK para que los HTML puedan usar logo/hero aunque
        // renmcycf_config no exista todavía (tenant recién creado)
        window._saasTenantFallback = {
            logo_url: tenantConfig.logo_url || null,
            hero_image_url: tenantConfig.hero_image_url || null
        };

        console.log("✅ Tenant cargado:", tenantConfig.nombre_institucion);

        // 3. INYECCIÓN DE BRANDING (Paleta de colores universal)
        document.documentElement.style.setProperty('--wl-primary', hexToRgbString(tenantConfig.color_primario || '#0f172a'));
        document.documentElement.style.setProperty('--wl-secondary', hexToRgbString(tenantConfig.color_secundario || '#d4af37'));
        document.documentElement.style.setProperty('--wl-tertiary', hexToRgbString(tenantConfig.color_terciario || '#1e3a8a'));
        document.documentElement.style.setProperty('--wl-background', hexToRgbString(tenantConfig.color_background || '#f1f5f9'));

        // 4. INYECCIÓN DE TEXTOS GLOBALES
        const institucionNombres = document.querySelectorAll(
            '.wl-institucion-nombre, .wl-institucion-nombre-corto, #wl-institucion-nombre-top, #wl-institucion-nombre-footer, #wl-title-institucion, #sidebar-institucion-nombre, #login-institucion-nombre, #doc-instituto, #modal-institucion-nombre'
        );
        institucionNombres.forEach(el => {
            if (el) {
                const texto = tenantConfig.nombre_institucion || 'Registro';
                // Si es un elemento "corto", truncamos el nombre si es muy largo
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
            // Solo modificamos enlaces internos (que no vayan a http, mailto, tel, #)
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto') && !href.startsWith('tel')) {
                try {
                    const url = new URL(link.href);
                    // Solo agregar tenant si no lo tiene ya
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

// Función global para redirecciones por JS (window.location)
window.navegarSaaS = function(paginaDestino) {
    window.location.href = `${paginaDestino}?tenant=${window.tenantSlugActivo}`;
};
