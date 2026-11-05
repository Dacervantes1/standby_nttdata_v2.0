/* Standby Control V3
   Se carga DESPUÉS de app.js para extender la V2 sin reemplazarla. */

(function standbyV3(){
  const ANNUAL_VACATION_DEFAULT = 12;

  function injectV3Navigation(){
    const nav = document.querySelector('#nav');
    if(!nav) return;

    const catalogBtn = nav.querySelector('[data-view="catalogo"]');
    if(catalogBtn){
      catalogBtn.removeAttribute('data-admin-only');
      catalogBtn.setAttribute('data-auth-only','');
    }

    if(!nav.querySelector('[data-view="configuracion"]')){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.view = 'configuracion';
      btn.setAttribute('data-admin-only','');
      btn.textContent = 'Configuración';
      const reports = nav.querySelector('[data-view="reportes"]');
      nav.insertBefore(btn,reports || null);
    }
  }

  function applyBranding(){
    document.querySelectorAll('.brand-mark').forEach(mark=>{
      if(mark.classList.contains('ntt-logo-box')) return;
      mark.classList.add('ntt-logo-box');
      mark.innerHTML = '<img src="assets/ntt-data-logo.svg" alt="NTT DATA"><span class="ntt-logo-fallback hidden">NTT DATA</span>';
      const img = mark.querySelector('img');
      const fallback = mark.querySelector('.ntt-logo-fallback');
      img.addEventListener('error',()=>{img.remove();fallback.classList.remove('hidden')},{once:true});
    });

    // V3.1: el logo permanece en el sidebar. Eliminamos cualquier marca duplicada
    // en el encabezado para evitar saturar la parte superior.
    document.querySelectorAll('.topbar-brand').forEach(x=>x.remove());
  }

  function completedServiceYears(employee, asOf = isoToday()){
    if(!employee?.fecha_ingreso) return 0;
    const start = new Date(employee.fecha_ingreso + 'T12:00:00');
    const end = new Date(asOf + 'T12:00:00');
    if(Number.isNaN(start.getTime()) || end < start) return 0;
    let years = end.getFullYear() - start.getFullYear();
    const anniversaryPassed =
      end.getMonth() > start.getMonth() ||
      (end.getMonth() === start.getMonth() && end.getDate() >= start.getDate());
    if(!anniversaryPassed) years -= 1;
    return Math.max(0,years);
  }

  function vacationStats(employee, asOf = isoToday()){
    if(!employee?.fecha_ingreso){
      return {years:0,earned:0,used:0,adjustment:Number(employee?.vacaciones_ajuste||0),available:null};
    }
    const years = completedServiceYears(employee,asOf);
    const annual = Number(employee.vacaciones_dias_anuales ?? ANNUAL_VACATION_DEFAULT);
    const earned = years * annual;
    const used = state.data.schedules.filter(s=>
      s.colaborador_id === employee.id &&
      s.codigo_horario === 'V' &&
      s.fecha >= employee.fecha_ingreso &&
      s.fecha <= asOf
    ).length;
    const adjustment = Number(employee.vacaciones_ajuste || 0);
    return {years,annual,earned,used,adjustment,available:earned + adjustment - used};
  }

  function techItemsHtml(employeeId){
    const list = state.data.techCatalog.filter(x=>x.colaborador_id===employeeId);
    if(!list.length) return '<p class="muted">Todavía no tienes accesos o equipos registrados.</p>';
    return `<div class="tech-list">${list.map(x=>`
      <div class="tech-item">
        <span class="pill ${x.tipo==='ACCESO'?'active':'pending'}">${x.tipo==='ACCESO'?'ACCESO':'EQUIPO'}</span>
        <b>${esc(x.nombre)}</b>
        <span class="muted">${x.tipo==='ACCESO'?'Permiso / acceso tecnológico':'Equipo asignado'}</span>
      </div>`).join('')}</div>`;
  }

  injectV3Navigation();
  applyBranding();


  // -----------------------------------------------------------------------
  // Buscador global V3.2
  // - Filtra realmente las filas/elementos visibles de la pantalla.
  // - No depende solo de una clase CSS: fuerza display:none cuando no coincide.
  // - Ignora tildes y mayúsculas/minúsculas.
  // - Mantiene un contador compacto y un único botón de limpiar.
  // -----------------------------------------------------------------------
  let globalViewSearchTerm = '';
  let globalViewSearchView = null;
  let searchMountScheduled = false;

  function normalizeSearch(value){
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .trim();
  }

  function searchTextFor(element){
    let value = element?.innerText || element?.textContent || '';
    element?.querySelectorAll?.('[title],[data-search]').forEach(node=>{
      value += ' ' + (node.getAttribute('title') || '');
      value += ' ' + (node.getAttribute('data-search') || '');
    });
    return normalizeSearch(value);
  }

  function searchCandidates(){
    // tbody > tr cubre tanto la matriz .plan como cualquier tabla CRUD/reporte.
    const selectors = [
      'table tbody > tr',
      '.tech-item',
      '.detail-row',
      '.calendar-day',
      '.vacation-stat',
      '.schedule-legend-item'
    ];
    const seen = new Set();
    const result = [];

    selectors.forEach(selector=>{
      app.querySelectorAll(selector).forEach(node=>{
        if(node.classList.contains('empty') || seen.has(node)) return;
        seen.add(node);
        result.push(node);
      });
    });
    return result;
  }

  function setSearchVisibility(node, visible){
    node.classList.toggle('global-search-hidden', !visible);
    node.toggleAttribute('data-search-filtered-out', !visible);

    // Refuerzo para tablas/matrices donde reglas de display pueden prevalecer.
    if(!visible){
      node.style.setProperty('display','none','important');
      node.setAttribute('aria-hidden','true');
    }else{
      node.style.removeProperty('display');
      node.removeAttribute('aria-hidden');
    }
  }

  function restoreSearchVisibility(){
    app.querySelectorAll('[data-search-filtered-out], .global-search-hidden').forEach(node=>{
      node.classList.remove('global-search-hidden');
      node.removeAttribute('data-search-filtered-out');
      node.removeAttribute('aria-hidden');
      node.style.removeProperty('display');
    });
  }

  function updateSearchStatus(matches,total,query){
    document.querySelectorAll('[data-global-search-count]').forEach(el=>{
      el.classList.toggle('has-query',Boolean(query));
      el.classList.toggle('no-results',Boolean(query) && matches===0);

      if(!query){
        el.textContent = 'Buscar';
      }else if(!total){
        el.textContent = 'Sin elementos';
      }else if(matches===0){
        el.textContent = '0 resultados';
      }else{
        el.textContent = `${matches} resultado${matches===1?'':'s'}`;
      }
    });
  }

  function applyGlobalViewSearch(){
    const query = normalizeSearch(globalViewSearchTerm);
    const candidates = searchCandidates();

    if(!query){
      restoreSearchVisibility();
      updateSearchStatus(candidates.length,candidates.length,'');
      return;
    }

    let matches = 0;
    candidates.forEach(node=>{
      const visible = searchTextFor(node).includes(query);
      setSearchVisibility(node,visible);
      if(visible) matches += 1;
    });

    updateSearchStatus(matches,candidates.length,query);
  }

  function buildGlobalSearchControl(standalone=false){
    const wrapper = document.createElement(standalone ? 'div' : 'label');
    wrapper.className = standalone ? 'global-search-panel global-view-search' : 'global-view-search';
    wrapper.innerHTML = `
      ${standalone ? '<div class="global-search-copy"><b>Buscar en esta pantalla</b><small>Filtra nombres, códigos, dominios, proyectos, tickets y texto visible.</small></div>' : '<span class="global-search-label">Buscar</span>'}
      <div class="global-search-control">
        <span class="global-search-icon" aria-hidden="true"></span>
        <input id="globalViewSearch" type="text" autocomplete="off" spellcheck="false" placeholder="Buscar por nombre, código, dominio, proyecto..." aria-label="Buscar en esta pantalla">
        <span class="global-search-result" data-global-search-count>Buscar</span>
        <button type="button" class="global-search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda">×</button>
      </div>`;

    const input = wrapper.querySelector('#globalViewSearch');
    const clear = wrapper.querySelector('.global-search-clear');
    input.value = globalViewSearchTerm;

    input.addEventListener('input',e=>{
      globalViewSearchTerm = e.target.value;
      wrapper.classList.toggle('searching',Boolean(normalizeSearch(globalViewSearchTerm)));
      clear.classList.toggle('visible',Boolean(normalizeSearch(globalViewSearchTerm)));
      applyGlobalViewSearch();
    });

    input.addEventListener('keydown',e=>{
      if(e.key === 'Escape' && globalViewSearchTerm){
        e.preventDefault();
        globalViewSearchTerm = '';
        input.value = '';
        wrapper.classList.remove('searching');
        clear.classList.remove('visible');
        applyGlobalViewSearch();
      }
    });

    clear.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      globalViewSearchTerm = '';
      input.value = '';
      wrapper.classList.remove('searching');
      clear.classList.remove('visible');
      applyGlobalViewSearch();
      input.focus();
    });

    wrapper.classList.toggle('searching',Boolean(normalizeSearch(globalViewSearchTerm)));
    clear.classList.toggle('visible',Boolean(normalizeSearch(globalViewSearchTerm)));
    return wrapper;
  }

  function mountGlobalViewSearch(){
    searchMountScheduled = false;
    const host = document.querySelector('#viewSearchHost');
    if(!host || !app || document.querySelector('#shell')?.classList.contains('hidden')) return;

    // Al cambiar de módulo no arrastramos el filtro de la pantalla anterior.
    if(globalViewSearchView !== state.view){
      restoreSearchVisibility();
      globalViewSearchView = state.view;
      globalViewSearchTerm = '';
    }

    const filterbar = app.querySelector('.filterbar');

    document.querySelectorAll('.global-view-search').forEach(node=>{
      if(!node.closest('#viewSearchHost') && !node.closest('.filterbar')) node.remove();
    });

    if(filterbar){
      host.innerHTML = '';
      host.classList.add('hidden');
      let control = filterbar.querySelector('.global-view-search');
      if(!control){
        control = buildGlobalSearchControl(false);
        filterbar.prepend(control);
      }
    }else{
      host.classList.remove('hidden');
      if(!host.querySelector('.global-view-search')){
        host.innerHTML = '';
        host.appendChild(buildGlobalSearchControl(true));
      }
    }

    const input = document.querySelector('#globalViewSearch');
    if(input && input.value !== globalViewSearchTerm) input.value = globalViewSearchTerm;
    applyGlobalViewSearch();
  }

  function scheduleSearchMount(){
    if(searchMountScheduled) return;
    searchMountScheduled = true;
    requestAnimationFrame(mountGlobalViewSearch);
  }

  const appSearchObserver = new MutationObserver(scheduleSearchMount);
  appSearchObserver.observe(app,{childList:true,subtree:true});
  scheduleSearchMount();

  // -----------------------------------------------------------------------
  // Extiende la carga de datos: el colaborador puede leer SU catálogo.
  // -----------------------------------------------------------------------
  const loadDataV2 = loadData;
  loadData = async function loadDataV3(){
    await loadDataV2();
    if(isAdmin()){
      const {data:allScheduleDefs,error:scheduleError}=await db.from('horarios_catalogo').select('*').order('orden');
      if(scheduleError) throw scheduleError;
      state.data.scheduleCatalogAll=allScheduleDefs||[];
    }
    if(!isAdmin() && state.currentEmployeeId){
      const {data,error} = await db
        .from('catalogo_tecnologico')
        .select('*')
        .eq('colaborador_id',state.currentEmployeeId)
        .order('created_at');
      if(error) throw error;
      state.data.techCatalog = data || [];
    }
  };

  // -----------------------------------------------------------------------
  // Navegación/rol.
  // -----------------------------------------------------------------------
  const setUserUIV2 = setUserUI;
  setUserUI = function setUserUIV3(){
    const requestedView=state.view;
    setUserUIV2();
    if(!isAdmin() && !isPublic() && requestedView==='catalogo') state.view='catalogo';
    applyBranding();
    document.querySelectorAll('[data-auth-only]').forEach(x=>x.classList.toggle('hidden',isPublic()));
    const catalogBtn = document.querySelector('#nav [data-view="catalogo"]');
    if(catalogBtn) catalogBtn.textContent = isAdmin() ? 'Catálogo tecnológico' : 'Mi catálogo tecnológico';
    if(!isAdmin() && !isPublic() && state.view==='configuracion') state.view='dashboard';
    scheduleSearchMount();
  };

  const renderV2 = render;
  render = function renderV3(){
    if(state.session && !isPublic() && !isAdmin() && state.view==='catalogo') return renderMyTechCatalog();
    if(state.session && isAdmin() && state.view==='configuracion') return renderAdminSettings();
    return renderV2();
  };

  // -----------------------------------------------------------------------
  // Vista de colaborador: vacaciones + catálogo tecnológico.
  // -----------------------------------------------------------------------
  const renderCollabV2 = renderCollab;
  renderCollab = function renderCollabV3(){
    renderCollabV2();
    const e = employeeById(state.currentEmployeeId);
    if(!e) return;
    const v = vacationStats(e);
    const filterbar = app.querySelector('.filterbar');
    const vacationHtml = `<div class="vacation-summary">
      <div class="vacation-stat"><div class="label">Antigüedad</div><strong>${v.years}</strong><small>Años completos de servicio</small></div>
      <div class="vacation-stat"><div class="label">Generados</div><strong>${v.available===null?'—':v.earned}</strong><small>${Number(e.vacaciones_dias_anuales||12)} días por año completo</small></div>
      <div class="vacation-stat"><div class="label">Vacaciones usadas</div><strong>${v.available===null?'—':v.used}</strong><small>Días V registrados desde el ingreso</small></div>
      <div class="vacation-stat"><div class="label">Disponibles</div><strong>${v.available===null?'Pendiente':v.available}</strong><small>${e.fecha_ingreso?'Corte '+isoToday():'Falta registrar fecha de ingreso'}</small></div>
    </div>`;
    if(filterbar) filterbar.insertAdjacentHTML('afterend',vacationHtml);

    app.insertAdjacentHTML('beforeend',`<div class="card section">
      <div class="section-head"><div><h2>Mi catálogo tecnológico</h2><p class="muted">Accesos, permisos y equipos asociados a tu usuario.</p></div><button class="secondary" id="openMyTech">Ver catálogo</button></div>
      ${techItemsHtml(e.id)}
    </div>`);
    const btn = document.querySelector('#openMyTech');
    if(btn) btn.onclick = ()=>{state.view='catalogo';render();};
  };

  function renderMyTechCatalog(){
    const e = employeeById(state.currentEmployeeId);
    setHeader('Mi catálogo tecnológico','Accesos, permisos y equipos asignados');
    app.innerHTML = `<div class="card section">
      <div class="section-head"><div><h2>${esc(fullName(e))}</h2><p class="muted">Información de solo lectura. Los cambios los realiza un administrador.</p></div></div>
      ${techItemsHtml(state.currentEmployeeId)}
    </div>`;
  }

  // -----------------------------------------------------------------------
  // Horario general: colapsa la enorme leyenda H1-H24.
  // -----------------------------------------------------------------------
  const renderGeneralScheduleV2 = renderGeneralSchedule;
  renderGeneralSchedule = function renderGeneralScheduleV3(){
    renderGeneralScheduleV2();
    const legend = app.querySelector('.schedule-legend');
    if(legend && !legend.closest('.schedule-legend-panel')){
      const details = document.createElement('details');
      details.className = 'schedule-legend-panel';
      details.innerHTML = '<summary>Ver catálogo de turnos y novedades (H1–H24, V, C, F, E, A)</summary>';
      legend.parentNode.insertBefore(details,legend);
      details.appendChild(legend);
    }
  };

  // -----------------------------------------------------------------------
  // Colaboradores: fecha de ingreso + saldo de vacaciones.
  // -----------------------------------------------------------------------
  renderEmployees = function renderEmployeesV3(){
    setHeader('Colaboradores','CRUD, estado, proyectos y saldo de vacaciones');
    app.innerHTML = `<div class="card section">
      <div class="section-head"><div><h2>Maestro de colaboradores</h2><p class="muted">El saldo se calcula con 12 días por cada año completo de servicio, menos los días V registrados.</p></div><button class="primary" id="newEmployee">Nuevo colaborador</button></div>
      <div class="toolbar" style="margin-bottom:12px"><input id="empSearch" placeholder="Buscar por código, nombre o correo"><select id="empStatusFilter"><option value="all">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Colaborador</th><th>Ingreso</th><th>Vacaciones</th><th>Dominio</th><th>Proyecto(s)</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="employeesBody"></tbody></table></div>
    </div>`;

    const draw = ()=>{
      const term = $('#empSearch').value.toLowerCase();
      const st = $('#empStatusFilter').value;
      const list = state.data.employees.filter(e=>(st==='all'||e.estado===st)&&(!term||[e.codigo_empleado,fullName(e),e.correo].join(' ').toLowerCase().includes(term)));
      $('#employeesBody').innerHTML = list.map(e=>{
        const ps=currentAssignments(e.id).map(a=>projectById(a.proyecto_id)?.codigo_proyecto).filter(Boolean).join(', ');
        const v=vacationStats(e);
        return `<tr>
          <td>${esc(e.codigo_empleado)}</td>
          <td><b>${esc(fullName(e))}</b><div class="muted">${esc(e.cedula||'')}</div></td>
          <td>${esc(e.fecha_ingreso||'—')}</td>
          <td class="employee-vacation"><b>${v.available===null?'—':v.available+' días'}</b><div class="muted">${v.available===null?'Registrar fecha de ingreso':`${v.earned} generados · ${v.used} usados`}</div></td>
          <td>${esc(domainName(e))}</td>
          <td>${esc(ps||'—')}</td>
          <td>${esc(e.correo||'—')}</td>
          <td><span class="pill ${e.estado==='ACTIVO'?'active':'inactive'}">${e.estado}</span></td>
          <td><div class="action-group"><button class="secondary" data-edit-emp="${e.id}">Editar</button><button class="switch ${e.estado==='ACTIVO'?'on':''}" data-toggle-emp="${e.id}" title="Activar/desactivar"></button><button class="danger" data-delete-emp="${e.id}">Eliminar</button></div></td>
        </tr>`;
      }).join('') || '<tr><td colspan="9" class="empty">Sin colaboradores</td></tr>';
    };

    draw();
    $('#empSearch').oninput=draw;
    $('#empStatusFilter').onchange=draw;
    $('#newEmployee').onclick=()=>openEmployeeModal();
    $('#employeesBody').onclick=e=>{
      const ed=e.target.closest('[data-edit-emp]'),tg=e.target.closest('[data-toggle-emp]'),del=e.target.closest('[data-delete-emp]');
      if(ed)openEmployeeModal(ed.dataset.editEmp);
      if(tg)toggleEmployee(tg.dataset.toggleEmp);
      if(del)deleteEmployee(del.dataset.deleteEmp);
    };
  };

  openEmployeeModal = function openEmployeeModalV3(id=null){
    const e=id?employeeById(id):null;
    const selected=new Set(id?currentAssignments(id).map(a=>a.proyecto_id):[]);
    openModal(`<h2>${e?'Editar':'Nuevo'} colaborador</h2><form id="employeeForm"><div class="form-grid">
      <label>Código empleado<input id="empCode" required value="${esc(e?.codigo_empleado||'')}"></label>
      <label>Estado<select id="empStatus"><option value="ACTIVO" ${e?.estado!=='INACTIVO'?'selected':''}>ACTIVO</option><option value="INACTIVO" ${e?.estado==='INACTIVO'?'selected':''}>INACTIVO</option></select></label>
      <label>Nombres<input id="empNames" required value="${esc(e?.nombres||'')}"></label>
      <label>Apellidos<input id="empLast" required value="${esc(e?.apellidos||'')}"></label>
      <label>Cédula<input id="empCedula" value="${esc(e?.cedula||'')}"></label>
      <label>Correo<input id="empEmail" type="email" value="${esc(e?.correo||'')}"></label>
      <label>Usuario NTT<input id="empUser" value="${esc(e?.usuario_ntt||'')}"></label>
      <label>Teléfono<input id="empPhone" value="${esc(e?.telefono||'')}"></label>
      <label>Fecha de ingreso<input id="empStartDate" type="date" value="${esc(e?.fecha_ingreso||'')}"></label>
      <label>Días de vacaciones/año<input id="empVacationAnnual" type="number" min="0" step="0.5" value="${esc(e?.vacaciones_dias_anuales??12)}"></label>
      <label>Ajuste de vacaciones<input id="empVacationAdjust" type="number" step="0.5" value="${esc(e?.vacaciones_ajuste??0)}"><span class="soft-note">Úsalo solo para saldos históricos o correcciones.</span></label>
      <label>Dominio<select id="empDomain"><option value="">Sin dominio</option>${state.data.domains.map(d=>`<option value="${d.id}" ${e?.dominio_id===d.id?'selected':''}>${esc(d.nombre)}</option>`).join('')}</select></label>
      <label>Sociedad<input id="empSociedad" value="${esc(e?.sociedad||'NECU')}"></label>
      <label class="full">Proyecto(s)<select id="empProjects" multiple size="6">${state.data.projects.filter(p=>p.estado==='ACTIVO').map(p=>`<option value="${p.id}" ${selected.has(p.id)?'selected':''}>${esc(p.codigo_proyecto)} · ${esc(p.nombre)}</option>`).join('')}</select></label>
    </div><div id="empError" class="alert error hidden"></div><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary" type="submit">Guardar</button></div></form>`);
    $('#employeeForm').onsubmit=ev=>saveEmployee(ev,id);
  };

  saveEmployee = async function saveEmployeeV3(ev,id){
    ev.preventDefault();
    const payload={
      codigo_empleado:$('#empCode').value.trim(),
      nombres:$('#empNames').value.trim(),
      apellidos:$('#empLast').value.trim(),
      cedula:$('#empCedula').value.trim()||null,
      correo:$('#empEmail').value.trim()||null,
      usuario_ntt:$('#empUser').value.trim()||null,
      telefono:$('#empPhone').value.trim()||null,
      fecha_ingreso:$('#empStartDate').value||null,
      vacaciones_dias_anuales:Number($('#empVacationAnnual').value||12),
      vacaciones_ajuste:Number($('#empVacationAdjust').value||0),
      dominio_id:$('#empDomain').value||null,
      sociedad:$('#empSociedad').value.trim()||'NECU',
      estado:$('#empStatus').value
    };

    let eid=id;
    if(id){
      const {error}=await db.from('colaboradores').update(payload).eq('id',id);
      if(error)return empError(normalizeError(error));
    }else{
      const {data,error}=await db.from('colaboradores').insert(payload).select('id').single();
      if(error)return empError(normalizeError(error));
      eid=data.id;
    }

    const selected=[...$('#empProjects').selectedOptions].map(o=>o.value);
    const existing=state.data.assignments.filter(a=>a.colaborador_id===eid&&a.estado==='ACTIVO');
    for(const a of existing.filter(a=>!selected.includes(a.proyecto_id))){
      const {error}=await db.from('colaborador_proyecto').update({estado:'INACTIVO',fecha_fin:isoToday()}).eq('id',a.id);
      if(error)return empError(normalizeError(error));
    }
    for(const pid of selected.filter(pid=>!existing.some(a=>a.proyecto_id===pid))){
      const {error}=await db.from('colaborador_proyecto').insert({colaborador_id:eid,proyecto_id:pid,es_principal:selected[0]===pid,estado:'ACTIVO'});
      if(error)return empError(normalizeError(error));
    }
    closeModal();notify('Colaborador guardado');refreshData();
  };

  // -----------------------------------------------------------------------
  // Configuración ADMIN: CRUD de dominios, feriados/días especiales y turnos.
  // -----------------------------------------------------------------------
  function renderAdminSettings(){
    setHeader('Configuración','CRUD de dominios, calendario especial y catálogo de horarios');
    app.innerHTML=`<div class="settings-grid">
      <div class="card section settings-card"><div class="section-head"><div><h2>Dominios</h2><p class="muted">Áreas usadas para clasificar colaboradores.</p></div><button class="primary" id="newDomain">Nuevo</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${state.data.domains.map(d=>`<tr><td><b>${esc(d.nombre)}</b></td><td>${esc(d.descripcion||'—')}</td><td><span class="pill ${d.estado==='ACTIVO'?'active':'inactive'}">${d.estado}</span></td><td><div class="action-group"><button class="secondary" data-domain-edit="${d.id}">Editar</button><button class="danger" data-domain-delete="${d.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>
      </div>

      <div class="card section settings-card"><div class="section-head"><div><h2>Calendario especial</h2><p class="muted">Feriados, Navidad, Año Nuevo y días especiales.</p></div><button class="primary" id="newSpecial">Nuevo</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${state.data.special.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(x=>`<tr><td>${esc(x.fecha)}</td><td>${esc(x.tipo_dia)}</td><td>${esc(x.descripcion||'—')}</td><td><span class="pill ${x.estado==='ACTIVO'?'active':'inactive'}">${x.estado}</span></td><td><div class="action-group"><button class="secondary" data-special-edit="${x.id}">Editar</button><button class="danger" data-special-delete="${x.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>
      </div>

      <div class="card section settings-card wide-card"><div class="section-head"><div><h2>Catálogo de horarios</h2><p class="muted">H1–H24 y novedades V, C, F, E, A.</p></div><button class="primary" id="newScheduleDef">Nuevo</button></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Tipo</th><th>Descripción</th><th>Inicio</th><th>Fin</th><th>Noct.</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${(state.data.scheduleCatalogAll||state.data.scheduleCatalog).map(h=>`<tr><td><b>${esc(h.codigo)}</b></td><td>${esc(h.tipo)}</td><td>${esc(h.descripcion||'—')}</td><td>${esc(h.inicio?.slice(0,5)||'—')}</td><td>${esc(h.fin?.slice(0,5)||'—')}</td><td>${esc(h.horas_nocturnidad??0)}</td><td>${esc(h.orden??0)}</td><td><span class="pill ${h.estado==='INACTIVO'?'inactive':'active'}">${esc(h.estado||'ACTIVO')}</span></td><td><div class="action-group"><button class="secondary" data-sdef-edit="${h.id}">Editar</button><button class="danger" data-sdef-delete="${h.id}">Eliminar</button></div></td></tr>`).join('')}</tbody></table></div>
      </div>
    </div>`;

    $('#newDomain').onclick=()=>openDomainModal();
    app.querySelectorAll('[data-domain-edit]').forEach(b=>b.onclick=()=>openDomainModal(b.dataset.domainEdit));
    app.querySelectorAll('[data-domain-delete]').forEach(b=>b.onclick=()=>deleteDomain(b.dataset.domainDelete));

    $('#newSpecial').onclick=()=>openSpecialModal();
    app.querySelectorAll('[data-special-edit]').forEach(b=>b.onclick=()=>openSpecialModal(b.dataset.specialEdit));
    app.querySelectorAll('[data-special-delete]').forEach(b=>b.onclick=()=>deleteSpecial(b.dataset.specialDelete));

    $('#newScheduleDef').onclick=()=>openScheduleDefModal();
    app.querySelectorAll('[data-sdef-edit]').forEach(b=>b.onclick=()=>openScheduleDefModal(b.dataset.sdefEdit));
    app.querySelectorAll('[data-sdef-delete]').forEach(b=>b.onclick=()=>deleteScheduleDef(b.dataset.sdefDelete));
  }

  function openDomainModal(id=null){
    const d=id?state.data.domains.find(x=>x.id===id):null;
    openModal(`<h2>${d?'Editar':'Nuevo'} dominio</h2><form id="domainForm"><div class="form-grid one-col">
      <label>Nombre<input id="domainName" required value="${esc(d?.nombre||'')}"></label>
      <label>Descripción<textarea id="domainDescription">${esc(d?.descripcion||'')}</textarea></label>
      <label>Estado<select id="domainStatus"><option value="ACTIVO" ${d?.estado!=='INACTIVO'?'selected':''}>ACTIVO</option><option value="INACTIVO" ${d?.estado==='INACTIVO'?'selected':''}>INACTIVO</option></select></label>
    </div><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#domainForm').onsubmit=async e=>{
      e.preventDefault();
      const payload={nombre:$('#domainName').value.trim(),descripcion:$('#domainDescription').value.trim()||null,estado:$('#domainStatus').value};
      const q=id?db.from('dominios').update(payload).eq('id',id):db.from('dominios').insert(payload);
      const {error}=await q;if(error)return notify(normalizeError(error),'error');
      closeModal();notify('Dominio guardado');refreshData();
    };
  }

  async function deleteDomain(id){
    const d=state.data.domains.find(x=>x.id===id);if(!confirm(`¿Eliminar el dominio ${d?.nombre||''}?`))return;
    const {error}=await db.from('dominios').delete().eq('id',id);
    if(error){const {error:soft}=await db.from('dominios').update({estado:'INACTIVO'}).eq('id',id);if(soft)return notify(normalizeError(soft),'error');notify('El dominio está en uso: se marcó INACTIVO.');}
    else notify('Dominio eliminado');
    refreshData();
  }

  function openSpecialModal(id=null){
    const x=id?state.data.special.find(v=>v.id===id):null;
    openModal(`<h2>${x?'Editar':'Nuevo'} día especial</h2><form id="specialForm"><div class="form-grid">
      <label>Fecha<input id="specialDate" type="date" required value="${esc(x?.fecha||isoToday())}"></label>
      <label>Tipo<select id="specialType">${['FDS','NAVIDAD','AN','FP'].map(v=>`<option value="${v}" ${x?.tipo_dia===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label class="full">Descripción<input id="specialDescription" value="${esc(x?.descripcion||'')}"></label>
      <label>País<input id="specialCountry" value="${esc(x?.pais||'Ecuador')}"></label>
      <label>Estado<select id="specialStatus"><option value="ACTIVO" ${x?.estado!=='INACTIVO'?'selected':''}>ACTIVO</option><option value="INACTIVO" ${x?.estado==='INACTIVO'?'selected':''}>INACTIVO</option></select></label>
    </div><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#specialForm').onsubmit=async e=>{
      e.preventDefault();
      const payload={fecha:$('#specialDate').value,tipo_dia:$('#specialType').value,descripcion:$('#specialDescription').value.trim()||null,pais:$('#specialCountry').value.trim()||'Ecuador',estado:$('#specialStatus').value};
      const q=id?db.from('calendario_especial').update(payload).eq('id',id):db.from('calendario_especial').insert(payload);
      const {error}=await q;if(error)return notify(normalizeError(error),'error');
      closeModal();notify('Día especial guardado');refreshData();
    };
  }

  async function deleteSpecial(id){
    if(!confirm('¿Eliminar este día especial?'))return;
    const {error}=await db.from('calendario_especial').delete().eq('id',id);
    if(error)return notify(normalizeError(error),'error');
    notify('Día especial eliminado');refreshData();
  }

  function openScheduleDefModal(id=null){
    const allDefs=state.data.scheduleCatalogAll||state.data.scheduleCatalog;
    const h=id?allDefs.find(x=>x.id===id):null;
    openModal(`<h2>${h?'Editar':'Nuevo'} horario</h2><form id="scheduleDefForm"><div class="form-grid">
      <label>Código<input id="sdCode" required value="${esc(h?.codigo||'')}" placeholder="H25 / V / C"></label>
      <label>Tipo<select id="sdType"><option value="HORARIO" ${h?.tipo!=='NOVEDAD'?'selected':''}>HORARIO</option><option value="NOVEDAD" ${h?.tipo==='NOVEDAD'?'selected':''}>NOVEDAD</option></select></label>
      <label class="full">Descripción<input id="sdDescription" required value="${esc(h?.descripcion||'')}"></label>
      <label>Inicio<input id="sdStart" type="time" value="${esc(h?.inicio?.slice(0,5)||'')}"></label>
      <label>Fin<input id="sdEnd" type="time" value="${esc(h?.fin?.slice(0,5)||'')}"></label>
      <label>Horas nocturnidad<input id="sdNight" type="number" min="0" step="0.5" value="${esc(h?.horas_nocturnidad??0)}"></label>
      <label>Orden<input id="sdOrder" type="number" min="0" step="1" value="${esc(h?.orden??0)}"></label>
      <label>Estado<select id="sdStatus"><option value="ACTIVO" ${h?.estado!=='INACTIVO'?'selected':''}>ACTIVO</option><option value="INACTIVO" ${h?.estado==='INACTIVO'?'selected':''}>INACTIVO</option></select></label>
    </div><div class="form-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Guardar</button></div></form>`);
    $('#scheduleDefForm').onsubmit=async e=>{
      e.preventDefault();
      const type=$('#sdType').value;
      const payload={codigo:$('#sdCode').value.trim().toUpperCase(),tipo:type,descripcion:$('#sdDescription').value.trim(),inicio:type==='HORARIO'?($('#sdStart').value||null):null,fin:type==='HORARIO'?($('#sdEnd').value||null):null,horas_nocturnidad:Number($('#sdNight').value||0),orden:Number($('#sdOrder').value||0),estado:$('#sdStatus').value};
      const q=id?db.from('horarios_catalogo').update(payload).eq('id',id):db.from('horarios_catalogo').insert(payload);
      const {error}=await q;if(error)return notify(normalizeError(error),'error');
      closeModal();notify('Horario guardado');refreshData();
    };
  }

  async function deleteScheduleDef(id){
    const allDefs=state.data.scheduleCatalogAll||state.data.scheduleCatalog;const h=allDefs.find(x=>x.id===id);if(!confirm(`¿Eliminar ${h?.codigo||'este horario'}?`))return;
    const {error}=await db.from('horarios_catalogo').delete().eq('id',id);
    if(error){const {error:soft}=await db.from('horarios_catalogo').update({estado:'INACTIVO'}).eq('id',id);if(soft)return notify(normalizeError(soft),'error');notify('El horario está en uso: se marcó INACTIVO.');}
    else notify('Horario eliminado');
    refreshData();
  }

  // Expone únicamente lo necesario para callbacks internos del router existente.
  window.renderAdminSettings = renderAdminSettings;
  window.renderMyTechCatalog = renderMyTechCatalog;
})();
