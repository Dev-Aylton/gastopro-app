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
    if (error) console.error('[Supabase] Erro ao deslogar:', error);
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
      callback(event, session ? session.user : null);
    });
  },

  // ================================================================
  // SINCRONIZAÇÃO DE DADOS NA NUVEM (PostgreSQL com RLS)
  // ================================================================

  /**
   * Busca todos os lançamentos pontuais do usuário logado na nuvem.
   */
  async fetchCloudEntries(userId) {
    if (!sb || !userId) return null;
    try {
      const { data, error } = await sb
        .from('entries')
        .select('*')
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
  async saveCloudEntry(entry, userId) {
    if (!sb || !userId) return;
    try {
      const payload = {
        user_id: userId,
        description: entry.desc,
        amount: entry.amount,
        category: entry.category,
        type: entry.type,
        date: entry.date,
        paid: Boolean(entry.paid),
        is_debt: Boolean(entry.isDebt),
        debt_info: entry.debtInfo || null,
        active: entry.active !== false
      };

      if (entry.id && String(entry.id).includes('-')) {
        payload.id = entry.id;
      }

      await sb.from('entries').upsert(payload);
    } catch (e) {
      console.warn('[Supabase] Falha ao salvar entry na nuvem:', e);
    }
  },

  /**
   * Remove um lançamento da nuvem.
   */
  async deleteCloudEntry(entryId, userId) {
    if (!sb || !userId) return;
    try {
      if (String(entryId).includes('-')) {
        await sb.from('entries').delete().eq('id', entryId);
      }
    } catch (e) {
      console.warn('[Supabase] Falha ao excluir entry na nuvem:', e);
    }
  },

  /**
   * Busca todos os templates de gastos fixos recorrentes na nuvem.
   */
  async fetchCloudTemplates(userId) {
    if (!sb || !userId) return null;
    try {
      const { data, error } = await sb
        .from('fixed_templates')
        .select('*');

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
  async saveCloudTemplate(tpl, userId) {
    if (!sb || !userId) return;
    try {
      const payload = {
        user_id: userId,
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
      };

      if (tpl.id && String(tpl.id).includes('-')) {
        payload.id = tpl.id;
      }

      await sb.from('fixed_templates').upsert(payload);
    } catch (e) {
      console.warn('[Supabase] Falha ao salvar template na nuvem:', e);
    }
  },

  /**
   * Remove um template da nuvem.
   */
  async deleteCloudTemplate(tplId, userId) {
    if (!sb || !userId) return;
    try {
      if (String(tplId).includes('-')) {
        await sb.from('fixed_templates').delete().eq('id', tplId);
      }
    } catch (e) {
      console.warn('[Supabase] Falha ao deletar template na nuvem:', e);
    }
  }
};

window.SupabaseAuth = SupabaseAuth;
