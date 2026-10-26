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
  if (!item) return;

  document.getElementById('editItemId').value = item.id;
  document.getElementById('editDesc').value = item.desc;
  document.getElementById('editAmount').value = item.amount;
  document.getElementById('editCategory').value = item.category || '';
  document.getElementById('editType').value = item.type;
  document.getElementById('editDate').value = item.date || getTodayString();

  const isFixed = item.type === 'fixed' || id.startsWith('fix-');
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
  // Cada botão de navegação dispara switchToView() com seu data-view
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
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
    const all = FinanceData.getAll();

    pickerMonthsGrid.innerHTML = SHORT_MONTHS.map((name, index) => {
      const monthNum   = index + 1;
      const ym         = `${pickerYear}-${String(monthNum).padStart(2, '0')}`;
      const isSelected = pickerYear === state.currentYear && monthNum === state.currentMonth;
      // Verifica se há qualquer dado cadastrado naquele mês (indicador visual de dados)
      const hasData    = all.some(e => e.month === ym);

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

  if (monthPickerTrigger) monthPickerTrigger.addEventListener('click', toggleMonthPicker);

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
    const amount = parseFloat(document.getElementById('editAmount').value);
    const category = document.getElementById('editCategory').value.trim();
    const type = document.getElementById('editType').value;
    const date = document.getElementById('editDate').value;
    const active = document.getElementById('editActive') ? document.getElementById('editActive').value === 'true' : true;
    const endMonth = document.getElementById('editEndMonth') ? document.getElementById('editEndMonth').value || null : null;

    if (!id || !desc || isNaN(amount) || amount <= 0) return;

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
});
