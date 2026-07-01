// ============================================================
//  Configuração de domínio — Concierge Natus Lumine
//  Setores (destinatários), serviços (com SLA e roteamento) e
//  tipos de dieta. Tudo parametrizável.
// ============================================================

// Setores que possuem MONITOR próprio (TV no setor) e recebem chamados.
export const SETORES = {
  hotelaria:   { nome: "Hotelaria",            cor: "#0F6A88" },
  limpeza:     { nome: "Limpeza / Higiene",    cor: "#1B9E6B" },
  manutencao:  { nome: "Manutenção",           cor: "#E8920C" },
  nutricao:    { nome: "Nutrição",             cor: "#C0399B" },
  enfermagem:  { nome: "Enfermagem / Liderança", cor: "#7A5AF8" },
  seguranca:   { nome: "Segurança",            cor: "#D64545" },
};
export const SETORES_IDS = Object.keys(SETORES);

// Serviços que o paciente/acompanhante pode solicitar.
// sla = minutos; setor = roteamento automático (vai direto ao monitor do setor).
export const SERVICOS = {
  agua:        { titulo: "Água ou copo",                 desc: "Repor água, gelo, copo",            sla: 15, setor: "nutricao" },
  hotelaria:   { titulo: "Roupa de cama e toalhas",      desc: "Troca de enxoval, travesseiros",    sla: 45, setor: "hotelaria" },
  limpeza:     { titulo: "Limpeza do quarto",            desc: "Algo derramou, lixo, banheiro",     sla: 30, setor: "limpeza" },
  manutencao:  { titulo: "Algo não funciona",            desc: "TV, ar, luz, tomada, cama",         sla: 60, setor: "manutencao" },
  refeicao:    { titulo: "Sobre a refeição / dieta",     desc: "Dúvida ou ajuste com a nutrição",   sla: 40, setor: "nutricao" },
  ajuda:       { titulo: "Falar com a equipe",           desc: "Dúvida, dor, apoio da enfermagem",  sla: 20, setor: "enfermagem" },
  seguranca:   { titulo: "Segurança",                    desc: "Algo me preocupa no ambiente",      sla: 15, setor: "seguranca" },
};
export const SERVICOS_IDS = Object.keys(SERVICOS);

// No modo acompanhante (UTI/Neonatal): foco em apoio ao familiar.
export const SERVICOS_ACOMPANHANTE = ["ajuda", "limpeza", "manutencao", "seguranca"];

// Tipos de dieta — Nutrição cadastra o cardápio semanal de cada um.
export const TIPOS_DIETA = {
  livre:        "Dieta livre",
  branda:       "Dieta branda",
  hipossodica:  "Dieta hipossódica",
  diabetica:    "Dieta para diabético",
  liquida:      "Dieta líquida",
  pos_parto:    "Pós-parto / puérpera",
  pediatrica:   "Pediátrica",
};
export const TIPOS_DIETA_IDS = Object.keys(TIPOS_DIETA);

// Dieta padrão sugerida por setor (enquanto não há prescrição específica).
export function dietaPadraoDoSetor(setor) {
  if (/Verde|Rosa/.test(setor || "")) return "pos_parto";
  if (/Pediátric|Pediatric|PED/.test(setor || "")) return "pediatrica";
  return "branda";
}

// Avaliação de experiência (não "NPS"): faixas para o termômetro do leito.
export function faixaExperiencia(nota) {
  if (nota == null) return "sem";
  if (nota <= 6) return "ruim";      // dispara intervenção do concierge
  if (nota <= 8) return "neutra";
  return "boa";
}
