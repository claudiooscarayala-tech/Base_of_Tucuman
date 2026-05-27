const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSearch();
    initForm();
    initTriggerBtn();
    
    // Load initial data
    fetchPolizas();
    fetchLogs();
});

function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => {
                p.classList.remove('active');
                p.classList.add('hidden');
            });

            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const targetTab = document.getElementById(tabId);
            if(targetTab) {
                targetTab.classList.remove('hidden');
                targetTab.classList.add('active');
                
                // Refresh data if tabs are selected
                if(tabId === 'tab-search') fetchPolizas();
                if(tabId === 'tab-logs') fetchLogs();
                if(tabId === 'tab-sandra') fetchSandra();
                if(tabId === 'tab-rocio') fetchRocio();
                if(tabId === 'tab-agustin') fetchAgustin();
                if(tabId === 'tab-patricia') fetchPatricia();
                if(tabId === 'tab-historico') fetchHistorico();
            }
        });
    });
}

const btnTrigger = document.getElementById('btnRunJob');
function initTriggerBtn() {
    if(btnTrigger) {
        btnTrigger.addEventListener('click', async () => {
            btnTrigger.disabled = true;
            const originalHTML = btnTrigger.innerHTML;
            btnTrigger.innerHTML = '<span class="icon">⏳</span> Ejecutando...';
            try {
                const res = await fetch(`${API_URL}/trigger-notifications`, { method: 'POST' });
                if(res.ok) {
                    alert("¡Motor de notificaciones ejecutado! Se procesaron y enviaron los mensajes correspondientes.");
                    await fetchLogs(); // refresh logs
                    
                    // Switch to the logs tab automatically
                    const logsTabBtn = document.querySelector('.nav-btn[data-tab="tab-logs"]');
                    if (logsTabBtn) logsTabBtn.click();
                    
                } else {
                    alert("Error al ejecutar notificaciones.");
                }
            } catch (err) {
                console.error(err);
                alert("Error de red al ejecutar la tarea.");
            }
            btnTrigger.disabled = false;
            btnTrigger.innerHTML = originalHTML;
        });
    }
}

