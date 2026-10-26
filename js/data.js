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

   ESQUEMA DE UM LANÇAMENTO (entry):
   {
     id:       "entry-<timestamp>-<random>",  // ID único gerado na inserção
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
     id:         "fix-<timestamp>-<random>",
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
// Nomes versionados para carregar a base de dados real da planilha.
// ----------------------------------------------------------------

/** Chave dos lançamentos pontuais (ganhos de renda e gastos variáveis). */
const STORAGE_ENTRIES = 'gastopro_entries_v4_oct';

/** Chave dos templates de gastos fixos recorrentes. */
const STORAGE_TEMPLATES = 'gastopro_templates_v4_oct';

/** Chave do perfil do usuário. */
const STORAGE_PROFILE = 'gastopro_profile_real_v2';

// ----------------------------------------------------------------
// BASE DE DADOS REAL EXTRAÍDA DA PLANILHA (Controle Mensal Aylton.xlsx)
// ----------------------------------------------------------------

/** Templates de Gastos Fixos Recorrentes e Dívidas reais da planilha */
const INITIAL_REAL_TEMPLATES = [
  // 1. Gastos Fixos Recorrentes (Contínuos - vigentes desde o início de 2026)
  {
    id: 'fix-saude-isabella',
    desc: 'Plano de saúde – Isabella',
    amount: 480.00,
    category: 'Saúde',
    type: 'fixed',
    isDebt: false,
    active: true,
    startMonth: '2026-01',
    endMonth: null,
    day: '05',
    paidMonths: {}
  },
  {
    id: 'fix-jiujitsu-kimura',
    desc: 'Jiu Jitsu – Kimura',
    amount: 120.00,
    category: 'Esporte',
    type: 'fixed',
    isDebt: false,
    active: true,
    startMonth: '2026-01',
    endMonth: null,
    day: '05',
    paidMonths: {}
  },
  {
    id: 'fix-academia-kitfit',
    desc: 'Academia – KitFit',
    amount: 200.00,
    category: 'Esporte',
    type: 'fixed',
    isDebt: false,
    active: true,
    startMonth: '2026-01',
    endMonth: null,
    day: '05',
    paidMonths: {}
  },
  {
    id: 'fix-cartao-credito',
    desc: 'Cartão de crédito (média)',
    amount: 850.00,
    category: 'Cartão de crédito',
    type: 'fixed',
    isDebt: false,
    active: true,
    startMonth: '2026-01',
    endMonth: null,
    day: '05',
    paidMonths: {}
  },

  // 2. Dívidas & Parcelamentos: Faculdade UNINTER
  {
    id: 'fix-uninter-pend-1',
    desc: 'UNINTER – Pendência 1',
    amount: 293.85,
    category: 'Faculdade UNINTER',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-11',
    endMonth: '2026-11',
    day: '09',
    paidMonths: {}
  },
  {
    id: 'fix-uninter-pend-2',
    desc: 'UNINTER – Pendência 2',
    amount: 230.00,
    category: 'Faculdade UNINTER',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-11',
    endMonth: '2026-11',
    day: '09',
    paidMonths: {}
  },
  {
    id: 'fix-uninter-mens-1',
    desc: 'UNINTER – Mensalidades Dez/26 a Jan/28',
    amount: 293.85,
    category: 'Faculdade UNINTER',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-12',
    endMonth: '2028-01',
    day: '09',
    paidMonths: {}
  },
  {
    id: 'fix-uninter-mens-2',
    desc: 'UNINTER – Mensalidades Fev/28 a Jul/28',
    amount: 241.37,
    category: 'Faculdade UNINTER',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2028-02',
    endMonth: '2028-07',
    day: '09',
    paidMonths: {}
  },

  // 3. Dívidas & Parcelamentos: Shopee Empréstimo
  {
    id: 'fix-shopee-emp-1',
    desc: 'Shopee Empréstimo – parcelas 8 a 11',
    amount: 99.38,
    category: 'Shopee Empréstimo',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-11',
    endMonth: '2027-02',
    day: '10',
    paidMonths: {}
  },
  {
    id: 'fix-shopee-emp-2',
    desc: 'Shopee Empréstimo – parcela 12',
    amount: 99.43,
    category: 'Shopee Empréstimo',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2027-03',
    endMonth: '2027-03',
    day: '10',
    paidMonths: {}
  },

  // 4. Dívidas & Parcelamentos: Shopee Parcelado
  {
    id: 'fix-shopee-parc-1',
    desc: 'Shopee Parcelado – parcela 1',
    amount: 588.99,
    category: 'Shopee Parcelado',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-11',
    endMonth: '2026-11',
    day: '20',
    paidMonths: {}
  },
  {
    id: 'fix-shopee-parc-2',
    desc: 'Shopee Parcelado – parcela 2',
    amount: 516.51,
    category: 'Shopee Parcelado',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2026-12',
    endMonth: '2026-12',
    day: '20',
    paidMonths: {}
  },
  {
    id: 'fix-shopee-parc-3',
    desc: 'Shopee Parcelado – parcela 3',
    amount: 516.52,
    category: 'Shopee Parcelado',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2027-01',
    endMonth: '2027-01',
    day: '20',
    paidMonths: {}
  },
  {
    id: 'fix-shopee-parc-4',
    desc: 'Shopee Parcelado – parcelas 4 a 10',
    amount: 156.39,
    category: 'Shopee Parcelado',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2027-02',
    endMonth: '2027-08',
    day: '20',
    paidMonths: {}
  },
  {
    id: 'fix-shopee-parc-5',
    desc: 'Shopee Parcelado – parcela 11',
    amount: 156.41,
    category: 'Shopee Parcelado',
    type: 'fixed',
    isDebt: true,
    active: true,
    startMonth: '2027-09',
    endMonth: '2027-09',
    day: '20',
    paidMonths: {}
  }
];

/** Gera a lista de receitas programadas para os meses do fluxo (R$ 2.710,00/mês) */
function generateRealInitialEntries() {
  const months = [
    '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
    '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10',
    '2027-11', '2027-12', '2028-01', '2028-02', '2028-03', '2028-04',
    '2028-05', '2028-06', '2028-07'
  ];
  const list = [];
  months.forEach(m => {
    list.push({
      id: `rec-03-${m}`,
      month: m,
      type: 'income',
      desc: 'Receita – dia 03',
      amount: 160.00,
      category: 'Receita',
      paid: true,
      date: `${m}-03`
    });
    list.push({
      id: `rec-07-${m}`,
      month: m,
      type: 'income',
      desc: 'Receita – 7º dia útil',
      amount: 1700.00,
      category: 'Receita',
      paid: true,
      date: `${m}-07`
    });
    list.push({
      id: `rec-15-${m}`,
      month: m,
      type: 'income',
      desc: 'Receita – dia 15',
      amount: 850.00,
      category: 'Receita',
      paid: true,
      date: `${m}-15`
    });
  });
  return list;
}

/**
 * @namespace FinanceData
 * @description
 * Singleton de persistência de dados do GastoPro.
 * Centraliza todas as operações de CRUD no localStorage.
 */
const FinanceData = {

  // ================================================================
  // LEITURA E ESCRITA DE LANÇAMENTOS PONTUAIS
  // ================================================================

  /**
   * Lê todos os lançamentos pontuais do localStorage.
   * Inicializa com os dados reais da planilha se ainda não existirem.
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
  saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
      const profile = this.getProfile();
      if (profile && profile.userId && window.SupabaseAuth) {
        entries.forEach(e => window.SupabaseAuth.saveCloudEntry(e, profile.userId));
      }
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar lançamentos no localStorage:', e);
    }
  },

  // ================================================================
  // LEITURA E ESCRITA DE TEMPLATES DE GASTOS FIXOS RECORRENTES
  // ================================================================

  /**
   * Lê todos os templates de gastos fixos do localStorage.
   * Inicializa com os dados reais da planilha se ainda não existirem.
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
  saveTemplates(templates) {
    try {
      localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates));
      const profile = this.getProfile();
      if (profile && profile.userId && window.SupabaseAuth) {
        templates.forEach(t => window.SupabaseAuth.saveCloudTemplate(t, profile.userId));
      }
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar templates fixos no localStorage:', e);
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
    // Passo 1: lançamentos pontuais deste mês
    const entries = this.getEntries().filter(e => e.month === yearMonth);

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
      id:   'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      date: item.date || new Date().toISOString().split('T')[0],
      paid: item.paid !== undefined ? item.paid : true, // Lançamentos nascem confirmados
      ...item
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
    const dateStr   = tpl.date || new Date().toISOString().split('T')[0];
    // Extrai o dia de vencimento da data (ex: "05" de "2026-11-05")
    const day = dateStr.split('-')[2] || '05';

    const newTemplate = {
      id:         'fix-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
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
  // Roteia automaticamente pelo prefixo do ID.
  // ================================================================

  /**
   * Atualiza campos de um item existente (lançamento ou template).
   * Roteamento: IDs 'fix-*' → template | demais → lançamento pontual.
   *
   * @param {string} id            - ID do item a atualizar.
   * @param {Object} updatedFields - Campos a mesclar sobre o item existente.
   * @returns {Object|null} Item atualizado, ou null se não encontrado.
   */
  update(id, updatedFields) {
    // ROTA: Template de gasto fixo
    if (id.startsWith('fix-')) {
      const templates = this.getTemplates();
      const idx = templates.findIndex(t => t.id === id);
      if (idx !== -1) {
        // Sincroniza o dia de vencimento se a data foi alterada
        if (updatedFields.date) {
          updatedFields.day = updatedFields.date.split('-')[2] || templates[idx].day;
        }
        templates[idx] = { ...templates[idx], ...updatedFields };
        this.saveTemplates(templates);
        return templates[idx];
      }
      return null;
    }

    // ROTA: Lançamento pontual
    const entries = this.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], ...updatedFields };
      this.saveEntries(entries);
      return entries[idx];
    }
    return null;
  },

  // ================================================================
  // TOGGLE DE PAGAMENTO (BAIXA / DESBAIXA)
  // Para templates: a baixa é registrada mês a mês em paidMonths{}.
  // Para lançamentos: inverte diretamente o campo booleano `paid`.
  // ================================================================

  /**
   * Inverte o status de pagamento de um item para o mês indicado.
   * - Template: alterna `paidMonths[currentYm]` (baixa específica por mês).
   * - Lançamento: alterna `paid` diretamente.
   *
   * @param {string} id        - ID do item.
   * @param {string} currentYm - Mês de referência "YYYY-MM".
   */
  togglePaid(id, currentYm) {
    // ROTA: Template — baixa registrada apenas para o mês corrente
    if (id.startsWith('fix-')) {
      const templates = this.getTemplates();
      const tpl = templates.find(t => t.id === id);
      if (tpl) {
        if (!tpl.paidMonths) tpl.paidMonths = {}; // Inicializa se não existir
        tpl.paidMonths[currentYm] = !tpl.paidMonths[currentYm];
        this.saveTemplates(templates);
      }
      return;
    }

    // ROTA: Lançamento pontual
    const entries = this.getEntries();
    const item = entries.find(e => e.id === id);
    if (item) {
      item.paid = !item.paid;
      this.saveEntries(entries);
    }
  },

  // ================================================================
  // TOGGLE DE STATUS ATIVO / INATIVO
  // Exclusivo para templates. Gastos inativos não entram nos totais
  // dos meses futuros, mas continuam no banco (não são excluídos).
  // ================================================================

  /**
   * Inverte o status `active` de um template de gasto fixo.
   * Útil para pausar temporariamente uma conta sem apagá-la.
   *
   * @param {string} id - ID do template (deve começar com 'fix-').
   * @returns {boolean} Novo valor de `active`, ou false se não encontrado.
   */
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

  /**
   * Remove permanentemente um item do banco de dados.
   * - 'fix-*' → remove o template (deixa de aparecer em todos os meses).
   * - demais  → remove o lançamento pontual.
   *
   * @param {string} id - ID do item a excluir.
   */
  delete(id) {
    const profile = this.getProfile();
    if (profile && profile.userId && window.SupabaseAuth) {
      if (id.startsWith('fix-')) {
        window.SupabaseAuth.deleteCloudTemplate(id, profile.userId);
      } else {
        window.SupabaseAuth.deleteCloudEntry(id, profile.userId);
      }
    }

    if (id.startsWith('fix-')) {
      const filtered = this.getTemplates().filter(t => t.id !== id);
      this.saveTemplates(filtered);
      return;
    }

    const filtered = this.getEntries().filter(e => e.id !== id);
    this.saveEntries(filtered);
  },

  // ================================================================
  // LIMPEZA TOTAL DA BASE DE DADOS
  // ================================================================

  /**
   * Apaga TODOS os lançamentos e templates do localStorage.
   * Ação irreversível — sempre exibir confirmação ao usuário antes de chamar.
   */
  clearAll() {
    this.saveEntries([]);
    this.saveTemplates([]);
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
   *   version:    "2.5",
   *   exportDate: "2026-11-05T10:00:00.000Z",
   *   entries:    [...],    // Todos os lançamentos pontuais
   *   templates:  [...]     // Todos os templates de gastos fixos
   * }
   */
  exportJSON() {
    const backup = {
      version:    '2.5',
      exportDate: new Date().toISOString(),
      entries:    this.getEntries(),
      templates:  this.getTemplates()
    };
    // Cria a Data URL e dispara o download via link temporário
    const dataStr  = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'gastopro_backup.json');
    dlAnchor.click();
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
    } catch (e) {
      console.error('[GastoPro] Erro ao salvar perfil no localStorage:', e);
    }
  }
};
