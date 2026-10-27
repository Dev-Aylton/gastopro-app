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
  it('não deve exibir dados do usuário A após trocar para o usuário B', () => {
    setupMockLocalStorage();
    FinanceData.activateUser('user-a');
    FinanceData.saveEntries([makeIncome({ id: 'entry-user-a' })]);

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

  it('add(income) deve criar um lançamento pontual com ID "entry-"', () => {
    const item = FinanceData.add(makeIncome());
    assertTrue(item.id.startsWith('entry-'), `ID deveria começar com "entry-", foi: ${item.id}`);
  });

  it('add(income) deve persistir o item corretamente', () => {
    setupMockLocalStorage();
    FinanceData.add(makeIncome({ amount: 2500, desc: 'Freela' }));
    const entries = FinanceData.getEntries();
    assertEqual(entries.length, 1);
    assertEqual(entries[0].amount, 2500);
    assertEqual(entries[0].type, 'income');
  });

  it('add(variable) deve criar lançamento variável com ID "entry-"', () => {
    setupMockLocalStorage();
    const item = FinanceData.add(makeVariable());
    assertTrue(item.id.startsWith('entry-'));
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

  it('add(fixed) deve criar um template com ID "fix-"', () => {
    const tpl = FinanceData.add(makeFixed());
    assertTrue(tpl.id.startsWith('fix-'), `ID deveria começar com "fix-", foi: ${tpl.id}`);
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

  it('deve apagar todos os lançamentos e templates', () => {
    FinanceData.add(makeIncome());
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));
    FinanceData.add(makeVariable());
    FinanceData.clearAll();
    assertEqual(FinanceData.getEntries().length, 0);
    assertEqual(FinanceData.getTemplates().length, 0);
  });
});

describe('FinanceData — exportJSON()', () => {
  setupMockLocalStorage();

  it('backup deve incluir campos version, exportDate, entries e templates', () => {
    FinanceData.add(makeIncome());
    FinanceData.add(makeFixed({ month: '2026-01', date: '2026-01-01' }));

    const originalCreateElement = document.createElement.bind(document);
    let backup = null;
    document.createElement = (tagName) => {
      if (tagName !== 'a') return originalCreateElement(tagName);

      return {
        setAttribute(name, value) {
          if (name !== 'href') return;
          const jsonData = value.slice(value.indexOf(',') + 1);
          backup = JSON.parse(decodeURIComponent(jsonData));
        },
        click() {}
      };
    };

    try {
      FinanceData.exportJSON();
    } finally {
      document.createElement = originalCreateElement;
    }

    assertTrue(typeof backup.version === 'string', 'version deve ser string');
    assertEqual(backup.version, '3.6');
    assertTrue(typeof backup.exportDate === 'string', 'exportDate deve ser string');
    assertTrue(Array.isArray(backup.entries), 'entries deve ser array');
    assertTrue(Array.isArray(backup.templates), 'templates deve ser array');
    assertEqual(backup.entries.length, 1);
    assertEqual(backup.templates.length, 1);
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
    const template = all.find(i => i.id.startsWith('fix-'));
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

// ================================================================
// RELATÓRIO FINAL
// ================================================================

/**
 * Imprime o relatório final de todos os testes executados.
 * Chame esta função após definir todos os suites de teste.
 */
function printTestReport() {
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
