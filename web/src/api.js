import { useEffect, useRef, useState } from "react";

async function req(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || `HTTP ${r.status}`);
  return r.json();
}

export const api = {
  config: () => req("/api/config"),
  login: (login, senha) => req("/api/login", { method: "POST", body: { login, senha } }),
  // paciente
  paciente: (qt) => req(`/api/p/${qt}`),
  salvarNome: (qt, nome) => req(`/api/p/${qt}/nome`, { method: "POST", body: { nome } }),
  abrirChamado: (qt, servico, detalhe, origem) => req(`/api/p/${qt}/chamado`, { method: "POST", body: { servico, detalhe, origem } }),
  avaliar: (qt, nota, contexto, comentario) => req(`/api/p/${qt}/avaliacao`, { method: "POST", body: { nota, contexto, comentario } }),
  // setor
  setor: (sid, token) => req(`/api/setor/${sid}`, { token }),
  assumir: (id, atendente, token) => req(`/api/chamados/${id}/assumir`, { method: "POST", body: { atendente }, token }),
  concluir: (id, token) => req(`/api/chamados/${id}/concluir`, { method: "POST", token }),
  // concierge
  estado: (token) => req("/api/estado", { token }),
  reforcar: (id, token) => req(`/api/chamados/${id}/reforcar`, { method: "POST", body: {}, token }),
  reencaminhar: (id, setor_id, token) => req(`/api/chamados/${id}/reencaminhar`, { method: "POST", body: { setor_id }, token }),
  intervir: (quarto_id, acao, avaliacao_id, token) => req("/api/intervencoes", { method: "POST", body: { quarto_id, acao, avaliacao_id }, token }),
  alta: (id, token) => req(`/api/quartos/${id}/alta`, { method: "POST", token }),
  leitos: (token) => req("/api/leitos", { token }),
  setDieta: (id, tipo_dieta, token) => req(`/api/quartos/${id}/dieta`, { method: "POST", body: { tipo_dieta }, token }),
  // nutrição
  cardapio: (tipo, token) => req(`/api/cardapio/${tipo}`, { token }),
  salvarCardapio: (cel, token) => req("/api/cardapio", { method: "POST", body: cel, token }),
  relatorio: (inicio, fim, setor, token) => {
    const qs = new URLSearchParams({ inicio, fim, ...(setor ? { setor } : {}) });
    return req(`/api/relatorio?${qs}`, { token });
  },
  estrategico: (token) => req("/api/estrategico", { token }),
};

export function useTempoReal(onEvento) {
  const [conectado, setConectado] = useState(false);
  const cbRef = useRef(onEvento); cbRef.current = onEvento;
  useEffect(() => {
    let vivo = true, tent = 0, ws;
    function conectar() {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => { setConectado(true); tent = 0; };
      ws.onclose = () => { setConectado(false); if (vivo) { tent++; setTimeout(conectar, Math.min(5000, 500 * tent)); } };
      ws.onmessage = (e) => { try { cbRef.current?.(JSON.parse(e.data)); } catch {} };
    }
    conectar();
    return () => { vivo = false; ws?.close(); };
  }, []);
  return { conectado };
}
