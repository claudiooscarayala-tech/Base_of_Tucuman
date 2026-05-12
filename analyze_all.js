const xlsx = require("xlsx");
const workbook = xlsx.readFile("Cobranzas por mes por compañía para estadisticas - por productor.xlsx");

const summary = {
  total_cobrado: 0,
  por_mes: {},
  por_compania: {},
  top_productores: {}
};

for (const sheetName of workbook.SheetNames) {
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  
  let mesTotal = 0;
  for (const row of data) {
    if (!row.PRODUCTOR || String(row.PRODUCTOR).toUpperCase().includes("TOTAL")) continue;
    
    if (row.TOTAL && typeof row.TOTAL === "number") {
      summary.total_cobrado += row.TOTAL;
      mesTotal += row.TOTAL;
      
      if (!summary.top_productores[row.PRODUCTOR]) {
        summary.top_productores[row.PRODUCTOR] = 0;
      }
      summary.top_productores[row.PRODUCTOR] += row.TOTAL;
    }
    
    for (const [key, value] of Object.entries(row)) {
      if (key !== "PRODUCTOR" && key !== "MAIL" && key !== "TOTAL" && key !== "MES" && key !== "__EMPTY" && typeof value === "number") {
        if (!summary.por_compania[key]) {
          summary.por_compania[key] = 0;
        }
        summary.por_compania[key] += value;
      }
    }
  }
  summary.por_mes[sheetName] = mesTotal;
}

// Sort productores
const sortedProductores = Object.entries(summary.top_productores)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log(JSON.stringify({
  total_cobrado: summary.total_cobrado,
  por_mes: summary.por_mes,
  por_compania: summary.por_compania,
  top_productores: sortedProductores
}, null, 2));
