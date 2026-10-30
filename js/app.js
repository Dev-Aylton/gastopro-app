/* ================================================================
   GastoPro — Controlador Principal (SPA Controller)
   Autor: Aylton Alberto | Estudante de ADS
   Arquivo: js/app.js

   RESPONSABILIDADE:
   Contém toda a lógica de navegação, renderização das telas,
   cálculos financeiros, eventos e inicialização do app.
   Depende de FinanceData (data.js) para persistência.

   ARQUITETURA DO ARQUIVO (por seção):
   1.  Estado Global (state) — variáveis de controle em memória
   2.  Constantes — nomes de meses e títulos das telas
   3.  Utilitários — formatação BRL, datas e toast de feedback
   4.  Navegação SPA — troca de telas com transição suave
   5.  Orquestrador (renderAll) — ponto central de re-renderização
   6.  Dashboard & Saúde Financeira — KPIs e regra 50/30/20
   7.  Centro de Dívidas — rastreamento de parcelamentos
   8.  Gráfico de Categorias — Chart.js doughnut
   9.  Tela de Ganhos — listagem e CRUD de receitas
   10. Tela de Gastos — listagem e CRUD de despesas
   11. Modal de Edição — formulário de alteração de lançamentos
   12. Modal de Confirmação — substitui o confirm() nativo
   13. Ações do Usuário — excluir, ativar, pagar
   14. Mini Calendário Popover — navegação por mês/ano
   15. Event Listeners & Inicialização — bootstrap do app
   ================================================================ */

'use strict';

window.GastoProSessionHelpers = {
  shouldClearLocalData(status, hasLocalUserId, hasPendingSync = false) {
    return status === 'signed_out' && Boolean(hasLocalUserId) && !hasPendingSync;
  },

  getSignedOutAction(hasLocalUserId, hasPendingSync) {
    if (!hasLocalUserId) return 'preserve';
    return hasPendingSync ? 'preserve-and-login' : 'clear';
  },

  getAccountSwitchAction(activeUserId, nextUserId, hasPendingSync, discardConfirmed = false) {
    if (!activeUserId || activeUserId === nextUserId || !hasPendingSync) return 'continue';
    return discardConfirmed ? 'discard-and-continue' : 'confirm-discard';
  }
};

window.GastoProProfileHelpers = {
  getInitialName(localName, cloudName, metadataName, emailPrefix) {
    return (typeof cloudName === 'string' && cloudName.trim()) ||
      (typeof localName === 'string' && localName.trim()) ||
      (typeof metadataName === 'string' && metadataName.trim()) ||
      emailPrefix || '';
  }
};

window.GastoProAvatarCrop = {
  computeCropRect(imageWidth, imageHeight, zoom = 1, offsetX = 0, offsetY = 0, frameSize = 256) {
    const width = Number(imageWidth);
    const height = Number(imageHeight);
    const frame = Number(frameSize);
    if (![width, height, frame].every(Number.isFinite) || width <= 0 || height <= 0 || frame <= 0) {
      throw new RangeError('Dimensões de recorte inválidas.');
    }
    const safeZoom = Math.min(3, Math.max(1, Number.isFinite(Number(zoom)) ? Number(zoom) : 1));
    const scale = Math.max(frame / width, frame / height) * safeZoom;
    const cropWidth = Math.min(width, frame / scale);
    const cropHeight = Math.min(height, frame / scale);
    const maxX = width - cropWidth;
    const maxY = height - cropHeight;
    const x = Math.min(maxX, Math.max(0, width / 2 - (Number(offsetX) || 0) / scale - cropWidth / 2));
    const y = Math.min(maxY, Math.max(0, height / 2 - (Number(offsetY) || 0) / scale - cropHeight / 2));
    return { x, y, width: cropWidth, height: cropHeight, zoom: safeZoom, scale };
  }
};

function readAvatarDimensions(file) {
  return file.arrayBuffer().then(buffer => {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let dimensions = null;
    if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47) {
      dimensions = { width: view.getUint32(16), height: view.getUint32(20) };
    } else if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
      const chunk = String.fromCharCode(...bytes.slice(12, 16));
      if (chunk === 'VP8X') {
        dimensions = {
          width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
          height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
        };
      } else if (chunk === 'VP8L' && bytes[20] === 0x2f) {
        dimensions = {
          width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
          height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))
        };
      } else if (chunk === 'VP8 ' && bytes[23] === 0x9d &&
        bytes[24] === 0x01 && bytes[25] === 0x2a) {
        dimensions = {
          width: ((bytes[27] & 0x3f) << 8) | bytes[26],
          height: ((bytes[29] & 0x3f) << 8) | bytes[28]
        };
      }
    } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) break;
        const marker = bytes[offset + 1];
        const segmentLength = view.getUint16(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          dimensions = {
            height: view.getUint16(offset + 5),
            width: view.getUint16(offset + 7)
          };
          break;
        }
        if (segmentLength < 2) break;
        offset += segmentLength + 2;
      }
    }
    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new Error('Não foi possível verificar as dimensões da imagem.');
    }
    if (dimensions.width > 12000 || dimensions.height > 12000 ||
      dimensions.width * dimensions.height > 40000000) {
      throw new Error('A imagem tem dimensões muito grandes. Escolha uma imagem com até 40 megapixels.');
    }
    return dimensions;
  });
}

// ================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// Objeto em memória que controla o que está sendo exibido.
// Toda alteração de estado deve ser seguida de renderAll().
// ================================================================

/** Data real do sistema, usada para inicializar o estado. */
const _initDate = new Date();

/**
 * @type {Object} state
 * @description Estado reativo da aplicação.
 * Qualquer função que precise saber "qual mês está ativo" ou
 * "qual tela está visível" deve ler este objeto.
 */
const state = {
  currentView:  'dashboard',              // Tela ativa
  currentYear:  _initDate.getFullYear(),  // Ano selecionado (inicializa com o ano atual)
  currentMonth: _initDate.getMonth() + 1, // Mês selecionado 1–12 (inicializa com mês atual)
  expenseFilter: 'all',                   // Filtro de gastos: 'all' | 'fixed' | 'variable'
  accountBalanceFilter: 'all',
  chartInstance: null                     // Instância ativa do Chart.js (para destruir antes de recriar)
};

const feedbackViewState = {
  mode: 'unknown',
  messages: [],
  loading: false,
  requestId: 0,
  userId: null,
  sending: false,
  draftCategory: 'duvida',
  draftMessage: '',
  notice: '',
  noticeType: 'status'
};

const adminViewState = {
  access: 'unknown',
  filter: 'new',
  messages: [],
  offset: 0,
  hasMore: false,
  loading: false,
  saving: false,
  editingId: null,
  draftReply: '',
  newCount: 0,
  notice: '',
  noticeType: 'status',
  requestId: 0
};

// ================================================================
// 2. CONSTANTES
// ================================================================

/** Nomes dos meses em português, indexados de 0 (Janeiro) a 11 (Dezembro). */
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/** Títulos exibidos na topbar de acordo com a tela ativa. */
const VIEW_TITLES = {
  dashboard: 'Dashboard & Saúde Financeira',
  incomes:   'Gerenciador de Ganhos do Mês',
  expenses:  'Gerenciador de Gastos do Mês',
  accounts:  'Contas',
  contact:   'Fale comigo',
  admin:     'Admin'
};

const LAST_VIEW_STORAGE_KEY = 'gastopro_last_view_v1';
const PERSISTED_VIEW_IDS = Object.freeze(Object.keys(VIEW_TITLES));

window.GastoProViewHelpers = {
  restore(storedView, userId, isAdmin) {
    const ownerId = userId || null;
    if (!storedView || typeof storedView !== 'object' ||
      storedView.ownerId !== ownerId || !PERSISTED_VIEW_IDS.includes(storedView.view)) {
      return 'dashboard';
    }
    if (storedView.view === 'admin' && isAdmin !== true) return 'dashboard';
    return storedView.view;
  }
};

function readStoredMainView() {
  try {
    const stored = localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    return null;
  }
}

function persistMainView(viewId) {
  if (!PERSISTED_VIEW_IDS.includes(viewId) ||
    (viewId === 'admin' && adminViewState.access !== 'allowed')) return;
  try {
    localStorage.setItem(LAST_VIEW_STORAGE_KEY, JSON.stringify({
      view: viewId,
      ownerId: FinanceData.getActiveUserId() || null
    }));
  } catch (error) {
    console.warn('[GastoPro] Não foi possível salvar a última tela:', error);
  }
}

// ================================================================
// 3. UTILITÁRIOS
// ================================================================

/**
 * Formata um número para o padrão de moeda brasileiro (R$).
 * Trata null/undefined como zero para evitar erros de exibição.
 *
 * @param {number|null|undefined} val - Valor numérico a formatar.
 * @returns {string} String formatada. Ex: "R$\xa01.350,00"
 */
function formatCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

let savingInProgress = false;

async function withSaving(button, action, timeoutMs = 15000) {
  if (savingInProgress) return false;
  savingInProgress = true;

  const originalHtml = button.innerHTML;
  const originalDisabled = button.disabled;
  const originalAriaBusy = button.getAttribute('aria-busy');
  button.disabled = true;
  button.textContent = 'Salvando...';
  button.setAttribute('aria-busy', 'true');

  const timeoutId = setTimeout(() => {
    button.textContent = 'Ainda sincronizando, aguarde...';
  }, timeoutMs);

  try {
    return await action();
  } finally {
    clearTimeout(timeoutId);
    button.innerHTML = originalHtml;
    button.disabled = originalDisabled;
    if (originalAriaBusy === null) button.removeAttribute('aria-busy');
    else button.setAttribute('aria-busy', originalAriaBusy);
    savingInProgress = false;
  }
}

window.GastoProSaving = { withSaving };

async function waitForAuthenticatedSave() {
  const profile = FinanceData.getProfile();
  if (!profile.userId || !window.SupabaseAuth || !window.SupabaseAuth.client) {
    return { success: true, skipped: true };
  }
  return FinanceData.flushPendingSync(profile.userId);
}

window.GastoProAuthHelpers = {
  normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  },

  emailsMatch(email, confirmation) {
    return this.normalizeEmail(email) === this.normalizeEmail(confirmation);
  },

  getPasswordRecoverySuccessMessage() {
    return 'Se esse e-mail tiver conta, você receberá as instruções. Confira também o spam.';
  },

  getPasswordRecoveryErrorMessage(error) {
    const message = error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const code = error && typeof error.code === 'string' ? error.code.toLowerCase() : '';
    if (Number(error && error.status) === 429 ||
      /rate[\s_-]?limit|too many|\b429\b|60\s*(?:seconds?|secs?|s)\b|once\s+every|security purposes/.test(`${message} ${code}`)) {
      return 'Muitos pedidos de e-mail agora. Aguarde alguns minutos e tente de novo.';
    }
    return 'Não foi possível enviar o e-mail. Verifique o endereço informado.';
  }
};

/**
 * Gera a string de mês/ano no formato YYYY-MM, com zero à esquerda no mês.
 * Usado como chave padrão de competência em todo o app.
 *
 * @param {number} year  - Ano com 4 dígitos (ex: 2026).
 * @param {number} month - Mês de 1 a 12.
 * @returns {string} Formato YYYY-MM (ex: "2026-11").
 */
function getYearMonthString(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getAccountBalanceForFilter(balances, filter) {
  return filter === 'PF' || filter === 'PJ' ? Number(balances[filter]) : Number(balances.total);
}

function buildAccountSelectOptions(accounts) {
  return [
    { value: '', label: 'Sem conta' },
    ...accounts.map(account => ({ value: account.id, label: account.name }))
  ];
}

function formatFeedbackDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR');
}

