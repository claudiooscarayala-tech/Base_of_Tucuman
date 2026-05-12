import React, { useState, useEffect } from "react";
import axios from "axios";
import { Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { NumericFormat } from "react-number-format";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function DataEntry() {
  const [producers, setProducers] = useState([]);
  const [companies, setCompanies] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  
  // amounts object: { producer_id: amount }
  const [amounts, setAmounts] = useState({});
  const [prevAmounts, setPrevAmounts] = useState({});
  
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load producers and companies
    Promise.all([
      axios.get("/api/producers"),
      axios.get("/api/companies")
    ]).then(([prodRes, compRes]) => {
      setProducers(prodRes.data);
      setCompanies(compRes.data);
    });
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedCompany) {
      const year = new Date().getFullYear();
      axios.get(`/api/collections?month=${selectedMonth}&year=${year}&company_id=${selectedCompany}`)
        .then(res => {
          const newAmounts = {};
          res.data.forEach(item => {
            newAmounts[item.producer_id] = item.amount;
          });
          setAmounts(newAmounts);
          setStatus({ type: "", message: "" });
        });

      const currentMonthIndex = MONTHS.indexOf(selectedMonth);
      if (currentMonthIndex > 0) {
        const prevMonth = MONTHS[currentMonthIndex - 1];
        axios.get(`/api/collections?month=${prevMonth}&year=${year}&company_id=${selectedCompany}`)
          .then(res => {
            const pAmounts = {};
            res.data.forEach(item => {
              pAmounts[item.producer_id] = item.amount;
            });
            setPrevAmounts(pAmounts);
          });
      } else {
        setPrevAmounts({});
      }
    }
  }, [selectedMonth, selectedCompany]);

  const totalPrev = Object.values(prevAmounts).reduce((acc, val) => acc + (Number(val) || 0), 0);
  const totalCurrent = Object.values(amounts).reduce((acc, val) => acc + (Number(val) || 0), 0);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "-";
    return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAmountChange = (producerId, value) => {
    setAmounts(prev => ({
      ...prev,
      [producerId]: value === "" ? "" : Number(value)
    }));
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
      
      const nextInput = document.getElementById(`input-${index + 1}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const handleSave = () => {
    if (!selectedMonth || !selectedCompany) return;
    
    setSaving(true);
    const year = new Date().getFullYear();
    
    const collectionsToSave = Object.entries(amounts)
      .filter(([_, amount]) => amount !== "" && amount !== undefined)
      .map(([producerId, amount]) => ({
        producer_id: Number(producerId),
        amount: Number(amount)
      }));

    axios.post("/api/collections", {
      month: selectedMonth,
      year,
      company_id: Number(selectedCompany),
      collections: collectionsToSave
    })
    .then(() => {
      setStatus({ type: "success", message: "Datos guardados correctamente." });
      setTimeout(() => setStatus({type: "", message: ""}), 3000);
    })
    .catch(err => {
      setStatus({ type: "error", message: "Error al guardar: " + err.message });
    })
    .finally(() => {
      setSaving(false);
    });
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Carga de Datos</h1>
        <p className="page-subtitle">Ingreso manual de cobranzas por mes y compañía</p>
      </header>

      <div className="glass-card" style={{display: "flex", gap: "2rem", marginBottom: "2rem", maxWidth: "800px"}}>
        <div className="form-group" style={{flex: 1, marginBottom: 0}}>
          <label className="form-label">Compañía</label>
          <select 
            className="form-select"
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
          >
            <option value="">Seleccione compañía</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{flex: 1, marginBottom: 0}}>
          <label className="form-label">Mes</label>
          <select 
            className="form-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="">Seleccione un mes</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {status.message && (
          <div className="fade-in" style={{display: "flex", alignItems: "center", gap: "0.5rem", color: status.type === "success" ? "var(--success)" : "var(--accent)", padding: "1rem"}}>
            {status.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span style={{fontWeight: "500"}}>{status.message}</span>
          </div>
        )}
      </div>

      {selectedMonth && selectedCompany ? (
        <div className="data-table-container fade-in" style={{ maxWidth: "800px" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: "50%"}}>Productor</th>
                <th style={{width: "25%", textAlign: "right"}}>Mes Anterior ({companies.find(c => c.id === Number(selectedCompany))?.name})</th>
                <th style={{width: "25%"}}>Monto de Cobranza ($)</th>
              </tr>
            </thead>
            <tbody>
              {producers.map((p, index) => (
                <tr key={p.id}>
                  <td style={{fontWeight: "500", fontSize: "0.85rem"}}>{p.name}</td>
                  <td style={{textAlign: "right", color: "var(--text-muted)", fontSize: "0.85rem"}}>
                    {prevAmounts[p.id] !== undefined ? formatCurrency(prevAmounts[p.id]) : "-"}
                  </td>
                  <td>
                    <NumericFormat 
                      id={`input-${index}`}
                      className="amount-input"
                      placeholder="$ 0,00"
                      value={amounts[p.id] !== undefined ? amounts[p.id] : ""}
                      onValueChange={(values) => {
                        handleAmountChange(p.id, values.floatValue === undefined ? "" : values.floatValue);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      thousandSeparator="."
                      decimalSeparator=","
                      prefix="$ "
                      decimalScale={2}
                      fixedDecimalScale={true}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(15, 23, 42, 0.5)", fontWeight: "600", fontSize: "0.85rem" }}>
                <td style={{ padding: "0.5rem 1rem" }}>TOTAL GENERAL</td>
                <td style={{ textAlign: "right", color: "var(--text-muted)", padding: "0.5rem 1rem" }}>
                  {formatCurrency(totalPrev)}
                </td>
                <td style={{ color: "var(--success)", padding: "0.5rem 1rem" }}>
                  {formatCurrency(totalCurrent)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div style={{textAlign: "center", padding: "4rem", color: "var(--text-muted)"}}>
          Seleccione un mes y una compañía para comenzar a cargar datos.
        </div>
      )}


    </div>
  );
}
