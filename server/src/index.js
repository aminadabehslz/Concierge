import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { db, migrate, snapshot, snapshotSetor, getChamado } from "./db.js";
import { SERVICOS, SERVICOS_IDS, SETORES, SETORES_IDS, TIPOS_DIETA_IDS, dietaPadraoDoSetor } from "./config.js";
import { gerarRelatorio, painelEstrategico } from "./relatorio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
migrate();

const app = express();
app.use(express.json());
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// ---- broadcast tempo real (com canal opcional p/ filtrar no cliente) ----
function broadcast(tipo, payload) {
  const msg = JSON.stringify({ tipo, payload, em: Date.now() });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ tipo: "snapshot", payload: snapshot(), em: Date.now() }));
});

// ---- sessões ----
const sessoes = new Map(); // token -> {login,nome,perfil,setor_id}
function auth(perfis) {
  return (req, res, next) => {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    const s = sessoes.get(t);
    if (!s) return res.status(401).json({ erro: "não autenticado" });
    if (perfis && !perfis.includes(s.perfil)) return res.status(403).json({ erro: "sem permissão" });
    req.user = s;
    next();
  };
}

function logEvento(chamado_id, tipo, autor, detalhe = "") {
  db.prepare("INSERT INTO eventos (chamado_id, tipo, autor, detalhe, em) VALUES (?,?,?,?,?)")
    .run(chamado_id, tipo, autor, detalhe, Date.now());
}

// monta a dieta do dia para um quarto a partir do cardápio semanal do seu tipo
const LABEL_DIETA = { livre: "Dieta livre", branda: "Dieta branda", hipossodica: "Dieta hipossódica", diabetica: "Dieta para diabético", liquida: "Dieta líquida", pos_parto: "Pós-parto / puérpera", pediatrica: "Pediátrica" };
function montarDieta(q) {
  const tipo = q.tipo_dieta || dietaPadraoDoSetor(q.setor);
  const dow = new Date().getDay();
  const rows = db.prepare("SELECT refeicao, hora, itens FROM cardapio WHERE tipo_dieta=? AND dia_semana=?").all(tipo, dow);
  const ordem = { cafe: 0, almoco: 1, lanche: 2, jantar: 3 };
  const nomes = { cafe: "Café da manhã", almoco: "Almoço", lanche: "Lanche da tarde", jantar: "Jantar" };
  const refeicoes = rows
    .sort((a, b) => (ordem[a.refeicao] ?? 9) - (ordem[b.refeicao] ?? 9))
    .map((r) => ({ hora: r.hora || "", nome: nomes[r.refeicao] || r.refeicao, itens: r.itens || "" }));
  return { tipo, tipoLabel: LABEL_DIETA[tipo] || tipo, definido: rows.length > 0, refeicoes };
}

// ====================================================
//  AUTENTICAÇÃO
// ====================================================
app.post("/api/login", (req, res) => {
  const { login, senha } = req.body || {};
  const u = db.prepare("SELECT * FROM usuarios WHERE login = ?").get(login);
  if (!u || u.senha !== senha) return res.status(401).json({ erro: "credenciais inválidas" });
  const token = randomUUID();
  sessoes.set(token, { login: u.login, nome: u.nome, perfil: u.perfil, setor_id: u.setor_id });
  res.json({ token, nome: u.nome, perfil: u.perfil, setor_id: u.setor_id });
});

// metadados públicos (serviços/setores) para o front montar telas
app.get("/api/config", (req, res) => {
  res.json({ servicos: SERVICOS, setores: SETORES, tipos_dieta: TIPOS_DIETA_IDS });
});

// ====================================================
//  PACIENTE (token de quarto — QR)
// ====================================================
app.get("/api/p/:token", (req, res) => {
  const q = db.prepare("SELECT id, paciente, setor, andar, modo, tipo_dieta, suite, zerado_em FROM quartos WHERE token = ?").get(req.params.token);
  if (!q) return res.status(404).json({ erro: "quarto não encontrado" });
  const chamados = db.prepare("SELECT * FROM chamados WHERE quarto_id=? AND criado_em>? ORDER BY criado_em DESC LIMIT 50").all(q.id, q.zerado_em || 0);
  res.json({ quarto: q, chamados, dieta: montarDieta(q) });
});

