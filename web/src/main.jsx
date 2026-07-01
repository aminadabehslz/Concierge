import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { api } from "./api";
import { C } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import Paciente from "./Paciente.jsx";
import Painel from "./Painel.jsx";
import MonitorSetor from "./MonitorSetor.jsx";
import Nutricao from "./Nutricao.jsx";
import Estrategico from "./Estrategico.jsx";

const estilo = document.createElement("style");
estilo.textContent = `
  *{box-sizing:border-box} body{margin:0}
  .spin{animation:spin 1.1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  .pulse{animation:pulse 1.6s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
  .flash{animation:flash 1.2s ease-out}@keyframes flash{0%{background:#FFF7C9}100%{background:transparent}}
  ::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-thumb{background:#c4d3d8;border-radius:5px}
`;
document.head.appendChild(estilo);

// roteia o usuário logado para a tela do seu perfil
function AppEquipe() {
  const [sessao, setSessao] = useState(() => { try { return JSON.parse(localStorage.getItem("sessao") || "null"); } catch { return null; } });
  function entrar(s) { localStorage.setItem("sessao", JSON.stringify(s)); setSessao(s); }
  function sair() { localStorage.removeItem("sessao"); setSessao(null); }
  if (!sessao) return <Login onEntrar={entrar} />;
  if (sessao.perfil === "direcao") return <Estrategico sessao={sessao} onSair={sair} />;
  if (sessao.perfil === "admin" || sessao.perfil === "concierge") return <Painel sessao={sessao} onSair={sair} />;
  if (sessao.perfil === "setor" && sessao.setor_id === "nutricao") return <Nutricao sessao={sessao} onSair={sair} />;
  if (sessao.perfil === "setor") return <MonitorSetor sessao={sessao} onSair={sair} />;
  return <Login onEntrar={entrar} />;
}

function Login({ onEntrar }) {
  const [login, setLogin] = useState("concierge");
  const [senha, setSenha] = useState("natus123");
  const [erro, setErro] = useState(null);
  const [carr, setCarr] = useState(false);
  async function entrar() {
    setCarr(true); setErro(null);
    try { onEntrar(await api.login(login, senha)); }
    catch (e) { setErro(e.message); setCarr(false); }
  }
  const atalhos = [["concierge", "Concierge"], ["direcao", "Direção"], ["admin", "Admin"], ["hotelaria", "Hotelaria"], ["nutricao", "Nutrição"], ["manutencao", "Manutenção"]];
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: `linear-gradient(165deg, ${C.petroleoEsc}, ${C.petroleo})`, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "32px 30px", width: "min(440px,100%)", boxShadow: "0 30px 70px rgba(10,80,103,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><MarcaNatus s={18} vertical /></div>
        <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: C.tinta, margin: "18px 0 2px" }}>Acesso da equipe</h1>
        <p style={{ textAlign: "center", fontSize: 13, color: C.tinta60, marginBottom: 18 }}>Concierge, setores e direção</p>
        <label style={lbl}>Usuário</label>
        <input value={login} onChange={(e) => setLogin(e.target.value)} style={inp} />
        <label style={lbl}>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} style={inp} onKeyDown={(e) => e.key === "Enter" && entrar()} />
        {erro && <div style={{ color: C.vermelho, fontSize: 13, fontWeight: 600, marginTop: 8 }}>{erro}</div>}
        <button onClick={entrar} disabled={carr} style={{ width: "100%", marginTop: 16, padding: 13, borderRadius: 12, background: C.petroleo, color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: carr ? 0.6 : 1, fontFamily: "inherit" }}>{carr ? "Entrando…" : "Entrar"}</button>
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.linha}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: C.tinta60, marginBottom: 7, textAlign: "center" }}>Piloto — entrar como (senha natus123):</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {atalhos.map(([u, lb]) => <button key={u} onClick={() => { setLogin(u); setSenha("natus123"); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 16, border: `1px solid ${C.linha}`, background: login === u ? C.tealNevoa : "#fff", color: C.tinta, cursor: "pointer", fontFamily: "inherit" }}>{lb}</button>)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}><SeloHosppital /></div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 700, color: C.tinta, marginBottom: 5, marginTop: 12 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.linha}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };

// permite abrir o monitor de um setor por URL fixa (TV), exigindo login de setor
function MonitorPorUrl() {
  return <AppEquipe />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppEquipe />} />
        <Route path="/p/:token" element={<Paciente />} />
        <Route path="/setor/:sid" element={<MonitorPorUrl />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
