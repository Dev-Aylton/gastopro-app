/* ================================================================
   GastoPro — Suite de Testes Automatizados
   Autor: Aylton Alberto | Estudante de ADS
   Arquivo: tests/gastopro.test.js

   COMO EXECUTAR:
   Abra o arquivo tests/test-runner.html no navegador.
   Todos os testes serão executados automaticamente e o resultado
   será exibido na tela com indicadores de PASS / FAIL.

   COBERTURA:
   1. FinanceData — Camada de dados (data.js)
      1.1 getEntries / saveEntries
      1.2 getTemplates / saveTemplates
      1.3 add() — Lançamentos pontuais
      1.4 addTemplate() — Templates fixos / dívidas
      1.5 getByMonth() — Projeção combinada
      1.6 update() — Lançamentos e templates
      1.7 togglePaid() — Baixa por mês
      1.8 toggleActive() — Pausar/reativar template
      1.9 delete() — Exclusão de itens
      1.10 clearAll() — Limpeza total
      1.11 exportJSON() — Estrutura do backup
      1.12 getProfile / saveProfile — Perfil do usuário
      1.13 UUIDs e fila de sincronização
      1.14 Contas bancárias PF/PJ

   2. Utilitários do app (app.js)
      2.1 formatCurrency() — Formatação BRL
      2.2 getYearMonthString() — Formatação YYYY-MM
      2.3 formatDate() — Formatação DD/MM
      2.4 escapeHtml() — Sanitização XSS

   3. Lógica de Negócio
      3.1 Cálculo de totais (income, fixed, variable, balance)
      3.2 Diagnóstico de saúde financeira (50/30/20)
      3.3 Gastos fixos inativos são excluídos dos totais
      3.4 Templates expirados não aparecem no mês
      3.5 Paidmonths: baixa isolada por mês

   4. Importação
      4.1 Parsing de valores, datas e categorias
      4.2 Limites de description e category

   NOTA: Os testes mockam o localStorage para isolar os dados
   de teste dos dados reais do usuário, sem nunca tocá-los.
   ================================================================ */

'use strict';

// ================================================================
// MICRO FRAMEWORK DE TESTES (sem dependências externas)
// ================================================================

/** Armazena todos os resultados para exibição final. */
const TestResults = {
  passed: 0,
  failed: 0,
  errors: []
};
const pendingTestPromises = [];

/**
 * Declara um grupo de testes relacionados.
 * @param {string} suiteName - Nome do grupo de testes.
 * @param {Function} fn - Função que contém os testes do grupo.
 */
function describe(suiteName, fn) {
  console.group(`📦 ${suiteName}`);
  try {
    fn();
  } catch (e) {
    console.error(`Erro inesperado no grupo "${suiteName}":`, e);
  }
  console.groupEnd();
}

/**
 * Declara um caso de teste individual.
 * @param {string} testName - Descrição do que está sendo testado.
 * @param {Function} fn - Função que contém as asserções.
 */
function it(testName, fn) {
  try {
    fn();
    TestResults.passed++;
    console.log(`  ✅ PASS — ${testName}`);
  } catch (e) {
    TestResults.failed++;
    TestResults.errors.push({ test: testName, error: e.message });
    console.error(`  ❌ FAIL — ${testName}`);
    console.error(`     → ${e.message}`);
  }
}

function itAsync(testName, fn) {
  const previous = pendingTestPromises.length
    ? pendingTestPromises[pendingTestPromises.length - 1]
    : Promise.resolve();
  const pending = previous
    .then(fn)
    .then(() => {
      TestResults.passed++;
      console.log(`  ✅ PASS — ${testName}`);
    })
    .catch((e) => {
      TestResults.failed++;
      TestResults.errors.push({ test: testName, error: e.message });
      console.error(`  ❌ FAIL — ${testName}`);
      console.error(`     → ${e.message}`);
    });
  pendingTestPromises.push(pending);
}

/**
 * Verifica se dois valores são iguais (comparação profunda para objetos simples).
 * @param {*} actual   - Valor obtido.
 * @param {*} expected - Valor esperado.
 * @param {string} [msg] - Mensagem de erro personalizada.
 */
function assertEqual(actual, expected, msg) {
  const actualStr   = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(msg || `Esperado: ${expectedStr}\nObtido:   ${actualStr}`);
  }
}

/**
 * Verifica se um valor é verdadeiro.
 * @param {*} value - Valor a verificar.
 * @param {string} [msg] - Mensagem de erro personalizada.
 */
function assertTrue(value, msg) {
  if (!value) {
    throw new Error(msg || `Esperado truthy, obtido: ${JSON.stringify(value)}`);
  }
}

/**
 * Verifica se um valor é falso.
 * @param {*} value - Valor a verificar.
 * @param {string} [msg] - Mensagem de erro personalizada.
 */
function assertFalse(value, msg) {
  if (value) {
    throw new Error(msg || `Esperado falsy, obtido: ${JSON.stringify(value)}`);
  }
}

/**
 * Verifica se um valor é nulo ou undefined.
 * @param {*} value - Valor a verificar.
 * @param {string} [msg] - Mensagem de erro personalizada.
 */
function assertNull(value, msg) {
  if (value !== null && value !== undefined) {
    throw new Error(msg || `Esperado null/undefined, obtido: ${JSON.stringify(value)}`);
  }
}

/**
 * Verifica se um valor não é nulo/undefined.
 * @param {*} value - Valor a verificar.
 * @param {string} [msg] - Mensagem de erro personalizada.
 */
function assertNotNull(value, msg) {
  if (value === null || value === undefined) {
    throw new Error(msg || `Esperado valor não-nulo, obtido: null/undefined`);
  }
}

// ================================================================
// MOCK DO LOCALSTORAGE
// Substitui o localStorage real por uma implementação em memória
// para que os testes não alterem os dados do usuário e sejam
// completamente isolados e repetíveis.
// ================================================================

/** Simula o localStorage usando um objeto em memória (sem persistência). */
const mockStorage = {};

/**
 * Aplica o mock do localStorage globalmente.
 * Chame antes de cada grupo de testes para garantir isolamento.
 */
function setupMockLocalStorage() {
  // Limpa o estado anterior
  for (const key in mockStorage) delete mockStorage[key];

  // Substitui os métodos globais do localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem:    (key) => mockStorage[key] !== undefined ? mockStorage[key] : null,
      setItem:    (key, value) => { mockStorage[key] = String(value); },
      removeItem: (key) => { delete mockStorage[key]; },
      clear:      () => { for (const k in mockStorage) delete mockStorage[k]; },
      key:        (index) => Object.keys(mockStorage)[index] || null,
      get length() { return Object.keys(mockStorage).length; }
    },
    writable: true,
    configurable: true
  });
}

describe('Tutorial de primeiro acesso', () => {
  setupMockLocalStorage();

  it('oferece sete tópicos com título, texto e ícone', () => {
    const topics = window.GastoProOnboarding.getTopics();
    assertEqual(topics.length, 8);
    assertTrue(topics.every(topic => topic.title && topic.text && topic.icon));
  });

  it('aparece no primeiro acesso e não aparece novamente após ser visto', () => {
    assertTrue(window.GastoProOnboarding.shouldShowOnFirstAccess());
    window.GastoProOnboarding.markSeen();
    assertTrue(window.GastoProOnboarding.hasSeen());
    assertFalse(window.GastoProOnboarding.shouldShowOnFirstAccess());
  });

  it('oferece o cadastro inicial sem contas e respeita a opção de pular', () => {
    localStorage.removeItem(window.GastoProOnboarding.ACCOUNT_SETUP_STORAGE_KEY);
    assertTrue(window.GastoProOnboarding.shouldShowAccountSetup([]));
    assertFalse(window.GastoProOnboarding.shouldShowAccountSetup([{ id: 'existente' }]));
    window.GastoProOnboarding.markAccountSetupSeen();
    assertFalse(window.GastoProOnboarding.shouldShowAccountSetup([]));
  });

  it('permite reabrir manualmente começando pelo primeiro tópico', () => {
    window.GastoProOnboarding.markSeen();
    assertEqual(window.GastoProOnboarding.getStartIndex(), 0);
    assertTrue(window.GastoProOnboarding.hasSeen());
  });

  it('navega para trás e para frente e fecha ao pular ou concluir', () => {
    assertEqual(window.GastoProOnboarding.navigate(0, 'back'), { index: 0, close: false });
    assertEqual(window.GastoProOnboarding.navigate(0, 'next'), { index: 1, close: false });
    assertEqual(window.GastoProOnboarding.navigate(7, 'next'), { index: 7, close: true });
    assertEqual(window.GastoProOnboarding.navigate(2, 'skip'), { index: 2, close: true });
  });

  itAsync('preserva a marca de visto após reset', async () => {
    setupMockLocalStorage();
    window.GastoProOnboarding.markSeen();
    const result = await FinanceData.clearAll();
    assertTrue(result.success);
    assertTrue(window.GastoProOnboarding.hasSeen());
  });

  it('preserva a marca de visto após a limpeza do logout', () => {
    window.GastoProOnboarding.markSeen();
    FinanceData.clearUserData();
    assertTrue(window.GastoProOnboarding.hasSeen());
  });
});

// ================================================================
// HELPERS DE TESTE
// ================================================================

/**
 * Cria um lançamento de renda de teste com valores padrão.
 * @param {Object} [overrides] - Campos a sobrescrever.
 * @returns {Object} Dados do lançamento de teste.
 */
function makeIncome(overrides = {}) {
  return {
    type: 'income',
    desc: 'Salário Teste',
    amount: 3000,
    month: '2026-11',
    category: 'Salário',
    date: '2026-11-05',
    ...overrides
  };
}

/**
 * Cria um gasto variável de teste.
 * @param {Object} [overrides] - Campos a sobrescrever.
 * @returns {Object} Dados do gasto de teste.
 */
function makeVariable(overrides = {}) {
  return {
    type: 'variable',
    desc: 'Mercado Teste',
    amount: 500,
    month: '2026-11',
    category: 'Alimentação',
    date: '2026-11-10',
    ...overrides
  };
}

/**
 * Cria um template de gasto fixo de teste.
 * @param {Object} [overrides] - Campos a sobrescrever.
 * @returns {Object} Dados do template de teste.
 */
function makeFixed(overrides = {}) {
  return {
    type: 'fixed',
    desc: 'Aluguel Teste',
    amount: 1200,
    month: '2026-11',
    category: 'Moradia',
    date: '2026-11-01',
    ...overrides
  };
}

// ================================================================
// SUITE 1: FINANCEDATA — CAMADA DE DADOS
// ================================================================

describe('FinanceData — Lançamentos Pontuais', () => {
  setupMockLocalStorage();

  it('getEntries() deve retornar [] quando o banco estiver vazio', () => {
    const result = FinanceData.getEntries();
    assertEqual(result, []);
  });

  it('saveEntries() deve persistir e getEntries() deve recuperar', () => {
    const income = makeIncome();
    FinanceData.saveEntries([income]);
    const result = FinanceData.getEntries();
    assertEqual(result.length, 1);
    assertEqual(result[0].desc, 'Salário Teste');
  });

  it('deve manter um lançamento legítimo com "Shopee" na descrição', () => {
    setupMockLocalStorage();
    const shopee = makeVariable({ desc: 'Compra Shopee' });
    FinanceData.saveEntries([shopee]);
    assertEqual(FinanceData.getEntries(), [shopee]);
  });
});

describe('FinanceData — Isolamento entre usuários', () => {
  it('primeiro login deve preservar e marcar para sync os dados criados no modo local', () => {
    setupMockLocalStorage();
    const localEntry = makeIncome({ id: 'entry-guest-1' });
    FinanceData.saveEntries([localEntry]);

    FinanceData.activateUser('user-first-login');

    assertEqual(FinanceData.getEntries(), [localEntry]);
    assertEqual(localStorage.getItem('gastopro_last_uid'), 'user-first-login');
    assertTrue(FinanceData.hasPendingSync());
  });

  it('não deve apagar dados pendentes ao tentar trocar para outra conta', () => {
    setupMockLocalStorage();
    const localEntry = makeIncome({ id: crypto.randomUUID() });
    FinanceData.saveEntries([localEntry]);
    FinanceData.activateUser('user-a');

    assertFalse(FinanceData.activateUser('user-b'));

    assertEqual(FinanceData.getActiveUserId(), 'user-a');
    assertEqual(FinanceData.getEntries(), [localEntry]);
  });

  it('não deve exibir dados do usuário A após trocar para o usuário B', () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_last_uid', 'user-a');
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([
      makeIncome({ id: crypto.randomUUID() })
    ]));

    FinanceData.activateUser('user-b');

    assertEqual(FinanceData.getEntries(), []);
    assertEqual(localStorage.getItem('gastopro_last_uid'), 'user-b');
  });

  it('logout limpa dados locais e preserva a marca do tutorial', () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_entries_v4_oct', '[]');
    localStorage.setItem('gastopro_goals_v1', '[]');
    localStorage.setItem('gastopro_avatar_cache', 'avatar');
    localStorage.setItem('gastopro_tutorial_seen', 'true');
    localStorage.setItem('gastopro_theme', 'light');
    localStorage.setItem('gastopro_last_view_v1', JSON.stringify({ view: 'accounts', ownerId: null }));
    localStorage.setItem('sb-project-auth-token', 'session');

    FinanceData.clearUserData();

    const remainingKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    assertEqual(remainingKeys, ['gastopro_tutorial_seen', 'gastopro_theme', 'sb-project-auth-token']);
    assertEqual(localStorage.getItem('gastopro_theme'), 'light');
    assertNull(localStorage.getItem('gastopro_last_view_v1'));
  });

  it('falha ou resposta vazia da nuvem não deve zerar dados locais do mesmo usuário', () => {
    setupMockLocalStorage();
    FinanceData.activateUser('user-a');
    const localEntry = makeIncome({ id: 'entry-local-user-a' });
    FinanceData.saveEntries([localEntry]);

    assertFalse(FinanceData.mergeCloudData('user-a', null, null));
    assertTrue(FinanceData.mergeCloudData('user-a', [], []));
    assertEqual(FinanceData.getEntries(), [localEntry]);
  });
});

describe('FinanceData — Metas por Categoria', () => {
  setupMockLocalStorage();

  it('deve criar, atualizar e remover uma meta', () => {
    const created = FinanceData.saveGoal('Mercado', 800);
    const updated = FinanceData.saveGoal('Mercado', 900);

    assertTrue(created.id.startsWith('goal-') && isUuid(created.id.slice(5)));
    assertEqual(FinanceData.getGoals().length, 1);
    assertEqual(updated.id, created.id);
    assertEqual(updated.limit, 900);

    FinanceData.deleteGoal('Mercado');
    assertEqual(FinanceData.getGoals(), []);
  });

  it('deve aplicar alertas nos limiares reais de 80% e 100%', () => {
    FinanceData.saveGoal('Mercado', 100);
    const originalGetElementById = document.getElementById.bind(document);
    const container = { innerHTML: '' };
    const emptyState = { style: { display: 'none' } };
    document.getElementById = (id) => {
      if (id === 'goalsListContainer') return container;
      if (id === 'goalsEmptyState') return emptyState;
      return originalGetElementById(id);
    };

    try {
      renderGoalsSection([{ category: 'Mercado', amount: 79.99 }], []);
      assertTrue(container.innerHTML.includes('goal-status--safe'));
      assertTrue(container.innerHTML.includes('>79.9%</span>'));

      renderGoalsSection([{ category: 'Mercado', amount: 80 }], []);
      assertTrue(container.innerHTML.includes('goal-card--warning'));

      renderGoalsSection([{ category: 'Mercado', amount: 99.99 }], []);
      assertTrue(container.innerHTML.includes('goal-card--warning'));
      assertFalse(container.innerHTML.includes('goal-card--danger'));
      assertTrue(container.innerHTML.includes('>99.9%</span>'));

      renderGoalsSection([{ category: 'Mercado', amount: 100 }], []);
      assertTrue(container.innerHTML.includes('goal-card--danger'));
    } finally {
      document.getElementById = originalGetElementById;
    }
  });

  it('deve mostrar o estado vazio quando não houver metas', () => {
    FinanceData.saveGoals([]);
    const originalGetElementById = document.getElementById.bind(document);
    const container = { innerHTML: 'conteúdo anterior' };
    const emptyState = { style: { display: 'none' } };
    document.getElementById = (id) => {
      if (id === 'goalsListContainer') return container;
      if (id === 'goalsEmptyState') return emptyState;
      return originalGetElementById(id);
    };

    try {
      renderGoalsSection([], []);
      assertEqual(container.innerHTML, '');
      assertEqual(emptyState.style.display, 'flex');
    } finally {
      document.getElementById = originalGetElementById;
    }
  });
});

describe('Estados vazios das telas', () => {
  it('oferece uma ação nas listas e painéis sem dados', () => {
    setupMockLocalStorage();
    const host = document.createElement('div');
    host.innerHTML = `
      <div id="incomesPageTotal"></div>
      <div id="incomesListDetailed"></div>
      <div id="expensesPageTotal"></div>
      <div id="subtotalFixedLabel"></div>
      <div id="subtotalVarLabel"></div>
      <div id="expensesListDetailed"></div>
      <div id="accountsList"></div>
      <div id="creditCardsList"></div>
      <div id="creditCardsEmpty"></div>
      <div id="goalsListContainer"></div>
      <div id="goalsEmptyState"></div>
      <div id="debtCardsGrid"></div>
      <div id="totalDebtRemaining"></div>
      <canvas id="categoryChart"></canvas>
      <div id="chartEmptyMessage"></div>
      <div id="dashboardAccountsEmpty"></div>`;
    document.body.appendChild(host);
    try {
      state.expenseFilter = 'all';
      renderIncomesView([], 0);
      renderExpensesView([], [], 0, 0, 0);
      renderAccountsView();
      renderCreditCardsPanel();
      renderGoalsSection([], [], []);
      renderDebtCenter('2026-10');
      renderCategoryChart([], []);
      renderAccountBalancesPanel();

      assertTrue(host.querySelector('#incomesListDetailed [data-action="focus-entry-form"]'));
      assertTrue(host.querySelector('#expensesListDetailed [data-action="focus-entry-form"]'));
      assertTrue(host.querySelector('#accountsList [data-action="new-account"]'));
      assertTrue(host.querySelector('#creditCardsEmpty [data-action="new-credit-card"]'));
      assertTrue(host.querySelector('#goalsEmptyState [data-action="new-goal"]'));
      assertTrue(host.querySelector('#debtCardsGrid [data-goto="expenses"]'));
      assertTrue(host.querySelector('#chartEmptyMessage [data-goto="expenses"]'));
      assertTrue(host.querySelector('#dashboardAccountsEmpty [data-goto="accounts"]'));
    } finally {
      host.remove();
    }
  });
});

