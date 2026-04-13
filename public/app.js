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
                    <strong>${p.asegurado}</strong><br>
                    <small style="color: var(--text-secondary)">Reg: ${p.nro_registro || '-'}</small>
                </td>
                <td><input type="text" value="${p.telefono || ''}" class="status-select" id="phone-${p.id}" style="width: 120px;" placeholder="Ej: 54938..." /></td>
                <td>${p.compania || '-'}</td>
                <td>${p.nro_poliza || '-'}</td>
                <td>${p.patente || '-'}</td>
                <td>
                    <select class="status-select" id="tipo-${p.id}" style="width: 110px;">
                        <option value="Automotor" ${p.tipo_vehiculo === 'Automotor' || !p.tipo_vehiculo ? 'selected' : ''}>Automotor</option>
                        <option value="Motovehiculo" ${p.tipo_vehiculo === 'Motovehiculo' ? 'selected' : ''}>Motovehiculo</option>
                    </select>
                </td>
                <td>
                    <input type="date" value="${dateStr}" class="status-select" id="date-${p.id}" />
                </td>
                <td>
                    <input type="date" value="${datePolStr}" class="status-select" id="vtopol-${p.id}" />
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
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="updatePoliza(${p.id})">
                        Guardar
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
        const response = await fetch(`${API_URL}/sandra`);
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
                <td>${phoneStr}</td>
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
                <td>
                    <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem; margin-bottom: 5px; width: 100%;" onclick="updateSandra(${p.id})">
                        Guardar
                    </button><br>
                    <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; background: #ef4444; border-color: #dc2626;" onclick="enviarHistorico(${p.id})">
                        A Histórico
                    </button>
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
                telefono: current ? current.telefono : '',
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

async function enviarHistorico(id) {
    if(!confirm('¿Estás seguro de enviar esta póliza al Histórico? Desaparecerá de tu lista activa.')) return;
    
    try {
        const policies = await (await fetch(`${API_URL}/polizas?q=`)).json();
        const current = policies.find(x => x.id === id);
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
                    <button class="btn btn-warning" style="padding: 6px 12px; font-size: 0.8rem;" onclick="activarHistorico(${p.id})">
                        Reactivar (Marcar Pagado)
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
    if(!confirm('¿Estás seguro de reactivar esta póliza? (Se marcará como Pagado y volverá a la lista activa)')) return;
    
    try {
        const resCurrent = await fetch(`${API_URL}/polizas?q=`);
        const policies = await resCurrent.json();
        const current = policies.find(x => x.id === id);
        if(!current) return;
        
        const res = await fetch(`${API_URL}/polizas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                estado_pago: 'Pagado', 
                vto_cuota: current.vto_cuota,
                vto_poliza: current.vto_poliza,
                forma_pago: current.forma_pago,
                tipo_vehiculo: current.tipo_vehiculo,
                telefono: current.telefono,
                mail: current.mail
            })
        });
        
        if(res.ok) {
            alert("Póliza reactivada con éxito.");
            fetchHistorico();
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
    
    // Historico Search logic
    const btnHistorico = document.getElementById('btnHistorico');
    const historicoInput = document.getElementById('historicoInput');

    btnHistorico.addEventListener('click', () => {
        fetchHistorico(historicoInput.value);
    });

    historicoInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') {
            fetchHistorico(historicoInput.value);
        }
    });

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

async function fetchLogs() {
    try {
        const response = await fetch(`${API_URL}/logs`);
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
                
                // Safe date
                let dStr = l.fecha_envio;
                try { dStr = new Date(l.fecha_envio).toLocaleString('es-AR'); } catch(ex){}
                                
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
