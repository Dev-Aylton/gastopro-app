# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (**Single Page Application**) de gestão financeira pessoal com Dashboard de Saúde Financeira, gerenciamento completo de receitas e despesas, rastreamento de dívidas e PWA para uso offline. Desenvolvido em HTML5, CSS3 e JavaScript puro.

![Status do Projeto](https://img.shields.io/badge/Status-Concluído-10b981?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Tecnologias-HTML5%20%7C%20CSS3%20%7C%20JS%20ES6%20%7C%20Chart.js-6366f1?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-0ea5e9?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-50%2B%20casos-10b981?style=for-the-badge)

---

## 👨‍💻 Sobre o Projeto & Autor

O **GastoPro** foi idealizado e desenvolvido por **Aylton Alberto**, estudante do curso de **Análise e Desenvolvimento de Sistemas (ADS)**. O projeto nasceu da necessidade real de transformar uma planilha complexa de controle orçamentário pessoal em uma aplicação web interativa, elegante, visual e sem atrito para o dia a dia.

O app é **100% client-side**: nenhum dado pessoal sai do dispositivo do usuário — tudo é armazenado no `localStorage` do próprio navegador.

---

## ✨ Principais Funcionalidades

1. **Dashboard & Diagnóstico de Saúde Financeira**
   - Resumo em tempo real dos 4 KPIs: **Total Recebido**, **Gastos Fixos**, **Gastos Variáveis** e **Saldo Livre**.
   - Barra de diagnóstico visual baseada na metodologia **50/30/20** (Fixos, Variáveis e Poupança).
   - Cálculo automático da sobra média disponível por dia até o final do mês.

2. **Centro de Dívidas & Previsão de Quitação**
   - Rastreamento dinâmico de parcelamentos, empréstimos e financiamentos.
   - Barras de progresso com contagem regressiva de parcelas e previsão de quitação.
   - Cálculo automático do saldo devedor total.

3. **Gerenciador Completo de Ganhos (CRUD)**
   - Listagem detalhada, cadastro rápido, edição e exclusão de receitas.
   - Suporte a categorias: Salário, Adiantamento, Renda Extra, Rendimentos, Outros.

4. **Gerenciador de Gastos & Gastos Fixos Recorrentes**
   - Gastos fixos repetem automaticamente nos meses subsequentes enquanto ativos.
   - Baixa de pagamento (**Pago/Pendente**) independente e específica por mês.
   - Status **Ativo/Inativo** para pausar despesas temporariamente sem excluí-las.
   - Filtros rápidos: Todos / Fixos & Dívidas / Variáveis.

5. **Navegação Inteligente de Meses**
   - Setas de navegação rápida mês a mês (com virada automática de ano).
   - **Mini Calendário Popover**: selecione qualquer mês/ano diretamente.
   - Indicador visual de meses com dados cadastrados.

6. **Painel do Usuário (Offcanvas Drawer)**
   - Personalização de nome e foto de perfil (armazenada em Base64).
   - Exportação de backup completo em JSON.
   - Reset completo com confirmação de segurança.

7. **PWA (Progressive Web App)**
   - Instalável como app nativo no celular ou desktop.
   - Funciona offline com Service Worker (estratégia Network First + Cache Fallback).

---

## 📁 Estrutura de Arquivos

```
financeiro-app/
│
├── index.html              # Estrutura SPA: sidebar, topbar, telas, modais e footer
├── manifest.json           # Manifesto PWA (nome, ícones, cores, orientação)
├── sw.js                   # Service Worker (cache offline e atualização automática)
│
├── assets/
│   ├── logo.jpg            # Logotipo do app (usado no header e favicon)
│   └── default_avatar.jpg  # Avatar padrão do usuário
│
├── css/
│   └── style.css           # Design System completo: dark mode, variáveis CSS, animações
│
├── js/
│   ├── data.js             # Camada de Dados: CRUD no localStorage (Model)
│   └── app.js              # Controller: lógica, renderização, eventos e gráficos
│
├── tests/
│   ├── gastopro.test.js    # Suite de testes (50+ casos, vanilla JS, sem framework)
│   └── test-runner.html    # Página de execução dos testes no navegador
│
└── README.md               # Esta documentação
```

---

## 🛠️ Arquitetura do Código

### `index.html` — Camada de Visão (View)

Construído com semântica HTML5 e padrão SPA. Três seções principais controladas por CSS:

| Seção | ID | Descrição |
|---|---|---|
| Dashboard | `#view-dashboard` | KPIs, saúde financeira, dívidas e gráfico |
| Ganhos | `#view-incomes` | Formulário e lista de receitas |
| Gastos | `#view-expenses` | Formulário, filtros e lista de despesas |

Modais e Drawers são nativos, controlados via classes `.active` / `.open`.

---

### `css/style.css` — Design System

- **Variáveis CSS (`:root`)**: paleta completa (*Slate*, *Indigo*, *Emerald*, *Amber*, *Rose*), raios de borda e sombras.
- **Animações**: `@keyframes viewFadeInSmooth` com `cubic-bezier(0.16, 1, 0.3, 1)` para transições de tela.
- **Layout**: Flexbox + CSS Grid responsivo (mobile, tablet, desktop, ultra-wide).
- **Dark Mode**: nativo, sem toggle necessário.

---

### `js/data.js` — Camada de Dados (Model)

Objeto singleton `FinanceData` — **única camada** que acessa o `localStorage`.

**Chaves de armazenamento:**

| Chave | Conteúdo |
|---|---|
| `gastopro_entries_clean_v1` | Lançamentos pontuais (ganhos e variáveis) |
| `gastopro_fixed_templates_v1` | Templates de gastos fixos recorrentes |
| `gastopro_user_profile_v2` | Perfil do usuário (nome e avatar Base64) |

**Roteamento por prefixo de ID:**
- `entry-*` → Lançamentos pontuais (um por mês)
- `fix-*` → Templates fixos (projetados em todos os meses do período)

**API do FinanceData:**

| Método | Descrição |
|---|---|
| `getEntries()` | Lê lançamentos pontuais do localStorage |
| `getTemplates()` | Lê templates de gastos fixos |
| `getByMonth(ym)` | Retorna itens do mês (pontuais + projeções fixas) |
| `getAll()` | Retorna todos os itens (busca geral e calendário) |
| `add(item)` | Insere lançamento ou template conforme o tipo |
| `update(id, fields)` | Atualiza campos de um item existente |
| `togglePaid(id, ym)` | Inverte o status de pagamento por mês |
| `toggleActive(id)` | Pausa/reativa um template fixo |
| `delete(id)` | Remove permanentemente um item |
| `clearAll()` | Apaga todos os dados (requer confirmação) |
| `exportJSON()` | Dispara download do backup em JSON |
| `getProfile()` / `saveProfile()` | Lê/salva perfil do usuário |

**Esquema de dados — Lançamento Pontual:**
```json
{
  "id":       "entry-1730000000000-a1b2",
  "month":    "2026-11",
  "type":     "income",
  "desc":     "Salário",
  "amount":   3500.00,
  "category": "Salário",
  "paid":     true,
  "date":     "2026-11-05"
}
```

**Esquema de dados — Template de Gasto Fixo:**
```json
{
  "id":         "fix-1730000000000-c3d4",
  "desc":       "Aluguel & Condomínio",
  "amount":     1350.00,
  "category":   "Moradia",
  "type":       "fixed",
  "isDebt":     false,
  "active":     true,
  "startMonth": "2026-01",
  "endMonth":   null,
  "day":        "05",
  "date":       "2026-01-05",
  "paidMonths": { "2026-11": true }
}
```

---

### `js/app.js` — Controller Principal

Organizado em 15 seções documentadas com JSDoc:

| Seção | Função Principal |
|---|---|
| Estado Global | `state` — mês ativo, tela atual, filtro, instância do gráfico |
| Utilitários | `formatCurrency()`, `formatDate()`, `escapeHtml()`, `showToast()` |
| Navegação SPA | `switchToView()` — troca de telas com animação |
| Orquestrador | `renderAll()` — recalcula e repinta tudo |
| Dashboard | `renderDashboardView()`, `renderHealthDiagnostic()` |
| Dívidas | `renderDebtCenter()` — rastreamento automático |
| Gráfico | `renderCategoryChart()` — Chart.js doughnut |
| Ganhos/Gastos | `renderIncomesView()`, `renderExpensesView()` |
| Modal Edição | `openEditModal()`, `closeEditModal()` |
| Confirmação | `showConfirm()` — substitui o `confirm()` nativo |
| Ações | `deleteEntry()`, `togglePaidEntry()`, `toggleActiveStatus()` |
| Calendário | `renderMonthPicker()`, `selectMonthFromPicker()` |
| Bootstrap | Inicialização e todos os `addEventListener` |

---

## 🧪 Testes Automatizados

O projeto inclui uma **suite de testes** com mais de **50 casos de teste** escritos em JavaScript puro (sem frameworks externos).

### Como executar

1. Abra o arquivo [`tests/test-runner.html`](tests/test-runner.html) no Chrome ou Edge (via Live Server ou duplo clique).
2. Os testes rodam automaticamente e exibem o resultado na tela.
3. Detalhes completos (✅/❌ por teste) aparecem no **Console do Navegador (F12)**.

> ⚠️ **Isolamento**: Os testes usam um mock do `localStorage` — **seus dados reais não são afetados**.

### Cobertura dos testes

| Suite | O que é testado |
|---|---|
| `FinanceData — Lançamentos` | getEntries, saveEntries, purga de dados de teste |
| `FinanceData — Templates` | getTemplates, saveTemplates |
| `FinanceData — add()` | Inserção de income, variable, fixed, debt |
| `FinanceData — addTemplate()` | active, paidMonths, isDebt, startMonth |
| `FinanceData — getByMonth()` | Projeção de templates, filtro por período |
| `FinanceData — update()` | Lançamentos, templates, sincronização do campo day |
| `FinanceData — togglePaid()` | Baixa por mês isolado, templates e lançamentos |
| `FinanceData — toggleActive()` | Ativar/inativar, retorno correto |
| `FinanceData — delete()` | Exclusão isolada sem remover outros itens |
| `FinanceData — clearAll()` | Limpeza total |
| `FinanceData — exportJSON()` | Estrutura do backup |
| `FinanceData — Perfil` | getProfile, saveProfile, merge com defaults |
| `Utilitários` | formatCurrency, getYearMonthString, formatDate, escapeHtml |
| `Lógica de Negócio` | Totais, saldo, regra 50/30/20, paidMonths isolado por mês |

---

## 🚀 Como Executar Localmente

**Método 1 — Live Server (Recomendado):**
1. Instale a extensão **Live Server** no VS Code.
2. Clique com o botão direito em `index.html` → **"Open with Live Server"**.
3. O app abrirá em `http://127.0.0.1:5500/` com hot-reload.

**Método 2 — Direto no Navegador:**
1. Dê um duplo clique em `index.html`.
2. O app abre no Chrome, Edge ou Firefox.
> ⚠️ O Service Worker não funciona via `file://`, mas todas as outras funcionalidades são normais.

---

## 🌐 Como Publicar no GitHub Pages

### Passo 1 — Prepare o repositório

```bash
# Dentro da pasta financeiro-app, inicialize o repositório
git init
git add .
git commit -m "feat: GastoPro v2.4 - Release completo com testes"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gastopro.git
git push -u origin main
```

### Passo 2 — Configure o GitHub Pages

1. No repositório do GitHub, acesse **Settings → Pages**.
2. Em **Source**, selecione **Deploy from a branch**.
3. Em **Branch**, escolha `main` e `/ (root)`.
4. Clique em **Save**.
5. Em até 2 minutos, o link `https://SEU-USUARIO.github.io/gastopro/` estará no ar!

### Arquivo `.gitignore` recomendado

Crie um arquivo `.gitignore` na raiz do projeto com o seguinte conteúdo:

```
# Sistema operacional
.DS_Store
Thumbs.db

# Editores
.vscode/
*.swp

# Node (caso use ferramentas locais no futuro)
node_modules/
npm-debug.log
```

---

## 🧭 Guia de Expansão para o Futuro

Se você for evoluir este projeto acadêmico para um produto real:

### 1. Autenticação (Firebase Auth / Supabase Auth)
- Substitua o avatar local por "Entrar com Google".
- Capture o `user.uid` autenticado para isolar dados por usuário.

### 2. Banco de Dados em Nuvem (Cloud Firestore / Supabase)
- Em `data.js`, substitua `saveEntries()` por chamadas assíncronas à coleção `users/{uid}/entries`.
- A arquitetura já está preparada: basta trocar a implementação de persistência.

### 3. Exportação de Relatórios PDF
- Use `jspdf` ou `html2pdf.js` para gerar relatórios mensais formatados.

### 4. Notificações de Contas a Vencer
- Use a Web Notifications API para alertar sobre contas fixas próximas do vencimento.

### 5. Multi-usuário / Família
- Adicione suporte a múltiplos perfis com separação de dados por chave no localStorage (curto prazo) ou banco de dados em nuvem (longo prazo).

---

## 📜 Licença

Desenvolvido por **Aylton Alberto** • Estudante de Análise e Desenvolvimento de Sistemas (ADS).  
Projeto livre para fins educacionais e estudo de arquitetura web front-end.



1. **Dashboard & Diagnóstico de Saúde Financeira**:
   - Resumo em tempo real dos 4 KPIs: **Total Recebido**, **Gastos Fixos**, **Gastos Variáveis** e **Saldo Livre / Sobra**.
   - Barra de diagnóstico visual baseada na metodologia **50 / 30 / 20** (Fixos, Variáveis e Poupança).
   - Cálculo automático da sobra média disponível por dia até o final do mês.
2. **Centro de Dívidas & Previsão de Quitação Dinâmico**:
   - Acompanhamento dinâmico de parcelamentos, empréstimos e financiamentos cadastrados pelo próprio usuário.
   - Barras de progresso com contagem regressiva de parcelas restantes e previsão de quitação.
3. **Gerenciador Completo de Ganhos**:
   - Listagem detalhada, cadastro rápido, edição e exclusão de receitas com totalizador instantâneo.
4. **Gerenciador de Gastos & Gastos Fixos Recorrentes**:
   - Gastos fixos repetem automaticamente nos meses subsequentes enquanto ativos.
   - Baixa de pagamento (**Pago / Pendente**) independente e específica por mês.
   - Status **Ativo / Inativo** para pausar despesas ou atualizar valores de faturas.
   - Filtros rápidos por tipo e categoria.
5. **Navegação Inteligente de Meses**:
   - Setas de navegação rápida mês a mês.
   - **Mini Calendário Popover**: clique direto no mês para viajar para qualquer mês ou ano (2026, 2027, 2028...) com indicador visual de dados presentes.
6. **Menu do Usuário (Offcanvas Drawer)**:
   - Drawer deslizante no topo direito com dados do perfil, exportação de backup JSON e restauração de dados originais.
7. **Privacidade Total & Offline First**:
   - Todos os dados ficam armazenados exclusivamente no dispositivo do usuário (`localStorage`), sem tráfego de informações pessoais para servidores de terceiros.

---

## 📁 Estrutura de Arquivos e Pastas

```bash
financeiro-app/
│
├── index.html          # Estrutura semântica SPA (Sidebar, Topbar, Views, Modal e Footer)
├── assets/
│   └── logo.jpg        # Logotipo oficial em alta resolução
├── css/
│   └── style.css       # Design System completo (Dark mode, variáveis CSS, transições fluidas)
├── js/
│   ├── data.js         # Camada de dados (localStorage CRUD e pré-carga de lançamentos reais)
│   └── app.js          # Controller principal (lógica, navegação, gráficos, cálculos e eventos)
└── README.md           # Documentação técnica para desenvolvedores
```

---

## 🛠️ Arquitetura do Código & Detalhes Técnicos

### 1. `index.html` (Visão / View)
- Construído segundo os padrões de acessibilidade e semântica HTML5.
- Utiliza **SPA (Single Page Application)** com contêineres `<section class="view-section">`:
  - `#view-dashboard`: Tela inicial com métricas, gráficos e saúde financeira.
  - `#view-incomes`: Tela dedicada à gestão de entradas e rendas.
  - `#view-expenses`: Tela dedicada à gestão de saídas, contas e parcelas.
- Modais e Drawers nativos controlados via classes CSS `.active` e `.open`.

### 2. `css/style.css` (Design System)
- **Variáveis CSS (`:root`)**: paleta de cores moderna (*Slate*, *Indigo*, *Emerald*, *Amber*, *Rose*), raios de borda e sombras consistentes.
- **Transição Suave (Smooth Transitions)**:
  - Utiliza animação por keyframes `@keyframes viewFadeInSmooth` com curva cúbica `cubic-bezier(0.16, 1, 0.3, 1)` para alternar entre telas com fluidez impecável.
- **Layout Flexbox e CSS Grid**: interface responsiva que se adapta automaticamente a telas de smartphones, tablets e monitores ultra-wide.

### 3. `js/data.js` (Camada de Dados / Model)
- Objeto singleton `FinanceData`:
  - `getAll()`: lê e faz parse do `localStorage` com tratamento de fallback.
  - `saveAll(entries)`: serializa e salva a lista completa de objetos no navegador.
  - `getByMonth(yearMonth)`: filtra lançamentos pelo formato de competência `YYYY-MM`.
  - `add(item)`: gera ID único com timestamp e insere novo lançamento.
  - `update(id, fields)`: localiza e atualiza campos de um lançamento existente.
  - `delete(id)`: remove um item pelo identificador único.
  - `togglePaid(id)`: inverte o status booleano `paid` (útil para contas fixas).
  - `exportJSON()`: gera download do arquivo `.json` para backup portátil.
  - `resetToDefault()`: recarrega a base oficial de 185 lançamentos da planilha original.

#### 📌 Esquema de um Lançamento (JSON Schema):
```json
{
  "id": "fix-2026-11-5",
  "month": "2026-11",
  "type": "fixed",         // "income" | "fixed" | "variable"
  "desc": "Aluguel & Condomínio",
  "amount": 1350.00,
  "category": "Moradia",
  "paid": false,           // true = conta quitada no mês
  "date": "2026-11-10"     // Formato ISO YYYY-MM-DD
}
```

### 4. `js/app.js` (Controlador / Controller)
- **Estado Global (`state`)**:
  - `currentView`: controla qual tela está ativa (`'dashboard'`, `'incomes'`, `'expenses'`).
  - `currentYear` e `currentMonth`: define o mês de competência atual exibido.
  - `expenseFilter`: filtro de despesas (`'all'`, `'fixed'`, `'variable'`).
  - `chartInstance`: guarda a instância ativa do **Chart.js** para destruição e recriação limpa ao alternar dados.
- **Funções Chave**:
  - `renderAll()`: orquestrador central de re-renderização reativa.
  - `switchToView(viewId)`: transição suave e atualização de títulos.
  - `renderCategoryChart()`: desenha o gráfico de rosca (doughnut) com legendas e tooltips customizadas.
  - `renderMonthPicker()`: constrói a grade interativa do mini calendário.

---

## 🚀 Como Executar o Projeto Localmente

1. **Clone o repositório** ou abra a pasta `financeiro-app` no seu **VS Code**.
2. **Método 1 (Recomendado)**:
   - Instale a extensão **Live Server** no VS Code.
   - Clique com o botão direito no arquivo `index.html` e selecione **"Open with Live Server"**.
3. **Método 2 (Direto no Navegador)**:
   - Dê um duplo clique no arquivo `index.html` para abrir diretamente no Google Chrome, Edge ou Firefox.

---

## 🌐 Como Publicar no GitHub Pages (Passo a Passo)

1. No terminal do VS Code (dentro da pasta `financeiro-app`):
   ```bash
   git init
   git add .
   git commit -m "feat: GastoPro v2.4 - Release Completo"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/gastopro.git
   git push -u origin main
   ```
2. No seu repositório no GitHub:
   - Acesse **Settings** > **Pages**.
   - Em **Source**, escolha **Deploy from a branch**.
   - Em **Branch**, selecione `main` e `/(root)`.
   - Clique em **Save**.
   - Em até 2 minutos, o link `https://SEU-USUARIO.github.io/gastopro/` estará no ar!

---

## 🧭 Guia de Expansão para o Futuro Desenvolvedor

Se você for evoluir este projeto acadêmico para um SaaS com múltiplos usuários na nuvem:

1. **Autenticação (Firebase Auth ou Supabase Auth)**:
   - Substitua o avatar local por um botão de "Entrar com Google".
   - Capture o `user.uid` autenticado.
2. **Banco de Dados em Nuvem (Cloud Firestore)**:
   - No `data.js`, em vez de salvar no `localStorage`, substitua `saveAll()` por chamadas assíncronas à coleção `users/{uid}/entries`.
3. **Exportação de Relatórios**:
   - Utilize bibliotecas leves como `jspdf` ou `html2pdf.js` para criar relatórios mensais formatados para impressão.
4. **PWA (Progressive Web App)**:
   - Adicione um `manifest.json` e um `service-worker.js` para permitir a instalação do site como aplicativo nativo no celular (com ícone na tela inicial).

---

## 📜 Licença

Desenvolvido por **Aylton Alberto** • Estudante de Análise e Desenvolvimento de Sistemas (ADS).  
Projeto livre para fins educacionais e estudo de arquitetura web front-end.
