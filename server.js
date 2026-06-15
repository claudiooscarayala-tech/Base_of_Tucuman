require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./database');
const path = require('path');
const fs = require('fs');

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

// Endpoint to download the database backup
app.get('/api/download-backup', (req, res) => {
    const dataPath = process.env.DATA_PATH || __dirname;
    const dbFilePath = path.resolve(dataPath, 'database.sqlite');
    
    if (require('fs').existsSync(dbFilePath)) {
        res.download(dbFilePath, 'database_backup.sqlite');
    } else {
        res.status(404).json({ error: "Database file not found" });
    }
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

async function downloadDignaPDF(nro_poliza, tipo_vehiculo, nro_endoso = 0, documentTypes = ['CuponPagoCompleto']) {
    console.log(`Consultando Digna para Póliza ${nro_poliza}, Endoso ${nro_endoso}, Tipos: ${documentTypes.join(', ')}`);
    try {
        const xmlBody = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://DCX/Emision/">
  <soapenv:Header>
        <UserCredentials>
            <IdUsuario>DCX_WS</IdUsuario>
            <Password>DCX_WS123</Password>
        </UserCredentials>
  </soapenv:Header>
  <soapenv:Body>
    <ConsultaDocumentoPolizaWeb>
      <CodigoSeccion>6</CodigoSeccion>
      <NumeroPoliza>${nro_poliza}</NumeroPoliza>
      <NumeroEndoso>${nro_endoso}</NumeroEndoso>
    </ConsultaDocumentoPolizaWeb>
  </soapenv:Body>
</soapenv:Envelope>`;

        const response = await fetch('https://portalweb.digna.seg.ar/WS/emision.asmx?op=ConsultaDocumentoPolizaWeb', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://DCX/Emision/ConsultaDocumentoPolizaWeb'
            },
            body: xmlBody,
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            console.error(`Digna API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const responseText = await response.text();
        
        // Check if Resultado is OK
        if (!responseText.includes('<Resultado>OK</Resultado>')) {
            console.error('Digna API Error: Resultado no es OK para la póliza', nro_poliza);
            return null;
        }

        // Extract all <string> URLs
        const urlMatches = [...responseText.matchAll(/<string>(http[^<]+\.pdf)<\/string>/g)];
        if (urlMatches.length === 0) {
            console.error('No se encontraron URLs de PDFs en la respuesta de Digna');
            return null;
        }

        const pdfUrls = urlMatches.map(m => m[1]);
        const downloadedDocs = [];

        for (const docType of documentTypes) {
            let targetUrl = pdfUrls.find(url => url.includes(docType));
            
            // Fallback para CuponPagoCompleto si no existe (algunas veces se usa FrenteDePoliza)
            if (!targetUrl && docType === 'CuponPagoCompleto') {
                targetUrl = pdfUrls.find(url => url.includes('FrenteDePoliza')) || pdfUrls[0];
            }

            if (!targetUrl) continue;

            console.log(`Descargando PDF ${docType} desde URL: ${targetUrl}`);
            
            const pdfResponse = await fetch(targetUrl);
            if (!pdfResponse.ok) {
                console.error(`Error descargando el PDF de Digna desde URL: ${targetUrl}`);
                continue;
            }

            const pdfBuffer = await pdfResponse.arrayBuffer();
            const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

            if (base64Pdf) {
                const tempDir = path.join(__dirname, 'temp_pdfs');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
                
                const urlParts = targetUrl.split('/');
                const originalFileName = urlParts[urlParts.length - 1];
                const fileName = `Digna_${nro_poliza}_${nro_endoso || 0}_${originalFileName}`;
                
                const filePath = path.join(tempDir, fileName);
                fs.writeFileSync(filePath, Buffer.from(base64Pdf, 'base64'));
                
                downloadedDocs.push({ filePath, fileName, base64: base64Pdf });
            }
        }
        
        return downloadedDocs.length > 0 ? downloadedDocs : null;
    } catch (e) {
        console.error('Excepción al descargar de Digna:', e.message);
        return null;
    }
}

async function sendWhatsAppDocument(poliza, message, tipo, documentData) {
    console.log(`[WhatsApp Document -> ${poliza.telefono}] ${message}`);

    const whapiToken = process.env.WHAPI_TOKEN;
    if (whapiToken && poliza.telefono) {
        try {
            let cleanPhone = poliza.telefono.replace(/\D/g, '');
            
            const payload = {
                to: `${cleanPhone}@s.whatsapp.net`,
                caption: message,
                media: `data:application/pdf;base64,${documentData.base64}`,
                file_name: documentData.fileName
            };

            const res = await fetch('https://gate.whapi.cloud/messages/document', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${whapiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000)
            });
            await res.text();
            console.log(`Documento enviado exitosamente a Whapi API para ${cleanPhone}`);
        } catch (e) {
            console.error("Error enviando documento por Whapi:", e);
        }
    } else {
        console.log("Simulado: (WHAPI_TOKEN no configurado o teléfono faltante)");
    }

    return new Promise((resolve) => {
        db.run(
            `INSERT INTO message_logs (poliza_id, telefono, mensaje, tipo_aviso) VALUES (?, ?, ?, ?)`,
            [poliza.id, poliza.telefono, message, tipo + ' (con PDF)'],
            (err) => {
                if (err) console.error("Error logging message:", err);
                resolve();
            }
        );
    });
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

                    // Attempt to download PDFs if it's Digna and it's T-3
                    let pdfDatas = null;
                    /* SUSPENDIDO HASTA NUEVA ORDEN
                    if (row.compania && row.compania.toUpperCase().includes('DIGNA') && row.nro_poliza && row.vto_cuota === targetTminus3) {
                        pdfDatas = await downloadDignaPDF(row.nro_poliza, row.tipo_vehiculo, row.nro_endoso, ['FrenteDePoliza', 'Mercosur', 'CuponPagoCompleto']);
                    }
                    */

                    if (pdfDatas && pdfDatas.length > 0) {
                        // Enviar el primer PDF con el mensaje como caption
                        await sendWhatsAppDocument(row, message, tipo, pdfDatas[0]);
                        // Enviar el resto de PDFs sin mensaje
                        for (let i = 1; i < pdfDatas.length; i++) {
                            await sendWhatsAppDocument(row, "", tipo, pdfDatas[i]);
                        }
                    } else {
                        await sendWhatsAppMessage(row, message, tipo);
                    }
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
                            
                            let pdfDatas = null;
                            /* SUSPENDIDO HASTA NUEVA ORDEN
                            if (row.compania && row.compania.toUpperCase().includes('DIGNA') && row.nro_poliza) {
                                pdfDatas = await downloadDignaPDF(row.nro_poliza, row.tipo_vehiculo, row.nro_endoso, ['FrenteDePoliza', 'Mercosur', 'CuponPagoCompleto']);
                            }
                            */

                            if (pdfDatas && pdfDatas.length > 0) {
                                await sendWhatsAppDocument(row, msg, tipoMsg, pdfDatas[0]);
                                for (let i = 1; i < pdfDatas.length; i++) {
                                    await sendWhatsAppDocument(row, "", tipoMsg, pdfDatas[i]);
                                }
                            } else {
                                await sendWhatsAppMessage(row, msg, tipoMsg);
                            }
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
            `🤖 *Sofía AI - Reporte Matutino*\n\nBuen día Claudio! ☀️\nHe finalizado el barrido automático de notificaciones.\nSe enviaron exitosamente *${total}* recordatorios a tus clientes el día de hoy.`, 
            "Reporte Admin"
        );
    } catch(err) {
        console.error("Cron Error: ", err);
    }
}, {
    timezone: "America/Argentina/Buenos_Aires"
});


