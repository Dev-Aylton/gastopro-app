/* ================================================================
   GastoPro — Controlador Principal (SPA Controller)
   Autor: Aylton Alberto | Estudante de ADS
   Arquivo: js/app.js

   RESPONSABILIDADE:
   Contém toda a lógica de navegação, renderização das telas,
   cálculos financeiros, eventos e inicialização do app.
   Depende de FinanceData (data.js) para persistência.

   ARQUITETURA DO ARQUIVO (por seção):
   1.  Estado Global (state) — variáveis de controle em memória
   2.  Constantes — nomes de meses e títulos das telas
   3.  Utilitários — formatação BRL, datas e toast de feedback
   4.  Navegação SPA — troca de telas com transição suave
   5.  Orquestrador (renderAll) — ponto central de re-renderização
   6.  Dashboard & Saúde Financeira — KPIs e regra 50/30/20
   7.  Centro de Dívidas — rastreamento de parcelamentos
   8.  Gráfico de Categorias — Chart.js doughnut
   9.  Tela de Ganhos — listagem e CRUD de receitas
   10. Tela de Gastos — listagem e CRUD de despesas
   11. Modal de Edição — formulário de alteração de lançamentos
   12. Modal de Confirmação — substitui o confirm() nativo
   13. Ações do Usuário — excluir, ativar, pagar
   14. Mini Calendário Popover — navegação por mês/ano
   15. Event Listeners & Inicialização — bootstrap do app
   ================================================================ */

'use strict';

// ================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// Objeto em memória que controla o que está sendo exibido.
// Toda alteração de estado deve ser seguida de renderAll().
// ================================================================

/** Data real do sistema, usada para inicializar o estado. */
const _initDate = new Date();

/**
 * @type {Object} state
 * @description Estado reativo da aplicação.
 * Qualquer função que precise saber "qual mês está ativo" ou
 * "qual tela está visível" deve ler este objeto.
 */
const state = {
  currentView:  'dashboard',              // Tela ativa: 'dashboard' | 'incomes' | 'expenses'
  currentYear:  _initDate.getFullYear(),  // Ano selecionado (inicializa com o ano atual)
  currentMonth: _initDate.getMonth() + 1, // Mês selecionado 1–12 (inicializa com mês atual)
  expenseFilter: 'all',                   // Filtro de gastos: 'all' | 'fixed' | 'variable'
  chartInstance: null                     // Instância ativa do Chart.js (para destruir antes de recriar)
};

// ================================================================
// 2. CONSTANTES
// ================================================================

/** Nomes dos meses em português, indexados de 0 (Janeiro) a 11 (Dezembro). */
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** Títulos exibidos na topbar de acordo com a tela ativa. */
const VIEW_TITLES = {
  dashboard: 'Dashboard & Saúde Financeira',
  incomes:   'Gerenciador de Ganhos do Mês',
  expenses:  'Gerenciador de Gastos do Mês'
};

// ================================================================
// 3. UTILITÁRIOS
// ================================================================

/**
 * Formata um número para o padrão de moeda brasileiro (R$).
 * Trata null/undefined como zero para evitar erros de exibição.
 *
 * @param {number|null|undefined} val - Valor numérico a formatar.
 * @returns {string} String formatada. Ex: "R$\xa01.350,00"
 */
function formatCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Gera a string de mês/ano no formato YYYY-MM, com zero à esquerda no mês.
 * Usado como chave padrão de competência em todo o app.
 *
 * @param {number} year  - Ano com 4 dígitos (ex: 2026).
 * @param {number} month - Mês de 1 a 12.
 * @returns {string} Formato YYYY-MM (ex: "2026-11").
 */
