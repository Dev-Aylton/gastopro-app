# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (Single Page Application — SPA) de gestão financeira pessoal, com dashboard de saúde financeira, receitas e despesas, rastreamento de dívidas, autenticação multiusuário Supabase, importação de extratos, Wizard de Lançamento Rápido e PWA offline.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-f59e0b?style=for-the-badge)
![Versão](https://img.shields.io/badge/Vers%C3%A3o-4.64-6366f1?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Supabase-0ea5e9?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-f59e0b?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-632%20casos-10b981?style=for-the-badge)

---

## 📚 Sumário

1. [Título, badges e resumo](#-gastopro--controle-de-gastos--saúde-financeira)
2. [Sumário](#-sumário)
3. [Apresentação](#-apresentação)
4. [Sobre o projeto e autor](#-sobre-o-projeto-e-autor)
5. [Funcionalidades](#-funcionalidades)
6. [Arquitetura e estrutura de arquivos](#-arquitetura-e-estrutura-de-arquivos)
7. [Referência técnica](#-referência-técnica)
8. [Segurança e privacidade](#-segurança-e-privacidade)
9. [Banco de dados](#-banco-de-dados)
10. [Testes](#-testes)
11. [Executar, configurar e publicar](#-executar-configurar-e-publicar)
12. [Dependências e integridade](#-dependências-e-integridade)
13. [Decisões de produto](#-decisões-de-produto)
14. [Roadmap](#-roadmap)
15. [Changelog](#-changelog)
16. [Licença](#-licença)

---

## 🚀 Apresentação

O GastoPro ajuda a organizar as finanças com menos digitação: analisa extratos, sugere os campos e permite conferir os dados antes de importar. O arquivo é lido no navegador e não é enviado; os dados financeiros salvos no app podem sincronizar com o Supabase quando há login.

### Importação
- Aceita CSV, TXT, OFX, XML de NF-e e PDF com texto selecionável. CSV/TXT precisam de cabeçalho reconhecido; OFX é lido por transação e o XML é interpretado como NF-e.
- CSV/TXT, OFX e XML têm limite de 1 MB; o PDF, 10 MB e 30 páginas. PDFs escaneados sem texto selecionável não são reconhecidos automaticamente.
- A prévia permite conferir e ajustar as linhas antes de confirmar; cada lote aceita até 500 linhas.

### Privacidade e acesso
- As opções de consentimento são opcionais e começam desligadas; a telemetria também fica desativada por padrão.
- O Painel Admin mostra indicadores agregados e não exibe lançamentos individuais, descrições, valores, contas, metas ou fotos de perfil.
- O acesso pode ser feito com e-mail e senha ou com a conta Google.

### Stack e arquitetura
Frontend em HTML, CSS e JavaScript sem framework de aplicação; hospedagem no GitHub Pages; Supabase para autenticação e sincronização; PWA com manifest e Service Worker.

| Camada | Responsabilidade |
|---|---|
| Navegador | Interface, leitura e prévia local de arquivos e armazenamento dos dados do app. |
| Supabase | Autenticação, sincronização da conta e policies RLS por usuário. |
| Painel Admin | Indicadores agregados e ferramentas administrativas de mensagens, sem acesso às linhas financeiras individuais. |

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
- Resumo compacto do limite usado nos cartões e próximo vencimento, com atalho para a carteira.

### 💳 Cartões de crédito
- Aba Carteira com limite total, parcelas em aberto, limite disponível, barra de uso, fechamento e próximo vencimento.
- O limite usado é calculado pelas parcelas não pagas; o valor opcional “Já gasto antes do app” fica no cartão e sincroniza entre aparelhos.
- O formulário existente de gastos cadastra compras no cartão com descrição, valor, data e parcelas.

### 💳 Dívidas e gastos recorrentes
- Rastreamento de parcelamentos, empréstimos e financiamentos.
- Barras de progresso, parcelas restantes e total devedor consolidado.
- Badge automático “🎉 Quitada!” ao quitar todas as parcelas.
- Gastos fixos repetidos nos meses do período definido; baixa independente por mês.
- Alternância Ativo/Inativo para pausar despesas sem excluí-las e filtros por tipo.

### 💰 Receitas e despesas
- Cadastro, edição e exclusão de receitas e gastos.
- Todo novo lançamento precisa de conta; sem contas, o primeiro cria a “Conta principal” com saldo inicial zero. Lançamentos antigos sem conta ficam para escolha manual quando já existem contas.
- Categorias de receita: Salário, Adiantamento, Renda Extra, Rendimentos e Outros.
- Lançamentos vinculados ao mês de competência da data informada.
- Forma de pagamento sincronizada; o backup já inclui `paymentMethod` e `previousSpent` nos objetos de lançamentos e cartões.

### 💸 Forma de pagamento
- Pix, débito, dinheiro e transferência com data de hoje ou anterior entram pagos; boleto e datas futuras entram pendentes.
- Lançamentos a pagar exigem dia de vencimento entre 1 e 31; gastos já pagos e ganhos não exigem esse campo.
- A forma escolhida fica lembrada por usuário; o status pago continua editável e lançamentos antigos mostram “Não informado”.
- Cartão de crédito cadastra compra e parcelas no cartão, sem debitar a conta até o pagamento da parcela.
- Lançamentos importados preservam a regra própria de pagamento e ficam sem forma informada.

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

### 🔔 Central de avisos
- Seis tipos locais, com prioridade dinâmica: saldo insuficiente e vencimento hoje/atrasado Crítico; cartão em 100% Crítico e desde 80% Atenção; vencimento próximo e gasto atípico Atenção; previsão do fim do mês Info; pagamentos importados para conferir Atenção.
- Avisos mostram cor, ícone e rótulo textual; a lista prioriza gravidade e depois recência, e o sino/contador acompanham o aviso não lido mais grave.
- Tocar no conteúdo navega para a tela, mês e item relacionado e destaca o destino; dispensas persistem para a mesma situação. Atualizações preservam tela, mês e rolagem, e o dashboard abre no topo.
- “Resumo mensal” não é um tipo separado na central; a previsão do fim do mês é o tipo mais próximo e fica como Info.

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
- Arraste e solte ou selecione um arquivo (.csv, .txt, .ofx, .xml ou .pdf).
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
- Fontes de renda múltiplas; checklist de gastos fixos cadastrados; grid de 16 categorias para gastos variáveis.
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
│   ├── logo-symbol.png        # Símbolo transparente da marca
│   ├── logo.jpg               # Logotipo legado preservado
│   ├── default_avatar.jpg     # Avatar padrão
│   ├── default_avatar_fem.jpg # Avatar feminino predefinido (256x256)
│   ├── icon-192.png           # Ícone PWA 192x192
│   ├── icon-512.png           # Ícone PWA 512x512
│   ├── icon-maskable-512.png  # Ícone maskable
│   ├── apple-touch-icon.png   # Ícone para iOS
│   ├── statement-guide-step-1.svg # Ilustração genérica: localizar extrato
│   ├── statement-guide-step-2.svg # Ilustração genérica: exportar arquivo
│   ├── statement-guide-step-3.svg # Ilustração genérica: importar e conferir
│   ├── inter-latin*.woff2       # Subconjuntos locais da fonte Inter
│   ├── OFL-Inter.txt            # Licença da fonte Inter
│   ├── LICENSE-Font-Awesome.txt # Licença dos ícones locais
│   └── fontawesome/             # CSS e webfonts locais do Font Awesome Free
├── css/
│   └── style.css              # Design System, dark mode, variáveis e animações
├── js/
│   ├── cache-assets.js        # Lista compartilhada dos recursos do precache
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
│       ├── 20261028_delete_my_account.sql # Exclusão de conta; aplicada no Supabase
│       ├── 20261029_feedback.sql # Canal de contato; aplicada no Supabase
│       ├── 20261031_admin_analytics.sql # Painel admin, eventos de uso e retenção de 12 meses; aplicada
│       ├── 20261101_sync_versioning.sql # Etapa 1 da sincronização; aplicada no Supabase
│       ├── 20261102_sync_realtime_publication.sql # Etapa 2 Realtime; aplicada no Supabase
│       ├── 20261103_sync_transactions.sql # Etapa 3; aplicada no Supabase
│       ├── 20261104_payment_method.sql # Formas de pagamento e gasto anterior; aplicada no Supabase
│       ├── 20261105_admin_consent.sql # Consentimentos e lista administrativa; criada, não aplicada
│       ├── 20261106_single_loan.sql # Empréstimo único; criada, não aplicada
│       ├── 20261107_admin_feedback_authors.sql # Autores de feedback para Admin; criada, não aplicada
│       └── 20261108_admin_email_text_cast.sql # Corrige tipo do e-mail nas funções administrativas; criada, não aplicada
├── tests/
│   ├── gastopro.test.js       # 613 testes em JavaScript puro, sem framework
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
| `gastopro_credit_cards_v1` | Cartões de crédito |
| `gastopro_credit_card_purchases_v1` | Compras e parcelas de cartões |
| `gastopro_payment_method_preference_v1:<uid>:<tipo>` | Última forma de pagamento por usuário e formulário |
| `gastopro_fixed_import_rules_v1` | Regras fixas de importação |
| `gastopro_theme` | Preferência de aparência deste aparelho (`dark` ou `light`), não sincronizada nem incluída no backup |
| `gastopro_last_uid` | UID da conta dona dos dados locais ativos |
| `gastopro_pending_sync_v1` | Fila de sincronização pendente |
| `gastopro_sync_metadata_v1` | Versão conhecida, hora de edição e diferença de relógio por registro |
| `gastopro_notifications_v1` | Histórico local da central de avisos |
| `gastopro_notification_preferences_v1` | Preferências locais dos cinco tipos de aviso |
| `gastopro_usage_telemetry_enabled_v1` | Preferência local de opt-out da coleta de eventos |
| `gastopro_last_view_v1` | Última tela principal por usuário |
| `gastopro_tutorial_seen` | Estado local do tutorial |
| `gastopro_account_setup_seen` | Estado local da configuração inicial de conta |

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
  "paymentMethod": "pix",
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

O registro pendente contém alterações e exclusões de lançamentos, templates, metas, contas, cartões e compras, além do perfil e regras fixas. Os registros locais guardam a versão `updated_at` conhecida e o instante da edição. Antes de enviar pendências, o app lê a nuvem e compara os relógios; alterações com diferença de até dois segundos favorecem o servidor. Conflitos exibem “Um item foi atualizado em outro aparelho”.

Metas são gravadas em `public.goals` por categoria, com upsert usando `onConflict: 'user_id,category'`; exclusões enfileiradas são enviadas pela fila pendente.

### Sincronização entre aparelhos

- **Etapa 1 — [x]:** versão por registro, `updated_at` definido no servidor, tombstones `deleted_at` e limpeza após 90 dias. Migration aplicada no Supabase. Commit `9219da3`. Após a poda, registro com versão conhecida ausente é tratado como excluído; só criações nunca sincronizadas são enviadas como novas.
- **Etapa 2 — [x]:** sync completa ao voltar ao app, focar a janela ou reconectar, serializada e com intervalo de 15 segundos; um canal Realtime assina as oito tabelas. Eventos antigos são ignorados, tombstones são aplicados, e alterações do registro em edição aguardam o fechamento do modal. Migration de publicação aplicada no Supabase.
- **Etapa 3 — [x]:** compra parcelada permanece uma única linha com ID estável, sem RPC. Os RPCs `delete_account_transactional` e `import_financial_batch` fazem, respectivamente, o desvínculo de lançamentos/templates/cartões/compras com exclusão lógica da conta e a importação atômica de lançamentos/templates/baixas. As operações ficam na fila offline com IDs e versões estáveis para retry; respeitam versões/tombstones e devolvem conflitos. O lote transacional aceita até 500 linhas de payload; acima disso, a importação inteira é recusada com aviso. Migration aplicada e conferida no Supabase.
- **Campos financeiros — [x]:** `payment_method` em lançamentos e `previous_spent` em cartões; sincronização, fila offline, Realtime e conflitos preservam os campos. Migration aplicada e conferida no Supabase.
- **Etapa 4 — [ ]:** reset e exclusões seguros, tela de aviso e testes finais.

### Pendências de validação manual

- Testar sincronização entre PC e celular: editar, excluir, edição simultânea e aviso de conflito.
- Testar “Meus dados” usando uma conta de teste, sem dados de produção.
- No iPhone, testar compra em 3x e limite, botão de topo, clique real no sino e cores dos avisos nos temas claro e escuro.

### Próximos passos

1. Etapa 4: reset e exclusões seguros, tela de aviso e testes finais.
2. RM-016 — Simulador de Cenários Futuros.
3. RM-017 — Exportação de dados adicionais.
4. RM-018 — Notificações push (parte 2).
5. RM-019 — Offline-First aprimorado com IndexedDB.
6. RM-020 — Ampliar cobertura de testes automatizados.
7. RM-032 — Contraste WCAG AA nas demais telas e gráficos (RM-034 cobre somente os avisos).
8. Itens em dúvida: mapeamento de colunas do CSV, cache offline de fontes e ícones, CI/CD.

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
| `subscribeToSyncChanges(userId, onChange, onFailure)` | Usa um canal Realtime único para as oito tabelas, filtrando pelo campo dono; em `profiles`, usa `id`. |
| `unsubscribeFromSyncChanges()` | Encerra o canal Realtime da sessão atual. |

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
- Fontes Inter e ícones Font Awesome Free são servidos localmente; as conexões externas do aplicativo são destinadas ao Supabase.
- A sincronização Supabase usa HTTPS/TLS e isolamento por usuário via RLS.

---

## 🗄️ Banco de dados

### Migrations

| Ordem | Migration | Estado no Supabase |
|---|---|---|
| 1 | `20261027_hardening.sql` | Aplicada |
| 2 | `20261028_accounts.sql` | Aplicada |
| 3 | `20261028_delete_my_account.sql` | Aplicada |
| 4 | `20261029_feedback.sql` | Aplicada |
| 5 | `20261030_account_balance_date.sql` | Aplicada |
| 6 | `20261030_credit_cards.sql` | Aplicada |
| 7 | `20261030_credit_cards_details.sql` | Aplicada |
| 8 | `20261030_credit_cards_purchases.sql` | Aplicada |
| 9 | `20261030_fixed_import_rules.sql` | Aplicada |
| 10 | `20261031_admin_analytics.sql` | Aplicada |
| 11 | `20261101_sync_versioning.sql` | Aplicada |
| 12 | `20261102_sync_realtime_publication.sql` | Aplicada |
| 13 | `20261103_sync_transactions.sql` | Aplicada e conferida no Supabase |
| 14 | `20261104_payment_method.sql` | Aplicada e conferida no Supabase |
| 15 | `20261105_admin_consent.sql` | Criada neste lote; não aplicada, aguarda revisão |
| 16 | `20261106_single_loan.sql` | Criada neste lote; não aplicada, aguarda revisão |
| 17 | `20261107_admin_feedback_authors.sql` | Criada neste lote; não aplicada, aguarda revisão |
| 18 | `20261108_admin_email_text_cast.sql` | Criada neste lote; não aplicada, aguarda revisão |
| 19 | `20261109_feedback_admin_read_at.sql` | Criada neste lote; não aplicada, aguarda revisão |

`CACHE_NAME` atual: `gastopro-v4.64`. Suíte atual: **632 testes**.

[`supabase/schema.sql`](./supabase/schema.sql) documenta as tabelas, validações, RLS, índices, permissões e triggers. Toda mudança no banco deve ser feita no painel e registrada neste arquivo. A migração [`supabase/migrations/20261027_hardening.sql`](./supabase/migrations/20261027_hardening.sql) foi aplicada e validada em produção em 28/10/2026.

As oito tabelas sincronizadas são `entries`, `fixed_templates`, `profiles`, `goals`, `accounts`, `credit_cards`, `credit_card_purchases` e `fixed_import_rules`; todas são restritas ao dono por RLS. As migrations [`supabase/migrations/20261101_sync_versioning.sql`](./supabase/migrations/20261101_sync_versioning.sql) e [`supabase/migrations/20261102_sync_realtime_publication.sql`](./supabase/migrations/20261102_sync_realtime_publication.sql) estão aplicadas. A migration [`supabase/migrations/20261105_admin_consent.sql`](./supabase/migrations/20261105_admin_consent.sql) foi criada neste lote e ainda não foi aplicada. Exclusão total de dados e exclusão de conta continuam físicas.

`public.accounts` contém `id`, `user_id`, `name`, `institution`, `type`, `initial_balance`, `created_at` e `updated_at`; `entries` e `fixed_templates` podem referenciar uma conta por `account_id`, com chave estrangeira composta que impede vínculo entre usuários. Empréstimos são templates com valor/data recebidos, total, número de parcelas, parcela e vencimento; o recebimento compõe somente o saldo da conta e `paid_months` registra baixas manuais. A migração [`supabase/migrations/20261106_single_loan.sql`](./supabase/migrations/20261106_single_loan.sql) define esses campos e ainda não foi aplicada. A migração [`supabase/migrations/20261028_accounts.sql`](./supabase/migrations/20261028_accounts.sql) foi aplicada em produção. A função `public.delete_my_account()` remove a conta Auth do usuário autenticado e depende dos `ON DELETE CASCADE` existentes; sua migração [`supabase/migrations/20261028_delete_my_account.sql`](./supabase/migrations/20261028_delete_my_account.sql) está aplicada.

O app envia nome e avatar para `profiles` ao editar o perfil autenticado; alterações locais são preservadas para nova tentativa de sincronização. `entries.debt_info` é um JSONB opcional, sem estrutura definida pelo código atual.

A migração [`supabase/migrations/20261029_feedback.sql`](./supabase/migrations/20261029_feedback.sql), aplicada no Supabase, cria `app_admins` e `feedback_messages`, as policies de RLS, `is_admin()` e o limite de cinco mensagens por usuário em 24 horas. O administrador pode ler mensagens e responder, mas não recebe acesso às tabelas financeiras nem a `profiles`; a lista de administradores é mantida diretamente pelo SQL Editor. Mensagens são obtidas sob demanda e não entram no localStorage, na fila financeira, no backup ou no Reset.

A migration [`supabase/migrations/20261031_admin_analytics.sql`](./supabase/migrations/20261031_admin_analytics.sql) implementa `admin_analytics_summary()` com métricas agregadas, `usage_events` com lista permitida de eventos e limpeza automática após 12 meses via `pg_cron`. A migration não aplicada [`supabase/migrations/20261105_admin_consent.sql`](./supabase/migrations/20261105_admin_consent.sql) adiciona consentimentos opcionais, impede gravar eventos sem telemetria ativa e limita a lista de usuários administrativos a identidades consentidas. O painel também usa `app_admins`/`is_admin()` e o canal `feedback_messages`.

Para criar um projeto Supabase, execute `supabase/schema.sql` no SQL Editor. Consulte também [Executar, configurar e publicar](#-executar-configurar-e-publicar).

---

## 🧪 Testes

Suite com **601 casos de teste** em JavaScript puro, sem frameworks. Os testes usam mocks do `localStorage` e do Supabase; os dados reais não são afetados.

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
| `Sincronização entre aparelhos — Realtime` | Lifecycle ao retornar, intervalo de 15 segundos, canal único, versões antigas, tombstones, edição aberta e fallback sem Realtime. |
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
- Pix, débito, dinheiro e transferência com data até hoje entram pagos; boleto e qualquer forma com data futura entram pendentes. O usuário pode alterar manualmente o status.
- Empréstimos e parcelamentos seguem a forma de pagamento e a data informadas; a importação mantém a regra própria de pagamento.
- O uso de PDF é limitado a documentos com texto selecionável; a prévia deve ser conferida.

---

## 🗺️ Roadmap

Legenda: `[ ]` pendente | `[x]` implementado e testado. Veja as instruções para agentes em [`.github/copilot-instructions.md`](./.github/copilot-instructions.md).

### Itens

- [x] **RM-001 — Acessibilidade na navegação e nos modais** / Descrição: melhorias de acessibilidade no bloco 5.1. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-002 — Reconhecimento de parcelas na importação** / Descrição: reconhecer parcelas, criar dívida com parcelas anteriores baixadas ou dar baixa em dívida existente (bloco 6A). / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-003 — Importação de OFX e XML de nota fiscal** / Descrição: importar OFX e NF-e/NFC-e (bloco 6B). / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-004 — Importação de Pix e linhas digitáveis de boleto** / Descrição: importar Pix copia e cola e boletos (bloco 6D). / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-005 — Ajuda embutida no modal do importador** / Descrição: orientar sobre formatos, prévia, parcelas, duplicados e privacidade. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-006 — Importação de PDF de extrato ou fatura** / Descrição: ler localmente PDFs com texto selecionável (bloco 6C). / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-007 — Metas e alertas de teto por categoria** / Descrição: seção no dashboard, cards, modal, edição e alertas em 80% e 100%. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-008 — Relatório financeiro em PDF** / Descrição: relatório mensal, anual ou por intervalo com totais, categorias, dívidas, metas, diagnóstico e detalhamento opcional. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-009 — Deduplicação na importação de extratos** / Descrição: desmarcar duplicatas existentes ou repetidas no arquivo, permitindo importação manual forçada. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-010 — Metas sincronizadas com a nuvem** / Descrição: sincronizar metas por categoria com `public.goals`, incluindo upserts e exclusões pendentes. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-011 — Hardening do banco aplicado** / Descrição: aplicar a migração `supabase/migrations/20261027_hardening.sql` ao banco. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-012 — Contas a pagar em CSV** / Descrição: aceitar colunas `tipo`, `mes_inicio`, `mes_fim`, `dia_venc` e `ativo`. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-013 — Categoria no CSV** / Descrição: aceitar a coluna opcional `categoria`. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-014 — Tipo OFX por TRNTYPE e descrição padrão** / Descrição: usar TRNTYPE conhecido, fallback de descrição vazia e aviso para OFX sem transações. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-015 — Reset sem apagar perfil** / Descrição: reset financeiro preserva identidade da conta e perfil. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-016 — Simulador de Cenários Futuros (“E se...”)** / Descrição: simular pagamento extra de dívida e estimar quitação; projetar amortização com gráfico de linha; simular corte de categoria (por exemplo, reduzir Alimentação em 20%); comparar antes/depois em painel lateral. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-017 — Exportação de dados adicionais** / Descrição: exportar lançamentos em Excel/CSV filtrados por período e oferecer exportações adicionais em Excel/CSV. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-018 — Notificações push (parte 2)** / Descrição: enviar notificações push com o app fechado via Service Worker e Edge Function agendada; reavaliar apenas se couber no plano gratuito. A central interna (parte 1) está implementada como Lote B1. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-019 — Offline-First aprimorado com IndexedDB** / Descrição: migrar de localStorage para IndexedDB para maior capacidade e performance; manter fila para operações offline e envio ao reconectar; exibir status de conectividade na UI. / Critério de pronto: a definir. / Arquivos: a definir.
- [ ] **RM-020 — Ampliar cobertura de testes automatizados** / Descrição: testes para o fluxo completo de quatro passos do Wizard. / Critério de pronto: a definir. / Arquivos: a definir.

### Novas melhorias

- [x] **RM-025 — Contas PF/PJ, saldo inicial, filtro e ajuste rápido** / Descrição: cadastro de contas PF/PJ, saldo inicial e data-base, filtro no Dashboard e ajuste rápido do saldo; com sincronização e backup. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`.
- [x] **RM-026 — Cartões, parcelas e limites** / Descrição: emissor, bandeira, cor personalizada, visual de carteira, compras parceladas até 24x, projeção das parcelas e alertas de limite. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`.
- [x] **RM-027 — Mais palavras-chave na categorização** / Descrição: ampliar as regras de categoria automática do importador. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-028 — Recuperação de conta e confirmação de e-mail** / Descrição: mensagens neutras e específicas para redefinição, espera visual entre pedidos, confirmação dupla no cadastro e orientação sem consulta a e-mails existentes. / Critério de pronto: testes automatizados aprovados e validação responsiva. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-029 — Importação de despesas futuras e restauração de tela** / Descrição: despesas futuras de CSV entram como a pagar; parcelas `N de M` são reconhecidas apenas no CSV; a última tela principal é restaurada com isolamento por usuário e verificação de Admin. / Critério de pronto: testes automatizados aprovados. / Arquivos: `js/importer.js`, `js/app.js`, `js/data.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-030 — Evitar gravações duplicadas ao salvar** / Descrição: trava reutilizável de salvamento com estado visual/acessível e espera de sincronização; modo local sem espera. / Critério de pronto: testes automatizados aprovados. / Arquivos: `js/app.js`, `tests/gastopro.test.js`.
- [x] **RM-031 — Guia para obter extrato bancário** / Descrição: guia acessível de três passos com ilustrações genéricas, botão no importador e atalho em Primeiros passos. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/onboarding.js`, `js/app.js`, `css/style.css`, `assets/statement-guide-step-*.svg`, `sw.js`, `tests/gastopro.test.js`.
- [x] **RM-032 — Contraste WCAG AA em celular e gráficos** / Descrição: contraste mínimo AA nas áreas mobile alteradas, avisos e textos sobre fundos coloridos nos temas claro e escuro. / Critério de pronto: testes automatizados aprovados.
- [x] **RM-034 — Contraste WCAG AA nos avisos** / Descrição: cores de Crítico, Atenção e Info com contraste AA nos temas claro e escuro, exclusivamente na central de avisos. O contraste nas áreas mobile alteradas foi concluído no RM-032; gráficos não foram alterados neste lote.
- [x] **RM-035 — Navegação contextual e preservação de tela** / Descrição: avisos levam à tela, mês e item relacionados; dispensas persistem pela situação; atualizações preservam a navegação e o dashboard abre no topo. / Critério de pronto: testes automatizados aprovados. / Arquivos: `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-036 — Carteira de cartões e limite calculado** / Descrição: aba Cartões, limite usado pelas parcelas em aberto, gasto anterior opcional sincronizado, atalho do dashboard e estado vazio. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-037 — Forma de pagamento e status automático** / Descrição: seleção rápida acessível, preferência por usuário, status inicial por forma/data, compra no crédito sem débito imediato e migração de gasto anterior para o cartão. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `js/supabase.js`, `css/style.css`, `supabase/schema.sql`, `supabase/migrations/20261104_payment_method.sql`, `tests/gastopro.test.js`.
- [x] **RM-041 — Painel do usuário e ações destrutivas claras** / Descrição: painel reorganizado, confirmações por frase, modal independente para apagar dados, camadas acima da navegação e rolagem de fundo bloqueada. / Critério de pronto: testes automatizados e verificação visual aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `js/a11y.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-042 — Camadas globais e cabeçalho mobile** / Descrição: ordenação de foco e z-index entre navegação, gavetas, avisos, modais, confirmações e toasts; cabeçalho mobile ampliado com compactação em paisagem baixa. / Critério de pronto: testes automatizados e validação visual em retrato e paisagem nos dois temas.
- [x] **RM-038 — Home mobile e navegação inferior** / Descrição: cabeçalho com logo, seletor compacto, valores financeiros, faixa de avisos, grade de cartões-resumo e navegação fixa acessível. / Critério de pronto: testes automatizados aprovados.
- [x] **RM-039 — Saldo em destaque e aviso de projeção no dashboard mobile** / Descrição: saldo real sem alteração pela projeção, aviso para saídas pendentes do mês, grade compacta, tipografia sem quebra forçada e navegação iniciada no topo. / Critério de pronto: testes automatizados e validação visual em 320, 360, 390 e 430 px nos dois temas. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-040 — Metas mobile, legenda dos fixos e paisagem compacta** / Descrição: navegação direta ao painel de metas com respeito às barras fixas, contagem de fixos pagos no dashboard e cabeçalho/menu compactos em paisagem baixa. / Critério de pronto: testes automatizados aprovados e validação visual nos dois temas.
- [x] **RM-043 — Zoom de campos e layout responsivo** / Descrição: campos com fonte mínima de 16 px, avisos e perfil sem overflow, cabeçalho e navegação mobile compactos e limpeza da chave legada de gasto anterior. / Critério de pronto: suíte automatizada aprovada e verificação visual em 320, 360, 390 e paisagem nos dois temas. / Arquivos: `css/style.css`, `js/data.js`, `tests/gastopro.test.js`.
- [x] **RM-044 — Home unificada e lançamentos responsivos** / Descrição: home única com saldo, avisos e quatro KPIs em colunas adaptáveis; meios de pagamento em selects; cartões de ganhos/gastos com chips e data sem corte. / Critério de pronto: 389 testes aprovados e medições geométricas nas larguras previstas, em dois temas. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.
- [ ] **RM-045 — Relatório para o contador (gerado no aparelho, sem custo)** / Ideia futura após a Etapa 4. Fase 1: CSV e relatório filtrado por conta, com ganhos e gastos por categoria. Fase 2, somente após ouvir 2 ou 3 contadores: nota ou comprovante, dedutível, com/sem nota, revenda/serviço e migration. O relatório é um organizador e não substitui informe de rendimentos nem nota fiscal.
- [x] **RM-046 — Tela única de lançamento e menu lateral** / Descrição: formulário de gasto/ganho alternável sem duplicar IDs, confirmação após salvar, contadores neutros, itens laterais sem destaque falso e avatares ajustados. / Critério de pronto: testes funcionais sem falhas e medição geométrica nas sete larguras e nos dois temas.
- [ ] **RM-047 — Redesenhar e atualizar o site-currículo (conta GitHub da faculdade), incluindo o GastoPro como projeto de portfólio.**
- [x] **RM-048 — Sidebar e painel do usuário organizados por função** / Descrição: tema em local único e acesso a Fale comigo sem duplicação; painel separado em Perfil, Preferências, Conta, Dados e backup, Ajuda e Zona de perigo. / Critério de pronto: testes estruturais aprovados e medições geométricas nas sete larguras e nos dois temas.
- [x] **RM-049 — Painel administrativo reorganizado** / Descrição: hierarquia visual, indicadores e mensagens organizados e responsivos; sem campos de registros financeiros individuais. / Critério de pronto: testes estruturais aprovados e conferência responsiva nos dois temas.
- [x] **RM-050 — Zona de perigo e textos longos resilientes** / Descrição: descrições originais das ações destrutivas restauradas; e-mails longos do Admin podem quebrar em separadores sem overflow horizontal. / Critério de pronto: suíte automatizada aprovada e conferência responsiva nos dois temas.
- [x] **RM-051 — Diagnóstico local temporário de sessão e navegação** / Descrição: registro circular local com eventos de autenticação, navegação, ciclo de vida, sincronização, Service Worker e Admin; leitura, cópia e limpeza no Painel do Usuário, sem armazenar identificadores pessoais. / Critério de pronto: 458 testes aprovados e medições geométricas nas sete larguras e nos dois temas. / Arquivos: `index.html`, `js/app.js`, `js/supabase.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-052 — Contas obrigatórias, vencimento explícito e acesso a ganhos** / Descrição: cria Conta principal somente quando necessário, exige destino nos lançamentos e mantém antigos sem conta para escolha; valida dias de vencimento sem fallback; ajuste de saldo usa o valor calculado e a navegação de Ganhos abre o formulário correspondente. / Critério de pronto: 467 testes aprovados e medições geométricas nas sete larguras e nos dois temas. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `js/importer.js`, `js/supabase.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-053 — Origem do vencimento de boleto e aviso de mês curto** / Descrição: identifica dias lidos do fator de boletos, mantém sem dia linhas sem vencimento explícito e avisa quando dia 31 altera a data da linha. / Critério de pronto: 472 testes aprovados; regras de contraste, controles e alvos verificadas no CSS. A medição real da prévia não foi executada. / Arquivos: `js/app.js`, `js/importer.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-054 — Saldo principal do dashboard acionável** / Descrição: transforma o saldo principal do dashboard em botão acessível que abre o ajuste da conta. / Critério de pronto: 473 testes aprovados em três execuções; clique real validado no navegador com zero, uma e duas contas. O saldo superior permaneceu oculto pela regra CSS existente e não foi alterado. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-055 — Empréstimo como lançamento único** / Descrição: armazena empréstimo em template com crédito de recebimento fora da renda, parcelas baixadas manualmente, custo no Centro de Dívidas e sincronização com a nuvem; remove a contagem individual de lançamentos no Admin. / Critério de pronto: 479 testes aprovados; migration criada e não aplicada. Medição geométrica da tela real não realizada. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `js/report.js`, `js/supabase.js`, `css/style.css`, `supabase/schema.sql`, `supabase/migrations/20261106_single_loan.sql`, `tests/gastopro.test.js`.
- [x] **RM-056 — Confirmação de conta no primeiro lançamento e seletor no ajuste** / Descrição: ao salvar sem conta, pede confirmação da Conta principal antes de gravar ganhos, gastos comuns, fixos, dívidas, empréstimos, parcelamentos, boletos, assistente inicial ou importação; cancelar não cria nem salva. A camada de dados bloqueia criação implícita, exceto na migração de lançamentos antigos, fora deste item. Ajuste de saldo abre direto com uma conta, exige escolha sem pré-seleção com várias e não cria conta quando não há nenhuma. / Critério de pronto: 485 testes aprovados; formulários medidos em 320, 390 e 1280 px nos temas claro/escuro, sem corte, com controles de 44 px e campos de 16 px ou mais; contraste mínimo atendido. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`, `sw.js`, `tests/gastopro.test.js`, `README.md`.
- [x] **RM-057 — Centros de controle mensais para Ganhos e Gastos** / Descrição: listas mensais com tipo, valor, data/dia, conta, situação, edição e exclusão; atalhos de criação levam a Lançamentos. Modelos recorrentes avisam que editar/excluir afeta o modelo e seus meses; empréstimos recebidos permanecem fora de Ganhos. / Critério de pronto: 491 testes aprovados; telas medidas em 320, 360, 390, 768, 1024, 1280 e paisagem 844×390 nos temas claro/escuro, sem corte, com alvos >= 44 px e contraste >= 4.5:1 para texto e >= 3:1 para ícones. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`, `sw.js`, `tests/gastopro.test.js`, `README.md`.
- [x] **RM-058 — Autoria consentida e avisos de feedback no Admin** / Descrição: mostra autor numerado sem consentimento ou nome/e-mail com `admin_visibility`; inclui feedback novo não lido no sino local e mantém o contador Admin sincronizado. A migração restrita `admin_feedback_authors()` não altera RLS e não foi aplicada. / Critério de pronto: 494 testes aprovados no test-runner com o código real; aparência em tela não medida. / Arquivos: `js/app.js`, `js/supabase.js`, `css/style.css`, `supabase/schema.sql`, `supabase/migrations/20261107_admin_feedback_authors.sql`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-059 — Estado e diagnóstico das mensagens de feedback** / Descrição: ao abrir Mensagens do Admin, o filtro volta a Novas sem interferir no refresh manual; falhas das consultas administrativas ficam no Diagnóstico sem IDs, e-mails ou conteúdo do feedback; mensagens do cliente aparecem da mais recente para a mais antiga, com status, datas e resposta associada. / Critério de pronto: 497 testes aprovados no test-runner com código real; testes de consultas Supabase usam mock; aparência/toque em tela não verificados. / Arquivos: `js/app.js`, `js/supabase.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-060 — Diagnóstico seguro, avatar feminino e aviso de atualização** / Descrição: erros administrativos usam mensagem fixa e não registram detalhes/hints; avatar feminino predefinido é selecionável e sincronizado no campo existente; aviso de Service Worker aguardando chama a verificação manual e registra sua exibição; navegação “Metas”/“Mais” permanece correta. / Critério de pronto: 503 testes aprovados no test-runner; layout do aviso e avatares verificados em 320, 390 e 1280 px nos dois temas; tela em dispositivo não verificada. / Arquivos: `js/app.js`, `js/cache-assets.js`, `assets/default_avatar_fem.jpg`, `css/style.css`, `index.html`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-061 — Refinamento do avatar feminino** / Descrição: rosto, pescoço e ombros refinados; cabelo em camadas roxo/turquesa; traços faciais, sombra de luz e detalhe na roupa. / Critério de pronto: 504 testes aprovados; seleção coberta; visual em tela não verificado. / Arquivos: `assets/default_avatar_fem.jpg`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-062 — Avatar feminino em JPEG** / Descrição: substitui o recurso feminino pelo JPEG 256x256 sem alterar o ID persistido, remove o SVG de avatar e mantém o JPG no cache. / Critério de pronto: 504 testes aprovados no test-runner; visual do avatar não verificado em tela. / Arquivos: `assets/default_avatar_fem.jpg`, `js/app.js`, `js/cache-assets.js`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-063 — Leitura na nuvem do feedback Admin** / Descrição: `admin_read_at` controla lista e contagem de mensagens não lidas; abrir resposta ou marcar como lida grava somente essa coluna, enquanto avisos de contas continuam locais. Sem Realtime ou polling. / Critério de pronto: 510 testes aprovados; testes da API Supabase usam mock; RLS/tipos reais não verificados e visual/toque não verificados em tela. / Arquivos: `js/app.js`, `js/supabase.js`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-064 — Cabeçalho explícito da zona de perigo** / Descrição: cabeçalho recolhível mostra ações internas, chevron giratório e estado `aria-expanded`; botões críticos, handlers e confirmações permanecem inalterados. / Critério de pronto: 514 testes aprovados; testes não medem layout real; visual/toque e layout em larguras/temas não verificados em tela. / Arquivos: `index.html`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-065 — Helpers puros para totais mensais de dívidas** / Descrição: adiciona o resumo de parcelas em atraso, mês atual, próximo mês, saldo restante e dívidas sem data final; separa gastos fixos recorrentes sem fim e mantém ganhos fora dos totais. / Critério de pronto: 530 testes aprovados no test-runner; visual/toque e layout não verificados em tela. / Arquivos: `js/app.js`, `js/data.js`, `tests/gastopro.test.js`, `index.html`, `css/style.css`, `sw.js`, `README.md`.
- [x] **RM-066 — Filtro de conta na home e relatório financeiro CSV/PDF** / Descrição: filtra os totais e listas do dashboard por todas as contas, PF/PJ ou conta individual; exporta localmente lançamentos do período filtrado em CSV com escape e neutralização de fórmulas, e em PDF com o gerador local existente. / Critério de pronto: 546 testes aprovados, zero falhas/pendências; aparência/toque e layout não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `js/report.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-067 — Login Google via OAuth** / Descrição: inicia autenticação com provider Google pelo cliente Supabase e callback local da aplicação; mantém o processamento de sessão existente, exige consentimento de privacidade no cadastro e mostra mensagem fixa sem expor detalhes de erro. / Critério de pronto: 550 testes aprovados com Supabase mockado; fluxo real com Google e visual/toque não verificados. / Arquivos: `index.html`, `js/app.js`, `js/supabase.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-068 — Aviso de saída com backup único e reset financeiro seguro** / Descrição: oculta corretamente o botão secundário de backup quando não há ação secundária; o reset já percorre exclusões por registro, sem enviar listas grandes de IDs. / Critério de pronto: 563 testes aprovados, zero falhas/pendências; testes de exclusão usam Supabase mockado; visual/toque não verificados em tela. / Arquivos: `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-069 — Nome Google inicial e diagnóstico local de sincronização** / Descrição: preenche o nome do perfil vazio com `full_name` ou `name` da primeira entrada Google sem substituir nome escolhido; registra no Diagnóstico temporário a categoria ou tipo transacional que falhou, com código fixo e sem dados pessoais, somente neste aparelho. A seção temporária será removida no U-12. / Critério de pronto: 567 testes aprovados, zero falhas/pendências; mocks de Supabase usados; tela e login Google real não verificados. / Arquivos: `js/app.js`, `js/data.js`, `tests/gastopro.test.js`, `sw.js`, `index.html`, `README.md`.
- [x] **RM-070 — Avatar Google inicial no perfil** / Descrição: usa como avatar inicial apenas URL HTTPS validada de `googleusercontent.com`; preserva escolha/remoção, não baixa a imagem e usa avatar local em falha. CSP libera somente o domínio de imagem em `img-src`; política descreve armazenamento do endereço. / Critério de pronto: 572 testes aprovados, zero falhas/pendências; Supabase mockado para validar persistência; visual/toque e login Google real não verificados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `supabase/schema.sql`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-071 — Diagnóstico dos formulários, modelo CSV e tutoriais recolhíveis** / Descrição: retornos sem efeito dos formulários mostram aviso e registram apenas categoria fixa no Diagnóstico local; modelo CSV inclui BOM UTF-8 e CRLF sem alterar o cabeçalho; tutoriais do painel ficam recolhidos em controle acessível. / Critério de pronto: 575 testes aprovados, zero falhas/pendências; Supabase mockado; Excel, visual e toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `js/importer.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-072 — Apresentação do produto e teste de rolagem determinístico** / Descrição: documenta proposta, importação, privacidade, acesso e arquitetura; estabiliza o teste de navegação até Metas fixando a altura de viewport no fixture, sem alterar a lógica do app. / Critério de pronto: 575 testes aprovados em duas execuções, zero falhas/pendências; consultas Supabase mockadas. / Arquivos: `README.md`, `tests/gastopro.test.js`, `index.html`, `sw.js`.
- [x] **RM-073 — Aba dedicada de Empréstimos** / Descrição: adiciona tela, formulário próprio, resumo das parcelas, conflitos com prévia e escolha explícita para manter, excluir ou cancelar; mantém recebimentos fora da renda e sincroniza exclusões pelo fluxo existente, sem migration. / Critério de pronto: 586 testes aprovados em duas execuções, zero falhas/pendências; Supabase mockado; visual e toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `js/loans.js`, `js/cache-assets.js`, `css/style.css`, `tests/gastopro.test.js`, `tests/test-runner.html`, `README.md`.
- [x] **RM-074 — Destaque do login Google, modelo CSV e rótulos de cópia** / Descrição: reforça o botão Google com contraste acessível; mantém o modelo CSV sem linhas de comentário e ensina as regras na importação; esclarece que a cópia de segurança restaura no app e renomeia o relatório para leitura/impressão. / Critério de pronto: 589 testes aprovados em duas execuções, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela. / Arquivos: `css/style.css`, `index.html`, `js/app.js`, `js/data.js`, `js/importer.js`, `tests/gastopro.test.js`, `README.md`, `sw.js`.
- [x] **RM-075 — Exclusão idempotente de regra de importação ausente** / Descrição: trata como sucesso a exclusão de `fixed_import_rules` quando a linha do usuário não existe na nuvem, sem mudar o comportamento das demais tabelas. / Critério de pronto: 595 testes aprovados em duas execuções consecutivas, zero falhas/pendências; testes Supabase mockados. / Arquivos: `js/supabase.js`, `tests/gastopro.test.js`, `README.md`, `index.html`, `sw.js`.
- [x] **RM-076 — Validação do mês final do empréstimo** / Descrição: protege a persistência contra modelos cujo mês final não corresponde ao mês inicial acrescido de parcelas menos um; o formulário calcula o mês final pela mesma regra. / Critério de pronto: 597 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado. / Arquivos: `tests/gastopro.test.js`, `README.md`, `index.html`, `sw.js`.
- [x] **RM-077 — Campos obrigatórios ocultos e feedback de envio** / Descrição: ajusta a obrigatoriedade das contas no formulário de gasto conforme o campo visível, corrige vencimento oculto na edição de ganhos e identifica o campo que bloqueou o envio; o Diagnóstico local registra apenas categoria e ID do campo oculto. / Critério de pronto: 599 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-078 — Painel reorganizado, alertas de erro e arquivamento de feedback** / Descrição: agrupa as ações do Painel do Usuário por contexto sem trocar handlers; erros usam ícone de alerta mantendo o check de sucesso; acrescenta `admin_archived_at` com UPDATE limitado à coluna e sem alterar a policy. / Critério de pronto: 601 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; migration criada, não executada; visual/toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`, `supabase/schema.sql`, `supabase/migrations/20261112_feedback_admin_archive.sql`, `sw.js`, `README.md`.
- [x] **RM-079 — Etapas de importação, motivos de exclusão e estado de feedback** / Descrição: mostra as etapas da importação, uma conclusão com quantidades e itens não importados com motivo; registra linhas ignoradas pelo analisador e oferece sugestões locais; conclui filtros e ações de arquivamento/leitura no Admin; mantém o filtro após exclusão variável com sincronização pendente. / Critério de pronto: 609 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; migration de arquivamento existente não executada; visual/toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `js/supabase.js`, `js/importer.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-080 — Estados de envio, templates ativos e saldo OFX** / Descrição: anuncia Enviando/Salvo/Erro e pendência de nuvem nos formulários de Ganhos, Gastos e Empréstimos; oculta templates com tombstone apenas nas telas sem removê-los do sync ou backup; exibe na prévia OFX o banco, conta mascarada e saldo/data, sem persistir metadados. / Critério de pronto: 612 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `js/importer.js`, `css/style.css`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-081 — Motivo local de falha ao sair** / Descrição: identifica grupos e código seguro da falha de sincronização na confirmação de logout, sem expor valores, descrições ou mensagens arbitrárias. / Critério de pronto: 613 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela. / Arquivos: `js/app.js`, `tests/gastopro.test.js`, `index.html`, `sw.js`, `README.md`.
- [x] **RM-083 — Destaque acessível do login Google** / Descrição: destaca somente o botão de entrada Google com fundo branco, G oficial local, nome acessível e estados de interação; mantém ID e fluxo OAuth. / Critério de pronto: 626 testes aprovados em duas execuções consecutivas, zero falhas/pendências; visual em iPhone não verificado. / Arquivos: `assets/google-g.svg`, `index.html`, `css/style.css`, `js/cache-assets.js`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-084 — Diagnóstico local de falhas de sincronização e acesso temporário** / Descrição: classifica falhas de sync apenas no registro local com status/código seguros, e revela o painel de diagnóstico por sete toques no selo de versão, com preferência local persistente. / Critério de pronto: 626 testes aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual e toque em iPhone não verificados. / Arquivos: `index.html`, `js/app.js`, `js/supabase.js`, `tests/gastopro.test.js`, `sw.js`, `README.md`.
- [x] **RM-085 — Destaque do Importar Extrato no menu** / Descrição: diferencia o item de importação do estado selecionado com ícone/borda de acento, fundo suave, texto em negrito e foco visível nos dois temas; mantém a etiqueta NOVO e o destaque roxo ativo. / Critério de pronto: 626 testes aprovados em duas execuções consecutivas, zero falhas/pendências; aparência e toque em iPhone não verificados. / Arquivos: `css/style.css`, `tests/gastopro.test.js`, `README.md`.
- [x] **RM-086 — Arredondamento e sinalização na importação** / Descrição: arredonda valores em centavos nos formatos CSV, texto/PDF, OFX, XML, Pix e boleto; sinaliza divergência explícita de tipo/sinal e movimentações próprias/investimentos sem seleção automática; avisa sobre pagamento de fatura sem deduplicar linhas do arquivo. / Critério de pronto: 632 testes aprovados em duas execuções consecutivas, zero falhas/pendências; comportamento de seleção automatizada coberto. / Arquivos: `js/importer.js`, `js/app.js`, `tests/gastopro.test.js`, `README.md`.
- [x] **RM-087 — Botões secundários de login e cadastro** / Descrição: aplica fundo transparente, borda/texto na cor de acento, foco visível e estado desabilitado aos botões Entrar no GastoPro e Criar Minha Conta Gratuita. Contraste texto/borda: 5,83:1 (escuro), 9,93:1 (claro); foco: 3,89:1 (escuro), 6,29:1 (claro). / Critério de pronto: 632 testes aprovados em duas execuções consecutivas; tamanhos responsivos e aparência em iPhone não verificados em tela. / Arquivos: `css/style.css`, `tests/gastopro.test.js`, `README.md`.
- [x] **RM-088 — Aviso de OFX no guia de extrato** / Descrição: orienta que arquivos OFX baixados do e-mail podem não aparecer no app Arquivos do iPhone; preserva os demais passos. / Critério de pronto: texto coberto pela suíte de 632 testes; apresentação visual não verificada em tela. / Arquivos: `js/onboarding.js`, `tests/gastopro.test.js`, `README.md`.

### Em dúvida

- Mapeamento de colunas do CSV configurável pelo usuário.
- Cache offline de fontes e ícones.
- Pipeline CI/CD.

---

## 📋 Changelog

### v4.64 — 03/11/2026 (versão atual)

- RM-086: arredonda valores importados em centavos; sinaliza divergência de tipo/sinal e movimentações próprias/investimentos para revisão, sem deduplicar linhas do mesmo arquivo; mantém pagamentos de fatura selecionados com aviso. RM-087: aplica estilo secundário aos botões de login/cadastro compartilhando a classe existente. RM-088: explica a limitação de arquivos OFX de e-mail no iPhone. Test-runner: 632 aprovados em duas execuções consecutivas, zero falhas/pendências; contraste calculado; visual/toque em iPhone não verificados.

### v4.63 — 03/11/2026 (versão anterior)

- RM-083: substitui as letras coloridas do botão Google por um G oficial local em SVG, mantém nome acessível e fluxo OAuth e adiciona o asset ao cache offline. RM-085: destaca Importar Extrato com acento distinto do estado selecionado nos dois temas, mantendo NOVO. Test-runner: 626 aprovados em duas execuções consecutivas, zero falhas/pendências; contraste calculado; visual/toque em iPhone não verificados.

### v4.62 — 03/11/2026 (versão anterior)

- RM-084: registra falhas de sincronização no diagnóstico local com categoria, status HTTP e código seguro quando disponíveis; não grava mensagens, valores nem identificadores. O painel fica oculto por padrão e abre/fecha após sete toques no selo de versão, com preferência somente local; lista de telemetria Supabase inalterada. Test-runner: 626 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual e toque em iPhone não verificados.

### v4.61 — 03/11/2026 (versão anterior)

- RM-081: a confirmação de logout identifica os grupos com falha e mostra um código seguro quando disponível; detalhes arbitrários e dados do lançamento não são exibidos. Test-runner: 613 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela.
- RM-083: introduz destaque acessível do botão Google com nome acessível e fluxo OAuth preservado. Test-runner: 621 aprovados em duas execuções consecutivas, zero falhas/pendências; visual em iPhone não verificado.

### v4.58 — 03/11/2026

- RM-080: adiciona estados acessíveis de salvamento nos formulários, mantém templates excluídos para sincronização/backup enquanto oculta as projeções na interface, e mostra banco, conta mascarada e saldo com data do OFX somente na prévia. Test-runner: 612 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela.

### v4.57 — 03/11/2026 (versão anterior)

- RM-079: adiciona etapas e tela final ao importador, lista itens não importados com motivo, registra linhas ignoradas e exibe sugestões locais; conclui arquivamento e leitura de feedback no Admin com filtros; cobre exclusão variável e sincronização pendente; erros usam tipo de toast `error`. Test-runner: 609 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela. Migration existente `admin_archived_at` não executada.

### v4.56 — 03/11/2026 (versão anterior)

- RM-078: agrupa o Painel do Usuário em Conta, Privacidade, Dados e cópia de segurança, App e Avançado sem trocar IDs ou handlers; conserva a versão no card de atualização porque o rodapé não fica visível sem rolagem em 320×800, 390×844 e 844×390; erros usam alerta e sucessos mantêm o check. Migration `admin_archived_at` criada e não executada. Test-runner: 601 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; aparência e toque em tela não verificados.

### v4.55 — 03/11/2026 (versão anterior)

- RM-077: impede campos de conta de crédito ocultos de bloquear gastos no débito, mantém obrigatoriedade de cartão/conta no crédito, limpa vencimento obrigatório quando a edição vira ganho e informa o campo inválido; ID de campo oculto registrado sem valores. Test-runner: 599 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado.

### v4.54 — 03/11/2026 (versão anterior)

- RM-076: adiciona testes de persistência para mês final consistente e inconsistente; a validação existente recusa divergências antes de gravar, e o formulário calcula o final a partir do mês inicial e da quantidade de parcelas. Test-runner: 597 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado.

### v4.53 — 03/11/2026 (versão anterior)

- RM-075: trata exclusão de linha ausente como sucesso idempotente somente para `fixed_import_rules`; outras tabelas continuam exigindo confirmação de exclusão. Test-runner: 595 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado.

### v4.52 — 02/11/2026 (versão anterior)

- RM-074: destaca Entrar com Google com altura mínima de 48 px e contraste calculado acima de 4,5:1 nos dois temas; remove comentários do modelo CSV mantendo compatibilidade com arquivos antigos; explica a cópia de segurança para restaurar no app e renomeia o relatório para leitura/impressão. Test-runner: 589 aprovados em duas execuções consecutivas, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela.
- Testes adicionais (somente testes): cobre limites de validação do formulário de Empréstimos e aplicação real dos temas no botão Google. Test-runner: 594 aprovados em duas execuções, zero falhas/pendências; Supabase mockado.

### v4.51 — 02/11/2026 (versão anterior)

- RM-073: adiciona a aba Empréstimos com formulário independente, resumo de parcelas, edição/exclusão e prévia de conflitos com confirmação explícita; recebimentos continuam fora da renda e empréstimos não são duplicados no Centro de Dívidas. Test-runner: 586 aprovados em duas execuções, zero falhas/pendências; Supabase mockado; visual/toque não verificados em tela.

### v4.50 — 02/11/2026 (versão anterior)

- RM-072: adiciona apresentação com regras de importação, privacidade e arquitetura; fixa a viewport do fixture de rolagem para tornar a asserção determinística, sem mudar o app. A frase da Política de Privacidade descreve a remoção do avatar conforme o código. Test-runner: 575 aprovados em duas execuções, zero falhas/pendências; Supabase mockado.

### v4.49 — 02/11/2026

- RM-071: formulários mostram aviso e registram categoria fixa local quando validação ou fluxo de conta/salvamento impede o envio; modelo CSV recebe BOM UTF-8 e CRLF e continua aceito pelo importador; tutoriais do painel passam a ficar recolhidos por padrão com `aria-expanded` sincronizado. Test-runner: 575 aprovados, zero falhas/pendências; Supabase mockado; Excel e visual/toque não verificados em tela.

### v4.48 — 02/11/2026

- RM-070: preenche avatar vazio com foto Google apenas por endereço HTTPS validado; remoção mantém o avatar predefinido, falha remota retorna ao JPEG local e `referrerpolicy` evita enviar referenciador. URL sincronizada pelo campo `profiles.avatar`; CSP e Política atualizadas somente para refletir o comportamento. Test-runner: 572 aprovados, zero falhas/pendências; Supabase mockado; visual/toque e login Google real não verificados.

### v4.47 — 02/11/2026

- RM-069: usa `full_name`/`name` do Google apenas para preencher perfil sem nome; falhas da sincronização de dados locais registram categoria/tipo e código fixo no Diagnóstico temporário, sem IDs ou detalhes do erro. Test-runner: 567 aprovados, zero falhas/pendências; Supabase mockado, tela e login Google real não verificados.

### v4.46 — 02/11/2026

- RM-068: correção do botão oculto de backup no aviso de saída; reset confirmado como exclusões remotas individuais, sem lote de IDs. Test-runner: 563 aprovados, zero falhas/pendências; Supabase mockado nos testes; visual/toque não verificados em tela.

### v4.45 — 02/11/2026

- RM-067: botão de acesso Google usa OAuth do Supabase, callback na origem/caminho do app e tratamento fixo de erro/cancelamento; cadastro preserva o consentimento explícito. Test-runner com Supabase mockado: 550 aprovados, zero falhas/pendências; fluxo real com Google e tela não verificados.

### v4.44 — 02/11/2026

- RM-066: filtro de conta na home e exportação CSV/PDF local dos lançamentos do período, com conta PF/PJ, tratamento de campos CSV e aviso sobre informe de rendimentos. Test-runner: 546 aprovados, zero falhas/pendências; visual/toque e layout não verificados em tela.

### v4.43 — 02/11/2026

- RM-065: Centro de Dívidas mostra atraso, parcelas deste mês/próximo e total restante calculados para o mês real local; gastos recorrentes e dívidas sem prazo ficam em alerta separado. Test-runner: 530 aprovados, zero falhas/pendências; aparência/toque e layout nas larguras previstas não verificados em tela.

### v4.42 — 02/11/2026

- RM-065: helpers puros para detalhamento mensal de dívidas e custos fixos recorrentes; 524 testes aprovados, zero falhas/pendências. Nenhuma mudança visual; tela não medida. Cache e selo mantidos nesta etapa.
- RM-064: cabeçalho da Zona de perigo agora explica as ações, mostra chevron e sincroniza `aria-expanded` ao abrir/fechar; conteúdo e handlers preservados. Test-runner: 514 aprovados, zero falhas; layout real e visual/toque não verificados.
- RM-063: leitura das mensagens do Admin gravada em `feedback_messages.admin_read_at`; lista, badge e contagem usam o estado remoto; avisos de contas seguem locais. Test-runner com código real: 510 aprovados, zero falhas; Supabase mockado, RLS/tipos reais e visual/toque em tela não verificados.
- RM-062: avatar feminino passou a ser JPEG 256x256; ID do preset preservado, escolha local sincronizável pelo campo de perfil existente, arquivo no cache e referências ao recurso vetorial removidas. Test-runner com código real: 504 aprovados, zero falhas; visual do avatar não verificado em tela.
- RM-061: acabamento do avatar feminino com rosto e pescoço mais estreitos, cabelo em camadas, orelhas, sobrancelhas, nariz, sombra lateral e detalhe turquesa; seleção coberta. Test-runner com código real: 504 aprovados, zero falhas; visual do avatar não verificado em tela.
- RM-060: mensagem de Diagnóstico administrativa fixa para excluir valores de `message`, `details` e `hint`; avatar feminino predefinido selecionável; aviso de Service Worker aguardando usa a verificação manual e registra exibição; navegação “Metas” rola ao painel e “Mais” abre menu sem mudança. Test-runner com código real: 503 aprovados, zero falhas; medições via fixture em 320/390/1280 px e dois temas.
- RM-059: Mensagens do Admin reabre no filtro Novas, sem alterar o filtro no refresh manual; erros de `admin_list_users`, `admin_feedback_authors` e consulta de feedback são registrados no Diagnóstico com código, mensagem sanitizada e origem, sem IDs/e-mails/conteúdo. Mensagens do cliente ordenadas da mais recente, com resposta, status e data. Test-runner com código real: 497 aprovados, zero falhas; testes de consultas Supabase mockados e tela não verificada.

### v4.36 — 02/11/2026

- RM-058: mensagens do Admin mostram autor numerado sem consentimento ou nome/e-mail quando `admin_visibility` permite; a resposta fica associada ao mesmo autor. O sino local alerta o Admin sobre feedback novo ainda não lido, atualiza ao autenticar/abrir o sino e mantém o contador do menu consistente. Sem Realtime, push ou polling. Criada a migration `20261107_admin_feedback_authors.sql`, ainda não aplicada. Test-runner com código real: 494 aprovados, zero falhas; aparência em tela não medida.

- RM-057: Ganhos e Gastos agora são centros mensais com tipo, valor, data/dia, conta, situação, edição/exclusão e atalhos para Lançamentos. Edição/exclusão de recorrências avisa que a ação afeta o modelo; compras parceladas de cartão avisam que afetam a compra inteira. Empréstimos recebidos não são listados como ganhos e a parcela aparece integral em Gastos. Suíte com 491 testes aprovados; teste do atalho de Ganhos usa requestAnimationFrame determinístico e ainda verifica navegação, tipo, formulário visível e foco. Medidos sete tamanhos (incluindo 844×390) e dois temas.

### v4.34 — 02/11/2026 (versão anterior)

- RM-056: criação da primeira conta exige confirmação antes de salvar lançamento; cancelamento mantém o formulário e não cria dados. Ganhos, gastos comuns, fixos, dívidas, empréstimos, parcelamentos, boletos, assistente inicial e importação usam a confirmação. A camada de dados bloqueia a criação implícita, exceto na migração de registros antigos. Ajuste de saldo seleciona a conta com segurança e não cria conta sem dados. Seis testes adicionados; suíte com 485 testes aprovados. Formulários medidos em 320, 390 e 1280 px, nos dois temas, com alvos >= 44 px, campos >= 16 px, sem corte e contraste conforme os limites.

### v4.33 — 02/11/2026 (versão anterior)

- RM-055: empréstimo como um template, valor recebido no saldo e fora da renda, parcelas pagas manualmente, custo e cronograma no Centro de Dívidas; Admin sem contagem individual de lançamentos. A tolerância de arredondamento aceita diferenças de até R$ 0,01 por parcela, mantendo o total informado como autoritativo; campos monetários aceitam no máximo duas casas decimais. Criada `20261106_single_loan.sql` (não aplicada). Seis testes adicionados; suíte com 479 testes aprovados. Layout real nas sete larguras e nos dois temas não medido.

### v4.32 — 02/11/2026

- RM-053: a prévia identifica “Dia lido do boleto” apenas para fator válido em boleto de 47 dígitos, mantém vencimento 31 ao avisar sobre mês curto e exclui linhas a pagar sem dia válido sem interromper as válidas. Cinco testes adicionados; suíte com 472 testes aprovados. Medição geométrica real da prévia não realizada.
- RM-054: o saldo principal do dashboard agora é um botão acessível e abre o ajuste de saldo; um teste de regressão reproduziu a falta de ação anterior. Suíte atual: 473 testes.

### v4.31 — 01/11/2026

- RM-052: destino obrigatório nos lançamentos, Conta principal automática apenas sem contas existentes, seleção manual para registros antigos sem vínculo e dia de vencimento validado entre 1 e 31 sem assumir o dia 01. Saldo real abre com o saldo calculado, Ganhos leva ao formulário na opção correta e falhas de migração ficam sinalizadas como sincronização pendente. Nove testes adicionados; suíte com 467 testes aprovados.

### v4.30 — 01/11/2026

- RM-051: diagnóstico temporário salvo somente no aparelho, com limite circular de 100 registros, sem UID/e-mail e sem chamada de rede pelo logger; lista legível, copiar e limpar no Painel do Usuário. Três testes adicionados; suíte com 458 testes aprovados.

### Planejamento (sem versão)

- Correção do reset: IDs remotos vivos de todas as coleções financeiras são buscados antes da limpeza local; exclusões pendentes são reconciliadas com uma versão posterior. Treze testes adicionados; suíte com 402 aprovados.
- [x] RM-044 — Home unificada em desktop/mobile, resumo duplicado oculto, selects de pagamento alimentados por uma lista central, cartões de lançamentos reorganizados e avisos/reposicionamento do rodapé ajustados. Quatro testes adicionados; suíte com 389 aprovados.
- [x] RM-048 — Sidebar e painel do usuário organizados por função, tema em um único local e acesso a Fale comigo sem duplicação. Um teste estrutural adicionado; suíte com 452 aprovados. Arquivos: `index.html`, `css/style.css`, `js/app.js`, `tests/gastopro.test.js`.
- [x] RM-043 — Corrigido zoom automático iOS em controles, cartões de aviso em coluna, nome em largura total, cabeçalho mobile e barra inferior; limpeza da chave legada em `clearAll` e `deleteAllUserData`. Cinco testes adicionados; suíte com 385 aprovados.
- [x] Home no celular: cabeçalho centralizado com logo existente, chip de mês, destaque financeiro, faixa de avisos, resumo dos cartões, barra inferior e contraste nos dois temas. Três testes novos; suíte com 368 aprovados.
- [x] RM-039 — Saldo real em destaque com aviso informativo das saídas pendentes no mês atual; grade de quatro blocos, cabeçalho sem sobreposição, barra inferior sem quebra forçada e abertura de telas no topo. A restauração automática da rolagem após atualização do Service Worker foi removida; somente “Atualizar dados” preserva a posição. Quatro testes adicionados; suíte com 372 aprovados.
- [x] RM-040 — botão Metas leva ao painel com rolagem instantânea, legenda de fixos pagos restaurada e cabeçalho/menu compactos em paisagem baixa. A atualização do Service Worker mantém tela e mês, mas inicia no topo. Três testes adicionados; suíte com 375 aprovados.
- [x] RM-037 — seleção e sincronização da forma de pagamento, status automático por forma/data, compra no crédito sem débito imediato e migração de gasto anterior para o cartão. Oito testes adicionados; suíte com 365 aprovados. Migration `20261104_payment_method.sql` aplicada e conferida no Supabase.
- [x] RM-036 — carteira de cartões com limite usado calculado das parcelas em aberto, gasto anterior opcional sincronizado no cartão, próximo vencimento e atalho compacto no dashboard. Quatro testes adicionados; suíte com 357 aprovados.
- [x] RM-035 — sino navega ao item e o destaca, dispensa de avisos persiste por situação e atualização preserva tela/mês/rolagem. Dashboard inicia no topo. Quatro testes adicionados; suíte com 353 aprovados.
- Central de avisos: níveis Crítico/Atenção/Info, escalada para vencimentos e cartão, ordenação por prioridade/recência, sino com prioridade não lida e cores AA para os temas claro/escuro; preferências existentes preservadas. Quatro testes adicionados.
- Lote A: destaque visual dos números financeiros e inteligência de categorização baseada em regras.
- Lote B1: central de avisos com sino, cinco tipos de alerta e preferências armazenadas no aparelho.
- “Meus dados”: exportação completa e exclusão definitiva de todos os dados; o menu do avatar também oferece “Atualizar Dados”.
- Identidade visual: logo e ícones PWA/iOS atualizados em `assets/`.
- Painel de administrador: `app_admins`/`is_admin()`, métricas agregadas via `admin_analytics_summary()`, feedback em `feedback_messages` e eventos permitidos em `usage_events`; telemetria tem opt-out local e retenção de 12 meses via `pg_cron` (`20261031_admin_analytics.sql`).
- Coleta de uso: eventos mínimos de telas e importação são enviados somente com a preferência habilitada; sem payload financeiro.
- Sincronização: Etapas 1 e 2 concluídas (commit `9219da3`; migrations `20261101` e `20261102` aplicadas). Etapa 3 implementada com a migration `20261103_sync_transactions.sql`, fila offline idempotente, conflitos de versão/tombstone e limite de 500 linhas; migration aplicada e conferida no Supabase. Etapa 4 pendente.
- RM-031: guia “Como pegar meu extrato” com três ilustrações genéricas, atalho no tutorial Primeiros passos e arquivos SVG adicionados ao cache sem alterar o CACHE_NAME; três testes adicionados.
- Importação: possíveis duplicados (iguais a lançamentos já salvos) vêm desmarcados, com contagem; linhas repetidas dentro do mesmo arquivo continuam marcadas.
- Importação — conferência: [x] recorrências são sugestões decididas pelo usuário; pagamentos de empréstimos/parcelas seguem a data e os importados pagos ficam em uma lista de revisão por usuário, com aviso e ações para conferir ou alterar para pendente.
- RM-030: ações de gravação usam trava compartilhada, estado “Salvando...”/“Ainda sincronizando” e aria-busy; importação bloqueia cancelamento e fechamento durante a gravação; modo local não aguarda sync; três testes adicionados.
- Ajuste RM-029: logout remove `gastopro_last_view_v1`; o Reset financeiro continua preservando a última tela principal.
- RM-029: CSV passa a sugerir a pagar para despesas futuras e parcelas futuras; nova etiqueta textual na prévia; detector CSV-only `N de M`; a última tela principal é restaurada por usuário, com Admin fechado até autorização; oito testes adicionados.
- RM-028: recuperação de senha com mensagens neutras, feedback de limite e contador de 60 segundos; cadastro confirma o e-mail; adicionada tela informativa “Não lembro meu e-mail”; três testes adicionados.
- O Roadmap foi atualizado com RM-025 a RM-027.
- RM-027: ampliadas as palavras-chave da categorização automática, corrigida a classificação de 'Mercado Livre' para Compras, removidas palavras ambíguas e 'Mercado Pago' direcionado para Outros.
- Adicionados quatro testes de `autoDetectCategory`, incluindo palavras-chave, normalização e precedência da categoria informada no CSV.
- RM-025 parte A: contas PF/PJ, vínculos opcionais em lançamentos/templates, saldos, sincronização e backup implementados; migração aplicada em produção.
- Exclusão da própria conta Supabase pela função `public.delete_my_account()`, com confirmação explícita e limpeza dos dados/sessão locais após sucesso; migration `20261028_delete_my_account.sql` aplicada.
- Reset agora também apaga contas bancárias, preservando sessão, nome e foto; testes cobrem fila de exclusões e limpeza após apagar a conta de login.
- Sessão expirada preserva alterações pendentes, orienta o login na mesma conta e exige confirmação explícita antes de descartá-las para trocar de conta.
- Validação estrita do backup JSON impede restauração parcial de dados inválidos e mantém compatibilidade com backups antigos.
- Erros ao verificar a sessão preservam os dados locais; merges da nuvem respeitam alterações e exclusões pendentes.
- Nome e foto agora são sincronizados com `profiles` sob RLS; o modal de recorte do avatar permite arrastar, teclado e zoom, e o backup permanece sem dados de perfil.
- Área Admin de mensagens: confirmação de acesso por `is_admin()`, lista paginada sem identificador do autor, filtros e respostas com atualização atômica dos campos no app; adicionados sete testes.
- Tema claro em preparação: a folha de estilos usa tokens semânticos com paleta escura preservada e uma paleta clara em validação.
- Tutorial de primeiro acesso com dicas sobre lançamentos, contas fixas, dívidas, metas, importação, relatórios e dados; disponível novamente em “Como usar” no perfil.
- RM-025 parte B: tela e modais de contas PF/PJ, vínculos em ganhos/gastos, saldo consolidado filtrável no Dashboard e duas funções puras cobertas por testes; cache do Service Worker atualizado.
- Tema claro/escuro alternável no rodapé do sidebar, escolhido no carregamento antes dos estilos e persistido por aparelho; limpeza de dados e restauração de backup preservam a preferência.
- Canal "Fale comigo": mensagens autenticadas e respostas armazenadas somente no Supabase, com exclusão pelo usuário, limite de envio e migração SQL pendente de aplicação manual.
- Ajustes responsivos para telas estreitas e reorganização do Painel do Usuário: ações irreversíveis recolhidas por padrão, logout neutro e correções de alinhamento e overflow.

### v4.29 — 01/11/2026

- RM-050: descrições originais restauradas na zona de perigo; e-mails longos no Admin quebram apenas em separadores; suíte com 455 testes aprovados.

### v4.28 — 01/11/2026

- Painel administrativo reorganizado, acesso visualmente restrito a indicadores agregados e abas responsivas; removidos o placeholder sem função do tema e as quebras proibidas. Dois testes adicionados; suíte com 454 aprovados.

### v4.27 — 01/11/2026

- Sidebar reorganizado por tarefa, tema fixado em um só lugar e acesso a Fale comigo unificado no painel; preferências, conta, backup e ajuda separados; 452 testes.

### v4.26 — 01/11/2026

- Painel do usuário compacto, com avatar padrão/foto, tema único no sidebar e zona de perigo recolhível; CACHE_NAME atualizado e suíte com 451 testes.

### v4.25 — 01/11/2026

- Status bar web app definido como padrão; suíte com 450 testes.

### v4.24 — 01/11/2026

- Ajuste de navegação por eventos de autenticação; suíte com 450 testes.

### v4.23 — 01/11/2026

- Navegação ao dashboard por autenticação somente na abertura inicial ou após troca real de usuário; suíte com 450 testes.

### v4.22 — 01/11/2026

- Painel de avisos permanece aberto ao marcar vários avisos como lidos; suíte com 446 testes.

### v4.21 — 01/11/2026

- Gráfico de cadastros do painel admin em barras, com rótulos horizontais responsivos; suíte com 445 testes.
### v4.0 — 28/10/2026

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

#### v2.4 — versão anterior
- Wizard de Lançamento Rápido, importação CSV/texto, autenticação multiusuário e Centro de Dívidas.
- Modal de confirmação customizado e pull-to-refresh mobile (PWA).

---

## 📜 Licença

Todos os direitos reservados © Aylton Alberto.

Projeto pessoal de estudante de ADS.
