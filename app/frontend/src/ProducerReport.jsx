import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { User, ArrowLeft, TrendingUp } from "lucide-react";

export default function ProducerReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("companyId");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = companyId ? `/api/reports/producer/${id}?companyId=${companyId}` : `/api/reports/producer/${id}`;
    axios.get(url)
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
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, companyId]);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "-";
    return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) return <div className="page-title fade-in">Cargando reporte de productor...</div>;
  if (!reportData) return <div className="page-title fade-in">Productor no encontrado.</div>;

  return (
    <div className="fade-in">
      <header className="page-header" style={{display: "flex", alignItems: "center", gap: "1rem"}}>
        <button 
          className="btn" 
          onClick={() => navigate(-1)}
          style={{padding: "0.5rem", borderRadius: "50%", background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-main)"}}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{marginBottom: 0}}>Reporte Individual</h1>
          <p className="page-subtitle">
            {reportData.company ? `Análisis de rendimiento en ${reportData.company}` : "Análisis de rendimiento global (Todas las compañías)"}
          </p>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="glass-card stat-card" style={{gridColumn: "span 6"}}>
          <div className="stat-title"><User size={16} style={{display:"inline", marginRight: "8px"}} /> Productor</div>
          <div className="stat-value" style={{fontSize: "1.5rem"}}>{reportData.producer}</div>
        </div>
        <div className="glass-card stat-card" style={{gridColumn: "span 6"}}>
          <div className="stat-title"><TrendingUp size={16} style={{display:"inline", marginRight: "8px"}} /> Total Recaudado (Año en curso)</div>
          <div className="stat-value" style={{color: "var(--success)"}}>{formatCurrency(reportData.total)}</div>
        </div>
      </div>

      <div className="glass-card chart-card fade-in" style={{marginTop: "2rem"}}>
        <h3 style={{marginBottom: "1.5rem", fontWeight: "600"}}>Cobranzas por Mes</h3>
        <ResponsiveContainer width="100%" height={350}>
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
      </div>
    </div>
  );
}
