import { useEffect, useState } from "react";
import { api } from "./api";
import { C } from "./tema";
import { MarcaNatus, SeloHosppital } from "./Marcas";
import MonitorSetor from "./MonitorSetor.jsx";

const TIPOS = { branda: "Dieta branda", hipossodica: "Dieta hipossódica", diabetica: "Diabético", liquida: "Dieta líquida", pos_parto: "Pós-parto", pediatrica: "Pediátrica", livre: "Livre" };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const REFS = [["cafe", "Café", "07:30"], ["almoco", "Almoço", "12:00"], ["lanche", "Lanche", "15:30"], ["jantar", "Jantar", "19:00"]];

// Nutrição tem duas abas: monitor de pedidos + cardápio semanal
export default function Nutricao({ sessao, onSair }) {
  const [aba, setAba] = useState("cardapio");
  if (aba === "monitor") return (
    <div>
      <AbaSwitch aba={aba} setAba={setAba} />
      <MonitorSetor sessao={sessao} onSair={onSair} />
    </div>
  );
  return (
    <div style={{ minHeight: "100dvh", background: C.fundo, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <AbaSwitch aba={aba} setAba={setAba} onSair={onSair} nome={sessao.nome} />
      <Cardapio sessao={sessao} />
    </div>
  );
}

function AbaSwitch({ aba, setAba, onSair, nome }) {
  return (
    <header style={{ background: "#fff", borderBottom: `1px solid ${C.linha}`, padding: "12px 26px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <MarcaNatus s={16} />
        <div style={{ display: "flex", gap: 6 }}>
          {[["cardapio", "Cardápio da semana"], ["monitor", "Pedidos do setor"]].map(([id, lb]) => (
            <button key={id} onClick={() => setAba(id)} style={{ fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", color: aba === id ? "#fff" : C.tinta60, background: aba === id ? C.petroleo : C.fundo }}>{lb}</button>
          ))}
        </div>
      </div>
      {onSair && <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: C.tinta60 }}>{nome} · Nutrição</span>
        <button onClick={onSair} style={{ fontSize: 13, color: C.tinta60, background: C.fundo, border: "none", borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>Sair</button>
      </div>}
    </header>
  );
}

function Cardapio({ sessao }) {
  const [tipo, setTipo] = useState("branda");
  const [dados, setDados] = useState({});
  const [salvo, setSalvo] = useState(null);

  async function carregar() {
    const rows = await api.cardapio(tipo, sessao.token);
    const map = {};
    for (const r of rows) map[`${r.dia_semana}:${r.refeicao}`] = r.itens;
    setDados(map);
  }
  useEffect(() => { carregar(); }, [tipo]);

  async function salvar(dia, ref, hora, itens) {
    await api.salvarCardapio({ tipo_dieta: tipo, dia_semana: dia, refeicao: ref, hora, itens }, sessao.token);
    setSalvo(`${dia}:${ref}`); setTimeout(() => setSalvo(null), 1000);
  }

  return (
    <div style={{ padding: "22px 26px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 3 }}>Cardápio da semana</h1>
      <p style={{ fontSize: 14, color: C.tinta60, marginBottom: 18 }}>Preencha o cardápio de cada tipo de dieta. Cada leito puxa automaticamente o cardápio do seu tipo, no dia certo.</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {Object.entries(TIPOS).map(([id, lb]) => (
          <button key={id} onClick={() => setTipo(id)} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 20, border: `1px solid ${tipo === id ? C.petroleo : C.linha}`, background: tipo === id ? C.petroleo : "#fff", color: tipo === id ? "#fff" : C.tinta60, cursor: "pointer", fontFamily: "inherit" }}>{lb}</button>
        ))}
      </div>

      <div style={{ overflow: "auto", background: "#fff", border: `1px solid ${C.linha}`, borderRadius: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr style={{ background: C.fundo }}>
              <th style={{ ...thc, width: 90, textAlign: "left" }}>Dia</th>
              {REFS.map(([id, lb, hora]) => <th key={id} style={thc}>{lb}<div style={{ fontSize: 10, color: C.tinta60, fontWeight: 500 }}>{hora}</div></th>)}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((dia, di) => (
              <tr key={di} style={{ borderTop: `1px solid ${C.linha}` }}>
                <td style={{ padding: "8px 12px", fontWeight: 700, color: C.tinta }}>{dia}</td>
                {REFS.map(([ref, , hora]) => {
                  const key = `${di}:${ref}`;
                  return (
                    <td key={ref} style={{ padding: 6, verticalAlign: "top" }}>
                      <textarea
                        defaultValue={dados[key] || ""}
                        onBlur={(e) => salvar(di, ref, hora, e.target.value)}
                        placeholder="—"
                        style={{ width: "100%", minHeight: 52, padding: 8, borderRadius: 8, border: `1px solid ${salvo === key ? C.verde : C.linha}`, fontSize: 12, resize: "vertical", fontFamily: "inherit", background: salvo === key ? "#E8F6EF" : "#fff", boxSizing: "border-box" }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: C.tinta60, marginTop: 10 }}>As mudanças salvam automaticamente ao sair de cada campo.</p>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}><SeloHosppital /></div>
    </div>
  );
}

const thc = { padding: "10px 12px", fontSize: 12, fontWeight: 700, color: C.tinta, textAlign: "left", borderBottom: `1px solid ${C.linha}` };
