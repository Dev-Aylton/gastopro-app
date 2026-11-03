(function () {
  'use strict';

  const MAX_PROJECTION_MONTHS = 600;

  function roundMoney(value) {
    const round = window.GastoProReportHelpers &&
      window.GastoProReportHelpers.roundMoney;
    if (typeof round !== 'function') {
      throw new Error('O arredondamento financeiro compartilhado não foi carregado.');
    }
    return round(value);
  }

  function validMonth(value) {
    return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }

  function monthAtOffset(month, offset) {
    if (!validMonth(month) || !Number.isInteger(offset)) {
      throw new TypeError('Informe um mês válido para projetar o cenário.');
    }
    const [year, value] = month.split('-').map(Number);
    const index = year * 12 + value - 1 + offset;
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
  }

  function simulateDebtPayoff(debt, extraAmount, frequency, startMonth) {
    const remaining = Number(debt && debt.remainingAmount);
    const installment = Number(debt && debt.amount);
    const remainingMonths = Number(debt && debt.remainingMonths);
    const extra = Number(extraAmount);
    const month = startMonth || (debt && debt.nextInstallmentMonth);
    if (!debt || !Number.isFinite(remaining) || remaining < 0 ||
      !Number.isFinite(installment) || installment <= 0 ||
      !Number.isInteger(remainingMonths) || remainingMonths < 0 ||
      !Number.isFinite(extra) || extra < 0 ||
      !['once', 'monthly'].includes(frequency) || !validMonth(month)) {
      throw new TypeError('Os dados da dívida ou do pagamento extra são inválidos.');
    }
    if (remaining === 0 || remainingMonths === 0) {
      return {
        isPaidOff: true,
        baseMonths: 0,
        simulatedMonths: 0,
        monthsSaved: 0,
        basePayoffMonth: null,
        simulatedPayoffMonth: null,
        interestIncluded: false,
        estimateWithoutInterest: true,
        series: []
      };
    }

    const baseMonths = Math.min(MAX_PROJECTION_MONTHS, remainingMonths);
    let baseBalance = remaining;
    let simulatedBalance = remaining;
    const series = [];
    let simulatedMonths = null;
    let simulatedPayoffMonth = null;
    for (let index = 0; index < MAX_PROJECTION_MONTHS; index += 1) {
      const basePayment = Math.min(baseBalance, installment);
      baseBalance = Math.max(0, roundMoney(baseBalance - basePayment));
      const extraThisMonth = frequency === 'monthly' || index === 0 ? extra : 0;
      const simulatedPayment = simulatedBalance > 0
        ? Math.min(simulatedBalance, installment + extraThisMonth)
        : 0;
      simulatedBalance = Math.max(0, roundMoney(simulatedBalance - simulatedPayment));
      const projectedMonth = monthAtOffset(month, index);
      series.push({
        month: projectedMonth,
        baseBalance,
        simulatedBalance,
        baseSpending: roundMoney(basePayment),
        simulatedSpending: roundMoney(simulatedPayment)
      });
      if (simulatedBalance === 0 && !simulatedPayoffMonth) {
        simulatedMonths = index + 1;
        simulatedPayoffMonth = projectedMonth;
      }
      if (baseBalance === 0 && simulatedBalance === 0) break;
    }
    const basePayoffMonth = series[Math.min(baseMonths, series.length) - 1].month;
    return {
      isPaidOff: false,
      baseMonths,
      simulatedMonths,
      monthsSaved: Math.max(0, baseMonths - simulatedMonths),
      basePayoffMonth,
      simulatedPayoffMonth,
      interestIncluded: false,
      estimateWithoutInterest: true,
      series
    };
  }

  function simulateCategoryCut(monthlyAmounts, percentage, startMonth) {
    const cut = Number(percentage);
    if (!Number.isFinite(cut) || cut < 0 || cut > 100) {
      throw new TypeError('O percentual de corte deve estar entre 0 e 100.');
    }
    const history = (Array.isArray(monthlyAmounts) ? monthlyAmounts : [])
      .map(value => Number(value && typeof value === 'object' ? value.amount : value))
      .filter(value => Number.isFinite(value) && value > 0);
    const monthsUsed = history.length;
    if (!monthsUsed) {
      return {
        sufficientData: false,
        monthsUsed: 0,
        monthlyAverage: 0,
        percentage: cut,
        monthlySavings: 0,
        annualSavings: 0,
        series: []
      };
    }
    const monthlyAverage = roundMoney(
      history.reduce((sum, value) => sum + value, 0) / monthsUsed
    );
    const monthlySavings = roundMoney(monthlyAverage * cut / 100);
    const month = startMonth || monthAtOffset(
      new Date().toISOString().slice(0, 7), 1
    );
    if (!validMonth(month)) throw new TypeError('Informe um mês válido para projetar o corte.');
    const series = Array.from({ length: 12 }, (_, index) => ({
      month: monthAtOffset(month, index),
      baseBalance: null,
      simulatedBalance: null,
      baseSpending: monthlyAverage,
      simulatedSpending: roundMoney(monthlyAverage - monthlySavings)
    }));
    return {
      sufficientData: true,
      monthsUsed,
      monthlyAverage,
      percentage: cut,
      monthlySavings,
      annualSavings: roundMoney(monthlySavings * 12),
      series
    };
  }

  window.GastoProSimulator = Object.freeze({
    simulateDebtPayoff,
    simulateCategoryCut,
    monthAtOffset
  });
})();
