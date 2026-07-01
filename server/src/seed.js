import { db, migrate } from "./db.js";
import { LEITOS } from "./leitos.js";
import { SERVICOS, SETORES_IDS, dietaPadraoDoSetor } from "./config.js";
import { randomUUID } from "node:crypto";

migrate();
const agora = Date.now();
const min = (n) => n * 60000;

db.exec("DELETE FROM eventos; DELETE FROM intervencoes; DELETE FROM avaliacoes; DELETE FROM chamados; DELETE FROM cardapio; DELETE FROM quartos; DELETE FROM usuarios;");

// ---- 114 leitos reais ----
const slug = (id) => id.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const token = (id) => "q" + slug(id) + randomUUID().slice(0, 5);
const insQ = db.prepare("INSERT INTO quartos (id, paciente, setor, andar, posto, acomod, modo, tipo_dieta, suite, token) VALUES (?,?,?,?,?,?,?,?,?,?)");
for (const l of LEITOS) {
  insQ.run(l.numero, null, l.setor, l.andar, l.posto, l.acomod, l.modo, dietaPadraoDoSetor(l.setor), l.acomod === "suite" ? 1 : 0, token(l.numero));
}

// ---- Usuários por perfil ----
const insU = db.prepare("INSERT INTO usuarios (login, senha, nome, perfil, setor_id) VALUES (?,?,?,?,?)");
insU.run("admin", "natus123", "Direção / TI", "admin", null);
insU.run("direcao", "natus123", "Dra. Helena Braga", "direcao", null);
insU.run("concierge", "natus123", "Cleide Rodrigues", "concierge", null);
// um login por setor (monitor)
const nomesSetor = { hotelaria: "Hotelaria", limpeza: "Equipe de Limpeza", manutencao: "Manutenção", nutricao: "Nutrição", enfermagem: "Enfermagem", seguranca: "Segurança" };
for (const sid of SETORES_IDS) insU.run(sid, "natus123", nomesSetor[sid] || sid, "setor", sid);

// ---- Cardápio semanal de exemplo (todos os dias iguais p/ simplificar o piloto) ----
const insCard = db.prepare("INSERT INTO cardapio (tipo_dieta, dia_semana, refeicao, hora, itens) VALUES (?,?,?,?,?)");
const cardapios = {
  branda: { cafe:"Pão integral, queijo branco, chá, mamão", almoco:"Frango grelhado, purê, legumes no vapor, gelatina diet", lanche:"Iogurte natural, biscoito sem açúcar", jantar:"Sopa de legumes, peito de peru, fruta" },
  pos_parto: { cafe:"Pão, queijo, leite, fruta, suco natural", almoco:"Carne magra, arroz, feijão, salada, fruta", lanche:"Vitamina de frutas, biscoito", jantar:"Sopa nutritiva, proteína, fruta" },
  pediatrica: { cafe:"Leite, pão com manteiga, fruta picada", almoco:"Arroz, frango desfiado, legumes macios, gelatina", lanche:"Iogurte, fruta", jantar:"Papa salgada, fruta" },
  hipossodica: { cafe:"Pão sem sal, queijo fresco, chá", almoco:"Peixe assado, arroz, legumes sem sal", lanche:"Fruta, torrada sem sal", jantar:"Sopa sem sal, fruta" },
  diabetica: { cafe:"Pão integral, ovo, chá sem açúcar", almoco:"Frango, arroz integral, salada, gelatina diet", lanche:"Castanhas, fruta com baixo índice", jantar:"Sopa de legumes, proteína" },
  liquida: { cafe:"Chá, suco coado, mingau ralo", almoco:"Caldo de legumes, suco", lanche:"Gelatina, água de coco", jantar:"Caldo, suco coado" },
  livre: { cafe:"Café, pão, frios, fruta", almoco:"Prato livre do dia", lanche:"Bolo, suco", jantar:"Prato livre do dia" },
};
const horas = { cafe:"07:30", almoco:"12:00", lanche:"15:30", jantar:"19:00" };
for (const [tipo, refs] of Object.entries(cardapios)) {
  for (let dow = 0; dow < 7; dow++) {
    for (const [ref, itens] of Object.entries(refs)) insCard.run(tipo, dow, ref, horas[ref], itens);
  }
}