// ----------------------------------------------------
// AUTOMATIC DAILY BACKUP (23:00 HS)
// ----------------------------------------------------
async function performDailyBackup() {
    console.log("Running Daily Database Task (Backup or Sync)...");
    try {
        const dataPath = process.env.DATA_PATH || __dirname;

        // Formatear fecha para el nombre del backup
        const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        const cleanDate = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
        
        // Si existe REMOTE_URL, entonces es la versión local y debe descargarse la base de la web
        if (process.env.REMOTE_URL) {
            console.log(`Descargando base de datos remota desde ${process.env.REMOTE_URL}/api/download-backup ...`);
            const response = await fetch(`${process.env.REMOTE_URL}/api/download-backup`);
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                
                // 1. Sincronizar la versión local principal
                const syncPath = path.resolve(dataPath, 'database.sqlite');
                fs.writeFileSync(syncPath, Buffer.from(buffer));
                console.log("¡Base de datos local sincronizada exitosamente con la versión web!");
                
                // 2. Crear backup histórico local
                const backupsDir = path.resolve(dataPath, 'backups');
                if (!fs.existsSync(backupsDir)) {
                    fs.mkdirSync(backupsDir);
                }
                const backupFilename = `database_backup_${cleanDate}.sqlite`;
                const backupPath = path.resolve(backupsDir, backupFilename);
                fs.writeFileSync(backupPath, Buffer.from(buffer));
                console.log(`Backup local guardado en: ${backupPath}`);
                
                // 3. Limpiar backups antiguos (mantener solo los últimos 3)
                const files = fs.readdirSync(backupsDir)
                                .filter(f => f.startsWith('database_backup_') && f.endsWith('.sqlite'))
                                .map(f => ({ name: f, time: fs.statSync(path.resolve(backupsDir, f)).mtime.getTime() }))
                                .sort((a, b) => b.time - a.time); // Ordenar de más reciente a más antiguo
                                
                if (files.length > 3) {
                    const filesToDelete = files.slice(3);
                    filesToDelete.forEach(file => {
                        fs.unlinkSync(path.resolve(backupsDir, file.name));
                        console.log(`Backup antiguo eliminado: ${file.name}`);
                    });
                }
            } else {
                console.error("Error al descargar la base de datos remota. Status:", response.status);
            }
            return; // Termina aquí para que no siga con la lógica del servidor web
        }

        const sourceDb = path.resolve(dataPath, 'database.sqlite');
        
        if (!fs.existsSync(sourceDb)) {
            console.error("Backup Error: Source database not found at", sourceDb);
            return;
        }

        const backupFilename = `database_backup_${cleanDate}.sqlite`;
        const backupPath = path.resolve(dataPath, backupFilename);

        fs.copyFileSync(sourceDb, backupPath);
        console.log(`Backup successfully created at: ${backupPath}`);
        
        // Notify admin
        await sendWhatsAppMessage(
            { id: 0, telefono: "5493874655897" }, 
            `💾 *Copia de Seguridad Exitosa*\nSe creó el respaldo diario:\n${backupFilename}`, 
            "Reporte Admin"
        );

    } catch (e) {
        console.error("Backup Error:", e);
    }
}