app.post("/api/p/:token/nome", (req, res) => {
  const q = db.prepare("SELECT * FROM quartos WHERE token = ?").get(req.params.token);
  if (!q) return res.status(404).json({ erro: "quarto não encontrado" });
  const nome = (req.body?.nome || "").trim().slice(0, 80) || null;
  db.prepare("UPDATE quartos SET paciente=? WHERE id=?").run(nome, q.id);
  broadcast("quarto_atualizado", { id: q.id, paciente: nome });
  res.json({ ok: true, paciente: nome });
});

// paciente abre chamado -> roteia direto ao setor do serviço
app.post("/api/p/:token/chamado", (req, res) => {
  const q = db.prepare("SELECT * FROM quartos WHERE token = ?").get(req.params.token);
  if (!q) return res.status(404).json({ erro: "quarto não encontrado" });
  const { servico, detalhe = "", origem = "paciente" } = req.body || {};
  const s = SERVICOS[servico];
  if (!s) return res.status(400).json({ erro: "serviço inválido" });
  const info = db.prepare(`INSERT INTO chamados (quarto_id, servico, setor_id, detalhe, origem, status, sla_min, criado_em)
    VALUES (?,?,?,?,?, 'aberto', ?, ?)`).run(q.id, servico, s.setor, detalhe, origem, s.sla, Date.now());
  const ch = getChamado(info.lastInsertRowid);
  logEvento(ch.id, "aberto", `Quarto ${q.id}`, `${servico} -> ${s.setor}`);
  broadcast("chamado_novo", ch);
  res.status(201).json(ch);
});

// paciente registra avaliação de experiência (dinâmica)
app.post("/api/p/:token/avaliacao", (req, res) => {
  const q = db.prepare("SELECT * FROM quartos WHERE token = ?").get(req.params.token);
  if (!q) return res.status(404).json({ erro: "quarto não encontrado" });
  const { nota, contexto = "geral", comentario = "" } = req.body || {};
  if (typeof nota !== "number" || nota < 0 || nota > 10) return res.status(400).json({ erro: "nota inválida" });
  const info = db.prepare("INSERT INTO avaliacoes (quarto_id, nota, contexto, comentario, em) VALUES (?,?,?,?,?)")
    .run(q.id, nota, contexto, comentario, Date.now());
  const aval = db.prepare("SELECT * FROM avaliacoes WHERE id=?").get(info.lastInsertRowid);
  // nota baixa => alerta de intervenção para o concierge (em tempo real)
  broadcast("avaliacao_nova", { aval, intervir: nota <= 6, quarto: { id: q.id, paciente: q.paciente, setor: q.setor } });
  res.status(201).json({ ok: true, aval });
});

// ====================================================
//  SETOR (monitor) — vê só os chamados do próprio setor
// ====================================================
app.get("/api/setor/:setor_id", auth(["setor", "concierge", "admin"]), (req, res) => {
  const sid = req.params.setor_id;
  if (req.user.perfil === "setor" && req.user.setor_id !== sid) return res.status(403).json({ erro: "outro setor" });
  if (!SETORES[sid]) return res.status(404).json({ erro: "setor inexistente" });
  res.json(snapshotSetor(sid));
});

// setor assume
app.post("/api/chamados/:id/assumir", auth(["setor", "concierge", "admin"]), (req, res) => {
  const c = getChamado(Number(req.params.id));
  if (!c) return res.status(404).json({ erro: "não encontrado" });
  if (c.status !== "aberto") return res.status(409).json({ erro: "já assumido" });
  const atendente = req.body?.atendente || req.user.nome;
  db.prepare("UPDATE chamados SET status='em_atendimento', atendente=?, assumido_em=? WHERE id=?").run(atendente, Date.now(), c.id);
  const a = getChamado(c.id);
  logEvento(c.id, "assumido", req.user.nome, atendente);
  broadcast("chamado_atualizado", a);
  res.json(a);
});