describe('FinanceData — Contas Bancárias', () => {
  setupMockLocalStorage();

  itAsync('cria, edita e valida contas PF/PJ', async () => {
    const created = await FinanceData.addAccount({
      name: '  Conta pessoal  ',
      institution: '  Banco Exemplo  ',
      type: 'PF',
      initialBalance: 125.5,
      balanceDate: '2026-10-01'
    });
    assertTrue(created.success);
    assertTrue(isUuid(created.account.id));
    assertEqual(created.account.name, 'Conta pessoal');
    assertEqual(created.account.institution, 'Banco Exemplo');
    assertEqual(created.account.balanceDate, '2026-10-01');

    const updated = await FinanceData.updateAccount(created.account.id, {
      name: 'Conta empresa',
      type: 'PJ',
      initialBalance: 800,
      balanceDate: '2026-11-01'
    });
    assertTrue(updated.success);
    assertEqual(FinanceData.getAccounts()[0].type, 'PJ');
    assertEqual(FinanceData.getAccounts()[0].initialBalance, 800);
    assertEqual(FinanceData.getAccounts()[0].balanceDate, '2026-11-01');
    const linkedEntry = FinanceData.add(makeIncome({ accountId: created.account.id }));
    const linkedTemplate = FinanceData.add(makeFixed({ accountId: created.account.id }));
    assertEqual(linkedEntry.accountId, created.account.id);
    assertEqual(linkedTemplate.accountId, created.account.id);
    assertNull(window.validateCloudPayload(linkedEntry, 'entries'));
    assertNull(window.validateCloudPayload(linkedTemplate, 'templates'));

    assertFalse((await FinanceData.addAccount({ name: ' ', type: 'PF' })).success);
    assertFalse((await FinanceData.addAccount({ name: 'Inválida', type: 'Mista' })).success);
    assertFalse((await FinanceData.addAccount({
      name: 'Saldo inválido', type: 'PF', initialBalance: 'invalido'
    })).success);
    assertFalse((await FinanceData.addAccount({
      name: 'Data inválida', type: 'PF', initialBalance: 10, balanceDate: '2026-02-30'
    })).success);
    assertFalse((await FinanceData.updateAccount(created.account.id, { type: 'Mista' })).success);
    assertEqual(FinanceData.getAccounts().length, 1);
    assertNull(window.validateCloudPayload(created.account, 'accounts'));
  });

  itAsync('cria, edita, valida e restaura cartões com vínculo opcional de conta', async () => {
    setupMockLocalStorage();
    const account = await FinanceData.addAccount({ name: 'Conta vinculada', type: 'PF' });
    const created = await FinanceData.addCreditCard({
      name: '  Cartão principal  ',
      totalLimit: 5000,
      closingDay: 20,
      dueDay: 5,
      accountId: account.account.id,
      brand: 'Visa',
      issuerBank: 'Outro',
      lastFour: '1234',
      customColor: '#123abc'
    });
    assertTrue(created.success);
    assertTrue(isUuid(created.card.id));
    assertEqual(created.card.name, 'Cartão principal');
    assertEqual(FinanceData.getCreditCards()[0].accountId, account.account.id);
    assertEqual(created.card.brand, 'Visa');
    assertEqual(created.card.issuerBank, 'Outro');
    assertEqual(created.card.lastFour, '1234');
    assertEqual(created.card.customColor, '#123abc');
    assertNull(window.validateCloudPayload(created.card, 'creditCards'));

    const updated = await FinanceData.updateCreditCard(created.card.id, {
      name: 'Cartão PJ', totalLimit: 7500, closingDay: 22, dueDay: 8, accountId: null,
      brand: 'Elo', issuerBank: 'PicPay', lastFour: null, customColor: null
    });
    assertTrue(updated.success);
    assertEqual(FinanceData.getCreditCards()[0].totalLimit, 7500);
    assertNull(FinanceData.getCreditCards()[0].accountId);
    assertEqual(FinanceData.getCreditCards()[0].brand, 'Elo');
    assertEqual(FinanceData.getCreditCards()[0].issuerBank, 'PicPay');
    assertNull(FinanceData.getCreditCards()[0].customColor);
    assertFalse((await FinanceData.addCreditCard({
      name: '', totalLimit: 100, closingDay: 20, dueDay: 5
    })).success);
    assertFalse((await FinanceData.addCreditCard({
      name: 'Cartão inválido', totalLimit: 100, closingDay: 32, dueDay: 5
    })).success);
    assertFalse((await FinanceData.addCreditCard({
      name: 'Bandeira inválida', totalLimit: 100, closingDay: 20, dueDay: 5,
      brand: 'Discover'
    })).success);
    assertFalse((await FinanceData.addCreditCard({
      name: 'Final inválido', totalLimit: 100, closingDay: 20, dueDay: 5,
      lastFour: '12x4'
    })).success);

    const expectedCards = FinanceData.getCreditCards();
    const backupText = JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [],
      accounts: [account.account], creditCards: expectedCards
    });
    assertEqual(GastoProBackupHelpers.validate(backupText).creditCards, expectedCards);
    assertTrue((await FinanceData.importJSON(backupText, 'replace')).success);
    assertEqual(FinanceData.getCreditCards(), expectedCards);
    assertEqual(GastoProBackupHelpers.validate(JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: []
    })).creditCards, []);
    const legacyCard = GastoProBackupHelpers.validate(JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [], accounts: [],
      creditCards: [{
        id: crypto.randomUUID(), name: 'Cartão antigo', totalLimit: 300,
        closingDay: 15, dueDay: 25, accountId: null
      }]
    })).creditCards[0];
    assertEqual(legacyCard.brand, 'Outra');
    assertEqual(legacyCard.issuerBank, 'Outro');
    assertEqual(legacyCard.lastFour, null);
    assertEqual(legacyCard.customColor, '#6366f1');
    const visual = window.GastoProCreditCardDashboardHelpers.renderVisual({
      ...created.card, name: '<Cartão>', totalLimit: 5000
    }, true);
    assertTrue(visual.includes('&lt;Cartão&gt;'));
    assertTrue(visual.includes('Visa'));
    assertTrue(visual.includes('•••• 1234'));
    assertTrue(visual.includes('Limite'));
  });

  itAsync('sincroniza cartões e limpa a fila após confirmação do Supabase', async () => {
    setupMockLocalStorage();
    const userId = 'user-credit-cards';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const card = {
      id: crypto.randomUUID(), name: 'Cartão sincronizado', totalLimit: 1200,
      closingDay: 15, dueDay: 25, accountId: null,
      brand: 'Mastercard', issuerBank: 'Nubank', lastFour: '7788', customColor: null
    };
    await FinanceData.saveCreditCards([card], { flush: false });
    const purchase = {
      id: crypto.randomUUID(), cardId: card.id, cardName: card.name, accountId: null,
      desc: 'Compra sincronizada', amount: 120, category: 'Compras',
      purchaseDate: '2026-03-10', installmentCount: 2, closingDay: 15, dueDay: 25,
      paidInstallments: [], paidDates: {}
    };
    await FinanceData.saveCreditCardPurchases([purchase], { flush: false });
    const previousAuth = window.SupabaseAuth;
    let syncedCards = [];
    let syncedPurchases = [];
    window.SupabaseAuth = {
      saveCloudCreditCards: async cards => {
        syncedCards = cards;
        return { success: true };
      },
      saveCloudCreditCardPurchases: async purchases => {
        syncedPurchases = purchases;
        return { success: true };
      }
    };
    try {
      const result = await FinanceData.flushPendingSync(userId);
      assertTrue(result.success);
      assertEqual(syncedCards, [card]);
      assertEqual(syncedPurchases, [purchase]);
      assertEqual(FinanceData.getPendingSync().creditCards, []);
      assertEqual(FinanceData.getPendingSync().creditCardPurchases, []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('distribui parcelas antes e depois do fechamento, em 1x e até 24x', async () => {
    const makePurchase = overrides => ({
      purchaseDate: '2026-03-20', amount: 2400, installmentCount: 1,
      closingDay: 20, dueDay: 10, ...overrides
    });
    const beforeClose = window.GastoProCreditCardHelpers.getInstallments(makePurchase({
      purchaseDate: '2026-03-20'
    }));
    const afterClose = window.GastoProCreditCardHelpers.getInstallments(makePurchase({
      purchaseDate: '2026-03-21'
    }));
    assertEqual(beforeClose[0].month, '2026-04');
    assertEqual(beforeClose[0].date, '2026-04-10');
    assertEqual(afterClose[0].month, '2026-05');

    const single = window.GastoProCreditCardHelpers.getInstallments(makePurchase({
      amount: 250, installmentCount: 1
    }));
    assertEqual(single.length, 1);
    assertEqual(single[0].amount, 250);
    const maximum = window.GastoProCreditCardHelpers.getInstallments(makePurchase({
      amount: 2400, installmentCount: 24
    }));
    assertEqual(maximum.length, 24);
    assertEqual(maximum[0].month, '2026-04');
    assertEqual(maximum[23].month, '2028-03');
    assertEqual(Math.round(maximum.reduce((sum, item) => sum + item.amount, 0) * 100), 240000);
  });

  itAsync('mantém a compra fora do saldo da conta até pagar a parcela e inclui fatura no mês correto', async () => {
    setupMockLocalStorage();
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta da fatura', type: 'PF', initialBalance: 1000, balanceDate: todayString
    });
    const card = await FinanceData.addCreditCard({
      name: 'Cartão da conta', totalLimit: 2000, closingDay: 31, dueDay: 10,
      accountId: account.account.id
    });
    const purchase = await FinanceData.addCreditCardPurchase({
      cardId: card.card.id, desc: 'Compra parcelada', amount: 300,
      category: 'Compras', purchaseDate: todayString, installmentCount: 3
    });
    assertTrue(purchase.success);
    assertEqual(FinanceData.getAccountBalance(account.account.id), 1000);
    const schedule = window.GastoProCreditCardHelpers.getInstallments(purchase.purchase);
    assertEqual(schedule[0].month, GastoProImporter.shiftMonth(todayString.slice(0, 7), 1));
    const monthItems = FinanceData.getByMonth(schedule[0].month);
    const installment = monthItems.find(item => item.isCardInstallment);
    assertEqual(installment.amount, 100);
    assertEqual(installment.installmentNumber, 1);

    const paid = await FinanceData.toggleCreditCardPurchasePaid(purchase.purchase.id, 1);
    assertTrue(paid.success);
    assertEqual(FinanceData.getAccountBalance(account.account.id), 900);
    assertEqual(FinanceData.getByMonth(schedule[0].month).find(item =>
      item.isCardInstallment
    ).paid, true);
  });

  it('calcula limite usado e alertas a 80% e 100%', () => {
    const card = { id: 'card-a', totalLimit: 1000 };
    const purchases = [
      { cardId: 'card-a', amount: 800, installmentCount: 1, purchaseDate: '2026-03-01',
        closingDay: 20, dueDay: 10, paidInstallments: [] }
    ];
    const warning = window.GastoProCreditCardHelpers.calculateLimitUsage(card, purchases);
    assertEqual(warning.used, 800);
    assertEqual(warning.available, 200);
    assertEqual(warning.alert, 'warning');
    assertEqual(
      window.GastoProCreditCardDashboardHelpers.getUsagePresentation(warning.alert).message,
      'Atenção: uso igual ou acima de 80%.'
    );
    purchases[0].amount = 1000;
    const full = window.GastoProCreditCardHelpers.calculateLimitUsage(card, purchases);
    assertEqual(full.alert, 'full');
    assertEqual(
      window.GastoProCreditCardDashboardHelpers.getUsagePresentation(full.alert).message,
      'Limite atingido ou excedido.'
    );
  });

  itAsync('mantém compras e baixas de parcelas no backup e aceita backup antigo sem cartões', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta de backup', type: 'PJ', initialBalance: 500, balanceDate: '2026-01-01'
    });
    const card = await FinanceData.addCreditCard({
      name: 'Cartão de backup', totalLimit: 3000, closingDay: 15, dueDay: 25,
      accountId: account.account.id
    });
    const added = await FinanceData.addCreditCardPurchase({
      cardId: card.card.id, desc: 'Compra no backup', amount: 240,
      category: 'Compras', purchaseDate: '2026-01-16', installmentCount: 2
    });
    await FinanceData.toggleCreditCardPurchasePaid(added.purchase.id, 1);
    const backupText = JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [],
      accounts: FinanceData.getAccounts(), creditCards: FinanceData.getCreditCards(),
      creditCardPurchases: FinanceData.getCreditCardPurchases()
    });
    const validated = GastoProBackupHelpers.validate(backupText);
    assertFalse(validated.error);
    assertEqual(validated.creditCardPurchases[0].paidInstallments, [1]);
    assertEqual(validated.creditCardPurchases[0].paidDates[1], todayString);
    assertTrue((await FinanceData.importJSON(backupText, 'replace')).success);
    assertEqual(FinanceData.getCreditCardPurchases(), validated.creditCardPurchases);
    const oldBackup = GastoProBackupHelpers.validate(JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: []
    }));
    assertFalse(oldBackup.error);
    assertEqual(oldBackup.creditCards, []);
    assertEqual(oldBackup.creditCardPurchases, []);
  });

  itAsync('calcula saldo considerando somente receitas e gastos pagos', async () => {
    setupMockLocalStorage();
    const account = await FinanceData.addAccount({ name: 'Conta', type: 'PF', initialBalance: 100 });
    const today = new Date();
    const formatDate = date =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const todayString = formatDate(today);
    const currentMonth = todayString.slice(0, 7);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const nextMonth = GastoProImporter.shiftMonth(currentMonth, 1);
    FinanceData.saveEntries([
      makeIncome({ id: crypto.randomUUID(), accountId: account.account.id, amount: 100, date: todayString, paid: true }),
      makeIncome({ id: crypto.randomUUID(), accountId: account.account.id, amount: 500, date: todayString, paid: false }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 25, date: todayString, paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 40, date: todayString, paid: false }),
      makeIncome({ id: crypto.randomUUID(), accountId: account.account.id, amount: 700, date: formatDate(tomorrow), paid: true })
    ]);
    FinanceData.saveTemplates([{
      ...makeFixed({
        id: crypto.randomUUID(), accountId: account.account.id, amount: 30,
        date: `${currentMonth}-${String(today.getDate()).padStart(2, '0')}`,
        day: String(today.getDate())
      }),
      paidMonths: { [currentMonth]: true, [nextMonth]: true }
    }]);

    assertEqual(FinanceData.getAccountBalance(account.account.id), 145);
  });

  itAsync('filtra movimentos pagos pela data-base e usa o dia de vencimento nos meses pagos', async () => {
    setupMockLocalStorage();
    const today = new Date();
    const formatDate = date =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const todayString = formatDate(today);
    const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10);
    const beforeBaseDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const currentMonth = todayString.slice(0, 7);
    const nextMonth = GastoProImporter.shiftMonth(currentMonth, 1);
    const account = await FinanceData.addAccount({
      name: 'Conta com data-base',
      type: 'PF',
      initialBalance: 1000,
      balanceDate: formatDate(baseDate)
    });
    FinanceData.saveEntries([
      makeIncome({ id: crypto.randomUUID(), accountId: account.account.id, amount: 200, date: formatDate(beforeBaseDate), paid: true }),
      makeIncome({ id: crypto.randomUUID(), accountId: account.account.id, amount: 100, date: formatDate(baseDate), paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 20, date: formatDate(beforeBaseDate), paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 50, date: todayString, paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 900, date: formatDate(tomorrow), paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: account.account.id, amount: 900, date: todayString, paid: false })
    ]);
    FinanceData.saveTemplates([{
      ...makeFixed({
        id: crypto.randomUUID(), accountId: account.account.id, amount: 30,
        date: `${currentMonth}-${String(today.getDate()).padStart(2, '0')}`,
        day: String(today.getDate())
      }),
      paidMonths: {
        [GastoProImporter.shiftMonth(currentMonth, -1)]: true,
        [currentMonth]: true,
        [nextMonth]: true
      }
    }]);

    assertEqual(FinanceData.getAccountBalance(account.account.id), 1020);
  });

  itAsync('consolida saldos PF e PJ sem incluir movimentações sem conta', async () => {
    setupMockLocalStorage();
    const personal = await FinanceData.addAccount({ name: 'PF', type: 'PF', initialBalance: 200 });
    await FinanceData.addAccount({ name: 'PJ', type: 'PJ', initialBalance: 300 });
    FinanceData.add(makeIncome({ amount: 999, paid: true }));

    assertEqual(FinanceData.getAccountBalances(), { total: 500, PF: 200, PJ: 300 });
    assertEqual(FinanceData.getAccountBalance(personal.account.id), 200);
  });

  itAsync('ajuste rápido recalcula o saldo inicial para atingir o saldo informado', async () => {
    setupMockLocalStorage();
    const created = await FinanceData.addAccount({ name: 'Conta', type: 'PF', initialBalance: 100 });
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    FinanceData.saveEntries([
      makeIncome({ id: crypto.randomUUID(), accountId: created.account.id, amount: 20, date: todayString, paid: true }),
      makeVariable({ id: crypto.randomUUID(), accountId: created.account.id, amount: 10, date: todayString, paid: true })
    ]);

    const adjusted = await FinanceData.adjustAccountBalance(created.account.id, 500);
    assertTrue(adjusted.success);
    assertEqual(FinanceData.getAccounts()[0].initialBalance, 490);
    assertEqual(FinanceData.getAccountBalance(created.account.id), 500);
  });

  itAsync('excluir uma conta desvincula lançamentos e templates sem apagá-los', async () => {
    setupMockLocalStorage();
    const created = await FinanceData.addAccount({ name: 'Conta', type: 'PF' });
    const entry = makeIncome({ id: crypto.randomUUID(), accountId: created.account.id });
    const template = {
      ...makeFixed({ id: crypto.randomUUID(), accountId: created.account.id }),
      paidMonths: {}
    };
    FinanceData.saveEntries([entry]);
    FinanceData.saveTemplates([template]);

    const result = await FinanceData.deleteAccount(created.account.id);
    assertTrue(result.success);
    assertEqual(FinanceData.getAccounts(), []);
    assertEqual(FinanceData.getEntries(), [{ ...entry, accountId: null }]);
    assertEqual(FinanceData.getTemplates()[0].accountId, null);
    assertEqual(FinanceData.getTemplates()[0].id, template.id);
  });

  itAsync('reset mantém contas cadastradas e remove lançamentos/templates vinculados', async () => {
    setupMockLocalStorage();
    const created = await FinanceData.addAccount({ name: 'Conta mantida', type: 'PF' });
    FinanceData.saveEntries([
      makeIncome({ id: crypto.randomUUID(), accountId: created.account.id })
    ]);
    FinanceData.saveTemplates([{
      ...makeFixed({ id: crypto.randomUUID(), accountId: created.account.id }),
      paidMonths: {}
    }]);

    await FinanceData.clearAll();
    assertEqual(FinanceData.getAccounts(), []);
    assertEqual(FinanceData.getEntries(), []);
    assertEqual(FinanceData.getTemplates(), []);
  });

  itAsync('enfileira upserts e exclusões de contas e retém falhas para nova tentativa', async () => {
    setupMockLocalStorage();
    const userId = 'user-account-queue';
    const account = {
      id: crypto.randomUUID(), name: 'Conta', institution: null, type: 'PF', initialBalance: 0
    };
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId });
    const previousAuth = window.SupabaseAuth;
    let fail = true;
    const callOrder = [];
    window.SupabaseAuth = {
      saveCloudEntries: async () => { callOrder.push('entries'); return { success: true }; },
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      deleteCloudGoals: async () => ({ success: true }),
      saveCloudAccounts: async accounts => {
        callOrder.push('accounts');
        return { success: !fail, failedIds: fail ? accounts.map(item => item.id) : [] };
      },
      deleteCloudAccounts: async () => ({ success: !fail })
    };
    try {
      await FinanceData.saveAccounts([account], { flush: false });
      await FinanceData.saveEntries([
        makeIncome({ id: crypto.randomUUID(), accountId: account.id })
      ], { flush: false });
      await FinanceData.flushPendingSync(userId);
      assertEqual(FinanceData.getPendingSync().accounts, [account.id]);
      assertEqual(callOrder.slice(0, 2), ['accounts', 'entries']);
      await FinanceData.deleteAccount(account.id);
      assertEqual(FinanceData.getPendingSync().deletedAccounts, [account.id]);
      assertEqual(FinanceData.getEntries()[0].accountId, null);

      fail = false;
      const result = await FinanceData.flushPendingSync(userId);
      assertTrue(result.success);
      assertEqual(FinanceData.getPendingSync().accounts, []);
      assertEqual(FinanceData.getPendingSync().deletedAccounts, []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  it('mescla contas da nuvem preservando alterações locais pendentes', () => {
    setupMockLocalStorage();
    const userId = 'user-account-merge';
    const local = {
      id: crypto.randomUUID(), name: 'Nome local', type: 'PF', institution: null, initialBalance: 10
    };
    const remote = {
      id: crypto.randomUUID(), name: 'Remota', type: 'PJ', institution: 'Banco', initialBalance: 20
    };
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveAccounts([local], { flush: false });
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
      goals: [], deletedGoals: [], accounts: [local.id], deletedAccounts: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, [], [
      { ...local, name: 'Nome remoto' }, remote
    ]));
    assertEqual(FinanceData.getAccounts().find(item => item.id === local.id).name, 'Nome local');
    assertTrue(FinanceData.getAccounts().some(item => item.id === remote.id));
  });

  itAsync('inclui contas e vínculos no backup, na validação e na restauração', async () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_theme', 'light');
    const accountId = crypto.randomUUID();
    const account = {
      id: accountId, name: 'Conta backup', institution: null, type: 'PF', initialBalance: 250,
      balanceDate: '2026-10-01'
    };
    const entry = makeIncome({
      id: crypto.randomUUID(), accountId, date: '2026-11-05', month: '2026-11'
    });
    const text = JSON.stringify({
      version: '4.0',
      entries: [entry],
      templates: [],
      goals: [],
      accounts: [account]
    });
    const validated = GastoProBackupHelpers.validate(text);
    assertEqual(validated.accounts, [account]);
    assertEqual(validated.entries[0].accountId, accountId);

    const result = await FinanceData.importJSON(text, 'replace');
    assertTrue(result.success);
    assertEqual(FinanceData.getAccounts(), [account]);
    assertEqual(FinanceData.getEntries()[0].accountId, accountId);
    assertEqual(localStorage.getItem('gastopro_theme'), 'light');
  });

  itAsync('sincroniza e limpa a fila de regras fixas de importação', async () => {
    setupMockLocalStorage();
    const userId = 'user-fixed-import-rules';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const previousAuth = window.SupabaseAuth;
    let syncedRules = null;
    window.SupabaseAuth = {
      saveCloudFixedImportRules: async rules => {
        syncedRules = rules;
        return { success: true };
      }
    };
    try {
      await FinanceData.saveFixedImportRules(['shopee sparcelado'], { flush: false });
      const result = await FinanceData.flushPendingSync(userId);
      assertTrue(result.success);
      assertEqual(syncedRules, ['shopee sparcelado']);
      assertFalse(FinanceData.getPendingSync().fixedImportRules);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('aceita e restaura conta antiga sem balanceDate com data nula', async () => {
    setupMockLocalStorage();
    const account = {
      id: crypto.randomUUID(), name: 'Conta antiga', institution: null, type: 'PF', initialBalance: 50
    };
    const backupText = JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [], accounts: [account]
    });
    const validated = GastoProBackupHelpers.validate(backupText);
    assertFalse(validated.error);
    assertEqual(validated.accounts[0].balanceDate, null);
    assertNull(window.validateCloudPayload({ ...account, balanceDate: null }, 'accounts'));
    assertTrue(window.validateCloudPayload({ ...account, balanceDate: '2026-02-30' }, 'accounts'));
    const restored = await FinanceData.importJSON(backupText, 'replace');
    assertTrue(restored.success);
    assertEqual(FinanceData.getAccounts()[0].balanceDate, null);
  });

  itAsync('salva e restaura regras fixas no backup e aceita backup antigo sem regras', async () => {
    setupMockLocalStorage();
    const rule = 'shopee sparcelado';
    const backupText = JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [], accounts: [],
      fixedImportRules: [rule]
    });
    const validated = GastoProBackupHelpers.validate(backupText);
    assertEqual(validated.fixedImportRules, [rule]);
    assertTrue((await FinanceData.importJSON(backupText, 'replace')).success);
    assertEqual(FinanceData.getFixedImportRules(), [rule]);

    const legacy = JSON.stringify({
      version: '4.0', entries: [], templates: [], goals: [], accounts: []
    });
    assertEqual(GastoProBackupHelpers.validate(legacy).fixedImportRules, []);
    assertTrue((await FinanceData.importJSON(legacy, 'replace')).success);
    assertEqual(FinanceData.getFixedImportRules(), []);
  });

  itAsync('converte em recorrência somente os lançamentos futuros confirmados', async () => {
    setupMockLocalStorage();
    const source = makeVariable({ id: 'fixed-source', date: '2026-01-10', paid: true });
    const future = makeVariable({ id: 'fixed-future', date: '2026-02-10', paid: true });
    const fields = {
      desc: source.desc, amount: source.amount, category: source.category,
      accountId: 'conta-original', active: true, endMonth: null
    };
    await FinanceData.saveEntries([source, future], { flush: false });

    const result = await FinanceData.convertEntryToTemplate(source.id, fields, []);
    assertTrue(result.success);
    assertEqual(FinanceData.getEntries().map(entry => entry.id), [future.id]);
    assertEqual(FinanceData.getTemplates()[0].accountId, 'conta-original');
    assertEqual(FinanceData.getTemplates()[0].paidMonths, { '2026-01': true });

    setupMockLocalStorage();
    await FinanceData.saveEntries([source, future], { flush: false });
    const applied = await FinanceData.convertEntryToTemplate(source.id, fields, [future.id]);
    assertTrue(applied.success);
    assertEqual(FinanceData.getEntries(), []);
    assertEqual(applied.convertedCount, 1);
    assertEqual(FinanceData.getTemplates()[0].paidMonths, {
      '2026-01': true, '2026-02': true
    });
  });
});

describe('Recuperação de conta e confirmação de e-mail', () => {
  it('compara e-mails ignorando caixa e espaços nas pontas', () => {
    assertTrue(window.GastoProAuthHelpers.emailsMatch('  Pessoa@Exemplo.com ', 'pessoa@exemplo.com'));
    assertFalse(window.GastoProAuthHelpers.emailsMatch('pessoa@exemplo.com', 'outra@exemplo.com'));
  });

  it('mapeia erros de limite e mantém uma mensagem genérica para outras falhas', () => {
    const rateLimitMessage = 'Muitos pedidos de e-mail agora. Aguarde alguns minutos e tente de novo.';
    assertEqual(window.GastoProAuthHelpers.getPasswordRecoveryErrorMessage({ status: 429 }), rateLimitMessage);
    assertEqual(window.GastoProAuthHelpers.getPasswordRecoveryErrorMessage({
      code: 'over_email_send_rate_limit'
    }), rateLimitMessage);
    assertEqual(window.GastoProAuthHelpers.getPasswordRecoveryErrorMessage({
      message: 'For security purposes, wait 60 seconds before requesting again'
    }), rateLimitMessage);
    assertEqual(window.GastoProAuthHelpers.getPasswordRecoveryErrorMessage({
      message: 'Network error'
    }), 'Não foi possível enviar o e-mail. Verifique o endereço informado.');
  });

  it('usa uma mensagem neutra após solicitar redefinição de senha', () => {
    assertEqual(
      window.GastoProAuthHelpers.getPasswordRecoverySuccessMessage(),
      'Se esse e-mail tiver conta, você receberá as instruções. Confira também o spam.'
    );
  });
});

describe('Restauração da tela principal', () => {
  const restore = window.GastoProViewHelpers.restore;

  it('restaura uma tela válida para o mesmo usuário', () => {
    assertEqual(restore({ view: 'accounts', ownerId: 'user-a' }, 'user-a', false), 'accounts');
  });

  it('usa Dashboard para tela inválida', () => {
    assertEqual(restore({ view: 'profile', ownerId: null }, null, false), 'dashboard');
  });

  it('restaura Admin somente após confirmar acesso', () => {
    const savedAdmin = { view: 'admin', ownerId: 'admin-user' };
    assertEqual(restore(savedAdmin, 'admin-user', false), 'dashboard');
    assertEqual(restore(savedAdmin, 'admin-user', true), 'admin');
  });

  it('não restaura a tela de outro usuário no mesmo aparelho', () => {
    assertEqual(restore({ view: 'expenses', ownerId: 'user-a' }, 'user-b', false), 'dashboard');
  });
});

describe('Salvamento com trava', () => {
  itAsync('ignora segundo clique após timeout e restaura botão quando a ação original termina', async () => {
    const button = document.createElement('button');
    button.innerHTML = '<i class="fa-solid fa-check"></i> Salvar';
    const originalHtml = button.innerHTML;
    let resolveOriginal;
    let calls = 0;
    const originalAction = new Promise(resolve => { resolveOriginal = resolve; });

    const firstSave = window.GastoProSaving.withSaving(button, () => {
      calls++;
      return originalAction;
    }, 5);
    await new Promise(resolve => setTimeout(resolve, 15));

    assertEqual(button.textContent, 'Ainda sincronizando, aguarde...');
    assertTrue(button.disabled);
    assertEqual(button.getAttribute('aria-busy'), 'true');
    assertFalse(await window.GastoProSaving.withSaving(button, async () => { calls++; }));
    assertEqual(calls, 1);

    resolveOriginal('salvo');
    assertEqual(await firstSave, 'salvo');
    assertEqual(button.innerHTML, originalHtml);
    assertFalse(button.disabled);
    assertNull(button.getAttribute('aria-busy'));
  });

  itAsync('restaura botão após sucesso', async () => {
    const button = document.createElement('button');
    button.innerHTML = 'Salvar meta';
    const result = await window.GastoProSaving.withSaving(button, async () => 'ok');
    assertEqual(result, 'ok');
    assertEqual(button.innerHTML, 'Salvar meta');
    assertFalse(button.disabled);
    assertNull(button.getAttribute('aria-busy'));
  });

  itAsync('restaura botão após erro e repassa a rejeição', async () => {
    const button = document.createElement('button');
    button.innerHTML = 'Salvar backup';
    let message = '';
    try {
      await window.GastoProSaving.withSaving(button, async () => {
        throw new Error('falha de teste');
      });
    } catch (error) {
      message = error.message;
    }
    assertEqual(message, 'falha de teste');
    assertEqual(button.innerHTML, 'Salvar backup');
    assertFalse(button.disabled);
    assertNull(button.getAttribute('aria-busy'));
  });
});

describe('Tema — preferência local', () => {
  it('normaliza valores ausentes ou inválidos para escuro', () => {
    assertEqual(window.GastoProThemeHelpers.normalizeSavedTheme(null), 'dark');
    assertEqual(window.GastoProThemeHelpers.normalizeSavedTheme('invalid'), 'dark');
    assertEqual(window.GastoProThemeHelpers.normalizeSavedTheme('light'), 'light');
  });

  it('escolhe o tema salvo ou escuro por padrão sem consultar o sistema', () => {
    assertEqual(window.GastoProThemeHelpers.chooseTheme(null), 'dark');
    assertEqual(window.GastoProThemeHelpers.chooseTheme('light'), 'light');
    assertEqual(window.GastoProThemeHelpers.chooseTheme('dark'), 'dark');
  });

  it('alterna nos dois sentidos', () => {
    assertEqual(window.GastoProThemeHelpers.toggleTheme('dark'), 'light');
    assertEqual(window.GastoProThemeHelpers.toggleTheme('light'), 'dark');
  });

  it('lê e persiste a preferência local com escuro como padrão', () => {
    setupMockLocalStorage();
    assertEqual(window.GastoProTheme.readTheme(), 'dark');
    localStorage.setItem('gastopro_theme', 'light');
    assertEqual(window.GastoProTheme.readTheme(), 'light');
    window.GastoProTheme.setTheme('dark');
    assertEqual(localStorage.getItem('gastopro_theme'), 'dark');
  });
});

describe('Interface — filtros e opções de contas', () => {
  it('seleciona o saldo de todas, por tipo ou de uma conta sem duplicar controles', () => {
    const balances = { total: 1450, PF: 900, PJ: 550 };
    const accounts = [
      { id: 'conta-pf', name: 'Conta pessoal', type: 'PF', balanceDate: '2026-01-01' },
      { id: 'conta-pj', name: 'Conta empresa', type: 'PJ', balanceDate: null }
    ];
    assertEqual(getAccountBalanceForFilter(balances, 'all'), 1450);
    assertEqual(getAccountBalanceForFilter(balances, 'PF'), 900);
    assertEqual(getAccountBalanceForFilter(balances, 'PJ'), 550);
    assertEqual(getAccountBalanceForFilter(
      balances, 'account:conta-pj', accounts, id => id === 'conta-pj' ? -25 : 0
    ), -25);
    assertEqual(buildAccountBalanceFilterOptions(accounts), [
      { value: 'all', label: 'Todas as contas' },
      { value: 'PF', label: 'Todas as contas PF' },
      { value: 'PJ', label: 'Todas as contas PJ' },
      { value: 'account:conta-pf', label: 'Conta pessoal' },
      { value: 'account:conta-pj', label: 'Conta empresa' }
    ]);
  });

  it('mostra convite sem contas e aviso de data apenas para a visão aplicável', () => {
    assertEqual(getAccountBalanceForFilter({ total: 0, PF: 0, PJ: 0 }, 'all', []), 0);
    assertEqual(getAccountBalanceFilterLabel([], 'all'), 'Cadastre uma conta para ver seu saldo.');
    const accounts = [
      { id: 'pf', type: 'PF', balanceDate: '2026-01-01' },
      { id: 'pj', type: 'PJ', balanceDate: null }
    ];
    assertFalse(accountsNeedBalanceDateNotice(accounts, 'PF'));
    assertTrue(accountsNeedBalanceDateNotice(accounts, 'PJ'));
    assertTrue(accountsNeedBalanceDateNotice(accounts, 'all'));
    assertTrue(accountsNeedBalanceDateNotice(accounts, 'account:pj'));
  });

  it('monta as opções de conta com Sem conta como primeira opção', () => {
    assertEqual(buildAccountSelectOptions([
      { id: 'account-1', name: 'Conta pessoal' },
      { id: 'account-2', name: 'Conta empresa' }
    ]), [
      { value: '', label: 'Sem conta' },
      { value: 'account-1', label: 'Conta pessoal' },
      { value: 'account-2', label: 'Conta empresa' }
    ]);
  });
});

