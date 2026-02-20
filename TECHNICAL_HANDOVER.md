# 📘 Technical Handover: TimeSheet Intelligence Portal

**Projeto:** Dashboard de Análise Estratégica de Timesheet
**Versão:** 1.0 (MVP)
**Stack:** React + Vite + TailwindCSS v4

---

## 🏗 Arquitetura & Stack

O projeto foi construído como uma **SPA (Single Page Application)** moderna, priorizando performance e facilidade de manutenção.

### Core Stack

- **Framework:** React 19 (`react`, `react-dom`)
- **Build Tool:** Vite 7.3 (`vite`)
- **Linguagem:** TypeScript (Strict mode)
- **Rotas:** React Router v7 (`react-router-dom`)
- **Deploy Target:** Static Hosting (Netlify/Vercel/S3)

### UI & Styling

- **CSS Engine:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Design System:** Configurado customizads para seguir o **Brandbook Poletto & Possamai** (Fontes `Texta`, Cores Hex exatas).
- **Ícones:** Lucide React (`lucide-react`)
- **Gráficos:** Recharts (`recharts`) - Wrapper responsivo sobre D3.js.

### Inteligência Artificial (AI)

- **Provider:** Google Gemini API (`@google/generative-ai`)
- **Modelo:** `gemini-1.5-flash` (Otimizado para latência e custo).
- **Integração:** Client-side fetch direto via API Key (para MVP).
- **Resiliência e Fallback**: Arquitetura robusta implementada em `src/services/gemini.ts` que gerencia automaticamente a troca de modelos em caso de falha ou cota excedida.
  - Prioridade 1: `gemini-2.5-flash` (Melhor qualidade)
  - Prioridade 2: `gemini-2.5-flash-lite` (Backup de cota)
  - Prioridade 3: `gemini-1.5-flash` (Legado)
  - Último recurso: Mock local (Offline)
- **Integração Google Sheets**: Backend serverless para auditoria via Google Apps Script. Mode" em caso de Rate Limit (429).

---

## 📂 Estrutura do Projeto

```
src/
├── assets/        # Fontes (Texta), Imagens e Brandbook
├── components/    # Componentes reutilizáveis (Cards, Clocks, etc.)
├── data/          # Camada de Dados (atualmente data.json local)
├── views/         # Páginas da aplicação (Route components)
│   ├── Home.tsx            # Landing Page Institucional
│   ├── GeneralDashboard.tsx # Visão Geral (Legado/Migrado)
│   ├── CollaboratorView.tsx # Jornada do Colaborador (Deep Dive)
│   ├── ClientView.tsx       # Raio-X do Cliente
│   └── AIView.tsx           # Interface de Chat com Gemini
├── App.tsx        # Configuração de Rotas e Layout Base
└── main.tsx       # Entry point
```

## 🔌 Guia de Integração (Hub de Tecnologia)

Para integrar este dashboard ao Hub de Tecnologia do escritório, recomendamos uma das seguintes abordagens:

### Opção 1: Micro-Frontend (Recomendado)

Como o projeto é construído com Vite, ele pode ser facilmente exportado como um módulo ou montado em uma sub-rota do Hub principal.

- **Build:** `npm run build`
- **Output:** Pasta `dist/` (estática).
- **Deploy:** Servir a pasta `dist` em uma rota `/dashboard-timesheet` do seu servidor Nginx/Apache/Vercel.

### Opção 2: Iframe

Se o Hub for uma aplicação monolítica legada, o deploy isolado (ex: no Netlify) pode ser consumido via Iframe seguro.

```html
<iframe src="https://dashboard-poletto.netlify.app" width="100%" height="800px" frameborder="0"></iframe>
```

### Opção 3: Component Library

Se o Hub também for React, os componentes de visualização (`charts`) podem ser migrados para a base de código principal.

---

## ⚠️ Pontos de Atenção para Devs

1. **Chave de API (Gemini):**
    Atualmente a chave está exposta no build client-side (`VITE_GEMINI_API_KEY`).
    - **Próximo Passo (Segurança):** Para produção em larga escala, mover a chamada para um **Proxy Backend** (Node.js/Python) para ocultar a chave e gerenciar rate limits centralizadamente.

2. **Dados (JSON vs API):**
    O dashboard consome `src/data/data.json`.
    - **Próximo Passo (ETL):** Automatizar a geração deste JSON a partir do banco de dados do Timesheet (SQL/Excel) via script Python/Node diário.

3. **Tailwind v4:**
    Note que usamos a versão 4 (alpha/beta features via plugin Vite). A configuração de tema fica no arquivo CSS (`index.css` com diretiva `@theme`), não mais apenas em `tailwind.config.js`.

---

## 🚀 Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
# Crie um arquivo .env na raiz com:
# VITE_GEMINI_API_KEY=sua_chave_aqui

# 3. Rodar servidor de desenvolvimento
npm run dev
```

---
*Documentação gerada automaticamente por Antigravity Agent em 07/01/2026.*