// setor encerra a demanda
app.post("/api/chamados/:id/concluir", auth(["setor", "concierge", "admin"]), (req, res) => {
  const c = getChamado(Number(req.params.id));
  if (!c) return res.status(404).json({ erro: "não encontrado" });
  if (c.status === "concluido") return res.status(409).json({ erro: "já concluído" });
  db.prepare("UPDATE chamados SET status='concluido', concluido_em=?, atendente=COALESCE(atendente,?) WHERE id=?").run(Date.now(), req.user.nome, c.id);
  const a = getChamado(c.id);
  logEvento(c.id, "concluido", req.user.nome);
  broadcast("chamado_atualizado", a);
  res.json(a);
});

// ====================================================
//  CONCIERGE (torre) — reforço, reencaminhar, intervenção
// ====================================================
// reforço: cutuca o setor (registra evento + alerta no monitor do setor)
app.post("/api/chamados/:id/reforcar", auth(["concierge", "admin"]), (req, res) => {
  const c = getChamado(Number(req.params.id));
  if (!c) return res.status(404).json({ erro: "não encontrado" });
  logEvento(c.id, "reforco", req.user.nome, req.body?.nota || "");
  broadcast("reforco", { chamado_id: c.id, setor_id: c.setor_id, quarto_id: c.quarto_id, por: req.user.nome });
  res.json({ ok: true });
});

// reencaminhar para outro setor (caso raro mal-roteado)
app.post("/api/chamados/:id/reencaminhar", auth(["concierge", "admin"]), (req, res) => {
  const c = getChamado(Number(req.params.id));
  if (!c) return res.status(404).json({ erro: "não encontrado" });
  const novo = req.body?.setor_id;
  if (!SETORES[novo]) return res.status(400).json({ erro: "setor inválido" });
  db.prepare("UPDATE chamados SET setor_id=?, status='aberto', atendente=NULL, assumido_em=NULL WHERE id=?").run(novo, c.id);
  const a = getChamado(c.id);
  logEvento(c.id, "reencaminhado", req.user.nome, `${c.setor_id} -> ${novo}`);
  broadcast("chamado_atualizado", a);
  res.json(a);
});

// intervenção do concierge numa avaliação baixa (registro rápido)
app.post("/api/intervencoes", auth(["concierge", "admin"]), (req, res) => {
  const { quarto_id, avaliacao_id = null, acao = "", resolvido = 1 } = req.body || {};
  const q = db.prepare("SELECT * FROM quartos WHERE id=?").get(quarto_id);
  if (!q) return res.status(400).json({ erro: "quarto inválido" });
  const info = db.prepare("INSERT INTO intervencoes (quarto_id, avaliacao_id, autor, acao, resolvido, em) VALUES (?,?,?,?,?,?)")
    .run(quarto_id, avaliacao_id, req.user.nome, acao, resolvido ? 1 : 0, Date.now());
  const it = db.prepare("SELECT * FROM intervencoes WHERE id=?").get(info.lastInsertRowid);
  broadcast("intervencao_nova", it);
  res.status(201).json(it);
});

// ====================================================
//  ADMIN / equipe geral
// ====================================================
app.get("/api/estado", auth(["concierge", "admin"]), (req, res) => res.json(snapshot()));

// ---- Painel estratégico (Direção) ----
app.get("/api/estrategico", auth(["admin", "direcao", "concierge"]), (req, res) => {
  res.json(painelEstrategico());
});

// ---- Zerar movimento (Direção/Admin): apaga chamados, avaliações e intervenções.
// Mantém leitos, setores, usuários e cardápio. Também limpa nomes de pacientes (LGPD).
app.post("/api/zerar-movimento", auth(["admin", "direcao"]), (req, res) => {
  db.exec("DELETE FROM eventos; DELETE FROM intervencoes; DELETE FROM avaliacoes; DELETE FROM chamados;");
  db.prepare("UPDATE quartos SET paciente=NULL, zerado_em=?").run(Date.now());
  broadcast("snapshot", snapshot());
  res.json({ ok: true, em: Date.now() });
});

