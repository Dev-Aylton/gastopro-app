# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (**Single Page Application — SPA**) de gestão financeira pessoal com Dashboard de Saúde Financeira, gerenciamento completo de receitas e despesas, rastreamento de dívidas, autenticação multi-usuário com Supabase, importação de extratos bancários, **Wizard de Lançamento Rápido** e PWA para uso offline.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-f59e0b?style=for-the-badge)
![Versão](https://img.shields.io/badge/Versão-3.3--parcial-6366f1?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Supabase-0ea5e9?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-f59e0b?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-50%2B%20casos-10b981?style=for-the-badge)


---

## 👨‍💻 Sobre o Projeto & Autor

O **GastoPro** foi idealizado e desenvolvido por **Aylton Alberto**, estudante do curso de **Análise e Desenvolvimento de Sistemas (ADS)**. O projeto nasceu da necessidade real de transformar uma planilha complexa de controle orçamentário pessoal em uma aplicação web interativa, elegante e segura.

A versão atual (v3.0) evoluiu de um app puramente local para um **SaaS multi-usuário com banco de dados em nuvem**, mantendo a simplicidade de uso e adicionando autenticação segura via Supabase.

---

## ✨ Funcionalidades Principais

### 📊 Dashboard & Saúde Financeira
- Resumo em tempo real dos 4 KPIs: **Total Recebido**, **Gastos Fixos**, **Gastos Variáveis** e **Saldo Livre**.
- Diagnóstico visual baseado na metodologia **50/30/20** com barras de progresso coloridas.
- Cálculo automático da **sobra média diária** até o fim do mês.
- Gráfico de rosca (doughnut) com distribuição de gastos por categoria via **Chart.js**.

### 💳 Centro de Dívidas & Previsão de Quitação
- Rastreamento dinâmico de parcelamentos, empréstimos e financiamentos.
- Barras de progresso com contagem regressiva de parcelas restantes.
- Cálculo automático do total devedor consolidado.
- Badge **"🎉 Quitada!"** automático ao quitar todas as parcelas.

### 💰 Gerenciador Completo de Ganhos (CRUD)
- Cadastro rápido, edição e exclusão de receitas.
- Categorias: Salário, Adiantamento, Renda Extra, Rendimentos, Outros.
- Lançamentos vinculados ao mês de competência da data informada.

### 🧾 Gerenciador de Gastos & Fixos Recorrentes
- Gastos fixos **repetem automaticamente** em todos os meses dentro do período definido.
- **Baixa de pagamento** independente por mês (não afeta outros meses).
- Toggle **Ativo/Inativo** para pausar despesas temporariamente sem excluí-las.
- Filtros rápidos: Todos / Fixos & Dívidas / Variáveis.

### 🗓️ Navegação Inteligente de Meses
- Setas de navegação rápida com virada automática de ano.
- **Mini Calendário Popover**: acesse qualquer mês/ano diretamente.
- Indicador visual de meses com dados cadastrados.

### 🔐 Autenticação & Sincronização Multi-Usuário (Supabase)
- Cadastro e login com **e-mail e senha**.
- Recuperação de senha via e-mail (**resetPasswordForEmail**).
- Dados isolados por usuário via **Row Level Security (RLS)** no PostgreSQL.
- Sincronização automática ao logar — dados carregados da nuvem.
- **Logout seguro**: limpa o localStorage local para proteger dados entre usuários no mesmo dispositivo.

### 👤 Painel do Usuário (Offcanvas Drawer)
- Personalização de nome e foto de perfil (Base64, até 2 MB).
- Status da conta: Conectado (Nuvem) ou Modo Local.
- Exportação de backup completo em JSON.
- Reset completo com confirmação de segurança.

### 📱 PWA (Progressive Web App)
- Instalável como app nativo no celular ou desktop.
- Funciona offline com Service Worker (Network First + Cache Fallback).

### 📥 Importação de Extratos Bancários (v3.1)
- **Upload de CSV**: Arraste e solte ou selecione um arquivo `.csv` para importação em lote.
- **Texto Bruto**: Cole diretamente o texto copiado do app ou site do banco.
- **Detecção automática de colunas**: O parser identifica colunas de Data, Descrição e Valor sem configuração manual.
- **Categorização automática**: +80 palavras-chave mapeiam automaticamente lançamentos para categorias (iFood → Alimentação, Spotify → Assinaturas, etc.).
- **Pré-visualização editável**: Revise, corrija categoria e tipo (Gasto/Receita) linha por linha antes de salvar.
- **Seleção granular**: Selecione ou desmarque lançamentos individualmente ou todos de uma vez.
- **Suporte a múltiplos formatos**: `DD/MM/AAAA Descrição R$ Valor`, `DD/MM Descrição Valor`, e outros padrões de extratos brasileiros.

### 🪄 Wizard de Lançamento Rápido (v3.2)
- **Fluxo guiado em 4 passos**: Renda → Gastos Fixos → Gastos Variáveis → Diagnóstico 50/30/20.
- **Passo 1 — Renda**: Adicione múltiplas fontes de renda (salário, freelance, etc.) com valor e data.
- **Passo 2 — Gastos Fixos**: Checklist dos gastos fixos **já cadastrados** no sistema + campo para adicionar novos.
- **Passo 3 — Gastos Variáveis**: Grid visual com 10 categorias (Alimentação, Mercado, Transporte...) + campo avulso.
- **Passo 4 — Resultado**: KPIs de Renda/Gastos/Saldo + barras animadas da regra 50/30/20 + diagnóstico textual inteligente.
- **Salvamento em lote**: Todos os dados são salvos de uma vez via `FinanceData.add()` com sincronização automática no Supabase.
- **Validação contextual**: Impede avançar sem informar renda; categoriza automaticamente gastos avulsos.
### 🧭 Navegação Lateral (Sidebar) & Sincronização
- **Indicadores em tempo real**: Badges numéricos com o total de receitas e despesas cadastradas no mês selecionado.
- **Ferramentas de produtividade**: Acesso direto ao **Importador de Extratos** e ao **Wizard de Lançamento Rápido**.
- **Botão Atualizar Dados**: Posicionado na base da barra lateral (rodapé da sidebar), permitindo sincronizar dados locais com o Supabase a qualquer momento com animação visual e feedback ao usuário.

## 📁 Estrutura de Arquivos

```
financeiro-app/
│
├── index.html              # Estrutura SPA: sidebar, topbar, telas, modais, auth modal e drawer
├── manifest.json           # Manifesto PWA (nome, ícones, cores, orientação)
├── sw.js                   # Service Worker (cache offline e atualização automática)
│
├── assets/
│   ├── logo.jpg            # Logotipo do app
│   └── default_avatar.jpg  # Avatar padrão do usuário
│
├── css/
│   └── style.css           # Design System completo: dark mode, variáveis CSS, animações
│
├── js/
│   ├── data.js             # Camada de Dados: CRUD local (localStorage) + sync cloud
│   ├── supabase.js         # Módulo Supabase: auth (email e senha) + CRUD PostgreSQL
│   ├── importer.js         # Módulo de Importação: parser CSV/Texto + categorização automática (v3.1)
│   └── app.js              # Controller: lógica, renderização, eventos, gráficos e auth
│
├── tests/
│   ├── gastopro.test.js    # Suite de testes (50+ casos, vanilla JS, sem framework)
│   └── test-runner.html    # Página de execução dos testes no navegador
│
└── README.md               # Esta documentação
```

---

## 🏗️ Arquitetura do Código

```
┌─────────────────────────────────────────────────────────┐
│                      index.html (View)                  │
│   SPA com 3 telas, auth modal, drawer e modais nativos  │
└───────────────────────┬─────────────────────────────────┘
                        │ eventos DOM
┌───────────────────────▼─────────────────────────────────┐
│                   js/app.js (Controller)                │
│   renderAll() · switchToView() · syncUserDataFromCloud() │
└───────────┬───────────────────────────┬─────────────────┘
            │ CRUD local                │ auth + cloud sync
┌───────────▼──────────┐   ┌───────────▼─────────────────┐
│    js/data.js        │   │      js/supabase.js          │
│  FinanceData         │   │      SupabaseAuth            │
│  localStorage CRUD   │   │  Supabase Auth + PostgreSQL  │
└──────────────────────┘   └─────────────────────────────┘
```

---

### `js/data.js` — Camada de Dados (Model)

Objeto singleton `FinanceData` — única camada que acessa o `localStorage`.

**Chaves de armazenamento:**

| Chave | Conteúdo |
|---|---|
| `gastopro_entries_v4_oct` | Lançamentos pontuais (ganhos e variáveis) |
| `gastopro_templates_v4_oct` | Templates de gastos fixos recorrentes |
| `gastopro_profile_real_v2` | Perfil do usuário (nome, email, userId, avatar) |

**Roteamento por prefixo de ID:**
- `entry-*` → Lançamentos pontuais (vinculados a um mês)
- `fix-*` → Templates fixos (projetados em todos os meses do período)

**API pública:**

| Método | Descrição |
|---|---|
| `getEntries()` | Lê lançamentos pontuais |
| `getTemplates()` | Lê templates de gastos fixos |
| `getByMonth(ym)` | Retorna itens do mês (pontuais + projeções fixas) |
| `getAll()` | Retorna todos os itens |
| `add(item)` | Insere lançamento ou template conforme o tipo |
| `update(id, fields)` | Atualiza campos de um item existente |
| `togglePaid(id, ym)` | Inverte status de pagamento por mês |
| `toggleActive(id)` | Pausa/reativa um template fixo |
| `delete(id)` | Remove permanentemente um item (local + nuvem) |
| `clearAll()` | Apaga todos os dados |
| `exportJSON()` | Download do backup em JSON |
| `getProfile()` / `saveProfile()` | Lê/salva perfil do usuário |

**Esquema — Lançamento Pontual:**
```json
{
  "id":       "entry-1730000000000-a1b2",
  "month":    "2026-11",
  "type":     "income",
  "desc":     "Salário",
  "amount":   2710.00,
  "category": "Salário",
  "paid":     true,
  "date":     "2026-11-05"
}
```

**Esquema — Template de Gasto Fixo:**
```json
{
  "id":         "fix-1730000000000-c3d4",
  "desc":       "Plano de saúde – Isabella",
  "amount":     480.00,
  "category":   "Saúde",
  "type":       "fixed",
  "isDebt":     false,
  "active":     true,
  "startMonth": "2026-01",
  "endMonth":   null,
  "day":        "05",
  "paidMonths": { "2026-10": true, "2026-11": false }
}
```

---

### `js/supabase.js` — Integração Supabase

Módulo `SupabaseAuth` com responsabilidades de autenticação e sincronização cloud.

**Métodos de Autenticação:**

| Método | Descrição |
|---|---|
| `getSessionUser()` | Retorna o usuário da sessão ativa, ou null |
| `signUp(name, email, password)` | Cria nova conta com metadados de nome |
| `signIn(email, password)` | Login com credenciais |
| `resetPasswordForEmail(email)` | Envia link de redefinição de senha para o e-mail |
| `signOut()` | Encerra a sessão no Supabase |
| `onAuthStateChange(cb)` | Escuta mudanças de sessão em tempo real |

**Métodos de Sincronização Cloud:**

| Método | Descrição |
|---|---|
| `fetchCloudEntries(userId)` | Busca lançamentos do usuário na nuvem |
| `saveCloudEntry(entry, userId)` | Upsert de lançamento na tabela `entries` |
| `deleteCloudEntry(id, userId)` | Remove lançamento da nuvem |
| `fetchCloudTemplates(userId)` | Busca templates do usuário na nuvem |
| `saveCloudTemplate(tpl, userId)` | Upsert de template na tabela `fixed_templates` |
| `deleteCloudTemplate(id, userId)` | Remove template da nuvem |

---

## 🔒 Modelo de Segurança & Isolamento de Dados

### 1. Row Level Security (RLS) — PostgreSQL
As tabelas `entries` e `fixed_templates` têm RLS ativo. Cada query retorna **apenas registros com `user_id = auth.uid()`**.

### 2. Limpeza de localStorage no Login/Logout

```
Logout      → localStorage dos dados é limpo imediatamente
Login       → dados carregados EXCLUSIVAMENTE da nuvem
Novo usuário → localStorage limpo; app inicia em branco
```

Isso previne o cenário onde um novo usuário herda dados do usuário anterior no mesmo navegador.

### 3. Perfil Sem Dados Hardcoded
O `defaultProfile` retorna `{ name: '', email: '', avatar: null }` — sem dados pessoais fixos no código.

---

## 🗄️ Banco de Dados Supabase

### Tabela `entries`
```sql
CREATE TABLE entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  category    text,
  type        text CHECK (type IN ('income','variable')),
  date        date,
  paid        boolean DEFAULT false,
  is_debt     boolean DEFAULT false,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

### Tabela `fixed_templates`
```sql
CREATE TABLE fixed_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  description text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  category    text,
  type        text DEFAULT 'fixed',
  is_debt     boolean DEFAULT false,
  active      boolean DEFAULT true,
  start_month text,
  end_month   text,
  day         text DEFAULT '01',
  paid_months jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
```

### Row Level Security
```sql
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_entries"
  ON entries FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "user_own_templates"
  ON fixed_templates FOR ALL USING (auth.uid() = user_id);
```

---

## 🧪 Testes Automatizados

Suite com **50+ casos de teste** em JavaScript puro (sem frameworks).

### Como executar
1. Abra `tests/test-runner.html` no Chrome ou Edge.
2. Os testes rodam automaticamente.
3. Detalhes (✅/❌) no **Console (F12)**.

> Os testes usam mock do `localStorage` — seus dados reais não são afetados.

### Cobertura

| Suite | O que é testado |
|---|---|
| `FinanceData — Lançamentos` | getEntries, saveEntries |
| `FinanceData — Templates` | getTemplates, saveTemplates |
| `FinanceData — add()` | income, variable, fixed, debt |
| `FinanceData — getByMonth()` | Projeção de templates, filtro por período |
| `FinanceData — update()` | Lançamentos, templates, sincronização do `day` |
| `FinanceData — togglePaid()` | Baixa por mês isolado |
| `FinanceData — toggleActive()` | Ativar/inativar |
| `FinanceData — delete()` | Exclusão isolada |
| `FinanceData — clearAll()` | Limpeza total |
| `FinanceData — exportJSON()` | Estrutura do backup |
| `FinanceData — Perfil` | getProfile, saveProfile, merge com defaults |
| `Utilitários` | formatCurrency, formatDate, escapeHtml |
| `Lógica de Negócio` | Totais, saldo, regra 50/30/20 |

---

## 🚀 Como Executar Localmente

**Método 1 — Live Server (Recomendado):**
1. Instale a extensão **Live Server** no VS Code.
2. Clique com o botão direito em `index.html` → **"Open with Live Server"**.
3. App em `http://127.0.0.1:5500/` com hot-reload.

**Método 2 — Direto no Navegador:**
- Duplo clique em `index.html` (Service Worker não funciona via `file://`, demais funcionalidades sim).

---

## 🌐 Como Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "feat: GastoPro v3.0 - Supabase auth + multi-user"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/gastopro.git
git push -u origin main
```

No repositório: **Settings → Pages → Branch: main / (root) → Save**.

> ⚠️ Adicione a URL publicada nas **Redirect URLs** do Supabase em `Authentication → URL Configuration`.

---

## 🛠️ Configuração do Supabase

1. Criar projeto em [supabase.com](https://supabase.com).
2. Criar tabelas e ativar RLS conforme scripts acima.
3. Em **Authentication → Providers**: certificar-se de que o provedor **Email** está habilitado.
4. Em **Authentication → URL Configuration**: adicionar a URL do app em **Redirect URLs**.
5. Inserir as credenciais em `js/supabase.js`:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_KEY = 'sua-chave-anon-publica'; // Chave pública — segura no front-end com RLS
```

---

## 📜 Licença

Desenvolvido por **Aylton Alberto** • Estudante de Análise e Desenvolvimento de Sistemas (ADS).  
Projeto livre para fins educacionais e estudo de arquitetura web front-end.


---

## 📋 Changelog

### v3.3 — 27/10/2026 (Última atualização)

> ⚠️ **Status: PARCIALMENTE IMPLEMENTADA** — A lógica JavaScript está 100% concluída. O HTML (`index.html`) e os estilos CSS (`style.css`) ainda precisam ser adicionados para que a feature seja visível e funcional no app.

#### 🎯 Metas & Alertas de Teto de Gastos por Categoria (Em andamento)

| Componente | Status | Arquivo |
|---|---|---|
| **Camada de dados** — `getGoals()`, `saveGoals()`, `saveGoal()`, `deleteGoal()` com chave `gastopro_goals_v1` | ✅ Concluído | `js/data.js` |
| **Renderização** — `renderGoalsSection()` integrada ao `renderAll()`, barras de progresso e alertas visuais | ✅ Concluído | `js/app.js` |
| **Modal de Meta** — `openGoalModal()`, `closeGoalModal()`, `initGoalModalListeners()` | ✅ Concluído | `js/app.js` |
| **Seção HTML no Dashboard** — seção, container, estado vazio e botão "Nova Meta" | ❌ Pendente | `index.html` |
| **Modal HTML** — estrutura do `goalModal` com select, input e botões | ❌ Pendente | `index.html` |
| **Estilos CSS** — `.goal-card`, `.goal-bar-fill--*`, `.goal-status`, `.goal-amounts`, `.goal-pct-badge` | ❌ Pendente | `css/style.css` |

---

---

### v3.3.1 — Pendências Técnicas Identificadas na Análise (27/10/2026)

> Itens identificados durante revisão de código que precisam ser corrigidos:

| # | Arquivo | Problema | Ação necessária |
|---|---|---|---|
| 1 | `sw.js` (linha 10) | `CACHE_NAME = 'gastopro-v2.5'` — desatualizado | Atualizar para `gastopro-v3.3` |
| 2 | `js/data.js` (linha 698) | `version: '2.5'` no `exportJSON()` — desatualizado | Atualizar para `3.3` |

---

### v2.5 — 27/10/2026

#### 🐛 Correções de Bugs

| # | Severidade | Correção | Arquivo |
|---|---|---|---|
| 1 | 🔴 Crítico | **Calendário Popover corrigido**: e.stopPropagation() adicionado no trigger do month picker — o popover estava fechando instantaneamente por borbulhamento de evento | js/app.js |
| 2 | 🟡 Médio | **Logout limpa perfil completo**: gastopro_profile_real_v2 agora é removido no logout, evitando vazamento de nome, avatar e e-mail entre usuários no mesmo dispositivo | js/app.js |
| 3 | 🟡 Médio | **Calendário has-data corrigido**: mini-calendário agora detecta meses com gastos fixos ativos (não apenas lançamentos pontuais) | js/app.js |
| 4 | 🟡 Baixo | **Sidebar listener corrigido**: seletor [data-view] evita que botões de ação (Import, Wizard, Refresh) disparem switchToView(null) | js/app.js |

#### ⚖️ Conformidade LGPD (Lei 13.709/2018)

| Melhoria | Arquivos |
|---|---|
| **Modal de Política de Privacidade** com 7 seções: Quem somos, Dados coletados, Armazenamento, Direitos LGPD, Compartilhamento, Segurança e Contato | index.html + js/app.js + css/style.css |
| **Link "Privacidade e LGPD"** no rodapé da aplicação | index.html |
| **Link "Política de Privacidade"** no Drawer do Usuário | index.html |
| **Checkbox de Consentimento** no formulário de cadastro com referência à LGPD | index.html |
| Estilos CSS para todos os novos elementos de privacidade | css/style.css |

#### 🎨 Reformulação de Layout & Experiência do Usuário (Sidebar & UI)

| # | Melhoria | Descrição | Arquivo |
|---|---|---|---|
| 1 | ⚡ **Lançamento Rápido reposicionado** | Botão movido para logo abaixo de "Dashboard & Saúde", facilitando o acesso instantâneo ao wizard guiado de lançamentos | index.html + css/style.css |
| 2 | 💎 **Importar Extrato em Destaque** | Reposicionado no final da sidebar (imediatamente acima de "Atualizar Dados") com estilo Fintech Verde Esmeralda (gradiente, brilho e realce no hover) | index.html + css/style.css |
| 3 | 🏷️ **Versão v2.5 sincronizada no app** | Badge de versão atualizado para v2.5 no rodapé do sistema; Service Worker atualizado para cache `gastopro-v2.5` com suporte offline a `importer.js` | index.html + sw.js |

### v2.4 Pro — versão anterior
- Wizard de Lançamento Rápido (4 passos)
- Importação de Extratos CSV/Texto
- Autenticação multi-usuário com Supabase
- Centro de Dívidas e Previsão de Quitação
- Modal de Confirmação Customizado
- Pull-to-refresh mobile (PWA)

---

## 🗺️ Roadmap de Melhorias Pendentes

> Lista gerada a partir dos documentos de planejamento (PDFs) do projeto.
> Marcar cada item como concluído (`[x]`) à medida que for implementado.

### 🔴 Alta Prioridade

- [ ] **🎯 Metas & Alertas de Teto de Gastos por Categoria** ⚠️ _v3.3 — JS pronto, HTML/CSS pendentes_
  - [x] `getGoals()`, `saveGoal()`, `deleteGoal()` implementados em `js/data.js`
  - [x] `renderGoalsSection()` e modal de meta implementados em `js/app.js`
  - [ ] Seção HTML no Dashboard (`index.html`) — **pendente**
  - [ ] Modal HTML `goalModal` (`index.html`) — **pendente**
  - [ ] Estilos CSS `.goal-card`, `.goal-bar-fill--*` (`css/style.css`) — **pendente**

- [ ] **🔮 Simulador de Cenários Futuros ("E se...")**
  - Simular: *"E se eu pagar R$ 500 a mais nessa dívida? Quando quito?"*
  - Projeção de amortização de dívidas com gráfico de linha
  - Simulação de corte de categoria: *"E se eu reduzir Alimentação em 20%?"*
  - Comparativo antes/depois exibido em painel lateral

- [ ] **📊 Exportação de Relatórios (PDF / Excel)**
  - Exportar relatório mensal completo em PDF (summary + gráficos)
  - Exportar lançamentos em Excel/CSV filtrado por período
  - Relatório anual consolidado (12 meses + totalizador)

---

### 🟡 Média Prioridade

- [ ] **🏷️ Deduplicação na Importação de Extratos**
  - Detectar lançamentos duplicados (mesma data + valor + estabelecimento)
  - Exibir alerta visual de duplicata antes de confirmar a importação
  - Opção de ignorar ou forçar importação do duplicado

- [ ] **🔔 Notificações In-App de Alertas de Gastos**
  - Alertas visuais quando meta de categoria estiver próxima do limite
  - Base para notificações push futuras via Service Worker

- [ ] **💡 Offline-First Aprimorado com IndexedDB**
  - Migrar de localStorage para IndexedDB (maior capacidade e performance)
  - Fila de sync: registrar operações offline e enviar ao reconectar
  - Indicador de status de conectividade visível na UI

- [ ] **🧪 Ampliar Cobertura de Testes Automatizados**
  - Testes para o módulo `importer.js` (parser CSV/Texto)
  - Testes para o Wizard (fluxo completo de 4 passos)
  - Testes para as futuras Metas por Categoria

---

### 🟢 Baixa Prioridade / Futuro SaaS

- [ ] **💳 Plano Freemium (Free vs. Pro)**
  - Separar funcionalidades entre plano Gratuito e Pro
  - Pro: Exportação PDF/Excel, histórico ilimitado, backup automático agendado

- [ ] **💰 Integração com Gateway de Pagamento**
  - Mercado Pago / Asaas / Stripe para cobrar assinaturas do plano Pro
  - Webhook de confirmação de pagamento → liberar acesso Pro automaticamente

- [ ] **🐍 Backend Python (FastAPI + Supabase)**
  - API RESTful com FastAPI + SQLAlchemy hospedada no Render/Railway (free)
  - Parser CSV mais robusto no servidor com pandas
  - Cron Jobs para backup automático de dados
  - Endpoints protegidos com JWT integrado ao Supabase Auth

- [ ] **🤝 Sistema de Afiliados**
  - Recomendação inteligente de cartões e contas para receita passiva do app
