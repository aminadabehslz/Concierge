export const C = {
  petroleo: "#0F6A88", petroleoEsc: "#0A5067", teal: "#3397AF", tealNevoa: "#E8F2F5",
  amarelo: "#F6EE0B", ambar: "#EFBC0C", tinta: "#0C2B36", tinta60: "#5B7079",
  linha: "#DDE7EA", verde: "#1B9E6B", vermelho: "#D64545", fundo: "#EEF4F6",
};
export const HP = { azul: "#1E7ADF", azulEsc: "#1560B8", azulClaro: "#AACBF4", tinta: "#131A35" };

export const SETORES = {
  hotelaria: { nome: "Hotelaria", cor: "#0F6A88" },
  limpeza: { nome: "Limpeza / Higiene", cor: "#1B9E6B" },
  manutencao: { nome: "Manutenção", cor: "#E8920C" },
  nutricao: { nome: "Nutrição", cor: "#C0399B" },
  enfermagem: { nome: "Enfermagem / Liderança", cor: "#7A5AF8" },
  seguranca: { nome: "Segurança", cor: "#D64545" },
};

export const SERVICOS = {
  agua: { titulo: "Água ou copo", desc: "Repor água, gelo, copo", sla: 15, setor: "hotelaria" },
  hotelaria: { titulo: "Roupa de cama e toalhas", desc: "Troca de enxoval, travesseiros", sla: 45, setor: "hotelaria" },
  limpeza: { titulo: "Limpeza do quarto", desc: "Algo derramou, lixo, banheiro", sla: 30, setor: "limpeza" },
  manutencao: { titulo: "Algo não funciona", desc: "TV, ar, luz, tomada, cama", sla: 60, setor: "manutencao" },
  refeicao: { titulo: "Sobre a refeição / dieta", desc: "Dúvida ou ajuste com a nutrição", sla: 40, setor: "nutricao" },
  ajuda: { titulo: "Falar com a equipe", desc: "Dúvida, dor, apoio da enfermagem", sla: 20, setor: "enfermagem" },
  seguranca: { titulo: "Segurança", desc: "Algo me preocupa no ambiente", sla: 15, setor: "seguranca" },
};
export const SERVICOS_IDS = Object.keys(SERVICOS);
export const SERVICOS_ACOMPANHANTE = ["ajuda", "limpeza", "manutencao", "seguranca"];

export const STATUS = {
  aberto: { label: "Aberto", cor: C.ambar },
  em_atendimento: { label: "Em atendimento", cor: C.petroleo },
  concluido: { label: "Concluído", cor: C.verde },
};

export function slaInfo(c) {
  const passados = Math.floor((Date.now() - c.criado_em) / 60000);
  if (c.status === "concluido") {
    const dur = c.concluido_em ? Math.floor((c.concluido_em - c.criado_em) / 60000) : passados;
    return { passados, dur, estourado: dur > c.sla_min, restante: 0 };
  }
  return { passados, estourado: passados > c.sla_min, restante: c.sla_min - passados };
}
export const fmtHora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// termômetro de experiência do leito a partir das avaliações
export function termometro(avaliacoes) {
  if (!avaliacoes.length) return { media: null, ultima: null, tendencia: "sem", faixa: "sem" };
  const ord = [...avaliacoes].sort((a, b) => a.em - b.em);
  const ultima = ord[ord.length - 1].nota;
  const media = avaliacoes.reduce((a, x) => a + x.nota, 0) / avaliacoes.length;
  let tendencia = "estável";
  if (ord.length >= 2) {
    const d = ultima - ord[ord.length - 2].nota;
    tendencia = d > 0 ? "subindo" : d < 0 ? "caindo" : "estável";
  }
  const faixa = ultima <= 6 ? "ruim" : ultima <= 8 ? "neutra" : "boa";
  return { media, ultima, tendencia, faixa };
}