// Backup crontab every day at 23:00 (Buenos Aires Time)
cron.schedule('0 23 * * *', async () => {
    await performDailyBackup();
}, {
    timezone: "America/Argentina/Buenos_Aires"
});


// ----------------------------------------------------
// MANUAL SEND ENDPOINTS
// ----------------------------------------------------

app.post('/api/polizas/:id/send-t3', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM polizas WHERE id = ?`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Póliza no encontrada" });
        if (!row.telefono) return res.status(400).json({ error: "No hay teléfono" });
        
        try {
            if (row.compania && row.compania.toUpperCase().includes('DIGNA') && row.nro_poliza) {
                const pdfDatas = await downloadDignaPDF(row.nro_poliza, row.tipo_vehiculo, row.nro_endoso, ['FrenteDePoliza', 'Mercosur', 'CuponPagoCompleto']);
                if (pdfDatas && pdfDatas.length > 0) {
                    for (const pdf of pdfDatas) {
                        await sendWhatsAppDocument(row, "", "Manual T-3", pdf);
                    }
                    return res.json({ success: true, message: "Documentos T-3 enviados." });
                }
            }
            res.status(400).json({ error: "No se pudieron obtener documentos de Digna o la compañía no es Digna." });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

app.post('/api/polizas/:id/send-cupon', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT * FROM polizas WHERE id = ?`, [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Póliza no encontrada" });
        if (!row.telefono) return res.status(400).json({ error: "No hay teléfono" });
        
        try {
            if (row.compania && row.compania.toUpperCase().includes('DIGNA') && row.nro_poliza) {
                const pdfDatas = await downloadDignaPDF(row.nro_poliza, row.tipo_vehiculo, row.nro_endoso, ['CuponPagoCompleto']);
                if (pdfDatas && pdfDatas.length > 0) {
                    await sendWhatsAppDocument(row, "", "Manual Cupón", pdfDatas[0]);
                    return res.json({ success: true, message: "Cupón enviado." });
                }
            }
            res.status(400).json({ error: "No se pudieron obtener documentos de Digna o la compañía no es Digna." });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Carga de Pólizas CRM is running on port ${PORT}`);
});
