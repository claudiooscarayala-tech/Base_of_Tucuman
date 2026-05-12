import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Building, Calendar } from "lucide-react";

export default function CompanyReports() {
  const [companies, setCompanies] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompany = searchParams.get("companyId") || "";

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    if (val) {
      setSearchParams({ companyId: val });
    } else {
      setSearchParams({});
    }
  };
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("/api/companies")
      .then(res => setCompanies(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      setLoading(true);
      axios.get(`/api/reports/company/${selectedCompany}`)
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
  }, [selectedCompany]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "-";
    return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Reportes por Compañía</h1>
        <p className="page-subtitle">Rendimiento acumulado desde Enero hasta el mes anterior</p>
      </header>

      <div style={{display: "flex", gap: "2rem", marginBottom: "2rem", alignItems: "stretch", flexWrap: "wrap"}}>
        <div className="glass-card" style={{flex: 1, minWidth: "300px", maxWidth: "400px", display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: 0}}>
          <div className="form-group" style={{marginBottom: 0}}>
            <label className="form-label">Seleccione una Compañía</label>
            <select 
              className="form-select"
              value={selectedCompany}
              onChange={handleCompanyChange}
            >
              <option value="">Seleccionar...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        
        {!loading && selectedCompany && reportData && (
          <div className="glass-card stat-card fade-in" style={{flex: 1, minWidth: "300px", maxWidth: "400px", margin: 0}}>
            <div className="stat-title"><Building size={16} style={{display:"inline", marginRight: "8px"}} /> Total Recaudado</div>
            <div className="stat-value" style={{color: "var(--success)"}}>{formatCurrency(reportData.total)}</div>
          </div>
        )}
      </div>

      {loading && <div className="fade-in">Cargando datos...</div>}

      {!loading && selectedCompany && reportData && (
        <div className="fade-in">
          <div className="glass-card chart-card fade-in" style={{marginBottom: "2rem"}}>
            <h3 style={{marginBottom: "1.5rem", fontWeight: "600"}}>Cobranzas Mensuales</h3>
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
                  <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Productor</th>
                  <th style={{textAlign: "right"}}>Recaudación en la Compañía</th>
                </tr>
              </thead>
              <tbody>
                {reportData.byProducer.map((p, index) => (
                  <tr key={index}>
                    <td style={{color: "var(--text-muted)", width: "50px"}}>#{index + 1}</td>
                    <td style={{fontWeight: "500"}}>
                      <Link to={`/productor/${p.id}?companyId=${selectedCompany}`} style={{color: "var(--accent)", textDecoration: "none"}} onMouseOver={(e) => e.target.style.textDecoration="underline"} onMouseOut={(e) => e.target.style.textDecoration="none"}>
                        {p.name}
                      </Link>
                    </td>
                    <td style={{textAlign: "right", fontWeight: "600"}}>
                      {formatCurrency(p.total)}
                    </td>
                  </tr>
                ))}
                {reportData.byProducer.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{textAlign: "center", padding: "2rem", color: "var(--text-muted)"}}>No hay cobranzas registradas en este período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
