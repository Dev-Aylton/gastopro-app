'use strict';

(function() {
  function isDeleted(item) {
    return Boolean(item && (item.deletedAt || item.deleted_at));
  }

  function isLoan(template) {
    return Boolean(template && template.loanReceivedAmount != null);
  }

  function monthAtOffset(month, offset) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isInteger(offset)) return null;
    const [year, value] = month.split('-').map(Number);
    const index = year * 12 + value - 1 + offset;
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`;
  }

  function toCents(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : null;
  }

  function getLoanSummary(loan) {
    if (!isLoan(loan)) throw new TypeError('Informe um modelo de empréstimo válido.');
    const count = Number(loan.loanInstallmentCount);
    const totalCents = toCents(loan.loanTotalPayable);
    const installmentCents = toCents(loan.amount);
    if (!Number.isInteger(count) || count < 1 || totalCents == null || installmentCents == null) {
      throw new TypeError('O modelo de empréstimo contém valores inválidos.');
    }

    const paidMonths = loan.paidMonths && typeof loan.paidMonths === 'object'
      ? loan.paidMonths : {};
    let paidInstallments = 0;
    let nextInstallmentMonth = null;
    let remainingCents = 0;
    for (let index = 0; index < count; index += 1) {
      const month = monthAtOffset(loan.startMonth, index);
      if (!month) throw new TypeError('O mês da primeira parcela é inválido.');
      const amountCents = index === count - 1
        ? Math.max(0, totalCents - installmentCents * (count - 1))
        : installmentCents;
      if (paidMonths[month] === true) {
        paidInstallments += 1;
      } else {
        remainingCents += amountCents;
        if (!nextInstallmentMonth) nextInstallmentMonth = month;
      }
    }

    return {
      paidInstallments,
      remainingInstallments: count - paidInstallments,
      nextInstallmentMonth,
      nextInstallmentAmount: nextInstallmentMonth
        ? Math.round(remainingCents > 0 && nextInstallmentMonth === monthAtOffset(loan.startMonth, count - 1)
          ? totalCents - installmentCents * (count - 1)
          : installmentCents) / 100
        : null,
      totalPayable: totalCents / 100,
      remainingAmount: remainingCents / 100,
      lastInstallmentMonth: monthAtOffset(loan.startMonth, count - 1),
      percentagePaid: totalCents > 0
        ? Math.min(100, Math.round((totalCents - remainingCents) / totalCents * 100))
        : 100
    };
  }

  function datesWithinDays(first, second, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(second || '')) return false;
    const firstTime = Date.parse(`${first}T00:00:00Z`);
    const secondTime = Date.parse(`${second}T00:00:00Z`);
    return Number.isFinite(firstTime) && Number.isFinite(secondTime) &&
      new Date(firstTime).toISOString().slice(0, 10) === first &&
      new Date(secondTime).toISOString().slice(0, 10) === second &&
      Math.abs(firstTime - secondTime) <= days * 86400000;
  }

  function makeConflictMap() {
    return new Map();
  }

  function addConflict(conflicts, item, reason, date, amount) {
    if (!item || isDeleted(item)) return;
    const key = item.id || item;
    let conflict = conflicts.get(key);
    if (!conflict) {
      conflict = {
        id: item.id || null,
        description: String(item.desc || item.description || 'Item sem descrição'),
        date: date || item.date || item.startMonth || '',
        amount: Number(amount == null ? item.amount : amount) || 0,
        accountId: item.accountId || null,
        reasons: []
      };
      conflicts.set(key, conflict);
    }
    if (!conflict.reasons.includes(reason)) conflict.reasons.push(reason);
  }

  function detectLoanConflicts(candidate, entries, templates) {
    if (!isLoan(candidate)) throw new TypeError('Informe um empréstimo candidato válido.');
    const conflicts = makeConflictMap();
    const receivedCents = toCents(candidate.loanReceivedAmount);
    const installmentCents = toCents(candidate.amount);
    const receivedDate = candidate.loanReceivedDate;

    (Array.isArray(entries) ? entries : []).forEach(entry => {
      if (isDeleted(entry) || entry.type !== 'income') return;
      const entryCents = toCents(entry.amount);
      if (receivedCents != null && entryCents != null &&
        Math.abs(entryCents - receivedCents) <= 1 &&
        datesWithinDays(entry.date, receivedDate, 7)) {
        addConflict(
          conflicts,
          entry,
          'Ganho com valor igual ao recebido e data dentro de 7 dias, em qualquer conta.',
          entry.date,
          entry.amount
        );
      }
    });

    (Array.isArray(templates) ? templates : []).forEach(template => {
      if (!template || isDeleted(template) || template.id === candidate.id) return;
      if (isLoan(template)) {
        const sameReceipt = toCents(template.loanReceivedAmount) != null &&
          receivedCents != null &&
          toCents(template.loanReceivedAmount) === receivedCents &&
          template.loanReceivedDate === receivedDate;
        const samePlan = toCents(template.amount) != null && installmentCents != null &&
          toCents(template.amount) === installmentCents &&
          Number(template.loanInstallmentCount) === Number(candidate.loanInstallmentCount) &&
          template.startMonth === candidate.startMonth;
        if (sameReceipt) {
          addConflict(
            conflicts,
            template,
            'Outro empréstimo tem o mesmo valor recebido e a mesma data de recebimento.',
            template.loanReceivedDate,
            template.loanReceivedAmount
          );
        }
        if (samePlan) {
          addConflict(
            conflicts,
            template,
            'Outro empréstimo tem o mesmo valor de parcela, número de parcelas e mês inicial.',
            template.loanReceivedDate,
            template.loanReceivedAmount
          );
        }
        return;
      }
      if (template.active !== false && template.type === 'fixed' &&
        toCents(template.amount) != null && installmentCents != null &&
        toCents(template.amount) === installmentCents &&
        Number(template.day) === Number(candidate.day)) {
        addConflict(
          conflicts,
          template,
          'Modelo recorrente ativo tem o mesmo valor de parcela e dia de vencimento.',
          template.startMonth || template.date,
          template.amount
        );
      }
    });

    return Array.from(conflicts.values()).map(conflict => ({
      ...conflict,
      reason: conflict.reasons.join(' ')
    }));
  }

  window.GastoProLoans = Object.freeze({
    getLoanSummary,
    detectLoanConflicts
  });
})();
