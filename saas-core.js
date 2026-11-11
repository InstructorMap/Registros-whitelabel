// ==============================================================================
// ASARI SAAS CORE - BOOTSTRAPPER MULTI-TENANT A PRUEBA DE BALAS
// ==============================================================================

(function () {
    'use strict';

    // ==========================================================================
    // 1. CREDENCIALES GLOBALES
    // ==========================================================================
    window.PROJECT_URL = 'https://udvpgthitdxtkicenits.supabase.co';
    window.PUBLIC_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnBndGhpdGR4dGtpY2VuaXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5OTYxMzAsImV4cCI6MjEwNDU3MjEzMH0.M6sokWDtgis7wPydD-y9OoMYWQSy1DQaQ08LmNQnbtc';

    // ==========================================================================
    // 2. ESTADO GLOBAL
    // ==========================================================================
    window.currentTenantId    = null;
    window.tenantConfigGlobal = null;
    window.tenantSlugActivo   = 'renmcycf';
    window._saasTenantFallback = { logo_url: null, hero_image_url: null };

    // ==========================================================================
    // 3. HELPERS
    // ==========================================================================
    const hexToRgbString = (hex) => {
        if (!hex || typeof hex !== 'string') return '15 23 42';
        let h = hex.trim().replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return '15 23 42';
        return `${parseInt(h.substring(0,2), 16)} ${parseInt(h.substring(2,4), 16)} ${parseInt(h.substring(4,6), 16)}`;
    };

    const limpiarHostname = (host) =>
        (host || '').replace(/^www\./i, '').toLowerCase().trim();

    const esHostingConPath = (hostname) => {
        if (!hostname) return true;
        return (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname.endsWith('.local') ||
            hostname.includes('github.io') ||
            hostname.includes('vercel.app') ||
            hostname.includes('netlify.app') ||
            hostname.includes('pages.dev') ||
            hostname.includes('web.app') ||
            hostname.includes('firebaseapp.com') ||
            hostname.includes('ngrok-free.app') ||
            /^\d+\.\d+\.\d+\.\d+$/.test(hostname)   // IP directa
        );
    };

    const esperarSupabase = () => new Promise((resolve, reject) => {
        if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
            return resolve(window.supabase);
        }
        let intentos = 0;
        const MAX_INTENTOS = 100;      // 100 * 50ms = 5 segundos
        const INTERVALO    = 50;
        const timer = setInterval(() => {
            intentos++;
            if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
                clearInterval(timer);
                resolve(window.supabase);
            } else if (intentos >= MAX_INTENTOS) {
                clearInterval(timer);
                reject(new Error(
                    'Supabase SDK no detectado tras 5s. ' +
                    'Incluí <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> antes de saas-core.js.'
                ));
            }
        }, INTERVALO);
    });

    // ==========================================================================
    // 4. INICIALIZACIÓN BLINDADA DE SUPABASE (Top-Level, con polling)
    // ==========================================================================
    const dbReady = (async () => {
        if (window.db) {
            console.log('ℹ️ [ASARI CORE] window.db ya existía. Se reutiliza.');
            return window.db;
        }
        try {
            const supa = await esperarSupabase();
            window.db = supa.createClient(window.PROJECT_URL, window.PUBLIC_KEY);
            console.log('✅ [ASARI CORE] Cliente Supabase inicializado.');
            return window.db;
        } catch (err) {
            console.error('❌ [ASARI CORE] No se pudo inicializar Supabase:', err.message);
            // Devolvemos un stub que falla explícitamente si alguien lo usa
            window.db = {
                from: () => { throw new Error('Supabase no inicializado: ' + err.message); },
                storage: { from: () => { throw new Error('Supabase no inicializado: ' + err.message); } }
            };
            return window.db;
        }
    })();

    window.dbReady = dbReady;

    // ==========================================================================
    // 5. APLICACIÓN DE TEMA (Colores + Branding)
    // ==========================================================================
    function applyTenantTheme(tenantConfig) {
        if (!tenantConfig) return;

        const root = document.documentElement;

        // Paleta RGB suelta para Tailwind (bg-wlPrimary/50, etc.)
        root.style.setProperty('--wl-primary',    hexToRgbString(tenantConfig.color_primario   || '#0f172a'));
        root.style.setProperty('--wl-secondary',  hexToRgbString(tenantConfig.color_secundario || '#d4af37'));
        root.style.setProperty('--wl-tertiary',   hexToRgbString(tenantConfig.color_terciario  || '#1e3a8a'));
        root.style.setProperty('--wl-background', hexToRgbString(tenantConfig.color_background || '#f1f5f9'));

        // Fallback de identidad para HTMLs que aún no tienen renmcycf_config
        window._saasTenantFallback = {
            logo_url:       tenantConfig.logo_url       || null,
            hero_image_url: tenantConfig.hero_image_url || null
        };

        // Inyección de nombre institucional en elementos comunes
        const nombre = tenantConfig.nombre_institucion || 'Registro';
        const selectores = [
            '.wl-institucion-nombre',
            '.wl-institucion-nombre-corto',
            '#wl-institucion-nombre',
            '#wl-institucion-nombre-top',
            '#wl-institucion-nombre-footer',
            '#wl-title-institucion',
            '#sidebar-institucion-nombre',
            '#login-institucion-nombre',
            '#doc-instituto',
            '#modal-institucion-nombre'
        ];
        document.querySelectorAll(selectores.join(',')).forEach(el => {
            if (!el) return;
            if (el.classList.contains('wl-institucion-nombre-corto') && nombre.length > 20) {
                el.innerText = nombre.substring(0, 18) + '…';
            } else {
                el.innerText = nombre;
            }
        });

        // Título de pestaña
        if (document.title && document.title.includes('·')) {
            const prefijo = document.title.split('·')[0].trim();
            document.title = `${prefijo} · ${nombre}`;
        } else if (document.title) {
            document.title = `${document.title} · ${nombre}`;
        }

        // Inyección de logos si existen contenedores estándar
        if (tenantConfig.logo_url) {
            document.querySelectorAll('.wl-logo, #nav-logo, #dynamic-logo, #val-logo').forEach(img => {
                if (img && img.tagName === 'IMG') {
                    img.src = tenantConfig.logo_url;
                    img.style.display = 'block';
                }
            });
        }
    }

    // ==========================================================================
    // 6. initTenant — Lógica estricta P1 → P2 → P3 → P4
    // ==========================================================================
    window.initTenant = async function () {
        try {
            await dbReady;   // nos aseguramos de tener db listo

            if (!window.db || typeof window.db.from !== 'function') {
                throw new Error('Cliente Supabase no disponible. Revisá el orden de carga de scripts.');
            }

            const urlParams   = new URLSearchParams(window.location.search);
            const hostnameRaw = window.location.hostname;
            const hostname    = limpiarHostname(hostnameRaw);
            const hostingPath = esHostingConPath(hostname);

            let tenantConfig = null;
            let tenantSlug   = null;
            let origen       = null;

            // ─────────────────────────────────────────────────────────
            // P1: ?tenant=slug → fuerza y limpia caché vieja
            // ─────────────────────────────────────────────────────────
            const slugParam = (urlParams.get('tenant') || '').trim().toLowerCase();
            if (slugParam) {
                origen = 'P1_URL';
                console.log('🎯 [P1] Force mode por query:', slugParam);

                // Limpiar caché vieja ANTES de consultar
                try {
                    sessionStorage.removeItem('saas_tenant_slug');
                    localStorage.removeItem('saas_tenant_slug');
                } catch (e) {}

                const { data, error } = await window.db
                    .from('saas_tenants')
                    .select('*')
                    .eq('slug', slugParam)
                    .eq('activo', true)
                    .maybeSingle();

                if (error) throw new Error(`Error de conexión (P1): ${error.message}`);
                if (data) {
                    tenantConfig = data;
                    tenantSlug   = data.slug;
                } else {
                    console.warn('⚠️ [P1] Slug no encontrado o inactivo:', slugParam);
                }
            }

            // ─────────────────────────────────────────────────────────
            // P2: Dominio personalizado (BLOQUEA a P3 si se activa)
            // ─────────────────────────────────────────────────────────
            if (!tenantConfig && !hostingPath && hostname) {
                origen = 'P2_DOMAIN';
                console.log('🌐 [P2] Buscando por dominio personalizado:', hostname);

                const { data, error } = await window.db
                    .from('saas_tenants')
                    .select('*')
                    .eq('dominio_personalizado', hostname)
                    .eq('activo', true)
                    .maybeSingle();

                if (error) throw new Error(`Error de conexión (P2): ${error.message}`);

                if (data) {
                    tenantConfig = data;
                    tenantSlug   = data.slug;
                    console.log('✅ [P2] Tenant por dominio:', tenantSlug);
                } else {
                    console.log('ℹ️ [P2] Dominio sin tenant asociado. Se ignora caché (P3) por ser dominio propio.');
                    // P2 activa y fallida → NO caemos a P3, saltamos a P4
                    origen = 'P2_DOMAIN_FALLIDO';
                }
            }

            // ─────────────────────────────────────────────────────────
            // P3: Caché (solo si P1 y P2 no resolvieron)
            // ─────────────────────────────────────────────────────────
            if (!tenantConfig && origen !== 'P2_DOMAIN_FALLIDO') {
                let slugCache = null;
                try {
                    slugCache = sessionStorage.getItem('saas_tenant_slug')
                             || localStorage.getItem('saas_tenant_slug');
                } catch (e) {}

                if (slugCache) {
                    origen = 'P3_CACHE';
                    console.log('💾 [P3] Usando caché:', slugCache);

                    const { data, error } = await window.db
                        .from('saas_tenants')
                        .select('*')
                        .eq('slug', slugCache)
                        .eq('activo', true)
                        .maybeSingle();

                    if (error) throw new Error(`Error de conexión (P3): ${error.message}`);
                    if (data) {
                        tenantConfig = data;
                        tenantSlug   = data.slug;
                    } else {
                        console.warn('⚠️ [P3] Slug en caché ya no existe o está inactivo:', slugCache);
                    }
                }
            }

            // ─────────────────────────────────────────────────────────
            // P4: Fallback absoluto
            // ─────────────────────────────────────────────────────────
            if (!tenantConfig) {
                origen = 'P4_FALLBACK';
                console.log('🆘 [P4] Fallback a renmcycf');

                const { data, error } = await window.db
                    .from('saas_tenants')
                    .select('*')
                    .eq('slug', 'renmcycf')
                    .eq('activo', true)
                    .maybeSingle();

                if (error) throw new Error(`Error de conexión (P4): ${error.message}`);
                if (data) {
                    tenantConfig = data;
                    tenantSlug   = data.slug;
                }
            }

            // ─────────────────────────────────────────────────────────
            // Validación final
            // ─────────────────────────────────────────────────────────
            if (!tenantConfig) {
                throw new Error(
                    `No se pudo resolver el tenant. ` +
                    `Hostname: ${hostname || 'desconocido'} | Slug intentado: ${tenantSlug || 'renmcycf'} | Origen: ${origen || 'ninguno'}`
                );
            }

            // Estado global
            window.currentTenantId     = tenantConfig.id;
            window.tenantConfigGlobal  = tenantConfig;
            window.tenantSlugActivo    = tenantConfig.slug || 'renmcycf';
            window.tenantOrigen        = origen;

            // Persistir caché (solo si hay slug)
            try {
                if (window.tenantSlugActivo) {
                    sessionStorage.setItem('saas_tenant_slug', window.tenantSlugActivo);
                    localStorage.setItem('saas_tenant_slug', window.tenantSlugActivo);
                }
            } catch (e) {}

            console.log(`✅ [ASARI CORE] Tenant activo: ${tenantConfig.nombre_institucion || tenantConfig.slug} | ID: ${tenantConfig.id} | Origen: ${origen}`);

            // Aplicar tema (colores, textos, logos)
            applyTenantTheme(tenantConfig);

            // Auto-propagación de ?tenant= en links internos
            try {
                document.querySelectorAll('a[href]').forEach(link => {
                    const href = link.getAttribute('href');
                    if (!href) return;
                    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
                    if (/^(https?:)?\/\//i.test(href)) return; // externos
                    try {
                        const url = new URL(link.href, window.location.origin);
                        if (!url.searchParams.has('tenant')) {
                            url.searchParams.set('tenant', window.tenantSlugActivo);
                            link.setAttribute('href', url.pathname + url.search + url.hash);
                        }
                    } catch (e) {}
                });
            } catch (e) {}

            // Liberar loader si existe
            if (document.body) document.body.classList.add('ready');

            // Dispatch global
            window.dispatchEvent(new CustomEvent('tenantReady', { detail: tenantConfig }));
            window.dispatchEvent(new Event('tenantReady'));

            return tenantConfig;

        } catch (err) {
            console.error('❌ [ASARI CORE] Error Bootstrapper SaaS:', err);

            // Pantalla de error mínima y clara
            if (document.body) {
                document.body.innerHTML = `
                    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px;">
                        <div style="max-width:520px;">
                            <h1 style="font-size:2rem;margin-bottom:12px;color:#ef4444;font-weight:900;">Error 404</h1>
                            <p style="font-size:1rem;line-height:1.5;color:#cbd5e1;">
                                ${err.message || 'La institución a la que intentás acceder no está registrada o se encuentra inactiva.'}
                            </p>
                        </div>
                    </div>`;
            }
            // Re-dispatch para que listeners igual reciban algo
            window.dispatchEvent(new Event('tenantError'));
            return null;
        }
    };

    // ==========================================================================
    // 7. UTILIDADES GLOBALES DE NAVEGACIÓN
    // ==========================================================================
    window.navegarSaaS = function (paginaDestino) {
        const slug = window.tenantSlugActivo || 'renmcycf';
        const sep  = paginaDestino.includes('?') ? '&' : '?';
        window.location.href = `${paginaDestino}${sep}tenant=${encodeURIComponent(slug)}`;
    };

    // ==========================================================================
    // 8. AUTO-BOOTSTRAP (si el usuario no llama a initTenant manualmente)
    // ==========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Solo auto-init si nadie lo llamó aún
            if (!window.tenantConfigGlobal) {
                window.initTenant().catch(() => {});
            }
        }, { once: true });
    } else {
        if (!window.tenantConfigGlobal) {
            window.initTenant().catch(() => {});
        }
    }

})();