async function fetchPolizas(query = '', dateValue = '') {
    try {
        const response = await fetch(`${API_URL}/polizas?q=${encodeURIComponent(query)}&vto=${encodeURIComponent(dateValue)}`);
        const polizas = await response.json();
        
        document.getElementById('count-search').innerText = polizas.length;
        
        const tbody = document.querySelector('#tablePolizas tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No se encontraron resultados</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Format phone beautifully
            const phoneStr = p.telefono || '-';
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <input type="text" value="${p.asegurado || ''}" class="status-select" id="asegurado-${p.id}" style="width: 150px; font-weight: bold;" placeholder="Nombre Asegurado..." /><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td><input type="text" value="${p.compania || ''}" class="status-select" id="cia-${p.id}" style="width: 100px;" placeholder="Cía..." /></td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <input type="text" value="${p.nro_poliza || ''}" class="status-select" id="pol-${p.id}" style="width: 100px;" placeholder="Póliza..." />
                        <button class="btn-orange" onclick="sendManualT3(${p.id})" title="Enviar T-3 Manual (Frente, Mercosur, Cupón)"></button>
                    </div>
                </td>
                <td><input type="text" value="${p.patente || ''}" class="status-select" id="pat-${p.id}" style="width: 80px;" placeholder="Patente..." /></td>
                <td>
                    <select class="status-select" id="tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <input type="date" value="${dateStr}" class="status-select" id="date-${p.id}" />
                        <button class="btn-orange" onclick="sendManualCupon(${p.id})" title="Enviar Solo Cupón Manual"></button>
                    </div>
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="vtopol-${p.id}" />
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updatePoliza(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
                </td>
                <td>
                    <select class="status-select" id="fp-${p.id}">
                        <option value="Efectivo con cupón" ${p.forma_pago === 'Efectivo con cupón' ? 'selected' : ''}>Efectivo con cupón</option>
                        <option value="CBU" ${p.forma_pago === 'CBU' ? 'selected' : ''}>CBU</option>
                        <option value="Tarjeta de Crédito" ${p.forma_pago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta de Crédito</option>
                    </select>
                </td>
                <td>
                    <select class="status-select ${statusClass}" id="status-${p.id}">
                        <option value="Pendiente" ${p.estado_pago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Pagado" ${p.estado_pago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; border: 1px solid var(--border-color); color: var(--text-primary); background: transparent;" onclick="verMensajes(${p.id})">
                        💬 Mensajes
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading policies:", e);
    }
}



async function updatePoliza(id, prefix = '') {
    const selStatus = document.getElementById(`${prefix}status-${id}`).value;
    const selDate = document.getElementById(`${prefix}date-${id}`).value;
    const selVtoPol = document.getElementById(`${prefix}vtopol-${id}`).value;
    const selTipo = document.getElementById(`${prefix}tipo-${id}`).value;
    const selFp = document.getElementById(`${prefix}fp-${id}`).value;
    const phoneEl = document.getElementById(`${prefix}phone-${id}`);
    const ciaEl = document.getElementById(`${prefix}cia-${id}`);
    const polEl = document.getElementById(`${prefix}pol-${id}`);
    const patEl = document.getElementById(`${prefix}pat-${id}`);
    const asegEl = document.getElementById(`${prefix}asegurado-${id}`);
    
    try {
        // Fetch current policy to retain other fields safely
        const policies = await (await fetch(`${API_URL}/polizas?q=`)).json();
        const current = policies.find(x => x.id === id);
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: selStatus, 
                vto_cuota: selDate,
                vto_poliza: selVtoPol,
                forma_pago: selFp,
                tipo_vehiculo: selTipo,
                telefono: phoneEl ? phoneEl.value : (current ? current.telefono : ''),
                compania: ciaEl ? ciaEl.value : (current ? current.compania : ''),
                nro_poliza: polEl ? polEl.value : (current ? current.nro_poliza : ''),
                patente: patEl ? patEl.value : (current ? current.patente : ''),
                asegurado: asegEl ? asegEl.value : (current ? current.asegurado : ''),
                mail: current ? current.mail : ''
            })
        });
        
        if(res.ok) {
            const selectEl = document.getElementById(`${prefix}status-${id}`);
            selectEl.className = `status-select ${selStatus === 'Pagado' ? 'badge-success' : 'badge-warning'}`;
            alert("Póliza actualizada con éxito.");
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}

let currentSandraFilter = '';

window.setSandraFilter = function(filterVal) {
    currentSandraFilter = filterVal;
    
    // Update active UI classes
    document.getElementById('cardFpTodos').classList.remove('active-filter');
    document.getElementById('cardFpEfectivo').classList.remove('active-filter');
    document.getElementById('cardFpCBU').classList.remove('active-filter');
    document.getElementById('cardFpTarjeta').classList.remove('active-filter');
    
    if(filterVal === '') document.getElementById('cardFpTodos').classList.add('active-filter');
    if(filterVal === 'Efectivo con cupón') document.getElementById('cardFpEfectivo').classList.add('active-filter');
    if(filterVal === 'CBU') document.getElementById('cardFpCBU').classList.add('active-filter');
    if(filterVal === 'Tarjeta de Crédito') document.getElementById('cardFpTarjeta').classList.add('active-filter');
    
    fetchSandra();
}

async function fetchSandra() {
    try {
        const query = document.getElementById('sandraSearchInput') ? document.getElementById('sandraSearchInput').value : '';
        const dateFilter = document.getElementById('sandraSearchDateInput') ? document.getElementById('sandraSearchDateInput').value : '';

        const response = await fetch(`${API_URL}/sandra?q=${encodeURIComponent(query)}&vto=${encodeURIComponent(dateFilter)}`);
        let allPolizas = await response.json();
        
        // Calculate KPI counts
        const countTodos = allPolizas.length;
        const countEfectivo = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === 'Efectivo con cupón').length;
        const countCBU = allPolizas.filter(p => p.forma_pago === 'CBU').length;
        const countTarjeta = allPolizas.filter(p => p.forma_pago === 'Tarjeta de Crédito').length;
        
        // Update KPI Cards DOM
        document.getElementById('count-sandra-todos').innerText = countTodos;
        document.getElementById('count-sandra-efectivo').innerText = countEfectivo;
        document.getElementById('count-sandra-cbu').innerText = countCBU;
        document.getElementById('count-sandra-tarjeta').innerText = countTarjeta;
        
        let polizas = allPolizas;
        if (currentSandraFilter) {
            polizas = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === currentSandraFilter);
        }
        
        document.getElementById('count-sandra').innerText = polizas.length;
        
        const tbody = document.querySelector('#tableSandra tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay clientes con cuotas vencidas hoy.</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Format phone beautifully
            const phoneStr = p.telefono || '-';
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="sandra-phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td>${p.compania || '-'}</td>
                <td>${p.nro_poliza || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>
                    <select class="status-select" id="sandra-tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <input type="date" value="${dateStr}" class="status-select" id="sandra-date-${p.id}" />
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="sandra-vtopol-${p.id}" />
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updateSandra(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
                </td>
                <td>
                    <select class="status-select" id="sandra-fp-${p.id}">
                        <option value="Efectivo con cupón" ${p.forma_pago === 'Efectivo con cupón' || !p.forma_pago ? 'selected' : ''}>Efectivo con cupón</option>
                        <option value="CBU" ${p.forma_pago === 'CBU' ? 'selected' : ''}>CBU</option>
                        <option value="Tarjeta de Crédito" ${p.forma_pago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta</option>
                    </select>
                </td>
                <td>
                    <select class="status-select ${statusClass}" id="sandra-status-${p.id}">
                        <option value="Pendiente" ${p.estado_pago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Pagado" ${p.estado_pago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading Sandra's policies:", e);
    }
}

async function updateSandra(id) {
    const selStatus = document.getElementById(`sandra-status-${id}`).value;
    const selDate = document.getElementById(`sandra-date-${id}`).value;
    const selPolDate = document.getElementById(`sandra-vtopol-${id}`).value;
    const selTipo = document.getElementById(`sandra-tipo-${id}`).value;
    const selFp = document.getElementById(`sandra-fp-${id}`).value;
    const phoneEl = document.getElementById(`sandra-phone-${id}`);
    
    try {
        const resCurrent = await fetch(`${API_URL}/polizas?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: selStatus, 
                vto_cuota: selDate,
                vto_poliza: selPolDate,
                forma_pago: selFp,
                tipo_vehiculo: selTipo,
                telefono: phoneEl ? phoneEl.value : (current ? current.telefono : ''),
                compania: current ? current.compania : '',
                nro_poliza: current ? current.nro_poliza : '',
                patente: current ? current.patente : '',
                asegurado: current ? current.asegurado : '',
                mail: current ? current.mail : ''
            })
        });
        
        if(res.ok) {
            const selectEl = document.getElementById(`sandra-status-${id}`);
            selectEl.className = `status-select ${selStatus === 'Pagado' ? 'badge-success' : 'badge-warning'}`;
            alert("Póliza actualizada con éxito.");
            // optionally refresh the list to remove paid items
            if(selStatus === 'Pagado') {
                fetchSandra();
            }
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}
window.updateSandra = updateSandra;

let currentRocioFilter = '';

window.setRocioFilter = function(filterVal) {
    currentRocioFilter = filterVal;
    
    // Update active UI classes
    document.getElementById('cardFpTodos').classList.remove('active-filter');
    document.getElementById('cardFpEfectivo').classList.remove('active-filter');
    document.getElementById('cardFpCBU').classList.remove('active-filter');
    document.getElementById('cardFpTarjeta').classList.remove('active-filter');
    
    if(filterVal === '') document.getElementById('cardFpTodos').classList.add('active-filter');
    if(filterVal === 'Efectivo con cupón') document.getElementById('cardFpEfectivo').classList.add('active-filter');
    if(filterVal === 'CBU') document.getElementById('cardFpCBU').classList.add('active-filter');
    if(filterVal === 'Tarjeta de Crédito') document.getElementById('cardFpTarjeta').classList.add('active-filter');
    
    fetchRocio();
}

async function fetchRocio() {
    try {
        const query = document.getElementById('rocioSearchInput') ? document.getElementById('rocioSearchInput').value : '';
        const dateFilter = document.getElementById('rocioSearchDateInput') ? document.getElementById('rocioSearchDateInput').value : '';

        const response = await fetch(`${API_URL}/rocio?q=${encodeURIComponent(query)}&vto=${encodeURIComponent(dateFilter)}`);
        let allPolizas = await response.json();
        
        // Calculate KPI counts
        const countTodos = allPolizas.length;
        const countEfectivo = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === 'Efectivo con cupón').length;
        const countCBU = allPolizas.filter(p => p.forma_pago === 'CBU').length;
        const countTarjeta = allPolizas.filter(p => p.forma_pago === 'Tarjeta de Crédito').length;
        
        // Update KPI Cards DOM
        document.getElementById('count-rocio-todos').innerText = countTodos;
        document.getElementById('count-rocio-efectivo').innerText = countEfectivo;
        document.getElementById('count-rocio-cbu').innerText = countCBU;
        document.getElementById('count-rocio-tarjeta').innerText = countTarjeta;
        
        let polizas = allPolizas;
        if (currentRocioFilter) {
            polizas = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === currentRocioFilter);
        }
        
        document.getElementById('count-rocio').innerText = polizas.length;
        
        const tbody = document.querySelector('#tableRocio tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay clientes con cuotas vencidas hoy.</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Format phone beautifully
            const phoneStr = p.telefono || '-';
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="rocio-phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td>${p.compania || '-'}</td>
                <td>${p.nro_poliza || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>
                    <select class="status-select" id="rocio-tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <input type="date" value="${dateStr}" class="status-select" id="rocio-date-${p.id}" />
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="rocio-vtopol-${p.id}" />
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updateRocio(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
                </td>
                <td>
                    <select class="status-select" id="rocio-fp-${p.id}">
                        <option value="Efectivo con cupón" ${p.forma_pago === 'Efectivo con cupón' || !p.forma_pago ? 'selected' : ''}>Efectivo con cupón</option>
                        <option value="CBU" ${p.forma_pago === 'CBU' ? 'selected' : ''}>CBU</option>
                        <option value="Tarjeta de Crédito" ${p.forma_pago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta</option>
                    </select>
                </td>
                <td>
                    <select class="status-select ${statusClass}" id="rocio-status-${p.id}">
                        <option value="Pendiente" ${p.estado_pago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Pagado" ${p.estado_pago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading Rocio's policies:", e);
    }
}

async function updateRocio(id) {
    const selStatus = document.getElementById(`rocio-status-${id}`).value;
    const selDate = document.getElementById(`rocio-date-${id}`).value;
    const selPolDate = document.getElementById(`rocio-vtopol-${id}`).value;
    const selTipo = document.getElementById(`rocio-tipo-${id}`).value;
    const selFp = document.getElementById(`rocio-fp-${id}`).value;
    const phoneEl = document.getElementById(`rocio-phone-${id}`);
    
    try {
        const resCurrent = await fetch(`${API_URL}/polizas?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: selStatus, 
                vto_cuota: selDate,
                vto_poliza: selPolDate,
                forma_pago: selFp,
                tipo_vehiculo: selTipo,
                telefono: phoneEl ? phoneEl.value : (current ? current.telefono : ''),
                compania: current ? current.compania : '',
                nro_poliza: current ? current.nro_poliza : '',
                patente: current ? current.patente : '',
                asegurado: current ? current.asegurado : '',
                mail: current ? current.mail : ''
            })
        });
        
        if(res.ok) {
            const selectEl = document.getElementById(`rocio-status-${id}`);
            selectEl.className = `status-select ${selStatus === 'Pagado' ? 'badge-success' : 'badge-warning'}`;
            alert("Póliza actualizada con éxito.");
            // optionally refresh the list to remove paid items
            if(selStatus === 'Pagado') {
                fetchRocio();
            }
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}
window.updateRocio = updateRocio;

let currentAgustinFilter = '';

window.setAgustinFilter = function(filterVal) {
    currentAgustinFilter = filterVal;
    
    // Update active UI classes
    document.getElementById('cardFpTodos').classList.remove('active-filter');
    document.getElementById('cardFpEfectivo').classList.remove('active-filter');
    document.getElementById('cardFpCBU').classList.remove('active-filter');
    document.getElementById('cardFpTarjeta').classList.remove('active-filter');
    
    if(filterVal === '') document.getElementById('cardFpTodos').classList.add('active-filter');
    if(filterVal === 'Efectivo con cupón') document.getElementById('cardFpEfectivo').classList.add('active-filter');
    if(filterVal === 'CBU') document.getElementById('cardFpCBU').classList.add('active-filter');
    if(filterVal === 'Tarjeta de Crédito') document.getElementById('cardFpTarjeta').classList.add('active-filter');
    
    fetchAgustin();
}

async function fetchAgustin() {
    try {
        const query = document.getElementById('agustinSearchInput') ? document.getElementById('agustinSearchInput').value : '';
        const dateFilter = document.getElementById('agustinSearchDateInput') ? document.getElementById('agustinSearchDateInput').value : '';

        const response = await fetch(`${API_URL}/agustin?q=${encodeURIComponent(query)}&vto=${encodeURIComponent(dateFilter)}`);
        let allPolizas = await response.json();
        
        // Calculate KPI counts
        const countTodos = allPolizas.length;
        const countEfectivo = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === 'Efectivo con cupón').length;
        const countCBU = allPolizas.filter(p => p.forma_pago === 'CBU').length;
        const countTarjeta = allPolizas.filter(p => p.forma_pago === 'Tarjeta de Crédito').length;
        
        // Update KPI Cards DOM
        document.getElementById('count-agustin-todos').innerText = countTodos;
        document.getElementById('count-agustin-efectivo').innerText = countEfectivo;
        document.getElementById('count-agustin-cbu').innerText = countCBU;
        document.getElementById('count-agustin-tarjeta').innerText = countTarjeta;
        
        let polizas = allPolizas;
        if (currentAgustinFilter) {
            polizas = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === currentAgustinFilter);
        }
        
        document.getElementById('count-agustin').innerText = polizas.length;
        
        const tbody = document.querySelector('#tableAgustin tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay clientes con cuotas vencidas hoy.</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Format phone beautifully
            const phoneStr = p.telefono || '-';
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="agustin-phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td>${p.compania || '-'}</td>
                <td>${p.nro_poliza || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>
                    <select class="status-select" id="agustin-tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <input type="date" value="${dateStr}" class="status-select" id="agustin-date-${p.id}" />
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="agustin-vtopol-${p.id}" />
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updateAgustin(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
                </td>
                <td>
                    <select class="status-select" id="agustin-fp-${p.id}">
                        <option value="Efectivo con cupón" ${p.forma_pago === 'Efectivo con cupón' || !p.forma_pago ? 'selected' : ''}>Efectivo con cupón</option>
                        <option value="CBU" ${p.forma_pago === 'CBU' ? 'selected' : ''}>CBU</option>
                        <option value="Tarjeta de Crédito" ${p.forma_pago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta</option>
                    </select>
                </td>
                <td>
                    <select class="status-select ${statusClass}" id="agustin-status-${p.id}">
                        <option value="Pendiente" ${p.estado_pago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Pagado" ${p.estado_pago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading Agustin's policies:", e);
    }
}

async function updateAgustin(id) {
    const selStatus = document.getElementById(`agustin-status-${id}`).value;
    const selDate = document.getElementById(`agustin-date-${id}`).value;
    const selPolDate = document.getElementById(`agustin-vtopol-${id}`).value;
    const selTipo = document.getElementById(`agustin-tipo-${id}`).value;
    const selFp = document.getElementById(`agustin-fp-${id}`).value;
    const phoneEl = document.getElementById(`agustin-phone-${id}`);
    
    try {
        const resCurrent = await fetch(`${API_URL}/polizas?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: selStatus, 
                vto_cuota: selDate,
                vto_poliza: selPolDate,
                forma_pago: selFp,
                tipo_vehiculo: selTipo,
                telefono: phoneEl ? phoneEl.value : (current ? current.telefono : ''),
                compania: current ? current.compania : '',
                nro_poliza: current ? current.nro_poliza : '',
                patente: current ? current.patente : '',
                asegurado: current ? current.asegurado : '',
                mail: current ? current.mail : ''
            })
        });
        
        if(res.ok) {
            const selectEl = document.getElementById(`agustin-status-${id}`);
            selectEl.className = `status-select ${selStatus === 'Pagado' ? 'badge-success' : 'badge-warning'}`;
            alert("Póliza actualizada con éxito.");
            // optionally refresh the list to remove paid items
            if(selStatus === 'Pagado') {
                fetchAgustin();
            }
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}
window.updateAgustin = updateAgustin;

let currentPatriciaFilter = '';

window.setPatriciaFilter = function(filterVal) {
    currentPatriciaFilter = filterVal;
    
    // Update active UI classes
    document.getElementById('cardFpTodos').classList.remove('active-filter');
    document.getElementById('cardFpEfectivo').classList.remove('active-filter');
    document.getElementById('cardFpCBU').classList.remove('active-filter');
    document.getElementById('cardFpTarjeta').classList.remove('active-filter');
    
    if(filterVal === '') document.getElementById('cardFpTodos').classList.add('active-filter');
    if(filterVal === 'Efectivo con cupón') document.getElementById('cardFpEfectivo').classList.add('active-filter');
    if(filterVal === 'CBU') document.getElementById('cardFpCBU').classList.add('active-filter');
    if(filterVal === 'Tarjeta de Crédito') document.getElementById('cardFpTarjeta').classList.add('active-filter');
    
    fetchPatricia();
}

async function fetchPatricia() {
    try {
        const query = document.getElementById('patriciaSearchInput') ? document.getElementById('patriciaSearchInput').value : '';
        const dateFilter = document.getElementById('patriciaSearchDateInput') ? document.getElementById('patriciaSearchDateInput').value : '';

        const response = await fetch(`${API_URL}/patricia?q=${encodeURIComponent(query)}&vto=${encodeURIComponent(dateFilter)}`);
        let allPolizas = await response.json();
        
        // Calculate KPI counts
        const countTodos = allPolizas.length;
        const countEfectivo = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === 'Efectivo con cupón').length;
        const countCBU = allPolizas.filter(p => p.forma_pago === 'CBU').length;
        const countTarjeta = allPolizas.filter(p => p.forma_pago === 'Tarjeta de Crédito').length;
        
        // Update KPI Cards DOM
        document.getElementById('count-patricia-todos').innerText = countTodos;
        document.getElementById('count-patricia-efectivo').innerText = countEfectivo;
        document.getElementById('count-patricia-cbu').innerText = countCBU;
        document.getElementById('count-patricia-tarjeta').innerText = countTarjeta;
        
        let polizas = allPolizas;
        if (currentPatriciaFilter) {
            polizas = allPolizas.filter(p => (p.forma_pago || 'Efectivo con cupón') === currentPatriciaFilter);
        }
        
        document.getElementById('count-patricia').innerText = polizas.length;
        
        const tbody = document.querySelector('#tablePatricia tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay clientes con cuotas vencidas hoy.</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Format phone beautifully
            const phoneStr = p.telefono || '-';
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="patricia-phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td>${p.compania || '-'}</td>
                <td>${p.nro_poliza || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>
                    <select class="status-select" id="patricia-tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <input type="date" value="${dateStr}" class="status-select" id="patricia-date-${p.id}" />
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="patricia-vtopol-${p.id}" />
                </td>
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updatePatricia(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
                </td>
                <td>
                    <select class="status-select" id="patricia-fp-${p.id}">
                        <option value="Efectivo con cupón" ${p.forma_pago === 'Efectivo con cupón' || !p.forma_pago ? 'selected' : ''}>Efectivo con cupón</option>
                        <option value="CBU" ${p.forma_pago === 'CBU' ? 'selected' : ''}>CBU</option>
                        <option value="Tarjeta de Crédito" ${p.forma_pago === 'Tarjeta de Crédito' ? 'selected' : ''}>Tarjeta</option>
                    </select>
                </td>
                <td>
                    <select class="status-select ${statusClass}" id="patricia-status-${p.id}">
                        <option value="Pendiente" ${p.estado_pago === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="Pagado" ${p.estado_pago === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading Patricia's policies:", e);
    }
}

async function updatePatricia(id) {
    const selStatus = document.getElementById(`patricia-status-${id}`).value;
    const selDate = document.getElementById(`patricia-date-${id}`).value;
    const selPolDate = document.getElementById(`patricia-vtopol-${id}`).value;
    const selTipo = document.getElementById(`patricia-tipo-${id}`).value;
    const selFp = document.getElementById(`patricia-fp-${id}`).value;
    const phoneEl = document.getElementById(`patricia-phone-${id}`);
    
    try {
        const resCurrent = await fetch(`${API_URL}/polizas?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: selStatus, 
                vto_cuota: selDate,
                vto_poliza: selPolDate,
                forma_pago: selFp,
                tipo_vehiculo: selTipo,
                telefono: phoneEl ? phoneEl.value : (current ? current.telefono : ''),
                compania: current ? current.compania : '',
                nro_poliza: current ? current.nro_poliza : '',
                patente: current ? current.patente : '',
                asegurado: current ? current.asegurado : '',
                mail: current ? current.mail : ''
            })
        });
        
        if(res.ok) {
            const selectEl = document.getElementById(`patricia-status-${id}`);
            selectEl.className = `status-select ${selStatus === 'Pagado' ? 'badge-success' : 'badge-warning'}`;
            alert("Póliza actualizada con éxito.");
            // optionally refresh the list to remove paid items
            if(selStatus === 'Pagado') {
                fetchPatricia();
            }
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}
window.updatePatricia = updatePatricia;

async function enviarHistorico(id) {
    if(!confirm('¿Estás seguro de enviar esta póliza al Histórico? Desaparecerá de tu lista activa.')) return;
    
    try {
        const policies = await (await fetch(`${API_URL}/polizas?q=`)).json();
        let current = policies.find(x => x.id === id);
        
        // If not found in active (e.g. older than 120 days but showing in some panels), check historico
        if(!current) {
            const histPolicies = await (await fetch(`${API_URL}/historico?q=`)).json();
            current = histPolicies.find(x => x.id === id);
        }
        if(!current) return;
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: 'Archivado', 
                vto_cuota: current.vto_cuota,
                vto_poliza: current.vto_poliza,
                forma_pago: current.forma_pago,
                tipo_vehiculo: current.tipo_vehiculo,
                telefono: current.telefono,
                compania: current.compania,
                nro_poliza: current.nro_poliza,
                patente: current.patente,
                asegurado: current.asegurado,
                mail: current.mail
            })
        });
        
        if(res.ok) {
            fetchSandra();
            fetchHistorico();
            fetchPolizas();
        }
    } catch (e) {
        console.error("Error archiving policy", e);
    }
}
window.enviarHistorico = enviarHistorico;

