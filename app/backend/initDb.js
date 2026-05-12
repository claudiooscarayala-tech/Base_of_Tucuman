const Database = require("better-sqlite3");
const xlsx = require("xlsx"); // This will resolve to the parent directory node_modules
const path = require("path");

const dbPath = process.env.DB_PATH || "database.sqlite";
const db = new Database(dbPath);

// Create Tables
db.exec(`
  DROP TABLE IF EXISTS collections;
  DROP TABLE IF EXISTS companies;
  DROP TABLE IF EXISTS producers;

  CREATE TABLE producers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    email TEXT
  );

  CREATE TABLE companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producer_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY(producer_id) REFERENCES producers(id),
    FOREIGN KEY(company_id) REFERENCES companies(id)
  );
`);

console.log("Tables created successfully.");

// Prepared statements
const insertProducer = db.prepare("INSERT INTO producers (name, email) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET email = excluded.email");
const getProducer = db.prepare("SELECT id FROM producers WHERE name = ?");

const insertCompany = db.prepare("INSERT OR IGNORE INTO companies (name) VALUES (?)");
const getCompany = db.prepare("SELECT id FROM companies WHERE name = ?");

const insertCollection = db.prepare(
  "INSERT INTO collections (producer_id, company_id, month, year, amount) VALUES (?, ?, ?, ?, ?)"
);

// Load Data
const excelPath = path.join(__dirname, "../..", "Cobranzas por mes por compañía para estadisticas - por productor.xlsx");
const workbook = xlsx.readFile(excelPath);

const EXCLUDED_COLS = ["PRODUCTOR", "MAIL", "TOTAL", "MES", "__EMPTY"];

db.transaction(() => {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // sheetName is Enero, Febrero, etc. We use it as month, and 2026 as year
    const monthStr = sheetName.trim();
    const year = new Date().getFullYear();

    for (const row of data) {
      if (!row.PRODUCTOR || String(row.PRODUCTOR).toUpperCase().includes("TOTAL")) continue;

      const producerName = String(row.PRODUCTOR).trim().toUpperCase();
      const producerEmail = row.MAIL ? String(row.MAIL).trim() : null;
      insertProducer.run(producerName, producerEmail);
      const producerId = getProducer.get(producerName).id;

      for (const [key, value] of Object.entries(row)) {
        const colName = key.trim().toUpperCase();
        if (!EXCLUDED_COLS.includes(colName) && typeof value === "number" && value !== 0) {
          insertCompany.run(colName);
          const companyId = getCompany.get(colName).id;

          insertCollection.run(producerId, companyId, monthStr, year, value);
        }
      }
    }
  }
})();

console.log("Database initialized with historical data.");
