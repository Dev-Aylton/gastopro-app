# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (Single Page Application — SPA) de gestão financeira pessoal, com dashboard de saúde financeira, receitas e despesas, rastreamento de dívidas, autenticação multiusuário Supabase, importação de extratos, Wizard de Lançamento Rápido e PWA offline.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-f59e0b?style=for-the-badge)
![Versão](https://img.shields.io/badge/Vers%C3%A3o-4.0-6366f1?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Supabase-0ea5e9?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-f59e0b?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-248%20casos-10b981?style=for-the-badge)

---

## 🤖 Guia para IAs (leia antes de editar)

1. O estado do projeto está no **Roadmap**: `[ ]` pendente, `[x]` implementado e ainda não testado, `[V]` testado e validado.
2. Quem concluir um item (pessoa ou IA) deve marcá-lo `[x]` **antes de seguir para o próximo**; marque `[V]` depois que o teste for feito e der certo.
3. Ao marcar, atualize no mesmo passo o Changelog e, se mudar a quantidade de testes, o total no README.
4. Respeite as **Decisões de produto**: Pix entra como Gasto (pago); boleto, empréstimos, parcelamentos e contas parceladas entram como "a pagar" nos meses seguintes e só o usuário marca como pago; sem foto, print nem OCR.
5. Não deduza informações nem o escopo da mudança: confirme com o Aylton antes de alterar.
6. Mudanças no banco são feitas no painel do Supabase e registradas em `supabase/schema.sql`.
7. Não proponha nem implemente soluções pagas. Use apenas planos e serviços gratuitos até que o app tenha usuários; não há monetização por ora.

---

## 📚 Sumário

1. [Título, badges e resumo](#-gastopro--controle-de-gastos--saúde-financeira)
2. [Sumário](#-sumário)
3. [Sobre o projeto e autor](#-sobre-o-projeto-e-autor)
4. [Funcionalidades](#-funcionalidades)
5. [Arquitetura e estrutura de arquivos](#-arquitetura-e-estrutura-de-arquivos)
6. [Referência técnica](#-referência-técnica)
7. [Segurança e privacidade](#-segurança-e-privacidade)
8. [Banco de dados](#-banco-de-dados)
9. [Testes](#-testes)
10. [Executar, configurar e publicar](#-executar-configurar-e-publicar)
11. [Dependências e integridade](#-dependências-e-integridade)
12. [Decisões de produto](#-decisões-de-produto)
13. [Roadmap](#-roadmap)
14. [Changelog](#-changelog)
15. [Licença](#-licença)

---

## 👨‍💻 Sobre o projeto e autor

O **GastoPro** foi idealizado e desenvolvido por **Aylton Alberto**, estudante de **Análise e Desenvolvimento de Sistemas (ADS)**. O projeto nasceu da necessidade de transformar uma planilha complexa de controle orçamentário pessoal em uma aplicação web interativa, elegante e segura.

A versão 4.0 evoluiu de um app local para uma aplicação multiusuário com banco de dados em nuvem, mantendo a simplicidade de uso e adicionando autenticação via Supabase.

---

## ✨ Funcionalidades

### 📊 Dashboard e saúde financeira
- Resumo em tempo real de Total Recebido, Gastos Fixos, Gastos Variáveis e Saldo Livre.
- Saldo consolidado das contas bancárias com filtro Todos/PF/PJ e atalho para a tela Contas.
- Diagnóstico visual baseado na metodologia 50/30/20, com barras de progresso.
- Cálculo automático da sobra média diária até o fim do mês.
- Gráfico de rosca com distribuição de gastos por categoria via Chart.js.
- Orçamento diário ajustado ao mês selecionado e alertas para dívidas vencidas ainda não baixadas.

### 💳 Dívidas e gastos recorrentes
- Rastreamento de parcelamentos, empréstimos e financiamentos.
- Barras de progresso, parcelas restantes e total devedor consolidado.
- Badge automático “🎉 Quitada!” ao quitar todas as parcelas.
- Gastos fixos repetidos nos meses do período definido; baixa independente por mês.
- Alternância Ativo/Inativo para pausar despesas sem excluí-las e filtros por tipo.

### 💰 Receitas e despesas
- Cadastro, edição e exclusão de receitas e gastos.
- Vínculo opcional de ganhos e gastos a uma conta; o saldo muda conforme os lançamentos pagos.
- Categorias de receita: Salário, Adiantamento, Renda Extra, Rendimentos e Outros.
- Lançamentos vinculados ao mês de competência da data informada.

### 🏦 Contas bancárias PF/PJ
- Cadastro e edição de contas com nome, instituição opcional, tipo e saldo inicial; ajuste manual do saldo atual.
- Saldos atuais por conta e consolidados, calculados pela camada FinanceData.
- Exclusão desvincula lançamentos e gastos fixos sem apagá-los; contas e vínculos são incluídos na sincronização e no backup.

### 🗓️ Navegação
- Setas de navegação rápida com virada automática de ano.
- Mini Calendário Popover para acesso direto a qualquer mês/ano e indicador de meses com dados.

### 🎯 Metas e alertas
- Metas de teto de gastos por categoria sincronizadas com a tabela `goals` do Supabase.
- Alertas visuais nos limiares exatos de 80% e 100%, com seção no dashboard, cards e modal de criação/edição.

### 🔐 Autenticação, perfil e backups
- Cadastro e login com e-mail e senha, recuperação de senha por e-mail e sincronização multiusuário.
- Dados isolados por usuário via Row Level Security (RLS).
- Canal "Fale comigo" para usuários logados enviarem mensagens, acompanharem respostas e excluírem suas conversas; conteúdo fica somente no Supabase.
- Área Admin para administradores confirmados pelo RPC `is_admin()`, com mensagens paginadas, filtros e respostas; RLS continua sendo a proteção efetiva.
- Nome e foto de perfil personalizados e sincronizados com `profiles` ao usar login; imagens JPEG, PNG ou WebP podem ser recortadas e salvas como JPEG 256×256.
- Status da conta Conectado (Nuvem) ou Modo Local.
- Exportação de backup JSON e restauração com prévia, mesclagem por ID ou substituição.
- Regras de logout, login, reset e troca de conta: consulte [Segurança e privacidade](#-segurança-e-privacidade).

### 📄 Relatórios em PDF
- Relatório mensal, anual ou por intervalo, gerado localmente no navegador.
- Totais, distribuição por categoria, dívidas, metas, diagnóstico e detalhamento opcional dos lançamentos.
- Compartilhamento em dispositivos compatíveis; nos demais casos, download ou abertura do PDF.

### 📥 Importação de extratos
- Arraste e solte ou selecione um arquivo (.csv, .ofx, .xml ou .pdf).
- PDF de extrato ou fatura com texto selecionável, até 10 MB e 30 páginas. A leitura é local e aproximada; PDFs escaneados não são reconhecidos automaticamente. Confira os dados na prévia.
- Detecção automática de colunas Data, Descrição e Valor, sem configuração manual.
- OFX em formato SGML ou XML, incluindo descrições e acentos em Windows-1252. O tipo (receita ou gasto) usa `TRNTYPE` quando presente.
- XML de nota fiscal NF-e/NFC-e: gera um lançamento com emitente, número e valor total.
- Texto bruto: cole linhas do extrato, um código Pix copia e cola ou uma linha digitável de boleto.
- CSV: colunas Data, Descrição e Valor; colunas opcionais `categoria`, `tipo`, `mes_inicio`, `mes_fim`, `dia_venc` e `ativo`.
- Pré-visualização editável: Gasto (pago), Gasto a pagar, Conta fixa, Dívida ou Receita.
- Categorização automática por mais de 80 palavras-chave; seleção granular, detecção de parcelas e deduplicação.

### 🪄 Wizard de Lançamento Rápido
- Fluxo em quatro passos: Renda → Gastos Fixos → Gastos Variáveis → Diagnóstico 50/30/20.
- Fontes de renda múltiplas; checklist de gastos fixos cadastrados; grid de dez categorias para gastos variáveis.
- KPIs de renda, gastos e saldo, diagnóstico textual e salvamento em lote com sincronização automática.
- **Validação contextual:** impede avançar sem informar renda; categoriza automaticamente gastos avulsos.

### 🧭 Navegação lateral e sincronização
- **Indicadores em tempo real**: Badges numéricos com o total de receitas e despesas cadastradas no mês selecionado.
- **Ferramentas de produtividade**: Acesso direto ao **Importador de Extratos** e ao **Wizard de Lançamento Rápido**.
- **Botão Atualizar Dados**: Posicionado na base da barra lateral (rodapé da sidebar), permitindo sincronizar dados locais com o Supabase a qualquer momento com animação visual e feedback ao usuário.

### ♿ Acessibilidade e PWA
- Gerenciamento de foco, navegação por Tab e fechamento de modais por Esc.
- Alternância entre tema claro e escuro, com preferência local independente dos dados sincronizados e dos backups.
- Instalável em celular ou desktop; Service Worker com funcionamento offline (Network First + Cache Fallback).

---

## 🏗️ Arquitetura e estrutura de arquivos

```text
financeiro-app/
├── index.html                 # Estrutura SPA, sidebar, telas, modais, autenticação e drawer
├── manifest.json              # Manifesto PWA: nome, ícones, cores e orientação
├── sw.js                      # Service Worker: cache offline e atualização automática
├── assets/
│   ├── logo.jpg               # Logotipo do app
│   ├── default_avatar.jpg     # Avatar padrão
│   ├── icon-192.png           # Ícone PWA 192x192
│   ├── icon-512.png           # Ícone PWA 512x512
│   ├── icon-maskable-512.png  # Ícone maskable
│   └── apple-touch-icon.png   # Ícone para iOS
├── css/
│   └── style.css              # Design System, dark mode, variáveis e animações
├── js/
│   ├── app.js                 # Controller: telas, renderização, contas, eventos, gráficos, auth e área Admin
│   ├── theme.js               # Aplica antecipadamente o tema salvo no aparelho
│   ├── data.js                # Camada de dados: CRUD local e sincronização
│   ├── supabase.js            # Autenticação e persistência Supabase
│   ├── categories.js          # Categorias compartilhadas e normalização
│   ├── importer.js            # Parsers e categorização automática
│   ├── onboarding.js          # Conteúdo, persistência e navegação do tutorial
│   ├── report.js              # Dados e renderização do relatório PDF
│   ├── a11y.js                # Foco, Tab e fechamento acessível de modais
│   └── vendor/                # Chart.js, Supabase, jsPDF, PDF.js e licenças
├── supabase/
│   ├── schema.sql             # Tabelas, validações, RLS, índices, permissões e triggers
│   └── migrations/
│       ├── 20261027_hardening.sql # Hardening aplicado e validado em 28/10/2026
│       ├── 20261028_accounts.sql  # RM-025 parte A; aplicada em produção
│       ├── 20261028_delete_my_account.sql # Exclusão de conta; aplicar manualmente no Supabase
│       └── 20261029_feedback.sql # Canal de contato; aplicar manualmente no Supabase
├── tests/
│   ├── gastopro.test.js       # 248 testes em JavaScript puro, sem framework
│   ├── test-runner.html       # Página de execução dos testes no navegador
│   └── test-runner.js         # Runner dos testes no navegador
└── README.md                  # Esta documentação
```

```text
index.html (View)
       │ eventos DOM
       ▼
js/app.js (Controller) ── renderAll() · switchToView() · syncUserDataFromCloud()
       │                         │
       │ CRUD local              │ autenticação e sincronização
       ▼                         ▼
js/data.js                 js/supabase.js
FinanceData                SupabaseAuth
localStorage               Supabase Auth + PostgreSQL
       │
       ├── categories.js: categorias e normalização compartilhadas
       ├── importer.js: parsing e categorização de importações
       ├── report.js: relatório PDF
       └── a11y.js: comportamento acessível dos modais
```

O canal "Fale comigo" é uma consulta sob demanda entre a tela em `js/app.js` e `SupabaseAuth` em `js/supabase.js`; suas mensagens não passam por `FinanceData`, localStorage ou fila de sincronização.

---

## 🧩 Referência técnica

### Chaves do localStorage

| Chave | Conteúdo |
|---|---|
| `gastopro_entries_v4_oct` | Lançamentos pontuais |
| `gastopro_templates_v4_oct` | Templates de gastos fixos recorrentes |
| `gastopro_profile_real_v2` | Perfil local: nome, e-mail, userId e avatar |
| `gastopro_goals_v1` | Metas por categoria |
| `gastopro_accounts_v1` | Contas bancárias PF/PJ |
| `gastopro_theme` | Preferência de aparência deste aparelho (`dark` ou `light`), não sincronizada nem incluída no backup |
| `gastopro_last_uid` | UID da conta dona dos dados locais ativos |
| `gastopro_pending_sync_v1` | Fila de sincronização pendente |

### Esquemas locais

Lançamento pontual:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "month": "2026-11",
  "type": "income",
  "desc": "Salário",
  "amount": 2710.00,
  "category": "Salário",
  "paid": true,
  "date": "2026-11-05"
}
```

Template de gasto fixo:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "desc": "Plano de saúde – Isabella",
  "amount": 480.00,
  "category": "Saúde",
  "type": "fixed",
  "isDebt": false,
  "active": true,
  "startMonth": "2026-01",
  "endMonth": null,
  "day": "05",
  "paidMonths": { "2026-10": true, "2026-11": false }
}
```

Meta:
```json
{ "id": "goal-550e8400-e29b-41d4-a716-446655440002", "category": "Mercado", "limit": 800 }
```

Conta bancária:
```json
{ "id": "550e8400-e29b-41d4-a716-446655440003", "name": "Conta principal", "institution": null, "type": "PF", "initialBalance": 1250.00 }
```

Lançamentos e templates usam UUID v4; metas usam um ID local com prefixo `goal-`. Lançamentos e templates podem incluir `accountId`; nulo significa que não pertencem a uma conta.

### Fila de sincronização

O registro pendente contém `full`, `entries`, `templates`, `deletedEntries`, `deletedTemplates`, `goals`, `deletedGoals`, `accounts` e `deletedAccounts`. Entradas, templates e contas são identificados por ID; metas e exclusões de metas são identificadas pela categoria. Alterações são enfileiradas localmente e removidas da fila após sincronização bem-sucedida.

Metas são gravadas em `public.goals` por categoria, com upsert usando `onConflict: 'user_id,category'`; exclusões enfileiradas são enviadas pela fila pendente.

### API de SupabaseAuth

- `sendFeedback({ category, message })`: envia uma mensagem autenticada diretamente a `feedback_messages`; não usa armazenamento local nem fila offline.
- `fetchMyFeedback()`: busca as mensagens do usuário autenticado, incluindo respostas.
- `deleteMyFeedback(id)`: exclui uma mensagem própria após confirmação na interface.
- `checkIsAdmin()`: confirma o acesso pela RPC `is_admin()` e falha fechado.
- `countNewFeedback()`: conta mensagens novas somente após confirmar acesso administrativo.
- `fetchAllFeedback({ status, limit, offset })`: lista mensagens administrativas paginadas, selecionando somente `id`, `category`, `message`, `status`, `reply`, `replied_at` e `created_at`; nunca solicita `user_id`.
- `replyFeedback(id, reply)`: grava resposta, status respondido e data juntos após validação.
- `GastoProFeedbackHelpers` oferece validação, filtro, ordenação, contagem e rótulos neutros para a área administrativa, além dos helpers do formulário de contato.

### API pública de `FinanceData` (`js/data.js`)

| Método | Descrição |
|---|---|
| `clearUserData()` | Remove chaves locais `gastopro_*`. |
| `getPendingSync()` | Lê a fila pendente de sincronização. |
| `savePendingSync(pending)` | Persiste a fila pendente. |
| `hasPendingSync()` | Indica se há sincronização pendente. |
| `getActiveUserId()` | Retorna o UID local ativo. |
| `markFullSync()` | Marca a sincronização completa como pendente. |
| `queueLocalChanges(kind, previousItems, nextItems)` | Enfileira alterações e exclusões de entradas ou templates. |
| `queueGoalChanges(previousGoals, nextGoals)` | Enfileira alterações e exclusões de metas por categoria. |
| `activateUser(userId)` | Ativa o usuário e prepara o isolamento local. |
| `prepareLocalDataForSync(userId)` | Prepara dados locais e envia a fila pendente. |
| `syncAllToCloud(userId)` | Marca e envia uma sincronização completa. |
| `flushPendingSync(userId)` | Envia e atualiza a fila pendente na nuvem. |
| `mergeCloudData(userId, cloudEntries, cloudTemplates, flushSucceeded, cloudGoals)` | Mescla dados locais e recebidos da nuvem sem substituir alterações ou exclusões pendentes. |
| `getEntries()` | Lê lançamentos pontuais locais. |
| `saveEntries(entries, options)` | Persiste lançamentos e atualiza sincronização. |
| `getTemplates()` | Lê templates recorrentes locais. |
| `saveTemplates(templates, options)` | Persiste templates e atualiza sincronização. |
| `getByMonth(yearMonth)` | Combina lançamentos e projeções de templates do mês. |
| `getAll()` | Retorna todos os itens financeiros. |
| `addMany(items)` | Insere itens em lote. |
| `add(item)` | Insere lançamento ou template conforme o tipo. |
| `addTemplate(tpl)` | Cria um template recorrente. |
| `update(id, updatedFields)` | Atualiza um item existente. |
| `togglePaid(id, currentYm)` | Alterna a baixa de pagamento do mês. |
| `markPaid(id, ym)` | Marca um template como pago no mês. |
| `markPaidMany(payments)` | Marca várias baixas em lote. |
| `toggleActive(id)` | Pausa ou reativa um template. |
| `delete(id)` | Exclui um item. |
| `clearAll()` | Apaga lançamentos, templates, metas e contas, mantendo o perfil e enfileirando exclusões. |
| `exportJSON()` | Gera e baixa JSON com `version`, `exportDate`, `entries`, `templates`, `goals` e `accounts`; não inclui perfil nem dados de login. |
| `importJSON(text, mode)` | Valida e restaura backup, com modo merge ou replace. |
| `getProfile()` | Lê o perfil local. |
| `saveProfile(profile)` | Persiste o perfil local e enfileira a sincronização quando há usuário autenticado. |
| `queueProfileSync()` | Marca nome e foto como pendentes de sincronização. |
| `mergeCloudProfile(profile)` | Mescla o perfil recebido sem substituir uma edição local pendente. |
| `getGoals()` | Lê metas locais. |
| `saveGoals(goals)` | Persiste metas e enfileira alterações. |
| `saveGoal(category, limit)` | Cria ou atualiza uma meta. |
| `deleteGoal(category)` | Exclui uma meta e solicita sincronização. |
| `getAccounts()` / `saveAccounts(accounts)` | Lê ou persiste contas bancárias. |
| `addAccount(account)` / `updateAccount(id, fields)` / `deleteAccount(id)` | CRUD local de contas; exclusão desvincula lançamentos e templates. |
| `getAccountBalance(id)` / `getAccountBalances()` | Calcula saldo de uma conta e consolidados PF/PJ. |
| `adjustAccountBalance(id, currentBalance)` | Ajusta o saldo inicial para atingir o saldo informado. |

### API pública de `SupabaseAuth` (`js/supabase.js`)

| Método | Descrição |
|---|---|
| `fetchAllPages(fetchPage)` | Busca registros paginados. |
| `upsertWithFallback(upsert, items, payloads)` | Tenta upsert em lote e recorre a linhas individuais em caso de falha. |
| `getSessionUser()` | Obtém o usuário da sessão Supabase ativa. |
| `getSessionState()` | Distingue sessão autenticada, ausência confirmada de sessão e erro de verificação. |
| `getAuthenticatedUserId(expectedUserId)` | Valida o usuário autenticado esperado. |
| `reportCloudError(operation, error)` | Registra e formata erro de operação na nuvem. |
| `signUp(name, email, password)` | Cria uma conta com metadados de nome. |
| `signIn(email, password)` | Autentica com e-mail e senha. |
| `signOut(scope)` | Encerra a sessão de autenticação no escopo solicitado. |
| `deleteAccount()` | Solicita a exclusão da conta Auth pela função `delete_my_account`. |
| `resetPasswordForEmail(email)` | Solicita redefinição de senha por e-mail. |
| `updatePassword(password)` | Atualiza a senha da sessão. |
| `onAuthStateChange(callback)` | Registra callback de mudanças de autenticação. |
| `fetchCloudEntries(userId)` | Busca lançamentos do usuário. |
| `saveCloudEntries(entries, userId)` | Salva lançamentos em lote. |
| `saveCloudEntry(entry, userId)` | Salva um lançamento. |
| `deleteCloudEntry(entryId, userId)` | Exclui um lançamento. |
| `deleteCloudEntries(entryIds, userId)` | Exclui lançamentos em lote. |
| `fetchCloudTemplates(userId)` | Busca templates recorrentes. |
| `saveCloudTemplates(templates, userId)` | Salva templates em lote. |
| `saveCloudTemplate(tpl, userId)` | Salva um template. |
| `deleteCloudTemplate(tplId, userId)` | Exclui um template. |
| `deleteCloudTemplates(templateIds, userId)` | Exclui templates em lote. |
| `fetchCloudGoals(userId)` | Busca metas por categoria e converte o limite para número. |
| `saveCloudGoals(goals, userId)` | Valida e faz upsert das metas por categoria. |
| `deleteCloudGoals(categories, userId)` | Exclui metas do usuário pelas categorias. |
| `fetchCloudAccounts(userId)` | Busca contas bancárias do usuário. |
| `saveCloudAccounts(accounts, userId)` | Valida e faz upsert das contas. |
| `deleteCloudAccounts(accountIds, userId)` | Exclui contas do usuário pelos IDs. |
| `fetchCloudProfile(userId)` | Busca nome e foto na tabela `profiles`, indicando separadamente falhas e ausência de registro. |
| `saveCloudProfile(profile, userId)` | Valida e sincroniza nome e foto na tabela `profiles`. |

---

## 🔒 Segurança e privacidade

- **RLS:** cada usuário autenticado só acessa registros associados ao próprio `auth.uid()`.
- **Logout:** encerra a sessão e remove os dados `gastopro_*` locais deste aparelho; os dados na nuvem permanecem.
- **Exclusão de conta:** após sucesso da função `delete_my_account`, encerra a sessão e apaga os dados locais `gastopro_*`; a exclusão na nuvem é irreversível.
- **Login:** sincroniza os dados da conta autenticada com os dados locais, conforme a fila pendente.
- **Dados sincronizados:** lançamentos, templates de gastos fixos/dívidas, metas e contas cadastradas são sincronizados com o Supabase e protegidos por RLS.
- **Reset logado:** apaga lançamentos, templates, metas e contas deste aparelho e envia as exclusões para a nuvem; se o envio falhar, elas ficam pendentes para nova tentativa. Mantém a sessão, o nome e a foto locais.
- **Reset sem login:** apaga somente os dados deste aparelho.
- **Troca de conta:** os dados locais da conta anterior são limpos quando não há sincronização pendente.
- O Supabase Auth guarda o e-mail e o nome informado no cadastro. Com login, nome e foto do perfil são enviados à tabela `profiles`, protegida por RLS; edições locais pendentes prevalecem sobre os dados recebidos da nuvem.
- O backup JSON exporta exatamente `version`, `exportDate`, `entries`, `templates`, `goals` e `accounts`; não inclui perfil, nome, foto, e-mail, UID nem sessão.
- Os arquivos PDF são lidos no próprio aparelho; não são enviados nem armazenados. A leitura de PDF é de texto selecionável, não de imagem escaneada.
- O `defaultProfile` não inclui dados pessoais hardcoded.
- Google Fonts e cdnjs (Font Awesome) são carregados de terceiros e podem receber endereço IP e dados técnicos de conexão; dados financeiros não são enviados a esses provedores.
- A sincronização Supabase usa HTTPS/TLS e isolamento por usuário via RLS.

---

## 🗄️ Banco de dados

[`supabase/schema.sql`](./supabase/schema.sql) documenta as tabelas, validações, RLS, índices, permissões e triggers. Toda mudança no banco deve ser feita no painel e registrada neste arquivo. A migração [`supabase/migrations/20261027_hardening.sql`](./supabase/migrations/20261027_hardening.sql) foi aplicada e validada em produção em 28/10/2026.

As tabelas `entries`, `fixed_templates`, `goals`, `accounts` e `profiles` têm RLS ativo. `public.accounts` contém `id`, `user_id`, `name`, `institution`, `type`, `initial_balance`, `created_at` e `updated_at`; `entries` e `fixed_templates` podem referenciar uma conta por `account_id`, com chave estrangeira composta que impede vínculo entre usuários. A migração [`supabase/migrations/20261028_accounts.sql`](./supabase/migrations/20261028_accounts.sql) foi aplicada em produção. A função `public.delete_my_account()` remove a conta Auth do usuário autenticado e depende dos `ON DELETE CASCADE` existentes; sua migração [`supabase/migrations/20261028_delete_my_account.sql`](./supabase/migrations/20261028_delete_my_account.sql) também precisa ser aplicada manualmente. O app envia nome e avatar para `profiles` ao editar o perfil autenticado; alterações pendentes são mantidas para nova tentativa. `entries.debt_info` é um JSONB opcional, sem estrutura definida pelo código atual.

A migração [`supabase/migrations/20261029_feedback.sql`](./supabase/migrations/20261029_feedback.sql) cria `app_admins` e `feedback_messages`, as policies de RLS, `is_admin()` e o limite de cinco mensagens por usuário em 24 horas. Ela **ainda precisa ser aplicada manualmente** no SQL Editor do Supabase. O administrador pode ler mensagens e responder, mas não recebe acesso às tabelas financeiras nem a `profiles`; a lista de administradores é mantida diretamente pelo SQL Editor. Mensagens são obtidas sob demanda e não entram no localStorage, na fila financeira, no backup ou no Reset.

Para criar um projeto Supabase, execute `supabase/schema.sql` no SQL Editor. Consulte também [Executar, configurar e publicar](#-executar-configurar-e-publicar).

---

## 🧪 Testes

Suite com **248 casos de teste** em JavaScript puro, sem frameworks. Os testes usam mock do `localStorage`; os dados reais não são afetados.

| Suite (`describe`) | Área coberta |
|---|---|
| `FinanceData — Lançamentos Pontuais` | CRUD e persistência de lançamentos. |
| `FinanceData — Isolamento entre usuários` | Isolamento de dados locais entre usuários e troca de conta. |
| `Recuperação de sessão` | Preservação de alterações pendentes após expiração, sincronização ao entrar na mesma conta e confirmação antes de descartar dados para trocar de conta. |
| `FinanceData — Metas por Categoria` | Criação, edição, remoção e alertas de metas. |
| `FinanceData — Contas Bancárias` | CRUD, validação, saldos, ajuste, exclusão, sincronização e backup de contas. |
| `Interface — filtros e opções de contas` | Seleção de saldo consolidado/PF/PJ e opções dos campos de conta. |
| `Tema — preferência local` | Normalização, tema inicial escuro e alternância de tema. |
| `Canal Fale comigo` | API autenticada, validação, status, contador, erros amigáveis e isolamento das mensagens em relação a backup e Reset. |
| `Admin — mensagens de contato` | Validação e payload de resposta, filtros, ordenação, contagem, rótulos neutros, falha fechada e seleção explícita sem identificador do autor. |
| `Exclusão de conta do usuário` | RPC, resposta de sucesso/erro, texto exato de confirmação, limpeza dos dados/sessão locais e preservação após falha. |
| `FinanceData — Templates de Gastos Fixos` | Leitura e gravação de templates. |
| `FinanceData — add() Lançamentos` | Inserção de tipos de lançamento. |
| `FinanceData — addTemplate() Gastos Fixos` | Criação de gastos recorrentes. |
| `FinanceData — getByMonth()` | Projeções e filtros por período. |
| `FinanceData — update()` | Atualização de lançamentos e templates. |
| `FinanceData — togglePaid()` | Baixa mensal. |
| `FinanceData — toggleActive()` | Ativação de templates. |
| `FinanceData — delete()` | Exclusões. |
| `FinanceData — clearAll()` | Reset de lançamentos, templates, metas e contas, com exclusões pendentes. |
| `FinanceData — mesclagem completa da nuvem` | Merge e sincronização de dados. |
| `Privacidade, payloads e autenticação` | Privacidade e validação de payloads. |
| `Bloco 2 — dívida, orçamento, diagnóstico e categorias` | Regras de dívida, orçamento e categorias. |
| `Bloco 2 — backup JSON` | Validação estrita dos dados, período de baixas, IDs, restauração atômica e compatibilidade com backups antigos. |
| `FinanceData — exportJSON()` | Exportação de backup. |
| `FinanceData — Perfil do Usuário` | Leitura e gravação de perfil. |
| `Perfil — sincronização e enquadramento do avatar` | Recorte, limites de zoom, sincronização pendente e precedência do perfil local/nuvem. |
| `FinanceData — getAll()` | Consulta de todos os itens. |
| `Utilitários — formatCurrency()` | Formatação monetária. |
| `Utilitários — getYearMonthString()` | Formatação de ano e mês. |
| `Utilitários — formatDate()` | Formatação de data. |
| `Utilitários — escapeHtml()` | Escape de HTML. |
| `Acessibilidade dos modais` | Interação acessível em modais. |
| `Acessibilidade de painéis e navegação` | Painéis e navegação acessíveis. |
| `Avatar — tipos de imagem suportados` | Tipos de imagem aceitos pelo avatar. |
| `Lógica de Negócio — Cálculo de Totais` | Totais financeiros. |
| `Lógica de Negócio — Gastos Fixos Inativos` | Tratamento de templates inativos. |
| `Lógica de Negócio — Regra 50/30/20` | Cálculo de percentuais. |
| `Lógica de Negócio — paidMonths por mês isolado` | Baixa por mês independente. |
| `GastoProImporter — parsing e limites` | Parsing, categorias e limites de importação. |
| `GastoProImporter — autoDetectCategory` | Palavras-chave, prioridade, normalização e categoria CSV informada. |
| `GastoProImporter — Pix e boletos` | Pix e linhas digitáveis. |
| `GastoProImporter — texto extraído de PDF` | Agrupamento e parsing de PDF. |
| `GastoProImporter — extratos bancários robustos` | CSV, parcelas, limites e deduplicação. |
| `GastoProImporter — importação de arquivos` | CSV, OFX, XML e PDF. |
| `FinanceData — inserção em lote para importação` | Inserção em lote e baixa de parcelas. |
| `FinanceData — conversões de data local e tipo` | Datas, UUIDs e tipos de registros. |
| `FinanceData — exclusão durante sincronização` | Concorrência de sincronização e exclusões. |
| `Relatório Financeiro — buildReportData` | Dados do relatório financeiro. |

Para executar, abra `tests/test-runner.html` no Chrome ou Edge; os testes rodam automaticamente e os detalhes aparecem no Console (F12).

---

## 🚀 Executar, configurar e publicar

### Executar localmente

**Live Server (recomendado):**
1. Instale a extensão Live Server no VS Code.
2. Clique com o botão direito em `index.html` e escolha **Open with Live Server**.
3. O app abre em `http://127.0.0.1:5500/` com hot-reload.

Também é possível abrir `index.html` diretamente no navegador; o Service Worker não funciona via `file://`, mas as demais funcionalidades funcionam.

### Configurar Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. Execute `supabase/schema.sql` no SQL Editor.
3. Em **Authentication → Providers**, habilite o provedor Email.
4. Em **Authentication → URL Configuration**, adicione a URL do app em **Redirect URLs**.
5. Configure as credenciais em `js/supabase.js`:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_KEY = 'sua-chave-anon-publica'; // Chave pública — segura no front-end com RLS
```

### Publicar no GitHub Pages

Configure **Settings → Pages → Branch: main / (root) → Save**. Para enviar as alterações existentes:

```bash
git add .
git commit -m "feat: descreva a alteração"
git push origin main
```

> ⚠️ Adicione a URL publicada nas **Redirect URLs** do Supabase em **Authentication → URL Configuration**.

---

## 📦 Dependências e integridade

Os bundles UMD do jsPDF e Chart.js mantêm seus cabeçalhos de licença MIT. O bundle UMD do Supabase não inclui cabeçalho no arquivo oficial; a licença MIT oficial está em `js/vendor/LICENSE.supabase.txt`. PDF.js é distribuído localmente com sua licença Apache-2.0.

### SHA-256 dos arquivos locais

| Biblioteca/arquivo | Versão ou observação | SHA-256 |
|---|---|---|
| `js/vendor/jspdf.umd.min.js` | jsPDF 4.2.1 | `E6551FCDC32F09D6853B2C5126D18D01D9447E0DA618A41A11EBEEE0F6C20D54` |
| `js/vendor/jspdf.plugin.autotable.min.js` | jspdf-autotable 5.0.9 | `83DD8E5AE29436BD3D3EF4F4A915125B3951264994C25DE0359D3FBD105ABE15` |
| `js/vendor/supabase.umd.js` | @supabase/supabase-js 2.117.3, publicado em 07/10/2026 | `D6A5C4414A5D4CE646D9C1DE223AA7067D3FF664C15394FFEB7FCFFC763354A3` |
| `js/vendor/chart.umd.js` | Chart.js 4.4.1 | `74401D738DD3E03EE5DFB3B6841210FE2C4EAD8A960C4011CA4BA0B78A9FD8F3` |
| `js/vendor/pdf.mjs` | pdfjs-dist 6.4.299, legacy | `BC51F4874A66E3853189CB5D50ABA4B3096AFA83ED433B885D293A3D94583CDC` |
| `js/vendor/pdf.worker.mjs` | pdfjs-dist 6.4.299, legacy | `BB422F60804477DE4A0B09091D8347A916A387755ED1CBAD24CCAEC1D09C78BF` |
| `js/vendor/LICENSE.pdfjs.txt` | pdfjs-dist, licença Apache-2.0 | `0D542E0C8804E39AA7F37EB00DA5A762149DC682D7829451287E11B938E94594` |

### SHA-512 dos tarballs oficiais do registry npm

| Biblioteca | SHA-512 |
|---|---|
| `@supabase/supabase-js@2.117.3` | `K+f8PimXDunPWQ63CKRXaF5pbVPJxmfw5ryAnh0s9S9PkwcuqBjiSpIaqpF7KLDljeYwXIL85ST8QxaO0+XuvA==` |
| `chart.js@4.4.1` | `C74QN1bxwV1v2PEujhmKjOZ7iUM4w6BWs23Md/6aOZZSlwMzeCIDGuZay++rBgChYru7/+QFeoQW0fQoP534Dg==` |
| `pdfjs-dist@6.4.299` | `AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==` |

O SHA-512 de pdfjs-dist foi conferido antes da extração; o pacote foi publicado em 03/10/2026. A integridade dos demais tarballs foi verificada antes da extração.

---

## 🧭 Decisões de produto

- Pix importado entra como **Gasto (pago)**.
- Boleto, empréstimos, parcelamentos e contas parceladas, depois de lançados, aparecem como **"a pagar"** em cada mês seguinte do período; **só o usuário marca como pago**, mês a mês.
- O app não terá importação por foto, print nem OCR; a decisão é manter o app leve.
- O uso de PDF é limitado a documentos com texto selecionável; a prévia deve ser conferida.
- Desenvolvimento 100% em planos gratuitos até o app estar funcionando e com vários usuários; não há monetização por ora.

---

## 🗺️ Roadmap

Legenda: `[ ]` pendente | `[x]` implementado, ainda não testado | `[V]` testado e validado. Veja as regras no [Guia para IAs](#-guia-para-ias-leia-antes-de-editar).

### Itens

- [V] **RM-001 — Acessibilidade na navegação e nos modais** / Descrição: melhorias de acessibilidade no bloco 5.1. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-002 — Reconhecimento de parcelas na importação** / Descrição: reconhecer parcelas, criar dívida com parcelas anteriores baixadas ou dar baixa em dívida existente (bloco 6A). / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-003 — Importação de OFX e XML de nota fiscal** / Descrição: importar OFX e NF-e/NFC-e (bloco 6B). / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-004 — Importação de Pix e linhas digitáveis de boleto** / Descrição: importar Pix copia e cola e boletos (bloco 6D). / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-005 — Ajuda embutida no modal do importador** / Descrição: orientar sobre formatos, prévia, parcelas, duplicados e privacidade. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-006 — Importação de PDF de extrato ou fatura** / Descrição: ler localmente PDFs com texto selecionável (bloco 6C). / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-007 — Metas e alertas de teto por categoria** / Descrição: seção no dashboard, cards, modal, edição e alertas em 80% e 100%. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-008 — Relatório financeiro em PDF** / Descrição: relatório mensal, anual ou por intervalo com totais, categorias, dívidas, metas, diagnóstico e detalhamento opcional. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-009 — Deduplicação na importação de extratos** / Descrição: desmarcar duplicatas existentes ou repetidas no arquivo, permitindo importação manual forçada. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-010 — Metas sincronizadas com a nuvem** / Descrição: sincronizar metas por categoria com `public.goals`, incluindo upserts e exclusões pendentes. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-011 — Hardening do banco aplicado** / Descrição: aplicar a migração `supabase/migrations/20261027_hardening.sql` ao banco. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-012 — Contas a pagar em CSV** / Descrição: aceitar colunas `tipo`, `mes_inicio`, `mes_fim`, `dia_venc` e `ativo`. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-013 — Categoria no CSV** / Descrição: aceitar a coluna opcional `categoria`. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-014 — Tipo OFX por TRNTYPE e descrição padrão** / Descrição: usar TRNTYPE conhecido, fallback de descrição vazia e aviso para OFX sem transações. / Critério de pronto: a definir. / Arquivos: a definir.
- [V] **RM-015 — Reset sem apagar perfil** / Descrição: reset financeiro preserva identidade da conta e perfil. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-016 — Simulador de Cenários Futuros (“E se...”)** / Descrição: simular pagamento extra de dívida e estimar quitação; projetar amortização com gráfico de linha; simular corte de categoria (por exemplo, reduzir Alimentação em 20%); comparar antes/depois em painel lateral. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-017 — Exportação de dados adicionais** / Descrição: exportar lançamentos em Excel/CSV filtrados por período e oferecer exportações adicionais em Excel/CSV. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-018 — Notificações de alertas de gastos** / Descrição: Parte 1 (sem custo): central de notificações dentro do app, com histórico dos alertas de metas (80% e 100%). Parte 2 (somente se couber no plano gratuito): notificações push via Service Worker com o app fechado, enviadas por Edge Function do Supabase com agendamento; avaliar se o plano gratuito permite o agendamento. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-019 — Offline-First aprimorado com IndexedDB** / Descrição: migrar de localStorage para IndexedDB para maior capacidade e performance; manter fila para operações offline e envio ao reconectar; exibir status de conectividade na UI. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-020 — Ampliar cobertura de testes automatizados** / Descrição: testes para o fluxo completo de quatro passos do Wizard. / Critério de pronto: a definir. / Arquivos: a definir.

### Descartado

- Importação por foto de cupom (6E) — motivo: decisão do autor: o app não terá foto/OCR.

### Novas melhorias

- [x] **RM-025 — Contas bancárias PF/PJ** / Descrição: partes A e B implementadas: cadastro e gerenciamento de contas, vínculos em ganhos e gastos, saldos consolidados/filtro no Dashboard, ajuste rápido, sincronização e backup. / Critério de pronto: testes automatizados aprovados; fluxos integrados pendentes de validação manual. / Arquivos: `index.html`, `js/app.js`, `css/style.css`.
- [ ] **RM-026 — Cartões de crédito e limites** / Descrição: cadastro de cartão (nome, limite total, dia de fechamento, dia de vencimento, conta vinculada); compras parceladas de 1x a 24x com abatimento do limite disponível e parcelas projetadas nos meses futuros; barra de uso do limite e alerta em 80%. Antes de implementar, confirmar com o Aylton como isso convive com as parcelas e dívidas "a pagar" já existentes. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-027 — Mais palavras-chave na categorização** / Descrição: ampliar as regras de categoria automática do importador. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-028 — Recuperação de conta e confirmação de e-mail** / Descrição: mensagens neutras e específicas para redefinição, espera visual entre pedidos, confirmação dupla no cadastro e orientação sem consulta a e-mails existentes. / Critério de pronto: testes automatizados aprovados e validação responsiva. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.

---

## 📋 Changelog

### Planejamento (sem versão)

- RM-028: recuperação de senha com mensagens neutras, feedback de limite e contador de 60 segundos; cadastro confirma o e-mail; adicionada tela informativa “Não lembro meu e-mail”; três testes adicionados.
- O Roadmap foi atualizado com RM-025 a RM-027.
- RM-027: ampliadas as palavras-chave da categorização automática, corrigida a classificação de 'Mercado Livre' para Compras, removidas palavras ambíguas e 'Mercado Pago' direcionado para Outros.
- Adicionados quatro testes de `autoDetectCategory`, incluindo palavras-chave, normalização e precedência da categoria informada no CSV.
- RM-025 parte A: contas PF/PJ, vínculos opcionais em lançamentos/templates, saldos, sincronização e backup implementados; migração aplicada em produção.
- Exclusão da própria conta Supabase pela função `public.delete_my_account()`, com confirmação explícita e limpeza dos dados/sessão locais após sucesso; migração pendente de aplicação manual.
- Reset agora também apaga contas bancárias, preservando sessão, nome e foto; testes cobrem fila de exclusões e limpeza após apagar a conta de login.
- Sessão expirada preserva alterações pendentes, orienta o login na mesma conta e exige confirmação explícita antes de descartá-las para trocar de conta.
- Validação estrita do backup JSON impede restauração parcial de dados inválidos e mantém compatibilidade com backups antigos.
- Erros ao verificar a sessão preservam os dados locais; merges da nuvem respeitam alterações e exclusões pendentes.
- Nome e foto agora são sincronizados com `profiles` sob RLS; o modal de recorte do avatar permite arrastar, teclado e zoom, e o backup permanece sem dados de perfil.
- Área Admin de mensagens: confirmação de acesso por `is_admin()`, lista paginada sem identificador do autor, filtros e respostas com atualização atômica dos campos no app; adicionados sete testes.
- Tema claro em preparação: a folha de estilos usa tokens semânticos com paleta escura preservada e uma paleta clara em validação.
- Tutorial de primeiro acesso com dicas sobre lançamentos, contas fixas, dívidas, metas, importação, relatórios e dados; disponível novamente em “Como usar” no perfil.
- RM-025 parte B: tela e modais de contas PF/PJ, vínculos em ganhos/gastos, saldo consolidado filtrável no Dashboard e duas funções puras cobertas por testes; cache do Service Worker atualizado.
- Tema claro/escuro alternável no cabeçalho, escolhido no carregamento antes dos estilos e persistido por aparelho; limpeza de dados e restauração de backup preservam a preferência.
- Canal "Fale comigo": mensagens autenticadas e respostas armazenadas somente no Supabase, com exclusão pelo usuário, limite de envio e migração SQL pendente de aplicação manual.
- Ajustes responsivos para telas estreitas e reorganização do Painel do Usuário: ações irreversíveis recolhidas por padrão, logout neutro e correções de alinhamento e overflow.

### v4.0 — 28/10/2026 (versão atual)

- Bloco 5.1: melhorias de acessibilidade na navegação e nos modais.
- Bloco 6A: reconhecimento e tratamento de parcelas durante a importação.
- Bloco 6B: importação de extratos OFX e notas fiscais XML (NF-e/NFC-e).
- Bloco 6D: importação de Pix copia e cola e linhas digitáveis de boleto.
- Bloco 6C: leitura local de PDFs de extrato e fatura com texto selecionável.
- Importação CSV com contas a pagar pelas colunas `tipo`, `mes_inicio`, `mes_fim`, `dia_venc` e `ativo`.
- Importação CSV aceita a coluna opcional `categoria`.
- OFX com descrição padrão, aviso para arquivo sem transações e tipo baseado em `TRNTYPE`.
- Reset financeiro sem apagar o perfil da conta.
- Metas sincronizadas com a tabela `goals`; tabela criada e trigger `updated_at` de `profiles` incluído.
- Migração de hardening aplicada e validada no banco em 28/10/2026.
- Ajuda embutida no modal do importador.
- Cobertura: 173 testes automatizados.

### v3.8 — 27/10/2026

- Bundles oficiais locais de Chart.js 4.4.1 e Supabase JS 2.117.3; scripts não dependem mais do jsDelivr.
- CSP mais restritiva para scripts e diretivas `object-src`, `base-uri` e `form-action`.
- Service Worker usa timeout de rede de 4 segundos, `no-cache` para assets locais, fallback específico para navegação e pré-cache tolerante de recursos opcionais.
- Gerados ícones PNG PWA e ícone Apple Touch; manifest atualizado com `id` e `scope`.
- Avatares aceitam JPEG, PNG e WebP, são redimensionados para até 256x256 e salvos como JPEG; erro de cota recebe aviso.
- Escapados valores de data, previsão de dívida e IDs interpolados em HTML.
- Política de privacidade corrigida para refletir provedores externos, dados locais, sessão, logout e Reset.
- Migração de hardening `supabase/migrations/20261027_hardening.sql` criada; aplicada e validada em 28/10/2026.
- `.gitignore` atualizado para arquivos `.env*`, com exceção de `.env.example`, temporários locais do Supabase e backups.
- Importador aprimorado com sinais, débito/crédito, cabeçalhos com preâmbulo, validação de datas, limites, deduplicação e gravação em lote.
- Cobertura histórica: 127 testes automatizados aprovados.

### v3.7 — 27/10/2026

#### 📄 Relatório Financeiro em PDF

- Relatórios de mês, ano ou intervalo com opção de detalhar os lançamentos.
- Resumo financeiro, metas e diagnóstico reutilizam as regras já existentes no dashboard; o centro de dívidas compartilha o cálculo de parcelas.
- Bibliotecas oficiais jsPDF 4.2.1 e jspdf-autotable 5.0.9 são carregadas sob demanda, sem CDN para o PDF.
- Modal acessível, compartilhamento de PDF em dispositivos compatíveis e fallback para abrir ou baixar quando necessário.
- Service Worker v3.7 pré-cacheia assets locais; os CDNs permitidos usam stale-while-revalidate e domínios Supabase nunca são interceptados.
- Evento `online` tenta retomar a sincronização pendente.
- Percentuais do PDF formatados no padrão pt-BR; textos fixos revisados para preservar acentuação e colunas numéricas alinhadas à direita.
- Download tenta compartilhamento de arquivos compatível com iOS, depois download por link e, por fim, abertura do PDF com aviso.
- A regra de parcelas restantes está documentada e coberta por teste: período total menos a quantidade de meses marcados como pagos.
- Validação final histórica: 92 testes automatizados aprovados e PDF fictício gerado para conferência.

#### 📦 Integridade dos bundles locais

- `js/vendor/jspdf.umd.min.js` — jsPDF 4.2.1; SHA-256 `E6551FCDC32F09D6853B2C5126D18D01D9447E0DA618A41A11EBEEE0F6C20D54`.
- `js/vendor/jspdf.plugin.autotable.min.js` — jspdf-autotable 5.0.9; SHA-256 `83DD8E5AE29436BD3D3EF4F4A915125B3951264994C25DE0359D3FBD105ABE15`.

### v3.6 — 27/10/2026

#### 🎯 Metas e alertas de teto de gastos por categoria

- Conclusão da interface da feature: seção no Dashboard, estado vazio, cards e modal de criação/edição.
- Metas podem ser criadas, editadas e removidas; alertas visuais usam os limiares exatos de 80% e 100%.
- A renderização acompanha a troca de mês e as metas são removidas junto aos dados locais no logout.

#### 🏷️ Versão e PWA

- Versão 3.6 sincronizada no badge, no backup JSON e no Service Worker.
- Cache do PWA atualizado para `gastopro-v3.6`; recursos locais listados no pré-cache, incluindo `js/importer.js`.
- Esquema do banco Supabase documentado em `supabase/schema.sql`, incluindo tabelas, validações, RLS, índices, permissões e triggers.

#### ✅ Correção dos alertas de limite

- Os estados de atenção e limite ultrapassado agora são determinados pela porcentagem real, sem antecipação causada pelo arredondamento do valor exibido.

### Histórico anterior

#### v3.3.1 — 27/10/2026
- Corrigido o cache do PWA: o `CACHE_NAME` não era atualizado, então o evento `activate` não removia o cache antigo e o celular servia arquivos indefinidamente.
- Atualizado o cache de `gastopro-v2.5` para `gastopro-v3.3`; o cache anterior passa a ser removido na ativação do novo Service Worker.
- Para forçar atualização no celular, fechar completamente o app e abri-lo novamente.

#### v3.3 — 27/10/2026
- Implementados dados locais de metas por categoria e CRUD em `js/data.js`.
- Renderização, modal, alertas, seção Dashboard e estilos de metas adicionados.
- As metas passaram a sincronizar com a nuvem na v4.0.

#### v2.5 — 27/10/2026
- Corrigidos o fechamento instantâneo do Mini Calendário Popover, a detecção de meses com gastos fixos e o listener da sidebar.
- Adicionada política de privacidade e LGPD, link no rodapé/drawer e consentimento no cadastro.
- Atualizados layout da sidebar, badge v2.5 e cache PWA.

#### v2.4 Pro — versão anterior
- Wizard de Lançamento Rápido, importação CSV/texto, autenticação multiusuário e Centro de Dívidas.
- Modal de confirmação customizado e pull-to-refresh mobile (PWA).

---

## 📜 Licença

Todos os direitos reservados © Aylton Alberto.

Projeto pessoal de estudante de ADS.