async function fetchHistorico(query = '') {
    try {
        const response = await fetch(`${API_URL}/historico?q=${encodeURIComponent(query)}`);
        const polizas = await response.json();
        
        document.getElementById('count-historico').innerText = polizas.length;
        
        const tbody = document.querySelector('#tableHistorico tbody');
        tbody.innerHTML = '';

        if(polizas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No hay registros históricos.</td></tr>';
            return;
        }

        polizas.forEach(p => {
            const tr = document.createElement('tr');
            
            // Date formatting
            const dateStr = p.vto_cuota ? p.vto_cuota : '-';
            const datePolStr = p.vto_poliza ? p.vto_poliza : '-';
            
            // Status badge logic
            const statusClass = p.estado_pago === 'Pagado' ? 'badge-success' : 'badge-warning';

            tr.innerHTML = `
                <td>
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td>${p.compania || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>${p.tipo_vehiculo || 'Automotor'}</td>
                <td>${dateStr}</td>
                <td>${datePolStr}</td>
                <td>
                    <span class="badge ${statusClass}">${p.estado_pago}</span>
                </td>
                <td>
                    <button class="btn btn-warning" style="padding: 6px 12px; font-size: 0.8rem; background-color: #f8fafc; color: #1e293b; border: 1px solid #cbd5e1;" onclick="activarHistorico(${p.id})">
                        Reactivar (Actualizar Fecha)
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error loading historico policies:", e);
    }
}

async function activarHistorico(id) {
    if(!confirm('¿Estás seguro de reactivar esta póliza? (Deberás ingresar la nueva fecha de vencimiento y volverá a la lista activa como Pendiente)')) return;
    
    try {
        const resCurrent = await fetch(`${API_URL}/historico?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        if(!current) return;
        
        // Calculate today's date in YYYY-MM-DD
        const today = new Date().toLocaleString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).split(',')[0];
        
        let newVtoCuota = current.vto_cuota;
        const promptCuota = prompt("Ingrese la NUEVA fecha de vencimiento de la cuota (AAAA-MM-DD):", current.vto_cuota || today);
        if (promptCuota === null) return; // User cancelled
        newVtoCuota = promptCuota;

        let newVtoPoliza = current.vto_poliza;
        if (current.vto_poliza) {
            const promptPoliza = prompt("Ingrese la NUEVA fecha de vencimiento de la póliza (AAAA-MM-DD):", current.vto_poliza);
            if (promptPoliza !== null) newVtoPoliza = promptPoliza;
        }

        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: 'Pendiente', 
                vto_cuota: newVtoCuota,
                vto_poliza: newVtoPoliza,
                forma_pago: current.forma_pago,
                tipo_vehiculo: current.tipo_vehiculo,
                telefono: current.telefono,
                compania: current.compania,
                nro_poliza: current.nro_poliza,
                patente: current.patente,
                mail: current.mail
            })
        });
        
        if(res.ok) {
            alert("Póliza reactivada con éxito. Ya figura en tus listas activas.");
            fetchHistorico();
            if (typeof fetchPolizas === 'function') fetchPolizas();
        }
    } catch (e) {
        console.error("Error updating", e);
    }
}
window.activarHistorico = activarHistorico;

