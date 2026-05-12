import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { TrendingUp, Award, Building } from "lucide-react";

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/reports")
      .then(res => {
        const reportData = res.data;
        const MONTHS_ORDER = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        
        if (reportData && reportData.byMonth) {
          reportData.byMonth.sort((a, b) => {
            return MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month);
          });
        }
        
        setData(reportData);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, []);

  if (loading) return <div className="page-title fade-in">Cargando reporte...</div>;

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "-";
    return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Dashboard General</h1>
        <p className="page-subtitle">Resumen de cobranzas del año en curso</p>
      </header>

      <div className="dashboard-grid">
        {/* Stats */}
        <div className="glass-card stat-card delay-1">
          <div className="stat-title"><TrendingUp size={16} style={{display:"inline", marginRight: "8px"}} /> Total Recaudado</div>
          <div className="stat-value">{formatCurrency(data.total)}</div>
        </div>
        <div className="glass-card stat-card delay-2">
          <div className="stat-title"><Building size={16} style={{display:"inline", marginRight: "8px"}} /> Mejor Compañía</div>
          <div className="stat-value" style={{fontSize: "1.5rem"}}>
            {data.byCompany.length > 0 ? data.byCompany[0].name : "-"}
          </div>
        </div>
        <div className="glass-card stat-card delay-3">
          <div className="stat-title"><Award size={16} style={{display:"inline", marginRight: "8px"}} /> Top Productor</div>
          <div className="stat-value" style={{fontSize: "1.2rem"}}>
            {data.byProducer.length > 0 ? data.byProducer[0].name : "-"}
          </div>
        </div>

        {/* Main Chart */}
        <div className="glass-card chart-card delay-1" style={{marginTop: "1.5rem"}}>
          <h3 style={{marginBottom: "1.5rem", fontWeight: "600"}}>Cobranzas por Mes</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#94a3b8" 
                tickFormatter={(value) => {
                  const monthData = data.byMonth.find(d => d.month === value);
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
        </div>

        {/* Side Charts */}
        <div className="glass-card side-chart-card delay-2" style={{marginTop: "1.5rem"}}>
          <h3 style={{marginBottom: "1.5rem", fontWeight: "600", textAlign: "center"}}>Participación por Compañía</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.byCompany}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="total"
                nameKey="name"
              >
                {data.byCompany.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px"}}
                formatter={(val) => formatCurrency(val)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginTop: "1rem"}}>
            {data.byCompany.slice(0,4).map((c, i) => (
               <span key={i} style={{fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px"}}>
                  <span style={{width: "10px", height: "10px", borderRadius: "50%", background: COLORS[i%COLORS.length]}}></span>
                  {c.name}
               </span>
            ))}
          </div>
        </div>

      </div>

      {/* Top Producers Table */}
      <div className="data-table-container fade-in delay-3">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Productor</th>
              <th style={{textAlign: "right"}}>Total Recaudado</th>
            </tr>
          </thead>
          <tbody>
            {data.byProducer.map((p, index) => (
              <tr key={index}>
                <td style={{color: "var(--text-muted)"}}>#{index + 1}</td>
                <td style={{fontWeight: "500"}}>
                  <Link to={`/productor/${p.id}`} style={{color: "var(--accent)", textDecoration: "none"}} onMouseOver={(e) => e.target.style.textDecoration="underline"} onMouseOut={(e) => e.target.style.textDecoration="none"}>
                    {p.name}
                  </Link>
                </td>
                <td style={{textAlign: "right", color: "var(--success)", fontWeight: "600"}}>
                  {formatCurrency(p.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
