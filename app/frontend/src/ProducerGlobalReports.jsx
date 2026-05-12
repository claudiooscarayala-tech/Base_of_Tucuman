import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { User, TrendingUp } from "lucide-react";

const COMPANY_COLORS = {
  "DIGNA": "#f97316",       // Naranja
  "SANCOR": "#ef4444",      // Rojo
  "PARANA": "#1e3a8a",      // Azul oscuro
  "BBVA": "#38bdf8",        // Celeste
  "FEDERACION": "#22c55e"   // Verde
};
const DEFAULT_COLORS = ["#8b5cf6", "#f43f5e", "#eab308", "#14b8a6", "#64748b"];

const getColorForCompany = (companyName, index) => {
  // Normalizar el nombre para evitar problemas de mayúsculas/minúsculas o espacios
  const normalized = companyName.trim().toUpperCase();
  for (const key in COMPANY_COLORS) {
    if (normalized.includes(key)) {
      return COMPANY_COLORS[key];
    }
  }
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

export default function ProducerGlobalReports() {
  const [producers, setProducers] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProducer = searchParams.get("producerId") || "";
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("/api/producers")
      .then(res => setProducers(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedProducer) {
      setLoading(true);
      axios.get(`/api/reports/producer/${selectedProducer}`)
        .then(res => {
          const data = res.data;
          const MONTHS_ORDER = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
          ];
          if (data && data.byMonth) {
            data.byMonth.sort((a, b) => {
              return MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month);
            });
          }
          setReportData(data);
          setLoading(false);
        })
        .catch(err => console.error(err));
    }
  }, [selectedProducer]);

  const handleProducerChange = (e) => {
    const val = e.target.value;
    if (val) {
      setSearchParams({ producerId: val });
    } else {
      setSearchParams({});
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "-";
    return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Reportes por Productor</h1>
        <p className="page-subtitle">Rendimiento global del productor en todas las compañías</p>
      </header>

      <div style={{display: "flex", gap: "2rem", marginBottom: "2rem", alignItems: "stretch", flexWrap: "wrap"}}>
        <div className="glass-card" style={{flex: 1, minWidth: "300px", maxWidth: "400px", display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: 0}}>
          <div className="form-group" style={{marginBottom: 0}}>
            <label className="form-label">Seleccione un Productor</label>
            <select 
              className="form-select"
              value={selectedProducer}
              onChange={handleProducerChange}
            >
              <option value="">Seleccionar...</option>
              {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        
        {!loading && selectedProducer && reportData && (
          <div className="glass-card stat-card fade-in" style={{flex: 1, minWidth: "300px", maxWidth: "400px", margin: 0}}>
            <div className="stat-title"><TrendingUp size={16} style={{display:"inline", marginRight: "8px"}} /> Total Recaudado Global</div>
            <div className="stat-value" style={{color: "var(--success)"}}>{formatCurrency(reportData.total)}</div>
          </div>
        )}
      </div>

      {loading && <div className="fade-in">Cargando datos...</div>}

      {!loading && selectedProducer && reportData && (
        <div className="fade-in">
          <div className="glass-card chart-card fade-in" style={{marginBottom: "2rem"}}>
            <h3 style={{marginBottom: "1.5rem", fontWeight: "600"}}>Cobranzas Mensuales Globales</h3>
            {reportData.byMonth && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#94a3b8" 
                    tickFormatter={(value) => {
                      const monthData = reportData.byMonth.find(d => d.month === value);
                      return monthData ? formatCurrency(monthData.total) : "";
                    }}
                    angle={0}
                    textAnchor="middle"
                    height={40}
                    tick={{fontSize: 11, fill: "var(--text-muted)"}}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    width={80}
                    tickFormatter={(val) => val >= 1000000 ? `$${(val/1000000).toFixed(1)}M` : `$${(val/1000).toFixed(0)}K`} 
                  />
                  <Tooltip 
                    cursor={{fill: "rgba(255,255,255,0.05)"}} 
                    contentStyle={{background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px"}}
                    formatter={(val) => formatCurrency(val)}
                  />
                  <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}} />
                  {reportData.byCompany && reportData.byCompany.map((c, index) => (
                    <Bar 
                      key={c.id} 
                      dataKey={c.name} 
                      stackId="a" 
                      fill={getColorForCompany(c.name, index)} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {reportData.byCompany && reportData.byCompany.length > 0 && (
            <div className="data-table-container">
              <h3 style={{marginBottom: "1rem", padding: "0 1.5rem", fontWeight: "600"}}>Desglose por Compañía</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Compañía</th>
                    <th style={{textAlign: "right"}}>Recaudación</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.byCompany.map((c, index) => (
                    <tr key={index}>
                      <td style={{fontWeight: "500"}}>
                        <Link to={`/productor/${selectedProducer}?companyId=${c.id}`} style={{color: "var(--accent)", textDecoration: "none"}} onMouseOver={(e) => e.target.style.textDecoration="underline"} onMouseOut={(e) => e.target.style.textDecoration="none"}>
                          {c.name}
                        </Link>
                      </td>
                      <td style={{textAlign: "right", fontWeight: "600"}}>
                        {formatCurrency(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
