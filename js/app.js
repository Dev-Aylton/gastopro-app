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

let returnToImportAfterAccountModal = false;
let importAccountCreatedId = null;
let accountOnboardingDataReady = false;
let firstEntryAccountRequest = null;
let mobileBottomSelection = 'home';

if (document.getElementById('incomeForm') && document.getElementById('expenseForm')) {
  FinanceData.requireExplicitAccount = true;
}

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
  },

  shouldNavigateToDashboard(event, previousUserId, userId, activatedUser) {
    if (event === 'INITIAL_SESSION') {
      return !previousUserId || previousUserId === userId || activatedUser;
    }
    return Boolean(activatedUser && previousUserId && previousUserId !== userId);
  }
};

const INSTALL_CARD_VISITS_KEY = 'gastopro_install_card_visits_v1';
const INSTALL_CARD_DISMISSED_KEY = 'gastopro_install_card_dismissed_v1';

function decideInstallCard({
  isMobile, standalone, visitCount, dismissed, onboardingOpen, userAgent, canPromptInstall
}) {
  if (!isMobile || standalone || visitCount < 2 || dismissed || onboardingOpen) return null;
  const agent = String(userAgent || '');
  if (/Android/i.test(agent)) return canPromptInstall ? 'android' : null;
  if (!/iPhone|iPod/i.test(agent) ||
    /(CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram|Line\/|LinkedInApp|WhatsApp|TikTok)/i.test(agent) ||
    !/Safari/i.test(agent)) return null;
  return 'ios';
}

function recordInstallCardVisit(storage) {
  const storedCount = Number.parseInt(storage.getItem(INSTALL_CARD_VISITS_KEY) || '0', 10);
  const visitCount = Number.isSafeInteger(storedCount) && storedCount >= 0 ? storedCount + 1 : 1;
  storage.setItem(INSTALL_CARD_VISITS_KEY, String(visitCount));
  return visitCount;
}

function dismissInstallCard(storage) {
  storage.setItem(INSTALL_CARD_DISMISSED_KEY, 'true');
}

window.GastoProInstallCardHelpers = Object.freeze({
  decide: decideInstallCard,
  recordVisit: recordInstallCardVisit,
  dismiss: dismissInstallCard,
  visitsKey: INSTALL_CARD_VISITS_KEY,
  dismissedKey: INSTALL_CARD_DISMISSED_KEY
});

window.GastoProProfileHelpers = {
  getGoogleAvatarUrl(user) {
    const isGoogleUser = Boolean(
      user && (
        user.app_metadata && user.app_metadata.provider === 'google' ||
        Array.isArray(user.identities) && user.identities.some(identity => identity.provider === 'google')
      )
    );
    if (!isGoogleUser || !user.user_metadata) return '';
    const metadata = user.user_metadata;
    for (const candidate of [metadata.avatar_url, metadata.picture]) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue;
      try {
        const url = new URL(candidate.trim());
        if (url.protocol === 'https:' &&
          (url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) {
          return url.href;
        }
      } catch (error) {
        continue;
      }
    }
    return '';
  },
  getInitialName(localName, cloudName, metadataName, emailPrefix) {
    return (typeof localName === 'string' && localName.trim()) ||
      (typeof cloudName === 'string' && cloudName.trim()) ||
      (typeof metadataName === 'string' && metadataName.trim()) ||
      emailPrefix || '';
  },
  getGoogleMetadataName(user) {
    const isGoogleUser = Boolean(
      user && (
        user.app_metadata && user.app_metadata.provider === 'google' ||
        Array.isArray(user.identities) && user.identities.some(identity => identity.provider === 'google')
      )
    );
    if (!isGoogleUser || !user.user_metadata) return '';
    const metadata = user.user_metadata;
    return (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
      (typeof metadata.name === 'string' && metadata.name.trim()) ||
      '';
  }
};

const PROFILE_AVATAR_PRESETS = Object.freeze([
  { id: 'neutral-default', label: 'Avatar padrão' },
  { id: 'feminine-default', label: 'Avatar feminino' }
]);

function getProfileAvatarPreset(value) {
  if (typeof value !== 'string' || !value.startsWith('preset:')) return null;
  return PROFILE_AVATAR_PRESETS.find(preset => `preset:${preset.id}` === value) || null;
}

function withProfileAvatarPreset(profile, value) {
  const preset = getProfileAvatarPreset(value);
  if (!preset) throw new Error('Avatar predefinido inválido.');
  return { ...profile, avatar: value, avatarPreset: value };
}

function withProfileAvatarPhoto(profile, photo) {
  if (typeof photo !== 'string' || !photo.startsWith('data:image/')) {
    throw new Error('Foto de perfil inválida.');
  }
  const selectedPreset = getProfileAvatarPreset(profile.avatar)
    ? profile.avatar
    : (getProfileAvatarPreset(profile.avatarPreset) ? profile.avatarPreset : 'preset:neutral-default');
  return { ...profile, avatar: photo, avatarPreset: selectedPreset };
}

function withoutProfileAvatarPhoto(profile) {
  const preset = getProfileAvatarPreset(profile.avatarPreset);
  const avatar = preset ? `preset:${preset.id}` : 'preset:neutral-default';
  return { ...profile, avatar, avatarPreset: avatar };
}

function withGoogleProfileAvatar(profile, user) {
  const updatedProfile = { ...profile };
  const currentAvatar = typeof updatedProfile.avatar === 'string'
    ? updatedProfile.avatar.trim()
    : '';
  if (currentAvatar) return updatedProfile;
  const avatarUrl = window.GastoProProfileHelpers.getGoogleAvatarUrl(user);
  if (!avatarUrl) return updatedProfile;
  const preset = getProfileAvatarPreset(updatedProfile.avatarPreset);
  const defaultPreset = preset ? `preset:${preset.id}` : 'preset:neutral-default';
  return { ...updatedProfile, avatar: avatarUrl, avatarPreset: defaultPreset };
}

window.GastoProAvatarGallery = Object.freeze({
  presets: PROFILE_AVATAR_PRESETS,
  isPreset: value => Boolean(getProfileAvatarPreset(value)),
  selectPreset: withProfileAvatarPreset,
  savePhoto: withProfileAvatarPhoto,
  removePhoto: withoutProfileAvatarPhoto,
  applyGoogleAvatar: withGoogleProfileAvatar,
  setImageSource(image, value, fallbackPreset) {
    if (!image) return;
    const fallback = getProfileAvatarPreset(fallbackPreset);
    const fallbackSource = fallback && fallback.id === 'feminine-default'
      ? 'assets/default_avatar_fem.jpg'
      : 'assets/default_avatar.jpg';
    const source = this.getSource(value);
    image.referrerPolicy = 'no-referrer';
    image.onerror = null;
    if (source !== fallbackSource && source.startsWith('https://')) {
      image.onerror = () => {
        image.onerror = null;
        image.src = fallbackSource;
      };
    }
    image.src = source;
  },
  getSource(value) {
    const preset = getProfileAvatarPreset(value);
    if (preset || typeof value !== 'string' || !value || value.startsWith('preset:')) {
      return preset && preset.id === 'feminine-default'
        ? 'assets/default_avatar_fem.jpg'
        : 'assets/default_avatar.jpg';
    }
    if (value.startsWith('data:image/')) return value;
    return window.GastoProProfileHelpers.getGoogleAvatarUrl({
      app_metadata: { provider: 'google' },
      user_metadata: { avatar_url: value }
    }) || 'assets/default_avatar.jpg';
  }
});

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
const DISMISSED_INSIGHTS_KEY = 'gastopro_dismissed_insights_v1';

function loadDismissedInsights() {
  try {
    const stored = localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some(key => typeof key !== 'string')) {
      throw new Error('Formato inválido para insights dispensados.');
    }
    return new Set(parsed);
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler insights dispensados:', error);
    return new Set();
  }
}

function saveDismissedInsights() {
  try {
    localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify([...state.dismissedInsights]));
    return true;
  } catch (error) {
    console.warn('[GastoPro] Não foi possível salvar insights dispensados:', error);
    return false;
  }
}

function clearDismissedInsights() {
  state.dismissedInsights.clear();
  try {
    localStorage.removeItem(DISMISSED_INSIGHTS_KEY);
    return true;
  } catch (error) {
    console.warn('[GastoPro] Não foi possível limpar insights dispensados:', error);
    return false;
  }
}

function dismissInsight(key) {
  if (typeof key !== 'string' || !key) return false;
  state.dismissedInsights.add(key);
  return saveDismissedInsights();
}

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
  dismissedInsights: loadDismissedInsights(),
  chartInstance: null                     // Instância ativa do Chart.js (para destruir antes de recriar)
};

window.GastoProInsightDismissal = {
  KEY: DISMISSED_INSIGHTS_KEY,
  restore() {
    state.dismissedInsights = loadDismissedInsights();
    return new Set(state.dismissedInsights);
  },
  dismiss: dismissInsight,
  isDismissed: key => state.dismissedInsights.has(key),
  clear: clearDismissedInsights
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

const adminUnreadFeedbackIds = new Set();
const adminFeedbackReadRequests = new Set();

const adminAnalyticsState = {
  data: null,
  userList: null,
  userListLoading: false,
  userListUnavailable: false,
  userListError: '',
  selectedMonth: '',
  loading: false,
  reloadAfterCurrent: false,
  error: '',
  requestId: 0,
  activeTab: 'analytics',
  growthChart: null,
  importsChart: null
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
  entries:   'Lançamentos',
  incomes:   'Gerenciador de Ganhos do Mês',
  expenses:  'Gerenciador de Gastos do Mês',
  loans:     'Empréstimos',
  cards:     'Cartões',
  accounts:  'Contas',
  contact:   'Fale comigo',
  admin:     'Admin'
};

const DIAGNOSTIC_LOG_KEY = 'gastopro_diagnostic_log_v1';
const DIAGNOSTIC_LOG_LIMIT = 100;
const DIAGNOSTIC_VISIBLE_KEY = 'gastopro_diag_visible';
const DIAGNOSTIC_EVENT_TYPES = new Set([
  'auth-state', 'view-switch', 'page-load', 'pageshow', 'visibilitychange',
  'focus', 'online', 'offline', 'sync', 'refresh', 'controllerchange', 'admin-check',
  'admin-query-error', 'app-update-notice', 'pending-sync-failure', 'submit-no-effect',
  'sync-failure'
]);
const SYNC_FAILURE_CATEGORIES = new Set([
  'sessao', 'rede', 'conflito', 'rpc', 'resposta_incompleta', 'merge',
  'preparacao_local', 'excecao'
]);
const DIAGNOSTIC_VIEW_IDS = new Set(Object.keys(VIEW_TITLES));
const DIAGNOSTIC_ALLOWED_DATA_KEYS = Object.freeze({
  'auth-state': ['event', 'previousUidPresent', 'uidEqualsPrevious', 'activation'],
  'view-switch': ['from', 'to', 'dashboard', 'stack'],
  'page-load': ['navigationType'],
  pageshow: ['persisted'],
  visibilitychange: ['state'],
  focus: [],
  online: [],
  offline: [],
  sync: ['phase', 'source', 'result'],
  refresh: ['phase', 'result'],
  controllerchange: [],
  'admin-check': ['phase', 'result', 'buttonVisibleBefore', 'buttonVisibleAfter'],
  'admin-query-error': ['query', 'code', 'message'],
  'app-update-notice': [],
  'pending-sync-failure': ['category', 'operationType', 'errorCode'],
  'submit-no-effect': ['category', 'fieldId'],
  'sync-failure': ['category', 'status', 'code']
});

function getLocalDiagnosticTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeDiagnosticData(type, data) {
  const allowedKeys = DIAGNOSTIC_ALLOWED_DATA_KEYS[type];
  if (!allowedKeys || !data || typeof data !== 'object') return {};
  const normalized = {};
  allowedKeys.forEach(key => {
    const value = data[key];
    if (key === 'event') {
      if (typeof value === 'string' && /^[A-Z_]{1,40}$/.test(value)) normalized[key] = value;
    } else if (key === 'previousUidPresent' || key === 'activation' ||
      key === 'dashboard' || key === 'persisted' ||
      key === 'buttonVisibleBefore' || key === 'buttonVisibleAfter') {
      if (typeof value === 'boolean') normalized[key] = value;
    } else if (key === 'uidEqualsPrevious' &&
      ['yes', 'no', 'without-previous'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'from' || key === 'to') {
      normalized[key] = DIAGNOSTIC_VIEW_IDS.has(value) ? value : 'unknown';
    } else if (key === 'stack' && Array.isArray(value)) {
      normalized[key] = value
        .filter(line => typeof line === 'string' && /^[\w.-]+\.js:\d+$/.test(line))
        .slice(0, 6);
    } else if (key === 'navigationType' &&
      ['navigate', 'reload', 'back_forward'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'state' && ['hidden', 'visible'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'phase' && ['start', 'end'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'source' && ['automatic', 'realtime', 'manual'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'result' &&
      ['success', 'failure', 'admin', 'not-admin', 'error'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'query' &&
      ['admin_feedback_authors', 'admin_list_users', 'feedback_messages.select',
        'feedback_messages.count_unread', 'feedback_messages.mark_read'].includes(value)) {
      normalized[key] = value;
    } else if (type === 'sync-failure' && key === 'category' &&
      SYNC_FAILURE_CATEGORIES.has(value)) {
      normalized[key] = value;
    } else if (type === 'sync-failure' && key === 'status' &&
      Number.isInteger(value) && value >= 100 && value <= 599) {
      normalized[key] = value;
    } else if (type === 'sync-failure' && key === 'code' &&
      typeof value === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(value)) {
      normalized[key] = value;
    } else if (key === 'category' &&
      ['entries', 'templates', 'goals', 'accounts', 'creditCards', 'creditCardPurchases',
        'profile', 'rules', 'transactional', 'reconciliation', 'session', 'unknown',
        'submit sem efeito: ganho', 'submit sem efeito: gasto', 'submit sem efeito: empréstimo'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'fieldId' &&
      typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value)) {
      normalized[key] = value;
    } else if (key === 'operationType' &&
      ['import', 'deleteAccount', 'unknown'].includes(value)) {
      normalized[key] = value;
    } else if (key === 'errorCode' && value === 'PENDING_SYNC_FAILED') {
      normalized[key] = value;
    } else if (key === 'code' &&
      typeof value === 'string' && /^[A-Z0-9]{1,16}$/.test(value)) {
      normalized[key] = value;
    } else if (key === 'message' && typeof value === 'string') {
      normalized[key] = 'Falha na consulta.';
    }
  });
  return normalized;
}

window.GastoProDiagnostics = {
  key: DIAGNOSTIC_LOG_KEY,

  record(type, data = {}) {
    try {
      if (!DIAGNOSTIC_EVENT_TYPES.has(type)) return;
      const entries = this.list();
      entries.push({
        time: getLocalDiagnosticTime(),
        type,
        view: DIAGNOSTIC_VIEW_IDS.has(state.currentView) ? state.currentView : 'unknown',
        data: normalizeDiagnosticData(type, data)
      });
      localStorage.setItem(DIAGNOSTIC_LOG_KEY, JSON.stringify(entries.slice(-DIAGNOSTIC_LOG_LIMIT)));
      if (diagnosticDetails && diagnosticDetails.open) renderDiagnosticLog();
    } catch {
      // O registro é diagnóstico local e nunca deve interromper o app.
    }
  },

  list() {
    try {
      const stored = localStorage.getItem(DIAGNOSTIC_LOG_KEY);
      if (!stored) return [];
      const entries = JSON.parse(stored);
      if (!Array.isArray(entries)) return [];
      return entries.filter(entry => entry && typeof entry === 'object' &&
        typeof entry.time === 'string' && DIAGNOSTIC_EVENT_TYPES.has(entry.type) &&
        typeof entry.view === 'string' && entry.data && typeof entry.data === 'object')
        .map(entry => ({
          time: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(entry.time)
            ? entry.time
            : getLocalDiagnosticTime(),
          type: entry.type,
          view: DIAGNOSTIC_VIEW_IDS.has(entry.view) ? entry.view : 'unknown',
          data: normalizeDiagnosticData(entry.type, entry.data)
        }))
        .slice(-DIAGNOSTIC_LOG_LIMIT);
    } catch {
      return [];
    }
  },

  clear() {
    try {
      localStorage.removeItem(DIAGNOSTIC_LOG_KEY);
      return true;
    } catch {
      return false;
    }
  },

  formatEntry(entry) {
    return `${entry.time} | ${entry.type} | tela: ${entry.view} | ${JSON.stringify(entry.data)}`;
  }
};

function getSyncFailureStatus(error) {
  const contextStatus = error && error.context && error.context.status;
  const status = error && (error.status || error.statusCode || contextStatus);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function getSyncFailureCode(error) {
  const code = error && error.code;
  return typeof code === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(code) ? code : null;
}

function classifySyncFailure(error, fallbackCategory = 'excecao') {
  const status = getSyncFailureStatus(error);
  const code = getSyncFailureCode(error);
  if (status === 401 || status === 403 || code === '42501') return 'sessao';
  if (status === 409 || ['23505', '40001'].includes(code)) return 'conflito';
  if (code && (/^PGRST\d+$/.test(code) || code === 'P0001')) return 'rpc';

  const message = error && typeof error.message === 'string'
    ? error.message.toLowerCase()
    : '';
  if (error && (navigator.onLine === false || error.name === 'TypeError' ||
    /failed to fetch|network|offline|connection|fetch failed|load failed|econn|etimedout/.test(message) ||
    code && /^(ECONN|ETIMEDOUT|ENET)/.test(code))) {
    return 'rede';
  }
  return SYNC_FAILURE_CATEGORIES.has(fallbackCategory) ? fallbackCategory : 'excecao';
}

function recordSyncFailureDiagnostic(fallbackCategory, error) {
  const category = classifySyncFailure(error, fallbackCategory);
  const data = { category };
  const status = getSyncFailureStatus(error);
  const code = getSyncFailureCode(error);
  if (status !== null) data.status = status;
  if (code) data.code = code;
  window.GastoProDiagnostics.record('sync-failure', data);
}

function createDiagnosticVisibilityController(options = {}) {
  let visible = options.initialVisible === true;
  let tapCount = 0;
  let sequenceStartedAt = null;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const persist = typeof options.persist === 'function' ? options.persist : () => {};
  const notify = typeof options.notify === 'function' ? options.notify : () => {};

  return Object.freeze({
    get visible() {
      return visible;
    },
    handleTap() {
      const currentTime = now();
      if (sequenceStartedAt === null || currentTime - sequenceStartedAt > 4000) {
        tapCount = 0;
        sequenceStartedAt = currentTime;
      }
      tapCount += 1;
      if (tapCount < 7) return false;

      tapCount = 0;
      sequenceStartedAt = null;
      visible = !visible;
      persist(visible);
      notify(visible);
      return true;
    }
  });
}

window.GastoProSyncDiagnostics = Object.freeze({
  recordFailure: recordSyncFailureDiagnostic
});

window.GastoProDiagnosticsVisibilityHelpers = Object.freeze({
  createController: createDiagnosticVisibilityController
});

const SUBMIT_DIAGNOSTIC_CATEGORIES = Object.freeze({
  income: 'submit sem efeito: ganho',
  expense: 'submit sem efeito: gasto',
  loan: 'submit sem efeito: empréstimo'
});

function reportSubmitNoEffect(formType, message, fieldId = null) {
  const category = SUBMIT_DIAGNOSTIC_CATEGORIES[formType];
  if (!category) throw new TypeError('Formulário de lançamento inválido.');
  const data = fieldId ? { category, fieldId } : { category };
  window.GastoProDiagnostics.record('submit-no-effect', data);
  showToast(message, 'error');
}

function bindSubmitValidationFeedback(form, formType) {
  if (!form || !SUBMIT_DIAGNOSTIC_CATEGORIES[formType]) return false;
  if (form.dataset.submitValidationFeedbackBound === 'true') return true;

  let noticeScheduled = false;
  let invalidField = null;
  form.addEventListener('invalid', event => {
    if (noticeScheduled) return;
    noticeScheduled = true;
    invalidField = event.target;
    window.setTimeout(() => {
      noticeScheduled = false;
      const field = invalidField;
      invalidField = null;
      if (!field) return;
      const hidden = field.hidden || Boolean(field.closest('[hidden]')) ||
        window.getComputedStyle(field).display === 'none' || field.getClientRects().length === 0;
      if (hidden) {
        reportSubmitNoEffect(
          formType,
          'Não foi possível enviar: há um campo obrigatório oculto.',
          field.id || null
        );
        return;
      }
      const label = Array.from(field.labels || [])
        .map(item => item.textContent.trim())
        .find(Boolean) || field.getAttribute('aria-label') || field.id || 'campo obrigatório';
      const formLabel = formType === 'income'
        ? 'o ganho'
        : formType === 'loan'
          ? 'o empréstimo'
          : 'o gasto';
      reportSubmitNoEffect(
        formType,
        `Não foi possível enviar ${formLabel}. Campo inválido: ${label}.`
      );
    }, 0);
  }, true);
  form.dataset.submitValidationFeedbackBound = 'true';
  return true;
}

window.GastoProSubmitFeedback = Object.freeze({
  report: reportSubmitNoEffect,
  bindValidation: bindSubmitValidationFeedback
});

function renderDiagnosticLog() {
  const list = document.getElementById('diagnosticLogList');
  if (!list) return;
  list.replaceChildren();
  const entries = window.GastoProDiagnostics.list().reverse();
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'diagnostic-log-empty';
    empty.textContent = 'Nenhum evento registrado.';
    list.appendChild(empty);
    return;
  }
  entries.forEach(entry => {
    const item = document.createElement('li');
    item.className = 'diagnostic-log-entry';
    const heading = document.createElement('strong');
    heading.textContent = `${entry.time} · ${entry.type} · ${entry.view}`;
    const details = document.createElement('pre');
    details.textContent = JSON.stringify(entry.data, null, 2);
    item.append(heading, details);
    list.appendChild(item);
  });
}

const diagnosticDetails = document.getElementById('diagnosticDetails');
const diagnosticCopyButton = document.getElementById('diagnosticCopyButton');
const diagnosticClearButton = document.getElementById('diagnosticClearButton');
const diagnosticStatus = document.getElementById('diagnosticStatus');

if (diagnosticDetails) {
  let diagnosticsVisible = false;
  try {
    diagnosticsVisible = localStorage.getItem(DIAGNOSTIC_VISIBLE_KEY) === 'true';
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler a preferência local de diagnóstico:', error);
  }
  const visibilityController = createDiagnosticVisibilityController({
    initialVisible: diagnosticsVisible,
    persist(visible) {
      try {
        localStorage.setItem(DIAGNOSTIC_VISIBLE_KEY, String(visible));
      } catch (error) {
        console.error('[GastoPro] Não foi possível salvar a preferência local de diagnóstico:', error);
      }
    },
    notify(visible) {
      showToast(`Diagnóstico ${visible ? 'ativado' : 'desativado'}`);
    }
  });
  diagnosticDetails.hidden = !diagnosticsVisible;
  if (!diagnosticsVisible) diagnosticDetails.open = false;
  document.querySelectorAll('.badge-version').forEach(badge => {
    badge.addEventListener('click', () => {
      if (!visibilityController.handleTap()) return;
      diagnosticDetails.hidden = !visibilityController.visible;
      if (!visibilityController.visible) diagnosticDetails.open = false;
    });
  });
  diagnosticDetails.addEventListener('toggle', () => {
    if (diagnosticDetails.open) renderDiagnosticLog();
  });
}
if (diagnosticCopyButton) {
  diagnosticCopyButton.addEventListener('click', async () => {
    const text = window.GastoProDiagnostics.list()
      .slice()
      .reverse()
      .map(entry => window.GastoProDiagnostics.formatEntry(entry))
      .join('\n');
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard indisponível.');
      }
      await navigator.clipboard.writeText(text);
      if (diagnosticStatus) diagnosticStatus.textContent = 'Registro copiado.';
    } catch {
      if (diagnosticStatus) diagnosticStatus.textContent = 'Não foi possível copiar neste navegador.';
    }
  });
}
if (diagnosticClearButton) {
  diagnosticClearButton.addEventListener('click', () => {
    const cleared = window.GastoProDiagnostics.clear();
    renderDiagnosticLog();
    if (diagnosticStatus) {
      diagnosticStatus.textContent = cleared
        ? 'Registro apagado.'
        : 'Não foi possível apagar o registro neste aparelho.';
    }
  });
}

let pageNavigationType = 'navigate';
try {
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  if (navigationEntry && ['navigate', 'reload', 'back_forward'].includes(navigationEntry.type)) {
    pageNavigationType = navigationEntry.type;
  }
} catch {
  // A disponibilidade de Navigation Timing varia entre navegadores.
}
window.GastoProDiagnostics.record('page-load', { navigationType: pageNavigationType });
window.addEventListener('pageshow', event => {
  window.GastoProDiagnostics.record('pageshow', { persisted: event.persisted === true });
});
document.addEventListener('visibilitychange', () => {
  window.GastoProDiagnostics.record('visibilitychange', {
    state: document.visibilityState === 'hidden' ? 'hidden' : 'visible'
  });
});
window.addEventListener('focus', () => window.GastoProDiagnostics.record('focus'));
window.addEventListener('online', () => window.GastoProDiagnostics.record('online'));
window.addEventListener('offline', () => window.GastoProDiagnostics.record('offline'));
try {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.GastoProDiagnostics.record('controllerchange');
    });
  }
} catch {
  // Service Worker APIs are not available in every browsing context.
}

const LAST_VIEW_STORAGE_KEY = 'gastopro_last_view_v1';
const PERSISTED_VIEW_IDS = Object.freeze(Object.keys(VIEW_TITLES));
const APP_RELOAD_STATE_KEY = 'gastopro_app_reload_state_v1';
const USER_CONSENT_STORAGE_PREFIX = 'gastopro_user_consents_v1';
const USER_CONSENT_TEXT_VERSION = '2026-11-01-v1';
const PAYMENT_METHOD_PREFERENCE_KEY = 'gastopro_payment_method_preference_v1';
const PAYMENT_METHOD_OPTIONS = Object.freeze({
  expense: Object.freeze([
    Object.freeze({ value: 'pix', label: 'Pix' }),
    Object.freeze({ value: 'debit', label: 'Débito' }),
    Object.freeze({ value: 'cash', label: 'Dinheiro' }),
    Object.freeze({ value: 'credit_card', label: 'Cartão de crédito' }),
    Object.freeze({ value: 'boleto', label: 'Boleto' }),
    Object.freeze({ value: 'transfer', label: 'Transferência' }),
    Object.freeze({ value: 'other', label: 'Outro' })
  ]),
  income: Object.freeze([
    Object.freeze({ value: 'pix', label: 'Pix' }),
    Object.freeze({ value: 'transfer', label: 'Transferência' }),
    Object.freeze({ value: 'cash', label: 'Dinheiro' }),
    Object.freeze({ value: 'other', label: 'Outro' })
  ])
});

function populatePaymentMethodSelect(select, kind, includeUnspecified = false) {
  if (!select || !PAYMENT_METHOD_OPTIONS[kind]) return;
  const previousValue = select.value;
  select.replaceChildren();
  if (includeUnspecified) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Não informado';
    select.appendChild(option);
  }
  PAYMENT_METHOD_OPTIONS[kind].forEach(method => {
    const option = document.createElement('option');
    option.value = method.value;
    option.textContent = method.label;
    select.appendChild(option);
  });
  if ([...select.options].some(option => option.value === previousValue)) {
    select.value = previousValue;
  }
}

function isPaidByPaymentMethod(paymentMethod, date, today = getLocalDateString()) {
  return ['pix', 'debit', 'cash', 'transfer'].includes(paymentMethod) &&
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date <= today;
}

function getPaymentMethodLabel(paymentMethod) {
  const method = Object.values(PAYMENT_METHOD_OPTIONS).flat()
    .find(option => option.value === paymentMethod);
  return method ? method.label : 'Não informado';
}

function renderPaymentMethodBadge(paymentMethod) {
  const label = getPaymentMethodLabel(paymentMethod);
  return label === 'Não informado'
    ? ''
    : `<span class="tag-badge transaction-payment-method-chip">${escapeHtml(label)}</span>`;
}

function getPaymentMethodPreferenceKey(kind) {
  const profile = FinanceData.getProfile();
  const ownerId = FinanceData.getActiveUserId() || profile.userId || 'local';
  return `${PAYMENT_METHOD_PREFERENCE_KEY}:${ownerId}:${kind}`;
}

function getPaymentMethodPreference(kind) {
  try {
    const stored = localStorage.getItem(getPaymentMethodPreferenceKey(kind));
    return PAYMENT_METHOD_OPTIONS[kind].some(option => option.value === stored)
      ? stored
      : kind === 'expense' ? 'cash' : 'pix';
  } catch (error) {
    console.error('[GastoPro] Não foi possível ler a forma de pagamento preferida:', error);
    return kind === 'expense' ? 'cash' : 'pix';
  }
}

function savePaymentMethodPreference(kind, paymentMethod) {
  if (!PAYMENT_METHOD_OPTIONS[kind].some(option => option.value === paymentMethod)) {
    throw new TypeError('A forma de pagamento não é válida para este lançamento.');
  }
  try {
    localStorage.setItem(getPaymentMethodPreferenceKey(kind), paymentMethod);
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar a forma de pagamento preferida:', error);
    throw error;
  }
}

window.GastoProPaymentHelpers = {
  isPaidByPaymentMethod,
  getLabel: getPaymentMethodLabel,
  renderBadge: renderPaymentMethodBadge,
  getOptions: kind => (PAYMENT_METHOD_OPTIONS[kind] || []).map(option => option.value),
  populateSelect: populatePaymentMethodSelect,
  getPreference: getPaymentMethodPreference,
  savePreference: savePaymentMethodPreference,
  updateCreditCardPurchaseFields,
  updateAccountSelects
};

function getConsentStorageKey(userId = getConsentUserId()) {
  return `${USER_CONSENT_STORAGE_PREFIX}:${userId || 'local'}`;
}

function getConsentUserId() {
  if (typeof FinanceData === 'undefined') return null;
  const profile = FinanceData.getProfile();
  return FinanceData.getActiveUserId() || profile.userId || null;
}

function normalizeConsentState(value) {
  const consent = value && typeof value === 'object' ? value : {};
  return {
    adminVisibility: consent.adminVisibility === true,
    telemetryEnabled: consent.telemetryEnabled === true,
    textVersion: typeof consent.textVersion === 'string' ? consent.textVersion : USER_CONSENT_TEXT_VERSION,
    acceptedAt: typeof consent.acceptedAt === 'string' ? consent.acceptedAt : null,
    revokedAt: typeof consent.revokedAt === 'string' ? consent.revokedAt : null,
    updatedAt: typeof consent.updatedAt === 'string' ? consent.updatedAt : null,
    pendingSync: consent.pendingSync === true
  };
}

function readConsentState(key = getConsentStorageKey()) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? normalizeConsentState(JSON.parse(stored)) : normalizeConsentState(null);
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler as preferências de privacidade:', error);
    return normalizeConsentState(null);
  }
}

function writeConsentState(consent, key = getConsentStorageKey()) {
  try {
    const normalized = normalizeConsentState(consent);
    normalized.updatedAt = normalized.updatedAt || new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(normalized));
    updateConsentSyncStatus(normalized);
    return normalized;
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar as preferências de privacidade:', error);
    throw error;
  }
}

function updateConsentSyncStatus(consent = readConsentState()) {
  const status = document.getElementById('privacySyncStatus');
  if (!status) return;
  status.hidden = !getConsentUserId() || consent.pendingSync !== true;
}

function getConsentStateForUser(user) {
  const userKey = getConsentStorageKey(user.id);
  try {
    const stored = localStorage.getItem(userKey);
    if (stored) return { state: normalizeConsentState(JSON.parse(stored)), key: userKey };
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    const pendingKey = email
      ? `${USER_CONSENT_STORAGE_PREFIX}:pending:${encodeURIComponent(email)}`
      : '';
    const pending = pendingKey ? localStorage.getItem(pendingKey) : null;
    return pending
      ? { state: normalizeConsentState(JSON.parse(pending)), key: pendingKey }
      : { state: null, key: userKey };
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler preferências pendentes de privacidade:', error);
    return { state: null, key: userKey };
  }
}

function storePendingConsent(email, consent) {
  if (typeof email !== 'string' || !email.trim()) throw new TypeError('O e-mail da conta é necessário.');
  const key = `${USER_CONSENT_STORAGE_PREFIX}:pending:${encodeURIComponent(email.trim().toLowerCase())}`;
  return writeConsentState({ ...consent, pendingSync: true }, key);
}

function removePendingConsent(email) {
  if (typeof email !== 'string' || !email.trim()) return;
  const key = `${USER_CONSENT_STORAGE_PREFIX}:pending:${encodeURIComponent(email.trim().toLowerCase())}`;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[GastoPro] Não foi possível limpar o consentimento pendente:', error);
  }
}

function createConsentState(adminVisibility, telemetryEnabled, previous = null) {
  const now = new Date().toISOString();
  const hasConsent = adminVisibility || telemetryEnabled;
  const newlyAccepted = previous && (
    adminVisibility && !previous.adminVisibility ||
    telemetryEnabled && !previous.telemetryEnabled
  );
  return {
    adminVisibility,
    telemetryEnabled,
    textVersion: USER_CONSENT_TEXT_VERSION,
    acceptedAt: newlyAccepted ? now : previous && previous.acceptedAt || (hasConsent ? now : null),
    revokedAt: previous && (
      previous.adminVisibility && !adminVisibility ||
      previous.telemetryEnabled && !telemetryEnabled
    ) ? now : null,
    updatedAt: now
  };
}

let consentSyncQueue = Promise.resolve();

function saveConsentSetting(field, enabled) {
  if (!['adminVisibility', 'telemetryEnabled'].includes(field) || typeof enabled !== 'boolean') {
    throw new TypeError('A preferência de privacidade é inválida.');
  }
  const userId = getConsentUserId();
  const previous = readConsentState(getConsentStorageKey(userId));
  const next = createConsentState(
    field === 'adminVisibility' ? enabled : previous.adminVisibility,
    field === 'telemetryEnabled' ? enabled : previous.telemetryEnabled,
    previous
  );
  const hasCloudUser = Boolean(userId);
  const hasSyncTarget = Boolean(hasCloudUser && window.SupabaseAuth &&
    typeof window.SupabaseAuth.saveUserConsent === 'function');
  const saved = writeConsentState({ ...next, pendingSync: hasCloudUser }, getConsentStorageKey(userId));
  if (!hasSyncTarget) {
    return Promise.resolve({ success: true, localOnly: true });
  }
  consentSyncQueue = consentSyncQueue.catch(() => {}).then(async () => {
    const result = await window.SupabaseAuth.saveUserConsent(saved, userId);
    if (!result.success && !result.unavailable) {
      console.error('[GastoPro] Não foi possível sincronizar a preferência de privacidade:', result.error);
    } else if (result.success) {
      writeConsentState({ ...saved, pendingSync: false }, getConsentStorageKey(userId));
    }
    return result;
  });
  return consentSyncQueue;
}

async function syncConsentForUser(user) {
  if (!user || !user.id || !window.SupabaseAuth) return;
  const local = getConsentStateForUser(user);
  const localState = local.state;
  const userKey = getConsentStorageKey(user.id);
  if (localState && local.key !== userKey) writeConsentState(localState, userKey);
  if (typeof window.SupabaseAuth.fetchUserConsent !== 'function' ||
    typeof window.SupabaseAuth.saveUserConsent !== 'function') return;

  const remoteResult = await window.SupabaseAuth.fetchUserConsent(user.id);
  if (!remoteResult.success) {
    if (remoteResult.unavailable) {
      console.warn('[GastoPro] A tabela de consentimentos ainda não existe; as preferências ficam locais.');
      return;
    }
    console.warn('[GastoPro] Não foi possível buscar preferências de privacidade:', remoteResult.error);
    return;
  }

  const localUpdatedAt = localState ? Date.parse(localState.updatedAt || '') : NaN;
  const remoteUpdatedAt = remoteResult.consent
    ? Date.parse(remoteResult.consent.updatedAt)
    : NaN;
  const shouldUploadLocal = localState && (
    localState.pendingSync || !remoteResult.consent ||
    Number.isFinite(localUpdatedAt) && remoteUpdatedAt < localUpdatedAt
  );
  if (remoteResult.consent && !shouldUploadLocal) {
    writeConsentState(remoteResult.consent, userKey);
  } else if (localState) {
    const saveResult = await window.SupabaseAuth.saveUserConsent(localState, user.id);
    if (!saveResult.success && !saveResult.unavailable) {
      console.warn('[GastoPro] Não foi possível enviar preferências de privacidade:', saveResult.error);
      return;
    }
    writeConsentState({ ...localState, pendingSync: !saveResult.success }, userKey);
  }
  removePendingConsent(user.email);
}

function clearConsentPreference(userId = getConsentUserId()) {
  try {
    localStorage.removeItem(getConsentStorageKey(userId));
    localStorage.removeItem('gastopro_usage_telemetry_enabled_v1');
  } catch (error) {
    console.error('[GastoPro] Não foi possível apagar preferências de privacidade:', error);
  }
}

function trackUsageEvent(eventName) {
  const allowedEvents = window.GastoProTelemetryConstants &&
    window.GastoProTelemetryConstants.eventNames;
  if (!Array.isArray(allowedEvents) || !allowedEvents.includes(eventName) ||
    !readConsentState().telemetryEnabled || !window.SupabaseAuth ||
    typeof window.SupabaseAuth.recordUsageEvent !== 'function') return;

  Promise.resolve()
    .then(() => window.SupabaseAuth.recordUsageEvent(eventName))
    .then(result => {
      if (!result || !result.success) {
        console.warn('[GastoPro] O evento de uso não foi registrado:', result && result.error);
      }
    })
    .catch(error => console.warn('[GastoPro] Falha ao registrar evento de uso:', error));
}

window.GastoProUsageTelemetry = {
  get PREFERENCE_KEY() { return getConsentStorageKey(); },
  getEnabled: () => readConsentState().telemetryEnabled,
  setEnabled: enabled => saveConsentSetting('telemetryEnabled', enabled),
  clearPreference: clearConsentPreference,
  track: trackUsageEvent
};

window.GastoProConsent = {
  textVersion: USER_CONSENT_TEXT_VERSION,
  getState: () => readConsentState(),
  set: saveConsentSetting,
  createSignupState: adminVisibility => createConsentState(adminVisibility === true, false),
  storePending: storePendingConsent,
  syncForUser: syncConsentForUser
};

function isFutureImportDate(date) {
  if (!date) return false;
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return date >= todayString;
}

function cleanRecurringImportDescription(description) {
  return String(description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,3}\s+de\s+\d{1,3}\b/gi, ' ')
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(/\bc\s*\/\s*desconto\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|,:;]+|[\s\-–—|,:;]+$/g, '')
    .trim();
}

function collectRecurringImportCandidates(rows, minimumMonths = 2) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    if (row.invalid || row.duplicate || row.type !== 'variable' || row.installment || !row.date) return;
    const description = cleanRecurringImportDescription(row.desc);
    if (!description) return;
    if (!grouped.has(description)) grouped.set(description, []);
    grouped.get(description).push({ row, index, month: row.date.substring(0, 7) });
  });

  return [...grouped.entries()].flatMap(([key, group]) => {
    const months = [...new Set(group.map(item => item.month))].sort();
    if (months.length < minimumMonths) return [];
    return [{
      key,
      description: group[0].row.desc,
      indexes: group.map(item => item.index),
      months,
      startMonth: months[0],
      lastMonth: months[months.length - 1]
    }];
  });
}

function getImportCandidateSuggestions(rows, existingCandidates, limit = 8) {
  const existingKeys = new Set((existingCandidates || []).map(candidate => candidate.key));
  const maxSuggestions = Math.max(0, Math.min(8, Math.floor(Number(limit) || 0)));
  return collectRecurringImportCandidates(rows, 1)
    .filter(candidate => !existingKeys.has(candidate.key))
    .slice(0, maxSuggestions);
}

function markRecurringImportRows(rows) {
  const candidates = collectRecurringImportCandidates(rows);
  const candidateByIndex = new Map();
  candidates.forEach(candidate => candidate.indexes.forEach(index =>
    candidateByIndex.set(index, candidate.key)
  ));
  return rows.map((row, index) => candidateByIndex.has(index)
    ? { ...row, recurringCandidate: true, recurringCandidateKey: candidateByIndex.get(index) }
    : { ...row, recurringCandidate: false, recurringCandidateKey: null }
  );
}

function findRecurringImportCandidates(search, rows) {
  const query = cleanRecurringImportDescription(search);
  if (!query) return [];
  return collectRecurringImportCandidates(rows, 1).filter(candidate =>
    cleanRecurringImportDescription(candidate.description).includes(query)
  );
}

function areRecurringImportCandidatesResolved(candidates, decisions) {
  return candidates.every(candidate => {
    const decision = decisions.get(candidate.key);
    return decision && (decision.type === 'variable' ||
      decision.type === 'fixed' && typeof decision.active === 'boolean');
  });
}

function mergeRecurringImportCandidates(existing, matches) {
  const candidates = [...existing];
  const keys = new Set(candidates.map(candidate => candidate.key));
  const added = matches.filter(candidate => {
    if (keys.has(candidate.key)) return false;
    keys.add(candidate.key);
    candidates.push(candidate);
    return true;
  });
  return { candidates, added };
}

function getImportPreviewType(row) {
  if (row.installment) return 'debt';
  if (row.pending || (row.type !== 'income' && isFutureImportDate(row.date))) {
    return 'variable_pending';
  }
  return ['income', 'fixed', 'debt'].includes(row.type) ? row.type : 'variable';
}

function getRecurringImportLineType(row, decision, selectedType) {
  if (!decision || decision.type !== 'variable' || selectedType === 'variable_pending') {
    return selectedType;
  }
  return getImportPreviewType({ ...row, type: 'variable', previewType: null });
}

function requiresImportPaymentReview(row, category = row && row.category) {
  const normalizedCategory = String(category || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return Boolean(row && (
    row.type === 'debt' || row.previewType === 'debt' ||
    normalizedCategory === 'emprestimo' ||
    normalizedCategory === 'parcelamento' ||
    /\b\d{1,3}\s*(?:\/|de)\s*\d{1,3}\b/i.test(row.desc || '')
  ));
}

function getImportPaidValue(row) {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return Boolean(row && row.date) && row.date < todayString;
}

function isValidImportDueDay(value) {
  return Number.isInteger(value) && value >= 1 && value <= 31;
}

function isImportDueDayRequired(row, selectedType, installmentDebt = false) {
  if (selectedType === 'income') return false;
  return ['fixed', 'debt', 'variable_pending'].includes(selectedType) ||
    Boolean(installmentDebt);
}

function getImportDueDayIssue(row, selectedType, installmentDebt = false) {
  const required = isImportDueDayRequired(row, selectedType, installmentDebt);
  const invalid = row && row.dueDay != null && !isValidImportDueDay(row.dueDay);
  if (required && !isValidImportDueDay(row && row.dueDay)) return 'missing';
  return selectedType !== 'income' && invalid ? 'invalid' : null;
}

function getImportDueDayPreview(rows) {
  const missing = (Array.isArray(rows) ? rows : []).filter(row => {
    if (!row || row.invalid || row.selected === false) return false;
    const type = row.previewType || getImportPreviewType(row);
    const installmentDebt = Boolean(
      row.installment && row.installment.current < row.installment.total &&
      !row.linkedTemplateId
    );
    return getImportDueDayIssue(row, type, installmentDebt) === 'missing';
  });
  return {
    count: missing.length,
    descriptions: missing.slice(0, 3).map(row =>
      String(row.desc || 'Lançamento sem descrição').slice(0, 70)
    )
  };
}

function updateImportDueDayField(row, selectedType, label, input, status, installmentDebt = false) {
  const required = isImportDueDayRequired(row, selectedType, installmentDebt);
  const issue = getImportDueDayIssue(row, selectedType, installmentDebt);
  const missing = Boolean(issue);
  if (label) label.hidden = selectedType === 'income';
  if (input) {
    input.required = required;
    input.setAttribute('aria-invalid', String(missing));
  }
  if (status) {
    const fromBoleto = !missing && row && row.dueDaySource === 'boleto';
    status.hidden = !missing && !fromBoleto;
    status.dataset.status = fromBoleto ? 'source' : 'missing';
    status.textContent = missing ? 'Falta o dia' : fromBoleto ? 'Dia lido do boleto' : '';
  }
  return { required, missing };
}

function getImportDueDayMonthWarning(row, selectedType) {
  if (!row || !['fixed', 'debt'].includes(selectedType) || row.dueDay !== 31) return '';
  const month = row.startMonth || (row.date && row.date.slice(0, 7));
  const match = typeof month === 'string' && month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return '';
  const lastDay = new Date(Number(match[1]), Number(match[2]), 0).getDate();
  if (lastDay >= 31) return '';
  return `Dia 31: a data da linha vira ${String(lastDay).padStart(2, '0')}/${match[2]} ` +
    '(último dia do mês); o vencimento continua 31';
}

function updateImportDueDay(row, value) {
  if (!row) return;
  row.dueDay = value === '' ? null : Number(value);
  delete row.dueDaySource;
}

function getImportDueDayExclusionIndexes(rows) {
  const indexes = new Set();
  rows.forEach(({ index, row, type, installmentDebt, candidate, candidateDecision }) => {
    if (!getImportDueDayIssue(row, type, installmentDebt)) return;
    if (candidateDecision && candidateDecision.type === 'fixed' && candidate) {
      candidate.indexes.forEach(candidateIndex => indexes.add(candidateIndex));
    } else {
      indexes.add(index);
    }
  });
  return [...indexes];
}

function getImportDueDayExcludedMessage(count) {
  return `${count} linha(s) sem dia válido ficaram fora da importação.`;
}

function buildRecurringImportTemplate(candidate, rows, decision, currentMonth) {
  if (!candidate || !decision || decision.type !== 'fixed' ||
    typeof decision.active !== 'boolean') return null;
  const selectedRows = candidate.indexes
    .map(index => ({ row: rows[index], index }))
    .filter(item => item.row && item.row.selected)
    .sort((left, right) => left.row.date.localeCompare(right.row.date) || left.index - right.index);
  if (!selectedRows.length) return null;

  const startMonth = selectedRows[0].row.date.slice(0, 7);
  const lastMonth = selectedRows[selectedRows.length - 1].row.date.slice(0, 7);
  const templateSource = selectedRows[selectedRows.length - 1].row;
  const paidMonths = {};
  for (let month = startMonth; month <= lastMonth; month = GastoProImporter.shiftMonth(month, 1)) {
    if (month < currentMonth) paidMonths[month] = true;
  }
  const finiteEndMonth = selectedRows.map(item => item.row.endMonth)
    .filter(month => /^\d{4}-\d{2}$/.test(month || ''))
    .sort()
    .pop() || null;
  const dueDay = templateSource.dueDay;

  return {
    ...templateSource,
    type: 'fixed',
    isDebt: Boolean(finiteEndMonth ||
      ['Empréstimo', 'Parcelamento'].includes(templateSource.category)),
    active: decision.active,
    month: startMonth,
    startMonth,
    endMonth: finiteEndMonth,
    dueDay,
    date: `${startMonth}-${templateSource.date.slice(8, 10)}`,
    paidMonths
  };
}

function getImportAccountId(accountId, accounts) {
  return typeof accountId === 'string' && Array.isArray(accounts) &&
    accounts.some(account => account && account.id === accountId)
    ? accountId
    : null;
}

function normalizeFixedDescription(description) {
  const months = new Set([
    'jan', 'janeiro', 'fev', 'fevereiro', 'mar', 'marco', 'abr', 'abril',
    'mai', 'maio', 'jun', 'junho', 'jul', 'julho', 'ago', 'agosto',
    'set', 'setembro', 'out', 'outubro', 'nov', 'novembro', 'dez', 'dezembro'
  ]);
  return String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[a-z0-9]*\d[a-z0-9]*/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token && !months.has(token))
    .join(' ');
}

function findFutureFixedDescriptionMatches(source, entries) {
  const normalized = normalizeFixedDescription(source && source.desc);
  const sourceMonth = String(source && source.date || '').slice(0, 7);
  if (!normalized || !/^\d{4}-(0[1-9]|1[0-2])$/.test(sourceMonth) || !Array.isArray(entries)) {
    return [];
  }
  return entries.filter(entry => entry && entry.id !== source.id && entry.type === 'variable' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(String(entry.date || '').slice(0, 7)) &&
    String(entry.date).slice(0, 7) > sourceMonth &&
    normalizeFixedDescription(entry.desc) === normalized);
}

function applyFixedImportRules(rows, rules) {
  if (!Array.isArray(rows) || !Array.isArray(rules)) return Array.isArray(rows) ? rows : [];
  const ruleSet = new Set(rules.map(normalizeFixedDescription).filter(Boolean));
  return rows.map(row => {
    if (row.invalid || row.duplicate || row.installment || row.recurringCovered ||
      row.type !== 'variable') return row;
    const description = normalizeFixedDescription(row.desc);
    if (!description || !ruleSet.has(description)) return row;
    const month = String(row.date || '').slice(0, 7);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? { ...row, type: 'fixed', recurringPrimary: true, startMonth: month, endMonth: null, fixedByRule: true }
      : row;
  });
}

function getImportSelectAllState(rows, checked) {
  const canSelect = row => !row.invalid && !row.duplicate &&
    !row.typeSignMismatch && !row.reviewOwnAccountMovement;
  const excluded = checked ? rows.filter(row => !row.invalid && !canSelect(row)) : [];
  const duplicateCount = excluded.filter(row =>
    row.duplicate && !row.typeSignMismatch && !row.reviewOwnAccountMovement
  ).length;
  const typeSignCount = excluded.filter(row => row.typeSignMismatch).length;
  const movementCount = excluded.filter(row =>
    !row.typeSignMismatch && row.reviewOwnAccountMovement
  ).length;
  const reasons = [];
  if (duplicateCount) {
    reasons.push(duplicateCount === 1
      ? '1 possível duplicado'
      : `${duplicateCount} possíveis duplicados`);
  }
  if (typeSignCount) {
    reasons.push(typeSignCount === 1
      ? '1 linha para revisar tipo e sinal'
      : `${typeSignCount} linhas para revisar tipo e sinal`);
  }
  if (movementCount) {
    reasons.push(movementCount === 1
      ? '1 movimentação entre suas contas ou investimento'
      : `${movementCount} movimentações entre suas contas ou investimentos`);
  }
  return {
    selected: rows.map(row => checked && canSelect(row)),
    message: reasons.length ? `Selecionar todos deixou de fora: ${reasons.join('; ')}.` : ''
  };
}

window.GastoProImportHelpers = Object.freeze({
  cleanRecurringImportDescription,
  markRecurringImportRows,
  collectRecurringImportCandidates,
  getImportCandidateSuggestions,
  findRecurringImportCandidates,
  areRecurringImportCandidatesResolved,
  mergeRecurringImportCandidates,
  buildRecurringImportTemplate,
  getImportPreviewType,
  getRecurringImportLineType,
  getImportPaidValue,
  isValidDueDay: isValidImportDueDay,
  requiresDueDay: isImportDueDayRequired,
  getDueDayIssue: getImportDueDayIssue,
  updateDueDayField: updateImportDueDayField,
  getDueDayMonthWarning: getImportDueDayMonthWarning,
  updateDueDay: updateImportDueDay,
  getDueDayExclusionIndexes: getImportDueDayExclusionIndexes,
  getDueDayExcludedMessage: getImportDueDayExcludedMessage,
  getDueDayPreview: getImportDueDayPreview,
  getImportSelectAllState,
  requiresImportPaymentReview,
  getImportAccountId,
  normalizeFixedDescription,
  findFutureFixedDescriptionMatches,
  applyFixedImportRules
});

window.GastoProViewHelpers = {
  restore(storedView, userId, isAdmin) {
    const ownerId = userId || null;
    if (!storedView || typeof storedView !== 'object' ||
      storedView.ownerId !== ownerId || !PERSISTED_VIEW_IDS.includes(storedView.view)) {
      return 'dashboard';
    }
    if (storedView.view === 'admin' && isAdmin !== true) return 'dashboard';
    return storedView.view;
  },
  migrateLegacyAccountAssignments,
  scrollToTop: scrollToViewTop,
  scrollToViewTop,
  resetInitialPosition: resetInitialViewPosition
};

function scrollToViewTop(viewId) {
  window.requestAnimationFrame(() => {
    const focusedElement = document.activeElement;
    if (focusedElement instanceof HTMLElement && focusedElement.closest('.view-section')) {
      focusedElement.blur();
    }
    scrollWindowWithAutoBehavior({
      top: 0,
      behavior: 'auto'
    });
  });
}

function scrollWindowWithAutoBehavior(options) {
  const rootStyle = document.documentElement.style;
  const previousBehavior = rootStyle.scrollBehavior;
  rootStyle.scrollBehavior = 'auto';
  window.scrollTo(options);
  rootStyle.scrollBehavior = previousBehavior;
}

function resetInitialViewPosition() {
  const focusedElement = document.activeElement;
  if (focusedElement instanceof HTMLElement && focusedElement !== document.body) {
    focusedElement.blur();
  }
  scrollWindowWithAutoBehavior({ top: 0, behavior: 'auto' });
}

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

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

function readAppReloadState() {
  try {
    const stored = sessionStorage.getItem(APP_RELOAD_STATE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed || !PERSISTED_VIEW_IDS.includes(parsed.view) ||
      !Number.isInteger(parsed.year) || parsed.year < 1 ||
      !Number.isInteger(parsed.month) || parsed.month < 1 || parsed.month > 12 ||
      !Number.isFinite(parsed.scrollX) || parsed.scrollX < 0 ||
      !Number.isFinite(parsed.scrollY) || parsed.scrollY < 0 ||
      (parsed.ownerId !== null && typeof parsed.ownerId !== 'string')) {
      throw new Error('Formato inválido para o estado de navegação salvo.');
    }
    return parsed;
  } catch (error) {
    console.warn('[GastoPro] Não foi possível restaurar a navegação após atualização:', error);
    return null;
  }
}

const appReloadState = readAppReloadState();
if (appReloadState) {
  state.currentYear = appReloadState.year;
  state.currentMonth = appReloadState.month;
}

function saveAppReloadState() {
  try {
    sessionStorage.setItem(APP_RELOAD_STATE_KEY, JSON.stringify({
      view: state.currentView,
      year: state.currentYear,
      month: state.currentMonth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      ownerId: FinanceData.getActiveUserId() || null
    }));
    return true;
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar a navegação antes da atualização:', error);
    return false;
  }
}

function clearAppReloadState() {
  try {
    sessionStorage.removeItem(APP_RELOAD_STATE_KEY);
  } catch (error) {
    console.warn('[GastoPro] Não foi possível limpar o estado temporário de navegação:', error);
  }
}

function captureAppViewState() {
  return {
    view: state.currentView,
    year: state.currentYear,
    month: state.currentMonth,
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  };
}

function applyAppViewState(snapshot) {
  if (!snapshot || !VIEW_TITLES[snapshot.view] ||
    !Number.isInteger(snapshot.year) || snapshot.year < 1 ||
    !Number.isInteger(snapshot.month) || snapshot.month < 1 || snapshot.month > 12) return false;
  state.currentView = snapshot.view;
  state.currentYear = snapshot.year;
  state.currentMonth = snapshot.month;
  return true;
}

function restoreAppViewState(snapshot) {
  const previousView = state.currentView;
  if (!applyAppViewState(snapshot)) return false;
  if (previousView !== snapshot.view) {
    window.switchToView(snapshot.view);
  } else {
    renderAll();
  }
  window.requestAnimationFrame(() => {
    window.scrollTo({
      left: Number(snapshot.scrollX) || 0,
      top: Number(snapshot.scrollY) || 0,
      behavior: 'auto'
    });
  });
  return true;
}

window.GastoProReloadState = {
  key: APP_RELOAD_STATE_KEY,
  capture: captureAppViewState,
  apply: applyAppViewState,
  getCurrent: () => ({
    view: state.currentView,
    year: state.currentYear,
    month: state.currentMonth
  }),
  restore: restoreAppViewState,
  save: saveAppReloadState,
  clear: clearAppReloadState
};

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
const protectedActionsInProgress = new WeakSet();

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

async function withProtectedAction(button, action) {
  if (!button || typeof button !== 'object' || typeof action !== 'function') {
    throw new TypeError('Ação protegida requer um botão e uma função.');
  }
  if (button.disabled || protectedActionsInProgress.has(button)) return false;
  protectedActionsInProgress.add(button);
  const originalAriaBusy = button.getAttribute('aria-busy');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    return await action();
  } finally {
    button.disabled = false;
    if (originalAriaBusy === null) button.removeAttribute('aria-busy');
    else button.setAttribute('aria-busy', originalAriaBusy);
    protectedActionsInProgress.delete(button);
  }
}

window.GastoProSaving = { withSaving, withProtectedAction };

async function waitForAuthenticatedSave() {
  const profile = FinanceData.getProfile();
  if (!profile.userId || !window.SupabaseAuth || !window.SupabaseAuth.client) {
    return { success: true, skipped: true };
  }
  return FinanceData.flushPendingSync(profile.userId);
}

function formatLogoutSyncFailure(result) {
  const groups = {
    entries: 'Lançamentos (entries)',
    templates: 'Modelos (fixed_templates)',
    goals: 'Metas (goals)',
    accounts: 'Contas (accounts)',
    creditCards: 'Cartões (credit_cards)',
    creditCardPurchases: 'Compras no cartão (credit_card_purchases)',
    rules: 'Regras de importação (fixed_import_rules)',
    profile: 'Perfil (profiles)',
    session: 'Sessão',
    reconciliation: 'Reconciliação',
    transactional: 'Operações transacionais'
  };
  const failedGroups = [...new Set(
    (Array.isArray(result && result.failureCategories) ? result.failureCategories : [])
      .map(failure => {
        const category = failure && failure.category;
        return typeof category === 'string' && Object.prototype.hasOwnProperty.call(groups, category)
          ? groups[category]
          : null;
      })
      .filter(Boolean)
  )];
  const code = result && result.error && typeof result.error.code === 'string'
    ? result.error.code.trim()
    : '';
  const safeCode = /^[A-Z0-9_]{1,20}$/.test(code) ? code : '';
  const reason = [
    `Grupos: ${failedGroups.length ? failedGroups.join(', ') : 'sincronização não identificada'}.`,
    safeCode ? `Código: ${safeCode}.` : 'Motivo: falha de sincronização sem código do servidor.'
  ].join(' ');
  return `Seus dados continuam neste aparelho. Baixe uma cópia de segurança para restaurar no app antes de tentar sair novamente. ${reason}`;
}

window.GastoProLogoutFailureHelpers = Object.freeze({
  format: formatLogoutSyncFailure
});

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

function getAccountBalanceForFilter(balances, filter, accounts = null, getBalance = null) {
  if (filter === 'PF' || filter === 'PJ') return Number(balances[filter]) || 0;
  if (filter.startsWith('account:')) {
    const accountId = filter.slice('account:'.length);
    if (Array.isArray(accounts) && accounts.some(account => account.id === accountId) &&
      typeof getBalance === 'function') {
      return Number(getBalance(accountId)) || 0;
    }
  }
  return accounts === null || accounts.length ? Number(balances.total) || 0 : 0;
}

function getDashboardHighlightValues(balances, filter, accounts, getBalance, monthlyResult) {
  return {
    currentBalance: getAccountBalanceForFilter(balances, filter, accounts, getBalance),
    monthlyResult: Number(monthlyResult) || 0
  };
}

function getPendingBalanceNotice(selectedMonth, actualMonth, balance, pendingOutflows) {
  if (selectedMonth !== actualMonth) return null;
  const currentBalance = Number(balance) || 0;
  const pending = Math.max(0, Number(pendingOutflows) || 0);
  if (currentBalance < 0) return { type: 'critical', shortfall: 0 };
  if (currentBalance < pending) {
    return {
      type: 'attention',
      shortfall: Math.round((pending - currentBalance) * 100) / 100
    };
  }
  return null;
}

function getPendingBalanceNoticeMessage(notice) {
  if (!notice) return null;
  if (notice.type === 'critical') return 'Seu saldo já está negativo.';
  if (notice.type !== 'attention') return null;
  return `Atenção: se você pagar tudo que está pendente neste mês, seu saldo ficará em ${formatCurrency(-notice.shortfall)}.`;
}

function getFixedPaidStatus(fixed, isMobile) {
  const items = Array.isArray(fixed) ? fixed : [];
  if (!items.length) return 'Nenhuma conta no mês';
  const paidCount = items.filter(item => item && item.paid).length;
  return `${paidCount} de ${items.length} ${isMobile ? 'fixos pagos' : 'contas pagas'}`;
}

function getBalanceTone(value) {
  return getFinancialAmountPresentation(value).className;
}

function getMobileNotificationSummary(count) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  if (!total) return 'Sem avisos';
  return `${total} ${total === 1 ? 'aviso' : 'avisos'} · ver todos`;
}

function getStableNotificationEventKey(type, itemId, month, level = '') {
  return [type, itemId, month, level].filter(Boolean).join(':');
}

window.GastoProMobileHomeHelpers = {
  getDashboardHighlightValues,
  getPendingBalanceNotice,
  getPendingBalanceNoticeMessage,
  getFixedPaidStatus,
  getBalanceTone,
  getNotificationSummary: getMobileNotificationSummary,
  getNotificationEventKey: getStableNotificationEventKey,
  navigate: navigateMobileBottomItem
};

function buildAccountBalanceFilterOptions(accounts) {
  return [
    { value: 'all', label: 'Todas as contas' },
    { value: 'PF', label: 'Todas as contas PF' },
    { value: 'PJ', label: 'Todas as contas PJ' },
    ...accounts.map(account => ({ value: `account:${account.id}`, label: account.name }))
  ];
}

function getAccountBalanceFilterLabel(accounts, filter) {
  if (!accounts.length) return 'Cadastre uma conta para ver seu saldo.';
  if (filter === 'PF') return 'Saldo consolidado das contas PF';
  if (filter === 'PJ') return 'Saldo consolidado das contas PJ';
  if (filter.startsWith('account:')) {
    const account = accounts.find(item => item.id === filter.slice('account:'.length));
    if (account) return `Saldo da conta ${account.name}`;
  }
  return 'Saldo consolidado de todas as contas';
}

function getAccountBalanceOptionsMarkup(accounts) {
  return buildAccountBalanceFilterOptions(accounts).map(option =>
    `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
  ).join('');
}

function accountsNeedBalanceDateNotice(accounts, filter) {
  const selected = filter === 'PF' || filter === 'PJ'
    ? accounts.filter(account => account.type === filter)
    : filter.startsWith('account:')
      ? accounts.filter(account => account.id === filter.slice('account:'.length))
      : accounts;
  return selected.some(account => !account.balanceDate);
}

function buildAccountSelectOptions(accounts) {
  return [
    { value: '', label: 'Selecione uma conta' },
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
          <a href="mailto:desenvolvedor.aylton@gmail.com">desenvolvedor<wbr>.aylton<wbr>@gmail<wbr>.com</a>.
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
  const messageCards = helper.sortMessages(feedbackViewState.messages, 'all').map(message => {
    const category = helper.categories[message.category] || 'Mensagem';
    const status = message.status === 'answered' ? 'Respondida' : 'Nova';
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
              ${message.replied_at ? `<time datetime="${escapeHtml(message.replied_at)}">${escapeHtml(formatFeedbackDate(message.replied_at))}</time>` : ''}
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
  badge.setAttribute('aria-label', `${adminViewState.newCount} mensagens novas não lidas`);
  badge.hidden = !isAdmin || adminViewState.newCount === 0;
}

function syncAdminPanelTabs() {
  const tabs = document.getElementById('adminPanelTabs');
  const analyticsTab = document.getElementById('adminAnalyticsTab');
  const messagesTab = document.getElementById('adminMessagesTab');
  const analyticsPanel = document.getElementById('adminAnalyticsContent');
  const messagesPanel = document.getElementById('adminMessagesPanel');
  const showAnalytics = adminAnalyticsState.activeTab === 'analytics';
  if (tabs) tabs.hidden = adminViewState.access !== 'allowed';
  if (analyticsTab) analyticsTab.setAttribute('aria-selected', String(showAnalytics));
  if (messagesTab) messagesTab.setAttribute('aria-selected', String(!showAnalytics));
  if (analyticsPanel) analyticsPanel.hidden = !showAnalytics;
  if (messagesPanel) messagesPanel.hidden = showAnalytics;
}

function getAdminEventLabel(eventName) {
  const labels = {
    screen_dashboard: 'Dashboard',
    screen_incomes: 'Ganhos',
    screen_expenses: 'Gastos',
    screen_accounts: 'Contas',
    screen_contact: 'Fale comigo',
    screen_import: 'Importação',
    import_parse_error: 'Falha ao ler importação',
    import_save_error: 'Falha ao salvar importação',
    sync_error: 'Falha de sincronização'
  };
  return labels[eventName] || 'Outro';
}

function renderAdminMetricRows(items, labelFor) {
  if (!items.length) return '<p class="admin-analytics-empty">Sem eventos neste período.</p>';
  return `<ul class="admin-analytics-list">${items.map(item => `
    <li><span>${escapeHtml(labelFor(item.name))}</span><strong>${escapeHtml(String(item.count))}</strong></li>
  `).join('')}</ul>`;
}

function formatDistinctUsersCaption(count) {
  const total = Number(count);
  return `${total} ${total === 1 ? 'usuário vinculado à conta' : 'usuários vinculados à conta'}`;
}

function renderAdminAnalytics() {
  const container = document.getElementById('adminAnalyticsContent');
  if (!container) return;
  syncAdminPanelTabs();

  if (adminViewState.access !== 'allowed') {
    container.innerHTML = adminViewState.access === 'denied'
      ? '<div class="empty-state" role="status">Área restrita</div>'
      : '<p role="status" aria-live="polite">Verificando acesso...</p>';
    return;
  }
  if (adminAnalyticsState.loading && !adminAnalyticsState.data) {
    container.innerHTML = '<p role="status" aria-live="polite">Carregando indicadores...</p>';
    return;
  }
  if (adminAnalyticsState.error) {
    container.innerHTML = `
      <p class="admin-feedback-notice feedback-notice-error" role="alert">${escapeHtml(adminAnalyticsState.error)}</p>
      <button type="button" class="btn-secondary" data-action="admin-analytics-refresh"
        ${adminAnalyticsState.loading ? 'disabled' : ''}>Tentar novamente</button>
    `;
    return;
  }
  if (!adminAnalyticsState.data) {
    container.innerHTML = '<p role="status">Os indicadores ainda não foram carregados.</p>';
    return;
  }

  const { users, records, feedback, usage, registrations } = adminAnalyticsState.data;
  const statusLabels = { new: 'Novas', answered: 'Respondidas' };
  const categoryLabels = { duvida: 'Dúvidas', sugestao: 'Sugestões', problema: 'Problemas' };
  const screenRows = usage.screens.filter(item => item.name.startsWith('screen_'));
  const recordItems = [
    ['Lançamentos', records.entries],
    ['Gastos fixos', records.fixedTemplates],
    ['Contas', records.accounts],
    ['Cartões', records.cards],
    ['Metas', records.goals]
  ];
  const consentedUserRows = adminAnalyticsState.userList
    ? adminAnalyticsState.userList.map(user => `
      <li class="admin-user-row">
        <div>
          <strong>${escapeHtml(user.displayName)}</strong>
          ${user.email ? `<span>${escapeHtml(user.email).replace(/([.@])/g, '$1<wbr>')}</span>` : ''}
          <small>Cadastro: ${escapeHtml(new Date(user.createdAt).toLocaleDateString('pt-BR'))}</small>
        </div>
      </li>
    `).join('')
    : '';
  const userListMarkup = adminAnalyticsState.userListLoading
    ? '<p role="status">Carregando lista de usuários...</p>'
    : adminAnalyticsState.userListUnavailable
      ? '<p role="status">A lista estará disponível após a atualização do banco de dados.</p>'
      : adminAnalyticsState.userListError
        ? `<p role="alert">${escapeHtml(adminAnalyticsState.userListError)}</p>`
        : `<ul class="admin-user-list">${consentedUserRows || '<li>Nenhum usuário cadastrado.</li>'}</ul>`;
  const selectedMonthLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;

  container.innerHTML = `
    <div class="admin-analytics-toolbar">
      <p>Uso de telas e erros considera os últimos 30 dias. O gráfico de importações usa o mês selecionado.</p>
      <button type="button" class="btn-secondary admin-analytics-refresh" data-action="admin-analytics-refresh"
        ${adminAnalyticsState.loading ? 'disabled' : ''}>Atualizar indicadores</button>
    </div>
    <section class="admin-analytics-section" aria-labelledby="adminUsersTitle">
      <h3 id="adminUsersTitle">Usuários</h3>
      <div class="admin-stat-grid">
        <article class="admin-stat-card"><span>Total</span><strong>${users.total}</strong></article>
        <article class="admin-stat-card"><span>Novos nesta semana</span><strong>${users.newWeek}</strong></article>
        <article class="admin-stat-card"><span>Novos neste mês</span><strong>${users.newMonth}</strong></article>
        <article class="admin-stat-card"><span>Ativos em 7 dias</span><strong>${users.active7Days}</strong></article>
        <article class="admin-stat-card"><span>Ativos em 30 dias</span><strong>${users.active30Days}</strong></article>
      </div>
      <div class="admin-analytics-chart">
        <h4>Cadastros por mês</h4>
        <canvas id="adminGrowthChart" role="img" aria-label="Gráfico de cadastros nos últimos 12 meses"></canvas>
      </div>
      <div class="admin-analytics-section" aria-labelledby="adminUserListTitle">
        <h4 id="adminUserListTitle">Lista de usuários</h4>
        <p>Somente aparecem nome e e-mail de quem autorizou essa visualização.</p>
        ${userListMarkup}
      </div>
    </section>
    <section class="admin-analytics-section" aria-labelledby="adminRecordsTitle">
      <h3 id="adminRecordsTitle">Registros no app</h3>
      <div class="admin-stat-grid">
        ${recordItems.map(([label, count]) => `
          <article class="admin-stat-card"><span>${label}</span><strong>${count}</strong></article>
        `).join('')}
      </div>
    </section>
    <section class="admin-analytics-section admin-analytics-columns" aria-label="Mensagens e uso do app">
      <div>
        <h3>Mensagens por status</h3>
        ${renderAdminMetricRows(feedback.status, name => statusLabels[name] || 'Outro')}
        <h3>Mensagens por categoria</h3>
        ${renderAdminMetricRows(feedback.categories, name => categoryLabels[name] || 'Outra')}
      </div>
      <div>
        <h3>Telas mais usadas (30 dias)</h3>
        <p class="admin-analytics-caption">${formatDistinctUsersCaption(usage.uniqueUsers30Days)}</p>
        ${renderAdminMetricRows(screenRows, getAdminEventLabel)}
      </div>
    </section>
    <section class="admin-analytics-section" aria-labelledby="adminImportsTitle">
      <h3 id="adminImportsTitle">Importações concluídas por dia — ${escapeHtml(selectedMonthLabel)}</h3>
      <div class="admin-analytics-chart">
        <canvas id="adminImportsChart" role="img" aria-label="Gráfico de importações diárias em ${escapeHtml(selectedMonthLabel)}"></canvas>
      </div>
    </section>
    <section class="admin-analytics-section">
      <h3>Erros mais comuns (30 dias)</h3>
      ${renderAdminMetricRows(usage.errors, getAdminEventLabel)}
    </section>
  `;

  [adminAnalyticsState.growthChart, adminAnalyticsState.importsChart]
    .filter(Boolean)
    .forEach(chart => chart.destroy());
  adminAnalyticsState.growthChart = null;
  adminAnalyticsState.importsChart = null;
  if (typeof window.Chart !== 'function') return;

  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--primary').trim();
  const success = styles.getPropertyValue('--success').trim();
  const textColor = styles.getPropertyValue('--text-main').trim();
  const borderColor = styles.getPropertyValue('--border').trim();
  const makeOptions = () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: textColor, maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: borderColor } },
      y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: borderColor } }
    }
  });
  const growthCanvas = document.getElementById('adminGrowthChart');
  if (growthCanvas) {
    adminAnalyticsState.growthChart = new window.Chart(growthCanvas, {
      type: 'bar',
      data: {
        labels: registrations.map(item => item.period),
        datasets: [{
          data: registrations.map(item => item.count),
          borderColor: primary,
          backgroundColor: primary
        }]
      },
      options: makeOptions()
    });
  }
  const importsCanvas = document.getElementById('adminImportsChart');
  if (importsCanvas) {
    adminAnalyticsState.importsChart = new window.Chart(importsCanvas, {
      type: 'bar',
      data: {
        labels: usage.importsByDay.map(item => item.period.slice(5)),
        datasets: [{
          data: usage.importsByDay.map(item => item.count),
          backgroundColor: success,
          borderColor: success
        }]
      },
      options: makeOptions()
    });
  }
}

async function loadAdminAnalytics() {
  if (adminViewState.access !== 'allowed') return;
  if (adminAnalyticsState.loading) {
    adminAnalyticsState.reloadAfterCurrent = true;
    return;
  }
  const requestId = ++adminAnalyticsState.requestId;
  const selectedMonth = getYearMonthString(state.currentYear, state.currentMonth);
  adminAnalyticsState.selectedMonth = selectedMonth;
  adminAnalyticsState.loading = true;
  adminAnalyticsState.userListLoading = true;
  adminAnalyticsState.error = '';
  adminAnalyticsState.userListError = '';
  adminAnalyticsState.userListUnavailable = false;
  renderAdminAnalytics();
  try {
    const [result, userListResult] = await Promise.all([
      window.SupabaseAuth.fetchAdminAnalytics(selectedMonth),
      window.SupabaseAuth.fetchAdminUsers()
    ]);
    if (requestId !== adminAnalyticsState.requestId || state.currentView !== 'admin') return;
    if (!result.success) {
      adminAnalyticsState.error = result.error || 'Não foi possível carregar os indicadores.';
      return;
    }
    adminAnalyticsState.data = result.analytics;
    if (userListResult.success) {
      adminAnalyticsState.userList = userListResult.users;
    } else {
      adminAnalyticsState.userList = null;
      adminAnalyticsState.userListUnavailable = userListResult.unavailable === true;
      adminAnalyticsState.userListError = userListResult.unavailable
        ? ''
        : userListResult.error || 'Não foi possível carregar a lista de usuários.';
    }
  } catch (error) {
    if (requestId !== adminAnalyticsState.requestId) return;
    console.error('[GastoPro] Não foi possível carregar indicadores administrativos:', error);
    adminAnalyticsState.error = 'Não foi possível carregar os indicadores. Tente novamente.';
  } finally {
    if (requestId === adminAnalyticsState.requestId) {
      adminAnalyticsState.loading = false;
      adminAnalyticsState.userListLoading = false;
      renderAdminAnalytics();
      if (adminAnalyticsState.reloadAfterCurrent && state.currentView === 'admin') {
        adminAnalyticsState.reloadAfterCurrent = false;
        loadAdminAnalytics();
      }
    }
  }
}

function selectAdminPanelTab(tab) {
  if (!['analytics', 'messages'].includes(tab) || adminViewState.access !== 'allowed') return;
  adminAnalyticsState.activeTab = tab;
  syncAdminPanelTabs();
}

function resetAdminSession() {
  adminViewState.requestId++;
  adminAnalyticsState.requestId++;
  [adminAnalyticsState.growthChart, adminAnalyticsState.importsChart]
    .filter(Boolean)
    .forEach(chart => chart.destroy());
  adminAnalyticsState.data = null;
  adminAnalyticsState.userList = null;
  adminAnalyticsState.userListLoading = false;
  adminAnalyticsState.userListUnavailable = false;
  adminAnalyticsState.userListError = '';
  adminAnalyticsState.selectedMonth = '';
  adminAnalyticsState.loading = false;
  adminAnalyticsState.reloadAfterCurrent = false;
  adminAnalyticsState.error = '';
  adminAnalyticsState.activeTab = 'analytics';
  adminAnalyticsState.growthChart = null;
  adminAnalyticsState.importsChart = null;
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
  syncAdminFeedbackNotifications([]);
  updateAdminNavigation();
  renderNotificationCenter();
  if (state.currentView === 'admin') {
    renderAdminView();
    renderAdminAnalytics();
  }
}

function renderAdminView() {
  const container = document.getElementById('adminContent');
  if (!container) return;
  syncAdminPanelTabs();
  if (adminViewState.access !== 'allowed') {
    container.innerHTML = adminViewState.access === 'denied'
      ? '<div class="empty-state" role="status">Área restrita</div>'
      : '<p role="status" aria-live="polite">Verificando acesso...</p>';
    return;
  }

  const helper = window.GastoProFeedbackHelpers;
  const cards = adminViewState.messages.map((message, index) => {
    const label = helper.getAdminLabel(index);
    const authorName = message.author.displayName;
    const authorEmail = message.author.email;
    const category = helper.categories[message.category] || 'Mensagem';
    const editing = adminViewState.editingId === message.id;
    return `
      <article class="manage-item-card admin-feedback-card">
        <div class="feedback-message-content">
          <div class="feedback-message-heading">
            <strong class="admin-feedback-author">${escapeHtml(authorName)}</strong>
            ${authorEmail ? `<span class="admin-feedback-author-email">${escapeHtml(authorEmail).replace(/([.@_-])/g, '$1<wbr>')}</span>` : ''}
            <span class="tag-badge">${escapeHtml(label)}</span>
            <span class="tag-badge">${escapeHtml(category)}</span>
            <span class="tag-badge feedback-status-badge ${message.status === 'answered' ? 'is-answered' : ''}">
              ${message.status === 'answered' ? 'Respondida' : 'Nova'}
            </span>
            <span class="tag-badge admin-feedback-read-badge" data-read="${message.admin_read_at ? 'true' : 'false'}">
              ${message.admin_read_at ? 'Lida' : 'Não lida'}
            </span>
            ${message.admin_archived_at ? '<span class="tag-badge">Arquivada</span>' : ''}
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
              <label for="adminReplyText">Resposta para ${escapeHtml(authorName)}</label>
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
            <button type="button" class="btn-secondary admin-action-button"
              data-action="${message.admin_read_at ? 'admin-mark-unread' : 'admin-mark-read'}"
              data-id="${escapeHtml(message.id)}">
              ${message.admin_read_at ? 'Marcar como não lida' : 'Marcar como lida'}
            </button>
            <button type="button" class="btn-secondary admin-action-button"
              data-action="${message.admin_archived_at ? 'admin-unarchive' : 'admin-archive'}"
              data-id="${escapeHtml(message.id)}">
              ${message.admin_archived_at ? 'Desarquivar' : 'Arquivar'}
            </button>
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
      <button type="button" class="filter-btn ${adminViewState.filter === 'all' ? 'active' : ''}" data-action="admin-filter" data-filter="all" aria-pressed="${adminViewState.filter === 'all'}">Todas</button>
      <button type="button" class="filter-btn ${adminViewState.filter === 'archived' ? 'active' : ''}" data-action="admin-filter" data-filter="archived" aria-pressed="${adminViewState.filter === 'archived'}">Arquivadas</button>
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
  const navItem = document.getElementById('navAdmin');
  const buttonVisibleBefore = Boolean(navItem && !navItem.hidden);
  let checkResult = 'error';
  window.GastoProDiagnostics.record('admin-check', {
    phase: 'start',
    buttonVisibleBefore,
    buttonVisibleAfter: buttonVisibleBefore
  });
  try {
    const isAdmin = await window.SupabaseAuth.checkIsAdmin(result => {
      if (['admin', 'not-admin', 'error'].includes(result)) checkResult = result;
    });
    if (requestId !== adminViewState.requestId) return false;
    adminViewState.access = isAdmin ? 'allowed' : 'denied';
    if (!isAdmin) {
      adminViewState.newCount = 0;
      adminViewState.messages = [];
      adminViewState.editingId = null;
      syncAdminFeedbackNotifications([]);
    } else if (!(await refreshAdminFeedbackNotifications())) {
      console.warn('[GastoPro] Não foi possível atualizar os avisos de mensagens novas.');
    }
    updateAdminNavigation();
    renderNotificationCenter();
    if (state.currentView === 'admin') renderAdminView();
    if (state.currentView === 'admin') renderAdminAnalytics();
    return isAdmin;
  } finally {
    const currentNavItem = document.getElementById('navAdmin');
    window.GastoProDiagnostics.record('admin-check', {
      phase: 'end',
      result: checkResult,
      buttonVisibleBefore,
      buttonVisibleAfter: Boolean(currentNavItem && !currentNavItem.hidden)
    });
  }
}

let adminFeedbackNotificationsRequestId = 0;

async function refreshAdminFeedbackNotifications() {
  if (adminViewState.access !== 'allowed') return false;
  const requestId = ++adminFeedbackNotificationsRequestId;
  const result = await window.SupabaseAuth.countUnreadFeedback();
  if (requestId !== adminFeedbackNotificationsRequestId) return false;
  if (!result.success) {
    console.warn('[GastoPro] Não foi possível atualizar os avisos de mensagens novas:', result.error);
    return false;
  }
  syncAdminFeedbackNotifications(result.ids);
  adminViewState.newCount = getUnreadAdminFeedbackCount();
  updateAdminNavigation();
  renderNotificationCenter();
  return true;
}

async function setAdminFeedbackReadState(id, isRead) {
  const message = adminViewState.messages.find(item => item.id === id);
  if (message && Boolean(message.admin_read_at) === isRead) {
    if (isRead) adminUnreadFeedbackIds.delete(id);
    else adminUnreadFeedbackIds.add(id);
    syncAdminFeedbackNotifications([...adminUnreadFeedbackIds]);
    adminViewState.newCount = getUnreadAdminFeedbackCount();
    updateAdminNavigation();
    renderNotificationCenter();
    if (state.currentView === 'admin') renderAdminView();
    return { success: true, alreadyInState: true, alreadyRead: isRead };
  }
  if (adminFeedbackReadRequests.has(id)) return { success: true, pending: true };
  adminFeedbackReadRequests.add(id);
  try {
    const result = await (isRead
      ? window.SupabaseAuth.markFeedbackRead(id)
      : window.SupabaseAuth.markFeedbackUnread(id));
    if (!result.success) {
      adminViewState.notice = result.error || 'Não foi possível atualizar o estado da mensagem.';
      adminViewState.noticeType = 'error';
      showToast(adminViewState.notice, 'error');
      renderAdminView();
      return result;
    }
    if (message) message.admin_read_at = isRead
      ? result.admin_read_at || result.readAt || new Date().toISOString()
      : null;
    if (isRead) adminUnreadFeedbackIds.delete(id);
    else adminUnreadFeedbackIds.add(id);
    syncAdminFeedbackNotifications([...adminUnreadFeedbackIds]);
    adminViewState.newCount = getUnreadAdminFeedbackCount();
    adminViewState.notice = isRead ? 'Mensagem marcada como lida.' : 'Mensagem marcada como não lida.';
    adminViewState.noticeType = 'status';
    updateAdminNavigation();
    renderNotificationCenter();
    if (state.currentView === 'admin') renderAdminView();
    return result;
  } catch (error) {
    console.warn('[GastoPro] Não foi possível atualizar a leitura da mensagem:', error);
    adminViewState.notice = 'Não foi possível atualizar a leitura da mensagem. Tente novamente.';
    adminViewState.noticeType = 'error';
    showToast(adminViewState.notice, 'error');
    renderAdminView();
    return { success: false, error: adminViewState.notice };
  } finally {
    adminFeedbackReadRequests.delete(id);
  }
}

async function markAdminFeedbackRead(id) {
  return setAdminFeedbackReadState(id, true);
}

async function markAdminFeedbackUnread(id) {
  return setAdminFeedbackReadState(id, false);
}

async function updateAdminFeedbackArchive(id, archived) {
  const message = adminViewState.messages.find(item => item.id === id);
  const result = await (archived
    ? window.SupabaseAuth.archiveFeedback(id)
    : window.SupabaseAuth.unarchiveFeedback(id));
  if (!result.success) {
    adminViewState.notice = result.error || 'Não foi possível atualizar o arquivamento.';
    adminViewState.noticeType = 'error';
    showToast(adminViewState.notice, 'error');
    renderAdminView();
    return result;
  }
  if (message) message.admin_archived_at = archived ? result.admin_archived_at : null;
  if (archived) adminUnreadFeedbackIds.delete(id);
  syncAdminFeedbackNotifications([...adminUnreadFeedbackIds]);
  adminViewState.newCount = getUnreadAdminFeedbackCount();
  adminViewState.notice = archived ? 'Mensagem arquivada.' : 'Mensagem desarquivada.';
  adminViewState.noticeType = 'status';
  adminViewState.messages = adminViewState.messages.filter(item => item.id !== id);
  updateAdminNavigation();
  renderNotificationCenter();
  renderAdminView();
  await Promise.all([
    loadAdminMessages({ reset: true }),
    refreshAdminFeedbackNotifications()
  ]);
  if (state.currentView === 'admin') {
    adminViewState.notice = archived ? 'Mensagem arquivada.' : 'Mensagem desarquivada.';
    adminViewState.noticeType = 'status';
    renderAdminView();
  }
  return result;
}

function confirmAdminFeedbackArchive(id, archived) {
  const message = adminViewState.messages.find(item => item.id === id);
  if (!message) return;
  showConfirm({
    title: archived ? 'Arquivar mensagem?' : 'Desarquivar mensagem?',
    message: archived
      ? 'A mensagem sairá das Novas e do sino do Admin, mas continuará visível para a pessoa que a enviou. Deseja arquivar?'
      : 'A mensagem voltará à lista de mensagens não arquivadas. Deseja continuar?',
    iconClass: archived ? 'fa-solid fa-box-archive' : 'fa-solid fa-box-open',
    okLabel: archived ? 'Arquivar' : 'Desarquivar',
    onConfirm: () => updateAdminFeedbackArchive(id, archived)
  });
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
  adminViewState.filter = 'new';
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
  [adminAnalyticsState.growthChart, adminAnalyticsState.importsChart]
    .filter(Boolean)
    .forEach(chart => chart.destroy());
  adminAnalyticsState.growthChart = null;
  adminAnalyticsState.importsChart = null;
  adminAnalyticsState.requestId++;
  adminAnalyticsState.data = null;
  adminAnalyticsState.userList = null;
  adminAnalyticsState.loading = false;
  adminAnalyticsState.userListLoading = false;
  adminAnalyticsState.userListUnavailable = false;
  adminAnalyticsState.userListError = '';
  adminAnalyticsState.selectedMonth = '';
  adminAnalyticsState.reloadAfterCurrent = false;
  await Promise.all([
    loadAdminAnalytics(),
    loadAdminMessages({ reset: true })
  ]);
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
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Construção segura via DOM — evita XSS com innerHTML
  const icon = document.createElement('i');
  const isError = type === 'error';
  icon.className = isError
    ? 'fa-solid fa-triangle-exclamation'
    : 'fa-solid fa-circle-check';
  icon.style.color = isError ? 'var(--danger-text)' : 'var(--success)';

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

function shouldShowBackToTop(scrollY, scrollHeight, viewportHeight) {
  return scrollHeight - viewportHeight > viewportHeight * 1.5 &&
    scrollY > viewportHeight * 1.5;
}

function updateBackToTopVisibility() {
  const button = document.getElementById('backToTopBtn');
  if (!button) return;
  const visible = shouldShowBackToTop(
    window.scrollY || window.pageYOffset || 0,
    document.documentElement.scrollHeight,
    window.innerHeight
  );
  button.classList.toggle('is-visible', visible);
  button.setAttribute('aria-hidden', String(!visible));
  button.tabIndex = visible ? 0 : -1;
}

function scrollToPageTop() {
  const prefersReducedMotion = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
}

function bindBackToTopClick(button) {
  button.addEventListener('click', scrollToPageTop);
}

window.GastoProScrollTop = {
  shouldShow: shouldShowBackToTop,
  updateVisibility: updateBackToTopVisibility,
  scrollToTop: scrollToPageTop,
  bindClick: bindBackToTopClick
};

// ================================================================
// 4. NAVEGAÇÃO SPA — TROCA DE TELAS
// ================================================================

/**
 * Alterna a tela visível do app.
 * Atualiza o estado, os botões da sidebar, o título da topbar
 * e fecha o menu lateral em dispositivos móveis.
 * Exposta globalmente (window) para ser chamada pela navegação delegada.
 *
 * @param {string} viewId - ID definido em VIEW_TITLES.
 */
window.switchToView = function(viewId) {
  const stack = new Error().stack;
  const stackLines = typeof stack === 'string'
    ? stack.split('\n').slice(1, 7).map(line => {
      const match = line.match(/([\w.-]+\.js):(\d+):\d+/);
      return match ? `${match[1]}:${match[2]}` : '';
    })
    : [];
  window.GastoProDiagnostics.record('view-switch', {
    from: state.currentView,
    to: viewId,
    dashboard: viewId === 'dashboard',
    stack: stackLines
  });
  // Ignora IDs de tela desconhecidos para evitar erros silenciosos
  if (!VIEW_TITLES[viewId]) return;
  state.currentView = viewId;
  setMobileBottomSelectionForView(viewId);
  const screenEventNames = {
    dashboard: 'screen_dashboard',
    incomes: 'screen_incomes',
    expenses: 'screen_expenses',
    accounts: 'screen_accounts',
    contact: 'screen_contact'
  };
  if (screenEventNames[viewId]) trackUsageEvent(screenEventNames[viewId]);
  persistMainView(viewId);

  // Marca o botão ativo na sidebar e desmarca os demais
  document.querySelectorAll('.sidebar .nav-item[data-view]').forEach(btn => {
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
    scrollToViewTop(viewId);
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
  if (adminViewState.access === 'allowed' && state.currentView === 'admin') persistMainView('admin');
  renderAll();
  if (viewId === 'contact') loadMyFeedback();
  if (viewId === 'admin') {
    openAdminView();
  } else {
    adminViewState.requestId++;
    adminViewState.loading = false;
  }
};

function updateMobileBottomNavigation() {
  document.querySelectorAll('.mobile-bottom-nav-item[data-destination]').forEach(button => {
    const active = button.dataset.destination === mobileBottomSelection;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function setMobileBottomSelectionForView(viewId) {
  if (viewId === 'dashboard') mobileBottomSelection = 'home';
  else if (viewId === 'entries' || viewId === 'incomes' || viewId === 'expenses') mobileBottomSelection = 'entries';
  else if (viewId === 'cards') mobileBottomSelection = 'cards';
  else mobileBottomSelection = 'more';
  updateMobileBottomNavigation();
}

function navigateMobileBottomItem(destination) {
  if (destination === 'home') {
    window.switchToView('dashboard');
  } else if (destination === 'entries') {
    window.switchToView('entries');
  } else if (destination === 'cards') {
    window.switchToView('cards');
  } else if (destination === 'goals') {
    window.switchToView('dashboard');
    mobileBottomSelection = 'goals';
    updateMobileBottomNavigation();
    window.requestAnimationFrame(scrollToGoalsDashboardPanel);
  } else if (destination === 'more') {
    mobileBottomSelection = 'more';
    updateMobileBottomNavigation();
    document.getElementById('menuToggleBtn')?.click();
  } else {
    return false;
  }
  return true;
}

function setEntryFormType(type, view = document.getElementById('view-entries')) {
  if (type !== null && !['expense', 'income'].includes(type)) return false;
  const container = view || document;
  const panels = {
    expense: container.querySelector('#expenseForm')?.closest('.panel-box'),
    income: container.querySelector('#incomeForm')?.closest('.panel-box')
  };
  if (!panels.expense || !panels.income) return false;

  container.querySelectorAll('.entry-type-button[data-entry-type]').forEach(button => {
    const selected = button.dataset.entryType === type;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  Object.entries(panels).forEach(([formType, panel]) => {
    panel.hidden = formType !== type;
  });
  const prompt = container.querySelector('#entryComposerPrompt');
  if (prompt) prompt.hidden = type !== null;
  return true;
}

function openIncomeEntryComposer() {
  if (typeof window.switchToView !== 'function') return false;
  window.switchToView('entries');
  const view = document.getElementById('view-entries');
  if (!setEntryFormType('income', view)) return false;
  window.requestAnimationFrame(() => {
    const form = view.querySelector('#incomeForm');
    const amount = view.querySelector('#incomeAmount');
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    amount?.focus();
  });
  return true;
}

function openExpenseEntryComposer() {
  if (typeof window.switchToView !== 'function') return false;
  window.switchToView('entries');
  const view = document.getElementById('view-entries');
  if (!setEntryFormType('expense', view)) return false;
  window.requestAnimationFrame(() => {
    const form = view.querySelector('#expenseForm');
    const description = view.querySelector('#expenseDesc');
    form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    description?.focus();
  });
  return true;
}

function clearEntryFormFields(type) {
  const fields = type === 'income'
    ? ['incomeDesc', 'incomeAmount', 'incomeAccount']
    : type === 'expense'
      ? [
        'expenseDesc', 'expenseAmount', 'expenseAccount', 'expenseEndMonth', 'expenseDueDay',
        'expenseCreditAccount'
      ]
      : null;
  if (!fields) return false;

  fields.forEach(id => {
    const field = document.getElementById(id);
    if (field) field.value = '';
  });
  const date = document.getElementById(`${type}Date`);
  if (date) date.value = getTodayString();
  return true;
}

function completeEntrySave(type) {
  if (!clearEntryFormFields(type)) return false;
  showToast(type === 'income' ? 'Ganho salvo' : 'Gasto salvo');
  return true;
}

const activeButtonSubmissions = new WeakSet();
const buttonStateTimers = new WeakMap();

function setButtonSubmissionState(button, state, message = '') {
  if (!button) return;
  const status = button.closest('form')?.querySelector('[data-button-state-status]');
  const timer = buttonStateTimers.get(button);
  if (timer) clearTimeout(timer);
  if (state === 'sending') {
    activeButtonSubmissions.add(button);
    button.disabled = true;
    if (status) status.textContent = 'Enviando…';
    return;
  }

  activeButtonSubmissions.delete(button);
  button.disabled = false;
  if (!status) return;
  if (state === 'saved') {
    status.textContent = 'Salvo.';
    buttonStateTimers.set(button, setTimeout(() => {
      status.textContent = '';
      buttonStateTimers.delete(button);
    }, 2500));
  } else if (state === 'pending') {
    status.textContent = 'Salvo neste aparelho; falta enviar à nuvem.';
  } else if (state === 'error') {
    status.textContent = `Erro: ${(message || 'não foi possível salvar.').slice(0, 120)}`;
  } else {
    status.textContent = '';
  }
}

function beginButtonSubmission(button) {
  if (!button || activeButtonSubmissions.has(button)) return false;
  setButtonSubmissionState(button, 'sending');
  return true;
}

async function runButtonSubmission(button, action) {
  if (!beginButtonSubmission(button)) return false;
  try {
    const result = await action();
    if (!result || !['saved', 'pending', 'error'].includes(result.state)) {
      setButtonSubmissionState(button, 'error', 'não foi possível confirmar o salvamento.');
      return result;
    }
    setButtonSubmissionState(button, result.state, result.message);
    return result;
  } catch (error) {
    console.error('[GastoPro] Falha ao salvar pelo formulário:', error);
    setButtonSubmissionState(button, 'error', error.message || 'não foi possível salvar.');
    return { state: 'error', message: error.message || 'não foi possível salvar.' };
  }
}

window.GastoProButtonStates = Object.freeze({
  begin: beginButtonSubmission,
  finish: setButtonSubmissionState,
  run: runButtonSubmission
});

function setupEntryComposer(view = document.getElementById('view-entries')) {
  if (!view) return;

  const expenseForm = document.getElementById('expenseForm');
  const incomeForm = document.getElementById('incomeForm');
  const expenseSlot = document.getElementById('entryExpenseFormSlot');
  const incomeSlot = document.getElementById('entryIncomeFormSlot');
  const expensePanel = expenseForm?.closest('.panel-box');
  const incomePanel = incomeForm?.closest('.panel-box');
  if (!expensePanel || !incomePanel || !expenseSlot || !incomeSlot) {
    throw new Error('A tela de lançamentos precisa dos dois formulários e seus espaços.');
  }

  expenseSlot.appendChild(expensePanel);
  incomeSlot.appendChild(incomePanel);
  view.querySelectorAll('.entry-type-button[data-entry-type]').forEach(button => {
    button.addEventListener('click', () => setEntryFormType(button.dataset.entryType));
  });
  if (!setEntryFormType(null, view)) {
    throw new Error('Não foi possível iniciar a tela de lançamentos.');
  }
}

function bindDetailsExpandedState(details) {
  const summary = details?.querySelector('summary');
  if (!summary) return false;

  const syncExpandedState = () => {
    summary.setAttribute('aria-expanded', String(details.open));
  };
  syncExpandedState();
  details.addEventListener('toggle', syncExpandedState);
  return true;
}

window.GastoProEntryComposer = Object.freeze({
  setType: setEntryFormType,
  openIncome: openIncomeEntryComposer,
  clearForm: clearEntryFormFields,
  completeSave: completeEntrySave,
  setup: setupEntryComposer
});

function scrollToGoalsDashboardPanel() {
  const panel = document.getElementById('goalsDashboardPanel');
  if (!panel) return false;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const panelRect = panel.getBoundingClientRect();
  const topbar = document.querySelector('.topbar');
  const topbarStyle = topbar ? window.getComputedStyle(topbar) : null;
  const topbarRect = topbar ? topbar.getBoundingClientRect() : null;
  const topbarOffset = topbarStyle && ['fixed', 'sticky'].includes(topbarStyle.position)
    ? Math.max(0, Math.min(viewportHeight, topbarRect.bottom))
    : 0;
  const bottomNav = document.getElementById('mobileBottomNav');
  const bottomNavStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;
  const bottomNavRect = bottomNav ? bottomNav.getBoundingClientRect() : null;
  const bottomNavOffset = bottomNavStyle && bottomNavStyle.display !== 'none' &&
    bottomNavStyle.position === 'fixed' && bottomNavRect.bottom >= viewportHeight - 1
    ? Math.max(0, viewportHeight - bottomNavRect.top)
    : 0;
  const visibleHeight = Math.max(0, viewportHeight - topbarOffset - bottomNavOffset);
  const panelOffset = topbarOffset + (panelRect.height <= visibleHeight
    ? Math.max(8, (visibleHeight - panelRect.height) / 2)
    : 8);

  scrollWindowWithAutoBehavior({
    top: Math.max(0, panelRect.top + window.scrollY - panelOffset),
    behavior: 'auto'
  });
  return true;
}

function showAppUpdateNoticeIfWaiting(registration, notice = document.getElementById('appUpdateNotice')) {
  if (!registration || !registration.waiting || !notice) return false;
  const shouldRecord = notice.hidden;
  notice.hidden = false;
  if (shouldRecord) window.GastoProDiagnostics.record('app-update-notice');
  return true;
}

function watchForWaitingAppUpdate(registration) {
  const checkWaiting = () => showAppUpdateNoticeIfWaiting(registration);
  checkWaiting();
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) checkWaiting();
    });
  });
}

window.GastoProAppUpdate = Object.freeze({
  showIfWaiting: showAppUpdateNoticeIfWaiting,
  watch: watchForWaitingAppUpdate
});

function renderLoansView() {
  const list = document.getElementById('loansList');
  if (!list) return;
  const accounts = FinanceData.getAccounts();
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const accountSelect = document.getElementById('loanAccount');
  const selectedAccountId = accountSelect?.value || '';
  if (accountSelect) {
    accountSelect.innerHTML = '<option value="">Selecione uma conta</option>' +
      accounts.map(account =>
        `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`
      ).join('');
    accountSelect.value = accounts.some(account => account.id === selectedAccountId)
      ? selectedAccountId : '';
    accountSelect.required = accounts.length > 0;
  }
  const accountNotice = document.getElementById('loanAccountNotice');
  if (accountNotice) {
    accountNotice.textContent = accounts.length
      ? 'Escolha a conta em que o valor foi recebido.'
      : 'Cadastre uma conta em Contas antes de salvar um empréstimo.';
  }

  const loans = FinanceData.getActiveTemplates().filter(template =>
    template.loanReceivedAmount != null && !template.deletedAt && !template.deleted_at
  );
  if (!loans.length) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i>
        <p>Nenhum empréstimo cadastrado.</p>
        <span>Cadastre um empréstimo para acompanhar parcelas, saldo restante e vencimento.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = loans.map(loan => {
    const summary = window.GastoProLoans.getLoanSummary(loan);
    const nextMonthLabel = summary.nextInstallmentMonth
      ? summary.nextInstallmentMonth.split('-').reverse().join('/')
      : 'Nenhuma';
    const accountName = accountNames.get(loan.accountId) || 'Conta não encontrada';
    return `
      <article class="loan-card">
        <div class="loan-card-heading">
          <div>
            <h4>${escapeHtml(loan.desc)}</h4>
            <p>${escapeHtml(accountName)} · Vencimento dia ${escapeHtml(String(loan.day))}</p>
          </div>
          <span class="loan-status ${summary.remainingInstallments ? '' : 'is-paid'}">
            ${summary.remainingInstallments ? `${summary.remainingInstallments}x restantes` : 'Quitado'}
          </span>
        </div>
        <div class="loan-progress-track" role="progressbar"
          aria-label="Parcelas pagas de ${escapeHtml(loan.desc)}"
          aria-valuemin="0" aria-valuemax="${summary.paidInstallments + summary.remainingInstallments}"
          aria-valuenow="${summary.paidInstallments}">
          <span style="width: ${summary.percentagePaid}%"></span>
        </div>
        <div class="loan-card-details">
          <span>Parcelas pagas: <strong>${summary.paidInstallments}</strong></span>
          <span>Próxima: <strong>${escapeHtml(nextMonthLabel)}</strong></span>
          <span>Total a pagar: <strong>${formatCurrency(summary.totalPayable)}</strong></span>
          <span>Falta pagar: <strong>${formatCurrency(summary.remainingAmount)}</strong></span>
          <span>Última parcela: <strong>${escapeHtml(summary.lastInstallmentMonth.split('-').reverse().join('/'))}</strong></span>
        </div>
        <div class="loan-card-actions">
          <button type="button" class="btn-primary" data-action="loan-toggle-paid"
            data-id="${escapeHtml(loan.id)}" data-month="${escapeHtml(summary.nextInstallmentMonth || '')}"
            ${summary.nextInstallmentMonth ? '' : 'disabled'}>
            ${summary.nextInstallmentMonth ? `Marcar parcela de ${escapeHtml(nextMonthLabel)} como paga` : 'Todas pagas'}
          </button>
          <button type="button" class="btn-secondary" data-action="edit-loan"
            data-id="${escapeHtml(loan.id)}">Editar</button>
          <button type="button" class="btn-secondary" data-action="delete-loan"
            data-id="${escapeHtml(loan.id)}">Excluir</button>
        </div>
      </article>
    `;
  }).join('');
}

let pendingLoanSave = null;

function setLoanFormError(message) {
  const error = document.getElementById('loanFormError');
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  reportSubmitNoEffect('loan', message);
}

function clearLoanFormError() {
  const error = document.getElementById('loanFormError');
  if (error) {
    error.textContent = '';
    error.hidden = true;
  }
}

function updateLoanInstallmentAmount() {
  const totalField = document.getElementById('loanTotalPayable');
  const countField = document.getElementById('loanInstallmentCount');
  const receivedField = document.getElementById('loanReceivedAmount');
  const installmentField = document.getElementById('loanInstallmentAmount');
  if (!totalField || !countField || !receivedField || !installmentField) return;
  clearLoanFormError();
  installmentField.value = '';
  if ([receivedField.value, totalField.value].some(value =>
    value !== '' && !window.GastoProMoneyScale.hasAtMostTwoDecimalPlaces(value))) {
    return;
  }
  const total = Number(totalField.value);
  const received = Number(receivedField.value);
  const count = Number(countField.value);
  if (totalField.value === '' || countField.value === '' || receivedField.value === '' ||
    !Number.isFinite(total) || !Number.isFinite(received) || total < received ||
    !Number.isInteger(count) || count < 1 || count > 480) return;
  const totalCents = Math.round(total * 100);
  const installmentCents = Math.round(totalCents / count);
  if (Math.abs(installmentCents * count - totalCents) > count) return;
  installmentField.value = (installmentCents / 100).toFixed(2);
}

function isValidLoanFormDate(value) {
  if (typeof value !== 'string' ||
    !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function buildLoanCandidate(form) {
  const value = id => form.querySelector(`#${id}`)?.value ?? '';
  const desc = value('loanDesc').trim();
  const receivedAmount = Number(value('loanReceivedAmount'));
  const totalPayable = Number(value('loanTotalPayable'));
  const installmentCount = Number(value('loanInstallmentCount'));
  const installmentAmount = Number(value('loanInstallmentAmount'));
  const dueDay = Number(value('loanDueDay'));
  const receivedDate = value('loanReceivedDate');
  const startMonth = value('loanFirstMonth');
  const accountId = value('loanAccount');
  const moneyFields = [value('loanReceivedAmount'), value('loanTotalPayable'), value('loanInstallmentAmount')];
  if (!desc || desc.length > 300) return { error: 'Informe uma descrição com até 300 caracteres.' };
  if (moneyFields.some(amount => !window.GastoProMoneyScale.hasAtMostTwoDecimalPlaces(amount))) {
    return { error: 'Os valores do empréstimo devem ter no máximo 2 casas decimais.' };
  }
  if (!Number.isFinite(receivedAmount) || receivedAmount < 0 ||
    receivedAmount > 9999999999.99 || !Number.isFinite(totalPayable) ||
    totalPayable < receivedAmount || totalPayable > 9999999999.99 ||
    !Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 480 ||
    !Number.isFinite(installmentAmount) ||
    Math.abs(Math.round(installmentAmount * 100) * installmentCount -
      Math.round(totalPayable * 100)) > installmentCount) {
    return { error: 'Informe valores válidos; a diferença entre o total e as parcelas não pode exceder R$ 0,01 por parcela.' };
  }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return { error: 'Informe um dia de vencimento entre 1 e 31.' };
  }
  if (!isValidLoanFormDate(receivedDate) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) {
    return { error: 'Informe uma data de recebimento e o mês da primeira parcela válidos.' };
  }
  if (!accountId || !FinanceData.getAccounts().some(account => account.id === accountId)) {
    return {
      error: FinanceData.getAccounts().length
        ? 'Escolha a conta que recebeu o empréstimo.'
        : 'Cadastre uma conta em Contas antes de salvar um empréstimo.'
    };
  }
  const editId = value('loanEditId');
  const existing = editId
    ? FinanceData.getActiveTemplates().find(template => template.id === editId && template.loanReceivedAmount != null)
    : null;
  if (editId && !existing) return { error: 'O empréstimo que você está editando não foi encontrado.' };
  return {
    loan: {
      ...(existing || {}),
      id: existing?.id,
      type: 'loan',
      isDebt: true,
      active: existing?.active !== false,
      desc,
      amount: installmentAmount,
      accountId,
      dueDay,
      day: String(dueDay).padStart(2, '0'),
      startMonth,
      endMonth: shiftDebtMonth(startMonth, installmentCount - 1),
      loanReceivedAmount: receivedAmount,
      loanReceivedDate: receivedDate,
      loanTotalPayable: totalPayable,
      loanInstallmentCount: installmentCount,
      paidMonths: existing?.paidMonths || {}
    },
    editId
  };
}

function renderLoanConflictPreview(conflicts) {
  const preview = document.getElementById('loanConflictPreview');
  const list = document.getElementById('loanConflictItems');
  const removeButton = document.getElementById('loanRemoveConflictBtn');
  if (!preview || !list || !removeButton) throw new Error('A prévia de conflitos de empréstimo não está disponível.');
  const accountNames = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  list.innerHTML = conflicts.map((conflict, index) => `
    <article class="loan-conflict-item">
      <label class="loan-conflict-choice">
        <input type="radio" name="loanConflictChoice" value="${index}"
          data-conflict-id="${escapeHtml(conflict.id || '')}" ${conflict.id ? '' : 'disabled'} />
        <span>
          <strong>${escapeHtml(conflict.description)} · ${formatCurrency(conflict.amount)}</strong>
          ${escapeHtml(conflict.date || 'Data não informada')} ·
          ${escapeHtml(accountNames.get(conflict.accountId) || 'Conta não informada')}<br />
          ${escapeHtml(conflict.reason)}
        </span>
      </label>
    </article>
  `).join('');
  removeButton.disabled = true;
  preview.hidden = false;
  preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideLoanConflictPreview() {
  const preview = document.getElementById('loanConflictPreview');
  if (preview) preview.hidden = true;
  pendingLoanSave = null;
}

async function persistLoanCandidate(candidate, editId) {
  let saved;
  if (editId) {
    saved = FinanceData.update(editId, {
      ...candidate,
      type: 'loan',
      day: candidate.day,
      dueDay: candidate.dueDay
    });
  } else {
    saved = FinanceData.add(candidate);
  }
  if (!saved) throw new Error('Não foi possível salvar. Confira os dados e a conta selecionada.');
  const syncResult = await waitForAuthenticatedSave();
  clearLoanFormError();
  hideLoanConflictPreview();
  document.getElementById('loanForm').reset();
  document.getElementById('loanEditId').value = '';
  document.getElementById('loanFormTitle').textContent = 'Adicionar empréstimo';
  document.getElementById('loanSubmitBtn').innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Salvar empréstimo';
  document.getElementById('loanCancelEditBtn').hidden = true;
  document.getElementById('loanReceivedDate').value = getTodayString();
  document.getElementById('loanInstallmentAmount').value = '';
  document.getElementById('loanAccount').value = '';
  renderAll();
  showToast(!syncResult.success
    ? 'Empréstimo salvo neste aparelho; a sincronização com a nuvem ficará pendente.'
    : editId ? 'Empréstimo atualizado.' : 'Empréstimo salvo.',
  syncResult.success ? 'success' : 'error');
  return syncResult;
}

async function finishLoanConflictChoice(choice, conflictId) {
  if (!pendingLoanSave) {
    setLoanFormError('A prévia de conflitos não está mais ativa. Confira os dados e tente novamente.');
    return;
  }
  const pending = pendingLoanSave;
  const button = choice === 'remove'
    ? document.getElementById('loanRemoveConflictBtn')
    : document.getElementById('loanInsertAnywayBtn');
  const saveResult = await withSaving(button, async () => {
    if (choice === 'remove') {
      const selected = pending.conflicts.find(conflict => conflict.id === conflictId);
      if (!selected) {
        setLoanFormError('Escolha um item identificável para remover.');
        return;
      }
      showConfirm({
        title: 'Remover este item?',
        message: `O item "${selected.description}" será excluído pelo caminho usual e a exclusão será sincronizada. Deseja continuar?`,
        iconClass: 'fa-solid fa-trash-can',
        okLabel: 'Remover e inserir',
        onCancel: () => {
          setLoanFormError('Empréstimo não salvo: a remoção não foi confirmada.');
        },
        onConfirm: async () => {
          try {
            const deleteResult = await FinanceData.delete(selected.id);
            if (!deleteResult || !deleteResult.success) {
              setLoanFormError('O item não foi removido; o empréstimo não foi inserido. Tente sincronizar novamente.');
              return;
            }
            const result = await persistLoanCandidate(pending.candidate, pending.editId);
            setButtonSubmissionState(document.getElementById('loanSubmitBtn'),
              result.success ? 'saved' : 'pending');
          } catch (error) {
            console.error('Erro ao remover o conflito do empréstimo:', error);
            setLoanFormError('Não foi possível remover o item escolhido. O empréstimo não foi inserido.');
          }
        }
      });
      return;
    }
    try {
      const result = await persistLoanCandidate(pending.candidate, pending.editId);
      setButtonSubmissionState(document.getElementById('loanSubmitBtn'),
        result.success ? 'saved' : 'pending');
    } catch (error) {
      console.error('Erro ao salvar o empréstimo após a prévia:', error);
      setLoanFormError(error.message || 'Não foi possível salvar o empréstimo.');
      setButtonSubmissionState(document.getElementById('loanSubmitBtn'), 'error',
        error.message || 'não foi possível salvar.');
    }
  });
  if (saveResult === false) {
    setLoanFormError('Outro salvamento está em andamento. Aguarde e tente novamente.');
  }
}

function bindLoansForm(form = document.getElementById('loanForm')) {
  if (!form) return false;
  if (form.dataset.loanFormBound === 'true') return true;
  const preview = document.getElementById('loanConflictPreview');
  const submitButton = document.getElementById('loanSubmitBtn');
  if (!preview || !submitButton) throw new Error('O formulário de empréstimos está incompleto.');
  const accountSelect = form.querySelector('#loanAccount');
  const accounts = FinanceData.getAccounts();
  if (accountSelect) accountSelect.required = accounts.length > 0;
  const accountNotice = form.querySelector('#loanAccountNotice');
  if (accountNotice) {
    accountNotice.textContent = accounts.length
      ? 'Escolha a conta em que o valor foi recebido.'
      : 'Cadastre uma conta em Contas antes de salvar um empréstimo.';
  }
  window.GastoProSubmitFeedback.bindValidation(form, 'loan');
  ['loanReceivedAmount', 'loanTotalPayable', 'loanInstallmentCount'].forEach(id => {
    form.querySelector(`#${id}`)?.addEventListener('input', updateLoanInstallmentAmount);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearLoanFormError();
    const result = buildLoanCandidate(form);
    if (result.error) {
      setLoanFormError(result.error);
      setButtonSubmissionState(submitButton, 'error', result.error);
      return;
    }
    const button = event.submitter || submitButton;
    if (!beginButtonSubmission(button)) return;
    const saveResult = await withSaving(button, async () => {
      try {
        const conflicts = window.GastoProLoans.detectLoanConflicts(
          result.loan,
          FinanceData.getEntries(),
          FinanceData.getActiveTemplates()
        );
        if (conflicts.length) {
          pendingLoanSave = { candidate: result.loan, editId: result.editId, conflicts };
          renderLoanConflictPreview(conflicts);
          return;
        }
        return await persistLoanCandidate(result.loan, result.editId);
      } catch (error) {
        console.error('Erro ao salvar empréstimo:', error);
        setLoanFormError(error.message || 'Ocorreu um erro ao salvar o empréstimo. Tente novamente.');
        return null;
      }
    });
    if (saveResult === false) {
      setLoanFormError('Outro salvamento está em andamento. Aguarde e tente novamente.');
      setButtonSubmissionState(button, 'error', 'outro salvamento está em andamento.');
    } else if (pendingLoanSave) {
      setButtonSubmissionState(button, 'error', 'revise e confirme os conflitos para continuar.');
    } else if (saveResult && typeof saveResult.success === 'boolean') {
      setButtonSubmissionState(button, saveResult.success ? 'saved' : 'pending');
    } else if (saveResult === null) {
      setButtonSubmissionState(button, 'error', 'não foi possível salvar o empréstimo.');
    } else {
      setButtonSubmissionState(button, 'error', 'não foi possível salvar o empréstimo.');
    }
  });
  document.getElementById('loanInsertAnywayBtn')?.addEventListener('click', () => {
    finishLoanConflictChoice('insert');
  });
  document.getElementById('loanRemoveConflictBtn')?.addEventListener('click', () => {
    const selected = preview.querySelector('input[name="loanConflictChoice"]:checked');
    finishLoanConflictChoice('remove', selected?.dataset.conflictId);
  });
  document.getElementById('loanCancelConflictBtn')?.addEventListener('click', () => {
    hideLoanConflictPreview();
    showToast('Empréstimo não salvo: operação cancelada.', 'error');
    reportSubmitNoEffect('loan', 'Empréstimo não salvo: operação cancelada.');
  });
  preview.addEventListener('change', event => {
    if (!(event.target instanceof Element) ||
      !event.target.matches('input[name="loanConflictChoice"]')) return;
    const removeButton = document.getElementById('loanRemoveConflictBtn');
    if (removeButton) removeButton.disabled = !event.target.dataset.conflictId;
  });
  document.getElementById('loanCancelEditBtn')?.addEventListener('click', () => {
    form.reset();
    document.getElementById('loanEditId').value = '';
    document.getElementById('loanFormTitle').textContent = 'Adicionar empréstimo';
    submitButton.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i> Salvar empréstimo';
    document.getElementById('loanCancelEditBtn').hidden = true;
    document.getElementById('loanReceivedDate').value = getTodayString();
    clearLoanFormError();
  });
  const receivedDate = document.getElementById('loanReceivedDate');
  if (receivedDate && !receivedDate.value) receivedDate.value = getTodayString();
  form.dataset.loanFormBound = 'true';
  return true;
}

function editLoan(id) {
  const loan = FinanceData.getActiveTemplates().find(template =>
    template.id === id && template.loanReceivedAmount != null
  );
  if (!loan) {
    showToast('Empréstimo não encontrado. Atualize a tela e tente novamente.', 'error');
    return;
  }
  showConfirm({
    title: 'Editar modelo recorrente?',
    message: 'A edição altera o modelo inteiro e suas ocorrências nos meses, não apenas este mês. Deseja continuar?',
    iconClass: 'fa-solid fa-repeat',
    okLabel: 'Editar modelo',
    okBtnClass: 'btn-primary',
    onConfirm: () => {
      const fieldValues = {
        loanEditId: loan.id,
        loanDesc: loan.desc,
        loanReceivedAmount: loan.loanReceivedAmount,
        loanReceivedDate: loan.loanReceivedDate,
        loanTotalPayable: loan.loanTotalPayable,
        loanInstallmentCount: loan.loanInstallmentCount,
        loanInstallmentAmount: loan.amount,
        loanDueDay: Number(loan.day),
        loanFirstMonth: loan.startMonth,
        loanAccount: loan.accountId
      };
      Object.entries(fieldValues).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
      });
      document.getElementById('loanFormTitle').textContent = 'Editar modelo de empréstimo';
      document.getElementById('loanSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar alterações';
      document.getElementById('loanCancelEditBtn').hidden = false;
      clearLoanFormError();
      window.switchToView('loans');
      document.getElementById('loanForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('loanDesc').focus();
    }
  });
}

function deleteLoan(id) {
  const loan = FinanceData.getActiveTemplates().find(template =>
    template.id === id && template.loanReceivedAmount != null
  );
  if (!loan) {
    showToast('Empréstimo não encontrado. Atualize a tela e tente novamente.', 'error');
    return;
  }
  showConfirm({
    title: 'Excluir modelo recorrente?',
    message: 'O modelo recorrente e seu histórico mensal serão removidos, não apenas este mês. Deseja excluir?',
    iconClass: 'fa-solid fa-trash-can',
    okLabel: 'Sim, excluir',
    onConfirm: async () => {
      try {
        const result = await FinanceData.delete(id);
        renderAll();
        showToast(result && result.success
          ? 'Empréstimo excluído.'
          : 'Não foi possível sincronizar a exclusão do empréstimo. Tente novamente.',
        result && result.success ? 'success' : 'error');
      } catch (error) {
        console.error('Erro ao excluir empréstimo:', error);
        showToast('Não foi possível excluir o empréstimo. Tente novamente.', 'error');
      }
    }
  });
}

async function markLoanInstallmentPaid(id, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    showToast('Não foi possível marcar a parcela: mês inválido.', 'error');
    reportSubmitNoEffect('loan', 'Parcela não marcada: mês inválido.');
    return;
  }
  try {
    const result = await FinanceData.markPaid(id, month);
    if (!result || !result.success) {
      showToast('Não foi possível marcar a parcela como paga. Tente novamente.', 'error');
      return;
    }
    renderAll();
    showToast('Parcela marcada como paga.');
  } catch (error) {
    console.error('Erro ao marcar parcela do empréstimo:', error);
    showToast('Não foi possível marcar a parcela como paga. Tente novamente.', 'error');
  }
}

window.GastoProLoanUI = Object.freeze({
  bindForm: bindLoansForm,
  render: renderLoansView,
  summarize: window.GastoProLoans.getLoanSummary,
  detectConflicts: window.GastoProLoans.detectLoanConflicts,
  edit: editLoan,
  delete: deleteLoan,
  markPaid: markLoanInstallmentPaid
});

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
  migrateLegacyAccountAssignments();
  updateAccountSelects();
  updateCreditCardPurchaseFields();
  const ym         = getYearMonthString(state.currentYear, state.currentMonth);
  const monthLabel = `${MONTH_NAMES[state.currentMonth - 1]} ${state.currentYear}`;

  // Atualiza o rótulo de mês no seletor e em todas as telas
  document.getElementById('currentMonthLabel').textContent = monthLabel;
  document.querySelectorAll('.badge-month-label').forEach(el => {
    el.textContent = monthLabel;
  });

  // Busca todos os itens financeiros do mês atual (entradas + projeções fixas)
  const entries = FinanceData.getByMonth(ym);
  const accounts = FinanceData.getAccounts();
  const dashboardSummary = getDashboardAccountSummary(
    entries, accounts, state.accountBalanceFilter
  );
  const incomes = entries.filter(e => e.type === 'income');
  const allFixed = entries.filter(e => e.type === 'fixed');
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
  const sidebarIncomeCount = document.getElementById('sidebarIncomeCount');
  sidebarIncomeCount.textContent = incomes.length;
  sidebarIncomeCount.hidden = incomes.length === 0;
  document.getElementById('sidebarExpenseCount').textContent = activeFixed.length + variables.length;

  const topbarMonthlyResult = document.getElementById('topbarMonthlyResult');
  if (topbarMonthlyResult) {
    setFinancialAmount(topbarMonthlyResult, dashboardSummary.balance, { signed: true });
  }

  const highlights = getDashboardHighlightValues(
    FinanceData.getAccountBalances(),
    state.accountBalanceFilter,
    accounts,
    accountId => FinanceData.getAccountBalance(accountId),
    dashboardSummary.balance
  );
  setFinancialAmount(document.getElementById('dashboardCurrentBalance'), highlights.currentBalance, { signed: true });
  setFinancialAmount(document.getElementById('dashboardMonthlyResult'), highlights.monthlyResult, { signed: true });

  // Delega para cada tela sua renderização específica
  renderDashboardView(
    dashboardSummary.incomes,
    dashboardSummary.fixed,
    dashboardSummary.variables,
    dashboardSummary.totalIncome,
    dashboardSummary.totalFixed,
    dashboardSummary.totalVariable,
    dashboardSummary.balance,
    ym
  );
  renderIncomesView(incomes, totalIncome);
  // allFixed (com inativos) é passado para permitir gerenciar gastos pausados na tela de Gastos
  renderExpensesView(allFixed, variables, totalFixed, totalVariable, totalExpenses);
  renderLoansView();
  renderAccountsView();
  renderCreditCardsPanel();
  renderContactView();
  renderAdminView();
  updateAdminNavigation();
}

let accountMigrationInProgress = false;
function migrateLegacyAccountAssignments(render = renderAll) {
  if (accountMigrationInProgress || FinanceData.getAccounts().length ||
    !FinanceData.getUnassignedAccountItems().length) return;
  accountMigrationInProgress = true;
  FinanceData.migrateUnassignedAccounts().then(result => {
    if (!result.success) {
      console.error('[GastoPro] Não foi possível atribuir os lançamentos antigos à Conta principal:', result.error);
      showToast('Não foi possível migrar lançamentos sem conta. Tente novamente.', 'error');
      return;
    }
    if (result.migrated) {
      const noticeKey = 'gastopro_account_migration_notice';
      if (!localStorage.getItem(noticeKey)) {
        localStorage.setItem(noticeKey, 'true');
        showToast(`${result.count} lançamento(s) sem conta foram atribuídos à Conta principal.`);
      }
      if (result.syncResult && !result.syncResult.success) {
        showToast('Lançamentos salvos neste aparelho; a sincronização com a nuvem ficará pendente.');
      }
      render();
    }
  }).catch(error => {
    console.error('[GastoPro] Erro ao migrar lançamentos sem conta:', error);
    showToast('Não foi possível migrar lançamentos sem conta. Tente novamente.', 'error');
  }).finally(() => {
    accountMigrationInProgress = false;
  });
}

function getCreditCardIssuerClass(issuerBank) {
  const classes = {
    Nubank: 'nubank',
    'Itaú': 'itau',
    Bradesco: 'bradesco',
    Santander: 'santander',
    'Banco do Brasil': 'banco-do-brasil',
    Caixa: 'caixa',
    Inter: 'inter',
    C6: 'c6',
    BTG: 'btg',
    'Mercado Pago': 'mercado-pago',
    PicPay: 'picpay',
    Outro: 'custom'
  };
  return classes[issuerBank] || 'custom';
}

function renderCreditCardVisual(card, showLimit = false) {
  const isCustom = (card.issuerBank || 'Outro') === 'Outro';
  const color = isCustom && /^#[0-9a-f]{6}$/i.test(card.customColor || '')
    ? ` style="background-color:${card.customColor}"`
    : '';
  return `
    <div class="credit-card-visual credit-card-visual--${getCreditCardIssuerClass(card.issuerBank)}"${color}>
      <div class="credit-card-visual-heading">
        <span>${escapeHtml(card.issuerBank || 'Outro')}</span>
        <span class="credit-card-visual-brand">${escapeHtml(card.brand || 'Outra')}</span>
      </div>
      <div class="credit-card-visual-name">${escapeHtml(card.name)}</div>
      <div class="credit-card-visual-footer">
        <span>${card.lastFour ? `•••• ${escapeHtml(card.lastFour)}` : 'Crédito'}</span>
        ${showLimit ? `<span>Limite ${formatCurrency(card.totalLimit)}</span>` : ''}
      </div>
    </div>`;
}

function updateCreditCardPurchaseFields() {
  const paymentMethod = document.getElementById('expensePaymentMethod');
  const expenseType = document.getElementById('expenseType');
  const creditFields = document.getElementById('expenseCreditFields');
  const accountGroup = document.getElementById('expenseAccountGroup');
  const cardSelect = document.getElementById('expenseCreditCard');
  const installmentsSelect = document.getElementById('expenseInstallments');
  if (!paymentMethod || !expenseType || !creditFields || !accountGroup ||
    !cardSelect || !installmentsSelect) return;

  const cards = FinanceData.getCreditCards();
  const selectedCardId = cardSelect.value;
  cardSelect.innerHTML = cards.length
    ? cards.map(card =>
      `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)}</option>`
    ).join('')
    : '<option value="">Nenhum cartão cadastrado</option>';
  if (cards.some(card => card.id === selectedCardId)) cardSelect.value = selectedCardId;
  const preview = document.getElementById('expenseCreditCardPreview');
  const selectedCard = cards.find(card => card.id === cardSelect.value);
  if (preview) preview.innerHTML = selectedCard ? renderCreditCardVisual(selectedCard) : '';
  if (!installmentsSelect.options.length) {
    installmentsSelect.innerHTML = Array.from({ length: 24 }, (_, index) =>
      `<option value="${index + 1}">${index + 1}x</option>`
    ).join('');
  }

  const useCredit = paymentMethod.value === 'credit_card' && expenseType.value === 'variable';
  creditFields.hidden = !useCredit;
  accountGroup.hidden = useCredit;
  cardSelect.required = useCredit;
  const accountSelect = document.getElementById('expenseAccount');
  const creditAccountSelect = document.getElementById('expenseCreditAccount');
  const hasAccounts = FinanceData.getAccounts().length > 0;
  if (accountSelect) accountSelect.required = hasAccounts && !useCredit;
  if (creditAccountSelect) {
    creditAccountSelect.required = hasAccounts && useCredit;
    if (!useCredit) {
      creditAccountSelect.value = '';
      creditAccountSelect.setCustomValidity('');
    }
  }
  const hint = document.getElementById('expenseCreditCardHint');
  if (hint) {
    hint.textContent = cards.length
      ? 'A parcela será lançada no mês da fatura; o saldo da conta só muda ao pagar.'
      : 'Cadastre um cartão na aba Cartões para usar esta opção.';
  }
}

window.GastoProPaymentHelpers.updateCreditCardPurchaseFields = updateCreditCardPurchaseFields;

function updateAccountSelects() {
  const accounts = FinanceData.getAccounts();
  document.querySelectorAll('.account-select').forEach(select => {
    const selectedId = select.value;
    const options = accounts.length
      ? buildAccountSelectOptions(accounts)
      : [{ value: '', label: 'Confirme uma conta para continuar' }];
    select.innerHTML = options.map(option =>
      `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join('');
    select.value = accounts.some(account => account.id === selectedId) ? selectedId : '';
    const creditFields = document.getElementById('expenseCreditFields');
    const isCreditPurchase = Boolean(creditFields && !creditFields.hidden);
    if (select.id === 'expenseAccount') {
      select.required = accounts.length > 0 && !isCreditPurchase;
    } else if (select.id === 'expenseCreditAccount') {
      select.required = accounts.length > 0 && isCreditPurchase;
      if (!isCreditPurchase) {
        select.value = '';
        select.setCustomValidity('');
      }
    } else {
      select.required = accounts.length > 0;
    }
  });
  const adjustSelect = document.getElementById('adjustAccountId');
  if (adjustSelect) {
    const selectedId = adjustSelect.value;
    adjustSelect.innerHTML = buildAccountSelectOptions(accounts).map(option =>
      `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join('');
    adjustSelect.value = accounts.some(account => account.id === selectedId) ? selectedId : '';
  }
  const wizardSelect = document.getElementById('wizardAccount');
  if (wizardSelect) {
    const selectedId = wizardSelect.value;
    const options = accounts.length
      ? buildAccountSelectOptions(accounts)
      : [{ value: '', label: 'Confirme uma conta para continuar' }];
    wizardSelect.innerHTML = options.map(option =>
      `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
    ).join('');
    wizardSelect.value = accounts.some(account => account.id === selectedId) ? selectedId : '';
    wizardSelect.required = accounts.length > 0;
    const field = wizardSelect.closest('.wizard-account-field');
    if (field) field.hidden = accounts.length === 0;
  }
}

function renderAccountsView() {
  const accounts = FinanceData.getAccounts();
  const list = document.getElementById('accountsList');
  const unassignedPanel = document.getElementById('unassignedEntriesPanel');
  const unassignedList = document.getElementById('unassignedEntriesList');
  const total = document.getElementById('accountsPageTotal');
  setFinancialAmount(total, FinanceData.getAccountBalances().total, { signed: true, tone: 'inverse' });
  if (!list) return;
  const unassigned = FinanceData.getUnassignedAccountItems();
  if (unassignedPanel && unassignedList) {
    unassignedPanel.hidden = !accounts.length || !unassigned.length;
    unassignedList.innerHTML = unassigned.map(item => `
      <article class="manage-item-card">
        <div class="card-item-left">
          <div class="card-item-info">
            <div class="card-item-title">${escapeHtml(item.desc || item.cardName || 'Lançamento')}</div>
            <div class="card-item-meta">${escapeHtml(item.date || item.startMonth || 'Data não informada')} · ${formatCurrency(item.amount)}</div>
          </div>
        </div>
        <div class="form-group">
          <label for="assign-account-${escapeHtml(item.id)}">Escolha a conta</label>
          <select id="assign-account-${escapeHtml(item.id)}" data-action="assign-unassigned-account"
            data-kind="${escapeHtml(item.storageKind)}" data-id="${escapeHtml(item.id)}">
            ${buildAccountSelectOptions(accounts).map(option =>
              `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`
            ).join('')}
          </select>
        </div>
      </article>
    `).join('');
  }

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
          ${account.balanceDate ? '' : '<small class="account-balance-date-note">Informe a data do saldo inicial para filtrar os movimentos considerados.</small>'}
        </div>
      </div>
      <div class="account-item-right">
        <strong class="account-balance-amount ${getFinancialAmountPresentation(FinanceData.getAccountBalance(account.id), { signed: true }).className}">${escapeHtml(getFinancialAmountPresentation(FinanceData.getAccountBalance(account.id), { signed: true }).text)}</strong>
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
  const selector = document.getElementById('accountBalanceView');
  if (!accounts.some(account => `account:${account.id}` === state.accountBalanceFilter) &&
    !['all', 'PF', 'PJ'].includes(state.accountBalanceFilter)) {
    state.accountBalanceFilter = 'all';
  }
  if (selector) {
    selector.innerHTML = getAccountBalanceOptionsMarkup(accounts);
    selector.value = state.accountBalanceFilter;
  }
  const amount = getAccountBalanceForFilter(
    balances, state.accountBalanceFilter, accounts, accountId => FinanceData.getAccountBalance(accountId)
  );
  const filterLabel = getAccountBalanceFilterLabel(accounts, state.accountBalanceFilter);
  setFinancialAmount(display, amount, { signed: true });
  setFinancialAmount(document.getElementById('dashboardCurrentBalance'), amount);
  renderDashboardBalanceWarning(amount);
  if (label) label.textContent = filterLabel;
  if (empty) {
    empty.hidden = accounts.length > 0;
    if (!accounts.length) {
      empty.innerHTML = `
        <p>Nenhuma conta cadastrada.</p>
        <button type="button" class="btn-secondary" data-goto="accounts">
          Cadastrar conta
        </button>`;
    }
  }
  const topbarBalance = document.getElementById('topbarBalance');
  const topbarEmpty = document.getElementById('topbarBalanceEmpty');
  const topbarDateNote = document.getElementById('topbarBalanceDateNote');
  if (topbarBalance) {
    setFinancialAmount(topbarBalance, amount, { signed: true });
    topbarBalance.hidden = accounts.length === 0;
  }
  if (topbarEmpty) topbarEmpty.hidden = accounts.length > 0;
  if (topbarDateNote) topbarDateNote.hidden =
    !accountsNeedBalanceDateNotice(accounts, state.accountBalanceFilter);
  renderFinancialInsights();
}

function renderDashboardBalanceWarning(balance) {
  const warning = document.getElementById('dashboardBalanceWarning');
  const message = document.getElementById('dashboardBalanceWarningText');
  if (!warning || !message) return;

  const now = new Date();
  const actualMonth = getYearMonthString(now.getFullYear(), now.getMonth() + 1);
  const selectedMonth = getYearMonthString(state.currentYear, state.currentMonth);
  const pending = FinanceData.calculatePendingOutflows(
    FinanceData.getByMonth(selectedMonth),
    state.accountBalanceFilter,
    FinanceData.getAccounts()
  );
  const notice = getPendingBalanceNotice(selectedMonth, actualMonth, balance, pending);
  if (!notice) {
    warning.hidden = true;
    warning.classList.remove('is-critical');
    message.textContent = '';
    return;
  }

  warning.hidden = false;
  warning.classList.toggle('is-critical', notice.type === 'critical');
  const icon = warning.querySelector('i');
  if (icon) {
    icon.className = `fa-solid ${notice.type === 'critical'
      ? 'fa-circle-exclamation'
      : 'fa-triangle-exclamation'}`;
  }
  message.textContent = getPendingBalanceNoticeMessage(notice);
}

function getCreditCardEmptyStateMarkup() {
  return `
    <p>Nenhum cartão cadastrado ainda.</p>
    <button type="button" class="btn-primary empty-state-action" data-action="new-credit-card">
      Cadastrar cartão
    </button>`;
}

function renderCreditCardsPanel() {
  const container = document.getElementById('creditCardsList');
  if (!container) return;
  const empty = document.getElementById('creditCardsEmpty');
  const accounts = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  const cards = FinanceData.getCreditCards();
  if (empty) empty.hidden = cards.length > 0;
  if (empty && !cards.length) {
    empty.innerHTML = getCreditCardEmptyStateMarkup();
  }
  const purchases = FinanceData.getCreditCardPurchases();
  container.innerHTML = cards.map(card => {
    const previousSpent = Number(card.previousSpent) || 0;
    const usage = window.GastoProCreditCardHelpers.calculateLimitUsage(
      card, purchases, previousSpent
    );
    const presentation = getCreditCardUsagePresentation(usage.alert);
    const nextDueDate = window.GastoProCreditCardHelpers.getNextDueDate(card);
    return `
    <article class="manage-item-card credit-card-item ${presentation.className}"
      data-card-id="${escapeHtml(card.id)}">
      <div class="card-item-left">
        <div class="card-item-info">
          ${renderCreditCardVisual(card, true)}
          <div class="card-item-meta">
            <span>Fecha dia ${card.closingDay} · próximo vencimento ${nextDueDate ? escapeHtml(formatDate(nextDueDate)) : 'não disponível'}</span>
            ${previousSpent > 0 ? `<span>Inclui ${escapeHtml(formatCurrency(previousSpent))} informado antes do app</span>` : ''}
            ${accounts.has(card.accountId) ? `<span>${escapeHtml(accounts.get(card.accountId))}</span>` : ''}
          </div>
          <div class="credit-card-usage">
            <div class="credit-card-usage-labels">
              <span>Usado: <strong class="financial-amount financial-amount--neutral">${escapeHtml(formatCurrency(usage.used))}</strong></span>
              <span>Disponível: <strong class="${getFinancialAmountPresentation(usage.available).className}">${escapeHtml(getFinancialAmountPresentation(usage.available).text)}</strong></span>
            </div>
            <progress class="credit-card-usage-progress" value="${Math.min(100, usage.percent)}" max="100"
              aria-label="Uso do limite de ${escapeHtml(card.name)}"
              aria-valuetext="${Math.round(usage.percent)}% usado"></progress>
            ${presentation.message ? `<p class="credit-card-usage-alert">${presentation.message}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="card-item-actions">
        <button type="button" class="btn-action-edit" data-action="edit-credit-card" data-id="${escapeHtml(card.id)}" aria-label="Editar cartão ${escapeHtml(card.name)}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="btn-action-delete" data-action="delete-credit-card" data-id="${escapeHtml(card.id)}" aria-label="Excluir cartão ${escapeHtml(card.name)}" title="Excluir">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </article>
  `;}).join('');
}

function getCreditCardDashboardSummary(
  cards, purchases, fromDate = new Date()
) {
  const cardList = Array.isArray(cards) ? cards : [];
  const purchaseList = Array.isArray(purchases) ? purchases : [];
  const used = cardList.reduce((sum, card) => {
    return sum + window.GastoProCreditCardHelpers.calculateLimitUsage(
      card, purchaseList, Number(card.previousSpent) || 0
    ).used;
  }, 0);
  const nextDueDate = cardList.map(card =>
    window.GastoProCreditCardHelpers.getNextDueDate(card, fromDate)
  ).filter(Boolean).sort()[0] || null;
  return {
    cardCount: cardList.length,
    used: Math.round(used * 100) / 100,
    nextDueDate
  };
}

function renderCreditCardDashboardSummary(summary) {
  if (!summary.cardCount) {
    return `
      <button type="button" class="dashboard-card-summary is-empty" data-action="open-credit-cards"
        aria-label="Abrir Cartões e cadastrar um cartão">
        <strong>Cartões</strong>
        <span>Nenhum cartão cadastrado. Abrir carteira para começar.</span>
      </button>`;
  }
  return `
    <button type="button" class="dashboard-card-summary" data-action="open-credit-cards"
      aria-label="Abrir Cartões. Limite usado ${escapeHtml(formatCurrency(summary.used))}.">
      <strong>Cartões</strong>
      <span>Limite usado: <b>${escapeHtml(formatCurrency(summary.used))}</b></span>
      <span>Próximo vencimento: <b>${summary.nextDueDate
        ? escapeHtml(formatDate(summary.nextDueDate))
        : 'não disponível'}</b></span>
    </button>`;
}

function renderDashboardCreditCardSummary() {
  const container = document.getElementById('dashboardCreditCardSummary');
  if (!container) return;
  const accounts = FinanceData.getAccounts();
  const cards = filterFinancialItemsByAccount(
    FinanceData.getCreditCards(), accounts, state.accountBalanceFilter
  );
  const purchases = filterFinancialItemsByAccount(
    FinanceData.getCreditCardPurchases(), accounts, state.accountBalanceFilter
  );
  const summary = getCreditCardDashboardSummary(
    cards,
    purchases
  );
  container.innerHTML = renderCreditCardDashboardSummary(summary);
}

function openCreditCardsView() {
  window.switchToView('cards');
}

function getCreditCardUsagePresentation(alert) {
  if (alert === 'full') {
    return { className: 'credit-card-usage--full', message: 'Limite atingido ou excedido.' };
  }
  if (alert === 'warning') {
    return { className: 'credit-card-usage--warning', message: 'Atenção: uso igual ou acima de 80%.' };
  }
  return { className: '', message: '' };
}

function getFinancialAmountPresentation(value, { signed = false, tone = 'auto' } = {}) {
  const amount = Number(value) || 0;
  const resolvedTone = tone === 'auto'
    ? amount > 0 ? 'positive' : amount < 0 ? 'negative' : 'neutral'
    : tone;
  const sign = signed && amount > 0 ? '+ ' : amount < 0 ? '− ' : '';
  return {
    text: `${sign}${formatCurrency(Math.abs(amount))}`,
    className: `financial-amount financial-amount--${resolvedTone}`
  };
}

function setFinancialAmount(element, value, options = {}) {
  if (!element) return;
  const presentation = getFinancialAmountPresentation(value, options);
  element.textContent = presentation.text;
  element.classList.remove(
    'financial-amount--positive',
    'financial-amount--negative',
    'financial-amount--neutral'
  );
  presentation.className.split(' ').forEach(className => element.classList.add(className));
}

function normalizeInsightDescription(description) {
  const monthNames = new Set([
    'jan', 'janeiro', 'fev', 'fevereiro', 'mar', 'marco', 'abril', 'abr',
    'mai', 'maio', 'jun', 'junho', 'jul', 'julho', 'ago', 'agosto', 'set',
    'setembro', 'out', 'outubro', 'nov', 'novembro', 'dez', 'dezembro'
  ]);
  return String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 1 && !monthNames.has(token));
}

function areInsightDescriptionsSimilar(left, right) {
  const leftTokens = new Set(normalizeInsightDescription(left));
  const rightTokens = new Set(normalizeInsightDescription(right));
  if (!leftTokens.size || !rightTokens.size) return false;
  const overlap = [...leftTokens].filter(token => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size) >= 0.6;
}

function findSimilarCategoryEntries(source, entries, category) {
  if (!source || !Array.isArray(entries)) return [];
  return entries.filter(entry =>
    entry && entry.id !== source.id &&
    entry.type === source.type &&
    GastoProCategories.normalize(entry.category || '') !== GastoProCategories.normalize(category || '') &&
    areInsightDescriptionsSimilar(source.desc, entry.desc)
  );
}

function calculateCategoryAnomalies(currentExpenses, historicalExpenses, multiplier = 1.5, minimumHistory = 3) {
  const historyByCategory = new Map();
  (historicalExpenses || []).forEach(item => {
    if (!item || !['fixed', 'variable'].includes(item.type) || item.active === false) return;
    const category = GastoProCategories.normalize(item.category || 'Outros');
    const amounts = historyByCategory.get(category) || [];
    amounts.push(Number(item.amount) || 0);
    historyByCategory.set(category, amounts);
  });
  return (currentExpenses || [])
    .filter(item => item && ['fixed', 'variable'].includes(item.type) && item.active !== false)
    .map(item => {
      const category = GastoProCategories.normalize(item.category || 'Outros');
      const history = historyByCategory.get(category) || [];
      const average = history.length
        ? history.reduce((sum, amount) => sum + amount, 0) / history.length
        : 0;
      return { item, category, average, historyCount: history.length };
    })
    .filter(result =>
      result.historyCount >= minimumHistory &&
      result.average > 0 &&
      Number(result.item.amount) > result.average * multiplier
    )
    .sort((left, right) =>
      Number(right.item.amount) / right.average - Number(left.item.amount) / left.average
    );
}

function calculateMonthEndForecast(currentBalance, pendingItems, today, monthEnd, minimumMovements = 2) {
  const movements = (pendingItems || []).filter(item =>
    item && item.paid !== true &&
    item.active !== false &&
    !item.isCardInstallment &&
    typeof item.date === 'string' &&
    item.date >= today && item.date <= monthEnd &&
    (item.type === 'income' || ['fixed', 'variable', 'debt'].includes(item.type))
  );
  if (movements.length < minimumMovements) return null;
  const pendingTotal = movements.reduce((total, item) =>
    total + (item.type === 'income' ? 1 : -1) * (Number(item.amount) || 0), 0
  );
  return {
    amount: Math.round((Number(currentBalance) + pendingTotal) * 100) / 100,
    movementCount: movements.length
  };
}

function calculateUpcomingDueWarning(currentBalance, pendingItems, today, horizonDays = 7) {
  const todayDate = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(todayDate.getTime())) return null;
  const horizon = new Date(todayDate.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const movements = (pendingItems || []).filter(item =>
    item && item.paid !== true &&
    item.active !== false &&
    !item.isCardInstallment &&
    typeof item.date === 'string' &&
    item.date >= today && item.date <= horizon &&
    (item.type === 'income' || ['fixed', 'variable', 'debt'].includes(item.type))
  );
  const dueExpenses = movements.filter(item => item.type !== 'income');
  if (!dueExpenses.length) return null;
  const byDate = new Map();
  movements.forEach(item => {
    byDate.set(item.date, (byDate.get(item.date) || 0) +
      (item.type === 'income' ? 1 : -1) * (Number(item.amount) || 0));
  });
  let runningBalance = Number(currentBalance) || 0;
  let lowestBalance = runningBalance;
  [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([, amount]) => {
    runningBalance += amount;
    lowestBalance = Math.min(lowestBalance, runningBalance);
  });
  return {
    dueCount: dueExpenses.length,
    dueTotal: dueExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    insufficientAmount: Math.max(0, Math.round(-lowestBalance * 100) / 100)
  };
}

function countUncoveredDueExpenses(currentBalance, dueItems) {
  const groupedByDate = new Map();
  dueItems.forEach(item => {
    if (!groupedByDate.has(item.date)) groupedByDate.set(item.date, []);
    groupedByDate.get(item.date).push(item);
  });
  let runningBalance = Number(currentBalance) || 0;
  let uncoveredCount = 0;
  [...groupedByDate.entries()].sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, items]) => {
      items.filter(item => item.type === 'income').forEach(item => {
        runningBalance += Number(item.amount) || 0;
      });
      items.filter(item => item.type !== 'income').forEach(item => {
        runningBalance -= Number(item.amount) || 0;
        if (runningBalance < 0) uncoveredCount++;
      });
    });
  return uncoveredCount;
}

function getLatestOverdueTemplateItems(templates, today) {
  const todayDate = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(todayDate.getTime())) return [];
  const currentMonthDate = new Date(Date.UTC(
    todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1
  ));
  const previousMonthDate = new Date(Date.UTC(
    currentMonthDate.getUTCFullYear(), currentMonthDate.getUTCMonth() - 1, 1
  ));
  const results = [];

  (templates || []).forEach(template => {
    if (!template || template.active === false) return;
    const startMonth = /^\d{4}-\d{2}$/.test(template.startMonth || '')
      ? template.startMonth : null;
    if (!startMonth) return;
    const startDate = new Date(`${startMonth}-01T00:00:00Z`);
    if (Number.isNaN(startDate.getTime())) return;
    const endMonth = /^\d{4}-\d{2}$/.test(template.endMonth || '')
      ? template.endMonth : null;
    let cursor = new Date(previousMonthDate);
    if (endMonth && endMonth < cursor.toISOString().slice(0, 7)) {
      const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
      cursor = new Date(Date.UTC(endYear, endMonthNumber - 1, 1));
    }

    while (cursor >= startDate) {
      const month = cursor.toISOString().slice(0, 7);
      if (!(template.paidMonths && template.paidMonths[month])) {
        const [year, monthNumber] = month.split('-').map(Number);
        const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
        const rawDay = Number.parseInt(template.day || '05', 10);
        const day = Math.min(Number.isInteger(rawDay) && rawDay > 0 ? rawDay : 5, monthEnd);
        const dueDate = `${month}-${String(day).padStart(2, '0')}`;
        if (dueDate < today) {
          results.push({
            id: template.id,
            desc: template.desc,
            type: 'fixed',
            category: template.category || 'Contas',
            accountId: template.accountId || null,
            date: dueDate,
            paid: false,
            active: true
          });
        }
        break;
      }
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
  });
  return results;
}

function buildMonthlyFinancialSummary(currentItems, previousItems) {
  const calculateTotals = items => {
    const eligible = (items || []).filter(item =>
      item && item.active !== false &&
      (item.type === 'income' || item.type === 'fixed' || item.type === 'variable')
    );
    const income = eligible.filter(item => item.type === 'income')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const expenses = eligible.filter(item => item.type !== 'income');
    const expenseTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const categories = new Map();
    expenses.forEach(item => {
      const name = item.category || 'Outros';
      categories.set(name, (categories.get(name) || 0) + (Number(item.amount) || 0));
    });
    return { income, expenses: expenseTotal, categories };
  };
  const current = calculateTotals(currentItems);
  if (!current.income && !current.expenses) return null;
  const previous = calculateTotals(previousItems);
  return {
    income: current.income,
    expenses: current.expenses,
    result: current.income - current.expenses,
    previousExpenses: previous.expenses,
    expenseChange: previous.expenses > 0
      ? ((current.expenses - previous.expenses) / previous.expenses) * 100
      : null,
    topCategories: [...current.categories.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3)
  };
}

function filterFinancialItemsByAccount(items, accounts, filter) {
  if (filter === 'all') return items;
  const accountTypeById = new Map(accounts.map(account => [account.id, account.type]));
  if (filter === 'PF' || filter === 'PJ') {
    return items.filter(item => item.accountId && accountTypeById.get(item.accountId) === filter);
  }
  if (filter.startsWith('account:')) {
    const accountId = filter.slice('account:'.length);
    return items.filter(item => item.accountId === accountId);
  }
  return items;
}

const GOOGLE_SIGN_IN_ERROR_MESSAGE =
  'Não foi possível entrar com Google. Tente novamente ou use e-mail e senha.';

function getGoogleOAuthRedirectTo(location) {
  return `${location.origin}${location.pathname}`;
}

function hasGoogleOAuthError(search, hash) {
  const searchParams = new URLSearchParams(search || '');
  const hashParams = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  return ['error', 'error_description'].some(key =>
    searchParams.has(key) || hashParams.has(key)
  );
}

function canStartGoogleSignIn(isRegistering, privacyConsentAccepted) {
  return !isRegistering || privacyConsentAccepted === true;
}

function applyGoogleAuthPriority(documentRef) {
  const loginTab = documentRef.getElementById('tabLoginBtn');
  const googleButton = documentRef.getElementById('googleSignInBtn');
  const tabs = loginTab && loginTab.parentElement;
  if (!tabs || !googleButton) return false;
  tabs.insertAdjacentElement('afterend', googleButton);
  googleButton.classList.add('btn-primary');
  ['submitLoginBtn', 'submitRegisterBtn'].forEach(id => {
    const button = documentRef.getElementById(id);
    if (!button) return;
    button.classList.remove('btn-primary');
    button.classList.add('btn-secondary');
  });
  return true;
}

function createGoogleSignInHandler(button, signIn, showError) {
  let inProgress = false;
  return async function handleGoogleSignIn() {
    if (inProgress) return false;
    inProgress = true;
    button.disabled = true;
    try {
      await signIn();
      return true;
    } catch (error) {
      showError(GOOGLE_SIGN_IN_ERROR_MESSAGE);
      inProgress = false;
      button.disabled = false;
      return false;
    }
  };
}

window.GastoProGoogleAuthHelpers = Object.freeze({
  errorMessage: GOOGLE_SIGN_IN_ERROR_MESSAGE,
  getRedirectTo: getGoogleOAuthRedirectTo,
  hasOAuthError: hasGoogleOAuthError,
  canStartSignIn: canStartGoogleSignIn,
  createSignInHandler: createGoogleSignInHandler,
  applyPriority: applyGoogleAuthPriority
});

function createUpdateReloadScheduler({ isBusy, reload, notify, schedule = (callback, delay) => window.setTimeout(callback, delay) }) {
  let timer = null;
  let requested = false;
  let completed = false;
  let noticeShown = false;

  const attemptReload = () => {
    timer = null;
    if (!requested || completed) return;
    if (isBusy()) {
      if (!noticeShown) {
        notify();
        noticeShown = true;
      }
      timer = schedule(attemptReload, 1000);
      return;
    }
    requested = false;
    completed = true;
    reload();
  };

  return Object.freeze({
    request() {
      if (completed) return false;
      requested = true;
      if (timer !== null) return false;
      attemptReload();
      return true;
    },
    isPending() {
      return requested && !completed;
    }
  });
}

window.GastoProUpdateReloadHelpers = Object.freeze({
  createScheduler: createUpdateReloadScheduler
});

function getDashboardAccountSummary(items, accounts, filter) {
  const filteredItems = filterFinancialItemsByAccount(items, accounts, filter);
  const incomes = filteredItems.filter(item => item.type === 'income');
  const fixed = filteredItems.filter(item =>
    item.type === 'fixed' && (item.active !== false || item.paid)
  );
  const variables = filteredItems.filter(item => item.type === 'variable');
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalFixed = fixed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalVariable = variables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    items: filteredItems,
    incomes,
    fixed,
    variables,
    totalIncome,
    totalFixed,
    totalVariable,
    balance: totalIncome - totalFixed - totalVariable
  };
}

window.GastoProAccountFilterHelpers = Object.freeze({
  filterItems: filterFinancialItemsByAccount,
  getDashboardSummary: getDashboardAccountSummary
});

const NOTIFICATION_PREFERENCES_KEY = 'gastopro_notification_preferences_v1';
const NOTIFICATION_ITEMS_KEY = 'gastopro_notifications_v1';
const NOTIFICATION_TYPES = Object.freeze({
  dueSoon: 'Vencimentos próximos',
  insufficientBalance: 'Saldo insuficiente',
  anomaly: 'Gastos fora do padrão',
  cardLimit: 'Limite do cartão',
  forecast: 'Previsão do fim do mês',
  importReview: 'Pagamentos importados para conferir',
  adminFeedback: 'Novas mensagens do Fale comigo'
});
const NOTIFICATION_PRIORITY_RANK = Object.freeze({ critical: 3, attention: 2, info: 1 });
const NOTIFICATION_PRIORITY_PRESENTATION = Object.freeze({
  critical: { label: 'Crítico', icon: 'fa-circle-exclamation' },
  attention: { label: 'Atenção', icon: 'fa-triangle-exclamation' },
  info: { label: 'Info', icon: 'fa-circle-info' }
});

function getNotificationPriority(item) {
  if (item && Object.prototype.hasOwnProperty.call(NOTIFICATION_PRIORITY_RANK, item.priority)) {
    return item.priority;
  }
  if (!item) return 'info';
  if (item.type === 'insufficientBalance') return 'critical';
  if (item.type === 'anomaly') return 'attention';
  if (item.type === 'forecast') return 'info';
  if (item.type === 'cardLimit') {
    return /100\s*%|atingido|excedido/i.test(`${item.title || ''} ${item.message || ''}`)
      ? 'critical' : 'attention';
  }
  if (item.type === 'dueSoon') {
    return /atrasado|vence hoje|vencimento hoje|hoje ou atrasado/i.test(item.title || '')
      ? 'critical' : 'attention';
  }
  return 'info';
}

function getNotificationPriorityPresentation(item) {
  return NOTIFICATION_PRIORITY_PRESENTATION[getNotificationPriority(item)];
}

function getNotificationPreferences() {
  const preferences = Object.fromEntries(
    Object.keys(NOTIFICATION_TYPES).map(type => [type, true])
  );
  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (!stored) return preferences;
    const parsed = JSON.parse(stored);
    Object.keys(NOTIFICATION_TYPES).forEach(type => {
      if (typeof parsed[type] === 'boolean') preferences[type] = parsed[type];
    });
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler as preferências de avisos:', error);
  }
  return preferences;
}

function saveNotificationPreferences(preferences) {
  const next = getNotificationPreferences();
  Object.keys(NOTIFICATION_TYPES).forEach(type => {
    if (typeof preferences[type] === 'boolean') next[type] = preferences[type];
  });
  try {
    localStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar as preferências de avisos:', error);
    throw error;
  }
}

function getStoredNotifications() {
  try {
    const stored = localStorage.getItem(NOTIFICATION_ITEMS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Formato inválido para os avisos salvos.');
    return parsed.filter(item =>
      item && typeof item.eventKey === 'string' &&
      Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, item.type) &&
      typeof item.title === 'string' &&
      typeof item.message === 'string' &&
      typeof item.read === 'boolean' &&
      typeof item.dismissed === 'boolean' &&
      (!item.destination || (
        typeof item.destination.screen === 'string' &&
        typeof item.destination.month === 'string' &&
        (!item.destination.target || typeof item.destination.target === 'string') &&
        Array.isArray(item.destination.ids) &&
        item.destination.ids.every(id => typeof id === 'string')
      ))
    );
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler os avisos salvos:', error);
    return [];
  }
}

function storeNotifications(items) {
  try {
    localStorage.setItem(NOTIFICATION_ITEMS_KEY, JSON.stringify(items));
    return items;
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar os avisos:', error);
    throw error;
  }
}

function syncNotificationEvents(candidates) {
  const preferences = getNotificationPreferences();
  const stored = getStoredNotifications();
  const byEvent = new Map(stored.map(item => [item.eventKey, item]));
  (Array.isArray(candidates) ? candidates : []).forEach(candidate => {
    if (!candidate || !Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, candidate.type) ||
      !preferences[candidate.type] || typeof candidate.eventKey !== 'string' ||
      typeof candidate.title !== 'string' || typeof candidate.message !== 'string') return;
    const previous = byEvent.get(candidate.eventKey);
    byEvent.set(candidate.eventKey, {
      eventKey: candidate.eventKey,
      scope: typeof candidate.scope === 'string' ? candidate.scope : 'all',
      type: candidate.type,
      priority: getNotificationPriority(candidate),
      title: candidate.title,
      message: candidate.message,
      createdAt: previous ? previous.createdAt : candidate.createdAt || new Date().toISOString(),
      read: candidate.type === 'adminFeedback' ? false : previous ? previous.read : false,
      dismissed: previous ? previous.dismissed : false,
      ...(candidate.destination ? { destination: candidate.destination } : {})
    });
  });
  return storeNotifications([...byEvent.values()]);
}

function updateStoredNotification(eventKey, changes) {
  const notifications = getStoredNotifications();
  const index = notifications.findIndex(item => item.eventKey === eventKey);
  if (index < 0) return notifications;
  notifications[index] = { ...notifications[index], ...changes };
  return storeNotifications(notifications);
}

function getVisibleNotifications(scope = 'all') {
  const preferences = getNotificationPreferences();
  return getStoredNotifications().filter(item =>
    !item.dismissed &&
    preferences[item.type] &&
    (item.type === 'adminFeedback'
      ? adminViewState.access === 'allowed'
      : (item.scope || 'all') === scope)
  ).sort((left, right) =>
    NOTIFICATION_PRIORITY_RANK[getNotificationPriority(right)] -
      NOTIFICATION_PRIORITY_RANK[getNotificationPriority(left)] ||
    String(right.createdAt).localeCompare(String(left.createdAt))
  );
}

function getNotificationUnreadCount(scope = 'all') {
  return getVisibleNotifications(scope).filter(item => !item.read).length;
}

function getUnreadAdminFeedbackCount() {
  return adminViewState.access === 'allowed' ? adminUnreadFeedbackIds.size : 0;
}

function syncAdminFeedbackNotifications(ids) {
  const activeIds = new Set((Array.isArray(ids) ? ids : [])
    .filter(id => typeof id === 'string'));
  adminUnreadFeedbackIds.clear();
  activeIds.forEach(id => adminUnreadFeedbackIds.add(id));
  const stored = getStoredNotifications();
  const filtered = stored.filter(item =>
    item.type !== 'adminFeedback' ||
    activeIds.has(item.eventKey.slice('adminFeedback:'.length))
  );
  if (filtered.length !== stored.length) storeNotifications(filtered);

  if (adminViewState.access !== 'allowed') return [];
  const candidates = [...activeIds].map(id => ({
    eventKey: `adminFeedback:${id}`,
    scope: 'all',
    type: 'adminFeedback',
    priority: 'attention',
    title: 'Nova mensagem no Fale comigo',
    message: 'Há uma mensagem não lida no painel Admin.',
    destination: { screen: 'admin', month: '', ids: [] }
  }));
  syncNotificationEvents(candidates);
  return getStoredNotifications().filter(item => item.type === 'adminFeedback');
}

function markNotificationAsRead(eventKey) {
  const notification = getStoredNotifications().find(item => item.eventKey === eventKey);
  if (notification && notification.type === 'adminFeedback') {
    return markAdminFeedbackRead(eventKey.slice('adminFeedback:'.length));
  }
  return updateStoredNotification(eventKey, { read: true });
}

function dismissNotification(eventKey) {
  const notification = getStoredNotifications().find(item => item.eventKey === eventKey);
  if (notification && notification.type === 'adminFeedback') {
    return updateStoredNotification(eventKey, { dismissed: true });
  }
  return updateStoredNotification(eventKey, { read: true, dismissed: true });
}

function clearAllNotifications() {
  return storeNotifications(getStoredNotifications().map(item => ({
    ...item,
    read: item.type === 'adminFeedback' ? false : true,
    dismissed: true
  })));
}

function clearNotificationPreferences() {
  try {
    localStorage.removeItem(NOTIFICATION_PREFERENCES_KEY);
    return true;
  } catch (error) {
    console.error('[GastoPro] Não foi possível apagar as preferências de avisos:', error);
    return false;
  }
}

function getPaidImportReviewStorageKey(userId) {
  const profile = FinanceData.getProfile();
  const scopedUserId = userId || FinanceData.getActiveUserId() ||
    (profile && profile.userId) || 'local';
  return `gastopro_paid_import_review_v1:${scopedUserId}`;
}

function getPaidImportReviewIds(userId) {
  const key = getPaidImportReviewStorageKey(userId);
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Formato inválido para IDs de pagamentos a revisar.');
    return [...new Set(parsed.filter(id => typeof id === 'string' && id.length > 0))];
  } catch (error) {
    console.warn('[GastoPro] Não foi possível ler os pagamentos importados para revisão:', error);
    return [];
  }
}

function savePaidImportReviewIds(ids, userId) {
  const key = getPaidImportReviewStorageKey(userId);
  const normalizedIds = [...new Set((Array.isArray(ids) ? ids : [])
    .filter(id => typeof id === 'string' && id.length > 0))];
  try {
    localStorage.setItem(key, JSON.stringify(normalizedIds));
    return normalizedIds;
  } catch (error) {
    console.error('[GastoPro] Não foi possível salvar os pagamentos importados para revisão:', error);
    throw error;
  }
}

function addPaidImportReviewIds(ids, userId) {
  return savePaidImportReviewIds([...getPaidImportReviewIds(userId), ...ids], userId);
}

function removePaidImportReviewId(id, userId) {
  return savePaidImportReviewIds(
    getPaidImportReviewIds(userId).filter(reviewId => reviewId !== id),
    userId
  );
}

function buildPaidImportReviewNotice(ids, entries) {
  const entriesById = new Map((Array.isArray(entries) ? entries : [])
    .filter(entry => entry && typeof entry.id === 'string')
    .map(entry => [entry.id, entry]));
  const reviewIds = [...new Set(ids)]
    .filter(id => {
      const entry = entriesById.get(id);
      return entry && entry.paid === true && requiresImportPaymentReview(entry, entry.category);
    })
    .sort();
  if (!reviewIds.length) return null;

  const months = reviewIds.map(id => {
    const entry = entriesById.get(id);
    return entry.month || String(entry.date || '').slice(0, 7);
  }).filter(month => /^\d{4}-\d{2}$/.test(month)).sort();
  const primaryEntry = entriesById.get(reviewIds[0]);
  const eventMonth = primaryEntry.month || String(primaryEntry.date || '').slice(0, 7) || 'unknown';
  return {
    eventKey: getStableNotificationEventKey('importReview', reviewIds[0], eventMonth),
    scope: 'all',
    type: 'importReview',
    priority: 'attention',
    title: 'Conferência de importação',
    message: `${reviewIds.length} itens importados como pagos precisam de conferência`,
    destination: {
      screen: 'entries',
      month: months[0] || '',
      ids: reviewIds
    }
  };
}

function syncPaidImportReviewNotification() {
  const reviewIds = getPaidImportReviewIds();
  const entries = FinanceData.getEntries();
  const notice = buildPaidImportReviewNotice(reviewIds, entries);
  const validIds = notice ? notice.destination.ids : [];
  if (validIds.length !== reviewIds.length ||
    validIds.some((id, index) => id !== reviewIds[index])) {
    savePaidImportReviewIds(validIds);
  }

  const notifications = getStoredNotifications();
  const filtered = notifications.filter(item =>
    item.type !== 'importReview' || item.dismissed ||
    Boolean(notice && item.eventKey === notice.eventKey)
  );
  if (filtered.length !== notifications.length) storeNotifications(filtered);
  if (notice) syncNotificationEvents([notice]);
  return notice;
}

window.GastoProImportReview = {
  getStorageKey: getPaidImportReviewStorageKey,
  getIds: getPaidImportReviewIds,
  saveIds: savePaidImportReviewIds,
  addIds: addPaidImportReviewIds,
  removeId: removePaidImportReviewId,
  buildNotice: buildPaidImportReviewNotice,
  syncNotice: syncPaidImportReviewNotification,
  markReviewed: markImportedPaidAsReviewed,
  setPending: changeImportedPaidToPending
};

function renderNotificationCenter() {
  const trigger = document.getElementById('notificationsTrigger');
  const count = document.getElementById('notificationsUnreadCount');
  const unreadLabel = document.getElementById('notificationsUnreadLabel');
  const list = document.getElementById('notificationsList');
  const settings = document.getElementById('notificationSettingsList');
  const mobileSummary = document.getElementById('financialInsightsMobileSummary');
  if (!trigger || !count || !unreadLabel || !list || !settings) return;

  const scope = state.accountBalanceFilter;
  const visible = getVisibleNotifications(scope);
  const unreadItems = visible.filter(item => !item.read);
  const unread = unreadItems.length;
  adminViewState.newCount = getUnreadAdminFeedbackCount();
  updateAdminNavigation();
  if (mobileSummary) mobileSummary.textContent = getMobileNotificationSummary(unread);
  const highestPriority = unreadItems.length ? getNotificationPriority(unreadItems[0]) : 'none';
  count.textContent = unread > 99 ? '99+' : String(unread);
  count.hidden = unread === 0;
  trigger.dataset.priority = highestPriority;
  count.dataset.priority = highestPriority;
  trigger.setAttribute('aria-label', unread
    ? `Abrir avisos, ${unread} não lido${unread === 1 ? '' : 's'}`
    : 'Abrir avisos');
  unreadLabel.textContent = unread
    ? `${unread} aviso${unread === 1 ? '' : 's'} não lido${unread === 1 ? '' : 's'}`
    : 'Nenhum aviso não lido';

  list.innerHTML = visible.length
    ? visible.map(item => {
      const priority = getNotificationPriority(item);
      const presentation = getNotificationPriorityPresentation(item);
      return `
      <article class="notification-item ${item.read ? '' : 'is-unread'}" data-priority="${priority}">
        <button type="button" class="notification-item-content notification-item-navigation"
          data-action="notification-navigate" data-event-key="${escapeHtml(item.eventKey)}"
          aria-label="Abrir ${escapeHtml(item.title)}: ${escapeHtml(item.message)}">
          <div class="notification-priority">
            <i class="fa-solid ${presentation.icon}" aria-hidden="true"></i>
            <span>${presentation.label}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.message)}</p>
        </button>
        <div class="notification-item-actions">
          ${item.read ? '' : `<button type="button" class="notification-action" data-action="notification-mark-read" data-event-key="${escapeHtml(item.eventKey)}">Marcar como lido</button>`}
          <button type="button" class="notification-action" data-action="notification-dismiss" data-event-key="${escapeHtml(item.eventKey)}">Dispensar</button>
        </div>
      </article>
    `;
    }).join('')
    : '<p class="notifications-empty">Nenhum aviso por enquanto.</p>';

  const preferences = getNotificationPreferences();
  settings.innerHTML = Object.entries(NOTIFICATION_TYPES).map(([type, label]) => `
    <label class="notification-setting">
      <input type="checkbox" data-notification-type="${escapeHtml(type)}"
        ${preferences[type] ? 'checked' : ''}>
      <span>${escapeHtml(label)}</span>
    </label>
  `).join('');
}

function notificationEventPathContains(event, element) {
  if (!element) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.length
    ? path.includes(element)
    : event.target instanceof Node && element.contains(event.target);
}

window.GastoProNotificationCenter = {
  TYPES: NOTIFICATION_TYPES,
  PREFERENCES_KEY: NOTIFICATION_PREFERENCES_KEY,
  ITEMS_KEY: NOTIFICATION_ITEMS_KEY,
  getPriority: getNotificationPriority,
  getPriorityPresentation: getNotificationPriorityPresentation,
  getPreferences: getNotificationPreferences,
  savePreferences: saveNotificationPreferences,
  getItems: getStoredNotifications,
  syncEvents: syncNotificationEvents,
  getVisible: getVisibleNotifications,
  getUnreadCount: getNotificationUnreadCount,
  syncAdminFeedback: syncAdminFeedbackNotifications,
  getAdminFeedbackUnreadCount: getUnreadAdminFeedbackCount,
  getAdminFeedbackUnreadIds: () => [...adminUnreadFeedbackIds],
  markFeedbackRead: markAdminFeedbackRead,
  markFeedbackUnread: markAdminFeedbackUnread,
  archiveFeedback: id => updateAdminFeedbackArchive(id, true),
  unarchiveFeedback: id => updateAdminFeedbackArchive(id, false),
  refreshAdminFeedbackNotifications,
  markRead: markNotificationAsRead,
  dismiss: dismissNotification,
  clearAll: clearAllNotifications,
  navigate: navigateToNotification,
  clearPreferences: clearNotificationPreferences,
  eventPathContains: notificationEventPathContains,
  render: renderNotificationCenter
};

let notificationHighlightTimeout;

function navigateToNotification(eventKey) {
  const notice = getStoredNotifications().find(item =>
    item.eventKey === eventKey && !item.dismissed
  );
  if (!notice || !notice.destination) return false;
  const destination = notice.destination;
  const viewId = destination.screen === 'entries' ? 'expenses' : destination.screen;
  if (!VIEW_TITLES[viewId]) return false;

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(destination.month || '')) {
    const [year, month] = destination.month.split('-').map(Number);
    state.currentYear = year;
    state.currentMonth = month;
  }
  if (notice.type === 'adminFeedback') {
    markAdminFeedbackRead(eventKey.slice('adminFeedback:'.length));
  } else {
    markNotificationAsRead(eventKey);
  }
  const notificationsPanel = document.getElementById('notificationsPanel');
  const notificationsTrigger = document.getElementById('notificationsTrigger');
  if (notificationsPanel) notificationsPanel.hidden = true;
  if (notificationsTrigger) notificationsTrigger.setAttribute('aria-expanded', 'false');
  window.switchToView(viewId);

  window.requestAnimationFrame(() => {
    const targets = [];
    if (destination.target) {
      const target = document.getElementById(destination.target);
      if (target) targets.push(target);
    } else {
      const selector = destination.screen === 'cards'
        ? '[data-card-id]'
        : '[data-entry-id]';
      document.querySelectorAll(selector).forEach(element => {
        const id = destination.screen === 'cards'
          ? element.getAttribute('data-card-id')
          : element.getAttribute('data-entry-id');
        if (destination.ids.includes(id)) targets.push(element);
      });
    }
    if (notificationHighlightTimeout) clearTimeout(notificationHighlightTimeout);
    targets.forEach(target => target.classList.add('notification-destination-highlight'));
    if (targets.length) {
      targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (!targets[0].hasAttribute('tabindex')) targets[0].setAttribute('tabindex', '-1');
      targets[0].focus({ preventScroll: true });
    }
    notificationHighlightTimeout = setTimeout(() => {
      targets.forEach(target => target.classList.remove('notification-destination-highlight'));
    }, 4000);
  });
  renderNotificationCenter();
  return true;
}

window.GastoProFinancialInsights = {
  getAmountPresentation: getFinancialAmountPresentation,
  normalizeDescription: normalizeInsightDescription,
  areDescriptionsSimilar: areInsightDescriptionsSimilar,
  findSimilarCategoryEntries,
  calculateCategoryAnomalies,
  calculateMonthEndForecast,
  calculateUpcomingDueWarning,
  countUncoveredDueExpenses,
  buildMonthlySummary: buildMonthlyFinancialSummary,
  filterByAccount: filterFinancialItemsByAccount
};

function getFinancialInsightAlertMarkup(key, title, content) {
  const escapedKey = escapeHtml(key);
  return `
    <article class="financial-insight-alert">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${content}</p>
      </div>
      <button type="button" class="financial-insight-dismiss" data-action="dismiss-insight"
        data-insight-key="${escapedKey}" aria-label="Dispensar alerta: ${escapeHtml(title)}">Dispensar</button>
    </article>`;
}

function renderFinancialInsights() {
  const alertContainer = document.getElementById('financialInsightsAlerts');
  const summaryContainer = document.getElementById('financialMonthSummary');
  if (!alertContainer || !summaryContainer) return;

  const accounts = FinanceData.getAccounts();
  const filter = state.accountBalanceFilter;
  const selectedMonth = getYearMonthString(state.currentYear, state.currentMonth);
  const currentDate = new Date();
  const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const actualMonth = today.slice(0, 7);
  const previousDate = new Date(Date.UTC(state.currentYear, state.currentMonth - 2, 1));
  const previousMonth = getYearMonthString(previousDate.getUTCFullYear(), previousDate.getUTCMonth() + 1);
  const monthEndDay = new Date(Date.UTC(state.currentYear, state.currentMonth, 0)).getUTCDate();
  const monthEnd = `${selectedMonth}-${String(monthEndDay).padStart(2, '0')}`;
  const currentItems = filterFinancialItemsByAccount(FinanceData.getByMonth(selectedMonth), accounts, filter);
  const previousItems = filterFinancialItemsByAccount(FinanceData.getByMonth(previousMonth), accounts, filter);
  const summary = buildMonthlyFinancialSummary(currentItems, previousItems);
  const alertScope = `${selectedMonth}:${filter}`;
  const alerts = [];
  const notificationEvents = [];

  if (selectedMonth === actualMonth) {
    const balance = accounts.length ? getAccountBalanceForFilter(
      FinanceData.getAccountBalances(),
      filter,
      accounts,
      accountId => FinanceData.getAccountBalance(accountId)
    ) : null;
    const pendingItems = filterFinancialItemsByAccount(
      FinanceData.getByMonth(actualMonth), accounts, filter
    );
    const balanceMovements = pendingItems.filter(item =>
      item.accountId && accounts.some(account => account.id === item.accountId)
    );
    const forecast = balance === null
      ? null
      : calculateMonthEndForecast(balance, balanceMovements, today, monthEnd);
    if (forecast) {
      const key = `forecast:${alertScope}`;
      if (!state.dismissedInsights.has(key)) {
        const presentation = getFinancialAmountPresentation(forecast.amount, { signed: true });
        alerts.push(getFinancialInsightAlertMarkup(
          key,
          'Previsão do saldo no fim do mês',
          `Considerando o saldo atual e ${forecast.movementCount} lançamentos pendentes: <strong class="${presentation.className}">${escapeHtml(presentation.text)}</strong>.`
        ));
      }
    }

    const due = calculateUpcomingDueWarning(0, pendingItems, today);
    const dueHorizon = new Date(
      new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400000
    ).toISOString().slice(0, 10);
    const isUnpaidDue = item => item && item.type !== 'income' && item.paid !== true &&
      item.active !== false && !item.isCardInstallment && typeof item.date === 'string';
    const upcomingDueItems = pendingItems.filter(item =>
      isUnpaidDue(item) && item.date >= today && item.date <= dueHorizon
    );
    const overdueEntryItems = filterFinancialItemsByAccount(
      FinanceData.getEntries(), accounts, filter
    ).filter(item => isUnpaidDue(item) && item.date < today);
    const overdueTemplateItems = filterFinancialItemsByAccount(
      getLatestOverdueTemplateItems(FinanceData.getActiveTemplates(), today), accounts, filter
    );
    const dueByDate = new Map();
    [...overdueEntryItems, ...overdueTemplateItems, ...upcomingDueItems].forEach(item => {
      dueByDate.set(`${item.id || item.desc}:${item.date}`, item);
    });
    const dueEventItems = [...dueByDate.values()];
    const dueEventId = dueEventItems.map(item => item.id)
      .filter(id => typeof id === 'string' && id)
      .sort()[0] || 'monthly';
    const dueDestinationMonth = dueEventItems
      .map(item => item.month || String(item.date || '').slice(0, 7))
      .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      .sort()[0] || actualMonth;
    const dueDestinationIds = dueEventItems
      .map(item => item.id)
      .filter(id => typeof id === 'string');
    if (dueEventItems.length) {
      const overdueCount = dueEventItems.filter(item => item.date < today).length;
      const dueTodayCount = dueEventItems.filter(item => item.date === today).length;
      const upcomingCount = dueEventItems.filter(item => item.date > today).length;
      const critical = overdueCount > 0 || dueTodayCount > 0;
      notificationEvents.push({
        eventKey: getStableNotificationEventKey('dueSoon', dueEventId, actualMonth),
        scope: filter,
        type: 'dueSoon',
        priority: critical ? 'critical' : 'attention',
        title: overdueCount ? 'Vencimento atrasado' : dueTodayCount ? 'Vencimento hoje' : 'Vencimento próximo',
        message: critical
          ? `${overdueCount} vencido${overdueCount === 1 ? '' : 's'}; ${dueTodayCount} para hoje; ${upcomingCount} nos próximos dias.`
          : `Você tem ${upcomingCount} gasto${upcomingCount === 1 ? '' : 's'} para pagar nos próximos 7 dias.`,
        destination: {
          screen: 'entries',
          month: dueDestinationMonth,
          ids: dueDestinationIds
        }
      });
    }
    if (due) {
      const key = `due:${alertScope}`;
      const balanceDue = balance === null
        ? null
        : calculateUpcomingDueWarning(balance, balanceMovements, today);
      const shortage = balanceDue ? balanceDue.insufficientAmount : 0;
      if (shortage > 0) {
        const upcomingDueIncome = balanceMovements.filter(item =>
          item.type === 'income' && item.paid !== true && item.active !== false &&
          item.date >= today && item.date <= dueHorizon
        );
        const uncoveredDueCount = countUncoveredDueExpenses(
          balance, [...dueByDate.values(), ...upcomingDueIncome]
        );
        notificationEvents.push({
          eventKey: getStableNotificationEventKey(
            'insufficientBalance', dueEventId, actualMonth,
            `uncovered-${Math.max(1, uncoveredDueCount)}`
          ),
          scope: filter,
          type: 'insufficientBalance',
          priority: 'critical',
          title: 'O saldo pode não ser suficiente',
          message: 'Confira o saldo antes dos próximos vencimentos.',
          destination: {
            screen: 'entries',
            month: dueDestinationMonth,
            ids: dueDestinationIds
          }
        });
      }
      if (!state.dismissedInsights.has(key)) {
        const shortfall = shortage > 0
          ? ` O saldo pode ficar insuficiente em <strong class="financial-amount financial-amount--negative">${escapeHtml(getFinancialAmountPresentation(-shortage, { signed: true }).text)}</strong>.`
          : '';
        alerts.push(getFinancialInsightAlertMarkup(
          key,
          'Vencimentos próximos',
          `${due.dueCount} gasto${due.dueCount === 1 ? '' : 's'} vence${due.dueCount === 1 ? '' : 'm'} nos próximos 7 dias.${shortfall}`
        ));
      }
    }
    if (forecast) {
      notificationEvents.push({
        eventKey: getStableNotificationEventKey(
          'forecast', forecast.amount < 0 ? 'negative' : 'positive', actualMonth
        ),
        scope: filter,
        type: 'forecast',
        priority: 'info',
        title: 'Previsão do fim do mês',
        message: 'Sua previsão do saldo no fim do mês foi atualizada.',
        destination: {
          screen: 'dashboard',
          month: actualMonth,
          ids: [],
          target: 'financialInsightsPanel'
        }
      });
    }
  }

  const historicalItems = [];
  for (let offset = 1; offset <= 3; offset++) {
    const date = new Date(Date.UTC(state.currentYear, state.currentMonth - 1 - offset, 1));
    const month = getYearMonthString(date.getUTCFullYear(), date.getUTCMonth() + 1);
    historicalItems.push(...filterFinancialItemsByAccount(FinanceData.getByMonth(month), accounts, filter));
  }
  const anomalies = calculateCategoryAnomalies(
    currentItems.filter(item => item.type !== 'income'),
    historicalItems
  ).slice(0, 2);
  anomalies.forEach(({ item, average }, index) => {
    const key = `anomaly:${alertScope}:${item.id || index}`;
    if (selectedMonth === actualMonth) {
      notificationEvents.push({
        eventKey: getStableNotificationEventKey(
          'anomaly', item.id || `category-${item.category || index}`, actualMonth
        ),
        scope: filter,
        type: 'anomaly',
        priority: 'attention',
        title: 'Gasto acima do normal',
        message: `${item.category || 'Um gasto'} está bem acima da média dessa categoria.`,
        destination: {
          screen: 'entries',
          month: selectedMonth,
          ids: typeof item.id === 'string' ? [item.id] : []
        }
      });
    }
    if (state.dismissedInsights.has(key)) return;
    const amount = getFinancialAmountPresentation(-Number(item.amount), { signed: true });
    alerts.push(getFinancialInsightAlertMarkup(
      key,
      'Gasto fora do padrão',
      `${escapeHtml(item.category || 'Outros')}: <strong class="${amount.className}">${escapeHtml(amount.text)}</strong>, acima de 1,5× a média histórica da categoria (${escapeHtml(formatCurrency(average))}).`
    ));
  });

  if (selectedMonth === actualMonth) {
    const accountTypeById = new Map(accounts.map(account => [account.id, account.type]));
    const cards = FinanceData.getCreditCards();
    const purchases = FinanceData.getCreditCardPurchases();
    cards.forEach(card => {
      const cardType = accountTypeById.get(card.accountId);
      const matchesScope = filter === 'all'
        ? true
        : filter === 'PF' || filter === 'PJ'
          ? cardType === filter
          : card.accountId === filter.slice('account:'.length);
      if (!matchesScope) return;
      const usage = window.GastoProCreditCardHelpers.calculateLimitUsage(
        card, purchases, Number(card.previousSpent) || 0
      );
      if (usage.alert === 'normal') return;
      notificationEvents.push({
        eventKey: getStableNotificationEventKey('cardLimit', card.id, actualMonth, usage.alert),
        scope: filter,
        type: 'cardLimit',
        priority: usage.alert === 'full' ? 'critical' : 'attention',
        title: usage.alert === 'full' ? 'Limite do cartão atingido' : 'Limite do cartão quase cheio',
        message: `${card.name}: ${Math.round(usage.percent)}% do limite está em uso.`,
        destination: {
          screen: 'cards',
          month: actualMonth,
          ids: [card.id]
        }
      });
    });
  }

  try {
    const importReviewNotice = syncPaidImportReviewNotification();
    if (importReviewNotice) notificationEvents.push(importReviewNotice);
    syncNotificationEvents(notificationEvents);
  } catch (error) {
    showToast('Não foi possível atualizar a central de avisos neste aparelho.', 'error');
  }
  renderNotificationCenter();
  alertContainer.innerHTML = alerts.length
    ? alerts.join('')
    : '<p class="financial-insights-empty">Nenhum alerta para este período.</p>';

  if (!summary) {
    summaryContainer.innerHTML = `
      <h3>Resumo do mês</h3>
      <p class="financial-insights-empty">Adicione lançamentos para ver o resumo mensal.</p>`;
    return;
  }
  const resultPresentation = getFinancialAmountPresentation(summary.result, { signed: true });
  const changeText = summary.expenseChange === null
    ? 'Ainda não há gastos no mês anterior para comparar.'
    : `Gastos ${summary.expenseChange > 0 ? 'subiram' : summary.expenseChange < 0 ? 'caíram' : 'ficaram iguais'} ${Math.abs(Math.round(summary.expenseChange))}% em relação ao mês anterior.`;
  summaryContainer.innerHTML = `
    <h3>Resumo de ${escapeHtml(MONTH_NAMES[state.currentMonth - 1])}</h3>
    <p>Resultado do mês: <strong class="${resultPresentation.className}">${escapeHtml(resultPresentation.text)}</strong></p>
    <p>${escapeHtml(changeText)}</p>
    <h4>Maiores categorias de gastos</h4>
    ${summary.topCategories.length
      ? `<ol>${summary.topCategories.map(item => {
        const amount = getFinancialAmountPresentation(-item.amount, { signed: true });
        return `<li><span>${escapeHtml(item.category)}</span><strong class="${amount.className}">${escapeHtml(amount.text)}</strong></li>`;
      }).join('')}</ol>`
      : '<p class="financial-insights-empty">Nenhum gasto neste período.</p>'}`;
}

window.GastoProCreditCardDashboardHelpers = {
  getUsagePresentation: getCreditCardUsagePresentation,
  renderVisual: renderCreditCardVisual,
  getSummary: getCreditCardDashboardSummary,
  renderSummary: renderCreditCardDashboardSummary,
  renderEmptyState: getCreditCardEmptyStateMarkup,
  openCards: openCreditCardsView
};

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
  setFinancialAmount(document.getElementById('totalIncomeDisplay'), totalIncome, { signed: true });
  document.getElementById('incomeCount').textContent =
    `${incomes.length} ${incomes.length === 1 ? 'entrada' : 'entradas'}`;

  // --- KPI: Gastos Fixos ---
  setFinancialAmount(document.getElementById('totalFixedDisplay'), -totalFixed, { signed: true });
  document.getElementById('fixedPaidStatus').textContent = getFixedPaidStatus(
    fixed,
    window.matchMedia('(max-width: 700px)').matches
  );

  // --- KPI: Gastos Variáveis ---
  setFinancialAmount(document.getElementById('totalVariableDisplay'), -totalVariable, { signed: true });

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

  // --- Sub-componentes do Dashboard ---
  renderHealthDiagnostic(totalIncome, balance, pctFixed, pctVar, pctSave);
  renderDebtCenter(ym);
  renderCategoryChart(fixed, variables);
  renderGoalsSection(fixed, variables);
  renderAccountBalancesPanel();
  renderDashboardCreditCardSummary();
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
      description: 'Registre um ganho em Lançamentos > Ganho.'
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
  const diagnostic = getHealthDiagnostic(income, balance, pctFixed, pctVar, pctSave);

  document.getElementById('lblPctFixed').textContent = `${pctFixed}%`;
  document.getElementById('lblPctVar').textContent = `${pctVar}%`;
  document.getElementById('lblPctSave').textContent = `${pctSave}%`;
  document.getElementById('barFixed').style.width = `${Math.min(100, pctFixed)}%`;
  document.getElementById('barVariable').style.width = `${Math.min(100, pctVar)}%`;
  document.getElementById('barSavings').style.width = `${Math.min(100, pctSave)}%`;

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
    return window.GastoProDeletionConfirmation.isValid(value, 'EXCLUIR CONTA');
  },

  async deleteAccountAndClearPendingSync(auth, financeData) {
    const profile = typeof financeData.getProfile === 'function'
      ? financeData.getProfile()
      : {};
    const consentUserId = typeof financeData.getActiveUserId === 'function'
      ? financeData.getActiveUserId() || profile.userId
      : profile.userId;
    const result = await auth.deleteAccount();
    if (result && result.success) {
      try {
        await auth.signOut('local');
      } catch (error) {
        console.error('[GastoPro] Falha ao encerrar a sessão local após excluir a conta:', error);
      } finally {
        financeData.clearUserData();
        if (window.GastoProNotificationCenter) {
          window.GastoProNotificationCenter.clearPreferences();
        } else {
          localStorage.removeItem('gastopro_notification_preferences_v1');
        }
        if (window.GastoProUsageTelemetry) {
          window.GastoProUsageTelemetry.clearPreference(consentUserId);
        } else {
          localStorage.removeItem('gastopro_usage_telemetry_enabled_v1');
        }
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

window.GastoProUserData = {
  isDeletionConfirmationValid(value) {
    return window.GastoProDeletionConfirmation.isValid(value, 'APAGAR DADOS');
  }
};

window.GastoProDeletionConfirmation = {
  normalize(value) {
    return String(value ?? '').trim().toUpperCase();
  },

  isValid(value, expected) {
    return this.normalize(value) === this.normalize(expected);
  },

  bind(input, button, expected, onInput) {
    const update = () => {
      button.disabled = !this.isValid(input.value, expected);
      if (onInput) onInput();
    };
    input.addEventListener('input', update);
    update();
    return update;
  }
};

function initOnboarding() {
  const tutorial = window.GastoProOnboarding;
  const modal = document.getElementById('onboardingModal');
  const title = document.getElementById('onboardingTitle');
  const text = document.getElementById('onboardingText');
  const icon = document.getElementById('onboardingIcon');
  const topicActionButton = document.getElementById('onboardingStatementGuideButton');
  const counter = document.getElementById('onboardingCounter');
  const backButton = document.getElementById('onboardingBackBtn');
  const nextButton = document.getElementById('onboardingNextBtn');
  const skipButton = document.getElementById('onboardingSkipBtn');
  const closeButton = document.getElementById('closeOnboardingBtn');
  const manualButton = document.getElementById('reopenOnboardingBtn');
  const topicsContainer = document.getElementById('howToUseTopics');

  if (!tutorial || !modal || !title || !text || !icon || !counter ||
    !backButton || !nextButton || !skipButton || !closeButton || !topicsContainer) return;

  const statementGuideMount = tutorial.mountStatementGuide(
    document.getElementById(tutorial.getStatementGuide().triggerContainerId)
  );
  if (!statementGuideMount) {
    console.error('[GastoPro] Não foi possível montar o guia de importação de extrato.');
  }

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
    if (topicActionButton) {
      topicActionButton.hidden = !topic.action;
      topicActionButton.textContent = topic.actionLabel || '';
    }
    counter.textContent = `${currentIndex + 1} de ${topics.length}`;
    backButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === topics.length - 1 ? 'Concluir' : 'Próximo';
  }

  function closeTutorial() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    window.dispatchEvent(new Event('gastopro:tutorial-closed'));
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

function initInstallCard() {
  const card = document.getElementById('installAppCard');
  if (!card) return;

  const installButton = document.getElementById('installAppButton');
  const dismissButton = document.getElementById('dismissInstallAppButton');
  const iosInstructions = document.getElementById('installAppIosInstructions');
  const onboardingModal = document.getElementById('onboardingModal');
  const accountSetupModal = document.getElementById('accountOnboardingModal');
  let visitCount;
  let deferredInstallPrompt = null;
  try {
    visitCount = window.GastoProInstallCardHelpers.recordVisit(window.localStorage);
  } catch (error) {
    console.error('[GastoPro] Não foi possível registrar a visita para instalação:', error);
    return;
  }

  const updateCard = () => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;
    const onboardingOpen = [onboardingModal, accountSetupModal].some(modal =>
      modal && (modal.classList.contains('active') || modal.getAttribute('aria-hidden') === 'false'));
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(INSTALL_CARD_DISMISSED_KEY) === 'true';
    } catch (error) {
      console.error('[GastoPro] Não foi possível consultar a preferência do cartão de instalação:', error);
      card.hidden = true;
      return;
    }
    const isMobile = navigator.userAgentData?.mobile === true ||
      /Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent);
    const cardType = window.GastoProInstallCardHelpers.decide({
      isMobile,
      standalone,
      visitCount,
      dismissed,
      onboardingOpen,
      userAgent: navigator.userAgent,
      canPromptInstall: Boolean(deferredInstallPrompt)
    });
    card.hidden = !cardType;
    card.dataset.installType = cardType || '';
    if (installButton) installButton.hidden = cardType !== 'android';
    if (iosInstructions) iosInstructions.hidden = cardType !== 'ios';
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateCard();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    card.hidden = true;
  });
  window.addEventListener('gastopro:tutorial-closed', updateCard);
  if (typeof MutationObserver === 'function') {
    const onboardingObserver = new MutationObserver(updateCard);
    [onboardingModal, accountSetupModal].forEach(modal => {
      if (modal) onboardingObserver.observe(modal, {
        attributes: true,
        attributeFilter: ['aria-hidden', 'class']
      });
    });
  }
  if (dismissButton) dismissButton.addEventListener('click', () => {
    try {
      window.GastoProInstallCardHelpers.dismiss(window.localStorage);
      updateCard();
    } catch (error) {
      console.error('[GastoPro] Não foi possível salvar a dispensa do cartão de instalação:', error);
    }
  });
  if (installButton) installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      updateCard();
      return;
    }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.error('[GastoPro] Não foi possível abrir o convite de instalação:', error);
    } finally {
      updateCard();
    }
  });
  updateCard();
}

function initAccountOnboarding() {
  const tutorial = window.GastoProOnboarding;
  const modal = document.getElementById('accountOnboardingModal');
  const form = document.getElementById('accountOnboardingForm');
  const nameInput = document.getElementById('accountOnboardingName');
  const typeInput = document.getElementById('accountOnboardingType');
  const balanceInput = document.getElementById('accountOnboardingBalance');
  const dateInput = document.getElementById('accountOnboardingBalanceDate');
  const error = document.getElementById('accountOnboardingError');
  const accountsList = document.getElementById('accountOnboardingAccounts');
  const skipButton = document.getElementById('skipAccountOnboardingBtn');
  const finishButton = document.getElementById('finishAccountOnboardingBtn');
  const saveButton = document.getElementById('addOnboardingAccountBtn');
  if (!tutorial || !modal || !form || !nameInput || !typeInput || !balanceInput ||
    !dateInput || !error || !accountsList || !skipButton || !finishButton || !saveButton) return;

  function closeAccountSetup(markSeen = false) {
    if (markSeen) tutorial.markAccountSetupSeen();
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function maybeOpenAccountSetup() {
    if (!accountOnboardingDataReady ||
      !tutorial.shouldShowAccountSetup(FinanceData.getAccounts())) return;
    const tutorialModal = document.getElementById('onboardingModal');
    if (tutorialModal && tutorialModal.classList.contains('active')) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    nameInput.focus();
  }

  function renderCreatedAccounts() {
    const accounts = FinanceData.getAccounts();
    accountsList.textContent = accounts.length
      ? `Contas cadastradas: ${accounts.map(account => `${account.name} (${account.type})`).join(', ')}`
      : '';
    finishButton.disabled = accounts.length === 0;
  }

  skipButton.addEventListener('click', () => closeAccountSetup(true));
  finishButton.addEventListener('click', () => {
    if (!FinanceData.getAccounts().length) return;
    closeAccountSetup(true);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const balanceDate = dateInput.value;
    const balance = Number(balanceInput.value);
    if (!name || name.length > 100 || !balanceInput.value ||
      !Number.isFinite(balance) || Math.abs(balance) > 9999999999.99 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(balanceDate) ||
      Number.isNaN(new Date(`${balanceDate}T00:00:00Z`).getTime()) ||
      new Date(`${balanceDate}T00:00:00Z`).toISOString().slice(0, 10) !== balanceDate) {
      error.textContent = 'Informe nome, saldo e uma data válida para a conta.';
      error.hidden = false;
      return;
    }

    saveButton.disabled = true;
    error.hidden = true;
    const previousIds = new Set(FinanceData.getAccounts().map(account => account.id));
    try {
      const result = await FinanceData.addAccount({
        name,
        type: typeInput.value,
        initialBalance: balance,
        balanceDate
      });
      const addedAccount = result.account || FinanceData.getAccounts().find(account =>
        !previousIds.has(account.id)
      );
      if (!addedAccount) {
        error.textContent = result.error && result.error.message ||
          result.error || 'Não foi possível cadastrar a conta.';
        error.hidden = false;
        return;
      }

      renderAll();
      renderCreatedAccounts();
      form.reset();
      typeInput.value = 'PF';
      if (!result.success) {
        showToast('Conta salva neste aparelho; a sincronização ficou pendente.');
      } else {
        showToast('Conta cadastrada. Você pode adicionar outra ou concluir.');
      }
      nameInput.focus();
    } catch (saveError) {
      console.error('[GastoPro] Falha ao cadastrar conta no primeiro uso:', saveError);
      error.textContent = `Não foi possível cadastrar a conta: ${saveError.message || saveError}`;
      error.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  window.addEventListener('gastopro:tutorial-closed', maybeOpenAccountSetup);
  window.addEventListener('gastopro:account-data-ready', maybeOpenAccountSetup);
  maybeOpenAccountSetup();
}

// ================================================================
// 7. CENTRO DE DÍVIDAS & PREVISÃO DE QUITAÇÃO
// ================================================================

function isDebtCenterTemplate(template) {
  if (template.isDebt || template.endMonth) return true;
  const cat = (template.category || '').toLowerCase();
  const desc = (template.desc || '').toLowerCase();
  return cat.includes('empréstimo') || cat.includes('emprestimo') ||
         cat.includes('parcela') || cat.includes('financiamento') ||
         cat.includes('dívida') || cat.includes('divida') ||
         desc.includes('empréstimo') || desc.includes('emprestimo') ||
         desc.includes('parcela') || desc.includes('financiamento') ||
         desc.includes('dívida') || desc.includes('divida');
}

function isExcludedOrInactiveTemplate(template) {
  return template.active === false || Boolean(template.deletedAt || template.deleted_at);
}

function isIncomeTemplate(template) {
  const category = String(template.category || '').trim().toLowerCase();
  return template.type === 'income' || GastoProCategories.INCOME.some(value =>
    String(value).trim().toLowerCase() === category
  );
}

function shiftDebtMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthIndex = year * 12 + monthNumber - 1 + offset;
  return `${String(Math.floor(monthIndex / 12)).padStart(4, '0')}-${String(monthIndex % 12 + 1).padStart(2, '0')}`;
}

function getDebtMonthBreakdown(templates, currentYm) {
  if (!Array.isArray(templates) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(currentYm || '')) {
    throw new TypeError('Informe templates e o mês atual no formato YYYY-MM.');
  }

  const nextYm = shiftDebtMonth(currentYm, 1);
  const overdueCents = { amount: 0, count: 0 };
  const currentMonth = { openAmount: 0, openCount: 0, totalCount: 0 };
  const nextMonth = { openAmount: 0, openCount: 0, totalCount: 0 };
  let totalRemainingCents = 0;
  let noEndCount = 0;
  let noEndMonthlyCents = 0;

  templates.forEach(template => {
    if (isExcludedOrInactiveTemplate(template) || isIncomeTemplate(template) ||
      !isDebtCenterTemplate(template)) return;

    const installmentCents = Math.max(0, Math.round((Number(template.amount) || 0) * 100));
    if (!template.endMonth) {
      noEndCount++;
      noEndMonthlyCents += installmentCents;
      return;
    }

    const isLoan = template.loanReceivedAmount != null;
    const startMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(template.startMonth || '')
      ? template.startMonth : currentYm;
    const totalMonths = isLoan
      ? Number(template.loanInstallmentCount)
      : Math.max(1, (Number(template.endMonth.slice(0, 4)) -
        Number(startMonth.slice(0, 4))) * 12 +
        Number(template.endMonth.slice(5, 7)) - Number(startMonth.slice(5, 7)) + 1);
    if (!Number.isInteger(totalMonths) || totalMonths < 1 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(template.endMonth)) return;

    const loanTotalCents = isLoan
      ? Math.max(0, Math.round((Number(template.loanTotalPayable) || 0) * 100))
      : 0;
    for (let offset = 0; offset < totalMonths; offset++) {
      const month = shiftDebtMonth(startMonth, offset);
      const amountCents = isLoan && offset === totalMonths - 1
        ? Math.max(0, loanTotalCents - installmentCents * (totalMonths - 1))
        : installmentCents;
      const monthSummary = month === currentYm ? currentMonth :
        month === nextYm ? nextMonth : null;
      if (monthSummary) monthSummary.totalCount++;
      if (template.paidMonths && template.paidMonths[month]) continue;

      totalRemainingCents += amountCents;
      if (month < currentYm) {
        overdueCents.amount += amountCents;
        overdueCents.count++;
      }
      if (monthSummary) {
        monthSummary.openAmount += amountCents;
        monthSummary.openCount++;
      }
    }
  });

  const toAmount = cents => Math.round(cents) / 100;
  return {
    overdue: { amount: toAmount(overdueCents.amount), count: overdueCents.count },
    currentMonth: {
      openAmount: toAmount(currentMonth.openAmount),
      openCount: currentMonth.openCount,
      totalCount: currentMonth.totalCount
    },
    nextMonth: {
      openAmount: toAmount(nextMonth.openAmount),
      openCount: nextMonth.openCount,
      totalCount: nextMonth.totalCount
    },
    totalRemaining: toAmount(totalRemainingCents),
    noEndDebts: { count: noEndCount, monthlyAmount: toAmount(noEndMonthlyCents) }
  };
}

function getRecurringFixedCosts(templates) {
  if (!Array.isArray(templates)) {
    throw new TypeError('Informe a lista de templates.');
  }
  let count = 0;
  let monthlyCents = 0;
  templates.forEach(template => {
    if (template.type !== 'fixed' || template.endMonth ||
      isExcludedOrInactiveTemplate(template) || isIncomeTemplate(template) ||
      isDebtCenterTemplate(template)) return;
    count++;
    monthlyCents += Math.max(0, Math.round((Number(template.amount) || 0) * 100));
  });
  return { monthlyAmount: Math.round(monthlyCents) / 100, count };
}

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
function getDebtCenterData(currentYm, templates = FinanceData.getActiveTemplates()) {
  const debtTemplates = templates.filter(isDebtCenterTemplate);

  const items = debtTemplates.map(tpl => {
    const paidMonthsCount = tpl.paidMonths ? Object.values(tpl.paidMonths).filter(Boolean).length : 0;
    const isLoan = tpl.loanReceivedAmount != null;
    let totalMonths = 0;
    let remainingMonths = 0;
    let nextInstallmentMonth = null;

    if (isLoan) {
      totalMonths = tpl.loanInstallmentCount;
      remainingMonths = Math.max(0, totalMonths - paidMonthsCount);
      for (let offset = 0; offset < totalMonths; offset += 1) {
        const [year, month] = tpl.startMonth.split('-').map(Number);
        const monthIndex = year * 12 + month - 1 + offset;
        const installmentMonth = `${String(Math.floor(monthIndex / 12)).padStart(4, '0')}-${String(monthIndex % 12 + 1).padStart(2, '0')}`;
        if (!tpl.paidMonths || tpl.paidMonths[installmentMonth] !== true) {
          nextInstallmentMonth = installmentMonth;
          break;
        }
      }
    } else if (tpl.endMonth && tpl.startMonth) {
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

    const remainingAmount = isLoan
      ? remainingMonths === 0
        ? 0
        : Math.max(0, Math.round((Number(tpl.loanTotalPayable) - paidMonthsCount * Number(tpl.amount)) * 100) / 100)
      : remainingMonths * tpl.amount;
    const paidAmount = isLoan
      ? Math.min(Number(tpl.loanTotalPayable), paidMonthsCount * Number(tpl.amount))
      : paidMonthsCount * tpl.amount;
    const totalProgressAmount = isLoan
      ? Number(tpl.loanTotalPayable)
      : remainingAmount + paidAmount || tpl.amount * totalMonths;
    const isFinished = remainingMonths === 0;
    const isOverdue = Boolean(tpl.endMonth && currentYm > tpl.endMonth && remainingMonths > 0);
    return {
      id: tpl.id,
      description: tpl.desc,
      category: tpl.category || 'Empréstimo',
      amount: tpl.amount,
      isLoan,
      loanCost: isLoan
        ? Math.round((Number(tpl.loanTotalPayable) - Number(tpl.loanReceivedAmount)) * 100) / 100
        : null,
      nextInstallmentMonth,
      nextInstallmentAmount: nextInstallmentMonth ? Number(tpl.amount) : null,
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
window.GastoProReportHelpers.getDebtMonthBreakdown = getDebtMonthBreakdown;
window.GastoProReportHelpers.getRecurringFixedCosts = getRecurringFixedCosts;
window.GastoProReportHelpers.isDebtCenterTemplate = isDebtCenterTemplate;

function getDebtCenterViewModel(templates, selectedYm, realYm) {
  const debtBreakdown = getDebtMonthBreakdown(templates, realYm);
  const recurringFixedCosts = getRecurringFixedCosts(templates);
  return { selectedYm, realYm, debtBreakdown, recurringFixedCosts };
}

function renderDebtCenterSummary(viewModel) {
  const { debtBreakdown, recurringFixedCosts } = viewModel;
  const monthStatus = (month, label, period) => {
    if (month.totalCount === 0) {
      return `<div class="debt-summary-row" data-debt-summary-block="${label}">
        <span class="debt-summary-label">${label}</span>
        <span class="debt-summary-value">Nenhuma parcela ${period}</span>
      </div>`;
    }
    if (month.openCount === 0) {
      return `<div class="debt-summary-row" data-debt-summary-block="${label}">
        <span class="debt-summary-label">${label}</span>
        <span class="debt-summary-value">Tudo pago ${period}</span>
      </div>`;
    }
    return `<div class="debt-summary-row" data-debt-summary-block="${label}">
      <span class="debt-summary-label">${label}</span>
      <span class="debt-summary-value">${formatCurrency(month.openAmount)} · ${month.openCount} em aberto</span>
    </div>`;
  };
  const recurringAmount = recurringFixedCosts.monthlyAmount;
  const noEndDebtAmount = debtBreakdown.noEndDebts.monthlyAmount;
  const showCostsAlert = recurringAmount > 0 || debtBreakdown.noEndDebts.count > 0;
  const costsAlert = showCostsAlert ? `
    <aside class="debt-cost-alert" aria-label="Custos fixos por mês">
      <div class="debt-cost-alert-heading">
        <strong>Custos fixos por mês</strong>
      </div>
      <p>Não entram no total que falta pagar.</p>
      ${recurringAmount > 0 ? `<p>Gastos fixos recorrentes: ${formatCurrency(recurringAmount)}.</p>` : ''}
      ${debtBreakdown.noEndDebts.count > 0
        ? `<p>Dívidas sem prazo definido: ${debtBreakdown.noEndDebts.count} · ${formatCurrency(noEndDebtAmount)} por mês.</p>`
        : ''}
      <a class="debt-cost-link" href="#view-expenses" data-goto="expenses">Ver gastos</a>
    </aside>
  ` : '';

  return `
    <section class="debt-month-breakdown" aria-label="Resumo de parcelas">
      ${debtBreakdown.overdue.count > 0 ? `
        <div class="debt-summary-row debt-summary-overdue" data-debt-summary-block="Em atraso">
          <span class="debt-summary-label">Em atraso</span>
          <span class="debt-summary-value">${formatCurrency(debtBreakdown.overdue.amount)} · ${debtBreakdown.overdue.count} parcelas</span>
        </div>
      ` : ''}
      ${monthStatus(debtBreakdown.currentMonth, 'Este mês', 'neste mês')}
      ${monthStatus(debtBreakdown.nextMonth, 'Próximo mês', 'no próximo mês')}
      <div class="debt-summary-row debt-summary-total" data-debt-total>
        <span class="debt-summary-label">Total que falta pagar</span>
        <span class="debt-summary-value">${formatCurrency(debtBreakdown.totalRemaining)}</span>
      </div>
    </section>
    ${costsAlert}
  `;
}

function renderDebtCenter(currentYm) {
  const container = document.getElementById('debtCardsGrid');
  const summaryContainer = document.getElementById('debtCenterSummary');
  if (!container) return;

  const templates = FinanceData.getActiveTemplates();
  const realYm = getLocalDateString().substring(0, 7);
  const viewModel = getDebtCenterViewModel(templates, currentYm, realYm);
  const debtData = getDebtCenterData(realYm, templates.filter(template =>
    !isExcludedOrInactiveTemplate(template) && !isIncomeTemplate(template)
  ));
  if (summaryContainer) summaryContainer.innerHTML = renderDebtCenterSummary(viewModel);

  if (debtData.items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-debt" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: var(--text-muted); opacity: 0.85;">
        <i class="fa-solid fa-flag-checkered" style="font-size: 2rem; margin-bottom: 0.6rem; opacity: 0.4;"></i>
        <p style="font-weight: 500; margin-bottom: 0.25rem;">Nenhum parcelamento ou empréstimo em andamento</p>
        <span style="font-size: 0.85rem;">Cadastre um empréstimo ou um gasto fixo com data final para acompanhar as parcelas e a quitação.</span>
        <small class="empty-state-tip">No empréstimo, a previsão é calculada pelo mês inicial e pelo número de parcelas.</small>
        <button type="button" class="btn-primary empty-state-action" data-goto="expenses">
          Ir para lançamentos
        </button>
      </div>
    `;
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
        ${debt.isLoan ? `
          <div class="debt-card-loan-details">
            <span>Custo: <strong>${formatCurrency(debt.loanCost)}</strong></span>
            <span>Próxima parcela: <strong>${debt.nextInstallmentMonth
              ? `${formatCurrency(debt.nextInstallmentAmount)} em ${escapeHtml(debt.nextInstallmentMonth.split('-').reverse().join('/'))}`
              : 'Nenhuma'}</strong></span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;
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

  const categories = [...catTotals.values()].sort((first, second) => second.amount - first.amount);
  const needsOtherGroup = categories.length > 8;
  const visibleCategories = needsOtherGroup
    ? categories.slice(0, 7).filter(item => GastoProCategories.normalize(item.label) !== 'outros')
    : categories;
  if (needsOtherGroup) {
    const retainedKeys = new Set(visibleCategories.map(item => GastoProCategories.normalize(item.label)));
    const otherAmount = categories
      .filter(item => !retainedKeys.has(GastoProCategories.normalize(item.label)))
      .reduce((sum, item) => sum + item.amount, 0);
    visibleCategories.push({ label: 'Outros', amount: otherAmount });
  }
  const labels = visibleCategories.map(item => item.label);
  const data = visibleCategories.map(item => item.amount);

  if (labels.length === 0) {
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
    document.getElementById('categoryChartLegend')?.replaceChildren();
    ctx.style.display = 'none';
    if (emptyMsg) {
      emptyMsg.innerHTML = `
        <i class="fa-solid fa-chart-simple"></i>
        <p>Nenhum gasto lançado neste mês ainda.</p>
        <span class="empty-state-tip">Registre uma saída para ver a distribuição por categoria.</span>
        <button type="button" class="btn-primary empty-state-action" data-goto="expenses">
          Adicionar gasto
        </button>`;
      emptyMsg.style.display = 'block';
    }
    return;
  }

  ctx.style.display = 'block';
  if (emptyMsg) emptyMsg.style.display = 'none';

  const chartColors = [
    '#d97706', '#2563eb', '#059669', '#db2777', '#8b5cf6', '#0f766e',
    '#c2410c', '#65a30d', '#0891b2', '#9333ea', '#b45309', '#4d7c0f',
    '#be123c', '#0369a1', '#ca8a04', '#a21caf'
  ];
  const categoryColor = category => {
    if (GastoProCategories.normalize(category) === 'outros') return '#64748b';
    const index = knownCategories.findIndex(value =>
      GastoProCategories.normalize(value) === GastoProCategories.normalize(category)
    );
    if (index >= 0) return chartColors[index % chartColors.length];
    let hash = 0;
    for (const character of GastoProCategories.normalize(category)) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return chartColors[hash % chartColors.length];
  };
  const colors = visibleCategories.map(item => categoryColor(item.label));
  const totalAmount = data.reduce((sum, amount) => sum + amount, 0);
  const legend = document.getElementById('categoryChartLegend');
  if (legend) {
    legend.replaceChildren();
    visibleCategories.forEach((item, index) => {
      const legendItem = document.createElement('li');
      const swatch = document.createElement('span');
      const label = document.createElement('span');
      const percentage = document.createElement('span');
      swatch.className = 'category-chart-legend-swatch';
      swatch.style.backgroundColor = colors[index];
      swatch.setAttribute('aria-hidden', 'true');
      label.className = 'category-chart-legend-name';
      label.textContent = item.label;
      percentage.className = 'category-chart-legend-percentage';
      percentage.textContent = `${totalAmount ? (item.amount / totalAmount * 100).toFixed(1) : '0.0'}%`;
      legendItem.append(swatch, label, percentage);
      legend.appendChild(legendItem);
    });
  }

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
        backgroundColor: colors,
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(c) {
              const val = c.raw || 0;
              const pct = (totalAmount ? (val / totalAmount) * 100 : 0).toFixed(1);
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
  setFinancialAmount(document.getElementById('incomesPageTotal'), totalIncome, { signed: true, tone: 'inverse' });

  const container = document.getElementById('incomesListDetailed');
  if (!container) return;

  if (incomes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-hand-holding-dollar" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.4;"></i>
        <p>Nenhum ganho neste mês.</p>
        <span>Os ganhos recebidos aparecerão aqui após serem lançados.</span>
        <button type="button" class="btn-primary empty-state-action" data-action="open-income-entry">
          Criar ganho em Lançamentos
        </button>
      </div>
    `;
    return;
  }

  const accountNames = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  container.innerHTML = incomes.map(item => renderControlCenterItem(item, accountNames, true)).join('');
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
  setFinancialAmount(document.getElementById('expensesPageTotal'), -totalExpenses, { signed: true, tone: 'inverse' });
  setFinancialAmount(document.getElementById('subtotalFixedLabel'), -totalFixed, { signed: true });
  setFinancialAmount(document.getElementById('subtotalVarLabel'), -totalVariable, { signed: true });

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
        <p>Nenhum gasto neste mês.</p>
        <span>Os lançamentos de gastos aparecerão aqui após serem criados.</span>
        <button type="button" class="btn-primary empty-state-action" data-action="open-expense-entry">
          Criar gasto em Lançamentos
        </button>
      </div>
    `;
    return;
  }

  const accountNames = new Map(FinanceData.getAccounts().map(account => [account.id, account.name]));
  container.innerHTML = itemsToDisplay.map(item => renderControlCenterItem(item, accountNames, false)).join('');
}

function getControlCenterTypeLabel(item) {
  if (item.type === 'income') return 'Ganho';
  if (item.isLoan || item.loanReceivedAmount != null) return 'Empréstimo';
  if (item.isCardInstallment || item.category === 'Parcelamento') return 'Parcelado';
  if (item.type === 'debt' || item.isDebt) return 'Dívida';
  if (item.paymentMethod === 'boleto') return 'Boleto';
  if (item.isTemplate || item.type === 'fixed') return 'Fixo';
  return 'Variável';
}

function renderControlCenterItem(item, accountNames, isIncome) {
  const isCardInstallment = Boolean(item.isCardInstallment);
  const isTemplate = Boolean(item.isTemplate) ||
    FinanceData.getActiveTemplates().some(template => template.id === item.id);
  const isInactive = !isIncome && item.active === false;
  const needsPaidReview = !isIncome && item.paid && getPaidImportReviewIds().includes(item.id);
  const dateLabel = item.date ? formatDate(item.date) :
    item.day ? `Dia ${String(item.day).padStart(2, '0')}` : 'Não definida';
  const statusLabel = typeof item.paid === 'boolean' ? (item.paid ? 'Pago' : 'A pagar') : null;
  const actions = isCardInstallment
    ? `
      <button type="button" class="control-center-action btn-action-edit" data-action="edit-card-purchase"
        data-id="${escapeHtml(item.purchaseId || item.id)}" aria-label="Editar compra parcelada ${escapeHtml(item.desc)}"
        title="Editar a compra e todo o parcelamento"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="control-center-action btn-action-delete" data-action="delete-card-purchase"
        data-id="${escapeHtml(item.purchaseId || item.id)}" aria-label="Excluir compra parcelada ${escapeHtml(item.desc)}"
        title="Excluir a compra e todas as parcelas"><i class="fa-solid fa-trash-can"></i></button>
    `
    : `
      <button type="button" class="control-center-action btn-action-edit" data-action="edit" data-id="${escapeHtml(item.id)}"
        aria-label="Editar ${isIncome ? 'ganho' : 'gasto'} ${escapeHtml(item.desc)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button type="button" class="control-center-action btn-action-delete" data-action="delete" data-id="${escapeHtml(item.id)}"
        aria-label="Excluir ${isIncome ? 'ganho' : 'gasto'} ${escapeHtml(item.desc)}" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
    `;

  return `
    <article class="control-center-item ${item.paid ? 'is-paid' : ''} ${isInactive ? 'is-inactive-card' : ''}"
      data-entry-id="${escapeHtml(item.id)}">
      <div class="control-center-item-heading">
        <h3 class="control-center-item-title">${escapeHtml(item.desc)}</h3>
        <strong class="control-center-item-amount ${isIncome ? 'text-success' : 'text-danger'}">
          ${isIncome ? '+' : '−'} ${formatCurrency(item.amount)}
        </strong>
      </div>
      <div class="control-center-item-details">
        <span><strong>Tipo:</strong> ${escapeHtml(getControlCenterTypeLabel(item))}</span>
        <span><strong>Data/dia:</strong> ${escapeHtml(dateLabel)}</span>
        <span><strong>Conta:</strong> ${escapeHtml(accountNames.get(item.accountId) || 'Sem conta')}</span>
        ${statusLabel ? `<span class="control-center-status"><strong>Situação:</strong> ${statusLabel}</span>` : ''}
        ${item.isCardInstallment
          ? `<span><strong>Parcela:</strong> ${item.installmentNumber}/${item.installmentCount} · ${escapeHtml(item.cardName || 'Cartão')}</span>`
          : ''}
        ${item.category ? `<span><strong>Categoria:</strong> ${escapeHtml(item.category)}</span>` : ''}
        ${item.dueDayMissing ? '<span class="badge badge-warning" role="status">Falta o dia</span>' : ''}
        ${item.paymentMethod ? `<span>${renderPaymentMethodBadge(item.paymentMethod)}</span>` : ''}
      </div>
      <div class="control-center-item-actions">
        ${!isIncome && typeof item.paid === 'boolean' ? `
          <label class="checkbox-paid-label control-center-paid-toggle">
            <input type="checkbox" ${item.paid ? 'checked' : ''} data-action="toggle-paid" data-id="${escapeHtml(item.id)}"
              ${isCardInstallment
                ? `data-kind="credit-card" data-installment="${item.installmentNumber}" data-month="${escapeHtml(item.month)}"`
                : ''} />
            <span>${item.paid ? 'Pago' : 'Marcar pago'}</span>
          </label>
        ` : ''}
        ${!isIncome && (item.isTemplate || item.type === 'fixed') ? `
          <button type="button" class="badge-status-btn ${item.active === false ? 'status-inactive' : 'status-active'}"
            data-action="toggle-active" data-id="${escapeHtml(item.id)}">
            ${item.active === false ? 'Reativar modelo' : 'Pausar modelo'}
          </button>
        ` : ''}
        ${needsPaidReview ? `
          <button type="button" class="notification-action" data-action="review-import-paid" data-id="${escapeHtml(item.id)}">Conferir</button>
          <button type="button" class="notification-action" data-action="pending-import-paid" data-id="${escapeHtml(item.id)}">A pagar</button>
        ` : ''}
        <div class="card-item-actions">${actions}</div>
      </div>
    </article>
  `;
}

window.GastoProIncomeListHelpers = Object.freeze({
  render: renderIncomesView,
  getTypeLabel: getControlCenterTypeLabel
});

window.GastoProControlCenterHelpers = Object.freeze({
  getTypeLabel: getControlCenterTypeLabel,
  openComposer(type) {
    if (type === 'income') return openIncomeEntryComposer();
    if (type === 'expense') return openExpenseEntryComposer();
    return false;
  }
});

window.GastoProExpenseListHelpers = Object.freeze({
  render: renderExpensesView
});

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
  const template = FinanceData.getActiveTemplates().find(item => item.id === id);
  if (template) {
    showConfirm({
      title: 'Editar modelo recorrente?',
      message: 'A edição altera o modelo inteiro e suas ocorrências nos meses, não apenas este mês. Deseja continuar?',
      iconClass: 'fa-solid fa-repeat',
      okLabel: 'Editar modelo',
      okBtnClass: 'btn-primary',
      onConfirm: () => populateEditModal(id)
    });
    return;
  }
  const purchase = FinanceData.getCreditCardPurchases().find(item => item.id === id);
  if (purchase) {
    showConfirm({
      title: 'Editar compra parcelada?',
      message: 'A edição altera a compra original e todas as parcelas, não apenas esta ocorrência mensal. Deseja continuar?',
      iconClass: 'fa-solid fa-credit-card',
      okLabel: 'Editar compra',
      okBtnClass: 'btn-primary',
      onConfirm: () => populateCreditCardPurchaseEditModal(purchase)
    });
    return;
  }
  populateEditModal(id);
};

function populateCreditCardPurchaseEditModal(purchase) {
  const editCategory = document.getElementById('editCategory');
  editCategory.querySelectorAll('[data-legacy="true"]').forEach(option => option.remove());
  if (purchase.category && !Array.from(editCategory.options).some(option => option.value === purchase.category)) {
    const option = document.createElement('option');
    option.value = purchase.category;
    option.textContent = purchase.category;
    option.dataset.legacy = 'true';
    editCategory.appendChild(option);
  }
  document.getElementById('editItemId').value = purchase.id;
  document.getElementById('editDesc').value = purchase.desc;
  document.getElementById('editAmount').value = purchase.amount;
  editCategory.value = purchase.category;
  document.getElementById('editType').value = 'variable';
  document.getElementById('editDate').value = purchase.purchaseDate;
  document.getElementById('editAccount').value = purchase.accountId || '';
  document.getElementById('editCreditCard').innerHTML = FinanceData.getCreditCards().map(card =>
    `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)}</option>`
  ).join('');
  document.getElementById('editCreditCard').value = purchase.cardId;
  document.getElementById('editInstallments').value = String(purchase.installmentCount);
  document.getElementById('editCreditCardFields').hidden = false;
  document.getElementById('editCreditCard').required = true;
  document.getElementById('editInstallments').required = true;
  document.getElementById('editCreditCardWarning').hidden = false;
  document.getElementById('editTypeGroup').hidden = true;
  document.getElementById('editStatusGroup').hidden = true;
  document.getElementById('editDueDayGroup').hidden = true;
  document.getElementById('editPaymentMethodGroup').hidden = true;
  document.getElementById('editEndMonthGroup').hidden = true;
  document.getElementById('editModalTitle').textContent = 'Alterar compra parcelada';
  document.getElementById('editModal').classList.add('active');
}

function populateEditModal(id) {
  document.getElementById('editCreditCardFields').hidden = true;
  document.getElementById('editCreditCard').required = false;
  document.getElementById('editInstallments').required = false;
  document.getElementById('editCreditCardWarning').hidden = true;
  document.getElementById('editTypeGroup').hidden = false;
  document.getElementById('editStatusGroup').hidden = false;
  document.getElementById('editDueDayGroup').hidden = false;
  document.getElementById('editPaymentMethodGroup').hidden = false;
  document.getElementById('editEndMonthGroup').hidden = false;
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
    const currentType = item.type || (item.isDebt ? 'debt' : (item.isTemplate ? 'fixed' : 'variable'));
    editTypeSelect.value = currentType;
    const isTemplate = FinanceData.getActiveTemplates().some(template => template.id === id);
    Array.from(editTypeSelect.options).forEach(option => {
      option.disabled = isTemplate
        ? option.value === 'income' || option.value === 'variable'
        : (option.value === 'fixed' && currentType !== 'variable') || option.value === 'debt';
    });
  }

  document.getElementById('editDate').value = item.date || getTodayString();
  const editPaymentMethod = document.getElementById('editPaymentMethod');
  if (editPaymentMethod) {
    populatePaymentMethodSelect(editPaymentMethod, item.type === 'income' ? 'income' : 'expense', true);
    editPaymentMethod.value = item.paymentMethod || '';
  }
  const editAccount = document.getElementById('editAccount');
  if (editAccount) editAccount.value = item.accountId || '';
  const editDueDayGroup = document.getElementById('editDueDayGroup');
  const editDueDay = document.getElementById('editDueDay');
  const itemDueDay = item.day || (item.debtInfo && item.debtInfo.dueDay) || '';
  const requiresDueDay = item.type !== 'income' &&
    (item.isTemplate || item.type === 'fixed' || item.type === 'debt' ||
      (item.paid === false && item.paymentMethod !== 'credit_card'));
  if (editDueDayGroup) editDueDayGroup.hidden = item.type === 'income';
  if (editDueDay) {
    editDueDay.value = itemDueDay;
    editDueDay.required = requiresDueDay;
    editDueDay.dataset.dueRequired = String(requiresDueDay);
  }

  const isFixed = item.type === 'fixed' || item.type === 'debt' || item.isTemplate ||
    FinanceData.getActiveTemplates().some(template => template.id === id);
  const statusGroup = document.getElementById('editStatusGroup');
  const endMonthGroup = document.getElementById('editEndMonthGroup');
  const paymentMethodGroup = document.getElementById('editPaymentMethodGroup');
  if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
  if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';
  if (paymentMethodGroup) paymentMethodGroup.style.display = isFixed ? 'none' : 'block';

  if (document.getElementById('editActive')) {
    document.getElementById('editActive').value = item.active !== false ? 'true' : 'false';
  }
  if (document.getElementById('editEndMonth')) {
    document.getElementById('editEndMonth').value = item.endMonth || '';
  }

  const title = item.type === 'income' ? 'Alterar Ganho' : (isFixed ? 'Alterar Gasto Fixo' : 'Alterar Gasto Variável');
  document.getElementById('editModalTitle').textContent = title;

  document.getElementById('editModal').classList.add('active');
}

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
  document.getElementById('accountBalanceDate').value = account ? account.balanceDate || '' : '';
  const error = document.getElementById('accountFormError');
  error.textContent = '';
  error.hidden = true;
  modal.classList.add('active');
  setTimeout(() => document.getElementById('accountName').focus(), 100);
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.remove('active');
  if (!returnToImportAfterAccountModal) return;
  document.getElementById('importModal').classList.add('active');
  window.dispatchEvent(new CustomEvent('gastopro:account-modal-closed-for-import', {
    detail: { accountId: importAccountCreatedId }
  }));
  returnToImportAfterAccountModal = false;
  importAccountCreatedId = null;
}

function openCreditCardModal(id) {
  const card = id ? FinanceData.getCreditCards().find(item => item.id === id) : null;
  const modal = document.getElementById('creditCardModal');
  document.getElementById('creditCardModalTitle').textContent = card ? 'Editar cartão' : 'Novo cartão';
  document.getElementById('creditCardId').value = card ? card.id : '';
  document.getElementById('creditCardName').value = card ? card.name : '';
  document.getElementById('creditCardIssuerBank').value = card ? card.issuerBank || 'Outro' : 'Nubank';
  document.getElementById('creditCardBrand').value = card ? card.brand || 'Outra' : 'Visa';
  document.getElementById('creditCardLastFour').value = card ? card.lastFour || '' : '';
  document.getElementById('creditCardCustomColor').value = card && /^#[0-9a-f]{6}$/i.test(card.customColor || '')
    ? card.customColor
    : '#6366f1';
  document.getElementById('creditCardCustomColorGroup').hidden =
    document.getElementById('creditCardIssuerBank').value !== 'Outro';
  document.getElementById('creditCardLimit').value = card ? card.totalLimit : '';
  document.getElementById('creditCardPreviousSpent').value =
    card ? card.previousSpent || '' : '';
  document.getElementById('creditCardClosingDay').value = card ? card.closingDay : '';
  document.getElementById('creditCardDueDay').value = card ? card.dueDay : '';
  const accountSelect = document.getElementById('creditCardAccount');
  accountSelect.innerHTML = '<option value="">Sem conta vinculada</option>' +
    FinanceData.getAccounts().map(account =>
      `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)} (${escapeHtml(account.type)})</option>`
    ).join('');
  accountSelect.value = card ? card.accountId || '' : '';
  const error = document.getElementById('creditCardFormError');
  error.textContent = '';
  error.hidden = true;
  modal.classList.add('active');
  setTimeout(() => document.getElementById('creditCardName').focus(), 100);
}

function closeCreditCardModal() {
  document.getElementById('creditCardModal').classList.remove('active');
}

function deleteCreditCard(id) {
  const card = FinanceData.getCreditCards().find(item => item.id === id);
  if (!card) return;
  showConfirm({
    title: 'Excluir cartão?',
    message: `Excluir "${card.name}" da lista? As compras já cadastradas e as parcelas pendentes serão mantidas no histórico.`,
    iconClass: 'fa-solid fa-trash-can',
    okLabel: 'Sim, excluir cartão',
    onConfirm: async () => {
      try {
        const result = await FinanceData.deleteCreditCard(id);
        renderAll();
        if (!result.success) {
          showToast(`O cartão foi removido localmente, mas a sincronização falhou: ${result.error && result.error.message || result.error || 'erro desconhecido'}`, 'error');
          return;
        }
        showToast('Cartão excluído.');
      } catch (error) {
        console.error('[GastoPro] Falha ao excluir cartão:', error);
        renderAll();
        showToast(`Não foi possível excluir o cartão: ${error.message || error}`, 'error');
      }
    }
  });
}

function openAdjustAccountModal(id = '') {
  const accounts = FinanceData.getAccounts();
  if (!accounts.length) {
    showToast('Cadastre uma conta antes de ajustar o saldo.', 'error');
    return;
  }
  const accountSelect = document.getElementById('adjustAccountId');
  updateAccountSelects();
  const account = accounts.length === 1
    ? accounts[0]
    : null;
  accountSelect.value = account ? account.id : '';
  if (!accountSelect.dataset.adjustBalanceBound) {
    accountSelect.addEventListener('change', () =>
      updateAdjustAccountFields(accountSelect.value)
    );
    accountSelect.dataset.adjustBalanceBound = 'true';
  }
  updateAdjustAccountFields(account ? account.id : '');
  document.getElementById('adjustAccountBalanceDate').value = account
    ? account.balanceDate || getTodayString()
    : getTodayString();
  const error = document.getElementById('adjustAccountError');
  error.textContent = '';
  error.hidden = true;
  document.getElementById('adjustAccountModal').classList.add('active');
  setTimeout(() => (account ? document.getElementById('adjustAccountBalance') : accountSelect).focus(), 100);
}

function updateAdjustAccountFields(accountId) {
  const accounts = FinanceData.getAccounts();
  const account = accounts.find(item => item.id === accountId) || null;
  const saveButton = document.getElementById('saveAdjustAccountBtn');
  if (saveButton) saveButton.disabled = accounts.length > 1 && !account;
  const balanceInput = document.getElementById('adjustAccountBalance');
  if (balanceInput) {
    balanceInput.value = account ? FinanceData.getAccountBalance(account.id) : '';
  }
  const dateInput = document.getElementById('adjustAccountBalanceDate');
  if (dateInput) dateInput.value = account ? account.balanceDate || getTodayString() : getTodayString();
  const name = document.getElementById('adjustAccountName');
  if (name) {
    name.textContent = account
      ? `Saldo real em ${account.balanceDate || getTodayString()}`
      : 'Selecione a conta e informe o saldo real na data escolhida.';
  }
}

function closeAdjustAccountModal() {
  document.getElementById('adjustAccountModal').classList.remove('active');
}

function requestFirstEntryAccount() {
  if (FinanceData.getAccounts().length) return Promise.resolve(null);
  if (firstEntryAccountRequest) return firstEntryAccountRequest.promise;

  const modal = document.getElementById('firstEntryAccountModal');
  const form = document.getElementById('firstEntryAccountForm');
  const nameInput = document.getElementById('firstEntryAccountName');
  const typeInput = document.getElementById('firstEntryAccountType');
  const balanceInput = document.getElementById('firstEntryAccountBalance');
  const error = document.getElementById('firstEntryAccountError');
  const saveButton = document.getElementById('confirmFirstEntryAccountBtn');
  const cancelButton = document.getElementById('cancelFirstEntryAccountBtn');
  const closeButton = document.getElementById('closeFirstEntryAccountBtn');
  if (!modal || !form || !nameInput || !typeInput || !balanceInput || !error || !saveButton ||
    !cancelButton || !closeButton) {
    return Promise.reject(new Error('O formulário de confirmação da conta não está disponível.'));
  }

  nameInput.value = 'Conta principal';
  typeInput.value = 'PF';
  balanceInput.value = '0';
  error.textContent = '';
  error.hidden = true;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');

  let resolveRequest;
  const promise = new Promise(resolve => {
    resolveRequest = resolve;
  });
  firstEntryAccountRequest = { promise, resolve: resolveRequest };
  let submitting = false;

  function close(accountId = null) {
    if (submitting) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const request = firstEntryAccountRequest;
    firstEntryAccountRequest = null;
    if (request) request.resolve(accountId);
  }

  if (!form.dataset.firstEntryAccountBound) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      const name = nameInput.value.trim();
      const balanceRaw = balanceInput.value;
      const balance = Number(balanceRaw);
      if (!name || name.length > 100 || balanceRaw === '' || !Number.isFinite(balance) ||
        Math.abs(balance) > 9999999999.99 || !['PF', 'PJ'].includes(typeInput.value)) {
        error.textContent = 'Informe um nome, tipo e saldo válidos para a conta.';
        error.hidden = false;
        return;
      }

      const previousIds = new Set(FinanceData.getAccounts().map(account => account.id));
      submitting = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      closeButton.disabled = true;
      error.hidden = true;
      try {
        const result = await FinanceData.addAccount({
          name,
          type: typeInput.value,
          initialBalance: balance,
          balanceDate: null
        });
        const created = FinanceData.getAccounts().find(account =>
          !previousIds.has(account.id)
        );
        if (!created) {
          error.textContent = result.error && result.error.message ||
            result.error || 'Não foi possível cadastrar a conta.';
          error.hidden = false;
          return;
        }
        if (!result.success) {
          showToast('Conta salva neste aparelho; a sincronização ficou pendente.');
        }
        submitting = false;
        close(created.id);
      } catch (saveError) {
        console.error('[GastoPro] Falha ao confirmar a conta do primeiro lançamento:', saveError);
        error.textContent = `Não foi possível cadastrar a conta: ${saveError.message || saveError}`;
        error.hidden = false;
      } finally {
        submitting = false;
        saveButton.disabled = false;
        cancelButton.disabled = false;
        closeButton.disabled = false;
      }
    });
    form.dataset.firstEntryAccountBound = 'true';
    cancelButton.addEventListener('click', () => close());
    closeButton.addEventListener('click', () => close());
    modal.addEventListener('click', event => {
      if (event.target === modal && !submitting) close();
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !submitting) close();
    });
  }

  setTimeout(() => nameInput.focus(), 0);
  return promise;
}

async function withNewEntryAccount(selectedAccountId, save) {
  if (FinanceData.getAccounts().length) return save(selectedAccountId || null);
  const accountId = await requestFirstEntryAccount();
  if (!accountId) return null;
  return save(accountId);
}

window.GastoProAccountFlow = {
  requestFirstEntryAccount,
  withNewEntryAccount,
  openAdjustAccountModal,
  updateAdjustAccountFields
};

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
          showToast(`Não foi possível concluir a sincronização da exclusão: ${result.error && result.error.message || result.error || 'erro desconhecido'}`, 'error');
          return;
        }
        showToast('Conta excluída. Os lançamentos vinculados foram mantidos sem conta.');
      } catch (error) {
        console.error('[GastoPro] Falha ao excluir conta:', error);
        renderAll();
        showToast(`Não foi possível excluir a conta: ${error.message || error}`, 'error');
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
  onBackup, secondaryLabel, onSecondary, keepOpenOnConfirm = false, rememberLabel,
  confirmationPhrase, onCancel
}) {
  const modal = document.getElementById('confirmModal');
  const iconEl = document.getElementById('confirmIcon');
  const iconWrapper = document.getElementById('confirmIconWrapper');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const backupBtn = document.getElementById('confirmBackupBtn');
  const rememberOption = document.getElementById('confirmRememberOption');
  const rememberCheckbox = document.getElementById('confirmRememberCheckbox');
  const rememberText = document.getElementById('confirmRememberLabel');
  const phraseGroup = document.getElementById('confirmPhraseGroup');
  const phraseInput = document.getElementById('confirmPhraseInput');
  const phraseLabel = document.getElementById('confirmPhraseLabel');

  iconEl.className = iconClass || 'fa-solid fa-triangle-exclamation';
  iconWrapper.className = 'confirm-icon-wrapper confirm-icon-danger';
  titleEl.textContent = title || 'Tem certeza?';
  msgEl.textContent = message || 'Esta ação não pode ser desfeita.';
  if (phraseGroup && phraseInput && phraseLabel) {
    phraseGroup.hidden = !confirmationPhrase;
    phraseInput.value = '';
    phraseLabel.textContent = confirmationPhrase
      ? `Digite ${confirmationPhrase} para confirmar`
      : '';
  }
  if (rememberOption && rememberCheckbox && rememberText) {
    rememberOption.hidden = !rememberLabel;
    rememberCheckbox.checked = false;
    rememberText.textContent = rememberLabel || '';
  }

  // Clona os botões para remover listeners antigos e evitar acúmulo
  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  const newBackup = backupBtn ? backupBtn.cloneNode(true) : null;
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
  if (backupBtn && newBackup) {
    backupBtn.parentNode.replaceChild(newBackup, backupBtn);
    newBackup.hidden = !onBackup && !onSecondary;
    newBackup.textContent = secondaryLabel || 'Cópia de segurança (para restaurar no app)';
  }

  newOk.textContent = okLabel || 'Confirmar';
  newOk.className = okBtnClass || 'btn-danger';
  newOk.disabled = Boolean(confirmationPhrase);

  newOk.addEventListener('click', async () => {
    if (confirmationPhrase &&
      !window.GastoProDeletionConfirmation.isValid(phraseInput.value, confirmationPhrase)) return;
    if (!keepOpenOnConfirm) modal.classList.remove('active');
    await onConfirm(newOk, Boolean(rememberCheckbox && rememberCheckbox.checked));
  });
  if (confirmationPhrase && phraseInput) {
    phraseInput.addEventListener('input', () => {
      newOk.disabled = !window.GastoProDeletionConfirmation.isValid(
        phraseInput.value, confirmationPhrase
      );
    });
  }
  newCancel.addEventListener('click', () => {
    modal.classList.remove('active');
    if (onCancel) onCancel();
  });
  if (newBackup && (onBackup || onSecondary)) {
    newBackup.addEventListener('click', async () => {
      if (onSecondary) {
        if (!keepOpenOnConfirm) modal.classList.remove('active');
        await onSecondary(newBackup, Boolean(rememberCheckbox && rememberCheckbox.checked));
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
  const isFixed = FinanceData.getActiveTemplates().some(template => template.id === id);
  const isCardPurchase = FinanceData.getCreditCardPurchases().some(purchase => purchase.id === id);
  showConfirm({
    title: isCardPurchase ? 'Excluir compra parcelada?' : isFixed ? 'Excluir modelo recorrente?' : 'Excluir lançamento?',
    message: isCardPurchase
      ? 'A compra original e todas as suas parcelas, pagas ou futuras, serão removidas; não apenas este mês. Deseja excluir?'
      : isFixed
        ? 'O modelo recorrente e seu histórico mensal serão removidos, não apenas este mês. Deseja excluir?'
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
window.togglePaidEntry = async function(id, kind = null, installmentNumber = null, ym = null) {
  const currentYm = ym || getYearMonthString(state.currentYear, state.currentMonth);
  if (kind === 'credit-card') {
    const result = await FinanceData.toggleCreditCardPurchasePaid(id, Number(installmentNumber));
    if (!result.success) {
      showToast(`Não foi possível registrar o pagamento da parcela: ${result.error && result.error.message || result.error || 'erro desconhecido'}`, 'error');
    }
  } else {
    FinanceData.togglePaid(id, currentYm);
  }
  renderAll();
};

async function markImportedPaidAsReviewed(id) {
  try {
    removePaidImportReviewId(id);
    syncPaidImportReviewNotification();
    if (document.getElementById('currentMonthLabel')) renderAll();
    showToast('Lançamento marcado como conferido.');
  } catch (error) {
    console.error('[GastoPro] Não foi possível concluir a revisão do lançamento:', error);
    showToast('Não foi possível salvar a revisão deste lançamento.', 'error');
  }
}

async function changeImportedPaidToPending(id) {
  const entries = FinanceData.getEntries();
  const target = entries.find(entry => entry.id === id);
  if (!target) {
    console.warn('[GastoPro] Lançamento para revisão não encontrado:', id);
    showToast('Este lançamento não está mais disponível.', 'error');
    return;
  }

  const result = await FinanceData.saveEntries(
    entries.map(entry => entry.id === id ? { ...entry, paid: false } : entry),
    { flush: false }
  );
  if (!result.success) {
    console.error('[GastoPro] Não foi possível alterar o lançamento para pendente:', result.error);
    showToast('Não foi possível alterar este lançamento para pendente.', 'error');
    return;
  }

  try {
    removePaidImportReviewId(id);
    syncPaidImportReviewNotification();
    if (document.getElementById('currentMonthLabel')) renderAll();
    showToast('Lançamento alterado para pendente.');
  } catch (error) {
    console.error('[GastoPro] O lançamento foi alterado, mas não foi possível atualizar a lista de revisão:', error);
    if (document.getElementById('currentMonthLabel')) renderAll();
    showToast('Lançamento pendente, mas a lista de revisão não pôde ser atualizada.', 'error');
  }
}

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
window.GastoProSyncHelpers = {
  createAutomaticSyncGate(intervalMs = 15000) {
    let lastStartedAt = 0;
    let inFlight = null;
    return {
      async run(now, action) {
        if (inFlight) return inFlight;
        if (lastStartedAt && now - lastStartedAt < intervalMs) return false;
        lastStartedAt = now;
        const pending = Promise.resolve().then(action);
        inFlight = pending;
        try {
          return await pending;
        } finally {
          if (inFlight === pending) inFlight = null;
        }
      },
      reset() {
        lastStartedAt = 0;
        inFlight = null;
      }
    };
  },
  isRecordBeingEdited(kind, key, documentRef = document) {
    if (kind === 'profiles') {
      const nameInput = documentRef.getElementById('profileNameInput');
      return Boolean(nameInput && documentRef.activeElement === nameInput);
    }
    const forms = {
      entries: ['editModal', 'editItemId'],
      templates: ['editModal', 'editItemId'],
      accounts: ['accountModal', 'accountId'],
      creditCards: ['creditCardModal', 'creditCardId'],
      goals: ['goalModal', 'goalCategorySelect']
    };
    const form = forms[kind];
    if (!form) return false;
    const modal = documentRef.getElementById(form[0]);
    const field = documentRef.getElementById(form[1]);
    return Boolean(modal && modal.classList.contains('active') && field && field.value === String(key));
  },
  isRemoteRecordDifferent(current, incoming, deletedAt) {
    if (deletedAt) return current !== null && current !== undefined &&
      (!Array.isArray(current) || current.length > 0);
    return JSON.stringify(current) !== JSON.stringify(incoming);
  },
  deferOrApply(change, key, isEditing, apply, deferred, onDeferred) {
    if (isEditing) {
      deferred.set(key, change);
      onDeferred();
      return false;
    }
    apply(change);
    return true;
  },
  bindLifecycleListeners(documentRef, windowRef, onReturn) {
    const visibilityHandler = () => {
      if (documentRef.visibilityState === 'visible') onReturn('visibilitychange');
    };
    const focusHandler = () => onReturn('focus');
    const onlineHandler = () => onReturn('online');
    documentRef.addEventListener('visibilitychange', visibilityHandler);
    windowRef.addEventListener('focus', focusHandler);
    windowRef.addEventListener('online', onlineHandler);
    return () => {
      documentRef.removeEventListener('visibilitychange', visibilityHandler);
      windowRef.removeEventListener('focus', focusHandler);
      windowRef.removeEventListener('online', onlineHandler);
    };
  }
};

function formatServiceWorkerCacheVersion(cacheName) {
  if (typeof cacheName !== 'string' || !/^gastopro-v\d+(?:\.\d+)*$/.test(cacheName)) return null;
  return `v${cacheName.slice('gastopro-v'.length)}`;
}

function getDisplayedAppVersion(cacheName) {
  return formatServiceWorkerCacheVersion(cacheName) || 'v…';
}

function updateDisplayedAppVersion() {
  const badges = document.querySelectorAll('.badge-version');
  if (!badges.length || !('serviceWorker' in navigator) || typeof MessageChannel !== 'function') return;

  navigator.serviceWorker.ready.then(registration => {
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => channel.port1.close(), 5000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      badges.forEach(badge => {
        badge.textContent = getDisplayedAppVersion(event.data && event.data.cacheName);
      });
      channel.port1.close();
    };
    worker.postMessage({ type: 'GASTOPRO_GET_CACHE_NAME' }, [channel.port2]);
  }).catch(error => {
    console.info('[GastoPro] Não foi possível consultar a versão do app:', error);
  });
}

window.GastoProAppVersion = {
  formatCacheName: formatServiceWorkerCacheVersion,
  getDisplayedVersion: getDisplayedAppVersion
};

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const legacyBalance = event.target.closest('#dashboardCurrentBalance');
  if (legacyBalance && !legacyBalance.dataset.action) openAdjustAccountModal();
});

document.addEventListener('DOMContentLoaded', () => {
  applyGoogleAuthPriority(document);
  const backToTopBtn = document.getElementById('backToTopBtn');
  if (backToTopBtn) {
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    window.addEventListener('resize', updateBackToTopVisibility);
    bindBackToTopClick(backToTopBtn);
    updateBackToTopVisibility();
  }
  setupEntryComposer();
  window.GastoProSubmitFeedback.bindValidation(
    document.getElementById('incomeForm'),
    'income'
  );
  window.GastoProSubmitFeedback.bindValidation(
    document.getElementById('expenseForm'),
    'expense'
  );
  bindLoansForm();
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

  function setPaymentMethodSelection(kind, paymentMethod, remember = true) {
    const select = document.getElementById(`${kind}PaymentMethod`);
    if (!select || !PAYMENT_METHOD_OPTIONS[kind].some(option => option.value === paymentMethod)) return;
    select.value = paymentMethod;
    if (remember) {
      try {
        savePaymentMethodPreference(kind, paymentMethod);
      } catch (error) {
        console.error('[GastoPro] Não foi possível atualizar a forma de pagamento preferida:', error);
        showToast('A forma foi selecionada, mas não foi possível salvar sua preferência.', 'error');
      }
    }
    if (kind === 'expense') {
      if (paymentMethod === 'credit_card') {
        document.getElementById('expenseType').value = 'variable';
      }
      updateCreditCardPurchaseFields();
      checkDebtVisibility();
    }
  }

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
  const reportAccountFilter = document.getElementById('reportAccountFilter');
  const exportReportCsvBtn = document.getElementById('exportReportCsvBtn');
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
    if (reportAccountFilter) {
      reportAccountFilter.innerHTML = getAccountBalanceOptionsMarkup(FinanceData.getAccounts());
      reportAccountFilter.value = state.accountBalanceFilter;
      if (!reportAccountFilter.value) reportAccountFilter.value = 'all';
    }
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

  function getReportPeriodValues() {
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
    return {
      type,
      from,
      to,
      accountFilter: reportAccountFilter ? reportAccountFilter.value : 'all'
    };
  }

  function showReportError(error) {
    console.error('[GastoPro] Falha ao gerar ou entregar o relatório:', error);
    reportError.textContent = error.message ||
      'Não foi possível gerar ou baixar o relatório neste aparelho.';
    reportError.hidden = false;
  }

  if (exportReportCsvBtn) {
    exportReportCsvBtn.addEventListener('click', () => {
      reportError.hidden = true;
      try {
        const period = getReportPeriodValues();
        const data = buildReportData({ ...period, includeDetails: true });
        const blob = new Blob([`\uFEFF${buildReportCsv(data)}`], {
          type: 'text/csv;charset=utf-8'
        });
        if (!downloadReportFile(blob, getReportCsvFileName(data))) {
          throw new Error('Não foi possível baixar o CSV neste navegador.');
        }
      } catch (error) {
        showReportError(error);
      }
    });
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
        const period = getReportPeriodValues();
        const data = buildReportData({
          ...period,
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
        showReportError(error);
      } finally {
        reportGenerationInProgress = false;
        generateReportBtn.disabled = false;
        generateReportBtn.textContent = 'Gerar PDF';
      }
    });
  }
  // ── Navegação e ações delegadas ───────────────────────────────
  const irreversibleActions = document.getElementById('irreversibleActions');
  if (irreversibleActions) bindDetailsExpandedState(irreversibleActions);
  const userTutorials = document.getElementById('userTutorials');
  if (userTutorials) bindDetailsExpandedState(userTutorials);

  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;

    const gotoElement = e.target.closest('[data-goto]');
    if (gotoElement) {
      switchToView(gotoElement.dataset.goto);
      return;
    }

    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const { id } = actionElement.dataset;
    if (!action) return;
    switch (action) {
      case 'open-irreversible-actions': {
        const details = document.getElementById('irreversibleActions');
        const summary = details?.querySelector('summary');
        if (details && summary) {
          details.open = true;
          summary.setAttribute('aria-expanded', 'true');
          summary.focus();
          summary.scrollIntoView({ block: 'center' });
        }
        break;
      }
      case 'open-statement-guide': {
        const guideModal = document.getElementById('statementGuideModal');
        if (guideModal) {
          guideModal.setAttribute('aria-hidden', 'false');
          guideModal.classList.add('active');
        }
        break;
      }
      case 'focus-entry-form': {
        const targets = {
          incomeForm: 'incomeDesc',
          expenseForm: 'expenseDesc'
        };
        const formId = actionElement.dataset.form;
        const focusId = targets[formId];
        const form = focusId && document.getElementById(formId);
        if (form) {
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.getElementById(focusId).focus();
        }
        break;
      }
      case 'open-income-entry':
        openIncomeEntryComposer();
        break;
      case 'open-expense-entry':
        openExpenseEntryComposer();
        break;
      case 'new-goal':
        openGoalModal();
        break;
      case 'close-statement-guide': {
        const guideModal = document.getElementById('statementGuideModal');
        if (guideModal) {
          guideModal.classList.remove('active');
          guideModal.setAttribute('aria-hidden', 'true');
        }
        break;
      }
      case 'admin-filter': {
        const filter = actionElement.dataset.filter;
        if (!['new', 'all', 'archived'].includes(filter)) break;
        adminViewState.filter = filter;
        adminViewState.editingId = null;
        adminViewState.draftReply = '';
        adminViewState.notice = '';
        loadAdminMessages({ reset: true });
        break;
      }
      case 'admin-panel-tab':
        selectAdminPanelTab(actionElement.dataset.tab);
        break;
      case 'admin-analytics-refresh':
        loadAdminAnalytics();
        break;
      case 'admin-reply': {
        if (adminViewState.access !== 'allowed') break;
        const message = adminViewState.messages.find(item => item.id === id);
        if (!message) break;
        if (!message.admin_read_at) markAdminFeedbackRead(id);
        adminViewState.editingId = id;
        adminViewState.draftReply = message.reply || '';
        adminViewState.notice = '';
        renderAdminView();
        document.getElementById('adminReplyText')?.focus();
        break;
      }
      case 'admin-mark-read':
        if (adminViewState.access === 'allowed' && id) markAdminFeedbackRead(id);
        break;
      case 'admin-mark-unread':
        if (adminViewState.access === 'allowed' && id) markAdminFeedbackUnread(id);
        break;
      case 'admin-archive':
        if (adminViewState.access === 'allowed' && id) confirmAdminFeedbackArchive(id, true);
        break;
      case 'admin-unarchive':
        if (adminViewState.access === 'allowed' && id) updateAdminFeedbackArchive(id, false);
        break;
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
      case 'edit-loan':
        editLoan(id);
        break;
      case 'edit-card-purchase':
        openEditModal(id);
        break;
      case 'delete':
        deleteEntry(id);
        break;
      case 'delete-loan':
        deleteLoan(id);
        break;
      case 'loan-toggle-paid':
        markLoanInstallmentPaid(id, actionElement.dataset.month);
        break;
      case 'delete-card-purchase':
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
      case 'remove-fixed-import-rule':
        removeFixedImportRule(actionElement.dataset.rule);
        break;
      case 'adjust-account':
        openAdjustAccountModal(id);
        break;
      case 'open-balance-adjustment':
        openAdjustAccountModal();
        break;
      case 'delete-account':
        deleteAccount(id);
        break;
      case 'new-credit-card':
        openCreditCardModal();
        break;
      case 'open-credit-cards':
        openCreditCardsView();
        break;
      case 'mobile-nav':
        navigateMobileBottomItem(actionElement.dataset.destination);
        break;
      case 'edit-credit-card':
        openCreditCardModal(id);
        break;
      case 'delete-credit-card':
        deleteCreditCard(id);
        break;
      case 'filter-account-balance':
        state.accountBalanceFilter = actionElement.dataset.filter;
        renderAccountBalancesPanel();
        break;
      case 'dismiss-insight':
        if (actionElement.dataset.insightKey) {
          dismissInsight(actionElement.dataset.insightKey);
          renderFinancialInsights();
        }
        break;
      case 'toggle-notifications': {
        const panel = document.getElementById('notificationsPanel');
        const trigger = document.getElementById('notificationsTrigger');
        if (panel && trigger) {
          const opening = panel.hidden;
          if (opening) closeProfileDrawer();
          panel.hidden = !opening;
          trigger.setAttribute('aria-expanded', String(opening));
          if (opening) {
            renderNotificationCenter();
            if (adminViewState.access === 'allowed') {
              refreshAdminFeedbackNotifications().catch(error => {
                console.error('[GastoPro] Falha ao atualizar avisos de feedback:', error);
              });
            }
          }
        }
        break;
      }
      case 'notification-mark-read':
        if (actionElement.dataset.eventKey) {
          const notification = getStoredNotifications().find(item =>
            item.eventKey === actionElement.dataset.eventKey
          );
          if (notification && notification.type === 'adminFeedback') {
            markAdminFeedbackRead(actionElement.dataset.eventKey.slice('adminFeedback:'.length));
          } else {
            markNotificationAsRead(actionElement.dataset.eventKey);
            renderNotificationCenter();
          }
        }
        break;
      case 'notification-navigate':
        if (actionElement.dataset.eventKey) navigateToNotification(actionElement.dataset.eventKey);
        break;
      case 'notification-dismiss':
        if (actionElement.dataset.eventKey) {
          dismissNotification(actionElement.dataset.eventKey);
          renderNotificationCenter();
        }
        break;
      case 'review-import-paid':
        if (id) markImportedPaidAsReviewed(id);
        break;
      case 'pending-import-paid':
        if (id) changeImportedPaidToPending(id);
        break;
      case 'notifications-clear-all':
        clearAllNotifications();
        renderNotificationCenter();
        break;
    }
  });

  const notificationsPanel = document.getElementById('notificationsPanel');
  const notificationsTrigger = document.getElementById('notificationsTrigger');
  const financialInsightsMobileStrip = document.getElementById('financialInsightsMobileStrip');
  const closeNotificationsBtn = document.getElementById('closeNotificationsBtn');
  const closeNotifications = () => {
    if (notificationsPanel) notificationsPanel.hidden = true;
    if (notificationsTrigger) notificationsTrigger.setAttribute('aria-expanded', 'false');
  };
  if (financialInsightsMobileStrip && notificationsTrigger) {
    financialInsightsMobileStrip.addEventListener('click', () => notificationsTrigger.click());
  }
  if (closeNotificationsBtn) closeNotificationsBtn.addEventListener('click', closeNotifications);
  if (notificationsPanel) {
    notificationsPanel.addEventListener('change', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.dataset.notificationType) return;
      const type = input.dataset.notificationType;
      try {
        saveNotificationPreferences({ [type]: input.checked });
      } catch (error) {
        showToast('Não foi possível salvar essa preferência neste aparelho.', 'error');
        return;
      }
      renderFinancialInsights();
      document.querySelector(`[data-notification-type="${type}"]`)?.focus();
    });
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element) ||
        notificationsPanel.hidden ||
        notificationEventPathContains(event, notificationsPanel) ||
        notificationEventPathContains(event, notificationsTrigger) ||
        notificationEventPathContains(event, financialInsightsMobileStrip)) return;
      closeNotifications();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !notificationsPanel.hidden) {
        closeNotifications();
        notificationsTrigger?.focus();
      }
    });
  }
  const userMenuButton = document.getElementById('userMenuBtn');
  if (userMenuButton) userMenuButton.addEventListener('click', closeNotifications);

  const accountBalanceView = document.getElementById('accountBalanceView');
  if (accountBalanceView) {
    accountBalanceView.addEventListener('change', () => {
      state.accountBalanceFilter = accountBalanceView.value;
      renderAll();
    });
  }

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
    if (e.target instanceof HTMLSelectElement &&
      e.target.dataset.action === 'assign-unassigned-account') {
      const { kind, id } = e.target.dataset;
      const accountId = e.target.value;
      if (!accountId) return;
      e.target.disabled = true;
      FinanceData.assignUnassignedAccount(kind, id, accountId).then(result => {
        if (!result.success) {
          showToast(result.error && result.error.message || result.error || 'Não foi possível vincular a conta.', 'error');
          return;
        }
        renderAll();
        showToast('Conta vinculada ao lançamento.');
      }).catch(error => {
        console.error('[GastoPro] Falha ao vincular conta ao lançamento:', error);
        showToast('Não foi possível vincular a conta ao lançamento.', 'error');
      }).finally(() => {
        e.target.disabled = false;
      });
      return;
    }
    if (e.target instanceof HTMLSelectElement && e.target.id === 'adjustAccountId') {
      updateAdjustAccountFields(e.target.value);
    }
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
    if (paidInput) {
      togglePaidEntry(
        paidInput.dataset.id,
        paidInput.dataset.kind,
        paidInput.dataset.installment,
        paidInput.dataset.month
      );
    }
  });

  // ── 1. Navegação da Sidebar ────────────────────────────────────
  // Apenas botões COM data-view disparam switchToView() (evita chamar com null)
  document.querySelectorAll('  .sidebar-nav .nav-item[data-view]').forEach(btn => {
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
    if (state.currentView === 'admin') loadAdminAnalytics();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 12) {
      state.currentMonth = 1;
      state.currentYear++;  // Avança o ano ao passar de Dezembro
    }
    renderAll();
    if (state.currentView === 'admin') loadAdminAnalytics();
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
    const templates = FinanceData.getActiveTemplates();

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
    if (state.currentView === 'admin') loadAdminAnalytics();
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
    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    const desc     = document.getElementById('incomeDesc').value.trim();
    const amount   = parseFloat(document.getElementById('incomeAmount').value);
    const category = document.getElementById('incomeCategory').value;
    const dateVal  = document.getElementById('incomeDate').value || getTodayString();
    const paymentMethod = document.getElementById('incomePaymentMethod').value;

    // Validações básicas antes de persistir
    if (!desc) {
      alert('Por favor, informe a descrição do ganho.');
      setButtonSubmissionState(saveButton, 'error', 'informe a descrição do ganho.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido para o ganho.');
      setButtonSubmissionState(saveButton, 'error', 'informe um valor válido para o ganho.');
      return;
    }

    // O mês de competência é extraído da data informada pelo usuário
    // (permite lançar ganhos de outros meses sem mudar o mês ativo)
    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    if (!beginButtonSubmission(saveButton)) return;
    let submissionState = null;
    let saveResult;
    try {
      saveResult = await withNewEntryAccount(
        document.getElementById('incomeAccount').value || null,
        accountId => withSaving(saveButton, async () => {
      try {
        const savedItem = FinanceData.add({
          month: itemMonth,
          type: 'income',
          desc: desc,
          amount: amount,
          category: category,
          paymentMethod,
          paid: isPaidByPaymentMethod(paymentMethod, dateVal),
          accountId,
          date: dateVal
        });
        if (!savedItem) {
          const message = FinanceData.getAccounts().length
            ? 'Selecione uma conta de destino antes de salvar o ganho.'
            : 'Não foi possível criar a Conta principal para salvar o ganho.';
          alert(message);
          submissionState = { state: 'error', message };
          return submissionState;
        }

        completeEntrySave('income');
        document.getElementById('incomeDesc').focus();

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        submissionState = syncResult.success
          ? { state: 'saved' }
          : { state: 'pending' };
        return submissionState;
      } catch (err) {
        console.error('Erro ao adicionar ganho:', err);
        alert('Ocorreu um erro ao salvar o ganho: ' + err.message);
        submissionState = { state: 'error', message: err.message };
        return submissionState;
      }
        })
      );
    } catch (error) {
      console.error('Erro ao preparar o salvamento do ganho:', error);
      reportSubmitNoEffect('income', 'Não foi possível iniciar o salvamento do ganho. Tente novamente.');
      setButtonSubmissionState(saveButton, 'error', 'não foi possível iniciar o salvamento.');
      return;
    }
    if (saveResult === null) {
      reportSubmitNoEffect('income', 'Ganho não salvo: a conta de destino não foi confirmada.');
      setButtonSubmissionState(saveButton, 'error', 'a conta de destino não foi confirmada.');
    } else if (saveResult === false) {
      reportSubmitNoEffect('income', 'Outro salvamento está em andamento. Aguarde e tente novamente.');
      setButtonSubmissionState(saveButton, 'error', 'outro salvamento está em andamento.');
    } else {
      const finalState = submissionState || saveResult;
      setButtonSubmissionState(saveButton, finalState.state || 'error',
        finalState.message || 'não foi possível confirmar o salvamento.');
    }
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
    if (!expenseEndMonthWrapper || !expenseTypeSelect) return;
    const isDebt = (expenseTypeSelect.value === 'debt') ||
                   (expenseCatSelect && (expenseCatSelect.value === 'Empréstimo' || expenseCatSelect.value === 'Parcelamento'));
    expenseEndMonthWrapper.style.display = isDebt ? 'block' : 'none';
    const categoryGroup = document.getElementById('expenseCategoryGroup');
    const paymentMethodGroup = document.getElementById('expensePaymentMethodGroup');
    if (categoryGroup) categoryGroup.hidden = false;
    if (paymentMethodGroup) paymentMethodGroup.hidden = false;
    if (expenseCatSelect) expenseCatSelect.required = true;
    const paymentMethod = document.getElementById('expensePaymentMethod');
    if (paymentMethod && paymentMethod.value === 'credit_card' &&
      expenseTypeSelect && expenseTypeSelect.value !== 'variable') {
      expenseTypeSelect.value = 'variable';
    }
    updateCreditCardPurchaseFields();
    const dateVal = document.getElementById('expenseDate').value || getTodayString();
    const requiresDueDay = expenseTypeSelect.value === 'fixed' || expenseTypeSelect.value === 'debt' ||
      (expenseTypeSelect.value === 'variable' && paymentMethod.value !== 'credit_card' &&
        !isPaidByPaymentMethod(paymentMethod.value, dateVal));
    const dueDayWrapper = document.getElementById('expenseDueDayWrapper');
    const dueDayInput = document.getElementById('expenseDueDay');
    if (dueDayWrapper) dueDayWrapper.hidden = !requiresDueDay;
    if (dueDayInput) dueDayInput.required = requiresDueDay;
  }
  if (expenseTypeSelect) expenseTypeSelect.addEventListener('change', checkDebtVisibility);
  if (expenseCatSelect) expenseCatSelect.addEventListener('change', checkDebtVisibility);
  if (expenseDateInput) expenseDateInput.addEventListener('change', checkDebtVisibility);
  ['income', 'expense'].forEach(kind => {
    const select = document.getElementById(`${kind}PaymentMethod`);
    if (!select) return;
    populatePaymentMethodSelect(select, kind);
    setPaymentMethodSelection(kind, getPaymentMethodPreference(kind), false);
    select.addEventListener('change', () => {
      setPaymentMethodSelection(kind, select.value);
      if (kind === 'expense') checkDebtVisibility();
    });
  });
  const creditCardSelect = document.getElementById('expenseCreditCard');
  if (creditCardSelect) {
    creditCardSelect.addEventListener('change', updateCreditCardPurchaseFields);
  }
  const creditCardIssuerSelect = document.getElementById('creditCardIssuerBank');
  if (creditCardIssuerSelect) {
    creditCardIssuerSelect.addEventListener('change', () => {
      document.getElementById('creditCardCustomColorGroup').hidden =
        creditCardIssuerSelect.value !== 'Outro';
    });
  }

  document.getElementById('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    const desc = document.getElementById('expenseDesc').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const type = document.getElementById('expenseType').value;
    const category = document.getElementById('expenseCategory').value;
    const dateVal = document.getElementById('expenseDate').value || getTodayString();
    const endMonthVal = document.getElementById('expenseEndMonth') ? document.getElementById('expenseEndMonth').value : null;
    const paymentMethod = document.getElementById('expensePaymentMethod').value;
    const dueDayValue = document.getElementById('expenseDueDay').value;

    if (!desc) {
      alert('Por favor, informe a descrição do gasto.');
      setButtonSubmissionState(saveButton, 'error', 'informe a descrição do gasto.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, informe um valor válido maior que zero.');
      setButtonSubmissionState(saveButton, 'error', 'informe um valor válido maior que zero.');
      return;
    }
    const requiresDueDay = type === 'fixed' || type === 'debt' ||
      (type === 'variable' && paymentMethod !== 'credit_card' &&
        !isPaidByPaymentMethod(paymentMethod, dateVal));
    const dueDay = dueDayValue === '' ? null : Number(dueDayValue);
    if (requiresDueDay && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      alert('Informe um dia de vencimento entre 1 e 31.');
      setButtonSubmissionState(saveButton, 'error', 'informe um dia de vencimento entre 1 e 31.');
      return;
    }
    if (dueDayValue !== '' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      alert('O dia de vencimento deve estar entre 1 e 31.');
      setButtonSubmissionState(saveButton, 'error', 'o dia de vencimento deve estar entre 1 e 31.');
      return;
    }

    const itemMonth = dateVal ? dateVal.substring(0, 7) : getYearMonthString(state.currentYear, state.currentMonth);

    if (!beginButtonSubmission(saveButton)) return;
    let submissionState = null;
    const selectedAccountId = paymentMethod === 'credit_card'
      ? document.getElementById('expenseCreditAccount').value || null
      : document.getElementById('expenseAccount').value || null;
    let saveResult;
    try {
      saveResult = await withNewEntryAccount(selectedAccountId, accountId => withSaving(saveButton, async () => {
      try {
        if (paymentMethod === 'credit_card') {
          const cardId = document.getElementById('expenseCreditCard').value;
          if (type !== 'variable') {
            alert('Compras no crédito devem ser cadastradas como gasto variável.');
            submissionState = { state: 'error', message: 'cadastre a compra como gasto variável.' };
            return submissionState;
          }
          if (!FinanceData.getCreditCards().length) {
            alert('Cadastre um cartão de crédito antes de lançar uma compra.');
            submissionState = { state: 'error', message: 'cadastre um cartão antes de lançar a compra.' };
            return submissionState;
          }
          const result = await FinanceData.addCreditCardPurchase({
            cardId,
            desc,
            amount,
            category,
            purchaseDate: dateVal,
            accountId,
            installmentCount: Number(document.getElementById('expenseInstallments').value)
          });
          if (!result.purchase) {
            const message = result.error && result.error.message || result.error ||
              'Não foi possível salvar a compra no cartão.';
            alert(message);
            submissionState = { state: 'error', message };
            return submissionState;
          }
          completeEntrySave('expense');
          updateCreditCardPurchaseFields();
          checkDebtVisibility();
          document.getElementById('expenseDesc').focus();
          state.expenseFilter = 'all';
          document.querySelectorAll('.filter-tabs-row .filter-btn').forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-filter') === 'all');
          });
          renderAll();
          submissionState = result.success ? { state: 'saved' } : { state: 'pending' };
          return submissionState;
        }

        const savedItem = FinanceData.add({
          month: itemMonth,
          type: type,
          desc: desc,
          amount: amount,
          category: category,
          paymentMethod: type === 'variable' ? paymentMethod : null,
          paid: isPaidByPaymentMethod(paymentMethod, dateVal),
          date: dateVal,
          accountId,
          dueDay,
          endMonth: endMonthVal || null
        });
        if (!savedItem) {
          const message = FinanceData.getAccounts().length
            ? 'Selecione uma conta de destino antes de salvar o gasto.'
            : 'Não foi possível criar a Conta principal para salvar o gasto.';
          alert(message);
          submissionState = { state: 'error', message };
          return submissionState;
        }

        completeEntrySave('expense');
        checkDebtVisibility();
        document.getElementById('expenseDesc').focus();

        state.expenseFilter = 'all';
        document.querySelectorAll('.filter-tabs-row .filter-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-filter') === 'all');
        });

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        submissionState = syncResult.success
          ? { state: 'saved' }
          : { state: 'pending' };
        return submissionState;
      } catch (err) {
        console.error('Erro ao adicionar gasto:', err);
        alert('Ocorreu um erro ao salvar o gasto: ' + err.message);
        submissionState = { state: 'error', message: err.message };
        return submissionState;
      }
      }));
    } catch (error) {
      console.error('Erro ao preparar o salvamento do gasto:', error);
      reportSubmitNoEffect('expense', 'Não foi possível iniciar o salvamento do gasto. Tente novamente.');
      setButtonSubmissionState(saveButton, 'error', 'não foi possível iniciar o salvamento.');
      return;
    }
    if (saveResult === null) {
      reportSubmitNoEffect('expense', 'Gasto não salvo: a conta de destino não foi confirmada.');
      setButtonSubmissionState(saveButton, 'error', 'a conta de destino não foi confirmada.');
    } else if (saveResult === false) {
      reportSubmitNoEffect('expense', 'Outro salvamento está em andamento. Aguarde e tente novamente.');
      setButtonSubmissionState(saveButton, 'error', 'outro salvamento está em andamento.');
    } else {
      const finalState = submissionState || saveResult;
      setButtonSubmissionState(saveButton, finalState.state || 'error',
        finalState.message || 'não foi possível confirmar o salvamento.');
    }
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
    const dueDayValue = document.getElementById('editDueDay').value;
    const dueDay = dueDayValue === '' ? null : Number(dueDayValue);
    const source = FinanceData.getAll().find(entry => entry.id === id);
    const purchaseSource = FinanceData.getCreditCardPurchases().find(purchase => purchase.id === id);
    const dueDayRequired = type === 'fixed' || type === 'debt' ||
      Boolean(source && source.isTemplate) ||
      Boolean(source && source.paid === false && source.paymentMethod !== 'credit_card' && type !== 'income');

    if (!id || !desc || isNaN(amount) || amount <= 0) {
      alert('Por favor, informe a descrição e um valor maior que zero.');
      return;
    }
    if (dueDayRequired && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      alert('Informe um dia de vencimento entre 1 e 31.');
      return;
    }
    if (dueDayValue !== '' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      alert('O dia de vencimento deve estar entre 1 e 31.');
      return;
    }

    const saveButton = e.submitter || e.currentTarget.querySelector('button[type="submit"]');
    if (source && source.type === 'variable' && type === 'fixed') {
      const sourceForMatching = { ...source, desc, date };
      const matches = findFutureFixedDescriptionMatches(sourceForMatching, FinanceData.getEntries());
      const fields = {
        desc,
        amount,
        category,
        active,
        endMonth,
        dueDay,
        accountId: document.getElementById('editAccount').value || null
      };
      const convert = async (futureIds, remember) => withSaving(saveButton, async () => {
        try {
          const result = await FinanceData.convertEntryToTemplate(id, fields, futureIds);
          if (!result.template) throw result.error || new Error('Não foi possível converter para gasto fixo.');
          let syncSucceeded = result.success;
          if (remember) {
            const normalized = normalizeFixedDescription(desc);
            const savedRules = [...new Set([...FinanceData.getFixedImportRules(), normalized])];
            const rulesResult = await FinanceData.saveFixedImportRules(savedRules);
            if (!FinanceData.getFixedImportRules().includes(normalized)) {
              throw rulesResult.error || new Error('Não foi possível salvar a regra de importação.');
            }
            syncSucceeded = syncSucceeded && rulesResult.success;
            renderFixedImportRules();
          }
          renderAll();
          closeEditModal();
          showToast(syncSucceeded
            ? `Gasto fixo criado${result.convertedCount ? `; ${result.convertedCount} lançamento(s) futuro(s) consolidado(s)` : ''}.`
            : 'Gasto fixo salvo neste aparelho; a sincronização ficou pendente.');
        } catch (error) {
          console.error('[GastoPro] Erro ao converter lançamento em gasto fixo:', error);
          showToast(error.message || 'Não foi possível converter para gasto fixo.', 'error');
        }
      });

      if (matches.length) {
        showConfirm({
          title: 'Consolidar gastos parecidos?',
          message: `Aplicar Fixo a ${matches.length} lançamento${matches.length === 1 ? '' : 's'} parecido${matches.length === 1 ? '' : 's'} nos meses seguintes?`,
          iconClass: 'fa-solid fa-repeat',
          okLabel: 'Aplicar',
          okBtnClass: 'btn-primary',
          secondaryLabel: 'Só este',
          rememberLabel: 'Lembrar para as próximas importações',
          onConfirm: (_button, remember) => convert(matches.map(entry => entry.id), remember),
          onSecondary: (_button, remember) => convert([], remember)
        });
      } else {
        convert([], false);
      }
      return;
    }

    const categoryMatches = source && source.type === type && source.category !== category
      ? findSimilarCategoryEntries({ ...source, desc }, FinanceData.getAll(), category)
      : [];
    await withSaving(saveButton, async () => {
      try {
        const updatedFields = {
          desc: desc,
          amount: amount,
          category: category,
          type: type,
          date: date,
          active: active,
          endMonth: endMonth,
          dueDay,
          accountId: document.getElementById('editAccount').value || null
        };
        if (purchaseSource) {
          const installmentCount = Number(document.getElementById('editInstallments').value);
          if ((purchaseSource.paidInstallments || []).some(number => number > installmentCount)) {
            showToast('Não é possível reduzir as parcelas abaixo de uma parcela já paga.', 'error');
            return;
          }
          updatedFields.cardId = document.getElementById('editCreditCard').value;
          updatedFields.installmentCount = installmentCount;
          updatedFields.paymentMethod = 'credit_card';
        } else if (source && !source.isTemplate) {
          updatedFields.paymentMethod = document.getElementById('editPaymentMethod').value || null;
        }
        const updated = await FinanceData.update(id, updatedFields);
        if (!updated) {
          showToast('Não é possível alterar entre lançamento pontual e recorrente pela edição.', 'error');
          return;
        }

        renderAll();
        const syncResult = await waitForAuthenticatedSave();
        if (!syncResult.success) return;
        closeEditModal();
        if (categoryMatches.length) {
          showConfirm({
            title: 'Aplicar categoria a lançamentos parecidos?',
            message: `Encontramos ${categoryMatches.length} lançamento${categoryMatches.length === 1 ? '' : 's'} com descrição parecida. Aplicar a categoria "${category}" também a eles?`,
            iconClass: 'fa-solid fa-tags',
            okLabel: 'Aplicar categoria',
            okBtnClass: 'btn-primary',
            secondaryLabel: 'Só este lançamento',
            onConfirm: button => withSaving(button, async () => {
              let failedCount = 0;
              const changed = categoryMatches.filter(match => {
                const result = FinanceData.update(match.id, { category });
                if (!result) failedCount++;
                return Boolean(result);
              });
              renderAll();
              const categorySync = await waitForAuthenticatedSave();
              if (!categorySync.success) return;
              showToast(failedCount
                ? `${changed.length} lançamento${changed.length === 1 ? '' : 's'} atualizado${changed.length === 1 ? '' : 's'}; ${failedCount} não puderam ser alterados.`
                : `${changed.length} lançamento${changed.length === 1 ? '' : 's'} atualizado${changed.length === 1 ? '' : 's'} com a categoria ${category}.`,
              failedCount ? 'error' : 'success');
            }),
            onSecondary: () => showToast('Categoria atualizada somente neste lançamento.')
          });
        } else {
          showToast('Informações alteradas com sucesso!');
        }
      } catch (error) {
        console.error('[GastoPro] Erro ao salvar alterações:', error);
        showToast(error.message || 'Não foi possível salvar as alterações. Tente novamente.', 'error');
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
    const balanceDate = document.getElementById('accountBalanceDate').value;
    const parsedBalanceDate = balanceDate ? new Date(`${balanceDate}T00:00:00Z`) : null;
    let validationError = '';

    if (!name || name.length > 100) validationError = 'O nome deve ter de 1 a 100 caracteres.';
    else if (institution.length > 100) validationError = 'A instituição deve ter até 100 caracteres.';
    else if (!['PF', 'PJ'].includes(type)) validationError = 'O tipo deve ser PF ou PJ.';
    else if (balanceRaw === '' || !Number.isFinite(balance) || Math.abs(balance) > 9999999999.99) {
      validationError = 'O saldo inicial deve ser um valor numérico válido.';
    } else if (balanceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(balanceDate) ||
      !parsedBalanceDate || Number.isNaN(parsedBalanceDate.getTime()) ||
      parsedBalanceDate.toISOString().slice(0, 10) !== balanceDate ||
      parsedBalanceDate.getUTCFullYear() < 1)) {
      validationError = 'A data do saldo inicial deve ser válida.';
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
      const fields = {
        name,
        institution: institution || null,
        type,
        initialBalance: balance,
        balanceDate: balanceDate || null
      };
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
      if (returnToImportAfterAccountModal && !id) importAccountCreatedId = result.account.id;
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

  document.getElementById('creditCardForm').addEventListener('submit', async event => {
    event.preventDefault();
    const errorEl = document.getElementById('creditCardFormError');
    const id = document.getElementById('creditCardId').value;
    const name = document.getElementById('creditCardName').value.trim();
    const totalLimitRaw = document.getElementById('creditCardLimit').value;
    const totalLimit = Number(totalLimitRaw);
    const previousSpentRaw = document.getElementById('creditCardPreviousSpent').value.trim();
    const previousSpent = previousSpentRaw ? Number(previousSpentRaw) : 0;
    const closingDay = Number(document.getElementById('creditCardClosingDay').value);
    const dueDay = Number(document.getElementById('creditCardDueDay').value);
    const accountId = document.getElementById('creditCardAccount').value || null;
    const issuerBank = document.getElementById('creditCardIssuerBank').value;
    const brand = document.getElementById('creditCardBrand').value;
    const lastFour = document.getElementById('creditCardLastFour').value.trim();
    const customColor = document.getElementById('creditCardCustomColor').value;
    let validationError = '';
    if (!name || name.length > 100) validationError = 'O nome deve ter de 1 a 100 caracteres.';
    else if (!totalLimitRaw || !Number.isFinite(totalLimit) || totalLimit <= 0 ||
      totalLimit > 9999999999.99) validationError = 'Informe um limite total válido.';
    else if (!Number.isFinite(previousSpent) || previousSpent < 0 ||
      previousSpent > 9999999999.99) {
      validationError = 'Informe um valor válido e não negativo para o gasto anterior.';
    }
    else if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 ||
      !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      validationError = 'Os dias de fechamento e vencimento devem estar entre 1 e 31.';
    }
    else if (lastFour && !/^\d{4}$/.test(lastFour)) {
      validationError = 'O final do cartão deve conter quatro dígitos.';
    }
    if (validationError) {
      errorEl.textContent = validationError;
      errorEl.hidden = false;
      return;
    }

    const saveButton = document.getElementById('saveCreditCardBtn');
    saveButton.disabled = true;
    errorEl.hidden = true;
    const previousIds = new Set(FinanceData.getCreditCards().map(card => card.id));
    try {
      const fields = {
        name, totalLimit, closingDay, dueDay, accountId, issuerBank, brand,
        previousSpent,
        lastFour: lastFour || null,
        customColor: issuerBank === 'Outro' ? customColor : null
      };
      const result = id
        ? await FinanceData.updateCreditCard(id, fields)
        : await FinanceData.addCreditCard(fields);
      const savedCard = id
        ? FinanceData.getCreditCards().find(card => card.id === id)
        : FinanceData.getCreditCards().find(card => !previousIds.has(card.id));
      if (savedCard && !id) {
        document.getElementById('creditCardId').value = savedCard.id;
        document.getElementById('creditCardModalTitle').textContent = 'Editar cartão';
      }
      renderAll();
      if (!result.success) {
        errorEl.textContent = result.error && result.error.message ||
          result.error || 'Não foi possível salvar o cartão.';
        errorEl.hidden = false;
        return;
      }
      closeCreditCardModal();
      renderAll();
      showToast(id ? 'Cartão atualizado.' : 'Cartão cadastrado.');
    } catch (error) {
      console.error('[GastoPro] Falha ao salvar cartão:', error);
      errorEl.textContent = `Não foi possível salvar o cartão: ${error.message || error}`;
      errorEl.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  document.getElementById('adjustAccountForm').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = document.getElementById('adjustAccountError');
    const accountId = document.getElementById('adjustAccountId').value;
    if (!FinanceData.getAccounts().some(account => account.id === accountId)) {
      errorEl.textContent = 'Selecione uma conta para ajustar o saldo.';
      errorEl.hidden = false;
      return;
    }
    const rawBalance = document.getElementById('adjustAccountBalance').value;
    const balance = Number(rawBalance);
    const balanceDate = document.getElementById('adjustAccountBalanceDate').value;
    const parsedBalanceDate = new Date(`${balanceDate}T00:00:00Z`);
    if (rawBalance === '' || !Number.isFinite(balance) || Math.abs(balance) > 9999999999.99) {
      errorEl.textContent = 'Informe um saldo atual válido.';
      errorEl.hidden = false;
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceDate) || Number.isNaN(parsedBalanceDate.getTime()) ||
      parsedBalanceDate.toISOString().slice(0, 10) !== balanceDate ||
      parsedBalanceDate.getUTCFullYear() < 1) {
      errorEl.textContent = 'Informe a data do saldo real.';
      errorEl.hidden = false;
      return;
    }

    const saveButton = document.getElementById('saveAdjustAccountBtn');
    saveButton.disabled = true;
    errorEl.hidden = true;
    try {
      const result = await FinanceData.adjustAccountBalance(
        accountId,
        balance,
        balanceDate
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
      saveButton.disabled = FinanceData.getAccounts().length > 1 &&
        !FinanceData.getAccounts().some(account => account.id === document.getElementById('adjustAccountId').value);
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
      const paymentMethodSelect = document.getElementById('editPaymentMethod');
      if (paymentMethodSelect) {
        populatePaymentMethodSelect(paymentMethodSelect, val === 'income' ? 'income' : 'expense', true);
      }
      const statusGroup = document.getElementById('editStatusGroup');
      const endMonthGroup = document.getElementById('editEndMonthGroup');
      if (statusGroup) statusGroup.style.display = isFixed ? 'block' : 'none';
      if (endMonthGroup) endMonthGroup.style.display = isFixed ? 'block' : 'none';
      const dueDayGroup = document.getElementById('editDueDayGroup');
      const dueDayInput = document.getElementById('editDueDay');
      if (dueDayGroup) dueDayGroup.hidden = val === 'income';
      if (dueDayInput) {
        dueDayInput.required = val !== 'income' &&
          (isFixed || dueDayInput.dataset.dueRequired === 'true');
      }
    });
  }

  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);

  document.getElementById('closeAccountModalBtn').addEventListener('click', closeAccountModal);
  document.getElementById('cancelAccountModalBtn').addEventListener('click', closeAccountModal);
  document.getElementById('closeCreditCardModalBtn').addEventListener('click', closeCreditCardModal);
  document.getElementById('cancelCreditCardModalBtn').addEventListener('click', closeCreditCardModal);
  document.getElementById('closeAdjustAccountModalBtn').addEventListener('click', closeAdjustAccountModal);
  document.getElementById('cancelAdjustAccountBtn').addEventListener('click', closeAdjustAccountModal);
  document.getElementById('accountModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAccountModal();
  });
  document.getElementById('creditCardModal').addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCreditCardModal();
  });
  document.getElementById('adjustAccountModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAdjustAccountModal();
  });

  // ── 9. Exportação e Reset de Dados ───────────────────────────
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        const result = await FinanceData.exportAllUserData();
        if (!result.success) {
          showToast(result.error || 'Não foi possível exportar seus dados.', 'error');
          return;
        }
        showToast('Exportação JSON concluída com seus dados e mensagens de feedback.');
      } catch (error) {
        console.error('[GastoPro] Falha ao exportar todos os dados:', error);
        showToast('Não foi possível exportar seus dados. Tente novamente.', 'error');
      } finally {
        exportBtn.disabled = false;
      }
    });
  }

  const restoreBackupBtn = document.getElementById('restoreBackupBtn');
  const restoreBackupFile = document.getElementById('restoreBackupFile');
  if (restoreBackupBtn && restoreBackupFile) {
    restoreBackupBtn.addEventListener('click', () => restoreBackupFile.click());
    restoreBackupFile.addEventListener('change', async () => {
      const file = restoreBackupFile.files && restoreBackupFile.files[0];
      restoreBackupFile.value = '';
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('A cópia de segurança excede o limite de 5 MB.', 'error');
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
          showToast(preview.error, 'error');
          return;
        }

        const summary = `Cópia de segurança com ${preview.entries.length} lançamentos, ${preview.templates.length} gastos fixos e ${preview.goals.length} metas. Escolha como restaurar no app.`;
        const restore = (mode, button) => withSaving(button, async () => {
          try {
            const result = await FinanceData.importJSON(text, mode);
            if (!result.success) {
              showToast(result.error || 'Não foi possível restaurar a cópia de segurança.', 'error');
              return;
            }
            renderAll();
            renderUserProfile();
            showToast(mode === 'merge'
              ? 'Cópia de segurança mesclada com sucesso.'
              : 'Cópia de segurança restaurada; os dados anteriores foram substituídos.');
            document.getElementById('confirmModal').classList.remove('active');
          } catch (error) {
            console.error('[GastoPro] Falha ao restaurar cópia de segurança:', error);
            showToast(error.message || 'Não foi possível restaurar a cópia de segurança.', 'error');
          }
        });
        showConfirm({
          title: 'Prévia da cópia de segurança',
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
        console.error('[GastoPro] Falha ao ler cópia de segurança:', error);
        showToast('Não foi possível ler o arquivo de cópia de segurança.', 'error');
      }
    });
  }

  // Exige confirmação antes de apagar todos os dados (ação irreversível)
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    const profile = FinanceData.getProfile();
    const hasCloudAccount = Boolean(profile.userId && profile.email);
    showConfirm({
      title:    'Zerar dados financeiros?',
      message:  hasCloudAccount
        ? 'Lançamentos, fixos, contas, cartões, compras, metas e regras serão removidos deste aparelho e da nuvem. Perfil, mensagens e login serão preservados.'
        : 'Lançamentos, fixos, contas, cartões, compras, metas e regras serão removidos deste aparelho. Perfil e mensagens serão preservados.',
      iconClass:'fa-solid fa-trash-can',
      okLabel:  'Zerar dados financeiros',
      secondaryLabel: 'Cópia de segurança (para restaurar no app)',
      confirmationPhrase: 'ZERAR',
      onBackup: () => {
        FinanceData.exportJSON();
        showToast('Cópia de segurança exportada.');
      },
      onConfirm: button => withProtectedAction(button, async () => {
        const result = await FinanceData.clearAll();
        closeProfileDrawer();
        renderUserProfile();
        renderAll();
        if (!result.success) {
          showToast('Alguns dados não foram apagados na nuvem. As exclusões locais ficaram pendentes de sincronização. Tente novamente.', 'error');
          return;
        }
        showToast('Dados financeiros zerados.');
      })
    });
  });

  // ── 10. Drawer do Usuário (painel lateral direito) ────────────
  const profileDrawer        = document.getElementById('profileDrawer');
  const profileDrawerOverlay = document.getElementById('profileDrawerOverlay');
  const userMenuBtn          = document.getElementById('userMenuBtn');
  const closeDrawerBtn       = document.getElementById('closeDrawerBtn');
  const usageTelemetryToggle = document.getElementById('usageTelemetryEnabled');
  const adminVisibilityToggle = document.getElementById('adminVisibilityEnabled');
  const consentToggles = [adminVisibilityToggle, usageTelemetryToggle].filter(Boolean);

  consentToggles.forEach(toggle => {
    const field = toggle === adminVisibilityToggle ? 'adminVisibility' : 'telemetryEnabled';
    toggle.checked = window.GastoProConsent.getState()[field];
    toggle.addEventListener('change', async () => {
      const previous = !toggle.checked;
      consentToggles.forEach(input => { input.disabled = true; });
      try {
        const result = await window.GastoProConsent.set(field, toggle.checked);
        if (result && result.unavailable) {
          showToast('Preferência salva neste aparelho. A sincronização ficará pendente até atualizar o banco.');
        } else if (result && result.localOnly) {
          showToast('Preferência salva neste aparelho. Entre na conta para sincronizar.');
        } else if (result && !result.success) {
          showToast('Preferência salva neste aparelho, mas não sincronizada. Tente novamente.', 'error');
        } else {
          showToast('Preferência de privacidade atualizada.');
        }
      } catch (error) {
        console.error('[GastoPro] Não foi possível atualizar a preferência de privacidade:', error);
        toggle.checked = previous;
        showToast('Não foi possível salvar essa preferência neste aparelho.', 'error');
      } finally {
        consentToggles.forEach(input => { input.disabled = false; });
      }
    });
  });

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
  const avatarGallery         = document.getElementById('avatarGallery');
  const removeProfilePhotoBtn = document.getElementById('removeProfilePhotoBtn');
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

  function renderAvatarGallery(profile) {
    if (!avatarGallery) return;
    const savedPreset = getProfileAvatarPreset(profile.avatar) ||
      getProfileAvatarPreset(profile.avatarPreset);
    const selectedValue = savedPreset ? `preset:${savedPreset.id}` : 'preset:neutral-default';
    const fragment = document.createDocumentFragment();
    PROFILE_AVATAR_PRESETS.forEach(preset => {
      const value = `preset:${preset.id}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avatar-preset-option';
      button.dataset.avatarPreset = value;
      button.setAttribute('aria-label', `Escolher avatar ${preset.label}`);
      button.setAttribute('aria-pressed', String(value === selectedValue));
      button.title = preset.label;
      const image = document.createElement('img');
      image.src = window.GastoProAvatarGallery.getSource(value);
      image.alt = '';
      image.width = 32;
      image.height = 32;
      const label = document.createElement('span');
      label.textContent = preset.label;
      button.append(image, label);
      fragment.append(button);
    });
    avatarGallery.replaceChildren(fragment);
  }

  function renderUserProfile() {
    const profile = FinanceData.getProfile();
    const avatarSrc = window.GastoProAvatarGallery.getSource(profile.avatar);

    if (profileNameInput) {
      profileNameInput.value = profile.name || '';
    }

    const drawerAvatarImg = document.getElementById('drawerAvatarImg');
    const topbarAvatarImg = document.getElementById('topbarAvatarImg');

    const fallbackPreset = profile.avatarPreset || profile.avatar;
    if (drawerAvatarImg) {
      window.GastoProAvatarGallery.setImageSource(drawerAvatarImg, avatarSrc, fallbackPreset);
    }
    if (topbarAvatarImg) {
      window.GastoProAvatarGallery.setImageSource(topbarAvatarImg, avatarSrc, fallbackPreset);
    }
    renderAvatarGallery(profile);
    if (removeProfilePhotoBtn) {
      removeProfilePhotoBtn.hidden = !profile.avatar ||
        window.GastoProAvatarGallery.isPreset(profile.avatar);
    }
    if (userMenuBtn) {
      userMenuBtn.title = profile.name ? `Menu do Usuário (${profile.name})` : 'Menu do Usuário (Escreva seu nome)';
    }
    const consent = window.GastoProConsent.getState();
    if (adminVisibilityToggle) adminVisibilityToggle.checked = consent.adminVisibility;
    if (usageTelemetryToggle) usageTelemetryToggle.checked = consent.telemetryEnabled;
    updateConsentSyncStatus(consent);

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
  const googleSignInBtn      = document.getElementById('googleSignInBtn');
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
  const deleteAllMyDataBtn = document.getElementById('deleteAllMyDataBtn');
  const deleteAllMyDataModal = document.getElementById('deleteAllMyDataModal');
  const closeDeleteAllMyDataModalBtn = document.getElementById('closeDeleteAllMyDataModalBtn');
  const cancelDeleteAllMyDataBtn = document.getElementById('cancelDeleteAllMyDataBtn');
  const deleteAllMyDataConfirmation = document.getElementById('deleteAllMyDataConfirmation');
  const deleteAllMyDataError = document.getElementById('deleteAllMyDataError');
  const confirmDeleteAllMyDataBtn = document.getElementById('confirmDeleteAllMyDataBtn');
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

  if (hasGoogleOAuthError(window.location.search, window.location.hash)) {
    openAuth('login');
    showAuthAlert(GOOGLE_SIGN_IN_ERROR_MESSAGE);
  }

  if (googleSignInBtn) {
    const handleGoogleSignIn = createGoogleSignInHandler(
      googleSignInBtn,
      async () => {
        if (!window.SupabaseAuth || !window.SupabaseAuth.client) {
          throw new Error('Serviço de autenticação indisponível.');
        }
        await window.SupabaseAuth.signInWithGoogle();
      },
      showAuthAlert
    );
    googleSignInBtn.addEventListener('click', () => {
      const isRegistering = authRegisterForm &&
        authRegisterForm.style.display !== 'none';
      const privacyConsentAccepted =
        document.getElementById('registerConsent')?.checked === true;
      if (!canStartGoogleSignIn(isRegistering, privacyConsentAccepted)) {
        showAuthAlert('Para criar uma conta, leia e aceite a Política de Privacidade.');
        return;
      }
      handleGoogleSignIn();
    });
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
      showToast('Cópia de segurança exportada. Guarde-a antes de descartar as alterações.');
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
        const previousUserId = FinanceData.getActiveUserId();
        FinanceData.clearUserData();
        if (!FinanceData.activateUser(user.id)) {
          throw new Error('Não foi possível preparar os dados da nova conta.');
        }
        if (previousUserId && previousUserId !== user.id) window.switchToView('dashboard');
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
  const deferredRealtimeChanges = new Map();
  const AUTOMATIC_SYNC_INTERVAL_MS = 15000;
  const automaticSyncGate = window.GastoProSyncHelpers.createAutomaticSyncGate(
    AUTOMATIC_SYNC_INTERVAL_MS
  );
  let fullSyncDeferredForEditor = false;
  let realtimeModalObserver = null;

  function getRealtimeRecordKey(change, userId) {
    if (change.kind === 'goals') return change.item && change.item.category;
    if (change.kind === 'profiles' || change.kind === 'fixedImportRules') return userId;
    return change.item && change.item.id;
  }

  function getCurrentRealtimeRecord(change, userId) {
    const getters = {
      entries: () => FinanceData.getEntries(),
      templates: () => FinanceData.getActiveTemplates(),
      accounts: () => FinanceData.getAccounts(),
      creditCards: () => FinanceData.getCreditCards(),
      creditCardPurchases: () => FinanceData.getCreditCardPurchases(),
      goals: () => FinanceData.getGoals()
    };
    if (change.kind === 'profiles') {
      const profile = FinanceData.getProfile();
      return { id: userId, name: profile.name || '', avatar: profile.avatar || null };
    }
    if (change.kind === 'fixedImportRules') return FinanceData.getFixedImportRules();
    const items = getters[change.kind]();
    const key = change.kind === 'goals' ? change.item.category : change.item.id;
    const getKey = change.kind === 'goals' ? item => item.category : item => item.id;
    return items.find(item => getKey(item) === key) || null;
  }

  function isRealtimeRecordBeingEdited(change, key) {
    return window.GastoProSyncHelpers.isRecordBeingEdited(change.kind, key);
  }

  function hasOpenSyncEditor() {
    return ['editModal', 'accountModal', 'creditCardModal', 'goalModal'].some(id => {
      const modal = document.getElementById(id);
      return modal && modal.classList.contains('active');
    });
  }

  function applyRealtimeChange(change, userId, render = renderAll) {
    const key = getRealtimeRecordKey(change, userId);
    if (!key) return;
    if (FinanceData.isOwnCloudSyncChange(
      change.kind, key, change.version, change.clientEditedAt, change.deletedAt
    )) return;
    const version = change.version || change.deletedAt;
    if (FinanceData.isCloudSyncRecordStale(change.kind, key, version)) return;
    const current = getCurrentRealtimeRecord(change, userId);
    const incoming = change.kind === 'fixedImportRules'
      ? change.deletedAt ? [] : change.item.rules
      : change.item;
    if (!window.GastoProSyncHelpers.isRemoteRecordDifferent(current, incoming, change.deletedAt)) return;
    const deferredKey = `${change.kind}:${key}`;
    window.GastoProSyncHelpers.deferOrApply(
      { change, userId },
      deferredKey,
      isRealtimeRecordBeingEdited(change, key),
      pending => {
        const result = FinanceData.applyCloudSyncRecord(
          pending.change.kind, pending.change.item, pending.change.version,
          pending.change.deletedAt, pending.userId
        );
        if (result && result.applied) render();
      },
      deferredRealtimeChanges,
      () => showToast('Um item foi atualizado em outro aparelho')
    );
  }

  function flushDeferredRealtimeChanges(render = renderAll) {
    deferredRealtimeChanges.forEach(({ change, userId }, key) => {
      const recordKey = getRealtimeRecordKey(change, userId);
      if (isRealtimeRecordBeingEdited(change, recordKey)) return;
      deferredRealtimeChanges.delete(key);
      applyRealtimeChange(change, userId, render);
    });
    if (fullSyncDeferredForEditor && !hasOpenSyncEditor()) {
      fullSyncDeferredForEditor = false;
      requestAutomaticSync('deferred-editor-close').catch(error => {
        console.error('[GastoPro] Falha ao sincronizar após fechar o editor:', error);
      });
    }
  }

  function observeRealtimeEditModals() {
    if (realtimeModalObserver || typeof MutationObserver !== 'function' || !document.body) return;
    realtimeModalObserver = new MutationObserver(flushDeferredRealtimeChanges);
    realtimeModalObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true
    });
  }

  function subscribeToUserRealtime(userId) {
    observeRealtimeEditModals();
    if (!window.SupabaseAuth || typeof window.SupabaseAuth.subscribeToSyncChanges !== 'function') return;
    try {
      window.SupabaseAuth.subscribeToSyncChanges(userId, change => {
        if (localStorage.getItem('gastopro_last_uid') !== userId) return;
        window.GastoProDiagnostics.record('sync', { phase: 'start', source: 'realtime' });
        let result = 'success';
        try {
          applyRealtimeChange(change, userId);
        } catch (error) {
          result = 'failure';
          throw error;
        } finally {
          window.GastoProDiagnostics.record('sync', {
            phase: 'end',
            source: 'realtime',
            result
          });
        }
      }, status => {
        console.warn('[GastoPro] Realtime indisponível; a sincronização será retomada ao voltar ao app.', status);
        window.SupabaseAuth.unsubscribeFromSyncChanges();
      });
    } catch (error) {
      console.warn('[GastoPro] Realtime indisponível; a sincronização será retomada ao voltar ao app.', error);
      window.SupabaseAuth.unsubscribeFromSyncChanges();
    }
  }

  async function requestAutomaticSync(reason, syncAction = syncUserDataFromCloud, now = Date.now()) {
    if (document.visibilityState === 'hidden' && reason !== 'online') return false;
    let sessionUser;
    try {
      sessionUser = window.SupabaseAuth && await window.SupabaseAuth.getSessionUser();
    } catch (error) {
      recordSyncFailureDiagnostic('excecao', error);
      throw error;
    }
    if (!sessionUser || !sessionUser.id) return false;
    if (reason === 'online') subscribeToUserRealtime(sessionUser.id);
    if (hasOpenSyncEditor()) {
      fullSyncDeferredForEditor = true;
      return false;
    }
    try {
      if (activeSyncs.has(sessionUser.id)) return await activeSyncs.get(sessionUser.id);
      return await automaticSyncGate.run(now, () => syncAction === syncUserDataFromCloud
        ? syncAction(sessionUser.id, 'automatic')
        : syncAction(sessionUser.id));
    } catch (error) {
      recordSyncFailureDiagnostic('excecao', error);
      throw error;
    }
  }

  window.GastoProSyncLifecycle = {
    requestAutomaticSync,
    applyRealtimeChange,
    flushDeferredRealtimeChanges,
    subscribeToUserRealtime,
    resetAutomaticSyncForTests() {
      automaticSyncGate.reset();
      fullSyncDeferredForEditor = false;
    }
  };

  window.GastoProSyncHelpers.bindLifecycleListeners(document, window, reason => {
    requestAutomaticSync(reason).catch(error => {
      console.error('[GastoPro] Falha ao sincronizar ao retornar ao app:', error);
    });
  });

  async function syncUserDataFromCloud(userId, source = 'manual') {
    if (!window.SupabaseAuth || !userId) return;
    if (activeSyncs.has(userId)) return activeSyncs.get(userId);

    window.GastoProDiagnostics.record('sync', { phase: 'start', source });
    const syncPromise = (async () => {
      try {
        const sessionUser = await window.SupabaseAuth.getSessionUser();
        if (!sessionUser || sessionUser.id !== userId) {
          recordSyncFailureDiagnostic('sessao');
          return false;
        }

        try {
          await syncConsentForUser(sessionUser);
          renderUserProfile();
        } catch (error) {
          console.warn('[GastoPro] Não foi possível sincronizar preferências de privacidade:', error);
        }

        const localSync = await FinanceData.prepareLocalDataForSync(userId);
        if (!localSync.success) {
          recordSyncFailureDiagnostic('preparacao_local', localSync.error);
          return false;
        }

        const [cloudEntries, cloudTemplates, cloudGoals, cloudAccounts, cloudFixedImportRules, cloudCreditCards, cloudCreditCardPurchases, cloudProfileResult] = await Promise.all([
          window.SupabaseAuth.fetchCloudEntries(userId),
          window.SupabaseAuth.fetchCloudTemplates(userId),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudGoals(userId))
            .catch(error => {
              recordSyncFailureDiagnostic('excecao', error);
              console.warn('[GastoPro] Não foi possível buscar metas na nuvem:', error);
              return null;
            }),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudAccounts(userId))
            .catch(error => {
              recordSyncFailureDiagnostic('excecao', error);
              console.warn('[GastoPro] Não foi possível buscar contas na nuvem:', error);
              return null;
            }),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudFixedImportRules
              ? window.SupabaseAuth.fetchCloudFixedImportRules(userId)
              : null)
            .catch(error => {
              recordSyncFailureDiagnostic('excecao', error);
              console.warn('[GastoPro] Não foi possível buscar regras de importação na nuvem:', error);
              return null;
            }),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudCreditCards
              ? window.SupabaseAuth.fetchCloudCreditCards(userId)
              : null)
            .catch(error => {
              recordSyncFailureDiagnostic('excecao', error);
              console.warn('[GastoPro] Não foi possível buscar cartões na nuvem:', error);
              return null;
            }),
          Promise.resolve()
            .then(() => window.SupabaseAuth.fetchCloudCreditCardPurchases
              ? window.SupabaseAuth.fetchCloudCreditCardPurchases(userId)
              : null)
            .catch(error => {
              recordSyncFailureDiagnostic('excecao', error);
              console.warn('[GastoPro] Não foi possível buscar compras no cartão na nuvem:', error);
              return null;
            }),
          window.SupabaseAuth.fetchCloudProfile
            ? window.SupabaseAuth.fetchCloudProfile(userId)
            : { success: false, error: new Error('Busca de perfil não disponível.') }
        ]);

        if (!Array.isArray(cloudEntries) || !Array.isArray(cloudTemplates) ||
          !Array.isArray(cloudAccounts)) {
          recordSyncFailureDiagnostic('resposta_incompleta');
          console.warn('[GastoPro] Sincronização incompleta; os dados locais foram mantidos.');
          showToast('Não foi possível sincronizar; seus dados continuam salvos neste aparelho', 'error');
          return false;
        }

        if (cloudProfileResult.success) {
          if (cloudProfileResult.profile) {
            FinanceData.mergeCloudProfile(cloudProfileResult.profile);
          }
        } else {
          console.warn('[GastoPro] Não foi possível buscar o perfil na nuvem:', cloudProfileResult.error);
          showToast('O perfil local foi preservado; não foi possível buscar o perfil na nuvem.', 'error');
        }

        if (!FinanceData.mergeCloudData(
          userId, cloudEntries, cloudTemplates, localSync.success, cloudGoals, cloudAccounts,
          cloudFixedImportRules, cloudCreditCards, cloudCreditCardPurchases
        )) {
          recordSyncFailureDiagnostic('merge');
          console.warn('[GastoPro] Sincronização ignorada: o usuário local não corresponde à sessão.');
          showToast('Não foi possível sincronizar; seus dados continuam salvos neste aparelho', 'error');
          return false;
        }

        renderAll();
        subscribeToUserRealtime(userId);
        return true;
      } catch (e) {
        recordSyncFailureDiagnostic('excecao', e);
        console.warn('[GastoPro] Aviso de sincronização na nuvem:', e);
        return false;
      }
    })();

    activeSyncs.set(userId, syncPromise);
    let syncSucceeded = false;
    try {
      const result = await syncPromise;
      syncSucceeded = result === true;
      return result;
    } finally {
      activeSyncs.delete(userId);
      window.GastoProDiagnostics.record('sync', {
        phase: 'end',
        source,
        result: syncSucceeded ? 'success' : 'failure'
      });
    }
  }

  function clearUserSessionData() {
    if (window.SupabaseAuth && typeof window.SupabaseAuth.unsubscribeFromSyncChanges === 'function') {
      window.SupabaseAuth.unsubscribeFromSyncChanges();
    }
    deferredRealtimeChanges.clear();
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
    const previousUserId = FinanceData.getActiveUserId();
    const switchAction = window.GastoProSessionHelpers.getAccountSwitchAction(
      previousUserId,
      user.id,
      FinanceData.hasPendingSync()
    );
    if (switchAction === 'confirm-discard') {
      requestDiscardForAccountSwitch(user);
      return null;
    }
    const switchedUser = FinanceData.activateUser(user.id);
    setPaymentMethodSelection('income', getPaymentMethodPreference('income'), false);
    setPaymentMethodSelection('expense', getPaymentMethodPreference('expense'), false);
    if (switchedUser && previousUserId && previousUserId !== user.id) {
      window.switchToView('dashboard');
    }
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
      if (cloudProfileResult.success) {
        const avatar = window.GastoProAvatarGallery.applyGoogleAvatar(profile, user);
        profile.avatar = avatar.avatar;
        profile.avatarPreset = avatar.avatarPreset;
      }
      profile.name = window.GastoProProfileHelpers.getInitialName(
        profile.name,
        cloudName,
        window.GastoProProfileHelpers.getGoogleMetadataName(user),
        user.email.split('@')[0]
      );
    }
    const queueInitialProfile = cloudProfileResult.success && !profilePending &&
      (!cloudProfileResult.profile ||
        (!cloudProfileResult.profile.name && profile.name) ||
        (!cloudProfileResult.profile.avatar && profile.avatar)) &&
      Boolean(profile.name || profile.avatar);
    FinanceData.saveProfile(profile, { queueSync: queueInitialProfile });
    renderUserProfile();
    return profile;
  }

  if (window.SupabaseAuth) {
    window.SupabaseAuth.onAuthStateChange((event, user) => {
      const previousUserId = FinanceData.getActiveUserId();
      const recordAuthState = activatedUser => {
        window.GastoProDiagnostics.record('auth-state', {
          event,
          previousUidPresent: Boolean(previousUserId),
          uidEqualsPrevious: !previousUserId
            ? 'without-previous'
            : user && previousUserId === user.id ? 'yes' : 'no',
          activation: activatedUser
        });
      };
      if (event === 'PASSWORD_RECOVERY') {
        recordAuthState(false);
        openPasswordRecovery();
        return;
      }
      if (event === 'SIGNED_OUT' || (!user && event === 'TOKEN_REFRESHED')) {
        recordAuthState(false);
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
      if (!user) {
        recordAuthState(false);
        return;
      }

      if (feedbackViewState.userId && feedbackViewState.userId !== user.id) {
        feedbackViewState.requestId++;
        feedbackViewState.loading = false;
        feedbackViewState.messages = [];
      }
      feedbackViewState.userId = user.id;
      const switchedUser = FinanceData.activateUser(user.id);
      recordAuthState(switchedUser);
      if (switchedUser) {
        resetAdminSession();
      }
      if (window.GastoProSessionHelpers.shouldNavigateToDashboard(
        event,
        previousUserId,
        user.id,
        switchedUser
      )) {
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
        const adminVisibilityConsent = document.getElementById('registerAdminVisibility')?.checked === true;
        let consentStored = !adminVisibilityConsent;
        if (adminVisibilityConsent) {
          try {
            storePendingConsent(email, window.GastoProConsent.createSignupState(true));
            consentStored = true;
          } catch (error) {
            console.error('[GastoPro] Não foi possível salvar o consentimento do cadastro neste aparelho:', error);
          }
        }
        const profile = FinanceData.getProfile();
        profile.name = name;
        profile.email = email;
        FinanceData.saveProfile(profile);
        renderUserProfile();

        if (data && data.session) {
          closeAuth();
          const user = data.session.user;
          const authenticatedProfile = await prepareAuthenticatedUser(user);
          if (authenticatedProfile) await syncUserDataFromCloud(authenticatedProfile.userId);
          showToast(consentStored
            ? `Conta criada com sucesso! Bem-vindo, ${name}!`
            : 'Conta criada. A autorização opcional não foi registrada e permanece desligada.');
        } else {
          showAuthAlert(consentStored
            ? 'Conta criada! A confirmação por e-mail pode demorar alguns minutos. Confira sua caixa de entrada e a pasta de spam.'
            : 'Conta criada. A autorização opcional não foi registrada e permanece desligada. A confirmação por e-mail pode demorar alguns minutos.',
          true);
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
          message: formatLogoutSyncFailure(syncResult),
          iconClass: 'fa-solid fa-cloud-arrow-up',
          okLabel: 'Cópia de segurança (para restaurar no app)',
          okBtnClass: 'btn-primary',
          onConfirm: () => {
            FinanceData.exportJSON();
            showToast('Cópia de segurança exportada. Seus dados continuam salvos neste aparelho.');
          }
        });
        return;
      }

      try {
        await window.SupabaseAuth.signOut();
      } catch (e) {
        console.warn('[GastoPro] Falha ao encerrar sessão:', e);
        showToast('Não foi possível encerrar a sessão. Seus dados continuam salvos neste aparelho.', 'error');
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
      confirmDeleteAccountBtn.textContent = 'Excluir conta definitivamente';
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

  let deleteAllMyDataFocusTimeout = null;

  function closeDeleteAllMyDataModal() {
    if (!deleteAllMyDataModal) return;
    if (deleteAllMyDataFocusTimeout !== null) {
      clearTimeout(deleteAllMyDataFocusTimeout);
      deleteAllMyDataFocusTimeout = null;
    }
    deleteAllMyDataModal.classList.remove('active');
    deleteAllMyDataModal.setAttribute('aria-hidden', 'true');
  }

  function showDeleteAllMyDataError(message) {
    if (!deleteAllMyDataError) return;
    deleteAllMyDataError.textContent = message;
    deleteAllMyDataError.hidden = false;
  }

  function openDeleteAllMyDataModal() {
    if (!deleteAllMyDataModal) return;
    if (deleteAllMyDataBtn) deleteAllMyDataBtn.focus();
    deleteAllMyDataConfirmation.value = '';
    deleteAllMyDataConfirmation.disabled = false;
    deleteAllMyDataError.textContent = '';
    deleteAllMyDataError.hidden = true;
    confirmDeleteAllMyDataBtn.disabled = true;
    confirmDeleteAllMyDataBtn.textContent = 'Apagar meus dados';
    closeDeleteAllMyDataModalBtn.disabled = false;
    cancelDeleteAllMyDataBtn.disabled = false;
    deleteAllMyDataModal.classList.add('active');
    deleteAllMyDataModal.setAttribute('aria-hidden', 'false');
    deleteAllMyDataFocusTimeout = setTimeout(() => {
      deleteAllMyDataFocusTimeout = null;
      if (deleteAllMyDataModal.classList.contains('active')) {
        deleteAllMyDataConfirmation.focus();
      }
    }, 300);
  }

  if (deleteAllMyDataBtn) {
    deleteAllMyDataBtn.addEventListener('click', openDeleteAllMyDataModal);
  }
  if (closeDeleteAllMyDataModalBtn) {
    closeDeleteAllMyDataModalBtn.addEventListener('click', closeDeleteAllMyDataModal);
  }
  if (cancelDeleteAllMyDataBtn) {
    cancelDeleteAllMyDataBtn.addEventListener('click', closeDeleteAllMyDataModal);
  }
  if (deleteAllMyDataModal) {
    deleteAllMyDataModal.addEventListener('click', event => {
      if (event.target === deleteAllMyDataModal) closeDeleteAllMyDataModal();
    });
  }
  if (deleteAllMyDataConfirmation && confirmDeleteAllMyDataBtn) {
    window.GastoProDeletionConfirmation.bind(
      deleteAllMyDataConfirmation,
      confirmDeleteAllMyDataBtn,
      'APAGAR DADOS',
      () => {
      deleteAllMyDataError.textContent = '';
      deleteAllMyDataError.hidden = true;
      }
    );

    confirmDeleteAllMyDataBtn.addEventListener('click', async () => {
      if (!window.GastoProUserData.isDeletionConfirmationValid(
        deleteAllMyDataConfirmation.value
      )) return;
      confirmDeleteAllMyDataBtn.disabled = true;
      confirmDeleteAllMyDataBtn.textContent = 'Excluindo...';
      deleteAllMyDataConfirmation.disabled = true;
      closeDeleteAllMyDataModalBtn.disabled = true;
      cancelDeleteAllMyDataBtn.disabled = true;
      try {
        const result = await FinanceData.deleteAllUserData(deleteAllMyDataConfirmation.value);
        if (!result.success) {
          showDeleteAllMyDataError(result.error && result.error.message || result.error ||
            'Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.');
          deleteAllMyDataConfirmation.disabled = false;
          closeDeleteAllMyDataModalBtn.disabled = false;
          cancelDeleteAllMyDataBtn.disabled = false;
          confirmDeleteAllMyDataBtn.disabled = !window.GastoProUserData.isDeletionConfirmationValid(deleteAllMyDataConfirmation.value);
          confirmDeleteAllMyDataBtn.textContent = 'Apagar meus dados';
          return;
        }
      } catch (error) {
        console.error('[GastoPro] Falha ao excluir todos os dados:', error);
        showDeleteAllMyDataError('Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.');
        deleteAllMyDataConfirmation.disabled = false;
        closeDeleteAllMyDataModalBtn.disabled = false;
        cancelDeleteAllMyDataBtn.disabled = false;
        confirmDeleteAllMyDataBtn.disabled = !window.GastoProUserData.isDeletionConfirmationValid(deleteAllMyDataConfirmation.value);
        confirmDeleteAllMyDataBtn.textContent = 'Apagar meus dados';
        return;
      }

      feedbackViewState.messages = [];
      feedbackViewState.notice = '';
      closeDeleteAllMyDataModal();
      closeProfileDrawer();
      renderUserProfile();
      renderAll();
      showToast('Todos os dados foram excluídos. Seu login foi mantido.');
    });
  }

  if (deleteAccountConfirmation && confirmDeleteAccountBtn) {
    window.GastoProDeletionConfirmation.bind(
      deleteAccountConfirmation,
      confirmDeleteAccountBtn,
      'EXCLUIR CONTA',
      () => {
      if (deleteAccountError) {
        deleteAccountError.textContent = '';
        deleteAccountError.hidden = true;
      }
      }
    );

    confirmDeleteAccountBtn.addEventListener('click', () =>
      withProtectedAction(confirmDeleteAccountBtn, async () => {
        if (!window.GastoProAccountDeletion.isConfirmationValid(deleteAccountConfirmation.value)) return;

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
                : 'Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.'
            );
            if (deleteAccountConfirmation) deleteAccountConfirmation.disabled = false;
            if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = false;
            if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = false;
            confirmDeleteAccountBtn.disabled = !window.GastoProAccountDeletion.isConfirmationValid(deleteAccountConfirmation.value);
            confirmDeleteAccountBtn.textContent = 'Excluir conta definitivamente';
            return;
          }
        } catch (error) {
          console.error('[GastoPro] Falha ao concluir a exclusão da conta:', error);
          showDeleteAccountError('Alguns dados não foram apagados na nuvem. Seus dados locais foram mantidos. Tente novamente.');
          if (deleteAccountConfirmation) deleteAccountConfirmation.disabled = false;
          if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.disabled = false;
          if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.disabled = false;
          confirmDeleteAccountBtn.disabled = !window.GastoProAccountDeletion.isConfirmationValid(deleteAccountConfirmation.value);
          confirmDeleteAccountBtn.textContent = 'Excluir conta definitivamente';
          return;
        }

        closeDeleteAccountModal();
        closeProfileDrawer();
        renderUserProfile();
        renderAll();
        showToast('Conta e dados excluídos. O GastoPro está pronto para começar novamente.');
      })
    );
  }

  if (downloadBackupBeforeAccountDeletion) {
    downloadBackupBeforeAccountDeletion.addEventListener('click', () => {
      FinanceData.exportJSON();
      showToast('Cópia de segurança exportada. Guarde-a antes de excluir a conta.');
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
    changeAvatarBtn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        avatarFileInput.click();
      }
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
        showToast(error.message || 'Não foi possível abrir a imagem.', 'error');
      }
    }

    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      avatarFileInput.value = '';
      if (!file) return;

      if (!isSupportedAvatarType(file.type)) {
        showToast('Selecione uma imagem JPEG, PNG ou WebP.', 'error');
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
        const profile = window.GastoProAvatarGallery.savePhoto(FinanceData.getProfile(), avatar);
        const result = FinanceData.saveProfile(profile, { queueSync: true });
        if (!result.success) {
          if (result.error && result.error.name === 'QuotaExceededError') {
            showToast('O armazenamento do navegador está cheio. Remova alguns dados e tente novamente.', 'error');
          } else {
            showToast('Não foi possível salvar a foto neste aparelho.', 'error');
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

  if (avatarGallery) {
    avatarGallery.addEventListener('click', event => {
      const option = event.target.closest('[data-avatar-preset]');
      if (!option || !avatarGallery.contains(option)) return;
      const value = option.dataset.avatarPreset;
      if (!getProfileAvatarPreset(value)) return;
      const profile = window.GastoProAvatarGallery.selectPreset(FinanceData.getProfile(), value);
      const result = FinanceData.saveProfile(profile, { queueSync: true });
      if (!result.success) {
        showToast('Não foi possível salvar o avatar neste aparelho.', 'error');
        return;
      }
      renderUserProfile();
      showToast('Avatar atualizado.');
      syncEditedProfile(profile);
    });
  }

  if (removeProfilePhotoBtn) {
    removeProfilePhotoBtn.addEventListener('click', () => {
      const profile = window.GastoProAvatarGallery.removePhoto(FinanceData.getProfile());
      const result = FinanceData.saveProfile(profile, { queueSync: true });
      if (!result.success) {
        showToast('Não foi possível remover a foto neste aparelho.', 'error');
        return;
      }
      renderUserProfile();
      showToast('Foto removida. Avatar restaurado.');
      syncEditedProfile(profile);
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
  const drawerRefreshBtn   = document.getElementById('drawerRefreshBtn');
  const refreshIcon        = document.getElementById('refreshIcon');
  const drawerRefreshIcon  = document.getElementById('drawerRefreshIcon');

  let isRefreshing = false;
  let isCheckingAppVersion = false;
  const updateReloadScheduler = window.GastoProUpdateReloadHelpers.createScheduler({
    isBusy: () => hasOpenSyncEditor() || activeSyncs.size > 0,
    reload: () => window.location.reload(),
    notify: () => showToast('A atualização será aplicada ao terminar a edição ou a sincronização.')
  });

  async function handleAppRefresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    window.GastoProDiagnostics.record('refresh', { phase: 'start' });
    let refreshResult = 'success';
    const viewSnapshot = captureAppViewState();

    // Ativa animação de rotação contínua nos ícones
    const icons = [refreshIcon].filter(Boolean);
    icons.forEach(icon => icon.classList.add('spinning'));

    const btns = [refreshAppBtn].filter(Boolean);
    btns.forEach(btn => btn.classList.add('refreshing'));

    const startTime = Date.now();

    try {
      let isCloud = false;
      let hasCloudSession = false;
      if (window.SupabaseAuth) {
        const user = await window.SupabaseAuth.getSessionUser();
        if (user && user.id) {
          hasCloudSession = true;
          isCloud = await syncUserDataFromCloud(user.id, 'manual');
        }
      }

      // Re-renderiza views e perfil
      renderUserProfile();
      restoreAppViewState(viewSnapshot);

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
      if (hasCloudSession && !isCloud) trackUsageEvent('sync_error');
      showToast(refreshMessage, hasCloudSession && !isCloud ? 'error' : 'success');

      // Se a sidebar ou o drawer estiverem abertos, fecha-os
      closeMobileSidebar();
      closeProfileDrawer();
    } catch (err) {
      refreshResult = 'failure';
      console.warn('[GastoPro] Erro durante o refresh:', err);
      recordSyncFailureDiagnostic('excecao', err);
      trackUsageEvent('sync_error');
      restoreAppViewState(viewSnapshot);
      showToast('Dados locais atualizados.');
    } finally {
      icons.forEach(icon => icon.classList.remove('spinning'));
      btns.forEach(btn => btn.classList.remove('refreshing'));
      isRefreshing = false;
      window.GastoProDiagnostics.record('refresh', {
        phase: 'end',
        result: refreshResult
      });
    }
  }

  async function handleAppVersionCheck() {
    if (isCheckingAppVersion) return;
    isCheckingAppVersion = true;

    const icon = drawerRefreshIcon;
    if (icon) icon.classList.add('spinning');
    if (drawerRefreshBtn) {
      drawerRefreshBtn.classList.add('refreshing');
      drawerRefreshBtn.disabled = true;
    }

    let serviceWorker;
    let registration;
    let onUpdateFound;
    let onControllerChange;
    let controllerChangeTimeout;

    try {
      if (!('serviceWorker' in navigator)) {
        showToast('Não foi possível buscar uma versão nova neste navegador.', 'error');
        return;
      }

      serviceWorker = navigator.serviceWorker;
      registration = await serviceWorker.getRegistration();
      if (!registration || typeof registration.update !== 'function') {
        showToast('Não foi possível verificar atualizações do app.', 'error');
        return;
      }

      let updateFound = false;
      let controllerChanged = false;
      let resolveControllerChange;
      const controllerChange = new Promise(resolve => {
        resolveControllerChange = resolve;
      });

      onUpdateFound = () => {
        updateFound = true;
      };
      onControllerChange = () => {
        controllerChanged = true;
        saveAppReloadState();
        resolveControllerChange();
      };
      registration.addEventListener('updatefound', onUpdateFound);
      serviceWorker.addEventListener('controllerchange', onControllerChange);

      await registration.update();
      updateFound = updateFound || Boolean(registration.installing || registration.waiting);
      if (!updateFound) {
        showToast('O app já está atualizado.');
        return;
      }

      if (!controllerChanged) {
        controllerChanged = await Promise.race([
          controllerChange.then(() => true),
          new Promise(resolve => {
            controllerChangeTimeout = setTimeout(() => resolve(false), 30000);
          })
        ]);
      }

      if (controllerChanged) {
        updateReloadScheduler.request();
      } else {
        showToast('Nova versão encontrada. Tente novamente em instantes.', 'error');
      }
    } catch (error) {
      console.warn('[GastoPro] Erro ao buscar nova versão do app:', error);
      showToast('Não foi possível verificar atualizações do app.', 'error');
    } finally {
      if (controllerChangeTimeout) clearTimeout(controllerChangeTimeout);
      if (registration && onUpdateFound) {
        registration.removeEventListener('updatefound', onUpdateFound);
      }
      if (serviceWorker && onControllerChange) {
        serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
      if (icon) icon.classList.remove('spinning');
      if (drawerRefreshBtn) {
        drawerRefreshBtn.classList.remove('refreshing');
        drawerRefreshBtn.disabled = false;
      }
      isCheckingAppVersion = false;
    }
  }

  if (refreshAppBtn) refreshAppBtn.addEventListener('click', handleAppRefresh);
  if (drawerRefreshBtn) drawerRefreshBtn.addEventListener('click', handleAppVersionCheck);
  const appUpdateCheckBtn = document.getElementById('appUpdateCheckBtn');
  if (appUpdateCheckBtn) appUpdateCheckBtn.addEventListener('click', handleAppVersionCheck);

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
  const downloadCsvTemplateBtn = document.getElementById('downloadCsvTemplateBtn');
  const parseTextBtn        = document.getElementById('parseTextBtn');
  const importRawTextarea   = document.getElementById('importRawTextarea');
  const importTargetAccount = document.getElementById('importTargetAccount');
  const createImportAccountBtn = document.getElementById('createImportAccountBtn');
  const importTargetAccountError = document.getElementById('importTargetAccountError');
  const importPreviewSection= document.getElementById('importPreviewSection');
  const importPreviewTbody  = document.getElementById('importPreviewTableBody');
  const previewCountBadge   = document.getElementById('previewCountBadge');
  const importSelectAll     = document.getElementById('importSelectAll');
  const importDuplicateSelectionNote = document.getElementById('importDuplicateSelectionNote');
  const confirmImportBtn    = document.getElementById('confirmImportBtn');
  const importFixedDecisionSection = document.getElementById('importFixedDecisionSection');
  const importFixedCandidateList = document.getElementById('importFixedCandidateList');
  const importFixedSearchForm = document.getElementById('importFixedSearchForm');
  const importFixedSearchInput = document.getElementById('importFixedSearchInput');
  const importFixedSearchStatus = document.getElementById('importFixedSearchStatus');
  const continueImportDecisionBtn = document.getElementById('continueImportDecisionBtn');
  const importFinalConfirmSection = document.getElementById('importFinalConfirmSection');
  const backToImportPreviewBtn = document.getElementById('backToImportPreviewBtn');
  const backToImportDecisionBtn = document.getElementById('backToImportDecisionBtn');
  const finalConfirmImportBtn = document.getElementById('finalConfirmImportBtn');
  const importStageStatus = document.getElementById('importStageStatus');
  const importWorkflowContent = document.getElementById('importWorkflowContent');
  const importCompletionSection = document.getElementById('importCompletionSection');
  const closeImportCompletionBtn = document.getElementById('closeImportCompletionBtn');
  let importSaving = false;
  let importDecisionCandidates = [];
  let importCandidateDecisions = new Map();
  let _importIgnoredRows = [];

  function setImportStage(stage) {
    const stages = {
      choose: 'Etapa 1 de 4 — Escolher arquivo ou texto',
      preview: 'Etapa 2 de 4 — Conferir prévia',
      decisions: 'Etapa 3 de 4 — Revisar gastos fixos',
      confirm: 'Etapa 4 de 4 — Confirmar importação',
      complete: 'Etapa 4 de 4 — Importação concluída'
    };
    if (importStageStatus) importStageStatus.textContent = stages[stage] || stages.choose;
  }

  function showImportDecisionStep(step) {
    if (importPreviewSection) importPreviewSection.classList.toggle('visible', step === 'preview');
    if (importFixedDecisionSection) importFixedDecisionSection.hidden = step !== 'decisions';
    if (importFinalConfirmSection) importFinalConfirmSection.hidden = step !== 'confirm';
    setImportStage(step);
  }

  function getImportNotImportedItems(importedIndexes) {
    const items = _importIgnoredRows.map(row => ({ ...row }));
    const existingEntries = FinanceData.getEntries();
    _importParsedRows.forEach((row, index) => {
      if (importedIndexes && importedIndexes.has(index)) return;
      let reason = '';
      if (row.invalid) {
        reason = row.invalidReason || 'Dados inválidos.';
      } else if (row.dueDayMissing) {
        reason = 'Dia de vencimento ausente ou inválido.';
      } else if (row.importSkipReason) {
        reason = row.importSkipReason;
      } else if (row.typeSignMismatch) {
        reason = 'Revisar tipo e sinal.';
      } else if (row.reviewOwnAccountMovement) {
        reason = 'Parece movimentação entre suas contas ou investimento.';
      } else if (row.duplicate && !row.selected) {
        const rowDate = row.date ? Date.parse(`${row.date}T00:00:00Z`) : NaN;
        const matchingEntry = existingEntries.find(entry => {
          if (!row.accountId || entry.accountId !== row.accountId ||
              Math.round(Number(entry.amount) * 100) !== Math.round(Number(row.amount) * 100) ||
              (entry.type === 'income') !== (getImportPreviewType(row) === 'income') ||
              !entry.date || !Number.isFinite(rowDate)) return false;
          const entryDate = Date.parse(`${entry.date}T00:00:00Z`);
          return Number.isFinite(entryDate) &&
            Math.abs(entryDate - rowDate) <= 2 * 24 * 60 * 60 * 1000;
        });
        const matchingTemplate = !matchingEntry && (row.type === 'fixed' || row.type === 'debt')
          ? FinanceData.getActiveTemplates().find(template =>
            normalizeFixedDescription(template.desc) === normalizeFixedDescription(row.desc) &&
            Math.abs(Math.round(Number(template.amount) * 100) - Math.round(Number(row.amount) * 100)) <= 1 &&
            template.startMonth === row.startMonth &&
            template.accountId === row.accountId
          )
          : null;
        const matchingItem = matchingEntry || matchingTemplate;
        reason = matchingItem
          ? `Duplicado de “${matchingItem.desc}”${
            matchingEntry && matchingEntry.date
              ? ` (${matchingEntry.date.slice(0, 10).split('-').reverse().join('/')})`
              : matchingTemplate && matchingTemplate.startMonth
                ? ` (início ${matchingTemplate.startMonth.split('-').reverse().join('/')})`
                : ''
          }.`
          : 'Possível duplicado de lançamento existente.';
      } else if (!row.selected) {
        reason = 'Não selecionado para importação.';
      }
      if (reason) items.push({ date: row.date || '', desc: row.desc, reason });
    });
    return items;
  }

  function renderImportNotImported(details, countElement, list, importedIndexes) {
    if (!details || !countElement || !list) return;
    const items = getImportNotImportedItems(importedIndexes);
    countElement.textContent = String(items.length);
    details.hidden = items.length === 0;
    list.innerHTML = items.map(item => {
      const date = item.date ? item.date.split('-').reverse().join('/') : 'Data não identificada';
      return `<li><strong>${escapeHtml(item.desc)}</strong> — ${escapeHtml(date)} — ${escapeHtml(item.reason)}</li>`;
    }).join('');
  }

  function resetImportDecisionFlow() {
    importDecisionCandidates = [];
    importCandidateDecisions = new Map();
    showImportDecisionStep('preview');
    if (importFixedCandidateList) importFixedCandidateList.innerHTML = '';
    if (importFixedSearchInput) importFixedSearchInput.value = '';
    if (importFixedSearchStatus) importFixedSearchStatus.textContent = '';
    if (continueImportDecisionBtn) continueImportDecisionBtn.disabled = true;
  }

  function renderImportDecisionCandidates() {
    if (!importFixedCandidateList) return;
    const suggestions = !importFixedSearchInput || !importFixedSearchInput.value.trim()
      ? getImportCandidateSuggestions(_importParsedRows, importDecisionCandidates)
      : [];
    importFixedCandidateList.innerHTML = importDecisionCandidates.map((candidate, index) => {
      const decision = importCandidateDecisions.get(candidate.key) || { type: null, active: null };
      const months = candidate.months.join(', ');
      return `
        <article class="import-fixed-candidate">
          <h5>${escapeHtml(candidate.description)}</h5>
          <p>${escapeHtml(`${candidate.indexes.length} linha(s) · ${months}`)}</p>
          <fieldset>
            <legend>Este gasto é fixo?</legend>
            <label><input type="radio" name="import-candidate-${index}" value="fixed"
              data-candidate-choice="${index}" ${decision.type === 'fixed' ? 'checked' : ''} /> É fixo</label>
            <label><input type="radio" name="import-candidate-${index}" value="variable"
              data-candidate-choice="${index}" ${decision.type === 'variable' ? 'checked' : ''} /> Não é fixo</label>
          </fieldset>
          <fieldset class="import-fixed-active-choice" ${decision.type === 'fixed' ? '' : 'hidden'}>
            <legend>Estado do gasto fixo</legend>
            <label><input type="radio" name="import-candidate-active-${index}" value="true"
              data-candidate-active="${index}" ${decision.active === true ? 'checked' : ''} /> Ativo</label>
            <label><input type="radio" name="import-candidate-active-${index}" value="false"
              data-candidate-active="${index}" ${decision.active === false ? 'checked' : ''} /> Inativo</label>
          </fieldset>
        </article>`;
    }).join('') || '<p class="import-help-note">Nenhum candidato na lista. Use a busca para adicionar outro gasto fixo.</p>';
    if (suggestions.length) {
      importFixedCandidateList.insertAdjacentHTML('beforeend', `
        <div class="import-fixed-suggestions">
          <p class="import-help-note">Sugestões locais da prévia — selecione para revisar:</p>
          <ul>${suggestions.map((candidate, index) => `
            <li><button type="button" class="btn-secondary" data-import-suggestion="${index}">
              ${escapeHtml(candidate.description)}
            </button></li>`).join('')}</ul>
        </div>`);
      importFixedCandidateList.querySelectorAll('[data-import-suggestion]').forEach(button => {
        button.addEventListener('click', () => {
          const suggestion = suggestions[Number(button.dataset.importSuggestion)];
          if (!suggestion || !importFixedSearchInput) return;
          importFixedSearchInput.value = suggestion.description;
          searchImportFixedCandidate({ preventDefault() {} });
        });
      });
    } else if (importFixedSearchStatus && !importFixedSearchInput?.value.trim()) {
      importFixedSearchStatus.textContent = 'Sugestões baseadas somente nas descrições desta prévia.';
    }

    importFixedCandidateList.querySelectorAll('[data-candidate-choice]').forEach(input => {
      input.addEventListener('change', event => {
        const index = Number(event.target.dataset.candidateChoice);
        const candidate = importDecisionCandidates[index];
        const previous = importCandidateDecisions.get(candidate.key) || {};
        const decision = event.target.value === 'fixed'
          ? { type: 'fixed', active: previous.type === 'fixed' ? previous.active : null }
          : { type: 'variable', active: null };
        importCandidateDecisions.set(candidate.key, decision);
        const card = event.target.closest('.import-fixed-candidate');
        const activeChoice = card.querySelector('.import-fixed-active-choice');
        activeChoice.hidden = decision.type !== 'fixed';
        if (decision.type !== 'fixed') {
          activeChoice.querySelectorAll('input').forEach(radio => { radio.checked = false; });
        }
        updateImportDecisionContinueButton();
      });
    });
    importFixedCandidateList.querySelectorAll('[data-candidate-active]').forEach(input => {
      input.addEventListener('change', event => {
        const index = Number(event.target.dataset.candidateActive);
        const candidate = importDecisionCandidates[index];
        const decision = importCandidateDecisions.get(candidate.key);
        if (decision) {
          decision.active = event.target.value === 'true';
          updateImportDecisionContinueButton();
        }
      });
    });
    updateImportDecisionContinueButton();
  }

  function updateImportDecisionContinueButton() {
    if (!continueImportDecisionBtn) return;
    continueImportDecisionBtn.disabled = !areRecurringImportCandidatesResolved(
      importDecisionCandidates,
      importCandidateDecisions
    );
  }

  function syncImportPreviewControls() {
    if (!importPreviewTbody) return;
    _importParsedRows.forEach((row, index) => {
      const checkbox = importPreviewTbody.querySelector(`.import-row-check[data-row="${index}"]`);
      const categorySelect = importPreviewTbody.querySelector(`.import-cat-select[data-row="${index}"]`);
      const typeSelect = importPreviewTbody.querySelector(`.import-type-select[data-row="${index}"]`);
      if (checkbox) row.selected = checkbox.checked;
      if (categorySelect) row.category = categorySelect.value;
      if (typeSelect) row.previewType = typeSelect.value;
    });
  }

  function beginImportDecisionStep() {
    syncImportPreviewControls();
    importDecisionCandidates = collectRecurringImportCandidates(_importParsedRows);
    importCandidateDecisions = new Map(importDecisionCandidates.map(candidate =>
      [candidate.key, { type: null, active: null }]
    ));
    renderImportDecisionCandidates();
    showImportDecisionStep('decisions');
    const heading = document.getElementById('importFixedDecisionTitle');
    if (heading) heading.focus();
  }

  function searchImportFixedCandidate(event) {
    event.preventDefault();
    const matches = findRecurringImportCandidates(
      importFixedSearchInput ? importFixedSearchInput.value : '',
      _importParsedRows
    );
    const merged = mergeRecurringImportCandidates(importDecisionCandidates, matches);
    importDecisionCandidates = merged.candidates;
    merged.added.forEach(candidate => {
      importCandidateDecisions.set(candidate.key, { type: null, active: null });
    });
    if (importFixedSearchStatus) {
      importFixedSearchStatus.textContent = merged.added.length
        ? `${merged.added.length} candidato(s) adicionado(s) à lista.`
        : matches.length
          ? 'Os itens encontrados já estão na lista.'
          : 'Nenhuma linha importada corresponde à busca.';
    }
    renderImportDecisionCandidates();
    if (merged.added.length && importFixedCandidateList) {
      const firstChoice = importFixedCandidateList.querySelector('[data-candidate-choice]');
      if (firstChoice) firstChoice.focus();
    }
  }

  /** Abre o modal de importação e reseta o estado. */
  function openImportModal() {
    if (!importModal) return;
    trackUsageEvent('screen_import');
    importModal.classList.add('active');
    resetImportModal();
    updateImportAccountSelector();
    renderFixedImportRules();
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
    resetImportDecisionFlow();
    _importIgnoredRows = [];
    if (importWorkflowContent) importWorkflowContent.hidden = false;
    if (importCompletionSection) importCompletionSection.hidden = true;
    const closeButton = document.getElementById('closeImportModalBtn');
    if (closeButton) closeButton.hidden = false;
    setImportStage('choose');
    if (importPreviewTbody)   importPreviewTbody.innerHTML = '';
    if (previewCountBadge)    previewCountBadge.textContent = '0 itens';
    if (importSelectAll)      importSelectAll.checked = true;
    _importSourceRows = [];
    _importParsedRows = [];
    _importIgnoredRows = [];
    if (importDuplicateSelectionNote) {
      importDuplicateSelectionNote.textContent = '';
      importDuplicateSelectionNote.hidden = true;
    }
  }

  function showImportCompletion(importedItems, paymentItems, importedIndexes) {
    const summary = document.getElementById('importCompletionSummary');
    const countsList = document.getElementById('importCompletionCounts');
    const total = importedItems.length + paymentItems.length;
    const notImportedCount = getImportNotImportedItems(importedIndexes).length;
    if (summary) {
      summary.textContent = `${total} item(ns) importado(s), incluindo ${paymentItems.length} baixa(s) de parcela; ${notImportedCount} item(ns) não importado(s).`;
    }
    if (countsList) {
      const counts = new Map([
        ['Receitas', 0],
        ['Gastos variáveis', 0],
        ['Contas fixas', 0],
        ['Dívidas', 0],
        ['Baixas de parcelas', paymentItems.length]
      ]);
      importedItems.forEach(item => {
        const label = item.type === 'income' ? 'Receitas'
          : item.type === 'fixed' ? 'Contas fixas'
            : item.type === 'debt' || item.isDebt ? 'Dívidas'
              : 'Gastos variáveis';
        counts.set(label, counts.get(label) + 1);
      });
      countsList.innerHTML = [...counts]
        .map(([label, count]) => `<li>${escapeHtml(label)}: ${count}</li>`)
        .join('') || '<li>Nenhum lançamento importado.</li>';
    }
    renderImportNotImported(
      document.getElementById('importNotImportedCompletion'),
      document.getElementById('importNotImportedCompletionCount'),
      document.getElementById('importNotImportedCompletionList'),
      importedIndexes
    );
    setImportStage('complete');
    if (importWorkflowContent) importWorkflowContent.hidden = true;
    if (importCompletionSection) importCompletionSection.hidden = false;
    const closeButton = document.getElementById('closeImportModalBtn');
    if (closeButton) closeButton.hidden = true;
    document.getElementById('importCompletionTitle')?.focus();
  }

  function updateImportAccountSelector(selectedId = '') {
    if (!importTargetAccount) return;
    const accounts = FinanceData.getAccounts();
    importTargetAccount.innerHTML = [
      `<option value="">${accounts.length ? 'Selecione uma conta' : 'Confirme uma conta para continuar'}</option>`,
      ...accounts.map(account =>
        `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`
      )
    ].join('');
    importTargetAccount.required = accounts.length > 0;
    importTargetAccount.setAttribute('aria-required', String(accounts.length > 0));
    importTargetAccount.value = accounts.some(account => account.id === selectedId) ? selectedId : '';
    const requiredIndicator = document.getElementById('importTargetAccountRequiredIndicator');
    if (requiredIndicator) requiredIndicator.hidden = accounts.length === 0;
    if (createImportAccountBtn) createImportAccountBtn.hidden = accounts.length > 0;
    if (importTargetAccountError) {
      importTargetAccountError.hidden = true;
      importTargetAccountError.textContent = '';
    }
    if (_importSourceRows.length) prepareImportRows(_importSourceRows);
  }

  function renderFixedImportRules() {
    const list = document.getElementById('fixedImportRulesList');
    const empty = document.getElementById('fixedImportRulesEmpty');
    if (!list || !empty) return;
    const rules = FinanceData.getFixedImportRules();
    list.innerHTML = rules.map(rule => `
      <li>
        <span>${escapeHtml(rule)}</span>
        <button type="button" class="btn-secondary" data-action="remove-fixed-import-rule"
          data-rule="${escapeHtml(rule)}" aria-label="Apagar regra ${escapeHtml(rule)}">Apagar</button>
      </li>
    `).join('');
    empty.hidden = rules.length > 0;
  }

  async function removeFixedImportRule(rule) {
    if (!rule) return;
    const result = await FinanceData.saveFixedImportRules(
      FinanceData.getFixedImportRules().filter(savedRule => savedRule !== rule)
    );
    if (!FinanceData.getFixedImportRules().includes(rule)) {
      renderFixedImportRules();
      showToast(result.success
        ? 'Regra de importação apagada.'
        : 'Regra apagada neste aparelho; a sincronização ficou pendente.');
      return;
    }
    console.error('[GastoPro] Não foi possível apagar a regra de importação:', result.error);
    showToast('Não foi possível apagar a regra de importação.', 'error');
  }

  /** Alterna entre as abas CSV e Texto do modal. */
  function switchImportTab(tab) {
    const isCsv = tab === 'csv';
    if (importTabCsvBtn)  importTabCsvBtn.classList.toggle('active', isCsv);
    if (importTabTextBtn) importTabTextBtn.classList.toggle('active', !isCsv);
    if (importCsvPanel)   importCsvPanel.classList.toggle('active', isCsv);
    if (importTextPanel)  importTextPanel.classList.toggle('active', !isCsv);
    resetImportDecisionFlow();
  }

  function renderImportDueDaySummary(rows) {
    const summary = document.getElementById('importDueDaySummary');
    if (!summary) return;
    const preview = window.GastoProImportHelpers.getDueDayPreview(rows);
    summary.hidden = preview.count === 0;
    summary.textContent = preview.count
      ? `${preview.count} lançamento(s) a pagar sem dia de vencimento${
        preview.descriptions.length ? `: ${preview.descriptions.join(', ')}` : ''
      }. Informe o dia antes de confirmar; não assumiremos dia 01.`
      : '';
  }

  /**
   * Renderiza a tabela de preview com as linhas parseadas.
   * @param {Array} rows - Resultado de parseCSV() ou parseRawText().
   */
  function renderImportPreview(rows) {
    const installmentHint = document.getElementById('importInstallmentHint');
    const statementInfo = GastoProImporter.getLastOFXStatementInfo();
    const statementInfoElement = document.getElementById('importOfxStatementInfo');
    if (statementInfoElement) {
      const details = [];
      if (statementInfo?.bank) details.push(`Banco: ${statementInfo.bank}`);
      if (statementInfo?.account) details.push(`Conta: ${statementInfo.account}`);
      if (statementInfo?.balance != null && statementInfo.balanceDate) {
        details.push(`Saldo no arquivo: ${Number(statementInfo.balance).toLocaleString('pt-BR', {
          style: 'currency', currency: 'BRL'
        })} em ${statementInfo.balanceDate}`);
      }
      statementInfoElement.textContent = details.join(' · ');
      statementInfoElement.hidden = details.length === 0;
    }
    renderImportDueDaySummary(rows);
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
      renderImportNotImported(
        document.getElementById('importNotImportedPreview'),
        document.getElementById('importNotImportedPreviewCount'),
        document.getElementById('importNotImportedPreviewList')
      );
      setImportStage('preview');
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
      const selectedType = row.previewType || getImportPreviewType(row);
      const isIncome = selectedType === 'income';
      const dateDisplay = row.date
        ? row.date.split('-').reverse().join('/')
        : 'Data inválida';
      const needsPaymentReview = requiresImportPaymentReview(row, row.category);
      const rowStatus = [
        row.invalid ? '<span class="import-row-status invalid">Data inválida</span>' : '',
        row.duplicate ? '<span class="import-row-status duplicate">Parece já lançado</span>' : '',
        row.typeSignMismatch
          ? '<span class="import-row-status duplicate">Revisar tipo e sinal</span>' : '',
        row.reviewOwnAccountMovement
          ? '<span class="import-row-status duplicate">Parece movimentação entre suas contas ou investimento</span>' : '',
        row.fixedByRule ? '<span class="import-row-status pending">Regra salva: Fixo</span>' : '',
        row.pending ? '<span class="import-row-status pending">Sugestão: a pagar</span>' : '',
        `<span class="import-row-status pending import-review-status" ${needsPaymentReview ? '' : 'hidden'}>Revisar</span>`
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
      const dueDayDisplay = `
        <label class="import-due-day-field" for="importDueDay${i}" ${isIncome ? 'hidden' : ''}>
          Dia do vencimento
          <input type="number" class="import-due-day-input" id="importDueDay${i}"
            data-row="${i}" min="1" max="31" step="1" inputmode="numeric"
            value="${row.dueDay == null ? '' : escapeHtml(row.dueDay)}" aria-label="Dia do vencimento do lançamento ${i + 1}" />
          <span class="import-due-day-status" data-row="${i}" hidden></span>
        </label>`;
      const dueDayMonthWarning = getImportDueDayMonthWarning(row, selectedType);
      const paymentPeriodDisplay = (row.type === 'fixed' || row.type === 'debt') && row.startMonth
        ? `<small class="import-row-reason">${escapeHtml(row.endMonth
          ? `A pagar de ${row.startMonth.slice(5, 7)}/${row.startMonth.slice(0, 4)} até ${row.endMonth.slice(5, 7)}/${row.endMonth.slice(0, 4)}`
          : `A pagar a partir de ${row.startMonth.slice(5, 7)}/${row.startMonth.slice(0, 4)}`)}</small>`
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-check">
          <label class="import-row-check-target">
            <input type="checkbox" class="import-row-check" data-row="${i}"
              aria-label="Incluir lançamento ${escapeHtml(row.desc)}"
              ${row.selected ? 'checked' : ''} ${row.invalid ? 'disabled' : ''} />
          </label>
        </td>
        <td class="col-date">${escapeHtml(dateDisplay)}</td>
        <td class="col-desc" title="${escapeHtml(row.desc)}">
          ${escapeHtml(row.desc)} ${rowStatus}
          ${installmentDisplay}
          ${paymentPeriodDisplay}
          ${dueDayDisplay}
          <small class="import-due-day-warning">${escapeHtml(dueDayMonthWarning)}</small>
          ${row.typeSignMismatch
            ? '<small class="import-row-reason">O tipo informado não combina com o sinal do valor.</small>'
            : ''}
          ${row.reviewOwnAccountMovement
            ? '<small class="import-row-reason">Confira se deseja importar esta movimentação entre suas contas ou investimento.</small>'
            : ''}
          ${row.cardInvoiceNotice
            ? '<small class="import-row-reason">Pagamento de fatura: não importe também as compras deste cartão para não contar duas vezes.</small>'
            : ''}
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

      const rowCheckbox = tr.querySelector('.import-row-check');
      rowCheckbox.addEventListener('change', event => {
        row.selected = event.target.checked;
        row.selectionTouched = true;
        renderImportDueDaySummary(_importParsedRows);
        renderImportNotImported(
          document.getElementById('importNotImportedPreview'),
          document.getElementById('importNotImportedPreviewCount'),
          document.getElementById('importNotImportedPreviewList')
        );
      });
      tr.querySelector('.import-cat-select').addEventListener('change', event => {
        row.category = event.target.value;
        const status = tr.querySelector('.import-review-status');
        if (status) status.hidden = !requiresImportPaymentReview(row, row.category);
      });
      // Listener dinâmico: ao mudar tipo, atualiza cor do valor
      tr.querySelector('.import-type-select').addEventListener('change', (e) => {
        const isInc = e.target.value === 'income';
        row.previewType = e.target.value;
        tr.querySelector('.col-amount').classList.toggle('income', isInc);
        const dueDayField = tr.querySelector('.import-due-day-field');
        const dueDayInput = tr.querySelector('.import-due-day-input');
        const dueDayStatus = tr.querySelector('.import-due-day-status');
        updateImportDueDayField(
          row, e.target.value, dueDayField, dueDayInput, dueDayStatus,
          Boolean(row.installment)
        );
        renderImportDueDaySummary(_importParsedRows);
        renderImportNotImported(
          document.getElementById('importNotImportedPreview'),
          document.getElementById('importNotImportedPreviewCount'),
          document.getElementById('importNotImportedPreviewList')
        );
        const warning = tr.querySelector('.import-due-day-warning');
        if (warning) warning.textContent = getImportDueDayMonthWarning(row, e.target.value);
      });
      const dueDayInput = tr.querySelector('.import-due-day-input');
      if (dueDayInput) {
        const dueDayField = tr.querySelector('.import-due-day-field');
        const dueDayStatus = tr.querySelector('.import-due-day-status');
        updateImportDueDayField(
          row, selectedType, dueDayField, dueDayInput, dueDayStatus,
          Boolean(row.installment)
        );
        dueDayInput.addEventListener('input', event => {
          updateImportDueDay(row, event.target.value);
          renderImportDueDaySummary(_importParsedRows);
          updateImportDueDayField(
            row, tr.querySelector('.import-type-select').value,
            dueDayField, dueDayInput, dueDayStatus, Boolean(row.installment)
          );
          const warning = tr.querySelector('.import-due-day-warning');
          if (warning) {
            warning.textContent = getImportDueDayMonthWarning(
              row, tr.querySelector('.import-type-select').value
            );
          }
        });
      }

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
    renderImportNotImported(
      document.getElementById('importNotImportedPreview'),
      document.getElementById('importNotImportedPreviewCount'),
      document.getElementById('importNotImportedPreviewList')
    );
    setImportStage('preview');
  }

  // Armazena as linhas parseadas para uso posterior na confirmação
  let _importParsedRows = [];
  let _importSourceRows = [];

  function showImportWarnings() {
    const warnings = GastoProImporter.getLastWarnings();
    if (warnings.length) showToast(warnings.join(' '));
    return warnings.length > 0;
  }

  function prepareImportRows(rows) {
    resetImportDecisionFlow();
    const previousRows = _importParsedRows;
    previousRows.forEach((row, index) => {
      const checkbox = importPreviewTbody &&
        importPreviewTbody.querySelector(`.import-row-check[data-row="${index}"]`);
      const categorySelect = importPreviewTbody &&
        importPreviewTbody.querySelector(`.import-cat-select[data-row="${index}"]`);
      const typeSelect = importPreviewTbody &&
        importPreviewTbody.querySelector(`.import-type-select[data-row="${index}"]`);
      const dueDayInput = importPreviewTbody &&
        importPreviewTbody.querySelector(`.import-due-day-input[data-row="${index}"]`);
      if (checkbox && checkbox.checked !== row.selected) {
        row.selected = checkbox.checked;
        row.selectionTouched = true;
      }
      if (categorySelect) row.category = categorySelect.value;
      if (typeSelect && typeSelect.value !== (row.previewType || getImportPreviewType(row))) {
        row.previewType = typeSelect.value;
      }
      if (dueDayInput) updateImportDueDay(row, dueDayInput.value);
    });
    _importSourceRows = rows.map(row => ({ ...row }));
    const templates = FinanceData.getActiveTemplates();
    const accountId = importTargetAccount ? importTargetAccount.value : '';
    _importParsedRows = GastoProImporter.markDuplicates(
      _importSourceRows, FinanceData.getEntries(), accountId
    )
      .map(row => {
        if (row.type === 'fixed' || row.type === 'debt') {
          const duplicate = row.duplicate ||
            GastoProImporter.isTemplateDuplicate(row, templates, accountId);
          return {
            ...row,
            duplicate,
            selected: !row.invalid && !duplicate &&
              !row.typeSignMismatch && !row.reviewOwnAccountMovement
          };
        }
        if (row.duplicate || row.invalid || !row.installment) return row;
        const template = GastoProImporter.matchDebtTemplate(row, templates);
        return template ? { ...row, linkedTemplateId: template.id } : row;
      });
    _importParsedRows = markRecurringImportRows(_importParsedRows);
    _importParsedRows = applyFixedImportRules(_importParsedRows, FinanceData.getFixedImportRules());
    _importParsedRows = _importParsedRows.map((row, index) => {
      const previous = previousRows[index];
      if (!previous) return row;
      const updated = {
        ...row,
        category: previous.category,
        previewType: previous.previewType,
        selectionTouched: previous.selectionTouched
      };
      if (previous.selectionTouched) {
        updated.selected = previous.selected;
      } else if (row.duplicate) {
        updated.selected = false;
      } else if (previous.duplicate) {
        updated.selected = !row.invalid &&
          !row.typeSignMismatch && !row.reviewOwnAccountMovement;
      } else {
        updated.selected = previous.selected;
      }
      return updated;
    });
    const hadWarnings = showImportWarnings();
    renderImportPreview(_importParsedRows);
    return hadWarnings;
  }

  /** Lê o arquivo selecionado e faz o parse. */
  async function handleCsvParse() {
    if (!csvFileInput || !csvFileInput.files || !csvFileInput.files[0]) {
      showToast('Selecione um arquivo antes de analisar.', 'error');
      return;
    }
    const file = csvFileInput.files[0];
    if (!GastoProImporter.isSupportedFile(file)) {
      csvFileInput.value = '';
      showToast(GastoProImporter.UNSUPPORTED_FILE_WARNING, 'error');
      return;
    }
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    if (file.size > (isPdf ? 10_000_000 : 1_000_000)) {
      showToast(isPdf ? 'O PDF excede 10 MB.' : 'O arquivo deve ter no máximo 1 MB.', 'error');
      return;
    }
    const pdfReadingStatus = document.getElementById('pdfReadingStatus');
    if (pdfReadingStatus) pdfReadingStatus.hidden = !isPdf;
    try {
      const rows = await GastoProImporter.parseFile(file);
      _importIgnoredRows = GastoProImporter.getLastIgnoredRows();
      const hadWarnings = prepareImportRows(rows);
      if (_importParsedRows.length > 0 && !hadWarnings) {
        showToast(`${_importParsedRows.length} lançamentos encontrados no arquivo!`);
      }
    } catch (err) {
      console.error('[GastoPro Importer] Erro ao ler o arquivo:', err);
      trackUsageEvent('import_parse_error');
      showToast('Erro ao ler o arquivo. Verifique o formato.', 'error');
    } finally {
      if (pdfReadingStatus) pdfReadingStatus.hidden = true;
    }
  }

  /** Lê o texto bruto da textarea e faz o parse. */
  function handleTextParse() {
    const text = importRawTextarea ? importRawTextarea.value : '';
    if (!text.trim()) {
      showToast('Cole o texto do extrato antes de analisar.', 'error');
      return;
    }
    if (text.length > 200_000) {
      showToast('O texto colado excede 200.000 caracteres.', 'error');
      return;
    }
    try {
      const rows = GastoProImporter.parseRawText(text);
      _importIgnoredRows = GastoProImporter.getLastIgnoredRows();
      const hadWarnings = prepareImportRows(rows);
      if (_importParsedRows.length > 0 && !hadWarnings) {
        showToast(`${_importParsedRows.length} lançamentos encontrados!`);
      }
    } catch (err) {
      console.error('[GastoPro Importer] Erro ao parsear texto:', err);
      trackUsageEvent('import_parse_error');
      showToast('Erro ao interpretar o texto. Verifique o formato.', 'error');
    }
  }

  /**
   * Confirma a importação e grava os itens selecionados em um único lote.
   * Lê os valores atuais de categoria e tipo diretamente da tabela de preview
   * para respeitar as edições feitas pelo usuário antes de confirmar.
   */
  async function handleConfirmImport() {
    if (!importPreviewTbody || _importParsedRows.length === 0) return;
    syncImportPreviewControls();
    let accountId = window.GastoProImportHelpers.getImportAccountId(
      importTargetAccount ? importTargetAccount.value : '',
      FinanceData.getAccounts()
    );
    if (!FinanceData.getAccounts().length) {
      accountId = await requestFirstEntryAccount();
      if (!accountId) return;
      updateImportAccountSelector(accountId);
    }
    if (!accountId && FinanceData.getAccounts().length) {
      const message = 'Selecione uma conta de destino antes de importar.';
      if (importTargetAccountError) {
        importTargetAccountError.textContent = message;
        importTargetAccountError.hidden = false;
      }
      showToast(message, 'error');
      return;
    }

    const checkboxes = importPreviewTbody.querySelectorAll('.import-row-check');
    const catSelects  = importPreviewTbody.querySelectorAll('.import-cat-select');
    const typeSelects = importPreviewTbody.querySelectorAll('.import-type-select');
    const dueDayInputs = importPreviewTbody.querySelectorAll('.import-due-day-input');
    dueDayInputs.forEach(input => {
      const row = _importParsedRows[Number(input.dataset.row)];
      if (row) updateImportDueDay(row, input.value);
    });

    const items = [];
    const debtItems = [];
    const launches = [];
    const payments = [];
    const importedIndexes = new Set();
    const candidateByIndex = new Map();
    importDecisionCandidates.forEach(candidate => candidate.indexes.forEach(index =>
      candidateByIndex.set(index, candidate)
    ));
    const processedFixedCandidates = new Set();
    let excludedDueDayRows = 0;
    const excludeImportRow = index => {
      const checkbox = checkboxes[index];
      const row = _importParsedRows[index];
      if (!checkbox || !row || !checkbox.checked) return;
      checkbox.checked = false;
      row.selected = false;
      row.dueDayMissing = true;
      excludedDueDayRows++;
      const typeSelect = typeSelects[index];
      const dueDayLabel = importPreviewTbody.querySelector(
        `.import-due-day-field[for="importDueDay${index}"]`
      );
      const dueDayInput = dueDayInputs[index];
      const dueDayStatus = importPreviewTbody.querySelector(
        `.import-due-day-status[data-row="${index}"]`
      );
      updateImportDueDayField(
        row, typeSelect ? typeSelect.value : getImportPreviewType(row),
        dueDayLabel, dueDayInput, dueDayStatus, Boolean(row.installment)
      );
    };
    const now = new Date();
    const currentMonth = getYearMonthString(now.getFullYear(), now.getMonth() + 1);
    const dueDayValidationRows = [];
    for (let index = 0; index < checkboxes.length; index++) {
      const sourceRow = _importParsedRows[index];
      if (!checkboxes[index].checked || sourceRow.invalid) continue;
      const candidate = candidateByIndex.get(index);
      const candidateDecision = candidate && importCandidateDecisions.get(candidate.key);
      if (candidateDecision && candidateDecision.type === 'fixed') {
        const latestSelected = candidate.indexes
          .filter(candidateIndex => _importParsedRows[candidateIndex].selected)
          .sort((left, right) =>
            _importParsedRows[left].date.localeCompare(_importParsedRows[right].date)
          ).pop();
        if (latestSelected !== index) continue;
      }
      const selectedType = typeSelects[index] ? typeSelects[index].value : getImportPreviewType(sourceRow);
      const type = getRecurringImportLineType(sourceRow, candidateDecision, selectedType);
      const installmentCheckbox = importPreviewTbody.querySelector(
        `.import-installment-check[data-row="${index}"]`
      );
      const createsInstallmentDebt = Boolean(
        sourceRow.installment && installmentCheckbox && installmentCheckbox.checked &&
        !sourceRow.linkedTemplateId
      );
      dueDayValidationRows.push({
        index,
        row: sourceRow,
        type,
        installmentDebt: createsInstallmentDebt,
        candidate,
        candidateDecision
      });
    }
    getImportDueDayExclusionIndexes(dueDayValidationRows).forEach(excludeImportRow);
    if (excludedDueDayRows) {
      showToast(getImportDueDayExcludedMessage(excludedDueDayRows));
    }
    checkboxes.forEach((cb, i) => {
      const sourceRow = _importParsedRows[i];
      if (sourceRow.invalid) return;
      const candidate = candidateByIndex.get(i);
      const candidateDecision = candidate && importCandidateDecisions.get(candidate.key);
      if (candidateDecision && candidateDecision.type === 'fixed') {
        if (processedFixedCandidates.has(candidate.key)) return;
        processedFixedCandidates.add(candidate.key);
        const fixed = buildRecurringImportTemplate(
          candidate, _importParsedRows, candidateDecision, currentMonth
        );
        if (!fixed) return;
        const category = fixed.category;
        const templateType = fixed.isDebt ? 'debt' : 'fixed';
        const builtTemplate = GastoProImporter.buildEntry(
          { ...fixed, accountId, category },
          templateType
        );
        debtItems.push({
          ...builtTemplate,
          isDebt: fixed.isDebt,
          active: fixed.active,
          paidMonths: fixed.paidMonths
        });
        candidate.indexes.forEach(candidateIndex => {
          if (_importParsedRows[candidateIndex].selected) importedIndexes.add(candidateIndex);
        });
        return;
      }
      if (!cb.checked) return;

      const row      = { ...sourceRow, accountId };
      const category = catSelects[i] ? catSelects[i].value : row.category;
      const selectedType = typeSelects[i] ? typeSelects[i].value : 'variable';
      const type = getRecurringImportLineType(row, candidateDecision, selectedType);

      if (type === 'fixed' || type === 'debt') {
        debtItems.push(GastoProImporter.buildEntry({ ...row, category }, type));
        importedIndexes.add(i);
        return;
      }

      if (type === 'variable_pending') {
        launches.push(GastoProImporter.buildEntry(
          { ...row, category },
          'variable',
          getImportPaidValue(row)
        ));
        importedIndexes.add(i);
        return;
      }

      if ((type === 'variable' || type === 'income') && row.installment && row.linkedTemplateId) {
        if (getImportPaidValue(row)) {
          payments.push({ id: row.linkedTemplateId, ym: row.date.substring(0, 7) });
          importedIndexes.add(i);
        } else {
          sourceRow.importSkipReason = 'Parcela marcada como não paga.';
        }
        return;
      }

      if ((type === 'variable' || type === 'income') && row.installment) {
        const installmentCheckbox = importPreviewTbody.querySelector(
          `.import-installment-check[data-row="${i}"]`
        );
        if (installmentCheckbox && installmentCheckbox.checked) {
          const debt = GastoProImporter.buildInstallmentDebt(row, category);
          const month = row.date.substring(0, 7);
          if (getImportPaidValue(row)) debt.paidMonths[month] = true;
          else delete debt.paidMonths[month];
          debtItems.push(debt);
          importedIndexes.add(i);
          return;
        }
      }

      const entry = GastoProImporter.buildEntry(
        { ...row, category },
        type,
        getImportPaidValue(row)
      );

      launches.push(entry);
      importedIndexes.add(i);
    });

    items.push(...debtItems, ...launches);
    if (items.length > 0 || payments.length > 0) {
      try {
        const result = await FinanceData.importBatch(items, payments);
        const persistedEntryIds = new Set(FinanceData.getEntries().map(entry => entry.id));
        const reviewIds = result.items
          .slice(debtItems.length)
          .filter(item => item && item.paid === true &&
            requiresImportPaymentReview(item, item.category) &&
            persistedEntryIds.has(item.id))
          .map(item => item.id);
        if (reviewIds.length) {
          try {
            addPaidImportReviewIds(reviewIds);
            syncPaidImportReviewNotification();
            renderNotificationCenter();
          } catch (error) {
            console.error('[GastoPro] Os lançamentos foram importados, mas não foi possível registrar a revisão:', error);
            showToast('Importação concluída, mas não foi possível salvar a lista de itens para conferência.', 'error');
          }
        }
        if (!result.success) {
          trackUsageEvent('import_save_error');
          showToast(result.syncResult
            ? 'O lote ficou salvo neste aparelho e aguarda sincronização.'
            : result.error || 'Não foi possível salvar o lote importado.',
          'error');
          return;
        }
        trackUsageEvent('import_completed');
        renderAll();
        showImportCompletion(result.items, payments, importedIndexes);
      } catch (err) {
        console.error('[GastoPro Importer] Erro ao salvar os lançamentos:', err);
        trackUsageEvent('import_save_error');
        showToast('Não foi possível concluir a importação. Tente novamente.', 'error');
      }
    } else {
      showToast(excludedDueDayRows
        ? `${excludedDueDayRows} linha(s) sem dia válido ficaram fora da importação; edite o dia e tente novamente.`
        : 'Selecione ao menos um lançamento para importar.',
      'error');
    }
  }

  // ── Event Listeners do modal de importação ────────────────────

  // Abrir modal
  if (sidebarImportBtn) sidebarImportBtn.addEventListener('click', openImportModal);
  if (createImportAccountBtn) {
    createImportAccountBtn.addEventListener('click', () => {
      returnToImportAfterAccountModal = true;
      importAccountCreatedId = null;
      closeImportModal();
      openAccountModal();
    });
  }
  if (importTargetAccount) {
    importTargetAccount.addEventListener('change', () => {
      if (importTargetAccountError) {
        importTargetAccountError.hidden = true;
        importTargetAccountError.textContent = '';
      }
      if (_importSourceRows.length) prepareImportRows(_importSourceRows);
    });
  }
  window.addEventListener('gastopro:account-modal-closed-for-import', event => {
    updateImportAccountSelector(event.detail.accountId);
  });

  // Fechar modal
  if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);
  if (cancelImportBtn)     cancelImportBtn.addEventListener('click', closeImportModal);
  if (closeImportCompletionBtn) {
    closeImportCompletionBtn.addEventListener('click', () => closeImportModal(true));
  }

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
      if (file && !GastoProImporter.isSupportedFile(file)) {
        csvFileInput.value = '';
        if (csvDropZone) {
          csvDropZone.classList.remove('csv-file-selected');
          document.getElementById('csvDropIcon').className = 'fa-solid fa-cloud-arrow-up drop-icon';
          document.getElementById('csvDropTitle').textContent = 'Arraste o arquivo aqui';
          document.getElementById('csvDropSub').textContent = 'ou clique para selecionar o arquivo (.csv, .ofx, .xml, .pdf)';
        }
        showToast(GastoProImporter.UNSUPPORTED_FILE_WARNING, 'error');
        return;
      }
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
  if (parseCsvBtn) parseCsvBtn.addEventListener('click', () =>
    withProtectedAction(parseCsvBtn, handleCsvParse)
  );
  if (parseTextBtn) parseTextBtn.addEventListener('click', () =>
    withProtectedAction(parseTextBtn, handleTextParse)
  );
  if (downloadCsvTemplateBtn) {
    downloadCsvTemplateBtn.addEventListener('click', () => {
      const downloaded = downloadReportFile(
        new Blob([GastoProImporter.createCSVTemplate()], { type: 'text/csv;charset=utf-8' }),
        'gastopro-modelo-importacao.csv'
      );
      if (!downloaded) showToast('Não foi possível baixar o modelo CSV neste navegador.', 'error');
    });
  }

  // Selecionar/deselecionar todos
  if (importSelectAll) {
    importSelectAll.addEventListener('change', () => {
      const checkboxes = importPreviewTbody
        ? importPreviewTbody.querySelectorAll('.import-row-check')
        : [];
      const selectionState = getImportSelectAllState(_importParsedRows, importSelectAll.checked);
      checkboxes.forEach(cb => {
        if (cb.disabled) return;
        const row = _importParsedRows[Number(cb.dataset.row)];
        row.selected = selectionState.selected[Number(cb.dataset.row)];
        row.selectionTouched = true;
        cb.checked = row.selected;
      });
      if (importDuplicateSelectionNote) {
        importDuplicateSelectionNote.hidden = !selectionState.message;
        importDuplicateSelectionNote.textContent = selectionState.message;
      }
      renderImportDueDaySummary(_importParsedRows);
      renderImportNotImported(
        document.getElementById('importNotImportedPreview'),
        document.getElementById('importNotImportedPreviewCount'),
        document.getElementById('importNotImportedPreviewList')
      );
    });
  }


  if (importFixedSearchForm) {
    importFixedSearchForm.addEventListener('submit', searchImportFixedCandidate);
  }
  if (confirmImportBtn) {
    confirmImportBtn.addEventListener('click', beginImportDecisionStep);
  }
  if (backToImportPreviewBtn) {
    backToImportPreviewBtn.addEventListener('click', () => showImportDecisionStep('preview'));
  }
  if (continueImportDecisionBtn) {
    continueImportDecisionBtn.addEventListener('click', () => {
      if (continueImportDecisionBtn.disabled) return;
      showImportDecisionStep('confirm');
      if (finalConfirmImportBtn) finalConfirmImportBtn.focus();
    });
  }
  if (backToImportDecisionBtn) {
    backToImportDecisionBtn.addEventListener('click', () => showImportDecisionStep('decisions'));
  }

  // Confirmar importação
  if (finalConfirmImportBtn) finalConfirmImportBtn.addEventListener('click', () =>
    withProtectedAction(finalConfirmImportBtn, async () => {
      if (importSaving) return;
      const previousCancelDisabled = cancelImportBtn.disabled;
      const previousCloseDisabled = closeImportModalBtn.disabled;
      await withSaving(finalConfirmImportBtn, async () => {
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
    })
  );


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
    fixedNew: [],         // { desc, amount, dueDay } → novos gastos fixos digitados
    varItems: {},         // { category: amount } → categorias com valor
    varCustom: [],        // { desc, amount, dueDay } → gastos variáveis avulsos
    varDueDay: null,
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
  const wFixedDay            = document.getElementById('wFixedDay');
  const wAddFixedBtn         = document.getElementById('wAddFixedBtn');

  // Passo 3 — Variáveis
  const wizardCategoryGrid = document.getElementById('wizardCategoryGrid');
  const wizardVarList      = document.getElementById('wizardVarList');
  const wVarDesc           = document.getElementById('wVarDesc');
  const wVarAmount         = document.getElementById('wVarAmount');
  const wVarDay            = document.getElementById('wVarDay');
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
    updateAccountSelects();
    const wizardAccount = document.getElementById('wizardAccount');
    if (wizardAccount) wizardAccount.value = '';
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
      varDueDay: null,
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

    if (!desc) { showToast('Informe a descrição da renda.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.', 'error'); return; }

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
    const allTemplates = FinanceData.getActiveTemplates().filter(t =>
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
    const dueDayValue = wFixedDay ? wFixedDay.value : '';
    const dueDay = dueDayValue === '' ? null : Number(dueDayValue);

    if (!desc)   { showToast('Informe a descrição do gasto fixo.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.', 'error'); return; }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      showToast('Informe um dia de vencimento entre 1 e 31.', 'error');
      return;
    }

    wizardState.fixedNew.push({ desc, amount, dueDay });
    if (wFixedDesc)   wFixedDesc.value   = '';
    if (wFixedAmount) wFixedAmount.value = '';
    if (wFixedDay) wFixedDay.value = '';
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
    const dueDayValue = wVarDay ? wVarDay.value : '';
    const dueDay = dueDayValue === '' ? null : Number(dueDayValue);

    if (!desc)   { showToast('Informe a descrição do gasto.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Informe um valor válido.', 'error'); return; }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      showToast('Informe um dia de vencimento entre 1 e 31.', 'error');
      return;
    }

    wizardState.varCustom.push({ desc, amount, dueDay });
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
    const templates = FinanceData.getActiveTemplates();
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
    const hasVariableItems = Object.values(wizardState.varItems).some(amount => amount > 0) ||
      wizardState.varCustom.length > 0;
    const varDueValue = wVarDay ? wVarDay.value : '';
    const varDueDay = varDueValue === '' ? null : Number(varDueValue);
    if (hasVariableItems && (!Number.isInteger(varDueDay) || varDueDay < 1 || varDueDay > 31)) {
      showToast('Informe um dia de vencimento entre 1 e 31 para os gastos variáveis.', 'error');
      goToWizardStep(3, 'back');
      return;
    }
    const itemsToSave = wizardState.incomes.length + wizardState.fixedChecked.length +
      wizardState.fixedNew.length + Object.values(wizardState.varItems).filter(amount => amount > 0).length +
      wizardState.varCustom.length;
    if (!itemsToSave) {
      showToast('Nenhum dado foi informado para salvar.', 'error');
      closeWizard();
      return;
    }
    let accountId = document.getElementById('wizardAccount').value || null;
    if (FinanceData.getAccounts().length && !accountId) {
      showToast('Escolha uma conta de destino antes de salvar.', 'error');
      return;
    }
    if (!FinanceData.getAccounts().length) {
      accountId = await requestFirstEntryAccount();
      if (!accountId) return;
    }
    let saved = 0;

    // 1. Salvar rendas
    wizardState.incomes.forEach(item => {
      const dateStr = item.date || `${ym}-01`;
      const result = FinanceData.add({
        type:     'income',
        desc:     item.desc,
        amount:   item.amount,
        category: 'Receita',
        date:     dateStr,
        month:    dateStr.substring(0, 7),
        paid:     true,
        accountId,
      });
      if (!result) throw new Error('Não foi possível salvar uma renda na conta escolhida.');
      saved++;
    });

    // 2. Registrar baixa dos fixos marcados no mês atual
    wizardState.fixedChecked.forEach(id => {
      const template = FinanceData.getActiveTemplates().find(item => item.id === id);
      const assigned = template && FinanceData.update(id, {
        accountId,
        dueDay: template.day
      });
      if (!assigned) throw new Error('Não foi possível vincular um gasto fixo à conta escolhida.');
      FinanceData.togglePaid(id, ym);
      saved++;
    });

    // 3. Salvar novos gastos fixos (templates)
    wizardState.fixedNew.forEach(item => {
      const result = FinanceData.add({
        type:       'fixed',
        desc:       item.desc,
        amount:     item.amount,
        category:   'Moradia',
        isDebt:     false,
        active:     true,
        startMonth: ym,
        endMonth:   null,
        dueDay:     item.dueDay,
        accountId,
      });
      if (!result) throw new Error('Não foi possível salvar um gasto fixo com o vencimento informado.');
      saved++;
    });

    // 4. Salvar gastos variáveis por categoria
    WIZARD_VAR_CATEGORIES.forEach(cat => {
      const amount = wizardState.varItems[cat.name];
      if (amount && amount > 0) {
        const result = FinanceData.add({
          type:     'variable',
          desc:     cat.name,
          amount:   amount,
          category: cat.name,
          date:     `${ym}-01`,
          month:    ym,
          paid:     false,
          dueDay:   varDueDay,
          accountId,
        });
        if (!result) throw new Error('Não foi possível salvar um gasto variável com a conta e vencimento informados.');
        saved++;
      }
    });

    // 5. Salvar gastos variáveis avulsos
    wizardState.varCustom.forEach(item => {
      const result = FinanceData.add({
        type:     'variable',
        desc:     item.desc,
        amount:   item.amount,
        category: GastoProImporter ? GastoProImporter.autoDetectCategory(item.desc) : 'Outros',
        date:     `${ym}-01`,
        month:    ym,
        paid:     false,
        dueDay:   item.dueDay,
        accountId,
      });
      if (!result) throw new Error('Não foi possível salvar um gasto variável com a conta e vencimento informados.');
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
      showToast('Nenhum dado foi informado para salvar.', 'error');
    }

    closeWizard();
  }

  // ── Navegação ────────────────────────────────────────────────

  /** Avança para o próximo passo ou finaliza. */
  async function handleWizardNext() {
    const step = wizardState.step;

    if (step === 1) {
      if (wizardState.incomes.length === 0) {
        showToast('Adicione ao menos uma fonte de renda antes de avançar.', 'error');
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
          showToast(error.message || 'Não foi possível salvar o lançamento rápido.', 'error');
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
            showToast('Não foi possível verificar a sessão. Seus dados locais foram preservados.', 'error');
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
          showToast('Não foi possível verificar a sessão. Seus dados locais foram preservados.', 'error');
        }
      }

      renderUserProfile();
      if (user) await refreshAdminBadge();
      else resetAdminSession();

      const defaultView = window.GastoProViewHelpers.restore(
        readStoredMainView(),
        user ? user.id : null,
        adminViewState.access === 'allowed'
      );
      const activeOwnerId = user ? user.id : FinanceData.getActiveUserId() || null;
      const canRestoreReloadState = appReloadState &&
        appReloadState.ownerId === activeOwnerId &&
        (appReloadState.view !== 'admin' || adminViewState.access === 'allowed');
      if (appReloadState && appReloadState.ownerId !== activeOwnerId) {
        state.currentYear = _initDate.getFullYear();
        state.currentMonth = _initDate.getMonth() + 1;
      }
      const restoredView = canRestoreReloadState ? appReloadState.view : defaultView;
      document.body.classList.remove('auth-checking');
      window.switchToView(restoredView);
      if (user) await syncUserDataFromCloud(user.id);
      if (appReloadState) clearAppReloadState();
      accountOnboardingDataReady = true;
      window.dispatchEvent(new Event('gastopro:account-data-ready'));
      window.requestAnimationFrame(resetInitialViewPosition);
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
    accountOnboardingDataReady = true;
    window.dispatchEvent(new Event('gastopro:account-data-ready'));
  });

  // ── 12. Registro do Service Worker (PWA) ─────────────────────
  // Permite instalação como app e funcionamento offline.
  // A falha é esperada quando o app é aberto via file:// (sem servidor),
  // então é tratada silenciosamente para não poluir o console do usuário.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(registration => {
      watchForWaitingAppUpdate(registration);
    }).catch(err => {
      console.info('[GastoPro] Service Worker não registrado (normal em file://):', err.message);
    });
    updateDisplayedAppVersion();
  }

  // ── 13. Metas por Categoria — Event Listeners ─────────────────
  initGoalModalListeners();
  initOnboarding();
  initInstallCard();
  initAccountOnboarding();
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
    if (emptyState) {
      emptyState.innerHTML = `
        <i class="fa-solid fa-bullseye"></i>
        <p>Nenhuma meta definida ainda.</p>
        <span>Defina um teto de gastos por categoria para acompanhar seus limites.</span>
        <small class="empty-state-tip">A tela mostra o progresso ao atingir 80% e 100% do limite.</small>`;
      emptyState.style.display = 'flex';
    }
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
          <span class="goal-spent ${getFinancialAmountPresentation(-goal.spent, { signed: true }).className}">${escapeHtml(getFinancialAmountPresentation(-goal.spent, { signed: true }).text)}</span>
          <span class="goal-separator">de</span>
          <span class="goal-limit financial-amount financial-amount--neutral">${formatCurrency(goal.limit)}</span>
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
        showToast('⚠️ Selecione uma categoria antes de salvar.', 'error');
        return;
      }
      if (!limit || limit <= 0) {
        showToast('⚠️ Informe um valor de limite válido (maior que zero).', 'error');
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
          showToast(error.message || 'Não foi possível salvar a meta.', 'error');
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
