/* ================================================================
   GastoPro — Camada de Dados & Persistência Local (Data Layer)
   Autor: Aylton Alberto | Estudante de ADS
   Arquivo: js/data.js

   RESPONSABILIDADE:
   Este arquivo é a única camada que se comunica com o localStorage.
   Toda leitura e escrita de dados do app passa por aqui.
   O restante do código (app.js) nunca acessa o localStorage diretamente.

   CHAVES DO LOCALSTORAGE:
   • STORAGE_ENTRIES   → Lançamentos pontuais (ganhos e gastos variáveis)
   • STORAGE_TEMPLATES → Templates de gastos fixos recorrentes
   • STORAGE_PROFILE   → Dados de perfil do usuário (nome e avatar Base64)
   • STORAGE_GOALS     → Metas por categoria
   • STORAGE_ACCOUNTS  → Contas bancárias PF/PJ
   • STORAGE_LAST_UID  → UID dono dos dados locais ativos

   ESQUEMA DE UM LANÇAMENTO (entry):
   {
     id:       "UUID v4",                      // ID único gerado na inserção
     month:    "2026-11",                     // Mês de competência YYYY-MM
     type:     "income" | "variable",         // Tipo do lançamento
     desc:     "Salário",                     // Descrição legível
     amount:   3500.00,                       // Valor em reais (Number)
     category: "Salário",                     // Categoria para agrupamento
     paid:     true,                          // true = lançamento confirmado
     date:     "2026-11-05"                   // Data ISO YYYY-MM-DD
   }

   ESQUEMA DE UM TEMPLATE FIXO (fixed template):
   {
     id:         "UUID v4",
     desc:       "Aluguel",
     amount:     1350.00,
     category:   "Moradia",
     type:       "fixed",
     isDebt:     false,        // true = é parcela/dívida com data de fim
     active:     true,         // false = pausado, não entra nos totais
     startMonth: "2026-01",    // Mês em que o gasto fixo começou
     endMonth:   "2027-12",    // Mês de quitação (null = sem fim previsto)
     day:        "05",         // Dia de vencimento usado na data projetada
     date:       "2026-01-05",
     paidMonths: {             // Mapa de baixas por mês (chave = YYYY-MM)
       "2026-11": true,
       "2026-12": false
     }
   }
   ================================================================ */

'use strict';

// ----------------------------------------------------------------
// CHAVES DO LOCALSTORAGE
// Nomes versionados das chaves de persistência local.
// ----------------------------------------------------------------

/** Chave dos lançamentos pontuais (ganhos de renda e gastos variáveis). */
const STORAGE_ENTRIES = 'gastopro_entries_v4_oct';

/** Chave dos templates de gastos fixos recorrentes. */
const STORAGE_TEMPLATES = 'gastopro_templates_v4_oct';

/** Chave do perfil do usuário. */
const STORAGE_PROFILE = 'gastopro_profile_real_v2';

/** Chave das metas de teto de gastos por categoria. */
const STORAGE_GOALS = 'gastopro_goals_v1';
const STORAGE_ACCOUNTS = 'gastopro_accounts_v1';
const STORAGE_CREDIT_CARDS = 'gastopro_credit_cards_v1';
const STORAGE_CREDIT_CARD_PURCHASES = 'gastopro_credit_card_purchases_v1';
const STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT = 'gastopro_credit_card_previous_spent_v1';
const STORAGE_FIXED_IMPORT_RULES = 'gastopro_fixed_import_rules_v1';
const STORAGE_LAST_UID = 'gastopro_last_uid';
const STORAGE_PENDING_SYNC = 'gastopro_pending_sync_v1';
const STORAGE_SYNC_METADATA = 'gastopro_sync_metadata_v1';
const MAX_TRANSACTIONAL_IMPORT_ROWS = 500;
const STORAGE_TUTORIAL_SEEN = 'gastopro_tutorial_seen';
const STORAGE_ACCOUNT_SETUP_SEEN = 'gastopro_account_setup_seen';
const MAX_ACCOUNT_BALANCE = 9999999999.99;
const MAX_CREDIT_CARD_LIMIT = 9999999999.99;
const CREDIT_CARD_BRANDS = [
  'Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'
];
const CREDIT_CARD_ISSUERS = [
  'Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa',
  'Inter', 'C6', 'BTG', 'Mercado Pago', 'PicPay', 'Outro'
];
const DEFAULT_CREDIT_CARD_COLOR = '#6366f1';
const CREDIT_CARD_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isUuid(id) {
  return typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function isValidCivilMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return Number(value.slice(0, 4)) > 0;
}

function isValidCivilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