function getYearMonthString(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Exibe uma notificação toast na tela por 2,5 segundos.
 * Usa a API DOM segura (textContent) em vez de innerHTML para evitar XSS,
 * mesmo quando a mensagem conteém input do usuário (ex: nome do perfil).
 *
 * @param {string} msg - Mensagem a exibir no toast.
 */
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Construção segura via DOM — evita XSS com innerHTML
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-circle-check';
  icon.style.color = '#10b981';

  const span = document.createElement('span');
  span.textContent = msg; // textContent não interpreta HTML — seguro com qualquer input

  toast.innerHTML = '';
  toast.appendChild(icon);
  toast.appendChild(document.createTextNode(' '));
  toast.appendChild(span);

  toast.classList.add('show');
  // Remove automaticamente após 2,5 segundos
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ================================================================
// 4. NAVEGAÇÃO SPA — TROCA DE TELAS
// ================================================================

/**
 * Alterna a tela visível do app (Dashboard, Ganhos ou Gastos).
 * Atualiza o estado, os botões da sidebar, o título da topbar
 * e fecha o menu lateral em dispositivos móveis.
 * Exposta globalmente (window) para ser chamada via onclick no HTML.
 *
 * @param {string} viewId - ID da tela: 'dashboard' | 'incomes' | 'expenses'.
 */
window.switchToView = function(viewId) {
  // Ignora IDs de tela desconhecidos para evitar erros silenciosos
  if (!VIEW_TITLES[viewId]) return;
  state.currentView = viewId;

  // Marca o botão ativo na sidebar e desmarca os demais
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  // Atualiza o título da topbar para o nome da tela ativa
  document.getElementById('currentViewTitle').textContent = VIEW_TITLES[viewId];

  // Remove a classe .active de todas as seções e ativa apenas a selecionada
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) {
    targetSection.classList.add('active');
    // Rola para o topo com animação suave ao trocar de tela
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Em mobile, fecha o menu lateral após selecionar uma tela
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  // Re-renderiza toda a interface para refletir a tela ativa
  renderAll();
};

// ================================================================
// 5. ORQUESTRADOR CENTRAL DE RENDERIZAÇÃO
// ================================================================

/**
 * Função central de re-renderização do app.
 * Deve ser chamada SEMPRE que o estado (mês, dados) mudar.
 * Ela recalcula todos os totais e repinta todas as telas.
 *
 * FLUXO:
 *  1. Calcula o mês de competência (ym) e o label legível.
 *  2. Busca todos os itens do mês em FinanceData.getByMonth().
 *  3. Separa os itens por tipo e calcula os totais financeiros.
 *  4. Atualiza os badges da sidebar e o saldo da topbar.
 *  5. Delega para as funções de renderização de cada tela.
 */
function renderAll() {
  const ym         = getYearMonthString(state.currentYear, state.currentMonth);
  const monthLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;

  // Atualiza o rótulo de mês no seletor e em todas as telas
  document.getElementById('currentMonthLabel').textContent = monthLabel;
  document.querySelectorAll('.badge-month-label').forEach(el => {
    el.textContent = monthLabel;
  });

  // Busca todos os itens financeiros do mês atual (entradas + projeções fixas)
  const entries   = FinanceData.getByMonth(ym);
  const incomes   = entries.filter(e => e.type === 'income');
  const allFixed  = entries.filter(e => e.type === 'fixed');
  const variables = entries.filter(e => e.type === 'variable');

  // Filtra apenas fixos ativos (ou pagos) para o cálculo de totais.
  // Fixos inativos ainda aparecem na tela de Gastos para gerenciamento,
  // mas não entram nos totais financeiros do mês.
  const activeFixed = allFixed.filter(e => e.active !== false || e.paid);

  // Cálculo dos totais do mês
  const totalIncome   = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalFixed    = activeFixed.reduce((sum, item) => sum + item.amount, 0);
  const totalVariable = variables.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const balance       = totalIncome - totalExpenses; // Saldo = Ganhos - (Fixos + Variáveis)

  // Atualiza os contadores na sidebar
  document.getElementById('sidebarIncomeCount').textContent  = incomes.length;
  document.getElementById('sidebarExpenseCount').textContent = activeFixed.length + variables.length;

  // Atualiza o saldo no canto superior direito da topbar
  const topbarBal = document.getElementById('topbarBalance');
  topbarBal.textContent  = formatCurrency(balance);
  topbarBal.style.color  = balance >= 0 ? 'var(--success)' : 'var(--danger)';

  // Delega para cada tela sua renderização específica
  renderDashboardView(incomes, activeFixed, variables, totalIncome, totalFixed, totalVariable, balance, ym);
  renderIncomesView(incomes, totalIncome);
  // allFixed (com inativos) é passado para permitir gerenciar gastos pausados na tela de Gastos
  renderExpensesView(allFixed, variables, totalFixed, totalVariable, totalExpenses);
}

// ================================================================
// 6. DASHBOARD & SAÚDE FINANCEIRA
// ================================================================

/**
 * Renderiza todos os componentes da tela Dashboard:
 * KPIs, diagnóstico de saúde financeira, Centro de Dívidas e gráfico.
 *
 * @param {Array}  incomes       - Lançamentos de renda do mês.
 * @param {Array}  fixed         - Gastos fixos ativos do mês.
 * @param {Array}  variables     - Gastos variáveis do mês.
 * @param {number} totalIncome   - Total de ganhos em R$.
 * @param {number} totalFixed    - Total de gastos fixos em R$.
 * @param {number} totalVariable - Total de gastos variáveis em R$.
 * @param {number} balance       - Saldo: totalIncome - (totalFixed + totalVariable).
 * @param {string} ym            - Mês de competência "YYYY-MM".
 */
function renderDashboardView(incomes, fixed, variables, totalIncome, totalFixed, totalVariable, balance, ym) {
  // --- KPI: Total Recebido ---
  document.getElementById('totalIncomeDisplay').textContent = formatCurrency(totalIncome);
  document.getElementById('incomeCount').textContent =
    `${incomes.length} ${incomes.length === 1 ? 'entrada' : 'entradas'}`;

  // --- KPI: Gastos Fixos ---
  document.getElementById('totalFixedDisplay').textContent = formatCurrency(totalFixed);
  const fixedPaidCount = fixed.filter(f => f.paid).length;
  document.getElementById('fixedPaidStatus').textContent =
    fixed.length > 0 ? `${fixedPaidCount} de ${fixed.length} contas pagas` : 'Nenhuma conta no mês';

  // --- KPI: Gastos Variáveis ---
  document.getElementById('totalVariableDisplay').textContent = formatCurrency(totalVariable);

  // --- KPI: Saldo / Sobra (cor muda conforme positivo ou negativo) ---
  const balanceCard = document.getElementById('balanceDisplay');
  balanceCard.textContent = formatCurrency(balance);
  balanceCard.className   = balance >= 0 ? 'kpi-value text-success' : 'kpi-value text-danger';

  // --- Cálculo das porcentagens para a regra 50/30/20 ---
  // Evita divisão por zero quando não há renda cadastrada
  let pctFixed = 0, pctVar = 0, pctSave = 0;
  if (totalIncome > 0) {
    pctFixed = Math.round((totalFixed    / totalIncome) * 100);
    pctVar   = Math.round((totalVariable / totalIncome) * 100);
    // pctSave = o que sobra, nunca negativo (Math.max garante >= 0)
    pctSave  = Math.max(0, 100 - pctFixed - pctVar);
  }

  document.getElementById('fixedPercentage').textContent    = `${pctFixed}% da renda`;
  document.getElementById('variablePercentage').textContent = `${pctVar}% da renda`;

  // --- Previsão de sobra diária até o final do mês ---
  const today      = new Date();
  // Dia 0 do próximo mês = último dia do mês atual
  const daysInMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();
  // Garante ao menos 1 para evitar divisão por zero no último dia do mês
  const daysLeft    = Math.max(1, daysInMonth - today.getDate());

  if (balance > 0) {
    const dailyAvailable = balance / daysLeft;
    document.getElementById('dailyBudgetDisplay').textContent =
      `Sobra média de ${formatCurrency(dailyAvailable)}/dia nos ${daysLeft} dias restantes`;
  } else {
    document.getElementById('dailyBudgetDisplay').textContent =
      balance < 0
        ? `Atenção: déficit de ${formatCurrency(Math.abs(balance))} no mês`
        : 'Sem sobra no momento';
  }

  // --- Sub-componentes do Dashboard ---
  renderHealthDiagnostic(totalIncome, balance, pctFixed, pctVar, pctSave);
  renderDebtCenter(ym);
  renderCategoryChart(fixed, variables);
  renderGoalsSection(fixed, variables);
}

/**
 * Atualiza o diagnóstico visual de saúde financeira baseado na regra 50/30/20.
 * Determina o status (Excelente / Equilibrado / Fixos Altos / Déficit / Sem Renda)
 * e atualiza o ícone, badge, título e descrição do banner de diagnóstico.
 * Também atualiza os percentuais e as barras de progresso da distribuição.
 *
 * Regra 50/30/20:
 *  - Até 50% da renda em gastos fixos essenciais.
 *  - Até 30% em gastos variáveis e lazer.
 *  - Mínimo de 20% em poupança/investimento.
 *
 * @param {number} income   - Total de renda do mês (R$).
 * @param {number} balance  - Saldo: renda - gastos (R$).
 * @param {number} pctFixed - % da renda comprometida com gastos fixos.
 * @param {number} pctVar   - % da renda comprometida com gastos variáveis.
 * @param {number} pctSave  - % restante disponível para poupança.
 */
function renderHealthDiagnostic(income, balance, pctFixed, pctVar, pctSave) {
  const icon  = document.getElementById('healthStatusIcon');
  const title = document.getElementById('healthTitle');
  const desc  = document.getElementById('healthDescription');
  const badge = document.getElementById('healthBadge');

  // Atualiza os percentuais nos rótulos da barra 50/30/20
  document.getElementById('lblPctFixed').textContent = `${pctFixed}%`;
  document.getElementById('lblPctVar').textContent   = `${pctVar}%`;
  document.getElementById('lblPctSave').textContent  = `${pctSave}%`;

  // Atualiza as larguras das barras de progresso (limitado a 100% para não transbordar)
  document.getElementById('barFixed').style.width    = `${Math.min(100, pctFixed)}%`;
  document.getElementById('barVariable').style.width = `${Math.min(100, pctVar)}%`;
  document.getElementById('barSavings').style.width  = `${Math.min(100, pctSave)}%`;

  // --- Diagnóstico por prioridade (do pior para o melhor) ---

  if (income === 0) {
    badge.className = 'badge badge-warning';
    badge.textContent = 'Sem Renda';
    icon.innerHTML = '<i class="fa-solid fa-hourglass-start"></i>';
    icon.style.background = 'var(--warning-bg)';
    icon.style.color = 'var(--warning)';
    title.textContent = 'Nenhuma renda lançada neste mês';
    desc.textContent = 'Acesse a aba Ganhos do Mês para inserir seu salário ou receitas.';
    return;
  }

  if (balance < 0) {
    badge.className = 'badge badge-danger';
    badge.textContent = 'Alerta: Déficit';
    icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    icon.style.background = 'var(--danger-bg)';
    icon.style.color = 'var(--danger)';
    title.textContent = 'Seus gastos superaram seus ganhos!';
    desc.textContent = `Você está com saldo negativo de ${formatCurrency(Math.abs(balance))}. Priorize pagar as dívidas essenciais para evitar juros.`;
  } else if (pctFixed > 55) {
    badge.className = 'badge badge-warning';
    badge.textContent = 'Fixos Altos';
    icon.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
    icon.style.background = 'var(--warning-bg)';
    icon.style.color = 'var(--warning)';
    title.textContent = 'Atenção com as despesas fixas e parcelas';
    desc.textContent = `Seus gastos fixos consomem ${pctFixed}% da renda (o ideal recomendado é até 50%). Revise suas assinaturas e contas fixas para equilibrar seu orçamento.`;
  } else if (pctSave >= 20) {
    badge.className = 'badge badge-success';
    badge.textContent = 'Excelente';
    icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    icon.style.background = 'var(--success-bg)';
    icon.style.color = 'var(--success)';
    title.textContent = 'Finanças sob total controle 🎉';
    desc.textContent = `Você tem ${pctSave}% (${formatCurrency(balance)}) disponível para construir sua reserva de emergência e investir!`;
  } else {
    badge.className = 'badge badge-success';
    badge.textContent = 'Equilibrado';
    icon.innerHTML = '<i class="fa-solid fa-scale-balanced"></i>';
    icon.style.background = 'var(--primary-bg)';
    icon.style.color = 'var(--primary)';
    title.textContent = 'Orçamento mensal saudável';
    desc.textContent = `Contas em dia com sobra positiva de ${formatCurrency(balance)} garantindo sua tranquilidade financeira.`;
  }
}

// ================================================================
// 7. CENTRO DE DÍVIDAS & PREVISÃO DE QUITAÇÃO
// ================================================================

/**
 * Renderiza o painel "Centro de Dívidas" no Dashboard.
 * Identifica automaticamente os templates marcados como dívida/parcelamento
 * (por isDebt, endMonth, ou por categoria/descrição) e exibe para cada um:
 *  - Barra de progresso de parcelas pagas vs. restantes.
 *  - Valor restante a pagar e previsão de quitação.
 *  - Badge "Quitada!" quando todas as parcelas foram baixadas.
 *
 * O painel é 100% dinâmico: alimentado apenas pelos dados que o
 * próprio usuário cadastra — não há dados fixos hardcoded.
 *
 * @param {string} currentYm - Mês atual no formato "YYYY-MM".
 */
function renderDebtCenter(currentYm) {
  const container = document.getElementById('debtCardsGrid');
  const totalRemainingEl = document.getElementById('totalDebtRemaining');
  if (!container) return;

  const templates = FinanceData.getTemplates();
  // Identifica dívidas ou parcelamentos definidos pelo usuário
  const debtTemplates = templates.filter(t => {
    if (t.isDebt || t.endMonth) return true;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.desc || '').toLowerCase();
    return cat.includes('empréstimo') || cat.includes('emprestimo') ||
           cat.includes('parcela') || cat.includes('financiamento') ||
           cat.includes('dívida') || cat.includes('divida') ||
           desc.includes('empréstimo') || desc.includes('emprestimo') ||
           desc.includes('parcela') || desc.includes('financiamento') ||
           desc.includes('dívida') || desc.includes('divida');
  });

  if (debtTemplates.length === 0) {
    container.innerHTML = `
      <div class="empty-state-debt" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: var(--text-muted); opacity: 0.85;">
        <i class="fa-solid fa-flag-checkered" style="font-size: 2rem; margin-bottom: 0.6rem; opacity: 0.4;"></i>
        <p style="font-weight: 500; margin-bottom: 0.25rem;">Nenhum parcelamento ou empréstimo em andamento</p>
        <span style="font-size: 0.85rem;">Ao cadastrar um gasto fixo com data final ou categoria de empréstimo/parcelamento, o cronograma de quitação aparecerá aqui automaticamente.</span>
      </div>
    `;
    if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(0);
    return;
  }

  let overallRemaining = 0;

  const cardsHtml = debtTemplates.map(tpl => {
    const paidMonthsCount = tpl.paidMonths ? Object.values(tpl.paidMonths).filter(Boolean).length : 0;
    
    // Se o usuário especificou endMonth, calcula o total de parcelas
    let totalMonths = 0;
    let remainingMonths = 0;
    
    if (tpl.endMonth && tpl.startMonth) {
      const [sYear, sMonth] = tpl.startMonth.split('-').map(Number);
      const [eYear, eMonth] = tpl.endMonth.split('-').map(Number);
      totalMonths = Math.max(1, (eYear - sYear) * 12 + (eMonth - sMonth) + 1);
      remainingMonths = Math.max(0, totalMonths - paidMonthsCount);
    } else {
      totalMonths = paidMonthsCount + (tpl.paidMonths && tpl.paidMonths[currentYm] ? 0 : 1);
      remainingMonths = tpl.paidMonths && tpl.paidMonths[currentYm] ? 0 : 1;
    }

    const remainingAmount = remainingMonths * tpl.amount;
    const paidAmount = paidMonthsCount * tpl.amount;
    const totalProg = remainingAmount + paidAmount || (tpl.amount * totalMonths);
    overallRemaining += remainingAmount;

    const pctPaid = totalProg > 0 ? Math.min(100, Math.round((paidAmount / totalProg) * 100)) : 0;
    const isFinished = remainingMonths === 0 || (tpl.endMonth && currentYm > tpl.endMonth);

    return `
      <div class="debt-card-item">
        <div class="debt-card-header">
          <span>${escapeHtml(tpl.desc)}</span>
          <span class="debt-status-tag ${isFinished ? 'badge-success' : 'badge-warning'}">
            ${isFinished ? '🎉 Quitada!' : `${remainingMonths}x restantes`}
          </span>
        </div>
        <div class="debt-progress-bg">
          <div class="debt-progress-fill" style="width: ${pctPaid}%; background: ${isFinished ? 'var(--success)' : 'var(--warning)'};"></div>
        </div>
        <div class="debt-card-meta">
          <span>Resta: <strong>${formatCurrency(remainingAmount)}</strong></span>
          <span>${tpl.endMonth ? `Previsão: ${tpl.endMonth.split('-').reverse().join('/')}` : 'Gasto Ativo'}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
  if (totalRemainingEl) {
    totalRemainingEl.textContent = formatCurrency(overallRemaining);
  }
}

// ================================================================
// 8. GRÁFICO DE DISTRIBUIÇÃO DE GASTOS (Chart.js — Doughnut)
// ================================================================

/**
 * Renderiza o gráfico de rosca (doughnut) com a distribuição
 * dos gastos do mês por categoria.
 * Destrói e recria a instância do Chart.js para evitar sobreposição
 * de gráficos ao mudar de mês ou atualizar dados.
 * Exibe uma mensagem de "vazio" quando não há gastos no mês.
 *
 * @param {Array} fixed     - Gastos fixos do mês (cada item contribui com sua categoria).
 * @param {Array} variables - Gastos variáveis do mês.
 */
function renderCategoryChart(fixed, variables) {
  const ctx = document.getElementById('categoryChart');
  const emptyMsg = document.getElementById('chartEmptyMessage');
  if (!ctx) return;

  const catTotals = {};
  [...fixed, ...variables].forEach(item => {
    const cat = item.type === 'fixed' ? (item.category || item.desc) : item.category;
    catTotals[cat] = (catTotals[cat] || 0) + item.amount;
  });

  const labels = Object.keys(catTotals);
  const data = Object.values(catTotals);

  if (labels.length === 0) {
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
    ctx.style.display = 'none';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  ctx.style.display = 'block';
  if (emptyMsg) emptyMsg.style.display = 'none';

  const colors = [
    '#6366f1', '#f59e0b', '#ec4899', '#10b981', '#3b82f6',
    '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#64748b'
  ];

  if (typeof Chart === 'undefined') {
    console.info('Chart.js ainda não carregou ou está indisponível.');
    return;
  }

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#151a26',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 12,
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(c) {
              const val = c.raw || 0;
              const sum = data.reduce((a, b) => a + b, 0);
              const pct = ((val / sum) * 100).toFixed(1);
              return ` ${c.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

// ================================================================
// 9. TELA DE GANHOS — GERENCIADOR DE RECEITAS
// ================================================================

/**
 * Renderiza a tela "Ganhos do Mês" com o total e a lista detalhada de receitas.
 * Cada item exibe descrição, categoria, data, valor e botões de editar/excluir.
 * Exibe um estado vazio com instruções quando não há ganhos no mês.
 *
 * @param {Array}  incomes     - Lançamentos de renda do mês.
 * @param {number} totalIncome - Soma total de ganhos do mês em R$.
 */
function renderIncomesView(incomes, totalIncome) {
  document.getElementById('incomesPageTotal').textContent = formatCurrency(totalIncome);

  const container = document.getElementById('incomesListDetailed');
  if (!container) return;

  if (incomes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-hand-holding-dollar" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>Nenhum ganho cadastrado para este mês ainda.</p>
        <span>Use o formulário acima para adicionar seu salário ou rendas extras.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = incomes.map(item => `
    <div class="manage-item-card">
      <div class="card-item-left">
        <div class="card-type-icon bg-green-soft">
          <i class="fa-solid fa-arrow-down"></i>
        </div>
        <div class="card-item-info">
          <div class="card-item-title">${escapeHtml(item.desc)}</div>
          <div class="card-item-meta">
            <span class="tag-badge">${escapeHtml(item.category || 'Renda')}</span>
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(item.date)}</span>
          </div>
        </div>
      </div>

      <div class="card-item-right">
        <div class="card-item-amount text-success">+ ${formatCurrency(item.amount)}</div>
        <div class="card-item-actions">
          <button class="btn-action-edit" onclick="openEditModal('${item.id}')" title="Alterar Ganho">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action-delete" onclick="deleteEntry('${item.id}')" title="Excluir Ganho">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ================================================================
// 10. TELA DE GASTOS — GERENCIADOR DE DESPESAS
// ================================================================

/**
 * Renderiza a tela "Gastos do Mês" com filtros, subtotais e lista.
 * Suporta filtragem por tipo (Todos / Fixos / Variáveis).
 * Para gastos fixos, exibe botões de status (Ativo/Inativo) e checkbox de pagamento.
 * Gastos inativos são exibidos com estilo esmaecido para facilitar identificação.
 *
 * @param {Array}  fixed         - Todos os gastos fixos do mês (incluindo inativos).
 * @param {Array}  variables     - Gastos variáveis do mês.
 * @param {number} totalFixed    - Total de fixos ativos em R$ (para o subtotal).
 * @param {number} totalVariable - Total de variáveis em R$.
 * @param {number} totalExpenses - totalFixed + totalVariable.
 */
function renderExpensesView(fixed, variables, totalFixed, totalVariable, totalExpenses) {
  document.getElementById('expensesPageTotal').textContent = formatCurrency(totalExpenses);
  document.getElementById('subtotalFixedLabel').textContent = formatCurrency(totalFixed);
  document.getElementById('subtotalVarLabel').textContent = formatCurrency(totalVariable);

  const container = document.getElementById('expensesListDetailed');
  if (!container) return;

  // Filtrar de acordo com a aba selecionada
  let itemsToDisplay = [];
  if (state.expenseFilter === 'all') {
    itemsToDisplay = [...fixed, ...variables];
  } else if (state.expenseFilter === 'fixed') {
    itemsToDisplay = fixed;
  } else if (state.expenseFilter === 'variable') {
    itemsToDisplay = variables;
  }

  if (itemsToDisplay.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>Nenhum gasto encontrado para este filtro.</p>
        <span>Cadastre uma nova despesa no formulário acima.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = itemsToDisplay.map(item => {
    const isFixed = item.type === 'fixed';
    const typeLabel = isFixed ? 'Conta Fixa Recorrente' : 'Gasto Variável';
    const iconClass = isFixed ? 'bg-yellow-soft' : 'bg-red-soft';
    const iconI = isFixed ? 'fa-solid fa-lock' : 'fa-solid fa-cart-shopping';
    const isInactive = isFixed && item.active === false;

    return `
      <div class="manage-item-card ${item.paid ? 'is-paid' : ''} ${isInactive ? 'is-inactive-card' : ''}">
        <div class="card-item-left">
          <div class="card-type-icon ${iconClass}">
            <i class="${iconI}"></i>
          </div>
          <div class="card-item-info">
            <div class="card-item-title">${escapeHtml(item.desc)}</div>
            <div class="card-item-meta">
              <span class="tag-badge">${escapeHtml(item.category || typeLabel)}</span>
              <span class="tag-badge" style="opacity: 0.8;">${typeLabel}</span>
              ${isFixed ? `
                <button class="badge-status-btn ${item.active ? 'status-active' : 'status-inactive'}" 
                        onclick="toggleActiveStatus('${item.id}')" 
                        title="Clique para ${item.active ? 'pausar nos meses seguintes' : 'reativar nos meses seguintes'}">
                  <i class="fa-solid ${item.active ? 'fa-circle-check' : 'fa-circle-pause'}"></i> ${item.active ? 'Ativo' : 'Inativo'}
                </button>
              ` : ''}
              <span><i class="fa-regular fa-calendar"></i> ${formatDate(item.date)}</span>
            </div>
          </div>
        </div>

        <div class="card-item-right">
          <!-- Checkbox de Pago (específico para o mês atual) -->
          <label class="checkbox-paid-label" title="${item.paid ? 'Marcar como pendente neste mês' : 'Dar baixa como pago neste mês'}">
            <input type="checkbox" ${item.paid ? 'checked' : ''} onchange="togglePaidEntry('${item.id}')" />
            <span>${item.paid ? 'Pago' : 'Pagar'}</span>
          </label>

          <div class="card-item-amount ${isFixed ? 'text-warning' : 'text-danger'} ${isInactive ? 'text-muted' : ''}">
            - ${formatCurrency(item.amount)}
          </div>

          <div class="card-item-actions">
            <button class="btn-action-edit" onclick="openEditModal('${item.id}')" title="Alterar Informação">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-action-delete" onclick="deleteEntry('${item.id}')" title="Excluir Gasto">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================================================================
// 11. MODAL DE EDIÇÃO DE LANÇAMENTOS
// ================================================================

/**
 * Abre o modal de edição preenchido com os dados do item especificado.
 * Detecta automaticamente se é um ganho, gasto fixo ou variável
 * e ajusta a visibilidade dos campos de Status e Mês Final.
 * Exposta globalmente para ser chamada via onclick no HTML.
 *
 * @param {string} id - ID do item a editar (entry-* ou fix-*).
 */
window.openEditModal = function(id) {
  const all = FinanceData.getAll();
  const item = all.find(e => e.id === id);
  if (!item) {
    console.warn('[GastoPro] Item não encontrado para edição:', id);
    return;
  }

  document.getElementById('editItemId').value = item.id;
  document.getElementById('editDesc').value = item.desc || '';
  document.getElementById('editAmount').value = item.amount || '';
  document.getElementById('editCategory').value = item.category || '';

  const editTypeSelect = document.getElementById('editType');
  if (editTypeSelect) {
    editTypeSelect.value = item.type || (item.isDebt ? 'debt' : (item.isTemplate ? 'fixed' : 'variable'));
  }

  document.getElementById('editDate').value = item.date || getTodayString();

  const isFixed = item.type === 'fixed' || item.type === 'debt' || item.isTemplate || (typeof id === 'string' && id.startsWith('fix-'));
  const statusGroup = document.getElementById('editStatusGroup');
  const endMonthGroup = document.getElementById('editEndMonthGroup');
  if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
  if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';

  if (document.getElementById('editActive')) {
    document.getElementById('editActive').value = item.active !== false ? 'true' : 'false';
  }
  if (document.getElementById('editEndMonth')) {
    document.getElementById('editEndMonth').value = item.endMonth || '';
  }

  const title = item.type === 'income' ? 'Alterar Ganho' : (isFixed ? 'Alterar Gasto Fixo' : 'Alterar Gasto Variável');
  document.getElementById('editModalTitle').textContent = title;

  document.getElementById('editModal').classList.add('active');
};

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

// ================================================================
// 12. MODAL DE CONFIRMAÇÃO CUSTOMIZADO
// ================================================================

/**
 * Exibe um modal de confirmação elegante que substitui o confirm() nativo.
 * Usa clonagem de botões para remover listeners anteriores e evitar
 * acúmulo de callbacks (importante em ações repetidas como excluir).
 *
 * @param {Object}   options            - Configurações do modal.
 * @param {string}   options.title      - Título do modal.
 * @param {string}   options.message    - Mensagem de confirmação.
 * @param {string}   [options.iconClass]   - Classe FontAwesome do ícone.
 * @param {string}   [options.okLabel]     - Texto do botão de confirmação.
 * @param {string}   [options.okBtnClass]  - Classe CSS do botão OK.
 * @param {Function} options.onConfirm  - Callback executado ao confirmar.
 */
function showConfirm({ title, message, iconClass, okLabel, okBtnClass, onConfirm }) {
  const modal = document.getElementById('confirmModal');
  const iconEl = document.getElementById('confirmIcon');
  const iconWrapper = document.getElementById('confirmIconWrapper');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  iconEl.className = iconClass || 'fa-solid fa-triangle-exclamation';
  iconWrapper.className = 'confirm-icon-wrapper confirm-icon-danger';
  titleEl.textContent = title || 'Tem certeza?';
  msgEl.textContent = message || 'Esta ação não pode ser desfeita.';

  // Clona os botões para remover listeners antigos e evitar acúmulo
  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newOk.textContent = okLabel || 'Confirmar';
  newOk.className = okBtnClass || 'btn-danger';

  newOk.addEventListener('click', () => {
    modal.classList.remove('active');
    onConfirm();
  });
  newCancel.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.classList.add('active');
}

// ================================================================
// 13. AÇÕES DO USUÁRIO (globais — chamadas via onclick no HTML)
// ================================================================

/**
 * Exibe confirmação e exclui um item (lançamento ou template).
 * Para templates fixos, exibe aviso de que o gasto deixará de se repetir.
 * Exposta globalmente para ser chamada via onclick no HTML.
 *
 * @param {string} id - ID do item a excluir.
 */
window.deleteEntry = function(id) {
  const isFixed = id.startsWith('fix-');
  showConfirm({
    title: isFixed ? 'Excluir gasto fixo recorrente?' : 'Excluir lançamento?',
    message: isFixed 
      ? 'Este gasto fixo deixará de se repetir nos meses futuros. Deseja realmente excluir?'
      : 'Esta ação não pode ser desfeita. O item será removido permanentemente.',
    iconClass: 'fa-solid fa-trash-can',
    okLabel: 'Sim, excluir',
    onConfirm: () => {
      FinanceData.delete(id);
      renderAll();
      showToast('Item excluído com sucesso!');
    }
  });
};

/**
 * Inverte o status de pagamento de um item para o mês atual.
 * Para templates fixos: registra a baixa em paidMonths[ym].
 * Para lançamentos: alterna o campo paid.
 * Exposta globalmente para ser chamada via onchange no HTML.
 *
 * @param {string} id - ID do item.
 */
window.togglePaidEntry = function(id) {
  const ym = getYearMonthString(state.currentYear, state.currentMonth);
  FinanceData.togglePaid(id, ym);
  renderAll();
};

/**
 * Inverte o status ativo/inativo de um template de gasto fixo.
 * Gastos inativos são mantidos no banco mas excluídos dos totais futuros.
 * Exposta globalmente para ser chamada via onclick no HTML.
 *
 * @param {string} id - ID do template fixo.
 */
window.toggleActiveStatus = function(id) {
  const isNowActive = FinanceData.toggleActive(id);
  renderAll();
  showToast(isNowActive ? 'Gasto fixo ativado nos próximos meses!' : 'Gasto fixo pausado nos próximos meses!');
};

/**
 * Retorna a data de hoje no formato ISO YYYY-MM-DD.
 * Usado para pré-preencher campos de data nos formulários.
 *
 * @returns {string} Data atual no formato "YYYY-MM-DD".
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Sanitiza strings para exibição segura no HTML, prevenindo XSS.
 * Escapa os caracteres especiais: &, <, >, " e ' (aspas simples).
 * O escape de ' &#x27; é essencial para atributos onclick que usam
 * aspas simples como delimitador: onclick="fn('${id}')".
 *
 * @param {string|null|undefined} str - Texto a sanitizar.
 * @returns {string} Texto com caracteres especiais escapados.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;'); // Escapa aspas simples — protége atributos onclick='...'
}

/**
 * Converte uma data no formato YYYY-MM-DD para DD/MM.
 * Exibição compacta usada nos cards de itens.
 *
 * @param {string|null} dateStr - Data no formato YYYY-MM-DD.
 * @returns {string} Data no formato DD/MM, ou string vazia se inválida.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

// ================================================================
// 14. MINI CALENDÁRIO POPOVER (definido dentro do DOMContentLoaded)
// 15. EVENT LISTENERS & INICIALIZAÇÃO DO APP
// ================================================================

/**
 * Bootstrap principal do app.
 * Registra todos os event listeners e executa a renderização inicial.
 * Usa DOMContentLoaded para garantir que o HTML já está disponível.
 *
 * ORDEM DE INICIALIZAÇÃO:
 *  1. Navegação da sidebar (troca de telas).
 *  2. Menu mobile (abrir/fechar sidebar).
 *  3. Navegação de meses (setas prev/next).
 *  4. Mini calendário popover (seleção de mês/ano).
 *  5. Formulário de novo ganho.
 *  6. Formulário de novo gasto (com toggle de dívida).
 *  7. Filtros de gastos (Todos / Fixos / Variáveis).
 *  8. Modal de edição.
 *  9. Exportação e reset de dados.
 *  10. Drawer do usuário (foto e nome).
 *  11. Render inicial do perfil e da interface.
 *  12. Registro do Service Worker (PWA).
 */
document.addEventListener('DOMContentLoaded', () => {

  // ── 1. Navegação da Sidebar ────────────────────────────────────
  // Apenas botões COM data-view disparam switchToView() (evita chamar com null)
  document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchToView(view);
    });
  });

  // ── 2. Menu Mobile (hamburguer + overlay) ─────────────────────
  const sidebarEl        = document.getElementById('sidebar');
  const sidebarOverlayEl = document.getElementById('sidebarOverlay');
  const menuToggleBtn    = document.getElementById('menuToggleBtn');
  const closeSidebarBtn  = document.getElementById('closeSidebarBtn');

  /** Abre o menu lateral em dispositivos móveis. */
  function openMobileSidebar() {
    if (sidebarEl)        sidebarEl.classList.add('open');
    if (sidebarOverlayEl) sidebarOverlayEl.classList.add('active');
  }

  /** Fecha o menu lateral em dispositivos móveis. */
  function closeMobileSidebar() {
    if (sidebarEl)        sidebarEl.classList.remove('open');
    if (sidebarOverlayEl) sidebarOverlayEl.classList.remove('active');
  }

  if (menuToggleBtn)    menuToggleBtn.addEventListener('click', openMobileSidebar);
  if (closeSidebarBtn)  closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarOverlayEl) sidebarOverlayEl.addEventListener('click', closeMobileSidebar);

  // ── 3. Navegação de Meses (setas prev/next) ───────────────────
  // Ao chegar no limite (jan/dez) vira para o ano anterior/seguinte
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 1) {
      state.currentMonth = 12;
      state.currentYear--;  // Retrocede o ano ao passar de Janeiro
    }
    renderAll();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 12) {
      state.currentMonth = 1;
      state.currentYear++;  // Avança o ano ao passar de Dezembro
    }
    renderAll();
  });

  // ── 4. Mini Calendário Popover (Month Picker) ─────────────────
  // Permite navegar diretamente para qualquer mês/ano clicando no label
  const monthPickerTrigger = document.getElementById('monthPickerTrigger');
  const monthPickerPopover = document.getElementById('monthPickerPopover');
  const pickerPrevYearBtn  = document.getElementById('pickerPrevYearBtn');
  const pickerNextYearBtn  = document.getElementById('pickerNextYearBtn');
  const pickerYearDisplay  = document.getElementById('pickerYearDisplay');
  const pickerMonthsGrid   = document.getElementById('pickerMonthsGrid');

  /** Ano atualmente exibido dentro do popover (independente do mês ativo). */
  let pickerYear = state.currentYear;

  /** Abreviações dos meses para exibição na grade do calendário. */
  const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  /**
   * Constrói a grade de meses no popover para o ano exibido.
   * Marca o mês ativo com a classe 'selected' e meses com dados com 'has-data'.
   */
  function renderMonthPicker() {
    pickerYearDisplay.textContent = pickerYear;
    const all       = FinanceData.getAll();
    const templates = FinanceData.getTemplates();

    pickerMonthsGrid.innerHTML = SHORT_MONTHS.map((name, index) => {
      const monthNum   = index + 1;
      const ym         = `${pickerYear}-${String(monthNum).padStart(2, '0')}`;
      const isSelected = pickerYear === state.currentYear && monthNum === state.currentMonth;

      // Verifica lançamentos pontuais com month === ym
      const hasEntry = all.some(e => !e.isTemplate && e.month === ym);

      // Verifica se algum template fixo está vigente neste mês
      const hasTemplate = templates.some(t => {
        const started  = !t.startMonth || t.startMonth <= ym;
        const notEnded = !t.endMonth   || ym <= t.endMonth;
        return t.active !== false && started && notEnded;
      });

      const hasData = hasEntry || hasTemplate;

      return `
        <button class="picker-month-btn ${isSelected ? 'selected' : ''} ${hasData ? 'has-data' : ''}" 
                onclick="selectMonthFromPicker(${pickerYear}, ${monthNum})">
          ${name}
        </button>
      `;
    }).join('');
  }

  /**
   * Navega para o mês/ano selecionado no calendário popover.
   * Exposta globalmente para ser chamada via onclick no HTML gerado.
   *
   * @param {number} year  - Ano selecionado.
   * @param {number} month - Mês selecionado (1–12).
   */
  window.selectMonthFromPicker = function(year, month) {
    state.currentYear  = year;
    state.currentMonth = month;
    closeMonthPicker();
    renderAll();
  };

  /** Alterna a visibilidade do popover de calendário. */
  function toggleMonthPicker() {
    if (!monthPickerPopover) return;
    const isOpen = monthPickerPopover.classList.contains('open');
    if (isOpen) {
      closeMonthPicker();
    } else {
      pickerYear = state.currentYear; // Inicia no ano do mês ativo
      renderMonthPicker();
      monthPickerPopover.classList.add('open');
      if (monthPickerTrigger) monthPickerTrigger.classList.add('active');
    }
  }

  /** Fecha o popover de calendário. */
  function closeMonthPicker() {
    if (monthPickerPopover) monthPickerPopover.classList.remove('open');
    if (monthPickerTrigger) monthPickerTrigger.classList.remove('active');
  }

  if (monthPickerTrigger) {
    monthPickerTrigger.addEventListener('click', (e) => {
      // stopPropagation impede que o clique borbulhe até o document.click
      // que fecharia o popover imediatamente após abri-lo
      e.stopPropagation();
      toggleMonthPicker();
    });
  }

  if (pickerPrevYearBtn) {
    pickerPrevYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear--;
      renderMonthPicker();
    });
  }

  if (pickerNextYearBtn) {
    pickerNextYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear++;
      renderMonthPicker();
    });
  }

  // Fechar popover ao clicar fora
  document.addEventListener('click', (e) => {
    const selectorBar = document.getElementById('monthSelectorBar');
    if (selectorBar && !selectorBar.contains(e.target)) {
      closeMonthPicker();
    }
  });

  // ── 5. Formulário de Novo Ganho ────────────────────────────────
  // Pré-preenche o campo de data com hoje ao abrir o formulário
  const incomeDateInput = document.getElementById('incomeDate');
  if (incomeDateInput) incomeDateInput.value = getTodayString();

  document.getElementById('incomeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc     = document.getElementById('incomeDesc').value.trim();
    const amount   = parseFloat(document.getElementById('incomeAmount').value);
    const category = document.getElementById('incomeCategory').value;
    const dateVal  = document.getElementById('incomeDate').value || getTodayString();

    // Validações básicas antes de persistir
    if (!desc) {
      alert('Por favor, informe a descrição do ganho.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido para o ganho.');
      return;
    }

    // O mês de competência é extraído da data informada pelo usuário
    // (permite lançar ganhos de outros meses sem mudar o mês ativo)
    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    try {
      FinanceData.add({
        month: itemMonth,
        type: 'income',
        desc: desc,
        amount: amount,
        category: category,
        date: dateVal
      });

      document.getElementById('incomeDesc').value = '';
      document.getElementById('incomeAmount').value = '';
      document.getElementById('incomeDate').value = getTodayString();
      document.getElementById('incomeDesc').focus();

      renderAll();
      showToast(`Ganho de ${formatCurrency(amount)} adicionado!`);
    } catch (err) {
      console.error('Erro ao adicionar ganho:', err);
      alert('Ocorreu um erro ao salvar o ganho: ' + err.message);
    }
  });

  // ── 6. Formulário de Novo Gasto ────────────────────────────────
  // Pré-preenche o campo de data com hoje
  const expenseDateInput = document.getElementById('expenseDate');
  if (expenseDateInput) expenseDateInput.value = getTodayString();

  // Exibe/oculta o campo "Mês Final" quando o tipo é dívida/parcelamento
  const expenseTypeSelect     = document.getElementById('expenseType');
  const expenseCatSelect      = document.getElementById('expenseCategory');
  const expenseEndMonthWrapper = document.getElementById('expenseEndMonthWrapper');

  function checkDebtVisibility() {
    if (!expenseEndMonthWrapper) return;
    const isDebt = (expenseTypeSelect && expenseTypeSelect.value === 'debt') || 
                   (expenseCatSelect && (expenseCatSelect.value === 'Empréstimo' || expenseCatSelect.value === 'Parcelamento'));
    expenseEndMonthWrapper.style.display = isDebt ? 'block' : 'none';
  }

  if (expenseTypeSelect) expenseTypeSelect.addEventListener('change', checkDebtVisibility);
  if (expenseCatSelect) expenseCatSelect.addEventListener('change', checkDebtVisibility);

  document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const type = document.getElementById('expenseType').value;
    const category = document.getElementById('expenseCategory').value;
    const dateVal = document.getElementById('expenseDate').value || getTodayString();
    const endMonthVal = document.getElementById('expenseEndMonth') ? document.getElementById('expenseEndMonth').value : null;

    if (!desc) {
      alert('Por favor, informe a descrição do gasto.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido maior que zero.');
      return;
    }

    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    try {
      FinanceData.add({
        month: itemMonth,
        type: type,
        desc: desc,
        amount: amount,
        category: category,
        paid: false,
        date: dateVal,
        endMonth: endMonthVal || null
      });

      document.getElementById('expenseDesc').value = '';
      document.getElementById('expenseAmount').value = '';
      document.getElementById('expenseDate').value = getTodayString();
      if (document.getElementById('expenseEndMonth')) document.getElementById('expenseEndMonth').value = '';
      checkDebtVisibility();
      document.getElementById('expenseDesc').focus();

      // Garante que o filtro exiba o novo gasto imediatamente
      state.expenseFilter = 'all';
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
      });

      renderAll();

      let toastMsg = `Gasto de ${formatCurrency(amount)} cadastrado!`;
      if (type === 'debt' || category === 'Empréstimo' || category === 'Parcelamento') {
        toastMsg = `Parcelamento adicionado! Veja no Centro de Dívidas.`;
      } else if (type === 'fixed') {
        toastMsg = `Gasto fixo de ${formatCurrency(amount)} cadastrado!`;
      }
      showToast(toastMsg);
    } catch (err) {
      console.error('Erro ao adicionar gasto:', err);
      alert('Ocorreu um erro ao salvar o gasto: ' + err.message);
    }
  });

  // ── 7. Filtros de Gastos ──────────────────────────────────────
  // Atualiza state.expenseFilter e re-renderiza ao clicar em cada aba de filtro
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.expenseFilter = btn.getAttribute('data-filter');
      renderAll();
    });
  });

  // ── 8. Modal de Edição ────────────────────────────────────────
  // Salva as alterações do formulário ao submeter o modal
  document.getElementById('editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const desc = document.getElementById('editDesc').value.trim();
    const amountRaw = document.getElementById('editAmount').value;
    const amount = parseFloat(String(amountRaw).replace(',', '.'));
    const category = document.getElementById('editCategory').value.trim();
    const type = document.getElementById('editType').value;
    const date = document.getElementById('editDate').value;
    const active = document.getElementById('editActive') ? document.getElementById('editActive').value === 'true' : true;
    const endMonth = document.getElementById('editEndMonth') ? document.getElementById('editEndMonth').value || null : null;

    if (!id || !desc || isNaN(amount) || amount <= 0) {
      alert('Por favor, informe a descrição e um valor maior que zero.');
      return;
    }

    FinanceData.update(id, {
      desc: desc,
      amount: amount,
      category: category,
      type: type,
      date: date,
      active: active,
      endMonth: endMonth
    });

    closeEditModal();
    renderAll();
    showToast('Informações alteradas com sucesso!');
  });

  const editModalEl = document.getElementById('editModal');
  if (editModalEl) {
    editModalEl.addEventListener('click', (e) => {
      if (e.target === editModalEl) closeEditModal();
    });
  }

  const editTypeSelect = document.getElementById('editType');
  if (editTypeSelect) {
    editTypeSelect.addEventListener('change', () => {
      const val = editTypeSelect.value;
      const isFixed = val === 'fixed' || val === 'debt';
      const statusGroup = document.getElementById('editStatusGroup');
      const endMonthGroup = document.getElementById('editEndMonthGroup');
      if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
      if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';
    });
  }

  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

  // ── 9. Exportação e Reset de Dados ───────────────────────────
  document.getElementById('exportBtn').addEventListener('click', () => {
    FinanceData.exportJSON();
    showToast('Backup JSON exportado com sucesso!');
  });

  // Exige confirmação antes de apagar todos os dados (ação irreversível)
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    showConfirm({
      title:    'Zerar todos os dados?',
      message:  'Todos os seus lançamentos serão apagados permanentemente. Esta ação não pode ser desfeita!',
      iconClass:'fa-solid fa-trash-can',
      okLabel:  'Sim, zerar tudo',
      onConfirm: () => {
        FinanceData.clearAll();
        FinanceData.saveProfile({ name: '', avatar: null });
        closeProfileDrawer();
        renderUserProfile();
        renderAll();
        showToast('Todos os dados foram resetados com sucesso!');
      }
    });
  });

  // ── 10. Drawer do Usuário (painel lateral direito) ────────────
  const profileDrawer        = document.getElementById('profileDrawer');
  const profileDrawerOverlay = document.getElementById('profileDrawerOverlay');
  const userMenuBtn          = document.getElementById('userMenuBtn');
  const closeDrawerBtn       = document.getElementById('closeDrawerBtn');

  /** Desliza o painel de perfil para a direita, tornando-o visível. */
  function openProfileDrawer() {
    if (profileDrawer && profileDrawerOverlay) {
      profileDrawer.classList.add('open');
      profileDrawerOverlay.classList.add('active');
    }
  }

  /** Fecha o painel de perfil deslizando-o para fora da tela. */
  function closeProfileDrawer() {
    if (profileDrawer && profileDrawerOverlay) {
      profileDrawer.classList.remove('open');
      profileDrawerOverlay.classList.remove('active');
    }
  }

  if (userMenuBtn)          userMenuBtn.addEventListener('click', openProfileDrawer);
  if (closeDrawerBtn)       closeDrawerBtn.addEventListener('click', closeProfileDrawer);
  if (profileDrawerOverlay) profileDrawerOverlay.addEventListener('click', closeProfileDrawer);

  // ── 11. Personalização de Perfil (Foto e Nome) ───────────────
  const profileNameInput      = document.getElementById('profileNameInput');
  const saveProfileNameBtn    = document.getElementById('saveProfileNameBtn');
  const changeAvatarBtn       = document.getElementById('changeAvatarBtn');
  const avatarFileInput       = document.getElementById('avatarFileInput');
  // Nota: drawerAvatarDisplay e topbarAvatarContainer são buscados por ID
  // dentro de renderUserProfile() para garantir que existem no DOM
  const drawerAvatarDisplay   = document.getElementById('drawerAvatarDisplay');
  const topbarAvatarContainer = document.getElementById('topbarAvatarContainer');

  function renderUserProfile() {
    const profile = FinanceData.getProfile();
    const defaultAvatar = 'assets/default_avatar.jpg';
    const avatarSrc = profile.avatar || defaultAvatar;

    if (profileNameInput) {
      profileNameInput.value = profile.name || '';
    }

    const drawerAvatarImg = document.getElementById('drawerAvatarImg');
    const topbarAvatarImg = document.getElementById('topbarAvatarImg');

    if (drawerAvatarImg) drawerAvatarImg.src = avatarSrc;
    if (topbarAvatarImg) topbarAvatarImg.src = avatarSrc;

    if (userMenuBtn) {
      userMenuBtn.title = profile.name ? `Menu do Usuário (${profile.name})` : 'Menu do Usuário (Escreva seu nome)';
    }

    // Atualiza status de Conta & Autenticação no Drawer
    const accountGuestCard   = document.getElementById('accountGuestCard');
    const accountLoggedCard  = document.getElementById('accountLoggedCard');
    const loggedUserEmail    = document.getElementById('loggedUserEmail');
    const accountStatusText  = document.getElementById('accountStatusText');

    if (profile.email) {
      if (accountGuestCard)  accountGuestCard.style.display = 'none';
      if (accountLoggedCard) accountLoggedCard.style.display = 'flex';
      if (loggedUserEmail)   loggedUserEmail.textContent = profile.email;
      if (accountStatusText) accountStatusText.textContent = 'Conta Conectada (Nuvem)';
    } else {
      if (accountGuestCard)  accountGuestCard.style.display = 'flex';
      if (accountLoggedCard) accountLoggedCard.style.display = 'none';
      if (accountStatusText) accountStatusText.textContent = 'Modo Local (Não conectado)';
    }
  }

  // ── 11.2 Modal de Autenticação (Login / Cadastro) ─────────────
  const authModal            = document.getElementById('authModal');
  const openAuthModalBtn     = document.getElementById('openAuthModalBtn');
  const closeAuthModalBtn    = document.getElementById('closeAuthModalBtn');
  const continueAsGuestBtn   = document.getElementById('continueAsGuestBtn');
  const tabLoginBtn          = document.getElementById('tabLoginBtn');
  const tabRegisterBtn       = document.getElementById('tabRegisterBtn');
  const authLoginForm        = document.getElementById('authLoginForm');
  const authRegisterForm     = document.getElementById('authRegisterForm');
  const authSubtitleText     = document.getElementById('authSubtitleText');
  const authAlertBanner      = document.getElementById('authAlertBanner');
  const authAlertText        = document.getElementById('authAlertText');
  const logoutBtn            = document.getElementById('logoutBtn');

  function showAuthAlert(msg, isSuccess = false) {
    if (!authAlertBanner || !authAlertText) return;
    authAlertText.textContent = msg;
    authAlertBanner.className = isSuccess ? 'auth-alert-banner success' : 'auth-alert-banner';
    authAlertBanner.style.display = 'flex';
  }

  function hideAuthAlert() {
    if (authAlertBanner) authAlertBanner.style.display = 'none';
  }

  function setAuthTab(tab) {
    hideAuthAlert();
    if (tab === 'login') {
      if (tabLoginBtn) tabLoginBtn.classList.add('active');
      if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
      if (authLoginForm) authLoginForm.style.display = 'flex';
      if (authRegisterForm) authRegisterForm.style.display = 'none';
      if (authSubtitleText) {
        authSubtitleText.textContent = 'Acesse sua conta para sincronizar seus lançamentos com segurança.';
      }
    } else {
      if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
      if (tabLoginBtn) tabLoginBtn.classList.remove('active');
      if (authRegisterForm) authRegisterForm.style.display = 'flex';
      if (authLoginForm) authLoginForm.style.display = 'none';
      if (authSubtitleText) {
        authSubtitleText.textContent = 'Crie sua conta em segundos para salvar seus dados com total privacidade.';
      }
    }
  }

  function openAuth(tab = 'login') {
    setAuthTab(tab);
    if (authModal) authModal.classList.add('active');
  }

  function closeAuth() {
    if (authModal) authModal.classList.remove('active');
    hideAuthAlert();
  }

  if (openAuthModalBtn) {
    openAuthModalBtn.addEventListener('click', () => openAuth('login'));
  }

  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener('click', closeAuth);
  }

  if (continueAsGuestBtn) {
    continueAsGuestBtn.addEventListener('click', () => {
      closeAuth();
      showToast('Continuando no Modo Local.');
    });
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuth();
    });
  }

  if (tabLoginBtn) {
    tabLoginBtn.addEventListener('click', () => setAuthTab('login'));
  }

  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener('click', () => setAuthTab('register'));
  }

  // Toggle de visualização de senha
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      }
    });
  }

  setupPasswordToggle('toggleLoginPasswordBtn', 'loginPassword');
  setupPasswordToggle('toggleRegisterPasswordBtn', 'registerPassword');

  // ── Sincronização de Dados com a Nuvem (Supabase) ───────────
  async function syncUserDataFromCloud(userId) {
    if (!window.SupabaseAuth || !userId) return;
    try {
      const cloudEntries = await window.SupabaseAuth.fetchCloudEntries(userId);
      const cloudTemplates = await window.SupabaseAuth.fetchCloudTemplates(userId);

      if (cloudEntries !== null && cloudTemplates !== null) {
        if (cloudEntries.length > 0 || cloudTemplates.length > 0) {
          // Usuário JÁ possui dados salvos na nuvem → substitui localStorage pelo dado da nuvem.
          // IMPORTANTE: usamos localStorage diretamente para não re-disparar saveCloudEntry.
          try {
            localStorage.setItem('gastopro_entries_v4_oct', JSON.stringify(cloudEntries));
            localStorage.setItem('gastopro_templates_v4_oct', JSON.stringify(cloudTemplates));
          } catch (storageErr) {
            console.warn('[GastoPro] Falha ao gravar no localStorage:', storageErr);
          }
        } else {
          // NOVO usuário sem dados na nuvem.
          // NÃO enviamos dados locais: eles podem pertencer a outro usuário que usou
          // o mesmo navegador antes. Limpamos o localStorage para começar do zero.
          try {
            localStorage.removeItem('gastopro_entries_v4_oct');
            localStorage.removeItem('gastopro_templates_v4_oct');
          } catch (storageErr) {
            console.warn('[GastoPro] Falha ao limpar localStorage:', storageErr);
          }
        }
        renderAll();
      }
    } catch (e) {
      console.warn('[GastoPro] Aviso de sincronização na nuvem:', e);
    }
  }



  // Submissão do Formulário de Login (Supabase Real com fallback)
  if (authLoginForm) {
    authLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;
      const submitBtn = document.getElementById('submitLoginBtn');

      if (!email || !password) {
        showAuthAlert('Por favor, preencha todos os campos.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
      }

      try {
        if (window.SupabaseAuth && window.SupabaseAuth.client) {
          const { user } = await window.SupabaseAuth.signIn(email, password);
          const profile = FinanceData.getProfile();
          profile.userId = user.id;
          profile.email  = user.email;
          profile.name   = (user.user_metadata && user.user_metadata.name) || profile.name || email.split('@')[0];
          FinanceData.saveProfile(profile);
          renderUserProfile();
          closeAuth();
          showToast(`Bem-vindo de volta, ${profile.name}!`);
          await syncUserDataFromCloud(user.id);
        } else {
          // Fallback offline / local
          const profile = FinanceData.getProfile();
          profile.email = email;
          profile.name = profile.name || email.split('@')[0];
          FinanceData.saveProfile(profile);
          renderUserProfile();
          closeAuth();
          showToast(`Bem-vindo, ${profile.name}!`);
        }
      } catch (err) {
        console.error('[GastoPro Auth] Erro no login:', err);
        let msg = 'Erro ao realizar login. Verifique suas credenciais.';
        if (err.message && err.message.includes('Invalid login credentials')) {
          msg = 'E-mail ou senha incorretos.';
        } else if (err.message && err.message.includes('Email not confirmed')) {
          msg = 'Confirmação pendente: verifique seu e-mail ou desative a confirmação no Supabase.';
        }
        showAuthAlert(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Entrar no GastoPro</span><i class="fa-solid fa-arrow-right"></i>';
        }
      }
    });
  }

  // Submissão do Formulário de Cadastro (Supabase Real com fallback)
  if (authRegisterForm) {
    authRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName')?.value.trim();
      const email = document.getElementById('registerEmail')?.value.trim();
      const password = document.getElementById('registerPassword')?.value;
      const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
      const submitBtn = document.getElementById('submitRegisterBtn');

      if (!name || !email || !password || !confirmPassword) {
        showAuthAlert('Por favor, preencha todos os campos.');
        return;
      }

      if (password !== confirmPassword) {
        showAuthAlert('As senhas não coincidem!');
        return;
      }

      if (password.length < 6) {
        showAuthAlert('A senha deve ter no mínimo 6 caracteres.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';
      }

      try {
        if (window.SupabaseAuth && window.SupabaseAuth.client) {
          const data = await window.SupabaseAuth.signUp(name, email, password);
          const profile = FinanceData.getProfile();
          profile.name = name;
          profile.email = email;
          if (data && data.user) {
            profile.userId = data.user.id;
          }
          FinanceData.saveProfile(profile);
          renderUserProfile();

          // Se a sessão já foi iniciada imediatamente
          if (data && data.session) {
            closeAuth();
            showToast(`Conta criada com sucesso! Bem-vindo, ${name}!`);
            if (data.user) {
              await syncUserDataFromCloud(data.user.id);
            }
          } else {
            showAuthAlert('Conta criada! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.', true);
          }
        } else {
          // Fallback offline / local
          const profile = FinanceData.getProfile();
          profile.name = name;
          profile.email = email;
          FinanceData.saveProfile(profile);
          renderUserProfile();
          closeAuth();
          showToast(`Conta criada com sucesso! Bem-vindo, ${name}!`);
        }
      } catch (err) {
        console.error('[GastoPro Auth] Erro no cadastro:', err);
        let msg = err.message || 'Erro ao criar conta. Tente novamente.';
        if (msg.includes('User already registered')) {
          msg = 'Este e-mail já está cadastrado. Faça login na aba "Entrar".';
        }
        showAuthAlert(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Criar Minha Conta Gratuita</span><i class="fa-solid fa-user-plus"></i>';
        }
      }
    });
  }

  // Botão de Logout Real (Supabase)
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (window.SupabaseAuth) {
          await window.SupabaseAuth.signOut();
        }
      } catch (e) {
        console.warn(e);
      }
      // Limpa TODOS os dados locais ao sair para garantir isolamento total entre usuários.
      // O próximo login (deste ou de outro usuário) buscará os dados corretos da nuvem.
      // LGPD: nome e avatar do usuário anterior não devem vazar para o próximo usuário.
      try {
        localStorage.removeItem('gastopro_entries_v4_oct');
        localStorage.removeItem('gastopro_templates_v4_oct');
        localStorage.removeItem('gastopro_profile_real_v2'); // Limpa nome, avatar e e-mail
      } catch (e) {
        console.warn('[GastoPro] Falha ao limpar localStorage no logout:', e);
      }
      renderUserProfile();
      renderAll();
      showToast('Você saiu da sua conta com segurança.');
    });
  }

  // Checagem de Sessão Ativa ao iniciar o App
  if (window.SupabaseAuth) {
    window.SupabaseAuth.getSessionUser().then((user) => {
      if (user) {
        const profile = FinanceData.getProfile();
        profile.userId = user.id;
        profile.email = user.email;
        if (!profile.name && user.user_metadata && user.user_metadata.name) {
          profile.name = user.user_metadata.name;
        }
        FinanceData.saveProfile(profile);
        renderUserProfile();
        syncUserDataFromCloud(user.id);
      }
    });
  }

  // Link Esqueceu a Senha — envia e-mail real de recuperação via Supabase
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('loginEmail');
      const email = emailInput ? emailInput.value.trim() : '';

      if (!email) {
        showAuthAlert('Digite seu e-mail no campo acima e clique em "Esqueceu a senha?" novamente.');
        return;
      }

      forgotPasswordLink.textContent = 'Enviando...';
      forgotPasswordLink.style.pointerEvents = 'none';

      try {
        if (window.SupabaseAuth && window.SupabaseAuth.resetPasswordForEmail) {
          await window.SupabaseAuth.resetPasswordForEmail(email);
          showAuthAlert(`Link de recuperação enviado para ${email}. Verifique sua caixa de entrada.`, true);
        } else {
          showAuthAlert('Serviço de recuperação não disponível. Tente novamente mais tarde.');
        }
      } catch (err) {
        console.error('[GastoPro] Erro ao enviar reset de senha:', err);
        showAuthAlert('Não foi possível enviar o e-mail. Verifique o endereço informado.');
      } finally {
        forgotPasswordLink.textContent = 'Esqueceu a senha?';
        forgotPasswordLink.style.pointerEvents = '';
      }
    });
  }

  // Upload de Foto
  if (changeAvatarBtn && avatarFileInput) {
    changeAvatarBtn.addEventListener('click', () => {
      avatarFileInput.click();
    });

    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
        return;
      }

      // Limite de 2 MB: o FileReader gera Base64 ~33% maior (até ~2.7 MB),
      // garantindo margem segura dentro do limite de ~5 MB do localStorage.
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem é muito grande! Escolha uma foto de até 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const profile = FinanceData.getProfile();
        profile.avatar = event.target.result;
        FinanceData.saveProfile(profile);
        renderUserProfile();
        showToast('Foto de perfil atualizada com sucesso!');
      };
      reader.readAsDataURL(file);
    });
  }

  // Salvar Nome do Usuário
  function handleSaveProfileName() {
    if (!profileNameInput) return;
    const newName = profileNameInput.value.trim();
    if (!newName) {
      alert('Por favor, digite um nome válido.');
      return;
    }

    const profile = FinanceData.getProfile();
    profile.name = newName;
    FinanceData.saveProfile(profile);
    renderUserProfile();
    showToast(`Nome alterado para "${newName}"!`);
  }

  if (saveProfileNameBtn) {
    saveProfileNameBtn.addEventListener('click', handleSaveProfileName);
  }

  if (profileNameInput) {
    profileNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveProfileName();
      }
    });
  }

  // ── 12. Botão de Atualizar / Refresh (Desktop & PWA Mobile) ──
  const refreshAppBtn      = document.getElementById('refreshAppBtn');
  const sidebarRefreshBtn  = document.getElementById('sidebarRefreshBtn');
  const drawerRefreshBtn   = document.getElementById('drawerRefreshBtn');
  const refreshIcon        = document.getElementById('refreshIcon');
  const sidebarRefreshIcon = document.getElementById('sidebarRefreshIcon');
  const drawerRefreshIcon  = document.getElementById('drawerRefreshIcon');

  let isRefreshing = false;

  async function handleAppRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    // Ativa animação de rotação contínua nos ícones
    const icons = [refreshIcon, sidebarRefreshIcon, drawerRefreshIcon].filter(Boolean);
    icons.forEach(icon => icon.classList.add('spinning'));

    const btns = [refreshAppBtn, sidebarRefreshBtn, drawerRefreshBtn].filter(Boolean);
    btns.forEach(btn => btn.classList.add('refreshing'));

    const startTime = Date.now();

    try {
      let isCloud = false;
      if (window.SupabaseAuth) {
        const user = await window.SupabaseAuth.getSessionUser();
        if (user && user.id) {
          isCloud = true;
          await syncUserDataFromCloud(user.id);
        }
      }

      // Re-renderiza views e perfil
      renderUserProfile();
      renderAll();

      // Feedback visual nítido (mínimo 500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(res => setTimeout(res, 500 - elapsed));
      }

      showToast(isCloud ? 'Dados sincronizados com a nuvem!' : 'Dados atualizados com sucesso!');

      // Se a sidebar ou o drawer estiverem abertos, fecha-os
      closeMobileSidebar();
      closeProfileDrawer();
    } catch (err) {
      console.warn('[GastoPro] Erro durante o refresh:', err);
      renderAll();
      showToast('Dados locais atualizados.');
    } finally {
      icons.forEach(icon => icon.classList.remove('spinning'));
      btns.forEach(btn => btn.classList.remove('refreshing'));
      isRefreshing = false;
    }
  }

  if (refreshAppBtn)     refreshAppBtn.addEventListener('click', handleAppRefresh);
  if (sidebarRefreshBtn) sidebarRefreshBtn.addEventListener('click', handleAppRefresh);
  if (drawerRefreshBtn)  drawerRefreshBtn.addEventListener('click', handleAppRefresh);

  // ── 13. MÓDULO DE IMPORTAÇÃO DE EXTRATOS ─────────────────────────
  // Controlador do modal de importação CSV / Texto Bruto.
  // Depende de GastoProImporter (js/importer.js) para o parsing.
  // ─────────────────────────────────────────────────────────────────

  /** Todas as categorias disponíveis para o select da tabela de preview. */
  const IMPORT_CATEGORIES = [
    'Alimentação', 'Mercado', 'Transporte', 'Saúde', 'Esporte', 'Educação',
    'Assinaturas', 'Moradia', 'Cartão de crédito', 'Compras', 'Receita',
    'Lazer', 'Esporte', 'Outros'
  ];

  // Referências dos elementos do modal
  const importModal         = document.getElementById('importModal');
  const closeImportModalBtn = document.getElementById('closeImportModalBtn');
  const cancelImportBtn     = document.getElementById('cancelImportBtn');
  const sidebarImportBtn    = document.getElementById('sidebarImportBtn');
  const importTabCsvBtn     = document.getElementById('importTabCsvBtn');
  const importTabTextBtn    = document.getElementById('importTabTextBtn');
  const importCsvPanel      = document.getElementById('importCsvPanel');
  const importTextPanel     = document.getElementById('importTextPanel');
  const csvFileInput        = document.getElementById('csvFileInput');
  const csvDropZone         = document.getElementById('csvDropZone');
  const parseCsvBtn         = document.getElementById('parseCsvBtn');
  const parseTextBtn        = document.getElementById('parseTextBtn');
  const importRawTextarea   = document.getElementById('importRawTextarea');
  const importPreviewSection= document.getElementById('importPreviewSection');
  const importPreviewTbody  = document.getElementById('importPreviewTableBody');
  const previewCountBadge   = document.getElementById('previewCountBadge');
  const importSelectAll     = document.getElementById('importSelectAll');
  const confirmImportBtn    = document.getElementById('confirmImportBtn');

  /** Abre o modal de importação e reseta o estado. */
  function openImportModal() {
    if (!importModal) return;
    importModal.classList.add('active');
    resetImportModal();
    closeMobileSidebar();
  }

  /** Fecha o modal de importação. */
  function closeImportModal() {
    if (!importModal) return;
    importModal.classList.remove('active');
  }

  /** Reseta o modal ao estado inicial (sem preview, aba CSV ativa). */
  function resetImportModal() {
    // Reseta painel para CSV
    switchImportTab('csv');
    // Limpa upload
    if (csvFileInput) csvFileInput.value = '';
    if (csvDropZone) {
      csvDropZone.classList.remove('csv-file-selected');
      document.getElementById('csvDropIcon').className = 'fa-solid fa-cloud-arrow-up drop-icon';
      document.getElementById('csvDropTitle').textContent = 'Arraste o arquivo CSV aqui';
      document.getElementById('csvDropSub').textContent   = 'ou clique para selecionar o arquivo (.csv, .txt)';
    }
    // Limpa textarea
    if (importRawTextarea) importRawTextarea.value = '';
    // Esconde preview
    if (importPreviewSection) importPreviewSection.classList.remove('visible');
    if (importPreviewTbody)   importPreviewTbody.innerHTML = '';
    if (previewCountBadge)    previewCountBadge.textContent = '0 itens';
    if (importSelectAll)      importSelectAll.checked = true;
  }

  /** Alterna entre as abas CSV e Texto do modal. */
  function switchImportTab(tab) {
    const isCsv = tab === 'csv';
    if (importTabCsvBtn)  importTabCsvBtn.classList.toggle('active', isCsv);
    if (importTabTextBtn) importTabTextBtn.classList.toggle('active', !isCsv);
    if (importCsvPanel)   importCsvPanel.classList.toggle('active', isCsv);
    if (importTextPanel)  importTextPanel.classList.toggle('active', !isCsv);
    // Esconde preview ao trocar de aba
    if (importPreviewSection) importPreviewSection.classList.remove('visible');
  }

  /**
   * Renderiza a tabela de preview com as linhas parseadas.
   * @param {Array} rows - Resultado de parseCSV() ou parseRawText().
   */
  function renderImportPreview(rows) {
    if (!importPreviewTbody) return;
    importPreviewTbody.innerHTML = '';

    if (!rows || rows.length === 0) {
      importPreviewTbody.innerHTML = `
        <tr><td colspan="6">
          <div class="import-empty-alert">
            <i class="fa-solid fa-triangle-exclamation"></i>
            Nenhum lançamento foi encontrado. Verifique o formato do arquivo ou texto.
          </div>
        </td></tr>`;
      if (previewCountBadge) previewCountBadge.textContent = '0 itens';
      if (importPreviewSection) importPreviewSection.classList.add('visible');
      return;
    }

    // Categorias únicas e ordenadas para o select
    const allCats = [...new Set([...IMPORT_CATEGORIES])].sort();

    rows.forEach((row, i) => {
      const isIncome = row.category === 'Receita';
      const dateDisplay = row.date
        ? row.date.split('-').reverse().join('/')
        : '--/--/----';

      // Gera opções do select de categoria
      const catOptions = allCats.map(c =>
        `<option value="${escapeHtml(c)}" ${c === row.category ? 'selected' : ''}>${escapeHtml(c)}</option>`
      ).join('');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-check">
          <input type="checkbox" class="import-row-check" data-row="${i}" checked />
        </td>
        <td class="col-date">${escapeHtml(dateDisplay)}</td>
        <td class="col-desc" title="${escapeHtml(row.desc)}">${escapeHtml(row.desc)}</td>
        <td class="col-category">
          <select class="import-cat-select" data-row="${i}">
            ${catOptions}
          </select>
        </td>
        <td class="col-type">
          <select class="import-type-select" data-row="${i}">
            <option value="variable" ${!isIncome ? 'selected' : ''}>Gasto</option>
            <option value="income"   ${isIncome  ? 'selected' : ''}>Receita</option>
          </select>
        </td>
        <td class="col-amount ${isIncome ? 'income' : ''}">
          R$ ${row.amount.toFixed(2).replace('.', ',')}
        </td>
      `;

      // Listener dinâmico: ao mudar tipo, atualiza cor do valor
      tr.querySelector('.import-type-select').addEventListener('change', (e) => {
        const isInc = e.target.value === 'income';
        tr.querySelector('.col-amount').classList.toggle('income', isInc);
      });

      importPreviewTbody.appendChild(tr);
    });

    if (previewCountBadge) previewCountBadge.textContent = `${rows.length} ${rows.length === 1 ? 'item' : 'itens'}`;
    if (importPreviewSection) importPreviewSection.classList.add('visible');
    if (importSelectAll)      importSelectAll.checked = true;
  }

  // Armazena as linhas parseadas para uso posterior na confirmação
  let _importParsedRows = [];

  /** Lê o arquivo CSV selecionado e faz o parse. */
  function handleCsvParse() {
    if (!csvFileInput || !csvFileInput.files || !csvFileInput.files[0]) {
      showToast('Selecione um arquivo CSV antes de analisar.');
      return;
    }
    const file = csvFileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        _importParsedRows = GastoProImporter.parseCSV(e.target.result);
        renderImportPreview(_importParsedRows);
        if (_importParsedRows.length > 0) {
          showToast(`${_importParsedRows.length} lançamentos encontrados no CSV!`);
        }
      } catch (err) {
        console.error('[GastoPro Importer] Erro ao parsear CSV:', err);
        showToast('Erro ao ler o CSV. Verifique o formato do arquivo.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  /** Lê o texto bruto da textarea e faz o parse. */
  function handleTextParse() {
    const text = importRawTextarea ? importRawTextarea.value : '';
    if (!text.trim()) {
      showToast('Cole o texto do extrato antes de analisar.');
      return;
    }
    try {
      _importParsedRows = GastoProImporter.parseRawText(text);
      renderImportPreview(_importParsedRows);
      if (_importParsedRows.length > 0) {
        showToast(`${_importParsedRows.length} lançamentos encontrados!`);
      }
    } catch (err) {
      console.error('[GastoPro Importer] Erro ao parsear texto:', err);
      showToast('Erro ao interpretar o texto. Verifique o formato.');
    }
  }

  /**
   * Confirma a importação: salva os lançamentos selecionados via FinanceData.add().
   * Lê os valores atuais de categoria e tipo diretamente da tabela de preview
   * para respeitar as edições feitas pelo usuário antes de confirmar.
   */
  function handleConfirmImport() {
    if (!importPreviewTbody || _importParsedRows.length === 0) return;

    const checkboxes = importPreviewTbody.querySelectorAll('.import-row-check');
    const catSelects  = importPreviewTbody.querySelectorAll('.import-cat-select');
    const typeSelects = importPreviewTbody.querySelectorAll('.import-type-select');

    let saved = 0;
    checkboxes.forEach((cb, i) => {
      if (!cb.checked) return; // Pula desmarcados

      const row      = _importParsedRows[i];
      const category = catSelects[i]  ? catSelects[i].value  : row.category;
      const type     = typeSelects[i] ? typeSelects[i].value : 'variable';

      const entry = GastoProImporter.buildEntry(
        { ...row, category },
        type
      );

      FinanceData.add(entry);
      saved++;
    });

    if (saved > 0) {
      showToast(`${saved} lançamento${saved > 1 ? 's' : ''} importado${saved > 1 ? 's' : ''} com sucesso!`);
      renderAll();
      closeImportModal();
    } else {
      showToast('Selecione ao menos um lançamento para importar.');
    }
  }

  // ── Event Listeners do modal de importação ────────────────────

  // Abrir modal
  if (sidebarImportBtn) sidebarImportBtn.addEventListener('click', openImportModal);

  // Fechar modal
  if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);
  if (cancelImportBtn)     cancelImportBtn.addEventListener('click', closeImportModal);

  // Fechar ao clicar no overlay
  if (importModal) {
    importModal.addEventListener('click', (e) => {
      if (e.target === importModal) closeImportModal();
    });
  }

  // Troca de abas
  if (importTabCsvBtn)  importTabCsvBtn.addEventListener('click',  () => switchImportTab('csv'));
  if (importTabTextBtn) importTabTextBtn.addEventListener('click', () => switchImportTab('text'));

  // Feedback visual de arquivo selecionado no drop zone
  if (csvFileInput) {
    csvFileInput.addEventListener('change', () => {
      const file = csvFileInput.files && csvFileInput.files[0];
      if (file && csvDropZone) {
        csvDropZone.classList.add('csv-file-selected');
        document.getElementById('csvDropIcon').className = 'fa-solid fa-file-circle-check drop-icon';
        document.getElementById('csvDropTitle').textContent = file.name;
        document.getElementById('csvDropSub').textContent   = `${(file.size / 1024).toFixed(1)} KB — pronto para analisar`;
      }
    });
  }

  // Drag and drop no drop zone
  if (csvDropZone) {
    csvDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      csvDropZone.classList.add('drag-over');
    });
    csvDropZone.addEventListener('dragleave', () => {
      csvDropZone.classList.remove('drag-over');
    });
    csvDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      csvDropZone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file && csvFileInput) {
        // Transfere o arquivo para o input via DataTransfer
        const dt = new DataTransfer();
        dt.items.add(file);
        csvFileInput.files = dt.files;
        csvFileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Botões de parse
  if (parseCsvBtn)   parseCsvBtn.addEventListener('click',   handleCsvParse);
  if (parseTextBtn)  parseTextBtn.addEventListener('click',  handleTextParse);

  // Selecionar/deselecionar todos
  if (importSelectAll) {
    importSelectAll.addEventListener('change', () => {
      const checkboxes = importPreviewTbody
        ? importPreviewTbody.querySelectorAll('.import-row-check')
        : [];
      checkboxes.forEach(cb => { cb.checked = importSelectAll.checked; });
    });
  }


  // Confirmar importação
  if (confirmImportBtn) confirmImportBtn.addEventListener('click', handleConfirmImport);


  // ── 14. MÓDULO WIZARD DE LANÇAMENTO RÁPIDO ───────────────────
  // Fluxo guiado em 4 passos: Renda → Fixos → Variáveis → Resultado
  // Salva todos os lançamentos em lote ao finalizar.
  // ─────────────────────────────────────────────────────────────

  /**
   * Estado interno do Wizard.
   * Acumulado durante a navegação e persistido apenas ao finalizar.
   */
  let wizardState = {
    step: 1,              // Passo atual (1–4)
    incomes: [],          // { desc, amount, date }
    fixedChecked: [],     // IDs dos templates fixos marcados para baixa
    fixedNew: [],         // { desc, amount } → novos gastos fixos digitados
    varItems: {},         // { category: amount } → categorias com valor
    varCustom: [],        // { desc, amount } → gastos variáveis avulsos
  };

  /** Categorias do Passo 3 — variáveis por categoria */
  const WIZARD_VAR_CATEGORIES = [
    { name: 'Alimentação',  icon: '🍔' },
    { name: 'Mercado',      icon: '🛒' },
    { name: 'Transporte',   icon: '🚗' },
    { name: 'Saúde',        icon: '💊' },
    { name: 'Lazer',        icon: '🎬' },
    { name: 'Compras',      icon: '🛍️' },
    { name: 'Assinaturas',  icon: '📺' },
    { name: 'Esporte',      icon: '🏋️' },
    { name: 'Educação',     icon: '📚' },
    { name: 'Outros',       icon: '💸' },
  ];

  // Referências dos elementos do Wizard
  const wizardModal        = document.getElementById('wizardModal');
  const sidebarWizardBtn   = document.getElementById('sidebarWizardBtn');
  const closeWizardBtn     = document.getElementById('closeWizardBtn');
  const wizardNextBtn      = document.getElementById('wizardNextBtn');
  const wizardBackBtn      = document.getElementById('wizardBackBtn');

  // Passo 1 — Renda
  const wizardIncomeList   = document.getElementById('wizardIncomeList');
  const wIncomeDesc        = document.getElementById('wIncomeDesc');
  const wIncomeAmount      = document.getElementById('wIncomeAmount');
  const wIncomeDate        = document.getElementById('wIncomeDate');
  const wAddIncomeBtn      = document.getElementById('wAddIncomeBtn');

  // Passo 2 — Fixos
  const wizardFixedChecklist = document.getElementById('wizardFixedChecklist');
  const wizardFixedList      = document.getElementById('wizardFixedList');
  const wFixedDesc           = document.getElementById('wFixedDesc');
  const wFixedAmount         = document.getElementById('wFixedAmount');
  const wAddFixedBtn         = document.getElementById('wAddFixedBtn');

  // Passo 3 — Variáveis
  const wizardCategoryGrid = document.getElementById('wizardCategoryGrid');
  const wizardVarList      = document.getElementById('wizardVarList');
  const wVarDesc           = document.getElementById('wVarDesc');
  const wVarAmount         = document.getElementById('wVarAmount');
  const wAddVarBtn         = document.getElementById('wAddVarBtn');

  // Passo 4 — Resultado
  const wResIncome         = document.getElementById('wResIncome');
  const wResExpense        = document.getElementById('wResExpense');
  const wResBalance        = document.getElementById('wResBalance');
  const wRulePctFixed      = document.getElementById('wRulePctFixed');
  const wRulePctVar        = document.getElementById('wRulePctVar');
  const wRulePctSave       = document.getElementById('wRulePctSave');
  const wRuleBarFixed      = document.getElementById('wRuleBarFixed');
  const wRuleBarVar        = document.getElementById('wRuleBarVar');
  const wRuleBarSave       = document.getElementById('wRuleBarSave');
  const wizardResultEmoji  = document.getElementById('wizardResultEmoji');
  const wizardResultTitle  = document.getElementById('wizardResultTitle');
  const wizardResultSubtitle = document.getElementById('wizardResultSubtitle');
  const wizardDiagnosisBanner = document.getElementById('wizardDiagnosisBanner');
  const wizardDiagnosisIcon   = document.getElementById('wizardDiagnosisIcon');
  const wizardDiagnosisText   = document.getElementById('wizardDiagnosisText');

  // Stepper elementos
  const wStep1 = document.getElementById('wStep1');
  const wStep2 = document.getElementById('wStep2');
  const wStep3 = document.getElementById('wStep3');
  const wStep4 = document.getElementById('wStep4');
  const wLine1 = document.getElementById('wLine1');
  const wLine2 = document.getElementById('wLine2');
  const wLine3 = document.getElementById('wLine3');
  const wDot1  = document.getElementById('wDot1');
  const wDot2  = document.getElementById('wDot2');
  const wDot3  = document.getElementById('wDot3');
  const wDot4  = document.getElementById('wDot4');

  /** Abre o wizard e reseta para o passo 1. */
  function openWizard() {
    if (!wizardModal) return;
    resetWizardState();
    wizardModal.classList.add('active');
    goToWizardStep(1, 'forward');
    closeMobileSidebar();
  }

  /** Fecha o wizard. */
  function closeWizard() {
    if (!wizardModal) return;
    wizardModal.classList.remove('active');
  }

  /** Reseta o estado interno do wizard. */
  function resetWizardState() {
    wizardState = {
      step: 1,
      incomes: [],
      fixedChecked: [],
      fixedNew: [],
      varItems: {},
      varCustom: [],
    };
  }

  /**
   * Navega para um passo específico do wizard.
   * @param {number} step - Número do passo (1–4).
   * @param {'forward'|'back'} direction - Direção de animação.
   */
  function goToWizardStep(step, direction = 'forward') {
    wizardState.step = step;

    // Atualiza stepper visual
    const steps = [wStep1, wStep2, wStep3, wStep4];
    const lines  = [wLine1, wLine2, wLine3];
    const dots   = [wDot1, wDot2, wDot3, wDot4];

    steps.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active');
    });

    lines.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('done', 'active-line');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active-line');
    });

    dots.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active');
    });

    // Mostra/esconde painéis
    ['wPanel1', 'wPanel2', 'wPanel3', 'wPanel4'].forEach((id, i) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.classList.remove('active', 'animate-back');
      if (i + 1 === step) {
        panel.classList.add('active');
        if (direction === 'back') panel.classList.add('animate-back');
      }
    });

    // Botão Voltar
    if (wizardBackBtn) wizardBackBtn.style.display = step > 1 ? 'flex' : 'none';

    // Botão Avançar / Finalizar
    if (wizardNextBtn) {
      if (step === 4) {
        wizardNextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar tudo';
        wizardNextBtn.classList.add('finish');
      } else {
        wizardNextBtn.innerHTML = 'Avançar <i class="fa-solid fa-arrow-right"></i>';
        wizardNextBtn.classList.remove('finish');
      }
    }

    // Renderiza conteúdo do passo
    if (step === 1) renderWizardStep1();
    if (step === 2) renderWizardStep2();
    if (step === 3) renderWizardStep3();
    if (step === 4) renderWizardStep4();
  }

  // ── Passo 1: Renda ──────────────────────────────────────────

  /** Renderiza a lista de rendas adicionadas. */
  function renderWizardStep1() {
    if (!wizardIncomeList) return;
    wizardIncomeList.innerHTML = '';

    if (wizardState.incomes.length === 0) {
      wizardIncomeList.innerHTML = '<p class="wizard-empty-state"><i class="fa-solid fa-circle-info" style="margin-right:0.4rem"></i>Nenhuma renda adicionada ainda.</p>';
    } else {
      wizardState.incomes.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'wizard-item-card';
        card.innerHTML = `
          <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
          <span class="wizard-item-date">${item.date ? item.date.split('-').reverse().join('/') : ''}</span>
          <span class="wizard-item-amount">${formatCurrency(item.amount)}</span>
          <button class="btn-wizard-remove" data-idx="${idx}" title="Remover">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
          wizardState.incomes.splice(idx, 1);
          renderWizardStep1();
        });
        wizardIncomeList.appendChild(card);
      });
    }

    // Inicializa data com o dia atual
    if (wIncomeDate && !wIncomeDate.value) {
      const ym = getYearMonthString(state.currentYear, state.currentMonth);
      wIncomeDate.value = `${ym}-01`;
    }
  }

  /** Adiciona uma renda ao estado do wizard. */
  function handleWizardAddIncome() {
    const desc   = (wIncomeDesc   ? wIncomeDesc.value.trim()          : '');
    const amount = (wIncomeAmount ? parseFloat(wIncomeAmount.value)   : 0);
    const date   = (wIncomeDate   ? wIncomeDate.value                 : '');

    if (!desc) { showToast('Informe a descrição da renda.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.incomes.push({ desc, amount, date: date || null });
    if (wIncomeDesc)   wIncomeDesc.value   = '';
    if (wIncomeAmount) wIncomeAmount.value = '';
    if (wIncomeDate)   wIncomeDate.value   = '';
    renderWizardStep1();
    if (wIncomeDesc) wIncomeDesc.focus();
  }

  // ── Passo 2: Fixos ──────────────────────────────────────────

  /** Renderiza checklist de gastos fixos existentes + lista de novos. */
  function renderWizardStep2() {
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    const allTemplates = FinanceData.getTemplates().filter(t =>
      t.type === 'fixed' && t.active !== false
    );

    // Checklist dos fixos existentes
    if (wizardFixedChecklist) {
      wizardFixedChecklist.innerHTML = '';
      if (allTemplates.length === 0) {
        wizardFixedChecklist.innerHTML = '<p class="wizard-empty-state">Nenhum gasto fixo cadastrado ainda.</p>';
      } else {
        allTemplates.forEach(t => {
          const isChecked = wizardState.fixedChecked.includes(t.id);
          const item = document.createElement('label');
          item.className = 'wizard-check-item';
          item.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} data-id="${t.id}" />
            <span class="wizard-check-item-desc">${escapeHtml(t.desc)}</span>
            <span class="wizard-check-item-amount">${formatCurrency(t.amount)}</span>
          `;
          const cb = item.querySelector('input');
          cb.addEventListener('change', () => {
            if (cb.checked) {
              if (!wizardState.fixedChecked.includes(t.id)) wizardState.fixedChecked.push(t.id);
            } else {
              wizardState.fixedChecked = wizardState.fixedChecked.filter(id => id !== t.id);
            }
          });
          wizardFixedChecklist.appendChild(item);
        });
      }
    }

    // Lista de novos fixos adicionados nesta sessão
    renderWizardFixedNewList();
  }

  /** Renderiza lista de novos gastos fixos adicionados no wizard. */
  function renderWizardFixedNewList() {
    if (!wizardFixedList) return;
    wizardFixedList.innerHTML = '';
    wizardState.fixedNew.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'wizard-item-card';
      card.innerHTML = `
        <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
        <span class="wizard-item-amount expense">${formatCurrency(item.amount)}</span>
        <button class="btn-wizard-remove" data-idx="${idx}" title="Remover">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
        wizardState.fixedNew.splice(idx, 1);
        renderWizardFixedNewList();
      });
      wizardFixedList.appendChild(card);
    });
  }

  /** Adiciona um novo gasto fixo ao wizard. */
  function handleWizardAddFixed() {
    const desc   = (wFixedDesc   ? wFixedDesc.value.trim()          : '');
    const amount = (wFixedAmount ? parseFloat(wFixedAmount.value)   : 0);

    if (!desc)   { showToast('Informe a descrição do gasto fixo.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.fixedNew.push({ desc, amount });
    if (wFixedDesc)   wFixedDesc.value   = '';
    if (wFixedAmount) wFixedAmount.value = '';
    renderWizardFixedNewList();
    if (wFixedDesc) wFixedDesc.focus();
  }

  // ── Passo 3: Variáveis ──────────────────────────────────────

  /** Renderiza o grid de categorias variáveis. */
  function renderWizardStep3() {
    if (!wizardCategoryGrid) return;
    wizardCategoryGrid.innerHTML = '';

    WIZARD_VAR_CATEGORIES.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'wizard-cat-card';
      card.innerHTML = `
        <div class="wizard-cat-top">
          <span class="wizard-cat-icon">${cat.icon}</span>
          <span class="wizard-cat-name">${escapeHtml(cat.name)}</span>
        </div>
        <input
          type="number"
          class="wizard-cat-input"
          placeholder="R$ 0,00"
          min="0"
          step="0.01"
          value="${wizardState.varItems[cat.name] > 0 ? wizardState.varItems[cat.name] : ''}"
          data-cat="${cat.name}"
        />
      `;
      const input = card.querySelector('.wizard-cat-input');
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        wizardState.varItems[cat.name] = (isNaN(val) || val <= 0) ? 0 : val;
      });
      wizardCategoryGrid.appendChild(card);
    });

    // Lista de gastos avulsos
    renderWizardVarList();
  }

  /** Renderiza a lista de gastos variáveis avulsos. */
  function renderWizardVarList() {
    if (!wizardVarList) return;
    wizardVarList.innerHTML = '';
    wizardState.varCustom.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'wizard-item-card';
      card.innerHTML = `
        <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
        <span class="wizard-item-amount expense">${formatCurrency(item.amount)}</span>
        <button class="btn-wizard-remove" data-idx="${idx}" title="Remover">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
        wizardState.varCustom.splice(idx, 1);
        renderWizardVarList();
      });
      wizardVarList.appendChild(card);
    });
  }

  /** Adiciona um gasto variável avulso. */
  function handleWizardAddVar() {
    const desc   = (wVarDesc   ? wVarDesc.value.trim()          : '');
    const amount = (wVarAmount ? parseFloat(wVarAmount.value)   : 0);

    if (!desc)   { showToast('Informe a descrição do gasto.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.varCustom.push({ desc, amount });
    if (wVarDesc)   wVarDesc.value   = '';
    if (wVarAmount) wVarAmount.value = '';
    renderWizardVarList();
    if (wVarDesc) wVarDesc.focus();
  }

  // ── Passo 4: Resultado / Diagnóstico ────────────────────────

  /** Calcula totais e renderiza o diagnóstico 50/30/20. */
  function renderWizardStep4() {
    const totalIncome = wizardState.incomes.reduce((s, i) => s + i.amount, 0);

    // Total de fixos: checados existentes + novos
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    const templates = FinanceData.getTemplates();
    const checkedFixedAmt = wizardState.fixedChecked.reduce((s, id) => {
      const t = templates.find(x => x.id === id);
      return s + (t ? t.amount : 0);
    }, 0);
    const newFixedAmt = wizardState.fixedNew.reduce((s, i) => s + i.amount, 0);
    const totalFixed = checkedFixedAmt + newFixedAmt;

    // Total de variáveis: grid + avulsos
    const catAmt = Object.values(wizardState.varItems).reduce((s, v) => s + (v || 0), 0);
    const customAmt = wizardState.varCustom.reduce((s, i) => s + i.amount, 0);
    const totalVar = catAmt + customAmt;

    const totalExpense = totalFixed + totalVar;
    const balance = totalIncome - totalExpense;

    // KPIs
    if (wResIncome)  wResIncome.textContent  = formatCurrency(totalIncome);
    if (wResExpense) wResExpense.textContent  = formatCurrency(totalExpense);
    if (wResBalance) wResBalance.textContent  = formatCurrency(balance);

    // Percentuais 50/30/20
    const pctFixed = totalIncome > 0 ? Math.round((totalFixed / totalIncome) * 100) : 0;
    const pctVar   = totalIncome > 0 ? Math.round((totalVar   / totalIncome) * 100) : 0;
    const pctSave  = totalIncome > 0 ? Math.round((balance    / totalIncome) * 100) : 0;

    if (wRulePctFixed) wRulePctFixed.textContent = `${pctFixed}%`;
    if (wRulePctVar)   wRulePctVar.textContent   = `${pctVar}%`;
    if (wRulePctSave)  wRulePctSave.textContent  = `${Math.max(0, pctSave)}%`;

    // Barras animadas (pequeno timeout para garantir animação)
    setTimeout(() => {
      if (wRuleBarFixed) {
        wRuleBarFixed.style.width = `${Math.min(pctFixed, 100)}%`;
        wRuleBarFixed.classList.toggle('over-limit', pctFixed > 50);
      }
      if (wRuleBarVar) {
        wRuleBarVar.style.width = `${Math.min(pctVar, 100)}%`;
        wRuleBarVar.classList.toggle('over-limit', pctVar > 30);
      }
      if (wRuleBarSave) {
        wRuleBarSave.style.width = `${Math.min(Math.max(pctSave, 0), 100)}%`;
        wRuleBarSave.classList.toggle('over-limit', pctSave < 0);
      }
    }, 80);

    // Diagnóstico
    const isGood = pctFixed <= 50 && pctVar <= 30 && pctSave >= 20;
    const isWarn = !isGood && balance >= 0;
    const isDanger = balance < 0;

    if (wizardResultEmoji) wizardResultEmoji.textContent   = isDanger ? '⚠️' : isWarn ? '🤔' : '🎉';
    if (wizardResultTitle) wizardResultTitle.textContent   = isDanger ? 'Atenção!' : isWarn ? 'Quase lá!' : 'Parabéns!';
    if (wizardResultSubtitle) wizardResultSubtitle.textContent = isDanger
      ? 'Seus gastos superam sua renda. Revise os valores.'
      : isWarn
      ? 'Orçamento positivo, mas ainda fora da regra 50/30/20.'
      : 'Seu orçamento está dentro da regra 50/30/20!';

    if (wizardDiagnosisBanner) {
      wizardDiagnosisBanner.className = 'wizard-diagnosis-banner' + (isDanger ? ' danger' : isWarn ? ' warning' : '');
    }
    if (wizardDiagnosisIcon) {
      wizardDiagnosisIcon.className = isDanger
        ? 'fa-solid fa-triangle-exclamation'
        : isWarn
        ? 'fa-solid fa-circle-exclamation'
        : 'fa-solid fa-circle-check';
    }
    if (wizardDiagnosisText) {
      wizardDiagnosisText.textContent = isDanger
        ? `Déficit de ${formatCurrency(Math.abs(balance))} — corte gastos ou adicione renda.`
        : isWarn
        ? `Sobra ${formatCurrency(balance)} (${pctSave}%). Meta: ≥ 20% da renda.`
        : `Sobra ${formatCurrency(balance)} (${pctSave}%) para investir ou poupar. 🚀`;
    }
  }

  // ── Salvar em lote ──────────────────────────────────────────

  /**
   * Persiste todos os dados coletados no wizard:
   * rendas, baixa de fixos existentes, novos fixos e variáveis.
   */
  function handleWizardFinish() {
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    let saved = 0;

    // 1. Salvar rendas
    wizardState.incomes.forEach(item => {
      const dateStr = item.date || `${ym}-01`;
      FinanceData.add({
        type:     'income',
        desc:     item.desc,
        amount:   item.amount,
        category: 'Receita',
        date:     dateStr,
        month:    dateStr.substring(0, 7),
        paid:     true,
      });
      saved++;
    });

    // 2. Registrar baixa dos fixos marcados no mês atual
    wizardState.fixedChecked.forEach(id => {
      FinanceData.togglePaid(id, ym);
      saved++;
    });

    // 3. Salvar novos gastos fixos (templates)
    wizardState.fixedNew.forEach(item => {
      FinanceData.add({
        type:       'fixed',
        desc:       item.desc,
        amount:     item.amount,
        category:   'Moradia',
        isDebt:     false,
        active:     true,
        startMonth: ym,
        endMonth:   null,
        day:        '01',
      });
      saved++;
    });

    // 4. Salvar gastos variáveis por categoria
    WIZARD_VAR_CATEGORIES.forEach(cat => {
      const amount = wizardState.varItems[cat.name];
      if (amount && amount > 0) {
        FinanceData.add({
          type:     'variable',
          desc:     cat.name,
          amount:   amount,
          category: cat.name,
          date:     `${ym}-01`,
          month:    ym,
          paid:     false,
        });
        saved++;
      }
    });

    // 5. Salvar gastos variáveis avulsos
    wizardState.varCustom.forEach(item => {
      FinanceData.add({
        type:     'variable',
        desc:     item.desc,
        amount:   item.amount,
        category: GastoProImporter ? GastoProImporter.autoDetectCategory(item.desc) : 'Outros',
        date:     `${ym}-01`,
        month:    ym,
        paid:     false,
      });
      saved++;
    });

    if (saved > 0) {
      showToast(`✅ ${saved} lançamento${saved > 1 ? 's' : ''} salvo${saved > 1 ? 's' : ''} com sucesso!`);
      renderAll();
    } else {
      showToast('Nenhum dado foi informado para salvar.');
    }

    closeWizard();
  }

  // ── Navegação ────────────────────────────────────────────────

  /** Avança para o próximo passo ou finaliza. */
  function handleWizardNext() {
    const step = wizardState.step;

    if (step === 1) {
      if (wizardState.incomes.length === 0) {
        showToast('Adicione ao menos uma fonte de renda antes de avançar.');
        return;
      }
      goToWizardStep(2, 'forward');

    } else if (step === 2) {
      goToWizardStep(3, 'forward');

    } else if (step === 3) {
      goToWizardStep(4, 'forward');

    } else if (step === 4) {
      handleWizardFinish();
    }
  }

  /** Volta para o passo anterior. */
  function handleWizardBack() {
    if (wizardState.step > 1) goToWizardStep(wizardState.step - 1, 'back');
  }

  // ── Event Listeners do Wizard ────────────────────────────────

  if (sidebarWizardBtn) sidebarWizardBtn.addEventListener('click', openWizard);
  if (closeWizardBtn)   closeWizardBtn.addEventListener('click',   closeWizard);
  if (wizardNextBtn)    wizardNextBtn.addEventListener('click',    handleWizardNext);
  if (wizardBackBtn)    wizardBackBtn.addEventListener('click',    handleWizardBack);

  // Fechar ao clicar no overlay
  if (wizardModal) {
    wizardModal.addEventListener('click', (e) => {
      if (e.target === wizardModal) closeWizard();
    });
  }

  // Botões de adicionar item
  if (wAddIncomeBtn) wAddIncomeBtn.addEventListener('click', handleWizardAddIncome);
  if (wAddFixedBtn)  wAddFixedBtn.addEventListener('click',  handleWizardAddFixed);
  if (wAddVarBtn)    wAddVarBtn.addEventListener('click',    handleWizardAddVar);

  // Enter nos inputs de renda
  [wIncomeDesc, wIncomeAmount, wIncomeDate].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddIncome(); });
  });

  // Enter nos inputs de fixos
  [wFixedDesc, wFixedAmount].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddFixed(); });
  });

  // Enter nos inputs de variáveis
  [wVarDesc, wVarAmount].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddVar(); });
  });


  // Pull-to-refresh para telas touch em smartphones / PWA
  let touchStartY = 0;
  let isAtTop = false;

  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 5) {
      isAtTop = true;
      touchStartY = e.touches[0].clientY;
    } else {
      isAtTop = false;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (isAtTop && !isRefreshing) {
      const touchEndY = e.changedTouches[0].clientY;
      const pullDistance = touchEndY - touchStartY;
      if (pullDistance > 90) {
        handleAppRefresh();
      }
    }
    isAtTop = false;
  }, { passive: true });

  // ── 15. Modal de Política de Privacidade (LGPD) ──────────────
  // Abre a partir do footer, drawer ou link no formulário de cadastro

  const privacyPolicyModal    = document.getElementById('privacyPolicyModal');
  const closePrivacyModalBtn  = document.getElementById('closePrivacyModalBtn');
  const closePrivacyModalOkBtn = document.getElementById('closePrivacyModalOkBtn');
  const footerPrivacyLink     = document.getElementById('footerPrivacyLink');
  const drawerPrivacyLink     = document.getElementById('drawerPrivacyLink');
  const openPrivacyPolicyBtn  = document.getElementById('openPrivacyPolicyBtn');

  function openPrivacyModal(e) {
    if (e) e.preventDefault();
    if (privacyPolicyModal) privacyPolicyModal.classList.add('active');
  }

  function closePrivacyModal() {
    if (privacyPolicyModal) privacyPolicyModal.classList.remove('active');
  }

  if (footerPrivacyLink)    footerPrivacyLink.addEventListener('click',    openPrivacyModal);
  if (drawerPrivacyLink)    drawerPrivacyLink.addEventListener('click',    openPrivacyModal);
  if (openPrivacyPolicyBtn) openPrivacyPolicyBtn.addEventListener('click', openPrivacyModal);
  if (closePrivacyModalBtn) closePrivacyModalBtn.addEventListener('click', closePrivacyModal);
  if (closePrivacyModalOkBtn) closePrivacyModalOkBtn.addEventListener('click', closePrivacyModal);

  // Fechar ao clicar no overlay
  if (privacyPolicyModal) {
    privacyPolicyModal.addEventListener('click', (e) => {
      if (e.target === privacyPolicyModal) closePrivacyModal();
    });
  }

  // ── Inicialização: renderiza perfil e interface ao carregar ───
  renderUserProfile();
  renderAll();

  // ── 12. Registro do Service Worker (PWA) ─────────────────────
  // Permite instalação como app e funcionamento offline.
  // A falha é esperada quando o app é aberto via file:// (sem servidor),
  // então é tratada silenciosamente para não poluir o console do usuário.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.info('[GastoPro] Service Worker não registrado (normal em file://):', err.message);
    });
  }

  // ── 13. Metas por Categoria — Event Listeners ─────────────────
  initGoalModalListeners();
});

// ================================================================
// METAS POR CATEGORIA — RENDERIZAÇÃO
// ================================================================

/**
 * Calcula o gasto atual de cada categoria e renderiza os cards
 * de metas com barras de progresso coloridas e alertas visuais.
 *
 * @param {Array} fixed     - Gastos fixos ativos do mês.
 * @param {Array} variables - Gastos variáveis do mês.
 */
function renderGoalsSection(fixed, variables) {
  const container  = document.getElementById('goalsListContainer');
  const emptyState = document.getElementById('goalsEmptyState');
  if (!container) return;

  const goals = FinanceData.getGoals();

  if (goals.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Calcula gasto atual agrupado por categoria (fixos + variáveis)
  const spendingMap = {};
  [...fixed, ...variables].forEach(item => {
    const cat = item.category || 'Outros';
    spendingMap[cat] = (spendingMap[cat] || 0) + (item.amount || 0);
  });

  // Disparar alertas toast para metas críticas (>= 100%) ou próximas (>= 80%)
  // Executa apenas uma vez por mês verificado (evita spam)
  goals.forEach(goal => {
    const spent = spendingMap[goal.category] || 0;
    const pct   = goal.limit > 0 ? (spent / goal.limit) * 100 : 0;
    if (pct >= 100) {
      // Alerta já será visível no card — toast só no momento exato (ver modal)
    }
  });

  // Renderiza os cards
  container.innerHTML = goals.map(goal => {
    const spent    = spendingMap[goal.category] || 0;
    const pct      = goal.limit > 0 ? Math.min(200, (spent / goal.limit) * 100) : 0;
    const pctShow  = Math.min(100, pct); // Largura da barra (max 100%)
    const pctLabel = Math.round(goal.limit > 0 ? (spent / goal.limit) * 100 : 0);

    // Define cor e status conforme percentual
    let barClass   = 'goal-bar-fill--safe';
    let statusIcon = '<i class="fa-solid fa-circle-check"></i>';
    let statusClass = 'goal-status--safe';
    let statusText  = 'Dentro do limite';

    if (pctLabel >= 100) {
      barClass    = 'goal-bar-fill--danger';
      statusIcon  = '<i class="fa-solid fa-circle-exclamation"></i>';
      statusClass = 'goal-status--danger';
      statusText  = '🔴 Limite ultrapassado!';
    } else if (pctLabel >= 80) {
      barClass    = 'goal-bar-fill--warning';
      statusIcon  = '<i class="fa-solid fa-triangle-exclamation"></i>';
      statusClass = 'goal-status--warning';
      statusText  = '⚠️ Atenção: 80% atingido';
    }

    return `
      <div class="goal-card ${pctLabel >= 100 ? 'goal-card--danger' : pctLabel >= 80 ? 'goal-card--warning' : ''}" data-goal-category="${escapeHtml(goal.category)}">
        <div class="goal-card-header">
          <div class="goal-card-title">
            <span class="goal-category-name">${escapeHtml(goal.category)}</span>
            <span class="goal-status ${statusClass}">${statusIcon} ${statusText}</span>
          </div>
          <button class="goal-edit-btn" onclick="openGoalModal('${escapeHtml(goal.category)}')" title="Editar meta">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        <div class="goal-amounts">
          <span class="goal-spent">${formatCurrency(spent)}</span>
          <span class="goal-separator">de</span>
          <span class="goal-limit">${formatCurrency(goal.limit)}</span>
          <span class="goal-pct-badge ${pctLabel >= 100 ? 'badge-danger' : pctLabel >= 80 ? 'badge-warning' : 'badge-success'}">${pctLabel}%</span>
        </div>
        <div class="goal-bar-track">
          <div class="goal-bar-fill ${barClass}" style="width: ${pctShow}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ================================================================
// METAS POR CATEGORIA — MODAL
// ================================================================

/**
 * Abre o modal de meta.
 * Se passado category, pré-preenche para edição; caso contrário, cria nova.
 *
 * @param {string} [category] - Categoria da meta a editar (opcional).
 */
window.openGoalModal = function(category) {
  const modal      = document.getElementById('goalModal');
  const title      = document.getElementById('goalModalTitle');
  const catSelect  = document.getElementById('goalCategorySelect');
  const limitInput = document.getElementById('goalLimitInput');
  const removeBtn  = document.getElementById('removeGoalBtn');

  if (!modal) return;

  if (category) {
    // Modo edição: preenche com valores da meta existente
    const goals     = FinanceData.getGoals();
    const existing  = goals.find(g => g.category === category);
    title.innerHTML = '<i class="fa-solid fa-bullseye"></i> Editar Meta de Gasto';
    catSelect.value  = category;
    catSelect.disabled = true; // Categoria não pode mudar na edição
    limitInput.value = existing ? existing.limit : '';
    removeBtn.style.display = 'inline-flex';
  } else {
    // Modo criação
    title.innerHTML  = '<i class="fa-solid fa-bullseye"></i> Nova Meta de Gasto';
    catSelect.value  = '';
    catSelect.disabled = false;
    limitInput.value = '';
    removeBtn.style.display = 'none';
  }

  modal.classList.add('active');
  setTimeout(() => limitInput.focus(), 100);
};

/**
 * Fecha o modal de metas e reseta o estado.
 */
function closeGoalModal() {
  const modal     = document.getElementById('goalModal');
  const catSelect = document.getElementById('goalCategorySelect');
  if (modal)     modal.classList.remove('active');
  if (catSelect) catSelect.disabled = false;
}

/**
 * Inicializa todos os event listeners do modal de metas.
 */
function initGoalModalListeners() {
  const openBtn    = document.getElementById('openGoalModalBtn');
  const closeBtn   = document.getElementById('closeGoalModalBtn');
  const cancelBtn  = document.getElementById('cancelGoalModalBtn');
  const saveBtn    = document.getElementById('saveGoalBtn');
  const removeBtn  = document.getElementById('removeGoalBtn');
  const modal      = document.getElementById('goalModal');

  if (openBtn)   openBtn.addEventListener('click',  () => openGoalModal());
  if (closeBtn)  closeBtn.addEventListener('click',  closeGoalModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeGoalModal);

  // Fecha ao clicar no overlay
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeGoalModal();
    });
  }

  // Salvar meta
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const category = document.getElementById('goalCategorySelect').value.trim();
      const limit    = parseFloat(document.getElementById('goalLimitInput').value);

      if (!category) {
        showToast('⚠️ Selecione uma categoria antes de salvar.');
        return;
      }
      if (!limit || limit <= 0) {
        showToast('⚠️ Informe um valor de limite válido (maior que zero).');
        return;
      }

      FinanceData.saveGoal(category, limit);
      closeGoalModal();
      renderAll();
      showToast(`✅ Meta de ${category}: ${formatCurrency(limit)} salva!`);
    });
  }

  // Remover meta
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const category = document.getElementById('goalCategorySelect').value;
      if (!category) return;
      FinanceData.deleteGoal(category);
      closeGoalModal();
      renderAll();
      showToast(`🗑️ Meta de ${category} removida.`);
    });
  }
}



