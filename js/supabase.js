/**
 * GastoPro — Módulo de Integração Supabase
 * Gerencia autenticação de múltiplos usuários e persistência na nuvem (PostgreSQL).
 */

const SUPABASE_URL = 'https://xfjhgzcqlrhpckqwnqtk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-TwM1I7tRwAQWveicUTWsw_1ZkCueNt';

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

  async fetchAllPages(fetchPage) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await fetchPage(from, from + 999);
      if (error || !Array.isArray(data)) return null;
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  },

  async upsertWithFallback(upsert, items, payloads) {
    let batchError = null;
    try {
      const { error } = await upsert(payloads);
      batchError = error;
    } catch (error) {
      batchError = error;
    }
    if (!batchError) return { failedIds: [] };

    console.warn('[Supabase] Falha no upsert em lote; tentando cada linha separadamente:', batchError.message || batchError);
    const failedIds = [];
    for (let index = 0; index < items.length; index++) {
      try {
        const { error } = await upsert(payloads[index]);
        if (error) {
          failedIds.push(items[index].id);
          console.warn('[Supabase] Linha não sincronizada:', { id: items[index].id, error: error.message });
        }
      } catch (error) {
        failedIds.push(items[index].id);
        console.warn('[Supabase] Linha não sincronizada:', { id: items[index].id, error: error.message || error });
      }
    }
    return { failedIds };
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
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
      if (!data) return null;

      // Mapeia colunas do banco para o formato do GastoPro
      return (data || []).map(row => ({
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
        accountId: row.account_id || null
      }));
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
        description: entry.desc,
        amount: entry.amount,
        category: entry.category,
        type: entry.type,
        date: entry.date,
        paid: Boolean(entry.paid),
        is_debt: Boolean(entry.isDebt),
        debt_info: entry.debtInfo || null,
        active: entry.active !== false,
        account_id: entry.accountId || null
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('entries').upsert(rows),
          validEntries,
          payload
        );
        failedIds.push(...result.failedIds);
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
      for (const batch of this.splitIntoBatches(validIds, 100)) {
        const { error } = await sb.from('entries').delete()
          .in('id', batch)
          .eq('user_id', sessionUserId);
        if (error) return this.reportCloudError('Erro ao excluir entries', error);
      }
      return { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao excluir entries na nuvem', e);
    }
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
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('fixed_templates').upsert(rows),
          validTemplates,
          payload
        );
        failedIds.push(...result.failedIds);
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
      for (const batch of this.splitIntoBatches(validIds, 100)) {
        const { error } = await sb.from('fixed_templates').delete()
          .in('id', batch)
          .eq('user_id', sessionUserId);
        if (error) return this.reportCloudError('Erro ao excluir templates', error);
      }
      return { success: true };
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
        ...(account.createdAt ? { created_at: account.createdAt } : {})
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('accounts').upsert(rows),
          validAccounts,
          payload
        );
        failedIds.push(...result.failedIds);
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
      for (const batch of this.splitIntoBatches(validIds, 100)) {
        const { error } = await sb.from('accounts').delete()
          .in('id', batch)
          .eq('user_id', sessionUserId);
        if (error) return this.reportCloudError('Erro ao excluir accounts', error);
      }
      return { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao excluir contas na nuvem', e);
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
        .select('id,name,avatar')
        .eq('id', sessionUserId)
        .maybeSingle();
      if (error) {
        return this.reportCloudError('Falha ao buscar perfil', error);
      }
      return {
        success: true,
        profile: data ? { id: data.id, name: data.name || '', avatar: data.avatar || null } : null
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
      const { error } = await this.client.from('profiles').upsert({
        id: sessionUserId,
        name: profile.name.trim() || null,
        avatar: profile.avatar || null
      });
      if (error) return this.reportCloudError('Erro ao salvar perfil', error);
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
        limit_amount: Math.round(goal.limit * 100) / 100
      }));
      if (payload.length) {
        const result = await this.upsertWithFallback(
          rows => sb.from('goals').upsert(rows, { onConflict: 'user_id,category' }),
          validGoals,
          payload
        );
        failedIds.push(...result.failedIds);
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
      const { error } = await sb.from('goals').delete()
        .eq('user_id', sessionUserId)
        .in('category', validCategories);
      if (error) return this.reportCloudError('Erro ao excluir metas', error);
      return { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao excluir metas na nuvem', e);
    }
  }
};

window.SupabaseAuth = SupabaseAuth;
window.validateCloudPayload = validateCloudPayload;
