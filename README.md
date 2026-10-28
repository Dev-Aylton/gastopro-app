# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (**Single Page Application — SPA**) de gestão financeira pessoal com Dashboard de Saúde Financeira, gerenciamento completo de receitas e despesas, rastreamento de dívidas, autenticação multi-usuário com Supabase, importação de extratos bancários, **Wizard de Lançamento Rápido** e PWA para uso offline.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-f59e0b?style=for-the-badge)
![Versão](https://img.shields.io/badge/Vers%C3%A3o-4.0-6366f1?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Supabase-0ea5e9?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-f59e0b?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-169%20casos-10b981?style=for-the-badge)


---

## 👨‍💻 Sobre o Projeto & Autor

O **GastoPro** foi idealizado e desenvolvido por **Aylton Alberto**, estudante do curso de **Análise e Desenvolvimento de Sistemas (ADS)**. O projeto nasceu da necessidade real de transformar uma planilha complexa de controle orçamentário pessoal em uma aplicação web interativa, elegante e segura.

A versão atual (v4.0) evoluiu de um app puramente local para um **SaaS multi-usuário com banco de dados em nuvem**, mantendo a simplicidade de uso e adicionando autenticação segura via Supabase.

---

## ✨ Funcionalidades Principais

### 📊 Dashboard & Saúde Financeira
- Resumo em tempo real dos 4 KPIs: **Total Recebido**, **Gastos Fixos**, **Gastos Variáveis** e **Saldo Livre**.
- Diagnóstico visual baseado na metodologia **50/30/20** com barras de progresso coloridas.
- Cálculo automático da **sobra média diária** até o fim do mês.
- Gráfico de rosca (doughnut) com distribuição de gastos por categoria via **Chart.js**.
- Orçamento diário ajustado ao mês selecionado e alertas para dívidas vencidas ainda não baixadas.

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
- **Logout**: encerra a sessão e limpa os dados locais deste aparelho; os dados sincronizados na nuvem permanecem.

### 👤 Painel do Usuário (Offcanvas Drawer)
- Personalização de nome e foto de perfil local; imagens JPEG, PNG ou WebP são redimensionadas para no máximo 256×256 e salvas como JPEG.
- Status da conta: Conectado (Nuvem) ou Modo Local.
- Exportação de backup completo em JSON.
- Restauração de backup JSON com prévia, mesclagem por ID ou substituição dos dados.
- Reset completo com confirmação de segurança; com login, também apaga os dados sincronizados na nuvem, e sem login apaga apenas os dados deste aparelho.
- As metas por categoria permanecem apenas neste aparelho; não são sincronizadas com o Supabase e são removidas no reset ou na troca de usuário.

### 📄 Relatório Financeiro em PDF
- Relatório mensal, anual ou por intervalo, gerado localmente no navegador.
- Inclui totais, distribuição por categoria, dívidas, metas, diagnóstico e lançamentos detalhados opcionais.
- Usa jsPDF 4.2.1 e jspdf-autotable 5.0.9, carregados sob demanda a partir de arquivos locais.
- No celular, permite compartilhar o arquivo PDF; em outros casos, oferece download ou abertura do PDF.

Os bundles UMD do jsPDF e Chart.js mantêm seus cabeçalhos de licença MIT. O bundle UMD do Supabase não inclui cabeçalho no arquivo oficial; a licença MIT oficial do pacote está preservada em `js/vendor/LICENSE.supabase.txt`. SHA-256 dos arquivos locais:
- `js/vendor/jspdf.umd.min.js` (jsPDF 4.2.1): `E6551FCDC32F09D6853B2C5126D18D01D9447E0DA618A41A11EBEEE0F6C20D54`
- `js/vendor/jspdf.plugin.autotable.min.js` (jspdf-autotable 5.0.9): `83DD8E5AE29436BD3D3EF4F4A915125B3951264994C25DE0359D3FBD105ABE15`
- `js/vendor/supabase.umd.js` (@supabase/supabase-js 2.117.3, publicado em 07/10/2026): `D6A5C4414A5D4CE646D9C1DE223AA7067D3FF664C15394FFEB7FCFFC763354A3`
- `js/vendor/chart.umd.js` (Chart.js 4.4.1): `74401D738DD3E03EE5DFB3B6841210FE2C4EAD8A960C4011CA4BA0B78A9FD8F3`
- `js/vendor/pdf.mjs` (pdfjs-dist 6.4.299, legacy): `BC51F4874A66E3853189CB5D50ABA4B3096AFA83ED433B885D293A3D94583CDC`
- `js/vendor/pdf.worker.mjs` (pdfjs-dist 6.4.299, legacy): `BB422F60804477DE4A0B09091D8347A916A387755ED1CBAD24CCAEC1D09C78BF`
- `js/vendor/LICENSE.pdfjs.txt` (Apache-2.0): `0D542E0C8804E39AA7F37EB00DA5A762149DC682D7829451287E11B938E94594`

Integridade SHA-512 dos tarballs oficiais do registry npm, verificada antes da extração:
- `@supabase/supabase-js@2.117.3`: `K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==`
- `chart.js@4.4.1`: `C74QN1bxwV1v2PEujhmKjOZ7iUM4w6BWs23Md/6aOZZSlwMzeCIDGuZay++rBgChYru7/+QFeoQW0fQoP534Dg==`
- `pdfjs-dist@6.4.299` (publicado em 03/10/2026; SHA-512 conferido antes da extração): `AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`

### 📱 PWA (Progressive Web App)
- Instalável como app nativo no celular ou desktop.
- Funciona offline com Service Worker (Network First + Cache Fallback).

### 📥 Importação de Extratos Bancários (v3.1)
- **Upload de CSV/PDF**: Arraste e solte ou selecione um arquivo `.csv` para importação em lote ou um PDF de extrato/fatura com texto selecionável (até 10 MB e 30 páginas).
- **Extratos OFX**: Importe arquivos `.ofx` em formato SGML ou XML, incluindo descrições e acentos em Windows-1252. O tipo (receita ou gasto) usa o TRNTYPE quando presente.
- **Notas fiscais XML**: Importe notas NF-e/NFC-e para criar um lançamento de despesa com emitente, número e valor total.
- **PDF de extrato ou fatura**: Leitura local do texto selecionável para a prévia; PDFs escaneados não são reconhecidos automaticamente.
- **Texto Bruto**: Cole diretamente o texto copiado do app ou site do banco, um código Pix copia e cola ou uma linha digitável de boleto.
- **Ajuda do importador**: O modal explica os formatos aceitos, a prévia, parcelas, duplicados e privacidade.
- **Detecção automática de colunas**: O parser identifica colunas de Data, Descrição e Valor sem configuração manual.
- O CSV aceita a coluna opcional categoria.
- **Contas a pagar em CSV**: Além das colunas básicas, aceite `tipo` (`income`, `fixed`, `debt` ou `variable`), `mes_inicio`, `mes_fim`, `dia_venc` e `ativo` (`não`, `false` ou `0` desativa a linha).
- **Categorização automática**: +80 palavras-chave mapeiam automaticamente lançamentos para categorias (iFood → Alimentação, Spotify → Assinaturas, etc.).
- **Pré-visualização editável**: Em todas as importações, revise categoria e selecione o tipo linha por linha: Gasto (pago), Gasto a pagar, Conta fixa, Dívida ou Receita.
- **Seleção granular**: Selecione ou desmarque lançamentos individualmente ou todos de uma vez.
- **Detecção de parcelas**: Identifica parcelas em descrições e permite criar a dívida com as parcelas anteriores baixadas ou dar baixa automática em uma dívida já cadastrada.
- **Suporte a múltiplos formatos**: `DD/MM/AAAA Descrição R$ Valor`, `DD/MM Descrição Valor`, e outros padrões de extratos brasileiros.

### 🪄 Wizard de Lançamento Rápido (v3.2)
- **Fluxo guiado em 4 passos**: Renda → Gastos Fixos → Gastos Variáveis → Diagnóstico 50/30/20.
- **Passo 1 — Renda**: Adicione múltiplas fontes de renda (salário, freelance, etc.) com valor e data.
- **Passo 2 — Gastos Fixos**: Checklist dos gastos fixos **já cadastrados** no sistema + campo para adicionar novos.
- **Passo 3 — Gastos Variáveis**: Grid visual com 10 categorias (Alimentação, Mercado, Transporte...) + campo avulso.
- **Passo 4 — Resultado**: KPIs de Renda/Gastos/Saldo + barras animadas da regra 50/30/20 + diagnóstico textual inteligente.
- **Salvamento em lote**: Todos os dados são salvos de uma vez via `FinanceData.add()` com sincronização automática no Supabase.
- **Validação contextual**: Impede avançar sem informar renda; categoriza automaticamente gastos avulsos.

### 🔐 Dados locais, login, logout e reset
- Ao criar conta ou entrar, lançamentos e templates são sincronizados para a conta Supabase autenticada.
- O logout encerra a sessão e remove os dados financeiros locais deste aparelho; os registros na nuvem permanecem até que o Reset logado solicite sua exclusão.
- O Reset com sessão ativa remove os dados locais e apaga os dados sincronizados na nuvem. Sem sessão ativa, remove somente os dados deste aparelho.
- Metas por categoria, nome e foto do perfil ficam apenas no aparelho. A sessão de autenticação é mantida pelo cliente Supabase no navegador.
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
│   ├── default_avatar.jpg  # Avatar padrão do usuário
│   ├── icon-192.png        # Ícone PWA 192x192
│   ├── icon-512.png        # Ícone PWA 512x512
│   ├── icon-maskable-512.png # Ícone maskable
│   └── apple-touch-icon.png # Ícone para iOS
│
├── css/
│   └── style.css           # Design System completo: dark mode, variáveis CSS, animações
│
├── js/
│   ├── data.js             # Camada de Dados: CRUD local (localStorage) + sync cloud
│   ├── supabase.js         # Módulo Supabase: auth (email e senha) + CRUD PostgreSQL
│   ├── categories.js       # Categorias compartilhadas e normalização
│   ├── importer.js         # Módulo de Importação: parser CSV/Texto + categorização automática (v3.1)
│   ├── app.js              # Controller: lógica, renderização, eventos, gráficos e auth
│   ├── report.js           # Dados e renderização do relatório PDF
│   ├── a11y.js             # Gerencia foco, navegação por Tab e fechamento por Esc nos modais
│   └── vendor/
│       ├── chart.umd.js
│       ├── supabase.umd.js
│       ├── LICENSE.supabase.txt
│       ├── jspdf.umd.min.js
│       ├── jspdf.plugin.autotable.min.js
│       ├── pdf.mjs              # pdf.js legacy (carregado sob demanda)
│       ├── pdf.worker.mjs       # Worker local do pdf.js
│       └── LICENSE.pdfjs.txt    # Licença Apache-2.0
│
├── supabase/
│   ├── schema.sql          # Esquema do banco: tabelas, RLS, índices, permissões e triggers
│   └── migrations/
│       └── 20261027_hardening.sql # Migração para aplicação manual; não executada
│
├── tests/
│   ├── gastopro.test.js    # Suite de testes (169 casos, vanilla JS, sem framework)
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

**IDs:** lançamentos e templates usam UUID v4; o tipo de registro é determinado pela coleção correspondente, não por prefixos no ID.

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
  "id":       "550e8400-e29b-41d4-a716-446655440000",
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
  "id":         "550e8400-e29b-41d4-a716-446655440001",
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
Logout      → encerra a sessao e remove os dados financeiros locais; a nuvem permanece
Login       → sincroniza os dados da conta ativa com a nuvem
Reset logado → remove os dados locais e apaga os dados sincronizados na nuvem
Reset local  → remove somente os dados deste aparelho
```

Ao trocar de conta, os dados locais da conta anterior são limpos quando não há sincronização pendente. Metas, nome e foto de perfil permanecem locais e não são sincronizados.

### 3. Perfil Sem Dados Hardcoded
O `defaultProfile` retorna `{ name: '', email: '', avatar: null }` — sem dados pessoais fixos no código.

---

## 🗄️ Banco de Dados (Supabase)

O arquivo [`supabase/schema.sql`](./supabase/schema.sql) espelha o banco de produção. Para criar um projeto novo, execute seu conteúdo no SQL Editor do Supabase. Toda mudança no banco deve ser feita no painel e registrada neste arquivo.

A tabela `profiles` guarda o identificador Auth do usuário, nome e avatar; o app atual ainda mantém o perfil localmente e não grava nessa tabela. `entries.debt_info` é um JSONB opcional, mas o código atual não define uma estrutura para seu conteúdo.

---

## 🧪 Testes Automatizados

Suite com **169 casos de teste** em JavaScript puro (sem frameworks).

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
2. No SQL Editor do projeto, execute `supabase/schema.sql` para criar o esquema documentado.
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

### v4.0 — 28/10/2026 (Versão atual)

- Bloco 5.1: melhorias de acessibilidade na navegação e nos modais.
- Bloco 6A: reconhecimento e tratamento de parcelas durante a importação.
- Bloco 6B: importação de extratos OFX e notas fiscais XML (NF-e/NFC-e).
- Bloco 6D: importação de Pix copia e cola e linhas digitáveis de boleto.
- Bloco 6C: leitura local de PDFs de extrato e fatura com texto selecionável.
- Ajuda embutida no modal de importação, com orientações sobre formatos, prévia, parcelas e privacidade.
- Cobertura atual: 169 testes automatizados.

### v3.8 — 27/10/2026

- Bundles oficiais locais de Chart.js 4.4.1 e Supabase JS 2.117.3; scripts não dependem mais do jsDelivr.
- CSP mais restritiva para scripts e diretivas `object-src`, `base-uri` e `form-action`.
- Service Worker usa timeout de rede de 4 segundos, `no-cache` para assets locais, fallback específico para navegação e pré-cache tolerante de recursos opcionais.
- Gerados ícones PNG PWA e ícone Apple Touch; manifest atualizado com `id` e `scope`.
- Avatares aceitam JPEG, PNG e WebP, são redimensionados para até 256x256 e salvos como JPEG; erro de cota recebe aviso.
- Escapados valores de data, previsão de dívida e IDs interpolados em HTML.
- Política de privacidade corrigida para refletir provedores externos, dados locais, sessão, logout e Reset.
- Criada a migração de hardening `supabase/migrations/20261027_hardening.sql`; ela **não foi executada**. `supabase/schema.sql` apenas a referencia para aplicação manual.
- `.gitignore` atualizado para arquivos `.env*`, com exceção de `.env.example`, temporários locais do Supabase e backups.
- Importador aprimorado com sinais, débito/crédito, cabeçalhos com preâmbulo, validação de datas, limites, deduplicação e gravação em lote.
- Cobertura atual: 127 testes automatizados aprovados.
- Os termos de licença ainda precisam ser esclarecidos: o rodapé informa "Todos os direitos reservados", enquanto esta documentação descreve o projeto como livre para fins educacionais.

### v3.7 — 27/10/2026

#### 📄 Relatório Financeiro em PDF

- Relatórios de mês, ano ou intervalo com opção de detalhar os lançamentos.
- Resumo financeiro, metas e diagnóstico reutilizam as regras já existentes no dashboard; o centro de dívidas compartilha o cálculo de parcelas.
- Bibliotecas oficiais jsPDF 4.2.1 e jspdf-autotable 5.0.9 são carregadas sob demanda, sem CDN para o PDF.
- Modal acessível, compartilhamento de PDF em dispositivos compatíveis e fallback para abrir ou baixar quando necessário.
- Service Worker v3.7 pré-cacheia assets locais; os CDNs permitidos usam stale-while-revalidate e domínios Supabase nunca são interceptados.
- Evento `online` tenta retomar a sincronização pendente.
- Percentuais do PDF formatados no padrão pt-BR; textos fixos revisados para preservar acentuação e colunas numéricas alinhadas à direita.
- Download agora tenta o compartilhamento de arquivos compatível com iOS, depois o download por link e, por fim, a abertura do PDF com aviso.
- A regra atual de parcelas restantes está documentada e coberta por teste: período total menos a quantidade de meses marcados como pagos.
- Validação final: 92 testes automatizados aprovados e PDF fictício gerado para conferência.

#### 📦 Integridade dos bundles locais

- `js/vendor/jspdf.umd.min.js` — jsPDF 4.2.1; SHA-256 `E6551FCDC32F09D6853B2C5126D18D01D9447E0DA618A41A11EBEEE0F6C20D54`.
- `js/vendor/jspdf.plugin.autotable.min.js` — jspdf-autotable 5.0.9; SHA-256 `83DD8E5AE29436BD3D3EF4F4A915125B3951264994C25DE0359D3FBD105ABE15`.

### v3.6 — 27/10/2026

#### 🎯 Metas & Alertas de Teto de Gastos por Categoria

- Conclusão da interface da feature: seção no Dashboard, estado vazio, cards e modal de criação/edição.
- Metas podem ser criadas, editadas e removidas; alertas visuais usam os limiares exatos de 80% e 100%.
- A renderização acompanha a troca de mês e as metas são removidas junto aos dados locais no logout.

#### 🏷️ Versão e PWA

- Versão 3.6 sincronizada no badge, no backup JSON e no Service Worker.
- Cache do PWA atualizado para `gastopro-v3.6`; recursos locais listados no pré-cache, incluindo `js/importer.js`.
- Esquema do banco Supabase documentado em `supabase/schema.sql`, incluindo tabelas, validações, RLS, índices, permissões e triggers.

#### ✅ Correção dos alertas de limite

- Os estados de atenção e limite ultrapassado agora são determinados pela porcentagem real, sem antecipação causada pelo arredondamento do valor exibido.

---

### v3.3.1 — 27/10/2026 — Correção Crítica: PWA não recebia atualizações no celular

#### 🐛 Bug: Atualizações não chegavam ao celular (PWA instalado)

**Causa raiz:** O `CACHE_NAME` no `sw.js` nunca era atualizado (`gastopro-v2.5`), então o evento `activate` do Service Worker nunca encontrava um cache "antigo" para deletar. O celular continuava servindo os arquivos em cache indefinidamente, mesmo com código novo no servidor.

**Como o Service Worker funciona:**
```
1. Novo SW detectado → entra em estado "waiting"
2. skipWaiting() (já existia) → ativa imediatamente
3. activate: filtra caches com nome DIFERENTE do CACHE_NAME atual
4. Se o nome não muda → nenhum cache é deletado → celular serve arquivos velhos
```

**Correção aplicada:**

| Arquivo | Antes | Depois |
|---|---|---|
| `sw.js` linha 10 | `CACHE_NAME = 'gastopro-v2.5'` | `CACHE_NAME = 'gastopro-v3.3'` |
| `js/data.js` linha 698 | `version: '2.5'` | `version: '3.3'` |

**Resultado:** Ao abrir o app no celular após a atualização, o novo SW é ativado, o cache `gastopro-v2.5` é deletado automaticamente e os arquivos atualizados são baixados.

> 💡 **Para forçar atualização imediata no celular:** Feche completamente o app (remova dos recentes) e abra novamente.

---

### v3.3 — 27/10/2026

#### 🎯 Metas & Alertas de Teto de Gastos por Categoria

| Componente | Status | Arquivo |
|---|---|---|
| **Camada de dados** — `getGoals()`, `saveGoals()`, `saveGoal()`, `deleteGoal()` com chave `gastopro_goals_v1` | ✅ Concluído | `js/data.js` |
| **Renderização** — `renderGoalsSection()` integrada ao `renderAll()`, barras de progresso e alertas visuais | ✅ Concluído | `js/app.js` |
| **Modal de Meta** — `openGoalModal()`, `closeGoalModal()`, `initGoalModalListeners()` | ✅ Concluído | `js/app.js` |
| **Seção HTML no Dashboard** — seção, container, estado vazio e botão "Nova Meta" | ✅ Concluído | `index.html` |
| **Modal HTML** — estrutura do `goalModal` com select, input e botões | ✅ Concluído | `index.html` |
| **Estilos CSS** — `.goal-card`, `.goal-bar-fill--*`, `.goal-status`, `.goal-amounts`, `.goal-pct-badge` | ✅ Concluído | `css/style.css` |

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

- [x] **Acessibilidade na navegação e nos modais** — bloco 5.1
- [x] **Reconhecimento de parcelas na importação** — bloco 6A
- [x] **Importação de OFX e XML de nota fiscal** — bloco 6B
- [x] **Importação de Pix e linhas digitáveis de boleto** — bloco 6D
- [x] **Ajuda embutida no modal do importador**
- [x] **Importação de PDF de extrato ou fatura** — bloco 6C
- [ ] **Importação por foto de cupom** — bloco 6E

- [x] **🎯 Metas & Alertas de Teto de Gastos por Categoria** — concluído na v3.6
  - [x] `getGoals()`, `saveGoal()`, `deleteGoal()` implementados em `js/data.js`
  - [x] `renderGoalsSection()` e modal de meta implementados em `js/app.js`
  - [x] Seção HTML no Dashboard (`index.html`)
  - [x] Modal HTML `goalModal` (`index.html`)
  - [x] Estilos CSS das metas (`css/style.css`)

- [ ] **🔮 Simulador de Cenários Futuros ("E se...")**
  - Simular: *"E se eu pagar R$ 500 a mais nessa dívida? Quando quito?"*
  - Projeção de amortização de dívidas com gráfico de linha
  - Simulação de corte de categoria: *"E se eu reduzir Alimentação em 20%?"*
  - Comparativo antes/depois exibido em painel lateral

- [x] **📄 Exportação de relatório financeiro em PDF** — concluído na v3.7
  - [x] Relatório por mês, ano ou intervalo, com totais, categorias, dívidas, metas e diagnóstico
  - [x] Detalhamento opcional dos lançamentos e geração local no navegador
- [ ] **📊 Exportação de dados adicionais**
  - Exportar lançamentos em Excel/CSV filtrado por período
  - Exportações adicionais em Excel/CSV

---

### 🟡 Média Prioridade

- [x] **🏷️ Deduplicação na Importação de Extratos** — concluída na v3.8
  - Duplicatas existentes ou repetidas no arquivo são desmarcadas inicialmente; o usuário pode forçar a importação.

- [ ] **🔔 Notificações In-App de Alertas de Gastos**
  - Alertas visuais quando meta de categoria estiver próxima do limite
  - Base para notificações push futuras via Service Worker

- [ ] **💡 Offline-First Aprimorado com IndexedDB**
  - Migrar de localStorage para IndexedDB (maior capacidade e performance)
  - Fila de sync: registrar operações offline e enviar ao reconectar
  - Indicador de status de conectividade visível na UI

- [ ] **🧪 Ampliar Cobertura de Testes Automatizados**
  - [x] Testes do módulo `importer.js` (parser CSV/Texto e casos de borda)
  - Testes para o Wizard (fluxo completo de 4 passos)
  - Testes automatizados para Metas por Categoria

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