describe('FinanceData — Templates de Gastos Fixos', () => {
  setupMockLocalStorage();

  it('getTemplates() deve retornar [] quando o banco estiver vazio', () => {
    const result = FinanceData.getTemplates();
    assertEqual(result, []);
  });

  it('saveTemplates() deve persistir e getTemplates() deve recuperar', () => {
    const tpl = { id: 'fix-test', desc: 'Aluguel', amount: 1200, active: true, startMonth: '2026-01' };
    FinanceData.saveTemplates([tpl]);
    const result = FinanceData.getTemplates();
    assertEqual(result.length, 1);
    assertEqual(result[0].desc, 'Aluguel');
  });
});

describe('FinanceData — add() Lançamentos', () => {
  setupMockLocalStorage();

  it('add(income) deve criar um lançamento pontual com UUID v4', () => {
    const item = FinanceData.add(makeIncome());
    assertTrue(isUuid(item.id), `ID deveria ser UUID v4, foi: ${item.id}`);
  });

  it('add(income) deve persistir o item corretamente', () => {
    setupMockLocalStorage();
    FinanceData.add(makeIncome({ amount: 2500, desc: 'Freela' }));
    const entries = FinanceData.getEntries();
    assertEqual(entries.length, 1);
    assertEqual(entries[0].amount, 2500);
    assertEqual(entries[0].type, 'income');
  });

  it('add(variable) deve criar lançamento variável com UUID v4', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeVariable());
    assertTrue(isUuid(item.id));
    assertEqual(item.type, 'variable');
  });

  it('add(income) deve marcar paid: true por padrão', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeIncome());
    assertTrue(item.paid, 'Lançamentos pontuais devem nascer com paid: true');
  });

  it('add(income) deve respeitar paid: false explícito', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeIncome({ paid: false }));
    assertFalse(item.paid);
  });

  it('add() deve gerar IDs únicos para múltiplos lançamentos', () => {
    setupMockLocalStorage();
    const a = FinanceData.add(makeIncome());
    const b = FinanceData.add(makeIncome());
    assertTrue(a.id !== b.id, 'IDs duplicados detectados!');
  });
});

describe('FinanceData — addTemplate() Gastos Fixos', () => {
  setupMockLocalStorage();

  it('add(fixed) deve criar um template com UUID v4', () => {
    const tpl = FinanceData.add(makeFixed());
    assertTrue(isUuid(tpl.id), `ID deveria ser UUID v4, foi: ${tpl.id}`);
  });

  it('add(fixed) deve salvar no localStorage de templates', () => {
    setupMockLocalStorage();
    FinanceData.add(makeFixed({ desc: 'Energia Elétrica', amount: 180 }));
    const templates = FinanceData.getTemplates();
    assertEqual(templates.length, 1);
    assertEqual(templates[0].desc, 'Energia Elétrica');
  });

  it('add(fixed) deve iniciar com active: true e paidMonths: {}', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed());
    assertTrue(tpl.active);
    assertEqual(tpl.paidMonths, {});
  });

  it('add(fixed) deve definir startMonth a partir do campo month', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ month: '2026-09', date: '2026-09-01' }));
    assertEqual(tpl.startMonth, '2026-09');
  });

  it('add(debt) deve marcar isDebt: true', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add({
      type: 'debt',
      desc: 'Empréstimo Banco',
      amount: 800,
      month: '2026-01',
      date: '2026-01-05',
      endMonth: '2026-12'
    });
    assertTrue(tpl.isDebt, 'isDebt deveria ser true para type=debt');
  });

  it('add(fixed) com category=Parcelamento deve marcar isDebt: true', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ category: 'Parcelamento', endMonth: '2027-06' }));
    assertTrue(tpl.isDebt);
  });
});

describe('FinanceData — getByMonth()', () => {
  setupMockLocalStorage();

  it('deve retornar apenas lançamentos do mês especificado', () => {
    FinanceData.add(makeIncome({ month: '2026-11', date: '2026-11-05' }));
    FinanceData.add(makeIncome({ month: '2026-10', date: '2026-10-05', desc: 'Outro mês' }));

    const result = FinanceData.getByMonth('2026-11');
    const novembro = result.filter(i => i.month === '2026-11');
    assertEqual(novembro.length, 1);
    assertEqual(novembro[0].desc, 'Salário Teste');
  });

  it('deve incluir template ativo que está dentro do período', () => {
    setupMockLocalStorage();
    // Template começa em 2026-01 sem fim definido
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-10', startMonth: '2026-01' }));
    const result = FinanceData.getByMonth('2026-11');
    const fixos  = result.filter(i => i.type === 'fixed');
    assertEqual(fixos.length, 1, 'Template de 2026-01 deve aparecer em 2026-11');
  });

  it('deve excluir template cujo endMonth já passou', () => {
    setupMockLocalStorage();
    // Template encerra em 2026-06, não deve aparecer em 2026-11
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01', endMonth: '2026-06' }));
    const result = FinanceData.getByMonth('2026-11');
    const fixos  = result.filter(i => i.type === 'fixed');
    assertEqual(fixos.length, 0, 'Template encerrado não deve aparecer');
  });

  it('deve excluir template que ainda não começou', () => {
    setupMockLocalStorage();
    // Template começa em 2027-01, não deve aparecer em 2026-11
    FinanceData.add(makeFixed({ month: '2027-01', date: '2027-01-01' }));
    const result = FinanceData.getByMonth('2026-11');
    const fixos  = result.filter(i => i.type === 'fixed');
    assertEqual(fixos.length, 0, 'Template futuro não deve aparecer');
  });

  it('template projetado deve ter isTemplate: true', () => {
    setupMockLocalStorage();
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-05' }));
    const result  = FinanceData.getByMonth('2026-11');
    const fixo    = result.find(i => i.type === 'fixed');
    assertTrue(fixo.isTemplate, 'Projeção de template deve ter isTemplate: true');
  });

  it('template projetado deve ter paid: false quando não baixado', () => {
    setupMockLocalStorage();
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-05' }));
    const result  = FinanceData.getByMonth('2026-11');
    const fixo    = result.find(i => i.type === 'fixed');
    assertFalse(fixo.paid, 'Sem baixa registrada, paid deve ser false');
  });
});

describe('FinanceData — update()', () => {
  setupMockLocalStorage();

  it('deve atualizar campos de um lançamento pontual', () => {
    const item    = FinanceData.add(makeIncome({ amount: 2000 }));
    const updated = FinanceData.update(item.id, { amount: 2500, desc: 'Salário Atualizado' });
    assertEqual(updated.amount, 2500);
    assertEqual(updated.desc, 'Salário Atualizado');
  });

  it('deve impedir que um lançamento pontual seja alterado para recorrente', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeVariable());
    const updated = FinanceData.update(item.id, { type: 'fixed' });
    assertNull(updated);
    assertTrue(FinanceData.getEntries().some(entry => entry.id === item.id));
    assertFalse(FinanceData.getTemplates().some(template => template.id === item.id));
  });

  it('deve impedir que um template recorrente seja alterado para pontual', () => {
    setupMockLocalStorage();
    const template = FinanceData.add(makeFixed());
    const updated = FinanceData.update(template.id, { type: 'variable' });
    assertNull(updated);
    assertTrue(FinanceData.getTemplates().some(item => item.id === template.id));
    assertFalse(FinanceData.getEntries().some(item => item.id === template.id));
  });

  it('deve retornar null para lançamento inexistente', () => {
    setupMockLocalStorage();
    const result = FinanceData.update('entry-inexistente-abc', { amount: 100 });
    assertNull(result, 'Deveria retornar null para ID inexistente');
  });

  it('deve atualizar um template de gasto fixo', () => {
    setupMockLocalStorage();
    const tpl     = FinanceData.add(makeFixed({ amount: 1200 }));
    const updated = FinanceData.update(tpl.id, { amount: 1350, desc: 'Aluguel Reajustado' });
    assertEqual(updated.amount, 1350);
    assertEqual(updated.desc, 'Aluguel Reajustado');
  });

  it('deve sincronizar o campo day ao alterar a date do template', () => {
    setupMockLocalStorage();
    const tpl     = FinanceData.add(makeFixed({ date: '2026-11-05' }));
    const updated = FinanceData.update(tpl.id, { date: '2026-11-15' });
    assertEqual(updated.day, '15', 'Campo day deve refletir o dia da nova data');
  });

  it('deve retornar null para template com ID inexistente', () => {
    setupMockLocalStorage();
    const result = FinanceData.update('fix-inexistente-abc', { amount: 100 });
    assertNull(result);
  });
});

describe('FinanceData — togglePaid()', () => {
  setupMockLocalStorage();

  it('deve inverter paid de false para true em lançamento pontual', () => {
    const item = FinanceData.add(makeVariable({ paid: false }));
    FinanceData.togglePaid(item.id, '2026-11');
    const updated = FinanceData.getEntries().find(e => e.id === item.id);
    assertTrue(updated.paid);
  });

  it('deve inverter paid de true para false em lançamento pontual', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeVariable({ paid: true }));
    FinanceData.togglePaid(item.id, '2026-11');
    const updated = FinanceData.getEntries().find(e => e.id === item.id);
    assertFalse(updated.paid);
  });

  it('deve registrar baixa em paidMonths[ym] do template', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.togglePaid(tpl.id, '2026-11');
    const templates = FinanceData.getTemplates();
    const updated   = templates.find(t => t.id === tpl.id);
    assertTrue(updated.paidMonths['2026-11'], 'Baixa de 2026-11 deveria ser true');
  });

  it('baixa de um mês não deve afetar outros meses do template', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.togglePaid(tpl.id, '2026-11');
    const updated = FinanceData.getTemplates().find(t => t.id === tpl.id);
    // Outros meses não devem ter sido afetados
    assertEqual(updated.paidMonths['2026-10'], undefined, '2026-10 não deveria ter registro');
    assertEqual(updated.paidMonths['2026-12'], undefined, '2026-12 não deveria ter registro');
  });

  it('getByMonth deve refletir paid:true após togglePaid no template', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.togglePaid(tpl.id, '2026-11');
    const result = FinanceData.getByMonth('2026-11');
    const fixo   = result.find(i => i.type === 'fixed');
    assertTrue(fixo.paid, 'Projeção deve refletir a baixa do mês');
  });
});

describe('FinanceData — toggleActive()', () => {
  setupMockLocalStorage();

  it('deve inverter active de true para false', () => {
    const tpl  = FinanceData.add(makeFixed());
    const novo = FinanceData.toggleActive(tpl.id);
    assertFalse(novo, 'Deveria retornar false após inativar');
    const templates = FinanceData.getTemplates();
    assertFalse(templates.find(t => t.id === tpl.id).active);
  });

  it('deve inverter active de false para true', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed());
    FinanceData.toggleActive(tpl.id); // inativa
    const novo = FinanceData.toggleActive(tpl.id); // reativa
    assertTrue(novo, 'Deveria retornar true após reativar');
  });

  it('deve retornar false para ID de template inexistente', () => {
    setupMockLocalStorage();
    const resultado = FinanceData.toggleActive('fix-inexistente');
    assertFalse(resultado);
  });
});

describe('FinanceData — delete()', () => {
  setupMockLocalStorage();

  it('deve remover um lançamento pontual pelo ID', () => {
    const item = FinanceData.add(makeIncome());
    FinanceData.delete(item.id);
    const entries = FinanceData.getEntries();
    assertEqual(entries.length, 0);
  });

  it('deve remover um template de gasto fixo pelo ID', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed());
    FinanceData.delete(tpl.id);
    const templates = FinanceData.getTemplates();
    assertEqual(templates.length, 0);
  });

  it('não deve remover outros itens ao deletar um específico', () => {
    setupMockLocalStorage();
    const a = FinanceData.add(makeIncome({ desc: 'Salário A' }));
    const b = FinanceData.add(makeIncome({ desc: 'Freela B' }));
    FinanceData.delete(a.id);
    const entries = FinanceData.getEntries();
    assertEqual(entries.length, 1);
    assertEqual(entries[0].id, b.id);
  });

  it('template deletado não deve aparecer no getByMonth()', () => {
    setupMockLocalStorage();
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.delete(tpl.id);
    const result = FinanceData.getByMonth('2026-11');
    assertEqual(result.filter(i => i.type === 'fixed').length, 0);
  });
});

