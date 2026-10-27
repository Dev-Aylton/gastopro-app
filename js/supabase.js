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

function validateCloudPayload(item, kind) {
  if (!item || typeof item !== 'object') return 'Registro inválido.';
  if (item.amount == null || item.amount === '' || typeof item.amount === 'boolean') return 'O valor deve ser finito e maior ou igual a zero.';
  if (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0) return 'O valor deve ser finito e maior ou igual a zero.';
  if (typeof item.desc !== 'string' || item.desc.length < 1 || item.desc.length > 300) return 'A descrição deve ter de 1 a 300 caracteres.';
  if (typeof item.category !== 'string' || item.category.length < 1 || item.category.length > 100) return 'A categoria deve ter de 1 a 100 caracteres.';

  if (kind === 'entries') {
    if (!['income', 'variable', 'fixed', 'debt'].includes(item.type)) return 'Tipo de lançamento inválido.';
    if (!isValidCloudDate(item.date)) return 'A data do lançamento deve ser uma data válida no formato AAAA-MM-DD.';
    return null;
  }

  if (kind === 'templates') {
    if (!['fixed', 'debt', 'variable'].includes(item.type || 'fixed')) return 'Tipo de template inválido.';
    if (!isValidCloudMonth(item.startMonth)) return 'O mês inicial deve estar no formato AAAA-MM.';
    if (item.endMonth && !isValidCloudMonth(item.endMonth)) return 'O mês final deve estar no formato AAAA-MM.';
    if (item.day != null && !/^\d{2}$/.test(String(item.day))) return 'O dia deve ter dois dígitos.';
    return null;
  }

  return 'Tipo de registro inválido.';
}

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

  async getSessionUser() {
    if (!sb) return null;
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (error || !session) return null;
      return session.user;
    } catch (e) {
      console.warn('[Supabase] Erro ao obter sessão:', e);
      return null;
    }
  },

  async getAuthenticatedUserId(expectedUserId) {
    const user = await this.getSessionUser();
    if (!user || (expectedUserId && user.id !== expectedUserId)) return null;
    return user.id;
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

  async signOut() {
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) {
      console.error('[Supabase] Erro ao deslogar:', error);
      throw error;
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
        active: row.active !== false
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
        active: entry.active !== false
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
      const { error } = await sb.from('entries').delete()
        .in('id', validIds)
        .eq('user_id', sessionUserId);
      if (error) return this.reportCloudError('Erro ao excluir entries', error);
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
        paidMonths: row.paid_months || {}
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
        paid_months: tpl.paidMonths || {}
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
      const { error } = await sb.from('fixed_templates').delete()
        .in('id', validIds)
        .eq('user_id', sessionUserId);
      if (error) return this.reportCloudError('Erro ao excluir templates', error);
      return { success: true };
    } catch (e) {
      return this.reportCloudError('Falha ao excluir templates na nuvem', e);
    }
  }
};

window.SupabaseAuth = SupabaseAuth;
window.validateCloudPayload = validateCloudPayload;
