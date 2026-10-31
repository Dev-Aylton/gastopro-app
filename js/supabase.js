/**
 * GastoPro — Módulo de Integração Supabase
 * Gerencia autenticação de múltiplos usuários e persistência na nuvem (PostgreSQL).
 */

const SUPABASE_URL = 'https://xfjhgzcqlrhpckqwnqtk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-TwM1I7tRwAQWveicUTWsw_1ZkCueNt';
const USAGE_EVENT_NAMES = Object.freeze([
  'screen_dashboard',
  'screen_incomes',
  'screen_expenses',
  'screen_accounts',
  'screen_contact',
  'screen_import',
  'import_completed',
  'import_parse_error',
  'import_save_error',
  'sync_error'
]);

window.GastoProTelemetryConstants = { eventNames: USAGE_EVENT_NAMES };

// Inicializa o cliente oficial do Supabase
const sb = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

function isValidCloudMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= 1 && month >= 1 && month <= 12;
}

function isValidCloudDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidCloudUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateCloudPayload(item, kind) {
  if (!item || typeof item !== 'object') return 'Registro inválido.';
  if (kind === 'accounts') {
    const balance = item.initialBalance;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 100) {
      return 'O nome da conta deve ter de 1 a 100 caracteres.';
    }
    if (item.institution != null &&
      (typeof item.institution !== 'string' || item.institution.length > 100)) {
      return 'A instituição deve ter até 100 caracteres.';
    }
    if (!['PF', 'PJ'].includes(item.type)) return 'O tipo da conta deve ser PF ou PJ.';
    if (balance == null || balance === '' || typeof balance === 'boolean' ||
      !Number.isFinite(Number(balance)) || Math.abs(Number(balance)) > 9999999999.99) {
      return 'O saldo inicial da conta deve ser válido.';
    }
    if (item.balanceDate != null && item.balanceDate !== '' && !isValidCloudDate(item.balanceDate)) {
      return 'A data do saldo inicial da conta deve ser válida.';
    }
    return null;
  }
  if (kind === 'creditCards') {
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 100) {
      return 'O nome do cartão deve ter de 1 a 100 caracteres.';
    }
    if (typeof item.totalLimit === 'boolean' || !Number.isFinite(Number(item.totalLimit)) ||
      Number(item.totalLimit) <= 0 || Number(item.totalLimit) > 9999999999.99) {
      return 'O limite total do cartão deve ser válido.';
    }
    if (!Number.isInteger(item.closingDay) || item.closingDay < 1 || item.closingDay > 31 ||
      !Number.isInteger(item.dueDay) || item.dueDay < 1 || item.dueDay > 31) {
      return 'Os dias de fechamento e vencimento devem estar entre 1 e 31.';
    }
    if (item.accountId != null && !isValidCloudUuid(item.accountId)) {
      return 'A conta vinculada ao cartão deve ter um UUID válido.';
    }
    if (item.previousSpent != null &&
      (typeof item.previousSpent === 'boolean' || !Number.isFinite(Number(item.previousSpent)) ||
        Number(item.previousSpent) < 0 || Number(item.previousSpent) > 9999999999.99)) {
      return 'O gasto anterior do cartão deve ser um valor não negativo válido.';
    }
    if (item.brand != null && ![
      'Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'
    ].includes(item.brand)) {
      return 'A bandeira do cartão é inválida.';
    }
    if (item.issuerBank != null && ![
      'Nubank', 'Itaú', 'Bradesco', 'Santander', 'Banco do Brasil', 'Caixa',
      'Inter', 'C6', 'BTG', 'Mercado Pago', 'PicPay', 'Outro'
    ].includes(item.issuerBank)) {
      return 'O banco emissor do cartão é inválido.';
    }
    if (item.lastFour != null && item.lastFour !== '' &&
      (typeof item.lastFour !== 'string' || !/^\d{4}$/.test(item.lastFour))) {
      return 'O final do cartão deve conter quatro dígitos.';
    }
    if (item.customColor != null &&
      (typeof item.customColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.customColor))) {
      return 'A cor personalizada do cartão é inválida.';
    }
    return null;
  }
  if (kind === 'creditCardPurchases') {
    if (typeof item.desc !== 'string' || !item.desc.trim() || item.desc.length > 300 ||
      typeof item.category !== 'string' || !item.category.trim() || item.category.length > 100) {
      return 'A descrição e a categoria da compra devem ser válidas.';
    }
    if (typeof item.amount === 'boolean' || !Number.isFinite(Number(item.amount)) ||
      Number(item.amount) <= 0 || Number(item.amount) > 9999999999.99) {
      return 'O valor da compra deve ser positivo e válido.';
    }
    if (!isValidCloudDate(item.purchaseDate)) return 'A data da compra deve ser válida.';
    if (!Number.isInteger(item.installmentCount) || item.installmentCount < 1 ||
      item.installmentCount > 24) return 'A quantidade de parcelas deve estar entre 1 e 24.';
    if (!Number.isInteger(item.closingDay) || item.closingDay < 1 || item.closingDay > 31 ||
      !Number.isInteger(item.dueDay) || item.dueDay < 1 || item.dueDay > 31) {
      return 'Os dias de fechamento e vencimento devem estar entre 1 e 31.';
    }
    if (typeof item.cardName !== 'string' || !item.cardName.trim() || item.cardName.length > 100) {
      return 'O nome de referência do cartão é inválido.';
    }
    if (item.cardId != null && !isValidCloudUuid(item.cardId)) {
      return 'O cartão da compra deve ter um UUID válido.';
    }
    if (item.accountId != null && !isValidCloudUuid(item.accountId)) {
      return 'A conta vinculada à compra deve ter um UUID válido.';
    }
    if (!Array.isArray(item.paidInstallments) || item.paidInstallments.some(number =>
      !Number.isInteger(number) || number < 1 || number > item.installmentCount
    ) || new Set(item.paidInstallments).size !== item.paidInstallments.length) {
      return 'As parcelas pagas não são válidas.';
    }
    if (!item.paidDates || typeof item.paidDates !== 'object' || Array.isArray(item.paidDates) ||
      Object.entries(item.paidDates).some(([number, date]) =>
        !/^\d+$/.test(number) || Number(number) < 1 ||
        Number(number) > item.installmentCount ||
        !item.paidInstallments.includes(Number(number)) || !isValidCloudDate(date)
      )) {
      return 'As datas de pagamento das parcelas não são válidas.';
    }
    return null;
  }
  if (item.amount == null || item.amount === '' || typeof item.amount === 'boolean') return 'O valor deve ser finito e maior ou igual a zero.';
  if (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0) return 'O valor deve ser finito e maior ou igual a zero.';
  if (typeof item.desc !== 'string' || item.desc.length < 1 || item.desc.length > 300) return 'A descrição deve ter de 1 a 300 caracteres.';
  if (typeof item.category !== 'string' || item.category.length < 1 || item.category.length > 100) return 'A categoria deve ter de 1 a 100 caracteres.';

  if (kind === 'entries') {
    if (!['income', 'variable', 'fixed', 'debt'].includes(item.type)) return 'Tipo de lançamento inválido.';
    if (!isValidCloudDate(item.date)) return 'A data do lançamento deve ser uma data válida no formato AAAA-MM-DD.';
    if (item.accountId != null && !isValidCloudUuid(item.accountId)) return 'A conta do lançamento deve ter um UUID válido.';
    if (item.paymentMethod != null && ![
      'pix', 'debit', 'cash', 'credit_card', 'boleto', 'transfer', 'other'
    ].includes(item.paymentMethod)) return 'A forma de pagamento do lançamento é inválida.';
    return null;
  }

  if (kind === 'templates') {
    if (!['fixed', 'debt', 'variable'].includes(item.type || 'fixed')) return 'Tipo de template inválido.';
    if (!isValidCloudMonth(item.startMonth)) return 'O mês inicial deve estar no formato AAAA-MM.';
    if (item.endMonth && !isValidCloudMonth(item.endMonth)) return 'O mês final deve estar no formato AAAA-MM.';
    if (item.day != null && !/^\d{2}$/.test(String(item.day))) return 'O dia deve ter dois dígitos.';
    if (item.accountId != null && !isValidCloudUuid(item.accountId)) return 'A conta do template deve ter um UUID válido.';
    return null;
  }

  return 'Tipo de registro inválido.';
}