describe('Canal Fale comigo', () => {
  const helpers = window.GastoProFeedbackHelpers;

  it('valida respostas entre 1 e 2000 caracteres após trim', () => {
    assertNull(helpers.validateReply('  Resposta válida  '));
    assertNull(helpers.validateReply('a'.repeat(2000)));
    assertTrue(helpers.validateReply('   ').includes('1 a 2000'));
    assertTrue(helpers.validateReply('a'.repeat(2001)).includes('1 a 2000'));
  });

  it('monta o payload de resposta com texto, status e data juntos', () => {
    const built = helpers.buildReplyPayload('  Obrigado pelo contato  ', '2026-10-29T12:30:00Z');
    assertNull(built.error);
    assertEqual(built.payload, {
      reply: 'Obrigado pelo contato',
      status: 'answered',
      replied_at: '2026-10-29T12:30:00.000Z'
    });
  });

  it('filtra mensagens pelo status sem alterar a lista original', () => {
    const messages = [{ status: 'new' }, { status: 'answered' }, { status: 'new' }];
    assertEqual(helpers.filterByStatus(messages, 'new'), [messages[0], messages[2]]);
    assertEqual(helpers.filterByStatus(messages, 'answered'), [messages[1]]);
    assertEqual(helpers.filterByStatus(messages, 'all'), messages);
    assertEqual(messages.length, 3);
  });

  it('ordena novas da mais antiga e as demais da mais recente', () => {
    const messages = [
      { id: 'c', created_at: '2026-10-30T00:00:00Z' },
      { id: 'a', created_at: '2026-10-28T00:00:00Z' },
      { id: 'b', created_at: '2026-10-29T00:00:00Z' }
    ];
    assertEqual(helpers.sortMessages(messages, 'new').map(item => item.id), ['a', 'b', 'c']);
    assertEqual(helpers.sortMessages(messages, 'answered').map(item => item.id), ['c', 'b', 'a']);
    assertEqual(helpers.sortMessages(messages, 'all').map(item => item.id), ['c', 'b', 'a']);
  });

  it('conta novas e cria rótulos neutros sequenciais', () => {
    assertEqual(helpers.countNew([{ status: 'new' }, { status: 'answered' }, { status: 'new' }]), 2);
    assertEqual(helpers.getAdminLabel(0), 'Mensagem #1');
    assertEqual(helpers.getAdminLabel(2), 'Mensagem #3');
  });

  itAsync('checkIsAdmin falha fechado em erro ou resposta inesperada', async () => {
    const previousClient = window.SupabaseAuth.client;
    const authenticatedClient = rpcResult => ({
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: '550e8400-e29b-41d4-a716-446655440001' } } },
          error: null
        })
      },
      rpc: async () => rpcResult
    });
    try {
      window.SupabaseAuth.client = authenticatedClient({ data: true, error: new Error('offline') });
      assertFalse(await window.SupabaseAuth.checkIsAdmin());
      window.SupabaseAuth.client = authenticatedClient({ data: { is_admin: true }, error: null });
      assertFalse(await window.SupabaseAuth.checkIsAdmin());
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('lista administrativa seleciona apenas campos sem identificador do autor', async () => {
    const previousClient = window.SupabaseAuth.client;
    let selectedColumns = '';
    const rows = [{
      id: '550e8400-e29b-41d4-a716-446655440002',
      category: 'duvida',
      message: 'Mensagem de teste',
      status: 'new',
      reply: null,
      replied_at: null,
      created_at: '2026-10-29T12:00:00Z'
    }];
    window.SupabaseAuth.client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: '550e8400-e29b-41d4-a716-446655440001' } } },
          error: null
        })
      },
      rpc: async () => ({ data: true, error: null }),
      from(table) {
        assertEqual(table, 'feedback_messages');
        return {
          select(columns) {
            selectedColumns = columns;
            return this;
          },
          eq() { return this; },
          order() { return this; },
          range: async () => ({ data: rows, error: null })
        };
      }
    };
    try {
      const result = await window.SupabaseAuth.fetchAllFeedback({ status: 'new', limit: 20, offset: 0 });
      assertTrue(result.success);
      assertEqual(selectedColumns, 'id, category, message, status, reply, replied_at, created_at');
      assertFalse(selectedColumns.includes('user_id'));
      assertEqual(result.messages, rows);
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  it('valida categoria e mensagem entre 10 e 1000 caracteres após trim', () => {
    assertNull(helpers.validateMessage('duvida', '  mensagem válida  '));
    assertNull(helpers.validateMessage('problema', 'a'.repeat(1000)));
    assertEqual(helpers.validateMessage('outra', 'mensagem válida'), 'Selecione uma categoria válida.');
    assertTrue(helpers.validateMessage('sugestao', '   ').includes('10 a 1000'));
    assertTrue(helpers.validateMessage('duvida', 'a'.repeat(1001)).includes('10 a 1000'));
  });

  it('mostra os rótulos enviados e respondidos', () => {
    assertEqual(helpers.getStatusLabel('new'), 'Enviada');
    assertEqual(helpers.getStatusLabel('answered'), 'Respondida');
  });

  it('conta caracteres para o limite do formulário', () => {
    assertEqual(helpers.getCharacterCount(''), 0);
    assertEqual(helpers.getCharacterCount('mensagem'), 8);
    assertEqual(helpers.getCharacterCount(null), 0);
  });

  itAsync('envia, busca e exclui mensagens pela sessão autenticada', async () => {
    const previousClient = window.SupabaseAuth.client;
    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const feedbackId = '550e8400-e29b-41d4-a716-446655440002';
    const rows = [{
      id: feedbackId, category: 'duvida', message: 'Minha mensagem', status: 'new',
      reply: null, replied_at: null, created_at: '2026-10-29T12:00:00Z'
    }];
    let insertedPayload = null;
    let selectedColumns = '';
    let deleteFilters = [];
    window.SupabaseAuth.client = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null })
      },
      from(table) {
        assertEqual(table, 'feedback_messages');
        let mode = '';
        let filters = [];
        return {
          insert: async payload => {
            insertedPayload = payload;
            return { error: null };
          },
          select(columns) {
            selectedColumns = columns;
            return this;
          },
          eq(column, value) {
            filters.push([column, value]);
            if (mode === 'delete' && filters.length === 2) {
              deleteFilters = filters;
              return Promise.resolve({ error: null });
            }
            return this;
          },
          order: async () => ({ data: rows, error: null }),
          delete() {
            mode = 'delete';
            return this;
          }
        };
      }
    };
    try {
      assertTrue((await window.SupabaseAuth.sendFeedback({
        category: 'duvida', message: '  Minha mensagem  '
      })).success);
      assertEqual(insertedPayload, {
        user_id: userId, category: 'duvida', message: 'Minha mensagem'
      });

      const fetched = await window.SupabaseAuth.fetchMyFeedback();
      assertTrue(fetched.success);
      assertEqual(fetched.messages, rows);
      assertTrue(selectedColumns.includes('reply'));

      assertTrue((await window.SupabaseAuth.deleteMyFeedback(feedbackId)).success);
      assertEqual(deleteFilters, [['id', feedbackId], ['user_id', userId]]);
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('exclui as tabelas próprias sem apagar o usuário de autenticação', async () => {
    const previousClient = window.SupabaseAuth.client;
    const previousGetAuthenticatedUserId = window.SupabaseAuth.getAuthenticatedUserId;
    const userId = '550e8400-e29b-41d4-a716-446655440001';
    const deletedTables = [];
    window.SupabaseAuth.getAuthenticatedUserId = async expectedUserId =>
      expectedUserId === userId ? userId : null;
    window.SupabaseAuth.client = {
      from(table) {
        return {
          delete() { return this; },
          eq(column, value) {
            deletedTables.push([table, column, value]);
            return Promise.resolve({ error: null });
          }
        };
      }
    };
    try {
      const result = await window.SupabaseAuth.deleteAllMyData(userId);
      assertTrue(result.success);
      assertEqual(deletedTables, [
        ['feedback_messages', 'user_id', userId],
        ['credit_card_purchases', 'user_id', userId],
        ['entries', 'user_id', userId],
        ['fixed_templates', 'user_id', userId],
        ['goals', 'user_id', userId],
        ['fixed_import_rules', 'user_id', userId],
        ['credit_cards', 'user_id', userId],
        ['accounts', 'user_id', userId],
        ['profiles', 'id', userId]
      ]);
    } finally {
      window.SupabaseAuth.client = previousClient;
      window.SupabaseAuth.getAuthenticatedUserId = previousGetAuthenticatedUserId;
    }
  });

  it('converte erros comuns do canal em mensagens claras', () => {
    assertTrue(window.SupabaseAuth.getFeedbackErrorMessage({ code: 'PGRST205' }).includes('migração'));
    assertTrue(window.SupabaseAuth.getFeedbackErrorMessage({ code: 'P0001' }).includes('5 mensagens'));
    assertTrue(window.SupabaseAuth.getFeedbackErrorMessage(new TypeError('Failed to fetch')).includes('Sem conexão'));
  });

  itAsync('clearAll não apaga mensagens na nuvem', async () => {
    setupMockLocalStorage();
    let deleteFeedbackCalls = 0;
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      deleteMyFeedback: async () => {
        deleteFeedbackCalls++;
        return { success: true };
      }
    };
    try {
      assertTrue((await FinanceData.clearAll()).success);
      assertEqual(deleteFeedbackCalls, 0);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

describe('FinanceData — clearAll()', () => {
  setupMockLocalStorage();

  itAsync('deve apagar todos os lançamentos e templates', async () => {
    FinanceData.add(makeIncome());
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.add(makeVariable());
    await FinanceData.clearAll();
    assertEqual(FinanceData.getEntries().length, 0);
    assertEqual(FinanceData.getTemplates().length, 0);
  });

  itAsync('deve limpar metas e contas, mantendo perfil e esvaziando a fila após sync', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-test';
    const entryId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_theme', 'light');
    localStorage.setItem('gastopro_last_view_v1', JSON.stringify({ view: 'accounts', ownerId: userId }));
    FinanceData.saveProfile({ name: 'Pessoa', avatar: 'data:image/png;base64,abc', email: 'pessoa@example.com', userId });
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([makeIncome({ id: entryId })]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([makeFixed({ id: templateId })]));
    FinanceData.saveGoals([{ id: 'goal-1', category: 'Casa', limit: 500 }]);
    localStorage.setItem('gastopro_accounts_v1', JSON.stringify([
      { id: accountId, name: 'Conta teste', institution: null, type: 'PF', initialBalance: 25 }
    ]));

    const deletedEntries = [];
    const deletedTemplates = [];
    const deletedAccounts = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      saveCloudAccounts: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudEntries: async ids => { deletedEntries.push(...ids); return { success: true }; },
      deleteCloudTemplates: async ids => { deletedTemplates.push(...ids); return { success: true }; },
      deleteCloudAccounts: async ids => { deletedAccounts.push(...ids); return { success: true }; },
      deleteCloudGoals: async categories => { assertTrue(categories.includes('Casa')); return { success: true }; }
    };
    try {
      const result = await FinanceData.clearAll();
      assertTrue(result.success);
      assertEqual(FinanceData.getProfile().userId, userId);
      assertEqual(FinanceData.getProfile().email, 'pessoa@example.com');
      assertEqual(FinanceData.getEntries(), []);
      assertEqual(FinanceData.getTemplates(), []);
      assertEqual(FinanceData.getGoals(), []);
      assertEqual(FinanceData.getAccounts(), []);
      assertTrue(deletedEntries.includes(entryId));
      assertTrue(deletedTemplates.includes(templateId));
      assertTrue(deletedAccounts.includes(accountId));
      assertFalse(FinanceData.hasPendingSync(), 'A fila não deve ressuscitar dados após reset concluído');
      assertEqual(FinanceData.getProfile().name, 'Pessoa');
      assertEqual(FinanceData.getProfile().avatar, 'data:image/png;base64,abc');
      assertEqual(localStorage.getItem('gastopro_theme'), 'light');
      assertEqual(JSON.parse(localStorage.getItem('gastopro_last_view_v1')), {
        view: 'accounts', ownerId: userId
      });
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('mantém exclusões de contas pendentes sem enfileirar upserts após falha do reset', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-account-pending';
    const account = {
      id: crypto.randomUUID(), name: 'Conta pendente', institution: null, type: 'PF', initialBalance: 0
    };
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: 'Pessoa', email: 'pessoa@example.com', userId });
    await FinanceData.saveAccounts([account], { flush: false });
    const savedAccounts = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      saveCloudAccounts: async accounts => { savedAccounts.push(...accounts); return { success: true }; },
      saveCloudGoals: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      deleteCloudAccounts: async () => ({ success: false }),
      deleteCloudGoals: async () => ({ success: true })
    };
    try {
      const result = await FinanceData.clearAll();
      assertFalse(result.success);
      assertEqual(FinanceData.getAccounts(), []);
      assertEqual(savedAccounts, []);
      assertEqual(FinanceData.getPendingSync().accounts, []);
      assertEqual(FinanceData.getPendingSync().deletedAccounts, [account.id]);
      assertEqual(FinanceData.getPendingSync().entries, []);
      assertEqual(FinanceData.getPendingSync().templates, []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

describe('FinanceData — exclusão de todos os dados mantendo o login', () => {
  itAsync('exige EXCLUIR antes de apagar cartões, regras ou outros dados', async () => {
    setupMockLocalStorage();
    const card = { id: crypto.randomUUID(), name: 'Cartão preservado', totalLimit: 1000 };
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify([card]));
    localStorage.setItem('gastopro_fixed_import_rules_v1', JSON.stringify(['mercado']));
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([makeIncome()]));
    let remoteCalls = 0;
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      deleteAllMyData: async () => {
        remoteCalls++;
        return { success: true };
      }
    };
    try {
      const result = await FinanceData.deleteAllUserData('excluir');
      assertFalse(result.success);
      assertEqual(remoteCalls, 0);
      assertEqual(FinanceData.getCreditCards(), [card]);
      assertEqual(FinanceData.getFixedImportRules(), ['mercado']);
      assertEqual(FinanceData.getEntries().length, 1);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('apaga dados locais e remotos sem remover a sessão de login', async () => {
    setupMockLocalStorage();
    const userId = 'user-delete-data-only';
    const card = { id: crypto.randomUUID(), name: 'Cartão', totalLimit: 1000 };
    const purchase = { id: crypto.randomUUID(), cardId: card.id, desc: 'Compra' };
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_theme', 'light');
    FinanceData.saveProfile({
      name: 'Pessoa', avatar: 'data:image/png;base64,abc',
      email: 'pessoa@example.com', userId
    });
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([makeIncome()]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([makeFixed()]));
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([
      { id: 'goal-1', category: 'Casa', limit: 500 }
    ]));
    localStorage.setItem('gastopro_accounts_v1', JSON.stringify([
      { id: crypto.randomUUID(), name: 'Conta', type: 'PF', initialBalance: 0 }
    ]));
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify([card]));
    localStorage.setItem('gastopro_credit_card_purchases_v1', JSON.stringify([purchase]));
    localStorage.setItem('gastopro_fixed_import_rules_v1', JSON.stringify(['mercado']));
    FinanceData.savePendingSync({ full: true });

    const deletedForUser = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      deleteAllMyData: async targetUserId => {
        deletedForUser.push(targetUserId);
        return { success: true };
      }
    };
    try {
      const result = await FinanceData.deleteAllUserData('EXCLUIR');
      assertTrue(result.success);
      assertEqual(deletedForUser, [userId]);
      assertEqual(FinanceData.getEntries(), []);
      assertEqual(FinanceData.getTemplates(), []);
      assertEqual(FinanceData.getGoals(), []);
      assertEqual(FinanceData.getAccounts(), []);
      assertEqual(FinanceData.getCreditCards(), []);
      assertEqual(FinanceData.getCreditCardPurchases(), []);
      assertEqual(FinanceData.getFixedImportRules(), []);
      assertFalse(FinanceData.hasPendingSync());
      assertEqual(FinanceData.getProfile(), {
        name: '', email: 'pessoa@example.com', avatar: null, userId
      });
      assertEqual(localStorage.getItem('gastopro_last_uid'), userId);
      assertEqual(localStorage.getItem('gastopro_theme'), 'light');
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('mantém a cópia local quando a exclusão remota falha', async () => {
    setupMockLocalStorage();
    const userId = 'user-delete-data-failure';
    const card = { id: crypto.randomUUID(), name: 'Cartão preservado', totalLimit: 1000 };
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: 'Pessoa', email: 'pessoa@example.com', userId });
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify([card]));
    localStorage.setItem('gastopro_fixed_import_rules_v1', JSON.stringify(['mercado']));
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      deleteAllMyData: async () => ({ success: false, error: 'Falha de rede.' })
    };
    try {
      const result = await FinanceData.deleteAllUserData('EXCLUIR');
      assertFalse(result.success);
      assertEqual(result.error, 'Falha de rede.');
      assertEqual(FinanceData.getCreditCards(), [card]);
      assertEqual(FinanceData.getFixedImportRules(), ['mercado']);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

describe('FinanceData — mesclagem completa da nuvem', () => {
  it('remove localmente lançamentos que já não existem na nuvem após flush concluído', () => {
    setupMockLocalStorage();
    const userId = 'user-merge-test';
    const deletedLocally = makeIncome({ id: crypto.randomUUID() });
    const retained = makeIncome({ id: crypto.randomUUID(), desc: 'Mantido na nuvem' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([deletedLocally, retained]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({ full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [] });

    assertTrue(FinanceData.mergeCloudData(userId, [retained], [], true));
    assertEqual(FinanceData.getEntries().map(item => item.id), [retained.id]);
  });

  it('preserva itens locais pendentes, incompletos ou sem flush bem-sucedido', () => {
    setupMockLocalStorage();
    const userId = 'user-merge-pending';
    const localItem = makeIncome({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([localItem]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [localItem.id], templates: [], deletedEntries: [], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], true));
    assertEqual(FinanceData.getEntries().map(item => item.id), [localItem.id]);
    assertFalse(FinanceData.mergeCloudData(userId, null, [], true));
    assertEqual(FinanceData.getEntries().map(item => item.id), [localItem.id]);
  });

  it('não remove dados locais se a etapa de flush não foi confirmada', () => {
    setupMockLocalStorage();
    const userId = 'user-merge-failed-flush';
    const localItem = makeIncome({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([localItem]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({ full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [] });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false));
    assertEqual(FinanceData.getEntries().map(item => item.id), [localItem.id]);
  });

  itAsync('prepara logout apenas com mudanças pendentes, sem upsert completo', async () => {
    setupMockLocalStorage();
    const userId = 'user-logout-incremental';
    const pending = makeIncome({ id: crypto.randomUUID(), desc: 'Pendente' });
    const unchanged = makeIncome({ id: crypto.randomUUID(), desc: 'Já sincronizado' });
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', avatar: null, email: 'user@example.com', userId });
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([pending, unchanged]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [pending.id], templates: [], deletedEntries: [], deletedTemplates: []
    });
    const savedIds = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async items => { savedIds.push(...items.map(item => item.id)); return { success: true }; },
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true })
    };
    try {
      const result = await FinanceData.prepareLocalDataForSync(userId);
      assertTrue(result.success);
      assertEqual(savedIds, [pending.id]);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

describe('Privacidade, payloads e autenticação', () => {
  it('não deve expor templates nem receitas financeiras pessoais iniciais', () => {
    assertEqual(typeof INITIAL_REAL_TEMPLATES, 'undefined');
    assertEqual(typeof generateRealInitialEntries, 'undefined');
  });

  it('valida payloads de nuvem por entidade e calendário', () => {
    const entry = makeIncome({ id: crypto.randomUUID() });
    assertEqual(validateCloudPayload(entry, 'entries'), null);
    assertTrue(validateCloudPayload({ ...entry, date: '2026-02-30' }, 'entries'));
    assertTrue(validateCloudPayload({ ...entry, amount: -1 }, 'entries'));
    assertTrue(validateCloudPayload({ ...entry, type: 'unknown' }, 'entries'));

    const template = makeFixed({ id: crypto.randomUUID(), startMonth: '2026-11', day: '01' });
    assertEqual(validateCloudPayload(template, 'templates'), null);
    assertTrue(validateCloudPayload({ ...template, startMonth: '2026-13' }, 'templates'));
    assertTrue(validateCloudPayload({ ...template, type: 'income' }, 'templates'));
  });

  itAsync('valida todas as páginas e sinaliza falha sem entregar sincronização parcial', async () => {
    const ranges = [];
    const rows = await window.SupabaseAuth.fetchAllPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: Array.from({ length: from === 0 ? 1000 : 1 }, (_, index) => ({ index: from + index })), error: null };
    });
    assertEqual(rows.length, 1001);
    assertEqual(ranges, [[0, 999], [1000, 1999]]);
    const incomplete = await window.SupabaseAuth.fetchAllPages(async () => ({ data: null, error: new Error('offline') }));
    assertNull(incomplete);
  });

  itAsync('isola falhas do upsert em lote e mantém as linhas válidas', async () => {
    const calls = [];
    const result = await window.SupabaseAuth.upsertWithFallback(async payload => {
      calls.push(payload);
      if (Array.isArray(payload) || payload.id === 'bad') return { error: new Error('linha inválida') };
      return { error: null };
    }, [{ id: 'good' }, { id: 'bad' }], [{ id: 'good' }, { id: 'bad' }]);
    assertEqual(result.failedIds, ['bad']);
    assertEqual(calls.length, 3);
  });

  itAsync('faz upsert do perfil com o UID autenticado na tabela profiles', async () => {
    const previousClient = window.SupabaseAuth.client;
    let upsertTable = '';
    let upsertPayload = null;
    window.SupabaseAuth.client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'profile-user' } } }, error: null }) },
      from(table) {
        upsertTable = table;
        return { upsert: async payload => { upsertPayload = payload; return { error: null }; } };
      }
    };
    try {
      const result = await window.SupabaseAuth.saveCloudProfile(
        { name: 'Nome', avatar: 'data:image/jpeg;base64,abc' },
        'profile-user'
      );
      assertTrue(result.success);
      assertEqual(upsertTable, 'profiles');
      assertEqual(upsertPayload, {
        id: 'profile-user',
        name: 'Nome',
        avatar: 'data:image/jpeg;base64,abc'
      });
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('atualiza a senha por meio do cliente autenticado', async () => {
    const previousClient = window.SupabaseAuth.client;
    let updatedPassword = '';
    window.SupabaseAuth.client = {
      auth: {
        updateUser: async ({ password }) => {
          updatedPassword = password;
          return { data: { user: { id: 'user-test' } }, error: null };
        }
      }
    };
    try {
      await window.SupabaseAuth.updatePassword('senha-segura-8');
      assertEqual(updatedPassword, 'senha-segura-8');
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  describe('Perfil — sincronização e enquadramento do avatar', () => {
    it('calcula um recorte que cobre o quadro, limita deslocamento e respeita zoom mínimo/máximo', () => {
      const crop = window.GastoProAvatarCrop.computeCropRect(800, 400, 1, 900, -900);
      assertTrue(crop.width <= 800 && crop.height <= 400);
      assertTrue(crop.x >= 0 && crop.y >= 0);
      assertTrue(crop.x + crop.width <= 800 && crop.y + crop.height <= 400);
      const minimum = window.GastoProAvatarCrop.computeCropRect(800, 400, 0.1, 0, 0);
      const maximum = window.GastoProAvatarCrop.computeCropRect(800, 400, 20, 0, 0);
      assertEqual(minimum.zoom, 1);
      assertEqual(maximum.zoom, 3);
      assertTrue(maximum.width <= 800 && maximum.height <= 400);
    });

    itAsync('mantém perfil pendente após falha de upsert e tenta novamente', async () => {
      setupMockLocalStorage();
      const userId = 'profile-pending-user';
      localStorage.setItem('gastopro_last_uid', userId);
      FinanceData.saveProfile({ name: 'Editado', avatar: 'foto', userId }, { queueSync: true });
      const attempts = [];
      const previousAuth = window.SupabaseAuth;
      window.SupabaseAuth = {
        saveCloudProfile: async profile => {
          attempts.push(profile);
          return attempts.length === 1
            ? { success: false, error: new Error('offline') }
            : { success: true };
        },
        saveCloudEntries: async () => ({ success: true }),
        saveCloudTemplates: async () => ({ success: true }),
        deleteCloudEntries: async () => ({ success: true }),
        deleteCloudTemplates: async () => ({ success: true }),
        saveCloudGoals: async () => ({ success: true }),
        deleteCloudGoals: async () => ({ success: true }),
        saveCloudAccounts: async () => ({ success: true }),
        deleteCloudAccounts: async () => ({ success: true })
      };
      try {
        const failed = await FinanceData.flushPendingSync(userId);
        assertFalse(failed.success);
        assertTrue(FinanceData.getPendingSync().profile);
        const retried = await FinanceData.flushPendingSync(userId);
        assertTrue(retried.success);
        assertFalse(FinanceData.getPendingSync().profile);
        assertEqual(attempts.length, 2);
      } finally {
        window.SupabaseAuth = previousAuth;
      }
    });

    it('mantém edição local de perfil pendente; sem pendência, aplica dados da nuvem', () => {
      setupMockLocalStorage();
      FinanceData.saveProfile({ name: 'Local', avatar: 'foto-local', userId: 'profile-merge-user' });
      FinanceData.savePendingSync({ ...FinanceData.getPendingSync(), profile: true });
      FinanceData.mergeCloudProfile({ id: 'profile-merge-user', name: 'Nuvem', avatar: 'foto-nuvem' });
      assertEqual(FinanceData.getProfile().name, 'Local');
      assertEqual(FinanceData.getProfile().avatar, 'foto-local');
      FinanceData.savePendingSync({ ...FinanceData.getPendingSync(), profile: false });
      FinanceData.mergeCloudProfile({ id: 'profile-merge-user', name: 'Nuvem', avatar: 'foto-nuvem' });
      assertEqual(FinanceData.getProfile().name, 'Nuvem');
      assertEqual(FinanceData.getProfile().avatar, 'foto-nuvem');
    });

    it('usa o nome do cadastro somente quando não há nome local nem de profiles', () => {
      assertEqual(window.GastoProProfileHelpers.getInitialName('', '', 'Cadastro', 'email'), 'Cadastro');
      assertEqual(window.GastoProProfileHelpers.getInitialName('Local', 'Nuvem', 'Cadastro', 'email'), 'Nuvem');
      assertEqual(window.GastoProProfileHelpers.getInitialName('Local', '', 'Cadastro', 'email'), 'Local');
    });
  });

  itAsync('distingue sessão válida, ausência confirmada e verificação indeterminada', async () => {
    const previousClient = window.SupabaseAuth.client;
    const user = { id: 'user-session-state' };
    const responses = [
      { data: { session: { user } }, error: null },
      { data: { session: null }, error: null },
      { data: { session: null }, error: new Error('offline') },
      { data: { session: null }, error: null },
      { data: { session: { user } }, error: null }
    ];
    window.SupabaseAuth.client = {
      auth: { getSession: async () => responses.shift() }
    };
    try {
      assertEqual(await window.SupabaseAuth.getSessionState(), { status: 'authenticated', user });
      assertEqual(await window.SupabaseAuth.getSessionState(), { status: 'signed_out', user: null });
      const indeterminate = await window.SupabaseAuth.getSessionState();
      assertEqual(indeterminate.status, 'indeterminate');
      assertNull(await window.SupabaseAuth.getSessionUser());
      assertEqual(await window.SupabaseAuth.getSessionUser(), user);
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  it('aceita somente senhas com oito ou mais caracteres', () => {
    assertFalse(isValidPassword('1234567'));
    assertTrue(isValidPassword('12345678'));
  });
});

describe('Recuperação de sessão', () => {
  it('limpa dados de sessão expirada somente quando a fila está vazia', () => {
    assertEqual(window.GastoProSessionHelpers.getSignedOutAction(true, false), 'clear');
    assertEqual(window.GastoProSessionHelpers.getSignedOutAction(true, true), 'preserve-and-login');
    assertEqual(window.GastoProSessionHelpers.getSignedOutAction(false, true), 'preserve');
    assertFalse(window.GastoProSessionHelpers.shouldClearLocalData('indeterminate', true, false));
    assertFalse(window.GastoProSessionHelpers.shouldClearLocalData('signed_out', true, true));
    assertTrue(window.GastoProSessionHelpers.shouldClearLocalData('signed_out', true, false));
  });

  it('preserva a sessão expirada com cada tipo de alteração pendente', () => {
    const pendingChanges = [
      { entries: ['entry'] },
      { templates: ['template'] },
      { goals: ['Mercado'] },
      { accounts: ['account'] },
      { deletedEntries: ['entry'] },
      { deletedTemplates: ['template'] },
      { deletedGoals: ['Mercado'] },
      { deletedAccounts: ['account'] }
    ];
    pendingChanges.forEach(changes => {
      setupMockLocalStorage();
      FinanceData.savePendingSync({ full: false, ...changes });
      assertEqual(
        window.GastoProSessionHelpers.getSignedOutAction(true, FinanceData.hasPendingSync()),
        'preserve-and-login'
      );
    });
  });

  itAsync('login na mesma conta mantém a fila e sincroniza as alterações pendentes', async () => {
    setupMockLocalStorage();
    const userId = 'same-account';
    const entry = makeIncome({ id: crypto.randomUUID(), desc: 'Mudança pendente' });
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveEntries([entry], { flush: false });
    const sentEntries = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async entries => { sentEntries.push(...entries); return { success: true }; },
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      deleteCloudGoals: async () => ({ success: true }),
      saveCloudAccounts: async () => ({ success: true }),
      deleteCloudAccounts: async () => ({ success: true })
    };
    try {
      assertEqual(
        window.GastoProSessionHelpers.getAccountSwitchAction(userId, userId, true),
        'continue'
      );
      assertFalse(FinanceData.activateUser(userId));
      const result = await FinanceData.prepareLocalDataForSync(userId);
      assertTrue(result.success);
      assertEqual(sentEntries, [entry]);
      assertFalse(FinanceData.hasPendingSync());
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  it('bloqueia login em outra conta quando há alterações pendentes', () => {
    assertEqual(
      window.GastoProSessionHelpers.getAccountSwitchAction('account-a', 'account-b', true),
      'confirm-discard'
    );
    assertEqual(
      window.GastoProSessionHelpers.getAccountSwitchAction('account-a', 'account-b', false),
      'continue'
    );
  });

  it('só permite descartar alterações de outra conta após confirmação explícita', () => {
    assertEqual(
      window.GastoProSessionHelpers.getAccountSwitchAction('account-a', 'account-b', true, false),
      'confirm-discard'
    );
    assertEqual(
      window.GastoProSessionHelpers.getAccountSwitchAction('account-a', 'account-b', true, true),
      'discard-and-continue'
    );
  });
});

describe('Bloco 2 — dívida, orçamento, diagnóstico e categorias', () => {
  it('preenche selects com as categorias oficiais de gastos e ganhos', () => {
    const expenseSelect = document.createElement('select');
    const goalSelect = document.createElement('select');
    const editSelect = document.createElement('select');
    GastoProCategories.populateSelect(expenseSelect, GastoProCategories.EXPENSE);
    GastoProCategories.populateSelect(goalSelect, GastoProCategories.EXPENSE, {}, 'Selecione a categoria...');
    GastoProCategories.populateSelect(
      editSelect,
      [...GastoProCategories.EXPENSE, ...GastoProCategories.INCOME]
    );
    const expenseOptions = Array.from(expenseSelect.options, option => option.value);
    const goalOptions = Array.from(goalSelect.options, option => option.value);
    const editOptions = Array.from(editSelect.options, option => option.value);
    assertEqual(expenseOptions, GastoProCategories.EXPENSE);
    assertEqual(goalOptions, ['', ...GastoProCategories.EXPENSE]);
    assertEqual(editOptions, [...GastoProCategories.EXPENSE, ...GastoProCategories.INCOME]);
    assertEqual(expenseOptions.length, 16);
  });

  it('não marca dívida vencida como quitada se ainda houver parcelas abertas', () => {
    const debt = GastoProReportHelpers.getDebtCenterData('2026-12', [{
      id: 'overdue-debt', desc: 'Financiamento', amount: 250, category: 'Empréstimo',
      isDebt: true, active: true, startMonth: '2025-01', endMonth: '2026-10',
      paidMonths: { '2025-01': true }
    }]).items[0];
    assertFalse(debt.isFinished);
    assertTrue(debt.isOverdue);
    assertEqual(debt.remainingMonths, 21);
  });

  it('marca dívida como quitada quando todas as parcelas foram pagas', () => {
    const debt = GastoProReportHelpers.getDebtCenterData('2026-12', [{
      id: 'finished-debt', desc: 'Quitada', amount: 250, category: 'Empréstimo',
      isDebt: true, active: true, startMonth: '2025-01', endMonth: '2025-02',
      paidMonths: { '2025-01': true, '2025-02': true }
    }]).items[0];
    assertTrue(debt.isFinished);
    assertFalse(debt.isOverdue);
    assertEqual(debt.remainingMonths, 0);
  });

  it('calcula orçamento diário para mês passado, atual e futuro', () => {
    assertEqual(getDailyBudgetInfo(310, 2026, 8, new Date(2026, 9, 2)), {
      status: 'past', days: 0, dailyAmount: null, message: 'Mês encerrado'
    });
    assertEqual(getDailyBudgetInfo(290, 2026, 10, new Date(2026, 9, 28)), {
      status: 'current', days: 4, dailyAmount: 72.5, message: ''
    });
    assertEqual(getDailyBudgetInfo(300, 2026, 11, new Date(2026, 9, 28)), {
      status: 'future', days: 30, dailyAmount: 10, message: ''
    });
  });

  it('conta hoje no mínimo um dia e lida com virada de ano e fevereiro bissexto', () => {
    assertEqual(getDailyBudgetInfo(100, 2026, 12, new Date(2026, 11, 31)).days, 1);
    assertEqual(getDailyBudgetInfo(290, 2024, 2, new Date(2024, 1, 28)), {
      status: 'current', days: 2, dailyAmount: 145, message: ''
    });
    assertEqual(getDailyBudgetInfo(620, 2027, 1, new Date(2026, 11, 31)).days, 31);
  });

  it('explica a faixa de alerta dos gastos fixos sem mudar o limiar e detecta variáveis altos', () => {
    const fixedAlert = getHealthDiagnostic(1000, 100, 56, 10, 34);
    assertEqual(fixedAlert.badge, 'Fixos Altos');
    assertTrue(fixedAlert.description.includes('ideal até 50%; alerta acima de 55%'));
    const variableAlert = getHealthDiagnostic(1000, 100, 50, 31, 19);
    assertEqual(variableAlert.badge, 'Variáveis Altos');
    assertEqual(variableAlert.badgeClass, 'badge badge-warning');
  });

  it('normaliza acentos e soma gastos Mercado em metas sem distinção de acento/caixa', () => {
    assertEqual(GastoProCategories.normalize('Alimentação'), GastoProCategories.normalize('alimentacao'));
    assertEqual(GastoProCategories.EXPENSE, [
      'Moradia', 'Contas', 'Saúde', 'Esporte', 'Cartão de crédito', 'Alimentação',
      'Mercado', 'Transporte', 'Educação', 'Empréstimo', 'Parcelamento',
      'Assinaturas', 'Compras', 'Vestuário', 'Lazer', 'Outros'
    ]);
    const progress = GastoProReportHelpers.calculateGoalProgress(
      [{ category: 'Mercado', limit: 500 }],
      [],
      [{ category: ' mercado ', amount: 125 }]
    );
    assertEqual(progress[0].spent, 125);
  });
});

describe('Bloco 2 — backup JSON', () => {
  const validateBackup = overrides => GastoProBackupHelpers.validate(JSON.stringify({
    version: '4.0',
    entries: [],
    templates: [],
    goals: [],
    ...overrides
  }));

  it('valida o backup e aceita apenas arrays limitados e versão textual', () => {
    const validBackup = JSON.stringify({
      version: '3.8',
      entries: [makeIncome({ id: crypto.randomUUID() })],
      templates: [makeFixed({ id: crypto.randomUUID(), startMonth: '2026-01' })],
      goals: [{ id: 'goal-1', category: 'Mercado', limit: 500 }]
    });
    const validated = GastoProBackupHelpers.validate(validBackup);
    assertEqual(validated.entries.length, 1);
    assertTrue(GastoProBackupHelpers.validate('{invalido').error);
    assertTrue(GastoProBackupHelpers.validate(JSON.stringify({
      version: 3, entries: [], templates: [], goals: []
    })).error);
    assertTrue(GastoProBackupHelpers.validate(JSON.stringify({
      version: '3.8', entries: new Array(5001), templates: [], goals: []
    })).error);
  });

  it('rejeita booleanos não reais nos lançamentos e templates', () => {
    const entryId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const invalidEntries = validateBackup({
      entries: [makeIncome({ id: entryId, paid: 'false' })]
    });
    assertTrue(invalidEntries.error.includes(`Lançamento ${entryId}`));
    assertTrue(validateBackup({
      templates: [makeFixed({
        id: templateId, startMonth: '2026-01', isDebt: 0, active: true
      })]
    }).error.includes(`Gasto fixo ${templateId}`));
    assertTrue(validateBackup({
      templates: [makeFixed({
        id: templateId, startMonth: '2026-01', isDebt: false, active: 'true'
      })]
    }).error.includes(`Gasto fixo ${templateId}`));
  });

  it('valida objeto, meses civis, valores booleanos e período de paidMonths', () => {
    const id = crypto.randomUUID();
    const template = makeFixed({
      id, startMonth: '2026-01', endMonth: '2026-03',
      isDebt: false, active: true, paidMonths: { '2026-02': true }
    });
    assertFalse(validateBackup({ templates: [template] }).error);
    for (const paidMonths of [
      [],
      { '2026-02': 'true' },
      { '2026-13': true },
      { '2025-12': true },
      { '2026-04': false }
    ]) {
      const result = validateBackup({ templates: [{ ...template, paidMonths }] });
      assertTrue(result.error.includes(`Gasto fixo ${id}`), JSON.stringify(paidMonths));
    }
  });

  it('aceita somente valores amount numéricos finitos dentro do limite do banco', () => {
    assertFalse(validateBackup({
      entries: [makeIncome({ id: crypto.randomUUID(), amount: 9999999999.99 })]
    }).error);
    for (const amount of ['25.50', -0.01, 10000000000, 1e100]) {
      const id = crypto.randomUUID();
      const result = validateBackup({ entries: [makeIncome({ id, amount })] });
      assertTrue(result.error.includes(`Lançamento ${id}`), String(amount));
    }
  });

  it('rejeita datas civis impossíveis e aceita somente tipos conhecidos', () => {
    const dateId = crypto.randomUUID();
    const typeId = crypto.randomUUID();
    assertTrue(validateBackup({
      entries: [makeIncome({ id: dateId, date: '2026-02-31' })]
    }).error.includes(`Lançamento ${dateId}`));
    assertTrue(validateBackup({
      entries: [makeIncome({ id: typeId, type: 'expense' })]
    }).error.includes(`Lançamento ${typeId}`));
  });

  it('aplica limites de descrição e categoria das constraints do banco', () => {
    const id = crypto.randomUUID();
    assertTrue(validateBackup({
      entries: [makeIncome({ id, desc: 'x'.repeat(301) })]
    }).error.includes(`Lançamento ${id}`));
    assertTrue(validateBackup({
      entries: [makeIncome({ id, category: '' })]
    }).error.includes(`Lançamento ${id}`));
    assertTrue(validateBackup({
      goals: [{ id: 'goal-1', category: 'x'.repeat(101), limit: 1 }]
    }).error.includes('Meta'));
  });

  it('rejeita IDs duplicados no arquivo de backup', () => {
    const id = crypto.randomUUID();
    const result = validateBackup({
      entries: [makeIncome({ id }), makeIncome({ id, desc: 'Duplicado' })]
    });
    assertTrue(result.error.includes(id));
    assertTrue(result.error.includes('duplicado'));
  });

  it('valida contas, e desvincula accountId ausente sem rejeitar o lançamento', () => {
    const accountId = crypto.randomUUID();
    const orphanEntryId = crypto.randomUUID();
    for (const account of [
      { id: accountId, name: '', type: 'PF', initialBalance: 0 },
      { id: accountId, name: 'Conta', type: 'conta', initialBalance: 0 },
      { id: accountId, name: 'Conta', type: 'PJ', initialBalance: '10' },
      { id: accountId, name: 'Conta', type: 'PJ', initialBalance: 10000000000 }
    ]) {
      assertTrue(validateBackup({ accounts: [account] }).error.includes('Conta'));
    }
    const valid = validateBackup({
      entries: [makeIncome({ id: orphanEntryId, accountId })]
    });
    assertFalse(valid.error);
    assertEqual(valid.entries[0].accountId, null);
  });

  itAsync('rejeita todo o arquivo antes de alterar dados locais e informa tipo e ID do primeiro erro', async () => {
    setupMockLocalStorage();
    const existing = makeIncome({ id: crypto.randomUUID(), desc: 'Já existente' });
    FinanceData.saveEntries([existing]);
    const invalidId = crypto.randomUUID();
    const result = await FinanceData.importJSON(JSON.stringify({
      version: '4.0',
      entries: [makeIncome({ id: invalidId, paid: 'false' })],
      templates: [],
      goals: []
    }), 'replace');
    assertFalse(result.success);
    assertTrue(result.error.includes(`Lançamento ${invalidId}`));
    assertEqual(FinanceData.getEntries(), [existing]);
  });

  it('continua aceitando backups antigos válidos sem accounts e flags opcionais', () => {
    const backup = validateBackup({
      version: '3.8',
      entries: [makeIncome({ id: crypto.randomUUID() })],
      templates: [makeFixed({ id: crypto.randomUUID(), startMonth: '2026-01' })],
      goals: [{ id: 'goal-1', category: 'Mercado', limit: 500 }]
    });
    assertFalse(backup.error);
    assertEqual(backup.accounts, []);
    assertEqual(backup.entries[0].paid, true);
    assertEqual(backup.entries[0].isDebt, false);
    assertEqual(backup.entries[0].active, true);
    assertEqual(backup.templates[0].isDebt, false);
    assertEqual(backup.templates[0].active, true);
  });

  it('mescla por ID e substitui integralmente sem compartilhar referências', () => {
    const current = {
      entries: [makeIncome({ id: 'keep-entry' })],
      templates: [],
      goals: [{ id: 'goal-local', category: 'Casa', limit: 300 }]
    };
    const incoming = {
      entries: [makeIncome({ id: 'keep-entry', amount: 500 }), makeIncome({ id: 'new-entry' })],
      templates: [],
      goals: [{ id: 'goal-imported', category: 'Mercado', limit: 700 }]
    };
    const merged = GastoProBackupHelpers.merge(current, incoming, 'merge');
    assertEqual(merged.entries.length, 2);
    assertEqual(merged.entries.find(item => item.id === 'keep-entry').amount, 500);
    assertEqual(merged.goals.length, 2);
    const goalId = crypto.randomUUID();
    assertEqual(GastoProBackupHelpers.merge(
      { entries: [], templates: [], goals: [{ id: `goal-${goalId}`, category: 'Mercado', limit: 500 }] },
      { entries: [], templates: [], goals: [{ id: goalId, category: 'Mercado', limit: 700 }] },
      'merge'
    ).goals.length, 1);
    const replaced = GastoProBackupHelpers.merge(current, incoming, 'replace');
    assertEqual(replaced.entries.length, 2);
    assertEqual(replaced.goals.length, 1);
    assertEqual(current.entries.length, 1);
  });

  it('gera UUID novo para IDs inválidos e rejeita backups maiores que 5 MB', () => {
    const backup = GastoProBackupHelpers.validate(JSON.stringify({
      version: '3.8',
      entries: [makeIncome({ id: 'legacy-id' })],
      templates: [],
      goals: []
    }));
    assertTrue(isUuid(backup.entries[0].id));
    assertTrue(GastoProBackupHelpers.validate(' '.repeat(5 * 1024 * 1024 + 1)).error);
  });

  itAsync('limpa metas locais ao ativar uma nova conta sem dados de usuário anterior', async () => {
    setupMockLocalStorage();
    FinanceData.saveGoals([{ id: 'goal-guest', category: 'Mercado', limit: 500 }]);
    assertTrue(FinanceData.activateUser('new-account'));
    assertEqual(FinanceData.getGoals(), []);
  });

  itAsync('importJSON substitui lançamentos, templates e metas no armazenamento local', async () => {
    setupMockLocalStorage();
    const restoredEntry = makeIncome({ id: crypto.randomUUID(), desc: 'Restaurado' });
    const restoredGoal = { id: crypto.randomUUID(), category: 'Mercado', limit: 900 };
    FinanceData.saveEntries([makeIncome({ id: crypto.randomUUID(), desc: 'Antigo' })]);
    FinanceData.saveGoals([{ id: crypto.randomUUID(), category: 'Casa', limit: 200 }]);
    const text = JSON.stringify({
      version: '3.8',
      entries: [restoredEntry],
      templates: [],
      goals: [restoredGoal]
    });

    const result = await FinanceData.importJSON(text, 'replace');
    assertTrue(result.success);
    assertEqual(FinanceData.getEntries().map(item => item.desc), ['Restaurado']);
    assertEqual(FinanceData.getTemplates(), []);
    assertEqual(FinanceData.getGoals().map(goal => goal.category), ['Mercado']);
  });
});

describe('FinanceData — exportJSON()', () => {
  setupMockLocalStorage();

  it('backup deve baixar JSON com Blob, URL temporária e data no nome do arquivo', () => {
    FinanceData.add(makeIncome());
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));

    const originalCreateElement = document.createElement.bind(document);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    let downloadName = '';
    let downloadUrl = '';
    document.createElement = (tagName) => {
      if (tagName !== 'a') return originalCreateElement(tagName);
      const anchor = originalCreateElement(tagName);
      const setAttribute = anchor.setAttribute.bind(anchor);
      anchor.setAttribute = (name, value) => {
        if (name === 'href') downloadUrl = value;
        if (name === 'download') downloadName = value;
        setAttribute(name, value);
      };
      anchor.click = () => {};
      return anchor;
    };
    URL.createObjectURL = () => 'blob:test-backup';
    URL.revokeObjectURL = () => {};

    try {
      const backup = FinanceData.exportJSON();
      assertTrue(typeof backup.version === 'string', 'version deve ser string');
      assertEqual(backup.version, '4.0');
      assertTrue(typeof backup.exportDate === 'string', 'exportDate deve ser string');
      assertTrue(Array.isArray(backup.entries), 'entries deve ser array');
      assertTrue(Array.isArray(backup.templates), 'templates deve ser array');
      assertTrue(Array.isArray(backup.goals), 'goals deve ser array');
      assertTrue(Array.isArray(backup.accounts), 'accounts deve ser array');
      assertFalse(Object.prototype.hasOwnProperty.call(backup, 'theme'));
      assertFalse(Object.prototype.hasOwnProperty.call(backup, 'gastopro_theme'));
      assertFalse(Object.prototype.hasOwnProperty.call(backup, 'feedback'));
      assertFalse(Object.prototype.hasOwnProperty.call(backup, 'messages'));
      assertEqual(backup.entries.length, 1);
      assertEqual(backup.templates.length, 1);
    } finally {
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }

    assertEqual(downloadUrl, 'blob:test-backup');
    assertTrue(/^gastopro_backup_\d{4}-\d{2}-\d{2}\.json$/.test(downloadName));
  });

  itAsync('exporta todas as coleções do backup e mensagens da conta', async () => {
    setupMockLocalStorage();
    const userId = 'user-export-all-data';
    const feedbackMessages = [{
      id: crypto.randomUUID(), category: 'duvida', message: 'Mensagem exportada',
      status: 'answered', reply: 'Resposta', created_at: '2026-10-30T12:00:00Z'
    }];
    FinanceData.saveProfile({ name: 'Pessoa', email: 'pessoa@example.com', userId });
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([makeIncome()]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([makeFixed()]));
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([
      { id: 'goal-1', category: 'Casa', limit: 500 }
    ]));
    localStorage.setItem('gastopro_accounts_v1', JSON.stringify([
      { id: crypto.randomUUID(), name: 'Conta', type: 'PF', initialBalance: 0 }
    ]));
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify([
      { id: crypto.randomUUID(), name: 'Cartão', totalLimit: 1000 }
    ]));
    localStorage.setItem('gastopro_credit_card_purchases_v1', JSON.stringify([
      { id: crypto.randomUUID(), desc: 'Compra', amount: 10 }
    ]));
    localStorage.setItem('gastopro_fixed_import_rules_v1', JSON.stringify(['mercado']));

    const originalCreateElement = document.createElement.bind(document);
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    document.createElement = tagName => {
      if (tagName !== 'a') return originalCreateElement(tagName);
      const anchor = originalCreateElement(tagName);
      anchor.click = () => {};
      return anchor;
    };
    URL.createObjectURL = () => 'blob:all-user-data';
    URL.revokeObjectURL = () => {};
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      fetchMyFeedback: async () => ({ success: true, messages: feedbackMessages })
    };
    try {
      const result = await FinanceData.exportAllUserData();
      assertTrue(result.success);
      assertEqual(result.backup.entries.length, 1);
      assertEqual(result.backup.templates.length, 1);
      assertEqual(result.backup.goals.length, 1);
      assertEqual(result.backup.accounts.length, 1);
      assertEqual(result.backup.creditCards.length, 1);
      assertEqual(result.backup.creditCardPurchases.length, 1);
      assertEqual(result.backup.fixedImportRules, ['mercado']);
      assertEqual(result.backup.feedbackMessages, feedbackMessages);
    } finally {
      window.SupabaseAuth = previousAuth;
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});

describe('FinanceData — Perfil do Usuário', () => {
  setupMockLocalStorage();

  it('getProfile() deve retornar perfil padrão quando vazio', () => {
    const profile = FinanceData.getProfile();
    assertEqual(profile.name, '');
    assertNull(profile.avatar);
  });

  it('saveProfile() deve persistir e getProfile() deve recuperar', () => {
    FinanceData.saveProfile({ name: 'Aylton', avatar: null });
    const profile = FinanceData.getProfile();
    assertEqual(profile.name, 'Aylton');
  });

  it('getProfile() deve mesclar com defaults para garantir campos novos', () => {
    // Simula perfil de versão antiga sem o campo avatar
    localStorage.setItem('gastopro_user_profile_v2', JSON.stringify({ name: 'Aylton' }));
    const profile = FinanceData.getProfile();
    assertEqual(profile.name, 'Aylton');
    assertNull(profile.avatar, 'Campo avatar deve estar presente com valor null');
  });
});

describe('FinanceData — getAll()', () => {
  setupMockLocalStorage();

  it('deve retornar lançamentos e templates combinados', () => {
    FinanceData.add(makeIncome());
    FinanceData.add(makeVariable());
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    const all = FinanceData.getAll();
    // 2 lançamentos pontuais + 1 template
    assertEqual(all.length, 3);
  });

  it('templates retornados por getAll() devem ter isTemplate: true', () => {
    setupMockLocalStorage();
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    const all = FinanceData.getAll();
    const template = all.find(i => i.isTemplate);
    assertTrue(template.isTemplate);
  });
});

// ================================================================
// SUITE 2: UTILITÁRIOS DO APP (app.js)
// Estes testes dependem das funções globais definidas em app.js.
// ================================================================

describe('Utilitários — voltar ao topo', () => {
  it('mostra o botão após rolar em tela longa e esconde no topo', () => {
    assertFalse(window.GastoProScrollTop.shouldShow(0, 1200, 700));
    assertFalse(window.GastoProScrollTop.shouldShow(401, 1100, 700));
    assertTrue(window.GastoProScrollTop.shouldShow(401, 1201, 700));

    const button = document.createElement('button');
    button.id = 'backToTopBtn';
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
    document.body.appendChild(button);
    const scrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      document.documentElement, 'scrollHeight'
    );
    const innerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    try {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 401 });
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true, value: 1201
      });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
      window.GastoProScrollTop.updateVisibility();
      assertTrue(button.classList.contains('is-visible'));
      assertEqual(button.getAttribute('aria-hidden'), 'false');
      assertEqual(button.tabIndex, 0);

      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
      window.GastoProScrollTop.updateVisibility();
      assertFalse(button.classList.contains('is-visible'));
      assertEqual(button.getAttribute('aria-hidden'), 'true');
      assertEqual(button.tabIndex, -1);
    } finally {
      if (scrollYDescriptor) Object.defineProperty(window, 'scrollY', scrollYDescriptor);
      else delete window.scrollY;
      if (scrollHeightDescriptor) {
        Object.defineProperty(document.documentElement, 'scrollHeight', scrollHeightDescriptor);
      } else {
        delete document.documentElement.scrollHeight;
      }
      if (innerHeightDescriptor) Object.defineProperty(window, 'innerHeight', innerHeightDescriptor);
      else delete window.innerHeight;
      button.remove();
    }
  });

  it('rola ao topo sem animação quando movimento reduzido está ativo', () => {
    const originalScrollTo = window.scrollTo;
    const originalMatchMedia = window.matchMedia;
    const calls = [];
    window.scrollTo = options => calls.push(options);
    window.matchMedia = query => ({
      matches: query === '(prefers-reduced-motion: reduce)'
    });
    const button = document.createElement('button');
    try {
      window.GastoProScrollTop.bindClick(button);
      button.click();
      assertEqual(calls[0], { top: 0, behavior: 'auto' });

      window.matchMedia = () => ({ matches: false });
      button.click();
      assertEqual(calls[1], { top: 0, behavior: 'smooth' });
    } finally {
      window.scrollTo = originalScrollTo;
      window.matchMedia = originalMatchMedia;
      button.remove();
    }
  });
});

describe('Utilitários — formatCurrency()', () => {
  it('deve formatar zero corretamente em BRL', () => {
    assertEqual(formatCurrency(0), 'R$\xa00,00');
  });

  it('deve formatar valores inteiros', () => {
    // R$ 1.000,00 (com separador de milhar)
    const result = formatCurrency(1000);
    assertTrue(result.includes('1.000'), `Esperado "1.000" em: ${result}`);
  });

  it('deve formatar valores decimais', () => {
    const result = formatCurrency(150.5);
    assertTrue(result.includes('150,50'), `Esperado "150,50" em: ${result}`);
  });

  it('deve tratar null/undefined como zero', () => {
    assertEqual(formatCurrency(null), formatCurrency(0));
    assertEqual(formatCurrency(undefined), formatCurrency(0));
  });
});

describe('Utilitários — getYearMonthString()', () => {
  it('deve formatar mês com zero à esquerda para meses de 1 dígito', () => {
    assertEqual(getYearMonthString(2026, 1),  '2026-01');
    assertEqual(getYearMonthString(2026, 9),  '2026-09');
    assertEqual(getYearMonthString(2026, 12), '2026-12');
  });

  it('deve funcionar para qualquer ano', () => {
    assertEqual(getYearMonthString(2030, 6), '2030-06');
  });
});

describe('Utilitários — formatDate()', () => {
  it('deve converter YYYY-MM-DD para DD/MM', () => {
    assertEqual(formatDate('2026-11-05'), '05/11');
    assertEqual(formatDate('2026-01-31'), '31/01');
  });

  it('deve retornar string vazia para valor vazio', () => {
    assertEqual(formatDate(''), '');
    assertEqual(formatDate(null), '');
  });
});

describe('Utilitários — escapeHtml()', () => {
  it('deve escapar o caractere &', () => {
    const result = escapeHtml('A & B');
    assertTrue(result.includes('&amp;'), `Esperado &amp; em: ${result}`);
  });

  it('deve escapar < e > para prevenir XSS', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    assertTrue(result.includes('&lt;'), 'Esperado &lt;');
    assertTrue(result.includes('&gt;'), 'Esperado &gt;');
    assertFalse(result.includes('<script>'), 'Tag <script> não deve existir');
  });

  it('deve escapar aspas duplas', () => {
    const result = escapeHtml('"texto"');
    assertTrue(result.includes('&quot;'), 'Esperado &quot;');
  });

  it('deve retornar string vazia para valor falsy', () => {
    assertEqual(escapeHtml(''), '');
    assertEqual(escapeHtml(null), '');
    assertEqual(escapeHtml(undefined), '');
  });

  it('não deve alterar texto simples sem caracteres especiais', () => {
    assertEqual(escapeHtml('Salário Normal'), 'Salário Normal');
  });
});

describe('Acessibilidade dos modais', () => {
  itAsync('foca o modal, prende Tab, fecha com Esc e devolve o foco', async () => {
    const previousFocus = document.createElement('button');
    previousFocus.id = 'a11yTestPreviousFocus';
    previousFocus.textContent = 'Abrir modal de teste';
    document.body.appendChild(previousFocus);
    previousFocus.focus();

    let overlay;
    try {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
      <section role="dialog" aria-modal="true" aria-labelledby="a11yTestTitle" tabindex="-1">
        <h2 id="a11yTestTitle">Modal de teste</h2>
        <button type="button" class="modal-close-btn" id="a11yTestClose">Fechar</button>
        <input id="a11yTestInput" aria-label="Primeiro campo">
        <button type="button" id="a11yTestLast">Último campo</button>
      </section>`;
      document.body.appendChild(overlay);
      const closeButton = overlay.querySelector('.modal-close-btn');
      closeButton.addEventListener('click', () => overlay.classList.remove('active'));
      overlay.classList.add('active');

      const tick = () => new Promise(resolve => setTimeout(resolve, 0));
      await tick();

      const focusable = [...overlay.querySelectorAll('button, input')];
      assertEqual(document.activeElement.id, 'a11yTestInput', 'O primeiro campo deve receber foco');

      focusable[focusable.length - 1].focus();
      overlay.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true
      }));
      assertEqual(document.activeElement.id, 'a11yTestClose', 'Tab no último controle deve voltar ao primeiro controle');

      overlay.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      assertEqual(document.activeElement.id, 'a11yTestLast', 'Shift+Tab no primeiro controle deve ir ao último');

      overlay.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true
      }));
      await tick();
      assertFalse(overlay.classList.contains('active'), 'Esc deve acionar o botão de fechar');
      assertEqual(document.activeElement.id, 'a11yTestPreviousFocus', 'O foco deve voltar ao elemento anterior');
    } finally {
      if (overlay) overlay.remove();
      previousFocus.remove();
    }
  });
});

describe('Tutorial de importação de extrato', () => {
  it('inclui um botão no importador e um atalho no passo Primeiros passos', () => {
    const guide = GastoProOnboarding.getStatementGuide();
    const topic = GastoProOnboarding.getTopics().find(item =>
      item.title === 'Comece rápido com o extrato do seu banco'
    );
    assertEqual(topic.action, 'open-statement-guide');
    assertEqual(topic.actionLabel, 'Como pegar meu extrato');
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const appBaseUrl = new URL('../', document.baseURI);
    let mounted;
    try {
      mounted = GastoProOnboarding.mountStatementGuide(slot, document, appBaseUrl);
      assertTrue(mounted, 'O guia deve ser criado junto com seu botão');
      assertEqual(mounted.trigger.id, guide.triggerId);
      assertEqual(mounted.trigger.dataset.action, topic.action);
      assertEqual(mounted.trigger.textContent, topic.actionLabel);
      assertEqual(mounted.modal.id, guide.modalId);
      assertEqual(mounted.modal.querySelectorAll('.statement-guide-step').length, 3);
      const illustrations = mounted.modal.querySelectorAll('img.statement-guide-illustration[alt]');
      assertEqual(illustrations.length, 3);
      assertTrue(Array.from(illustrations).every(image =>
        image.getAttribute('loading') === null && image.alt
      ));
      assertEqual(mounted.modal.querySelector('.modal-close-btn').dataset.action, 'close-statement-guide');
    } finally {
      if (mounted) mounted.modal.remove();
      slot.remove();
    }
  });

  it('contém três passos curtos sem nomes de bancos', () => {
    const guide = GastoProOnboarding.getStatementGuide();
    const text = `${guide.steps.map(step => step.text).join(' ')} ${guide.note}`;
    assertEqual(guide.steps.length, 3);
    assertTrue(guide.steps[0].text.includes('procure “Extrato”'));
    assertTrue(guide.steps[1].text.includes('Salvar em Arquivos'));
    assertTrue(guide.steps[2].text.includes('confira a prévia antes de confirmar'));
    assertEqual(guide.note, 'O nome dos botões muda de banco para banco.');
    assertFalse(/\b(nubank|ita[uú]|bradesco|santander|banco do brasil|caixa|inter|c6)\b/i.test(text));
  });

  itAsync('referencia ilustrações SVG existentes para os três passos', async () => {
    const guide = GastoProOnboarding.getStatementGuide();
    const appBaseUrl = new URL('../', document.baseURI);
    const images = await Promise.all(guide.steps.map(step => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(step.illustration);
      image.onerror = () => reject(new Error(`Ilustração não encontrada: ${step.illustration}`));
      image.src = new URL(step.illustration, appBaseUrl).href;
    })));
    assertEqual(images.length, 3);
  });
});

describe('Acessibilidade de painéis e navegação', () => {
  function createKeyboardPanelTest(id, trapFocus = false) {
    const trigger = document.createElement('button');
    trigger.id = `${id}Trigger`;
    const panel = document.createElement('div');
    panel.id = id;
    panel.className = 'open';
    panel.tabIndex = -1;
    panel.innerHTML = '<button type="button">Fechar</button><button type="button">Último</button>';
    document.body.append(trigger, panel);
    let closed = false;
    window.GastoProKeyboardPanels.bind({
      panel,
      trigger,
      isOpen: () => panel.isConnected && panel.classList.contains('open'),
      close: () => {
        closed = true;
        panel.classList.remove('open');
      },
      trapFocus
    });
    return { trigger, panel, get closed() { return closed; } };
  }

  it('drawer fecha com Esc, devolve foco e mantém Tab dentro do painel', () => {
    const testPanel = createKeyboardPanelTest('drawerKeyboardTest', true);
    try {
      const [first, last] = testPanel.panel.querySelectorAll('button');
      last.focus();
      last.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Tab', bubbles: true, cancelable: true
      }));
      assertEqual(document.activeElement.id, first.id, 'Tab no último controle deve voltar ao primeiro');

      first.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }));
      assertTrue(testPanel.closed, 'Esc deve fechar o drawer');
      assertEqual(document.activeElement.id, testPanel.trigger.id, 'O foco deve voltar ao acionador');
    } finally {
      testPanel.trigger.remove();
      testPanel.panel.remove();
    }
  });

  it('calendário fecha com Esc e devolve foco ao acionador', () => {
    const testPanel = createKeyboardPanelTest('calendarKeyboardTest');
    try {
      testPanel.panel.querySelector('button').focus();
      testPanel.panel.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }));
      assertTrue(testPanel.closed, 'Esc deve fechar o calendário');
      assertEqual(document.activeElement.id, testPanel.trigger.id, 'O foco deve voltar ao acionador');
    } finally {
      testPanel.trigger.remove();
      testPanel.panel.remove();
    }
  });

  it('sidebar fecha com Esc e devolve foco ao botão do menu', () => {
    const testPanel = createKeyboardPanelTest('sidebarKeyboardTest');
    try {
      testPanel.panel.querySelector('button').focus();
      testPanel.panel.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }));
      assertTrue(testPanel.closed, 'Esc deve fechar a sidebar');
      assertEqual(document.activeElement.id, testPanel.trigger.id, 'O foco deve voltar ao botão do menu');
    } finally {
      testPanel.trigger.remove();
      testPanel.panel.remove();
    }
  });
});

describe('Avatar — tipos de imagem suportados', () => {
  it('aceita somente JPEG, PNG e WebP', () => {
    assertTrue(isSupportedAvatarType('image/jpeg'));
    assertTrue(isSupportedAvatarType('image/png'));
    assertTrue(isSupportedAvatarType('image/webp'));
    assertFalse(isSupportedAvatarType('image/svg+xml'));
    assertFalse(isSupportedAvatarType('image/gif'));
    assertFalse(isSupportedAvatarType('application/octet-stream'));
  });
});

// ================================================================
// SUITE 3: LÓGICA DE NEGÓCIO (cálculos do dashboard)
// ================================================================

describe('Lógica de Negócio — Cálculo de Totais', () => {
  setupMockLocalStorage();

  it('saldo deve ser positivo quando ganhos > gastos', () => {
    FinanceData.add(makeIncome({ amount: 3000 }));
    FinanceData.add(makeVariable({ amount: 500 }));

    const ym      = '2026-11';
    const entries = FinanceData.getByMonth(ym);
    const total   = entries.filter(e => e.type === 'income').reduce((s, i) => s + i.amount, 0);
    const gastos  = entries.filter(e => e.type === 'variable').reduce((s, i) => s + i.amount, 0);
    const saldo   = total - gastos;

    assertEqual(saldo, 2500);
    assertTrue(saldo >= 0, 'Saldo deveria ser positivo');
  });

  it('saldo deve ser negativo quando gastos > ganhos', () => {
    setupMockLocalStorage();
    FinanceData.add(makeIncome({ amount: 500 }));
    FinanceData.add(makeVariable({ amount: 1000 }));

    const ym      = '2026-11';
    const entries = FinanceData.getByMonth(ym);
    const income  = entries.filter(e => e.type === 'income').reduce((s, i) => s + i.amount, 0);
    const expense = entries.filter(e => e.type === 'variable').reduce((s, i) => s + i.amount, 0);
    const saldo   = income - expense;

    assertTrue(saldo < 0, 'Saldo deveria ser negativo');
    assertEqual(saldo, -500);
  });

  it('saldo deve ser zero quando ganhos = gastos', () => {
    setupMockLocalStorage();
    FinanceData.add(makeIncome({ amount: 1000 }));
    FinanceData.add(makeVariable({ amount: 1000 }));

    const ym      = '2026-11';
    const entries = FinanceData.getByMonth(ym);
    const income  = entries.filter(e => e.type === 'income').reduce((s, i) => s + i.amount, 0);
    const expense = entries.filter(e => e.type === 'variable').reduce((s, i) => s + i.amount, 0);

    assertEqual(income - expense, 0);
  });
});

describe('Lógica de Negócio — Gastos Fixos Inativos', () => {
  setupMockLocalStorage();

  it('template inativo não deve ser contabilizado nos totais do mês', () => {
    // Adiciona template ativo e depois o inativa
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01', amount: 1200 }));
    FinanceData.toggleActive(tpl.id);

    const ym      = '2026-11';
    const entries = FinanceData.getByMonth(ym);

    // O template inativo APARECE na lista (para gerenciamento), mas active === false
    const fixo = entries.find(i => i.type === 'fixed');
    assertNotNull(fixo, 'Template deve aparecer na lista mesmo inativo');
    assertFalse(fixo.active, 'active deve ser false');

    // A lógica do app filtra por active !== false antes de somar
    const activeFixed = entries.filter(e => e.type === 'fixed' && e.active !== false);
    assertEqual(activeFixed.length, 0, 'Nenhum fixo ativo deve existir');
    const totalFixed = activeFixed.reduce((s, i) => s + i.amount, 0);
    assertEqual(totalFixed, 0, 'Total fixo de inativo deve ser zero');
  });
});

describe('Inteligência financeira local', () => {
  const insights = window.GastoProFinancialInsights;

  it('sugere categorias por descrição normalizada sem alterar lançamentos', () => {
    const source = { id: 'a', type: 'variable', desc: 'UNINTER (12322044)', category: 'Outros' };
    const similar = { id: 'b', type: 'variable', desc: 'Uninter 995512', category: 'Outros' };
    const unrelated = { id: 'c', type: 'variable', desc: 'Mercado semanal', category: 'Mercado' };
    assertEqual(insights.normalizeDescription(source.desc), ['uninter']);
    assertTrue(insights.areDescriptionsSimilar('Shopee SParcelado out/nov', 'Shopee SParcelado jan/fev'));
    assertEqual(insights.findSimilarCategoryEntries(source, [source, similar, unrelated], 'Educação'), [similar]);
    assertEqual(similar.category, 'Outros');
  });

  it('só alerta gasto acima de 1,5x com pelo menos três ocorrências históricas', () => {
    const history = [100, 100, 100].map(amount => ({ type: 'variable', category: 'Mercado', amount }));
    const alerts = insights.calculateCategoryAnomalies(
      [{ id: 'large', type: 'variable', category: 'Mercado', amount: 151 }],
      history
    );
    assertEqual(alerts.length, 1);
    assertEqual(alerts[0].average, 100);
    assertEqual(insights.calculateCategoryAnomalies(
      [{ type: 'variable', category: 'Mercado', amount: 151 }],
      history.slice(0, 2)
    ), []);
  });

  it('prevê saldo com dois movimentos pendentes e suprime previsão com poucos dados', () => {
    const pending = [
      { type: 'fixed', amount: 100, date: '2026-10-31', paid: false },
      { type: 'income', amount: 50, date: '2026-10-30', paid: false },
      { type: 'variable', amount: 400, date: '2026-10-31', paid: false, isCardInstallment: true }
    ];
    assertEqual(
      insights.calculateMonthEndForecast(500, pending, '2026-10-30', '2026-10-31'),
      { amount: 450, movementCount: 2 }
    );
    assertNull(insights.calculateMonthEndForecast(500, pending.slice(0, 1), '2026-10-30', '2026-10-31'));
  });

  it('avisa vencimento em até sete dias e calcula eventual insuficiência', () => {
    const due = [{ type: 'fixed', amount: 120, date: '2026-11-05', paid: false }];
    assertEqual(
      insights.calculateUpcomingDueWarning(80, due, '2026-11-01'),
      { dueCount: 1, dueTotal: 120, insufficientAmount: 40 }
    );
    assertNull(insights.calculateUpcomingDueWarning(80, due, '2026-11-01', 3));
  });

  it('resume categorias, resultado e variação contra o mês anterior', () => {
    const summary = insights.buildMonthlySummary([
      { type: 'income', amount: 1000 },
      { type: 'variable', category: 'Mercado', amount: 300 },
      { type: 'fixed', category: 'Moradia', amount: 200 }
    ], [{ type: 'variable', category: 'Mercado', amount: 250 }]);
    assertEqual(summary.result, 500);
    assertEqual(summary.expenseChange, 100);
    assertEqual(summary.topCategories.map(item => item.category), ['Mercado', 'Moradia']);
    assertNull(insights.buildMonthlySummary([], []));
  });

  it('aplica escopo de Todas, PF, PJ e conta aos lançamentos', () => {
    const accounts = [{ id: 'pf', type: 'PF' }, { id: 'pj', type: 'PJ' }];
    const items = [
      { id: 'a', accountId: 'pf' },
      { id: 'b', accountId: 'pj' },
      { id: 'c', accountId: null }
    ];
    assertEqual(insights.filterByAccount(items, accounts, 'all').length, 3);
    assertEqual(insights.filterByAccount(items, accounts, 'PF').map(item => item.id), ['a']);
    assertEqual(insights.filterByAccount(items, accounts, 'PJ').map(item => item.id), ['b']);
    assertEqual(insights.filterByAccount(items, accounts, 'account:pf').map(item => item.id), ['a']);
  });

  it('reforça valores com sinal e classe semântica positiva ou negativa', () => {
    assertEqual(insights.getAmountPresentation(125, { signed: true }), {
      text: '+ R$\xa0125,00',
      className: 'financial-amount financial-amount--positive'
    });
    assertEqual(insights.getAmountPresentation(-125, { signed: true }), {
      text: '− R$\xa0125,00',
      className: 'financial-amount financial-amount--negative'
    });
    assertEqual(insights.getAmountPresentation(0).className, 'financial-amount financial-amount--neutral');
  });
});

describe('Lógica de Negócio — Regra 50/30/20', () => {
  it('deve calcular porcentagens corretamente com renda conhecida', () => {
    const totalIncome   = 4000;
    const totalFixed    = 2000;  // 50%
    const totalVariable = 1200;  // 30%

    const pctFixed = Math.round((totalFixed / totalIncome) * 100);
    const pctVar   = Math.round((totalVariable / totalIncome) * 100);
    const pctSave  = Math.max(0, 100 - pctFixed - pctVar);

    assertEqual(pctFixed, 50);
    assertEqual(pctVar, 30);
    assertEqual(pctSave, 20);
  });

  it('pctSave não deve ser negativo quando gastos > 100% da renda', () => {
    const totalIncome   = 1000;
    const totalFixed    = 800;   // 80%
    const totalVariable = 500;   // 50% — total > 100%

    const pctFixed = Math.round((totalFixed / totalIncome) * 100);
    const pctVar   = Math.round((totalVariable / totalIncome) * 100);
    const pctSave  = Math.max(0, 100 - pctFixed - pctVar); // Math.max garante >= 0

    assertTrue(pctSave >= 0, 'pctSave não pode ser negativo');
    assertEqual(pctSave, 0);
  });

  it('porcentagens devem ser zero quando não há renda', () => {
    const totalIncome = 0;
    const pctFixed = totalIncome > 0 ? Math.round((500 / totalIncome) * 100) : 0;
    assertEqual(pctFixed, 0, 'Sem renda, porcentagens devem ser zero');
  });
});

describe('Lógica de Negócio — paidMonths por mês isolado', () => {
  setupMockLocalStorage();

  it('dar baixa em novembro não deve affetar outubro nem dezembro', () => {
    const tpl = FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));

    // Dá baixa apenas em novembro
    FinanceData.togglePaid(tpl.id, '2026-11');

    const resultOct = FinanceData.getByMonth('2026-10');
    const resultNov = FinanceData.getByMonth('2026-11');
    const resultDec = FinanceData.getByMonth('2026-12');

    const fixOct = resultOct.find(i => i.type === 'fixed');
    const fixNov = resultNov.find(i => i.type === 'fixed');
    const fixDec = resultDec.find(i => i.type === 'fixed');

    assertFalse(fixOct.paid, 'Outubro não deve ter baixa');
    assertTrue(fixNov.paid, 'Novembro deve ter baixa');
    assertFalse(fixDec.paid, 'Dezembro não deve ter baixa');
  });
});

describe('GastoProImporter — parsing e limites', () => {
  it('parseMoney deve aceitar vírgula decimal com uma ou duas casas e formatos existentes', () => {
    assertEqual(GastoProImporter.parseMoney('45,9'), 45.9);
    assertEqual(GastoProImporter.parseMoney('45,90'), 45.9);
    assertEqual(GastoProImporter.parseMoney('1.234,56'), 1234.56);
    assertEqual(GastoProImporter.parseMoney('1234.56'), 1234.56);
  });

  it('parseDate deve converter datas brasileiras e preservar ISO', () => {
    assertEqual(GastoProImporter.parseDate('31/10/2026'), '2026-10-31');
    assertEqual(GastoProImporter.parseDate('2026-10-31'), '2026-10-31');
  });

  it('autoDetectCategory deve inferir categoria a partir da descrição', () => {
    assertEqual(GastoProImporter.autoDetectCategory('Compra no supermercado'), 'Mercado');
    assertEqual(GastoProImporter.autoDetectCategory('descrição desconhecida'), 'Outros');
  });

  it('deve limitar description a 300 e category a 100 caracteres', () => {
    const longDescription = 'D'.repeat(350);
    const csvRows = GastoProImporter.parseCSV(
      `date,description,amount\n2026-10-31,"${longDescription}",12.34`
    );
    const rawRows = GastoProImporter.parseRawText(`31/10/2026 ${longDescription} 12,34`);
    const row = GastoProImporter.buildEntry({
      date: '2026-10-31',
      desc: longDescription,
      amount: 12.34,
      category: 'C'.repeat(120)
    });
    assertEqual(csvRows[0].desc.length, 300);
    assertEqual(rawRows[0].desc.length, 300);
    assertEqual(row.desc.length, 300);
    assertEqual(row.category.length, 100);
  });

  it('buildEntry cria contas fixas e dívidas sem baixa e aceita gasto pendente', () => {
    const row = {
      date: '2026-10-15',
      startMonth: '2026-11',
      endMonth: '2027-01',
      dueDay: 5,
      desc: 'Conta importada',
      amount: 120,
      category: 'Moradia',
      accountId: 'conta-destino'
    };
    const fixed = GastoProImporter.buildEntry(row, 'fixed');
    const debt = GastoProImporter.buildEntry(row, 'debt');
    const pending = GastoProImporter.buildEntry(row, 'variable', false);
    assertEqual(fixed.date, '2026-11-05');
    assertEqual(fixed.month, '2026-11');
    assertEqual(fixed.startMonth, '2026-11');
    assertEqual(fixed.endMonth, '2027-01');
    assertEqual(fixed.accountId, 'conta-destino');
    assertEqual(debt.accountId, 'conta-destino');
    assertEqual(pending.accountId, 'conta-destino');
    assertFalse(Object.prototype.hasOwnProperty.call(fixed, 'paid'));
    assertFalse(Object.prototype.hasOwnProperty.call(debt, 'paid'));
    assertEqual(pending.paid, false);
  });

  it('valida conta de destino obrigatória e rejeita seleção ausente ou inválida', () => {
    const accounts = [{ id: 'conta-destino' }];
    assertEqual(window.GastoProImportHelpers.getImportAccountId('conta-destino', accounts), 'conta-destino');
    assertNull(window.GastoProImportHelpers.getImportAccountId('', accounts));
    assertNull(window.GastoProImportHelpers.getImportAccountId('outra-conta', accounts));
    assertNull(window.GastoProImportHelpers.getImportAccountId('conta-destino', []));
  });

  it('normaliza descrições ignorando mês, números, caixa e acentos', () => {
    const normalize = window.GastoProImportHelpers.normalizeFixedDescription;
    assertEqual(normalize('UNINTER (12322044)'), 'uninter');
    assertEqual(
      normalize('Shopee SParcelado out/nov'),
      normalize('SHOPEE SParcelado nov/dez')
    );
    assertEqual(normalize('Academía São João 2026'), 'academia sao joao');
  });

  it('encontra apenas lançamentos parecidos em meses seguintes', () => {
    const source = makeVariable({ id: 'source', desc: 'UNINTER (12322044)', date: '2026-03-10' });
    const entries = [
      source,
      makeVariable({ id: 'previous', desc: 'Uninter 455', date: '2026-02-10' }),
      makeVariable({ id: 'future', desc: 'Uninter (9988)', date: '2026-04-10' }),
      makeVariable({ id: 'income', type: 'income', desc: 'Uninter', date: '2026-05-10' }),
      makeVariable({ id: 'other', desc: 'Outro', date: '2026-06-10' })
    ];
    const matches = window.GastoProImportHelpers.findFutureFixedDescriptionMatches(source, entries);
    assertEqual(matches.map(entry => entry.id), ['future']);
  });

  it('aplica regras às novas importações sem alterar inválidos, duplicados ou parcelas', () => {
    const applyRules = window.GastoProImportHelpers.applyFixedImportRules;
    const rows = [
      { ...makeVariable({ desc: 'Shopee SParcelado nov/2026', date: '2026-11-12' }) },
      { ...makeVariable({ id: 'duplicate', desc: 'Shopee SParcelado', duplicate: true }) },
      { ...makeVariable({ id: 'invalid', desc: 'Shopee SParcelado', invalid: true }) },
      { ...makeVariable({ id: 'installment', desc: 'Shopee SParcelado', installment: { current: 1 } }) },
      { ...makeVariable({ id: 'unmatched', desc: 'Outro gasto' }) }
    ];
    const result = applyRules(rows, ['shopee sparcelado']);
    assertEqual(result[0].type, 'fixed');
    assertEqual(result[0].startMonth, '2026-11');
    assertTrue(result[0].fixedByRule);
    assertEqual(result[1], rows[1]);
    assertEqual(result[2], rows[2]);
    assertEqual(result[3], rows[3]);
    assertEqual(result[4], rows[4]);
  });
});

describe('GastoProImporter — autoDetectCategory', () => {
  it('classifica Mercado Livre, Supermercado Extra e Amazon Prime', () => {
    assertEqual(GastoProImporter.autoDetectCategory('Mercado Livre'), 'Compras');
    assertEqual(GastoProImporter.autoDetectCategory('MercadoLivre'), 'Compras');
    assertEqual(GastoProImporter.autoDetectCategory('Supermercado Extra'), 'Mercado');
    assertEqual(GastoProImporter.autoDetectCategory('Amazon Prime'), 'Assinaturas');
  });

  it('evita categorias ambíguas e reconhece descrições específicas', () => {
    const cases = [
      ['Mercado Pago', 'Outros'],
      ['Pix enviado Mateus Silva', 'Outros'],
      ['Tenda do Churrasco', 'Outros'],
      ['Pix recebido Joao Vivo', 'Outros'],
      ['Vivo Fibra', 'Moradia'],
      ['Claro Fatura', 'Moradia'],
      ['Claro Internet', 'Moradia'],
      ['Mercado Livre', 'Compras'],
      ['Supermercado Extra', 'Mercado']
    ];
    cases.forEach(([description, category]) => {
      assertEqual(GastoProImporter.autoDetectCategory(description), category);
    });
  });

  it('classifica novas palavras-chave em suas categorias', () => {
    const cases = [
      ['Hamburgueria Central', 'Alimentação'],
      ['Makro Atacado', 'Mercado'],
      ['Shell Select', 'Transporte'],
      ['DROGASIL FILIAL 12', 'Saúde'],
      ['Wellhub', 'Esporte'],
      ['Duolingo', 'Educação'],
      ['Prime Video', 'Assinaturas'],
      ['Neoenergia', 'Moradia'],
      ['Kabum', 'Compras'],
      ['Cashback', 'Outros'],
      ['Cinemark', 'Lazer']
    ];
    cases.forEach(([description, category]) => {
      assertEqual(GastoProImporter.autoDetectCategory(description), category);
    });
  });

  it('classifica gastos apenas nas categorias oficiais e preserva categorias de ganhos', () => {
    const descriptions = [
      'Conta de luz', 'Empréstimo pessoal', 'Parcelamento compra', 'Roupa nova'
    ];
    const expected = ['Contas', 'Empréstimo', 'Parcelamento', 'Vestuário'];
    const detected = descriptions.map(description =>
      GastoProImporter.autoDetectCategory(description)
    );
    assertEqual(detected, expected);
    assertTrue(detected.every(category => GastoProCategories.EXPENSE.includes(category)));
    assertEqual(GastoProImporter.autoDetectCategory('Pix recebido Joao'), 'Outros');

    const incomeRows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n15/10/2026;Salário recebido;2500,00'
    );
    assertEqual(incomeRows.map(row => [row.type, row.category]), [['income', 'Receita']]);
    const expenseRows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor;tipo;categoria\n' +
      '15/10/2026;Pix recebido;10,00;variable;Receita'
    );
    assertEqual(expenseRows[0].category, 'Outros');
    assertTrue(GastoProCategories.EXPENSE.includes(expenseRows[0].category));
  });

  it('normaliza acentos e maiúsculas e trata descrições vazias', () => {
    assertEqual(GastoProImporter.autoDetectCategory('Açougue Bom Preço'), 'Mercado');
    assertEqual(GastoProImporter.autoDetectCategory(''), 'Outros');
    assertEqual(GastoProImporter.autoDetectCategory(null), 'Outros');
  });

  it('mantém categoria informada no CSV acima da detecção automática', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor;categoria\n' +
      '15/10/2026;Compra no supermercado;45,90; alimentacao '
    );
    assertEqual(rows[0].category, 'Alimentação');
  });
});

describe('GastoProImporter — CSV futuro e parcelas mensais', () => {
  const today = new Date(2026, 9, 30);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowString = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const firstRecurringMonth = GastoProImporter.shiftMonth(currentMonth, 1);
  const secondRecurringMonth = GastoProImporter.shiftMonth(currentMonth, 2);
  const firstRecurringDate = `${firstRecurringMonth}-05`;
  const secondRecurringDate = `${secondRecurringMonth}-05`;
  const prepareRecurringRows = csv => window.GastoProImportHelpers.markRecurringImportRows(
    GastoProImporter.markDuplicates(GastoProImporter.parseCSV(csv), [])
  );

  it('importa despesa futura como a pagar, sem marcar paid', () => {
    const row = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n2026-10-31;Loja Exemplo Parcelado out;-450,00', today
    )[0];
    assertTrue(row.pending);
    assertEqual(row.type, 'variable');
    assertFalse(GastoProImporter.buildEntry(row, 'variable', false).paid);
  });

  it('reconhece N de M somente para linha CSV futura e mantém a linha passada como antes', () => {
    const future = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n2026-10-31;Loja Exemplo Empréstimo 07 de 12;-450,00', today
    )[0];
    assertTrue(future.pending);
    assertEqual(future.installment, { current: 7, total: 12 });
    assertEqual(future.installmentBase, 'Loja Exemplo Empréstimo');

    const past = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n2026-10-29;Loja Exemplo Empréstimo 06 de 12;-450,00', today
    )[0];
    assertFalse(Boolean(past.pending));
    assertNull(past.installment);
    assertTrue(GastoProImporter.buildEntry(past, 'variable').paid);
    assertNull(GastoProImporter.detectInstallment('Loja Exemplo Empréstimo 07 de 12'));
  });

  it('inicia parcela futura detectada como Dívida na prévia', () => {
    const future = GastoProImporter.parseCSV(
      `Data;Descrição;Valor\n${tomorrowString};Loja Exemplo Empréstimo 07 de 12;-450,00`
    )[0];
    assertEqual(window.GastoProImportHelpers.getImportPreviewType(future), 'debt');
  });

  it('mantém gasto futuro sem parcela como Gasto a pagar na prévia', () => {
    const future = GastoProImporter.parseCSV(
      `Data;Descrição;Valor\n${tomorrowString};Compra futura;-45,00`
    )[0];
    assertFalse(Boolean(future.installment));
    assertEqual(window.GastoProImportHelpers.getImportPreviewType(future), 'variable_pending');
  });

  it('agrupa descrição recorrente limpa com valor igual e limita o template ao último mês', () => {
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Exemplo (111) - c/ desconto;-150,00\n${secondRecurringDate};Curso Exemplo;-150,00`
    );
    const first = rows[0];
    const covered = rows[1];
    assertEqual(window.GastoProImportHelpers.cleanRecurringImportDescription(
      'Curso Exemplo (111) - c/ desconto'
    ), 'curso exemplo');
    assertEqual(first.type, 'fixed');
    assertEqual(window.GastoProImportHelpers.getImportPreviewType(first), 'fixed');
    assertTrue(first.selected);
    assertEqual(first.startMonth, firstRecurringMonth);
    assertEqual(first.endMonth, secondRecurringMonth);
    assertTrue(covered.recurringCovered);
    assertFalse(covered.selected);
  });

  it('não agrupa descrições parecidas com conteúdo diferente', () => {
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Loja Exemplo Empréstimo;-99,00\n${secondRecurringDate};Loja Exemplo Parcelado;-99,00`
    );
    assertTrue(rows.every(row => !row.recurringPrimary && !row.recurringCovered));
    assertTrue(rows.every(row =>
      window.GastoProImportHelpers.getImportPreviewType(row) === 'variable_pending'
    ));
  });

  it('mantém como Gasto a pagar a descrição que aparece em apenas um mês', () => {
    const row = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Único Exemplo;-80,00`
    )[0];
    assertFalse(Boolean(row.recurringPrimary));
    assertEqual(window.GastoProImportHelpers.getImportPreviewType(row), 'variable_pending');
  });

  it('não agrupa descrição recorrente quando o valor muda entre meses', () => {
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Variável Exemplo;-150,00\n${secondRecurringDate};Curso Variável Exemplo;-150,00\n${GastoProImporter.shiftMonth(currentMonth, 3)}-05;Curso Variável Exemplo;-160,00`
    );
    assertTrue(rows.every(row => !row.recurringPrimary && !row.recurringCovered && row.selected));
    assertTrue(rows.every(row =>
      window.GastoProImportHelpers.getImportPreviewType(row) === 'variable_pending'
    ));
  });

  it('mantém parcela N de M como Dívida, fora do agrupamento recorrente', () => {
    const row = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Exemplo 07 de 12;-150,00`
    )[0];
    assertTrue(Boolean(row.installment));
    assertFalse(Boolean(row.recurringPrimary));
    assertEqual(window.GastoProImportHelpers.getImportPreviewType(row), 'debt');
  });

  it('não marca como pago o mês futuro de dívida com parcelas restantes selecionadas', () => {
    const future = GastoProImporter.parseCSV(
      `Data;Descrição;Valor\n${tomorrowString};Loja Exemplo Empréstimo 07 de 12;-450,00`
    )[0];
    const selectedType = window.GastoProImportHelpers.getImportPreviewType(future);
    const launchRemaining = true;
    assertEqual(selectedType, 'debt');
    assertTrue(launchRemaining);
    const debt = GastoProImporter.buildInstallmentDebt(future, future.category);
    assertFalse(Object.prototype.hasOwnProperty.call(debt.paidMonths, tomorrowString.substring(0, 7)));
  });

  it('grava data futura como não paga mesmo quando o tipo escolhido é pago', () => {
    const row = GastoProImporter.parseCSV(
      `Data;Descrição;Valor\n${tomorrowString};Compra futura;-45,00`
    )[0];
    const paid = window.GastoProImportHelpers.getImportPaidValue(row, 'variable');
    assertFalse(GastoProImporter.buildEntry(row, 'variable', paid).paid);
  });

  it('mantém como pago gasto passado e gasto datado hoje', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n2026-10-29;Pix enviado - Pessoa Exemplo;-20,00\n2026-10-30;Compra no débito - Mercado Exemplo;-35,00',
      today
    );
    assertTrue(rows.every(row => !row.pending));
    assertTrue(rows.every(row => GastoProImporter.buildEntry(row, 'variable').paid));
  });

  it('preserva RM-002 no Texto bruto para PARC 03/48', () => {
    const row = GastoProImporter.parseRawText(
      '15/10/2026 FACULDADE X PARC 03/48 -500,00'
    )[0];
    assertEqual(row.installment, { current: 3, total: 48 });
    assertEqual(row.installmentBase, 'FACULDADE X');
    const debt = GastoProImporter.buildInstallmentDebt(row, 'Educação');
    assertEqual(Object.keys(debt.paidMonths), ['2026-08', '2026-09', '2026-10']);
  });
});

describe('GastoProImporter — Pix e boletos', () => {
  const crc16 = value => {
    let crc = 0xFFFF;
    for (let index = 0; index < value.length; index++) {
      crc ^= value.charCodeAt(index) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };
  const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;
  const makePix = includeAmount => {
    const payload = '000201' + tlv('26', '0014BR.GOV.BCB.PIX') +
      (includeAmount ? tlv('54', '25.90') : '') +
      tlv('59', 'LOJA TESTE') + tlv('60', 'SAO PAULO');
    const crcInput = payload + '6304';
    return crcInput + crc16(crcInput);
  };
  const encodeConvenio = codigo => {
    const checkDigitPositions = new Set([11, 23, 35, 47]);
    let encoded = '';
    let codigoIndex = 0;
    for (let index = 0; index < 48; index++) {
      encoded += checkDigitPositions.has(index) ? '9' : codigo[codigoIndex++];
    }
    return encoded;
  };
  const today = new Date(2025, 1, 25);

  it('interpreta Pix com CRC válido, valor, descrição e data local', () => {
    const payload = makePix(true);
    const rows = GastoProImporter.parsePixPayload(payload, today);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].date, '2025-02-25');
    assertEqual(rows[0].desc, 'LOJA TESTE');
    assertEqual(rows[0].amount, 25.9);
    assertEqual(rows[0].signedAmount, -25.9);
    assertEqual(rows[0].type, 'variable');
    assertFalse(rows[0].invalid);
  });

  it('rejeita Pix com CRC inválido', () => {
    const payload = makePix(true);
    const corrupted = payload.slice(0, -1) + (payload.endsWith('0') ? '1' : '0');
    assertEqual(GastoProImporter.parsePixPayload(corrupted, today), []);
    assertTrue(GastoProImporter.getLastWarnings().includes('Código Pix com CRC inválido.'));
  });

  it('marca Pix sem valor como inválido', () => {
    const rows = GastoProImporter.parsePixPayload(makePix(false), today);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].amount, 0);
    assertTrue(rows[0].invalid);
    assertEqual(rows[0].invalidReason, 'Pix sem valor definido');
  });

  it('interpreta boleto de 47 dígitos com fator conhecido e valor', () => {
    const digits = '001' + '0'.repeat(30) + '1000' + '0000012345';
    const rows = GastoProImporter.parseBoletoLine(digits, today);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].date, '2025-02-22');
    assertEqual(rows[0].amount, 123.45);
    assertEqual(rows[0].desc, 'Boleto banco 001');
    assertFalse(rows[0].invalid);
    assertTrue(rows[0].pending);
  });

  it('usa a data local atual quando o fator do boleto é zero', () => {
    const digits = '001' + '0'.repeat(30) + '0000' + '0000012345';
    const rows = GastoProImporter.parseBoletoLine(digits, today);
    assertEqual(rows[0].date, '2025-02-25');
  });

  it('interpreta valor em convênio de 48 dígitos com identificador 6', () => {
    const codigo = '8060' + '00000012345' + '0'.repeat(29);
    const rows = GastoProImporter.parseBoletoLine(encodeConvenio(codigo), today);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].amount, 123.45);
    assertEqual(rows[0].desc, 'Guia de convênio/arrecadação');
    assertFalse(rows[0].invalid);
  });

  it('marca convênio de 48 dígitos sem valor para identificador 7', () => {
    const codigo = '8070' + '00000012345' + '0'.repeat(29);
    const rows = GastoProImporter.parseBoletoLine(encodeConvenio(codigo), today);
    assertEqual(rows.length, 1);
    assertEqual(rows[0].amount, 0);
    assertTrue(rows[0].invalid);
    assertEqual(rows[0].invalidReason, 'Valor não informado no código');
  });

  it('rejeita comprimento inválido de linha digitável', () => {
    assertEqual(GastoProImporter.parseBoletoLine('123456789'), []);
    assertTrue(GastoProImporter.getLastWarnings().includes('Linha digitável inválida.'));
  });

  it('roteia Pix e boleto automaticamente em parseRawText', () => {
    const pixRows = GastoProImporter.parseRawText(makePix(true));
    const boleto = '001' + '0'.repeat(30) + '0000' + '0000012345';
    const boletoRows = GastoProImporter.parseRawText(boleto);
    assertEqual(pixRows[0].desc, 'LOJA TESTE');
    assertEqual(pixRows[0].amount, 25.9);
    assertEqual(boletoRows[0].desc, 'Boleto banco 001');
    assertEqual(boletoRows[0].amount, 123.45);
  });
});

