import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "./api";
import { C } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";

export default function QRGerador({ sessao, onVoltar }) {
  const [leitos, setLeitos] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [qrs, setQrs] = useState({});

  useEffect(() => { api.leitos(sessao.token).then(setLeitos).catch(() => {}); }, []);
  useEffect(() => {
    leitos.forEach((l) => {
      if (qrs[l.id]) return;
      const url = `${location.origin}/p/${l.token}`;
      QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: C.petroleoEsc, light: "#ffffff" } })
        .then((d) => setQrs((q) => ({ ...q, [l.id]: d }))).catch(() => {});
    });
  }, [leitos]);

  const setores = [...new Set(leitos.map((l) => l.setor))];
  const vis = filtro === "todos" ? leitos : leitos.filter((l) => l.setor === filtro);

  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <header className="noprint" style={{ background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "13px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <MarcaNatus s={17} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ fontSize: 13, padding: "7px 10px", borderRadius: 10, border: `1px solid ${C.linha}`, fontFamily: "inherit" }}>
            <option value="todos">Todos os setores ({leitos.length})</option>
            {setores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => window.print()} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: C.petroleo, padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Imprimir</button>
          <button onClick={onVoltar} style={{ fontSize: 13, fontWeight: 600, color: C.tinta60, background: C.fundo, padding: "8px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Voltar ao painel</button>
        </div>
      </header>

      <div style={{ padding: "22px 26px" }}>
        <h1 className="noprint" style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>QR Codes dos leitos</h1>
        <p className="noprint" style={{ fontSize: 14, color: C.tinta60, marginBottom: 20 }}>Imprima e cole na porta de cada quarto. Ao escanear, o paciente abre o concierge já no leito certo.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 16 }}>
          {vis.map((l) => (
            <div key={l.id} style={{ background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 14, padding: 16, textAlign: "center", breakInside: "avoid" }}>
              <div style={{ marginBottom: 6 }}><MarcaNatus s={11} /></div>
              {qrs[l.id]
                ? <img src={qrs[l.id]} alt={`QR ${l.id}`} style={{ width: "100%", maxWidth: 160, margin: "0 auto", display: "block" }} />
                : <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.tinta60, fontSize: 12 }}>gerando…</div>}
              <div style={{ fontSize: 22, fontWeight: 800, color: C.tinta, marginTop: 6, fontFamily: "monospace" }}>{l.id}</div>
              <div style={{ fontSize: 11, color: C.tinta60 }}>{l.setor}</div>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginTop: 2 }}>
                concierge do paciente
              </div>
            </div>
          ))}
        </div>
        <div className="noprint" style={{ marginTop: 24, display: "flex", justifyContent: "center" }}><SeloHosppital /></div>
      </div>

      <style>{`@media print { .noprint { display:none !important } body { background:#fff } }`}</style>
    </div>
  );
}