function mapEntryFromCloud(row) {
  return {
    id: row.id,
    desc: row.description,
    amount: Number(row.amount),
    category: row.category,
    type: row.type,
    date: row.date,
    month: row.date ? String(row.date).substring(0, 7) : '',
    paid: Boolean(row.paid),
    isDebt: Boolean(row.is_debt),
    debtInfo: row.debt_info,
    active: row.active !== false,
    accountId: row.account_id || null,
    paymentMethod: row.payment_method || null
  };
}

function mapEntryToCloud(entry) {
  return {
    description: entry.desc,
    amount: entry.amount,
    category: entry.category,
    type: entry.type,
    date: entry.date,
    paid: Boolean(entry.paid),
    is_debt: Boolean(entry.isDebt),
    debt_info: entry.debtInfo || null,
    active: entry.active !== false,
    account_id: entry.accountId || null,
    payment_method: entry.paymentMethod || null
  };
}

function mapCreditCardFromCloud(row) {
  return {
    id: row.id,
    name: row.name,
    totalLimit: Number(row.total_limit),
    closingDay: row.closing_day,
    dueDay: row.due_day,
    brand: row.brand || 'Outra',
    issuerBank: row.issuer_bank || 'Outro',
    lastFour: row.last_four || null,
    customColor: row.custom_color || null,
    accountId: row.account_id || null,
    previousSpent: Number(row.previous_spent) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCreditCardToCloud(card) {
  return {
    name: card.name.trim(),
    total_limit: Math.round(Number(card.totalLimit) * 100) / 100,
    closing_day: card.closingDay,
    due_day: card.dueDay,
    brand: card.brand || 'Outra',
    issuer_bank: card.issuerBank || 'Outro',
    last_four: card.lastFour || null,
    custom_color: card.issuerBank === 'Outro' ? card.customColor || '#6366f1' : null,
    account_id: card.accountId || null,
    previous_spent: Math.round((Number(card.previousSpent) || 0) * 100) / 100
  };
}

window.GastoProSyncFieldHelpers = {
  entryFromCloud: mapEntryFromCloud,
  entryToCloud: mapEntryToCloud,
  creditCardFromCloud: mapCreditCardFromCloud,
  creditCardToCloud: mapCreditCardToCloud
};

const FEEDBACK_CATEGORIES = {
  duvida: 'Dúvida',
  sugestao: 'Sugestão',
  problema: 'Problema'
};

function validateFeedbackMessage(category, message) {
  if (!Object.prototype.hasOwnProperty.call(FEEDBACK_CATEGORIES, category)) {
    return 'Selecione uma categoria válida.';
  }
  if (typeof message !== 'string') return 'A mensagem deve ter de 10 a 1000 caracteres.';
  const trimmedMessage = message.trim();
  if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
    return 'A mensagem deve ter de 10 a 1000 caracteres após remover espaços extras.';
  }
  return null;
}

function getFeedbackStatusLabel(status) {
  return status === 'answered' ? 'Respondida' : 'Enviada';
}

function getFeedbackCharacterCount(message) {
  return typeof message === 'string' ? message.length : 0;
}

function validateFeedbackReply(reply) {
  if (typeof reply !== 'string') return 'A resposta deve ter de 1 a 2000 caracteres.';
  const trimmedReply = reply.trim();
  return trimmedReply.length >= 1 && trimmedReply.length <= 2000
    ? null
    : 'A resposta deve ter de 1 a 2000 caracteres após remover espaços extras.';
}

function sanitizeAdminAnalytics(data) {
  const isCount = value => Number.isSafeInteger(value) && value >= 0;
  const isPeriod = value => typeof value === 'string' &&
    (/^\d{4}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value));
  const isMetricList = (items, validNames) => Array.isArray(items) && items.every(item =>
    item && typeof item === 'object' &&
    validNames.includes(item.name) &&
    isCount(item.count) &&
    Object.keys(item).every(key => ['name', 'count'].includes(key))
  );
  const users = data && data.users;
  const records = data && data.records;
  const feedback = data && data.feedback;
  const usage = data && data.usage;
  const registrations = data && data.registrations;
  const screenNames = USAGE_EVENT_NAMES.filter(name => name.startsWith('screen_'));
  const errorNames = ['import_parse_error', 'import_save_error', 'sync_error'];
  const feedbackStatuses = ['new', 'answered'];
  const feedbackCategories = ['duvida', 'sugestao', 'problema'];

  if (!data || typeof data !== 'object' ||
    !users || !records || !feedback || !usage ||
    !['total', 'newWeek', 'newMonth', 'active7Days', 'active30Days'].every(key => isCount(users[key])) ||
    !['entries', 'accounts', 'cards', 'goals'].every(key => isCount(records[key])) ||
    !Array.isArray(registrations) || registrations.some(item =>
      !item || typeof item !== 'object' || !isPeriod(item.period) || !isCount(item.count) ||
      Object.keys(item).some(key => !['period', 'count'].includes(key))
    ) ||
    !isMetricList(feedback.status, feedbackStatuses) ||
    !isMetricList(feedback.categories, feedbackCategories) ||
    !isCount(usage.uniqueUsers30Days) ||
    !isMetricList(usage.screens, screenNames) ||
    !Array.isArray(usage.importsByDay) || usage.importsByDay.some(item =>
      !item || typeof item !== 'object' || !isPeriod(item.period) || !isCount(item.count) ||
      Object.keys(item).some(key => !['period', 'count'].includes(key))
    ) ||
    !isMetricList(usage.errors, errorNames) ||
    Object.keys(data).some(key => !['users', 'registrations', 'records', 'feedback', 'usage'].includes(key)) ||
    Object.keys(users).some(key => !['total', 'newWeek', 'newMonth', 'active7Days', 'active30Days'].includes(key)) ||
    Object.keys(records).some(key => !['entries', 'accounts', 'cards', 'goals'].includes(key)) ||
    Object.keys(feedback).some(key => !['status', 'categories'].includes(key)) ||
    Object.keys(usage).some(key => !['uniqueUsers30Days', 'screens', 'importsByDay', 'errors'].includes(key))) {
    return null;
  }

  return {
    users: {
      total: users.total,
      newWeek: users.newWeek,
      newMonth: users.newMonth,
      active7Days: users.active7Days,
      active30Days: users.active30Days
    },
    registrations: registrations.map(item => ({ period: item.period, count: item.count })),
    records: {
      entries: records.entries,
      accounts: records.accounts,
      cards: records.cards,
      goals: records.goals
    },
    feedback: {
      status: feedback.status.map(item => ({ name: item.name, count: item.count })),
      categories: feedback.categories.map(item => ({ name: item.name, count: item.count }))
    },
    usage: {
      uniqueUsers30Days: usage.uniqueUsers30Days,
      screens: usage.screens.map(item => ({ name: item.name, count: item.count })),
      importsByDay: usage.importsByDay.map(item => ({ period: item.period, count: item.count })),
      errors: usage.errors.map(item => ({ name: item.name, count: item.count }))
    }
  };
}