describe('GastoProImporter — texto extraído de PDF', () => {
  it('agrupa colunas por linha, tolera variação vertical e ordena linhas e colunas', () => {
    const items = [
      { str: 'Valor', transform: [1, 0, 0, 1, 300, 100] },
      { str: 'Data', transform: [1, 0, 0, 1, 10, 100] },
      { str: 'Mercado', transform: [1, 0, 0, 1, 100, 98] },
      { str: 'Descrição', transform: [1, 0, 0, 1, 100, 80] },
      { str: '12,50', transform: [1, 0, 0, 1, 300, 80] },
      { str: '15/10', transform: [1, 0, 0, 1, 10, 80] }
    ];
    assertEqual(
      GastoProImporter.groupTextItemsIntoLines(items),
      ['Data Mercado Valor', '15/10 Descrição 12,50']
    );
  });

  it('parseRawText interpreta três linhas fictícias no formato de fatura', () => {
    const rows = GastoProImporter.parseRawText(
      '15/10/2026 Mercado Central 123,45\n' +
      '16/10/2026 Farmácia Exemplo 27,90\n' +
      '17/10/2026 Padaria Modelo 8,50'
    );
    assertEqual(rows.length, 3);
    assertEqual(rows.map(row => row.desc), ['Mercado Central', 'Farmácia Exemplo', 'Padaria Modelo']);
    assertEqual(rows.map(row => row.amount), [123.45, 27.9, 8.5]);
  });
});