function getCreditCardInstallments(purchase) {
  const purchaseDate = purchase && purchase.purchaseDate;
  const count = Number(purchase && purchase.installmentCount);
  const amount = Number(purchase && purchase.amount);
  const closingDay = Number(purchase && purchase.closingDay);
  const dueDay = Number(purchase && purchase.dueDay);
  if (!isValidCivilDate(purchaseDate) || !Number.isInteger(count) || count < 1 || count > 24 ||
    !Number.isFinite(amount) || amount <= 0 ||
    !Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 ||
    !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return [];

  const [year, month, day] = purchaseDate.split('-').map(Number);
  const statementMonth = new Date(Date.UTC(year, month - 1 + (day > closingDay ? 2 : 1), 1));
  const baseCents = Math.floor((Math.round(amount * 100) / count));
  const totalCents = Math.round(amount * 100);
  return Array.from({ length: count }, (_, index) => {
    const statementDate = new Date(Date.UTC(
      statementMonth.getUTCFullYear(), statementMonth.getUTCMonth() + index, 1
    ));
    const ym = `${statementDate.getUTCFullYear()}-${String(statementDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(Date.UTC(
      statementDate.getUTCFullYear(), statementDate.getUTCMonth() + 1, 0
    )).getUTCDate();
    const installmentCents = index === count - 1
      ? totalCents - baseCents * (count - 1)
      : baseCents;
    return {
      number: index + 1,
      month: ym,
      date: `${ym}-${String(Math.min(dueDay, daysInMonth)).padStart(2, '0')}`,
      amount: installmentCents / 100
    };
  });
}

function calculateCreditCardLimitUsage(card, purchases, previousSpent) {
  const installments = purchases.flatMap(purchase =>
    purchase.cardId === card.id ? getCreditCardInstallments(purchase)
      .filter(installment => !(purchase.paidInstallments || []).includes(installment.number)) : []
  );
  const totalLimit = Number(card.totalLimit);
  const extraSpent = Number(previousSpent == null
    ? card.previousSpent == null ? 0 : card.previousSpent
    : previousSpent);
  if (!Number.isFinite(extraSpent) || extraSpent < 0) {
    throw new RangeError('O gasto anterior do cartão deve ser um valor não negativo.');
  }
  const used = Math.round((
    installments.reduce((sum, installment) => sum + installment.amount, 0) + extraSpent
  ) * 100) / 100;
  const percent = totalLimit > 0 ? used / totalLimit * 100 : 0;
  return {
    used,
    available: Math.max(0, Math.round((totalLimit - used) * 100) / 100),
    percent,
    alert: percent >= 100 ? 'full' : percent >= 80 ? 'warning' : 'normal'
  };
}

function getNextCreditCardDueDate(card, fromDate = new Date()) {
  const dueDay = Number(card && card.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 ||
    !(fromDate instanceof Date) || Number.isNaN(fromDate.getTime())) return null;

  const today = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let offset = 0; offset < 2; offset++) {
    const year = today.getFullYear();
    const month = today.getMonth() + offset;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dueDate = new Date(year, month, Math.min(dueDay, daysInMonth));
    if (dueDate < today) continue;
    return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
  }
  return null;
}

function validateBackupText(text) {
  if (typeof text !== 'string') return { error: 'O conteúdo do backup deve ser texto.' };
  if (new Blob([text]).size > 5 * 1024 * 1024) return { error: 'O backup excede o limite de 5 MB.' };

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { error: 'O arquivo não contém um JSON válido.' };
  }
  if (!parsed || typeof parsed !== 'object' ||
    typeof parsed.version !== 'string' || !parsed.version.trim()) {
    return { error: 'O backup precisa conter uma versão textual.' };
  }

  const recordError = (kind, item, message) => {
    const labels = {
      entries: 'Lançamento',
      templates: 'Gasto fixo',
      goals: 'Meta',
      accounts: 'Conta',
      creditCards: 'Cartão',
      creditCardPurchases: 'Compra no cartão'
    };
    const id = item && item.id != null ? String(item.id) : '(sem ID)';
    return `${labels[kind]} ${id}: ${message}`;
  };
  const isRecord = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const textLength = value => Array.from(value).length;
  const validText = (value, max) =>
    typeof value === 'string' && textLength(value) >= 1 && textLength(value) <= max;
  const validAmount = value =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_ACCOUNT_BALANCE;
  const validMonth = isValidCivilMonth;
  const validDate = isValidCivilDate;
  const validateBooleanFields = (kind, item, fields) => {
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(item, field) && typeof item[field] !== 'boolean') {
        return recordError(kind, item, `${field} precisa ser booleano.`);
      }
    }
    return null;
  };

  const collections = ['entries', 'templates', 'goals'];
  for (const key of collections) {
    if (!Array.isArray(parsed[key])) return { error: `A coleção ${key} precisa ser uma lista.` };
    if (parsed[key].length > 5000) return { error: `A coleção ${key} excede o limite de 5.000 itens.` };
  }

  const entries = parsed.entries.map(item => isRecord(item) ? { ...item } : item);
  const templates = parsed.templates.map(item => isRecord(item) ? { ...item } : item);
  const goals = parsed.goals.map(item => isRecord(item) ? { ...item } : item);
  const accounts = parsed.accounts === undefined
    ? []
    : Array.isArray(parsed.accounts) ? parsed.accounts.map(item => isRecord(item) ? { ...item } : item) : parsed.accounts;
  if (!Array.isArray(accounts)) return { error: 'A coleção accounts precisa ser uma lista.' };
  if (accounts.length > 5000) return { error: 'A coleção accounts excede o limite de 5.000 itens.' };
  const creditCards = parsed.creditCards === undefined
    ? []
    : Array.isArray(parsed.creditCards)
      ? parsed.creditCards.map(item => isRecord(item) ? { ...item } : item)
      : parsed.creditCards;
  if (!Array.isArray(creditCards)) return { error: 'A coleção creditCards precisa ser uma lista.' };
  if (creditCards.length > 5000) return { error: 'A coleção creditCards excede o limite de 5.000 itens.' };
  const creditCardPurchases = parsed.creditCardPurchases === undefined
    ? []
    : Array.isArray(parsed.creditCardPurchases)
      ? parsed.creditCardPurchases.map(item => isRecord(item) ? { ...item } : item)
      : parsed.creditCardPurchases;
  if (!Array.isArray(creditCardPurchases)) {
    return { error: 'A coleção creditCardPurchases precisa ser uma lista.' };
  }
  if (creditCardPurchases.length > 5000) {
    return { error: 'A coleção creditCardPurchases excede o limite de 5.000 itens.' };
  }
  const fixedImportRules = parsed.fixedImportRules === undefined ? [] : parsed.fixedImportRules;
  if (!Array.isArray(fixedImportRules) || fixedImportRules.length > 5000 ||
    fixedImportRules.some(rule => typeof rule !== 'string' || !rule.trim() || rule.length > 300)) {
    return { error: 'A coleção fixedImportRules precisa conter regras textuais válidas.' };
  }
  const seenIds = new Set();
  const checkId = (kind, item) => {
    if (item.id == null || item.id === '') return null;
    const rawId = String(item.id);
    const key = kind === 'goals' ? rawId.replace(/^goal-/, '') : rawId;
    if (seenIds.has(key)) return recordError(kind, item, 'ID duplicado no backup.');
    seenIds.add(key);
    return null;
  };
  const accountIds = new Map();
  for (const [index, account] of accounts.entries()) {
    if (!isRecord(account)) return { error: recordError('accounts', account, 'registro inválido.') };
    const duplicateError = checkId('accounts', account);
    if (duplicateError) return { error: duplicateError };
    if (!validText(account.name, 100) || !account.name.trim()) {
      return { error: recordError('accounts', account, 'o nome deve ter de 1 a 100 caracteres.') };
    }
    if (account.institution != null &&
      (typeof account.institution !== 'string' || textLength(account.institution) > 100)) {
      return { error: recordError('accounts', account, 'a instituição deve ter até 100 caracteres.') };
    }
    if (!['PF', 'PJ'].includes(account.type)) {
      return { error: recordError('accounts', account, 'o tipo deve ser PF ou PJ.') };
    }
    if (account.initialBalance != null &&
      (typeof account.initialBalance !== 'number' || !Number.isFinite(account.initialBalance) ||
        Math.abs(account.initialBalance) > MAX_ACCOUNT_BALANCE)) {
      return { error: recordError('accounts', account, 'o saldo inicial deve ser um número finito dentro do limite permitido.') };
    }
    if (account.balanceDate != null && account.balanceDate !== '' && !isValidCivilDate(account.balanceDate)) {
      return { error: recordError('accounts', account, 'a data do saldo inicial deve ser válida.') };
    }
    const originalId = account.id;
    account.id = isUuid(originalId) ? originalId : crypto.randomUUID();
    account.initialBalance = account.initialBalance == null ? 0 : account.initialBalance;
    account.balanceDate = account.balanceDate || null;
    account.name = account.name.trim();
    account.institution = typeof account.institution === 'string' && account.institution.trim()
      ? account.institution.trim()
      : null;
    if (originalId != null) accountIds.set(String(originalId), account.id);
  }

  const creditCardIds = new Map();
  for (const card of creditCards) {
    if (!isRecord(card)) return { error: recordError('creditCards', card, 'registro inválido.') };
    const duplicateError = checkId('creditCards', card);
    if (duplicateError) return { error: duplicateError };
    if (!validText(card.name, 100) || !card.name.trim()) {
      return { error: recordError('creditCards', card, 'o nome deve ter de 1 a 100 caracteres.') };
    }
    if (typeof card.totalLimit !== 'number' || !Number.isFinite(card.totalLimit) ||
      card.totalLimit <= 0 || card.totalLimit > MAX_CREDIT_CARD_LIMIT) {
      return { error: recordError('creditCards', card, 'o limite total deve ser positivo e válido.') };
    }
    if (card.brand != null && !CREDIT_CARD_BRANDS.includes(card.brand)) {
      return { error: recordError('creditCards', card, 'a bandeira não é válida.') };
    }
    if (card.issuerBank != null && !CREDIT_CARD_ISSUERS.includes(card.issuerBank)) {
      return { error: recordError('creditCards', card, 'o banco emissor não é válido.') };
    }
    if (card.lastFour != null && card.lastFour !== '' &&
      (typeof card.lastFour !== 'string' || !/^\d{4}$/.test(card.lastFour))) {
      return { error: recordError('creditCards', card, 'o final deve conter quatro dígitos.') };
    }
    if (card.customColor != null &&
      (typeof card.customColor !== 'string' || !CREDIT_CARD_COLOR_PATTERN.test(card.customColor))) {
      return { error: recordError('creditCards', card, 'a cor personalizada deve ser hexadecimal válida.') };
    }
    if (!Number.isInteger(card.closingDay) || card.closingDay < 1 || card.closingDay > 31 ||
      !Number.isInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) {
      return { error: recordError('creditCards', card, 'os dias de fechamento e vencimento devem estar entre 1 e 31.') };
    }
    const originalId = card.id;
    card.id = isUuid(originalId) ? originalId : crypto.randomUUID();
    card.name = card.name.trim();
    card.totalLimit = Math.round(card.totalLimit * 100) / 100;
    card.brand = card.brand || 'Outra';
    card.issuerBank = card.issuerBank || 'Outro';
    card.lastFour = card.lastFour || null;
    card.customColor = card.issuerBank === 'Outro'
      ? card.customColor || DEFAULT_CREDIT_CARD_COLOR
      : null;
    card.accountId = card.accountId == null || card.accountId === ''
      ? null
      : accountIds.get(String(card.accountId)) || null;
    if (originalId != null) creditCardIds.set(String(originalId), card.id);
  }
  for (const purchase of creditCardPurchases) {
    if (!isRecord(purchase)) {
      return { error: recordError('creditCardPurchases', purchase, 'registro inválido.') };
    }
    const duplicateError = checkId('creditCardPurchases', purchase);
    if (duplicateError) return { error: duplicateError };
    if (!validText(purchase.desc, 300) || !validText(purchase.category, 100)) {
      return { error: recordError('creditCardPurchases', purchase, 'descrição e categoria devem ser válidas.') };
    }
    if (typeof purchase.amount !== 'number' || !Number.isFinite(purchase.amount) ||
      purchase.amount <= 0 || purchase.amount > MAX_ACCOUNT_BALANCE) {
      return { error: recordError('creditCardPurchases', purchase, 'o valor da compra deve ser positivo e válido.') };
    }
    if (!validDate(purchase.purchaseDate)) {
      return { error: recordError('creditCardPurchases', purchase, 'a data da compra deve ser válida.') };
    }
    if (!Number.isInteger(purchase.installmentCount) || purchase.installmentCount < 1 ||
      purchase.installmentCount > 24) {
      return { error: recordError('creditCardPurchases', purchase, 'as parcelas devem estar entre 1 e 24.') };
    }
    if (!Number.isInteger(purchase.closingDay) || purchase.closingDay < 1 || purchase.closingDay > 31 ||
      !Number.isInteger(purchase.dueDay) || purchase.dueDay < 1 || purchase.dueDay > 31) {
      return { error: recordError('creditCardPurchases', purchase, 'os dias de fechamento e vencimento devem estar entre 1 e 31.') };
    }
    if (!validText(purchase.cardName, 100)) {
      return { error: recordError('creditCardPurchases', purchase, 'o nome de referência do cartão é inválido.') };
    }
    const paidInstallments = purchase.paidInstallments === undefined ? [] : purchase.paidInstallments;
    if (!Array.isArray(paidInstallments) || paidInstallments.some(number =>
      !Number.isInteger(number) || number < 1 || number > purchase.installmentCount
    ) || new Set(paidInstallments).size !== paidInstallments.length) {
      return { error: recordError('creditCardPurchases', purchase, 'as parcelas pagas precisam ser números únicos entre 1 e a quantidade total.') };
    }
    const paidDates = purchase.paidDates === undefined ? {} : purchase.paidDates;
    if (!isRecord(paidDates) || Object.entries(paidDates).some(([number, date]) =>
      !/^\d+$/.test(number) || Number(number) < 1 || Number(number) > purchase.installmentCount ||
      !paidInstallments.includes(Number(number)) || !validDate(date)
    )) {
      return { error: recordError('creditCardPurchases', purchase, 'as datas de pagamento das parcelas são inválidas.') };
    }
    const originalId = purchase.id;
    purchase.id = isUuid(originalId) ? originalId : crypto.randomUUID();
    purchase.amount = Math.round(purchase.amount * 100) / 100;
    purchase.cardId = purchase.cardId == null
      ? null
      : creditCardIds.get(String(purchase.cardId)) || null;
    purchase.accountId = purchase.accountId == null
      ? null
      : accountIds.get(String(purchase.accountId)) || null;
    purchase.cardName = purchase.cardName.trim();
    purchase.desc = purchase.desc.trim();
    purchase.category = purchase.category.trim();
    purchase.paidInstallments = paidInstallments;
    purchase.paidDates = paidDates;
  }

  for (const [index, item] of entries.entries()) {
    if (!isRecord(item)) return { error: recordError('entries', item, 'registro inválido.') };
    const duplicateError = checkId('entries', item);
    if (duplicateError) return { error: duplicateError };
    const booleanError = validateBooleanFields('entries', item, ['paid', 'isDebt', 'active']);
    if (booleanError) return { error: booleanError };
    if (!validAmount(item.amount)) {
      return { error: recordError('entries', item, 'amount deve ser um número finito entre 0 e 9999999999.99.') };
    }
    if (!validText(item.desc, 300)) {
      return { error: recordError('entries', item, 'description deve ter de 1 a 300 caracteres.') };
    }
    if (!validText(item.category, 100)) {
      return { error: recordError('entries', item, 'category deve ter de 1 a 100 caracteres.') };
    }
    if (!['income', 'variable', 'fixed', 'debt'].includes(item.type)) {
      return { error: recordError('entries', item, 'tipo de lançamento inválido.') };
    }
    if (!validDate(item.date)) {
      return { error: recordError('entries', item, 'date deve ser uma data civil válida no formato AAAA-MM-DD.') };
    }
    if (item.paid === undefined) item.paid = true;
    if (item.isDebt === undefined) item.isDebt = false;
    if (item.active === undefined) item.active = true;
    item.month = item.date.substring(0, 7);
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
    if (item.accountId != null) {
      item.accountId = accountIds.get(String(item.accountId)) || null;
    }
  }
  for (const [index, item] of templates.entries()) {
    if (!isRecord(item)) return { error: recordError('templates', item, 'registro inválido.') };
    const duplicateError = checkId('templates', item);
    if (duplicateError) return { error: duplicateError };
    const booleanError = validateBooleanFields('templates', item, ['isDebt', 'active']);
    if (booleanError) return { error: booleanError };
    if (!validAmount(item.amount)) {
      return { error: recordError('templates', item, 'amount deve ser um número finito entre 0 e 9999999999.99.') };
    }
    if (!validText(item.desc, 300)) {
      return { error: recordError('templates', item, 'description deve ter de 1 a 300 caracteres.') };
    }
    if (!validText(item.category, 100)) {
      return { error: recordError('templates', item, 'category deve ter de 1 a 100 caracteres.') };
    }
    if (!['fixed', 'debt', 'variable'].includes(item.type === undefined ? 'fixed' : item.type)) {
      return { error: recordError('templates', item, 'tipo de template inválido.') };
    }
    if (item.type === undefined) item.type = 'fixed';
    if (!validMonth(item.startMonth)) {
      return { error: recordError('templates', item, 'startMonth deve ser um mês válido no formato AAAA-MM.') };
    }
    if (item.endMonth != null && !validMonth(item.endMonth)) {
      return { error: recordError('templates', item, 'endMonth deve ser um mês válido no formato AAAA-MM.') };
    }
    if (item.day != null && !/^(0[1-9]|[12]\d|3[01])$/.test(String(item.day))) {
      return { error: recordError('templates', item, 'day deve estar entre 01 e 31.') };
    }
    const paidMonths = item.paidMonths === undefined ? {} : item.paidMonths;
    if (!isRecord(paidMonths)) {
      return { error: recordError('templates', item, 'paidMonths deve ser um objeto de meses e valores booleanos.') };
    }
    for (const [month, paid] of Object.entries(paidMonths)) {
      if (!validMonth(month) || typeof paid !== 'boolean') {
        return { error: recordError('templates', item, 'paidMonths deve conter meses AAAA-MM válidos e valores booleanos.') };
      }
      if (month < item.startMonth ||
        (item.endMonth && month > item.endMonth)) {
        return { error: recordError('templates', item, `paidMonths contém ${month} fora do período do template.`) };
      }
    }
    item.paidMonths = paidMonths;
    if (item.isDebt === undefined) {
      item.isDebt = item.type === 'debt' || Boolean(item.endMonth) ||
        item.category === 'Empréstimo' || item.category === 'Parcelamento';
    }
    if (item.active === undefined) item.active = true;
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
    if (item.accountId != null) {
      item.accountId = accountIds.get(String(item.accountId)) || null;
    }
  }
  const goalCategories = new Set();
  for (const [index, goal] of goals.entries()) {
    if (!isRecord(goal)) return { error: recordError('goals', goal, 'registro inválido.') };
    const duplicateError = checkId('goals', goal);
    if (duplicateError) return { error: duplicateError };
    if (!validText(goal.category, 100) || !goal.category.trim() ||
      typeof goal.limit !== 'number' || !Number.isFinite(goal.limit) ||
      goal.limit < 0 || goal.limit > MAX_ACCOUNT_BALANCE) {
      return { error: recordError('goals', goal, 'category deve ter de 1 a 100 caracteres e limit deve ser um número válido.') };
    }
    goal.category = goal.category.trim();
    if (goalCategories.has(goal.category)) {
      return { error: recordError('goals', goal, 'categoria duplicada no backup.') };
    }
    goalCategories.add(goal.category);
    const goalId = String(goal.id || '').replace(/^goal-/, '');
    goal.id = isUuid(goalId) ? goalId : crypto.randomUUID();
  }

  return {
    version: parsed.version,
    exportDate: typeof parsed.exportDate === 'string' ? parsed.exportDate : null,
    fixedImportRules: [...new Set(fixedImportRules.map(rule => rule.trim()))],
    entries,
    templates,
    goals,
    accounts,
    creditCards,
    creditCardPurchases
  };
}

function mergeBackupData(current, incoming, mode) {
  const clone = value => JSON.parse(JSON.stringify(value));
  if (mode === 'replace') return clone(incoming);
  if (mode !== 'merge') throw new TypeError('Modo de restauração inválido.');

  const mergeById = (existing, added, normalizeGoalId = false) => {
    const keyOf = item => {
      const id = String(item.id);
      return normalizeGoalId ? id.replace(/^goal-/, '') : id;
    };
    const merged = new Map(existing.map(item => [keyOf(item), clone(item)]));
    added.forEach(item => merged.set(keyOf(item), clone(item)));
    return [...merged.values()];
  };
  return {
    entries: mergeById(current.entries, incoming.entries),
    templates: mergeById(current.templates, incoming.templates),
    goals: mergeById(current.goals, incoming.goals, true),
    accounts: mergeById(current.accounts || [], incoming.accounts || []),
    creditCards: mergeById(current.creditCards || [], incoming.creditCards || []),
    creditCardPurchases: mergeById(current.creditCardPurchases || [], incoming.creditCardPurchases || []),
    fixedImportRules: [...new Set([...(current.fixedImportRules || []), ...(incoming.fixedImportRules || [])])]
  };
}

function validateAccount(account) {
  if (!account || typeof account !== 'object') return 'Registro inválido.';
  if (typeof account.name !== 'string' || !account.name.trim() || account.name.trim().length > 100) {
    return 'O nome deve ter de 1 a 100 caracteres.';
  }
  if (account.institution != null &&
    (typeof account.institution !== 'string' || account.institution.length > 100)) {
    return 'A instituição deve ter até 100 caracteres.';
  }
  if (!['PF', 'PJ'].includes(account.type)) return 'O tipo deve ser PF ou PJ.';
  const balance = account.initialBalance == null ? 0 : account.initialBalance;
  if (typeof balance === 'boolean' || balance === '' || !Number.isFinite(Number(balance)) ||
    Math.abs(Number(balance)) > MAX_ACCOUNT_BALANCE) {
    return 'O saldo inicial deve ser um valor numérico válido.';
  }
  if (account.balanceDate != null && account.balanceDate !== '' && !isValidCivilDate(account.balanceDate)) {
    return 'A data do saldo inicial deve ser uma data válida.';
  }
  return null;
}

window.GastoProBackupHelpers = {
  validate: validateBackupText,
  merge: mergeBackupData
};

window.GastoProCreditCardHelpers = {
  getInstallments: getCreditCardInstallments,
  calculateLimitUsage: calculateCreditCardLimitUsage,
  getNextDueDate: getNextCreditCardDueDate
};

function calculatePendingOutflows(items, accountFilter = 'all', accounts = []) {
  const accountTypes = new Map((Array.isArray(accounts) ? accounts : [])
    .map(account => [account.id, account.type]));
  const accountId = typeof accountFilter === 'string' && accountFilter.startsWith('account:')
    ? accountFilter.slice('account:'.length)
    : null;
  const total = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!item || item.paid === true || !['fixed', 'variable', 'debt'].includes(item.type) ||
      (item.type === 'fixed' && item.active === false)) return sum;
    if (accountFilter === 'PF' || accountFilter === 'PJ') {
      if (!item.accountId || accountTypes.get(item.accountId) !== accountFilter) return sum;
    } else if (accountId) {
      if (item.accountId !== accountId) return sum;
    } else if (accountFilter !== 'all') {
      return sum;
    }
    const amount = Number(item.amount);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
  return Math.round(total * 100) / 100;
}

const FinanceData = {

  getSyncMetadata() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_SYNC_METADATA) || '{}');
      return { records: {}, deleted: {}, clockOffsetMs: 0, ...stored };
    } catch (error) {
      return { records: {}, deleted: {}, clockOffsetMs: 0 };
    }
  },

  saveSyncMetadata(metadata) {
    localStorage.setItem(STORAGE_SYNC_METADATA, JSON.stringify(metadata));
  },

  saveCloudSyncVersions(kind, versions) {
    const metadata = this.getSyncMetadata();
    metadata.records[kind] ||= {};
    Object.entries(versions || {}).forEach(([id, updatedAt]) => {
      if (!updatedAt) return;
      metadata.records[kind][id] = {
        updatedAt,
        editedAt: metadata.records[kind][id]?.editedAt || updatedAt
      };
    });
    this.saveSyncMetadata(metadata);
  },

  isCloudSyncRecordStale(kind, key, version) {
    const metadata = this.getSyncMetadata();
    const knownVersion = metadata.records[kind]?.[key]?.updatedAt ||
      metadata.deleted[kind]?.[key]?.updatedAt;
    return Boolean(version && knownVersion && version < knownVersion);
  },

  getClientEditedAt(kind, id, deleted = false) {
    const metadata = this.getSyncMetadata();
    const edit = metadata[deleted ? 'deleted' : 'records']?.[kind]?.[id]?.editedAt;
    const timestamp = Date.parse(edit || '');
    return new Date((Number.isFinite(timestamp) ? timestamp : Date.now()) +
      (Number(metadata.clockOffsetMs) || 0)).toISOString();
  },

  clearUserData() {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith('gastopro_') &&
        key !== STORAGE_TUTORIAL_SEEN && key !== STORAGE_ACCOUNT_SETUP_SEEN &&
        key !== 'gastopro_theme' && key !== 'gastopro_notification_preferences_v1' &&
        key !== 'gastopro_usage_telemetry_enabled_v1' &&
        !key.startsWith(STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT + ':') &&
        !key.startsWith('gastopro_payment_method_preference_v1:') &&
        !key.startsWith('gastopro_paid_import_review_v1:')) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  getPendingSync() {
    try {
      const stored = localStorage.getItem(STORAGE_PENDING_SYNC);
      return stored
        ? {
          full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
          goals: [], deletedGoals: [], accounts: [], deletedAccounts: [],
          creditCards: [], deletedCreditCards: [],
          creditCardPurchases: [], deletedCreditCardPurchases: [], fixedImportRules: false,
          profile: false, transactionalOperations: [],
          ...JSON.parse(stored)
        }
        : {
          full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
          goals: [], deletedGoals: [], accounts: [], deletedAccounts: [],
          creditCards: [], deletedCreditCards: [],
          creditCardPurchases: [], deletedCreditCardPurchases: [],
          fixedImportRules: false, profile: false, transactionalOperations: []
        };
    } catch (e) {
      console.error('[GastoPro] Erro ao ler alterações pendentes:', e);
      return {
        full: true, entries: [], templates: [], deletedEntries: [], deletedTemplates: [],
        goals: [], deletedGoals: [], accounts: [], deletedAccounts: [],
        creditCards: [], deletedCreditCards: [],
        creditCardPurchases: [], deletedCreditCardPurchases: [],
        fixedImportRules: true, profile: true, transactionalOperations: []
      };
    }
  },

  savePendingSync(pending) {
    localStorage.setItem(STORAGE_PENDING_SYNC, JSON.stringify(pending));
  },

  hasPendingSync() {
    const pending = this.getPendingSync();
    return Boolean(
      pending.full ||
      pending.entries.length ||
      pending.templates.length ||
      pending.deletedEntries.length ||
      pending.deletedTemplates.length ||
      pending.goals.length ||
      pending.deletedGoals.length ||
      pending.accounts.length ||
      pending.deletedAccounts.length ||
      pending.creditCards.length ||
      pending.deletedCreditCards.length ||
      pending.creditCardPurchases.length ||
      pending.deletedCreditCardPurchases.length ||
      pending.fixedImportRules ||
      pending.profile ||
      pending.transactionalOperations.length
    );
  },

  getActiveUserId() {
    return localStorage.getItem(STORAGE_LAST_UID);
  },

  markFullSync() {
    const pending = this.getPendingSync();
    pending.full = true;
    this.savePendingSync(pending);
  },

  queueLocalChanges(kind, previousItems, nextItems) {
    const pending = this.getPendingSync();
    const metadata = this.getSyncMetadata();
    metadata.records[kind] ||= {};
    metadata.deleted[kind] ||= {};
    const pendingIds = pending[kind];
    const deletedIds = pending[kind === 'entries' ? 'deletedEntries' :
      kind === 'templates' ? 'deletedTemplates' :
        kind === 'creditCardPurchases' ? 'deletedCreditCardPurchases' :
        kind === 'creditCards' ? 'deletedCreditCards' : 'deletedAccounts'];
    const previousById = new Map(previousItems.map(item => [item.id, item]));
    const nextById = new Map(nextItems.map(item => [item.id, item]));

    nextItems.forEach(item => {
      if (!isUuid(item.id)) return;
      const previous = previousById.get(item.id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) {
        if (!pendingIds.includes(item.id)) pendingIds.push(item.id);
        const known = metadata.records[kind][item.id];
        metadata.records[kind][item.id] = {
          updatedAt: known ? known.updatedAt : null,
          editedAt: new Date().toISOString()
        };
        delete metadata.deleted[kind][item.id];
        const deletedIndex = deletedIds.indexOf(item.id);
        if (deletedIndex !== -1) deletedIds.splice(deletedIndex, 1);
      }
    });

    previousItems.forEach(item => {
      if (isUuid(item.id) && !nextById.has(item.id) && !deletedIds.includes(item.id)) {
        deletedIds.push(item.id);
        const known = metadata.records[kind][item.id];
        metadata.deleted[kind][item.id] = {
          updatedAt: known ? known.updatedAt : null,
          editedAt: new Date().toISOString()
        };
        delete metadata.records[kind][item.id];
        const pendingIndex = pendingIds.indexOf(item.id);
        if (pendingIndex !== -1) pendingIds.splice(pendingIndex, 1);
      }
    });

    this.savePendingSync(pending);
    this.saveSyncMetadata(metadata);
  },

  queueGoalChanges(previousGoals, nextGoals) {
    const pending = this.getPendingSync();
    const metadata = this.getSyncMetadata();
    metadata.records.goals ||= {};
    metadata.deleted.goals ||= {};
    const previousByCategory = new Map(previousGoals.map(goal => [goal.category, goal]));
    const nextByCategory = new Map(nextGoals.map(goal => [goal.category, goal]));

    nextGoals.forEach(goal => {
      const previous = previousByCategory.get(goal.category);
      if (!previous || Number(previous.limit) !== Number(goal.limit)) {
        if (!pending.goals.includes(goal.category)) pending.goals.push(goal.category);
        const known = metadata.records.goals[goal.category];
        metadata.records.goals[goal.category] = {
          updatedAt: known ? known.updatedAt : null,
          editedAt: new Date().toISOString()
        };
        delete metadata.deleted.goals[goal.category];
        const deletedIndex = pending.deletedGoals.indexOf(goal.category);
        if (deletedIndex !== -1) pending.deletedGoals.splice(deletedIndex, 1);
      }
    });

    previousGoals.forEach(goal => {
      if (!nextByCategory.has(goal.category) && !pending.deletedGoals.includes(goal.category)) {
        pending.deletedGoals.push(goal.category);
        const known = metadata.records.goals[goal.category];
        metadata.deleted.goals[goal.category] = {
          updatedAt: known ? known.updatedAt : null,
          editedAt: new Date().toISOString()
        };
        delete metadata.records.goals[goal.category];
        const pendingIndex = pending.goals.indexOf(goal.category);
        if (pendingIndex !== -1) pending.goals.splice(pendingIndex, 1);
      }
    });

    this.savePendingSync(pending);
    this.saveSyncMetadata(metadata);
  },

  activateUser(userId) {
    if (!userId) return false;
    const previousUserId = localStorage.getItem(STORAGE_LAST_UID);
    if (previousUserId === userId) return false;

    if (previousUserId) {
      if (this.hasPendingSync()) return false;
      this.clearUserData();
    } else {
      this.markFullSync();
      localStorage.removeItem(STORAGE_GOALS);
    }
    localStorage.setItem(STORAGE_LAST_UID, userId);
    return true;
  },

  async prepareLocalDataForSync(userId) {
    if (!userId || localStorage.getItem(STORAGE_LAST_UID) !== userId) {
      return { success: false, error: new Error('O usuário local não corresponde à sessão atual.') };
    }

    const entries = this.getEntries();
    const templates = this.getTemplates();
    const goals = this.getGoals();
    const accounts = this.getAccounts();
    const localProfile = this.getProfile();
    const migratedEntries = entries.map(item => isUuid(item.id) ? item : { ...item, id: crypto.randomUUID() });
    const migratedTemplates = templates.map(item => isUuid(item.id) ? item : { ...item, id: crypto.randomUUID() });

    if (migratedEntries.some((item, index) => item.id !== entries[index].id)) {
      localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(migratedEntries));
      this.queueLocalChanges('entries', entries, migratedEntries);
    }
    if (migratedTemplates.some((item, index) => item.id !== templates[index].id)) {
      localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(migratedTemplates));
      this.queueLocalChanges('templates', templates, migratedTemplates);
    }
    const migratedAccounts = accounts.map(item => isUuid(item.id) ? item : { ...item, id: crypto.randomUUID() });
    if (migratedAccounts.some((item, index) => item.id !== accounts[index].id)) {
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(migratedAccounts));
      this.queueLocalChanges('accounts', accounts, migratedAccounts);
    }

    return this.flushPendingSync(userId);
  },

  async syncAllToCloud(userId) {
    if (!userId || localStorage.getItem(STORAGE_LAST_UID) !== userId) {
      return { success: false, error: new Error('O usuário local não corresponde à sessão atual.') };
    }
    const prepared = await this.prepareLocalDataForSync(userId);
    if (!prepared.success) return prepared;
    this.markFullSync();
    return this.flushPendingSync(userId);
  },

  async reconcileCloudBeforeSync(userId) {
    const auth = window.SupabaseAuth;
    if (!auth || !auth.client || typeof auth.fetchCloudSyncState !== 'function' ||
      (typeof auth.isSyncServerReady === 'function' && !auth.isSyncServerReady())) {
      return { success: true, skipped: true };
    }
    const startedAt = Date.now();
    const serverTime = await auth.getSyncServerTime();
    const finishedAt = Date.now();
    const serverTimeMs = Date.parse(serverTime || '');
    if (!Number.isFinite(serverTimeMs)) {
      return { success: false, error: new Error('Não foi possível medir o horário do servidor.') };
    }
    const syncMetadata = this.getSyncMetadata();
    syncMetadata.clockOffsetMs = serverTimeMs - ((startedAt + finishedAt) / 2);
    this.saveSyncMetadata(syncMetadata);

    const [entries, templates, goals, accounts, rules, cards, purchases, profileResult, syncState] =
      await Promise.all([
        auth.fetchCloudEntries(userId),
        auth.fetchCloudTemplates(userId),
        auth.fetchCloudGoals(userId),
        auth.fetchCloudAccounts(userId),
        auth.fetchCloudFixedImportRules(userId),
        auth.fetchCloudCreditCards(userId),
        auth.fetchCloudCreditCardPurchases(userId),
        auth.fetchCloudProfile(userId),
        auth.fetchCloudSyncState(userId)
      ]);
    if (!profileResult || !profileResult.success || !Array.isArray(entries) || !Array.isArray(templates) || !Array.isArray(goals) ||
      !Array.isArray(accounts) || !Array.isArray(rules) || !Array.isArray(cards) ||
      !Array.isArray(purchases) || !syncState) {
      return { success: false, error: new Error('A leitura da nuvem não foi concluída.') };
    }
    if (!this.mergeCloudData(userId, entries, templates, false, goals, accounts, rules,
      cards, purchases, syncState.tombstones, syncState.versions)) {
      return { success: false, error: new Error('Não foi possível reconciliar os dados da nuvem.') };
    }
    if (profileResult && profileResult.success && profileResult.profile) {
      this.mergeCloudProfile(profileResult.profile);
    } else if (profileResult && profileResult.success && !profileResult.profile) {
      const metadata = this.getSyncMetadata();
      if (metadata.records.profiles?.[userId]?.updatedAt) {
        const pending = this.getPendingSync();
        pending.profile = false;
        this.savePendingSync(pending);
        delete metadata.records.profiles[userId];
        this.saveSyncMetadata(metadata);
        this.saveProfile({ ...this.getProfile(), name: '', avatar: null });
        if (typeof showToast === 'function') showToast('Um item foi atualizado em outro aparelho');
      }
    }
    return { success: true };
  },

  applyCloudSyncRecord(kind, item, version, deletedAt, userId) {
    if (!userId || localStorage.getItem(STORAGE_LAST_UID) !== userId) return false;
    const key = kind === 'goals' ? item && item.category :
      kind === 'profiles' || kind === 'fixedImportRules' ? userId : item && item.id;
    if (!key) return false;
    const metadata = this.getSyncMetadata();
    const known = metadata.records[kind]?.[key];
    if (this.isCloudSyncRecordStale(kind, key, version)) {
      return { applied: false, stale: true, conflict: false };
    }

    if (kind === 'profiles') {
      const pending = this.getPendingSync();
      const localTime = Date.parse(known && known.editedAt || '');
      const remoteTime = Date.parse(version || deletedAt || '');
      const remoteChanged = Boolean(deletedAt || version && (!known || !known.updatedAt || version > known.updatedAt));
      const conflict = Boolean(pending.profile && remoteChanged || deletedAt && known && known.updatedAt);
      const localWins = pending.profile && Number.isFinite(localTime) && Number.isFinite(remoteTime) &&
        localTime + (Number(metadata.clockOffsetMs) || 0) > remoteTime + 2000;
      metadata.records.profiles ||= {};
      if (pending.profile && !remoteChanged) return { applied: false, stale: false, conflict: false };
      if (localWins) {
        metadata.records.profiles[key] = { updatedAt: version || deletedAt, editedAt: known.editedAt };
        this.saveSyncMetadata(metadata);
      } else if (deletedAt) {
        pending.profile = false;
        this.savePendingSync(pending);
        delete metadata.records.profiles[key];
        this.saveSyncMetadata(metadata);
        this.saveProfile({ ...this.getProfile(), name: '', avatar: null });
      } else if (item) {
        pending.profile = false;
        this.savePendingSync(pending);
        metadata.records.profiles[key] = { updatedAt: version, editedAt: version };
        this.saveSyncMetadata(metadata);
        this.saveProfile({
          ...this.getProfile(),
          name: item.name || '',
          avatar: item.avatar || null
        });
      }
      if (conflict && typeof showToast === 'function') showToast('Um item foi atualizado em outro aparelho');
      return { applied: !localWins, stale: false, conflict };
    }

    const cloudEntries = kind === 'entries' ? (deletedAt ? [] : [item]) : null;
    const cloudTemplates = kind === 'templates' ? (deletedAt ? [] : [item]) : null;
    const cloudGoals = kind === 'goals' ? (deletedAt ? [] : [item]) : null;
    const cloudAccounts = kind === 'accounts' ? (deletedAt ? [] : [item]) : null;
    const cloudCreditCards = kind === 'creditCards' ? (deletedAt ? [] : [item]) : null;
    const cloudCreditCardPurchases = kind === 'creditCardPurchases' ? (deletedAt ? [] : [item]) : null;
    const cloudFixedImportRules = kind === 'fixedImportRules'
      ? deletedAt ? [] : [...new Set(item.rules || [])]
      : null;
    const cloudVersions = { [kind]: { [key]: version } };
    const cloudTombstones = deletedAt ? { [kind]: { [key]: version || deletedAt } } : {};
    const conflict = this.reconcileSyncVersions(userId, cloudEntries, cloudTemplates, cloudGoals, cloudAccounts,
      cloudCreditCards, cloudCreditCardPurchases, cloudTombstones, cloudVersions, cloudFixedImportRules);
    return { applied: true, stale: false, conflict: Boolean(conflict) };
  },

  async flushPendingSync(userId) {
    const profile = this.getProfile();
    const targetUserId = userId || (profile && profile.userId);
    if (!targetUserId || !window.SupabaseAuth) return { success: true, skipped: true };

    const flush = async () => {
      if (localStorage.getItem(STORAGE_LAST_UID) !== targetUserId) {
        return { success: false, error: new Error('O usuário local não corresponde à sessão atual.') };
      }

      const reconciliation = await this.reconcileCloudBeforeSync(targetUserId);
      if (!reconciliation.success) return reconciliation;

      const transactionalSync = await this.flushTransactionalOperations(targetUserId);
      if (!transactionalSync.success) return transactionalSync;

      const pending = this.getPendingSync();
      const fullSync = pending.full;
      const entries = this.getEntries();
      const templates = this.getTemplates();
      const goals = this.getGoals();
      const accounts = this.getAccounts();
      const creditCards = this.getCreditCards();
      const creditCardPurchases = this.getCreditCardPurchases();
      const fixedImportRules = this.getFixedImportRules();
      const localProfile = this.getProfile();
      const entriesToSave = fullSync
        ? entries.filter(item => !transactionalSync.synced.entries.includes(item.id))
        : entries.filter(item => pending.entries.includes(item.id));
      const templatesToSave = fullSync
        ? templates.filter(item => !transactionalSync.synced.templates.includes(item.id))
        : templates.filter(item => pending.templates.includes(item.id));
      const goalsToSave = fullSync
        ? goals
        : goals.filter(goal => pending.goals.includes(goal.category));

      const accountsToSave = fullSync
        ? accounts
        : accounts.filter(account => pending.accounts.includes(account.id));
      const creditCardsToSave = fullSync
        ? creditCards.filter(card => !transactionalSync.synced.creditCards.includes(card.id))
        : creditCards.filter(card => pending.creditCards.includes(card.id));
      const creditCardPurchasesToSave = fullSync
        ? creditCardPurchases.filter(purchase =>
          !transactionalSync.synced.creditCardPurchases.includes(purchase.id))
        : creditCardPurchases.filter(purchase => pending.creditCardPurchases.includes(purchase.id));
      const accountResult = accountsToSave.length
        ? await window.SupabaseAuth.saveCloudAccounts(accountsToSave, targetUserId)
        : { success: true };
      const creditCardsResult = creditCardsToSave.length
        ? typeof window.SupabaseAuth.saveCloudCreditCards === 'function'
          ? await window.SupabaseAuth.saveCloudCreditCards(creditCardsToSave, targetUserId)
          : { success: false, error: new Error('Sincronização de cartões não disponível.') }
        : { success: true };
      const creditCardPurchasesResult = creditCardPurchasesToSave.length
        ? typeof window.SupabaseAuth.saveCloudCreditCardPurchases === 'function'
          ? await window.SupabaseAuth.saveCloudCreditCardPurchases(creditCardPurchasesToSave, targetUserId)
          : { success: false, error: new Error('Sincronização de compras no cartão não disponível.') }
        : { success: true };
      const fixedImportRulesResult = fullSync || pending.fixedImportRules
        ? await window.SupabaseAuth.saveCloudFixedImportRules(fixedImportRules, targetUserId)
        : { success: true };
      const profileResult = pending.profile
        ? await window.SupabaseAuth.saveCloudProfile(localProfile, targetUserId)
        : { success: true };
      const results = await Promise.all([
        entriesToSave.length ? window.SupabaseAuth.saveCloudEntries(entriesToSave, targetUserId) : { success: true },
        templatesToSave.length ? window.SupabaseAuth.saveCloudTemplates(templatesToSave, targetUserId) : { success: true },
        pending.deletedEntries.length ? window.SupabaseAuth.deleteCloudEntries(pending.deletedEntries, targetUserId) : { success: true },
        pending.deletedTemplates.length ? window.SupabaseAuth.deleteCloudTemplates(pending.deletedTemplates, targetUserId) : { success: true },
        goalsToSave.length ? window.SupabaseAuth.saveCloudGoals(goalsToSave, targetUserId) : { success: true },
        pending.deletedGoals.length ? window.SupabaseAuth.deleteCloudGoals(pending.deletedGoals, targetUserId) : { success: true },
        pending.deletedAccounts.length ? window.SupabaseAuth.deleteCloudAccounts(pending.deletedAccounts, targetUserId) : { success: true },
        pending.deletedCreditCards.length && typeof window.SupabaseAuth.deleteCloudCreditCards === 'function'
          ? window.SupabaseAuth.deleteCloudCreditCards(pending.deletedCreditCards, targetUserId)
          : pending.deletedCreditCards.length
            ? { success: false, error: new Error('Exclusão de cartões não disponível.') }
            : { success: true },
        pending.deletedCreditCardPurchases.length && typeof window.SupabaseAuth.deleteCloudCreditCardPurchases === 'function'
          ? window.SupabaseAuth.deleteCloudCreditCardPurchases(pending.deletedCreditCardPurchases, targetUserId)
          : pending.deletedCreditCardPurchases.length
            ? { success: false, error: new Error('Exclusão de compras no cartão não disponível.') }
            : { success: true }
      ]);

      const latestPending = this.getPendingSync();
      const getFailedIds = (result, sentItems) => {
        if (result && result.success) return result.failedIds || [];
        return result && Array.isArray(result.failedIds) && result.failedIds.length
          ? result.failedIds
          : sentItems.map(item => item.id);
      };
      const getConflictIds = result => result && Array.isArray(result.conflictIds)
        ? result.conflictIds : [];
      const failedEntryIds = getFailedIds(results[0], entriesToSave);
      const failedTemplateIds = getFailedIds(results[1], templatesToSave);
      const failedGoalCategories = getFailedIds(
        results[4],
        goalsToSave.map(goal => ({ ...goal, id: goal.category }))
      );
      const failedAccountIds = getFailedIds(accountResult, accountsToSave);
      const failedCreditCardIds = getFailedIds(creditCardsResult, creditCardsToSave);
      const failedCreditCardPurchaseIds = getFailedIds(
        creditCardPurchasesResult, creditCardPurchasesToSave
      );
      const failedFixedImportRules = !fixedImportRulesResult || !fixedImportRulesResult.success;
      const failedProfile = !profileResult || !profileResult.success;
      const failedEntryDeletes = !results[2] || !results[2].success;
      const failedTemplateDeletes = !results[3] || !results[3].success;
      const failedGoalDeletes = !results[5] || !results[5].success;
      const failedAccountDeletes = !results[6] || !results[6].success;
      const failedCreditCardDeletes = !results[7] || !results[7].success;
      const failedCreditCardPurchaseDeletes = !results[8] || !results[8].success;
      const hasFailures = failedEntryIds.length > 0 || failedTemplateIds.length > 0 ||
        failedGoalCategories.length > 0 || failedAccountIds.length > 0 || failedCreditCardIds.length > 0 ||
        failedCreditCardPurchaseIds.length > 0 ||
        failedFixedImportRules ||
        failedEntryDeletes || failedTemplateDeletes || failedGoalDeletes || failedAccountDeletes ||
        failedCreditCardDeletes || failedCreditCardPurchaseDeletes ||
        failedProfile;
      const removeSyncedIds = (kind, sentItems, currentItems, failedIds, conflictIds = []) => {
        const sentById = new Map(sentItems.map(item => [item.id, JSON.stringify(item)]));
        const unresolvedIds = new Set([...failedIds, ...conflictIds]);
        latestPending[kind] = latestPending[kind].filter(id => {
          if (unresolvedIds.has(id)) return true;
          const current = currentItems.find(item => item.id === id);
          return current && sentById.get(id) !== JSON.stringify(current);
        });
        failedIds.forEach(id => {
          if (!latestPending[kind].includes(id)) latestPending[kind].push(id);
        });
      };
      removeSyncedIds('entries', entriesToSave, this.getEntries(), failedEntryIds, getConflictIds(results[0]));
      removeSyncedIds('templates', templatesToSave, this.getTemplates(), failedTemplateIds, getConflictIds(results[1]));
      removeSyncedIds('accounts', accountsToSave, this.getAccounts(), failedAccountIds, getConflictIds(accountResult));
      removeSyncedIds('creditCards', creditCardsToSave, this.getCreditCards(), failedCreditCardIds, getConflictIds(creditCardsResult));
      removeSyncedIds(
        'creditCardPurchases', creditCardPurchasesToSave,
        this.getCreditCardPurchases(), failedCreditCardPurchaseIds, getConflictIds(creditCardPurchasesResult)
      );
      const sentGoalsByCategory = new Map(goalsToSave.map(goal => [goal.category, JSON.stringify(goal)]));
      latestPending.goals = latestPending.goals.filter(category => {
        if (failedGoalCategories.includes(category) || getConflictIds(results[4]).includes(category)) return true;
        const current = this.getGoals().find(goal => goal.category === category);
        return current && sentGoalsByCategory.get(category) !== JSON.stringify(current);
      });
      failedGoalCategories.forEach(category => {
        if (!latestPending.goals.includes(category)) latestPending.goals.push(category);
      });

      if (!failedEntryDeletes) {
        latestPending.deletedEntries = latestPending.deletedEntries.filter(id =>
          !pending.deletedEntries.includes(id) || getConflictIds(results[2]).includes(id));
      }
      if (!failedTemplateDeletes) {
        latestPending.deletedTemplates = latestPending.deletedTemplates.filter(id =>
          !pending.deletedTemplates.includes(id) || getConflictIds(results[3]).includes(id));
      }
      if (!failedGoalDeletes) {
        latestPending.deletedGoals = latestPending.deletedGoals.filter(category =>
          !pending.deletedGoals.includes(category) || getConflictIds(results[5]).includes(category));
      }
      if (!failedAccountDeletes) {
        latestPending.deletedAccounts = latestPending.deletedAccounts.filter(id =>
          !pending.deletedAccounts.includes(id) || getConflictIds(results[6]).includes(id));
      }
      if (!failedCreditCardDeletes) {
        latestPending.deletedCreditCards = latestPending.deletedCreditCards.filter(id =>
          !pending.deletedCreditCards.includes(id) || getConflictIds(results[7]).includes(id));
      }
      if (!failedCreditCardPurchaseDeletes) {
        latestPending.deletedCreditCardPurchases = latestPending.deletedCreditCardPurchases.filter(
          id => !pending.deletedCreditCardPurchases.includes(id) || getConflictIds(results[8]).includes(id)
        );
      }
      if (pending.profile && !failedProfile && !getConflictIds(profileResult).length) latestPending.profile = false;
      if (failedProfile) latestPending.profile = true;
      if (pending.fixedImportRules && !failedFixedImportRules &&
        !getConflictIds(fixedImportRulesResult).length &&
        JSON.stringify(fixedImportRules) === JSON.stringify(this.getFixedImportRules())) {
        latestPending.fixedImportRules = false;
      }
      if (failedFixedImportRules) latestPending.fixedImportRules = true;

      if (fullSync) {
        latestPending.full = !hasFailures && (
          JSON.stringify(entries) !== JSON.stringify(this.getEntries()) ||
          JSON.stringify(templates) !== JSON.stringify(this.getTemplates()) ||
          JSON.stringify(goals) !== JSON.stringify(this.getGoals()) ||
          JSON.stringify(accounts) !== JSON.stringify(this.getAccounts()) ||
          JSON.stringify(creditCards) !== JSON.stringify(this.getCreditCards()) ||
          JSON.stringify(creditCardPurchases) !== JSON.stringify(this.getCreditCardPurchases()) ||
          JSON.stringify(fixedImportRules) !== JSON.stringify(this.getFixedImportRules())
        );
      }
      this.savePendingSync(latestPending);
      if (hasFailures) {
        if (typeof showToast === 'function') {
          const hasConflicts = [accountResult, creditCardsResult, creditCardPurchasesResult, ...results]
            .some(result => getConflictIds(result).length > 0);
          showToast(hasConflicts
            ? 'Um item foi atualizado em outro aparelho'
            : 'Não foi possível sincronizar todos os dados; os itens pendentes continuam salvos neste aparelho');
        }
        return (accountResult && !accountResult.success ? accountResult : null) ||
          (profileResult && !profileResult.success ? profileResult : null) ||
          (creditCardsResult && !creditCardsResult.success ? creditCardsResult : null) ||
          (creditCardPurchasesResult && !creditCardPurchasesResult.success ? creditCardPurchasesResult : null) ||
          results.find(result => !result || !result.success) ||
          { success: false, error: new Error('Alguns itens não puderam ser sincronizados.') };
      }
      return { success: true };
    };

    const previousSync = this._pendingSyncPromise || Promise.resolve();
    const currentSync = previousSync.then(flush, flush);
    this._pendingSyncPromise = currentSync.catch(() => undefined);
    return currentSync;
  },

  async flushTransactionalOperations(userId) {
    const auth = window.SupabaseAuth;
    const synced = { entries: [], templates: [], accounts: [], creditCards: [], creditCardPurchases: [] };
    let pending = this.getPendingSync();
    const operations = [...pending.transactionalOperations];
    const getters = {
      entries: () => this.getEntries(),
      templates: () => this.getTemplates(),
      creditCards: () => this.getCreditCards(),
      creditCardPurchases: () => this.getCreditCardPurchases()
    };
    const clearSyncedIds = (kind, snapshots) => {
      const byId = new Map(snapshots.map(item => [item.id, item]));
      const currentItems = getters[kind]();
      pending[kind] = pending[kind].filter(id => {
        if (!byId.has(id)) return true;
        const current = currentItems.find(item => item.id === id);
        if (!current || JSON.stringify(current) !== JSON.stringify(byId.get(id))) return true;
        synced[kind].push(id);
        return false;
      });
    };

    for (const operation of operations) {
      if (operation.type === 'deleteAccount') {
        if (typeof auth.deleteAccountTransactional !== 'function') {
          return { success: false, error: new Error('Exclusão transacional de conta não disponível.'), synced };
        }
        const result = await auth.deleteAccountTransactional(
          operation.accountId, operation.clientEditedAt, userId
        );
        if (!result || !result.success) {
          if (result && result.conflicts && result.conflicts.length && typeof showToast === 'function') {
            showToast('Um item foi atualizado em outro aparelho');
          }
          return {
            success: false,
            error: result && result.error || new Error('A exclusão transacional da conta falhou.'),
            conflicts: result && result.conflicts || [],
            synced
          };
        }

        pending = this.getPendingSync();
        pending.transactionalOperations = pending.transactionalOperations.filter(item =>
          item.operationId !== operation.operationId
        );
        Object.keys(operation.linked || {}).forEach(kind => clearSyncedIds(kind, operation.linked[kind]));
        pending.accounts = pending.accounts.filter(id => id !== operation.accountId);
        pending.deletedAccounts = pending.deletedAccounts.filter(id => id !== operation.accountId);
        this.savePendingSync(pending);
        continue;
      }

      if (operation.type === 'import') {
        if (typeof auth.importFinancialBatch !== 'function') {
          return { success: false, error: new Error('Importação transacional não disponível.'), synced };
        }
        const currentEntries = this.getEntries();
        const currentTemplates = this.getTemplates();
        const entries = operation.entries.map(item => currentEntries.find(current => current.id === item.id));
        const templates = operation.templates.map(item => currentTemplates.find(current => current.id === item.id));
        if (entries.some(item => !item) || templates.some(item => !item)) {
          return {
            success: false,
            error: new Error('O lote de importação mudou localmente; a transação foi mantida na fila.'),
            conflicts: [],
            synced
          };
        }
        const result = await auth.importFinancialBatch(entries, templates, operation.payments, userId);
        if (!result || !result.success) {
          if (result && result.conflicts && result.conflicts.length && typeof showToast === 'function') {
            showToast('Um item foi atualizado em outro aparelho');
          }
          return {
            success: false,
            error: result && result.error || new Error('A importação transacional falhou.'),
            conflicts: result && result.conflicts || [],
            synced
          };
        }

        pending = this.getPendingSync();
        pending.transactionalOperations = pending.transactionalOperations.filter(item =>
          item.operationId !== operation.operationId
        );
        clearSyncedIds('entries', entries);
        clearSyncedIds('templates', templates);
        this.savePendingSync(pending);
      }
    }
    return { success: true, synced };
  },

  reconcileSyncVersions(userId, cloudEntries, cloudTemplates, cloudGoals, cloudAccounts,
    cloudCreditCards, cloudCreditCardPurchases, cloudTombstones = {}, cloudVersions = {},
    cloudFixedImportRules = null) {
    const pending = this.getPendingSync();
    const metadata = this.getSyncMetadata();
    const offset = Number(metadata.clockOffsetMs) || 0;
    let conflictFound = false;
    const newerThan = (editedAt, serverAt) => {
      const localTime = Date.parse(editedAt || '');
      const remoteTime = Date.parse(serverAt || '');
      return Number.isFinite(localTime) && Number.isFinite(remoteTime) &&
        localTime + offset > remoteTime + 2000;
    };
    const collections = [
      ['entries', STORAGE_ENTRIES, this.getEntries(), cloudEntries, item => item.id, 'entries', 'deletedEntries'],
      ['templates', STORAGE_TEMPLATES, this.getTemplates(), cloudTemplates, item => item.id, 'templates', 'deletedTemplates'],
      ['accounts', STORAGE_ACCOUNTS, this.getAccounts(), cloudAccounts, item => item.id, 'accounts', 'deletedAccounts'],
      ['creditCards', STORAGE_CREDIT_CARDS, this.getCreditCards(), cloudCreditCards, item => item.id, 'creditCards', 'deletedCreditCards'],
      ['creditCardPurchases', STORAGE_CREDIT_CARD_PURCHASES, this.getCreditCardPurchases(), cloudCreditCardPurchases, item => item.id, 'creditCardPurchases', 'deletedCreditCardPurchases'],
      ['goals', STORAGE_GOALS, this.getGoals(), cloudGoals, item => item.category, 'goals', 'deletedGoals']
    ];
    collections.forEach(([kind, storageKey, localItems, cloudItems, getKey, pendingKey, deletedKey]) => {
      if (!Array.isArray(cloudItems)) return;
      metadata.records[kind] ||= {};
      metadata.deleted[kind] ||= {};
      const remoteByKey = new Map(cloudItems.map(item => [getKey(item), item]));
      const merged = new Map(remoteByKey);
      const remoteVersions = cloudVersions[kind] || {};
      const remoteTombstones = cloudTombstones[kind] || {};
      localItems.forEach(item => {
        const key = getKey(item);
        const remote = remoteByKey.get(key);
        const remoteVersion = remoteVersions[key];
        const tombstoneVersion = remoteTombstones[key];
        const knownVersion = metadata.records[kind][key]?.updatedAt;
        const editedAt = metadata.records[kind][key]?.editedAt;
        const isPending = pending.full || pending[pendingKey].includes(key);
        if (remote) {
          if (remoteVersion && knownVersion && remoteVersion < knownVersion) {
            merged.set(key, item);
            return;
          }
          const changedRemotely = remoteVersion && (!knownVersion || remoteVersion > knownVersion);
          if (isPending && changedRemotely) {
            conflictFound = true;
            if (newerThan(editedAt, remoteVersion)) {
              merged.set(key, item);
              metadata.records[kind][key] = { updatedAt: remoteVersion, editedAt };
            } else {
              merged.set(key, remote);
              pending[pendingKey] = pending[pendingKey].filter(value => value !== key);
              metadata.records[kind][key] = { updatedAt: remoteVersion, editedAt: remoteVersion };
            }
          } else if (isPending) {
            merged.set(key, item);
            if (remoteVersion) metadata.records[kind][key] = {
              updatedAt: remoteVersion, editedAt: editedAt || remoteVersion
            };
          } else {
            merged.set(key, remote);
            if (remoteVersion) metadata.records[kind][key] = {
              updatedAt: remoteVersion, editedAt: remoteVersion
            };
          }
          return;
        }
        if (tombstoneVersion && knownVersion && tombstoneVersion < knownVersion) {
          merged.set(key, item);
          return;
        }
        if (tombstoneVersion || knownVersion) {
          conflictFound = true;
          if (isPending && tombstoneVersion && newerThan(editedAt, tombstoneVersion)) {
            merged.set(key, item);
            metadata.records[kind][key] = { updatedAt: tombstoneVersion, editedAt };
          } else {
            merged.delete(key);
            pending[pendingKey] = pending[pendingKey].filter(value => value !== key);
            pending[deletedKey] = pending[deletedKey].filter(value => value !== key);
            delete metadata.records[kind][key];
            delete metadata.deleted[kind][key];
          }
        } else {
          merged.set(key, item);
        }
      });
      pending[deletedKey].forEach(key => {
        const remote = remoteByKey.get(key);
        const remoteVersion = remoteVersions[key];
        const tombstoneVersion = remoteTombstones[key];
        const edit = metadata.deleted[kind][key];
        if (remote && edit && remoteVersion && edit.updatedAt && remoteVersion < edit.updatedAt) return;
        if (remote && !newerThan(edit?.editedAt, remoteVersion)) {
          pending[deletedKey] = pending[deletedKey].filter(value => value !== key);
          delete metadata.deleted[kind][key];
          merged.set(key, remote);
          conflictFound = true;
        } else if (!remote && (!tombstoneVersion || !newerThan(edit?.editedAt, tombstoneVersion))) {
          pending[deletedKey] = pending[deletedKey].filter(value => value !== key);
          delete metadata.deleted[kind][key];
          conflictFound = true;
        }
      });
      localStorage.setItem(storageKey, JSON.stringify([...merged.values()]));
    });

    const profileId = userId;
    metadata.records.profiles ||= {};
    metadata.deleted.profiles ||= {};

    if (Array.isArray(cloudFixedImportRules)) {
      metadata.records.fixedImportRules ||= {};
      metadata.deleted.fixedImportRules ||= {};
      const known = metadata.records.fixedImportRules[userId]?.updatedAt;
      const editedAt = metadata.records.fixedImportRules[userId]?.editedAt;
      const version = cloudVersions.fixedImportRules && cloudVersions.fixedImportRules[userId];
      const tombstone = cloudTombstones.fixedImportRules && cloudTombstones.fixedImportRules[userId];
      if (tombstone || known && !version || pending.fixedImportRules && version && (!known || version > known)) {
        conflictFound = true;
        if (pending.fixedImportRules &&
          (version && newerThan(editedAt, version) || tombstone && newerThan(editedAt, tombstone))) {
          metadata.records.fixedImportRules[userId] = { updatedAt: version || tombstone, editedAt };
        } else {
          pending.fixedImportRules = false;
          localStorage.setItem(STORAGE_FIXED_IMPORT_RULES, JSON.stringify(tombstone || known && !version ? [] : cloudFixedImportRules));
          metadata.records.fixedImportRules[userId] = { updatedAt: version || tombstone || null, editedAt: version || tombstone || null };
        }
      } else if (!pending.fixedImportRules) {
        localStorage.setItem(STORAGE_FIXED_IMPORT_RULES, JSON.stringify(cloudFixedImportRules));
        if (version) metadata.records.fixedImportRules[userId] = { updatedAt: version, editedAt: version };
      }
    }
    this.savePendingSync(pending);
    this.saveSyncMetadata(metadata);
    if (conflictFound && typeof showToast === 'function') showToast('Um item foi atualizado em outro aparelho');
    return conflictFound;
  },

  mergeCloudData(userId, cloudEntries, cloudTemplates, flushSucceeded = false, cloudGoals = null, cloudAccounts = null, cloudFixedImportRules = null, cloudCreditCards = null, cloudCreditCardPurchases = null, cloudTombstones = {}, cloudVersions = {}) {
    if (
      !userId ||
      localStorage.getItem(STORAGE_LAST_UID) !== userId ||
      !Array.isArray(cloudEntries) ||
      !Array.isArray(cloudTemplates) ||
      (cloudGoals !== null && !Array.isArray(cloudGoals)) ||
      (cloudAccounts !== null && !Array.isArray(cloudAccounts)) ||
      (cloudCreditCards !== null && !Array.isArray(cloudCreditCards)) ||
      (cloudCreditCardPurchases !== null && !Array.isArray(cloudCreditCardPurchases)) ||
      (cloudFixedImportRules !== null && (!Array.isArray(cloudFixedImportRules) ||
        cloudFixedImportRules.some(rule => typeof rule !== 'string')))
    ) return false;

    if (Object.keys(cloudVersions || {}).length || Object.keys(cloudTombstones || {}).length) {
      this.reconcileSyncVersions(userId, cloudEntries, cloudTemplates, cloudGoals, cloudAccounts,
        cloudCreditCards, cloudCreditCardPurchases, cloudTombstones, cloudVersions, cloudFixedImportRules);
    }

    const pending = this.getPendingSync();
    const canRemoveCloudDeleted = flushSucceeded && !this.hasPendingSync();
    const mergeById = (localItems, cloudItems, pendingIds, deletedIds) => {
      const merged = new Map(localItems.map(item => [item.id, item]));
      const pendingSet = new Set(pendingIds);
      const deletedSet = new Set(deletedIds);
      cloudItems.forEach(item => {
        if (deletedSet.has(item.id)) return;
        if (pendingSet.has(item.id)) return;
        merged.set(item.id, item);
      });
      if (canRemoveCloudDeleted) {
        localItems.forEach(item => {
          if (!isUuid(item.id) || pendingSet.has(item.id)) merged.set(item.id, item);
          else if (!cloudItems.some(cloudItem => cloudItem.id === item.id)) merged.delete(item.id);
        });
      }
      return [...merged.values()];
    };

    const entries = mergeById(
      this.getEntries(), cloudEntries, pending.entries, pending.deletedEntries
    );
    const templates = mergeById(
      this.getTemplates(), cloudTemplates, pending.templates, pending.deletedTemplates
    );
    const accounts = this.getAccounts();
    localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
    localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
    if (cloudAccounts !== null) {
      const pendingAccounts = new Set(pending.accounts);
      const deletedAccounts = new Set(pending.deletedAccounts);
      const mergedAccounts = new Map();
      cloudAccounts.forEach(account => {
        if (deletedAccounts.has(account.id)) return;
        const local = accounts.find(item => item.id === account.id);
        mergedAccounts.set(account.id, local && pendingAccounts.has(account.id) ? local : account);
      });
      accounts.forEach(account => {
        if (mergedAccounts.has(account.id) || deletedAccounts.has(account.id)) return;
        if (pendingAccounts.has(account.id) || !canRemoveCloudDeleted) {
          mergedAccounts.set(account.id, account);
        }
      });
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify([...mergedAccounts.values()]));
    }
    if (cloudCreditCards !== null) {
      const localCards = this.getCreditCards();
      const pendingCards = new Set(pending.creditCards);
      const deletedCards = new Set(pending.deletedCreditCards);
      const mergedCards = new Map();
      cloudCreditCards.forEach(card => {
        if (deletedCards.has(card.id)) return;
        const local = localCards.find(item => item.id === card.id);
        mergedCards.set(card.id, local && pendingCards.has(card.id) ? local : card);
      });
      localCards.forEach(card => {
        if (mergedCards.has(card.id) || deletedCards.has(card.id)) return;
        if (pendingCards.has(card.id) || !canRemoveCloudDeleted) mergedCards.set(card.id, card);
      });
      localStorage.setItem(STORAGE_CREDIT_CARDS, JSON.stringify([...mergedCards.values()]));
    }
    if (cloudCreditCardPurchases !== null) {
      localStorage.setItem(STORAGE_CREDIT_CARD_PURCHASES, JSON.stringify(mergeById(
        this.getCreditCardPurchases(), cloudCreditCardPurchases,
        pending.creditCardPurchases, pending.deletedCreditCardPurchases
      )));
    }
    if (cloudGoals !== null) {
      const localGoals = this.getGoals();
      const pendingGoals = new Set(pending.goals);
      const deletedGoals = new Set(pending.deletedGoals);
      const mergedGoals = new Map();
      cloudGoals.forEach(goal => {
        if (deletedGoals.has(goal.category)) return;
        const local = localGoals.find(item => item.category === goal.category);
        if (local && pendingGoals.has(goal.category)) {
          mergedGoals.set(goal.category, local);
        } else {
          mergedGoals.set(goal.category, {
            id: local ? local.id : 'goal-' + crypto.randomUUID(),
            category: goal.category,
            limit: goal.limit
          });
        }
      });
      localGoals.forEach(goal => {
        if (mergedGoals.has(goal.category) || deletedGoals.has(goal.category)) return;
        if (pendingGoals.has(goal.category) || !canRemoveCloudDeleted) {
          mergedGoals.set(goal.category, goal);
        }
      });
      localStorage.setItem(STORAGE_GOALS, JSON.stringify([...mergedGoals.values()]));
    }
    if (cloudFixedImportRules !== null) {
      if (pending.fixedImportRules) return true;
      localStorage.setItem(STORAGE_FIXED_IMPORT_RULES, JSON.stringify([...new Set(cloudFixedImportRules)]));
    }
    return true;
  },

  mergeCloudProfile(cloudProfile) {
    if (!cloudProfile || typeof cloudProfile !== 'object') return this.getProfile();
    const pending = this.getPendingSync();
    const profile = this.getProfile();
    const metadata = this.getSyncMetadata();
    const profileId = cloudProfile.id || profile.userId;
    metadata.records.profiles ||= {};
    const known = metadata.records.profiles[profileId];
    if (pending.profile && cloudProfile.updatedAt && known && known.updatedAt &&
      cloudProfile.updatedAt > known.updatedAt) {
      const localTime = Date.parse(known.editedAt || '');
      const remoteTime = Date.parse(cloudProfile.updatedAt);
      if (Number.isFinite(localTime) && localTime + (Number(metadata.clockOffsetMs) || 0) > remoteTime + 2000) {
        metadata.records.profiles[profileId] = { updatedAt: cloudProfile.updatedAt, editedAt: known.editedAt };
        this.saveSyncMetadata(metadata);
        if (typeof showToast === 'function') showToast('Um item foi atualizado em outro aparelho');
        return profile;
      }
      pending.profile = false;
      this.savePendingSync(pending);
      if (typeof showToast === 'function') showToast('Um item foi atualizado em outro aparelho');
    } else if (pending.profile) {
      return profile;
    }
    if (cloudProfile.updatedAt) metadata.records.profiles[profileId] = {
      updatedAt: cloudProfile.updatedAt, editedAt: cloudProfile.updatedAt
    };
    this.saveSyncMetadata(metadata);
    return this.saveProfile({
      ...profile,
      name: typeof cloudProfile.name === 'string' ? cloudProfile.name : profile.name,
      avatar: typeof cloudProfile.avatar === 'string' || cloudProfile.avatar === null
        ? cloudProfile.avatar
        : profile.avatar
    }, { queueSync: false });
  },

  queueProfileSync() {
    const pending = this.getPendingSync();
    pending.profile = true;
    this.savePendingSync(pending);
    const metadata = this.getSyncMetadata();
    const profileId = this.getProfile().userId;
    metadata.records.profiles ||= {};
    const known = metadata.records.profiles[profileId];
    metadata.records.profiles[profileId] = {
      updatedAt: known ? known.updatedAt : null,
      editedAt: new Date().toISOString()
    };
    this.saveSyncMetadata(metadata);
  },

  // ================================================================
  // LEITURA E ESCRITA DE LANÇAMENTOS PONTUAIS
  // ================================================================

  /**
   * Lê todos os lançamentos pontuais do localStorage.
   *
   * @returns {Array<Object>} Lista de lançamentos.
   */
  getEntries() {
    try {
      const stored = localStorage.getItem(STORAGE_ENTRIES);
      // Retorna array vazio para novos usuários — dados virão da nuvem após login
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (e) {
      console.error('[GastoPro] Erro ao ler lançamentos:', e);
      return [];
    }
  },

  /**
   * Persiste a lista completa de lançamentos pontuais.
   *
   * @param {Array<Object>} entries - Array de lançamentos a salvar.
   */
  async saveEntries(entries, options = {}) {
    try {
      const previousEntries = this.getEntries();
      localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
      this.queueLocalChanges('entries', previousEntries, entries);
      const profile = this.getProfile();
      return options.flush === false
        ? { success: true, queued: true }
        : await this.flushPendingSync(profile && profile.userId);
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar lançamentos no localStorage:', e);
      return { success: false, error: e };
    }
  },

  // ================================================================
  // LEITURA E ESCRITA DE TEMPLATES DE GASTOS FIXOS RECORRENTES
  // ================================================================

  /**
   * Lê todos os templates de gastos fixos do localStorage.
   *
   * @returns {Array<Object>} Lista de templates.
   */
  getTemplates() {
    try {
      const stored = localStorage.getItem(STORAGE_TEMPLATES);
      // Retorna array vazio para novos usuários — dados virão da nuvem após login
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (e) {
      console.error('[GastoPro] Erro ao ler templates fixos:', e);
      return [];
    }
  },

  /**
   * Persiste a lista completa de templates fixos.
   *
   * @param {Array<Object>} templates - Array de templates a salvar.
   */
  async saveTemplates(templates, options = {}) {
    try {
      const previousTemplates = this.getTemplates();
      localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
      this.queueLocalChanges('templates', previousTemplates, templates);
      const profile = this.getProfile();
      return options.flush === false
        ? { success: true, queued: true }
        : await this.flushPendingSync(profile && profile.userId);
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar templates fixos no localStorage:', e);
      return { success: false, error: e };
    }
  },

  getAccounts() {
    try {
      const stored = localStorage.getItem(STORAGE_ACCOUNTS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[GastoPro] Erro ao ler contas:', e);
      return [];
    }
  },

  getCreditCards() {
    try {
      const stored = localStorage.getItem(STORAGE_CREDIT_CARDS);
      const cards = stored ? JSON.parse(stored) : [];
      return this.migrateLegacyCreditCardPreviousSpent(cards);
    } catch (error) {
      console.error('[GastoPro] Erro ao ler cartões:', error);
      return [];
    }
  },

  migrateLegacyCreditCardPreviousSpent(cards) {
    const profile = this.getProfile();
    const userId = this.getActiveUserId() || profile.userId || 'local';
    const legacyKey = `${STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT}:${userId}`;
    const stored = localStorage.getItem(legacyKey);
    if (!stored || !Array.isArray(cards) || !cards.length) return cards;

    let legacyValues;
    try {
      legacyValues = JSON.parse(stored);
    } catch (error) {
      console.error('[GastoPro] Erro ao ler gastos anteriores legados dos cartões:', error);
      return cards;
    }
    if (!legacyValues || typeof legacyValues !== 'object' || Array.isArray(legacyValues)) {
      console.error('[GastoPro] Os gastos anteriores legados dos cartões têm formato inválido.');
      return cards;
    }

    const migratedCards = cards.map(card => ({ ...card }));
    const handledIds = [];
    let changed = false;
    Object.entries(legacyValues).forEach(([cardId, amount]) => {
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return;
      const card = migratedCards.find(item => item.id === cardId);
      if (!card) return;
      handledIds.push(cardId);
      if (Number(card.previousSpent) === 0 || card.previousSpent == null) {
        card.previousSpent = Math.round(amount * 100) / 100;
        changed = true;
      }
    });
    if (!handledIds.length) return cards;

    if (changed) {
      try {
        localStorage.setItem(STORAGE_CREDIT_CARDS, JSON.stringify(migratedCards));
        this.queueLocalChanges('creditCards', cards, migratedCards);
      } catch (error) {
        console.error('[GastoPro] Não foi possível migrar gastos anteriores para os cartões:', error);
        return cards;
      }
    }

    handledIds.forEach(cardId => { delete legacyValues[cardId]; });
    try {
      if (Object.keys(legacyValues).length) {
        localStorage.setItem(legacyKey, JSON.stringify(legacyValues));
      } else {
        localStorage.removeItem(legacyKey);
      }
    } catch (error) {
      console.error('[GastoPro] Não foi possível limpar os gastos anteriores legados:', error);
    }
    return migratedCards;
  },

  getCreditCardPurchases() {
    try {
      const stored = localStorage.getItem(STORAGE_CREDIT_CARD_PURCHASES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[GastoPro] Erro ao ler compras no cartão:', error);
      return [];
    }
  },

  async saveCreditCardPurchases(purchases, options = {}) {
    try {
      if (!Array.isArray(purchases)) {
        return { success: false, error: 'As compras no cartão precisam ser uma lista.' };
      }
      const cards = new Set(this.getCreditCards().map(card => card.id));
      const accounts = new Set(this.getAccounts().map(account => account.id));
      const ids = new Set();
      const normalized = [];
      for (const purchase of purchases) {
        if (!purchase || !isUuid(purchase.id) || ids.has(purchase.id)) {
          return { success: false, error: 'Cada compra no cartão deve ter um UUID válido e exclusivo.' };
        }
        ids.add(purchase.id);
        if (typeof purchase.desc !== 'string' || !purchase.desc.trim() || purchase.desc.trim().length > 300 ||
          typeof purchase.category !== 'string' || !purchase.category.trim() || purchase.category.trim().length > 100) {
          return { success: false, error: 'Informe uma descrição e uma categoria válidas para a compra.' };
        }
        if (typeof purchase.amount === 'boolean' || !Number.isFinite(Number(purchase.amount)) ||
          Number(purchase.amount) <= 0 || Number(purchase.amount) > MAX_ACCOUNT_BALANCE) {
          return { success: false, error: 'O valor da compra no cartão deve ser positivo e válido.' };
        }
        if (!isValidCivilDate(purchase.purchaseDate)) {
          return { success: false, error: 'A data da compra no cartão deve ser válida.' };
        }
        if (!Number.isInteger(purchase.installmentCount) || purchase.installmentCount < 1 ||
          purchase.installmentCount > 24) {
          return { success: false, error: 'A quantidade de parcelas deve estar entre 1 e 24.' };
        }
        if (!Number.isInteger(purchase.closingDay) || purchase.closingDay < 1 || purchase.closingDay > 31 ||
          !Number.isInteger(purchase.dueDay) || purchase.dueDay < 1 || purchase.dueDay > 31) {
          return { success: false, error: 'Os dias de fechamento e vencimento devem estar entre 1 e 31.' };
        }
        if (typeof purchase.cardName !== 'string' || !purchase.cardName.trim() || purchase.cardName.length > 100) {
          return { success: false, error: 'O nome de referência do cartão é inválido.' };
        }
        if (purchase.cardId != null && !cards.has(purchase.cardId)) {
          return { success: false, error: 'O cartão da compra não existe.' };
        }
        if (purchase.accountId != null && !accounts.has(purchase.accountId)) {
          return { success: false, error: 'A conta vinculada à compra não existe.' };
        }
        const paidInstallments = purchase.paidInstallments || [];
        if (!Array.isArray(paidInstallments) || paidInstallments.some(number =>
          !Number.isInteger(number) || number < 1 || number > purchase.installmentCount
        ) || new Set(paidInstallments).size !== paidInstallments.length) {
          return { success: false, error: 'As parcelas pagas não são válidas.' };
        }
        const paidDates = purchase.paidDates || {};
        if (!paidDates || typeof paidDates !== 'object' || Array.isArray(paidDates) ||
          Object.entries(paidDates).some(([number, date]) =>
            !/^\d+$/.test(number) || Number(number) < 1 ||
            Number(number) > purchase.installmentCount ||
            !paidInstallments.includes(Number(number)) || !isValidCivilDate(date)
          )) {
          return { success: false, error: 'As datas de pagamento das parcelas não são válidas.' };
        }
        normalized.push({
          ...purchase,
          desc: purchase.desc.trim(),
          category: purchase.category.trim(),
          amount: Math.round(Number(purchase.amount) * 100) / 100,
          cardName: purchase.cardName.trim(),
          cardId: purchase.cardId || null,
          accountId: purchase.accountId || null,
          paidInstallments: paidInstallments.slice(),
          paidDates: { ...paidDates }
        });
      }
      const previous = this.getCreditCardPurchases();
      localStorage.setItem(STORAGE_CREDIT_CARD_PURCHASES, JSON.stringify(normalized));
      this.queueLocalChanges('creditCardPurchases', previous, normalized);
      return options.flush === false
        ? { success: true, queued: true }
        : await this.flushPendingSync(this.getProfile().userId);
    } catch (error) {
      console.error('[GastoPro] Erro ao salvar compras no cartão:', error);
      return { success: false, error };
    }
  },

  async addCreditCardPurchase(fields) {
    const card = this.getCreditCards().find(item => item.id === fields.cardId);
    if (!card) return { success: false, error: 'Selecione um cartão válido.' };
    const purchase = {
      ...fields,
      id: crypto.randomUUID(),
      cardId: card.id,
      cardName: card.name,
      accountId: card.accountId || null,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      amount: Number(fields.amount),
      installmentCount: Number(fields.installmentCount),
      paidInstallments: [],
      paidDates: {}
    };
    const result = await this.saveCreditCardPurchases([
      ...this.getCreditCardPurchases(), purchase
    ]);
    const savedPurchase = this.getCreditCardPurchases().find(item => item.id === purchase.id);
    return savedPurchase
      ? { success: result.success, purchase: savedPurchase, error: result.error }
      : { success: false, error: result.error };
  },

  async toggleCreditCardPurchasePaid(id, installmentNumber) {
    const purchases = this.getCreditCardPurchases();
    const purchase = purchases.find(item => item.id === id);
    if (!purchase || !Number.isInteger(installmentNumber) ||
      installmentNumber < 1 || installmentNumber > purchase.installmentCount) {
      return { success: false, error: 'Parcela da compra no cartão não encontrada.' };
    }
    const paid = new Set(purchase.paidInstallments || []);
    if (paid.has(installmentNumber)) {
      paid.delete(installmentNumber);
      if (purchase.paidDates) delete purchase.paidDates[installmentNumber];
    } else {
      paid.add(installmentNumber);
      if (!purchase.paidDates) purchase.paidDates = {};
      purchase.paidDates[installmentNumber] = getLocalDateString();
    }
    purchase.paidInstallments = [...paid].sort((left, right) => left - right);
    return this.saveCreditCardPurchases(purchases);
  },

  async saveCreditCards(cards, options = {}) {
    try {
      if (!Array.isArray(cards)) return { success: false, error: 'Os cartões precisam ser uma lista.' };
      const accounts = new Set(this.getAccounts().map(account => account.id));
      const ids = new Set();
      const normalizedCards = [];
      for (const card of cards) {
        if (!card || typeof card.name !== 'string' || !card.name.trim() || card.name.trim().length > 100) {
          return { success: false, error: 'O nome do cartão deve ter de 1 a 100 caracteres.' };
        }
        if (typeof card.totalLimit === 'boolean' || !Number.isFinite(Number(card.totalLimit)) ||
          Number(card.totalLimit) <= 0 || Number(card.totalLimit) > MAX_CREDIT_CARD_LIMIT) {
          return { success: false, error: 'Informe um limite total válido para o cartão.' };
        }
        if (!Number.isInteger(Number(card.closingDay)) || Number(card.closingDay) < 1 ||
          Number(card.closingDay) > 31 || !Number.isInteger(Number(card.dueDay)) ||
          Number(card.dueDay) < 1 || Number(card.dueDay) > 31) {
          return { success: false, error: 'Os dias de fechamento e vencimento devem estar entre 1 e 31.' };
        }
        if (card.brand != null && !CREDIT_CARD_BRANDS.includes(card.brand)) {
          return { success: false, error: 'Selecione uma bandeira válida.' };
        }
        if (card.issuerBank != null && !CREDIT_CARD_ISSUERS.includes(card.issuerBank)) {
          return { success: false, error: 'Selecione um banco emissor válido.' };
        }
        if (card.lastFour != null && card.lastFour !== '' &&
          (typeof card.lastFour !== 'string' || !/^\d{4}$/.test(card.lastFour))) {
          return { success: false, error: 'O final do cartão deve conter quatro dígitos.' };
        }
        if (card.customColor != null &&
          (typeof card.customColor !== 'string' || !CREDIT_CARD_COLOR_PATTERN.test(card.customColor))) {
          return { success: false, error: 'Informe uma cor personalizada válida.' };
        }
        if (card.previousSpent != null &&
          (typeof card.previousSpent === 'boolean' || !Number.isFinite(Number(card.previousSpent)) ||
            Number(card.previousSpent) < 0 || Number(card.previousSpent) > MAX_CREDIT_CARD_LIMIT)) {
          return { success: false, error: 'O gasto anterior do cartão deve ser um valor não negativo válido.' };
        }
        if (card.accountId != null && !accounts.has(card.accountId)) {
          return { success: false, error: 'A conta vinculada ao cartão não existe.' };
        }
        if (!isUuid(card.id) || ids.has(card.id)) {
          return { success: false, error: 'Cada cartão deve ter um UUID válido e exclusivo.' };
        }
        ids.add(card.id);
        const normalizedCard = {
          ...card,
          name: card.name.trim(),
          totalLimit: Math.round(Number(card.totalLimit) * 100) / 100,
          closingDay: Number(card.closingDay),
          dueDay: Number(card.dueDay),
          accountId: card.accountId || null,
          brand: card.brand || 'Outra',
          issuerBank: card.issuerBank || 'Outro',
          lastFour: card.lastFour || null,
          customColor: (card.issuerBank || 'Outro') === 'Outro'
            ? card.customColor || DEFAULT_CREDIT_CARD_COLOR
            : null
        };
        if (card.previousSpent != null) {
          normalizedCard.previousSpent = Math.round(Number(card.previousSpent) * 100) / 100;
        }
        normalizedCards.push(normalizedCard);
      }
      const previousCards = this.getCreditCards();
      localStorage.setItem(STORAGE_CREDIT_CARDS, JSON.stringify(normalizedCards));
      this.queueLocalChanges('creditCards', previousCards, normalizedCards);
      return options.flush === false
        ? { success: true, queued: true }
        : await this.flushPendingSync(this.getProfile().userId);
    } catch (error) {
      console.error('[GastoPro] Erro ao salvar cartões localmente:', error);
      return { success: false, error };
    }
  },

  async addCreditCard(fields) {
    const card = {
      ...fields,
      id: crypto.randomUUID(),
      name: typeof fields.name === 'string' ? fields.name.trim() : fields.name,
      totalLimit: Number(fields.totalLimit),
      closingDay: Number(fields.closingDay),
      dueDay: Number(fields.dueDay),
      accountId: fields.accountId || null,
      brand: fields.brand || 'Outra',
      issuerBank: fields.issuerBank || 'Outro',
      lastFour: fields.lastFour || null,
      customColor: (fields.issuerBank || 'Outro') === 'Outro'
        ? fields.customColor || DEFAULT_CREDIT_CARD_COLOR
        : null
    };
    const result = await this.saveCreditCards([...this.getCreditCards(), card]);
    return result.success ? { success: true, card } : { success: false, error: result.error };
  },

  async updateCreditCard(id, fields) {
    const cards = this.getCreditCards();
    const index = cards.findIndex(card => card.id === id);
    if (index < 0) return { success: false, error: 'Cartão não encontrado.' };
    const candidate = { ...cards[index], ...fields, id };
    cards[index] = candidate;
    const result = await this.saveCreditCards(cards);
    return result.success
      ? { success: true, card: this.getCreditCards().find(card => card.id === id) }
      : { success: false, error: result.error };
  },

  async deleteCreditCard(id) {
    const cards = this.getCreditCards();
    const card = cards.find(item => item.id === id);
    if (!card) return { success: false, error: 'Cartão não encontrado.' };
    const purchases = this.getCreditCardPurchases().map(purchase =>
      purchase.cardId === id ? { ...purchase, cardId: null } : purchase
    );
    const purchasesResult = await this.saveCreditCardPurchases(purchases, { flush: false });
    if (!purchasesResult.success) return purchasesResult;
    const result = await this.saveCreditCards(cards.filter(item => item.id !== id), { flush: false });
    if (!result.success) return result;
    return this.flushPendingSync(this.getProfile().userId);
  },

  async saveAccounts(accounts, options = {}) {
    try {
      if (!Array.isArray(accounts)) return { success: false, error: 'As contas precisam ser uma lista.' };
      const ids = new Set();
      for (const account of accounts) {
        const error = validateAccount(account);
        if (error) return { success: false, error };
        if (!isUuid(account.id) || ids.has(account.id)) {
          return { success: false, error: 'Cada conta deve ter um UUID válido e exclusivo.' };
        }
        ids.add(account.id);
      }
      const normalizedAccounts = accounts.map(account => account && ({
        ...account,
        name: typeof account.name === 'string' ? account.name.trim() : account.name,
        institution: typeof account.institution === 'string' && account.institution.trim()
          ? account.institution.trim()
          : null,
        initialBalance: Math.round(Number(account.initialBalance == null ? 0 : account.initialBalance) * 100) / 100,
        balanceDate: account.balanceDate || null
      }));
      const previousAccounts = this.getAccounts();
      localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(normalizedAccounts));
      this.queueLocalChanges('accounts', previousAccounts, normalizedAccounts);
      const profile = this.getProfile();
      return options.flush === false
        ? { success: true, queued: true }
        : await this.flushPendingSync(profile && profile.userId);
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar contas localmente:', e);
      return { success: false, error: e };
    }
  },

  async addAccount(account) {
    const candidate = {
      name: account && account.name,
      institution: account && account.institution,
      type: account && account.type,
      initialBalance: account && account.initialBalance != null ? account.initialBalance : 0,
      balanceDate: account && account.balanceDate ? account.balanceDate : null
    };
    const error = validateAccount(candidate);
    if (error) return { success: false, error };
    const created = {
      ...candidate,
      id: crypto.randomUUID(),
      name: candidate.name.trim(),
      institution: typeof candidate.institution === 'string' && candidate.institution.trim()
        ? candidate.institution.trim()
        : null,
      initialBalance: Math.round(Number(candidate.initialBalance) * 100) / 100,
      balanceDate: candidate.balanceDate || null
    };
    const result = await this.saveAccounts([...this.getAccounts(), created]);
    return result.success ? { success: true, account: created } : { success: false, error: result.error };
  },

  async updateAccount(id, fields) {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(account => account.id === id);
    if (index < 0) return { success: false, error: 'Conta não encontrada.' };
    const candidate = { ...accounts[index], ...fields, id };
    const error = validateAccount(candidate);
    if (error) return { success: false, error };
    candidate.name = candidate.name.trim();
    candidate.institution = typeof candidate.institution === 'string' && candidate.institution.trim()
      ? candidate.institution.trim()
      : null;
    candidate.initialBalance = Math.round(Number(candidate.initialBalance) * 100) / 100;
    accounts[index] = candidate;
    const result = await this.saveAccounts(accounts);
    return result.success ? { success: true, account: candidate } : { success: false, error: result.error };
  },

  async deleteAccount(id) {
    const accounts = this.getAccounts();
    if (!accounts.some(account => account.id === id)) {
      return { success: false, error: 'Conta não encontrada.' };
    }
    const linkedEntries = this.getEntries().filter(entry => entry.accountId === id);
    const linkedTemplates = this.getTemplates().filter(template => template.accountId === id);
    const linkedCreditCards = this.getCreditCards().filter(card => card.accountId === id);
    const linkedPurchases = this.getCreditCardPurchases().filter(purchase => purchase.accountId === id);
    const entries = this.getEntries().map(entry =>
      entry.accountId === id ? { ...entry, accountId: null } : entry
    );
    const templates = this.getTemplates().map(template =>
      template.accountId === id ? { ...template, accountId: null } : template
    );
    const creditCards = this.getCreditCards().map(card =>
      card.accountId === id ? { ...card, accountId: null } : card
    );
    const creditCardPurchases = this.getCreditCardPurchases().map(purchase =>
      purchase.accountId === id ? { ...purchase, accountId: null } : purchase
    );
    const entryResult = await this.saveEntries(entries, { flush: false });
    const templateResult = await this.saveTemplates(templates, { flush: false });
    const cardsResult = await this.saveCreditCards(creditCards, { flush: false });
    const purchasesResult = await this.saveCreditCardPurchases(creditCardPurchases, { flush: false });
    if (!entryResult.success || !templateResult.success || !cardsResult.success || !purchasesResult.success) {
      return {
        success: false,
        error: entryResult.error || templateResult.error || cardsResult.error || purchasesResult.error
      };
    }
    const accountResult = await this.saveAccounts(accounts.filter(account => account.id !== id), { flush: false });
    if (!accountResult.success) return accountResult;
    const pending = this.getPendingSync();
    pending.transactionalOperations ||= [];
    if (!pending.transactionalOperations.some(operation =>
      operation.type === 'deleteAccount' && operation.accountId === id
    )) {
      pending.transactionalOperations.push({
        type: 'deleteAccount',
        operationId: crypto.randomUUID(),
        accountId: id,
        clientEditedAt: this.getClientEditedAt('accounts', id, true),
        linked: {
          entries: linkedEntries.map(entry => ({ ...entry, accountId: null })),
          templates: linkedTemplates.map(template => ({ ...template, accountId: null })),
          creditCards: linkedCreditCards.map(card => ({ ...card, accountId: null })),
          creditCardPurchases: linkedPurchases.map(purchase => ({ ...purchase, accountId: null }))
        }
      });
      this.savePendingSync(pending);
    }
    const syncResult = await this.flushPendingSync(this.getProfile().userId);
    return syncResult.success ? { success: true } : { success: false, error: syncResult.error };
  },

  getFixedImportRules() {
    try {
      const stored = localStorage.getItem(STORAGE_FIXED_IMPORT_RULES);
      if (!stored) return [];
      const rules = JSON.parse(stored);
      return Array.isArray(rules)
        ? [...new Set(rules.filter(rule => typeof rule === 'string' && rule.trim()).map(rule => rule.trim()))]
        : [];
    } catch (error) {
      console.error('[GastoPro] Erro ao ler regras de importação:', error);
      return [];
    }
  },

  async saveFixedImportRules(rules, options = {}) {
    if (!Array.isArray(rules) || rules.some(rule =>
      typeof rule !== 'string' || !rule.trim() || rule.length > 300
    )) {
      return { success: false, error: 'As regras de importação precisam ser textos válidos.' };
    }
    try {
      const normalizedRules = [...new Set(rules.map(rule => rule.trim()))];
      localStorage.setItem(STORAGE_FIXED_IMPORT_RULES, JSON.stringify(normalizedRules));
      const pending = this.getPendingSync();
      pending.fixedImportRules = true;
      this.savePendingSync(pending);
      const metadata = this.getSyncMetadata();
      const profileId = this.getProfile().userId;
      metadata.records.fixedImportRules ||= {};
      const known = metadata.records.fixedImportRules[profileId];
      metadata.records.fixedImportRules[profileId] = {
        updatedAt: known ? known.updatedAt : null,
        editedAt: new Date().toISOString()
      };
      this.saveSyncMetadata(metadata);
      if (options.flush === false) return { success: true, queued: true };
      return await this.flushPendingSync(this.getProfile().userId);
    } catch (error) {
      console.error('[GastoPro] Erro ao salvar regras de importação:', error);
      return { success: false, error };
    }
  },

  async convertEntryToTemplate(id, fields, futureEntryIds = []) {
    const entries = this.getEntries();
    const source = entries.find(entry => entry.id === id);
    if (!source || source.type !== 'variable') {
      return { success: false, error: 'O lançamento variável não foi encontrado.' };
    }
    const sourceMonth = String(source.date || '').slice(0, 7);
    if (!isValidCivilMonth(sourceMonth)) {
      return { success: false, error: 'A data do lançamento não permite criar um gasto fixo.' };
    }
    const candidateIds = new Set(futureEntryIds);
    const futureEntries = entries.filter(entry =>
      candidateIds.has(entry.id) && entry.type === 'variable' &&
      String(entry.date || '').slice(0, 7) > sourceMonth
    );
    const paidMonths = {};
    if (source.paid) paidMonths[sourceMonth] = true;
    futureEntries.forEach(entry => {
      if (entry.paid) paidMonths[String(entry.date).slice(0, 7)] = true;
    });

    const templates = this.getTemplates();
    const template = {
      id: crypto.randomUUID(),
      desc: fields.desc,
      amount: Number(fields.amount),
      category: fields.category,
      type: 'fixed',
      isDebt: Boolean(fields.endMonth) || fields.category === 'Empréstimo' ||
        fields.category === 'Parcelamento',
      active: fields.active !== false,
      startMonth: sourceMonth,
      endMonth: fields.endMonth || null,
      day: String(source.date).slice(8, 10) || '05',
      date: source.date,
      accountId: fields.accountId || null,
      paidMonths
    };
    const templateResult = await this.saveTemplates([...templates, template], { flush: false });
    if (!templateResult.success) return { success: false, error: templateResult.error };

    const removedIds = new Set([id, ...futureEntries.map(entry => entry.id)]);
    const entryResult = await this.saveEntries(
      entries.filter(entry => !removedIds.has(entry.id)),
      { flush: false }
    );
    if (!entryResult.success) {
      const rollback = await this.saveTemplates(templates, { flush: false });
      if (!rollback.success) {
        return {
          success: false,
          error: new Error('Não foi possível concluir nem reverter a conversão para gasto fixo.')
        };
      }
      return { success: false, error: entryResult.error };
    }

    const syncResult = await this.flushPendingSync(this.getProfile().userId);
    return { success: syncResult.success, template, convertedCount: futureEntries.length, syncResult };
  },

  getAccountBalance(accountId) {
    const account = this.getAccounts().find(item => item.id === accountId);
    if (!account) return null;
    const balanceDate = account.balanceDate || null;
    const today = getLocalDateString();
    let activity = 0;
    this.getEntries().forEach(entry => {
      if (entry.accountId !== accountId || !entry.paid) return;
      if (!isValidCivilDate(entry.date) || entry.date > today) return;
      if (balanceDate && (!isValidCivilDate(entry.date) || entry.date < balanceDate)) return;
      activity += entry.type === 'income' ? Number(entry.amount) : -Number(entry.amount);
    });
    this.getTemplates().forEach(template => {
      if (template.accountId !== accountId || !template.paidMonths) return;
      const paidCount = Object.entries(template.paidMonths).filter(([ym, paid]) => {
        if (paid !== true || !isValidCivilMonth(ym)) return false;
        const [year, month] = ym.split('-').map(Number);
        const daysInMonth = [
          31,
          year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
          31, 30, 31, 30, 31, 31, 30, 31, 30, 31
        ][month - 1];
        const storedDay = Number(template.day || String(template.date || '').slice(8, 10));
        const dueDay = Number.isInteger(storedDay) && storedDay >= 1 && storedDay <= 31
          ? storedDay
          : 5;
        const paidDate = `${ym}-${String(Math.min(dueDay, daysInMonth)).padStart(2, '0')}`;
        return paidDate <= today && (!balanceDate || paidDate >= balanceDate);
      }).length;
      activity -= Number(template.amount) * paidCount;
    });
    this.getCreditCardPurchases().forEach(purchase => {
      if (purchase.accountId !== accountId) return;
      const paid = new Set(purchase.paidInstallments || []);
      getCreditCardInstallments(purchase).forEach(installment => {
        const paidDate = purchase.paidDates && purchase.paidDates[installment.number] || installment.date;
        if (paid.has(installment.number) && paidDate <= today &&
          (!balanceDate || paidDate >= balanceDate)) {
          activity -= installment.amount;
        }
      });
    });
    return Math.round((Number(account.initialBalance) + activity) * 100) / 100;
  },

  getAccountBalances() {
    const totals = { total: 0, PF: 0, PJ: 0 };
    this.getAccounts().forEach(account => {
      const balance = this.getAccountBalance(account.id);
      totals.total += balance;
      totals[account.type] += balance;
    });
    Object.keys(totals).forEach(key => {
      totals[key] = Math.round(totals[key] * 100) / 100;
    });
    return totals;
  },

  async adjustAccountBalance(accountId, currentBalance) {
    const account = this.getAccounts().find(item => item.id === accountId);
    if (!account) return { success: false, error: 'Conta não encontrada.' };
    if (typeof currentBalance === 'boolean' || currentBalance === '' ||
      !Number.isFinite(Number(currentBalance)) || Math.abs(Number(currentBalance)) > MAX_ACCOUNT_BALANCE) {
      return { success: false, error: 'Informe um saldo atual válido.' };
    }
    const activityBalance = this.getAccountBalance(accountId) - Number(account.initialBalance);
    return this.updateAccount(accountId, {
      initialBalance: Math.round((Number(currentBalance) - activityBalance) * 100) / 100
    });
  },

  // ================================================================
  // CONSULTA COMBINADA POR MÊS
  // Função principal usada pelo app.js para renderizar cada tela.
  // Combina lançamentos pontuais com projeções dos templates fixos.
  // ================================================================

  /**
   * Retorna todos os itens financeiros do mês indicado.
   * Combina:
   *  1. Lançamentos pontuais com `month === yearMonth`.
   *  2. Projeções dos templates fixos ativos no período do mês.
   *
   * Cada template ativo gera um objeto projetado (não é o template em si),
   * com a flag `isTemplate: true` para identificação nos outros métodos.
   *
   * @param {string} yearMonth - Mês no formato "YYYY-MM" (ex: "2026-11").
   * @returns {Array<Object>} Lista combinada de itens do mês.
   *
   * @example
   * const itens = FinanceData.getByMonth('2026-11');
   * const ganhos = itens.filter(i => i.type === 'income');
   */
  getByMonth(yearMonth) {
    // Passo 1: lançamentos pontuais deste mês (com fallback para e.date)
    const entries = this.getEntries().filter(e => {
      const itemMonth = e.month || (e.date ? String(e.date).substring(0, 7) : '');
      return itemMonth === yearMonth;
    });

    // Passo 2: projeta templates fixos ativos para o mês pedido
    const templates = this.getTemplates();
    const fixedForMonth = [];

    templates.forEach(tpl => {
      // Verifica se o template já estava vigente neste mês
      const isStarted  = !tpl.startMonth || tpl.startMonth <= yearMonth;
      const isNotEnded = !tpl.endMonth   || yearMonth <= tpl.endMonth;

      if (isStarted && isNotEnded) {
        // Verifica se houve baixa de pagamento especificamente neste mês
        const isPaidThisMonth = Boolean(tpl.paidMonths && tpl.paidMonths[yearMonth]);

        // Cria a projeção do template para o mês (objeto auxiliar, não modifica o template)
        fixedForMonth.push({
          id:         tpl.id,
          isTemplate: true,    // Flag para identificar como projeção de template
          type:       'fixed',
          desc:       tpl.desc,
          amount:     tpl.amount,
          category:   tpl.category || 'Contas',
          active:     tpl.active !== false,   // undefined é tratado como ativo
          month:      yearMonth,
          date:       `${yearMonth}-${String(tpl.day || '05').padStart(2, '0')}`,
          startMonth: tpl.startMonth,
          endMonth:   tpl.endMonth || null,
          accountId:  tpl.accountId || null,
          paid:       isPaidThisMonth
        });
      }
    });

    const cardInstallments = this.getCreditCardPurchases().flatMap(purchase =>
      getCreditCardInstallments(purchase)
        .filter(installment => installment.month === yearMonth)
        .map(installment => ({
          id: purchase.id,
          isCardInstallment: true,
          purchaseId: purchase.id,
          installmentNumber: installment.number,
          installmentCount: purchase.installmentCount,
          cardName: purchase.cardName,
          type: 'variable',
          desc: purchase.desc,
          amount: installment.amount,
          category: purchase.category,
          month: installment.month,
          date: installment.date,
          accountId: purchase.accountId,
          paid: (purchase.paidInstallments || []).includes(installment.number)
        }))
    );

    return [...entries, ...fixedForMonth, ...cardInstallments];
  },

  calculatePendingOutflows(items, accountFilter, accounts) {
    return calculatePendingOutflows(items, accountFilter, accounts);
  },

  /**
   * Retorna TODOS os itens do banco (lançamentos + templates).
   * Usado para pesquisas amplas: mini calendário, modal de edição.
   * Templates são retornados com `isTemplate: true`.
   *
   * @returns {Array<Object>} Lista de todos os itens armazenados.
   */
  getAll() {
    const entries   = this.getEntries();
    const templates = this.getTemplates().map(t => ({
      ...t,
      isTemplate: true,
      type: 'fixed',
      // Garante que o template tenha uma data para exibição no calendário
      date: t.date || `${t.startMonth || '2026-01'}-${String(t.day || '05').padStart(2, '0')}`
    }));
    return [...entries, ...templates];
  },

  // ================================================================
  // INSERÇÃO DE NOVOS ITENS
  // O tipo do item determina se vira lançamento pontual ou template.
  // ================================================================

  async importBatch(items, payments = []) {
    if (!Array.isArray(items) || !Array.isArray(payments)) {
      return { success: false, items: [], error: 'O lote de importação é inválido.' };
    }
    if (items.length + payments.length > MAX_TRANSACTIONAL_IMPORT_ROWS) {
      return {
        success: false,
        items: [],
        error: `A importação excede o limite de ${MAX_TRANSACTIONAL_IMPORT_ROWS} linhas por transação. Reduza a seleção e tente novamente.`
      };
    }
    if (!items.length && !payments.length) {
      return { success: true, items: [], syncResult: { success: true, skipped: true } };
    }

    const newEntries = [];
    const newTemplates = [];
    const addedItems = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return { success: false, items: [], error: 'O lote contém uma linha inválida.' };
      }
      if (item.type === 'fixed' || item.type === 'debt') {
        const date = item.date || getLocalDateString();
        const category = item.category || (item.type === 'debt' ? 'Empréstimo' : 'Contas');
        const template = {
          ...item,
          id: isUuid(item.id) ? item.id : crypto.randomUUID(),
          desc: item.desc,
          amount: parseFloat(item.amount) || 0,
          category,
          type: 'fixed',
          isDebt: item.type === 'debt' || Boolean(item.endMonth) ||
            category === 'Empréstimo' || category === 'Parcelamento',
          active: item.active !== false,
          startMonth: item.month || item.startMonth || date.substring(0, 7),
          endMonth: item.endMonth || null,
          day: date.split('-')[2] || '05',
          date,
          accountId: item.accountId || null,
          paidMonths: item.paidMonths || {}
        };
        newTemplates.push(template);
        addedItems.push(template);
      } else {
        const date = item.date || getLocalDateString();
        const entry = {
          ...item,
          id: isUuid(item.id) ? item.id : crypto.randomUUID(),
          date,
          month: item.month || date.substring(0, 7),
          paymentMethod: null,
          paid: item.paid !== undefined ? item.paid : true
        };
        newEntries.push(entry);
        addedItems.push(entry);
      }
    }

    const previousTemplates = this.getTemplates();
    const templatesById = new Map(previousTemplates.map(template => [template.id, { ...template }]));
    newTemplates.forEach(template => templatesById.set(template.id, template));
    const normalizedPayments = [];
    const paymentKeys = new Set();
    for (const payment of payments) {
      if (!payment || typeof payment.id !== 'string' || !/^\d{4}-\d{2}$/.test(payment.ym || '')) {
        return { success: false, items: [], error: 'Uma baixa do lote de importação é inválida.' };
      }
      const key = `${payment.id}:${payment.ym}`;
      if (paymentKeys.has(key)) continue;
      paymentKeys.add(key);
      const template = templatesById.get(payment.id);
      if (!template) {
        return { success: false, items: [], error: 'Uma baixa do lote não corresponde a um template existente.' };
      }
      if (!template.paidMonths || !template.paidMonths[payment.ym]) {
        template.paidMonths = { ...(template.paidMonths || {}), [payment.ym]: true };
        normalizedPayments.push({ id: payment.id, ym: payment.ym });
      }
    }

    const changedExistingTemplates = [...templatesById.values()].filter(template =>
      !newTemplates.some(newTemplate => newTemplate.id === template.id) &&
      payments.some(payment => payment.id === template.id && normalizedPayments.some(
        normalized => normalized.id === payment.id && normalized.ym === payment.ym
      ))
    );
    const batchTemplates = [...newTemplates, ...changedExistingTemplates];
    if (newEntries.length + batchTemplates.length + normalizedPayments.length >
      MAX_TRANSACTIONAL_IMPORT_ROWS) {
      return {
        success: false,
        items: [],
        error: `A importação excede o limite de ${MAX_TRANSACTIONAL_IMPORT_ROWS} linhas por transação. Reduza a seleção e tente novamente.`
      };
    }
    const operation = {
      operationId: crypto.randomUUID(),
      entries: newEntries,
      templates: batchTemplates,
      payments: normalizedPayments
    };
    const pending = this.getPendingSync();
    pending.transactionalOperations ||= [];
    pending.transactionalOperations.push({ type: 'import', ...operation });
    this.savePendingSync(pending);

    const entryResult = newEntries.length
      ? await this.saveEntries([...this.getEntries(), ...newEntries], { flush: false })
      : { success: true };
    const currentTemplates = this.getTemplates();
    batchTemplates.forEach(template => {
      const index = currentTemplates.findIndex(current => current.id === template.id);
      if (index >= 0) currentTemplates[index] = template;
      else currentTemplates.push(template);
    });
    const templateResult = batchTemplates.length
      ? await this.saveTemplates(currentTemplates, { flush: false })
      : { success: true };
    if (!entryResult.success || !templateResult.success) {
      return {
        success: false,
        items: addedItems,
        error: entryResult.error || templateResult.error || 'Não foi possível preparar o lote local.'
      };
    }

    const syncResult = await this.flushPendingSync(this.getProfile().userId);
    return { success: syncResult.success, items: addedItems, syncResult, error: syncResult.error };
  },

  async addMany(items) {
    return this.importBatch(items, []);
  },

  /**
   * Adiciona um novo item financeiro ao banco.
   * - Tipo 'fixed' ou 'debt' → cria template recorrente via addTemplate().
   * - Tipo 'income' ou 'variable' → cria lançamento pontual.
   *
   * @param {Object} item              - Dados do item.
   * @param {string} item.type         - 'income' | 'fixed' | 'debt' | 'variable'
   * @param {string} item.desc         - Descrição.
   * @param {number} item.amount       - Valor em reais.
   * @param {string} item.month        - Mês de competência YYYY-MM.
   * @param {string} [item.date]       - Data ISO. Padrão: hoje.
   * @returns {Object} Item criado com ID gerado automaticamente.
   */
  add(item) {
    // Gastos fixos e dívidas/parcelamentos são templates recorrentes
    if (item.type === 'fixed' || item.type === 'debt') {
      return this.addTemplate(item);
    }

    // Ganhos e variáveis são lançamentos pontuais de mês único
    const entries = this.getEntries();
    const newItem = {
      ...item,
      id:   crypto.randomUUID(),
      date: item.date || getLocalDateString(),
      paid: item.paid !== undefined ? item.paid : true // Lançamentos nascem confirmados
    };
    entries.push(newItem);
    this.saveEntries(entries);
    return newItem;
  },

  /**
   * Cria um template de gasto fixo recorrente.
   * Chamado internamente por add() quando type === 'fixed' ou 'debt'.
   *
   * @param {Object} tpl - Dados do template (mesmo formato de add()).
   * @returns {Object} Template criado com ID gerado.
   */
  addTemplate(tpl) {
    const templates = this.getTemplates();
    const dateStr   = tpl.date || getLocalDateString();
    const startMonth = tpl.month || tpl.startMonth || dateStr.substring(0, 7);
    // Extrai o dia de vencimento da data (ex: "05" de "2026-11-05")
    const day = dateStr.split('-')[2] || '05';

    const newTemplate = {
      id:         crypto.randomUUID(),
      desc:       tpl.desc,
      amount:     parseFloat(tpl.amount) || 0,
      category:   tpl.category || (tpl.type === 'debt' ? 'Empréstimo' : 'Contas'),
      type:       'fixed',
      // isDebt: sinaliza que é parcelamento ou dívida com data de fim
      isDebt:     tpl.type === 'debt' || Boolean(tpl.endMonth) ||
                  (tpl.category === 'Empréstimo' || tpl.category === 'Parcelamento'),
      active:     true,   // Todo template nasce ativo
      startMonth,
      endMonth:   tpl.endMonth || null,  // null = sem data de quitação prevista
      day:        day,    // Usado para calcular a data de vencimento projetada
      date:       dateStr,
      accountId:  tpl.accountId || null,
      paidMonths: tpl.paid === true ? { [startMonth]: true } : {}
    };

    templates.push(newTemplate);
    this.saveTemplates(templates);
    return newTemplate;
  },

  // ================================================================
  // ATUALIZAÇÃO DE ITENS EXISTENTES
  // Procura o item nas coleções locais para determinar seu tipo.
  // ================================================================

  /**
   * Atualiza campos de um item existente (lançamento ou template).
   * Roteamento pelo ID encontrado na coleção de templates ou lançamentos.
   *
   * @param {string} id            - ID do item a atualizar.
   * @param {Object} updatedFields - Campos a mesclar sobre o item existente.
   * @returns {Object|null} Item atualizado, ou null se não encontrado.
   */
  update(id, updatedFields) {
    // 1. Procura primeiro nos templates
    const templates = this.getTemplates();
    const tplIdx = templates.findIndex(t => t.id === id);
    if (tplIdx !== -1) {
      if (updatedFields.type === 'income' || updatedFields.type === 'variable') {
        console.warn('[GastoPro] Não é possível converter um template recorrente em lançamento pontual pela edição.');
        return null;
      }
      if (updatedFields.date) {
        updatedFields.day = String(updatedFields.date).split('-')[2] || templates[tplIdx].day;
      }
      templates[tplIdx] = { ...templates[tplIdx], ...updatedFields };
      this.saveTemplates(templates);
      return templates[tplIdx];
    }

    // 2. Procura nos lançamentos pontuais
    const entries = this.getEntries();
    const entryIdx = entries.findIndex(e => e.id === id);
    if (entryIdx !== -1) {
      if (updatedFields.type === 'fixed' || updatedFields.type === 'debt') {
        console.warn('[GastoPro] Não é possível converter um lançamento pontual em template recorrente pela edição.');
        return null;
      }
      if (updatedFields.date) {
        updatedFields.month = String(updatedFields.date).substring(0, 7);
      }
      entries[entryIdx] = { ...entries[entryIdx], ...updatedFields };
      this.saveEntries(entries);
      return entries[entryIdx];
    }

    return null;
  },

  // ================================================================
  // TOGGLE DE PAGAMENTO (BAIXA / DESBAIXA)
  // ================================================================

  togglePaid(id, currentYm) {
    const templates = this.getTemplates();
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      if (!tpl.paidMonths) tpl.paidMonths = {};
      tpl.paidMonths[currentYm] = !tpl.paidMonths[currentYm];
      this.saveTemplates(templates);
      return;
    }

    const entries = this.getEntries();
    const item = entries.find(e => e.id === id);
    if (item) {
      item.paid = !item.paid;
      this.saveEntries(entries);
    }
  },

  async markPaid(id, ym) {
    const templates = this.getTemplates();
    const template = templates.find(item => item.id === id);
    if (!template) return { success: false, error: 'Template não encontrado.' };
    if (!template.paidMonths) template.paidMonths = {};
    template.paidMonths[ym] = true;
    return await this.saveTemplates(templates);
  },

  async markPaidMany(payments) {
    const templates = this.getTemplates();
    const currentMonth = getLocalDateString().substring(0, 7);
    let applied = 0;
    payments.forEach(payment => {
      if (payment.ym > currentMonth) return;
      const template = templates.find(item => item.id === payment.id);
      if (!template) return;
      if (!template.paidMonths) template.paidMonths = {};
      template.paidMonths[payment.ym] = true;
      applied++;
    });
    const result = await this.saveTemplates(templates);
    return { success: result.success, applied };
  },

  // ================================================================
  // TOGGLE DE STATUS ATIVO / INATIVO
  // ================================================================

  toggleActive(id) {
    const templates = this.getTemplates();
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      tpl.active = !tpl.active;
      this.saveTemplates(templates);
      return tpl.active;
    }
    return false;
  },

  // ================================================================
  // EXCLUSÃO DE ITENS
  // ================================================================

  async delete(id) {
    const templates = this.getTemplates();
    if (templates.some(template => template.id === id)) {
      return this.saveTemplates(templates.filter(template => template.id !== id));
    }
    return this.saveEntries(this.getEntries().filter(entry => entry.id !== id));
  },

  // ================================================================
  // LIMPEZA TOTAL DA BASE DE DADOS
  // ================================================================

  async deleteAllUserData(confirmation) {
    if (String(confirmation ?? '').trim().toUpperCase() !== 'APAGAR DADOS') {
      return { success: false, error: 'Digite APAGAR DADOS para confirmar a exclusão.' };
    }

    const profile = this.getProfile();
    const userId = profile.userId || this.getActiveUserId();
    if (userId) {
      if (!window.SupabaseAuth ||
        typeof window.SupabaseAuth.deleteAllMyData !== 'function') {
        return { success: false, error: 'Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.' };
      }
      const cloudResult = await window.SupabaseAuth.deleteAllMyData(userId);
      if (!cloudResult || !cloudResult.success) {
        return {
          success: false,
          error: cloudResult && cloudResult.error
            ? cloudResult.error
            : 'Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.'
        };
      }
    }

    try {
      [
        STORAGE_ENTRIES,
        STORAGE_TEMPLATES,
        STORAGE_GOALS,
        STORAGE_ACCOUNTS,
        STORAGE_CREDIT_CARDS,
        STORAGE_CREDIT_CARD_PURCHASES,
        STORAGE_FIXED_IMPORT_RULES,
        STORAGE_PENDING_SYNC,
        STORAGE_SYNC_METADATA,
        STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT
      ].forEach(key => localStorage.removeItem(key));
      const ownerId = profile.userId || this.getActiveUserId();
      if (ownerId) {
        localStorage.removeItem(`${STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT}:${ownerId}`);
        ['income', 'expense'].forEach(kind =>
          localStorage.removeItem(`gastopro_payment_method_preference_v1:${ownerId}:${kind}`)
        );
      }
      const currentProfile = this.getProfile();
      const profileResult = this.saveProfile({
        ...currentProfile,
        name: '',
        avatar: null
      });
      if (!profileResult.success) throw profileResult.error;
      return { success: true };
    } catch (error) {
      console.error('[GastoPro] Falha ao limpar os dados locais do usuário:', error);
      return {
        success: false,
        error: 'Os dados da nuvem foram excluídos, mas não foi possível limpar completamente este aparelho.'
      };
    }
  },

  /**
   * Apaga lançamentos, templates e metas, aguardando a sincronização pendente.
   * Ação irreversível — sempre exibir confirmação ao usuário antes de chamar.
   */
  async clearAll() {
    const profile = this.getProfile();
    const userId = profile.userId || this.getActiveUserId();
    let remoteResetRecords = null;
    if (userId) {
      const auth = window.SupabaseAuth;
      const remoteResult = auth && typeof auth.fetchCloudResetData === 'function'
        ? await auth.fetchCloudResetData(userId)
        : { success: false, error: new Error('A consulta da nuvem não está disponível.') };
      const requiredTables = [
        'entries', 'fixed_templates', 'goals', 'accounts', 'credit_cards',
        'credit_card_purchases', 'fixed_import_rules'
      ];
      if (!remoteResult || !remoteResult.success || !remoteResult.records ||
        requiredTables.some(table => !Array.isArray(remoteResult.records[table]))) {
        const error = remoteResult && remoteResult.error
          ? remoteResult.error
          : new Error('Não foi possível buscar os dados da nuvem. Seus dados não foram alterados.');
        if (typeof showToast === 'function') {
          showToast('Não foi possível consultar a nuvem. Seus dados continuam salvos neste aparelho.');
        }
        return { success: false, error };
      }
      remoteResetRecords = remoteResult.records;
    }

    await this.saveEntries([], { flush: false });
    await this.saveTemplates([], { flush: false });
    await this.saveAccounts([], { flush: false });
    await this.saveCreditCardPurchases([], { flush: false });
    await this.saveCreditCards([], { flush: false });
    this.saveGoals([]);
    await this.saveFixedImportRules([], { flush: false });
    if (window.GastoProInsightDismissal) {
      window.GastoProInsightDismissal.clear();
    } else {
      try {
        localStorage.removeItem('gastopro_dismissed_insights_v1');
      } catch (error) {
        console.warn('[GastoPro] Não foi possível limpar insights dispensados:', error);
      }
    }
    localStorage.removeItem(STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT);
    const ownerId = profile.userId || this.getActiveUserId();
    if (ownerId) {
      localStorage.removeItem(`${STORAGE_LEGACY_CREDIT_CARD_PREVIOUS_SPENT}:${ownerId}`);
    }
    if (remoteResetRecords) {
      const pending = this.getPendingSync();
      const metadata = this.getSyncMetadata();
      const remoteKinds = [
        ['entries', 'entries', 'deletedEntries'],
        ['fixed_templates', 'templates', 'deletedTemplates'],
        ['accounts', 'accounts', 'deletedAccounts'],
        ['credit_cards', 'creditCards', 'deletedCreditCards'],
        ['credit_card_purchases', 'creditCardPurchases', 'deletedCreditCardPurchases'],
        ['goals', 'goals', 'deletedGoals']
      ];
      remoteKinds.forEach(([table, kind, pendingKey]) => {
        metadata.deleted[kind] ||= {};
        const rows = remoteResetRecords[table] || [];
        rows.forEach(row => {
          const id = row.id;
          if (!id) return;
          if (!pending[pendingKey].includes(id)) pending[pendingKey].push(id);
          const current = metadata.deleted[kind][id];
          const remoteUpdatedAt = Date.parse(row.updatedAt || '');
          const clockOffset = Number(metadata.clockOffsetMs) || 0;
          const editedAt = Math.max(
            Date.now(),
            Number.isFinite(remoteUpdatedAt) ? remoteUpdatedAt + 5000 - clockOffset : 0
          );
          metadata.deleted[kind][id] = {
            updatedAt: current && current.updatedAt || row.updatedAt || null,
            editedAt: new Date(editedAt).toISOString()
          };
        });
      });
      if (!(remoteResetRecords.fixed_import_rules || []).length) {
        pending.fixedImportRules = false;
      }
      this.savePendingSync(pending);
      this.saveSyncMetadata(metadata);
    }
    return this.flushPendingSync(userId);
  },

  // ================================================================
  // EXPORTAÇÃO DE BACKUP JSON
  // ================================================================

  /**
   * Gera e dispara o download de um arquivo JSON com todos os dados.
   * O arquivo pode ser usado como backup portátil ou inspeção manual.
   *
   * Estrutura do backup exportado:
   * {
   *   version:    "4.0",
   *   exportDate: "2026-11-05T10:00:00.000Z",
   *   entries:    [...],    // Todos os lançamentos pontuais
   *   templates:  [...],    // Todos os templates de gastos fixos
   *   goals:      [...],     // Metas de gastos por categoria
   *   accounts:   [...]      // Contas bancárias
   * }
   */
  exportJSON(options = {}) {
    const backup = {
      version:    '4.0',
      exportDate: new Date().toISOString(),
      entries:    this.getEntries(),
      templates:  this.getTemplates(),
      goals:      this.getGoals(),
      accounts:   this.getAccounts(),
      creditCards: this.getCreditCards(),
      creditCardPurchases: this.getCreditCardPurchases(),
      fixedImportRules: this.getFixedImportRules()
    };
    if (Array.isArray(options.feedbackMessages)) {
      backup.feedbackMessages = options.feedbackMessages;
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', objectUrl);
    dlAnchor.setAttribute('download', `gastopro_backup_${getLocalDateString()}.json`);
    dlAnchor.style.display = 'none';
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    return backup;
  },

  async exportAllUserData() {
    const profile = this.getProfile();
    const userId = profile.userId || this.getActiveUserId();
    let feedbackMessages = [];
    if (userId) {
      if (!window.SupabaseAuth ||
        typeof window.SupabaseAuth.fetchMyFeedback !== 'function') {
        return { success: false, error: 'Não foi possível exportar as mensagens da sua conta.' };
      }
      const result = await window.SupabaseAuth.fetchMyFeedback();
      if (!result || !result.success) {
        return {
          success: false,
          error: result && result.error
            ? result.error
            : 'Não foi possível exportar as mensagens da sua conta.'
        };
      }
      feedbackMessages = result.messages;
    }
    return { success: true, backup: this.exportJSON({ feedbackMessages }) };
  },

  async importJSON(text, mode = 'merge') {
    const imported = validateBackupText(text);
    if (imported.error) return { success: false, error: imported.error };
    let restored;
    try {
      restored = mergeBackupData({
        entries: this.getEntries(),
        templates: this.getTemplates(),
        goals: this.getGoals(),
        accounts: this.getAccounts(),
        creditCards: this.getCreditCards(),
        creditCardPurchases: this.getCreditCardPurchases(),
        fixedImportRules: this.getFixedImportRules()
      }, imported, mode);
    } catch (error) {
      return { success: false, error: error.message };
    }

    const accountsResult = await this.saveAccounts(restored.accounts);
    const creditCardsResult = await this.saveCreditCards(restored.creditCards, { flush: false });
    const creditCardPurchasesResult = await this.saveCreditCardPurchases(
      restored.creditCardPurchases, { flush: false }
    );
    const [entriesResult, templatesResult] = await Promise.all([
      this.saveEntries(restored.entries),
      this.saveTemplates(restored.templates)
    ]);
    if (!this.saveGoals(restored.goals)) {
      return { success: false, error: 'Lançamentos e gastos fixos restaurados, mas não foi possível salvar as metas localmente.' };
    }
    const rulesResult = await this.saveFixedImportRules(restored.fixedImportRules, { flush: false });
    if (!rulesResult.success) return rulesResult;
    const goalsSyncResult = await this.flushPendingSync(this.getProfile().userId);
    if (!accountsResult.success || !creditCardsResult.success || !creditCardPurchasesResult.success ||
      !entriesResult.success || !templatesResult.success || !goalsSyncResult.success) {
      return { success: false, error: 'O backup foi restaurado localmente, mas há alterações pendentes de sincronização.' };
    }
    return { success: true };
  },

  // ================================================================
  // PERFIL DO USUÁRIO
  // ================================================================

  /**
   * Lê o perfil do usuário salvo no localStorage.
   * Se não existir, retorna o perfil padrão (nome vazio, sem foto).
   *
   * @returns {{ name: string, avatar: string|null }} Perfil do usuário.
   */
  getProfile() {
    const defaultProfile = { name: '', email: '', avatar: null };
    try {
      const stored = localStorage.getItem(STORAGE_PROFILE);
      // Mescla com o default para garantir novos campos em versões futuras
      return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
    } catch (e) {
      return defaultProfile;
    }
  },

  /**
   * Salva o perfil do usuário no localStorage.
   * O avatar é armazenado como uma Data URL (Base64) gerada pelo FileReader.
   *
   * @param {{ name: string, avatar: string|null }} profile - Dados do perfil.
   */
  saveProfile(profile, { queueSync = false } = {}) {
    try {
      localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
      if (queueSync && profile && profile.userId) this.queueProfileSync();
      return { success: true };
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar perfil no localStorage:', e);
      return { success: false, error: e };
    }
  },

  // ================================================================
  // METAS DE TETO DE GASTOS POR CATEGORIA
  // ================================================================

  /**
   * Lê todas as metas de teto de gastos por categoria.
   * Cada meta: { id, category, limit }
   *
   * @returns {Array<Object>} Lista de metas.
   */
  getGoals() {
    try {
      const stored = localStorage.getItem(STORAGE_GOALS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[GastoPro] Erro ao ler metas:', e);
      return [];
    }
  },

  /**
   * Persiste a lista completa de metas de categoria.
   *
   * @param {Array<Object>} goals - Array de metas a salvar.
   */
  saveGoals(goals) {
    try {
      const previousGoals = this.getGoals();
      this.queueGoalChanges(previousGoals, goals);
      localStorage.setItem(STORAGE_GOALS, JSON.stringify(goals));
      return true;
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar metas:', e);
      return false;
    }
  },

  /**
   * Adiciona ou atualiza a meta de uma categoria específica.
   * Se já existe uma meta para a categoria, substitui o limite.
   *
   * @param {string} category - Nome da categoria.
   * @param {number} limit    - Limite de gasto em R$.
   * @returns {Object} Meta salva.
   */
  saveGoal(category, limit) {
    const goals = this.getGoals();
    const existing = goals.findIndex(g => g.category === category);
    const goal = {
      id: existing >= 0 ? goals[existing].id : 'goal-' + crypto.randomUUID(),
      category,
      limit: parseFloat(limit) || 0
    };
    if (existing >= 0) {
      goals[existing] = goal;
    } else {
      goals.push(goal);
    }
    this.saveGoals(goals);
    const profile = this.getProfile();
    this.flushPendingSync(profile && profile.userId)
      .catch(error => console.error('[GastoPro] Erro ao sincronizar meta:', error));
    return goal;
  },

  /**
   * Remove a meta de uma categoria.
   *
   * @param {string} category - Nome da categoria a remover.
   */
  deleteGoal(category) {
    const goals = this.getGoals().filter(g => g.category !== category);
    this.saveGoals(goals);
    const profile = this.getProfile();
    this.flushPendingSync(profile && profile.userId)
      .catch(error => console.error('[GastoPro] Erro ao sincronizar exclusão de meta:', error));
  }
};

window.FinanceData = FinanceData;
