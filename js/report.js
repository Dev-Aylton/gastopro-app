(function () {
  'use strict';

  const MONTHS_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const REPORT_LABELS = {
    title: 'Relatório financeiro',
    debts: 'Dívidas',
    variableExpenses: 'Despesas variáveis',
    description: 'Descrição',
    status: 'Situação',
    month: 'Mês',
    variable: 'Variáveis',
    debtSection: 'Dívidas em aberto',
    forecast: 'Previsão de quitação',
    settlementForecast: 'Quitação prevista',
    information: 'Informação',
    noDebts: 'Nenhuma dívida identificada no período.',
    noGoals: 'Nenhuma meta cadastrada.',
    diagnosis: 'Diagnóstico financeiro',
    diagnosisColumn: 'Diagnóstico',
    guidance: 'Orientação',
    noEntries: 'Nenhum lançamento no período.'
  };

  function formatReportPercentage(value) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatPeriod(ym) {
    const [year, month] = ym.split('-').map(Number);
    return `${MONTHS_PT[month - 1]} de ${year}`;
  }

  function monthRange(from, to) {
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    const months = [];
    for (let year = fromYear, month = fromMonth;
      year < toYear || (year === toYear && month <= toMonth);
      month += 1) {
      if (month > 12) {
        month = 1;
        year += 1;
      }
      months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return months;
  }

  function periodLabel(period, months) {
    if (period.type === 'year') return period.from.slice(0, 4);
    if (months.length === 1) return formatPeriod(months[0]);
    return `${formatPeriod(months[0])} a ${formatPeriod(months[months.length - 1])}`;
  }

  function getMonthTotals(rows, debtIds) {
    const activeFixed = rows.fixed.filter(item => item.active !== false || item.paid);
    const income = rows.income.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const fixed = activeFixed
      .filter(item => !debtIds.has(String(item.id)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const debts = activeFixed
      .filter(item => debtIds.has(String(item.id)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const variable = rows.variable.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = fixed + debts + variable;
    const balance = income - expenses;
    return {
      income: roundMoney(income),
      fixed: roundMoney(fixed),
      debts: roundMoney(debts),
      variable: roundMoney(variable),
      expenses: roundMoney(expenses),
      balance: roundMoney(balance),
      percentages: {
        fixed: income ? Math.round(((fixed + debts) / income) * 100) : 0,
        variable: income ? Math.round((variable / income) * 100) : 0,
        savings: income
          ? Math.max(0, 100 - Math.round(((fixed + debts) / income) * 100) - Math.round((variable / income) * 100))
          : 0
      }
    };
  }

  function addToCategoryMap(map, item) {
    const category = item.category || 'Outros';
    map[category] = (map[category] || 0) + Number(item.amount || 0);
  }

  function toReportEntry(item, ym, kind) {
    return {
      date: item.date || `${ym}-${String(item.day || '01').padStart(2, '0')}`,
      description: item.desc || '',
      category: item.category || 'Outros',
      amount: roundMoney(item.amount),
      status: item.paid ? 'Pago' : 'Pendente',
      kind
    };
  }

  function buildReportData(period) {
    if (!period || !['month', 'year', 'range'].includes(period.type) ||
      typeof period.from !== 'string' || typeof period.to !== 'string' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(period.from) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(period.to) || period.from > period.to) {
      throw new TypeError('Período inválido para o relatório.');
    }
    const months = monthRange(period.from, period.to);
    if (!months.length) {
      throw new RangeError('Informe um período válido.');
    }

    const entries = { income: [], fixed: [], debts: [], variable: [] };
    const categoryMap = {};
    const monthly = [];
    const monthlyRows = [];
    const debtHelpers = window.GastoProReportHelpers;
    const templateList = FinanceData.getTemplates();

    months.forEach(ym => {
      const projectedRows = FinanceData.getByMonth(ym);
      const monthRows = {
        income: projectedRows.filter(item => item.type === 'income'),
        fixed: projectedRows.filter(item => item.type === 'fixed' || item.type === 'debt'),
        variable: projectedRows.filter(item => item.type === 'variable')
      };
      const debtData = debtHelpers.getDebtCenterData(ym, templateList);
      const debtIds = new Set(debtData.items.map(item => String(item.id)));
      const totals = getMonthTotals(monthRows, debtIds);
      monthly.push({ month: ym, label: formatPeriod(ym), ...totals });
      monthlyRows.push({ ym, rows: monthRows, debtIds });

      monthRows.income.forEach(item => {
        entries.income.push(toReportEntry(item, ym, 'income'));
      });
      monthRows.fixed
        .filter(item => item.active !== false || item.paid)
        .forEach(item => {
          const isDebt = debtIds.has(String(item.id));
          const kind = isDebt ? 'debt' : 'fixed';
          entries[kind === 'debt' ? 'debts' : 'fixed'].push(toReportEntry(item, ym, kind));
          addToCategoryMap(categoryMap, item);
        });
      monthRows.variable.forEach(item => {
        entries.variable.push(toReportEntry(item, ym, 'variable'));
        addToCategoryMap(categoryMap, item);
      });
    });

    const totals = ['income', 'fixed', 'debts', 'variable', 'expenses', 'balance']
      .reduce((result, key) => {
        result[key] = roundMoney(monthly.reduce((sum, item) => sum + item[key], 0));
        return result;
      }, {});
    totals.debt = totals.debts;
    totals.percentages = {
      fixed: totals.income ? Math.round(((totals.fixed + totals.debts) / totals.income) * 100) : 0,
      variable: totals.income ? Math.round((totals.variable / totals.income) * 100) : 0,
      savings: totals.income
        ? Math.max(0, 100 - Math.round(((totals.fixed + totals.debts) / totals.income) * 100) -
          Math.round((totals.variable / totals.income) * 100))
        : 0
    };

    const totalExpenses = totals.expenses;
    const categories = Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount: roundMoney(amount),
        percentage: totalExpenses ? roundMoney((amount / totalExpenses) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const debtData = debtHelpers.getDebtCenterData(period.to, templateList);
    const outstandingDebts = debtData.items.filter(item => !item.isFinished);
    const debts = {
      totalRemaining: roundMoney(debtData.totalRemaining),
      remainingInstallments: outstandingDebts.reduce((sum, item) => sum + item.remainingMonths, 0),
      forecastMonth: outstandingDebts.reduce((latest, item) =>
        item.forecastMonth && (!latest || item.forecastMonth > latest) ? item.forecastMonth : latest, null),
      items: debtData.items.map(item => ({
        description: item.description,
        category: item.category,
        remainingAmount: roundMoney(item.remainingAmount),
        remainingInstallments: item.remainingMonths,
        forecastMonth: item.forecastMonth,
        isFinished: item.isFinished,
        isOverdue: item.isOverdue,
        status: item.isFinished
          ? 'Quitada'
          : item.isOverdue
            ? `${item.remainingMonths} parcela(s) em aberto`
            : `${item.remainingMonths}x restantes`
      }))
    };

    const goalProgress = debtHelpers.calculateGoalProgress(
      FinanceData.getGoals(),
      monthlyRows.flatMap(({ rows }) => rows.fixed.filter(item => item.active !== false || item.paid)),
      monthlyRows.flatMap(({ rows }) => rows.variable)
    );
    const goals = goalProgress.map(goal => ({
      category: goal.category,
      limit: roundMoney(goal.limit),
      spent: roundMoney(goal.spent),
      percentage: roundMoney(goal.percentage),
      status: goal.status
    }));

    const profile = FinanceData.getProfile();
    const generatedAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date());
    const diagnosis = debtHelpers.getHealthDiagnostic(
      totals.income, totals.balance, totals.percentages.fixed,
      totals.percentages.variable, totals.percentages.savings
    );

    return {
      meta: {
        period: periodLabel(period, months),
        from: period.from,
        to: period.to,
        profileName: profile && profile.name ? profile.name : '',
        generatedAt
      },
      totals,
      monthly,
      months: monthly.map(item => ({
        month: item.month,
        label: item.label,
        totals: { ...item, debt: item.debts }
      })),
      categories,
      entries: period.includeDetails ? entries : null,
      details: period.includeDetails ? entries : { income: [], fixed: [], debts: [], variable: [] },
      debts,
      goals,
      diagnosis
    };
  }

  function sanitizePdfText(value) {
    return String(value == null ? '' : value)
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/[^\u0020-\u00FF\u0100-\u024F\u1E00-\u1EFF\u2013\u2014\u2022]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pdfCurrency(value) {
    return sanitizePdfText(new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value));
  }

  function pdfDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? `${match[3]}/${match[2]}/${match[1]}` : sanitizePdfText(value);
  }

  function getReportFileName(data) {
    const from = data.meta.from;
    const to = data.meta.to;
    if (from.slice(0, 4) === to.slice(0, 4) &&
      from.endsWith('-01') && to.endsWith('-12')) {
      return `GastoPro-relatorio-${from.slice(0, 4)}.pdf`;
    }
    if (from === to) return `GastoPro-relatorio-${from}.pdf`;
    return `GastoPro-relatorio-${from}_a_${to}.pdf`;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function addSectionTitle(doc, title, y) {
    if (y > doc.internal.pageSize.getHeight() - 45) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(33, 50, 75);
    doc.text(sanitizePdfText(title), 14, y);
    return y + 3;
  }

  function renderTable(doc, head, body, y, options = {}) {
    const numericColumns = new Set(options.numericColumns || []);
    const tableOptions = { ...options };
    delete tableOptions.numericColumns;
    const columnStyles = { ...(tableOptions.columnStyles || {}) };
    numericColumns.forEach(index => {
      columnStyles[index] = { ...(columnStyles[index] || {}), halign: 'right' };
    });
    const finalTableOptions = {
      startY: y,
      head: [head.map(sanitizePdfText)],
      body: body.map(row => row.map(value => sanitizePdfText(value))),
      margin: { left: 14, right: 14, top: 14, bottom: 14 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [48, 57, 70] },
      headStyles: { fillColor: [29, 78, 137], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      ...tableOptions,
      columnStyles,
      didParseCell(cellData) {
        if (numericColumns.has(cellData.column.index)) cellData.cell.styles.halign = 'right';
      }
    };
    if (typeof doc.autoTable === 'function') {
      doc.autoTable(finalTableOptions);
    } else if (typeof window.autoTable === 'function') {
      window.autoTable(doc, finalTableOptions);
    } else {
      throw new Error('O plugin jspdf-autotable não foi carregado.');
    }
    return doc.lastAutoTable.finalY + 9;
  }

  async function renderReportPDF(data, options = {}) {
    const jspdf = window.jspdf;
    if (!jspdf || !jspdf.jsPDF) throw new Error('A biblioteca jsPDF não foi carregada.');
    const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setProperties({ title: `GastoPro - Relatório financeiro - ${data.meta.period}` });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 46, 60);
    doc.setFontSize(21);
    doc.text('GastoPro', 14, 21);
    doc.setFontSize(15);
    doc.text(REPORT_LABELS.title, 14, 30);
    doc.setFontSize(10);
    doc.text(sanitizePdfText(data.meta.period), 14, 37);
    doc.setFontSize(8);
    doc.text(`Gerado em ${sanitizePdfText(data.meta.generatedAt)}`, 14, 43);
    if (data.meta.profileName) {
      doc.text(`Perfil: ${sanitizePdfText(data.meta.profileName)}`, 14, 48);
    }

    try {
      const logo = await loadImage(options.logoUrl || 'assets/logo-symbol.png');
      const canvas = document.createElement('canvas');
      canvas.width = logo.naturalWidth;
      canvas.height = logo.naturalHeight;
      canvas.getContext('2d').drawImage(logo, 0, 0);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 165, 14, 22, 22);
    } catch (error) {
      console.warn('[GastoPro] O relatório será gerado sem a logo:', error);
    }

    let y = renderTable(doc, ['Resumo', 'Valor'], [
      ['Renda', pdfCurrency(data.totals.income)],
      ['Despesas fixas', pdfCurrency(data.totals.fixed)],
      [REPORT_LABELS.debts, pdfCurrency(data.totals.debts)],
      [REPORT_LABELS.variableExpenses, pdfCurrency(data.totals.variable)],
      ['Saldo', pdfCurrency(data.totals.balance)],
      ['Percentual 50/30/20', `${formatReportPercentage(data.totals.percentages.fixed)}% / ${formatReportPercentage(data.totals.percentages.variable)}% / ${formatReportPercentage(data.totals.percentages.savings)}%`]
    ], data.meta.profileName ? 55 : 50, { numericColumns: [1] });

    y = addSectionTitle(doc, 'Totais por mês', y);
    y = renderTable(doc, [REPORT_LABELS.month, 'Renda', 'Fixos', REPORT_LABELS.debts, REPORT_LABELS.variable, 'Saldo'],
      data.monthly.map(item => [
        item.label, pdfCurrency(item.income), pdfCurrency(item.fixed), pdfCurrency(item.debts),
        pdfCurrency(item.variable), pdfCurrency(item.balance)
      ]), y, { numericColumns: [1, 2, 3, 4, 5] });

    y = addSectionTitle(doc, 'Gastos por categoria', y);
    y = renderTable(doc, ['Categoria', 'Valor', '% dos gastos'],
      data.categories.map(item => [item.category, pdfCurrency(item.amount), `${formatReportPercentage(item.percentage)}%`]),
      y, { numericColumns: [1, 2] });

    y = addSectionTitle(doc, REPORT_LABELS.debtSection, y);
    y = renderTable(doc, ['Saldo devedor total', 'Parcelas restantes', REPORT_LABELS.forecast], [[
      pdfCurrency(data.debts.totalRemaining),
      String(data.debts.remainingInstallments),
      data.debts.forecastMonth || 'Sem previsão'
    ]], y, { numericColumns: [0, 1] });
    y = renderTable(doc, [REPORT_LABELS.description, 'Categoria', 'Saldo devedor', 'Parcelas restantes', REPORT_LABELS.settlementForecast, REPORT_LABELS.status],
      data.debts.items.map(item => [
        item.description, item.category, pdfCurrency(item.remainingAmount),
          String(item.remainingInstallments), item.forecastMonth || 'Sem previsão', item.status
      ]), y, { numericColumns: [2, 3] });
    if (!data.debts.items.length) {
      y = renderTable(doc, [REPORT_LABELS.information], [[REPORT_LABELS.noDebts]], y);
    }

    y = addSectionTitle(doc, 'Metas por categoria', y);
    y = renderTable(doc, ['Categoria', 'Limite', 'Consumo', '% do limite', 'Situação'],
      data.goals.map(item => [
        item.category, pdfCurrency(item.limit), pdfCurrency(item.spent),
        `${formatReportPercentage(item.percentage)}%`, item.status
      ]), y, { numericColumns: [1, 2, 3] });
    if (!data.goals.length) {
      y = renderTable(doc, [REPORT_LABELS.information], [[REPORT_LABELS.noGoals]], y);
    }

    y = addSectionTitle(doc, REPORT_LABELS.diagnosis, y);
    y = renderTable(doc, [REPORT_LABELS.status, REPORT_LABELS.diagnosisColumn, REPORT_LABELS.guidance], [[
      data.diagnosis.badge,
      data.diagnosis.title,
      data.diagnosis.description
    ]], y);

    if (data.entries) {
      const sections = [
        ['Ganhos', data.entries.income],
        ['Gastos fixos', data.entries.fixed],
        [REPORT_LABELS.debts, data.entries.debts],
        [REPORT_LABELS.variableExpenses, data.entries.variable]
      ];
      sections.forEach(([title, rows]) => {
        y = addSectionTitle(doc, title, y);
        y = renderTable(doc, ['Data', 'Descrição', 'Categoria', 'Valor', 'Situação'],
          rows.map(item => [
            pdfDate(item.date), item.description, item.category, pdfCurrency(item.amount), item.status
          ]), y, { numericColumns: [3] });
        if (!rows.length) {
          y = renderTable(doc, [REPORT_LABELS.information], [[REPORT_LABELS.noEntries]], y);
        }
      });
    }

    const blob = doc.output('blob');
    const fileName = getReportFileName(data);
    if (options.download !== false) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return blob;
  }

  window.buildReportData = buildReportData;
  window.renderReportPDF = renderReportPDF;
  window.getReportFileName = getReportFileName;
  window.sanitizePdfText = sanitizePdfText;
  window.formatReportPercentage = formatReportPercentage;
  window.getReportLabels = () => ({ ...REPORT_LABELS });
})();
