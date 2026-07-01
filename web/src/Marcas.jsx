import { C, HP } from "./tema";

export function SimboloNatus({ s = 34 }) {
  const u = s / 3, g = s * 0.04, m = s / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <g transform={`rotate(45 ${m} ${m})`}>
        <rect x={m - u - g} y={m - u - g} width={u} height={u} rx={u * 0.12} fill={C.amarelo} />
        <rect x={m + g} y={m - u - g} width={u} height={u} rx={u * 0.12} fill={C.teal} />
        <rect x={m - u - g} y={m + g} width={u} height={u} rx={u * 0.12} fill={C.teal} />
        <rect x={m + g} y={m + g} width={u} height={u} rx={u * 0.12} fill={C.petroleoEsc} />
      </g>
    </svg>
  );
}

export function MarcaNatus({ s = 20, claro, vertical }) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: vertical ? s * 0.5 : s * 0.55 }}>
      <SimboloNatus s={s * 1.5} />
      <div style={{ lineHeight: 1, textAlign: vertical ? "center" : "left" }}>
        <div style={{ fontWeight: 800, fontSize: s, letterSpacing: "0.02em", color: claro ? "#fff" : C.petroleo }}>NATUS LUMINE</div>
        <div style={{ fontWeight: 700, fontSize: s * 0.4, letterSpacing: "0.2em", marginTop: s * 0.12, color: claro ? C.tealNevoa : C.teal }}>HOSPITAL E MATERNIDADE</div>
      </div>
    </div>
  );
}

export function SeloHosppital({ compacto = false }) {
  const s = 15;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {!compacto && <span style={{ fontSize: 11, fontWeight: 600, color: C.tinta60 }}>Desenvolvido pela</span>}
      <div style={{ display: "flex", alignItems: "center", gap: s * 0.3 }}>
        <svg width={s * 1.05} height={s * 1.05} viewBox="0 0 48 48">
          <rect x="6" y="6" width="36" height="36" rx="11" fill={HP.azulClaro} />
          <path d="M14 12 h9 v15 a9 9 0 0 1 -9 9 z" fill={HP.azul} />
          <rect x="25" y="12" width="9" height="24" rx="3.5" fill={HP.azul} />
          <rect x="25" y="12" width="9" height="9" rx="3.5" fill={HP.azulEsc} />
        </svg>
        <span style={{ fontWeight: 800, fontSize: s, letterSpacing: "-0.02em", color: HP.tinta }}>
          hos<span style={{ color: HP.azul }}>pp</span>ital
        </span>
      </div>
    </div>
  );
}