// ---- Chamados de exemplo roteados a setores ----
const pac = db.prepare("SELECT id FROM quartos WHERE modo='paciente' ORDER BY id LIMIT 40").all().map(r => r.id);
const peg = (i) => pac[i % pac.length];
const insC = db.prepare(`INSERT INTO chamados (quarto_id, servico, setor_id, detalhe, origem, status, atendente, sla_min, criado_em, assumido_em, concluido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const novo = (qi, serv, det, origem, status, atend, criadoMin, assumMin, conclMin) => {
  const s = SERVICOS[serv];
  insC.run(peg(qi), serv, s.setor, det, origem, status, atend, s.sla, agora - min(criadoMin), assumMin ? agora - min(assumMin) : null, conclMin ? agora - min(conclMin) : null);
};
novo(2, "manutencao", "Ar-condicionado não gela", "paciente", "em_atendimento", "João (Manut.)", 54, 40, null);
novo(5, "limpeza", "", "paciente", "aberto", null, 38, null, null);
novo(8, "agua", "Jarra vazia", "paciente", "aberto", null, 18, null, null);          // já estourou (SLA 15)
novo(1, "refeicao", "Trocar suco por água", "paciente", "aberto", null, 6, null, null);
novo(0, "hotelaria", "Troca de toalhas", "acompanhante", "concluido", "Ana (Hotel.)", 70, 64, 41);

// ---- Avaliações de experiência (dinâmicas) + 1 baixa p/ intervenção ----
const insA = db.prepare("INSERT INTO avaliacoes (quarto_id, nota, contexto, comentario, em) VALUES (?,?,?,?,?)");
insA.run(peg(0), 9, "geral", "Equipe atenciosa", agora - min(180));
insA.run(peg(0), 8, "refeicao", "", agora - min(60));
insA.run(peg(2), 4, "geral", "Demora no ar-condicionado", agora - min(15));   // dispara intervenção

// ---- Histórico de 30 dias (para relatórios) ----
function rand(seed) { let a = seed; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
const rnd = rand(2026);
const pacHist = db.prepare("SELECT id, setor FROM quartos WHERE modo='paciente'").all();
const servList = Object.keys(SERVICOS);
const atendentesPorSetor = { hotelaria: "Ana (Hotel.)", limpeza: "Marcos (Limp.)", manutencao: "João (Manut.)", nutricao: "Rita (Nutr.)", enfermagem: "Enf. Paula", seguranca: "Vigilante Sérgio" };
const insCH = db.prepare(`INSERT INTO chamados (quarto_id, servico, setor_id, detalhe, origem, status, atendente, sla_min, criado_em, assumido_em, concluido_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const insAV = db.prepare("INSERT INTO avaliacoes (quarto_id, nota, contexto, comentario, em) VALUES (?,?,?,?,?)");
const insIV = db.prepare("INSERT INTO intervencoes (quarto_id, avaliacao_id, autor, acao, resolvido, em) VALUES (?,?,?,?,?,?)");

for (let d = 30; d >= 1; d--) {
  const base = agora - min(d * 1440); // d dias atrás
  const qtdDia = 8 + Math.floor(rnd() * 12); // 8-20 chamados/dia
  for (let k = 0; k < qtdDia; k++) {
    const q = pacHist[Math.floor(rnd() * pacHist.length)];
    const serv = servList[Math.floor(rnd() * servList.length)];
    const s = SERVICOS[serv];
    const criado = base + Math.floor(rnd() * min(600));
    // 88% concluídos; tempo de atendimento variável (às vezes estoura SLA)
    const conclui = rnd() < 0.9;
    const fator = rnd() < 0.75 ? 0.5 + rnd() * 0.4 : 1.1 + rnd() * 0.8; // maioria dentro do SLA
    const tempo = Math.round(s.sla * fator);
    const assumido = criado + min(Math.round(tempo * 0.3));
    const concluido = conclui ? criado + min(tempo) : null;
    insCH.run(q.id, serv, s.setor, "", rnd() < 0.85 ? "paciente" : "acompanhante", conclui ? "concluido" : "aberto", conclui ? atendentesPorSetor[s.setor] : null, s.sla, criado, conclui ? assumido : null, concluido);
  }
  // 3-6 avaliações/dia, tendência levemente melhorando
  const qtdAv = 3 + Math.floor(rnd() * 4);
  for (let k = 0; k < qtdAv; k++) {
    const q = pacHist[Math.floor(rnd() * pacHist.length)];
    const boa = rnd() < (0.55 + (30 - d) * 0.01); // melhora ao longo do tempo
    const nota = boa ? 8 + Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 5);
    const em = base + Math.floor(rnd() * min(720));
    const info = insAV.run(q.id, nota, "geral", nota <= 6 ? "precisa de atenção" : "", em);
    if (nota <= 6 && rnd() < 0.8) insIV.run(q.id, info.lastInsertRowid, "Cleide Rodrigues", "Fui ao leito e resolvi a questão", 1, em + min(20));
  }
}

const total = db.prepare("SELECT COUNT(*) n FROM quartos").get().n;
console.log(`Seed concluído. ${total} leitos · ${SETORES_IDS.length} setores · cardápio semanal carregado.`);
console.log("\nLogins (senha natus123):");
console.log("  admin       -> vê tudo (Direção/TI)");
console.log("  concierge   -> torre de experiência");
for (const sid of SETORES_IDS) console.log(`  ${sid.padEnd(11)} -> monitor do setor`);
console.log("\nTokens de quarto (QR) — exemplos:");
for (const r of db.prepare("SELECT id, modo, token FROM quartos ORDER BY id LIMIT 4").all()) console.log(`  ${r.id.padEnd(9)} ${r.modo.padEnd(12)} -> /p/${r.token}`);