function renderContactView() {
  const container = document.getElementById('feedbackContent');
  if (!container) return;

  if (feedbackViewState.mode === 'unknown' || feedbackViewState.mode === 'loading') {
    container.innerHTML = `<p>${escapeHtml(feedbackViewState.notice || 'Verificando seu acesso ao canal...')}</p>`;
    return;
  }

  if (feedbackViewState.mode === 'signed_out') {
    container.innerHTML = `
      <div class="feedback-guest">
        <p>Entre na sua conta para enviar mensagens e acompanhar minhas respostas.</p>
        <button type="button" class="btn-primary feedback-submit" data-action="open-contact" data-login="true">
          <i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar ou criar conta
        </button>
        <p>Se preferir, você também pode escrever para
          <a href="mailto:desenvolvedor.aylton@gmail.com">desenvolvedor.aylton@gmail.com</a>.
        </p>
      </div>
    `;
    return;
  }

  if (feedbackViewState.mode === 'error') {
    container.innerHTML = `
      <p class="feedback-notice feedback-notice-error" role="alert">${escapeHtml(feedbackViewState.notice)}</p>
      <button type="button" class="btn-secondary feedback-submit" data-action="open-contact" data-retry="true">
        Tentar novamente
      </button>
    `;
    return;
  }

  const helper = window.GastoProFeedbackHelpers;
  const messageCards = feedbackViewState.messages.map(message => {
    const category = helper.categories[message.category] || 'Mensagem';
    const status = helper.getStatusLabel(message.status);
    return `
      <article class="manage-item-card feedback-message-card">
        <div class="feedback-message-content">
          <div class="feedback-message-heading">
            <span class="tag-badge">${escapeHtml(category)}</span>
            <span class="tag-badge feedback-status-badge ${message.status === 'answered' ? 'is-answered' : ''}">${escapeHtml(status)}</span>
            <time datetime="${escapeHtml(message.created_at || '')}">${escapeHtml(formatFeedbackDate(message.created_at))}</time>
          </div>
          <p class="feedback-message-text">${escapeHtml(message.message)}</p>
          ${message.reply ? `
            <div class="feedback-reply">
              <strong>Resposta</strong>
              <p class="feedback-message-text">${escapeHtml(message.reply)}</p>
            </div>
          ` : ''}
          <button type="button" class="btn-secondary feedback-delete" data-action="delete-feedback" data-id="${escapeHtml(message.id)}">
            <i class="fa-solid fa-trash-can"></i> Excluir mensagem
          </button>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = `
    <form id="feedbackForm" class="feedback-form">
      <div>
        <label for="feedbackCategory">Categoria</label>
        <select id="feedbackCategory" name="category" required>
          <option value="duvida" ${feedbackViewState.draftCategory === 'duvida' ? 'selected' : ''}>Dúvida</option>
          <option value="sugestao" ${feedbackViewState.draftCategory === 'sugestao' ? 'selected' : ''}>Sugestão</option>
          <option value="problema" ${feedbackViewState.draftCategory === 'problema' ? 'selected' : ''}>Problema</option>
        </select>
      </div>
      <div>
        <label for="feedbackMessage">Mensagem</label>
        <textarea id="feedbackMessage" name="message" minlength="10" maxlength="1000" required
          placeholder="Se quiser que eu responda fora do app, pode deixar seu WhatsApp ou e-mail na mensagem. É opcional e escolha sua.">${escapeHtml(feedbackViewState.draftMessage)}</textarea>
        <div class="feedback-text-meta">
          <small class="feedback-contact-tip">Se quiser que eu responda fora do app, pode deixar seu WhatsApp ou e-mail na mensagem. É opcional e escolha sua.</small>
          <span id="feedbackCharacterCount" aria-live="polite">${helper.getCharacterCount(feedbackViewState.draftMessage)}/1000</span>
        </div>
      </div>
      <p class="feedback-safety-notice">Não envie senhas, dados de cartão nem dados bancários.</p>
      <p class="feedback-response-note">Respondo quando possível; não há prazo fixo.</p>
      <p class="feedback-notice ${feedbackViewState.noticeType === 'error' ? 'feedback-notice-error' : 'feedback-notice-success'}"
        id="feedbackNotice" role="${feedbackViewState.noticeType === 'error' ? 'alert' : 'status'}" aria-live="polite">
        ${escapeHtml(feedbackViewState.notice)}
      </p>
      <button type="submit" class="btn-primary feedback-submit" data-action="send-feedback" ${feedbackViewState.sending ? 'disabled' : ''}>
        ${feedbackViewState.sending ? '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...' : '<i class="fa-solid fa-paper-plane"></i> Enviar'}
      </button>
    </form>
    <section class="feedback-messages-section" aria-labelledby="feedbackMessagesTitle">
      <h3 id="feedbackMessagesTitle">Minhas mensagens</h3>
      ${feedbackViewState.loading ? '<p>Carregando mensagens...</p>' : ''}
      ${!feedbackViewState.loading && !feedbackViewState.messages.length
        ? '<div class="empty-state">Você ainda não enviou mensagens. Quando enviar, elas aparecerão aqui.</div>'
        : `<div class="items-cards-list">${messageCards}</div>`}
    </section>
  `;
}

async function loadMyFeedback(preserveNotice = false) {
  if (feedbackViewState.loading) return;
  const requestId = ++feedbackViewState.requestId;
  feedbackViewState.loading = true;
  feedbackViewState.mode = 'loading';
  if (!preserveNotice) feedbackViewState.notice = '';
  renderContactView();
  try {
    const sessionState = await window.SupabaseAuth.getSessionState();
    if (requestId !== feedbackViewState.requestId) return;
    if (sessionState.status === 'signed_out') {
      feedbackViewState.mode = 'signed_out';
      feedbackViewState.messages = [];
      feedbackViewState.userId = null;
      return;
    }
    if (sessionState.status !== 'authenticated') {
      feedbackViewState.mode = 'error';
      feedbackViewState.notice = 'Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.';
      return;
    }

    feedbackViewState.mode = 'signed_in';
    if (feedbackViewState.userId !== sessionState.user.id) feedbackViewState.messages = [];
    feedbackViewState.userId = sessionState.user.id;
    const result = await window.SupabaseAuth.fetchMyFeedback();
    if (requestId !== feedbackViewState.requestId) return;
    if (!result.success) {
      feedbackViewState.notice = result.error;
      feedbackViewState.noticeType = 'error';
      return;
    }
    feedbackViewState.messages = result.messages;
    feedbackViewState.noticeType = 'status';
  } catch (error) {
    if (requestId !== feedbackViewState.requestId) return;
    console.error('[GastoPro] Não foi possível carregar as mensagens de contato:', error);
    feedbackViewState.mode = 'error';
    feedbackViewState.notice = 'Não foi possível carregar suas mensagens. Tente novamente.';
  } finally {
    if (requestId === feedbackViewState.requestId) {
      feedbackViewState.loading = false;
      renderContactView();
    }
  }
}

function updateAdminNavigation() {
  const navItem = document.getElementById('navAdmin');
  const badge = document.getElementById('adminNewCount');
  if (!navItem || !badge) return;
  const isAdmin = adminViewState.access === 'allowed';
  navItem.hidden = !isAdmin;
  badge.textContent = String(adminViewState.newCount);
  badge.setAttribute('aria-label', `${adminViewState.newCount} mensagens novas`);
  badge.hidden = !isAdmin || adminViewState.newCount === 0;
}

function resetAdminSession() {
  adminViewState.requestId++;
  adminViewState.access = 'denied';
  adminViewState.messages = [];
  adminViewState.offset = 0;
  adminViewState.hasMore = false;
  adminViewState.loading = false;
  adminViewState.saving = false;
  adminViewState.editingId = null;
  adminViewState.draftReply = '';
  adminViewState.newCount = 0;
  adminViewState.notice = '';
  updateAdminNavigation();
  if (state.currentView === 'admin') renderAdminView();
}

function renderAdminView() {
  const container = document.getElementById('adminContent');
  if (!container) return;
  if (adminViewState.access !== 'allowed') {
    container.innerHTML = adminViewState.access === 'denied'
      ? '<div class="empty-state" role="status">Área restrita</div>'
      : '<p role="status" aria-live="polite">Verificando acesso...</p>';
    return;
  }

  const helper = window.GastoProFeedbackHelpers;
  const cards = adminViewState.messages.map((message, index) => {
    const label = helper.getAdminLabel(index);
    const category = helper.categories[message.category] || 'Mensagem';
    const editing = adminViewState.editingId === message.id;
    return `
      <article class="manage-item-card admin-feedback-card">
        <div class="feedback-message-content">
          <div class="feedback-message-heading">
            <strong>${escapeHtml(label)}</strong>
            <span class="tag-badge">${escapeHtml(category)}</span>
            <span class="tag-badge feedback-status-badge ${message.status === 'answered' ? 'is-answered' : ''}">
              ${message.status === 'answered' ? 'Respondida' : 'Nova'}
            </span>
            <time datetime="${escapeHtml(message.created_at || '')}">${escapeHtml(formatFeedbackDate(message.created_at))}</time>
          </div>
          <p class="feedback-message-text">${escapeHtml(message.message)}</p>
          ${message.reply && !editing ? `
            <div class="feedback-reply">
              <strong>Resposta atual</strong>
              <p class="feedback-message-text">${escapeHtml(message.reply)}</p>
            </div>
          ` : ''}
          ${editing ? `
            <div class="admin-reply-editor">
              <label for="adminReplyText">Resposta para ${escapeHtml(label)}</label>
              <textarea id="adminReplyText" maxlength="2000" rows="5">${escapeHtml(adminViewState.draftReply)}</textarea>
              <div class="feedback-text-meta">
                <span id="adminReplyCount" aria-live="polite">${helper.getCharacterCount(adminViewState.draftReply)}/2000</span>
              </div>
              <div class="admin-reply-actions">
                <button type="button" class="btn-primary admin-action-button" data-action="admin-send-reply" data-id="${escapeHtml(message.id)}" ${adminViewState.saving ? 'disabled' : ''}>
                  ${adminViewState.saving ? 'Enviando...' : 'Enviar'}
                </button>
                <button type="button" class="btn-secondary admin-action-button" data-action="admin-cancel-reply" ${adminViewState.saving ? 'disabled' : ''}>Cancelar</button>
              </div>
            </div>
          ` : `
            <button type="button" class="btn-secondary admin-action-button" data-action="admin-reply" data-id="${escapeHtml(message.id)}">
              ${message.reply ? 'Editar resposta' : 'Responder'}
            </button>
          `}
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = `
    <div class="filter-buttons admin-feedback-filters" role="group" aria-label="Filtrar mensagens">
      <button type="button" class="filter-btn ${adminViewState.filter === 'new' ? 'active' : ''}" data-action="admin-filter" data-filter="new" aria-pressed="${adminViewState.filter === 'new'}">Novas</button>
      <button type="button" class="filter-btn ${adminViewState.filter === 'answered' ? 'active' : ''}" data-action="admin-filter" data-filter="answered" aria-pressed="${adminViewState.filter === 'answered'}">Respondidas</button>
      <button type="button" class="filter-btn ${adminViewState.filter === 'all' ? 'active' : ''}" data-action="admin-filter" data-filter="all" aria-pressed="${adminViewState.filter === 'all'}">Todas</button>
    </div>
    <p class="admin-feedback-notice ${adminViewState.noticeType === 'error' ? 'feedback-notice-error' : ''}" role="${adminViewState.noticeType === 'error' ? 'alert' : 'status'}" aria-live="polite">${escapeHtml(adminViewState.notice)}</p>
    ${adminViewState.loading && !adminViewState.messages.length ? '<p role="status">Carregando mensagens...</p>' : ''}
    ${!adminViewState.loading && !adminViewState.messages.length
      ? '<div class="empty-state">Nenhuma mensagem nesta categoria.</div>'
      : `<div class="items-cards-list">${cards}</div>`}
    ${adminViewState.hasMore ? `
      <button type="button" class="btn-secondary admin-load-more" data-action="admin-load-more" ${adminViewState.loading ? 'disabled' : ''}>
        ${adminViewState.loading ? 'Carregando...' : 'Carregar mais'}
      </button>
    ` : ''}
  `;
}

async function refreshAdminBadge() {
  const requestId = ++adminViewState.requestId;
  const isAdmin = await window.SupabaseAuth.checkIsAdmin();
  if (requestId !== adminViewState.requestId) return false;
  adminViewState.access = isAdmin ? 'allowed' : 'denied';
  if (!isAdmin) {
    adminViewState.newCount = 0;
    adminViewState.messages = [];
    adminViewState.editingId = null;
  } else {
    const result = await window.SupabaseAuth.countNewFeedback();
    if (requestId !== adminViewState.requestId) return false;
    if (result.success) {
      adminViewState.newCount = result.count;
    } else {
      adminViewState.newCount = 0;
      console.warn('[GastoPro] Não foi possível atualizar o contador de mensagens novas:', result.error);
    }
  }
  updateAdminNavigation();
  if (state.currentView === 'admin') renderAdminView();
  return isAdmin;
}

async function loadAdminMessages({ reset = false } = {}) {
  if (adminViewState.access !== 'allowed' || adminViewState.loading) return;
  if (reset) {
    adminViewState.messages = [];
    adminViewState.offset = 0;
    adminViewState.hasMore = false;
  }
  const requestId = ++adminViewState.requestId;
  const offset = adminViewState.offset;
  adminViewState.loading = true;
  renderAdminView();
  try {
    const result = await window.SupabaseAuth.fetchAllFeedback({
      status: adminViewState.filter,
      limit: 20,
      offset
    });
    if (requestId !== adminViewState.requestId || state.currentView !== 'admin') return;
    if (!result.success) {
      adminViewState.notice = result.error;
      adminViewState.noticeType = 'error';
      return;
    }
    adminViewState.messages = reset
      ? result.messages
      : [...adminViewState.messages, ...result.messages];
    adminViewState.offset = offset + result.messages.length;
    adminViewState.hasMore = result.messages.length === 20;
    adminViewState.notice = '';
  } catch (error) {
    if (requestId !== adminViewState.requestId) return;
    console.error('[GastoPro] Não foi possível carregar mensagens administrativas:', error);
    adminViewState.notice = 'Não foi possível carregar as mensagens. Tente novamente.';
    adminViewState.noticeType = 'error';
  } finally {
    if (requestId === adminViewState.requestId) {
      adminViewState.loading = false;
      renderAdminView();
    }
  }
}

async function openAdminView() {
  adminViewState.access = 'checking';
  adminViewState.messages = [];
  adminViewState.offset = 0;
  adminViewState.hasMore = false;
  adminViewState.loading = false;
  adminViewState.notice = '';
  renderAdminView();
  const isAdmin = await refreshAdminBadge();
  if (!isAdmin || state.currentView !== 'admin') {
    if (state.currentView === 'admin') renderAdminView();
    return;
  }
  await loadAdminMessages({ reset: true });
}

function getDailyBudgetInfo(balance, year, month, today) {
  const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const targetYm = `${year}-${String(month).padStart(2, '0')}`;
  if (targetYm < currentYm) {
    return { status: 'past', days: 0, dailyAmount: null, message: 'Mês encerrado' };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = targetYm === currentYm
    ? Math.max(1, daysInMonth - today.getDate() + 1)
    : daysInMonth;
  return {
    status: targetYm === currentYm ? 'current' : 'future',
    days,
    dailyAmount: Number(balance) / days,
    message: ''
  };
}

/**
 * Exibe uma notificação toast na tela por 2,5 segundos.
 * Usa a API DOM segura (textContent) em vez de innerHTML para evitar XSS,
 * mesmo quando a mensagem conteém input do usuário (ex: nome do perfil).
 *
 * @param {string} msg - Mensagem a exibir no toast.
 */
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Construção segura via DOM — evita XSS com innerHTML
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-circle-check';
  icon.style.color = '#10b981';

  const span = document.createElement('span');
  span.textContent = msg; // textContent não interpreta HTML — seguro com qualquer input

  toast.innerHTML = '';
  toast.appendChild(icon);
  toast.appendChild(document.createTextNode(' '));
  toast.appendChild(span);

  toast.classList.add('show');
  // Remove automaticamente após 2,5 segundos
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ================================================================
// 4. NAVEGAÇÃO SPA — TROCA DE TELAS
// ================================================================

/**
 * Alterna a tela visível do app (Dashboard, Ganhos ou Gastos).
 * Atualiza o estado, os botões da sidebar, o título da topbar
 * e fecha o menu lateral em dispositivos móveis.
 * Exposta globalmente (window) para ser chamada pela navegação delegada.
 *
 * @param {string} viewId - ID da tela: 'dashboard' | 'incomes' | 'expenses'.
 */
window.switchToView = function(viewId) {
  // Ignora IDs de tela desconhecidos para evitar erros silenciosos
  if (!VIEW_TITLES[viewId]) return;
  state.currentView = viewId;
  persistMainView(viewId);

  // Marca o botão ativo na sidebar e desmarca os demais
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  // Atualiza o título da topbar para o nome da tela ativa
  document.getElementById('currentViewTitle').textContent = VIEW_TITLES[viewId];

  // Remove a classe .active de todas as seções e ativa apenas a selecionada
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) {
    targetSection.classList.add('active');
    // Rola para o topo com animação suave ao trocar de tela
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Em mobile, fecha o menu lateral após selecionar uma tela
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    if (menuToggleBtn) {
      menuToggleBtn.setAttribute('aria-expanded', 'false');
      menuToggleBtn.setAttribute('aria-label', 'Abrir menu de navegação');
    }
  }

  // Re-renderiza toda a interface para refletir a tela ativa
  if (isAdmin && state.currentView === 'admin') persistMainView('admin');
  renderAll();
  if (viewId === 'contact') loadMyFeedback();
  if (viewId === 'admin') {
    openAdminView();
  } else {
    adminViewState.requestId++;
    adminViewState.loading = false;
  }
};

// ================================================================
// 5. ORQUESTRADOR CENTRAL DE RENDERIZAÇÃO
// ================================================================

/**
 * Função central de re-renderização do app.
 * Deve ser chamada SEMPRE que o estado (mês, dados) mudar.
 * Ela recalcula todos os totais e repinta todas as telas.
 *
 * FLUXO:
 *  1. Calcula o mês de competência (ym) e o label legível.
 *  2. Busca todos os itens do mês em FinanceData.getByMonth().
 *  3. Separa os itens por tipo e calcula os totais financeiros.
 *  4. Atualiza os badges da sidebar e o saldo da topbar.
 *  5. Delega para as funções de renderização de cada tela.
 */
function renderAll() {
  updateAccountSelects();
  const ym         = getYearMonthString(state.currentYear, state.currentMonth);
  const monthLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;

  // Atualiza o rótulo de mês no seletor e em todas as telas
  document.getElementById('currentMonthLabel').textContent = monthLabel;
  document.querySelectorAll('.badge-month-label').forEach(el => {
    el.textContent = monthLabel;
  });

  // Busca todos os itens financeiros do mês atual (entradas + projeções fixas)
  const entries   = FinanceData.getByMonth(ym);
  const incomes   = entries.filter(e => e.type === 'income');
  const allFixed  = entries.filter(e => e.type === 'fixed');
  const variables = entries.filter(e => e.type === 'variable');

  // Filtra apenas fixos ativos (ou pagos) para o cálculo de totais.
  // Fixos inativos ainda aparecem na tela de Gastos para gerenciamento,
  // mas não entram nos totais financeiros do mês.
  const activeFixed = allFixed.filter(e => e.active !== false || e.paid);

  // Cálculo dos totais do mês
  const totalIncome   = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalFixed    = activeFixed.reduce((sum, item) => sum + item.amount, 0);
  const totalVariable = variables.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const balance       = totalIncome - totalExpenses; // Saldo = Ganhos - (Fixos + Variáveis)

  // Atualiza os contadores na sidebar
  document.getElementById('sidebarIncomeCount').textContent  = incomes.length;
  document.getElementById('sidebarExpenseCount').textContent = activeFixed.length + variables.length;

  // Atualiza o saldo no canto superior direito da topbar
  const topbarBal = document.getElementById('topbarBalance');
  topbarBal.textContent  = formatCurrency(balance);
  topbarBal.style.color  = balance >= 0 ? 'var(--success)' : 'var(--danger)';

  // Delega para cada tela sua renderização específica
  renderDashboardView(incomes, activeFixed, variables, totalIncome, totalFixed, totalVariable, balance, ym);
  renderIncomesView(incomes, totalIncome);
  // allFixed (com inativos) é passado para permitir gerenciar gastos pausados na tela de Gastos
  renderExpensesView(allFixed, variables, totalFixed, totalVariable, totalExpenses);
  renderAccountsView();
  renderContactView();
  renderAdminView();
  updateAdminNavigation();
}

function updateAccountSelects() {
  const accounts = FinanceData.getAccounts();
  document.querySelectorAll('.account-select').forEach(select => {
    const selectedId = select.value;
    const options = buildAccountSelectOptions(accounts);
    select.innerHTML = options.map(option =>
      `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join('');
    select.value = accounts.some(account => account.id === selectedId) ? selectedId : '';
  });
}

function renderAccountsView() {
  const accounts = FinanceData.getAccounts();
  const list = document.getElementById('accountsList');
  const total = document.getElementById('accountsPageTotal');
  if (total) total.textContent = formatCurrency(FinanceData.getAccountBalances().total);
  if (!list) return;

  if (!accounts.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-building-columns account-empty-icon"></i>
        <p>Nenhuma conta cadastrada.</p>
        <span>Cadastre uma conta PF ou PJ para acompanhar o saldo e vincular lançamentos.</span>
        <button type="button" class="btn-primary account-empty-action" data-action="new-account">
          <i class="fa-solid fa-plus"></i> Cadastrar primeira conta
        </button>
      </div>
    `;
    return;
  }

  list.innerHTML = accounts.map(account => `
    <article class="manage-item-card account-item-card">
      <div class="card-item-left">
        <div class="card-type-icon bg-green-soft"><i class="fa-solid fa-building-columns"></i></div>
        <div class="card-item-info">
          <div class="card-item-title">${escapeHtml(account.name)}</div>
          <div class="card-item-meta account-card-meta">
            ${account.institution ? `<span>${escapeHtml(account.institution)}</span>` : ''}
            <span class="tag-badge account-type-badge">${escapeHtml(account.type)}</span>
          </div>
        </div>
      </div>
      <div class="account-item-right">
        <strong class="account-balance-amount">${formatCurrency(FinanceData.getAccountBalance(account.id))}</strong>
        <div class="account-item-actions">
          <button type="button" class="btn-secondary account-action-button" data-action="edit-account" data-id="${escapeHtml(account.id)}" aria-label="Editar conta ${escapeHtml(account.name)}" title="Editar">
            <i class="fa-solid fa-pen"></i><span>Editar</span>
          </button>
          <button type="button" class="btn-secondary account-action-button" data-action="adjust-account" data-id="${escapeHtml(account.id)}" aria-label="Ajustar saldo da conta ${escapeHtml(account.name)}" title="Ajustar saldo">
            <i class="fa-solid fa-scale-balanced"></i><span>Ajustar saldo</span>
          </button>
          <button type="button" class="btn-secondary account-action-button account-delete-action" data-action="delete-account" data-id="${escapeHtml(account.id)}" aria-label="Excluir conta ${escapeHtml(account.name)}" title="Excluir">
            <i class="fa-solid fa-trash-can"></i><span>Excluir</span>
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderAccountBalancesPanel() {
  const balances = FinanceData.getAccountBalances();
  const accounts = FinanceData.getAccounts();
  const display = document.getElementById('dashboardAccountBalance');
  const label = document.getElementById('accountBalanceFilterLabel');
  const empty = document.getElementById('dashboardAccountsEmpty');
  if (display) display.textContent = formatCurrency(getAccountBalanceForFilter(balances, state.accountBalanceFilter));
  if (label) {
    label.textContent = state.accountBalanceFilter === 'all'
      ? 'Saldo consolidado de todas as contas'
      : `Saldo das contas ${state.accountBalanceFilter}`;
  }
  if (empty) empty.hidden = accounts.length > 0;
  document.querySelectorAll('[data-action="filter-account-balance"]').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === state.accountBalanceFilter);
    button.setAttribute('aria-pressed', button.dataset.filter === state.accountBalanceFilter ? 'true' : 'false');
  });
}

// ================================================================
// 6. DASHBOARD & SAÚDE FINANCEIRA
// ================================================================

/**
 * Renderiza todos os componentes da tela Dashboard:
 * KPIs, diagnóstico de saúde financeira, Centro de Dívidas e gráfico.
 *
 * @param {Array}  incomes       - Lançamentos de renda do mês.
 * @param {Array}  fixed         - Gastos fixos ativos do mês.
 * @param {Array}  variables     - Gastos variáveis do mês.
 * @param {number} totalIncome   - Total de ganhos em R$.
 * @param {number} totalFixed    - Total de gastos fixos em R$.
 * @param {number} totalVariable - Total de gastos variáveis em R$.
 * @param {number} balance       - Saldo: totalIncome - (totalFixed + totalVariable).
 * @param {string} ym            - Mês de competência "YYYY-MM".
 */
function renderDashboardView(incomes, fixed, variables, totalIncome, totalFixed, totalVariable, balance, ym) {
  // --- KPI: Total Recebido ---
  document.getElementById('totalIncomeDisplay').textContent = formatCurrency(totalIncome);
  document.getElementById('incomeCount').textContent =
    `${incomes.length} ${incomes.length === 1 ? 'entrada' : 'entradas'}`;

  // --- KPI: Gastos Fixos ---
  document.getElementById('totalFixedDisplay').textContent = formatCurrency(totalFixed);
  const fixedPaidCount = fixed.filter(f => f.paid).length;
  document.getElementById('fixedPaidStatus').textContent =
    fixed.length > 0 ? `${fixedPaidCount} de ${fixed.length} contas pagas` : 'Nenhuma conta no mês';

  // --- KPI: Gastos Variáveis ---
  document.getElementById('totalVariableDisplay').textContent = formatCurrency(totalVariable);

  // --- KPI: Saldo / Sobra (cor muda conforme positivo ou negativo) ---
  const balanceCard = document.getElementById('balanceDisplay');
  balanceCard.textContent = formatCurrency(balance);
  balanceCard.className   = balance >= 0 ? 'kpi-value text-success' : 'kpi-value text-danger';

  // --- Cálculo das porcentagens para a regra 50/30/20 ---
  // Evita divisão por zero quando não há renda cadastrada
  let pctFixed = 0, pctVar = 0, pctSave = 0;
  if (totalIncome > 0) {
    pctFixed = Math.round((totalFixed    / totalIncome) * 100);
    pctVar   = Math.round((totalVariable / totalIncome) * 100);
    // pctSave = o que sobra, nunca negativo (Math.max garante >= 0)
    pctSave  = Math.max(0, 100 - pctFixed - pctVar);
  }

  document.getElementById('fixedPercentage').textContent    = `${pctFixed}% da renda`;
  document.getElementById('variablePercentage').textContent = `${pctVar}% da renda`;

  // --- Previsão de sobra diária do mês selecionado ---
  const dailyBudget = getDailyBudgetInfo(balance, state.currentYear, state.currentMonth, new Date());
  if (dailyBudget.status === 'past') {
    document.getElementById('dailyBudgetDisplay').textContent = dailyBudget.message;
  } else if (balance > 0) {
    document.getElementById('dailyBudgetDisplay').textContent =
      `Sobra média de ${formatCurrency(dailyBudget.dailyAmount)}/dia nos ${dailyBudget.days} dias restantes`;
  } else {
    document.getElementById('dailyBudgetDisplay').textContent =
      balance < 0
        ? `Atenção: déficit de ${formatCurrency(Math.abs(balance))} no mês`
        : 'Sem sobra no momento';
  }

  // --- Sub-componentes do Dashboard ---
  renderHealthDiagnostic(totalIncome, balance, pctFixed, pctVar, pctSave);
  renderDebtCenter(ym);
  renderCategoryChart(fixed, variables);
  renderGoalsSection(fixed, variables);
  renderAccountBalancesPanel();
}

/**
 * Atualiza o diagnóstico visual de saúde financeira baseado na regra 50/30/20.
 * Determina o status (Excelente / Equilibrado / Fixos Altos / Déficit / Sem Renda)
 * e atualiza o ícone, badge, título e descrição do banner de diagnóstico.
 * Também atualiza os percentuais e as barras de progresso da distribuição.
 *
 * Regra 50/30/20:
 *  - Até 50% da renda em gastos fixos essenciais.
 *  - Até 30% em gastos variáveis e lazer.
 *  - Mínimo de 20% em poupança/investimento.
 *
 * @param {number} income   - Total de renda do mês (R$).
 * @param {number} balance  - Saldo: renda - gastos (R$).
 * @param {number} pctFixed - % da renda comprometida com gastos fixos.
 * @param {number} pctVar   - % da renda comprometida com gastos variáveis.
 * @param {number} pctSave  - % restante disponível para poupança.
 */
function getHealthDiagnostic(income, balance, pctFixed, pctVar, pctSave) {
  if (income === 0) {
    return {
      badge: 'Sem Renda', badgeClass: 'badge badge-warning',
      icon: 'fa-hourglass-start', iconBackground: 'var(--warning-bg)', iconColor: 'var(--warning)',
      title: 'Nenhuma renda lançada neste mês',
      description: 'Acesse a aba Ganhos do Mês para inserir seu salário ou receitas.'
    };
  }
  if (balance < 0) {
    return {
      badge: 'Alerta: Déficit', badgeClass: 'badge badge-danger',
      icon: 'fa-triangle-exclamation', iconBackground: 'var(--danger-bg)', iconColor: 'var(--danger)',
      title: 'Seus gastos superaram seus ganhos!',
      description: `Você está com saldo negativo de ${formatCurrency(Math.abs(balance))}. Priorize pagar as dívidas essenciais para evitar juros.`
    };
  }
  if (pctFixed > 55) {
    return {
      badge: 'Fixos Altos', badgeClass: 'badge badge-warning',
      icon: 'fa-shield-halved', iconBackground: 'var(--warning-bg)', iconColor: 'var(--warning)',
      title: 'Atenção com as despesas fixas e parcelas',
      description: `Seus gastos fixos consomem ${pctFixed}% da renda (ideal até 50%; alerta acima de 55%). Revise suas assinaturas e contas fixas para equilibrar seu orçamento.`
    };
  }
  if (pctVar > 30) {
    return {
      badge: 'Variáveis Altos', badgeClass: 'badge badge-warning',
      icon: 'fa-cart-shopping', iconBackground: 'var(--warning-bg)', iconColor: 'var(--warning)',
      title: 'Atenção aos gastos variáveis',
      description: `Seus gastos variáveis consomem ${pctVar}% da renda, acima do limite recomendado de 30%. Revise gastos do dia a dia e lazer.`
    };
  }
  if (pctSave >= 20) {
    return {
      badge: 'Excelente', badgeClass: 'badge badge-success',
      icon: 'fa-circle-check', iconBackground: 'var(--success-bg)', iconColor: 'var(--success)',
      title: 'Finanças sob total controle 🎉',
      description: `Você tem ${pctSave}% (${formatCurrency(balance)}) disponível para construir sua reserva de emergência e investir!`
    };
  }
  return {
    badge: 'Equilibrado', badgeClass: 'badge badge-success',
    icon: 'fa-scale-balanced', iconBackground: 'var(--primary-bg)', iconColor: 'var(--primary)',
    title: 'Orçamento mensal saudável',
    description: `Contas em dia com sobra positiva de ${formatCurrency(balance)} garantindo sua tranquilidade financeira.`
  };
}

function renderHealthDiagnostic(income, balance, pctFixed, pctVar, pctSave) {
  const icon = document.getElementById('healthStatusIcon');
  const title = document.getElementById('healthTitle');
  const desc = document.getElementById('healthDescription');
  const badge = document.getElementById('healthBadge');
  const diagnostic = getHealthDiagnostic(income, balance, pctFixed, pctVar, pctSave);

  document.getElementById('lblPctFixed').textContent = `${pctFixed}%`;
  document.getElementById('lblPctVar').textContent = `${pctVar}%`;
  document.getElementById('lblPctSave').textContent = `${pctSave}%`;
  document.getElementById('barFixed').style.width = `${Math.min(100, pctFixed)}%`;
  document.getElementById('barVariable').style.width = `${Math.min(100, pctVar)}%`;
  document.getElementById('barSavings').style.width = `${Math.min(100, pctSave)}%`;

  badge.className = diagnostic.badgeClass;
  badge.textContent = diagnostic.badge;
  icon.innerHTML = `<i class="fa-solid ${diagnostic.icon}"></i>`;
  icon.style.background = diagnostic.iconBackground;
  icon.style.color = diagnostic.iconColor;
  title.textContent = diagnostic.title;
  desc.textContent = diagnostic.description;
}

window.GastoProReportHelpers = {
  getHealthDiagnostic,
  getDailyBudgetInfo
};

window.GastoProAccountDeletion = {
  isConfirmationValid(value) {
    return value === 'EXCLUIR';
  },

  async deleteAccountAndClearPendingSync(auth, financeData) {
    const result = await auth.deleteAccount();
    if (result && result.success) {
      try {
        await auth.signOut('local');
      } catch (error) {
        console.error('[GastoPro] Falha ao encerrar a sessão local após excluir a conta:', error);
      } finally {
        financeData.clearUserData();
        if (window.GastoProOnboarding) {
          window.GastoProOnboarding.clearSeen();
        } else {
          localStorage.removeItem('gastopro_tutorial_seen');
        }
      }
    }
    return result;
  }
};

function initOnboarding() {
  const tutorial = window.GastoProOnboarding;
  const modal = document.getElementById('onboardingModal');
  const title = document.getElementById('onboardingTitle');
  const text = document.getElementById('onboardingText');
  const icon = document.getElementById('onboardingIcon');
  const counter = document.getElementById('onboardingCounter');
  const backButton = document.getElementById('onboardingBackBtn');
  const nextButton = document.getElementById('onboardingNextBtn');
  const skipButton = document.getElementById('onboardingSkipBtn');
  const closeButton = document.getElementById('closeOnboardingBtn');
  const manualButton = document.getElementById('reopenOnboardingBtn');
  const topicsContainer = document.getElementById('howToUseTopics');

  if (!tutorial || !modal || !title || !text || !icon || !counter ||
    !backButton || !nextButton || !skipButton || !closeButton || !topicsContainer) return;

  const topics = tutorial.getTopics();
  let currentIndex = tutorial.getStartIndex();

  topics.forEach(topic => {
    const details = document.createElement('details');
    details.className = 'how-to-use-topic';
    const summary = document.createElement('summary');
    const topicIcon = document.createElement('i');
    topicIcon.className = topic.icon;
    topicIcon.setAttribute('aria-hidden', 'true');
    const topicTitle = document.createElement('span');
    topicTitle.textContent = topic.title;
    const description = document.createElement('p');
    description.textContent = topic.text;
    summary.append(topicIcon, topicTitle);
    details.append(summary, description);
    topicsContainer.appendChild(details);
  });

  function renderStep() {
    const topic = topics[currentIndex];
    title.textContent = topic.title;
    text.textContent = topic.text;
    icon.className = topic.icon;
    counter.textContent = `${currentIndex + 1} de ${topics.length}`;
    backButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === topics.length - 1 ? 'Concluir' : 'Próximo';
  }

  function closeTutorial() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openTutorial() {
    currentIndex = tutorial.getStartIndex();
    tutorial.markSeen();
    renderStep();
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function move(action) {
    const result = tutorial.navigate(currentIndex, action);
    currentIndex = result.index;
    if (result.close) {
      closeTutorial();
      return;
    }
    renderStep();
  }

  backButton.addEventListener('click', () => move('back'));
  nextButton.addEventListener('click', () => move('next'));
  skipButton.addEventListener('click', () => move('skip'));
  closeButton.addEventListener('click', closeTutorial);
  if (manualButton) manualButton.addEventListener('click', openTutorial);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeTutorial();
  });

  if (tutorial.shouldShowOnFirstAccess()) openTutorial();
}

// ================================================================
// 7. CENTRO DE DÍVIDAS & PREVISÃO DE QUITAÇÃO
// ================================================================

/**
 * Renderiza o painel "Centro de Dívidas" no Dashboard.
 * Identifica automaticamente os templates marcados como dívida/parcelamento
 * (por isDebt, endMonth, ou por categoria/descrição) e exibe para cada um:
 *  - Barra de progresso de parcelas pagas vs. restantes.
 *  - Valor restante a pagar e previsão de quitação.
 *  - Badge "Quitada!" quando todas as parcelas foram baixadas.
 *
 * O painel é 100% dinâmico: alimentado apenas pelos dados que o
 * próprio usuário cadastra — não há dados fixos hardcoded.
 *
 * @param {string} currentYm - Mês atual no formato "YYYY-MM".
 */
function getDebtCenterData(currentYm, templates = FinanceData.getTemplates()) {
  const debtTemplates = templates.filter(t => {
    if (t.isDebt || t.endMonth) return true;
    const cat = (t.category || '').toLowerCase();
    const desc = (t.desc || '').toLowerCase();
    return cat.includes('empréstimo') || cat.includes('emprestimo') ||
           cat.includes('parcela') || cat.includes('financiamento') ||
           cat.includes('dívida') || cat.includes('divida') ||
           desc.includes('empréstimo') || desc.includes('emprestimo') ||
           desc.includes('parcela') || desc.includes('financiamento') ||
           desc.includes('dívida') || desc.includes('divida');
  });

  const items = debtTemplates.map(tpl => {
    const paidMonthsCount = tpl.paidMonths ? Object.values(tpl.paidMonths).filter(Boolean).length : 0;
    let totalMonths = 0;
    let remainingMonths = 0;

    if (tpl.endMonth && tpl.startMonth) {
      const [sYear, sMonth] = tpl.startMonth.split('-').map(Number);
      const [eYear, eMonth] = tpl.endMonth.split('-').map(Number);
      totalMonths = Math.max(1, (eYear - sYear) * 12 + (eMonth - sMonth) + 1);
      // Regra atual: parcelas restantes = total do período menos meses marcados como pagos,
      // mesmo que o mês final já tenha passado; o atraso não baixa parcelas automaticamente.
      remainingMonths = Math.max(0, totalMonths - paidMonthsCount);
    } else {
      totalMonths = paidMonthsCount + (tpl.paidMonths && tpl.paidMonths[currentYm] ? 0 : 1);
      remainingMonths = tpl.paidMonths && tpl.paidMonths[currentYm] ? 0 : 1;
    }

    const remainingAmount = remainingMonths * tpl.amount;
    const paidAmount = paidMonthsCount * tpl.amount;
    const totalProgressAmount = remainingAmount + paidAmount || tpl.amount * totalMonths;
    const isFinished = remainingMonths === 0;
    const isOverdue = Boolean(tpl.endMonth && currentYm > tpl.endMonth && remainingMonths > 0);
    return {
      id: tpl.id,
      description: tpl.desc,
      category: tpl.category || 'Empréstimo',
      amount: tpl.amount,
      paidMonthsCount,
      totalMonths,
      remainingMonths,
      remainingAmount,
      paidAmount,
      percentagePaid: totalProgressAmount > 0
        ? Math.min(100, Math.round((paidAmount / totalProgressAmount) * 100))
        : 0,
      isFinished: Boolean(isFinished),
      isOverdue,
      forecastMonth: tpl.endMonth || null
    };
  });
  return {
    items,
    totalRemaining: items.reduce((sum, item) => sum + item.remainingAmount, 0)
  };
}

window.GastoProReportHelpers.getDebtCenterData = getDebtCenterData;

function renderDebtCenter(currentYm) {
  const container = document.getElementById('debtCardsGrid');
  const totalRemainingEl = document.getElementById('totalDebtRemaining');
  if (!container) return;

  const debtData = getDebtCenterData(currentYm);

  if (debtData.items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-debt" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: var(--text-muted); opacity: 0.85;">
        <i class="fa-solid fa-flag-checkered" style="font-size: 2rem; margin-bottom: 0.6rem; opacity: 0.4;"></i>
        <p style="font-weight: 500; margin-bottom: 0.25rem;">Nenhum parcelamento ou empréstimo em andamento</p>
        <span style="font-size: 0.85rem;">Ao cadastrar um gasto fixo com data final ou categoria de empréstimo/parcelamento, o cronograma de quitação aparecerá aqui automaticamente.</span>
        <small class="empty-state-tip">Informe a data final no cadastro para ver a previsão de término.</small>
      </div>
    `;
    if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(0);
    return;
  }

  const cardsHtml = debtData.items.map(debt => {
    return `
      <div class="debt-card-item">
        <div class="debt-card-header">
          <span>${escapeHtml(debt.description)}</span>
          <span class="debt-status-tag ${debt.isFinished ? 'badge-success' : debt.isOverdue ? 'badge-danger' : 'badge-warning'}">
            ${debt.isFinished ? '🎉 Quitada!' : debt.isOverdue ? `${debt.remainingMonths} parcela(s) em aberto` : `${debt.remainingMonths}x restantes`}
          </span>
        </div>
        <div class="debt-progress-bg">
          <div class="debt-progress-fill" style="width: ${debt.percentagePaid}%; background: ${debt.isFinished ? 'var(--success)' : 'var(--warning)'};"></div>
        </div>
        <div class="debt-card-meta">
          <span>Resta: <strong>${formatCurrency(debt.remainingAmount)}</strong></span>
          <span>${debt.forecastMonth ? `Previsão: ${escapeHtml(debt.forecastMonth.split('-').reverse().join('/'))}` : 'Gasto Ativo'}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
  if (totalRemainingEl) {
    totalRemainingEl.textContent = formatCurrency(debtData.totalRemaining);
  }
}

// ================================================================
// 8. GRÁFICO DE DISTRIBUIÇÃO DE GASTOS (Chart.js — Doughnut)
// ================================================================

/**
 * Renderiza o gráfico de rosca (doughnut) com a distribuição
 * dos gastos do mês por categoria.
 * Destrói e recria a instância do Chart.js para evitar sobreposição
 * de gráficos ao mudar de mês ou atualizar dados.
 * Exibe uma mensagem de "vazio" quando não há gastos no mês.
 *
 * @param {Array} fixed     - Gastos fixos do mês (cada item contribui com sua categoria).
 * @param {Array} variables - Gastos variáveis do mês.
 */
function renderCategoryChart(fixed, variables) {
  const ctx = document.getElementById('categoryChart');
  const emptyMsg = document.getElementById('chartEmptyMessage');
  if (!ctx) return;

  const catTotals = new Map();
  const knownCategories = [...GastoProCategories.EXPENSE, ...GastoProCategories.INCOME];
  [...fixed, ...variables].forEach(item => {
    const cat = item.type === 'fixed' ? (item.category || item.desc) : item.category;
    const category = knownCategories.find(value =>
      GastoProCategories.normalize(value) === GastoProCategories.normalize(cat)
    ) || String(cat || 'Outros').trim();
    const key = GastoProCategories.normalize(category);
    const current = catTotals.get(key) || { label: category, amount: 0 };
    current.amount += Number(item.amount) || 0;
    catTotals.set(key, current);
  });

  const labels = [...catTotals.values()].map(item => item.label);
  const data = [...catTotals.values()].map(item => item.amount);

  if (labels.length === 0) {
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
    ctx.style.display = 'none';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  ctx.style.display = 'block';
  if (emptyMsg) emptyMsg.style.display = 'none';

  const colors = [
    '#6366f1', '#f59e0b', '#ec4899', '#10b981', '#3b82f6',
    '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#64748b'
  ];

  if (typeof Chart === 'undefined') {
    console.info('Chart.js ainda não carregou ou está indisponível.');
    return;
  }

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#151a26',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 12,
            color: '#94a3b8',
            font: { family: 'Inter', size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(c) {
              const val = c.raw || 0;
              const sum = data.reduce((a, b) => a + b, 0);
              const pct = ((val / sum) * 100).toFixed(1);
              return ` ${c.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

// ================================================================
// 9. TELA DE GANHOS — GERENCIADOR DE RECEITAS
// ================================================================

/**
 * Renderiza a tela "Ganhos do Mês" com o total e a lista detalhada de receitas.
 * Cada item exibe descrição, categoria, data, valor e botões de editar/excluir.
 * Exibe um estado vazio com instruções quando não há ganhos no mês.
 *
 * @param {Array}  incomes     - Lançamentos de renda do mês.
 * @param {number} totalIncome - Soma total de ganhos do mês em R$.
 */
function renderIncomesView(incomes, totalIncome) {
  document.getElementById('incomesPageTotal').textContent = formatCurrency(totalIncome);

  const container = document.getElementById('incomesListDetailed');
  if (!container) return;

  if (incomes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-hand-holding-dollar" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>Nenhum ganho cadastrado para este mês ainda.</p>
        <span>Use o formulário acima para adicionar seu salário ou rendas extras.</span>
        <small class="empty-state-tip">Depois de salvar, você pode editar ou excluir o lançamento nesta lista.</small>
      </div>
    `;
    return;
  }

  const accountNames = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  container.innerHTML = incomes.map(item => {
    const accountName = accountNames.get(item.accountId);
    return `
    <div class="manage-item-card">
      <div class="card-item-left">
        <div class="card-type-icon bg-green-soft">
          <i class="fa-solid fa-arrow-down"></i>
        </div>
        <div class="card-item-info">
          <div class="card-item-title">${escapeHtml(item.desc)}</div>
          <div class="card-item-meta">
            <span class="tag-badge">${escapeHtml(item.category || 'Renda')}</span>
            ${accountName ? `<span class="tag-badge">${escapeHtml(accountName)}</span>` : ''}
            <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(formatDate(item.date))}</span>
          </div>
        </div>
      </div>

      <div class="card-item-right">
        <div class="card-item-amount text-success">+ ${formatCurrency(item.amount)}</div>
        <div class="card-item-actions">
          <button class="btn-action-edit" data-action="edit" data-id="${escapeHtml(item.id)}" title="Alterar Ganho" aria-label="Editar ganho ${escapeHtml(item.desc)}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action-delete" data-action="delete" data-id="${escapeHtml(item.id)}" title="Excluir Ganho" aria-label="Excluir ganho ${escapeHtml(item.desc)}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  }).join('');
}

// ================================================================
// 10. TELA DE GASTOS — GERENCIADOR DE DESPESAS
// ================================================================

/**
 * Renderiza a tela "Gastos do Mês" com filtros, subtotais e lista.
 * Suporta filtragem por tipo (Todos / Fixos / Variáveis).
 * Para gastos fixos, exibe botões de status (Ativo/Inativo) e checkbox de pagamento.
 * Gastos inativos são exibidos com estilo esmaecido para facilitar identificação.
 *
 * @param {Array}  fixed         - Todos os gastos fixos do mês (incluindo inativos).
 * @param {Array}  variables     - Gastos variáveis do mês.
 * @param {number} totalFixed    - Total de fixos ativos em R$ (para o subtotal).
 * @param {number} totalVariable - Total de variáveis em R$.
 * @param {number} totalExpenses - totalFixed + totalVariable.
 */
function renderExpensesView(fixed, variables, totalFixed, totalVariable, totalExpenses) {
  document.getElementById('expensesPageTotal').textContent = formatCurrency(totalExpenses);
  document.getElementById('subtotalFixedLabel').textContent = formatCurrency(totalFixed);
  document.getElementById('subtotalVarLabel').textContent = formatCurrency(totalVariable);

  const container = document.getElementById('expensesListDetailed');
  if (!container) return;

  // Filtrar de acordo com a aba selecionada
  let itemsToDisplay = [];
  if (state.expenseFilter === 'all') {
    itemsToDisplay = [...fixed, ...variables];
  } else if (state.expenseFilter === 'fixed') {
    itemsToDisplay = fixed;
  } else if (state.expenseFilter === 'variable') {
    itemsToDisplay = variables;
  }

  if (itemsToDisplay.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>Nenhum gasto encontrado para este filtro.</p>
        <span>Cadastre uma nova despesa no formulário acima.</span>
        <small class="empty-state-tip">Escolha a categoria e confira se o gasto é fixo ou variável antes de salvar.</small>
      </div>
    `;
    return;
  }

  const accountNames = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  container.innerHTML = itemsToDisplay.map(item => {
    const isFixed = item.type === 'fixed';
    const typeLabel = isFixed ? 'Conta Fixa Recorrente' : 'Gasto Variável';
    const iconClass = isFixed ? 'bg-yellow-soft' : 'bg-red-soft';
    const iconI = isFixed ? 'fa-solid fa-lock' : 'fa-solid fa-cart-shopping';
    const isInactive = isFixed && item.active === false;
    const accountName = accountNames.get(item.accountId);

    return `
      <div class="manage-item-card ${item.paid ? 'is-paid' : ''} ${isInactive ? 'is-inactive-card' : ''}">
        <div class="card-item-left">
          <div class="card-type-icon ${iconClass}">
            <i class="${iconI}"></i>
          </div>
          <div class="card-item-info">
            <div class="card-item-title">${escapeHtml(item.desc)}</div>
            <div class="card-item-meta">
              <span class="tag-badge">${escapeHtml(item.category || typeLabel)}</span>
              ${accountName ? `<span class="tag-badge">${escapeHtml(accountName)}</span>` : ''}
              <span class="tag-badge" style="opacity: 0.8;">${typeLabel}</span>
              ${isFixed ? `
                <button class="badge-status-btn ${item.active ? 'status-active' : 'status-inactive'}" 
                        data-action="toggle-active" data-id="${escapeHtml(item.id)}"
                        title="Clique para ${item.active ? 'pausar nos meses seguintes' : 'reativar nos meses seguintes'}">
                  <i class="fa-solid ${item.active ? 'fa-circle-check' : 'fa-circle-pause'}"></i> ${item.active ? 'Ativo' : 'Inativo'}
                </button>
              ` : ''}
              <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(formatDate(item.date))}</span>
            </div>
          </div>
        </div>

        <div class="card-item-right">
          <!-- Checkbox de Pago (específico para o mês atual) -->
          <label class="checkbox-paid-label" title="${item.paid ? 'Marcar como pendente neste mês' : 'Dar baixa como pago neste mês'}">
            <input type="checkbox" ${item.paid ? 'checked' : ''} data-action="toggle-paid" data-id="${escapeHtml(item.id)}" />
            <span>${item.paid ? 'Pago' : 'Pagar'}</span>
          </label>

          <div class="card-item-amount ${isFixed ? 'text-warning' : 'text-danger'} ${isInactive ? 'text-muted' : ''}">
            - ${formatCurrency(item.amount)}
          </div>

          <div class="card-item-actions">
            <button class="btn-action-edit" data-action="edit" data-id="${escapeHtml(item.id)}" title="Alterar Informação" aria-label="Editar gasto ${escapeHtml(item.desc)}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-action-delete" data-action="delete" data-id="${escapeHtml(item.id)}" title="Excluir Gasto" aria-label="Excluir gasto ${escapeHtml(item.desc)}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================================================================
// 11. MODAL DE EDIÇÃO DE LANÇAMENTOS
// ================================================================

/**
 * Abre o modal de edição preenchido com os dados do item especificado.
 * Detecta automaticamente se é um ganho, gasto fixo ou variável
 * e ajusta a visibilidade dos campos de Status e Mês Final.
 *
 * @param {string} id - UUID do item a editar.
 */
window.openEditModal = function(id) {
  const all = FinanceData.getAll();
  const item = all.find(e => e.id === id);
  if (!item) {
    console.warn('[GastoPro] Item não encontrado para edição:', id);
    return;
  }

  document.getElementById('editItemId').value = item.id;
  document.getElementById('editDesc').value = item.desc || '';
  document.getElementById('editAmount').value = item.amount || '';
  const editCategory = document.getElementById('editCategory');
  const categoryValue = item.category || '';
  editCategory.querySelectorAll('[data-legacy="true"]').forEach(option => option.remove());
  if (categoryValue && !Array.from(editCategory.options).some(option => option.value === categoryValue)) {
    const legacyOption = document.createElement('option');
    legacyOption.value = categoryValue;
    legacyOption.textContent = categoryValue;
    legacyOption.dataset.legacy = 'true';
    editCategory.appendChild(legacyOption);
  }
  editCategory.value = categoryValue;

  const editTypeSelect = document.getElementById('editType');
  if (editTypeSelect) {
    editTypeSelect.value = item.type || (item.isDebt ? 'debt' : (item.isTemplate ? 'fixed' : 'variable'));
    const isTemplate = FinanceData.getTemplates().some(template => template.id === id);
    Array.from(editTypeSelect.options).forEach(option => {
      option.disabled = isTemplate
        ? option.value === 'income' || option.value === 'variable'
        : option.value === 'fixed' || option.value === 'debt';
    });
  }

  document.getElementById('editDate').value = item.date || getTodayString();
  const editAccount = document.getElementById('editAccount');
  if (editAccount) editAccount.value = item.accountId || '';

  const isFixed = item.type === 'fixed' || item.type === 'debt' || item.isTemplate ||
    FinanceData.getTemplates().some(template => template.id === id);
  const statusGroup = document.getElementById('editStatusGroup');
  const endMonthGroup = document.getElementById('editEndMonthGroup');
  if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
  if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';

  if (document.getElementById('editActive')) {
    document.getElementById('editActive').value = item.active !== false ? 'true' : 'false';
  }
  if (document.getElementById('editEndMonth')) {
    document.getElementById('editEndMonth').value = item.endMonth || '';
  }

  const title = item.type === 'income' ? 'Alterar Ganho' : (isFixed ? 'Alterar Gasto Fixo' : 'Alterar Gasto Variável');
  document.getElementById('editModalTitle').textContent = title;

  document.getElementById('editModal').classList.add('active');
};

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

function openAccountModal(id) {
  const account = id ? FinanceData.getAccounts().find(item => item.id === id) : null;
  const modal = document.getElementById('accountModal');
  document.getElementById('accountModalTitle').textContent = account ? 'Editar conta' : 'Nova conta';
  document.getElementById('accountId').value = account ? account.id : '';
  document.getElementById('accountName').value = account ? account.name : '';
  document.getElementById('accountInstitution').value = account ? account.institution || '' : '';
  document.getElementById('accountType').value = account ? account.type : 'PF';
  document.getElementById('accountInitialBalance').value = account ? account.initialBalance : '0';
  const error = document.getElementById('accountFormError');
  error.textContent = '';
  error.hidden = true;
  modal.classList.add('active');
  setTimeout(() => document.getElementById('accountName').focus(), 100);
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.remove('active');
}

function openAdjustAccountModal(id) {
  const account = FinanceData.getAccounts().find(item => item.id === id);
  if (!account) return;
  document.getElementById('adjustAccountId').value = account.id;
  document.getElementById('adjustAccountName').textContent = account.name;
  document.getElementById('adjustAccountBalance').value = FinanceData.getAccountBalance(id);
  const error = document.getElementById('adjustAccountError');
  error.textContent = '';
  error.hidden = true;
  document.getElementById('adjustAccountModal').classList.add('active');
  setTimeout(() => document.getElementById('adjustAccountBalance').focus(), 100);
}

function closeAdjustAccountModal() {
  document.getElementById('adjustAccountModal').classList.remove('active');
}

function deleteAccount(id) {
  const account = FinanceData.getAccounts().find(item => item.id === id);
  if (!account) return;
  showConfirm({
    title: 'Excluir conta?',
    message: `Excluir "${account.name}"? Os lançamentos e gastos fixos vinculados NÃO serão apagados; apenas ficarão sem conta.`,
    iconClass: 'fa-solid fa-trash-can',
    okLabel: 'Sim, excluir conta',
    onConfirm: async () => {
      try {
        const result = await FinanceData.deleteAccount(id);
        renderAll();
        if (!result.success) {
          showToast(`Não foi possível concluir a sincronização da exclusão: ${result.error && result.error.message || result.error || 'erro desconhecido'}`);
          return;
        }
        showToast('Conta excluída. Os lançamentos vinculados foram mantidos sem conta.');
      } catch (error) {
        console.error('[GastoPro] Falha ao excluir conta:', error);
        renderAll();
        showToast(`Não foi possível excluir a conta: ${error.message || error}`);
      }
    }
  });
}

// ================================================================
// 12. MODAL DE CONFIRMAÇÃO CUSTOMIZADO
// ================================================================

/**
 * Exibe um modal de confirmação elegante que substitui o confirm() nativo.
 * Usa clonagem de botões para remover listeners anteriores e evitar
 * acúmulo de callbacks (importante em ações repetidas como excluir).
 *
 * @param {Object}   options            - Configurações do modal.
 * @param {string}   options.title      - Título do modal.
 * @param {string}   options.message    - Mensagem de confirmação.
 * @param {string}   [options.iconClass]   - Classe FontAwesome do ícone.
 * @param {string}   [options.okLabel]     - Texto do botão de confirmação.
 * @param {string}   [options.okBtnClass]  - Classe CSS do botão OK.
 * @param {Function} options.onConfirm  - Callback executado ao confirmar.
 */
function showConfirm({
  title, message, iconClass, okLabel, okBtnClass, onConfirm,
  onBackup, secondaryLabel, onSecondary, keepOpenOnConfirm = false
}) {
  const modal = document.getElementById('confirmModal');
  const iconEl = document.getElementById('confirmIcon');
  const iconWrapper = document.getElementById('confirmIconWrapper');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const backupBtn = document.getElementById('confirmBackupBtn');

  iconEl.className = iconClass || 'fa-solid fa-triangle-exclamation';
  iconWrapper.className = 'confirm-icon-wrapper confirm-icon-danger';
  titleEl.textContent = title || 'Tem certeza?';
  msgEl.textContent = message || 'Esta ação não pode ser desfeita.';

  // Clona os botões para remover listeners antigos e evitar acúmulo
  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  const newBackup = backupBtn ? backupBtn.cloneNode(true) : null;
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  if (backupBtn && newBackup) {
    backupBtn.parentNode.replaceChild(newBackup, backupBtn);
    newBackup.hidden = !onBackup && !onSecondary;
    newBackup.textContent = secondaryLabel || 'Baixar backup JSON';
  }

  newOk.textContent = okLabel || 'Confirmar';
  newOk.className = okBtnClass || 'btn-danger';

  newOk.addEventListener('click', async () => {
    if (!keepOpenOnConfirm) modal.classList.remove('active');
    await onConfirm(newOk);
  });
  newCancel.addEventListener('click', () => {
    modal.classList.remove('active');
  });
  if (newBackup && (onBackup || onSecondary)) {
    newBackup.addEventListener('click', async () => {
      if (onSecondary) {
        if (!keepOpenOnConfirm) modal.classList.remove('active');
        await onSecondary(newBackup);
      } else {
        onBackup();
      }
    });
  }

  modal.classList.add('active');
}

// ================================================================
// 13. AÇÕES DO USUÁRIO (globais — chamadas pela delegação de eventos)
// ================================================================

/**
 * Exibe confirmação e exclui um item (lançamento ou template).
 * Para templates fixos, exibe aviso de que o gasto deixará de se repetir.
 *
 * @param {string} id - ID do item a excluir.
 */
window.deleteEntry = function(id) {
  const isFixed = FinanceData.getTemplates().some(template => template.id === id);
  showConfirm({
    title: isFixed ? 'Excluir gasto fixo recorrente?' : 'Excluir lançamento?',
    message: isFixed 
      ? 'Este gasto fixo deixará de se repetir nos meses futuros. Deseja realmente excluir?'
      : 'Esta ação não pode ser desfeita. O item será removido permanentemente.',
    iconClass: 'fa-solid fa-trash-can',
    okLabel: 'Sim, excluir',
    onConfirm: async () => {
      const result = await FinanceData.delete(id);
      renderAll();
      if (result && result.success) showToast('Item excluído com sucesso!');
    }
  });
};

/**
 * Inverte o status de pagamento de um item para o mês atual.
 * Para templates fixos: registra a baixa em paidMonths[ym].
 * Para lançamentos: alterna o campo paid.
 *
 * @param {string} id - ID do item.
 */
window.togglePaidEntry = function(id) {
  const ym = getYearMonthString(state.currentYear, state.currentMonth);
  FinanceData.togglePaid(id, ym);
  renderAll();
};

/**
 * Inverte o status ativo/inativo de um template de gasto fixo.
 * Gastos inativos são mantidos no banco mas excluídos dos totais futuros.
 *
 * @param {string} id - ID do template fixo.
 */
window.toggleActiveStatus = function(id) {
  const isNowActive = FinanceData.toggleActive(id);
  renderAll();
  showToast(isNowActive ? 'Gasto fixo ativado nos próximos meses!' : 'Gasto fixo pausado nos próximos meses!');
};

/**
 * Retorna a data de hoje no formato ISO YYYY-MM-DD.
 * Usado para pré-preencher campos de data nos formulários.
 *
 * @returns {string} Data atual no formato "YYYY-MM-DD".
 */
function getTodayString() {
  return getLocalDateString();
}

/**
 * Sanitiza strings para exibição segura no HTML, prevenindo XSS.
 * Escapa os caracteres especiais: &, <, >, " e ' (aspas simples).
 *
 * @param {string|null|undefined} str - Texto a sanitizar.
 * @returns {string} Texto com caracteres especiais escapados.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Converte uma data no formato YYYY-MM-DD para DD/MM.
 * Exibição compacta usada nos cards de itens.
 *
 * @param {string|null} dateStr - Data no formato YYYY-MM-DD.
 * @returns {string} Data no formato DD/MM, ou string vazia se inválida.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

function isSupportedAvatarType(type) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type);
}

function renderAvatarCropToJpeg(image, cropRect) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível processar a imagem.');
  context.drawImage(
    image,
    cropRect.x, cropRect.y, cropRect.width, cropRect.height,
    0, 0, canvas.width, canvas.height
  );
  for (let quality = 0.9; quality >= 0.45; quality -= 0.05) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= 400000) return dataUrl;
  }
  throw new Error('A foto excede o limite de armazenamento permitido.');
}

// ================================================================
// 14. MINI CALENDÁRIO POPOVER (definido dentro do DOMContentLoaded)
// 15. EVENT LISTENERS & INICIALIZAÇÃO DO APP
// ================================================================

window.GastoProKeyboardPanels = {
  bind({ panel, trigger, isOpen, close, trapFocus = false }) {
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || !isOpen()) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        if (trigger) trigger.focus();
        return;
      }

      if (!trapFocus || event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
  }
};

/**
 * Bootstrap principal do app.
 * Registra todos os event listeners e executa a renderização inicial.
 * Usa DOMContentLoaded para garantir que o HTML já está disponível.
 *
 * ORDEM DE INICIALIZAÇÃO:
 *  1. Navegação delegada e da sidebar (troca de telas e ações dinâmicas).
 *  2. Menu mobile (abrir/fechar sidebar).
 *  3. Navegação de meses (setas prev/next).
 *  4. Mini calendário popover (seleção de mês/ano).
 *  5. Formulário de novo ganho.
 *  6. Formulário de novo gasto (com toggle de dívida).
 *  7. Filtros de gastos (Todos / Fixos / Variáveis).
 *  8. Modal de edição.
 *  9. Exportação e reset de dados.
 *  10. Drawer do usuário (foto e nome).
 *  11. Render inicial do perfil e da interface.
 *  12. Registro do Service Worker (PWA).
 */
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('gastopro:themechange', () => {
    if (document.getElementById('categoryChart')) renderAll();
  });
  if (!document.getElementById('prevMonthBtn')) return;

  const categoryIcons = {
    'Moradia': '🏠', 'Contas': '💡', 'Saúde': '🏥', 'Esporte': '🥋',
    'Cartão de crédito': '💳', 'Alimentação': '🍽️', 'Mercado': '🛒',
    'Transporte': '🚗', 'Educação': '🎓', 'Empréstimo': '💳',
    'Parcelamento': '📦', 'Assinaturas': '📱', 'Compras': '🛍️',
    'Vestuário': '👕', 'Lazer': '🍿', 'Outros': '📦',
    'Salário': '💼', 'Adiantamento': '📅', 'Extra': '✨',
    'Investimentos': '📈', 'Receita': '💵'
  };
  const categoryCatalog = window.GastoProCategories;
  categoryCatalog.populateSelect(document.getElementById('expenseCategory'), categoryCatalog.EXPENSE, categoryIcons);
  categoryCatalog.populateSelect(document.getElementById('incomeCategory'), categoryCatalog.INCOME, categoryIcons);
  categoryCatalog.populateSelect(
    document.getElementById('goalCategorySelect'),
    categoryCatalog.EXPENSE,
    categoryIcons,
    'Selecione a categoria...'
  );
  categoryCatalog.populateSelect(
    document.getElementById('editCategory'),
    [...categoryCatalog.EXPENSE, ...categoryCatalog.INCOME],
    categoryIcons
  );

  const reportModal = document.getElementById('reportModal');
  const reportDialog = reportModal && reportModal.querySelector('[role="dialog"]');
  const reportForm = document.getElementById('reportForm');
  const reportType = document.getElementById('reportPeriodType');
  const reportFrom = document.getElementById('reportFrom');
  const reportTo = document.getElementById('reportTo');
  const reportToGroup = document.getElementById('reportToGroup');
  const reportFromLabel = document.getElementById('reportFromLabel');
  const reportError = document.getElementById('reportError');
  const generateReportBtn = document.getElementById('generateReportBtn');
  let reportGenerationInProgress = false;
  let reportScriptPromises = {};
  let reportPreviousFocus = null;

  function updateReportPeriodFields() {
    const type = reportType.value;
    reportToGroup.hidden = type !== 'range';
    reportTo.required = type === 'range';
    reportFromLabel.textContent = type === 'year' ? 'Ano' : 'Mês';
    reportFrom.type = type === 'year' ? 'number' : 'month';
    if (type === 'year') {
      reportFrom.min = '2000';
      reportFrom.max = '2100';
      reportFrom.step = '1';
      reportFrom.value = reportFrom.value.slice(0, 4) || String(new Date().getFullYear());
    } else {
      reportFrom.removeAttribute('min');
      reportFrom.removeAttribute('max');
      reportFrom.removeAttribute('step');
      if (!/^\d{4}-\d{2}$/.test(reportFrom.value)) {
        reportFrom.value = getLocalDateString().slice(0, 7);
      }
    }
  }

  function openReportModal() {
    if (!reportModal) return;
    reportPreviousFocus = document.activeElement;
    reportError.hidden = true;
    updateReportPeriodFields();
    reportModal.classList.add('active');
    reportModal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => reportDialog.focus());
  }

  function closeReportModal() {
    if (!reportModal) return;
    reportModal.classList.remove('active');
    reportModal.setAttribute('aria-hidden', 'true');
    if (reportPreviousFocus && typeof reportPreviousFocus.focus === 'function') {
      reportPreviousFocus.focus();
    }
  }

  function loadReportScript(src) {
    if (reportScriptPromises[src]) return reportScriptPromises[src];
    reportScriptPromises[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
      document.head.appendChild(script);
    });
    return reportScriptPromises[src];
  }

  function downloadReportFile(blob, fileName) {
    let url;
    let link;
    try {
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      if (!('download' in link)) {
        throw new Error('Este navegador não oferece download direto por link.');
      }
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch (error) {
      if (url) URL.revokeObjectURL(url);
      console.warn('[GastoPro] O download do relatório não pôde ser iniciado:', error);
      return false;
    } finally {
      if (link && link.isConnected) link.remove();
    }
  }

  async function deliverReport(result) {
    if (typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function' && typeof File === 'function') {
      try {
        const file = new File([result.blob], result.fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Relatório financeiro GastoPro',
            text: 'Relatório financeiro em PDF'
          });
          return 'shared';
        }
      } catch (error) {
        if (error.name === 'AbortError') return 'cancelled';
        console.warn('[GastoPro] O compartilhamento do relatório falhou:', error);
      }
    }

    if (downloadReportFile(result.blob, result.fileName)) return 'downloaded';
    const url = URL.createObjectURL(result.blob);
    try {
      const opened = window.open(url, '_blank');
      if (!opened) throw new Error('O navegador bloqueou a abertura do PDF.');
      opened.opener = null;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'opened';
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error('Não foi possível iniciar o download ou abrir o PDF. Tente novamente.');
    }
  }

  if (reportType) reportType.addEventListener('change', updateReportPeriodFields);
  document.getElementById('openReportModalBtn')?.addEventListener('click', openReportModal);
  document.getElementById('closeReportModalBtn')?.addEventListener('click', closeReportModal);
  document.getElementById('cancelReportBtn')?.addEventListener('click', closeReportModal);
  if (reportModal) {
    reportModal.addEventListener('click', event => {
      if (event.target === reportModal) closeReportModal();
    });
    reportModal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeReportModal();
      } else if (event.key === 'Tab') {
        const focusable = [...reportDialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
          .filter(element => !element.closest('[hidden]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }
  if (reportForm) {
    reportForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (reportGenerationInProgress) return;
      reportGenerationInProgress = true;
      generateReportBtn.disabled = true;
      generateReportBtn.textContent = 'Gerando...';
      reportError.hidden = true;
      try {
        await loadReportScript('js/vendor/jspdf.umd.min.js');
        await loadReportScript('js/vendor/jspdf.plugin.autotable.min.js');
        const type = reportType.value;
        const fromValue = reportFrom.value;
        const toValue = reportTo.value;
        let from;
        let to;
        if (type === 'year') {
          if (!/^\d{4}$/.test(fromValue)) throw new Error('Informe um ano válido.');
          from = `${fromValue}-01`;
          to = `${fromValue}-12`;
        } else if (type === 'range') {
          from = fromValue;
          to = toValue;
        } else {
          from = fromValue;
          to = fromValue;
        }
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(to) || from > to) {
          throw new Error('Confira o período informado.');
        }
        const data = buildReportData({
          type, from, to,
          includeDetails: document.getElementById('reportIncludeDetails').checked
        });
        const blob = await renderReportPDF(data, { download: false });
        const result = { blob, fileName: getReportFileName(data) };
        const delivery = await deliverReport(result);
        if (delivery === 'opened') {
          reportError.textContent = 'O relatório foi aberto em uma nova aba porque o download automático não pôde ser iniciado.';
          reportError.hidden = false;
        } else if (delivery !== 'cancelled') {
          closeReportModal();
        }
      } catch (error) {
        console.error('[GastoPro] Falha ao gerar ou entregar o relatório:', error);
        reportError.textContent = 'Não foi possível gerar ou baixar o relatório. Confira sua conexão e tente novamente.';
        reportError.hidden = false;
      } finally {
        reportGenerationInProgress = false;
        generateReportBtn.disabled = false;
        generateReportBtn.textContent = 'Gerar PDF';
      }
    });
  }
  window.addEventListener('online', () => {
    FinanceData.flushPendingSync().catch(error => {
      console.error('[GastoPro] Falha ao retomar sincronização:', error);
    });
    if (localStorage.getItem('gastopro_last_uid')) {
      initializeAuthenticatedView().catch(error => {
        console.error('[GastoPro] Falha ao revalidar a sessão após reconexão:', error);
      });
    }
  });

  // ── Navegação e ações delegadas ───────────────────────────────
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;

    const gotoElement = e.target.closest('[data-goto]');
    if (gotoElement) {
      switchToView(gotoElement.dataset.goto);
      return;
    }

    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;

    const { action, id } = actionElement.dataset;
    switch (action) {
      case 'open-irreversible-actions': {
        const details = document.getElementById('irreversibleActions');
        const summary = details?.querySelector('summary');
        if (details && summary) {
          details.open = true;
          summary.focus();
          summary.scrollIntoView({ block: 'center' });
        }
        break;
      }
      case 'admin-filter': {
        const filter = actionElement.dataset.filter;
        if (!['new', 'answered', 'all'].includes(filter)) break;
        adminViewState.filter = filter;
        adminViewState.editingId = null;
        adminViewState.draftReply = '';
        adminViewState.notice = '';
        loadAdminMessages({ reset: true });
        break;
      }
      case 'admin-reply': {
        if (adminViewState.access !== 'allowed') break;
        const message = adminViewState.messages.find(item => item.id === id);
        if (!message) break;
        adminViewState.editingId = id;
        adminViewState.draftReply = message.reply || '';
        adminViewState.notice = '';
        renderAdminView();
        document.getElementById('adminReplyText')?.focus();
        break;
      }
      case 'admin-send-reply':
        saveAdminReply(id);
        break;
      case 'admin-cancel-reply':
        adminViewState.editingId = null;
        adminViewState.draftReply = '';
        adminViewState.notice = '';
        renderAdminView();
        break;
      case 'admin-load-more':
        loadAdminMessages();
        break;
      case 'send-feedback': {
        e.preventDefault();
        const form = actionElement.closest('#feedbackForm');
        if (form) submitFeedbackForm(form);
        break;
      }
      case 'delete-feedback':
        deleteFeedbackMessage(id);
        break;
      case 'open-contact':
        if (actionElement.dataset.retry === 'true') {
          loadMyFeedback();
        } else {
          closeProfileDrawer();
          switchToView('contact');
          if (actionElement.dataset.login === 'true') openAuth('login');
        }
        break;
      case 'edit':
        openEditModal(id);
        break;
      case 'delete':
        deleteEntry(id);
        break;
      case 'toggle-active':
        toggleActiveStatus(id);
        break;
      case 'select-month':
        selectMonthFromPicker(Number(actionElement.dataset.year), Number(actionElement.dataset.month));
        break;
      case 'edit-goal':
        openGoalModal(id);
        break;
      case 'new-account':
        openAccountModal();
        break;
      case 'edit-account':
        openAccountModal(id);
        break;
      case 'adjust-account':
        openAdjustAccountModal(id);
        break;
      case 'delete-account':
        deleteAccount(id);
        break;
      case 'filter-account-balance':
        state.accountBalanceFilter = actionElement.dataset.filter;
        renderAccountBalancesPanel();
        break;
    }
  });

  document.addEventListener('input', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.id === 'adminReplyText') {
      adminViewState.draftReply = e.target.value;
      const count = document.getElementById('adminReplyCount');
      if (count) count.textContent = `${window.GastoProFeedbackHelpers.getCharacterCount(e.target.value)}/2000`;
      return;
    }
    if (e.target.id !== 'feedbackMessage') return;
    feedbackViewState.draftMessage = e.target.value;
    const counter = document.getElementById('feedbackCharacterCount');
    if (counter) counter.textContent = `${window.GastoProFeedbackHelpers.getCharacterCount(e.target.value)}/1000`;
  });

  document.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement && e.target.id === 'feedbackCategory') {
      feedbackViewState.draftCategory = e.target.value;
    }
  });

  document.addEventListener('submit', (e) => {
    if (!(e.target instanceof HTMLFormElement) || e.target.id !== 'feedbackForm') return;
    e.preventDefault();
    submitFeedbackForm(e.target);
  });

  async function submitFeedbackForm(form) {
    if (feedbackViewState.sending) return;
    feedbackViewState.draftCategory = form.elements.category.value;
    feedbackViewState.draftMessage = form.elements.message.value;
    const validationError = window.GastoProFeedbackHelpers.validateMessage(
      feedbackViewState.draftCategory,
      feedbackViewState.draftMessage
    );
    if (validationError) {
      feedbackViewState.notice = validationError;
      feedbackViewState.noticeType = 'error';
      renderContactView();
      return;
    }

    feedbackViewState.sending = true;
    feedbackViewState.notice = '';
    renderContactView();
    const result = await window.SupabaseAuth.sendFeedback({
      category: feedbackViewState.draftCategory,
      message: feedbackViewState.draftMessage
    });
    feedbackViewState.sending = false;
    if (!result.success) {
      feedbackViewState.notice = result.error;
      feedbackViewState.noticeType = 'error';
      renderContactView();
      return;
    }

    feedbackViewState.draftCategory = 'duvida';
    feedbackViewState.draftMessage = '';
    feedbackViewState.notice = 'Mensagem enviada. Vou responder quando possível.';
    feedbackViewState.noticeType = 'status';
    await loadMyFeedback(true);
  }

  async function saveAdminReply(messageId) {
    if (adminViewState.access !== 'allowed' || adminViewState.saving) return;
    const validationError = window.GastoProFeedbackHelpers.validateReply(adminViewState.draftReply);
    if (validationError) {
      adminViewState.notice = validationError;
      adminViewState.noticeType = 'error';
      renderAdminView();
      return;
    }
    const reply = adminViewState.draftReply.trim();
    adminViewState.saving = true;
    adminViewState.notice = '';
    renderAdminView();
    const result = await window.SupabaseAuth.replyFeedback(messageId, reply);
    adminViewState.saving = false;
    if (!result.success) {
      adminViewState.notice = result.error;
      adminViewState.noticeType = 'error';
      renderAdminView();
      return;
    }

    adminViewState.editingId = null;
    adminViewState.draftReply = '';
    adminViewState.notice = 'Resposta enviada.';
    adminViewState.noticeType = 'status';
    await refreshAdminBadge();
    if (adminViewState.filter === 'new') {
      await loadAdminMessages({ reset: true });
    } else {
      const message = adminViewState.messages.find(item => item.id === messageId);
      if (message) {
        message.reply = reply;
        message.status = 'answered';
        message.replied_at = new Date().toISOString();
      }
      renderAdminView();
    }
  }

  function deleteFeedbackMessage(messageId) {
    const message = feedbackViewState.messages.find(item => item.id === messageId);
    if (!message) return;
    showConfirm({
      title: 'Excluir mensagem?',
      message: 'A mensagem será apagada e não poderá ser recuperada.',
      iconClass: 'fa-solid fa-trash-can',
      okLabel: 'Excluir mensagem',
      onConfirm: async () => {
        const result = await window.SupabaseAuth.deleteMyFeedback(messageId);
        if (!result.success) {
          feedbackViewState.notice = result.error;
          feedbackViewState.noticeType = 'error';
          renderContactView();
          return;
        }
        feedbackViewState.notice = 'Mensagem excluída.';
        feedbackViewState.noticeType = 'status';
        await loadMyFeedback(true);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!(e.target instanceof Element) || !['Enter', ' '].includes(e.key)) return;
    const gotoElement = e.target.closest('[data-goto][role="button"]');
    if (!gotoElement) return;
    e.preventDefault();
    switchToView(gotoElement.dataset.goto);
  });

  document.addEventListener('change', (e) => {
    if (!(e.target instanceof Element)) return;
    const paidInput = e.target.closest('[data-action="toggle-paid"]');
    if (paidInput) togglePaidEntry(paidInput.dataset.id);
  });

  // ── 1. Navegação da Sidebar ────────────────────────────────────
  // Apenas botões COM data-view disparam switchToView() (evita chamar com null)
  document.querySelectorAll('.sidebar-nav .nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchToView(view);
    });
  });

  // ── 2. Menu Mobile (hamburguer + overlay) ─────────────────────
  const sidebarEl        = document.getElementById('sidebar');
  const sidebarOverlayEl = document.getElementById('sidebarOverlay');
  const menuToggleBtn    = document.getElementById('menuToggleBtn');
  const closeSidebarBtn  = document.getElementById('closeSidebarBtn');

  /** Abre o menu lateral em dispositivos móveis. */
  function openMobileSidebar() {
    if (sidebarEl)        sidebarEl.classList.add('open');
    if (sidebarOverlayEl) sidebarOverlayEl.classList.add('active');
    if (menuToggleBtn) {
      menuToggleBtn.setAttribute('aria-expanded', 'true');
      menuToggleBtn.setAttribute('aria-label', 'Fechar menu de navegação');
    }
  }

  /** Fecha o menu lateral em dispositivos móveis. */
  function closeMobileSidebar() {
    if (sidebarEl)        sidebarEl.classList.remove('open');
    if (sidebarOverlayEl) sidebarOverlayEl.classList.remove('active');
    if (menuToggleBtn) {
      menuToggleBtn.setAttribute('aria-expanded', 'false');
      menuToggleBtn.setAttribute('aria-label', 'Abrir menu de navegação');
    }
  }

  if (menuToggleBtn)    menuToggleBtn.addEventListener('click', openMobileSidebar);
  if (closeSidebarBtn)  closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarOverlayEl) sidebarOverlayEl.addEventListener('click', closeMobileSidebar);
  if (sidebarEl) {
    window.GastoProKeyboardPanels.bind({
      panel: sidebarEl,
      trigger: menuToggleBtn,
      isOpen: () => sidebarEl.classList.contains('open'),
      close: closeMobileSidebar
    });
  }

  // ── 3. Navegação de Meses (setas prev/next) ───────────────────
  // Ao chegar no limite (jan/dez) vira para o ano anterior/seguinte
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 1) {
      state.currentMonth = 12;
      state.currentYear--;  // Retrocede o ano ao passar de Janeiro
    }
    renderAll();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 12) {
      state.currentMonth = 1;
      state.currentYear++;  // Avança o ano ao passar de Dezembro
    }
    renderAll();
  });

  // ── 4. Mini Calendário Popover (Month Picker) ─────────────────
  // Permite navegar diretamente para qualquer mês/ano clicando no label
  const monthPickerTrigger = document.getElementById('monthPickerTrigger');
  const monthPickerPopover = document.getElementById('monthPickerPopover');
  const pickerPrevYearBtn  = document.getElementById('pickerPrevYearBtn');
  const pickerNextYearBtn  = document.getElementById('pickerNextYearBtn');
  const pickerYearDisplay  = document.getElementById('pickerYearDisplay');
  const pickerMonthsGrid   = document.getElementById('pickerMonthsGrid');

  /** Ano atualmente exibido dentro do popover (independente do mês ativo). */
  let pickerYear = state.currentYear;

  /** Abreviações dos meses para exibição na grade do calendário. */
  const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  /**
   * Constrói a grade de meses no popover para o ano exibido.
   * Marca o mês ativo com a classe 'selected' e meses com dados com 'has-data'.
   */
  function renderMonthPicker() {
    pickerYearDisplay.textContent = pickerYear;
    const all       = FinanceData.getAll();
    const templates = FinanceData.getTemplates();

    pickerMonthsGrid.innerHTML = SHORT_MONTHS.map((name, index) => {
      const monthNum   = index + 1;
      const ym         = `${pickerYear}-${String(monthNum).padStart(2, '0')}`;
      const isSelected = pickerYear === state.currentYear && monthNum === state.currentMonth;

      // Verifica lançamentos pontuais com month === ym
      const hasEntry = all.some(e => !e.isTemplate && e.month === ym);

      // Verifica se algum template fixo está vigente neste mês
      const hasTemplate = templates.some(t => {
        const started  = !t.startMonth || t.startMonth <= ym;
        const notEnded = !t.endMonth   || ym <= t.endMonth;
        return t.active !== false && started && notEnded;
      });

      const hasData = hasEntry || hasTemplate;

      return `
        <button class="picker-month-btn ${isSelected ? 'selected' : ''} ${hasData ? 'has-data' : ''}" 
                data-action="select-month" data-year="${pickerYear}" data-month="${monthNum}">
          ${name}
        </button>
      `;
    }).join('');
  }

  /**
   * Navega para o mês/ano selecionado no calendário popover.
   *
   * @param {number} year  - Ano selecionado.
   * @param {number} month - Mês selecionado (1–12).
   */
  window.selectMonthFromPicker = function(year, month) {
    state.currentYear  = year;
    state.currentMonth = month;
    closeMonthPicker();
    renderAll();
  };

  /** Alterna a visibilidade do popover de calendário. */
  function toggleMonthPicker() {
    if (!monthPickerPopover) return;
    const isOpen = monthPickerPopover.classList.contains('open');
    if (isOpen) {
      closeMonthPicker();
    } else {
      pickerYear = state.currentYear; // Inicia no ano do mês ativo
      renderMonthPicker();
      monthPickerPopover.classList.add('open');
      if (monthPickerTrigger) monthPickerTrigger.setAttribute('aria-expanded', 'true');
      if (monthPickerTrigger) monthPickerTrigger.classList.add('active');
    }
  }

  /** Fecha o popover de calendário. */
  function closeMonthPicker() {
    if (monthPickerPopover) monthPickerPopover.classList.remove('open');
    if (monthPickerTrigger) monthPickerTrigger.setAttribute('aria-expanded', 'false');
    if (monthPickerTrigger) monthPickerTrigger.classList.remove('active');
  }

  if (monthPickerPopover) {
    window.GastoProKeyboardPanels.bind({
      panel: monthPickerPopover,
      trigger: monthPickerTrigger,
      isOpen: () => monthPickerPopover.classList.contains('open'),
      close: closeMonthPicker
    });
  }

  if (monthPickerTrigger) {
    monthPickerTrigger.addEventListener('click', (e) => {
      // stopPropagation impede que o clique borbulhe até o document.click
      // que fecharia o popover imediatamente após abri-lo
      e.stopPropagation();
      toggleMonthPicker();
    });
  }

  if (pickerPrevYearBtn) {
    pickerPrevYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear--;
      renderMonthPicker();
    });
  }

  if (pickerNextYearBtn) {
    pickerNextYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear++;
      renderMonthPicker();
    });
  }

  // Fechar popover ao clicar fora
  document.addEventListener('click', (e) => {
    const selectorBar = document.getElementById('monthSelectorBar');
    if (selectorBar && !selectorBar.contains(e.target)) {
      closeMonthPicker();
    }
  });

  // ── 5. Formulário de Novo Ganho ────────────────────────────────
  // Pré-preenche o campo de data com hoje ao abrir o formulário
  const incomeDateInput = document.getElementById('incomeDate');
  if (incomeDateInput) incomeDateInput.value = getTodayString();

  document.getElementById('incomeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc     = document.getElementById('incomeDesc').value.trim();
    const amount   = parseFloat(document.getElementById('incomeAmount').value);
    const category = document.getElementById('incomeCategory').value;
    const dateVal  = document.getElementById('incomeDate').value || getTodayString();

    // Validações básicas antes de persistir
    if (!desc) {
      alert('Por favor, informe a descrição do ganho.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido para o ganho.');
      return;
    }

    // O mês de competência é extraído da data informada pelo usuário
    // (permite lançar ganhos de outros meses sem mudar o mês ativo)
    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    await withSaving(saveButton, async () => {
      try {
        FinanceData.add({
          month: itemMonth,
          type: 'income',
          desc: desc,
          amount: amount,
          category: category,
          accountId: document.getElementById('incomeAccount').value || null,
          date: dateVal
        });

        document.getElementById('incomeDesc').value = '';
        document.getElementById('incomeAmount').value = '';
        document.getElementById('incomeDate').value = getTodayString();
        document.getElementById('incomeAccount').value = '';
        document.getElementById('incomeDesc').focus();

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        if (syncResult.success) showToast(`Ganho de ${formatCurrency(amount)} adicionado!`);
      } catch (err) {
        console.error('Erro ao adicionar ganho:', err);
        alert('Ocorreu um erro ao salvar o ganho: ' + err.message);
      }
    });
  });

  // ── 6. Formulário de Novo Gasto ────────────────────────────────
  // Pré-preenche o campo de data com hoje
  const expenseDateInput = document.getElementById('expenseDate');
  if (expenseDateInput) expenseDateInput.value = getTodayString();

  // Exibe/oculta o campo "Mês Final" quando o tipo é dívida/parcelamento
  const expenseTypeSelect     = document.getElementById('expenseType');
  const expenseCatSelect      = document.getElementById('expenseCategory');
  const expenseEndMonthWrapper = document.getElementById('expenseEndMonthWrapper');

  function checkDebtVisibility() {
    if (!expenseEndMonthWrapper) return;
    const isDebt = (expenseTypeSelect && expenseTypeSelect.value === 'debt') || 
                   (expenseCatSelect && (expenseCatSelect.value === 'Empréstimo' || expenseCatSelect.value === 'Parcelamento'));
    expenseEndMonthWrapper.style.display = isDebt ? 'block' : 'none';
  }

  if (expenseTypeSelect) expenseTypeSelect.addEventListener('change', checkDebtVisibility);
  if (expenseCatSelect) expenseCatSelect.addEventListener('change', checkDebtVisibility);

  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const type = document.getElementById('expenseType').value;
    const category = document.getElementById('expenseCategory').value;
    const dateVal = document.getElementById('expenseDate').value || getTodayString();
    const endMonthVal = document.getElementById('expenseEndMonth') ? document.getElementById('expenseEndMonth').value : null;

    if (!desc) {
      alert('Por favor, informe a descrição do gasto.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido maior que zero.');
      return;
    }

    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    await withSaving(saveButton, async () => {
      try {
        FinanceData.add({
          month: itemMonth,
          type: type,
          desc: desc,
          amount: amount,
          category: category,
          paid: false,
          date: dateVal,
          accountId: document.getElementById('expenseAccount').value || null,
          endMonth: endMonthVal || null
        });

        document.getElementById('expenseDesc').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expenseDate').value = getTodayString();
        document.getElementById('expenseAccount').value = '';
        if (document.getElementById('expenseEndMonth')) document.getElementById('expenseEndMonth').value = '';
        checkDebtVisibility();
        document.getElementById('expenseDesc').focus();

        state.expenseFilter = 'all';
        document.querySelectorAll('.filter-tabs-row .filter-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
        });

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        if (!syncResult.success) return;

        let toastMsg = `Gasto de ${formatCurrency(amount)} cadastrado!`;
        if (type === 'debt' || category === 'Empréstimo' || category === 'Parcelamento') {
          toastMsg = `Parcelamento adicionado! Veja no Centro de Dívidas.`;
        } else if (type === 'fixed') {
          toastMsg = `Gasto fixo de ${formatCurrency(amount)} cadastrado!`;
        }
        showToast(toastMsg);
      } catch (err) {
        console.error('Erro ao adicionar gasto:', err);
        alert('Ocorreu um erro ao salvar o gasto: ' + err.message);
      }
    });
  });

  // ── 7. Filtros de Gastos ──────────────────────────────────────
  // Atualiza state.expenseFilter e re-renderiza ao clicar em cada aba de filtro
  document.querySelectorAll('.filter-tabs-row .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tabs-row .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.expenseFilter = btn.getAttribute('data-filter');
      renderAll();
    });
  });

  // ── 8. Modal de Edição ────────────────────────────────────────
  // Salva as alterações do formulário ao submeter o modal
  document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const desc = document.getElementById('editDesc').value.trim();
    const amountRaw = document.getElementById('editAmount').value;
    const amount = parseFloat(String(amountRaw).replace(',', '.'));
    const category = document.getElementById('editCategory').value.trim();
    const type = document.getElementById('editType').value;
    const date = document.getElementById('editDate').value;
    const active = document.getElementById('editActive') ? document.getElementById('editActive').value === 'true' : true;
    const endMonth = document.getElementById('editEndMonth') ? document.getElementById('editEndMonth').value || null : null;

    if (!id || !desc || isNaN(amount) || amount <= 0) {
      alert('Por favor, informe a descrição e um valor maior que zero.');
      return;
    }

    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    await withSaving(saveButton, async () => {
      try {
        const updated = FinanceData.update(id, {
          desc: desc,
          amount: amount,
          category: category,
          type: type,
          date: date,
          active: active,
          endMonth: endMonth,
          accountId: document.getElementById('editAccount').value || null
        });
        if (!updated) {
          showToast('Não é possível alterar entre lançamento pontual e recorrente pela edição.');
          return;
        }

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        if (!syncResult.success) return;
        closeEditModal();
        showToast('Informações alteradas com sucesso!');
      } catch (error) {
        console.error('[GastoPro] Erro ao salvar alterações:', error);
        showToast(error.message || 'Não foi possível salvar as alterações. Tente novamente.');
      }
    });
  });

  document.getElementById('accountForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('accountFormError');
    const id = document.getElementById('accountId').value;
    const name = document.getElementById('accountName').value.trim();
    const institution = document.getElementById('accountInstitution').value.trim();
    const type = document.getElementById('accountType').value;
    const balanceRaw = document.getElementById('accountInitialBalance').value;
    const balance = Number(balanceRaw);
    let validationError = '';

    if (!name || name.length > 100) validationError = 'O nome deve ter de 1 a 100 caracteres.';
    else if (institution.length > 100) validationError = 'A instituição deve ter até 100 caracteres.';
    else if (!['PF', 'PJ'].includes(type)) validationError = 'O tipo deve ser PF ou PJ.';
    else if (balanceRaw === '' || !Number.isFinite(balance) || Math.abs(balance) > 9999999999.99) {
      validationError = 'O saldo inicial deve ser um valor numérico válido.';
    }

    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    const saveButton = document.getElementById('saveAccountBtn');
    saveButton.disabled = true;
    errorEl.hidden = true;
    try {
      const fields = { name, institution: institution || null, type, initialBalance: balance };
      const previousAccountIds = new Set(FinanceData.getAccounts().map(account => account.id));
      const result = id
        ? await FinanceData.updateAccount(id, fields)
        : await FinanceData.addAccount(fields);
      if (!result.success) {
        if (!id) {
          const newlySaved = FinanceData.getAccounts().find(account =>
            !previousAccountIds.has(account.id)
          );
          if (newlySaved) {
            document.getElementById('accountId').value = newlySaved.id;
            document.getElementById('accountModalTitle').textContent = 'Editar conta';
          }
        }
        renderAll();
        errorEl.textContent = result.error && result.error.message || result.error || 'Não foi possível salvar a conta.';
        errorEl.hidden = false;
        return;
      }
      closeAccountModal();
      renderAll();
      showToast(id ? 'Conta atualizada com sucesso.' : 'Conta cadastrada com sucesso.');
    } catch (error) {
      console.error('[GastoPro] Falha ao salvar conta:', error);
      errorEl.textContent = `Não foi possível salvar a conta: ${error.message || error}`;
      errorEl.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  document.getElementById('adjustAccountForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('adjustAccountError');
    const rawBalance = document.getElementById('adjustAccountBalance').value;
    const balance = Number(rawBalance);
    if (rawBalance === '' || !Number.isFinite(balance) || Math.abs(balance) > 9999999999.99) {
      errorEl.textContent = 'Informe um saldo atual válido.';
      errorEl.hidden = false;
      return;
    }

    const saveButton = document.getElementById('saveAdjustAccountBtn');
    saveButton.disabled = true;
    errorEl.hidden = true;
    try {
      const result = await FinanceData.adjustAccountBalance(
        document.getElementById('adjustAccountId').value,
        balance
      );
      if (!result.success) {
        renderAll();
        errorEl.textContent = result.error && result.error.message || result.error || 'Não foi possível ajustar o saldo.';
        errorEl.hidden = false;
        return;
      }
      closeAdjustAccountModal();
      renderAll();
      showToast('Saldo atualizado com sucesso.');
    } catch (error) {
      console.error('[GastoPro] Falha ao ajustar saldo da conta:', error);
      errorEl.textContent = `Não foi possível ajustar o saldo: ${error.message || error}`;
      errorEl.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  const editModalEl = document.getElementById('editModal');
  if (editModalEl) {
    editModalEl.addEventListener('click', (e) => {
      if (e.target === editModalEl) closeEditModal();
    });
  }

  const editTypeSelect = document.getElementById('editType');
  if (editTypeSelect) {
    editTypeSelect.addEventListener('change', () => {
      const val = editTypeSelect.value;
      const isFixed = val === 'fixed' || val === 'debt';
      const statusGroup = document.getElementById('editStatusGroup');
      const endMonthGroup = document.getElementById('editEndMonthGroup');
      if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
      if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';
    });
  }

  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

  document.getElementById('closeAccountModalBtn').addEventListener('click', closeAccountModal);
  document.getElementById('cancelAccountModalBtn').addEventListener('click', closeAccountModal);
  document.getElementById('closeAdjustAccountModalBtn').addEventListener('click', closeAdjustAccountModal);
  document.getElementById('cancelAdjustAccountBtn').addEventListener('click', closeAdjustAccountModal);
  document.getElementById('accountModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAccountModal();
  });
  document.getElementById('adjustAccountModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAdjustAccountModal();
  });

  // ── 9. Exportação e Reset de Dados ───────────────────────────
  document.getElementById('exportBtn').addEventListener('click', () => {
    FinanceData.exportJSON();
    showToast('Backup JSON exportado com sucesso!');
  });

  const restoreBackupBtn = document.getElementById('restoreBackupBtn');
  const restoreBackupFile = document.getElementById('restoreBackupFile');
  if (restoreBackupBtn && restoreBackupFile) {
    restoreBackupBtn.addEventListener('click', () => restoreBackupFile.click());
    restoreBackupFile.addEventListener('change', async () => {
      const file = restoreBackupFile.files && restoreBackupFile.files[0];
      restoreBackupFile.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('O backup excede o limite de 5 MB.');
        return;
      }

      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
          reader.readAsText(file);
        });
        const preview = GastoProBackupHelpers.validate(text);
        if (preview.error) {
          showToast(preview.error);
          return;
        }

        const summary = `Backup com ${preview.entries.length} lançamentos, ${preview.templates.length} gastos fixos e ${preview.goals.length} metas. Escolha como restaurar.`;
        const restore = (mode, button) => withSaving(button, async () => {
          try {
            const result = await FinanceData.importJSON(text, mode);
            if (!result.success) {
              showToast(result.error || 'Não foi possível restaurar o backup.');
              return;
            }
            renderAll();
            renderUserProfile();
            showToast(mode === 'merge' ? 'Backup mesclado com sucesso.' : 'Backup restaurado; os dados anteriores foram substituídos.');
            document.getElementById('confirmModal').classList.remove('active');
          } catch (error) {
            console.error('[GastoPro] Falha ao restaurar backup:', error);
            showToast(error.message || 'Não foi possível restaurar o backup.');
          }
        });
        showConfirm({
          title: 'Prévia do backup',
          message: summary,
          iconClass: 'fa-solid fa-file-import',
          okLabel: 'Mesclar',
          okBtnClass: 'btn-primary',
          secondaryLabel: 'Substituir tudo',
          keepOpenOnConfirm: true,
          onConfirm: button => restore('merge', button),
          onSecondary: button => restore('replace', button)
        });
      } catch (error) {
        console.error('[GastoPro] Falha ao ler backup:', error);
        showToast('Não foi possível ler o arquivo de backup.');
      }
    });
  }

  // Exige confirmação antes de apagar todos os dados (ação irreversível)
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    const profile = FinanceData.getProfile();
    const hasCloudAccount = Boolean(profile.userId && profile.email);
    showConfirm({
      title:    'Zerar todos os dados?',
      message:  hasCloudAccount
        ? 'Todos os lançamentos e metas serão apagados deste aparelho e da nuvem. Isso também apaga seus dados sincronizados na nuvem. Baixe um backup antes, se desejar.'
        : 'Todos os lançamentos e metas serão apagados somente deste aparelho. Baixe um backup antes, se desejar.',
      iconClass:'fa-solid fa-trash-can',
      okLabel:  'Sim, zerar tudo',
      onBackup: () => {
        FinanceData.exportJSON();
        showToast('Backup JSON exportado.');
      },
      onConfirm: async () => {
        const result = await FinanceData.clearAll();
        closeProfileDrawer();
        renderUserProfile();
        renderAll();
        if (!result.success) {
          showToast('Reset local concluído; a exclusão na nuvem ficou pendente.');
          return;
        }
        showToast('Todos os dados foram resetados com sucesso!');
      }
    });
  });

  // ── 10. Drawer do Usuário (painel lateral direito) ────────────
  const profileDrawer        = document.getElementById('profileDrawer');
  const profileDrawerOverlay = document.getElementById('profileDrawerOverlay');
  const userMenuBtn          = document.getElementById('userMenuBtn');
  const closeDrawerBtn       = document.getElementById('closeDrawerBtn');

  /** Desliza o painel de perfil para a direita, tornando-o visível. */
  function openProfileDrawer() {
    if (profileDrawer && profileDrawerOverlay) {
      profileDrawer.classList.add('open');
      profileDrawerOverlay.classList.add('active');
      profileDrawer.removeAttribute('inert');
      profileDrawer.setAttribute('aria-hidden', 'false');
      if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'true');
      if (closeDrawerBtn) closeDrawerBtn.focus();
    }
  }

  /** Fecha o painel de perfil deslizando-o para fora da tela. */
  function closeProfileDrawer() {
    if (profileDrawer && profileDrawerOverlay) {
      const returnFocus = profileDrawer.contains(document.activeElement);
      profileDrawer.classList.remove('open');
      profileDrawerOverlay.classList.remove('active');
      profileDrawer.setAttribute('aria-hidden', 'true');
      profileDrawer.setAttribute('inert', '');
      if (userMenuBtn) userMenuBtn.setAttribute('aria-expanded', 'false');
      if (returnFocus && userMenuBtn) userMenuBtn.focus();
    }
  }

  if (userMenuBtn)          userMenuBtn.addEventListener('click', openProfileDrawer);
  if (closeDrawerBtn)       closeDrawerBtn.addEventListener('click', closeProfileDrawer);
  if (profileDrawerOverlay) profileDrawerOverlay.addEventListener('click', closeProfileDrawer);
  if (profileDrawer) {
    window.GastoProKeyboardPanels.bind({
      panel: profileDrawer,
      trigger: userMenuBtn,
      isOpen: () => profileDrawer.classList.contains('open'),
      close: closeProfileDrawer,
      trapFocus: true
    });
  }

  // ── 11. Personalização de Perfil (Foto e Nome) ───────────────
  const profileNameInput      = document.getElementById('profileNameInput');
  const saveProfileNameBtn    = document.getElementById('saveProfileNameBtn');
  const changeAvatarBtn       = document.getElementById('changeAvatarBtn');
  const avatarFileInput       = document.getElementById('avatarFileInput');
  const avatarCropModal       = document.getElementById('avatarCropModal');
  const avatarCropFrame       = document.getElementById('avatarCropFrame');
  const avatarCropImage       = document.getElementById('avatarCropImage');
  const avatarZoomSlider      = document.getElementById('avatarZoomSlider');
  const avatarCropError       = document.getElementById('avatarCropError');
  const saveAvatarCropBtn     = document.getElementById('saveAvatarCropBtn');
  const cancelAvatarCropBtn   = document.getElementById('cancelAvatarCropBtn');
  const closeAvatarCropBtn    = document.getElementById('closeAvatarCropBtn');
  let avatarCropState = null;
  // Nota: drawerAvatarDisplay e topbarAvatarContainer são buscados por ID
  // dentro de renderUserProfile() para garantir que existem no DOM
  const drawerAvatarDisplay   = document.getElementById('drawerAvatarDisplay');
  const topbarAvatarContainer = document.getElementById('topbarAvatarContainer');

  function syncEditedProfile(profile) {
    if (!profile.userId) return;
    FinanceData.flushPendingSync(profile.userId).then(result => {
      if (!result.success) {
        showToast('Perfil salvo neste aparelho; a sincronização permanece pendente.');
      }
    }).catch(error => {
      console.error('[GastoPro] Erro ao sincronizar perfil editado:', error);
      showToast('Perfil salvo neste aparelho; a sincronização permanece pendente.');
    });
  }

  function renderUserProfile() {
    const profile = FinanceData.getProfile();
    const defaultAvatar = 'assets/default_avatar.jpg';
    const avatarSrc = profile.avatar || defaultAvatar;

    if (profileNameInput) {
      profileNameInput.value = profile.name || '';
    }

    const drawerAvatarImg = document.getElementById('drawerAvatarImg');
    const topbarAvatarImg = document.getElementById('topbarAvatarImg');

    if (drawerAvatarImg) drawerAvatarImg.src = avatarSrc;
    if (topbarAvatarImg) topbarAvatarImg.src = avatarSrc;

    if (userMenuBtn) {
      userMenuBtn.title = profile.name ? `Menu do Usuário (${profile.name})` : 'Menu do Usuário (Escreva seu nome)';
    }

    // Atualiza status de Conta & Autenticação no Drawer
    const accountGuestCard   = document.getElementById('accountGuestCard');
    const accountLoggedCard  = document.getElementById('accountLoggedCard');
    const deleteAccountAction = document.getElementById('deleteAccountAction');
    const loggedUserEmail    = document.getElementById('loggedUserEmail');
    const accountStatusText  = document.getElementById('accountStatusText');

    if (profile.email) {
      if (accountGuestCard)  accountGuestCard.style.display = 'none';
      if (accountLoggedCard) accountLoggedCard.style.display = 'flex';
      if (deleteAccountAction) deleteAccountAction.hidden = false;
      if (loggedUserEmail)   loggedUserEmail.textContent = profile.email;
      if (accountStatusText) accountStatusText.textContent = 'Conta Conectada (Nuvem)';
    } else {
      if (accountGuestCard)  accountGuestCard.style.display = 'flex';
      if (accountLoggedCard) accountLoggedCard.style.display = 'none';
      if (deleteAccountAction) deleteAccountAction.hidden = true;
      if (accountStatusText) {
        accountStatusText.textContent = 'Modo Local (Não conectado)';
      }
    }
  }

  // ── 11.2 Modal de Autenticação (Login / Cadastro) ─────────────
  const authModal            = document.getElementById('authModal');
  const openAuthModalBtn     = document.getElementById('openAuthModalBtn');
  const closeAuthModalBtn    = document.getElementById('closeAuthModalBtn');
  const continueAsGuestBtn   = document.getElementById('continueAsGuestBtn');
  const tabLoginBtn          = document.getElementById('tabLoginBtn');
  const tabRegisterBtn       = document.getElementById('tabRegisterBtn');
  const authLoginForm        = document.getElementById('authLoginForm');
  const authRegisterForm     = document.getElementById('authRegisterForm');
  const authSubtitleText     = document.getElementById('authSubtitleText');
  const authAlertBanner      = document.getElementById('authAlertBanner');
  const authAlertText        = document.getElementById('authAlertText');
  const discardPendingModal = document.getElementById('discardPendingModal');
  const cancelDiscardPendingBtn = document.getElementById('cancelDiscardPendingBtn');
  const exportBeforeDiscardBtn = document.getElementById('exportBeforeDiscardBtn');
  const confirmDiscardPendingBtn = document.getElementById('confirmDiscardPendingBtn');
  const logoutBtn            = document.getElementById('logoutBtn');
  const deleteAccountBtn     = document.getElementById('deleteAccountBtn');
  const deleteAccountModal   = document.getElementById('deleteAccountModal');
  const closeDeleteAccountModalBtn = document.getElementById('closeDeleteAccountModalBtn');
  const cancelDeleteAccountBtn = document.getElementById('cancelDeleteAccountBtn');
  const deleteAccountConfirmation = document.getElementById('deleteAccountConfirmation');
  const deleteAccountError   = document.getElementById('deleteAccountError');
  const confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');
  const downloadBackupBeforeAccountDeletion = document.getElementById('downloadBackupBeforeAccountDeletion');
  const passwordRecoveryModal = document.getElementById('passwordRecoveryModal');
  const passwordRecoveryDialog = passwordRecoveryModal && passwordRecoveryModal.querySelector('[role="dialog"]');
  const passwordRecoveryForm = document.getElementById('passwordRecoveryForm');
  const passwordRecoveryError = document.getElementById('passwordRecoveryError');
  const emailHelpModal = document.getElementById('emailHelpModal');
  const registerEmailInput = document.getElementById('registerEmail');
  const registerEmailConfirmationInput = document.getElementById('registerEmailConfirmation');
  const registerEmailMismatch = document.getElementById('registerEmailMismatch');
  let recoveryPreviousFocus = null;
  let pendingAccountSwitchUser = null;
  let recoveryCooldownInterval = null;
  if (passwordRecoveryError) passwordRecoveryError.style.display = 'none';

  function openEmailHelpModal() {
    if (!emailHelpModal) return;
    emailHelpModal.classList.add('active');
    emailHelpModal.setAttribute('aria-hidden', 'false');
  }

  function closeEmailHelpModal() {
    if (!emailHelpModal) return;
    emailHelpModal.classList.remove('active');
    emailHelpModal.setAttribute('aria-hidden', 'true');
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const actionElement = event.target.closest('[data-action="open-email-help"], [data-action="close-email-help"]');
    if (!actionElement) return;
    event.preventDefault();
    if (actionElement.dataset.action === 'open-email-help') openEmailHelpModal();
    else closeEmailHelpModal();
  });

  if (emailHelpModal) {
    emailHelpModal.addEventListener('click', event => {
      if (event.target === emailHelpModal) closeEmailHelpModal();
    });
  }

  function clearRegisterEmailMismatch() {
    if (registerEmailMismatch) {
      registerEmailMismatch.textContent = '';
      registerEmailMismatch.hidden = true;
    }
    if (registerEmailConfirmationInput) {
      registerEmailConfirmationInput.removeAttribute('aria-invalid');
    }
  }

  [registerEmailInput, registerEmailConfirmationInput].forEach(input => {
    if (input) input.addEventListener('input', clearRegisterEmailMismatch);
  });

  function startRecoveryCooldown() {
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (!forgotPasswordLink) return;
    if (recoveryCooldownInterval) clearInterval(recoveryCooldownInterval);

    const expiresAt = Date.now() + 60000;
    const updateCountdown = () => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      if (secondsLeft === 0) {
        clearInterval(recoveryCooldownInterval);
        recoveryCooldownInterval = null;
        forgotPasswordLink.textContent = 'Esqueceu a senha?';
        forgotPasswordLink.removeAttribute('aria-disabled');
        forgotPasswordLink.removeAttribute('aria-label');
        forgotPasswordLink.removeAttribute('tabindex');
        return;
      }
      forgotPasswordLink.textContent = `Tente novamente em ${secondsLeft}s`;
      forgotPasswordLink.setAttribute('aria-disabled', 'true');
      forgotPasswordLink.setAttribute('aria-label', `Esqueceu a senha? Aguarde ${secondsLeft} segundos`);
      forgotPasswordLink.setAttribute('tabindex', '-1');
    };

    updateCountdown();
    recoveryCooldownInterval = setInterval(updateCountdown, 1000);
  }

  function closePasswordRecovery() {
    if (!passwordRecoveryModal) return;
    passwordRecoveryModal.classList.remove('active');
    passwordRecoveryModal.setAttribute('aria-hidden', 'true');
    if (passwordRecoveryError) {
      passwordRecoveryError.textContent = '';
      passwordRecoveryError.hidden = true;
      passwordRecoveryError.style.display = 'none';
    }
    if (recoveryPreviousFocus && typeof recoveryPreviousFocus.focus === 'function') {
      recoveryPreviousFocus.focus();
    }
  }

  function openPasswordRecovery() {
    if (!passwordRecoveryModal || !passwordRecoveryDialog) return;
    recoveryPreviousFocus = document.activeElement;
    passwordRecoveryModal.classList.add('active');
    passwordRecoveryModal.setAttribute('aria-hidden', 'false');
    passwordRecoveryDialog.focus();
    document.getElementById('recoveryPassword')?.focus();
  }

  const closePasswordRecoveryBtn = document.getElementById('closePasswordRecoveryBtn');
  if (closePasswordRecoveryBtn) closePasswordRecoveryBtn.addEventListener('click', closePasswordRecovery);
  if (passwordRecoveryModal) {
    passwordRecoveryModal.addEventListener('click', e => {
      if (e.target === passwordRecoveryModal) closePasswordRecovery();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && passwordRecoveryModal?.classList.contains('active')) {
      closePasswordRecovery();
    }
  });

  function showAuthAlert(msg, isSuccess = false) {
    if (!authAlertBanner || !authAlertText) return;
    authAlertText.textContent = msg;
    authAlertBanner.className = isSuccess ? 'auth-alert-banner success' : 'auth-alert-banner';
    authAlertBanner.style.display = 'flex';
  }

  function hideAuthAlert() {
    if (authAlertBanner) authAlertBanner.style.display = 'none';
  }

  function setAuthTab(tab) {
    hideAuthAlert();
    if (tab === 'login') {
      if (tabLoginBtn) tabLoginBtn.classList.add('active');
      if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
      if (authLoginForm) authLoginForm.style.display = 'flex';
      if (authRegisterForm) authRegisterForm.style.display = 'none';
      if (authSubtitleText) {
        authSubtitleText.textContent = 'Acesse sua conta para sincronizar seus lançamentos com segurança.';
      }
    } else {
      if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
      if (tabLoginBtn) tabLoginBtn.classList.remove('active');
      if (authRegisterForm) authRegisterForm.style.display = 'flex';
      if (authLoginForm) authLoginForm.style.display = 'none';
      if (authSubtitleText) {
        authSubtitleText.textContent = 'Crie sua conta em segundos para salvar seus dados com total privacidade.';
      }
    }
  }

  function openAuth(tab = 'login') {
    setAuthTab(tab);
    if (authModal) authModal.classList.add('active');
  }

  function closeDiscardPendingModal() {
    if (!discardPendingModal) return;
    discardPendingModal.classList.remove('active');
    discardPendingModal.setAttribute('aria-hidden', 'true');
  }

  function requestDiscardForAccountSwitch(user) {
    pendingAccountSwitchUser = user;
    if (!discardPendingModal) {
      showAuthAlert('Há alterações não sincronizadas. Entre novamente na mesma conta ou descarte as alterações antes de trocar de conta.');
      return;
    }
    discardPendingModal.classList.add('active');
    discardPendingModal.setAttribute('aria-hidden', 'false');
  }

  function closeAuth() {
    if (authModal) authModal.classList.remove('active');
    hideAuthAlert();
  }

  if (openAuthModalBtn) {
    openAuthModalBtn.addEventListener('click', () => openAuth('login'));
  }

  if (closeAuthModalBtn) {
    closeAuthModalBtn.addEventListener('click', closeAuth);
  }

  if (continueAsGuestBtn) {
    continueAsGuestBtn.addEventListener('click', () => {
      closeAuth();
      showToast('Continuando no Modo Local.');
    });
  }

  if (cancelDiscardPendingBtn) {
    cancelDiscardPendingBtn.addEventListener('click', async () => {
      const user = pendingAccountSwitchUser;
      closeDiscardPendingModal();
      try {
        await window.SupabaseAuth.signOut();
        pendingAccountSwitchUser = null;
      } catch (error) {
        console.warn('[GastoPro] Não foi possível cancelar a troca de conta:', error);
        pendingAccountSwitchUser = user;
        if (discardPendingModal) {
          discardPendingModal.classList.add('active');
          discardPendingModal.setAttribute('aria-hidden', 'false');
        }
        showAuthAlert('Não foi possível cancelar a troca. Seus dados pendentes continuam preservados.');
      }
    });
  }

  if (exportBeforeDiscardBtn) {
    exportBeforeDiscardBtn.addEventListener('click', () => {
      FinanceData.exportJSON();
      showToast('Backup JSON exportado. Guarde-o antes de descartar as alterações.');
    });
  }

  if (confirmDiscardPendingBtn) {
    confirmDiscardPendingBtn.addEventListener('click', async () => {
      const user = pendingAccountSwitchUser;
      if (!user || window.GastoProSessionHelpers.getAccountSwitchAction(
        FinanceData.getActiveUserId(),
        user.id,
        FinanceData.hasPendingSync(),
        true
      ) !== 'discard-and-continue') return;

      confirmDiscardPendingBtn.disabled = true;
      try {
        FinanceData.clearUserData();
        if (!FinanceData.activateUser(user.id)) {
          throw new Error('Não foi possível preparar os dados da nova conta.');
        }
        pendingAccountSwitchUser = null;
        closeDiscardPendingModal();
        closeAuth();
        await prepareAuthenticatedUser(user);
        await syncUserDataFromCloud(user.id);
        renderUserProfile();
        renderAll();
      } catch (error) {
        console.error('[GastoPro] Falha ao descartar alterações e trocar de conta:', error);
        showAuthAlert('Não foi possível trocar de conta. Os dados locais foram limpos após sua confirmação; tente entrar novamente.');
      } finally {
        confirmDiscardPendingBtn.disabled = false;
      }
    });
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuth();
    });
  }

  if (tabLoginBtn) {
    tabLoginBtn.addEventListener('click', () => setAuthTab('login'));
  }

  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener('click', () => setAuthTab('register'));
  }

  // Toggle de visualização de senha
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      }
      btn.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
    });
  }

  setupPasswordToggle('toggleLoginPasswordBtn', 'loginPassword');
  setupPasswordToggle('toggleRegisterPasswordBtn', 'registerPassword');
  setupPasswordToggle('toggleRecoveryPasswordBtn', 'recoveryPassword');

  if (passwordRecoveryForm) {
    passwordRecoveryForm.addEventListener('submit', async e => {
      e.preventDefault();
      const password = document.getElementById('recoveryPassword').value;
      const confirmation = document.getElementById('recoveryPasswordConfirm').value;
      const submitBtn = document.getElementById('submitRecoveryPasswordBtn');
      if (!isValidPassword(password)) {
        passwordRecoveryError.textContent = 'A senha deve ter no mínimo 8 caracteres.';
        passwordRecoveryError.hidden = false;
        passwordRecoveryError.style.display = 'flex';
        return;
      }
      if (password !== confirmation) {
        passwordRecoveryError.textContent = 'As senhas não coincidem.';
        passwordRecoveryError.hidden = false;
        passwordRecoveryError.style.display = 'flex';
        return;
      }
      submitBtn.disabled = true;
      try {
        await window.SupabaseAuth.updatePassword(password);
        closePasswordRecovery();
        history.replaceState(null, document.title, `${location.pathname}${location.search}`);
        showToast('Senha atualizada com sucesso.');
      } catch (error) {
        console.error('[GastoPro Auth] Erro ao atualizar senha:', error);
        passwordRecoveryError.textContent = 'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.';
        passwordRecoveryError.hidden = false;
        passwordRecoveryError.style.display = 'flex';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ── Sincronização de Dados com a Nuvem (Supabase) ───────────
  const activeSyncs = new Map();

  async function syncUserDataFromCloud(userId) {
    if (!window.SupabaseAuth || !userId) return;
    if (activeSyncs.has(userId)) return activeSyncs.get(userId);

    const syncPromise = (async () => {
      try {
        const sessionUser = await window.SupabaseAuth.getSessionUser();
        if (!sessionUser || sessionUser.id !== userId) return false;

        const localSync = await FinanceData.prepareLocalDataForSync(userId);
        if (!localSync.success) return false;

        const [cloudEntries, cloudTemplates, cloudGoals, cloudAccounts, cloudProfileResult] = await Promise.all([
          window.SupabaseAuth.fetchCloudEntries(userId),
          window.SupabaseAuth.fetchCloudTemplates(userId),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudGoals(userId))
            .catch(error => {
              console.warn('[GastoPro] Não foi possível buscar metas na nuvem:', error);
              return null;
            }),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudAccounts(userId))
            .catch(error => {
              console.warn('[GastoPro] Não foi possível buscar contas na nuvem:', error);
              return null;
            }),
          window.SupabaseAuth.fetchCloudProfile
            ? window.SupabaseAuth.fetchCloudProfile(userId)
            : { success: false, error: new Error('Busca de perfil não disponível.') }
        ]);

        if (!Array.isArray(cloudEntries) || !Array.isArray(cloudTemplates) ||
          !Array.isArray(cloudAccounts)) {
          console.warn('[GastoPro] Sincronização incompleta; os dados locais foram mantidos.');
          showToast('Não foi possível sincronizar; seus dados continuam salvos neste aparelho');
          return false;
        }

        if (cloudProfileResult.success) {
          if (cloudProfileResult.profile) {
            FinanceData.mergeCloudProfile(cloudProfileResult.profile);
          }
        } else {
          console.warn('[GastoPro] Não foi possível buscar o perfil na nuvem:', cloudProfileResult.error);
          showToast('O perfil local foi preservado; não foi possível buscar o perfil na nuvem.');
        }

        if (!FinanceData.mergeCloudData(
          userId, cloudEntries, cloudTemplates, localSync.success, cloudGoals, cloudAccounts
        )) {
          console.warn('[GastoPro] Sincronização ignorada: o usuário local não corresponde à sessão.');
          showToast('Não foi possível sincronizar; seus dados continuam salvos neste aparelho');
          return false;
        }

        renderAll();
        return true;
      } catch (e) {
        console.warn('[GastoPro] Aviso de sincronização na nuvem:', e);
        return false;
      }
    })();

    activeSyncs.set(userId, syncPromise);
    try {
      return await syncPromise;
    } finally {
      activeSyncs.delete(userId);
    }
  }

  function clearUserSessionData() {
    resetAdminSession();
    try {
      FinanceData.clearUserData();
    } catch (e) {
      console.warn('[GastoPro] Falha ao limpar dados locais da sessão:', e);
    }

    if (state.chartInstance) state.chartInstance.destroy();
    state.chartInstance = null;
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
    const editForm = document.getElementById('editForm');
    if (editForm) editForm.reset();
    renderUserProfile();
    renderAll();
  }

  async function prepareAuthenticatedUser(user) {
    if (!user || !user.id) return null;
    const switchAction = window.GastoProSessionHelpers.getAccountSwitchAction(
      FinanceData.getActiveUserId(),
      user.id,
      FinanceData.hasPendingSync()
    );
    if (switchAction === 'confirm-discard') {
      requestDiscardForAccountSwitch(user);
      return null;
    }
    const switchedUser = FinanceData.activateUser(user.id);
    if (switchedUser) window.switchToView('dashboard');
    if (FinanceData.getActiveUserId() !== user.id) {
      showAuthAlert('Há alterações não sincronizadas da conta anterior. Entre novamente nessa conta para sincronizá-las.');
      try {
        const activeSession = await window.SupabaseAuth.getSessionUser();
        if (activeSession && activeSession.id === user.id) {
          await window.SupabaseAuth.signOut();
        }
      } catch (e) {
        console.warn('[GastoPro] Falha ao cancelar a troca de conta:', e);
      }
      return null;
    }
    const cloudProfileResult = window.SupabaseAuth.fetchCloudProfile
      ? await window.SupabaseAuth.fetchCloudProfile(user.id)
      : { success: false, error: new Error('Busca de perfil não disponível.') };
    const profilePending = FinanceData.getPendingSync().profile;
    if (cloudProfileResult.success && cloudProfileResult.profile) {
      FinanceData.mergeCloudProfile(cloudProfileResult.profile);
    } else if (!cloudProfileResult.success) {
      console.warn('[GastoPro] Não foi possível buscar perfil antes de preparar a sessão:', cloudProfileResult.error);
    }

    const profile = FinanceData.getProfile();
    profile.userId = user.id;
    profile.email = user.email;
    if (!profilePending) {
      const cloudName = cloudProfileResult.success && cloudProfileResult.profile
        ? cloudProfileResult.profile.name
        : '';
      profile.name = window.GastoProProfileHelpers.getInitialName(
        profile.name,
        cloudName,
        user.user_metadata && user.user_metadata.name,
        user.email.split('@')[0]
      );
    }
    const queueInitialProfile = cloudProfileResult.success && !profilePending &&
      (!cloudProfileResult.profile || !cloudProfileResult.profile.name) &&
      Boolean(profile.name || profile.avatar);
    FinanceData.saveProfile(profile, { queueSync: queueInitialProfile });
    renderUserProfile();
    return profile;
  }

  if (window.SupabaseAuth) {
    window.SupabaseAuth.onAuthStateChange((event, user) => {
      if (event === 'PASSWORD_RECOVERY') {
        openPasswordRecovery();
        return;
      }
      if (event === 'SIGNED_OUT' || (!user && event === 'TOKEN_REFRESHED')) {
        resetAdminSession();
        feedbackViewState.requestId++;
        feedbackViewState.loading = false;
        feedbackViewState.mode = 'signed_out';
        feedbackViewState.messages = [];
        feedbackViewState.userId = null;
        feedbackViewState.notice = '';
        if (FinanceData.hasPendingSync()) {
          renderContactView();
          openAuth('login');
          showAuthAlert('Sua sessão expirou e há alterações não sincronizadas neste aparelho. Entre novamente na mesma conta para sincronizá-las.');
          return;
        }
        clearUserSessionData();
        return;
      }
      if (!user) return;

      if (feedbackViewState.userId && feedbackViewState.userId !== user.id) {
        feedbackViewState.requestId++;
        feedbackViewState.loading = false;
        feedbackViewState.messages = [];
      }
      feedbackViewState.userId = user.id;
      const switchedUser = FinanceData.activateUser(user.id);
      if (switchedUser) {
        resetAdminSession();
        window.switchToView('dashboard');
      }
      if (switchedUser || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        prepareAuthenticatedUser(user).then(async profile => {
          if (!profile) return false;
          await refreshAdminBadge();
          if (state.currentView === 'contact') loadMyFeedback();
          if (state.currentView === 'admin') openAdminView();
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            return syncUserDataFromCloud(user.id);
          }
        }).catch(e => {
          console.warn('[GastoPro] Falha ao preparar sessão autenticada:', e);
        });
      }
    });
  }



  // Submissão do Formulário de Login (Supabase Real com fallback)
  if (authLoginForm) {
    authLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;
      const submitBtn = document.getElementById('submitLoginBtn');

      if (!email || !password) {
        showAuthAlert('Por favor, preencha todos os campos.');
        return;
      }
      if (!window.SupabaseAuth || !window.SupabaseAuth.client) {
        showAuthAlert('Serviço de autenticação indisponível. Verifique sua conexão e tente novamente.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
      }

      try {
        const { user } = await window.SupabaseAuth.signIn(email, password);
        const profile = await prepareAuthenticatedUser(user);
        if (!profile) {
          if (!pendingAccountSwitchUser) {
            showAuthAlert('Há alterações não sincronizadas. Entre novamente na mesma conta para sincronizá-las.');
          }
          return;
        }
        closeAuth();
        showToast(`Bem-vindo de volta, ${profile.name}!`);
        await syncUserDataFromCloud(user.id);
      } catch (err) {
        console.error('[GastoPro Auth] Erro no login:', err);
        let msg = 'Erro ao realizar login. Verifique suas credenciais.';
        if (err.message && err.message.includes('Invalid login credentials')) {
          msg = 'E-mail ou senha incorretos.';
        } else if (err.message && err.message.includes('Email not confirmed')) {
          msg = 'Confirme seu e-mail antes de entrar.';
        }
        showAuthAlert(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Entrar no GastoPro</span><i class="fa-solid fa-arrow-right"></i>';
        }
      }
    });
  }

  // Submissão do Formulário de Cadastro (Supabase Real com fallback)
  if (authRegisterForm) {
    authRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName')?.value.trim();
      const email = document.getElementById('registerEmail')?.value.trim();
      const password = document.getElementById('registerPassword')?.value;
      const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
      const submitBtn = document.getElementById('submitRegisterBtn');

      if (!name || !email || !password || !confirmPassword) {
        showAuthAlert('Por favor, preencha todos os campos.');
        return;
      }

      if (!window.SupabaseAuth || !window.SupabaseAuth.client) {
        showAuthAlert('Serviço de autenticação indisponível. Verifique sua conexão e tente novamente.');
        return;
      }

      if (!window.GastoProAuthHelpers.emailsMatch(email, registerEmailConfirmationInput.value)) {
        if (registerEmailMismatch) {
          registerEmailMismatch.textContent = 'Os e-mails não coincidem. Confira os dois campos.';
          registerEmailMismatch.hidden = false;
        }
        registerEmailConfirmationInput.setAttribute('aria-invalid', 'true');
        registerEmailConfirmationInput.focus();
        return;
      }
      clearRegisterEmailMismatch();

      if (password !== confirmPassword) {
        showAuthAlert('As senhas não coincidem!');
        return;
      }

      if (!isValidPassword(password)) {
        showAuthAlert('A senha deve ter no mínimo 8 caracteres.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';
      }

      try {
        const data = await window.SupabaseAuth.signUp(name, email, password);
        const profile = FinanceData.getProfile();
        profile.name = name;
        profile.email = email;
        FinanceData.saveProfile(profile);
        renderUserProfile();

        if (data && data.session) {
          closeAuth();
          showToast(`Conta criada com sucesso! Bem-vindo, ${name}!`);
          const user = data.session.user;
          const authenticatedProfile = await prepareAuthenticatedUser(user);
          if (authenticatedProfile) await syncUserDataFromCloud(authenticatedProfile.userId);
        } else {
          showAuthAlert('Conta criada! A confirmação por e-mail pode demorar alguns minutos. Confira sua caixa de entrada e a pasta de spam.', true);
        }
      } catch (err) {
        console.error('[GastoPro Auth] Erro no cadastro:', err);
        let msg = err.message || 'Erro ao criar conta. Tente novamente.';
        if (msg.includes('User already registered')) {
          msg = 'Este e-mail já está cadastrado. Faça login na aba "Entrar".';
        }
        showAuthAlert(msg);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Criar Minha Conta Gratuita</span><i class="fa-solid fa-user-plus"></i>';
        }
      }
    });
  }

  // Botão de Logout Real (Supabase)
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const user = window.SupabaseAuth
        ? await window.SupabaseAuth.getSessionUser()
        : null;
      if (!user || !user.id) {
        showToast('Seus dados locais foram mantidos neste aparelho.');
        return;
      }

      const syncResult = await FinanceData.prepareLocalDataForSync(user.id);
      if (!syncResult.success) {
        showConfirm({
          title: 'Não foi possível sincronizar',
          message: 'Seus dados continuam neste aparelho. Baixe um backup JSON antes de tentar sair novamente.',
          iconClass: 'fa-solid fa-cloud-arrow-up',
          okLabel: 'Baixar backup JSON',
          okBtnClass: 'btn-primary',
          onConfirm: () => {
            FinanceData.exportJSON();
            showToast('Backup JSON exportado. Seus dados continuam salvos neste aparelho.');
          }
        });
        return;
      }

      try {
        await window.SupabaseAuth.signOut();
      } catch (e) {
        console.warn('[GastoPro] Falha ao encerrar sessão:', e);
        showToast('Não foi possível encerrar a sessão. Seus dados continuam salvos neste aparelho.');
        return;
      }
      clearUserSessionData();
      showToast('Você saiu da sua conta com segurança.');
    });
  }

  function closeDeleteAccountModal() {
    if (!deleteAccountModal) return;
    deleteAccountModal.classList.remove('active');
    deleteAccountModal.setAttribute('aria-hidden', 'true');
  }

  function showDeleteAccountError(message) {
    if (!deleteAccountError) return;
    deleteAccountError.textContent = message;
    deleteAccountError.hidden = false;
  }

  function openDeleteAccountModal() {
    if (!deleteAccountModal) return;
    if (deleteAccountConfirmation) {
      deleteAccountConfirmation.value = '';
      deleteAccountConfirmation.disabled = false;
    }
    if (deleteAccountError) {
      deleteAccountError.textContent = '';
      deleteAccountError.hidden = true;
    }
    if (confirmDeleteAccountBtn) {
      confirmDeleteAccountBtn.disabled = true;
      confirmDeleteAccountBtn.textContent = 'Excluir conta';
    }
    if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = false;
    if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = false;
    deleteAccountModal.classList.add('active');
    deleteAccountModal.setAttribute('aria-hidden', 'false');
  }

  if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', openDeleteAccountModal);
  if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.addEventListener('click', closeDeleteAccountModal);
  if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.addEventListener('click', closeDeleteAccountModal);
  if (deleteAccountModal) {
    deleteAccountModal.addEventListener('click', event => {
      if (event.target === deleteAccountModal) closeDeleteAccountModal();
    });
  }

  if (deleteAccountConfirmation && confirmDeleteAccountBtn) {
    deleteAccountConfirmation.addEventListener('input', () => {
      confirmDeleteAccountBtn.disabled = !window.GastoProAccountDeletion.isConfirmationValid(
        deleteAccountConfirmation.value
      );
      if (deleteAccountError) {
        deleteAccountError.textContent = '';
        deleteAccountError.hidden = true;
      }
    });

    confirmDeleteAccountBtn.addEventListener('click', async () => {
      if (!window.GastoProAccountDeletion.isConfirmationValid(deleteAccountConfirmation.value)) return;

      confirmDeleteAccountBtn.disabled = true;
      confirmDeleteAccountBtn.textContent = 'Excluindo...';
      if (deleteAccountConfirmation) deleteAccountConfirmation.disabled = true;
      if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = true;
      if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = true;

      try {
        const result = await window.GastoProAccountDeletion.deleteAccountAndClearPendingSync(
          window.SupabaseAuth,
          FinanceData
        );
        if (!result || !result.success) {
          showDeleteAccountError(
            result && result.error && result.error.message
              ? result.error.message
              : 'Não foi possível excluir a conta. Tente novamente.'
          );
          if (deleteAccountConfirmation) deleteAccountConfirmation.disabled = false;
          if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = false;
          if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = false;
          confirmDeleteAccountBtn.disabled = !window.GastoProAccountDeletion.isConfirmationValid(
            deleteAccountConfirmation.value
          );
          confirmDeleteAccountBtn.textContent = 'Excluir conta';
          return;
        }
      } catch (error) {
        console.error('[GastoPro] Falha ao concluir a exclusão da conta:', error);
        showDeleteAccountError('Não foi possível concluir a exclusão da conta. Verifique a conexão e tente novamente.');
        if (deleteAccountConfirmation) deleteAccountConfirmation.disabled = false;
        if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = false;
        if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = false;
        confirmDeleteAccountBtn.disabled = !window.GastoProAccountDeletion.isConfirmationValid(
          deleteAccountConfirmation.value
        );
        confirmDeleteAccountBtn.textContent = 'Excluir conta';
        return;
      }

      closeDeleteAccountModal();
      closeProfileDrawer();
      renderUserProfile();
      renderAll();
      showToast('Conta e dados excluídos. O GastoPro está pronto para começar novamente.');
    });
  }

  if (downloadBackupBeforeAccountDeletion) {
    downloadBackupBeforeAccountDeletion.addEventListener('click', () => {
      FinanceData.exportJSON();
      showToast('Backup JSON exportado. Guarde-o antes de excluir a conta.');
    });
  }

  // Link Esqueceu a Senha — envia e-mail real de recuperação via Supabase
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      if (forgotPasswordLink.getAttribute('aria-disabled') === 'true') return;
      const emailInput = document.getElementById('loginEmail');
      const email = emailInput ? emailInput.value.trim() : '';

      if (!email) {
        showAuthAlert('Digite seu e-mail no campo acima e clique em "Esqueceu a senha?" novamente.');
        return;
      }

      forgotPasswordLink.textContent = 'Enviando...';
      forgotPasswordLink.setAttribute('aria-busy', 'true');
      let requestAttempted = false;

      try {
        if (window.SupabaseAuth && window.SupabaseAuth.resetPasswordForEmail) {
          requestAttempted = true;
          await window.SupabaseAuth.resetPasswordForEmail(email);
          showAuthAlert(window.GastoProAuthHelpers.getPasswordRecoverySuccessMessage(), true);
        } else {
          showAuthAlert('Serviço de recuperação não disponível. Tente novamente mais tarde.');
        }
      } catch (err) {
        console.error('[GastoPro] Erro ao enviar reset de senha:', err);
        showAuthAlert(window.GastoProAuthHelpers.getPasswordRecoveryErrorMessage(err));
      } finally {
        forgotPasswordLink.removeAttribute('aria-busy');
        if (requestAttempted) startRecoveryCooldown();
        else forgotPasswordLink.textContent = 'Esqueceu a senha?';
      }
    });
  }

  // Upload de Foto
  if (changeAvatarBtn && avatarFileInput) {
    changeAvatarBtn.addEventListener('click', () => {
      avatarFileInput.click();
    });

    function closeAvatarCrop() {
      if (avatarCropModal) {
        avatarCropModal.classList.remove('active');
        avatarCropModal.setAttribute('aria-hidden', 'true');
      }
      if (avatarCropState && avatarCropState.objectUrl) {
        URL.revokeObjectURL(avatarCropState.objectUrl);
      }
      avatarCropState = null;
      if (avatarCropImage) avatarCropImage.removeAttribute('src');
      if (changeAvatarBtn) changeAvatarBtn.focus();
    }

    function updateAvatarCropPreview() {
      if (!avatarCropState || !avatarCropImage) return;
      const { image, zoom, offsetX, offsetY } = avatarCropState;
      const crop = window.GastoProAvatarCrop.computeCropRect(
        image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY
      );
      avatarCropState.crop = crop;
      const previewScale = (avatarCropFrame.clientWidth || 256) / crop.width;
      avatarCropImage.style.width = `${image.naturalWidth * previewScale}px`;
      avatarCropImage.style.height = `${image.naturalHeight * previewScale}px`;
      avatarCropImage.style.left = `${-crop.x * previewScale}px`;
      avatarCropImage.style.top = `${-crop.y * previewScale}px`;
      if (avatarZoomSlider) avatarZoomSlider.value = String(crop.zoom);
    }

    function setAvatarZoom(zoom) {
      if (!avatarCropState) return;
      avatarCropState.zoom = Math.min(3, Math.max(1, zoom));
      updateAvatarCropPreview();
    }

    async function openAvatarCrop(file) {
      let objectUrl = null;
      try {
        const dimensions = await readAvatarDimensions(file);
        objectUrl = URL.createObjectURL(file);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error('Não foi possível decodificar a imagem.'));
          image.src = objectUrl;
        });
        const decodedWidth = image.naturalWidth;
        const decodedHeight = image.naturalHeight;
        const validDecodedDimensions = decodedWidth > 0 && decodedHeight > 0 &&
          decodedWidth <= 12000 && decodedHeight <= 12000 &&
          decodedWidth * decodedHeight <= 40000000;
        const matchingDimensions = (decodedWidth === dimensions.width &&
          decodedHeight === dimensions.height) ||
          (decodedWidth === dimensions.height && decodedHeight === dimensions.width);
        if (!validDecodedDimensions || !matchingDimensions) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          throw new Error('As dimensões da imagem não puderam ser confirmadas.');
        }
        avatarCropState = { image, objectUrl, zoom: 1, offsetX: 0, offsetY: 0, crop: null };
        if (avatarCropImage) avatarCropImage.src = objectUrl;
        if (avatarCropError) {
          avatarCropError.hidden = true;
          avatarCropError.textContent = '';
        }
        updateAvatarCropPreview();
        if (avatarCropModal) {
          avatarCropModal.classList.add('active');
          avatarCropModal.setAttribute('aria-hidden', 'false');
          avatarCropModal.querySelector('[role="dialog"]')?.focus();
        }
      } catch (error) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        console.error('[GastoPro] Erro ao abrir a foto:', error);
        showToast(error.message || 'Não foi possível abrir a imagem.');
      }
    }

    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      avatarFileInput.value = '';
      if (!file) return;

      if (!isSupportedAvatarType(file.type)) {
        showToast('Selecione uma imagem JPEG, PNG ou WebP.');
        return;
      }

      // Limite de 2 MB: o FileReader gera Base64 ~33% maior (até ~2.7 MB),
      // garantindo margem segura dentro do limite de ~5 MB do localStorage.
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem é muito grande! Escolha uma foto de até 2MB.');
        return;
      }

      openAvatarCrop(file);
    });

    if (avatarCropFrame) {
      avatarCropFrame.addEventListener('pointerdown', event => {
        if (!avatarCropState) return;
        avatarCropState.pointer = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY
        };
        avatarCropFrame.setPointerCapture(event.pointerId);
      });
      avatarCropFrame.addEventListener('pointermove', event => {
        if (!avatarCropState || !avatarCropState.pointer ||
          avatarCropState.pointer.id !== event.pointerId) return;
        const ratio = 256 / (avatarCropFrame.clientWidth || 256);
        avatarCropState.offsetX += (event.clientX - avatarCropState.pointer.x) * ratio;
        avatarCropState.offsetY += (event.clientY - avatarCropState.pointer.y) * ratio;
        avatarCropState.pointer.x = event.clientX;
        avatarCropState.pointer.y = event.clientY;
        updateAvatarCropPreview();
      });
      const stopDragging = event => {
        if (avatarCropState && avatarCropState.pointer &&
          avatarCropState.pointer.id === event.pointerId) avatarCropState.pointer = null;
      };
      avatarCropFrame.addEventListener('pointerup', stopDragging);
      avatarCropFrame.addEventListener('pointercancel', stopDragging);
      avatarCropFrame.addEventListener('wheel', event => {
        if (!avatarCropState) return;
        event.preventDefault();
        setAvatarZoom(avatarCropState.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
      }, { passive: false });
      avatarCropFrame.addEventListener('keydown', event => {
        if (!avatarCropState) return;
        const step = (event.shiftKey ? 30 : 10) * 256 / (avatarCropFrame.clientWidth || 256);
        if (event.key === 'ArrowLeft') avatarCropState.offsetX -= step;
        else if (event.key === 'ArrowRight') avatarCropState.offsetX += step;
        else if (event.key === 'ArrowUp') avatarCropState.offsetY -= step;
        else if (event.key === 'ArrowDown') avatarCropState.offsetY += step;
        else if (event.key === '+' || event.key === '=') setAvatarZoom(avatarCropState.zoom + 0.1);
        else if (event.key === '-') setAvatarZoom(avatarCropState.zoom - 0.1);
        else return;
        event.preventDefault();
        updateAvatarCropPreview();
      });
    }

    const zoomOutBtn = document.getElementById('avatarZoomOutBtn');
    const zoomInBtn = document.getElementById('avatarZoomInBtn');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
      if (avatarCropState) setAvatarZoom(avatarCropState.zoom - 0.1);
    });
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
      if (avatarCropState) setAvatarZoom(avatarCropState.zoom + 0.1);
    });
    if (avatarZoomSlider) avatarZoomSlider.addEventListener('input', () => {
      setAvatarZoom(Number(avatarZoomSlider.value));
    });
    [cancelAvatarCropBtn, closeAvatarCropBtn].forEach(button => {
      if (button) button.addEventListener('click', closeAvatarCrop);
    });
    if (avatarCropModal) avatarCropModal.addEventListener('click', event => {
      if (event.target === avatarCropModal) closeAvatarCrop();
    });
    if (avatarCropModal) {
      const avatarCropDialog = avatarCropModal.querySelector('[role="dialog"]');
      window.GastoProKeyboardPanels.bind({
        panel: avatarCropDialog,
        trigger: changeAvatarBtn,
        isOpen: () => avatarCropModal.classList.contains('active'),
        close: closeAvatarCrop,
        trapFocus: true
      });
    }
    if (saveAvatarCropBtn) saveAvatarCropBtn.addEventListener('click', () => {
      if (!avatarCropState) return;
      try {
        const avatar = renderAvatarCropToJpeg(avatarCropState.image, avatarCropState.crop);
        const profile = FinanceData.getProfile();
        profile.avatar = avatar;
        const result = FinanceData.saveProfile(profile, { queueSync: true });
        if (!result.success) {
          if (result.error && result.error.name === 'QuotaExceededError') {
            showToast('O armazenamento do navegador está cheio. Remova alguns dados e tente novamente.');
          } else {
            showToast('Não foi possível salvar a foto neste aparelho.');
          }
          return;
        }
        closeAvatarCrop();
        renderUserProfile();
        showToast('Foto de perfil atualizada com sucesso!');
        syncEditedProfile(profile);
      } catch (error) {
        console.error('[GastoPro] Erro ao processar avatar:', error);
        if (avatarCropError) {
          avatarCropError.textContent = error.message || 'Não foi possível salvar a foto.';
          avatarCropError.hidden = false;
        }
      }
    });
  }

  // Salvar Nome do Usuário
  function handleSaveProfileName() {
    if (!profileNameInput) return;
    const newName = profileNameInput.value.trim();
    if (!newName) {
      alert('Por favor, digite um nome válido.');
      return;
    }

    const profile = FinanceData.getProfile();
    profile.name = newName;
    FinanceData.saveProfile(profile, { queueSync: true });
    renderUserProfile();
    showToast(`Nome alterado para "${newName}"!`);
    syncEditedProfile(profile);
  }

  if (saveProfileNameBtn) {
    saveProfileNameBtn.addEventListener('click', handleSaveProfileName);
  }

  if (profileNameInput) {
    profileNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveProfileName();
      }
    });
  }

  // ── 12. Botão de Atualizar / Refresh (Desktop & PWA Mobile) ──
  const refreshAppBtn      = document.getElementById('refreshAppBtn');
  const sidebarRefreshBtn  = document.getElementById('sidebarRefreshBtn');
  const drawerRefreshBtn   = document.getElementById('drawerRefreshBtn');
  const refreshIcon        = document.getElementById('refreshIcon');
  const sidebarRefreshIcon = document.getElementById('sidebarRefreshIcon');
  const drawerRefreshIcon  = document.getElementById('drawerRefreshIcon');

  let isRefreshing = false;

  async function handleAppRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;

    // Ativa animação de rotação contínua nos ícones
    const icons = [refreshIcon, sidebarRefreshIcon, drawerRefreshIcon].filter(Boolean);
    icons.forEach(icon => icon.classList.add('spinning'));

    const btns = [refreshAppBtn, sidebarRefreshBtn, drawerRefreshBtn].filter(Boolean);
    btns.forEach(btn => btn.classList.add('refreshing'));

    const startTime = Date.now();

    try {
      let isCloud = false;
      let hasCloudSession = false;
      if (window.SupabaseAuth) {
        const user = await window.SupabaseAuth.getSessionUser();
        if (user && user.id) {
          hasCloudSession = true;
          isCloud = await syncUserDataFromCloud(user.id);
        }
      }

      // Re-renderiza views e perfil
      renderUserProfile();
      renderAll();

      // Feedback visual nítido (mínimo 500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(res => setTimeout(res, 500 - elapsed));
      }

      const refreshMessage = isCloud
        ? 'Dados sincronizados com a nuvem!'
        : hasCloudSession
          ? 'Dados locais mantidos; não foi possível sincronizar agora.'
          : 'Dados atualizados com sucesso!';
      showToast(refreshMessage);

      // Se a sidebar ou o drawer estiverem abertos, fecha-os
      closeMobileSidebar();
      closeProfileDrawer();
    } catch (err) {
      console.warn('[GastoPro] Erro durante o refresh:', err);
      renderAll();
      showToast('Dados locais atualizados.');
    } finally {
      icons.forEach(icon => icon.classList.remove('spinning'));
      btns.forEach(btn => btn.classList.remove('refreshing'));
      isRefreshing = false;
    }
  }

  if (refreshAppBtn)     refreshAppBtn.addEventListener('click', handleAppRefresh);
  if (sidebarRefreshBtn) sidebarRefreshBtn.addEventListener('click', handleAppRefresh);
  if (drawerRefreshBtn)  drawerRefreshBtn.addEventListener('click', handleAppRefresh);

  // ── 13. MÓDULO DE IMPORTAÇÃO DE EXTRATOS ─────────────────────────
  // Controlador do modal de importação CSV / Texto Bruto.
  // Depende de GastoProImporter (js/importer.js) para o parsing.
  // ─────────────────────────────────────────────────────────────────

  /** Todas as categorias disponíveis para o select da tabela de preview. */
  const IMPORT_CATEGORIES = [...new Set([
    ...GastoProCategories.EXPENSE,
    ...GastoProCategories.INCOME
  ])];

  // Referências dos elementos do modal
  const importModal         = document.getElementById('importModal');
  const closeImportModalBtn = document.getElementById('closeImportModalBtn');
  const cancelImportBtn     = document.getElementById('cancelImportBtn');
  const sidebarImportBtn    = document.getElementById('sidebarImportBtn');
  const importTabCsvBtn     = document.getElementById('importTabCsvBtn');
  const importTabTextBtn    = document.getElementById('importTabTextBtn');
  const importCsvPanel      = document.getElementById('importCsvPanel');
  const importTextPanel     = document.getElementById('importTextPanel');
  const csvFileInput        = document.getElementById('csvFileInput');
  const csvDropZone         = document.getElementById('csvDropZone');
  const parseCsvBtn         = document.getElementById('parseCsvBtn');
  const parseTextBtn        = document.getElementById('parseTextBtn');
  const importRawTextarea   = document.getElementById('importRawTextarea');
  const importPreviewSection= document.getElementById('importPreviewSection');
  const importPreviewTbody  = document.getElementById('importPreviewTableBody');
  const previewCountBadge   = document.getElementById('previewCountBadge');
  const importSelectAll     = document.getElementById('importSelectAll');
  const importDuplicateSelectionNote = document.getElementById('importDuplicateSelectionNote');
  const confirmImportBtn    = document.getElementById('confirmImportBtn');
  let importSaving = false;

  /** Abre o modal de importação e reseta o estado. */
  function openImportModal() {
    if (!importModal) return;
    importModal.classList.add('active');
    resetImportModal();
    closeMobileSidebar();
  }

  /** Fecha o modal de importação. */
  function closeImportModal(force = false) {
    if (!importModal || (importSaving && !force)) return;
    importModal.classList.remove('active');
  }

  /** Reseta o modal ao estado inicial (sem preview, aba CSV ativa). */
  function resetImportModal() {
    // Reseta painel para CSV
    switchImportTab('csv');
    // Limpa upload
    if (csvFileInput) csvFileInput.value = '';
    if (csvDropZone) {
      csvDropZone.classList.remove('csv-file-selected');
      document.getElementById('csvDropIcon').className = 'fa-solid fa-cloud-arrow-up drop-icon';
      document.getElementById('csvDropTitle').textContent = 'Arraste o arquivo aqui';
      document.getElementById('csvDropSub').textContent   = 'ou clique para selecionar o arquivo (.csv, .ofx, .xml)';
    }
    // Limpa textarea
    if (importRawTextarea) importRawTextarea.value = '';
    // Esconde preview
    if (importPreviewSection) importPreviewSection.classList.remove('visible');
    if (importPreviewTbody)   importPreviewTbody.innerHTML = '';
    if (previewCountBadge)    previewCountBadge.textContent = '0 itens';
    if (importSelectAll)      importSelectAll.checked = true;
    if (importDuplicateSelectionNote) {
      importDuplicateSelectionNote.textContent = '';
      importDuplicateSelectionNote.hidden = true;
    }
  }

  /** Alterna entre as abas CSV e Texto do modal. */
  function switchImportTab(tab) {
    const isCsv = tab === 'csv';
    if (importTabCsvBtn)  importTabCsvBtn.classList.toggle('active', isCsv);
    if (importTabTextBtn) importTabTextBtn.classList.toggle('active', !isCsv);
    if (importCsvPanel)   importCsvPanel.classList.toggle('active', isCsv);
    if (importTextPanel)  importTextPanel.classList.toggle('active', !isCsv);
    // Esconde preview ao trocar de aba
    if (importPreviewSection) importPreviewSection.classList.remove('visible');
  }

  /**
   * Renderiza a tabela de preview com as linhas parseadas.
   * @param {Array} rows - Resultado de parseCSV() ou parseRawText().
   */
  function renderImportPreview(rows) {
    const installmentHint = document.getElementById('importInstallmentHint');
    if (installmentHint) installmentHint.hidden = !rows || !rows.some(row => row.installment);
    if (!importPreviewTbody) return;
    importPreviewTbody.innerHTML = '';

    if (!rows || rows.length === 0) {
      importPreviewTbody.innerHTML = `
        <tr><td colspan="6">
          <div class="import-empty-alert">
            <i class="fa-solid fa-triangle-exclamation"></i>
            Nenhum lançamento foi encontrado. Verifique o formato do arquivo ou texto.
          </div>
        </td></tr>`;
      if (previewCountBadge) previewCountBadge.textContent = '0 itens';
      if (importPreviewSection) importPreviewSection.classList.add('visible');
      return;
    }

    if (importDuplicateSelectionNote) {
      importDuplicateSelectionNote.textContent = '';
      importDuplicateSelectionNote.hidden = true;
    }

    // Categorias únicas e ordenadas para o select
    const allCats = [...new Set([
      ...GastoProCategories.EXPENSE,
      ...GastoProCategories.INCOME,
      ...IMPORT_CATEGORIES
    ])].sort();

    rows.forEach((row, i) => {
      const isIncome = row.type === 'income';
      const selectedType = ['income', 'fixed', 'debt'].includes(row.type)
        ? row.type
        : row.pending ? 'variable_pending' : 'variable';
      const dateDisplay = row.date
        ? row.date.split('-').reverse().join('/')
        : 'Data inválida';
      const rowStatus = [
        row.invalid ? '<span class="import-row-status invalid">Data inválida</span>' : '',
        row.duplicate ? '<span class="import-row-status duplicate">Possível duplicado</span>' : '',
        row.pending ? '<span class="import-row-status pending">Sugestão: a pagar</span>' : ''
      ].filter(Boolean).join(' ');

      // Gera opções do select de categoria
      const catOptions = allCats.map(c =>
        `<option value="${escapeHtml(c)}" ${c === row.category ? 'selected' : ''}>${escapeHtml(c)}</option>`
      ).join('');
      const installmentDisplay = row.linkedTemplateId
        ? `<span class="import-installment-badge">${escapeHtml(`Baixa da parcela ${row.installment.current}/${row.installment.total} (dívida já cadastrada)`)}</span>`
        : row.installment
          ? `<span class="import-installment-badge">${escapeHtml(`Parcela ${row.installment.current}/${row.installment.total}`)}</span>${
            row.installment.current < row.installment.total
              ? `<label><input type="checkbox" class="import-installment-check" data-row="${i}" aria-label="${escapeHtml(`Lançar as ${row.installment.total - row.installment.current} restantes`)}" checked /> ${escapeHtml(`Lançar as ${row.installment.total - row.installment.current} restantes`)}</label>`
              : ''
          }`
          : '';
      const paymentPeriodDisplay = (row.type === 'fixed' || row.type === 'debt') && row.startMonth
        ? `<small class="import-row-reason">${escapeHtml(row.endMonth
          ? `A pagar de ${row.startMonth.slice(5, 7)}/${row.startMonth.slice(0, 4)} até ${row.endMonth.slice(5, 7)}/${row.endMonth.slice(0, 4)}`
          : `A pagar a partir de ${row.startMonth.slice(5, 7)}/${row.startMonth.slice(0, 4)}`)}</small>`
        : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-check">
          <input type="checkbox" class="import-row-check" data-row="${i}"
            aria-label="Incluir lançamento ${escapeHtml(row.desc)}"
            ${row.selected ? 'checked' : ''} ${row.invalid ? 'disabled' : ''} />
        </td>
        <td class="col-date">${escapeHtml(dateDisplay)}</td>
        <td class="col-desc" title="${escapeHtml(row.desc)}">
          ${escapeHtml(row.desc)} ${rowStatus}
          ${installmentDisplay}
          ${paymentPeriodDisplay}
          ${row.invalidReason ? `<small class="import-row-reason">${escapeHtml(row.invalidReason)}</small>` : ''}
        </td>
        <td class="col-category">
          <select class="import-cat-select" data-row="${i}" aria-label="Categoria de ${escapeHtml(row.desc)}">
            ${catOptions}
          </select>
        </td>
        <td class="col-type">
          <select class="import-type-select" data-row="${i}" aria-label="Tipo de ${escapeHtml(row.desc)}">
            <option value="variable" ${selectedType === 'variable' ? 'selected' : ''}>Gasto (pago)</option>
            <option value="variable_pending" ${selectedType === 'variable_pending' ? 'selected' : ''}>Gasto a pagar</option>
            <option value="fixed" ${selectedType === 'fixed' ? 'selected' : ''}>Conta fixa</option>
            <option value="debt" ${selectedType === 'debt' ? 'selected' : ''}>Dívida</option>
            <option value="income" ${selectedType === 'income' ? 'selected' : ''}>Receita</option>
          </select>
        </td>
        <td class="col-amount ${isIncome ? 'income' : ''}">
          ${escapeHtml(formatCurrency(row.amount))}
        </td>
      `;

      // Listener dinâmico: ao mudar tipo, atualiza cor do valor
      tr.querySelector('.import-type-select').addEventListener('change', (e) => {
        const isInc = e.target.value === 'income';
        tr.querySelector('.col-amount').classList.toggle('income', isInc);
      });

      importPreviewTbody.appendChild(tr);
    });

    const invalidCount = rows.filter(row => row.invalid).length;
    const duplicateCount = rows.filter(row => row.duplicate).length;
    if (previewCountBadge) {
      previewCountBadge.textContent =
        `${rows.length} ${rows.length === 1 ? 'item' : 'itens'} · ${invalidCount} inválidos · ${duplicateCount} possíveis duplicados`;
    }
    if (importPreviewSection) importPreviewSection.classList.add('visible');
    if (importSelectAll) importSelectAll.checked = rows.length > 0 && rows.every(row => row.selected);
  }

  // Armazena as linhas parseadas para uso posterior na confirmação
  let _importParsedRows = [];

  function showImportWarnings() {
    const warnings = GastoProImporter.getLastWarnings();
    if (warnings.length) showToast(warnings.join(' '));
    return warnings.length > 0;
  }

  function prepareImportRows(rows) {
    const templates = FinanceData.getTemplates();
    _importParsedRows = GastoProImporter.markDuplicates(rows, FinanceData.getEntries())
      .map(row => {
        if (row.type === 'fixed' || row.type === 'debt') {
          const duplicate = GastoProImporter.isTemplateDuplicate(row, templates);
          return { ...row, duplicate, selected: !row.invalid && !duplicate };
        }
        if (row.duplicate || row.invalid || !row.installment) return row;
        const template = GastoProImporter.matchDebtTemplate(row, templates);
        return template ? { ...row, linkedTemplateId: template.id } : row;
      });
    const hadWarnings = showImportWarnings();
    renderImportPreview(_importParsedRows);
    return hadWarnings;
  }

  /** Lê o arquivo selecionado e faz o parse. */
  async function handleCsvParse() {
    if (!csvFileInput || !csvFileInput.files || !csvFileInput.files[0]) {
      showToast('Selecione um arquivo antes de analisar.');
      return;
    }
    const file = csvFileInput.files[0];
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    if (file.size > (isPdf ? 10_000_000 : 1_000_000)) {
      showToast(isPdf ? 'O PDF excede 10 MB.' : 'O arquivo deve ter no máximo 1 MB.');
      return;
    }
    const pdfReadingStatus = document.getElementById('pdfReadingStatus');
    if (pdfReadingStatus) pdfReadingStatus.hidden = !isPdf;
    try {
      const rows = await GastoProImporter.parseFile(file);
      const hadWarnings = prepareImportRows(rows);
      if (_importParsedRows.length > 0 && !hadWarnings) {
        showToast(`${_importParsedRows.length} lançamentos encontrados no arquivo!`);
      }
    } catch (err) {
      console.error('[GastoPro Importer] Erro ao ler o arquivo:', err);
      showToast('Erro ao ler o arquivo. Verifique o formato.');
    } finally {
      if (pdfReadingStatus) pdfReadingStatus.hidden = true;
    }
  }

  /** Lê o texto bruto da textarea e faz o parse. */
  function handleTextParse() {
    const text = importRawTextarea ? importRawTextarea.value : '';
    if (!text.trim()) {
      showToast('Cole o texto do extrato antes de analisar.');
      return;
    }
    if (text.length > 200_000) {
      showToast('O texto colado excede 200.000 caracteres.');
      return;
    }
    try {
      const hadWarnings = prepareImportRows(GastoProImporter.parseRawText(text));
      if (_importParsedRows.length > 0 && !hadWarnings) {
        showToast(`${_importParsedRows.length} lançamentos encontrados!`);
      }
    } catch (err) {
      console.error('[GastoPro Importer] Erro ao parsear texto:', err);
      showToast('Erro ao interpretar o texto. Verifique o formato.');
    }
  }

  /**
   * Confirma a importação e grava os itens selecionados em um único lote.
   * Lê os valores atuais de categoria e tipo diretamente da tabela de preview
   * para respeitar as edições feitas pelo usuário antes de confirmar.
   */
  async function handleConfirmImport() {
    if (!importPreviewTbody || _importParsedRows.length === 0) return;

    const checkboxes = importPreviewTbody.querySelectorAll('.import-row-check');
    const catSelects  = importPreviewTbody.querySelectorAll('.import-cat-select');
    const typeSelects = importPreviewTbody.querySelectorAll('.import-type-select');

    const items = [];
    const debtItems = [];
    const launches = [];
    const payments = [];
    checkboxes.forEach((cb, i) => {
      if (!cb.checked || _importParsedRows[i].invalid) return;

      const row      = _importParsedRows[i];
      const category = catSelects[i]  ? catSelects[i].value  : row.category;
      const type     = typeSelects[i] ? typeSelects[i].value : 'variable';

      if (type === 'fixed' || type === 'debt') {
        debtItems.push(GastoProImporter.buildEntry({ ...row, category }, type));
        return;
      }

      if (type === 'variable_pending') {
        launches.push(GastoProImporter.buildEntry({ ...row, category }, 'variable', false));
        return;
      }

      if ((type === 'variable' || type === 'income') && row.installment && row.linkedTemplateId) {
        payments.push({ id: row.linkedTemplateId, ym: row.date.substring(0, 7) });
        return;
      }

      if ((type === 'variable' || type === 'income') && row.installment) {
        const installmentCheckbox = importPreviewTbody.querySelector(
          `.import-installment-check[data-row="${i}"]`
        );
        if (installmentCheckbox && installmentCheckbox.checked) {
          debtItems.push(GastoProImporter.buildInstallmentDebt(row, category));
          return;
        }
      }

      const entry = GastoProImporter.buildEntry(
        { ...row, category },
        type
      );

      launches.push(entry);
    });

    items.push(...debtItems, ...launches);
    if (items.length > 0 || payments.length > 0) {
      try {
        const result = items.length ? await FinanceData.addMany(items) : null;
        if (result && !result.success) {
          showToast(result.syncResult
            ? 'Os lançamentos foram salvos neste aparelho, mas a sincronização ficou pendente.'
            : 'Não foi possível salvar os lançamentos importados neste aparelho.');
          return;
        }
        if (payments.length) {
          const paid = await FinanceData.markPaidMany(payments);
          if (!paid.success) {
            showToast('Não foi possível concluir a importação. Tente novamente.');
            renderAll();
            closeImportModal();
            return;
          }
        }
        const debtCount = debtItems.length;
        const paymentCount = payments.length;
        const launchCount = launches.length;
        showToast(
          `${debtCount} conta${debtCount === 1 ? '' : 's'} a pagar criada${debtCount === 1 ? '' : 's'}, ` +
          `${paymentCount} baixa${paymentCount === 1 ? '' : 's'} registrada${paymentCount === 1 ? '' : 's'} e ` +
          `${launchCount} lançamento${launchCount === 1 ? '' : 's'} importado${launchCount === 1 ? '' : 's'} com sucesso!`
        );
        renderAll();
        closeImportModal(true);
      } catch (err) {
        console.error('[GastoPro Importer] Erro ao salvar os lançamentos:', err);
        showToast('Não foi possível concluir a importação. Tente novamente.');
      }
    } else {
      showToast('Selecione ao menos um lançamento para importar.');
    }
  }

  // ── Event Listeners do modal de importação ────────────────────

  // Abrir modal
  if (sidebarImportBtn) sidebarImportBtn.addEventListener('click', openImportModal);

  // Fechar modal
  if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);
  if (cancelImportBtn)     cancelImportBtn.addEventListener('click', closeImportModal);

  // Fechar ao clicar no overlay
  if (importModal) {
    importModal.addEventListener('click', (e) => {
      if (e.target === importModal) closeImportModal();
    });
  }

  // Troca de abas
  if (importTabCsvBtn)  importTabCsvBtn.addEventListener('click',  () => switchImportTab('csv'));
  if (importTabTextBtn) importTabTextBtn.addEventListener('click', () => switchImportTab('text'));

  // Feedback visual de arquivo selecionado no drop zone
  if (csvFileInput) {
    csvFileInput.addEventListener('change', () => {
      const file = csvFileInput.files && csvFileInput.files[0];
      if (file && csvDropZone) {
        csvDropZone.classList.add('csv-file-selected');
        document.getElementById('csvDropIcon').className = 'fa-solid fa-file-circle-check drop-icon';
        document.getElementById('csvDropTitle').textContent = file.name;
        document.getElementById('csvDropSub').textContent   = `${(file.size / 1024).toFixed(1)} KB — pronto para analisar`;
      }
    });
  }

  // Drag and drop no drop zone
  if (csvDropZone) {
    csvDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      csvDropZone.classList.add('drag-over');
    });
    csvDropZone.addEventListener('dragleave', () => {
      csvDropZone.classList.remove('drag-over');
    });
    csvDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      csvDropZone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file && csvFileInput) {
        // Transfere o arquivo para o input via DataTransfer
        const dt = new DataTransfer();
        dt.items.add(file);
        csvFileInput.files = dt.files;
        csvFileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Botões de parse
  if (parseCsvBtn)   parseCsvBtn.addEventListener('click',   handleCsvParse);
  if (parseTextBtn)  parseTextBtn.addEventListener('click',  handleTextParse);

  // Selecionar/deselecionar todos
  if (importSelectAll) {
    importSelectAll.addEventListener('change', () => {
      const checkboxes = importPreviewTbody
        ? importPreviewTbody.querySelectorAll('.import-row-check')
        : [];
      const duplicateCount = importSelectAll.checked
        ? _importParsedRows.filter(row => row.duplicate && !row.invalid).length
        : 0;
      checkboxes.forEach(cb => {
        if (cb.disabled) return;
        const row = _importParsedRows[Number(cb.dataset.row)];
        cb.checked = importSelectAll.checked && !row.duplicate;
      });
      if (importDuplicateSelectionNote) {
        importDuplicateSelectionNote.hidden = duplicateCount === 0;
        importDuplicateSelectionNote.textContent = duplicateCount === 1
          ? '1 possível duplicado ficou desmarcado.'
          : duplicateCount > 1
            ? `${duplicateCount} possíveis duplicados ficaram desmarcados.`
            : '';
      }
    });
  }


  // Confirmar importação
  if (confirmImportBtn) confirmImportBtn.addEventListener('click', async () => {
    if (importSaving) return;
    const previousCancelDisabled = cancelImportBtn.disabled;
    const previousCloseDisabled = closeImportModalBtn.disabled;
    await withSaving(confirmImportBtn, async () => {
      importSaving = true;
      cancelImportBtn.disabled = true;
      closeImportModalBtn.disabled = true;
      try {
        await handleConfirmImport();
      } finally {
        importSaving = false;
        cancelImportBtn.disabled = previousCancelDisabled;
        closeImportModalBtn.disabled = previousCloseDisabled;
      }
    });
  });


  // ── 14. MÓDULO WIZARD DE LANÇAMENTO RÁPIDO ───────────────────
  // Fluxo guiado em 4 passos: Renda → Fixos → Variáveis → Resultado
  // Salva todos os lançamentos em lote ao finalizar.
  // ─────────────────────────────────────────────────────────────

  /**
   * Estado interno do Wizard.
   * Acumulado durante a navegação e persistido apenas ao finalizar.
   */
  let wizardState = {
    step: 1,              // Passo atual (1–4)
    incomes: [],          // { desc, amount, date }
    fixedChecked: [],     // IDs dos templates fixos marcados para baixa
    fixedNew: [],         // { desc, amount } → novos gastos fixos digitados
    varItems: {},         // { category: amount } → categorias com valor
    varCustom: [],        // { desc, amount } → gastos variáveis avulsos
  };

  /** Categorias do Passo 3 — variáveis por categoria */
  const WIZARD_VAR_CATEGORIES = [
    ...GastoProCategories.EXPENSE.map(name => ({
      name,
      icon: categoryIcons[name] || '📦'
    }))
  ];

  // Referências dos elementos do Wizard
  const wizardModal        = document.getElementById('wizardModal');
  const sidebarWizardBtn   = document.getElementById('sidebarWizardBtn');
  const closeWizardBtn     = document.getElementById('closeWizardBtn');
  const wizardNextBtn      = document.getElementById('wizardNextBtn');
  const wizardBackBtn      = document.getElementById('wizardBackBtn');

  // Passo 1 — Renda
  const wizardIncomeList   = document.getElementById('wizardIncomeList');
  const wIncomeDesc        = document.getElementById('wIncomeDesc');
  const wIncomeAmount      = document.getElementById('wIncomeAmount');
  const wIncomeDate        = document.getElementById('wIncomeDate');
  const wAddIncomeBtn      = document.getElementById('wAddIncomeBtn');

  // Passo 2 — Fixos
  const wizardFixedChecklist = document.getElementById('wizardFixedChecklist');
  const wizardFixedList      = document.getElementById('wizardFixedList');
  const wFixedDesc           = document.getElementById('wFixedDesc');
  const wFixedAmount         = document.getElementById('wFixedAmount');
  const wAddFixedBtn         = document.getElementById('wAddFixedBtn');

  // Passo 3 — Variáveis
  const wizardCategoryGrid = document.getElementById('wizardCategoryGrid');
  const wizardVarList      = document.getElementById('wizardVarList');
  const wVarDesc           = document.getElementById('wVarDesc');
  const wVarAmount         = document.getElementById('wVarAmount');
  const wAddVarBtn         = document.getElementById('wAddVarBtn');

  // Passo 4 — Resultado
  const wResIncome         = document.getElementById('wResIncome');
  const wResExpense        = document.getElementById('wResExpense');
  const wResBalance        = document.getElementById('wResBalance');
  const wRulePctFixed      = document.getElementById('wRulePctFixed');
  const wRulePctVar        = document.getElementById('wRulePctVar');
  const wRulePctSave       = document.getElementById('wRulePctSave');
  const wRuleBarFixed      = document.getElementById('wRuleBarFixed');
  const wRuleBarVar        = document.getElementById('wRuleBarVar');
  const wRuleBarSave       = document.getElementById('wRuleBarSave');
  const wizardResultEmoji  = document.getElementById('wizardResultEmoji');
  const wizardResultTitle  = document.getElementById('wizardResultTitle');
  const wizardResultSubtitle = document.getElementById('wizardResultSubtitle');
  const wizardDiagnosisBanner = document.getElementById('wizardDiagnosisBanner');
  const wizardDiagnosisIcon   = document.getElementById('wizardDiagnosisIcon');
  const wizardDiagnosisText   = document.getElementById('wizardDiagnosisText');

  // Stepper elementos
  const wStep1 = document.getElementById('wStep1');
  const wStep2 = document.getElementById('wStep2');
  const wStep3 = document.getElementById('wStep3');
  const wStep4 = document.getElementById('wStep4');
  const wLine1 = document.getElementById('wLine1');
  const wLine2 = document.getElementById('wLine2');
  const wLine3 = document.getElementById('wLine3');
  const wDot1  = document.getElementById('wDot1');
  const wDot2  = document.getElementById('wDot2');
  const wDot3  = document.getElementById('wDot3');
  const wDot4  = document.getElementById('wDot4');

  /** Abre o wizard e reseta para o passo 1. */
  function openWizard() {
    if (!wizardModal) return;
    resetWizardState();
    wizardModal.classList.add('active');
    goToWizardStep(1, 'forward');
    closeMobileSidebar();
  }

  /** Fecha o wizard. */
  function closeWizard() {
    if (!wizardModal) return;
    wizardModal.classList.remove('active');
  }

  /** Reseta o estado interno do wizard. */
  function resetWizardState() {
    wizardState = {
      step: 1,
      incomes: [],
      fixedChecked: [],
      fixedNew: [],
      varItems: {},
      varCustom: [],
    };
  }

  /**
   * Navega para um passo específico do wizard.
   * @param {number} step - Número do passo (1–4).
   * @param {'forward'|'back'} direction - Direção de animação.
   */
  function goToWizardStep(step, direction = 'forward') {
    wizardState.step = step;

    // Atualiza stepper visual
    const steps = [wStep1, wStep2, wStep3, wStep4];
    const lines  = [wLine1, wLine2, wLine3];
    const dots   = [wDot1, wDot2, wDot3, wDot4];

    steps.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active');
    });

    lines.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('done', 'active-line');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active-line');
    });

    dots.forEach((el, i) => {
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i + 1 < step) el.classList.add('done');
      if (i + 1 === step) el.classList.add('active');
    });

    // Mostra/esconde painéis
    ['wPanel1', 'wPanel2', 'wPanel3', 'wPanel4'].forEach((id, i) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.classList.remove('active', 'animate-back');
      if (i + 1 === step) {
        panel.classList.add('active');
        if (direction === 'back') panel.classList.add('animate-back');
      }
    });

    // Botão Voltar
    if (wizardBackBtn) wizardBackBtn.style.display = step > 1 ? 'flex' : 'none';

    // Botão Avançar / Finalizar
    if (wizardNextBtn) {
      if (step === 4) {
        wizardNextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar tudo';
        wizardNextBtn.classList.add('finish');
      } else {
        wizardNextBtn.innerHTML = 'Avançar <i class="fa-solid fa-arrow-right"></i>';
        wizardNextBtn.classList.remove('finish');
      }
    }

    // Renderiza conteúdo do passo
    if (step === 1) renderWizardStep1();
    if (step === 2) renderWizardStep2();
    if (step === 3) renderWizardStep3();
    if (step === 4) renderWizardStep4();
  }

  // ── Passo 1: Renda ──────────────────────────────────────────

  /** Renderiza a lista de rendas adicionadas. */
  function renderWizardStep1() {
    if (!wizardIncomeList) return;
    wizardIncomeList.innerHTML = '';

    if (wizardState.incomes.length === 0) {
      wizardIncomeList.innerHTML = '<p class="wizard-empty-state"><i class="fa-solid fa-circle-info" style="margin-right:0.4rem"></i>Nenhuma renda adicionada ainda.</p>';
    } else {
      wizardState.incomes.forEach((item, idx) => {
        const card = document.createElement('div');
        card.className = 'wizard-item-card';
        card.innerHTML = `
          <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
          <span class="wizard-item-date">${item.date ? item.date.split('-').reverse().join('/') : ''}</span>
          <span class="wizard-item-amount">${formatCurrency(item.amount)}</span>
          <button class="btn-wizard-remove" data-idx="${idx}" title="Remover" aria-label="Remover renda ${escapeHtml(item.desc)}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
          wizardState.incomes.splice(idx, 1);
          renderWizardStep1();
        });
        wizardIncomeList.appendChild(card);
      });
    }

    // Inicializa data com o dia atual
    if (wIncomeDate && !wIncomeDate.value) {
      const ym = getYearMonthString(state.currentYear, state.currentMonth);
      wIncomeDate.value = `${ym}-01`;
    }
  }

  /** Adiciona uma renda ao estado do wizard. */
  function handleWizardAddIncome() {
    const desc   = (wIncomeDesc   ? wIncomeDesc.value.trim()          : '');
    const amount = (wIncomeAmount ? parseFloat(wIncomeAmount.value)   : 0);
    const date   = (wIncomeDate   ? wIncomeDate.value                 : '');

    if (!desc) { showToast('Informe a descrição da renda.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.incomes.push({ desc, amount, date: date || null });
    if (wIncomeDesc)   wIncomeDesc.value   = '';
    if (wIncomeAmount) wIncomeAmount.value = '';
    if (wIncomeDate)   wIncomeDate.value   = '';
    renderWizardStep1();
    if (wIncomeDesc) wIncomeDesc.focus();
  }

  // ── Passo 2: Fixos ──────────────────────────────────────────

  /** Renderiza checklist de gastos fixos existentes + lista de novos. */
  function renderWizardStep2() {
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    const allTemplates = FinanceData.getTemplates().filter(t =>
      t.type === 'fixed' && t.active !== false
    );

    // Checklist dos fixos existentes
    if (wizardFixedChecklist) {
      wizardFixedChecklist.innerHTML = '';
      if (allTemplates.length === 0) {
        wizardFixedChecklist.innerHTML = '<p class="wizard-empty-state">Nenhum gasto fixo cadastrado ainda.</p>';
      } else {
        allTemplates.forEach(t => {
          const isChecked = wizardState.fixedChecked.includes(t.id);
          const item = document.createElement('label');
          item.className = 'wizard-check-item';
          item.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} data-id="${escapeHtml(t.id)}" />
            <span class="wizard-check-item-desc">${escapeHtml(t.desc)}</span>
            <span class="wizard-check-item-amount">${formatCurrency(t.amount)}</span>
          `;
          const cb = item.querySelector('input');
          cb.addEventListener('change', () => {
            if (cb.checked) {
              if (!wizardState.fixedChecked.includes(t.id)) wizardState.fixedChecked.push(t.id);
            } else {
              wizardState.fixedChecked = wizardState.fixedChecked.filter(id => id !== t.id);
            }
          });
          wizardFixedChecklist.appendChild(item);
        });
      }
    }

    // Lista de novos fixos adicionados nesta sessão
    renderWizardFixedNewList();
  }

  /** Renderiza lista de novos gastos fixos adicionados no wizard. */
  function renderWizardFixedNewList() {
    if (!wizardFixedList) return;
    wizardFixedList.innerHTML = '';
    wizardState.fixedNew.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'wizard-item-card';
      card.innerHTML = `
        <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
        <span class="wizard-item-amount expense">${formatCurrency(item.amount)}</span>
        <button class="btn-wizard-remove" data-idx="${idx}" title="Remover" aria-label="Remover gasto fixo ${escapeHtml(item.desc)}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
        wizardState.fixedNew.splice(idx, 1);
        renderWizardFixedNewList();
      });
      wizardFixedList.appendChild(card);
    });
  }

  /** Adiciona um novo gasto fixo ao wizard. */
  function handleWizardAddFixed() {
    const desc   = (wFixedDesc   ? wFixedDesc.value.trim()          : '');
    const amount = (wFixedAmount ? parseFloat(wFixedAmount.value)   : 0);

    if (!desc)   { showToast('Informe a descrição do gasto fixo.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.fixedNew.push({ desc, amount });
    if (wFixedDesc)   wFixedDesc.value   = '';
    if (wFixedAmount) wFixedAmount.value = '';
    renderWizardFixedNewList();
    if (wFixedDesc) wFixedDesc.focus();
  }

  // ── Passo 3: Variáveis ──────────────────────────────────────

  /** Renderiza o grid de categorias variáveis. */
  function renderWizardStep3() {
    if (!wizardCategoryGrid) return;
    wizardCategoryGrid.innerHTML = '';

    WIZARD_VAR_CATEGORIES.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'wizard-cat-card';
      card.innerHTML = `
        <div class="wizard-cat-top">
          <span class="wizard-cat-icon">${cat.icon}</span>
          <span class="wizard-cat-name">${escapeHtml(cat.name)}</span>
        </div>
        <input
          type="number"
          class="wizard-cat-input"
          aria-label="Valor para ${escapeHtml(cat.name)}"
          placeholder="R$ 0,00"
          min="0"
          step="0.01"
          value="${wizardState.varItems[cat.name] > 0 ? wizardState.varItems[cat.name] : ''}"
          data-cat="${cat.name}"
        />
      `;
      const input = card.querySelector('.wizard-cat-input');
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        wizardState.varItems[cat.name] = (isNaN(val) || val <= 0) ? 0 : val;
      });
      wizardCategoryGrid.appendChild(card);
    });

    // Lista de gastos avulsos
    renderWizardVarList();
  }

  /** Renderiza a lista de gastos variáveis avulsos. */
  function renderWizardVarList() {
    if (!wizardVarList) return;
    wizardVarList.innerHTML = '';
    wizardState.varCustom.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'wizard-item-card';
      card.innerHTML = `
        <span class="wizard-item-desc">${escapeHtml(item.desc)}</span>
        <span class="wizard-item-amount expense">${formatCurrency(item.amount)}</span>
        <button class="btn-wizard-remove" data-idx="${idx}" title="Remover" aria-label="Remover gasto variável ${escapeHtml(item.desc)}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      card.querySelector('.btn-wizard-remove').addEventListener('click', () => {
        wizardState.varCustom.splice(idx, 1);
        renderWizardVarList();
      });
      wizardVarList.appendChild(card);
    });
  }

  /** Adiciona um gasto variável avulso. */
  function handleWizardAddVar() {
    const desc   = (wVarDesc   ? wVarDesc.value.trim()          : '');
    const amount = (wVarAmount ? parseFloat(wVarAmount.value)   : 0);

    if (!desc)   { showToast('Informe a descrição do gasto.'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.'); return; }

    wizardState.varCustom.push({ desc, amount });
    if (wVarDesc)   wVarDesc.value   = '';
    if (wVarAmount) wVarAmount.value = '';
    renderWizardVarList();
    if (wVarDesc) wVarDesc.focus();
  }

  // ── Passo 4: Resultado / Diagnóstico ────────────────────────

  /** Calcula totais e renderiza o diagnóstico 50/30/20. */
  function renderWizardStep4() {
    const totalIncome = wizardState.incomes.reduce((s, i) => s + i.amount, 0);

    // Total de fixos: checados existentes + novos
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    const templates = FinanceData.getTemplates();
    const checkedFixedAmt = wizardState.fixedChecked.reduce((s, id) => {
      const t = templates.find(x => x.id === id);
      return s + (t ? t.amount : 0);
    }, 0);
    const newFixedAmt = wizardState.fixedNew.reduce((s, i) => s + i.amount, 0);
    const totalFixed = checkedFixedAmt + newFixedAmt;

    // Total de variáveis: grid + avulsos
    const catAmt = Object.values(wizardState.varItems).reduce((s, v) => s + (v || 0), 0);
    const customAmt = wizardState.varCustom.reduce((s, i) => s + i.amount, 0);
    const totalVar = catAmt + customAmt;

    const totalExpense = totalFixed + totalVar;
    const balance = totalIncome - totalExpense;

    // KPIs
    if (wResIncome)  wResIncome.textContent  = formatCurrency(totalIncome);
    if (wResExpense) wResExpense.textContent  = formatCurrency(totalExpense);
    if (wResBalance) wResBalance.textContent  = formatCurrency(balance);

    // Percentuais 50/30/20
    const pctFixed = totalIncome > 0 ? Math.round((totalFixed / totalIncome) * 100) : 0;
    const pctVar   = totalIncome > 0 ? Math.round((totalVar   / totalIncome) * 100) : 0;
    const pctSave  = totalIncome > 0 ? Math.round((balance    / totalIncome) * 100) : 0;

    if (wRulePctFixed) wRulePctFixed.textContent = `${pctFixed}%`;
    if (wRulePctVar)   wRulePctVar.textContent   = `${pctVar}%`;
    if (wRulePctSave)  wRulePctSave.textContent  = `${Math.max(0, pctSave)}%`;

    // Barras animadas (pequeno timeout para garantir animação)
    setTimeout(() => {
      if (wRuleBarFixed) {
        wRuleBarFixed.style.width = `${Math.min(pctFixed, 100)}%`;
        wRuleBarFixed.classList.toggle('over-limit', pctFixed > 50);
      }
      if (wRuleBarVar) {
        wRuleBarVar.style.width = `${Math.min(pctVar, 100)}%`;
        wRuleBarVar.classList.toggle('over-limit', pctVar > 30);
      }
      if (wRuleBarSave) {
        wRuleBarSave.style.width = `${Math.min(Math.max(pctSave, 0), 100)}%`;
        wRuleBarSave.classList.toggle('over-limit', pctSave < 0);
      }
    }, 80);

    // Diagnóstico
    const isGood = pctFixed <= 50 && pctVar <= 30 && pctSave >= 20;
    const isWarn = !isGood && balance >= 0;
    const isDanger = balance < 0;

    if (wizardResultEmoji) wizardResultEmoji.textContent   = isDanger ? '⚠️' : isWarn ? '🤔' : '🎉';
    if (wizardResultTitle) wizardResultTitle.textContent   = isDanger ? 'Atenção!' : isWarn ? 'Quase lá!' : 'Parabéns!';
    if (wizardResultSubtitle) wizardResultSubtitle.textContent = isDanger
      ? 'Seus gastos superam sua renda. Revise os valores.'
      : isWarn
      ? 'Orçamento positivo, mas ainda fora da regra 50/30/20.'
      : 'Seu orçamento está dentro da regra 50/30/20!';

    if (wizardDiagnosisBanner) {
      wizardDiagnosisBanner.className = 'wizard-diagnosis-banner' + (isDanger ? ' danger' : isWarn ? ' warning' : '');
    }
    if (wizardDiagnosisIcon) {
      wizardDiagnosisIcon.className = isDanger
        ? 'fa-solid fa-triangle-exclamation'
        : isWarn
        ? 'fa-solid fa-circle-exclamation'
        : 'fa-solid fa-circle-check';
    }
    if (wizardDiagnosisText) {
      wizardDiagnosisText.textContent = isDanger
        ? `Déficit de ${formatCurrency(Math.abs(balance))} — corte gastos ou adicione renda.`
        : isWarn
        ? `Sobra ${formatCurrency(balance)} (${pctSave}%). Meta: ≥ 20% da renda.`
        : `Sobra ${formatCurrency(balance)} (${pctSave}%) para investir ou poupar. 🚀`;
    }
  }

  // ── Salvar em lote ──────────────────────────────────────────

  /**
   * Persiste todos os dados coletados no wizard:
   * rendas, baixa de fixos existentes, novos fixos e variáveis.
   */
  async function handleWizardFinish() {
    const ym = getYearMonthString(state.currentYear, state.currentMonth);
    let saved = 0;

    // 1. Salvar rendas
    wizardState.incomes.forEach(item => {
      const dateStr = item.date || `${ym}-01`;
      FinanceData.add({
        type:     'income',
        desc:     item.desc,
        amount:   item.amount,
        category: 'Receita',
        date:     dateStr,
        month:    dateStr.substring(0, 7),
        paid:     true,
      });
      saved++;
    });

    // 2. Registrar baixa dos fixos marcados no mês atual
    wizardState.fixedChecked.forEach(id => {
      FinanceData.togglePaid(id, ym);
      saved++;
    });

    // 3. Salvar novos gastos fixos (templates)
    wizardState.fixedNew.forEach(item => {
      FinanceData.add({
        type:       'fixed',
        desc:       item.desc,
        amount:     item.amount,
        category:   'Moradia',
        isDebt:     false,
        active:     true,
        startMonth: ym,
        endMonth:   null,
        day:        '01',
      });
      saved++;
    });

    // 4. Salvar gastos variáveis por categoria
    WIZARD_VAR_CATEGORIES.forEach(cat => {
      const amount = wizardState.varItems[cat.name];
      if (amount && amount > 0) {
        FinanceData.add({
          type:     'variable',
          desc:     cat.name,
          amount:   amount,
          category: cat.name,
          date:     `${ym}-01`,
          month:    ym,
          paid:     false,
        });
        saved++;
      }
    });

    // 5. Salvar gastos variáveis avulsos
    wizardState.varCustom.forEach(item => {
      FinanceData.add({
        type:     'variable',
        desc:     item.desc,
        amount:   item.amount,
        category: GastoProImporter ? GastoProImporter.autoDetectCategory(item.desc) : 'Outros',
        date:     `${ym}-01`,
        month:    ym,
        paid:     false,
      });
      saved++;
    });

    if (saved > 0) {
      renderAll();
      const syncResult = await waitForAuthenticatedSave();
      if (syncResult.success) {
        showToast(`✅ ${saved} lançamento${saved > 1 ? 's' : ''} salvo${saved > 1 ? 's' : ''} com sucesso!`);
      } else {
        showToast('Os lançamentos foram salvos neste aparelho, mas a sincronização ficou pendente.');
      }
    } else {
      showToast('Nenhum dado foi informado para salvar.');
    }

    closeWizard();
  }

  // ── Navegação ────────────────────────────────────────────────

  /** Avança para o próximo passo ou finaliza. */
  async function handleWizardNext() {
    const step = wizardState.step;

    if (step === 1) {
      if (wizardState.incomes.length === 0) {
        showToast('Adicione ao menos uma fonte de renda antes de avançar.');
        return;
      }
      goToWizardStep(2, 'forward');

    } else if (step === 2) {
      goToWizardStep(3, 'forward');

    } else if (step === 3) {
      goToWizardStep(4, 'forward');

    } else if (step === 4) {
      await withSaving(wizardNextBtn, async () => {
        try {
          await handleWizardFinish();
        } catch (error) {
          console.error('[GastoPro] Erro ao salvar o lançamento rápido:', error);
          showToast(error.message || 'Não foi possível salvar o lançamento rápido.');
        }
      });
    }
  }

  /** Volta para o passo anterior. */
  function handleWizardBack() {
    if (wizardState.step > 1) goToWizardStep(wizardState.step - 1, 'back');
  }

  // ── Event Listeners do Wizard ────────────────────────────────

  if (sidebarWizardBtn) sidebarWizardBtn.addEventListener('click', openWizard);
  if (closeWizardBtn)   closeWizardBtn.addEventListener('click',   closeWizard);
  if (wizardNextBtn)    wizardNextBtn.addEventListener('click',    handleWizardNext);
  if (wizardBackBtn)    wizardBackBtn.addEventListener('click',    handleWizardBack);

  // Fechar ao clicar no overlay
  if (wizardModal) {
    wizardModal.addEventListener('click', (e) => {
      if (e.target === wizardModal) closeWizard();
    });
  }

  // Botões de adicionar item
  if (wAddIncomeBtn) wAddIncomeBtn.addEventListener('click', handleWizardAddIncome);
  if (wAddFixedBtn)  wAddFixedBtn.addEventListener('click',  handleWizardAddFixed);
  if (wAddVarBtn)    wAddVarBtn.addEventListener('click',    handleWizardAddVar);

  // Enter nos inputs de renda
  [wIncomeDesc, wIncomeAmount, wIncomeDate].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddIncome(); });
  });

  // Enter nos inputs de fixos
  [wFixedDesc, wFixedAmount].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddFixed(); });
  });

  // Enter nos inputs de variáveis
  [wVarDesc, wVarAmount].forEach(el => {
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardAddVar(); });
  });


  // Pull-to-refresh para telas touch em smartphones / PWA
  let touchStartY = 0;
  let isAtTop = false;

  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 5) {
      isAtTop = true;
      touchStartY = e.touches[0].clientY;
    } else {
      isAtTop = false;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (isAtTop && !isRefreshing) {
      const touchEndY = e.changedTouches[0].clientY;
      const pullDistance = touchEndY - touchStartY;
      if (pullDistance > 90) {
        handleAppRefresh();
      }
    }
    isAtTop = false;
  }, { passive: true });

  // ── 15. Modal de Política de Privacidade (LGPD) ──────────────
  // Abre a partir do footer, drawer ou link no formulário de cadastro

  const privacyPolicyModal    = document.getElementById('privacyPolicyModal');
  const closePrivacyModalBtn  = document.getElementById('closePrivacyModalBtn');
  const closePrivacyModalOkBtn = document.getElementById('closePrivacyModalOkBtn');
  const footerPrivacyLink     = document.getElementById('footerPrivacyLink');
  const drawerPrivacyLink     = document.getElementById('drawerPrivacyLink');
  const openPrivacyPolicyBtn  = document.getElementById('openPrivacyPolicyBtn');

  function openPrivacyModal(e) {
    if (e) e.preventDefault();
    if (privacyPolicyModal) privacyPolicyModal.classList.add('active');
  }

  function closePrivacyModal() {
    if (privacyPolicyModal) privacyPolicyModal.classList.remove('active');
  }

  if (footerPrivacyLink)    footerPrivacyLink.addEventListener('click',    openPrivacyModal);
  if (drawerPrivacyLink)    drawerPrivacyLink.addEventListener('click',    openPrivacyModal);
  if (openPrivacyPolicyBtn) openPrivacyPolicyBtn.addEventListener('click', openPrivacyModal);
  if (closePrivacyModalBtn) closePrivacyModalBtn.addEventListener('click', closePrivacyModal);
  if (closePrivacyModalOkBtn) closePrivacyModalOkBtn.addEventListener('click', closePrivacyModal);

  // Fechar ao clicar no overlay
  if (privacyPolicyModal) {
    privacyPolicyModal.addEventListener('click', (e) => {
      if (e.target === privacyPolicyModal) closePrivacyModal();
    });
  }

  // ── Inicialização: renderiza perfil e interface ao carregar ───
  let sessionInitializationPromise = null;
  async function initializeAuthenticatedView() {
    if (sessionInitializationPromise) return sessionInitializationPromise;
    sessionInitializationPromise = (async () => {
      let user = null;
      const localUserId = localStorage.getItem('gastopro_last_uid');
      try {
        const sessionState = window.SupabaseAuth
          ? await window.SupabaseAuth.getSessionState()
          : { status: 'indeterminate' };
        if (sessionState.status === 'authenticated') {
          user = sessionState.user;
          const profile = await prepareAuthenticatedUser(user);
          if (!profile) user = null;
        } else if (sessionState.status === 'indeterminate') {
          if (localUserId) {
            console.warn('[GastoPro] Sessão indeterminada; os dados locais foram preservados.');
            showToast('Não foi possível verificar a sessão. Seus dados locais foram preservados.');
          }
        } else if (sessionState.status === 'signed_out') {
          const action = window.GastoProSessionHelpers.getSignedOutAction(
            Boolean(localUserId),
            FinanceData.hasPendingSync()
          );
          if (action === 'clear' && window.GastoProSessionHelpers.shouldClearLocalData(
            sessionState.status,
            localUserId,
            FinanceData.hasPendingSync()
          )) {
            clearUserSessionData();
          } else if (action === 'preserve-and-login') {
            openAuth('login');
            showAuthAlert('Sua sessão expirou e há alterações não sincronizadas neste aparelho. Entre novamente na mesma conta para sincronizá-las.');
          }
        }
      } catch (e) {
        console.warn('[GastoPro] Falha ao restaurar sessão; os dados locais foram preservados:', e);
        if (localUserId) {
          showToast('Não foi possível verificar a sessão. Seus dados locais foram preservados.');
        }
      }

      renderUserProfile();
      if (user) await refreshAdminBadge();
      else resetAdminSession();

      const restoredView = window.GastoProViewHelpers.restore(
        readStoredMainView(),
        user ? user.id : null,
        adminViewState.access === 'allowed'
      );
      document.body.classList.remove('auth-checking');
      window.switchToView(restoredView);
      if (user) await syncUserDataFromCloud(user.id);
    })();
    try {
      return await sessionInitializationPromise;
    } finally {
      sessionInitializationPromise = null;
    }
  }

  initializeAuthenticatedView().catch(e => {
    console.error('[GastoPro] Falha ao inicializar a sessão:', e);
    document.body.classList.remove('auth-checking');
  });

  // ── 12. Registro do Service Worker (PWA) ─────────────────────
  // Permite instalação como app e funcionamento offline.
  // A falha é esperada quando o app é aberto via file:// (sem servidor),
  // então é tratada silenciosamente para não poluir o console do usuário.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.info('[GastoPro] Service Worker não registrado (normal em file://):', err.message);
    });
  }

  // ── 13. Metas por Categoria — Event Listeners ─────────────────
  initGoalModalListeners();
  initOnboarding();
});

// ================================================================
// METAS POR CATEGORIA — RENDERIZAÇÃO
// ================================================================

/**
 * Calcula o gasto atual de cada categoria e renderiza os cards
 * de metas com barras de progresso coloridas e alertas visuais.
 *
 * @param {Array} fixed     - Gastos fixos ativos do mês.
 * @param {Array} variables - Gastos variáveis do mês.
 */
function calculateGoalProgress(goals, fixed, variables) {
  const spendingMap = {};
  [...fixed, ...variables].forEach(item => {
    const category = item.category || 'Outros';
    const key = GastoProCategories.normalize(category);
    spendingMap[key] = (spendingMap[key] || 0) + (Number(item.amount) || 0);
  });

  return goals.map(goal => {
    const spent = spendingMap[GastoProCategories.normalize(goal.category)] || 0;
    const percentage = goal.limit > 0 ? (spent / goal.limit) * 100 : 0;
    const isDanger = percentage >= 100;
    const isWarning = percentage >= 80 && !isDanger;
    return {
      ...goal,
      spent,
      percentage,
      percentageLabel: Math.floor(percentage * 10) / 10,
      isDanger,
      isWarning,
      status: isDanger ? 'Limite ultrapassado!' : isWarning ? 'Atenção: 80% atingido' : 'Dentro do limite'
    };
  });
}

window.GastoProReportHelpers.calculateGoalProgress = calculateGoalProgress;

function renderGoalsSection(fixed, variables) {
  const container  = document.getElementById('goalsListContainer');
  const emptyState = document.getElementById('goalsEmptyState');
  if (!container) return;

  const goals = FinanceData.getGoals();

  if (goals.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Renderiza os cards
  const progress = calculateGoalProgress(goals, fixed, variables);
  container.innerHTML = progress.map(goal => {
    const pctShow = Math.min(100, goal.percentage);
    const isDanger = goal.isDanger;
    const isWarning = goal.isWarning;

    // Define cor e status conforme percentual
    let barClass   = 'goal-bar-fill--safe';
    let statusIcon = '<i class="fa-solid fa-circle-check"></i>';
    let statusClass = 'goal-status--safe';
    let statusText  = 'Dentro do limite';

    if (isDanger) {
      barClass    = 'goal-bar-fill--danger';
      statusIcon  = '<i class="fa-solid fa-circle-exclamation"></i>';
      statusClass = 'goal-status--danger';
      statusText  = `🔴 ${goal.status}`;
    } else if (isWarning) {
      barClass    = 'goal-bar-fill--warning';
      statusIcon  = '<i class="fa-solid fa-triangle-exclamation"></i>';
      statusClass = 'goal-status--warning';
      statusText  = `⚠️ ${goal.status}`;
    }

    return `
      <div class="goal-card ${isDanger ? 'goal-card--danger' : isWarning ? 'goal-card--warning' : ''}" data-goal-category="${escapeHtml(goal.category)}">
        <div class="goal-card-header">
          <div class="goal-card-title">
            <span class="goal-category-name">${escapeHtml(goal.category)}</span>
            <span class="goal-status ${statusClass}">${statusIcon} ${statusText}</span>
          </div>
          <button class="goal-edit-btn" data-action="edit-goal" data-id="${escapeHtml(goal.category)}" title="Editar meta">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        <div class="goal-amounts">
          <span class="goal-spent">${formatCurrency(goal.spent)}</span>
          <span class="goal-separator">de</span>
          <span class="goal-limit">${formatCurrency(goal.limit)}</span>
          <span class="goal-pct-badge ${isDanger ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-success'}">${goal.percentageLabel}%</span>
        </div>
        <div class="goal-bar-track">
          <div class="goal-bar-fill ${barClass}" style="width: ${pctShow}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ================================================================
// METAS POR CATEGORIA — MODAL
// ================================================================

/**
 * Abre o modal de meta.
 * Se passado category, pré-preenche para edição; caso contrário, cria nova.
 *
 * @param {string} [category] - Categoria da meta a editar (opcional).
 */
window.openGoalModal = function(category) {
  const modal      = document.getElementById('goalModal');
  const title      = document.getElementById('goalModalTitle');
  const catSelect  = document.getElementById('goalCategorySelect');
  const limitInput = document.getElementById('goalLimitInput');
  const removeBtn  = document.getElementById('removeGoalBtn');

  catSelect.querySelectorAll('[data-legacy="true"]').forEach(option => option.remove());

  if (category) {
    // Modo edição: preenche com valores da meta existente
    const goals     = FinanceData.getGoals();
    const existing  = goals.find(g => g.category === category);
    if (!Array.from(catSelect.options).some(option => option.value === category)) {
      const legacyOption = document.createElement('option');
      legacyOption.value = category;
      legacyOption.textContent = category;
      legacyOption.dataset.legacy = 'true';
      catSelect.appendChild(legacyOption);
    }
    title.innerHTML = '<i class="fa-solid fa-bullseye"></i> Editar Meta de Gasto';
    if (!Array.from(catSelect.options).some(option => option.value === category)) {
      const legacyOption = document.createElement('option');
      legacyOption.value = category;
      legacyOption.textContent = category;
      legacyOption.dataset.legacy = 'true';
      catSelect.appendChild(legacyOption);
    }
    catSelect.value  = category;
    catSelect.disabled = true; // Categoria não pode mudar na edição
    limitInput.value = existing ? existing.limit : '';
    removeBtn.style.display = 'inline-flex';
  } else {
    // Modo criação
    title.innerHTML  = '<i class="fa-solid fa-bullseye"></i> Nova Meta de Gasto';
    catSelect.value  = '';
    catSelect.disabled = false;
    limitInput.value = '';
    removeBtn.style.display = 'none';
  }

  modal.classList.add('active');
  setTimeout(() => limitInput.focus(), 100);
};

/**
 * Fecha o modal de metas e reseta o estado.
 */
function closeGoalModal() {
  const modal     = document.getElementById('goalModal');
  const catSelect = document.getElementById('goalCategorySelect');
  if (modal)     modal.classList.remove('active');
  if (catSelect) catSelect.disabled = false;
}

/**
 * Inicializa todos os event listeners do modal de metas.
 */
function initGoalModalListeners() {
  const openBtn    = document.getElementById('openGoalModalBtn');
  const closeBtn   = document.getElementById('closeGoalModalBtn');
  const cancelBtn  = document.getElementById('cancelGoalModalBtn');
  const saveBtn    = document.getElementById('saveGoalBtn');
  const removeBtn  = document.getElementById('removeGoalBtn');
  const modal      = document.getElementById('goalModal');

  if (openBtn)   openBtn.addEventListener('click',  () => openGoalModal());
  if (closeBtn)  closeBtn.addEventListener('click',  closeGoalModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeGoalModal);

  // Fecha ao clicar no overlay
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeGoalModal();
    });
  }

  // Salvar meta
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const category = document.getElementById('goalCategorySelect').value.trim();
      const limit    = parseFloat(document.getElementById('goalLimitInput').value);

      if (!category) {
        showToast('⚠️ Selecione uma categoria antes de salvar.');
        return;
      }
      if (!limit || limit <= 0) {
        showToast('⚠️ Informe um valor de limite válido (maior que zero).');
        return;
      }

      await withSaving(saveBtn, async () => {
        try {
          FinanceData.saveGoal(category, limit);
          const syncResult = await waitForAuthenticatedSave();
          closeGoalModal();
          renderAll();
          if (syncResult.success) showToast(`✅ Meta de ${category}: ${formatCurrency(limit)} salva!`);
        } catch (error) {
          console.error('[GastoPro] Erro ao salvar meta:', error);
          showToast(error.message || 'Não foi possível salvar a meta.');
        }
      });
    });
  }

  // Remover meta
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const category = document.getElementById('goalCategorySelect').value;
      if (!category) return;
      FinanceData.deleteGoal(category);
      closeGoalModal();
      renderAll();
      showToast(`🗑️ Meta de ${category} removida.`);
    });
  }
}