function buildFeedbackReplyPayload(reply, repliedAt) {
  const validationError = validateFeedbackReply(reply);
  if (validationError) return { error: validationError, payload: null };
  const timestamp = new Date(repliedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return { error: 'Não foi possível registrar a data da resposta.', payload: null };
  }
  return {
    error: null,
    payload: {
      reply: reply.trim(),
      status: 'answered',
      replied_at: timestamp.toISOString()
    }
  };
}

function filterFeedbackByStatus(messages, status = 'all') {
  if (status === 'all') return messages.slice();
  return messages.filter(message => message.status === status);
}

function sortFeedbackMessages(messages, status = 'all') {
  const direction = status === 'new' ? 1 : -1;
  return messages.slice().sort((left, right) => {
    const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
    return timeDifference === 0 ? String(left.id).localeCompare(String(right.id)) : timeDifference * direction;
  });
}

function countNewFeedback(messages) {
  return messages.filter(message => message.status === 'new').length;
}

function getFeedbackAdminLabel(index) {
  return `Mensagem #${Number(index) + 1}`;
}

window.GastoProFeedbackHelpers = {
  categories: FEEDBACK_CATEGORIES,
  validateMessage: validateFeedbackMessage,
  getStatusLabel: getFeedbackStatusLabel,
  getCharacterCount: getFeedbackCharacterCount,
  validateReply: validateFeedbackReply,
  buildReplyPayload: buildFeedbackReplyPayload,
  filterByStatus: filterFeedbackByStatus,
  sortMessages: sortFeedbackMessages,
  countNew: countNewFeedback,
  getAdminLabel: getFeedbackAdminLabel
};

