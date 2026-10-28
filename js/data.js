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
const STORAGE_LAST_UID = 'gastopro_last_uid';
const STORAGE_PENDING_SYNC = 'gastopro_pending_sync_v1';

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

  const collections = ['entries', 'templates', 'goals'];
  for (const key of collections) {
    if (!Array.isArray(parsed[key])) return { error: `A coleção ${key} precisa ser uma lista.` };
    if (parsed[key].length > 5000) return { error: `A coleção ${key} excede o limite de 5.000 itens.` };
  }

  const entries = parsed.entries.map(item => ({ ...item }));
  const templates = parsed.templates.map(item => ({ ...item }));
  const goals = parsed.goals.map(item => ({ ...item }));
  for (const [index, item] of entries.entries()) {
    const error = window.validateCloudPayload(item, 'entries');
    if (error) return { error: `Lançamento ${index + 1}: ${error}` };
    item.amount = Number(item.amount);
    item.month = item.date.substring(0, 7);
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
  }
  for (const [index, item] of templates.entries()) {
    const error = window.validateCloudPayload(item, 'templates');
    if (error) return { error: `Gasto fixo ${index + 1}: ${error}` };
    item.amount = Number(item.amount);
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
  }
  for (const [index, goal] of goals.entries()) {
    if (!goal || typeof goal.category !== 'string' || !goal.category.trim() ||
      goal.category.length > 100 || !Number.isFinite(Number(goal.limit)) || Number(goal.limit) <= 0) {
      return { error: `Meta ${index + 1}: informe categoria e limite válido.` };
    }
    goal.category = goal.category.trim();
    goal.limit = Number(goal.limit);
    const goalId = String(goal.id || '').replace(/^goal-/, '');
    goal.id = isUuid(goalId) ? goalId : crypto.randomUUID();
  }

  return {
    version: parsed.version,
    exportDate: typeof parsed.exportDate === 'string' ? parsed.exportDate : null,
    entries,
    templates,
    goals
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
    goals: mergeById(current.goals, incoming.goals, true)
  };
}

window.GastoProBackupHelpers = {
  validate: validateBackupText,
  merge: mergeBackupData
};