window.updatePoliza = updatePoliza;

function initSearch() {
    const btnSearch = document.getElementById('btnSearch');
    const searchInput = document.getElementById('searchInput');
    const searchDateInput = document.getElementById('searchDateInput');

    btnSearch.addEventListener('click', () => {
        fetchPolizas(searchInput.value, searchDateInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            fetchPolizas(searchInput.value, searchDateInput.value);
        }
    });

    searchDateInput.addEventListener('change', () => {
        fetchPolizas(searchInput.value, searchDateInput.value);
    });
    
    // Sandra Search logic
    const btnSandraSearch = document.getElementById('btnSandraSearch');
    const sandraSearchInput = document.getElementById('sandraSearchInput');
    const sandraSearchDateInput = document.getElementById('sandraSearchDateInput');

    if (btnSandraSearch) {
        btnSandraSearch.addEventListener('click', () => { fetchSandra(); });
        sandraSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchSandra(); });
        sandraSearchDateInput.addEventListener('change', () => { fetchSandra(); });
    }

    // Rocio Search logic
    const btnRocioSearch = document.getElementById('btnRocioSearch');
    const rocioSearchInput = document.getElementById('rocioSearchInput');
    const rocioSearchDateInput = document.getElementById('rocioSearchDateInput');

    if (btnRocioSearch) {
        btnRocioSearch.addEventListener('click', () => { fetchRocio(); });
        rocioSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchRocio(); });
        rocioSearchDateInput.addEventListener('change', () => { fetchRocio(); });
    }

    // Agustin Search logic
    const btnAgustinSearch = document.getElementById('btnAgustinSearch');
    const agustinSearchInput = document.getElementById('agustinSearchInput');
    const agustinSearchDateInput = document.getElementById('agustinSearchDateInput');

    if (btnAgustinSearch) {
        btnAgustinSearch.addEventListener('click', () => { fetchAgustin(); });
        agustinSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchAgustin(); });
        agustinSearchDateInput.addEventListener('change', () => { fetchAgustin(); });
    }

    // Patricia Search logic
    const btnPatriciaSearch = document.getElementById('btnPatriciaSearch');
    const patriciaSearchInput = document.getElementById('patriciaSearchInput');
    const patriciaSearchDateInput = document.getElementById('patriciaSearchDateInput');

    if (btnPatriciaSearch) {
        btnPatriciaSearch.addEventListener('click', () => { fetchPatricia(); });
        patriciaSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') fetchPatricia(); });
        patriciaSearchDateInput.addEventListener('change', () => { fetchPatricia(); });
    }
    
    // Historico Search logic
    const btnHistorico = document.getElementById('btnHistorico');
    const historicoInput = document.getElementById('historicoInput');

    if (btnHistorico) {
        btnHistorico.addEventListener('click', () => {
            fetchHistorico(historicoInput.value);
        });

        historicoInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                fetchHistorico(historicoInput.value);
            }
        });
    }

    // Logs Search logic
    const btnLogsSearch = document.getElementById('btnLogsSearch');
    const logsDateInput = document.getElementById('logsDateInput');
    
    if (btnLogsSearch && logsDateInput) {
        btnLogsSearch.addEventListener('click', () => {
            fetchLogs(logsDateInput.value);
        });
        logsDateInput.addEventListener('change', () => {
            fetchLogs(logsDateInput.value);
        });
    }

    fetchPolizas();
    fetchHistorico();
}

