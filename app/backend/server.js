const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const multer = require("multer");
const xlsx = require("xlsx");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const fs = require("fs");
const dbPath = process.env.DB_PATH || "database.sqlite";

if (process.env.DB_PATH && !fs.existsSync(dbPath)) {
  if (fs.existsSync(path.join(__dirname, "database.sqlite"))) {
    fs.copyFileSync(path.join(__dirname, "database.sqlite"), dbPath);
    console.log("Base de datos copiada al volumen persistente.");
  }
}

const db = new Database(dbPath);

// --- Endpoints ---

// 1. Get all producers
app.get("/api/producers", (req, res) => {
  const producers = db.prepare("SELECT * FROM producers ORDER BY name").all();
  res.json(producers);
});

// 2. Get all companies
app.get("/api/companies", (req, res) => {
  const companies = db.prepare("SELECT * FROM companies ORDER BY name").all();
  res.json(companies);
});

app.get("/api/producers", (req, res) => {
  const producers = db.prepare("SELECT * FROM producers ORDER BY name").all();
  res.json(producers);
});

// 3. Save collections for a specific month and company
app.post("/api/collections", (req, res) => {
  const { month, year, company_id, collections } = req.body;
  // collections is an array of { producer_id, amount }
  
  if (!month || !year || !company_id || !collections) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const insertStmt = db.prepare(
    "INSERT INTO collections (producer_id, company_id, month, year, amount) VALUES (?, ?, ?, ?, ?)"
  );
  const checkStmt = db.prepare(
    "SELECT id FROM collections WHERE producer_id = ? AND company_id = ? AND month = ? AND year = ?"
  );
  const updateStmt = db.prepare(
    "UPDATE collections SET amount = ? WHERE id = ?"
  );

  try {
    db.transaction(() => {
      for (const col of collections) {
        // Check if exists to update, or insert
        const existing = checkStmt.get(col.producer_id, company_id, month, year);
        if (existing) {
          if (col.amount === 0) {
             db.prepare("DELETE FROM collections WHERE id = ?").run(existing.id);
          } else {
             updateStmt.run(col.amount, existing.id);
          }
        } else {
          if (col.amount > 0) {
            insertStmt.run(col.producer_id, company_id, month, year, col.amount);
          }
        }
      }
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get collections for data entry (to prepopulate the form if editing)
app.get("/api/collections", (req, res) => {
  const { month, year, company_id } = req.query;
  const data = db.prepare(
    "SELECT producer_id, amount FROM collections WHERE month = ? AND year = ? AND company_id = ?"
  ).all(month, year, company_id);
  res.json(data);
});

// 5. Get reports data
app.get("/api/reports", (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  const total = db.prepare("SELECT SUM(amount) as total FROM collections WHERE year = ?").get(year).total || 0;

  const byMonth = db.prepare(`
    SELECT month, SUM(amount) as total 
    FROM collections 
    WHERE year = ? 
    GROUP BY month
  `).all(year);

  const byCompany = db.prepare(`
    SELECT c.name, SUM(amount) as total 
    FROM collections col
    JOIN companies c ON col.company_id = c.id
    WHERE year = ?
    GROUP BY c.id
    ORDER BY total DESC
  `).all(year);

  const byProducer = db.prepare(`
    SELECT p.id, p.name, SUM(amount) as total 
    FROM collections col
    JOIN producers p ON col.producer_id = p.id
    WHERE year = ?
    GROUP BY p.id
    ORDER BY total DESC
    LIMIT 20
  `).all(year);

  res.json({
    total,
    byMonth,
    byCompany,
    byProducer
  });
});

// 6. Get reports by company (year to date, up to previous month)
app.get("/api/reports/company/:id", (req, res) => {
  const companyId = req.params.id;
  const year = req.query.year || new Date().getFullYear();
  
  const currentMonthIndex = new Date().getMonth();
  const maxMonth = currentMonthIndex === 0 ? 1 : currentMonthIndex;
  const validMonths = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ].slice(0, maxMonth);

  const placeholders = validMonths.map(() => "?").join(",");

  const total = db.prepare(`
    SELECT SUM(amount) as total FROM collections 
    WHERE company_id = ? AND year = ? AND month IN (${placeholders})
  `).get(companyId, year, ...validMonths).total || 0;

  const byProducer = db.prepare(`
    SELECT p.id, p.name, SUM(amount) as total 
    FROM collections col
    JOIN producers p ON col.producer_id = p.id
    WHERE col.company_id = ? AND col.year = ? AND col.month IN (${placeholders})
    GROUP BY p.id
    ORDER BY total DESC
  `).all(companyId, year, ...validMonths);

  const byMonth = db.prepare(`
    SELECT month, SUM(amount) as total 
    FROM collections 
    WHERE company_id = ? AND year = ? AND month IN (${placeholders})
    GROUP BY month
  `).all(companyId, year, ...validMonths);

  res.json({
    total,
    byProducer,
    byMonth,
    period: validMonths
  });
});

// 7. Get reports for a specific producer
app.get("/api/reports/producer/:id", (req, res) => {
  const producerId = req.params.id;
  const year = req.query.year || new Date().getFullYear();
  const companyId = req.query.companyId;

  const producer = db.prepare("SELECT name FROM producers WHERE id = ?").get(producerId);
  if (!producer) return res.status(404).json({ error: "Producer not found" });

  let total, byMonth, byCompany;
  let companyName = null;

  if (companyId) {
    const comp = db.prepare("SELECT name FROM companies WHERE id = ?").get(companyId);
    if (comp) companyName = comp.name;

    total = db.prepare("SELECT SUM(amount) as total FROM collections WHERE producer_id = ? AND year = ? AND company_id = ?").get(producerId, year, companyId).total || 0;
    byMonth = db.prepare(`
      SELECT month, SUM(amount) as total 
      FROM collections 
      WHERE producer_id = ? AND year = ? AND company_id = ?
      GROUP BY month
    `).all(producerId, year, companyId);
    byCompany = []; // Only one company is selected
  } else {
    total = db.prepare("SELECT SUM(amount) as total FROM collections WHERE producer_id = ? AND year = ?").get(producerId, year).total || 0;
    const rawByMonth = db.prepare(`
      SELECT col.month, c.name as company, SUM(col.amount) as total 
      FROM collections col
      JOIN companies c ON col.company_id = c.id
      WHERE col.producer_id = ? AND col.year = ? 
      GROUP BY col.month, c.id
    `).all(producerId, year);
    
    const monthMap = {};
    for (const row of rawByMonth) {
      if (!monthMap[row.month]) {
        monthMap[row.month] = { month: row.month, total: 0 };
      }
      monthMap[row.month][row.company] = row.total;
      monthMap[row.month].total += row.total;
    }
    byMonth = Object.values(monthMap);
    byCompany = db.prepare(`
      SELECT c.id, c.name, SUM(col.amount) as total 
      FROM collections col
      JOIN companies c ON col.company_id = c.id
      WHERE col.producer_id = ? AND col.year = ? 
      GROUP BY c.id
      ORDER BY total DESC
    `).all(producerId, year);
  }

  res.json({
    producer: producer.name,
    company: companyName,
    total,
    byMonth,
    byCompany
  });
});

const upload = multer({ dest: 'uploads/' });

app.post("/api/deuda/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  const company = req.body.company || "Digna Seguros";

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Group by producer
    const groupedData = {};
    for (const row of data) {
      const producerKey = Object.keys(row).find(k => k.toUpperCase().includes('PRODUCTOR'));
      if (!producerKey) continue;
      
      const producerName = String(row[producerKey]).trim().toUpperCase();
      if (!producerName) continue;

      if (!groupedData[producerName]) {
        groupedData[producerName] = [];
      }
      groupedData[producerName].push(row);
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'claudiooscarayala@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD // Required in .env
      }
    });

    let emailsSent = 0;

    for (const [producerName, rows] of Object.entries(groupedData)) {
      const producerRow = db.prepare("SELECT email FROM producers WHERE name = ?").get(producerName);
      let email = producerRow?.email;

      if (!email) {
        const firstRow = rows[0];
        const emailKey = Object.keys(firstRow).find(k => k.toUpperCase().includes('MAIL') || k.toUpperCase().includes('EMAIL'));
        if (emailKey) {
          email = firstRow[emailKey];
        }
      }

      if (!email) continue; 

      const newWs = xlsx.utils.json_to_sheet(rows);
      const newWb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(newWb, newWs, `Deuda ${company}`);
      
      const buffer = xlsx.write(newWb, { type: "buffer", bookType: "xlsx" });

      const mailOptions = {
        from: 'claudiooscarayala@gmail.com',
        to: email,
        cc: 'garzonauxiliaradm@gmail.com',
        subject: `Deudores por premio ${company}`,
        text: `Estimado ${producerName}:\n\nEn archivo adjunto enviamos listado de cuotas pendientes de cobro de tu cartera en ${company}, solicitamos analizar y realizar la gestión de cobranzas correspondiente. Agradecemos tu gestión.`,
        attachments: [
          {
            filename: \`Deuda_\${producerName.replace(/[^a-zA-Z0-9_]/g, '_')}.xlsx\`,
            content: buffer
          }
        ]
      };

      try {
         await transporter.sendMail(mailOptions);
         emailsSent++;
      } catch (err) {
         console.error("Error sending to", email, err);
      }
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, emailsSent });
  } catch (err) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
const path = require("path");

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Anything that doesn't match the API routes should be handled by React Router
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
