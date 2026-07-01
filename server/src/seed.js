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
insU.run("admin", "natus123", "Administração", "admin", null);
insU.run("direcao", "natus123", "Direção", "direcao", null);
insU.run("concierge", "natus123", "Concierge", "concierge", null);
// um login por setor (monitor)
const nomesSetor = { hotelaria: "Hotelaria", limpeza: "Limpeza", manutencao: "Manutenção", nutricao: "Nutrição", enfermagem: "Enfermagem", seguranca: "Segurança" };
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

// ---- Sem movimento fictício: sistema começa limpo, pronto para uso real ----
// (chamados, avaliações e intervenções nascem do uso real do sistema)

const total = db.prepare("SELECT COUNT(*) n FROM quartos").get().n;
console.log(`Seed concluído. ${total} leitos · ${SETORES_IDS.length} setores · cardápio semanal carregado.`);
console.log("\nLogins (senha natus123):");
console.log("  admin       -> vê tudo (Direção/TI)");
console.log("  concierge   -> torre de experiência");
for (const sid of SETORES_IDS) console.log(`  ${sid.padEnd(11)} -> monitor do setor`);
console.log("\nTokens de quarto (QR) — exemplos:");
for (const r of db.prepare("SELECT id, modo, token FROM quartos ORDER BY id LIMIT 4").all()) console.log(`  ${r.id.padEnd(9)} ${r.modo.padEnd(12)} -> /p/${r.token}`);
