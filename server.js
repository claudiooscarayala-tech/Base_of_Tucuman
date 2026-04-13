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
// API ROUTES
// ----------------------------------------------------

// Get all policies (with optional search)
app.get('/api/polizas', (req, res) => {
    const search = req.query.q || "";
    const dateFilter = req.query.vto || "";
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr + "T12:00:00");
    todayDate.setDate(todayDate.getDate() - 120);
    const targetDate = todayDate.toISOString().split('T')[0];

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

// Sandra's endpoint: all policies with vto_cuota <= today (excluding historical ones)
app.get('/api/sandra', (req, res) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDateObj = new Date(todayStr + "T12:00:00");
    targetDateObj.setDate(targetDateObj.getDate() - 120);
    const targetDate = targetDateObj.toISOString().split('T')[0];

    db.all(
        `SELECT * FROM polizas 
         WHERE IFNULL(vto_cuota, '') != '' AND vto_cuota <= ?
         AND IFNULL(estado_pago, '') != 'Archivado'
         AND NOT (
             (IFNULL(vto_poliza, '') != '' AND vto_poliza < ?) 
             OR (IFNULL(vto_poliza, '') = '' AND IFNULL(vto_cuota, '') != '' AND vto_cuota < ?)
         )
         ORDER BY vto_cuota DESC`,
        [todayStr, targetDate, targetDate],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Historico endpoint: policies where vto_poliza < today - 120 days (or vto_cuota if poliza is null)
app.get('/api/historico', (req, res) => {
    const search = req.query.q || "";
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr + "T12:00:00");
    todayDate.setDate(todayDate.getDate() - 120);
    const targetDate = todayDate.toISOString().split('T')[0];

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
    const { estado_pago, vto_cuota, telefono, mail, forma_pago, tipo_vehiculo, vto_poliza } = req.body;
    
    // basic dynamic update
    db.run(
        `UPDATE polizas SET estado_pago = ?, vto_cuota = ?, telefono = ?, mail = ?, forma_pago = ?, tipo_vehiculo = ?, vto_poliza = ? WHERE id = ?`,
        [estado_pago, vto_cuota, telefono, mail, forma_pago, tipo_vehiculo, vto_poliza, id],
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
    db.all(`
        SELECT l.*, p.asegurado 
        FROM message_logs l
        LEFT JOIN polizas p ON l.poliza_id = p.id
        ORDER BY l.fecha_envio DESC LIMIT 200
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Manual trigger for the notification engine (for testing)
app.post('/api/trigger-notifications', async (req, res) => {
    try {
        await processDailyNotifications();
        res.json({ message: 'Notifications processed successfully' });
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
            
            await fetch('https://gate.whapi.cloud/messages/text', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${whapiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    typing_time: 0,
                    to: `${cleanPhone}@s.whatsapp.net`,
                    body: message
                })
            });
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
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // T-3 (3 days before expiration)
    const targetTminus3 = addDays(today, 3);
    
    // T (exact day)
    const targetT = today;

    // T+3 (3 days after expiration)
    const targetTplus3 = addDays(today, -3);

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

                for (const row of rows) {
                    if (!row.telefono) continue; // skip if no phone

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
                            const tipoMsg = "Renovación Moto (T-3)";
                            const msg = `Hola ${row.asegurado}, te informamos que dentro de 3 días se vence tu póliza de seguro de moto (${row.compania} - Patente: ${row.patente || 'S/N'}). ¿Deseas renovarla?`;
                            await sendWhatsAppMessage(row, msg, tipoMsg);
                        }
                        
                        resolve();
                    }
                );
            }
        );
    });
}

// Ensure crontab runs every morning at 09:00 AM (DISABLED PER USER REQUEST)
// cron.schedule('0 9 * * *', () => {
//     processDailyNotifications();
// });


// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Carga de Pólizas CRM is running on http://localhost:${PORT}`);
});