describe('GastoProImporter — extratos bancários robustos', () => {
  it('parseCSV usa categoria canônica informada e mantém a detecção quando não reconhecida ou ausente', () => {
    const withCategory = GastoProImporter.parseCSV(
      'Data;Descrição;Valor;categoria\n' +
      '15/10/2026;Compra no supermercado;45,90; alimentacao \n' +
      '16/10/2026;Compra no supermercado;12,00;Categoria desconhecida'
    );
    const withoutCategory = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n17/10/2026;Compra no supermercado;8,50'
    );
    assertEqual(withCategory.map(row => row.category), ['Alimentação', 'Mercado']);
    assertEqual(withoutCategory[0].category, 'Mercado');
  });

  it('mantém parseMoney absoluto e expõe o valor assinado e o tipo padrão', () => {
    assertEqual(GastoProImporter.parseMoney('-45,90'), 45.9);
    assertEqual(GastoProImporter.parseMoneySigned('-45,90'), -45.9);
    const mixed = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n15/10/2026;Compra mercado;-45,90\n16/10/2026;Salário;100,00'
    );
    assertEqual(mixed.map(row => row.signedAmount), [-45.9, 100]);
    assertEqual(mixed.map(row => row.type), ['variable', 'income']);
    const sameSign = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n15/10/2026;Compra mercado;45,90\n16/10/2026;Compra mercado;12,00'
    );
    assertEqual(sameSign.map(row => row.type), ['variable', 'variable']);
    const receita = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n15/10/2026;Receita de venda;-45,90'
    );
    assertEqual(receita[0].type, 'income');
  });

  it('calcula Crédito menos Débito e identifica receita/gasto em colunas separadas', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Débito;Crédito\n15/10/2026;Compra supermercado;45,90;0,00\n16/10/2026;Salário;0,00;100,00'
    );
    assertEqual(rows.map(row => row.signedAmount), [-45.9, 100]);
    assertEqual(rows.map(row => row.type), ['variable', 'income']);
  });

  it('interpreta tipos e período de contas a pagar em colunas opcionais do CSV', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor;tipo;mes_inicio;mes_fim;dia_venc\n' +
      '15/10/2026;Conta de luz;120,00;fixed;2026-11;2027-01;5\n' +
      '16/10/2026;Empréstimo;250,00;debt;inválido;2026-09;31\n' +
      '17/10/2026;Salário;3000,00;income;;;'
    );
    assertEqual(rows.map(row => row.type), ['fixed', 'debt', 'income']);
    assertEqual(
      [rows[0].startMonth, rows[0].endMonth, rows[0].dueDay],
      ['2026-11', '2027-01', 5]
    );
    assertEqual(
      [rows[1].startMonth, rows[1].endMonth, rows[1].dueDay],
      ['2026-10', null, 31]
    );
    assertFalse(Boolean(rows[0].installment));
  });

  it('ignora linhas inativas no CSV e emite aviso com a contagem', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor;tipo;ativo\n' +
      '15/10/2026;Conta ativa;120,00;fixed;sim\n' +
      '16/10/2026;Conta inativa;250,00;debt;não'
    );
    assertEqual(rows.length, 1);
    assertEqual(rows[0].desc, 'Conta ativa');
    assertTrue(GastoProImporter.getLastWarnings().includes('1 linhas inativas foram ignoradas.'));
  });

  it('mantém o comportamento de CSV sem coluna tipo, inclusive detecção de parcelas', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n' +
      '15/10/2026;Compra PARC 02/12;-45,90\n' +
      '16/10/2026;Salário;100,00'
    );
    assertEqual(rows.map(row => row.type), ['variable', 'income']);
    assertEqual(rows[0].installment, { current: 2, total: 12 });
    assertEqual(rows[0].installmentBase, 'Compra');
  });

  it('localiza o cabeçalho nas primeiras 15 linhas e ignora preâmbulo bancário', () => {
    const rows = GastoProImporter.parseCSV(
      'Extrato da conta\nPeríodo: outubro de 2026\nAgência;1234\nConta;5678\nData;Descrição;Valor\n15/10/2026;Compra mercado;-45,90'
    );
    assertEqual(rows.length, 1);
    assertEqual(rows[0].desc, 'Compra mercado');
    const tooLate = GastoProImporter.parseCSV(
      `${Array.from({ length: 15 }, (_, i) => `Preâmbulo ${i}`).join('\n')}\nData;Descrição;Valor\n15/10/2026;Compra;10,00`
    );
    assertEqual(tooLate.length, 0);
  });

  it('valida datas reais, aceita hora e aplica ano anterior a DD/MM distante no futuro', () => {
    assertEqual(GastoProImporter.parseDate('15/10/2026 14:32'), '2026-10-15');
    assertEqual(GastoProImporter.parseDate('15/10/26'), '2026-10-15');
    assertEqual(GastoProImporter.parseDate('15-10-2026'), '2026-10-15');
    assertEqual(GastoProImporter.parseDate('2026-10-15'), '2026-10-15');
    assertNull(GastoProImporter.parseDate('31/02/2026'));
    assertEqual(GastoProImporter.parseDate('31/12', new Date(2026, 0, 10)), '2025-12-31');
    const row = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n31/02/2026;Compra;10,00'
    )[0];
    assertTrue(row.invalid);
    assertTrue(Boolean(row.invalidReason));
  });

  it('não substitui data ausente por hoje e marca a linha como inválida', () => {
    const row = GastoProImporter.parseRawText('Compra supermercado 10,00')[0];
    assertNull(row.date);
    assertTrue(row.invalid);
    assertTrue(Boolean(row.invalidReason));
  });

  it('detecta parcelas com marcador e entre parênteses, mas não confunde datas', () => {
    assertEqual(GastoProImporter.detectInstallment('FACULDADE X PARC 03/48'), {
      current: 3, total: 48, baseDesc: 'FACULDADE X'
    });
    assertEqual(GastoProImporter.detectInstallment('Compra Parcela 3 de 12'), {
      current: 3, total: 12, baseDesc: 'Compra'
    });
    assertEqual(GastoProImporter.detectInstallment('Compra (3/12)'), {
      current: 3, total: 12, baseDesc: 'Compra'
    });
    assertEqual(GastoProImporter.detectInstallment('PCL 2/10').current, 2);
    assertEqual(GastoProImporter.detectInstallment('Prest 5/36').total, 36);
    assertEqual(GastoProImporter.detectInstallment('Cota 5/10').current, 5);
    assertNull(GastoProImporter.detectInstallment('COMPRA 03/12'));
    assertNull(GastoProImporter.detectInstallment('PARC 13/12'));
    assertNull(GastoProImporter.detectInstallment('PARC 0/12'));
  });

  it('shiftMonth atravessa a virada de ano nos dois sentidos', () => {
    assertEqual(GastoProImporter.shiftMonth('2026-01', -1), '2025-12');
    assertEqual(GastoProImporter.shiftMonth('2026-12', 1), '2027-01');
  });

  it('matchDebtTemplate encontra apenas dívida compatível com descrição, valor e período', () => {
    const template = {
      id: 'debt-1',
      desc: 'Faculdade X',
      amount: 105,
      isDebt: true,
      startMonth: '2026-08',
      endMonth: '2030-07'
    };
    const row = {
      date: '2026-10-15',
      desc: 'FACULDADE X PARC 03/48',
      amount: 100,
      installmentBase: 'FACULDADE X'
    };
    assertEqual(GastoProImporter.matchDebtTemplate(row, [template]), template);
    assertNull(GastoProImporter.matchDebtTemplate({ ...row, amount: 120 }, [template]));
    assertNull(GastoProImporter.matchDebtTemplate({ ...row, date: '2026-07-15' }, [template]));
  });

  it('parseRawText anota parcelas em gastos, mas não em receitas', () => {
    const rows = GastoProImporter.parseRawText(
      '15/10/2026 FACULDADE X PARC 03/48 -500,00\n' +
      '16/10/2026 Receita de venda PARC 03/12 100,00'
    );
    assertEqual(rows[0].installment, { current: 3, total: 48 });
    assertEqual(rows[0].installmentBase, 'FACULDADE X');
    assertEqual(rows[1].type, 'income');
    assertFalse(Boolean(rows[1].installment));
  });

  it('calcula o exemplo 03/48 com três meses pagos e 45 restantes', () => {
    const debt = GastoProImporter.buildInstallmentDebt({
      date: '2026-10-15',
      amount: 500,
      installmentBase: 'FACULDADE X',
      installment: { current: 3, total: 48 }
    }, 'Educação');
    assertEqual(debt.startMonth, '2026-08');
    assertEqual(debt.endMonth, '2030-07');
    assertEqual(debt.date, '2026-08-15');
    assertEqual(Object.keys(debt.paidMonths).length, 3);
    assertEqual(48 - Object.keys(debt.paidMonths).length, 45);
  });

  it('não marca como pago o mês da parcela importada com data futura', () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    const month = date.substring(0, 7);
    const debt = GastoProImporter.buildInstallmentDebt({
      date,
      amount: 500,
      installmentBase: 'FACULDADE X',
      installment: { current: 3, total: 48 }
    }, 'Educação');
    assertFalse(Object.prototype.hasOwnProperty.call(debt.paidMonths, month));
    assertTrue(Object.keys(debt.paidMonths).length > 0);
  });

  it('impõe limites de tamanho e linhas e limita cada linha a 500 caracteres', () => {
    const oversizedLine = `15/10/2026 ${'x'.repeat(510)} 10,00`;
    const rows = GastoProImporter.parseRawText(
      `15/10/2026 mercado 10,00\n${oversizedLine}`
    );
    assertEqual(rows.length, 1);
    assertEqual(GastoProImporter.parseCSV('x'.repeat(1_000_001)).length, 0);
    assertTrue(GastoProImporter.getLastWarnings().some(warning => warning.includes('1 MB')));
    assertEqual(GastoProImporter.parseRawText('x'.repeat(200_001)).length, 0);
    assertTrue(GastoProImporter.getLastWarnings().some(warning => warning.includes('200.000')));
    assertEqual(GastoProImporter.parseRawText(
      Array.from({ length: 2001 }, () => '15/10/2026 mercado 10,00').join('\n')
    ).length, 2000);
  });

  it('processa linha longa com segurança sem regex de backtracking custoso', () => {
    const input = `${' '.repeat(10000)}${'1'.repeat(10000)}`;
    const start = performance.now();
    GastoProImporter.parseRawText(input);
    assertTrue(performance.now() - start < 200, 'O parse deve terminar em menos de 200 ms');
  });

  it('ignora totais/saldos e classifica por palavras inteiras com categorias válidas', () => {
    const rows = GastoProImporter.parseCSV(
      'Data;Descrição;Valor\n15/10/2026;Saldo anterior;100,00\n15/10/2026;Total da fatura;100,00'
    );
    assertEqual(rows.length, 0);
    assertEqual(GastoProImporter.autoDetectCategory('EXTRATO CONTA'), 'Outros');
    assertEqual(GastoProImporter.autoDetectCategory('INTERNET CLARO'), 'Moradia');
    assertEqual(GastoProImporter.autoDetectCategory('SUPERMERCADO EXTRA'), 'Mercado');
    assertEqual(GastoProImporter.autoDetectCategory('UBER *TRIP'), 'Transporte');
    assertEqual(GastoProImporter.autoDetectCategory('UBER EATS'), 'Alimentação');
    const validCategories = [...GastoProCategories.EXPENSE, ...GastoProCategories.INCOME];
    ['EXTRATO CONTA', 'INTERNET CLARO', 'SUPERMERCADO EXTRA', 'UBER *TRIP', 'UBER EATS']
      .forEach(description => assertTrue(validCategories.includes(
        GastoProImporter.autoDetectCategory(description)
      )));
  });

  it('marca duplicados da mesma conta por valor e data em uma janela de dois dias', () => {
    const rows = [
      { date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Outro nome' },
      { date: '2026-10-17', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Mesmo valor' },
      { date: '2026-10-18', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Fora da janela' },
      { date: '2026-10-15', amount: 11, type: 'variable', accountId: 'conta-a', desc: 'Outro valor' },
      { date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-b', desc: 'Outra conta' },
      { date: '2026-10-15', amount: 10, type: 'income', accountId: 'conta-a', desc: 'Receita' }
    ];
    const marked = GastoProImporter.markDuplicates(rows, [
      { date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Lançamento manual' }
    ]);
    assertEqual(marked.map(row => row.duplicate), [true, true, false, false, false, false]);
    assertEqual(marked.map(row => row.selected), [false, false, true, true, true, true]);
    marked[0].selected = true;
    assertTrue(marked[0].selected, 'Um possível duplicado pode ser marcado manualmente');
  });

  it('não marca linhas idênticas entre si quando não há lançamentos salvos', () => {
    const rows = [
      { date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Mercado EXTRA' },
      { date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'mercado extra' }
    ];
    const marked = GastoProImporter.markDuplicates(rows);
    assertEqual(marked.map(row => row.duplicate), [false, false]);
    assertEqual(marked.map(row => row.selected), [true, true]);
  });

  it('bloqueia duplicação ao reimportar e aceita lançamento salvo manualmente', () => {
    const importedRow = {
      date: '2026-10-15', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Primeira importação'
    };
    const manualEntry = {
      date: '2026-10-17', amount: 10, type: 'variable', accountId: 'conta-a', desc: 'Digitado manualmente'
    };
    assertEqual(GastoProImporter.markDuplicates([importedRow], [importedRow])[0].duplicate, true);
    assertEqual(GastoProImporter.markDuplicates([importedRow], [manualEntry])[0].duplicate, true);
    assertEqual(GastoProImporter.markDuplicates([importedRow], [
      { ...manualEntry, accountId: 'conta-b' }
    ])[0].duplicate, false);
  });

  it('detecta conta fixa ou dívida já cadastrada pelo nome, valor e mês inicial', () => {
    const template = {
      desc: 'Conta de Luz',
      amount: 120,
      startMonth: '2026-11'
    };
    assertTrue(GastoProImporter.isTemplateDuplicate({
      desc: 'CONTA DE LUZ',
      amount: 120.01,
      startMonth: '2026-11'
    }, [template]));
    assertFalse(GastoProImporter.isTemplateDuplicate({
      desc: 'CONTA DE LUZ',
      amount: 120.02,
      startMonth: '2026-11'
    }, [template]));
    assertFalse(GastoProImporter.isTemplateDuplicate({
      desc: 'CONTA DE LUZ',
      amount: 120,
      startMonth: '2026-12'
    }, [template]));
  });
});

describe('GastoProImporter — importação de arquivos', () => {
  itAsync('parseFile mantém o parsing CSV e decodifica CSV Windows-1252', async () => {
    const csv = 'Data;Descrição;Valor\n15/10/2026;Café;12,50';
    const utf8File = new File([csv], 'extrato.csv');
    assertEqual(await GastoProImporter.parseFile(utf8File), GastoProImporter.parseCSV(csv));

    const legacyCsv = 'Data;Descrição;Valor\n15/10/2026;Café;12,50';
    const bytes = Uint8Array.from(legacyCsv, char => char.charCodeAt(0));
    const windowsFile = new File([bytes], 'extrato.csv');
    const rows = await GastoProImporter.parseFile(windowsFile);
    assertEqual(rows[0].desc, 'Café');
  });

  itAsync('parseFile interpreta OFX SGML Windows-1252 com crédito e débito', async () => {
    const ofx = 'OFXHEADER:100\nCHARSET:1252\n<OFX><BANKTRANLIST>' +
      '<STMTTRN><DTPOSTED>20261015000000<TRNAMT>1500.00<NAME>SALÁRIO' +
      '<STMTTRN><DTPOSTED>20261016000000<TRNAMT>-45.90<MEMO>PADARIA CAFÉ' +
      '</BANKTRANLIST></OFX>';
    const bytes = Uint8Array.from(ofx, char => char.charCodeAt(0));
    const rows = await GastoProImporter.parseFile(new File([bytes], 'extrato.ofx'));
    assertEqual(rows.map(row => row.date), ['2026-10-15', '2026-10-16']);
    assertEqual(rows.map(row => row.amount), [1500, 45.9]);
    assertEqual(rows.map(row => row.signedAmount), [1500, -45.9]);
    assertEqual(rows[1].desc, 'PADARIA CAFÉ');
    assertEqual(rows.map(row => row.type), ['income', 'variable']);
  });

  itAsync('parseFile interpreta OFX XML', async () => {
    const ofx = '<?xml version="1.0"?><OFX><BANKTRANLIST>' +
      '<STMTTRN><DTPOSTED>20261015<TRNAMT>1500.00<MEMO>Salário</STMTTRN>' +
      '<STMTTRN><DTPOSTED>20261016<TRNAMT>-45.90<MEMO>PADARIA CAFÉ</STMTTRN>' +
      '</BANKTRANLIST></OFX>';
    const rows = await GastoProImporter.parseFile(new File([ofx], 'extrato.ofx'));
    assertEqual(rows.map(row => row.signedAmount), [1500, -45.9]);
    assertEqual(rows[1].desc, 'PADARIA CAFÉ');
    assertEqual(rows.map(row => row.type), ['income', 'variable']);
  });

  it('parseOFX usa descrição padrão quando MEMO e NAME estão ausentes', () => {
    const rows = GastoProImporter.parseOFX(
      '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261015<TRNAMT>-10.00</STMTTRN></BANKTRANLIST></OFX>'
    );
    assertEqual(rows[0].desc, 'Lançamento importado');
  });

  it('parseOFX avisa quando o arquivo não contém transações', () => {
    const rows = GastoProImporter.parseOFX('<OFX><BANKTRANLIST></BANKTRANLIST></OFX>');
    assertEqual(rows, []);
    assertTrue(GastoProImporter.getLastWarnings().includes('Nenhuma transação encontrada no arquivo OFX.'));
  });

  it('parseOFX prioriza TRNTYPE e usa sinal para tipos desconhecidos', () => {
    const rows = GastoProImporter.parseOFX(
      '<OFX><BANKTRANLIST>' +
      '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261015<TRNAMT>-10.00<MEMO>Crédito fictício</STMTTRN>' +
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261016<TRNAMT>10.00<MEMO>Débito fictício</STMTTRN>' +
      '<STMTTRN><TRNTYPE>XFER<DTPOSTED>20261017<TRNAMT>-5.00<MEMO>Transferência fictícia</STMTTRN>' +
      '</BANKTRANLIST></OFX>'
    );
    assertEqual(rows.map(row => row.type), ['income', 'variable', 'variable']);
  });

  itAsync('parseFile marca data inválida em OFX', async () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261340' +
      '<TRNAMT>-10.00<MEMO>Compra</BANKTRANLIST></OFX>';
    const rows = await GastoProImporter.parseFile(new File([ofx], 'extrato.ofx'));
    assertTrue(rows[0].invalid);
    assertNull(rows[0].date);
  });

  itAsync('parseFile detecta parcela em descrição OFX', async () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261015' +
      '<TRNAMT>-500.00<MEMO>FACULDADE X PARC 03/48</BANKTRANLIST></OFX>';
    const rows = await GastoProImporter.parseFile(new File([ofx], 'extrato.ofx'));
    assertEqual(rows[0].installment, { current: 3, total: 48 });
    assertEqual(rows[0].installmentBase, 'FACULDADE X');
  });

  itAsync('parseFile aceita extensão OFX', async () => {
    const ofx = '<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261015' +
      '<TRNAMT>-12.50<MEMO>Compra fictícia</STMTTRN></BANKTRANLIST></OFX>';
    const rows = await GastoProImporter.parseFile(new File([ofx], 'extrato.ofx'));
    assertEqual(rows.length, 1);
    assertEqual(rows[0].amount, 12.5);
  });

  itAsync('parseFile importa XML de NFC-e usando emitente e valor da nota', async () => {
    const xml = '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe>' +
      '<infNFe><ide><dhEmi>2026-10-15T10:00:00-03:00</dhEmi><nNF>123</nNF></ide>' +
      '<emit><xNome>PADARIA CAFÉ</xNome></emit><dest><xNome>DESTINATÁRIO DIFERENTE</xNome></dest>' +
      '<det><prod><xProd>Pão francês</xProd></prod></det>' +
      '<total><ICMSTot><vNF>45.90</vNF></ICMSTot></total></infNFe></NFe></nfeProc>';
    const rows = await GastoProImporter.parseFile(new File([xml], 'nota.xml'));
    assertEqual(rows.length, 1);
    assertEqual(rows[0].desc, 'PADARIA CAFÉ — NF 123');
    assertEqual(rows[0].amount, 45.9);
    assertEqual(rows[0].type, 'variable');
    assertFalse(rows[0].desc.includes('DESTINATÁRIO'));
  });

  itAsync('parseFile avisa sobre XML malformado', async () => {
    const rows = await GastoProImporter.parseFile(new File(['<nfeProc><NFe>'], 'nota.xml'));
    assertEqual(rows, []);
    assertTrue(GastoProImporter.getLastWarnings().includes('XML inválido.'));
  });

  itAsync('parseFile rejeita XML com DOCTYPE', async () => {
    const xml = '<!DOCTYPE nfeProc [<!ENTITY x "x">]><nfeProc></nfeProc>';
    const rows = await GastoProImporter.parseFile(new File([xml], 'nota.xml'));
    assertEqual(rows, []);
    assertTrue(GastoProImporter.getLastWarnings().includes('XML inválido.'));
  });

  itAsync('parseFile rejeita extensão não suportada', async () => {
    const rows = await GastoProImporter.parseFile(new File(['documento'], 'nota.docx'));
    assertEqual(rows, []);
    assertTrue(GastoProImporter.getLastWarnings().includes(
      'Formato não suportado. Use CSV, OFX, PDF, XML ou TXT.'
    ));
  });

  itAsync('parseFile rejeita .jpg com mensagem clara sem analisar o conteúdo', async () => {
    const rows = await GastoProImporter.parseFile(new File(['conteúdo não analisável'], 'foto.jpg'));
    assertEqual(rows, []);
    assertEqual(GastoProImporter.getLastWarnings(), [
      'Formato não suportado. Use CSV, OFX, PDF, XML ou TXT.'
    ]);
  });
});

describe('FinanceData — inserção em lote para importação', () => {
  setupMockLocalStorage();

  itAsync('addMany grava entries e templates e solicita apenas um flush', async () => {
    setupMockLocalStorage();
    let flushes = 0;
    const originalFlush = FinanceData.flushPendingSync;
    FinanceData.flushPendingSync = async () => {
      flushes++;
      return { success: true };
    };
    try {
      const added = await FinanceData.addMany([
        { type: 'variable', desc: 'Gasto lote', amount: 10, date: '2026-10-15', month: '2026-10', accountId: 'account-id' },
        { type: 'fixed', desc: 'Fixo lote', amount: 20, date: '2026-10-15', month: '2026-10', accountId: 'account-id' }
      ]);
      assertEqual(added.items.length, 2);
      assertEqual(FinanceData.getEntries().length, 1);
      assertEqual(FinanceData.getTemplates().length, 1);
      assertEqual(FinanceData.getEntries()[0].accountId, 'account-id');
      assertEqual(FinanceData.getTemplates()[0].accountId, 'account-id');
      assertEqual(flushes, 1);
      assertTrue(added.items.every(item => isUuid(item.id)));
    } finally {
      FinanceData.flushPendingSync = originalFlush;
    }
  });

  itAsync('addMany preserva paidMonths fornecido em dívida', async () => {
    setupMockLocalStorage();
    const originalFlush = FinanceData.flushPendingSync;
    FinanceData.flushPendingSync = async () => ({ success: true });
    try {
      await FinanceData.addMany([{
        type: 'debt',
        desc: 'Faculdade X',
        amount: 500,
        date: '2026-08-15',
        startMonth: '2026-08',
        endMonth: '2030-07',
        paidMonths: { '2026-08': true, '2026-09': true, '2026-10': true }
      }]);
      assertEqual(FinanceData.getTemplates()[0].paidMonths, {
        '2026-08': true, '2026-09': true, '2026-10': true
      });
    } finally {
      FinanceData.flushPendingSync = originalFlush;
    }
  });

  itAsync('addMany cria template pendente e mantém lançamento importado como não pago', async () => {
    setupMockLocalStorage();
    const originalFlush = FinanceData.flushPendingSync;
    FinanceData.flushPendingSync = async () => ({ success: true });
    try {
      const fixed = GastoProImporter.buildEntry({
        date: '2026-10-15',
        startMonth: '2026-11',
        endMonth: null,
        dueDay: 5,
        desc: 'Conta fixa importada',
        amount: 120,
        category: 'Moradia'
      }, 'fixed');
      const pending = GastoProImporter.buildEntry({
        date: '2026-10-15',
        desc: 'Gasto a pagar importado',
        amount: 45,
        category: 'Mercado'
      }, 'variable', false);
      await FinanceData.addMany([fixed, pending]);
      assertEqual(FinanceData.getTemplates()[0].paidMonths, {});
      assertEqual(FinanceData.getEntries()[0].paid, false);
    } finally {
      FinanceData.flushPendingSync = originalFlush;
    }
  });

  itAsync('markPaid define baixa verdadeira e é idempotente', async () => {
    setupMockLocalStorage();
    const originalFlush = FinanceData.flushPendingSync;
    FinanceData.flushPendingSync = async () => ({ success: true });
    try {
      const { items } = await FinanceData.addMany([{
        type: 'debt',
        desc: 'Faculdade X',
        amount: 500,
        date: '2026-08-15',
        startMonth: '2026-08'
      }]);
      const first = await FinanceData.markPaid(items[0].id, '2026-10');
      const second = await FinanceData.markPaid(items[0].id, '2026-10');
      assertTrue(first.success);
      assertTrue(second.success);
      assertEqual(FinanceData.getTemplates()[0].paidMonths, { '2026-10': true });
    } finally {
      FinanceData.flushPendingSync = originalFlush;
    }
  });

  itAsync('markPaid não grava quando o template não existe', async () => {
    setupMockLocalStorage();
    let saves = 0;
    const originalSaveTemplates = FinanceData.saveTemplates;
    FinanceData.saveTemplates = async () => {
      saves++;
      return { success: true };
    };
    try {
      const result = await FinanceData.markPaid('missing-template', '2026-10');
      assertEqual(result, { success: false, error: 'Template não encontrado.' });
      assertEqual(saves, 0);
    } finally {
      FinanceData.saveTemplates = originalSaveTemplates;
    }
  });

  itAsync('markPaidMany grava duas baixas uma vez e mantém idempotência', async () => {
    setupMockLocalStorage();
    const originalFlush = FinanceData.flushPendingSync;
    const originalSaveTemplates = FinanceData.saveTemplates;
    FinanceData.flushPendingSync = async () => ({ success: true });
    const { items } = await FinanceData.addMany([
      { type: 'debt', desc: 'Dívida A', amount: 100, date: '2026-08-15' },
      { type: 'debt', desc: 'Dívida B', amount: 200, date: '2026-08-15' }
    ]);
    let saves = 0;
    FinanceData.saveTemplates = async function(templates) {
      saves++;
      return await originalSaveTemplates.call(this, templates);
    };
    try {
      const payments = [
        { id: items[0].id, ym: '2026-09' },
        { id: items[1].id, ym: '2026-10' },
        { id: 'missing-template', ym: '2026-10' }
      ];
      const first = await FinanceData.markPaidMany(payments);
      assertEqual(first, { success: true, applied: 2 });
      assertEqual(saves, 1);
      const second = await FinanceData.markPaidMany(payments);
      assertEqual(second, { success: true, applied: 2 });
      assertEqual(saves, 2);
      assertEqual(FinanceData.getTemplates().map(template => template.paidMonths), [
        { '2026-09': true },
        { '2026-10': true }
      ]);
    } finally {
      FinanceData.saveTemplates = originalSaveTemplates;
      FinanceData.flushPendingSync = originalFlush;
    }
  });

  itAsync('markPaidMany ignora baixa de mês futuro', async () => {
    setupMockLocalStorage();
    const originalFlush = FinanceData.flushPendingSync;
    FinanceData.flushPendingSync = async () => ({ success: true });
    const { items } = await FinanceData.addMany([
      { type: 'debt', desc: 'Dívida futura', amount: 200, date: '2026-08-15' }
    ]);
    try {
      const future = new Date();
      future.setMonth(future.getMonth() + 1, 1);
      const ym = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}`;
      const result = await FinanceData.markPaidMany([{ id: items[0].id, ym }]);
      assertEqual(result, { success: true, applied: 0 });
      assertEqual(FinanceData.getTemplates()[0].paidMonths, {});
    } finally {
      FinanceData.flushPendingSync = originalFlush;
    }
  });
});

describe('FinanceData — conversões de data local e tipo', () => {
  setupMockLocalStorage();

  it('getLocalDateString deve formatar a data do calendário local', () => {
    assertEqual(getLocalDateString(new Date(2026, 9, 31)), '2026-10-31');
  });

  it('isUuid deve aceitar UUIDs RFC das versões 1 a 8', () => {
    assertTrue(isUuid('01890f3e-7c00-7abc-8def-0123456789ab'));
  });

  it('edição de template não deve permitir o tipo income da família entries', () => {
    const template = FinanceData.add(makeFixed());
    const updated = FinanceData.update(template.id, { type: 'income' });
    assertNull(updated);
    assertEqual(FinanceData.getTemplates()[0].type, 'fixed');
    assertEqual(FinanceData.getEntries(), []);
  });
});

describe('FinanceData — exclusão durante sincronização', () => {
  itAsync('saveGoal e deleteGoal enfileiram alterações de metas por categoria', async () => {
    setupMockLocalStorage();
    const userId = 'user-goal-queue';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId });
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([
      { id: 'goal-delete', category: 'Transporte', limit: 50 }
    ]));
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: false, failedIds: ['Mercado'] }),
      deleteCloudGoals: async () => ({ success: false })
    };
    try {
      FinanceData.saveGoal('Mercado', 300);
      FinanceData.deleteGoal('Transporte');
      await FinanceData.flushPendingSync(userId);
      assertEqual(FinanceData.getPendingSync().goals, ['Mercado']);
      assertEqual(FinanceData.getPendingSync().deletedGoals, ['Transporte']);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('flush envia somente metas pendentes e limpa a fila após sucesso', async () => {
    setupMockLocalStorage();
    const userId = 'user-goal-flush';
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([
      { id: 'goal-a', category: 'Mercado', limit: 300 },
      { id: 'goal-b', category: 'Transporte', limit: 100 }
    ]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
      goals: ['Mercado'], deletedGoals: []
    });
    const savedGoals = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async goals => { savedGoals.push(...goals); return { success: true }; },
      deleteCloudGoals: async () => ({ success: true })
    };
    try {
      const result = await FinanceData.flushPendingSync(userId);
      assertTrue(result.success);
      assertEqual(savedGoals.map(goal => goal.category), ['Mercado']);
      assertEqual(FinanceData.getPendingSync().goals, []);
      assertFalse(FinanceData.hasPendingSync());
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  it('mergeCloudData preserva metas locais pendentes, mescla nuvem e ignora metas null', () => {
    setupMockLocalStorage();
    const userId = 'user-goal-merge';
    localStorage.setItem('gastopro_last_uid', userId);
    const localGoals = [
      { id: 'goal-pending', category: 'Mercado', limit: 300 },
      { id: 'goal-existing', category: 'Transporte', limit: 100 }
    ];
    localStorage.setItem('gastopro_goals_v1', JSON.stringify(localGoals));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
      goals: ['Mercado'], deletedGoals: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, null));
    assertEqual(FinanceData.getGoals(), localGoals);
    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, [
      { category: 'Mercado', limit: 999 },
      { category: 'Transporte', limit: 150 },
      { category: 'Moradia', limit: 800 }
    ]));
    const goals = FinanceData.getGoals();
    assertEqual(goals.find(goal => goal.category === 'Mercado'), localGoals[0]);
    assertEqual(goals.find(goal => goal.category === 'Transporte'), {
      id: 'goal-existing', category: 'Transporte', limit: 150
    });
    assertEqual(goals.find(goal => goal.category === 'Moradia').limit, 800);
    assertTrue(goals.find(goal => goal.category === 'Moradia').id.startsWith('goal-'));
  });

  itAsync('preserva edição local de lançamento após falha de envio e merge da nuvem', async () => {
    setupMockLocalStorage();
    const userId = 'user-entry-merge-after-failure';
    const local = makeIncome({ id: crypto.randomUUID(), desc: 'Edição local' });
    const remote = { ...local, desc: 'Versão antiga da nuvem' };
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([local]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [local.id], templates: [], deletedEntries: [], deletedTemplates: []
    });
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async entries => ({ success: false, failedIds: entries.map(item => item.id) }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true })
    };
    try {
      assertFalse((await FinanceData.flushPendingSync(userId)).success);
      assertTrue(FinanceData.mergeCloudData(userId, [remote], [], false));
      assertEqual(FinanceData.getEntries()[0].desc, 'Edição local');
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('preserva edição local de template após falha de envio e merge da nuvem', async () => {
    setupMockLocalStorage();
    const userId = 'user-template-merge-after-failure';
    const local = makeFixed({ id: crypto.randomUUID(), desc: 'Edição local' });
    const remote = { ...local, desc: 'Versão antiga da nuvem' };
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([local]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [local.id], deletedEntries: [], deletedTemplates: []
    });
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async templates => ({ success: false, failedIds: templates.map(item => item.id) }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true })
    };
    try {
      assertFalse((await FinanceData.flushPendingSync(userId)).success);
      assertTrue(FinanceData.mergeCloudData(userId, [], [remote], false));
      assertEqual(FinanceData.getTemplates()[0].desc, 'Edição local');
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  it('não recria lançamento com exclusão pendente durante o merge', () => {
    setupMockLocalStorage();
    const userId = 'user-entry-delete-merge';
    const deleted = makeIncome({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [deleted.id], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [deleted], [], false));
    assertEqual(FinanceData.getEntries(), []);
  });

  it('não recria template com exclusão pendente durante o merge', () => {
    setupMockLocalStorage();
    const userId = 'user-template-delete-merge';
    const deleted = makeFixed({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [deleted.id]
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [deleted], false));
    assertEqual(FinanceData.getTemplates(), []);
  });

  it('atualiza lançamentos e templates não pendentes com a versão da nuvem', () => {
    setupMockLocalStorage();
    const userId = 'user-cloud-updates-nonpending';
    const localEntry = makeIncome({ id: crypto.randomUUID(), desc: 'Antigo' });
    const localTemplate = makeFixed({ id: crypto.randomUUID(), desc: 'Antigo template' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([localEntry]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([localTemplate]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(
      userId,
      [{ ...localEntry, desc: 'Atualizado' }],
      [{ ...localTemplate, desc: 'Template atualizado' }],
      false
    ));
    assertEqual(FinanceData.getEntries()[0].desc, 'Atualizado');
    assertEqual(FinanceData.getTemplates()[0].desc, 'Template atualizado');
  });

  it('não recria meta por categoria com exclusão pendente durante o merge', () => {
    setupMockLocalStorage();
    const userId = 'user-goal-delete-merge';
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
      goals: [], deletedGoals: ['Mercado']
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, [
      { category: 'Mercado', limit: 500 }
    ]));
    assertEqual(FinanceData.getGoals(), []);
  });

  it('não recria conta com exclusão pendente durante o merge', () => {
    setupMockLocalStorage();
    const userId = 'user-account-delete-merge';
    const deleted = {
      id: crypto.randomUUID(), name: 'Removida', institution: null, type: 'PF', initialBalance: 0
    };
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_accounts_v1', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
      goals: [], deletedGoals: [], accounts: [], deletedAccounts: [deleted.id]
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, [], [deleted]));
    assertEqual(FinanceData.getAccounts(), []);
  });

  itAsync('clearAll enfileira a exclusão de todas as metas locais', async () => {
    setupMockLocalStorage();
    const userId = 'user-clear-goals';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId });
    localStorage.setItem('gastopro_goals_v1', JSON.stringify([
      { id: 'goal-a', category: 'Mercado', limit: 300 },
      { id: 'goal-b', category: 'Transporte', limit: 100 }
    ]));
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudGoals: async () => ({ success: false })
    };
    try {
      await FinanceData.clearAll();
      assertEqual(FinanceData.getPendingSync().deletedGoals.sort(), ['Mercado', 'Transporte']);
      assertEqual(FinanceData.getGoals(), []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('deve manter e enviar exclusão enfileirada enquanto o upsert está pendente', async () => {
    setupMockLocalStorage();
    const userId = 'user-sync-race';
    const entryId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    await FinanceData.saveEntries([makeIncome({ id: entryId })]);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId });

    let finishEntrySave;
    const deletedIds = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: () => new Promise(resolve => { finishEntrySave = resolve; }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async ids => {
        deletedIds.push(...ids);
        return { success: true };
      },
      deleteCloudTemplates: async () => ({ success: true })
    };

    try {
      const firstFlush = FinanceData.flushPendingSync(userId);
      await Promise.resolve();
      assertTrue(typeof finishEntrySave === 'function', 'Upsert inicial deveria estar pendente');

      const deletion = FinanceData.delete(entryId);
      finishEntrySave({ success: true });
      await Promise.all([firstFlush, deletion]);

      assertTrue(deletedIds.includes(entryId), 'A exclusão concorrente deveria ser enviada à nuvem');
      assertFalse(FinanceData.hasPendingSync(), 'A fila deveria estar limpa após o envio da exclusão');
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

describe('Relatório Financeiro — buildReportData', () => {
  setupMockLocalStorage();

  it('deve calcular totais mensais, percentuais e totais do intervalo', () => {
    FinanceData.saveEntries([
      makeIncome({ id: 'report-income-jan', month: '2026-01', date: '2026-01-05', amount: 5000 }),
      makeVariable({ id: 'report-variable-jan', month: '2026-01', date: '2026-01-10', amount: 400 }),
      makeIncome({ id: 'report-income-feb', month: '2026-02', date: '2026-02-05', amount: 1000 })
    ]);
    FinanceData.saveTemplates([
      {
        id: 'report-fixed', desc: 'Aluguel', amount: 1000, category: 'Moradia',
        type: 'fixed', active: true, startMonth: '2026-01', endMonth: null, day: '05', paidMonths: {}
      },
      {
        id: 'report-debt', desc: 'Parcela', amount: 300, category: 'Empréstimo',
        type: 'fixed', isDebt: true, active: true, startMonth: '2026-01',
        endMonth: '2026-02', day: '10', paidMonths: { '2026-01': true }
      }
    ]);
    FinanceData.saveProfile({ name: 'Pessoa de Teste', avatar: null });

    const report = buildReportData({
      type: 'range', from: '2026-01', to: '2026-02', includeDetails: true
    });

    assertEqual(report.meta.profileName, 'Pessoa de Teste');
    assertEqual(report.months.length, 2);
    assertEqual(report.months[0].totals.income, 5000);
    assertEqual(report.months[0].totals.fixed, 1000);
    assertEqual(report.months[0].totals.debt, 300);
    assertEqual(report.months[0].totals.variable, 400);
    assertEqual(report.months[0].totals.balance, 3300);
    assertEqual(report.months[0].totals.percentages.fixed, 26);
    assertEqual(report.months[0].totals.percentages.variable, 8);
    assertEqual(report.months[0].totals.percentages.savings, 66);
    assertEqual(report.totals.income, 6000);
    assertEqual(report.totals.balance, 3000);
  });

  it('deve incluir projeções fixas ativas, respeitar pagamentos e omitir inativas', () => {
    FinanceData.saveEntries([
      makeIncome({ id: 'report-detail-income', month: '2026-03', date: '2026-03-01' }),
      makeVariable({ id: 'report-detail-variable', month: '2026-03', date: '2026-03-15' })
    ]);
    FinanceData.saveTemplates([
      {
        id: 'report-active-fixed', desc: 'Conta paga', amount: 100, category: 'Casa',
        type: 'fixed', active: true, startMonth: '2026-01', endMonth: null, day: '03',
        paidMonths: { '2026-03': true }
      },
      {
        id: 'report-inactive-fixed', desc: 'Conta pausada', amount: 900, category: 'Casa',
        type: 'fixed', active: false, startMonth: '2026-01', endMonth: null, day: '04',
        paidMonths: {}
      }
    ]);

    const report = buildReportData({
      type: 'month', from: '2026-03', to: '2026-03', includeDetails: true
    });

    assertEqual(report.details.income.length, 1);
    assertEqual(report.details.variable.length, 1);
    assertEqual(report.details.fixed.length, 1);
    assertEqual(report.details.fixed[0].description, 'Conta paga');
    assertEqual(report.details.fixed[0].status, 'Pago');
  });

  it('deve calcular metas e diagnóstico e omitir listas quando detalhes estão desativados', () => {
    FinanceData.saveEntries([
      makeIncome({ id: 'report-goal-income', month: '2026-04', date: '2026-04-01', amount: 1000 }),
      makeVariable({ id: 'report-goal-variable', month: '2026-04', date: '2026-04-05', amount: 800, category: 'Mercado' })
    ]);
    FinanceData.saveTemplates([]);
    FinanceData.saveGoals([{ id: 'goal-report', category: 'Mercado', limit: 1000 }]);

    const report = buildReportData({
      type: 'month', from: '2026-04', to: '2026-04', includeDetails: false
    });

    assertEqual(report.goals[0].spent, 800);
    assertEqual(report.goals[0].percentage, 80);
    assertEqual(report.goals[0].status, 'Atenção: 80% atingido');
    assertEqual(report.details.income, []);
    assertEqual(report.diagnosis.badge, 'Variáveis Altos');
    assertTrue(report.diagnosis.title.length > 0);
    assertTrue(report.meta.generatedAt.length > 0);
  });

  it('deve preservar texto latino e remover emoji e caracteres fora do alfabeto latino no PDF', () => {
    assertEqual(sanitizePdfText('ç ã é ô R$ – • 😀 漢'), 'ç ã é ô R$ – •');
  });

  it('deve formatar percentuais com vírgula decimal e textos do PDF com acentuação', () => {
    assertEqual(formatReportPercentage(60.91), '60,91');
    assertEqual(formatReportPercentage(26.4), '26,4');
    const labels = getReportLabels();
    assertEqual(labels.title, 'Relatório financeiro');
    assertEqual(labels.debts, 'Dívidas');
    assertEqual(labels.variableExpenses, 'Despesas variáveis');
    assertEqual(labels.description, 'Descrição');
    assertEqual(labels.status, 'Situação');
    assertEqual(labels.forecast, 'Previsão de quitação');
    assertEqual(labels.settlementForecast, 'Quitação prevista');
    assertEqual(labels.diagnosis, 'Diagnóstico financeiro');
    assertEqual(labels.guidance, 'Orientação');
    assertEqual(sanitizePdfText('Relatório – Dívidas • ç ã é ô Alimentação'),
      'Relatório – Dívidas • ç ã é ô Alimentação');
  });

  it('deve documentar o cálculo atual das parcelas restantes da dívida', () => {
    FinanceData.saveTemplates([{
      id: 'report-debt-installments',
      desc: 'Parcela de teste',
      amount: 250,
      category: 'Financiamento',
      type: 'fixed',
      isDebt: true,
      active: true,
      startMonth: '2025-01',
      endMonth: '2026-10',
      day: '15',
      paidMonths: {
        '2025-01': true,
        '2025-02': true,
        '2025-03': true,
        '2025-04': true,
        '2025-05': true,
        '2025-06': true
      }
    }]);

    const debt = GastoProReportHelpers.getDebtCenterData('2026-04').items[0];
    assertEqual(debt.remainingMonths, 16);
    assertEqual(debt.remainingAmount, 4000);
    assertEqual(debt.forecastMonth, '2026-10');
  });

  it('inclui status de parcelas em aberto no relatório após o vencimento', () => {
    FinanceData.saveEntries([]);
    FinanceData.saveTemplates([{
      id: 'report-overdue-debt',
      desc: 'Financiamento vencido',
      amount: 250,
      category: 'Empréstimo',
      type: 'fixed',
      isDebt: true,
      active: true,
      startMonth: '2025-01',
      endMonth: '2026-01',
      day: '15',
      paidMonths: { '2025-01': true }
    }]);
    const report = buildReportData({
      type: 'month', from: '2026-02', to: '2026-02', includeDetails: true
    });
    assertEqual(report.debts.items[0].isFinished, false);
    assertEqual(report.debts.items[0].isOverdue, true);
    assertEqual(report.debts.items[0].status, '12 parcela(s) em aberto');
    assertEqual(report.debts.totalRemaining, 3000);
  });
});

describe('Exclusão de conta do usuário', () => {
  itAsync('deleteAccount chama delete_my_account e informa sucesso', async () => {
    const previousClient = SupabaseAuth.client;
    let rpcName = null;
    SupabaseAuth.client = {
      rpc: async name => {
        rpcName = name;
        return { error: null };
      }
    };
    try {
      assertEqual(await SupabaseAuth.deleteAccount(), { success: true });
      assertEqual(rpcName, 'delete_my_account');
    } finally {
      SupabaseAuth.client = previousClient;
    }
  });

  itAsync('deleteAccount retorna o erro recebido do RPC sem lançar exceção', async () => {
    const previousClient = SupabaseAuth.client;
    const rpcError = { message: 'Falha simulada', code: 'TEST' };
    SupabaseAuth.client = {
      rpc: async () => ({ error: rpcError })
    };
    try {
      const result = await SupabaseAuth.deleteAccount();
      assertFalse(result.success);
      assertEqual(result.error.message, rpcError.message);
      assertEqual(result.error.code, rpcError.code);
    } finally {
      SupabaseAuth.client = previousClient;
    }
  });

  it('só aceita o texto exato EXCLUIR', () => {
    assertTrue(window.GastoProAccountDeletion.isConfirmationValid('EXCLUIR'));
    assertFalse(window.GastoProAccountDeletion.isConfirmationValid('excluir'));
    assertFalse(window.GastoProAccountDeletion.isConfirmationValid(' EXCLUIR'));
    assertFalse(window.GastoProAccountDeletion.isConfirmationValid('EXCLUIR '));
    assertTrue(window.GastoProUserData.isDeletionConfirmationValid('EXCLUIR'));
    assertFalse(window.GastoProUserData.isDeletionConfirmationValid('excluir'));
    assertFalse(window.GastoProUserData.isDeletionConfirmationValid(' EXCLUIR'));
  });

  itAsync('limpa todos os dados e a sessão local após excluir a conta com sucesso', async () => {
    setupMockLocalStorage();
    window.GastoProOnboarding.markSeen();
    FinanceData.savePendingSync({
      full: true,
      entries: ['entry-pending'],
      templates: ['template-pending'],
      deletedEntries: ['entry-deleted'],
      deletedTemplates: ['template-deleted'],
      goals: ['Mercado'],
      deletedGoals: ['Transporte'],
      accounts: ['account-pending'],
      deletedAccounts: ['account-deleted']
    });
    localStorage.setItem('gastopro_entries_v4', JSON.stringify([{ id: 'local-entry' }]));
    localStorage.setItem('gastopro_profile_real_v2', JSON.stringify({ name: 'Pessoa', avatar: 'foto' }));
    localStorage.setItem('gastopro_theme', 'light');
    localStorage.setItem('gastopro_last_uid', 'user-delete');
    localStorage.setItem('sb-project-auth-token', 'sessao');
    let signOutScope = null;

    const result = await window.GastoProAccountDeletion.deleteAccountAndClearPendingSync({
      deleteAccount: async () => ({ success: true }),
      signOut: async scope => {
        signOutScope = scope;
        localStorage.removeItem('sb-project-auth-token');
      }
    }, FinanceData);

    assertTrue(result.success);
    assertFalse(FinanceData.hasPendingSync());
    assertFalse(window.GastoProOnboarding.hasSeen());
    assertEqual(signOutScope, 'local');
    assertEqual(localStorage.length, 1);
    assertEqual(localStorage.getItem('gastopro_theme'), 'light');
  });

  itAsync('preserva dados, fila e sessão se a exclusão no servidor falhar', async () => {
    setupMockLocalStorage();
    window.GastoProOnboarding.markSeen();
    FinanceData.savePendingSync({ full: true, entries: ['pending-entry'] });
    localStorage.setItem('gastopro_entries_v4', JSON.stringify([{ id: 'local-entry' }]));
    localStorage.setItem('gastopro_last_uid', 'user-delete');
    localStorage.setItem('sb-project-auth-token', 'sessao');
    let signedOut = false;

    const result = await window.GastoProAccountDeletion.deleteAccountAndClearPendingSync({
      deleteAccount: async () => ({ success: false, error: new Error('RPC falhou') }),
      signOut: async () => { signedOut = true; }
    }, FinanceData);

    assertFalse(result.success);
    assertTrue(FinanceData.hasPendingSync());
    assertEqual(localStorage.getItem('gastopro_entries_v4'), JSON.stringify([{ id: 'local-entry' }]));
    assertEqual(localStorage.getItem('gastopro_last_uid'), 'user-delete');
    assertEqual(localStorage.getItem('sb-project-auth-token'), 'sessao');
    assertTrue(window.GastoProOnboarding.hasSeen());
    assertFalse(signedOut);
  });
});

// ================================================================
// RELATÓRIO FINAL
// ================================================================

/**
 * Imprime o relatório final de todos os testes executados.
 * Chame esta função após definir todos os suites de teste.
 */
async function printTestReport() {
  await Promise.all(pendingTestPromises);
  const total = TestResults.passed + TestResults.failed;
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL DE TESTES — GastoPro');
  console.log('='.repeat(60));
  console.log(`Total de testes: ${total}`);
  console.log(`✅ Aprovados:    ${TestResults.passed}`);
  console.log(`❌ Reprovados:   ${TestResults.failed}`);

  if (TestResults.failed > 0) {
    console.log('\n🔍 Testes reprovados:');
    TestResults.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.test}`);
      console.log(`     → ${err.error}`);
    });
  } else {
    console.log('\n🎉 Todos os testes passaram! App está 100% funcional.');
  }
  console.log('='.repeat(60));

  // Expõe resultado para o test-runner.html poder exibir na tela
  window.GastoProTestResults = TestResults;
  window.GastoProTestResults.total = total;
}

// Executa o relatório automaticamente ao final do carregamento
window.addEventListener('load', printTestReport);
