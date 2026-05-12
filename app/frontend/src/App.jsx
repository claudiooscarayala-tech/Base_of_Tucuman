import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { LayoutDashboard, Database, BarChart3, Building, User, FileText } from "lucide-react";
import Dashboard from "./Dashboard";
import DataEntry from "./DataEntry";
import CompanyReports from "./CompanyReports";
import ProducerGlobalReports from "./ProducerGlobalReports";
import ProducerReport from "./ProducerReport";
import Deuda from "./Deuda";

function App() {
  return (
    <Router>
      <aside className="sidebar">
        <div className="logo">
          <BarChart3 className="logo-icon" size={28} />
          <span>COA Analytics</span>
        </div>
        <nav className="nav-links">
          <NavLink 
            to="/" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          <NavLink 
            to="/por-compania" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Building size={20} />
            Por Compañía
          </NavLink>
          <NavLink 
            to="/por-productor" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <User size={20} />
            Por Productor
          </NavLink>
          <NavLink 
            to="/ingreso" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <Database size={20} />
            Carga de Datos
          </NavLink>
          <NavLink 
            to="/deuda-digna" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <FileText size={20} />
            Deuda Digna
          </NavLink>
          <NavLink 
            to="/deuda-sancor" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <FileText size={20} />
            Deuda Sancor
          </NavLink>
          <NavLink 
            to="/deuda-parana" 
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
          >
            <FileText size={20} />
            Deuda Paraná
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/por-compania" element={<CompanyReports />} />
          <Route path="/por-productor" element={<ProducerGlobalReports />} />
          <Route path="/productor/:id" element={<ProducerReport />} />
          <Route path="/ingreso" element={<DataEntry />} />
          <Route path="/deuda-digna" element={<Deuda companyName="Digna Seguros" />} />
          <Route path="/deuda-sancor" element={<Deuda companyName="Sancor Seguros" />} />
          <Route path="/deuda-parana" element={<Deuda companyName="Paraná Seguros" />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
