import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, "..", "data.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quartos (
      id TEXT PRIMARY KEY,
      paciente TEXT,
      setor TEXT,           -- setor clínico (ex.: UNI Adulto Rosa)
      andar TEXT,
      posto TEXT,
      acomod TEXT,
      modo TEXT DEFAULT 'paciente',     -- paciente | acompanhante
      tipo_dieta TEXT DEFAULT 'branda',
      suite INTEGER DEFAULT 0,
      zerado_em INTEGER DEFAULT 0,
      token TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      nome TEXT NOT NULL,
      perfil TEXT NOT NULL,    -- admin | concierge | setor
      setor_id TEXT            -- preenchido quando perfil = setor
    );

    CREATE TABLE IF NOT EXISTS chamados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quarto_id TEXT NOT NULL REFERENCES quartos(id),
      servico TEXT NOT NULL,
      setor_id TEXT NOT NULL,            -- destino (roteado)
      detalhe TEXT DEFAULT '',
      origem TEXT DEFAULT 'paciente',    -- paciente | acompanhante | equipe
      status TEXT NOT NULL DEFAULT 'aberto', -- aberto | em_atendimento | concluido | cancelado
      atendente TEXT,
      sla_min INTEGER NOT NULL,
      criado_em INTEGER NOT NULL,
      assumido_em INTEGER,
      concluido_em INTEGER
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chamado_id INTEGER REFERENCES chamados(id),
      tipo TEXT NOT NULL,
      autor TEXT,
      detalhe TEXT,
      em INTEGER NOT NULL
    );

    -- Avaliações de experiência (dinâmicas: várias por leito ao longo da internação)
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quarto_id TEXT NOT NULL REFERENCES quartos(id),
      nota INTEGER NOT NULL,        -- 0..10
      contexto TEXT,                -- ex.: 'geral', 'refeicao', 'pos_chamado'
      comentario TEXT,
      em INTEGER NOT NULL
    );

    -- Intervenções do concierge (registro rápido ao atuar numa nota baixa)
    CREATE TABLE IF NOT EXISTS intervencoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quarto_id TEXT NOT NULL REFERENCES quartos(id),
      avaliacao_id INTEGER REFERENCES avaliacoes(id),
      autor TEXT,
      acao TEXT,                    -- o que fez
      resolvido INTEGER DEFAULT 1,
      em INTEGER NOT NULL
    );

    -- Cardápio semanal por tipo de dieta (Nutrição alimenta)
    -- chave: tipo_dieta + dia_semana (0=Dom..6=Sáb) + refeicao
    CREATE TABLE IF NOT EXISTS cardapio (
      tipo_dieta TEXT NOT NULL,
      dia_semana INTEGER NOT NULL,
      refeicao TEXT NOT NULL,       -- cafe | almoco | lanche | jantar
      hora TEXT,
      itens TEXT,
      PRIMARY KEY (tipo_dieta, dia_semana, refeicao)
    );

    CREATE INDEX IF NOT EXISTS idx_chamados_setor ON chamados(setor_id);
    CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
    CREATE INDEX IF NOT EXISTS idx_aval_quarto ON avaliacoes(quarto_id);
  `);
}

export function getChamado(id) {
  return db.prepare("SELECT * FROM chamados WHERE id = ?").get(id);
}

// snapshot geral (admin/concierge veem tudo; ignora chamados anteriores à alta)
export function snapshot() {
  return {
    quartos: db.prepare("SELECT id, paciente, setor, andar, posto, acomod, modo, tipo_dieta, suite FROM quartos ORDER BY id").all(),
    chamados: db.prepare(`SELECT c.* FROM chamados c JOIN quartos q ON q.id=c.quarto_id
                          WHERE c.criado_em > COALESCE(q.zerado_em,0) ORDER BY c.criado_em DESC LIMIT 400`).all(),
    avaliacoes: db.prepare(`SELECT a.* FROM avaliacoes a JOIN quartos q ON q.id=a.quarto_id
                            WHERE a.em > COALESCE(q.zerado_em,0) ORDER BY a.em DESC LIMIT 200`).all(),
    intervencoes: db.prepare(`SELECT i.* FROM intervencoes i JOIN quartos q ON q.id=i.quarto_id
                              WHERE i.em > COALESCE(q.zerado_em,0) ORDER BY i.em DESC LIMIT 200`).all(),
  };
}

// snapshot de um setor específico (monitor do setor)
export function snapshotSetor(setor_id) {
  return {
    setor_id,
    chamados: db.prepare(`SELECT c.* FROM chamados c JOIN quartos q ON q.id=c.quarto_id
                          WHERE c.setor_id = ? AND c.criado_em > COALESCE(q.zerado_em,0)
                          ORDER BY c.criado_em DESC LIMIT 200`).all(setor_id),
  };
}
