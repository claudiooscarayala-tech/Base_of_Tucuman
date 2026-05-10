require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./database');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------
function getTodayBA() {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
}

function addDaysBA(dateStr, days) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Get all policies (with optional search)
app.get('/api/polizas', (req, res) => {
    const search = req.query.q || "";
    const dateFilter = req.query.vto || "";
    
    const todayStr = getTodayBA();
    const targetDate = addDaysBA(todayStr, -120);

    const sql = `
        SELECT * FROM polizas 
        WHERE (asegurado LIKE ? OR patente LIKE ? OR nro_poliza LIKE ?)
        AND (? = '' OR vto_cuota = ?)
        AND IFNULL(estado_pago, '') != 'Archivado'
        AND NOT (
            (IFNULL(vto_poliza, '') != '' AND vto_poliza < ?) 
            OR (IFNULL(vto_poliza, '') = '' AND IFNULL(vto_cuota, '') != '' AND vto_cuota < ?)
        )
        ORDER BY CASE WHEN vto_cuota IS NULL OR vto_cuota = '' THEN 1 ELSE 0 END, vto_cuota ASC
    `;
    const params = [`%${search}%`, `%${search}%`, `%${search}%`, dateFilter, dateFilter, targetDate, targetDate];

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

function sendVencidosResponse(req, res, minDays, maxDays) {
    const search = req.query.q || "";
    const dateFilter = req.query.vto || "";
    const todayStr = getTodayBA();
    
    // Calculate maxDate and minDate based on T - minDays and T - maxDays
    const maxDateStr = minDays !== null ? addDaysBA(todayStr, -minDays) : null;
    const minDateStr = maxDays !== null ? addDaysBA(todayStr, -maxDays) : null;
    
    const targetDate = addDaysBA(todayStr, -120);

    let dateCond = "";
    if (maxDateStr !== null && minDateStr !== null) {
        dateCond = `vto_cuota <= '${maxDateStr}' AND vto_cuota >= '${minDateStr}'`;
    } else if (maxDateStr !== null) {
        dateCond = `vto_cuota <= '${maxDateStr}'`;
    } else if (minDateStr !== null) {
        dateCond = `vto_cuota >= '${minDateStr}'`;
    }

    db.all(
        `SELECT * FROM polizas 
         WHERE IFNULL(vto_cuota, '') != '' AND ${dateCond}
         AND (asegurado LIKE ? OR patente LIKE ? OR nro_poliza LIKE ?)
         AND (? = '' OR vto_cuota = ?)
         AND IFNULL(estado_pago, '') != 'Archivado'
         AND NOT (
             (IFNULL(vto_poliza, '') != '' AND vto_poliza < ?) 
             OR (IFNULL(vto_poliza, '') = '' AND IFNULL(vto_cuota, '') != '' AND vto_cuota < ?)
         )
         ORDER BY vto_cuota DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, dateFilter, dateFilter, targetDate, targetDate],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
}

// Sandra: T to T-10
app.get('/api/sandra', (req, res) => sendVencidosResponse(req, res, 0, 10));

// Rocio: T-11 to T-23
app.get('/api/rocio', (req, res) => sendVencidosResponse(req, res, 11, 23));

// Agustin: T-24 to T-38
app.get('/api/agustin', (req, res) => sendVencidosResponse(req, res, 24, 38));

// Patricia: T-31 and beyond
app.get('/api/patricia', (req, res) => sendVencidosResponse(req, res, 31, null));

// Historico endpoint: policies where vto_poliza < today - 120 days (or vto_cuota if poliza is null)
app.get('/api/historico', (req, res) => {
    const search = req.query.q || "";
    const todayStr = getTodayBA();
    const targetDate = addDaysBA(todayStr, -120);

    db.all(
        `SELECT * FROM polizas 
         WHERE ((IFNULL(vto_poliza, '') != '' AND vto_poliza < ?) 
            OR (IFNULL(vto_poliza, '') = '' AND IFNULL(vto_cuota, '') != '' AND vto_cuota < ?)
            OR IFNULL(estado_pago, '') = 'Archivado')
           AND (asegurado LIKE ? OR patente LIKE ? OR nro_registro LIKE ?)
         ORDER BY vto_poliza DESC, vto_cuota DESC`,
        [targetDate, targetDate, `%${search}%`, `%${search}%`, `%${search}%`],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Update a policy (e.g. mark as Paid)
app.put('/api/polizas/:id', (req, res) => {
    const id = req.params.id;
    const { estado_pago, vto_cuota, telefono, mail, forma_pago, tipo_vehiculo, vto_poliza, compania, nro_poliza, patente, asegurado } = req.body;
    
    // basic dynamic update
    db.run(
        `UPDATE polizas SET estado_pago = ?, vto_cuota = ?, telefono = ?, mail = ?, forma_pago = ?, tipo_vehiculo = ?, vto_poliza = ?, compania = ?, nro_poliza = ?, patente = ?, asegurado = ? WHERE id = ?`,
        [estado_pago, vto_cuota, telefono, mail, forma_pago, tipo_vehiculo, vto_poliza, compania, nro_poliza, patente, asegurado, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// Add a new policy
app.post('/api/polizas', (req, res) => {
    const { nro_registro, asegurado, telefono, mail, compania, nro_poliza, patente, vto_cuota, forma_pago, tipo_vehiculo, vto_poliza } = req.body;
    db.run(
        `INSERT INTO polizas (nro_registro, asegurado, telefono, mail, compania, nro_poliza, patente, vto_cuota, estado_pago, forma_pago, tipo_vehiculo, vto_poliza)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?)`,
         [nro_registro, asegurado, telefono, mail, compania, nro_poliza, patente, vto_cuota, forma_pago || 'Efectivo con cupón', tipo_vehiculo || 'Automotor', vto_poliza],
         function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
         }
    );
});

// Get message logs
app.get('/api/logs', (req, res) => {
    const dateFilter = req.query.date || "";
    let dateCond = "";
    const params = [];
    
    if (dateFilter) {
        // Shift SQLite UTC time by -3 hours to match Argentina localized time for filtering
        dateCond = "WHERE date(datetime(l.fecha_envio, '-3 hours')) = ?";
        params.push(dateFilter);
    }
    
    db.all(`
        SELECT l.*, p.asegurado 
        FROM message_logs l
        LEFT JOIN polizas p ON l.poliza_id = p.id
        ${dateCond}
        ORDER BY l.fecha_envio DESC LIMIT 200
    `, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get message logs for a specific policy
app.get('/api/polizas/:id/logs', (req, res) => {
    const id = req.params.id;
    db.all(`
        SELECT * 
        FROM message_logs 
        WHERE poliza_id = ?
        ORDER BY fecha_envio DESC
    `, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Manual trigger for the notification engine (for testing)
app.post('/api/trigger-notifications', async (req, res) => {
    try {
        const total = await processDailyNotifications();
        // Notify admin remotely
        await sendWhatsAppMessage(
            { id: 0, telefono: "5493874655897" }, 
            `🤖 *Sofía AI - Notificación de Sistema*\n\n🟢 Ejecución *MANUAL* del motor finalizada.\nSe procesaron exitosamente *${total}* mensajes correspondientes a los vencimientos vigentes.`, 
            "Reporte Admin"
        );
        res.json({ message: 'Notifications processed successfully', total });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ----------------------------------------------------
// WORKFLOW AUTOMATION ENGINE
// ----------------------------------------------------

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
}

async function sendWhatsAppMessage(poliza, message, tipo) {
    console.log(`[WhatsApp -> ${poliza.telefono}] ${message}`);

    // If WHAPI_TOKEN is configured, send the real message
    const whapiToken = process.env.WHAPI_TOKEN;
    if (whapiToken && poliza.telefono) {
        try {
            // Clean phone number (remove +, spaces, dashes)
            let cleanPhone = poliza.telefono.replace(/\D/g, '');
            // Argentina quick fix: if it starts with 54 but lacks 9, some APIs require it, but Whapi usually handles raw numbers
            
            const res = await fetch('https://gate.whapi.cloud/messages/text', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${whapiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    typing_time: 0,
                    to: `${cleanPhone}@s.whatsapp.net`,
                    body: message
                }),
                signal: AbortSignal.timeout(8000)
            });
            await res.text(); // Free up the socket stream
            console.log(`Mensaje enviado exitosamente a Whapi API para ${cleanPhone}`);
        } catch (e) {
            console.error("Error enviando por Whapi:", e);
        }
    } else {
        console.log("Simulado: (WHAPI_TOKEN no configurado o teléfono faltante)");
    }

    // Insert into db log
    return new Promise((resolve) => {
        db.run(
            `INSERT INTO message_logs (poliza_id, telefono, mensaje, tipo_aviso) VALUES (?, ?, ?, ?)`,
            [poliza.id, poliza.telefono, message, tipo],
            (err) => {
                if (err) console.error("Error logging message:", err);
                resolve();
            }
        );
    });
}

async function processDailyNotifications() {
    console.log("Running Daily Notification Engine...");
    const today = getTodayBA(); // YYYY-MM-DD in BA timezone
    
    // T-3 (3 days before expiration)
    const targetTminus3 = addDaysBA(today, 3);
    
    // T (exact day)
    const targetT = today;

    // T+3 (3 days after expiration)
    const targetTplus3 = addDaysBA(today, -3);

    return new Promise((resolve, reject) => {
        // Query finding all Pendiente policies where vto_cuota matches T-3, T, or T+3 AND doesn't pay by credit card
        db.all(
            `SELECT * FROM polizas 
             WHERE estado_pago = 'Pendiente' 
             AND forma_pago != 'Tarjeta de Crédito'
             AND (tipo_vehiculo != 'Motovehiculo' OR tipo_vehiculo IS NULL)
             AND vto_cuota IN (?, ?, ?)`,
            [targetTminus3, targetT, targetTplus3],
            async (err, rows) => {
                if (err) return reject(err);

                console.log(`Found ${rows.length} notifications to process for Automotores (Cuotas).`);
                
                let totalEnviados = 0;

                for (const row of rows) {
                    if (!row.telefono) continue; // skip if no phone
                    totalEnviados++;

                    let message = "";
                    let tipo = "";

                    if (row.vto_cuota === targetTminus3) {
                        tipo = "Preventiva (T-3)";
                        message = `Hola ${row.asegurado}, te recordamos que la cuota de tu póliza de seguro de ${row.compania} (Patente: ${row.patente}) está próxima a vencer el ${row.vto_cuota}.`;
                    } else if (row.vto_cuota === targetT) {
                        tipo = "Vencimiento (T)";
                        message = `Hola ${row.asegurado}, te informamos que la cuota de tu póliza de seguro vence hoy.`;
                    } else if (row.vto_cuota === targetTplus3) {
                        tipo = "Riesgo (T+3)";
                        message = `Circula con cuidado, hace 3 días se venció la cuota de tu póliza de seguros (${row.compania} - Patente: ${row.patente}).`;
                    }

                    await sendWhatsAppMessage(row, message, tipo);
                }
                
                // --- SEGUNDA VERIFICACIÓN: MOTOVEHÍCULOS (RENOVACIÓN DE PÓLIZA) ---
                db.all(
                    `SELECT * FROM polizas 
                     WHERE tipo_vehiculo = 'Motovehiculo' 
                     AND vto_poliza = ?`,
                    [targetTminus3],
                    async (errMotos, rowsMotos) => {
                        if (errMotos) return reject(errMotos);
                        
                        console.log(`Found ${rowsMotos.length} renewal notifications for Motovehiculos.`);
                        
                        for (const row of rowsMotos) {
                            if (!row.telefono) continue;
                            totalEnviados++;
                            const tipoMsg = "Renovación Moto (T-3)";
                            const msg = `Hola ${row.asegurado}, te informamos que dentro de 3 días se vence tu póliza de seguro de moto (${row.compania} - Patente: ${row.patente || 'S/N'}). ¿Deseas renovarla?`;
                            await sendWhatsAppMessage(row, msg, tipoMsg);
                        }
                        
                        resolve(totalEnviados);
                    }
                );
            }
        );
    });
}

// Ensure crontab runs every morning at 09:00 AM (Buenos Aires Time)
cron.schedule('0 9 * * *', async () => {
    try {
        const total = await processDailyNotifications();
        await sendWhatsAppMessage(
            { id: 0, telefono: "5493874655897" }, 
            `🤖 *Sofía AI - Reporte Matutino*\n\nBuen día Claudio! ☀️\nHe finalizado el barrido automátic de notificaciones.\nSe enviaron exitosamente *${total}* recordatorios a tus clientes el día de hoy.`, 
            "Reporte Admin"
        );
    } catch(err) {
        console.error("Cron Error: ", err);
    }
}, {
    timezone: "America/Argentina/Buenos_Aires"
});


// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Carga de Pólizas CRM is running on http://localhost:${PORT}`);
});
