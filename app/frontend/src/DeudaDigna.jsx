import React, { useState } from "react";
import axios from "axios";
import { UploadCloud, CheckCircle, AlertCircle, Loader } from "lucide-react";

function DeudaDigna() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage("");
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Por favor, selecciona un archivo Excel.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await axios.post("http://localhost:3001/api/deuda-digna/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setMessage(`Proceso completado: Se enviaron ${response.data.emailsSent} correos.`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Ocurrió un error al procesar el archivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <h1 className="report-title">Gestión de Deuda Digna Seguros</h1>
      </div>
      
      <div className="card" style={{ maxWidth: "600px", margin: "2rem auto" }}>
        <h2 style={{ marginBottom: "1rem", color: "var(--text-main)" }}>Subir Archivo Excel</h2>
        <p style={{ marginBottom: "1.5rem", color: "var(--text-light)" }}>
          Sube el archivo Excel con los registros de cuotas adeudadas. El sistema agrupará por productor y les enviará un correo automáticamente con su archivo correspondiente.
        </p>

        <div 
          style={{ 
            border: "2px dashed var(--border-color)", 
            padding: "2rem", 
            borderRadius: "0.5rem",
            textAlign: "center",
            marginBottom: "1.5rem"
          }}
        >
          <UploadCloud size={48} style={{ color: "var(--primary-color)", marginBottom: "1rem" }} />
          <br />
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileChange} 
            id="file-upload"
            style={{ display: "none" }}
          />
          <label 
            htmlFor="file-upload" 
            className="btn btn-primary"
            style={{ cursor: "pointer", display: "inline-block" }}
          >
            Seleccionar Archivo
          </label>
          {file && (
            <p style={{ marginTop: "1rem", color: "var(--success-color)", fontWeight: "500" }}>
              Archivo seleccionado: {file.name}
            </p>
          )}
        </div>

        <button 
          className="btn btn-primary" 
          onClick={handleUpload} 
          disabled={!file || loading}
          style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
        >
          {loading ? <Loader className="spin" size={20} /> : <UploadCloud size={20} />}
          {loading ? "Procesando y Enviando..." : "Procesar y Enviar Correos"}
        </button>

        {message && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--success-color)", borderRadius: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={20} />
            {message}
          </div>
        )}

        {error && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", borderRadius: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeudaDigna;
