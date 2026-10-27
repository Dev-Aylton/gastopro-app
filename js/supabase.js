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

const SupabaseAuth = {
  client: sb,

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
      const { data, error } = await sb
        .from('entries')
        .select('*')
        .eq('user_id', sessionUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase] Erro ao carregar entries:', error.message);
        return null;
      }

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

      const invalidItem = entries.find(entry => !isUuid(entry.id));
      if (invalidItem) {
        return this.reportCloudError('ID inválido ao salvar entries', new Error(`O lançamento ${invalidItem.id} ainda não possui UUID v4.`));
      }

      const payload = entries.map(entry => ({
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

      const { error } = await sb.from('entries').upsert(payload);
      if (error) return this.reportCloudError('Erro ao salvar entries', error);
      return { success: true };
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
      const { data, error } = await sb
        .from('fixed_templates')
        .select('*')
        .eq('user_id', sessionUserId);

      if (error) {
        console.warn('[Supabase] Erro ao carregar templates:', error.message);
        return null;
      }

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

      const invalidItem = templates.find(tpl => !isUuid(tpl.id));
      if (invalidItem) {
        return this.reportCloudError('ID inválido ao salvar templates', new Error(`O template ${invalidItem.id} ainda não possui UUID v4.`));
      }

      const payload = templates.map(tpl => ({
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

      const { error } = await sb.from('fixed_templates').upsert(payload);
      if (error) return this.reportCloudError('Erro ao salvar templates', error);
      return { success: true };
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