function initForm() {
    const form = document.getElementById('formNuevaPoliza');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            nro_registro: document.getElementById('f_nro_registro').value,
            asegurado: document.getElementById('f_asegurado').value,
            telefono: document.getElementById('f_telefono').value,
            mail: document.getElementById('f_mail').value,
            compania: document.getElementById('f_compania').value,
            nro_poliza: document.getElementById('f_nro_poliza').value,
            patente: document.getElementById('f_patente').value,
            vto_cuota: document.getElementById('f_vto_cuota').value,
            vto_poliza: document.getElementById('f_vto_poliza').value,
            forma_pago: document.getElementById('f_forma_pago').value,
            tipo_vehiculo: document.getElementById('f_tipo_vehiculo').value
        };

        try {
            const res = await fetch(`${API_URL}/polizas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if(res.ok) {
                alert("Póliza cargada exitosamente.");
                form.reset();
            } else {
                alert("Hubo un error al guardar.");
            }
        } catch (e) {
            console.error("Error storing policy", e);
        }
    });
}

async function fetchLogs(dateValue = '') {
    try {
        const response = await fetch(`${API_URL}/logs?date=${encodeURIComponent(dateValue)}`);
        const logs = await response.json();
        
        const tbody = document.querySelector('#tableLogs tbody');
        tbody.innerHTML = '';

        if(!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay notificaciones enviadas aún.</td></tr>';
            return;
        }

        logs.forEach(l => {
            try {
                const tr = document.createElement('tr');
                
                const tipoStr = l.tipo_aviso || 'Vencimiento';
                const badgeType = tipoStr.includes('T-3') ? 'badge-info' 
                                : tipoStr.includes('T+3') ? 'badge-warning' 
                                : 'badge-warning'; // Fallback
                
                // Safe date formatted to Argentina Time
                let dStr = l.fecha_envio;
                try { 
                    const isoStr = l.fecha_envio.replace(' ', 'T') + 'Z';
                    dStr = new Date(isoStr).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false }); 
                } catch(ex){}
                                
                tr.innerHTML = `
                    <td style="white-space: nowrap">${dStr}</td>
                    <td><strong>${l.asegurado || 'Desconocido'}</strong></td>
                    <td><span class="badge ${badgeType}">${tipoStr}</span></td>
                    <td>${l.telefono || '-'}</td>
                    <td><small>${l.mensaje || '-'}</small></td>
                `;
                tbody.appendChild(tr);
            } catch(innerE) {
                console.error('Row render error', innerE);
            }
        });
    } catch (e) {
        console.error("Error loading logs:", e);
        const tbody = document.querySelector('#tableLogs tbody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error cargando logs: ${e.message}</td></tr>`;
    }
}

