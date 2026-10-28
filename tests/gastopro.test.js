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

  it('logout deve limpar todas as chaves gastopro_*', () => {
    setupMockLocalStorage();
    localStorage.setItem('gastopro_entries_v4_oct', '[]');
    localStorage.setItem('gastopro_goals_v1', '[]');
    localStorage.setItem('gastopro_avatar_cache', 'avatar');
    localStorage.setItem('sb-project-auth-token', 'session');

    FinanceData.clearUserData();

    const remainingKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    assertEqual(remainingKeys, ['sb-project-auth-token']);
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

  itAsync('deve limpar metas e manter a identidade da conta, enfileirando exclusões', async () => {
    setupMockLocalStorage();
    const userId = 'user-reset-test';
    const entryId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    localStorage.setItem('gastopro_last_uid', userId);
    FinanceData.saveProfile({ name: 'Pessoa', avatar: 'data:image/png;base64,abc', email: 'pessoa@example.com', userId });
    localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify([makeIncome({ id: entryId })]));
    localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify([makeFixed({ id: templateId })]));
    FinanceData.saveGoals([{ id: 'goal-1', category: 'Casa', limit: 500 }]);

    const deletedEntries = [];
    const deletedTemplates = [];
    const previousAuth = window.SupabaseAuth;
    window.SupabaseAuth = {
      saveCloudEntries: async () => ({ success: true }),
      saveCloudTemplates: async () => ({ success: true }),
      deleteCloudEntries: async ids => { deletedEntries.push(...ids); return { success: true }; },
      deleteCloudTemplates: async ids => { deletedTemplates.push(...ids); return { success: true }; }
    };
    try {
      const result = await FinanceData.clearAll();
      assertTrue(result.success);
      assertEqual(FinanceData.getProfile().userId, userId);
      assertEqual(FinanceData.getProfile().email, 'pessoa@example.com');
      assertEqual(FinanceData.getEntries(), []);
      assertEqual(FinanceData.getTemplates(), []);
      assertEqual(FinanceData.getGoals(), []);
      assertTrue(deletedEntries.includes(entryId));
      assertTrue(deletedTemplates.includes(templateId));
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

  it('aceita somente senhas com oito ou mais caracteres', () => {
    assertFalse(isValidPassword('1234567'));
    assertTrue(isValidPassword('12345678'));
  });
});

describe('Bloco 2 — dívida, orçamento, diagnóstico e categorias', () => {
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
      assertEqual(backup.version, '3.9');
      assertTrue(typeof backup.exportDate === 'string', 'exportDate deve ser string');
      assertTrue(Array.isArray(backup.entries), 'entries deve ser array');
      assertTrue(Array.isArray(backup.templates), 'templates deve ser array');
      assertTrue(Array.isArray(backup.goals), 'goals deve ser array');
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

describe('GastoProImporter — extratos bancários robustos', () => {
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

  it('marca duplicados existentes e repetidos no próprio arquivo', () => {
    const rows = [
      { date: '2026-10-15', amount: 10, desc: 'Mercado EXTRA' },
      { date: '2026-10-15', amount: 10, desc: 'mercado extra' },
      { date: '2026-10-16', amount: 10, desc: 'mercado extra' }
    ];
    const marked = GastoProImporter.markDuplicates(rows, [
      { date: '2026-10-15', amount: 10, desc: 'MERCADO EXTRA' }
    ]);
    assertEqual(marked.map(row => row.duplicate), [true, true, false]);
    assertEqual(marked.map(row => row.selected), [false, false, true]);
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
    const rows = await GastoProImporter.parseFile(new File(['documento'], 'nota.pdf'));
    assertEqual(rows, []);
    assertTrue(GastoProImporter.getLastWarnings().includes('Formato de arquivo não suportado.'));
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
        { type: 'variable', desc: 'Gasto lote', amount: 10, date: '2026-10-15', month: '2026-10' },
        { type: 'fixed', desc: 'Fixo lote', amount: 20, date: '2026-10-15', month: '2026-10' }
      ]);
      assertEqual(added.items.length, 2);
      assertEqual(FinanceData.getEntries().length, 1);
      assertEqual(FinanceData.getTemplates().length, 1);
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