const FinanceData = {

  clearUserData() {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith('gastopro_')) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  getPendingSync() {
    try {
      const stored = localStorage.getItem(STORAGE_PENDING_SYNC);
      return stored
        ? { full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [], ...JSON.parse(stored) }
        : { full: false, entries: [], templates: [], deletedEntries: [], deletedTemplates: [] };
    } catch (e) {
      console.error('[GastoPro] Erro ao ler alterações pendentes:', e);
      return { full: true, entries: [], templates: [], deletedEntries: [], deletedTemplates: [] };
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
      pending.deletedTemplates.length
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
    const pendingIds = pending[kind];
    const deletedIds = pending[kind === 'entries' ? 'deletedEntries' : 'deletedTemplates'];
    const previousById = new Map(previousItems.map(item => [item.id, item]));
    const nextById = new Map(nextItems.map(item => [item.id, item]));

    nextItems.forEach(item => {
      if (!isUuid(item.id)) return;
      const previous = previousById.get(item.id);
      if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) {
        if (!pendingIds.includes(item.id)) pendingIds.push(item.id);
        const deletedIndex = deletedIds.indexOf(item.id);
        if (deletedIndex !== -1) deletedIds.splice(deletedIndex, 1);
      }
    });

    previousItems.forEach(item => {
      if (isUuid(item.id) && !nextById.has(item.id) && !deletedIds.includes(item.id)) {
        deletedIds.push(item.id);
        const pendingIndex = pendingIds.indexOf(item.id);
        if (pendingIndex !== -1) pendingIds.splice(pendingIndex, 1);
      }
    });

    this.savePendingSync(pending);
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

  async flushPendingSync(userId) {
    const profile = this.getProfile();
    const targetUserId = userId || (profile && profile.userId);
    if (!targetUserId || !window.SupabaseAuth) return { success: true, skipped: true };

    const flush = async () => {
      if (localStorage.getItem(STORAGE_LAST_UID) !== targetUserId) {
        return { success: false, error: new Error('O usuário local não corresponde à sessão atual.') };
      }

      const pending = this.getPendingSync();
      const fullSync = pending.full;
      const entries = this.getEntries();
      const templates = this.getTemplates();
      const entriesToSave = fullSync
        ? entries
        : entries.filter(item => pending.entries.includes(item.id));
      const templatesToSave = fullSync
        ? templates
        : templates.filter(item => pending.templates.includes(item.id));

      const results = await Promise.all([
        entriesToSave.length ? window.SupabaseAuth.saveCloudEntries(entriesToSave, targetUserId) : { success: true },
        templatesToSave.length ? window.SupabaseAuth.saveCloudTemplates(templatesToSave, targetUserId) : { success: true },
        pending.deletedEntries.length ? window.SupabaseAuth.deleteCloudEntries(pending.deletedEntries, targetUserId) : { success: true },
        pending.deletedTemplates.length ? window.SupabaseAuth.deleteCloudTemplates(pending.deletedTemplates, targetUserId) : { success: true }
      ]);

      const latestPending = this.getPendingSync();
      const getFailedIds = (result, sentItems) => {
        if (result && result.success) return result.failedIds || [];
        return result && Array.isArray(result.failedIds) && result.failedIds.length
          ? result.failedIds
          : sentItems.map(item => item.id);
      };
      const failedEntryIds = getFailedIds(results[0], entriesToSave);
      const failedTemplateIds = getFailedIds(results[1], templatesToSave);
      const failedEntryDeletes = !results[2] || !results[2].success;
      const failedTemplateDeletes = !results[3] || !results[3].success;
      const hasFailures = failedEntryIds.length > 0 || failedTemplateIds.length > 0 ||
        failedEntryDeletes || failedTemplateDeletes;
      const removeSyncedIds = (kind, sentItems, currentItems, failedIds) => {
        const sentById = new Map(sentItems.map(item => [item.id, JSON.stringify(item)]));
        latestPending[kind] = latestPending[kind].filter(id => {
          if (failedIds.includes(id)) return true;
          const current = currentItems.find(item => item.id === id);
          return current && sentById.get(id) !== JSON.stringify(current);
        });
        failedIds.forEach(id => {
          if (!latestPending[kind].includes(id)) latestPending[kind].push(id);
        });
      };
      removeSyncedIds('entries', entriesToSave, this.getEntries(), failedEntryIds);
      removeSyncedIds('templates', templatesToSave, this.getTemplates(), failedTemplateIds);

      if (!failedEntryDeletes) {
        latestPending.deletedEntries = latestPending.deletedEntries.filter(id => !pending.deletedEntries.includes(id));
      }
      if (!failedTemplateDeletes) {
        latestPending.deletedTemplates = latestPending.deletedTemplates.filter(id => !pending.deletedTemplates.includes(id));
      }

      if (fullSync) {
        latestPending.full = !hasFailures && (
          JSON.stringify(entries) !== JSON.stringify(this.getEntries()) ||
          JSON.stringify(templates) !== JSON.stringify(this.getTemplates())
        );
      }
      this.savePendingSync(latestPending);
      if (hasFailures) {
        if (typeof showToast === 'function') {
          showToast('Não foi possível sincronizar todos os dados; os itens pendentes continuam salvos neste aparelho');
        }
        return results.find(result => !result || !result.success) ||
          { success: false, error: new Error('Alguns itens não puderam ser sincronizados.') };
      }
      return { success: true };
    };

    const previousSync = this._pendingSyncPromise || Promise.resolve();
    const currentSync = previousSync.then(flush, flush);
    this._pendingSyncPromise = currentSync.catch(() => undefined);
    return currentSync;
  },

  mergeCloudData(userId, cloudEntries, cloudTemplates, flushSucceeded = false) {
    if (
      !userId ||
      localStorage.getItem(STORAGE_LAST_UID) !== userId ||
      !Array.isArray(cloudEntries) ||
      !Array.isArray(cloudTemplates)
    ) return false;

    const pending = this.getPendingSync();
    const canRemoveCloudDeleted = flushSucceeded && !this.hasPendingSync();
    const mergeById = (localItems, cloudItems, pendingIds) => {
      const merged = new Map(localItems.map(item => [item.id, item]));
      cloudItems.forEach(item => merged.set(item.id, item));
      if (canRemoveCloudDeleted) {
        localItems.forEach(item => {
          if (!isUuid(item.id) || pendingIds.includes(item.id)) merged.set(item.id, item);
          else if (!cloudItems.some(cloudItem => cloudItem.id === item.id)) merged.delete(item.id);
        });
      }
      return [...merged.values()];
    };

    const entries = mergeById(this.getEntries(), cloudEntries, pending.entries);
    const templates = mergeById(this.getTemplates(), cloudTemplates, pending.templates);
    localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
    localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
    return true;
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
          paid:       isPaidThisMonth
        });
      }
    });

    return [...entries, ...fixedForMonth];
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

  async addMany(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, items: [], syncResult: { success: true, skipped: true } };
    }

    const newEntries = [];
    const newTemplates = [];
    const addedItems = [];

    items.forEach(item => {
      if (item.type === 'fixed' || item.type === 'debt') {
        const date = item.date || getLocalDateString();
        const category = item.category || (item.type === 'debt' ? 'Empréstimo' : 'Contas');
        const template = {
          id: crypto.randomUUID(),
          desc: item.desc,
          amount: parseFloat(item.amount) || 0,
          category,
          type: 'fixed',
          isDebt: item.type === 'debt' || Boolean(item.endMonth) ||
            category === 'Empréstimo' || category === 'Parcelamento',
          active: true,
          startMonth: item.month || item.startMonth || date.substring(0, 7),
          endMonth: item.endMonth || null,
          day: date.split('-')[2] || '05',
          date,
          paidMonths: item.paidMonths || {}
        };
        newTemplates.push(template);
        addedItems.push(template);
        return;
      }

      const date = item.date || getLocalDateString();
      const entry = {
        ...item,
        id: crypto.randomUUID(),
        date,
        month: item.month || date.substring(0, 7),
        paid: item.paid !== undefined ? item.paid : true
      };
      newEntries.push(entry);
      addedItems.push(entry);
    });

    if (newEntries.length) {
      const result = await this.saveEntries([...this.getEntries(), ...newEntries], { flush: false });
      if (!result.success) return { success: false, items: addedItems, error: result.error };
    }
    if (newTemplates.length) {
      const result = await this.saveTemplates([...this.getTemplates(), ...newTemplates], { flush: false });
      if (!result.success) return { success: false, items: addedItems, error: result.error };
    }
    const syncResult = await this.flushPendingSync(this.getProfile().userId);
    return { success: syncResult.success, items: addedItems, syncResult, error: syncResult.error };
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
      startMonth: tpl.month || tpl.startMonth || dateStr.substring(0, 7),
      endMonth:   tpl.endMonth || null,  // null = sem data de quitação prevista
      day:        day,    // Usado para calcular a data de vencimento projetada
      date:       dateStr,
      paidMonths: {}      // Mapa de baixas por mês — começa vazio
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
    let applied = 0;
    payments.forEach(payment => {
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

  /**
   * Apaga lançamentos, templates e metas, aguardando a sincronização pendente.
   * Ação irreversível — sempre exibir confirmação ao usuário antes de chamar.
   */
  async clearAll() {
    const profile = this.getProfile();
    await this.saveEntries([], { flush: false });
    await this.saveTemplates([], { flush: false });
    this.saveGoals([]);
    return this.flushPendingSync(profile.userId);
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
   *   version:    "3.9",
   *   exportDate: "2026-11-05T10:00:00.000Z",
   *   entries:    [...],    // Todos os lançamentos pontuais
   *   templates:  [...],    // Todos os templates de gastos fixos
   *   goals:      [...]      // Metas de gastos por categoria
   * }
   */
  exportJSON() {
    const backup = {
      version:    '3.9',
      exportDate: new Date().toISOString(),
      entries:    this.getEntries(),
      templates:  this.getTemplates(),
      goals:      this.getGoals()
    };
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

  async importJSON(text, mode = 'merge') {
    const imported = validateBackupText(text);
    if (imported.error) return { success: false, error: imported.error };
    let restored;
    try {
      restored = mergeBackupData({
        entries: this.getEntries(),
        templates: this.getTemplates(),
        goals: this.getGoals()
      }, imported, mode);
    } catch (error) {
      return { success: false, error: error.message };
    }

    const [entriesResult, templatesResult] = await Promise.all([
      this.saveEntries(restored.entries),
      this.saveTemplates(restored.templates)
    ]);
    if (!this.saveGoals(restored.goals)) {
      return { success: false, error: 'Lançamentos e gastos fixos restaurados, mas não foi possível salvar as metas localmente.' };
    }
    if (!entriesResult.success || !templatesResult.success) {
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
  saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
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
  }
};