async function verMensajes(id) {
    document.getElementById('mensajesModalContent').innerHTML = '<p style="text-align: center;">Cargando mensajes...</p>';
    document.getElementById('mensajesModal').style.display = 'block';

    try {
        const response = await fetch(`${API_URL}/polizas/${id}/logs`);
        const logs = await response.json();

        if (!logs || logs.length === 0) {
            document.getElementById('mensajesModalContent').innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No hay mensajes enviados a este cliente aún.</p>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
        logs.forEach(l => {
            const badgeType = l.tipo_aviso.includes('T-3') ? 'badge-info' 
                            : l.tipo_aviso.includes('T+3') ? 'badge-warning' 
                            : 'badge-warning';

            let dStr = l.fecha_envio;
            try { 
                const isoStr = l.fecha_envio.replace(' ', 'T') + 'Z';
                dStr = new Date(isoStr).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false }); 
            } catch(ex){}

            html += `
                <div style="background: var(--surface-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong><span class="badge ${badgeType}">${l.tipo_aviso}</span></strong>
                        <small style="color: var(--text-secondary);">${dStr}</small>
                    </div>
                    <div><span style="font-size: 0.9rem;">${l.mensaje}</span></div>
                    ${l.telefono ? `<div style="margin-top: 5px;"><small style="color: var(--text-secondary);">Enviado a: ${l.telefono}</small></div>` : ''}
                </div>
            `;
        });
        html += '</div>';

        document.getElementById('mensajesModalContent').innerHTML = html;
    } catch (e) {
        console.error("Error loading specific logs:", e);
        document.getElementById('mensajesModalContent').innerHTML = `<p style="color:red; text-align:center;">Error cargando mensajes: ${e.message}</p>`;
    }
}
window.verMensajes = verMensajes;

async function sendManualT3(id) {
    if (!confirm("¿Enviar los 3 documentos de T-3 a este cliente ahora?")) return;
    
    try {
        const res = await fetch(`${API_URL}/polizas/${id}/send-t3`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert("¡Documentos T-3 enviados exitosamente!");
        } else {
            alert("Error: " + (data.error || "No se pudo enviar."));
        }
    } catch (e) {
        console.error(e);
        alert("Error de red al intentar enviar.");
    }
}
window.sendManualT3 = sendManualT3;

async function sendManualCupon(id) {
    if (!confirm("¿Enviar el Cupón de Pago a este cliente ahora?")) return;
    
    try {
        const res = await fetch(`${API_URL}/polizas/${id}/send-cupon`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert("¡Cupón enviado exitosamente!");
        } else {
            alert("Error: " + (data.error || "No se pudo enviar."));
        }
    } catch (e) {
        console.error(e);
        alert("Error de red al intentar enviar.");
    }
}
window.sendManualCupon = sendManualCupon;