const SupabaseAuth = {
  client: sb,
  syncRealtimeChannel: null,
  syncRealtimeUserId: null,

  isSyncServerReady() {
    return Boolean(sb && this.client === sb);
  },

  subscribeToSyncChanges(userId, onChange, onFailure) {
    const client = this.client;
    if (!client || typeof client.channel !== 'function' || !userId) return false;
    if (this.syncRealtimeChannel && this.syncRealtimeUserId === userId) return true;
    this.unsubscribeFromSyncChanges();

    const channel = client.channel(`gastopro-sync-${userId}`);
    const tables = [
      ['entries', 'user_id'],
      ['fixed_templates', 'user_id'],
      ['profiles', 'id'],
      ['goals', 'user_id'],
      ['accounts', 'user_id'],
      ['credit_cards', 'user_id'],
      ['credit_card_purchases', 'user_id'],
      ['fixed_import_rules', 'user_id']
    ];
    tables.forEach(([table, ownerColumn]) => {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `${ownerColumn}=eq.${userId}`
      }, payload => {
        if (payload.eventType === 'DELETE' || !payload.new) return;
        const change = this.normalizeSyncRealtimeRecord(table, payload.new);
        if (change) onChange({ ...change, eventType: payload.eventType });
      });
    });
    this.syncRealtimeUserId = userId;
    this.syncRealtimeChannel = channel;
    try {
      channel.subscribe(status => {
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) &&
          this.syncRealtimeChannel === channel && this.syncRealtimeUserId === userId) {
          onFailure(status);
        }
      });
      return true;
    } catch (error) {
      this.unsubscribeFromSyncChanges();
      onFailure(error);
      return false;
    }
  },

  unsubscribeFromSyncChanges() {
    const channel = this.syncRealtimeChannel;
    this.syncRealtimeChannel = null;
    this.syncRealtimeUserId = null;
    const client = this.client;
    if (!channel || !client || typeof client.removeChannel !== 'function') return Promise.resolve();
    return client.removeChannel(channel).catch(error => {
      console.warn('[Supabase] Falha ao encerrar o canal Realtime:', error);
    });
  },

  normalizeSyncRealtimeRecord(table, row) {
    const base = { version: row.updated_at, deletedAt: row.deleted_at || null };
    switch (table) {
      case 'entries':
        return { ...base, kind: 'entries', item: mapEntryFromCloud(row) };
      case 'fixed_templates':
        return { ...base, kind: 'templates', item: {
          id: row.id, desc: row.description, amount: Number(row.amount), category: row.category,
          type: row.type || 'fixed', isDebt: Boolean(row.is_debt), active: row.active !== false,
          startMonth: row.start_month, endMonth: row.end_month || null, day: row.day || '01',
          paidMonths: row.paid_months || {}, accountId: row.account_id || null
        } };
      case 'profiles':
        return { ...base, kind: 'profiles', item: {
          id: row.id, name: row.name || '', avatar: row.avatar || null
        } };
      case 'goals':
        return { ...base, kind: 'goals', item: {
          id: `goal-${crypto.randomUUID()}`, category: row.category, limit: Number(row.limit_amount)
        } };
      case 'accounts':
        return { ...base, kind: 'accounts', item: {
          id: row.id, name: row.name, institution: row.institution || null, type: row.type,
          initialBalance: Number(row.initial_balance), balanceDate: row.balance_date || null,
          createdAt: row.created_at, updatedAt: row.updated_at
        } };
      case 'credit_cards':
        return { ...base, kind: 'creditCards', item: mapCreditCardFromCloud(row) };
      case 'credit_card_purchases':
        return { ...base, kind: 'creditCardPurchases', item: {
          id: row.id, cardId: row.card_id || null, cardName: row.card_name,
          accountId: row.account_id || null, desc: row.description, amount: Number(row.amount),
          category: row.category, purchaseDate: row.purchase_date,
          installmentCount: row.installment_count, closingDay: row.closing_day,
          dueDay: row.due_day, paidInstallments: Array.isArray(row.paid_installments)
            ? row.paid_installments : [],
          paidDates: row.paid_dates && typeof row.paid_dates === 'object' ? row.paid_dates : {},
          createdAt: row.created_at, updatedAt: row.updated_at
        } };
      case 'fixed_import_rules':
        return { ...base, kind: 'fixedImportRules', item: {
          rules: Array.isArray(row.rules) ? row.rules : []
        } };
      default:
        return null;
    }
  },

  async fetchAllPages(fetchPage) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await fetchPage(from, from + 999);
      if (error || !Array.isArray(data)) return null;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },

  async getSyncServerTime() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client.rpc('get_sync_server_time');
      return error || !data ? null : data;
    } catch (error) {
      return null;
    }
  },

  async fetchCloudSyncState(userId) {
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const definitions = [
      ['entries', 'entries', 'id', 'user_id'],
      ['templates', 'fixed_templates', 'id', 'user_id'],
      ['profiles', 'profiles', 'id', 'id'],
      ['goals', 'goals', 'category', 'user_id'],
      ['accounts', 'accounts', 'id', 'user_id'],
      ['creditCards', 'credit_cards', 'id', 'user_id'],
      ['creditCardPurchases', 'credit_card_purchases', 'id', 'user_id'],
      ['fixedImportRules', 'fixed_import_rules', 'user_id', 'user_id']
    ];
      const versions = {};
      const tombstones = {};
      for (const [kind, table, keyColumn, ownerColumn] of definitions) {
        const rows = await this.fetchAllPages((from, to) => this.client.from(table)
          .select(`${keyColumn},updated_at,deleted_at`)
          .eq(ownerColumn, sessionUserId)
          .range(from, to));
        if (!rows) return null;
        versions[kind] = {};
        tombstones[kind] = {};
        rows.forEach(row => {
          const key = row[keyColumn];
          if (row.updated_at) versions[kind][key] = row.updated_at;
          if (row.deleted_at) tombstones[kind][key] = row.updated_at || row.deleted_at;
        });
      }
      return { versions, tombstones };
    } catch (error) {
      return null;
    }
  },

  async upsertWithFallback(upsert, items, payloads, keyField = 'id', kind = null) {
    let batchError = null;
    try {
      const { data, error } = await upsert(payloads);
      batchError = error;
      if (!batchError) {
        const conflictIds = Array.isArray(data)
          ? items.filter((item, index) => !data.some(row => row[keyField] ===
            (keyField === 'id' ? item.id : item[keyField]))).map(item => item.id || item[keyField])
          : [];
        const versions = Object.fromEntries((data || []).filter(row => row.updated_at)
          .map(row => [row[keyField], row.updated_at]));
        if (kind) window.FinanceData?.saveCloudSyncVersions(kind, versions);
        return { failedIds: [], conflictIds, versions };
      }
    } catch (error) {
      batchError = error;
    }

    console.warn('[Supabase] Falha no upsert em lote; tentando cada linha separadamente:', batchError.message || batchError);
    const failedIds = [];
    const conflictIds = [];
    const versions = {};
    for (let index = 0; index < items.length; index++) {
      try {
        const { data, error } = await upsert(payloads[index]);
        if (error) {
          failedIds.push(items[index].id);
          console.warn('[Supabase] Linha não sincronizada:', { id: items[index].id, error: error.message });
        } else if (Array.isArray(data) && !data.length) {
          conflictIds.push(items[index].id);
        } else if (Array.isArray(data) && data[0] && data[0].updated_at) {
          versions[data[0][keyField]] = data[0].updated_at;
        }
      } catch (error) {
        failedIds.push(items[index].id);
        console.warn('[Supabase] Linha não sincronizada:', { id: items[index].id, error: error.message || error });
      }
    }
    if (kind) window.FinanceData?.saveCloudSyncVersions(kind, versions);
    return { failedIds, conflictIds, versions };
  },

  async getSessionState() {
    if (!this.client) {
      return { status: 'indeterminate', error: new Error('Cliente Supabase não inicializado.') };
    }
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) {
        console.warn('[Supabase] Não foi possível verificar a sessão:', error);
        return { status: 'indeterminate', error };
      }
      const user = data && data.session && data.session.user;
      return user
        ? { status: 'authenticated', user }
        : { status: 'signed_out', user: null };
    } catch (e) {
      console.warn('[Supabase] Não foi possível verificar a sessão:', e);
      return { status: 'indeterminate', error: e };
    }
  },

  async getSessionUser() {
    const state = await this.getSessionState();
    return state.status === 'authenticated' ? state.user : null;
  },

  async getAuthenticatedUserId(expectedUserId) {
    const user = await this.getSessionUser();
    if (!user || (expectedUserId && user.id !== expectedUserId)) return null;
    return user.id;
  },

  async checkIsAdmin() {
    if (!this.client) return false;
    try {
      const sessionState = await this.getSessionState();
      if (sessionState.status !== 'authenticated') return false;
      const { data, error } = await this.client.rpc('is_admin');
      return !error && data === true;
    } catch (error) {
      console.warn('[Supabase] Não foi possível confirmar acesso administrativo:', error);
      return false;
    }
  },

  async fetchAdminAnalytics() {
    if (!this.client || !(await this.checkIsAdmin())) {
      return { success: false, error: 'Área restrita.' };
    }
    try {
      const { data, error } = await this.client.rpc('admin_analytics_summary');
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      const analytics = sanitizeAdminAnalytics(data);
      if (!analytics) {
        return { success: false, error: 'Os indicadores recebidos do servidor são inválidos.' };
      }
      return { success: true, analytics };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async recordUsageEvent(eventName) {
    if (!USAGE_EVENT_NAMES.includes(eventName)) {
      return { success: false, error: 'Evento de uso não permitido.' };
    }
    if (window.GastoProUsageTelemetry &&
      !window.GastoProUsageTelemetry.getEnabled()) {
      return { success: true, skipped: true };
    }
    if (!this.client) {
      return { success: false, error: 'Cliente Supabase não inicializado.' };
    }
    try {
      const sessionState = await this.getSessionState();
      if (sessionState.status === 'signed_out') return { success: true, skipped: true };
      if (sessionState.status !== 'authenticated' || !sessionState.user.id) {
        return { success: false, error: 'Não foi possível verificar a sessão.' };
      }
      if (window.GastoProUsageTelemetry &&
        !window.GastoProUsageTelemetry.getEnabled()) {
        return { success: true, skipped: true };
      }
      const { error } = await this.client.from('usage_events').insert({
        user_id: sessionState.user.id,
        event_name: eventName
      });
      if (error) {
        const result = this.reportCloudError('Erro ao registrar evento de uso', error);
        return { success: false, error: result.error.message };
      }
      return { success: true };
    } catch (error) {
      const result = this.reportCloudError('Falha ao registrar evento de uso', error);
      return { success: false, error: result.error.message };
    }
  },

  async countNewFeedback() {
    if (!this.client || !(await this.checkIsAdmin())) {
      return { success: false, error: 'Acesso restrito.' };
    }
    try {
      const { count, error } = await this.client.from('feedback_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      return { success: true, count: Number(count) || 0 };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async fetchAllFeedback({ status = 'all', limit = 20, offset = 0 } = {}) {
    if (!['new', 'answered', 'all'].includes(status)) {
      return { success: false, error: 'O filtro de mensagens é inválido.' };
    }
    const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));
    if (!this.client || !(await this.checkIsAdmin())) {
      return { success: false, error: 'Área restrita.' };
    }
    try {
      let query = this.client.from('feedback_messages')
        .select('id, category, message, status, reply, replied_at, created_at')
        .order('created_at', { ascending: status === 'new' });
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query.range(safeOffset, safeOffset + safeLimit - 1);
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      if (!Array.isArray(data) || data.some(item =>
        !item || typeof item !== 'object' ||
        ['user_id', 'name', 'email'].some(key => Object.prototype.hasOwnProperty.call(item, key))
      )) {
        return { success: false, error: 'A resposta do servidor contém dados inesperados.' };
      }
      return { success: true, messages: data };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async replyFeedback(id, reply) {
    if (!isValidCloudUuid(id)) return { success: false, error: 'A mensagem selecionada é inválida.' };
    const built = buildFeedbackReplyPayload(reply, new Date());
    if (built.error) return { success: false, error: built.error };
    if (!this.client || !(await this.checkIsAdmin())) {
      return { success: false, error: 'Área restrita.' };
    }
    try {
      const { error } = await this.client.from('feedback_messages')
        .update(built.payload)
        .eq('id', id);
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  getFeedbackErrorMessage(error) {
    const code = error && error.code ? error.code : '';
    const message = error && error.message ? error.message.toLowerCase() : '';
    if (['42P01', 'PGRST205'].includes(code) ||
      message.includes('feedback_messages') && (message.includes('does not exist') || message.includes('schema cache'))) {
      return 'O canal ainda não está disponível. A migração de mensagens precisa ser aplicada no Supabase.';
    }
    if (code === 'P0001' || message.includes('limite de 5 mensagens')) {
      return 'Você atingiu o limite de 5 mensagens nas últimas 24 horas. Tente novamente mais tarde.';
    }
    if ((typeof navigator !== 'undefined' && navigator.onLine === false) ||
      /failed to fetch|network|offline|connection|fetch failed|load failed/.test(message)) {
      return 'Sem conexão com a internet. Conecte-se e tente enviar novamente.';
    }
    if (code === '23514') return 'Confira a categoria e o tamanho da mensagem antes de tentar novamente.';
    return 'Não foi possível concluir esta ação agora. Tente novamente mais tarde.';
  },

  async getFeedbackUser() {
    const sessionState = await this.getSessionState();
    if (sessionState.status === 'indeterminate') {
      return { user: null, error: 'Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.' };
    }
    if (sessionState.status !== 'authenticated' || !sessionState.user) {
      return { user: null, error: 'Entre na sua conta para usar o canal Fale comigo.' };
    }
    return { user: sessionState.user, error: null };
  },

  async sendFeedback(payload = {}) {
    const { category, message } = payload && typeof payload === 'object' ? payload : {};
    const validationError = validateFeedbackMessage(category, message);
    if (validationError) return { success: false, error: validationError };
    if (!this.client) {
      return { success: false, error: 'O canal de mensagens está temporariamente indisponível.' };
    }
    try {
      const { user, error: sessionError } = await this.getFeedbackUser();
      if (sessionError) return { success: false, error: sessionError };
      const { error } = await this.client.from('feedback_messages').insert({
        user_id: user.id,
        category,
        message: message.trim()
      });
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async fetchMyFeedback() {
    if (!this.client) {
      return { success: false, error: 'O canal de mensagens está temporariamente indisponível.' };
    }
    try {
      const { user, error: sessionError } = await this.getFeedbackUser();
      if (sessionError) return { success: false, error: sessionError };
      const { data, error } = await this.client.from('feedback_messages')
        .select('id,category,message,status,reply,replied_at,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      return { success: true, messages: Array.isArray(data) ? data : [] };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async deleteMyFeedback(id) {
    if (!isValidCloudUuid(id)) return { success: false, error: 'A mensagem selecionada é inválida.' };
    if (!this.client) {
      return { success: false, error: 'O canal de mensagens está temporariamente indisponível.' };
    }
    try {
      const { user, error: sessionError } = await this.getFeedbackUser();
      if (sessionError) return { success: false, error: sessionError };
      const { error } = await this.client.from('feedback_messages')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return { success: false, error: this.getFeedbackErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getFeedbackErrorMessage(error) };
    }
  },

  async deleteAllMyData(expectedUserId) {
    if (!this.client) {
      return this.reportCloudError('Cliente não inicializado ao excluir dados do usuário', new Error('Cliente Supabase não inicializado.'));
    }
    try {
      const sessionUserId = await this.getAuthenticatedUserId(expectedUserId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir dados do usuário', new Error('Entre novamente na sua conta para excluir os dados sincronizados.'));
      }

      const { error: usageEventsError } = await this.client.rpc('delete_my_usage_events');
      if (usageEventsError) {
        return this.reportCloudError('Erro ao excluir eventos de uso', usageEventsError);
      }

      const deletions = [
        ['feedback_messages', 'user_id'],
        ['credit_card_purchases', 'user_id'],
        ['entries', 'user_id'],
        ['fixed_templates', 'user_id'],
        ['goals', 'user_id'],
        ['fixed_import_rules', 'user_id'],
        ['credit_cards', 'user_id'],
        ['accounts', 'user_id'],
        ['profiles', 'id']
      ];
      for (const [table, ownerColumn] of deletions) {
        const { error } = await this.client.from(table).delete().eq(ownerColumn, sessionUserId);
        if (error) return this.reportCloudError(`Erro ao excluir dados de ${table}`, error);
      }
      return { success: true };
    } catch (error) {
      return this.reportCloudError('Falha ao excluir dados do usuário na nuvem', error);
    }
  },

  reportCloudError(operation, error) {
    const details = {
      message: error && error.message ? error.message : String(error || 'Erro desconhecido.'),
      code: error && error.code ? error.code : null,
      details: error && error.details ? error.details : null
    };
    console.error(`[Supabase] ${operation}:`, details);
    return { success: false, error: details };
  },

  async signUp(name, email, password) {
    if (!sb) throw new Error('Cliente Supabase não inicializado.');
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() }
      }
    });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (!sb) throw new Error('Cliente Supabase não inicializado.');
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signOut(scope = 'global') {
    if (!sb) return;
    const { error } = await sb.auth.signOut({ scope });
    if (error) {
      console.error('[Supabase] Erro ao deslogar:', error);
      throw error;
    }
  },

  async deleteAccount() {
    if (!this.client) {
      return this.reportCloudError('Cliente não inicializado ao excluir a conta', new Error('Cliente Supabase não inicializado.'));
    }
    try {
      const { error } = await this.client.rpc('delete_my_account');
      if (error) return this.reportCloudError('Erro ao excluir a conta', error);
      return { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao excluir a conta', e);
    }
  },

  async resetPasswordForEmail(email) {
    if (!sb) throw new Error('Cliente Supabase não inicializado.');
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
  },

  async updatePassword(password) {
    if (!this.client) throw new Error('Cliente Supabase não inicializado.');
    const { data, error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
    return data;
  },

  onAuthStateChange(callback) {
    if (!sb) return;
    sb.auth.onAuthStateChange((event, session) => {
      setTimeout(() => callback(event, session ? session.user : null), 0);
    });
  },

  // ================================================================
  // SINCRONIZAÇÃO DE DADOS NA NUVEM (PostgreSQL com RLS)
  // ================================================================

  async importFinancialBatch(entries, templates, payments, userId) {
    if (!this.client) return this.reportCloudError('Cliente não inicializado ao importar em lote', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao importar em lote', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const entryPayload = entries.map(entry => ({
        id: entry.id,
        ...mapEntryToCloud(entry),
        client_edited_at: window.FinanceData.getClientEditedAt('entries', entry.id)
      }));
      const templatePayload = templates.map(template => ({
        id: template.id,
        description: template.desc,
        amount: template.amount,
        category: template.category,
        type: template.type || 'fixed',
        is_debt: Boolean(template.isDebt),
        active: template.active !== false,
        start_month: template.startMonth,
        end_month: template.endMonth || null,
        day: template.day || '01',
        paid_months: template.paidMonths || {},
        account_id: template.accountId || null,
        client_edited_at: window.FinanceData.getClientEditedAt('templates', template.id)
      }));
      const paymentPayload = payments.map(payment => ({
        id: payment.id,
        ym: payment.ym,
        client_edited_at: window.FinanceData.getClientEditedAt('templates', payment.id)
      }));
      const { data, error } = await this.client.rpc('import_financial_batch', {
        p_entries: entryPayload,
        p_templates: templatePayload,
        p_payments: paymentPayload
      });
      if (error) return this.reportCloudError('Falha ao importar lote na nuvem', error);
      if (!data || !data.success) {
        return {
          success: false,
          error: data && data.error || 'O lote não foi aplicado.',
          conflicts: data && data.conflicts || []
        };
      }
      window.FinanceData.saveCloudSyncVersions('entries', data.versions && data.versions.entries);
      window.FinanceData.saveCloudSyncVersions('templates', data.versions && data.versions.templates);
      return { success: true, conflicts: [] };
    } catch (error) {
      return this.reportCloudError('Falha ao importar lote na nuvem', error);
    }
  },

  async deleteAccountTransactional(accountId, clientEditedAt, userId) {
    if (!this.client) return this.reportCloudError('Cliente não inicializado ao excluir conta', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir conta', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const { data, error } = await this.client.rpc('delete_account_transactional', {
        p_account_id: accountId,
        p_client_edited_at: clientEditedAt
      });
      if (error) return this.reportCloudError('Falha ao excluir conta na nuvem', error);
      if (!data || !data.success) {
        return {
          success: false,
          error: data && data.error || 'A exclusão não foi aplicada.',
          conflicts: data && data.conflicts || []
        };
      }
      return { success: true, conflicts: [] };
    } catch (error) {
      return this.reportCloudError('Falha ao excluir conta na nuvem', error);
    }
  },

  /**
   * Busca todos os lançamentos pontuais do usuário logado na nuvem.
   */
  async fetchCloudEntries(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('entries')
        .select('*')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;

      // Mapeia colunas do banco para o formato do GastoPro
      return (data || []).map(mapEntryFromCloud);
    } catch (e) {
      console.warn('[Supabase] Falha de conexão ao buscar entries:', e);
      return null;
    }
  },

  /**
   * Salva ou atualiza um lançamento na nuvem.
   */
  async saveCloudEntries(entries, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar entries', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar entries', new Error('Não há uma sessão autenticada correspondente.'));
      }
      if (!entries.length) return { success: true };

      const validEntries = [];
      const failedIds = [];
      entries.forEach(entry => {
        const validationError = validateCloudPayload(entry, 'entries') ||
          (!isUuid(entry.id) ? 'O lançamento ainda não possui um UUID válido.' : null);
        if (validationError) {
          failedIds.push(entry.id);
          console.warn('[Supabase] Lançamento inválido não enviado:', { id: entry.id, error: validationError });
        } else {
          validEntries.push(entry);
        }
      });
      if (failedIds.length && typeof window.showToast === 'function') {
        window.showToast('Alguns lançamentos inválidos não foram sincronizados.');
      }

      const payload = validEntries.map(entry => ({
        id: entry.id,
        user_id: sessionUserId,
        ...mapEntryToCloud(entry),
        client_edited_at: window.FinanceData?.getClientEditedAt('entries', entry.id),
        deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('entries').upsert(rows).select('id,updated_at'),
          validEntries,
          payload,
          'id',
          'entries'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Um ou mais lançamentos não foram sincronizados.') }
        : { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao salvar entries na nuvem', e);
    }
  },

  async saveCloudEntry(entry, userId) {
    return this.saveCloudEntries([entry], userId);
  },

  /**
   * Remove um lançamento da nuvem.
   */
  async deleteCloudEntry(entryId, userId) {
    return this.deleteCloudEntries([entryId], userId);
  },

  splitIntoBatches(ids, batchSize) {
    const batches = [];
    for (let index = 0; index < ids.length; index += batchSize) {
      batches.push(ids.slice(index, index + batchSize));
    }
    return batches;
  },

  async deleteCloudEntries(entryIds, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir entries', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir entries', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validIds = entryIds.filter(isUuid);
      if (validIds.length !== entryIds.length) {
        return this.reportCloudError('ID inválido ao excluir entries', new Error('A exclusão contém um ID que não é UUID v4.'));
      }
      if (!validIds.length) return { success: true };
      return this.markCloudDeleted('entries', 'id', validIds, 'entries', sessionUserId);
    } catch (e) {
      return this.reportCloudError('Falha ao excluir entries na nuvem', e);
    }
  },

  async markCloudDeleted(table, keyColumn, ids, kind, sessionUserId) {
    const conflictIds = [];
    for (const id of ids) {
      const { data, error } = await sb.from(table).update({
        deleted_at: new Date().toISOString(),
        client_edited_at: window.FinanceData?.getClientEditedAt(kind, id, true)
      }).eq('user_id', sessionUserId).eq(keyColumn, id).select(keyColumn);
      if (error) return this.reportCloudError(`Erro ao excluir ${table}`, error);
      if (Array.isArray(data) && !data.length) conflictIds.push(id);
    }
    if (conflictIds.length && typeof window.showToast === 'function') {
      window.showToast('Um item foi atualizado em outro aparelho');
    }
    return { success: true, conflictIds };
  },

  /**
   * Busca todos os templates de gastos fixos recorrentes na nuvem.
   */
  async fetchCloudTemplates(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('fixed_templates')
        .select('*')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;

      return (data || []).map(row => ({
        id: row.id,
        desc: row.description,
        amount: Number(row.amount),
        category: row.category,
        type: row.type || 'fixed',
        isDebt: Boolean(row.is_debt),
        active: row.active !== false,
        startMonth: row.start_month,
        endMonth: row.end_month || null,
        day: row.day || '01',
        paidMonths: row.paid_months || {},
        accountId: row.account_id || null
      }));
    } catch (e) {
      console.warn('[Supabase] Falha ao buscar templates:', e);
      return null;
    }
  },

  /**
   * Salva ou atualiza um template de gasto fixo na nuvem.
   */
  async saveCloudTemplates(templates, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar templates', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar templates', new Error('Não há uma sessão autenticada correspondente.'));
      }
      if (!templates.length) return { success: true };

      const validTemplates = [];
      const failedIds = [];
      templates.forEach(tpl => {
        const validationError = validateCloudPayload(tpl, 'templates') ||
          (!isUuid(tpl.id) ? 'O template ainda não possui um UUID válido.' : null);
        if (validationError) {
          failedIds.push(tpl.id);
          console.warn('[Supabase] Template inválido não enviado:', { id: tpl.id, error: validationError });
        } else {
          validTemplates.push(tpl);
        }
      });
      if (failedIds.length && typeof window.showToast === 'function') {
        window.showToast('Alguns templates inválidos não foram sincronizados.');
      }

      const payload = validTemplates.map(tpl => ({
        id: tpl.id,
        user_id: sessionUserId,
        description: tpl.desc,
        amount: tpl.amount,
        category: tpl.category,
        type: tpl.type || 'fixed',
        is_debt: Boolean(tpl.isDebt),
        active: tpl.active !== false,
        start_month: tpl.startMonth,
        end_month: tpl.endMonth || null,
        day: tpl.day || '01',
        paid_months: tpl.paidMonths || {},
        account_id: tpl.accountId || null
        ,client_edited_at: window.FinanceData?.getClientEditedAt('templates', tpl.id)
        ,deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('fixed_templates').upsert(rows).select('id,updated_at'),
          validTemplates,
          payload,
          'id',
          'templates'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Um ou mais templates não foram sincronizados.') }
        : { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao salvar templates na nuvem', e);
    }
  },

  async saveCloudTemplate(tpl, userId) {
    return this.saveCloudTemplates([tpl], userId);
  },

  /**
   * Remove um template da nuvem.
   */
  async deleteCloudTemplate(tplId, userId) {
    return this.deleteCloudTemplates([tplId], userId);
  },

  async deleteCloudTemplates(templateIds, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir templates', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir templates', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validIds = templateIds.filter(isUuid);
      if (validIds.length !== templateIds.length) {
        return this.reportCloudError('ID inválido ao excluir templates', new Error('A exclusão contém um ID que não é UUID v4.'));
      }
      if (!validIds.length) return { success: true };
      return this.markCloudDeleted('fixed_templates', 'id', validIds, 'templates', sessionUserId);
    } catch (e) {
      return this.reportCloudError('Falha ao excluir templates na nuvem', e);
    }
  },

  async fetchCloudAccounts(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('accounts')
        .select('*')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;
      return data.map(row => ({
        id: row.id,
        name: row.name,
        institution: row.institution || null,
        type: row.type,
        initialBalance: Number(row.initial_balance),
        balanceDate: row.balance_date || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (e) {
      console.warn('[Supabase] Falha ao buscar contas:', e);
      return null;
    }
  },

  async saveCloudAccounts(accounts, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar accounts', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar accounts', new Error('Não há uma sessão autenticada correspondente.'));
      }
      if (!accounts.length) return { success: true };

      const validAccounts = [];
      const failedIds = [];
      accounts.forEach(account => {
        const validationError = validateCloudPayload(account, 'accounts') ||
          (!isValidCloudUuid(account.id) ? 'A conta ainda não possui um UUID válido.' : null);
        if (validationError) {
          failedIds.push(account.id);
          console.warn('[Supabase] Conta inválida não enviada:', { id: account.id, error: validationError });
        } else {
          validAccounts.push(account);
        }
      });
      if (failedIds.length && typeof window.showToast === 'function') {
        window.showToast('Algumas contas inválidas não foram sincronizadas.');
      }

      const payload = validAccounts.map(account => ({
        id: account.id,
        user_id: sessionUserId,
        name: account.name.trim(),
        institution: account.institution || null,
        type: account.type,
        initial_balance: Math.round(Number(account.initialBalance) * 100) / 100,
        balance_date: account.balanceDate || null,
        ...(account.createdAt ? { created_at: account.createdAt } : {})
        ,client_edited_at: window.FinanceData?.getClientEditedAt('accounts', account.id)
        ,deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('accounts').upsert(rows).select('id,updated_at'),
          validAccounts,
          payload,
          'id',
          'accounts'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Uma ou mais contas não foram sincronizadas.') }
        : { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao salvar contas na nuvem', e);
    }
  },

  async deleteCloudAccounts(accountIds, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir accounts', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir accounts', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validIds = accountIds.filter(isValidCloudUuid);
      if (validIds.length !== accountIds.length) {
        return this.reportCloudError('ID inválido ao excluir accounts', new Error('A exclusão contém um ID que não é UUID válido.'));
      }
      if (!validIds.length) return { success: true };
      return this.markCloudDeleted('accounts', 'id', validIds, 'accounts', sessionUserId);
    } catch (e) {
      return this.reportCloudError('Falha ao excluir contas na nuvem', e);
    }
  },

  async fetchCloudCreditCards(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('credit_cards')
        .select('*')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;
      return data.map(mapCreditCardFromCloud);
    } catch (error) {
      console.warn('[Supabase] Falha ao buscar cartões:', error);
      return null;
    }
  },

  async saveCloudCreditCards(cards, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar cartões', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar cartões', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validCards = [];
      const failedIds = [];
      cards.forEach(card => {
        const validationError = validateCloudPayload(card, 'creditCards') ||
          (!isValidCloudUuid(card.id) ? 'O cartão ainda não possui um UUID válido.' : null);
        if (validationError) {
          failedIds.push(card.id);
          console.warn('[Supabase] Cartão inválido não enviado:', { id: card.id, error: validationError });
        } else {
          validCards.push(card);
        }
      });
      const payload = validCards.map(card => ({
        id: card.id,
        user_id: sessionUserId,
        ...mapCreditCardToCloud(card),
        ...(card.createdAt ? { created_at: card.createdAt } : {}),
        client_edited_at: window.FinanceData?.getClientEditedAt('creditCards', card.id),
        deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('credit_cards').upsert(rows).select('id,updated_at'),
          validCards,
          payload,
          'id',
          'creditCards'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Um ou mais cartões não foram sincronizados.') }
        : { success: true };
    } catch (error) {
      return this.reportCloudError('Falha ao salvar cartões na nuvem', error);
    }
  },

  async deleteCloudCreditCards(cardIds, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir cartões', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir cartões', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validIds = cardIds.filter(isValidCloudUuid);
      if (validIds.length !== cardIds.length) {
        return this.reportCloudError('ID inválido ao excluir cartões', new Error('A exclusão contém um ID que não é UUID válido.'));
      }
      return this.markCloudDeleted('credit_cards', 'id', validIds, 'creditCards', sessionUserId);
    } catch (error) {
      return this.reportCloudError('Falha ao excluir cartões na nuvem', error);
    }
  },

  async fetchCloudCreditCardPurchases(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('credit_card_purchases')
        .select('*')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;
      return data.map(row => ({
        id: row.id,
        cardId: row.card_id || null,
        cardName: row.card_name,
        accountId: row.account_id || null,
        desc: row.description,
        amount: Number(row.amount),
        category: row.category,
        purchaseDate: row.purchase_date,
        installmentCount: row.installment_count,
        closingDay: row.closing_day,
        dueDay: row.due_day,
        paidInstallments: Array.isArray(row.paid_installments) ? row.paid_installments : [],
        paidDates: row.paid_dates && typeof row.paid_dates === 'object' ? row.paid_dates : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.warn('[Supabase] Falha ao buscar compras no cartão:', error);
      return null;
    }
  },

  async saveCloudCreditCardPurchases(purchases, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar compras no cartão', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar compras no cartão', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validPurchases = [];
      const failedIds = [];
      purchases.forEach(purchase => {
        const validationError = validateCloudPayload(purchase, 'creditCardPurchases') ||
          (!isValidCloudUuid(purchase.id) ? 'A compra ainda não possui um UUID válido.' : null);
        if (validationError) {
          failedIds.push(purchase.id);
          console.warn('[Supabase] Compra inválida não enviada:', { id: purchase.id, error: validationError });
        } else {
          validPurchases.push(purchase);
        }
      });
      const payload = validPurchases.map(purchase => ({
        id: purchase.id,
        user_id: sessionUserId,
        card_id: purchase.cardId || null,
        card_name: purchase.cardName,
        account_id: purchase.accountId || null,
        description: purchase.desc,
        amount: Math.round(Number(purchase.amount) * 100) / 100,
        category: purchase.category,
        purchase_date: purchase.purchaseDate,
        installment_count: purchase.installmentCount,
        closing_day: purchase.closingDay,
        due_day: purchase.dueDay,
        paid_installments: purchase.paidInstallments,
        paid_dates: purchase.paidDates || {},
        ...(purchase.createdAt ? { created_at: purchase.createdAt } : {})
        ,client_edited_at: window.FinanceData?.getClientEditedAt('creditCardPurchases', purchase.id)
        ,deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('credit_card_purchases').upsert(rows).select('id,updated_at'),
          validPurchases,
          payload,
          'id',
          'creditCardPurchases'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Uma ou mais compras no cartão não foram sincronizadas.') }
        : { success: true };
    } catch (error) {
      return this.reportCloudError('Falha ao salvar compras no cartão', error);
    }
  },

  async deleteCloudCreditCardPurchases(purchaseIds, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir compras no cartão', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir compras no cartão', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validIds = purchaseIds.filter(isValidCloudUuid);
      if (validIds.length !== purchaseIds.length) {
        return this.reportCloudError('ID inválido ao excluir compras no cartão', new Error('A exclusão contém um ID que não é UUID válido.'));
      }
      return this.markCloudDeleted('credit_card_purchases', 'id', validIds, 'creditCardPurchases', sessionUserId);
    } catch (error) {
      return this.reportCloudError('Falha ao excluir compras no cartão', error);
    }
  },

  async fetchCloudProfile(userId) {
    if (!this.client) return { success: false, error: new Error('Cliente Supabase não inicializado.') };
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return { success: false, error: new Error('Não há uma sessão autenticada correspondente.') };
      }
      const { data, error } = await this.client.from('profiles')
        .select('id,name,avatar,updated_at')
        .eq('id', sessionUserId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) {
        return this.reportCloudError('Falha ao buscar perfil', error);
      }
      return {
        success: true,
        profile: data ? { id: data.id, name: data.name || '', avatar: data.avatar || null, updatedAt: data.updated_at } : null
      };
    } catch (error) {
      return this.reportCloudError('Falha ao buscar perfil', error);
    }
  },

  async saveCloudProfile(profile, userId) {
    if (!this.client) return this.reportCloudError('Cliente não inicializado ao salvar perfil', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar perfil', new Error('Não há uma sessão autenticada correspondente.'));
      }
      if (!profile || typeof profile !== 'object' ||
        typeof profile.name !== 'string' || profile.name.length > 300 ||
        (profile.avatar != null &&
          (typeof profile.avatar !== 'string' || profile.avatar.length > 400000))) {
        return this.reportCloudError('Perfil inválido ao sincronizar', new Error('Nome ou foto de perfil excede os limites permitidos.'));
      }
      const upsert = this.client.from('profiles').upsert({
        id: sessionUserId,
        name: profile.name.trim() || null,
        avatar: profile.avatar || null,
        client_edited_at: window.FinanceData?.getClientEditedAt('profiles', sessionUserId),
        deleted_at: null
      });
      const { data, error } = typeof upsert.select === 'function'
        ? await upsert.select('id,updated_at')
        : await upsert;
      if (error) return this.reportCloudError('Erro ao salvar perfil', error);
      if (Array.isArray(data) && !data.length) {
        if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
        return { success: true, conflictIds: [sessionUserId] };
      }
      if (data && data[0] && data[0].updated_at) {
        window.FinanceData?.saveCloudSyncVersions('profiles', { [sessionUserId]: data[0].updated_at });
      }
      return { success: true };
    } catch (error) {
      return this.reportCloudError('Falha ao salvar perfil na nuvem', error);
    }
  },

  async fetchCloudGoals(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const data = await this.fetchAllPages((from, to) => sb
        .from('goals')
        .select('category,limit_amount')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .order('category', { ascending: true })
        .range(from, to));
      if (!data) return null;
      return data.map(row => ({
        category: row.category,
        limit: Number(row.limit_amount)
      }));
    } catch (e) {
      console.warn('[Supabase] Falha ao buscar metas:', e);
      return null;
    }
  },

  async saveCloudGoals(goals, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar metas', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar metas', new Error('Não há uma sessão autenticada correspondente.'));
      }

      const validGoals = [];
      const failedIds = [];
      goals.forEach(goal => {
        const limit = goal && Number(goal.limit);
        const valid = goal &&
          typeof goal.category === 'string' &&
          goal.category.trim().length > 0 &&
          goal.category.length <= 100 &&
          goal.limit != null &&
          goal.limit !== '' &&
          typeof goal.limit !== 'boolean' &&
          Number.isFinite(limit) &&
          limit >= 0;
        if (!valid) {
          failedIds.push(goal && goal.category);
          console.warn('[Supabase] Meta inválida não enviada:', {
            category: goal && goal.category
          });
          return;
        }
        validGoals.push({ ...goal, id: goal.category, limit });
      });
      if (failedIds.length && typeof window.showToast === 'function') {
        window.showToast('Algumas metas inválidas não foram sincronizadas.');
      }

      const payload = validGoals.map(goal => ({
        user_id: sessionUserId,
        category: goal.category,
        limit_amount: Math.round(goal.limit * 100) / 100,
        client_edited_at: window.FinanceData?.getClientEditedAt('goals', goal.category),
        deleted_at: null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('goals').upsert(rows, { onConflict: 'user_id,category' }).select('category,updated_at'),
          validGoals,
          payload,
          'category',
          'goals'
        );
        failedIds.push(...result.failedIds);
        if (result.conflictIds.length) {
          if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
          return { success: true, failedIds: [], conflictIds: result.conflictIds };
        }
      }
      return failedIds.length
        ? { success: false, failedIds, error: new Error('Uma ou mais metas não foram sincronizadas.') }
        : { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao salvar metas na nuvem', e);
    }
  },

  async deleteCloudGoals(categories, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao excluir metas', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao excluir metas', new Error('Não há uma sessão autenticada correspondente.'));
      }
      const validCategories = [...new Set(categories.filter(category =>
        typeof category === 'string' && category.trim().length > 0 && category.length <= 100
      ))];
      if (!validCategories.length) return { success: true };
      return this.markCloudDeleted('goals', 'category', validCategories, 'goals', sessionUserId);
    } catch (e) {
      return this.reportCloudError('Falha ao excluir metas na nuvem', e);
    }
  },

  async fetchCloudFixedImportRules(userId) {
    if (!sb) return null;
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) return null;
      const { data, error } = await sb
        .from('fixed_import_rules')
        .select('rules')
        .eq('user_id', sessionUserId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) {
        console.warn('[Supabase] Falha ao buscar regras de importação:', error);
        return null;
      }
      if (!data) return [];
      return Array.isArray(data.rules) &&
        data.rules.every(rule => typeof rule === 'string' && rule.trim().length <= 300)
        ? [...new Set(data.rules.map(rule => rule.trim()).filter(Boolean))]
        : null;
    } catch (error) {
      console.warn('[Supabase] Falha ao buscar regras de importação:', error);
      return null;
    }
  },

  async saveCloudFixedImportRules(rules, userId) {
    if (!sb) return this.reportCloudError('Cliente não inicializado ao salvar regras de importação', new Error('Cliente Supabase não inicializado.'));
    try {
      const sessionUserId = await this.getAuthenticatedUserId(userId);
      if (!sessionUserId) {
        return this.reportCloudError('Sessão inválida ao salvar regras de importação', new Error('Não há uma sessão autenticada correspondente.'));
      }
      if (!Array.isArray(rules) || rules.some(rule =>
        typeof rule !== 'string' || !rule.trim() || rule.length > 300
      )) {
        return this.reportCloudError('Regras de importação inválidas', new Error('Uma ou mais regras não são válidas.'));
      }
      if (!rules.length) {
        return this.markCloudDeleted('fixed_import_rules', 'user_id', [sessionUserId],
          'fixedImportRules', sessionUserId);
      }
      const { data, error } = await sb.from('fixed_import_rules').upsert({
        user_id: sessionUserId,
        rules: [...new Set(rules.map(rule => rule.trim()))],
        client_edited_at: window.FinanceData?.getClientEditedAt('fixedImportRules', sessionUserId),
        deleted_at: null
      }, { onConflict: 'user_id' }).select('user_id,updated_at');
      if (error) return this.reportCloudError('Erro ao salvar regras de importação', error);
      if (Array.isArray(data) && !data.length) {
        if (typeof window.showToast === 'function') window.showToast('Um item foi atualizado em outro aparelho');
        return { success: true, conflictIds: [sessionUserId] };
      }
      if (data && data[0] && data[0].updated_at) {
        window.FinanceData?.saveCloudSyncVersions('fixedImportRules', { [sessionUserId]: data[0].updated_at });
      }
      return { success: true };
    } catch (error) {
      return this.reportCloudError('Falha ao salvar regras de importação na nuvem', error);
    }
  }
};

window.SupabaseAuth = SupabaseAuth;
window.validateCloudPayload = validateCloudPayload;
