const xlsx = require("xlsx");
const workbook = xlsx.readFile("Cobranzas por mes por compañía para estadisticas - por productor.xlsx");
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);
console.log("Sheet names:", workbook.SheetNames);
console.log(`Total rows in ${sheetName}: ${data.length}`);
console.log("First 3 rows:");
console.log(JSON.stringify(data.slice(0, 3), null, 2));