// ---- Relatório por período ----
// admin/concierge/direcao: qualquer setor ou geral. setor: só o próprio.
app.get("/api/relatorio", auth(["admin", "direcao", "concierge", "setor"]), (req, res) => {
  const inicio = Number(req.query.inicio) || (Date.now() - 30 * 86400000);
  const fim = Number(req.query.fim) || Date.now();
  let setor = req.query.setor || null;
  if (req.user.perfil === "setor") setor = req.user.setor_id; // setor só vê o próprio
  const rel = gerarRelatorio(inicio, fim, setor);
  res.json(rel);
});

app.get("/api/leitos", auth(["concierge", "admin"]), (req, res) => {
  res.json(db.prepare("SELECT id, setor, andar, posto, acomod, modo, tipo_dieta, paciente, token FROM quartos ORDER BY id").all());
});

// tokens dos monitores de setor (para abrir a TV por URL)
app.get("/api/setores", auth(["admin", "concierge"]), (req, res) => {
  res.json(SETORES_IDS.map((id) => ({ id, ...SETORES[id] })));
});

// definir tipo de dieta de um leito (admin/concierge)
app.post("/api/quartos/:id/dieta", auth(["concierge", "admin"]), (req, res) => {
  const tipo = req.body?.tipo_dieta;
  if (!TIPOS_DIETA_IDS.includes(tipo)) return res.status(400).json({ erro: "tipo inválido" });
  db.prepare("UPDATE quartos SET tipo_dieta=? WHERE id=?").run(tipo, req.params.id);
  broadcast("quarto_atualizado", { id: req.params.id, tipo_dieta: tipo });
  res.json({ ok: true });
});

// ALTA: zera o leito (LGPD)
app.post("/api/quartos/:id/alta", auth(["concierge", "admin"]), (req, res) => {
  const q = db.prepare("SELECT * FROM quartos WHERE id=?").get(req.params.id);
  if (!q) return res.status(404).json({ erro: "leito não encontrado" });
  const now = Date.now();
  db.prepare("UPDATE chamados SET status='concluido', concluido_em=COALESCE(concluido_em,?) WHERE quarto_id=? AND status!='concluido'").run(now, q.id);
  db.prepare("UPDATE quartos SET paciente=NULL, zerado_em=? WHERE id=?").run(now, q.id);
  broadcast("alta", { id: q.id });
  res.json({ ok: true, leito: q.id });
});

// ====================================================
//  NUTRIÇÃO — cardápio semanal por tipo de dieta
// ====================================================
app.get("/api/cardapio/:tipo", auth(["setor", "concierge", "admin"]), (req, res) => {
  res.json(db.prepare("SELECT * FROM cardapio WHERE tipo_dieta=? ORDER BY dia_semana, refeicao").all(req.params.tipo));
});

// upsert de uma célula do cardápio (tipo + dia + refeição)
app.post("/api/cardapio", auth(["setor", "concierge", "admin"]), (req, res) => {
  if (req.user.perfil === "setor" && req.user.setor_id !== "nutricao") return res.status(403).json({ erro: "apenas nutrição" });
  const { tipo_dieta, dia_semana, refeicao, hora = "", itens = "" } = req.body || {};
  if (!TIPOS_DIETA_IDS.includes(tipo_dieta)) return res.status(400).json({ erro: "tipo inválido" });
  db.prepare(`INSERT INTO cardapio (tipo_dieta, dia_semana, refeicao, hora, itens) VALUES (?,?,?,?,?)
    ON CONFLICT(tipo_dieta, dia_semana, refeicao) DO UPDATE SET hora=excluded.hora, itens=excluded.itens`)
    .run(tipo_dieta, dia_semana, refeicao, hora, itens);
  broadcast("cardapio_atualizado", { tipo_dieta, dia_semana, refeicao });
  res.json({ ok: true });
});

// ---- front estático ----
const WEB_DIST = join(__dirname, "..", "..", "web", "dist");
if (existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (req, res) => res.sendFile(join(WEB_DIST, "index.html")));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`API + WS rodando em http://localhost:${PORT}`));
