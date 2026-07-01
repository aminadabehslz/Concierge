# Concierge · Natus Lumine — Piloto funcional

App de concierge hospitalar com **duas frentes** sobre um mesmo backend:

- **Paciente** (celular, acesso por QR Code do quarto): abre pedidos de hotelaria/limpeza/manutenção, acompanha o status em tempo real, responde NPS.
- **Equipe / Concierge** (desktop, login): painel com a fila de chamados em tempo real, SLA, atribuição de responsável, conclusão, ouvidoria e carga por equipe.

> Desenvolvido pela **hosppital**. Marca-cliente: **Natus Lumine Hospital e Maternidade**.

## O que torna este um piloto "de verdade"

| Capacidade | Como |
|---|---|
| **Persistência** | Banco **SQLite** em arquivo (`server/data.db`). Os dados sobrevivem a reinício do servidor. |
| **Tempo real multiusuário** | **WebSocket**: um pedido aberto no celular aparece na hora em todos os painéis abertos; quando a equipe atende, o celular do paciente atualiza sozinho. |
| **Login / perfis** | Autenticação real com sessão por token. Perfis `concierge` e `lideranca`. |
| **Acesso do paciente por QR** | Cada quarto tem um **token** próprio; a URL `/p/<token>` é o que vai no QR Code colado na porta. |
| **Auditoria** | Toda transição de chamado grava um evento (autor, horário, tipo). |

Integração com o HIS **SPDATA** fica para a fase seguinte (este piloto roda autônomo).

## Arquitetura

```
concierge-piloto/
├── server/            API Express + WebSocket + SQLite (Node 22, sem dep de banco)
│   ├── src/db.js      schema e helpers
│   ├── src/seed.js    popula quartos (com tokens), usuários e chamados
│   └── src/index.js   API REST + WS + serve o front buildado
└── web/               Front React (Vite)
    └── src/           Painel.jsx (equipe) · Paciente.jsx (mobile) · api.js (REST+WS)
```

## Como rodar (do zero)

Requer **Node.js 22+** (usa o SQLite nativo embutido).

```bash
# 1. Backend
cd server
npm install
npm run seed        # cria o banco e imprime os tokens de quarto + logins

# 2. Frontend (build)
cd ../web
npm install
npm run build       # gera web/dist, que o backend serve automaticamente

# 3. Subir tudo (um processo serve API + front)
cd ../server
npm start           # http://localhost:3000
```

- **Painel da equipe:** abra `http://localhost:3000/`
  Login do piloto: `concierge` / `natus123` (ou `lideranca` / `natus123`).
- **App do paciente:** abra `http://localhost:3000/p/<token-do-quarto>`
  Os tokens são impressos pelo `npm run seed`. Em produção, cada token vira um QR Code colado na porta do quarto.

### Desenvolvimento (hot reload do front)

```bash
# terminal 1
cd server && npm start
# terminal 2
cd web && npm run dev      # http://localhost:5173 (proxy para a API/WS na :3000)
```

## Demonstração de 30 segundos

1. Abra o **painel** (`/`) num monitor e o **app do paciente** (`/p/<token>`) no celular (mesma rede) ou em outra aba.
2. No celular, peça **"Água ou copo"** → o chamado aparece na fila do painel com destaque (flash amarelo) e o selo "ao vivo" pisca.
3. No painel, clique **Assumir → Cleide Rodrigues** → o status muda; o celular do paciente reflete "Em atendimento" sozinho.
4. **Concluir** no painel → fecha dos dois lados e entra no tempo médio.
5. No celular, dê um **NPS ≤ 6** → uma tratativa abre automaticamente no bloco **Ouvidoria** do painel.

## Para colocar um andar no ar (deploy do piloto)

O app é um único servidor Node servindo API + front, então qualquer um destes serve:

- **Servidor local no andar** (um mini-PC ou Raspberry na rede do hospital): rode `npm start` e aponte os QR Codes para `http://<ip-do-servidor>:3000/p/<token>`.
- **Nuvem** (Railway, Render, Fly.io): suba o repo; defina `PORT` e um volume persistente para o `data.db`.

### Pendências conhecidas antes de produção real
- Trocar senhas em claro por **hash** (bcrypt/argon2) e mover usuários para cadastro administrável.
- HTTPS (obrigatório para câmera/QR em celulares e para `wss://`).
- Tokens de quarto rotacionáveis (trocar quando o paciente recebe alta).
- LGPD: o painel exibe nome do paciente — restringir por perfil e registrar consentimento.
- Integração SPDATA para popular quartos/pacientes automaticamente (admissão/alta).
```
