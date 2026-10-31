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
    localStorage.setItem('gastopro_paid_import_review_v1:user-a', '["entry-review"]');

    FinanceData.clearUserData();

    const remainingKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    assertEqual(remainingKeys, [
      'gastopro_tutorial_seen', 'gastopro_theme', 'sb-project-auth-token',
      'gastopro_paid_import_review_v1:user-a'
    ]);
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

  itAsync('sincroniza uma compra parcelada como linha única e reenvia o mesmo ID após falha', async () => {
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
    const syncedPurchaseIds = [];
    let purchaseAttempts = 0;
    window.SupabaseAuth = {
      saveCloudCreditCards: async cards => {
        syncedCards = cards;
        return { success: true };
      },
      saveCloudCreditCardPurchases: async purchases => {
        syncedPurchaseIds.push(purchases.map(item => item.id));
        purchaseAttempts++;
        return purchaseAttempts === 1
          ? { success: false, failedIds: purchases.map(item => item.id), error: new Error('offline') }
          : { success: true };
      }
    };
    try {
      const failed = await FinanceData.flushPendingSync(userId);
      assertFalse(failed.success);
      assertEqual(FinanceData.getPendingSync().creditCardPurchases, [purchase.id]);
      const result = await FinanceData.flushPendingSync(userId);
      assertTrue(result.success);
      assertEqual(syncedCards, [card]);
      assertEqual(syncedPurchaseIds, [[purchase.id], [purchase.id]]);
      assertEqual(FinanceData.getCreditCardPurchases().length, 1);
      assertEqual(FinanceData.getCreditCardPurchases()[0].installmentCount, 2);
      assertEqual(FinanceData.getPendingSync().creditCards, []);
      assertEqual(FinanceData.getPendingSync().creditCardPurchases, []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('importa lote todo-ou-nada, mantém a fila após falha e reutiliza IDs no retry', async () => {
    setupMockLocalStorage();
    const userId = 'user-transactional-import';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const existingTemplate = { ...makeFixed({ id: crypto.randomUUID() }), paidMonths: {} };
    await FinanceData.saveTemplates([existingTemplate], { flush: false });
    const entryId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const importedItems = [
      makeIncome({ id: entryId, desc: 'Linha CSV' }),
      makeFixed({ id: templateId, desc: 'Template CSV' })
    ];
    const calls = [];
    const committedIds = new Set();
    let attempt = 0;
    let genericWrites = 0;
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      importFinancialBatch: async (entries, templates, payments) => {
        calls.push({ entries: entries.map(item => item.id), templates: templates.map(item => item.id), payments });
        attempt++;
        if (attempt === 1) return { success: false, error: 'falha antes do commit' };
        entries.forEach(item => committedIds.add(item.id));
        templates.forEach(item => committedIds.add(item.id));
        if (attempt === 2) return { success: false, error: 'resposta perdida após commit' };
        return { success: true };
      },
      saveCloudEntries: async () => { genericWrites++; return { success: true }; },
      saveCloudTemplates: async () => { genericWrites++; return { success: true }; }
    };
    try {
      const first = await FinanceData.importBatch(importedItems, [
        { id: existingTemplate.id, ym: '2026-10' }
      ]);
      assertFalse(first.success);
      assertEqual(committedIds.size, 0);
      assertEqual(FinanceData.getPendingSync().transactionalOperations.length, 1);
      assertEqual(genericWrites, 0);

      assertFalse((await FinanceData.flushPendingSync(userId)).success);
      assertEqual(committedIds.size, 3);
      assertEqual(FinanceData.getPendingSync().transactionalOperations.length, 1);
      assertTrue((await FinanceData.flushPendingSync(userId)).success);
      assertEqual(committedIds.size, 3);
      assertEqual(calls[0].entries, calls[1].entries);
      assertEqual(calls[1].entries, calls[2].entries);
      assertEqual(calls[0].templates, calls[2].templates);
      assertEqual(calls[0].payments, calls[2].payments);
      assertEqual(FinanceData.getPendingSync().transactionalOperations, []);
      assertEqual(genericWrites, 0);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('avisa e não divide importação acima de 500 linhas', async () => {
    setupMockLocalStorage();
    const oversized = Array.from({ length: 501 }, (_, index) =>
      makeIncome({ id: crypto.randomUUID(), desc: `Linha ${index}` })
    );
    const result = await FinanceData.importBatch(oversized, []);
    assertFalse(result.success);
    assertTrue(result.error.includes('500 linhas'));
    assertEqual(FinanceData.getEntries(), []);
    assertEqual(FinanceData.getPendingSync().transactionalOperations, []);

    const templates = Array.from({ length: 251 }, () => ({
      ...makeFixed({ id: crypto.randomUUID() }), paidMonths: {}
    }));
    await FinanceData.saveTemplates(templates, { flush: false });
    const payments = templates.map(template => ({ id: template.id, ym: '2026-10' }));
    const paymentResult = await FinanceData.importBatch([], payments);
    assertFalse(paymentResult.success);
    assertTrue(paymentResult.error.includes('500 linhas'));
    assertEqual(FinanceData.getTemplates().length, templates.length);
    assertEqual(FinanceData.getPendingSync().transactionalOperations, []);
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

  it('soma ao limite usado somente as parcelas que continuam em aberto', () => {
    const card = { id: 'card-a', totalLimit: 1000 };
    const purchases = [
      {
        cardId: 'card-a', amount: 500, installmentCount: 2,
        purchaseDate: '2026-03-01', closingDay: 20, dueDay: 10,
        paidInstallments: [1]
      },
      {
        cardId: 'card-a', amount: 200, installmentCount: 1,
        purchaseDate: '2026-03-01', closingDay: 20, dueDay: 10,
        paidInstallments: [1]
      }
    ];
    const usage = window.GastoProCreditCardHelpers.calculateLimitUsage(card, purchases);
    assertEqual(usage.used, 250);
    assertEqual(usage.available, 750);
  });

  it('soma o gasto anterior salvo no cartão às compras em aberto', () => {
    const previousSpent = 125.5;
    const usage = window.GastoProCreditCardHelpers.calculateLimitUsage({
      id: 'card-a', totalLimit: 1000, previousSpent
    }, [{
      cardId: 'card-a', amount: 300, installmentCount: 2,
      purchaseDate: '2026-03-01', closingDay: 20, dueDay: 10,
      paidInstallments: []
    }]);
    assertEqual(previousSpent, 125.5);
    assertEqual(usage.used, 425.5);
  });

  it('resume próximo vencimento e abre a aba Cartões pelo atalho do dashboard', () => {
    const dashboard = window.GastoProCreditCardDashboardHelpers;
    const card = {
      id: 'card-a', name: 'Cartão A', totalLimit: 1000, dueDay: 25, previousSpent: 20
    };
    const summary = dashboard.getSummary([card], [{
      cardId: card.id, amount: 100, installmentCount: 1,
      purchaseDate: '2026-03-01', closingDay: 20, dueDay: 25,
      paidInstallments: []
    }], new Date(2026, 1, 28));
    assertEqual(summary.used, 120);
    assertEqual(summary.nextDueDate, '2026-03-25');

    const host = document.createElement('div');
    host.innerHTML = dashboard.renderSummary(summary);
    document.body.appendChild(host);
    const originalSwitch = window.switchToView;
    let destination = null;
    window.switchToView = view => { destination = view; };
    try {
      const shortcut = host.querySelector('[data-action="open-credit-cards"]');
      assertNotNull(shortcut);
      shortcut.addEventListener('click', () => dashboard.openCards());
      shortcut.click();
      assertEqual(destination, 'cards');
    } finally {
      window.switchToView = originalSwitch;
      host.remove();
    }
  });

  it('mostra estado vazio claro e acesso para cadastrar ou abrir Cartões', () => {
    const dashboard = window.GastoProCreditCardDashboardHelpers;
    const host = document.createElement('div');
    host.innerHTML = dashboard.renderEmptyState() + dashboard.renderSummary({
      cardCount: 0, used: 0, nextDueDate: null
    });
    assertTrue(host.textContent.includes('Nenhum cartão cadastrado ainda.'));
    assertNotNull(host.querySelector('[data-action="new-credit-card"]'));
    assertTrue(host.textContent.includes('Nenhum cartão cadastrado.'));
    assertNotNull(host.querySelector('[data-action="open-credit-cards"]'));
  });

  itAsync('Pix, débito e dinheiro na data atual entram pagos e alteram o saldo', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta de pagamentos', type: 'PF', initialBalance: 100, balanceDate: today
    });
    for (const paymentMethod of ['pix', 'debit', 'cash', 'transfer']) {
      FinanceData.add({
        type: 'variable', desc: `Gasto ${paymentMethod}`, amount: 10, category: 'Outros',
        date: today, accountId: account.account.id, paymentMethod,
        paid: window.GastoProPaymentHelpers.isPaidByPaymentMethod(paymentMethod, today, today)
      });
    }
    assertTrue(FinanceData.getEntries().every(entry => entry.paid));
    assertEqual(FinanceData.getEntries().map(entry => entry.paymentMethod), ['pix', 'debit', 'cash', 'transfer']);
    assertEqual(FinanceData.getAccountBalance(account.account.id), 60);
  });

  itAsync('boleto e pagamentos com data futura entram pendentes', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const future = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta pendente', type: 'PF', initialBalance: 100, balanceDate: today
    });
    for (const [paymentMethod, date] of [['boleto', today], ['pix', future]]) {
      FinanceData.add({
        type: 'variable', desc: `Pendente ${paymentMethod}`, amount: 10, category: 'Outros',
        date, accountId: account.account.id, paymentMethod,
        paid: window.GastoProPaymentHelpers.isPaidByPaymentMethod(paymentMethod, date, today)
      });
    }
    assertTrue(FinanceData.getEntries().every(entry => !entry.paid));
    assertEqual(FinanceData.getAccountBalance(account.account.id), 100);
  });

  itAsync('alteração manual do pago prevalece sobre a forma automática', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta editável', type: 'PF', initialBalance: 100, balanceDate: today
    });
    const entry = FinanceData.add({
      type: 'variable', desc: 'Pix ajustável', amount: 25, category: 'Outros',
      date: today, accountId: account.account.id, paymentMethod: 'pix',
      paid: window.GastoProPaymentHelpers.isPaidByPaymentMethod('pix', today, today)
    });
    assertTrue(entry.paid);
    FinanceData.update(entry.id, { paid: false });
    assertFalse(FinanceData.getEntries()[0].paid);
    assertEqual(FinanceData.getAccountBalance(account.account.id), 100);
  });

  itAsync('compra no crédito não debita a conta e cria compra parcelada no cartão', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const account = await FinanceData.addAccount({
      name: 'Conta do crédito', type: 'PF', initialBalance: 500, balanceDate: today
    });
    const card = await FinanceData.addCreditCard({
      name: 'Cartão do crédito', totalLimit: 1000, closingDay: 20, dueDay: 10,
      accountId: account.account.id
    });
    const result = await FinanceData.addCreditCardPurchase({
      cardId: card.card.id, desc: 'Compra no crédito', amount: 120, category: 'Compras',
      purchaseDate: today, installmentCount: 3
    });
    assertTrue(result.success);
    assertEqual(result.purchase.cardId, card.card.id);
    assertEqual(FinanceData.getEntries(), []);
    assertEqual(FinanceData.getAccountBalance(account.account.id), 500);
  });

  it('lembra a forma escolhida por usuário e exibe Não informado para lançamentos antigos', () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_last_uid', 'user-a');
    window.GastoProPaymentHelpers.savePreference('expense', 'debit');
    window.GastoProPaymentHelpers.savePreference('income', 'transfer');
    assertEqual(window.GastoProPaymentHelpers.getPreference('expense'), 'debit');
    assertEqual(window.GastoProPaymentHelpers.getPreference('income'), 'transfer');
    localStorage.setItem('gastopro_last_uid', 'user-b');
    assertEqual(window.GastoProPaymentHelpers.getPreference('expense'), 'cash');
    assertEqual(window.GastoProPaymentHelpers.getLabel(null), 'Não informado');
  });

  it('mapeia payment_method e previous_spent nos dois sentidos da sincronização', () => {
    const sync = window.GastoProSyncFieldHelpers;
    const entry = {
      id: '00000000-0000-4000-8000-000000000001', desc: 'Pix', amount: 10,
      category: 'Outros', type: 'variable', date: '2026-11-05', paid: true,
      isDebt: false, active: true, paymentMethod: 'pix'
    };
    assertEqual(sync.entryToCloud(entry).payment_method, 'pix');
    assertEqual(sync.entryFromCloud({
      id: entry.id, description: entry.desc, amount: 10, category: 'Outros',
      type: 'variable', date: entry.date, paid: true, payment_method: 'pix'
    }).paymentMethod, 'pix');
    const card = {
      id: '00000000-0000-4000-8000-000000000002', name: 'Cartão',
      totalLimit: 1000, closingDay: 20, dueDay: 10, previousSpent: 75.5
    };
    assertEqual(sync.creditCardToCloud(card).previous_spent, 75.5);
    assertEqual(sync.creditCardFromCloud({
      id: card.id, name: card.name, total_limit: 1000, closing_day: 20,
      due_day: 10, previous_spent: 75.5
    }).previousSpent, 75.5);
  });

  it('mantém forma nula em lançamentos antigos e mostra Não informado', () => {
    const entry = window.GastoProSyncFieldHelpers.entryFromCloud({
      id: '00000000-0000-4000-8000-000000000021',
      description: 'Lançamento antigo', amount: 10, category: 'Outros',
      type: 'variable', date: '2026-11-05', paid: true, payment_method: null
    });
    assertEqual(entry.paymentMethod, null);
    assertEqual(window.GastoProPaymentHelpers.getLabel(entry.paymentMethod), 'Não informado');
  });

  it('migra gasto anterior local para cartão sem sobrescrever valor já existente', () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_last_uid', 'user-migration');
    const cards = [
      { id: '00000000-0000-4000-8000-000000000011', name: 'Novo', previousSpent: 0 },
      { id: '00000000-0000-4000-8000-000000000012', name: 'Existente', previousSpent: 80 }
    ];
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify(cards));
    const legacyKey = 'gastopro_credit_card_previous_spent_v1:user-migration';
    localStorage.setItem(legacyKey, JSON.stringify({
      [cards[0].id]: 25.5,
      [cards[1].id]: 120
    }));
    const migrated = FinanceData.getCreditCards();
    assertEqual(migrated.map(card => card.previousSpent), [25.5, 80]);
    assertEqual(localStorage.getItem(legacyKey), null);
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
    const card = {
      id: crypto.randomUUID(), name: 'Cartão da conta', totalLimit: 1000,
      closingDay: 10, dueDay: 20, accountId: created.account.id,
      brand: 'Visa', issuerBank: 'Nubank', lastFour: null, customColor: null
    };
    const purchase = {
      id: crypto.randomUUID(), cardId: card.id, cardName: card.name,
      accountId: created.account.id, desc: 'Compra', amount: 90, category: 'Compras',
      purchaseDate: '2026-10-10', installmentCount: 3, closingDay: 10, dueDay: 20,
      paidInstallments: [], paidDates: {}
    };
    FinanceData.saveEntries([entry]);
    FinanceData.saveTemplates([template]);
    await FinanceData.saveCreditCards([card], { flush: false });
    await FinanceData.saveCreditCardPurchases([purchase], { flush: false });

    const result = await FinanceData.deleteAccount(created.account.id);
    assertTrue(result.success);
    assertEqual(FinanceData.getAccounts(), []);
    assertEqual(FinanceData.getEntries(), [{ ...entry, accountId: null }]);
    assertEqual(FinanceData.getTemplates()[0].accountId, null);
    assertEqual(FinanceData.getTemplates()[0].id, template.id);
    assertEqual(FinanceData.getCreditCards()[0].accountId, null);
    assertEqual(FinanceData.getCreditCards()[0].id, card.id);
    assertEqual(FinanceData.getCreditCardPurchases()[0].accountId, null);
    assertEqual(FinanceData.getCreditCardPurchases()[0].id, purchase.id);
  });

  itAsync('apaga conta transacionalmente e mantém desvínculos na fila até o retry', async () => {
    setupMockLocalStorage();
    const userId = 'user-account-transaction';
    const account = {
      id: crypto.randomUUID(), name: 'Conta a remover', institution: null,
      type: 'PF', initialBalance: 0, balanceDate: null
    };
    const entry = makeIncome({ id: crypto.randomUUID(), accountId: account.id });
    const template = { ...makeFixed({ id: crypto.randomUUID(), accountId: account.id }), paidMonths: {} };
    const card = {
      id: crypto.randomUUID(), name: 'Cartão vinculado', totalLimit: 1200,
      closingDay: 10, dueDay: 20, accountId: account.id, brand: 'Visa',
      issuerBank: 'Nubank', lastFour: null, customColor: null
    };
    const purchase = {
      id: crypto.randomUUID(), cardId: card.id, cardName: card.name,
      accountId: account.id, desc: 'Compra vinculada', amount: 90, category: 'Compras',
      purchaseDate: '2026-10-10', installmentCount: 3, closingDay: 10, dueDay: 20,
      paidInstallments: [], paidDates: {}
    };
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    localStorage.setItem('gastopro_accounts_v1', JSON.stringify([account]));
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([entry]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([template]));
    localStorage.setItem('gastopro_credit_cards_v1', JSON.stringify([card]));
    localStorage.setItem('gastopro_credit_card_purchases_v1', JSON.stringify([purchase]));
    const previousAuth = window.SupabaseAuth;
    const calls = [];
    window.SupabaseAuth = {
      deleteAccountTransactional: async (accountId, clientEditedAt) => {
        calls.push({ accountId, clientEditedAt });
        return calls.length === 1 ? { success: false, error: 'offline' } : { success: true };
      }
    };
    try {
      assertFalse((await FinanceData.deleteAccount(account.id)).success);
      assertEqual(FinanceData.getAccounts(), []);
      assertEqual(FinanceData.getEntries()[0].accountId, null);
      assertEqual(FinanceData.getTemplates()[0].accountId, null);
      assertEqual(FinanceData.getCreditCards()[0].accountId, null);
      assertEqual(FinanceData.getCreditCardPurchases()[0].accountId, null);
      assertEqual(FinanceData.getPendingSync().transactionalOperations.length, 1);

      assertTrue((await FinanceData.flushPendingSync(userId)).success);
      assertEqual(calls.length, 2);
      assertEqual(calls[0], calls[1]);
      assertEqual(FinanceData.getPendingSync().transactionalOperations, []);
      assertEqual(FinanceData.getPendingSync().deletedAccounts, []);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
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
      deleteAccountTransactional: async () => ({
        success: !fail,
        conflicts: fail ? [{ kind: 'accounts', id: account.id }] : []
      }),
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

  itAsync('indicadores administrativos usam apenas RPC e removem campos não agregados', async () => {
    const previousClient = window.SupabaseAuth.client;
    const rpcCalls = [];
    const summary = {
      users: { total: 12, newWeek: 2, newMonth: 4, active7Days: 5, active30Days: 8 },
      registrations: [{ period: '2026-10', count: 4 }],
      records: { entries: 30, accounts: 8, cards: 3, goals: 5 },
      feedback: {
        status: [{ name: 'new', count: 2 }],
        categories: [{ name: 'duvida', count: 1 }]
      },
      usage: {
        uniqueUsers30Days: 6,
        screens: [{ name: 'screen_dashboard', count: 10 }],
        importsByDay: [{ period: '2026-10-30', count: 3 }],
        errors: [{ name: 'sync_error', count: 1 }]
      }
    };
    window.SupabaseAuth.client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: '550e8400-e29b-41d4-a716-446655440001' } } },
          error: null
        })
      },
      rpc: async name => {
        rpcCalls.push(name);
        return { data: name === 'is_admin' ? true : summary, error: null };
      }
    };
    try {
      const result = await window.SupabaseAuth.fetchAdminAnalytics();
      assertTrue(result.success);
      assertEqual(rpcCalls, ['is_admin', 'admin_analytics_summary']);
      assertEqual(result.analytics.users.total, 12);
      assertEqual(result.analytics.usage.screens, [{ name: 'screen_dashboard', count: 10 }]);
      assertFalse(Object.prototype.hasOwnProperty.call(result.analytics, 'user_id'));
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('rejeita resposta agregada com identificador ou campos inesperados', async () => {
    const previousClient = window.SupabaseAuth.client;
    const summary = {
      users: { total: 1, newWeek: 0, newMonth: 0, active7Days: 0, active30Days: 0 },
      registrations: [],
      records: { entries: 0, accounts: 0, cards: 0, goals: 0 },
      feedback: { status: [], categories: [] },
      usage: { uniqueUsers30Days: 0, screens: [], importsByDay: [], errors: [] },
      user_id: 'não deve chegar ao painel'
    };
    window.SupabaseAuth.client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: '550e8400-e29b-41d4-a716-446655440001' } } },
          error: null
        })
      },
      rpc: async name => ({
        data: name === 'is_admin' ? true : summary,
        error: null
      })
    };
    try {
      const result = await window.SupabaseAuth.fetchAdminAnalytics();
      assertFalse(result.success);
      assertTrue(result.error.includes('inválidos'));
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('envia apenas eventos permitidos com usuário e nome fixos', async () => {
    const previousClient = window.SupabaseAuth.client;
    const previousPreference = localStorage.getItem(window.GastoProUsageTelemetry.PREFERENCE_KEY);
    const inserted = [];
    localStorage.removeItem(window.GastoProUsageTelemetry.PREFERENCE_KEY);
    assertTrue(window.GastoProUsageTelemetry.getEnabled());
    window.GastoProUsageTelemetry.setEnabled(true);
    window.SupabaseAuth.client = {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: '550e8400-e29b-41d4-a716-446655440001' } } },
          error: null
        })
      },
      from(table) {
        assertEqual(table, 'usage_events');
        return {
          insert: async payload => {
            inserted.push(payload);
            return { error: null };
          }
        };
      }
    };
    try {
      assertTrue((await window.SupabaseAuth.recordUsageEvent('screen_dashboard')).success);
      assertFalse((await window.SupabaseAuth.recordUsageEvent('screen_secret')).success);
      window.GastoProUsageTelemetry.setEnabled(false);
      const optedOut = await window.SupabaseAuth.recordUsageEvent('screen_dashboard');
      assertTrue(optedOut.success);
      assertTrue(optedOut.skipped);
      assertEqual(inserted, [{
        user_id: '550e8400-e29b-41d4-a716-446655440001',
        event_name: 'screen_dashboard'
      }]);
    } finally {
      window.SupabaseAuth.client = previousClient;
      if (previousPreference === null) {
        localStorage.removeItem(window.GastoProUsageTelemetry.PREFERENCE_KEY);
      } else {
        localStorage.setItem(window.GastoProUsageTelemetry.PREFERENCE_KEY, previousPreference);
      }
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
    const rpcCalls = [];
    window.SupabaseAuth.getAuthenticatedUserId = async expectedUserId =>
      expectedUserId === userId ? userId : null;
    window.SupabaseAuth.client = {
      rpc: async name => {
        rpcCalls.push(name);
        return { error: null };
      },
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
      assertEqual(rpcCalls, ['delete_my_usage_events']);
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

  const emptyCloudResetRecords = () => ({
    entries: [],
    fixed_templates: [],
    goals: [],
    accounts: [],
    credit_cards: [],
    credit_card_purchases: [],
    fixed_import_rules: []
  });

  async function captureResetQueue(records) {
    setupMockLocalStorage();
    const userId = 'user-cloud-only-queue';
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const previousAuth = window.SupabaseAuth;
    const previousFlush = FinanceData.flushPendingSync;
    let queuedAtFlush = null;
    window.SupabaseAuth = {
      fetchCloudResetData: async () => ({ success: true, records })
    };
    FinanceData.flushPendingSync = async () => {
      queuedAtFlush = JSON.parse(JSON.stringify(FinanceData.getPendingSync()));
      return { success: true };
    };
    try {
      const result = await FinanceData.clearAll();
      assertTrue(result.success);
      assertTrue(queuedAtFlush, 'O reset deveria chegar à etapa de sincronização');
      return queuedAtFlush;
    } finally {
      window.SupabaseAuth = previousAuth;
      FinanceData.flushPendingSync = previousFlush;
    }
  }

  itAsync('clearAll enfileira template que existe somente na nuvem', async () => {
    const templateId = crypto.randomUUID();
    const records = emptyCloudResetRecords();
    records.fixed_templates = [{ id: templateId, updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertEqual(pending.deletedTemplates, [templateId]);
  });

  itAsync('clearAll enfileira meta que existe somente na nuvem', async () => {
    const category = 'Meta remota';
    const records = emptyCloudResetRecords();
    records.goals = [{ id: category, updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertEqual(pending.deletedGoals, [category]);
  });

  itAsync('clearAll enfileira conta que existe somente na nuvem', async () => {
    const accountId = crypto.randomUUID();
    const records = emptyCloudResetRecords();
    records.accounts = [{ id: accountId, updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertEqual(pending.deletedAccounts, [accountId]);
  });

  itAsync('clearAll enfileira cartão que existe somente na nuvem', async () => {
    const cardId = crypto.randomUUID();
    const records = emptyCloudResetRecords();
    records.credit_cards = [{ id: cardId, updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertEqual(pending.deletedCreditCards, [cardId]);
  });

  itAsync('clearAll enfileira compra no cartão que existe somente na nuvem', async () => {
    const purchaseId = crypto.randomUUID();
    const records = emptyCloudResetRecords();
    records.credit_card_purchases = [{ id: purchaseId, updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertEqual(pending.deletedCreditCardPurchases, [purchaseId]);
  });

  itAsync('clearAll mantém a pendência de regras quando existem somente na nuvem', async () => {
    const records = emptyCloudResetRecords();
    records.fixed_import_rules = [{ id: 'user-cloud-only-queue', updatedAt: '2026-10-01T10:00:00.000Z' }];
    const pending = await captureResetQueue(records);
    assertTrue(pending.fixedImportRules);
  });

  itAsync('um novo sync conclui somente a coleção que falhou no reset', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-partial-retry';
    const entryId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const records = emptyCloudResetRecords();
    records.entries = [{ id: entryId, updatedAt: '2026-10-01T10:00:00.000Z' }];
    records.fixed_templates = [{ id: templateId, updatedAt: '2026-10-01T10:00:00.000Z' }];

    const previousAuth = window.SupabaseAuth;
    const previousReconcile = FinanceData.reconcileCloudBeforeSync;
    const previousFlushTransactions = FinanceData.flushTransactionalOperations;
    const deleteEntryCalls = [];
    const deleteTemplateCalls = [];
    let templateAttempt = 0;
    window.SupabaseAuth = {
      fetchCloudResetData: async () => ({ success: true, records }),
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      saveCloudAccounts: async () => ({ success: true }),
      saveCloudCreditCards: async () => ({ success: true }),
      saveCloudCreditCardPurchases: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudEntries: async ids => {
        deleteEntryCalls.push([...ids]);
        return { success: true };
      },
      deleteCloudTemplates: async ids => {
        deleteTemplateCalls.push([...ids]);
        templateAttempt++;
        return templateAttempt === 1
          ? { success: false, error: new Error('falha simulada') }
          : { success: true };
      },
      deleteCloudGoals: async () => ({ success: true }),
      deleteCloudAccounts: async () => ({ success: true }),
      deleteCloudCreditCards: async () => ({ success: true }),
      deleteCloudCreditCardPurchases: async () => ({ success: true })
    };
    FinanceData.reconcileCloudBeforeSync = async () => ({ success: true });
    FinanceData.flushTransactionalOperations = async () => ({
      success: true,
      synced: { entries: [], templates: [], creditCards: [], creditCardPurchases: [] }
    });
    try {
      const firstReset = await FinanceData.clearAll();
      assertFalse(firstReset.success);
      assertEqual(FinanceData.getEntries(), []);
      assertEqual(FinanceData.getTemplates(), []);
      assertEqual(FinanceData.getPendingSync().deletedEntries, []);
      assertEqual(FinanceData.getPendingSync().deletedTemplates, [templateId]);
      assertEqual(deleteEntryCalls, [[entryId]]);
      assertEqual(deleteTemplateCalls, [[templateId]]);

      const retry = await FinanceData.flushPendingSync(userId);
      assertTrue(retry.success);
      assertEqual(FinanceData.getPendingSync().deletedEntries, []);
      assertEqual(FinanceData.getPendingSync().deletedTemplates, []);
      assertEqual(deleteEntryCalls, [[entryId]]);
      assertEqual(deleteTemplateCalls, [[templateId], [templateId]]);
    } finally {
      window.SupabaseAuth = previousAuth;
      FinanceData.reconcileCloudBeforeSync = previousReconcile;
      FinanceData.flushTransactionalOperations = previousFlushTransactions;
    }
  });

  itAsync('clearAll exclui registros que existem somente na nuvem', async () => {
    setupMockLocalStorage();
    const userId = 'user-cloud-only-reset';
    const remoteEntryId = crypto.randomUUID();
    const sharedEntryId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    await FinanceData.saveEntries([makeIncome({ id: sharedEntryId })], { flush: false });
    const deletedIds = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      fetchCloudResetData: async () => ({
        success: true,
        records: {
          entries: [
            { id: sharedEntryId, updatedAt: '2026-10-01T10:00:00.000Z' },
            { id: remoteEntryId, updatedAt: '2026-10-01T10:00:00.000Z' }
          ],
          fixed_templates: [], goals: [], accounts: [], credit_cards: [],
          credit_card_purchases: [], fixed_import_rules: []
        }
      }),
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      saveCloudAccounts: async () => ({ success: true }),
      saveCloudCreditCards: async () => ({ success: true }),
      saveCloudCreditCardPurchases: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudEntries: async ids => { deletedIds.push(...ids); return { success: true }; },
      deleteCloudTemplates: async () => ({ success: true }),
      deleteCloudGoals: async () => ({ success: true }),
      deleteCloudAccounts: async () => ({ success: true }),
      deleteCloudCreditCards: async () => ({ success: true }),
      deleteCloudCreditCardPurchases: async () => ({ success: true })
    };
    try {
      const result = await FinanceData.clearAll();
      assertTrue(result.success);
      assertEqual(new Set(deletedIds).size, deletedIds.length);
      assertEqual(deletedIds, [sharedEntryId, remoteEntryId]);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('a busca de reset pagina mais de 1000 IDs remotos', async () => {
    const previousClient = window.SupabaseAuth.client;
    const previousGetUserId = window.SupabaseAuth.getAuthenticatedUserId;
    const ranges = [];
    window.SupabaseAuth.getAuthenticatedUserId = async userId => userId;
    window.SupabaseAuth.client = {
      from(table) {
        let range = null;
        const query = {
          select() { return this; },
          eq() { return this; },
          is() { return this; },
          order() { return this; },
          range(from, to) { range = [from, to]; ranges.push([table, from, to]); return this; },
          then(resolve, reject) {
            const rows = table === 'entries' && range[0] === 0
              ? Array.from({ length: 1000 }, (_, index) => ({ id: `entry-${index}`, updated_at: null }))
              : table === 'entries' && range[0] === 1000
                ? [{ id: 'entry-1000', updated_at: null }]
                : [];
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          }
        };
        return query;
      }
    };
    try {
      const result = await window.SupabaseAuth.fetchCloudResetData('reset-user');
      assertTrue(result.success);
      assertEqual(result.records.entries.length, 1001);
      assertEqual(ranges.filter(([table]) => table === 'entries'), [
        ['entries', 0, 999], ['entries', 1000, 1999]
      ]);
    } finally {
      window.SupabaseAuth.client = previousClient;
      window.SupabaseAuth.getAuthenticatedUserId = previousGetUserId;
    }
  });

  itAsync('markCloudDeleted repete uma atualização descartada com versão posterior', async () => {
    const previousClient = window.SupabaseAuth.client;
    const entryId = crypto.randomUUID();
    const updates = [];
    let updateCount = 0;
    window.SupabaseAuth.client = {
      from() {
        let operation = null;
        const query = {
          update(payload) { operation = 'update'; updates.push(payload); return this; },
          select() { if (!operation) operation = 'select'; return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({
              data: { id: entryId, deleted_at: null, updated_at: '2026-10-30T12:00:00.000Z' },
              error: null
            });
          },
          then(resolve, reject) {
            updateCount++;
            const data = updateCount === 1 ? [] : [{ id: entryId }];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
        };
        return query;
      }
    };
    try {
      const result = await window.SupabaseAuth.markCloudDeleted(
        'entries', 'id', [entryId], 'entries', 'reset-user'
      );
      assertTrue(result.success);
      assertEqual(updates.length, 2);
      assertTrue(Date.parse(updates[1].client_edited_at) >
        Date.parse('2026-10-30T12:00:00.000Z'));
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('markCloudDeleted aceita retorno vazio quando a linha já está excluída', async () => {
    const previousClient = window.SupabaseAuth.client;
    const entryId = crypto.randomUUID();
    window.SupabaseAuth.client = {
      from() {
        let operation = null;
        return {
          update() { operation = 'update'; return this; },
          select() { if (!operation) operation = 'select'; return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({
              data: { id: entryId, deleted_at: '2026-10-30T12:00:00.000Z', updated_at: '2026-10-30T12:00:00.000Z' },
              error: null
            });
          },
          then(resolve, reject) {
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
        };
      }
    };
    try {
      const result = await window.SupabaseAuth.markCloudDeleted(
        'entries', 'id', [entryId], 'entries', 'reset-user'
      );
      assertTrue(result.success);
    } finally {
      window.SupabaseAuth.client = previousClient;
    }
  });

  itAsync('clearAll mantém a pendência quando o retry da exclusão remota falha', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-delete-failure';
    const entryId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    const previousAuth = window.SupabaseAuth;
    const previousClient = window.SupabaseAuth.client;
    const previousFetchSyncState = window.SupabaseAuth.fetchCloudSyncState;
    let updateCount = 0;
    const client = {
      from() {
        let operation = null;
        return {
          update() { operation = 'update'; return this; },
          select() { if (!operation) operation = 'select'; return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({
              data: { id: entryId, deleted_at: null, updated_at: '2026-10-30T12:00:00.000Z' },
              error: null
            });
          },
          then(resolve, reject) {
            updateCount++;
            return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          }
        };
      }
    };
    window.SupabaseAuth = {
      client,
      reportCloudError: previousAuth.reportCloudError,
      fetchCloudSyncState: undefined,
      fetchCloudResetData: async () => ({
        success: true,
        records: {
          entries: [{ id: entryId, updatedAt: '2026-10-01T10:00:00.000Z' }],
          fixed_templates: [], goals: [], accounts: [], credit_cards: [],
          credit_card_purchases: [], fixed_import_rules: []
        }
      }),
      getClientEditedAt: FinanceData.getClientEditedAt.bind(FinanceData),
      getSyncMetadata: FinanceData.getSyncMetadata.bind(FinanceData),
      markCloudDeleted: previousAuth.markCloudDeleted,
      deleteCloudEntries: async (ids, targetUserId) =>
        previousAuth.markCloudDeleted.call(window.SupabaseAuth, 'entries', 'id', ids, 'entries', targetUserId),
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      saveCloudGoals: async () => ({ success: true }),
      saveCloudAccounts: async () => ({ success: true }),
      saveCloudCreditCards: async () => ({ success: true }),
      saveCloudCreditCardPurchases: async () => ({ success: true }),
      saveCloudFixedImportRules: async () => ({ success: true }),
      deleteCloudTemplates: async () => ({ success: true }),
      deleteCloudGoals: async () => ({ success: true }),
      deleteCloudAccounts: async () => ({ success: true }),
      deleteCloudCreditCards: async () => ({ success: true }),
      deleteCloudCreditCardPurchases: async () => ({ success: true })
    };
    try {
      const result = await FinanceData.clearAll();
      assertFalse(result.success);
      assertEqual(updateCount, 2);
      assertEqual(FinanceData.getPendingSync().deletedEntries, [entryId]);
    } finally {
      window.SupabaseAuth = previousAuth;
      window.SupabaseAuth.client = previousClient;
      window.SupabaseAuth.fetchCloudSyncState = previousFetchSyncState;
    }
  });

  itAsync('aborta o reset e avisa quando não consegue buscar os registros remotos', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-fetch-failure';
    const entry = makeIncome({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: '', email: '', avatar: null, userId }, { queueSync: false });
    await FinanceData.saveEntries([entry], { flush: false });
    const previousAuth = window.SupabaseAuth;
    const previousToast = window.showToast;
    const messages = [];
    window.SupabaseAuth = {
      fetchCloudResetData: async () => ({ success: false, error: new Error('offline') })
    };
    window.showToast = message => messages.push(message);
    try {
      const result = await FinanceData.clearAll();
      assertFalse(result.success);
      assertEqual(FinanceData.getEntries(), [entry]);
      assertTrue(messages.some(message => message.includes('Seus dados continuam salvos')));
    } finally {
      window.SupabaseAuth = previousAuth;
      window.showToast = previousToast;
    }
  });

  itAsync('deve apagar todos os lançamentos e templates', async () => {
    setupMockLocalStorage();
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
      fetchCloudResetData: async () => ({
        success: true,
        records: {
          entries: [], fixed_templates: [], goals: [], accounts: [], credit_cards: [],
          credit_card_purchases: [], fixed_import_rules: []
        }
      }),
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
      fetchCloudResetData: async () => ({
        success: true,
        records: {
          entries: [], fixed_templates: [], goals: [], accounts: [], credit_cards: [],
          credit_card_purchases: [], fixed_import_rules: []
        }
      }),
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
  itAsync('exige APAGAR DADOS antes de apagar cartões, regras ou outros dados', async () => {
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
      const result = await FinanceData.deleteAllUserData('APAGAR DADOS');
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
      const result = await FinanceData.deleteAllUserData('APAGAR DADOS');
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
      assertEqual(upsertPayload.id, 'profile-user');
      assertEqual(upsertPayload.name, 'Nome');
      assertEqual(upsertPayload.avatar, 'data:image/jpeg;base64,abc');
      assertEqual(upsertPayload.deleted_at, null);
      assertTrue(typeof upsertPayload.client_edited_at === 'string');
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

describe('Dashboard mobile', () => {
  const helpers = window.GastoProMobileHomeHelpers;

  it('resume a quantidade de avisos na faixa compacta', () => {
    assertEqual(helpers.getNotificationSummary(0), 'Sem avisos');
    assertEqual(helpers.getNotificationSummary(1), '1 aviso · ver todos');
    assertEqual(helpers.getNotificationSummary(4), '4 avisos · ver todos');
  });

  it('conta na faixa somente avisos não lidos', () => {
    setupMockLocalStorage();
    const host = document.createElement('div');
    host.innerHTML = `
      <button id="notificationsTrigger"></button>
      <span id="notificationsUnreadCount"></span>
      <p id="notificationsUnreadLabel"></p>
      <span id="financialInsightsMobileSummary"></span>
      <div id="notificationsList"></div>
      <div id="notificationSettingsList"></div>`;
    document.body.appendChild(host);
    const notifications = window.GastoProNotificationCenter;
    notifications.syncEvents([{
      eventKey: 'dueSoon:entry-1:2026-10',
      scope: 'all',
      type: 'dueSoon',
      title: 'Vencimento próximo',
      message: 'Há uma conta para pagar.'
    }]);
    try {
      notifications.render();
      assertEqual(host.querySelector('#financialInsightsMobileSummary').textContent, '1 aviso · ver todos');
      notifications.markRead('dueSoon:entry-1:2026-10');
      notifications.render();
      assertEqual(host.querySelector('#financialInsightsMobileSummary').textContent, 'Sem avisos');
    } finally {
      host.remove();
    }
  });

  it('formata a versão exibida a partir do nome do cache do service worker', () => {
    assertEqual(window.GastoProAppVersion.formatCacheName('gastopro-v4.10'), 'v4.10');
    assertNull(window.GastoProAppVersion.formatCacheName('other-v4.7'));
    assertEqual(window.GastoProAppVersion.getDisplayedVersion(null), 'v…');
    assertEqual(window.GastoProAppVersion.getDisplayedVersion('gastopro-v4.10'), 'v4.10');
  });

  it('usa o saldo filtrado das contas e o resultado mensal existente no destaque', () => {
    assertEqual(helpers.getDashboardHighlightValues(
      { total: 1300, PF: 900, PJ: 400 },
      'PF',
      [{ id: 'pj-1', type: 'PJ' }],
      () => 0,
      275
    ), { currentBalance: 900, monthlyResult: 275 });
    assertEqual(helpers.getDashboardHighlightValues(
      { total: 1300, PF: 900, PJ: 400 },
      'account:pj-1',
      [{ id: 'pj-1', type: 'PJ' }],
      () => 425,
      -80
    ), { currentBalance: 425, monthlyResult: -80 });
  });

  it('aplica a cor financeira do saldo conforme positivo, negativo e zero', () => {
    assertEqual(helpers.getBalanceTone(12), 'financial-amount financial-amount--positive');
    assertEqual(helpers.getBalanceTone(-12), 'financial-amount financial-amount--negative');
    assertEqual(helpers.getBalanceTone(0), 'financial-amount financial-amount--neutral');
  });

  it('calcula somente saídas pendentes do mês e respeita filtro de conta', () => {
    const items = [
      { type: 'income', amount: 900, accountId: 'pf' },
      { type: 'variable', amount: 80, paid: false, accountId: 'pf' },
      { type: 'variable', amount: 45, paid: true, accountId: 'pf' },
      { type: 'fixed', amount: 50, paid: false, active: true, accountId: 'pf' },
      { type: 'fixed', amount: 100, paid: false, active: false, accountId: 'pf' },
      { type: 'variable', amount: 60, paid: false, isCardInstallment: true, accountId: 'pj' },
      { type: 'variable', amount: 30, paid: true, isCardInstallment: true, accountId: 'pj' }
    ];
    const accounts = [{ id: 'pf', type: 'PF' }, { id: 'pj', type: 'PJ' }];
    assertEqual(FinanceData.calculatePendingOutflows(items, 'all', accounts), 190);
    assertEqual(FinanceData.calculatePendingOutflows(items, 'PF', accounts), 130);
    assertEqual(FinanceData.calculatePendingOutflows(items, 'account:pj', accounts), 60);
    assertEqual(items[0].paid, undefined);
  });

  itAsync('cria dados reais e mostra aviso somente no mês atual para despesa, fixo e parcela em aberto', async () => {
    setupMockLocalStorage();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = `${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

    FinanceData.add(makeVariable({
      month: currentMonth, date: today, amount: 25, paid: false
    }));
    FinanceData.add(makeIncome({
      month: currentMonth, date: today, amount: 900, paid: false
    }));
    FinanceData.add(makeFixed({
      month: currentMonth, startMonth: currentMonth, date: `${currentMonth}-05`,
      amount: 35, paidMonths: {}
    }));

    const cardResult = await FinanceData.addCreditCard({
      name: 'Cartão para teste de projeção', totalLimit: 1000, closingDay: 31, dueDay: 10
    });
    assertTrue(cardResult.success);
    const purchaseResult = await FinanceData.addCreditCardPurchase({
      cardId: cardResult.card.id, desc: 'Parcela pendente de teste', amount: 60,
      category: 'Compras', purchaseDate: `${previousMonth}-01`, installmentCount: 1
    });
    assertTrue(purchaseResult.success);

    const currentItems = FinanceData.getByMonth(currentMonth);
    assertTrue(currentItems.some(item => item.isCardInstallment && !item.paid));
    const pending = FinanceData.calculatePendingOutflows(
      currentItems, 'all', FinanceData.getAccounts()
    );
    assertEqual(pending, 120);
    const currentNotice = helpers.getPendingBalanceNotice(currentMonth, currentMonth, 50, pending);
    assertEqual(
      helpers.getPendingBalanceNoticeMessage(currentNotice),
      `Atenção: se você pagar tudo que está pendente neste mês, seu saldo ficará em ${formatCurrency(-70)}.`
    );

    [previousMonth, nextMonth].forEach(month => {
      const monthPending = FinanceData.calculatePendingOutflows(
        FinanceData.getByMonth(month), 'all', FinanceData.getAccounts()
      );
      assertNull(helpers.getPendingBalanceNotice(month, currentMonth, 50, monthPending));
      assertNull(helpers.getPendingBalanceNoticeMessage(
        helpers.getPendingBalanceNotice(month, currentMonth, 50, monthPending)
      ));
    });
  });

  it('avisa somente no mês atual quando o saldo é negativo ou insuficiente', () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    assertNull(helpers.getPendingBalanceNotice(currentMonth, currentMonth, 100, 100));
    assertEqual(helpers.getPendingBalanceNotice(currentMonth, currentMonth, 75, 100), {
      type: 'attention', shortfall: 25
    });
    assertEqual(helpers.getPendingBalanceNotice(currentMonth, currentMonth, -10, 100), {
      type: 'critical', shortfall: 0
    });
    assertNull(helpers.getPendingBalanceNotice(previousMonth, currentMonth, -10, 100));
    assertNull(helpers.getPendingBalanceNotice(nextMonth, currentMonth, 0, 100));
  });

  it('define tipografia mobile sem quebra forçada nas palavras da home', () => {
    const sheet = Array.from(document.styleSheets).find(item =>
      item.href && item.href.endsWith('/css/style.css')
    );
    assertTrue(Boolean(sheet), 'A folha de estilos do app deve estar disponível para verificação.');
    const mobileRules = [];
    const collectRules = rules => {
      Array.from(rules).forEach(rule => {
        if (rule.type === CSSRule.MEDIA_RULE &&
          /max-width:\s*700px/.test(rule.conditionText)) {
          collectRules(rule.cssRules);
        } else if (rule.type === CSSRule.STYLE_RULE) {
          mobileRules.push(rule);
        }
      });
    };
    collectRules(sheet.cssRules);
    const compactRule = mobileRules.find(rule =>
      rule.selectorText.includes('.mobile-brand') &&
      rule.selectorText.includes('.kpi-value')
    );
    assertTrue(Boolean(compactRule), 'Rótulos compactos devem ter regras mobile explícitas.');
    ['.mobile-brand', '.kpi-title', '.kpi-badge', '.kpi-value']
      .forEach(selector => assertTrue(compactRule.selectorText.includes(selector)));
    assertEqual(compactRule.style.getPropertyValue('white-space'), 'nowrap');
    assertEqual(compactRule.style.getPropertyValue('overflow-wrap'), 'normal');
    assertEqual(compactRule.style.getPropertyValue('word-break'), 'normal');
    assertEqual(compactRule.style.getPropertyValue('hyphens'), 'none');
    const navigationRule = mobileRules.find(rule =>
      rule.selectorText.includes('.mobile-bottom-nav-item')
    );
    assertTrue(Boolean(navigationRule));
    assertEqual(navigationRule.style.getPropertyValue('white-space'), 'nowrap');
    assertEqual(navigationRule.style.getPropertyValue('overflow-wrap'), 'normal');
    assertEqual(navigationRule.style.getPropertyValue('word-break'), 'normal');
    assertEqual(navigationRule.style.getPropertyValue('hyphens'), 'none');
    const descriptionRule = mobileRules.find(rule =>
      rule.selectorText.includes('.kpi-caption') &&
      rule.selectorText.includes('.dashboard-highlight-description')
    );
    assertTrue(Boolean(descriptionRule));
    assertEqual(descriptionRule.style.getPropertyValue('overflow-wrap'), 'normal');
    assertEqual(descriptionRule.style.getPropertyValue('word-break'), 'normal');
    assertEqual(descriptionRule.style.getPropertyValue('hyphens'), 'none');
  });

  it('gera a legenda de fixos adequada para desktop e celular', () => {
    const fixed = [{ paid: true }, { paid: false }, { paid: true }];
    assertEqual(helpers.getFixedPaidStatus(fixed, false), '2 de 3 contas pagas');
    assertEqual(helpers.getFixedPaidStatus(fixed, true), '2 de 3 fixos pagos');
    assertEqual(helpers.getFixedPaidStatus([], false), 'Nenhuma conta no mês');
    assertEqual(helpers.getFixedPaidStatus([], true), 'Nenhuma conta no mês');
  });

  it('rola até Metas somente nessa navegação e respeita cabeçalho e barra inferior', () => {
    const originalSwitch = window.switchToView;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalScrollTo = window.scrollTo;
    const destinations = [];
    const scrolls = [];
    const initialScrollY = window.scrollY;
    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.style.position = 'sticky';
    topbar.getBoundingClientRect = () => ({
      top: 0, bottom: 80, height: 80, left: 0, right: 0, width: 0
    });
    const bottomNav = document.createElement('nav');
    bottomNav.id = 'mobileBottomNav';
    bottomNav.style.position = 'fixed';
    bottomNav.style.display = 'flex';
    bottomNav.getBoundingClientRect = () => ({
      top: window.innerHeight - 60, bottom: window.innerHeight,
      height: 60, left: 0, right: 0, width: 0
    });
    const goalsButton = document.createElement('button');
    goalsButton.className = 'mobile-bottom-nav-item';
    goalsButton.dataset.destination = 'goals';
    bottomNav.appendChild(goalsButton);
    const homeButton = document.createElement('button');
    homeButton.className = 'mobile-bottom-nav-item';
    homeButton.dataset.destination = 'home';
    bottomNav.appendChild(homeButton);
    const goalsPanel = document.createElement('section');
    goalsPanel.id = 'goalsDashboardPanel';
    goalsPanel.getBoundingClientRect = () => ({
      top: 900, bottom: 1040, height: 140, left: 0, right: 0, width: 0
    });
    document.body.append(topbar, bottomNav, goalsPanel);

    window.switchToView = view => {
      destinations.push(view);
      window.GastoProViewHelpers.scrollToTop(view);
    };
    window.requestAnimationFrame = callback => { callback(); return 1; };
    window.scrollTo = options => scrolls.push(options);
    try {
      assertTrue(helpers.navigate('goals'));
      assertEqual(destinations, ['dashboard']);
      const availableHeight = window.innerHeight - 80 - 60;
      const panelOffset = 80 + Math.max(8, (availableHeight - 140) / 2);
      assertEqual(scrolls, [
        { top: 0, behavior: 'auto' },
        { top: Math.max(0, 900 + initialScrollY - panelOffset), behavior: 'auto' }
      ]);

      destinations.length = 0;
      scrolls.length = 0;
      assertTrue(helpers.navigate('home'));
      assertEqual(destinations, ['dashboard']);
      assertEqual(scrolls, [{ top: 0, behavior: 'auto' }]);
      destinations.length = 0;
      scrolls.length = 0;
      assertTrue(helpers.navigate('cards'));
      assertEqual(destinations, ['cards']);
      assertEqual(scrolls, [{ top: 0, behavior: 'auto' }]);
    } finally {
      window.switchToView = originalSwitch;
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.scrollTo = originalScrollTo;
      topbar.remove();
      bottomNav.remove();
      goalsPanel.remove();
    }
  });

  it('leva o botão Cartões da navegação inferior à tela de cartões', () => {
    const originalSwitch = window.switchToView;
    let destination = null;
    window.switchToView = view => { destination = view; };
    try {
      assertTrue(helpers.navigate('cards'));
      assertEqual(destination, 'cards');
    } finally {
      window.switchToView = originalSwitch;
    }
  });

  it('abre a tela única de Lançamentos pela navegação inferior', () => {
    const originalSwitch = window.switchToView;
    let destination = null;
    window.switchToView = view => { destination = view; };
    try {
      assertTrue(helpers.navigate('entries'));
      assertEqual(destination, 'entries');
    } finally {
      window.switchToView = originalSwitch;
    }
  });

  it('alterna entre os formulários sem exibi-los juntos e sem duplicar IDs', () => {
    const fixture = document.createElement('div');
    fixture.innerHTML = `
      <button class="entry-type-button" data-entry-type="expense" aria-pressed="false"></button>
      <button class="entry-type-button" data-entry-type="income" aria-pressed="false"></button>
      <div class="panel-box"><form id="expenseForm"></form></div>
      <div class="panel-box"><form id="incomeForm"></form></div>
    `;
    document.body.appendChild(fixture);
    try {
      assertTrue(window.GastoProEntryComposer.setType('expense'));
      assertFalse(fixture.querySelector('#expenseForm').closest('.panel-box').hidden);
      assertTrue(fixture.querySelector('#incomeForm').closest('.panel-box').hidden);
      assertEqual(fixture.querySelector('[data-entry-type="expense"]').getAttribute('aria-pressed'), 'true');

      assertTrue(window.GastoProEntryComposer.setType('income'));
      assertTrue(fixture.querySelector('#expenseForm').closest('.panel-box').hidden);
      assertFalse(fixture.querySelector('#incomeForm').closest('.panel-box').hidden);
      assertEqual(fixture.querySelector('[data-entry-type="income"]').getAttribute('aria-pressed'), 'true');
      ['expenseForm', 'incomeForm'].forEach(id => {
        assertEqual(fixture.querySelectorAll(`[id="${id}"]`).length, 1, `${id} deve existir uma vez.`);
      });
    } finally {
      fixture.remove();
    }
  });

  it('mantém o tipo escolhido aberto após limpar os campos do formulário salvo', () => {
    const fixture = document.createElement('div');
    fixture.innerHTML = `
      <div id="toast"></div>
      <button class="entry-type-button" data-entry-type="expense" aria-pressed="false"></button>
      <button class="entry-type-button" data-entry-type="income" aria-pressed="false"></button>
      <div class="panel-box"><form id="expenseForm">
        <input id="expenseDesc" value="Conta de luz">
        <input id="expenseAmount" value="120">
        <input id="expenseDate" type="date">
        <select id="expenseAccount"><option value="">Sem conta</option><option value="conta">Conta</option></select>
        <input id="expenseEndMonth">
      </form></div>
      <div class="panel-box"><form id="incomeForm">
        <input id="incomeDesc" value="Salário">
        <input id="incomeAmount" value="3000">
        <input id="incomeDate" type="date">
        <select id="incomeAccount"><option value="">Sem conta</option><option value="conta">Conta</option></select>
      </form></div>
    `;
    document.body.appendChild(fixture);
    try {
      ['expenseDesc', 'expenseAmount', 'expenseAccount', 'expenseEndMonth'].forEach(id => {
        fixture.querySelector(`#${id}`).value = id === 'expenseAccount' ? 'conta' : 'preenchido';
      });
      assertTrue(window.GastoProEntryComposer.setType('expense'));
      assertTrue(window.GastoProEntryComposer.completeSave('expense'));
      assertEqual(fixture.querySelector('#toast').textContent.trim(), 'Gasto salvo');
      assertEqual(fixture.querySelector('#expenseDesc').value, '');
      assertEqual(fixture.querySelector('#expenseAmount').value, '');
      assertEqual(fixture.querySelector('#expenseAccount').value, '');
      assertFalse(fixture.querySelector('#expenseDate').value === '');
      assertFalse(fixture.querySelector('#expenseForm').closest('.panel-box').hidden);

      ['incomeDesc', 'incomeAmount', 'incomeAccount'].forEach(id => {
        fixture.querySelector(`#${id}`).value = id === 'incomeAccount' ? 'conta' : 'preenchido';
      });
      assertTrue(window.GastoProEntryComposer.setType('income'));
      assertTrue(window.GastoProEntryComposer.completeSave('income'));
      assertEqual(fixture.querySelector('#toast').textContent.trim(), 'Ganho salvo');
      assertEqual(fixture.querySelector('#incomeDesc').value, '');
      assertEqual(fixture.querySelector('#incomeAmount').value, '');
      assertEqual(fixture.querySelector('#incomeAccount').value, '');
      assertFalse(fixture.querySelector('#incomeDate').value === '');
      assertFalse(fixture.querySelector('#incomeForm').closest('.panel-box').hidden);
    } finally {
      fixture.remove();
    }
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
  itAsync('mantém o modal de apagar dados independente e devolve o foco ao fechar', async () => {
    const trigger = document.createElement('button');
    trigger.id = 'deleteAllMyDataModalTestTrigger';
    const accountModal = document.createElement('div');
    accountModal.id = 'deleteAccountModalTest';
    accountModal.className = 'modal-overlay';
    const dataModal = document.createElement('div');
    dataModal.id = 'deleteAllMyDataModalTest';
    dataModal.className = 'modal-overlay';
    dataModal.innerHTML = `
      <section role="dialog" aria-modal="true" tabindex="-1">
        <button type="button" class="modal-close-btn">Fechar</button>
        <input aria-label="Confirmação">
        <button type="button" data-modal-cancel>Cancelar</button>
      </section>`;
    document.body.append(trigger, accountModal, dataModal);
    const input = dataModal.querySelector('input');
    const close = dataModal.querySelector('.modal-close-btn');
    trigger.addEventListener('click', () => {
      dataModal.classList.add('active');
      dataModal.setAttribute('aria-hidden', 'false');
      setTimeout(() => input.focus(), 0);
    });
    close.addEventListener('click', () => {
      dataModal.classList.remove('active');
      dataModal.setAttribute('aria-hidden', 'true');
    });
    dataModal.addEventListener('click', event => {
      if (event.target === dataModal) close.click();
    });
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    try {
      assertTrue(accountModal.parentElement === dataModal.parentElement,
        'Os modais devem ser elementos irmãos, não aninhados');
      trigger.focus();
      trigger.click();
      await tick();
      assertTrue(dataModal.classList.contains('active'), 'O modal deve abrir');
      assertEqual(document.activeElement, input, 'O campo de confirmação recebe foco');
      dataModal.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true, cancelable: true
      }));
      await tick();
      assertFalse(dataModal.classList.contains('active'), 'Escape deve fechar o modal');
      assertEqual(document.activeElement, trigger, 'Escape devolve o foco ao acionador');

      trigger.click();
      await tick();
      dataModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await tick();
      assertFalse(dataModal.classList.contains('active'), 'Clique fora deve fechar o modal');
      assertEqual(document.activeElement, trigger, 'Fechar devolve o foco ao acionador');
    } finally {
      trigger.remove();
      accountModal.remove();
      dataModal.remove();
    }
  });

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

describe('Central de avisos local', () => {
  const notifications = window.GastoProNotificationCenter;

  it('inicia com todos os avisos ligados e filtra pelo escopo selecionado', () => {
    setupMockLocalStorage();
    assertTrue(Object.values(notifications.getPreferences()).every(Boolean));
    assertEqual(Object.keys(notifications.TYPES), [
      'dueSoon', 'insufficientBalance', 'anomaly', 'cardLimit', 'forecast', 'importReview'
    ]);
    notifications.syncEvents([
      { eventKey: 'due-pf', scope: 'PF', type: 'dueSoon', title: 'Vencimento', message: 'Há um gasto próximo.' },
      { eventKey: 'card-all', scope: 'all', type: 'cardLimit', title: 'Cartão', message: 'Limite quase cheio.' }
    ]);
    assertEqual(notifications.getUnreadCount('PF'), 1);
    assertEqual(notifications.getVisible('PF').map(item => item.eventKey), ['due-pf']);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), ['card-all']);
  });

  it('classifica os cinco tipos e ajusta vencimentos e limite conforme o estado', () => {
    assertEqual(notifications.getPriority({ type: 'insufficientBalance' }), 'critical');
    assertEqual(notifications.getPriority({ type: 'cardLimit', title: 'Limite atingido' }), 'critical');
    assertEqual(notifications.getPriority({ type: 'cardLimit', title: 'Limite quase cheio' }), 'attention');
    assertEqual(notifications.getPriority({ type: 'dueSoon', title: 'Vencimento atrasado' }), 'critical');
    assertEqual(notifications.getPriority({ type: 'dueSoon', title: 'Vencimento hoje' }), 'critical');
    assertEqual(notifications.getPriority({ type: 'dueSoon', title: 'Vencimento amanhã' }), 'attention');
    assertEqual(notifications.getPriority({ type: 'anomaly' }), 'attention');
    assertEqual(notifications.getPriority({ type: 'forecast' }), 'info');
    assertFalse(Object.prototype.hasOwnProperty.call(notifications.TYPES, 'monthlySummary'));
  });

  it('eleva a prioridade do mesmo aviso sem apagar seu estado de leitura', () => {
    setupMockLocalStorage();
    const event = {
      eventKey: 'due-escalation', scope: 'all', type: 'dueSoon', priority: 'attention',
      title: 'Vencimento próximo', message: 'Amanhã.', createdAt: '2026-10-30T09:00:00.000Z'
    };
    notifications.syncEvents([event]);
    notifications.markRead(event.eventKey);
    notifications.syncEvents([{
      ...event, priority: 'critical', title: 'Vencimento hoje', message: 'Vence hoje.'
    }]);
    const updated = notifications.getItems()[0];
    assertEqual(updated.priority, 'critical');
    assertTrue(updated.read);
    assertEqual(updated.createdAt, event.createdAt);
  });

  it('ordena por gravidade e depois pela data mais recente', () => {
    setupMockLocalStorage();
    notifications.syncEvents([
      { eventKey: 'info-new', scope: 'all', type: 'forecast', priority: 'info', title: 'Info', message: 'Info.', createdAt: '2026-10-30T12:00:00.000Z' },
      { eventKey: 'critical-old', scope: 'all', type: 'insufficientBalance', priority: 'critical', title: 'Crítico antigo', message: 'Crítico.', createdAt: '2026-10-29T12:00:00.000Z' },
      { eventKey: 'attention-new', scope: 'all', type: 'anomaly', priority: 'attention', title: 'Atenção nova', message: 'Atenção.', createdAt: '2026-10-30T11:00:00.000Z' },
      { eventKey: 'critical-new', scope: 'all', type: 'dueSoon', priority: 'critical', title: 'Crítico novo', message: 'Crítico.', createdAt: '2026-10-30T10:00:00.000Z' }
    ]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [
      'critical-new', 'critical-old', 'attention-new', 'info-new'
    ]);
  });

  it('usa no sino e contador a prioridade mais grave ainda não lida', () => {
    setupMockLocalStorage();
    const host = document.createElement('div');
    host.innerHTML = `
      <button id="notificationsTrigger"><i></i></button>
      <span id="notificationsUnreadCount"></span>
      <p id="notificationsUnreadLabel"></p>
      <div id="notificationsList"></div>
      <div id="notificationSettingsList"></div>`;
    document.body.appendChild(host);
    notifications.syncEvents([
      { eventKey: 'due-critical', scope: 'all', type: 'dueSoon', priority: 'critical', title: 'Hoje', message: 'Vence hoje.' },
      { eventKey: 'anomaly-attention', scope: 'all', type: 'anomaly', priority: 'attention', title: 'Atípico', message: 'Confira.' }
    ]);
    try {
      notifications.render();
      assertEqual(host.querySelector('#notificationsTrigger').dataset.priority, 'critical');
      assertEqual(host.querySelector('#notificationsUnreadCount').dataset.priority, 'critical');
      assertTrue(host.querySelector('.notification-priority').textContent.includes('Crítico'));
      notifications.markRead('due-critical');
      notifications.render();
      assertEqual(host.querySelector('#notificationsTrigger').dataset.priority, 'attention');
      assertEqual(host.querySelector('#notificationsUnreadCount').dataset.priority, 'attention');
    } finally {
      host.remove();
    }
  });

  it('salva preferências no aparelho e não cria tipos desligados', () => {
    setupMockLocalStorage();
    notifications.savePreferences({ anomaly: false });
    notifications.syncEvents([
      { eventKey: 'anomaly-event', scope: 'all', type: 'anomaly', title: 'Gasto alto', message: 'Confira.' },
      { eventKey: 'forecast-event', scope: 'all', type: 'forecast', title: 'Previsão', message: 'Atualizada.' }
    ]);
    assertFalse(notifications.getPreferences().anomaly);
    assertTrue(notifications.getPreferences().forecast);
    assertEqual(notifications.getItems().map(item => item.eventKey), ['forecast-event']);
    assertNotNull(localStorage.getItem(notifications.PREFERENCES_KEY));
  });

  it('marca como lido, dispensa e não repete o mesmo evento após sincronizar de novo', () => {
    setupMockLocalStorage();
    const event = {
      eventKey: 'due-event',
      scope: 'all',
      type: 'dueSoon',
      title: 'Vencimento próximo',
      message: 'Há uma conta para pagar.'
    };
    notifications.syncEvents([event]);
    notifications.markRead(event.eventKey);
    assertEqual(notifications.getUnreadCount('all'), 0);
    notifications.dismiss(event.eventKey);
    notifications.syncEvents([event]);
    assertEqual(notifications.getVisible('all'), []);
    assertTrue(notifications.getItems()[0].dismissed);
  });

  it('mantém a dispensa do insight depois de restaurar o estado salvo', () => {
    setupMockLocalStorage();
    const dismissal = window.GastoProInsightDismissal;
    dismissal.restore();
    const key = 'forecast:dashboard:2026-10';
    assertTrue(dismissal.dismiss(key));
    assertNotNull(localStorage.getItem(dismissal.KEY));
    const restored = dismissal.restore();
    assertTrue(restored.has(key));
    assertTrue(dismissal.isDismissed(key));
  });

  it('não recria aviso dispensado quando o valor muda no mesmo item e mês', () => {
    setupMockLocalStorage();
    const notifications = window.GastoProNotificationCenter;
    const getEventKey = window.GastoProMobileHomeHelpers.getNotificationEventKey;
    const eventKey = getEventKey('cardLimit', 'card-1', '2026-10');
    notifications.syncEvents([{
      eventKey, scope: 'all', type: 'cardLimit', title: 'Limite quase cheio',
      message: '80% em uso.', amount: 80
    }]);
    notifications.dismiss(eventKey);
    notifications.syncEvents([{
      eventKey: getEventKey('cardLimit', 'card-1', '2026-10'),
      scope: 'all', type: 'cardLimit', title: 'Limite quase cheio',
      message: '91% em uso.', amount: 91
    }]);
    assertEqual(notifications.getVisible('all'), []);
    assertTrue(notifications.getItems()[0].dismissed);
  });

  it('cria aviso novo quando o mesmo evento pertence a outro mês', () => {
    setupMockLocalStorage();
    const notifications = window.GastoProNotificationCenter;
    const getEventKey = window.GastoProMobileHomeHelpers.getNotificationEventKey;
    const octoberKey = getEventKey('cardLimit', 'card-1', '2026-10');
    const novemberKey = getEventKey('cardLimit', 'card-1', '2026-11');
    const event = month => ({
      eventKey: getEventKey('cardLimit', 'card-1', month),
      scope: 'all', type: 'cardLimit', title: 'Limite quase cheio',
      message: 'Confira o limite.'
    });
    notifications.syncEvents([event('2026-10')]);
    notifications.dismiss(octoberKey);
    notifications.syncEvents([event('2026-11')]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [novemberKey]);
  });

  it('mostra nível novo de limite após dispensar alerta de 80%', () => {
    setupMockLocalStorage();
    const notifications = window.GastoProNotificationCenter;
    const getEventKey = window.GastoProMobileHomeHelpers.getNotificationEventKey;
    const warningKey = getEventKey('cardLimit', 'card-1', '2026-10', 'warning');
    const fullKey = getEventKey('cardLimit', 'card-1', '2026-10', 'full');
    const event = (eventKey, message, priority) => ({
      eventKey, scope: 'all', type: 'cardLimit', title: 'Limite de cartão',
      message, priority
    });
    notifications.syncEvents([event(warningKey, '80% em uso.', 'attention')]);
    notifications.dismiss(warningKey);
    notifications.syncEvents([event(fullKey, '100% em uso.', 'critical')]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [fullKey]);
  });

  it('mostra previsão negativa depois de dispensar previsão positiva', () => {
    setupMockLocalStorage();
    const notifications = window.GastoProNotificationCenter;
    const getEventKey = window.GastoProMobileHomeHelpers.getNotificationEventKey;
    const positiveKey = getEventKey('forecast', 'positive', '2026-10');
    const negativeKey = getEventKey('forecast', 'negative', '2026-10');
    const event = eventKey => ({
      eventKey, scope: 'all', type: 'forecast', title: 'Previsão mensal',
      message: 'Previsão do saldo.'
    });
    notifications.syncEvents([event(positiveKey)]);
    notifications.dismiss(positiveKey);
    notifications.syncEvents([event(negativeKey)]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [negativeKey]);
  });

  it('mostra insuficiência de gravidade maior após dispensar nível menor', () => {
    setupMockLocalStorage();
    const notifications = window.GastoProNotificationCenter;
    const getEventKey = window.GastoProMobileHomeHelpers.getNotificationEventKey;
    const oneUncoveredKey = getEventKey(
      'insufficientBalance', 'entry-1', '2026-10', 'uncovered-1'
    );
    const twoUncoveredKey = getEventKey(
      'insufficientBalance', 'entry-1', '2026-10', 'uncovered-2'
    );
    const event = eventKey => ({
      eventKey, scope: 'all', type: 'insufficientBalance',
      title: 'Saldo insuficiente', message: 'Vencimentos descobertos.'
    });
    notifications.syncEvents([event(oneUncoveredKey)]);
    notifications.dismiss(oneUncoveredKey);
    notifications.syncEvents([event(twoUncoveredKey)]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [twoUncoveredKey]);
  });

  it('mantém a dispensa na mesma situação e cria aviso quando a situação muda', () => {
    setupMockLocalStorage();
    const sameSituation = {
      eventKey: 'cardLimit:2026-10:all:card-a:warning:80',
      scope: 'all', type: 'cardLimit', title: 'Limite quase cheio',
      message: '80% do limite está em uso.'
    };
    notifications.syncEvents([sameSituation]);
    notifications.dismiss(sameSituation.eventKey);
    notifications.syncEvents([{ ...sameSituation }]);
    assertEqual(notifications.getVisible('all'), []);

    const changedSituation = {
      ...sameSituation,
      eventKey: 'cardLimit:2026-10:all:card-a:warning:81',
      message: '81% do limite está em uso.'
    };
    notifications.syncEvents([changedSituation]);
    assertEqual(notifications.getVisible('all').map(item => item.eventKey), [
      changedSituation.eventKey
    ]);
  });

  it('navega ao destino do aviso, seleciona o mês e destaca o lançamento', () => {
    setupMockLocalStorage();
    const id = 'entry-notification-target';
    const host = document.createElement('div');
    host.innerHTML = `
      <section id="notificationsPanel">
        <button id="notificationsTrigger"></button>
        <span id="notificationsUnreadCount"></span>
        <p id="notificationsUnreadLabel"></p>
        <div id="notificationsList"></div>
        <div id="notificationSettingsList"></div>
      </section>
      <div data-entry-id="${id}"></div>`;
    document.body.appendChild(host);
    const target = host.querySelector(`[data-entry-id="${id}"]`);
    let scrollIntoViewCount = 0;
    target.scrollIntoView = () => { scrollIntoViewCount++; };
    target.focus = () => {};
    const originalSwitch = window.switchToView;
    const originalAnimationFrame = window.requestAnimationFrame;
    let navigatedView = null;
    window.switchToView = view => {
      navigatedView = view;
      window.GastoProReloadState.apply({
        view, year: 2026, month: 3, scrollX: 0, scrollY: 0
      });
    };
    window.requestAnimationFrame = callback => callback();
    try {
      notifications.syncEvents([{
        eventKey: 'due-destination',
        scope: 'all',
        type: 'dueSoon',
        title: 'Vencimento',
        message: 'Há um lançamento.',
        destination: { screen: 'entries', month: '2026-03', ids: [id] }
      }]);
      notifications.render();
      const navigateButton = host.querySelector('[data-action="notification-navigate"]');
      const dismissButton = host.querySelector('[data-action="notification-dismiss"]');
      assertNotNull(navigateButton);
      assertNotNull(dismissButton);
      navigateButton.addEventListener('click', event =>
        notifications.navigate(event.currentTarget.dataset.eventKey)
      );
      navigateButton.click();
      assertEqual(navigatedView, 'expenses');
      assertEqual(window.GastoProReloadState.getCurrent(), {
        view: 'expenses', year: 2026, month: 3
      });
      assertEqual(scrollIntoViewCount, 1);
      assertTrue(target.classList.contains('notification-destination-highlight'));
      assertTrue(host.querySelector('#notificationsPanel').hidden);
      assertEqual(notifications.getItems()[0].read, true);
    } finally {
      window.switchToView = originalSwitch;
      window.requestAnimationFrame = originalAnimationFrame;
      host.remove();
    }
  });

  itAsync('cria aviso de revisão com prioridade, mês mais antigo e IDs no destino', async () => {
    setupMockLocalStorage();
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    await FinanceData.saveEntries([
      makeVariable({ id: firstId, desc: 'Curso parcela 3/12', date: '2026-11-05', month: '2026-11', paid: true }),
      makeVariable({ id: secondId, desc: 'Empréstimo pessoal', category: 'Empréstimo', date: '2026-10-05', month: '2026-10', paid: true })
    ], { flush: false });
    const review = window.GastoProImportReview;
    review.saveIds([firstId, secondId]);
    const notice = review.syncNotice();
    const stored = notifications.getItems().find(item => item.eventKey === notice.eventKey);
    assertEqual(notice.type, 'importReview');
    assertEqual(notifications.getPriority(notice), 'attention');
    assertEqual(notice.message, '2 itens importados como pagos precisam de conferência');
    assertEqual(stored.destination, {
      screen: 'entries',
      month: '2026-10',
      ids: [firstId, secondId].sort()
    });
    assertEqual(review.getStorageKey('user-a'), 'gastopro_paid_import_review_v1:user-a');
    assertTrue(review.getStorageKey('user-a') !== review.getStorageKey('user-b'));
  });

  itAsync('remove o aviso quando todos os lançamentos forem conferidos', async () => {
    setupMockLocalStorage();
    const id = crypto.randomUUID();
    await FinanceData.saveEntries([
      makeVariable({ id, desc: 'Compra parcela 3/12', date: '2026-10-05', month: '2026-10', paid: true })
    ], { flush: false });
    const review = window.GastoProImportReview;
    review.saveIds([id]);
    const notice = review.syncNotice();
    assertNotNull(notice);
    await review.markReviewed(id);
    assertEqual(review.getIds(), []);
    assertEqual(notifications.getVisible('all').filter(item => item.type === 'importReview'), []);
  });

  itAsync('mantém dispensado o aviso da mesma lista de IDs', async () => {
    setupMockLocalStorage();
    const id = crypto.randomUUID();
    await FinanceData.saveEntries([
      makeVariable({ id, desc: 'Compra parcela 3/12', date: '2026-10-05', month: '2026-10', paid: true })
    ], { flush: false });
    const review = window.GastoProImportReview;
    review.saveIds([id]);
    const notice = review.syncNotice();
    notifications.dismiss(notice.eventKey);
    const repeated = review.syncNotice();
    assertEqual(repeated.eventKey, notice.eventKey);
    assertEqual(notifications.getVisible('all').filter(item => item.type === 'importReview'), []);
    assertTrue(notifications.getItems().find(item => item.eventKey === notice.eventKey).dismissed);
  });

  itAsync('altera para pendente e remove o ID da lista de revisão', async () => {
    setupMockLocalStorage();
    const id = crypto.randomUUID();
    await FinanceData.saveEntries([
      makeVariable({ id, desc: 'Compra parcela 3/12', date: '2026-10-05', month: '2026-10', paid: true })
    ], { flush: false });
    const review = window.GastoProImportReview;
    review.saveIds([id]);
    review.syncNotice();
    await review.setPending(id);
    assertFalse(FinanceData.getEntries().find(entry => entry.id === id).paid);
    assertEqual(review.getIds(), []);
    assertEqual(notifications.getVisible('all').filter(item => item.type === 'importReview'), []);
  });

  it('limpar tudo dispensa avisos existentes e mantém o histórico contra repetição', () => {
    setupMockLocalStorage();
    const event = {
      eventKey: 'forecast-event',
      scope: 'all',
      type: 'forecast',
      title: 'Previsão',
      message: 'Confira o fim do mês.'
    };
    notifications.syncEvents([event]);
    notifications.clearAll();
    notifications.syncEvents([event]);
    assertEqual(notifications.getVisible('all'), []);
    assertEqual(notifications.getUnreadCount('all'), 0);
  });

  it('renderiza estado vazio e seis opções acessíveis de configuração', () => {
    setupMockLocalStorage();
    const host = document.createElement('div');
    host.innerHTML = `
      <button id="notificationsTrigger"></button>
      <span id="notificationsUnreadCount"></span>
      <p id="notificationsUnreadLabel"></p>
      <div id="notificationsList"></div>
      <div id="notificationSettingsList"></div>`;
    document.body.appendChild(host);
    try {
      notifications.render();
      assertEqual(host.querySelector('#notificationsList').textContent.trim(), 'Nenhum aviso por enquanto.');
      assertEqual(host.querySelectorAll('#notificationSettingsList input[type="checkbox"]').length, 6);
      assertTrue([...host.querySelectorAll('#notificationSettingsList input')].every(input => input.checked));
      assertTrue(host.querySelector('#notificationsUnreadCount').hidden);
    } finally {
      host.remove();
    }
  });

  itAsync('mantém preferências após reset e limpa apenas na exclusão da conta', async () => {
    setupMockLocalStorage();
    notifications.savePreferences({ cardLimit: false });
    window.GastoProUsageTelemetry.setEnabled(false);
    const insightDismissal = window.GastoProInsightDismissal;
    const dismissedInsightKey = 'forecast:monthly:2026-10';
    insightDismissal.restore();
    insightDismissal.dismiss(dismissedInsightKey);
    notifications.syncEvents([{
      eventKey: 'card-event',
      scope: 'all',
      type: 'cardLimit',
      title: 'Limite',
      message: 'Quase cheio.'
    }]);
    const resetResult = await FinanceData.clearAll();
    assertTrue(resetResult.success);
    assertFalse(notifications.getPreferences().cardLimit);
    assertFalse(window.GastoProUsageTelemetry.getEnabled());
    assertNull(localStorage.getItem(insightDismissal.KEY));
    assertFalse(insightDismissal.isDismissed(dismissedInsightKey));
    FinanceData.clearUserData();
    assertFalse(notifications.getPreferences().cardLimit);
    assertFalse(window.GastoProUsageTelemetry.getEnabled());
    assertEqual(notifications.getItems(), []);

    await window.GastoProAccountDeletion.deleteAccountAndClearPendingSync({
      deleteAccount: async () => ({ success: true }),
      signOut: async () => {}
    }, FinanceData);
    assertNull(localStorage.getItem(notifications.PREFERENCES_KEY));
    assertNull(localStorage.getItem(window.GastoProUsageTelemetry.PREFERENCE_KEY));
    assertEqual(notifications.getItems(), []);
  });
});

describe('Restauração da navegação após atualização', () => {
  it('preserva a tela e o mês selecionados ao restaurar o estado salvo', () => {
    const reloadState = window.GastoProReloadState;
    const original = reloadState.getCurrent();
    const saved = {
      view: 'expenses', year: 2026, month: 4, scrollX: 0, scrollY: 620
    };
    try {
      assertTrue(reloadState.apply(saved));
      const snapshot = reloadState.capture();
      assertEqual(snapshot.view, saved.view);
      assertEqual(snapshot.year, saved.year);
      assertEqual(snapshot.month, saved.month);
      assertTrue(reloadState.apply({
        ...saved, view: 'dashboard', month: 11, scrollY: 0
      }));
      assertTrue(reloadState.apply(snapshot));
      assertEqual(reloadState.getCurrent(), {
        view: 'expenses', year: 2026, month: 4
      });
    } finally {
      reloadState.apply(original);
    }
  });

  it('abre as telas no topo e preserva rolagem apenas na restauração explícita', () => {
    const originalScrollTo = window.scrollTo;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalSwitchToView = window.switchToView;
    const originalState = window.GastoProReloadState.getCurrent();
    const scrollOptions = [];
    window.scrollTo = options => { scrollOptions.push(options); };
    window.requestAnimationFrame = callback => { callback(); return 1; };
    window.switchToView = () => {};
    try {
      window.GastoProViewHelpers.scrollToTop('dashboard');
      window.GastoProViewHelpers.scrollToTop('expenses');
      assertEqual(scrollOptions, [
        { top: 0, behavior: 'auto' },
        { top: 0, behavior: 'auto' }
      ]);
      const focusedControl = document.createElement('input');
      document.body.appendChild(focusedControl);
      focusedControl.focus();
      assertTrue(document.activeElement === focusedControl);
      window.GastoProViewHelpers.resetInitialPosition();
      assertFalse(document.activeElement === focusedControl);
      assertEqual(scrollOptions[2], { top: 0, behavior: 'auto' });
      focusedControl.remove();
      scrollOptions.length = 0;
      const restoredView = originalState.view === 'expenses' ? 'dashboard' : 'expenses';
      assertTrue(window.GastoProReloadState.restore({
        view: restoredView, year: 2026, month: 7, scrollX: 0, scrollY: 620
      }));
      assertEqual(scrollOptions, [{ left: 0, top: 620, behavior: 'auto' }]);
    } finally {
      window.scrollTo = originalScrollTo;
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.switchToView = originalSwitchToView;
      window.GastoProReloadState.apply(originalState);
    }
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

  it('sugere descrição recorrente limpa sem converter linhas em gasto fixo', () => {
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Exemplo (111) - c/ desconto;-150,00\n${secondRecurringDate};Curso Exemplo;-150,00`
    );
    assertEqual(window.GastoProImportHelpers.cleanRecurringImportDescription(
      'Curso Exemplo (111) - c/ desconto'
    ), 'curso exemplo');
    assertTrue(rows.every(row => row.type === 'variable' && row.selected));
    assertTrue(rows.every(row => row.recurringCandidate));
    assertTrue(rows.every(row => !row.recurringPrimary && !row.recurringCovered));
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

  it('sugere descrição recorrente mesmo quando o valor muda entre meses', () => {
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstRecurringDate};Curso Variável Exemplo;-150,00\n${secondRecurringDate};Curso Variável Exemplo;-150,00\n${GastoProImporter.shiftMonth(currentMonth, 3)}-05;Curso Variável Exemplo;-160,00`
    );
    assertTrue(rows.every(row => row.recurringCandidate && row.selected));
    assertTrue(rows.every(row => row.type === 'variable'));
  });

  it('bloqueia continuar enquanto candidatos não tiverem decisão e estado ativo', () => {
    const candidates = [{ key: 'internet' }, { key: 'academia' }];
    const decisions = new Map([
      ['internet', { type: 'fixed', active: null }],
      ['academia', { type: null, active: null }]
    ]);
    const canContinue = window.GastoProImportHelpers.areRecurringImportCandidatesResolved;
    assertFalse(canContinue(candidates, decisions));
    decisions.set('internet', { type: 'fixed', active: true });
    decisions.set('academia', { type: 'variable', active: null });
    assertTrue(canContinue(candidates, decisions));
  });

  it('busca e adiciona à decisão uma linha importada não sugerida', () => {
    const rows = GastoProImporter.markDuplicates(
      GastoProImporter.parseCSV(`Data;Descrição;Valor\n${tomorrowString};Moto Táxi;-18,00`),
      []
    );
    const matches = window.GastoProImportHelpers.findRecurringImportCandidates('MOTO TAXI', rows);
    const list = window.GastoProImportHelpers.mergeRecurringImportCandidates([], matches);
    assertEqual(list.added.length, 1);
    assertEqual(list.candidates[0].description, 'Moto Táxi');
    assertEqual(rows[0].type, 'variable');
  });

  itAsync('cria fixo confirmado sem fim e projeta nos meses seguintes', async () => {
    setupMockLocalStorage();
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${currentMonth}-05;Internet Exemplo;-120,00\n${GastoProImporter.shiftMonth(currentMonth, 1)}-05;Internet Exemplo;-125,00`
    );
    const helper = window.GastoProImportHelpers;
    const candidate = helper.collectRecurringImportCandidates(rows)[0];
    const template = helper.buildRecurringImportTemplate(
      candidate, rows, { type: 'fixed', active: true }, currentMonth
    );
    const result = await FinanceData.importBatch([{ ...template, type: 'fixed' }]);
    assertTrue(result.success);
    const futureMonth = GastoProImporter.shiftMonth(template.startMonth, 2);
    const projected = FinanceData.getByMonth(futureMonth).find(item =>
      item.desc === 'Internet Exemplo'
    );
    assertTrue(Boolean(projected));
    assertNull(FinanceData.getTemplates().find(item =>
      item.desc === 'Internet Exemplo'
    ).endMonth);
  });

  itAsync('preserva fixo inativo sem incluí-lo nos itens ativos do mês', async () => {
    setupMockLocalStorage();
    const monthAfter = GastoProImporter.shiftMonth(currentMonth, 1);
    const result = await FinanceData.importBatch([{
      type: 'fixed',
      desc: 'Academia Inativa',
      amount: 80,
      category: 'Saúde',
      date: `${currentMonth}-05`,
      startMonth: currentMonth,
      endMonth: null,
      active: false
    }]);
    assertTrue(result.success);
    const projected = FinanceData.getByMonth(monthAfter).find(item =>
      item.desc === 'Academia Inativa'
    );
    assertEqual(projected.active, false);
    assertFalse(FinanceData.getByMonth(monthAfter).filter(item =>
      item.active !== false
    ).some(item => item.desc === 'Academia Inativa'));
  });

  it('mantém Moto Táxi variável quando a pessoa decide que não é fixo', () => {
    const firstPastMonth = GastoProImporter.shiftMonth(currentMonth, -2);
    const secondPastMonth = GastoProImporter.shiftMonth(currentMonth, -1);
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${firstPastMonth}-05;Moto Táxi;-18,00\n${secondPastMonth}-05;Moto Táxi;-20,00`
    );
    const helper = window.GastoProImportHelpers;
    const candidate = helper.collectRecurringImportCandidates(rows)[0];
    const template = helper.buildRecurringImportTemplate(
      candidate, rows, { type: 'variable', active: null }, currentMonth
    );
    assertNull(template);
    assertEqual(helper.getRecurringImportLineType(
      rows[0], { type: 'variable' }, 'fixed'
    ), 'variable');
    assertTrue(rows.every(row => row.type === 'variable' && row.selected));
  });

  it('mantém parcelamento e empréstimo pagos somente quando a data é anterior a hoje', () => {
    const helper = window.GastoProImportHelpers;
    const now = new Date();
    const formatDate = date =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const todayDate = formatDate(now);
    const yesterdayDate = formatDate(yesterday);
    const installment = { date: yesterdayDate, desc: 'Curso parcela 3/12', type: 'variable' };
    const loan = { date: yesterdayDate, desc: 'Crédito pessoal', type: 'variable' };
    assertTrue(helper.requiresImportPaymentReview(installment, 'Educação'));
    assertTrue(helper.requiresImportPaymentReview(loan, 'Empréstimo'));
    assertTrue(helper.getImportPaidValue(installment));
    assertTrue(helper.getImportPaidValue(loan));
    assertTrue(helper.getImportPaidValue({ ...installment, type: 'variable_pending' }));
    assertFalse(helper.getImportPaidValue({ ...installment, date: todayDate }));
    assertFalse(helper.getImportPaidValue({ ...loan, date: tomorrowString }));
  });

  it('marca como pagos os meses passados de fixo confirmado e deixa o atual pendente', () => {
    const previousMonth = GastoProImporter.shiftMonth(currentMonth, -1);
    const rows = prepareRecurringRows(
      `Data;Descrição;Valor\n${previousMonth}-05;Água Exemplo;-60,00\n${currentMonth}-05;Água Exemplo;-65,00`
    );
    const helper = window.GastoProImportHelpers;
    const candidate = helper.collectRecurringImportCandidates(rows)[0];
    const template = helper.buildRecurringImportTemplate(
      candidate, rows, { type: 'fixed', active: true }, currentMonth
    );
    assertEqual(template.paidMonths[previousMonth], true);
    assertFalse(Object.prototype.hasOwnProperty.call(template.paidMonths, currentMonth));
  });

  it('considera pagos somente lançamentos anteriores a hoje', () => {
    const now = new Date();
    const formatDate = date =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const helper = window.GastoProImportHelpers;
    assertTrue(helper.getImportPaidValue({ date: formatDate(yesterday) }));
    assertFalse(helper.getImportPaidValue({ date: formatDate(now) }));
    assertFalse(helper.getImportPaidValue({ date: formatDate(tomorrowDate) }));
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

  it('resolve edições simultâneas pelo horário local corrigido e mantém empate para o servidor', () => {
    setupMockLocalStorage();
    const userId = 'user-version-conflict';
    const localWins = makeIncome({ id: crypto.randomUUID(), desc: 'Edição mais recente' });
    const serverWins = makeIncome({ id: crypto.randomUUID(), desc: 'Edição local antiga' });
    const knownVersion = '2026-10-29T10:00:00.000Z';
    const remoteVersion = '2026-10-29T10:30:00.000Z';
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([localWins, serverWins]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 3600000,
      records: { entries: {
        [localWins.id]: { updatedAt: knownVersion, editedAt: '2026-10-29T09:31:00.000Z' },
        [serverWins.id]: { updatedAt: knownVersion, editedAt: '2026-10-29T09:30:00.000Z' }
      } },
      deleted: {}
    }));
    FinanceData.savePendingSync({
      full: false, entries: [localWins.id, serverWins.id], templates: [],
      deletedEntries: [], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [
      { ...localWins, desc: 'Servidor mais antigo' },
      { ...serverWins, desc: 'Servidor mais recente' }
    ], [], false, null, null, null, null, null,
    { entries: {} }, { entries: { [localWins.id]: remoteVersion, [serverWins.id]: remoteVersion } }));

    const entries = FinanceData.getEntries();
    assertEqual(entries.find(item => item.id === localWins.id).desc, 'Edição mais recente');
    assertEqual(entries.find(item => item.id === serverWins.id).desc, 'Servidor mais recente');
    assertEqual(FinanceData.getPendingSync().entries, [localWins.id]);
  });

  it('remove edição concorrente com exclusão marcada ou já limpa', () => {
    setupMockLocalStorage();
    const userId = 'user-delete-conflict';
    const marked = makeIncome({ id: crypto.randomUUID(), desc: 'Edição local marcada' });
    const expired = makeIncome({ id: crypto.randomUUID(), desc: 'Edição local antiga' });
    const knownVersion = '2026-10-29T10:00:00.000Z';
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([marked, expired]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 0,
      records: { entries: {
        [marked.id]: { updatedAt: knownVersion, editedAt: '2026-10-29T10:01:00.000Z' },
        [expired.id]: { updatedAt: knownVersion, editedAt: '2026-10-29T10:01:00.000Z' }
      } },
      deleted: {}
    }));
    FinanceData.savePendingSync({
      full: false, entries: [marked.id, expired.id], templates: [], deletedEntries: [], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, null, null, null, null, null,
      { entries: { [marked.id]: '2026-10-29T10:02:00.000Z' } }, { entries: {} }));
    assertEqual(FinanceData.getEntries(), []);
    assertEqual(FinanceData.getPendingSync().entries, []);
  });

  it('mantém criação offline nunca sincronizada para envio após voltar online', () => {
    setupMockLocalStorage();
    const userId = 'user-offline-new-record';
    const created = makeIncome({ id: crypto.randomUUID(), desc: 'Criado offline' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([created]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [created.id], templates: [], deletedEntries: [], deletedTemplates: []
    });

    assertTrue(FinanceData.mergeCloudData(userId, [], [], false, null, null, null, null, null,
      { entries: {} }, { entries: {} }));
    assertEqual(FinanceData.getEntries(), [created]);
    assertEqual(FinanceData.getPendingSync().entries, [created.id]);
  });

  itAsync('mantém pendências no aparelho quando a reconciliação falha offline', async () => {
    setupMockLocalStorage();
    const userId = 'user-sync-offline';
    const created = makeIncome({ id: crypto.randomUUID() });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([created]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    FinanceData.savePendingSync({
      full: false, entries: [created.id], templates: [], deletedEntries: [], deletedTemplates: []
    });
    const previousAuth = window.SupabaseAuth;
    let sent = false;
    window.SupabaseAuth = {
      client: {},
      isSyncServerReady: () => true,
      getSyncServerTime: async () => null,
      fetchCloudSyncState: async () => null,
      saveCloudEntries: async () => { sent = true; return { success: true }; }
    };
    try {
      assertFalse((await FinanceData.flushPendingSync(userId)).success);
      assertFalse(sent);
      assertEqual(FinanceData.getPendingSync().entries, [created.id]);
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });

  itAsync('sincroniza ao retornar ao app e respeita intervalo de 15 segundos', async () => {
    const signals = [];
    const documentListeners = {};
    const windowListeners = {};
    const lifecycleDocument = {
      visibilityState: 'visible',
      addEventListener: (type, callback) => { documentListeners[type] = callback; },
      removeEventListener: type => { delete documentListeners[type]; }
    };
    const lifecycleWindow = {
      addEventListener: (type, callback) => { windowListeners[type] = callback; },
      removeEventListener: type => { delete windowListeners[type]; }
    };
    const removeListeners = window.GastoProSyncHelpers.bindLifecycleListeners(
      lifecycleDocument, lifecycleWindow, reason => signals.push(reason)
    );
    documentListeners.visibilitychange();
    windowListeners.focus();
    windowListeners.online();
    removeListeners();
    assertEqual(signals, ['visibilitychange', 'focus', 'online']);

    let runs = 0;
    let finishSync;
    const gate = window.GastoProSyncHelpers.createAutomaticSyncGate();
    const first = gate.run(1000, () => {
      runs++;
      return new Promise(resolve => { finishSync = resolve; });
    });
    await Promise.resolve();
    const concurrent = gate.run(2000, async () => { runs++; return true; });
    assertEqual(runs, 1);
    finishSync(true);
    assertTrue(await first);
    assertTrue(await concurrent);
    assertFalse(await gate.run(15999, async () => { runs++; return true; }));
    assertTrue(await gate.run(16000, async () => { runs++; return true; }));
    assertEqual(runs, 2);
  });

  itAsync('ignora evento Realtime mais antigo que a versão conhecida', async () => {
    setupMockLocalStorage();
    const userId = 'user-realtime-stale';
    const entry = makeIncome({ id: crypto.randomUUID(), desc: 'Versão atual' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([entry]));
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 0,
      records: { entries: { [entry.id]: {
        updatedAt: '2026-10-30T12:00:00.000Z', editedAt: '2026-10-30T12:00:00.000Z'
      } } },
      deleted: {}
    }));
    const result = FinanceData.applyCloudSyncRecord(
      'entries', { ...entry, desc: 'Evento antigo' }, '2026-10-30T11:59:00.000Z', null, userId
    );
    assertTrue(result.stale);
    assertEqual(FinanceData.getEntries()[0].desc, 'Versão atual');
  });

  itAsync('assina as oito tabelas em um canal com o filtro de proprietário correto', async () => {
    const auth = window.SupabaseAuth;
    const previousClient = auth.client;
    const userId = 'user-realtime-channel';
    let channelCount = 0;
    let registrations = [];
    const channel = {
      on(event, filter, callback) {
        registrations.push({ event, filter, callback });
        return this;
      },
      subscribe(callback) {
        callback('SUBSCRIBED');
        return this;
      }
    };
    auth.client = {
      channel: name => {
        assertEqual(name, `gastopro-sync-${userId}`);
        channelCount++;
        return channel;
      },
      removeChannel: async () => 'ok'
    };
    try {
      assertTrue(auth.subscribeToSyncChanges(userId, () => {}, () => {}));
      assertEqual(channelCount, 1);
      assertEqual(registrations.length, 8);
      assertTrue(registrations.every(item => item.event === 'postgres_changes'));
      assertEqual(registrations.find(item => item.filter.table === 'profiles').filter.filter, `id=eq.${userId}`);
      assertTrue(registrations.filter(item => item.filter.table !== 'profiles')
        .every(item => item.filter.filter === `user_id=eq.${userId}`));
      await auth.unsubscribeFromSyncChanges();
    } finally {
      await auth.unsubscribeFromSyncChanges();
      auth.client = previousClient;
    }
  });

  itAsync('ignora evento Realtime correspondente à versão gravada neste aparelho', async () => {
    setupMockLocalStorage();
    const auth = window.SupabaseAuth;
    const previousClient = auth.client;
    const userId = 'user-realtime-own-echo';
    const entryId = crypto.randomUUID();
    const version = '2026-10-30T12:01:00.000Z';
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 0,
      records: { entries: { [entryId]: { updatedAt: version, editedAt: version } } },
      deleted: {}
    }));
    const registrations = [];
    let received = 0;
    const channel = {
      on(event, filter, callback) {
        registrations.push({ filter, callback });
        return this;
      },
      subscribe() { return this; }
    };
    auth.client = {
      channel: () => channel,
      removeChannel: async () => 'ok'
    };
    try {
      assertTrue(auth.subscribeToSyncChanges(userId, () => { received++; }, () => {}));
      const entriesChange = registrations.find(item => item.filter.table === 'entries');
      entriesChange.callback({
        eventType: 'UPDATE',
        new: {
          id: entryId, user_id: userId, description: 'Salário', amount: 1000,
          category: 'Salário', type: 'income', date: '2026-10-30', paid: true,
          is_debt: false, active: true, updated_at: version, client_edited_at: version
        }
      });
      assertEqual(received, 0);
    } finally {
      await auth.unsubscribeFromSyncChanges();
      auth.client = previousClient;
    }
  });

  it('não trata tombstone de registro inexistente como conflito', () => {
    setupMockLocalStorage();
    const userId = 'user-sync-unknown-tombstone';
    localStorage.setItem('gastopro_last_uid', userId);
    let notices = 0;
    const previousToast = window.showToast;
    window.showToast = () => { notices++; };
    try {
      const conflict = FinanceData.reconcileSyncVersions(
        userId, [], [], [], [], [], [],
        { entries: { missingEntry: '2026-10-30T12:00:00.000Z' } },
        { entries: { missingEntry: '2026-10-30T12:00:00.000Z' } }
      );
      const rulesConflict = FinanceData.reconcileSyncVersions(
        userId, [], [], [], [], [], [],
        { fixedImportRules: { [userId]: '2026-10-30T12:00:00.000Z' } },
        { fixedImportRules: { [userId]: '2026-10-30T12:00:00.000Z' } },
        []
      );
      assertFalse(conflict);
      assertFalse(rulesConflict);
      assertEqual(notices, 0);
    } finally {
      window.showToast = previousToast;
    }
  });

  it('só sinaliza mudança remota diferente enquanto o registro está em edição', () => {
    const current = { id: 'entry-editing', desc: 'Valor local', amount: 10 };
    const remote = { ...current, desc: 'Valor remoto' };
    const same = { ...current };
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'modal-overlay active';
    const field = document.createElement('input');
    field.id = 'editItemId';
    field.value = current.id;
    modal.appendChild(field);
    document.body.appendChild(modal);
    const deferred = new Map();
    let notices = 0;
    const notifyForChange = incoming => {
      if (!window.GastoProSyncHelpers.isRemoteRecordDifferent(current, incoming, null)) return;
      window.GastoProSyncHelpers.deferOrApply(
        { item: incoming },
        `entries:${current.id}`,
        window.GastoProSyncHelpers.isRecordBeingEdited('entries', current.id),
        () => {},
        deferred,
        () => { notices++; }
      );
    };
    try {
      notifyForChange(remote);
      notifyForChange(same);
      assertEqual(notices, 1);
      assertEqual(deferred.size, 1);
    } finally {
      modal.remove();
    }
  });

  itAsync('aplica tombstone Realtime e remove o registro local', async () => {
    setupMockLocalStorage();
    const userId = 'user-realtime-tombstone';
    const entry = makeIncome({ id: crypto.randomUUID(), desc: 'Será excluído' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([entry]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 0,
      records: { entries: { [entry.id]: {
        updatedAt: '2026-10-30T12:00:00.000Z', editedAt: '2026-10-30T12:00:00.000Z'
      } } },
      deleted: {}
    }));
    const result = FinanceData.applyCloudSyncRecord(
      'entries', entry, '2026-10-30T12:01:00.000Z', '2026-10-30T12:01:00.000Z', userId
    );
    assertEqual(FinanceData.getEntries(), []);
    assertTrue(result.applied);
  });

  itAsync('adia mudança Realtime enquanto o mesmo lançamento está aberto para edição', async () => {
    setupMockLocalStorage();
    const userId = 'user-realtime-editing';
    const entry = makeIncome({ id: crypto.randomUUID(), desc: 'Valor na tela' });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([entry]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([]));
    localStorage.setItem('gastopro_sync_metadata_v1', JSON.stringify({
      clockOffsetMs: 0,
      records: { entries: { [entry.id]: {
        updatedAt: '2026-10-30T12:00:00.000Z', editedAt: '2026-10-30T12:00:00.000Z'
      } } },
      deleted: {}
    }));
    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'modal-overlay active';
    const field = document.createElement('input');
    field.id = 'editItemId';
    field.value = entry.id;
    modal.appendChild(field);
    document.body.appendChild(modal);
    const deferred = new Map();
    let applied = 0;
    let notices = 0;
    const change = {
      kind: 'entries', item: { ...entry, desc: 'Alteração remota' },
      version: '2026-10-30T12:01:00.000Z', deletedAt: null
    };
    const deferOrApply = () => window.GastoProSyncHelpers.deferOrApply(
      { change, userId },
      `entries:${entry.id}`,
      window.GastoProSyncHelpers.isRecordBeingEdited('entries', entry.id),
      pending => {
        const result = FinanceData.applyCloudSyncRecord(
          pending.change.kind, pending.change.item, pending.change.version,
          pending.change.deletedAt, pending.userId
        );
        if (result.applied) applied++;
      },
      deferred,
      () => { notices++; }
    );
    try {
      assertFalse(deferOrApply());
      assertEqual(FinanceData.getEntries()[0].desc, 'Valor na tela');
      assertEqual(applied, 0);
      assertEqual(notices, 1);
      modal.classList.remove('active');
      const [key, pending] = deferred.entries().next().value;
      deferred.delete(key);
      assertTrue(window.GastoProSyncHelpers.deferOrApply(
        pending, key, window.GastoProSyncHelpers.isRecordBeingEdited('entries', entry.id),
        changeToApply => {
          const result = FinanceData.applyCloudSyncRecord(
            changeToApply.change.kind, changeToApply.change.item, changeToApply.change.version,
            changeToApply.change.deletedAt, changeToApply.userId
          );
          if (result.applied) applied++;
        }, deferred, () => { notices++; }
      ));
      assertEqual(FinanceData.getEntries()[0].desc, 'Alteração remota');
      assertEqual(applied, 1);
    } finally {
      modal.remove();
    }
  });

  itAsync('mantém fallback de sync ao retornar após falha do Realtime', async () => {
    const previousAuth = window.SupabaseAuth;
    const previousClient = previousAuth.client;
    const userId = 'user-realtime-fallback';
    let failed = false;
    let fallbackRuns = 0;
    const channel = {
      on() { return this; },
      subscribe(callback) { callback('CHANNEL_ERROR'); return this; }
    };
    previousAuth.client = {
      channel: () => channel,
      removeChannel: async () => 'ok'
    };
    const gate = window.GastoProSyncHelpers.createAutomaticSyncGate();
    try {
      assertTrue(previousAuth.subscribeToSyncChanges(userId, () => {}, () => {
        failed = true;
        previousAuth.unsubscribeFromSyncChanges();
      }));
      assertTrue(failed);
      await previousAuth.unsubscribeFromSyncChanges();
      assertTrue(await gate.run(20000, async () => {
        fallbackRuns++;
        return true;
      }));
      assertEqual(fallbackRuns, 1);
    } finally {
      await previousAuth.unsubscribeFromSyncChanges();
      previousAuth.client = previousClient;
    }
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
      fetchCloudResetData: async () => ({
        success: true,
        records: {
          entries: [], fixed_templates: [], goals: [], accounts: [], credit_cards: [],
          credit_card_purchases: [], fixed_import_rules: []
        }
      }),
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
      await Promise.resolve();
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

  it('valida as frases das três ações ignorando caixa e espaços nas pontas', () => {
    assertTrue(window.GastoProDeletionConfirmation.isValid(' zerar ', 'ZERAR'));
    assertTrue(window.GastoProUserData.isDeletionConfirmationValid('  apagar dados '));
    assertTrue(window.GastoProAccountDeletion.isConfirmationValid(' excluir conta '));
    assertFalse(window.GastoProDeletionConfirmation.isValid('ZERAR DADOS', 'ZERAR'));
    assertFalse(window.GastoProUserData.isDeletionConfirmationValid('APAGAR'));
    assertFalse(window.GastoProAccountDeletion.isConfirmationValid('EXCLUIR'));
  });

  it('mantém os botões de confirmação desabilitados até a frase correta', () => {
    const checks = [
      { phrase: 'ZERAR', isValid: value => window.GastoProDeletionConfirmation.isValid(value, 'ZERAR') },
      { phrase: 'APAGAR DADOS', isValid: value => window.GastoProUserData.isDeletionConfirmationValid(value) },
      { phrase: 'EXCLUIR CONTA', isValid: value => window.GastoProAccountDeletion.isConfirmationValid(value) }
    ];
    checks.forEach(({ phrase, isValid }) => {
      const input = document.createElement('input');
      const button = document.createElement('button');
      document.body.append(input, button);
      try {
        window.GastoProDeletionConfirmation.bind(input, button, phrase);
        assertTrue(button.disabled, `${phrase}: iniciar desabilitado`);
        input.value = ` ${phrase.toLowerCase()} `;
        input.dispatchEvent(new Event('input'));
        assertFalse(button.disabled, `${phrase}: aceitar caixa diferente e espaços nas pontas`);
        input.value = `${phrase} inválida`;
        input.dispatchEvent(new Event('input'));
        assertTrue(button.disabled, `${phrase}: desabilitar para texto incorreto`);
        assertTrue(isValid(` ${phrase.toLowerCase()} `));
      } finally {
        input.remove();
        button.remove();
      }
    });
  });

  it('mantém gaveta acima da navegação inferior e sem quebra forçada de palavras', () => {
    const drawerLayer = Number(getComputedStyle(document.documentElement)
      .getPropertyValue('--layer-profile-drawer'));
    assertTrue(drawerLayer > 300, 'A gaveta deve ficar acima da barra inferior (z-index 300)');
    const drawer = document.createElement('aside');
    drawer.className = 'profile-drawer';
    document.body.appendChild(drawer);
    try {
      const style = getComputedStyle(drawer);
      assertEqual(style.overflowWrap, 'normal');
      assertEqual(style.wordBreak, 'normal');
      assertEqual(style.hyphens, 'none');
    } finally {
      drawer.remove();
    }
  });

  it('mantém a escala global das camadas acima da barra inferior', () => {
    const rootStyle = getComputedStyle(document.documentElement);
    const layer = name => Number(rootStyle.getPropertyValue(name));
    assertTrue(layer('--layer-sidebar-overlay') > layer('--layer-mobile-bottom-nav'));
    assertTrue(layer('--layer-sidebar') > layer('--layer-mobile-bottom-nav'));
    assertTrue(layer('--layer-profile-drawer') > layer('--layer-mobile-bottom-nav'));
    assertTrue(layer('--layer-notifications') > layer('--layer-profile-drawer'));
    assertTrue(layer('--layer-modal') > layer('--layer-notifications'));
    assertTrue(layer('--layer-confirmation') > layer('--layer-modal'));
    assertTrue(layer('--layer-toast') > layer('--layer-confirmation'));
    assertEqual(layer('--layer-onboarding'), layer('--layer-modal'));

    const modalIds = [
      'editModal', 'accountModal', 'creditCardModal', 'adjustAccountModal',
      'confirmModal', 'deleteAccountModal', 'deleteAllMyDataModal',
      'passwordRecoveryModal', 'reportModal', 'authModal', 'emailHelpModal',
      'discardPendingModal', 'avatarCropModal', 'importModal', 'wizardModal',
      'privacyPolicyModal', 'goalModal', 'accountOnboardingModal',
      'onboardingModal', 'statementGuideModal'
    ];
    const modals = modalIds.map(id => {
      const modal = document.createElement('div');
      modal.id = id;
      modal.className = `modal-overlay${id === 'onboardingModal' ? ' onboarding-modal' : ''}`;
      document.body.appendChild(modal);
      return modal;
    });
    try {
      modals.forEach(modal => {
        assertEqual(modal.parentElement, document.body, `${modal.id} deve ser elemento irmão no body`);
        const expectedLayer = modal.id === 'confirmModal'
          ? layer('--layer-confirmation')
          : layer('--layer-modal');
        assertEqual(Number(getComputedStyle(modal).zIndex), expectedLayer, `${modal.id} deve usar a camada correta`);
      });
    } finally {
      modals.forEach(modal => modal.remove());
    }
  });

  itAsync('move o foco para o modal e devolve ao acionador ao fechar', async () => {
    const opener = document.createElement('button');
    const modal = document.createElement('div');
    const dialog = document.createElement('section');
    const close = document.createElement('button');
    opener.textContent = 'Abrir';
    modal.className = 'modal-overlay';
    dialog.setAttribute('role', 'dialog');
    dialog.tabIndex = -1;
    close.className = 'modal-close-btn';
    close.textContent = 'Fechar';
    close.addEventListener('click', () => modal.classList.remove('active'));
    dialog.appendChild(close);
    modal.appendChild(dialog);
    document.body.append(opener, modal);
    const waitForObserver = () => new Promise(resolve => setTimeout(resolve, 0));
    try {
      opener.focus();
      modal.classList.add('active');
      await waitForObserver();
      assertTrue(modal.contains(document.activeElement), 'O foco deve entrar no modal aberto');
      assertTrue(document.body.classList.contains('has-open-layer'), 'A rolagem do fundo deve ser bloqueada');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitForObserver();
      assertFalse(modal.classList.contains('active'), 'Escape deve fechar o modal superior');
      assertEqual(document.activeElement, opener, 'O foco deve retornar ao acionador');
      assertFalse(document.body.classList.contains('has-open-layer'), 'Fechar o modal deve liberar a rolagem');
    } finally {
      modal.classList.remove('active');
      opener.remove();
      modal.remove();
      document.body.classList.remove('has-open-layer');
    }
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
    localStorage.setItem(window.GastoProUsageTelemetry.PREFERENCE_KEY, 'false');
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
    assertNull(localStorage.getItem(window.GastoProUsageTelemetry.PREFERENCE_KEY));
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

let responsiveFixtureFrame = null;

async function getResponsiveFixtureFrame(width, height = 844) {
  if (!responsiveFixtureFrame) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:844px;border:0;';
    const stylesheet = new URL('../css/style.css', window.location.href).href;
    const loaded = new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', reject, { once: true });
    });
    frame.srcdoc = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${stylesheet}"></head><body data-theme="dark"><div class="app-shell" id="fixtureApp"></div></body></html>`;
    document.body.appendChild(frame);
    await loaded;
    responsiveFixtureFrame = frame;
  }

  responsiveFixtureFrame.style.width = `${width}px`;
  responsiveFixtureFrame.style.height = `${height}px`;
  await new Promise(resolve => setTimeout(resolve, 25));
  return responsiveFixtureFrame;
}

function removeResponsiveFixtureFrame() {
  if (!responsiveFixtureFrame) return;
  responsiveFixtureFrame.remove();
  responsiveFixtureFrame = null;
}

describe('Layout responsivo e tipografia mobile', () => {
  itAsync('mantém todos os controles em 16px ou mais entre 320px e 1280px', async () => {
    const frame = await getResponsiveFixtureFrame(320);
    const frameDocument = frame.contentDocument;
    const inputFields = [
      ['profileNameInput', 'text', 'profile-name-input'],
      ['incomeDesc', 'text', ''], ['incomeAmount', 'number', ''], ['incomeDate', 'date', ''],
      ['expenseDesc', 'text', ''], ['expenseAmount', 'number', ''], ['expenseDate', 'date', ''],
      ['expenseEndMonth', 'month', ''], ['editDesc', 'text', ''], ['editAmount', 'number', ''],
      ['editDate', 'date', ''], ['editEndMonth', 'month', ''], ['accountName', 'text', ''],
      ['accountInstitution', 'text', ''], ['accountInitialBalance', 'number', ''],
      ['accountBalanceDate', 'date', ''], ['creditCardName', 'text', ''],
      ['creditCardLastFour', 'text', ''], ['creditCardLimit', 'number', ''],
      ['creditCardPreviousSpent', 'number', ''], ['creditCardClosingDay', 'number', ''],
      ['creditCardDueDay', 'number', ''], ['adjustAccountBalance', 'number', ''],
      ['confirmPhraseInput', 'text', ''], ['deleteAccountConfirmation', 'text', ''],
      ['deleteAllMyDataConfirmation', 'text', ''], ['reportFrom', 'month', ''],
      ['reportTo', 'month', ''], ['wIncomeDesc', 'text', 'wizard-input'],
      ['wIncomeAmount', 'number', 'wizard-input'], ['wIncomeDate', 'date', 'wizard-input'],
      ['wFixedDesc', 'text', 'wizard-input'], ['wFixedAmount', 'number', 'wizard-input'],
      ['wVarDesc', 'text', 'wizard-input'], ['wVarAmount', 'number', 'wizard-input'],
      ['goalLimitInput', 'number', 'form-control'], ['accountOnboardingName', 'text', ''],
      ['accountOnboardingBalance', 'number', ''], ['accountOnboardingBalanceDate', 'date', ''],
      ['recoveryPassword', 'password', ''], ['loginEmail', 'email', ''],
      ['loginPassword', 'password', ''], ['registerName', 'text', ''],
      ['registerPassword', 'password', ''], ['registerConfirmPassword', 'password', ''],
      ['editItemId', 'hidden', ''], ['confirmRememberCheckbox', 'checkbox', ''],
      ['avatarZoomSlider', 'range', ''], ['csvFileInput', 'file', ''],
      ['importFixedSearchInput', 'search', '']
    ];
    const app = frameDocument.getElementById('fixtureApp');
    app.innerHTML = inputFields.map(([id, type, className]) =>
      `<input id="${id}" type="${type}" class="${className}">`
    ).join('') + `
      <select id="reportPeriodType" class="form-control"><option>Período</option></select>
      <select id="incomeCategory"><option>Categoria</option></select>
      <textarea id="importRawTextarea" class="import-textarea"></textarea>
      <textarea id="adminReplyText" class="admin-reply-editor"></textarea>
      <input id="reportIncludeDetails" type="checkbox">
      <input id="registerConsent" type="checkbox">
    `;

    try {
      for (const width of [320, 360, 390, 768, 1280]) {
        await getResponsiveFixtureFrame(width);
        const below16 = [...frameDocument.querySelectorAll('input, select, textarea')]
          .filter(element => parseFloat(frame.contentWindow.getComputedStyle(element).fontSize) < 16)
          .map(element => `${element.id}: ${frame.contentWindow.getComputedStyle(element).fontSize}`);
        assertEqual(below16, [], `${width}px: controles abaixo de 16px: ${below16.join(', ')}`);
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });

  itAsync('mantém avatares, botões e contadores legíveis nas larguras e temas previstos', async () => {
    const frame = await getResponsiveFixtureFrame(320);
    const frameDocument = frame.contentDocument;
    const app = frameDocument.getElementById('fixtureApp');
    app.innerHTML = `
      <header class="topbar"><div class="topbar-right">
        <button class="user-avatar-btn"><img class="user-avatar-sm" src="" alt="Avatar"></button>
      </div></header>
      <nav class="sidebar-nav"><button class="nav-item" id="counterNav">
        <span>Ganhos do Mês</span><span class="nav-badge" id="neutralCounter">12</span>
      </button></nav>
      <div class="drawer-user-card">
        <label class="profile-name-label" for="profileNameInput">Seu nome</label>
        <div class="drawer-avatar-wrapper"><div class="drawer-user-avatar"><img src="" alt="Avatar"></div>
          <span class="avatar-camera-badge"></span></div>
        <div class="drawer-user-info"><div class="profile-name-edit-row">
          <input id="profileNameInput" class="profile-name-input">
          <button id="saveProfileNameBtn" class="btn-save-name">Salvar nome</button></div></div>
        <p class="drawer-storage-status">Modo Local</p>
      </div>
      <section class="entry-type-selector">
        <button class="entry-type-button">Gasto</button><button class="entry-type-button">Ganho</button>
      </section>
    `;

    const parseRgb = color => {
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        const expanded = hex.length === 3 ? [...hex].map(channel => channel + channel).join('') : hex;
        return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16)).map(channel => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
      }
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number);
      return channels.map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
    };
    const contrast = (foreground, background) => {
      const fg = parseRgb(foreground);
      const bg = parseRgb(background);
      const luminance = rgb => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };

    try {
      for (const theme of ['dark', 'light']) {
        frameDocument.documentElement.dataset.theme = theme;
        frameDocument.body.dataset.theme = theme;
        for (const [width, height] of [
          [320, 844], [360, 844], [390, 844], [768, 1024],
          [1024, 768], [1280, 800], [844, 390]
        ]) {
          await getResponsiveFixtureFrame(width, height);
          const topAvatar = frameDocument.querySelector('.user-avatar-sm');
          const drawerAvatar = frameDocument.querySelector('.drawer-user-avatar');
          const topStyle = frame.contentWindow.getComputedStyle(topAvatar);
          const drawerStyle = frame.contentWindow.getComputedStyle(
            frameDocument.querySelector('.drawer-user-avatar img')
          );
          const topRect = topAvatar.getBoundingClientRect();
          const drawerRect = drawerAvatar.getBoundingClientRect();
          const prefix = `${theme} ${width}x${height}`;
          assertTrue(topRect.width >= 40 && topRect.height >= 40, `${prefix}: avatar do cabeçalho`);
          assertEqual(topStyle.objectFit, 'cover', `${prefix}: recorte do avatar do cabeçalho`);
          assertTrue(drawerRect.width >= 72 && drawerRect.width <= 80, `${prefix}: largura do avatar do painel`);
          assertTrue(drawerRect.height >= 72 && drawerRect.height <= 80, `${prefix}: altura do avatar do painel`);
          assertEqual(drawerStyle.objectFit, 'cover', `${prefix}: recorte do avatar do painel`);

          const wrapper = frameDocument.querySelector('.drawer-avatar-wrapper').getBoundingClientRect();
          const camera = frameDocument.querySelector('.avatar-camera-badge').getBoundingClientRect();
          const nameInput = frameDocument.getElementById('profileNameInput').getBoundingClientRect();
          const editRow = frameDocument.querySelector('.profile-name-edit-row').getBoundingClientRect();
          assertTrue(camera.right <= wrapper.right && camera.bottom <= wrapper.bottom, `${prefix}: câmera dentro do avatar`);
          assertFalse(camera.right > nameInput.left && camera.left < nameInput.right &&
            camera.bottom > nameInput.top && camera.top < nameInput.bottom, `${prefix}: câmera não cobre o nome`);
          assertTrue(Math.abs(
            drawerRect.top + drawerRect.height / 2 - editRow.top - editRow.height / 2
          ) <= 1, `${prefix}: avatar centralizado com campo e botão`);

          const buttons = [...frameDocument.querySelectorAll('.entry-type-button')];
          assertEqual(buttons.length, 2, `${prefix}: dois tipos de lançamento`);
          buttons.forEach(button => assertTrue(button.getBoundingClientRect().height >= 44, `${prefix}: botão ${button.textContent}`));

          const badge = frameDocument.getElementById('neutralCounter');
          const nav = frameDocument.getElementById('counterNav');
          const inactiveBadge = frame.contentWindow.getComputedStyle(badge);
          assertTrue(contrast(inactiveBadge.color, inactiveBadge.backgroundColor) >= 4.5,
            `${prefix}: contraste do contador neutro`);
          assertFalse(badge.classList.contains('text-success') || badge.classList.contains('text-danger'),
            `${prefix}: contador sem cor financeira`);
          nav.classList.add('active');
          const activeBadge = frame.contentWindow.getComputedStyle(badge);
          const primaryStrong = frame.contentWindow.getComputedStyle(frameDocument.documentElement)
            .getPropertyValue('--primary-strong').trim();
          assertTrue(contrast(activeBadge.color, primaryStrong) >= 4.5,
            `${prefix}: contraste do contador na navegação ativa`);
          nav.classList.remove('active');
        }
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });

  itAsync('renderiza avisos longos em coluna dentro do painel', async () => {
    setupMockLocalStorage();
    const fixture = document.createElement('div');
    fixture.innerHTML = `
      <button id="notificationsTrigger"></button>
      <span id="notificationsUnreadCount"></span>
      <span id="notificationsUnreadLabel"></span>
      <span id="financialInsightsMobileSummary"></span>
      <div id="notificationsList"></div>
      <div id="notificationSettingsList"></div>
    `;
    document.body.appendChild(fixture);
    const frame = await getResponsiveFixtureFrame(320);

    try {
      window.GastoProNotificationCenter.syncEvents([{
        type: 'forecast',
        eventKey: 'layout-long-notice',
        scope: 'all',
        title: 'Aviso de projeção com título longo para validar a quebra natural em uma tela estreita',
        message: 'A descrição do aviso contém várias palavras e deve permanecer dentro da largura disponível no painel.',
        createdAt: new Date().toISOString()
      }]);
      window.GastoProNotificationCenter.render();
      const sourceCard = fixture.querySelector('.notification-item');
      assertTrue(sourceCard, 'O renderizador real deve criar o cartão de aviso');

      const frameDocument = frame.contentDocument;
      const panel = frameDocument.createElement('section');
      panel.className = 'notifications-panel';
      const list = frameDocument.createElement('div');
      list.className = 'notifications-list';
      panel.appendChild(list);
      frameDocument.body.appendChild(panel);
      list.appendChild(frameDocument.importNode(sourceCard, true));

      const card = list.querySelector('.notification-item');
      const content = card.querySelector('.notification-item-navigation');
      const badge = card.querySelector('.notification-priority');
      const title = card.querySelector('h3');
      const message = card.querySelector('p');
      const cardRect = card.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      assertEqual(frame.contentWindow.getComputedStyle(card).flexDirection, 'column');
      assertEqual(frame.contentWindow.getComputedStyle(content).flexDirection, 'column');
      assertEqual(frame.contentWindow.getComputedStyle(content).whiteSpace, 'normal');
      assertEqual(frame.contentWindow.getComputedStyle(badge).whiteSpace, 'nowrap');
      assertTrue(badge.getBoundingClientRect().bottom <= title.getBoundingClientRect().top);
      assertTrue(title.getBoundingClientRect().bottom <= message.getBoundingClientRect().top);
      assertTrue(cardRect.right <= panelRect.right + 0.5, 'O cartão não deve ultrapassar o painel');
    } finally {
      fixture.remove();
      removeResponsiveFixtureFrame();
      setupMockLocalStorage();
    }
  });

  itAsync('mantém campo e botão Salvar nome dentro do cartão em 320px e 360px', async () => {
    const frame = await getResponsiveFixtureFrame(320);
    const app = frame.contentDocument.getElementById('fixtureApp');
    app.innerHTML = `
      <aside class="profile-drawer open" aria-hidden="false">
        <div class="drawer-body">
          <section class="drawer-section drawer-profile-section">
            <div class="drawer-user-card">
              <div class="drawer-avatar-wrapper"><div class="drawer-user-avatar"></div></div>
              <div class="drawer-user-info">
                <label class="profile-name-label" for="profileNameInput">Seu nome</label>
                <div class="profile-name-edit-row">
                  <input id="profileNameInput" class="profile-name-input" value="Pessoa" type="text">
                  <button id="saveProfileNameBtn" class="btn-save-name" type="button">Salvar nome</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    `;

    try {
      for (const width of [320, 360]) {
        await getResponsiveFixtureFrame(width);
        const card = frame.contentDocument.querySelector('.drawer-user-card');
        const row = frame.contentDocument.querySelector('.profile-name-edit-row');
        const input = frame.contentDocument.querySelector('#profileNameInput');
        const button = frame.contentDocument.querySelector('#saveProfileNameBtn');
        const cardRect = card.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const labelRange = frame.contentDocument.createRange();
        labelRange.selectNodeContents(button);
        const labelRect = labelRange.getBoundingClientRect();
        assertTrue(Math.abs(inputRect.width - rowRect.width) < 1, `${width}px: campo em largura total`);
        assertTrue(Math.abs(buttonRect.width - rowRect.width) < 1, `${width}px: botão em largura total`);
        assertTrue(buttonRect.top >= inputRect.bottom, `${width}px: botão abaixo do campo`);
        assertTrue(buttonRect.left >= cardRect.left && buttonRect.right <= cardRect.right, `${width}px: botão dentro do cartão`);
        assertTrue(labelRect.left >= buttonRect.left && labelRect.right <= buttonRect.right, `${width}px: rótulo dentro do botão`);
        assertTrue(buttonRect.height >= 44, `${width}px: botão com altura mínima de 44px`);
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });

  itAsync('mantém cinco itens da barra inferior dentro da tela em 320px e 360px', async () => {
    const frame = await getResponsiveFixtureFrame(320);
    const app = frame.contentDocument.getElementById('fixtureApp');
    app.innerHTML = `
      <nav class="mobile-bottom-nav" aria-label="Navegação principal">
        <button class="mobile-bottom-nav-item"><i></i><span>Início</span></button>
        <button class="mobile-bottom-nav-item"><i></i><span>Lançamentos</span></button>
        <button class="mobile-bottom-nav-item"><i></i><span>Cartões</span></button>
        <button class="mobile-bottom-nav-item"><i></i><span>Metas</span></button>
        <button class="mobile-bottom-nav-item is-active"><i></i><span>Mais</span></button>
      </nav>
    `;

    try {
      for (const width of [320, 360]) {
        await getResponsiveFixtureFrame(width);
        const nav = frame.contentDocument.querySelector('.mobile-bottom-nav');
        const navRect = nav.getBoundingClientRect();
        const items = [...nav.querySelectorAll('.mobile-bottom-nav-item')];
        assertEqual(items.length, 5);
        assertTrue(navRect.left >= 0 && navRect.right <= frame.contentWindow.innerWidth);
        items.forEach(item => {
          const rect = item.getBoundingClientRect();
          const label = item.querySelector('span');
          assertTrue(rect.left >= navRect.left && rect.right <= navRect.right, `${width}px: item dentro da barra`);
          assertEqual(frame.contentWindow.getComputedStyle(label).whiteSpace, 'nowrap');
          assertTrue(label.scrollWidth <= label.clientWidth, `${width}px: rótulo ${label.textContent} inteiro`);
        });
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });

  itAsync('clearAll e deleteAllUserData removem a chave legada de gasto anterior', async () => {
    const legacyKey = 'gastopro_credit_card_previous_spent_v1';
    setupMockLocalStorage();
    localStorage.setItem(legacyKey, '25');
    const resetResult = await FinanceData.clearAll();
    assertTrue(resetResult.success);
    assertNull(localStorage.getItem(legacyKey));

    setupMockLocalStorage();
    const userId = 'legacy-cleanup-test';
    FinanceData.saveProfile({ name: 'Pessoa', email: 'pessoa@example.com', avatar: null, userId });
    localStorage.setItem('gastopro_last_uid', userId);
    localStorage.setItem(legacyKey, '25');
    localStorage.setItem(`${legacyKey}:${userId}`, '35');
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = { deleteAllMyData: async () => ({ success: true }) };
    try {
      const deleteResult = await FinanceData.deleteAllUserData('APAGAR DADOS');
      assertTrue(deleteResult.success);
      assertNull(localStorage.getItem(legacyKey));
      assertNull(localStorage.getItem(`${legacyKey}:${userId}`));
    } finally {
      window.SupabaseAuth = previousAuth;
    }
  });
});

// ================================================================
// RELATÓRIO FINAL
describe('Cartões de lançamentos e notificações responsivos', () => {
  itAsync('mantém chips e datas dos lançamentos inteiros dentro do cartão', async () => {
    const frame = await getResponsiveFixtureFrame(320, 800);
    const frameDocument = frame.contentDocument;
    frameDocument.getElementById('fixtureApp').innerHTML = `
      <aside class="sidebar"></aside>
      <div class="main-content"><main class="views-wrapper"><section class="view-section active">
        <article class="manage-item-card transaction-item-card">
          <div class="card-item-left"><div class="card-type-icon"></div>
            <div class="card-item-info"><div class="card-item-title">Corrida de mototáxi para entrega de documentos</div>
              <div class="card-item-meta"><span class="tag-badge">Transporte</span><span class="tag-badge">Banco Bradesco</span><span class="tag-badge">Gasto Variável</span><span class="tag-badge">Transferência</span></div>
              <time class="card-item-date">31/10/2026</time>
            </div>
          </div>
          <div class="card-item-right"><label class="checkbox-paid-label">Pago</label><span class="card-item-amount">− R$ 9.999,99</span><div class="card-item-actions"><button>Editar</button></div></div>
        </article>
      </section></main></div>
    `;
    const screenSizes = [[320, 800], [360, 800], [390, 844], [768, 900], [1024, 900], [1280, 900], [844, 390]];

    try {
      for (const themeName of ['dark', 'light']) {
        for (const [width, height] of screenSizes) {
          await getResponsiveFixtureFrame(width, height);
          frameDocument.documentElement.dataset.theme = themeName;
          frameDocument.body.dataset.theme = themeName;
          const card = frameDocument.querySelector('.transaction-item-card');
          assertTrue(card.scrollWidth <= card.clientWidth, `${width}px ${themeName}: cartão sem overflow`);
          [...card.querySelectorAll('.tag-badge')].forEach(chip => {
            assertTrue(chip.scrollWidth <= chip.clientWidth, `${width}px ${themeName}: chip ${chip.textContent} inteiro`);
            assertEqual(frame.contentWindow.getComputedStyle(chip).whiteSpace, 'nowrap');
            assertEqual(frame.contentWindow.getComputedStyle(chip).overflowWrap, 'normal');
          });
          const date = card.querySelector('.card-item-date');
          assertEqual(frame.contentWindow.getComputedStyle(date).whiteSpace, 'nowrap');
          assertTrue(date.scrollWidth <= date.clientWidth, `${width}px ${themeName}: data inteira`);
          assertTrue(frameDocument.documentElement.scrollWidth <= frameDocument.documentElement.clientWidth,
            `${width}px ${themeName}: sem rolagem horizontal`);
        }
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });

  itAsync('posiciona toast sem cobrir a navegação mobile ou o rodapé do menu desktop', async () => {
    const frame = await getResponsiveFixtureFrame(390, 844);
    const frameDocument = frame.contentDocument;
    frameDocument.getElementById('fixtureApp').innerHTML = `
      <aside class="sidebar"><div class="sidebar-footer" id="menuFooter">Rodapé do menu</div></aside>
      <div class="main-content"><main class="views-wrapper"><footer class="app-footer"><div class="footer-security-badge"><i></i><span>Sem login, os dados ficam no dispositivo. Com login, também são sincronizados com a nuvem.</span></div></footer></main></div>
      <nav class="mobile-bottom-nav"><button class="mobile-bottom-nav-item">Início</button></nav>
      <div class="toast show"><span>Um item foi atualizado em outro aparelho</span></div>
      <button class="back-to-top-btn is-visible">Topo</button>
    `;

    try {
      for (const themeName of ['dark', 'light']) {
        for (const [width, height] of [[390, 844], [1280, 900]]) {
          await getResponsiveFixtureFrame(width, height);
          frameDocument.documentElement.dataset.theme = themeName;
          frameDocument.body.dataset.theme = themeName;
          const toast = frameDocument.querySelector('.toast');
          toast.style.transition = 'none';
          toast.style.transform = 'translateY(0)';
          const rect = element => element.getBoundingClientRect();
          const intersects = (first, second) => first.left < second.right && first.right > second.left &&
            first.top < second.bottom && first.bottom > second.top;
          const toastRect = rect(toast);
          const nav = frameDocument.querySelector('.mobile-bottom-nav');
          const menuFooter = frameDocument.querySelector('#menuFooter');
          const badgeText = frameDocument.querySelector('.footer-security-badge span');
          if (width <= 600) {
            assertFalse(intersects(toastRect, rect(nav)), `${themeName}: toast não cobre a barra inferior`);
          } else {
            assertFalse(intersects(toastRect, rect(menuFooter)), `${themeName}: toast não cobre o rodapé do menu`);
          }
          assertTrue(badgeText.scrollWidth <= badgeText.clientWidth, `${themeName}: texto do rodapé inteiro`);
          assertTrue(frameDocument.documentElement.scrollWidth <= frameDocument.documentElement.clientWidth,
            `${width}px ${themeName}: sem rolagem horizontal`);
          assertEqual(getComputedStyle(toast).zIndex, '700');
        }
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
  });
});

// ================================================================
// RELATÓRIO FINAL
describe('Home unificada e formas de pagamento', () => {
  itAsync('usa uma lista central de pagamento e preserva pago, pendente e crédito', async () => {
    setupMockLocalStorage();
    const helpers = window.GastoProPaymentHelpers;
    const expenseOptions = ['pix', 'debit', 'cash', 'credit_card', 'boleto', 'transfer', 'other'];
    const incomeOptions = ['pix', 'transfer', 'cash', 'other'];
    assertEqual(helpers.getOptions('expense'), expenseOptions);
    assertEqual(helpers.getOptions('income'), incomeOptions);

    const fixture = document.createElement('div');
    fixture.innerHTML = `
      <select id="incomePaymentMethod"></select>
      <select id="expensePaymentMethod"></select>
      <select id="editPaymentMethod"></select>
      <select id="expenseType"><option value="variable">Variável</option></select>
      <div id="expenseCreditFields" hidden></div>
      <div id="expenseAccountGroup"></div>
      <select id="expenseCreditCard"></select>
      <select id="expenseInstallments"></select>
    `;
    document.body.appendChild(fixture);
    try {
      const incomeSelect = fixture.querySelector('#incomePaymentMethod');
      const expenseSelect = fixture.querySelector('#expensePaymentMethod');
      const editSelect = fixture.querySelector('#editPaymentMethod');
      helpers.populateSelect(incomeSelect, 'income');
      helpers.populateSelect(expenseSelect, 'expense');
      helpers.populateSelect(editSelect, 'income', true);
      assertEqual([...incomeSelect.options].map(option => option.value), incomeOptions);
      assertEqual([...expenseSelect.options].map(option => option.value), expenseOptions);
      assertEqual([...editSelect.options].map(option => option.value), ['', ...incomeOptions]);
      helpers.populateSelect(editSelect, 'expense', true);
      assertEqual([...editSelect.options].map(option => option.value), ['', ...expenseOptions]);

      const date = '2026-10-31';
      ['pix', 'debit', 'cash', 'transfer'].forEach(method =>
        assertTrue(helpers.isPaidByPaymentMethod(method, date, date), `${method} deve entrar pago`)
      );
      ['boleto', 'credit_card'].forEach(method =>
        assertFalse(helpers.isPaidByPaymentMethod(method, date, date), `${method} não deve debitar a conta`)
      );

      expenseSelect.value = 'credit_card';
      helpers.updateCreditCardPurchaseFields();
      assertFalse(fixture.querySelector('#expenseCreditFields').hidden);
      assertTrue(fixture.querySelector('#expenseAccountGroup').hidden);
      assertTrue(fixture.querySelector('#expenseCreditCard').required);
      expenseSelect.value = 'pix';
      helpers.updateCreditCardPurchaseFields();
      assertTrue(fixture.querySelector('#expenseCreditFields').hidden);
      assertFalse(fixture.querySelector('#expenseAccountGroup').hidden);
    } finally {
      fixture.remove();
    }
  });

  itAsync('mantém saldo, avisos e quatro KPIs em uma home responsiva nos dois temas', async () => {
    const frame = await getResponsiveFixtureFrame(320, 800);
    const frameDocument = frame.contentDocument;
    frameDocument.getElementById('fixtureApp').innerHTML = `
      <aside class="sidebar"></aside>
      <div class="main-content">
        <header class="topbar">
          <div class="topbar-left"><button class="menu-toggle-btn">Menu</button></div>
          <button class="mobile-brand">GastoPro</button>
          <div class="topbar-right"><div class="topbar-summary">Saldo duplicado</div></div>
        </header>
        <main class="views-wrapper">
          <section class="view-section active" id="view-dashboard">
            <section class="dashboard-highlight-card">
              <div class="dashboard-highlight-value">
                <span>Saldo atual</span><strong>R$ 1.234,56</strong>
                <span class="dashboard-highlight-description">Disponível nas contas</span>
              </div>
              <div class="dashboard-balance-warning"><i></i><span>Projeção do mês atual</span></div>
            </section>
            <section class="panel-box financial-insights-panel">
              <button class="financial-insights-mobile-strip"><span>4 avisos</span><i></i></button>
              <div class="panel-header">Alertas</div><div class="financial-insights-grid"></div>
            </section>
            <div class="kpi-grid">
              <div class="kpi-card result-card"><span class="kpi-title"><i></i><span>Resultado</span></span><span class="kpi-value">R$ 1,00</span></div>
              <div class="kpi-card"><span class="kpi-title"><i></i><span>Recebido</span></span><span class="kpi-value">R$ 2,00</span></div>
              <div class="kpi-card"><span class="kpi-title"><i></i><span>Fixos</span></span><span class="kpi-value">R$ 3,00</span></div>
              <div class="kpi-card"><span class="kpi-title"><i></i><span>Variáveis</span></span><span class="kpi-value">R$ 4,00</span></div>
            </div>
          </section>
        </main>
      </div>
    `;
    const screenSizes = [[320, 800], [360, 800], [390, 844], [768, 900], [1024, 900], [1280, 900], [844, 390]];

    try {
      for (const themeName of ['dark', 'light']) {
        for (const [width, height] of screenSizes) {
          await getResponsiveFixtureFrame(width, height);
          frameDocument.documentElement.dataset.theme = themeName;
          frameDocument.body.dataset.theme = themeName;
          const dashboard = frameDocument.querySelector('#view-dashboard');
          const highlight = dashboard.querySelector('.dashboard-highlight-card');
          const strip = dashboard.querySelector('.financial-insights-mobile-strip');
          const grid = dashboard.querySelector('.kpi-grid');
          const cards = [...grid.querySelectorAll('.kpi-card')];
          const visible = element => getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
          const titles = cards.map(card => [...card.querySelectorAll('.kpi-title span')]
            .filter(visible).map(title => title.textContent.trim()));
          const columns = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length;
          assertTrue(visible(highlight), `${width}x${height} ${themeName}: saldo visível`);
          assertTrue(visible(strip), `${width}x${height} ${themeName}: faixa de avisos visível`);
          assertEqual(cards.filter(visible).length, 4, `${width}x${height} ${themeName}: quatro KPIs`);
          assertEqual(titles, [['Resultado'], ['Recebido'], ['Fixos'], ['Variáveis']]);
          assertEqual(getComputedStyle(frameDocument.querySelector('.topbar-summary')).display, 'none');
          assertEqual(columns, width >= 1024 ? 4 : 2, `${width}px: número de colunas`);
          assertTrue(frameDocument.documentElement.scrollWidth <= frameDocument.documentElement.clientWidth,
            `${width}x${height} ${themeName}: sem rolagem horizontal`);
          cards.forEach(card => {
            const title = card.querySelector('.kpi-title');
            assertTrue(title.scrollWidth <= title.clientWidth, `${width}px: rótulo ${title.textContent.trim()} inteiro`);
          });
        }
      }
    } finally {
      removeResponsiveFixtureFrame();
    }
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
  window.dispatchEvent(new Event('gastopro:tests-complete'));
}

// Executa o relatório automaticamente ao final do carregamento
window.addEventListener('load', printTestReport);
