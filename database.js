const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Create table for policies
        db.run(`
            CREATE TABLE IF NOT EXISTS polizas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nro_registro TEXT,
                asegurado TEXT,
                telefono TEXT,
                mail TEXT,
                compania TEXT,
                nro_poliza TEXT,
                patente TEXT,
                vto_cuota DATE,
                estado_pago TEXT DEFAULT 'Pendiente',
                forma_pago TEXT DEFAULT 'Efectivo con cupón',
                tipo_vehiculo TEXT DEFAULT 'Automotor',
                vto_poliza DATE
            )
        `);

        // Create table for message logs
        db.run(`
            CREATE TABLE IF NOT EXISTS message_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poliza_id INTEGER,
                telefono TEXT,
                mensaje TEXT,
                tipo_aviso TEXT,
                fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    });
}

module.exports = db;
