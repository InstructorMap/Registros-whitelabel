(() => {
 const button=document.getElementById('payhub-open');
 if(!button)return;
 const dialog=document.createElement('dialog');
 dialog.style.cssText='width:min(92vw,620px);max-height:85vh;overflow:auto;border:1px solid #64748b;border-radius:16px;padding:24px;background:#0f172a;color:#f8fafc';
 dialog.innerHTML='<h2 style="font-size:24px;font-weight:bold">ASARI Pay Hub</h2><p>Infraestructura financiera · Entrega 1.1</p><label for="payhub-env">Entorno</label> <select id="payhub-env" style="color:#0f172a;background:#fff"><option value="testing">Testing</option><option value="production">Producción</option></select><p id="payhub-status" role="status" style="margin:16px 0"></p><button type="button" id="payhub-refresh">Actualizar</button> <button type="button" id="payhub-close">Cerrar</button>';
 document.body.append(dialog);
 const status=dialog.querySelector('#payhub-status'), env=dialog.querySelector('#payhub-env');
 let generation=0;
 async function refresh(){
 const current=++generation;
 status.textContent='Verificando sesión y base financiera…';
 try {
 const {data,error}=await db.auth.getUser();
 if(error||data.user?.id!=='e11ce688-bcd0-42f5-9135-d6dc9a3757ac')throw new Error('Acceso reservado al administrador general.');
 const selected=env.value;
 const results=await Promise.all(['payhub_accounts','payhub_orders','payhub_events'].map(t=>db.from(t).select('id',{count:'exact',head:true}).eq('environment',selected)));
 if(results.some(r=>r.error))throw new Error('No se pudo consultar la infraestructura financiera.');
 if(current!==generation||!dialog.open)return;
 status.textContent='Cuentas: '+results[0].count+' · Órdenes: '+results[1].count+' · Eventos: '+results[2].count+' · Conexión a proveedores pendiente. No se habilitan cobros desde esta entrega.';
 }catch(e){if(current===generation&&dialog.open)status.textContent=e.message;}
 }
 button.addEventListener('click',()=>{dialog.showModal();refresh();});
 env.addEventListener('change',refresh);
 dialog.querySelector('#payhub-refresh').addEventListener('click',refresh);
 dialog.querySelector('#payhub-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{generation++;status.textContent='';});
})();