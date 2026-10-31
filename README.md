# 💼 GastoPro — Controle de Gastos & Saúde Financeira

> Aplicativo Web moderno (Single Page Application — SPA) de gestão financeira pessoal, com dashboard de saúde financeira, receitas e despesas, rastreamento de dívidas, autenticação multiusuário Supabase, importação de extratos, Wizard de Lançamento Rápido e PWA offline.

![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-f59e0b?style=for-the-badge)
![Versão](https://img.shields.io/badge/Vers%C3%A3o-4.0-6366f1?style=for-the-badge)
![Tecnologias](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20JS%20%7C%20Supabase-0ea5e9?style=for-the-badge)
![Autor](https://img.shields.io/badge/Criador-Aylton%20Alberto-f59e0b?style=for-the-badge)
![Testes](https://img.shields.io/badge/Testes-389%20casos-10b981?style=for-the-badge)

---

## 🤖 Guia para IAs (leia antes de editar)

1. O estado do projeto está no **Roadmap**: `[ ]` pendente e `[x]` implementado/testado.
2. Quem concluir um item (pessoa ou IA) deve marcá-lo `[x]` **antes de seguir para o próximo**.
3. Ao marcar, atualize no mesmo passo o Changelog e, se mudar a quantidade de testes, o total no README.
4. Respeite as **Decisões de produto**: Pix, débito, dinheiro e transferência com data de hoje ou anterior entram pagos; boleto e datas futuras entram pendentes, salvo alteração manual; importações mantêm sua regra própria; sem foto, print nem OCR.
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
- Vínculo opcional de ganhos e gastos a uma conta; o saldo muda conforme os lançamentos pagos.
- Categorias de receita: Salário, Adiantamento, Renda Extra, Rendimentos e Outros.
- Lançamentos vinculados ao mês de competência da data informada.
- Forma de pagamento sincronizada; o backup já inclui `paymentMethod` e `previousSpent` nos objetos de lançamentos e cartões.

### 💸 Forma de pagamento
- Pix, débito, dinheiro e transferência com data de hoje ou anterior entram pagos; boleto e datas futuras entram pendentes.
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
│   ├── icon-192.png           # Ícone PWA 192x192
│   ├── icon-512.png           # Ícone PWA 512x512
│   ├── icon-maskable-512.png  # Ícone maskable
│   ├── apple-touch-icon.png   # Ícone para iOS
│   ├── statement-guide-step-1.svg # Ilustração genérica: localizar extrato
│   ├── statement-guide-step-2.svg # Ilustração genérica: exportar arquivo
│   └── statement-guide-step-3.svg # Ilustração genérica: importar e conferir
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
│       ├── 20261028_delete_my_account.sql # Exclusão de conta; aplicada no Supabase
│       ├── 20261029_feedback.sql # Canal de contato; aplicada no Supabase
│       ├── 20261031_admin_analytics.sql # Painel admin, eventos de uso e retenção de 12 meses; aplicada
│       ├── 20261101_sync_versioning.sql # Etapa 1 da sincronização; aplicada no Supabase
│       ├── 20261102_sync_realtime_publication.sql # Etapa 2 Realtime; aplicada no Supabase
│       ├── 20261103_sync_transactions.sql # Etapa 3; aplicada no Supabase
│       └── 20261104_payment_method.sql # Formas de pagamento e gasto anterior; aplicada no Supabase
├── tests/
│   ├── gastopro.test.js       # 389 testes em JavaScript puro, sem framework
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
- Google Fonts e cdnjs (Font Awesome) são carregados de terceiros e podem receber endereço IP e dados técnicos de conexão; dados financeiros não são enviados a esses provedores.
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

`CACHE_NAME` atual: `gastopro-v4.5`. Suíte atual: **365 testes**.

[`supabase/schema.sql`](./supabase/schema.sql) documenta as tabelas, validações, RLS, índices, permissões e triggers. Toda mudança no banco deve ser feita no painel e registrada neste arquivo. A migração [`supabase/migrations/20261027_hardening.sql`](./supabase/migrations/20261027_hardening.sql) foi aplicada e validada em produção em 28/10/2026.

As oito tabelas sincronizadas são `entries`, `fixed_templates`, `profiles`, `goals`, `accounts`, `credit_cards`, `credit_card_purchases` e `fixed_import_rules`; todas são restritas ao dono por RLS. As migrations [`supabase/migrations/20261101_sync_versioning.sql`](./supabase/migrations/20261101_sync_versioning.sql) e [`supabase/migrations/20261102_sync_realtime_publication.sql`](./supabase/migrations/20261102_sync_realtime_publication.sql) estão aplicadas. Exclusão total de dados e exclusão de conta continuam físicas.

`public.accounts` contém `id`, `user_id`, `name`, `institution`, `type`, `initial_balance`, `created_at` e `updated_at`; `entries` e `fixed_templates` podem referenciar uma conta por `account_id`, com chave estrangeira composta que impede vínculo entre usuários. A migração [`supabase/migrations/20261028_accounts.sql`](./supabase/migrations/20261028_accounts.sql) foi aplicada em produção. A função `public.delete_my_account()` remove a conta Auth do usuário autenticado e depende dos `ON DELETE CASCADE` existentes; sua migração [`supabase/migrations/20261028_delete_my_account.sql`](./supabase/migrations/20261028_delete_my_account.sql) está aplicada.

O app envia nome e avatar para `profiles` ao editar o perfil autenticado; alterações locais são preservadas para nova tentativa de sincronização. `entries.debt_info` é um JSONB opcional, sem estrutura definida pelo código atual.

A migração [`supabase/migrations/20261029_feedback.sql`](./supabase/migrations/20261029_feedback.sql), aplicada no Supabase, cria `app_admins` e `feedback_messages`, as policies de RLS, `is_admin()` e o limite de cinco mensagens por usuário em 24 horas. O administrador pode ler mensagens e responder, mas não recebe acesso às tabelas financeiras nem a `profiles`; a lista de administradores é mantida diretamente pelo SQL Editor. Mensagens são obtidas sob demanda e não entram no localStorage, na fila financeira, no backup ou no Reset.

A migration [`supabase/migrations/20261031_admin_analytics.sql`](./supabase/migrations/20261031_admin_analytics.sql) implementa `admin_analytics_summary()` com métricas agregadas, `usage_events` com lista permitida de eventos e limpeza automática após 12 meses via `pg_cron`. O usuário pode desativar a coleta no aparelho (`gastopro_usage_telemetry_enabled_v1`); eventos não incluem payload financeiro. O painel também usa `app_admins`/`is_admin()` e o canal `feedback_messages`.

Para criar um projeto Supabase, execute `supabase/schema.sql` no SQL Editor. Consulte também [Executar, configurar e publicar](#-executar-configurar-e-publicar).

---

## 🧪 Testes

Suite com **365 casos de teste** em JavaScript puro, sem frameworks. Os testes usam mock do `localStorage`; os dados reais não são afetados.

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
- O app não terá importação por foto, print nem OCR; a decisão é manter o app leve.
- O uso de PDF é limitado a documentos com texto selecionável; a prévia deve ser conferida.
- Desenvolvimento 100% em planos gratuitos até o app estar funcionando e com vários usuários; não há monetização por ora.

---

## 🗺️ Roadmap

Legenda: `[ ]` pendente | `[x]` implementado e testado. Veja as regras no [Guia para IAs](#-guia-para-ias-leia-antes-de-editar).

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

### Descartado

- Importação por foto de cupom (6E) — motivo: decisão do autor: o app não terá foto/OCR.
- Plano Pro e pagamentos, Open Finance, Pix voluntário e propaganda — descartados; sem monetização ou conexões financeiras externas no escopo atual.

### Novas melhorias

- [x] **RM-025 — Contas PF/PJ, saldo inicial, filtro e ajuste rápido** / Descrição: cadastro de contas PF/PJ, saldo inicial e data-base, filtro no Dashboard e ajuste rápido do saldo; com sincronização e backup. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`.
- [x] **RM-026 — Cartões, parcelas e limites** / Descrição: emissor, bandeira, cor personalizada, visual de carteira, compras parceladas até 24x, projeção das parcelas e alertas de limite. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/app.js`, `js/data.js`, `css/style.css`.
- [x] **RM-027 — Mais palavras-chave na categorização** / Descrição: ampliar as regras de categoria automática do importador. / Critério de pronto: a definir. / Arquivos: a definir.
- [x] **RM-028 — Recuperação de conta e confirmação de e-mail** / Descrição: mensagens neutras e específicas para redefinição, espera visual entre pedidos, confirmação dupla no cadastro e orientação sem consulta a e-mails existentes. / Critério de pronto: testes automatizados aprovados e validação responsiva. / Arquivos: `index.html`, `js/app.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-029 — Importação de despesas futuras e restauração de tela** / Descrição: despesas futuras de CSV entram como a pagar; parcelas `N de M` são reconhecidas apenas no CSV; a última tela principal é restaurada com isolamento por usuário e verificação de Admin. / Critério de pronto: testes automatizados aprovados. / Arquivos: `js/importer.js`, `js/app.js`, `js/data.js`, `css/style.css`, `tests/gastopro.test.js`.
- [x] **RM-030 — Evitar gravações duplicadas ao salvar** / Descrição: trava reutilizável de salvamento com estado visual/acessível e espera de sincronização; modo local sem espera. / Critério de pronto: testes automatizados aprovados. / Arquivos: `js/app.js`, `tests/gastopro.test.js`.
- [x] **RM-031 — Guia para obter extrato bancário** / Descrição: guia acessível de três passos com ilustrações genéricas, botão no importador e atalho em Primeiros passos. / Critério de pronto: testes automatizados aprovados. / Arquivos: `index.html`, `js/onboarding.js`, `js/app.js`, `css/style.css`, `assets/statement-guide-step-*.svg`, `sw.js`, `tests/gastopro.test.js`.
- [x] **RM-032 — Contraste WCAG AA em celular e gráficos** / Descrição: contraste mínimo AA nas áreas mobile alteradas, avisos e textos sobre fundos coloridos nos temas claro e escuro. / Critério de pronto: testes automatizados aprovados.
- [ ] **RM-033 — Idioma pt/en (futuro, adiado)** / Descrição: adicionar localização para português e inglês em etapa futura.
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

### Em dúvida

- Mapeamento de colunas do CSV configurável pelo usuário.
- Cache offline de fontes e ícones.
- Pipeline CI/CD.

---

## 📋 Changelog

### Planejamento (sem versão)

- [x] RM-044 — Home unificada em desktop/mobile, resumo duplicado oculto, selects de pagamento alimentados por uma lista central, cartões de lançamentos reorganizados e avisos/reposicionamento do rodapé ajustados. Quatro testes adicionados; suíte com 389 aprovados.
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
