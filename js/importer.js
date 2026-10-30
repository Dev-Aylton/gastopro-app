/* ================================================================
   GastoPro — Módulo de Importação de Extratos (Importer)
   Autor: Aylton Alberto | Estudante de ADS
   Arquivo: js/importer.js

   RESPONSABILIDADE:
   Centraliza a lógica de parsing de extratos bancários em dois formatos:
   1. CSV  — arquivo .csv com colunas Data, Descrição, Valor
   2. Texto bruto — bloco copiado diretamente do app/site do banco

   API pública (GastoProImporter):
   - parseCSV(text)        → Array de linhas parseadas
   - parseRawText(text)    → Array de linhas parseadas via Regex
   - autoDetectCategory(desc) → String da categoria inferida
   - buildEntry(row, entryType) → Objeto no formato FinanceData.add()
   ================================================================ */

'use strict';

/**
 * @namespace GastoProImporter
 * @description
 * Módulo de importação de extratos bancários.
 * Detecta automaticamente categorias por palavras-chave e gera
 * objetos prontos para serem salvos via FinanceData.add().
 */
const GastoProImporter = (() => {

  const MAX_CSV_CHARS = 1_000_000;
  const MAX_RAW_CHARS = 200_000;
  const MAX_LINE_CHARS = 500;
  const MAX_ROWS = 2000;
  let lastWarnings = [];

  const CATEGORY_RULES = [
    { keys: ['ifood', 'rappi', 'uber eats', 'uber eat', 'delivery', 'mcdonalds', 'mc donalds',
      'burguer', 'burger', 'pizza', 'lanche', 'restaurante', 'padaria', 'pastelaria', 'sushi',
      'starbucks', 'cafe', 'bar', 'boteco', 'churrascaria', 'galeto', 'refeicao', 'alimentacao',
      'hamburgueria', 'lanchonete', 'acai', 'sorveteria', 'confeitaria', 'cafeteria', 'burger king',
      'subway', 'habibs', 'dominos', 'outback', 'ze delivery'],
      category: 'Alimentação' },
    { keys: ['mercado livre', 'mercadolivre'], category: 'Compras' },
    { keys: ['mercado pago', 'mercadopago'], category: 'Outros' },
    { keys: ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'extra', 'walmart',
      'hortifruti', 'sacolao', 'feira', 'minimarket', 'pao de acucar', 'sams club', 'costco',
      'atacarejo', 'makro', 'mercearia', 'acougue', 'emporio', 'bretas'],
      category: 'Mercado' },
    { keys: ['uber', '99pop', '99 pop', 'cabify', 'taxi', 'onibus', 'combustivel', 'gasolina',
      'etanol', 'posto', 'estacionamento', 'pedagio', 'autopass', 'sem parar', 'veloe',
      'bilhete unico', 'ipva', 'oficina', 'mecanica', 'lava jato', 'shell', 'ipiranga',
      'petrobras', 'conectcar'], category: 'Transporte' },
    { keys: ['farmacia', 'drogaria', 'ultrafarma', 'drogaraia', 'raia', 'medico', 'consulta',
      'clinica', 'hospital', 'exame', 'laboratorio', 'plano de saude', 'plano saude', 'amil',
      'sulamerica', 'unimed', 'hapvida', 'bradesco saude', 'porto saude', 'odonto',
      'drogasil', 'pague menos', 'pacheco', 'panvel', 'nissei', 'dentista', 'psicologo',
      'fisioterapia', 'otica'], category: 'Saúde' },
    { keys: ['academia', 'gym', 'smartfit', 'smart fit', 'bioritmo', 'jiu jitsu', 'jiujitsu',
      'crossfit', 'pilates', 'yoga', 'natacao', 'esporte', 'bluefit', 'totalpass', 'gympass',
      'wellhub'], category: 'Esporte' },
    { keys: ['uninter', 'faculdade', 'universidade', 'escola', 'curso', 'alura', 'udemy',
      'coursera', 'mentoria', 'treinamento', 'livro', 'livraria', 'apostila',
      'mensalidade escolar', 'matricula', 'duolingo', 'hotmart', 'kumon', 'senac', 'senai',
      'vestibular'], category: 'Educação' },
    { keys: ['netflix', 'spotify', 'amazon prime', 'youtube', 'disney', 'hbo', 'globoplay',
      'paramount', 'apple tv', 'deezer', 'tidal', 'crunchyroll', 'twitch', 'microsoft 365',
      'office 365', 'adobe', 'canva', 'notion', 'chatgpt', 'assinatura', 'subscription',
      'prime video', 'star+', 'icloud', 'google one', 'google play', 'dropbox', 'github',
      'xbox', 'playstation', 'linkedin'],
      category: 'Assinaturas' },
    { keys: ['contas', 'conta de luz', 'conta de agua', 'conta de telefone', 'conta de internet'],
      category: 'Contas' },
    { keys: ['aluguel', 'condominio', 'energia', 'cemig', 'copel', 'enel', 'agua', 'sabesp',
      'sanepar', 'embasa', 'copasa', 'comgas', 'internet', 'giga', 'algar', 'embratel',
      'telefone', 'iptu', 'imovel', 'reforma', 'neoenergia', 'equatorial', 'energisa',
      'cagece', 'naturgy', 'vivo fibra', 'claro internet', 'claro fatura', 'seguro residencial'],
      category: 'Moradia' },
    { keys: ['emprestimo', 'financiamento', 'credito pessoal', 'cdc'], category: 'Empréstimo' },
    { keys: ['parcelamento', 'parcelado', 'parcelada', 'parcela', 'pcl', 'prestacao'],
      category: 'Parcelamento' },
    { keys: ['cartao', 'fatura', 'sicredi', 'nubank', 'c6', 'neon', 'debito automatico'],
      category: 'Cartão de crédito' },
    { keys: ['vestuario', 'roupa', 'roupas', 'calcado', 'calcados', 'sapato', 'sapatos',
      'tenis', 'shein', 'zara', 'renner', 'riachuelo', 'hering'], category: 'Vestuário' },
    { keys: ['shopee', 'americanas', 'magazine', 'magalu',
      'amazon', 'aliexpress', 'kabum',
      'casas bahia', 'ponto frio', 'fast shop', 'leroy merlin', 'netshoes', 'centauro',
      'decathlon', 'temu'], category: 'Compras' },
    { keys: ['cinema', 'teatro', 'show', 'ingresso', 'evento', 'bilheteria', 'ticketmaster',
      'sympla', 'parque', 'clube', 'viagem', 'hotel', 'airbnb', 'booking', 'passagem',
      'decolar', 'cvc', 'cinemark', 'kinoplex', 'steam', 'pousada'], category: 'Lazer' }
  ];
  const INCOME_CATEGORY_RULES = [
    { keys: ['salario', 'pgto sal', 'folha', 'holerite', 'adiantamento', 'pix recebido',
      'ted recebido', 'doc recebido', 'deposito', 'transferencia recebida', 'receita',
      'rendimento', 'dividendo', 'cashback', 'reembolso', 'estorno'],
      category: 'Receita' }
  ];

  // ================================================================
  // FUNÇÕES PRIVADAS
  // ================================================================

  function normalize(text) {
    return window.GastoProCategories.normalize(text);
  }

  function containsWholeKey(text, key) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
  }

  function autoDetectCategory(desc) {
    if (!desc) return 'Outros';
    const lower = normalize(desc);
    for (const rule of CATEGORY_RULES) {
      if (rule.keys.some(key => containsWholeKey(lower, normalize(key)))) {
        return rule.category;
      }
    }
    return 'Outros';
  }

  function autoDetectIncomeCategory(desc) {
    if (!desc) return null;
    const lower = normalize(desc);
    for (const rule of INCOME_CATEGORY_RULES) {
      if (rule.keys.some(key => containsWholeKey(lower, normalize(key)))) {
        return rule.category;
      }
    }
    return null;
  }

  function normalizeExpenseCategories(rows) {
    rows.forEach(row => {
      if (row.type === 'income' || GastoProCategories.EXPENSE.includes(row.category)) return;
      row.category = autoDetectCategory(row.desc);
    });
    return rows;
  }

  function truncateText(value, maxLength) {
    return String(value == null ? '' : value).slice(0, maxLength);
  }

  function parseMoneySigned(value) {
    if (value == null || value === '') return 0;
    let text = String(value).trim().replace(/R\$\s?/gi, '').replace(/\s/g, '');
    const isNegative = /^\(.*\)$/.test(text) || text.startsWith('-');
    text = text.replace(/[()]/g, '').replace(/^[+-]/, '').replace(/[^\d.,]/g, '');
    if (!text) return 0;

    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma !== -1 && dot !== -1) {
      text = comma > dot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (comma !== -1) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else if ((text.match(/\./g) || []).length > 1) {
      const lastDot = text.lastIndexOf('.');
      text = text.slice(0, lastDot).replace(/\./g, '') + text.slice(lastDot);
    }

    const number = Number(text);
    if (!Number.isFinite(number)) return 0;
    return isNegative ? -number : number;
  }

  function parseMoney(value) {
    return Math.abs(parseMoneySigned(value));
  }

  function validDateParts(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
  }

  function formatIsoDate(year, month, day) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function parseDate(dateValue, today = new Date()) {
    if (!dateValue) return null;
    const text = String(dateValue).trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}(?:[/-]\d{2,4})?)(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (!match) return null;

    const datePart = match[1];
    let year;
    let month;
    let day;
    if (/^\d{4}-/.test(datePart)) {
      [year, month, day] = datePart.split('-').map(Number);
    } else {
      const parts = datePart.split(/[/-]/).map(Number);
      [day, month] = parts;
      year = parts[2] || today.getFullYear();
      if (parts[2] && String(parts[2]).length === 2) year += 2000;
      if (!parts[2]) {
        const tentative = new Date(Date.UTC(year, month - 1, day));
        const currentDate = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        if (tentative - currentDate > 7 * 24 * 60 * 60 * 1000) year--;
      }
    }

    if (!validDateParts(year, month, day)) return null;
    return formatIsoDate(year, month, day);
  }

  function setWarnings(warnings = []) {
    lastWarnings = [...new Set(warnings)];
  }

  function lineIgnored(line) {
    return /\b(?:saldo|total|limite)\b|\bfatura\s+anterior\b/.test(normalize(line));
  }

  function isDateHeader(header) {
    return /^(data|date|dt)(?:\b|$)|data\s+(?:lancamento|movimento|transacao|pgto)/.test(header);
  }

  function findHeader(lines) {
    for (let index = 0; index < Math.min(lines.length, 15); index++) {
      const line = lines[index];
      if (!line || line.length > MAX_LINE_CHARS) continue;
      const separator = line.split(';').length > line.split(',').length ? ';' : ',';
      const headers = splitCSVLine(line, separator).map(cell =>
        normalize(cell.replace(/^"|"$/g, '').trim())
      );
      const hasDate = headers.some(isDateHeader);
      const hasValue = headers.some(header =>
        /^(valor|value|amount|vlr|montante)(?:\b|$)/.test(header) ||
        /^(debito|credito|debit|credit)$/.test(header)
      );
      if (hasDate && hasValue) return { index, separator, headers };
    }
    return null;
  }

  function splitCSVLine(line, sep) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === sep && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function parseCSV(text, today = new Date()) {
    setWarnings();
    if (!text || !text.trim()) return [];
    if (text.length > MAX_CSV_CHARS) {
      setWarnings(['Arquivo CSV excede 1 MB; reduza o arquivo e tente novamente.']);
      return [];
    }

    const lines = text.split(/\r?\n/);
    if (lines.length > MAX_ROWS + 15) {
      setWarnings(['O extrato excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.']);
    }
    const header = findHeader(lines);
    if (!header) return [];

    const headers = header.headers;
    const idxDate = headers.findIndex(isDateHeader);
    const idxDesc = headers.findIndex(name =>
      /^(desc|description|historico|descricao|memo|estabelecimento|lancamento|detalhe)(?:\b|$)/.test(name)
    );
    const idxCategory = headers.findIndex(name => /^(categoria|category)$/.test(name));
    const idxDebit = headers.findIndex(name => /^(debito|debit)$/.test(name));
    const idxCredit = headers.findIndex(name => /^(credito|credit)$/.test(name));
    const idxAmount = headers.findIndex(name =>
      /^(valor|value|amount|vlr|montante)$/.test(name)
    );
    const idxType = headers.findIndex(name => name === 'tipo');
    const idxStartMonth = headers.findIndex(name => name === 'mes_inicio');
    const idxEndMonth = headers.findIndex(name => name === 'mes_fim');
    const idxDueDay = headers.findIndex(name => name === 'dia_venc');
    const idxActive = headers.findIndex(name => name === 'ativo');
    if (idxDebit < 0 && idxCredit < 0 && idxAmount < 0) return [];

    const rows = [];
    const defaultTypeRows = [];
    const warnings = [...lastWarnings];
    let inactiveCount = 0;
    const lastLine = Math.min(lines.length, header.index + 1 + MAX_ROWS);
    for (let index = header.index + 1; index < lastLine; index++) {
      const line = lines[index].trim();
      if (!line) continue;
      if (line.length > MAX_LINE_CHARS) {
        warnings.push('Linhas com mais de 500 caracteres foram ignoradas.');
        continue;
      }
      if (lineIgnored(line)) continue;
      const columns = splitCSVLine(line, header.separator);
      const valueAt = columnIndex => (columns[columnIndex] || '').replace(/^"|"$/g, '').trim();
      const activeValue = idxActive >= 0 ? normalize(valueAt(idxActive)) : '';
      if (['nao', 'false', '0'].includes(activeValue)) {
        inactiveCount++;
        continue;
      }
      const rawDate = valueAt(idxDate);
      const rawDesc = valueAt(idxDesc);
      const explicitType = idxType >= 0 ? normalize(valueAt(idxType)) : '';
      const debit = idxDebit >= 0 ? parseMoney(valueAt(idxDebit)) : 0;
      const credit = idxCredit >= 0 ? parseMoney(valueAt(idxCredit)) : 0;
      const signedAmount = idxDebit >= 0 || idxCredit >= 0
        ? credit - debit
        : parseMoneySigned(valueAt(idxAmount));
      if (!rawDesc && signedAmount === 0) continue;
      const date = parseDate(rawDate, today);
      const rawCategory = idxCategory >= 0 ? valueAt(idxCategory) : '';
      const normalizedCategory = normalize(rawCategory);
      const canonicalCategory = [
        ...GastoProCategories.EXPENSE,
        ...GastoProCategories.INCOME
      ].find(category => normalize(category) === normalizedCategory);
      const defaultCategory = explicitType === 'income' || !explicitType
        ? autoDetectIncomeCategory(rawDesc) || autoDetectCategory(rawDesc)
        : autoDetectCategory(rawDesc);
      const row = {
        date,
        desc: truncateText(rawDesc || 'Lançamento importado', 300),
        amount: Math.abs(signedAmount),
        signedAmount,
        category: truncateText(canonicalCategory || defaultCategory, 100),
        invalid: !date,
        invalidReason: date ? '' : 'Data inválida ou ausente.',
        raw: line
      };
      if (idxType >= 0 && ['income', 'fixed', 'debt', 'variable'].includes(explicitType)) {
        row.type = explicitType;
        if (explicitType === 'fixed' || explicitType === 'debt') {
          const validMonth = value => {
            const match = value.match(/^(\d{4})-(\d{2})$/);
            return match && Number(match[2]) >= 1 && Number(match[2]) <= 12
              ? `${match[1]}-${match[2]}`
              : null;
          };
          const startMonth = validMonth(valueAt(idxStartMonth)) || (date ? date.substring(0, 7) : null);
          const requestedEndMonth = validMonth(valueAt(idxEndMonth));
          const dueDayValue = valueAt(idxDueDay);
          const dueDay = /^\d{1,2}$/.test(dueDayValue) ? Number(dueDayValue) : null;
          row.startMonth = startMonth;
          row.endMonth = requestedEndMonth && startMonth && requestedEndMonth >= startMonth
            ? requestedEndMonth
            : null;
          row.dueDay = dueDay >= 1 && dueDay <= 31 ? dueDay : null;
        }
      } else {
        defaultTypeRows.push(row);
      }
      rows.push(row);
    }
    if (lines.length > lastLine) warnings.push('O extrato excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.');
    if (inactiveCount) warnings.push(`${inactiveCount} linhas inativas foram ignoradas.`);
    applyDefaultTypes(defaultTypeRows);
    applyInstallments(defaultTypeRows);
    const todayString = formatIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    rows.forEach(row => {
      if (row.type !== 'variable' || !row.date || row.date <= todayString) return;
      row.pending = true;
      if (!row.installment) {
        const installment = detectCsvInstallment(row.desc);
        if (installment) {
          row.installment = { current: installment.current, total: installment.total };
          row.installmentBase = installment.baseDesc;
        }
      }
    });
    setWarnings(warnings);
    return normalizeExpenseCategories(rows);
  }

  // ================================================================
  // PARSER DE TEXTO BRUTO
  // ================================================================

  function applyDefaultTypes(rows) {
    const hasNegative = rows.some(row => row.signedAmount < 0);
    const hasPositive = rows.some(row => row.signedAmount > 0);
    const mixedSigns = hasNegative && hasPositive;
    rows.forEach(row => {
      row.type = row.category === 'Receita' ||
        (mixedSigns && row.signedAmount > 0) ? 'income' : 'variable';
    });
  }

  function applyInstallments(rows) {
    rows.forEach(row => {
      if (row.type === 'income') return;
      const installment = detectInstallment(row.desc);
      if (!installment) return;
      row.installment = { current: installment.current, total: installment.total };
      row.installmentBase = installment.baseDesc;
    });
  }

  function shiftMonth(ym, delta) {
    const [year, month] = ym.split('-').map(Number);
    const monthIndex = year * 12 + month - 1 + delta;
    const nextYear = Math.floor(monthIndex / 12);
    const nextMonth = ((monthIndex % 12) + 12) % 12 + 1;
    return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
  }

  function detectInstallment(desc) {
    if (!desc) return null;
    const match = desc.match(
      /\b(?:parc(?:ela)?|pcl|prest|cota)\b\s*(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\b|\((\d{1,3})\s*\/\s*(\d{1,3})\)/i
    );
    if (!match) return null;
    const current = Number(match[1] || match[3]);
    const total = Number(match[2] || match[4]);
    if (current < 1 || current > total || total < 2 || total > 360) return null;
    return {
      current,
      total,
      baseDesc: (desc.slice(0, match.index) + desc.slice(match.index + match[0].length)).trim()
    };
  }

  function detectCsvInstallment(desc) {
    const existing = detectInstallment(desc);
    if (existing || !desc) return existing;
    const match = String(desc).match(/\b(\d{1,3})\s+de\s+(\d{1,3})\b/i);
    if (!match) return null;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (current < 1 || current > total || total < 2 || total > 360) return null;
    return {
      current,
      total,
      baseDesc: (String(desc).slice(0, match.index) + String(desc).slice(match.index + match[0].length)).trim()
    };
  }

  function matchDebtTemplate(row, templates) {
    if (!row.date || !row.installmentBase) return null;
    const month = row.date.substring(0, 7);
    return templates.find(tpl =>
      tpl.isDebt === true &&
      normalize(tpl.desc) === normalize(row.installmentBase) &&
      Math.abs(Number(tpl.amount) - Number(row.amount)) <= Number(row.amount) * 0.1 &&
      month >= tpl.startMonth &&
      (!tpl.endMonth || month <= tpl.endMonth)
    ) || null;
  }

  function buildInstallmentDebt(row, category) {
    const month = row.date.substring(0, 7);
    const startMonth = shiftMonth(month, -(row.installment.current - 1));
    const paidMonths = {};
    for (let offset = 0; offset < row.installment.current; offset++) {
      paidMonths[shiftMonth(startMonth, offset)] = true;
    }
    return {
      type: 'debt',
      desc: row.installmentBase,
      amount: row.amount,
      category,
      startMonth,
      endMonth: shiftMonth(startMonth, row.installment.total - 1),
      date: `${startMonth}-${row.date.substring(8, 10)}`,
      paidMonths
    };
  }

  function decodeBytes(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  function groupTextItemsIntoLines(items) {
    const lines = [];
    for (const item of items) {
      if (!item || typeof item.str !== 'string' || !item.transform ||
          !Number.isFinite(item.transform[4]) || !Number.isFinite(item.transform[5])) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let line = lines.find(candidate => Math.abs(candidate.y - y) <= 3);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, str: item.str });
    }
    return lines
      .sort((left, right) => right.y - left.y)
      .map(line => line.items
        .sort((left, right) => left.x - right.x)
        .map(item => item.str)
        .join(' '));
  }

  let pdfJsModulePromise;
  function loadPdfJs() {
    if (!pdfJsModulePromise) {
      pdfJsModulePromise = import(new URL('./js/vendor/pdf.mjs', document.baseURI).href)
        .then(pdfjsLib => {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            new URL('./js/vendor/pdf.worker.mjs', document.baseURI).href;
          return pdfjsLib;
        })
        .catch(error => {
          pdfJsModulePromise = null;
          throw error;
        });
    }
    return pdfJsModulePromise;
  }

  async function extractPdfText(file) {
    let loadingTask;
    setWarnings();
    try {
      const pdfjsLib = await loadPdfJs();
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
      const pdf = await loadingTask.promise;
      if (pdf.numPages > 30) {
        setWarnings(['O PDF excede o limite de 30 páginas.']);
        return null;
      }

      let text = '';
      let truncated = false;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = groupTextItemsIntoLines(content.items).join('\n');
        const separator = pageNumber > 1 ? '\n' : '';
        const remaining = MAX_RAW_CHARS - text.length - separator.length;
        if (pageText.length > remaining) {
          text += separator + pageText.slice(0, Math.max(0, remaining));
          truncated = true;
          break;
        }
        text += separator + pageText;
      }
      if (truncated) setWarnings(['O texto do PDF excede 200.000 caracteres e foi truncado.']);
      if (text.trim().length < 20) {
        setWarnings([...getLastWarnings(), 'PDF sem texto selecionável (escaneado). Use OFX/CSV ou cole o texto.']);
        return null;
      }
      return text;
    } catch (error) {
      console.error('[GastoPro Importer] Erro ao ler PDF:', error);
      setWarnings(error && error.name === 'PasswordException'
        ? ['PDF protegido por senha não é suportado.']
        : ['Não foi possível ler o PDF. Verifique se o arquivo é válido.']);
      return null;
    } finally {
      if (loadingTask) {
        try {
          await loadingTask.destroy();
        } catch (error) {
          console.warn('[GastoPro Importer] Erro ao liberar o PDF:', error);
        }
      }
    }
  }

  async function parseFile(file, today = new Date()) {
    const extensionMatch = file.name.toLowerCase().match(/\.[^.]+$/);
    const extension = extensionMatch ? extensionMatch[0] : '';
    if (!['.csv', '.txt', '.ofx', '.xml', '.pdf'].includes(extension)) {
      setWarnings(['Formato de arquivo não suportado.']);
      return [];
    }
    if (extension === '.pdf') {
      if (file.size > 10_000_000) {
        setWarnings(['O PDF excede 10 MB.']);
        return [];
      }
      const extractedText = await extractPdfText(file);
      if (extractedText === null) return [];
      const pdfWarnings = getLastWarnings();
      const rows = parseRawText(extractedText);
      setWarnings([...pdfWarnings, ...getLastWarnings()]);
      return rows;
    }
    if (file.size > MAX_CSV_CHARS) {
      setWarnings(['O arquivo excede 1 MB; reduza o arquivo e tente novamente.']);
      return [];
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text;
    if (extension === '.ofx' &&
        /CHARSET:1252/i.test(new TextDecoder('windows-1252').decode(bytes.slice(0, 500)))) {
      text = new TextDecoder('windows-1252').decode(bytes);
    } else {
      text = decodeBytes(bytes);
    }
    if (extension === '.csv' || extension === '.txt') return parseCSV(text, today);
    if (extension === '.ofx') return parseOFX(text);
    if (extension === '.xml') return parseNFeXML(text);
    return [];
  }

  function parseOFX(text) {
    setWarnings();
    if (text.length > MAX_CSV_CHARS) {
      setWarnings(['O extrato OFX excede 1 MB; reduza o arquivo e tente novamente.']);
      return [];
    }
    const warnings = [];
    const rows = [];
    const blocks = [...text.matchAll(/<STMTTRN\b([\s\S]*?)(?=<\/STMTTRN\b|<STMTTRN\b|<\/BANKTRANLIST\b|$)(?:<\/STMTTRN\b[^>]*>)?/gi)];
    if (blocks.length === 0) {
      setWarnings(['Nenhuma transação encontrada no arquivo OFX.']);
      return [];
    }
    const getField = (block, tag) => {
      const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
      return match ? match[1].trim() : '';
    };
    const decodeDescription = value => value.replace(/&(amp|lt|gt|quot|apos);/g, entity => ({
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'"
    })[entity]);
    const defaultTypeRows = [];

    blocks.slice(0, MAX_ROWS).forEach(match => {
      const block = `<STMTTRN${match[1]}`;
      const rawDate = getField(block, 'DTPOSTED').match(/^\d{8}/);
      const year = rawDate ? Number(rawDate[0].slice(0, 4)) : 0;
      const month = rawDate ? Number(rawDate[0].slice(4, 6)) : 0;
      const day = rawDate ? Number(rawDate[0].slice(6, 8)) : 0;
      const date = rawDate && validDateParts(year, month, day)
        ? formatIsoDate(year, month, day)
        : null;
      const signedAmount = parseMoneySigned(getField(block, 'TRNAMT'));
      const memo = getField(block, 'MEMO');
      const originalDesc = decodeDescription(memo || getField(block, 'NAME'));
      const desc = truncateText(originalDesc || 'Lançamento importado', 300);
      const row = {
        date,
        desc,
        amount: Math.abs(signedAmount),
        signedAmount,
        category: truncateText(autoDetectIncomeCategory(originalDesc) ||
          autoDetectCategory(originalDesc), 100),
        invalid: !date,
        invalidReason: date ? '' : 'Data inválida ou ausente.',
        raw: truncateText(match[0].trim(), MAX_LINE_CHARS)
      };
      const transactionType = getField(block, 'TRNTYPE').toUpperCase();
      if (['CREDIT', 'DEP', 'DIRECTDEP', 'INT', 'DIV'].includes(transactionType)) {
        row.type = 'income';
      } else if (['DEBIT', 'PAYMENT', 'CHECK', 'ATM', 'FEE', 'SRVCHG', 'POS', 'CASH',
        'REPEATPMT', 'DIRECTDEBIT'].includes(transactionType)) {
        row.type = 'variable';
      } else {
        defaultTypeRows.push(row);
      }
      rows.push(row);
    });
    if (blocks.length > MAX_ROWS) {
      warnings.push('O extrato excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.');
    }
    applyDefaultTypes(defaultTypeRows);
    applyInstallments(rows);
    setWarnings(warnings);
    return normalizeExpenseCategories(rows);
  }

  function parseNFeXML(text) {
    setWarnings();
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
      setWarnings(['XML inválido.']);
      return [];
    }
    const document = new DOMParser().parseFromString(text, 'application/xml');
    if (document.getElementsByTagName('parsererror').length) {
      setWarnings(['XML inválido.']);
      return [];
    }
    const rootName = (document.documentElement.localName || document.documentElement.nodeName)
      .split(':').pop().toLowerCase();
    if (!['nfeproc', 'nfe', 'infnfe'].includes(rootName)) {
      setWarnings(['XML não reconhecido como nota fiscal.']);
      return [];
    }
    const elements = (parent, name) => Array.from(parent.getElementsByTagNameNS('*', name));
    const firstText = (parent, name) => {
      const element = elements(parent, name)[0];
      return element ? element.textContent.trim() : '';
    };
    const emit = elements(document, 'emit')[0];
    const infNFe = rootName === 'infnfe'
      ? document.documentElement
      : elements(document, 'infNFe')[0] || document.documentElement;
    const dateText = firstText(infNFe, 'dhEmi') || firstText(infNFe, 'dEmi');
    const datePart = dateText.substring(0, 10);
    const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = dateMatch && validDateParts(
      Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])
    ) ? datePart : null;
    const emitente = emit ? firstText(emit, 'xNome') : '';
    const number = firstText(infNFe, 'nNF');
    const icmsTot = elements(infNFe, 'ICMSTot')[0];
    const totalText = icmsTot ? firstText(icmsTot, 'vNF') : firstText(infNFe, 'vNF');
    const amount = totalText ? parseMoney(totalText) : 0;
    const products = elements(infNFe, 'xProd').slice(0, 3).map(item => item.textContent.trim());
    const desc = truncateText(`${emitente} — NF ${number}`, 300);
    const invalid = !date || !totalText;
    return [{
      date,
      desc,
      amount,
      signedAmount: -amount,
      category: truncateText(autoDetectCategory(`${emitente} ${products.join(' ')}`), 100),
      type: 'variable',
      invalid,
      invalidReason: invalid ? 'Data de emissão ou valor total ausente ou inválido.' : '',
      raw: truncateText(text, MAX_LINE_CHARS)
    }];
  }

  function parseRawText(text) {
    setWarnings();
    if (!text || !text.trim()) return [];
    if (text.length > MAX_RAW_CHARS) {
      setWarnings(['O texto colado excede 200.000 caracteres.']);
      return [];
    }

    const trimmedText = text.trim();
    if (trimmedText.startsWith('000201') && trimmedText.toUpperCase().includes('BR.GOV.BCB.PIX')) {
      return parsePixPayload(trimmedText);
    }
    const boletoDigits = text.replace(/[\s.-]/g, '');
    if (/^\d{47,48}$/.test(boletoDigits)) return parseBoletoLine(boletoDigits);

    const lines = text.split(/\r?\n/);
    const result = [];
    const warnings = [];
    const amountPattern = '([+-]?\\s*(?:R\\$\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:[,.]\\d{1,2})?)';
    const datePattern = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}[/-]\\d{2}(?:[/-]\\d{2,4})?(?:\\s+\\d{1,2}:\\d{2})?)';
    const startDate = new RegExp(`^${datePattern}\\s+(.+?)\\s+${amountPattern}$`);
    const endDate = new RegExp(`^${amountPattern}\\s+(.+?)\\s+${datePattern}$`);
    const noDate = new RegExp(`^(.+?)\\s+${amountPattern}$`);

    for (const originalLine of lines.slice(0, MAX_ROWS)) {
      const line = originalLine.trim();
      if (!line) continue;
      if (line.length > MAX_LINE_CHARS) {
        warnings.push('Linhas com mais de 500 caracteres foram ignoradas.');
        continue;
      }
      if (lineIgnored(line)) continue;
      let match = line.match(startDate);
      let dateText;
      let desc;
      let signedAmount;
      if (match) {
        [, dateText, desc, signedAmount] = match;
        signedAmount = parseMoneySigned(signedAmount);
      } else {
        match = line.match(endDate);
        if (match) {
          [, signedAmount, desc, dateText] = match;
          signedAmount = parseMoneySigned(signedAmount);
        } else {
          match = line.match(noDate);
          if (!match) continue;
          [, desc, signedAmount] = match;
          signedAmount = parseMoneySigned(signedAmount);
          dateText = '';
        }
      }
      const date = parseDate(dateText);
      result.push({
        date,
        desc: truncateText(desc.trim(), 300),
        amount: Math.abs(signedAmount),
        signedAmount,
        category: truncateText(autoDetectIncomeCategory(desc) || autoDetectCategory(desc), 100),
        invalid: !date,
        invalidReason: date ? '' : 'Data inválida ou ausente.',
        raw: line
      });
    }
    if (lines.length > MAX_ROWS) warnings.push('O texto excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.');
    applyDefaultTypes(result);
    applyInstallments(result);
    setWarnings(warnings);
    return normalizeExpenseCategories(result);
  }

  function parsePixPayload(payload, today = new Date()) {
    setWarnings();
    let offset = 0;
    let crcOffset = -1;
    const fields = {};
    while (offset < payload.length) {
      if (offset + 4 > payload.length) {
        setWarnings(['Código Pix inválido.']);
        return [];
      }
      const id = payload.slice(offset, offset + 2);
      const lengthText = payload.slice(offset + 2, offset + 4);
      if (!/^\d{2}$/.test(lengthText)) {
        setWarnings(['Código Pix inválido.']);
        return [];
      }
      const valueStart = offset + 4;
      const valueEnd = valueStart + Number(lengthText);
      if (valueEnd > payload.length) {
        setWarnings(['Código Pix inválido.']);
        return [];
      }
      fields[id] = payload.slice(valueStart, valueEnd);
      if (id === '63') crcOffset = offset;
      offset = valueEnd;
    }

    if (crcOffset < 0 || fields['63'].length !== 4) {
      setWarnings(['Código Pix com CRC inválido.']);
      return [];
    }
    let crc = 0xFFFF;
    const crcInput = payload.slice(0, crcOffset + 4);
    for (let index = 0; index < crcInput.length; index++) {
      crc ^= crcInput.charCodeAt(index) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    if (crc.toString(16).toUpperCase().padStart(4, '0') !== fields['63'].toUpperCase()) {
      setWarnings(['Código Pix com CRC inválido.']);
      return [];
    }

    const amount = fields['54'] ? parseMoney(fields['54']) : 0;
    const desc = truncateText(fields['59'] || 'Pagamento Pix', 300);
    const date = formatIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const invalid = !fields['54'] || amount === 0;
    return [{
      date,
      desc,
      amount,
      signedAmount: -amount,
      category: autoDetectCategory(desc),
      type: 'variable',
      invalid,
      invalidReason: invalid ? 'Pix sem valor definido' : '',
      raw: truncateText(payload, MAX_LINE_CHARS)
    }];
  }

  function parseBoletoLine(digits, today = new Date()) {
    setWarnings();
    if (typeof digits !== 'string' || !/^\d+$/.test(digits) || ![47, 48].includes(digits.length)) {
      setWarnings(['Linha digitável inválida.']);
      return [];
    }
    const localDate = formatIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    let date = localDate;
    let desc;
    let amount;
    let invalidReason = '';

    if (digits.length === 47) {
      const factor = Number(digits.slice(33, 37));
      amount = Number(digits.slice(37, 47)) / 100;
      desc = `Boleto banco ${digits.slice(0, 3)}`;
      if (factor !== 0) {
        const baseDate = Date.UTC(1997, 9, 7);
        const candidates = [new Date(baseDate + factor * 86400000)];
        if (factor >= 1000) {
          candidates.push(new Date(Date.UTC(2025, 1, 22) + (factor - 1000) * 86400000));
        }
        const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const nearest = candidates.reduce((selected, candidate) =>
          Math.abs(candidate.getTime() - todayUtc) < Math.abs(selected.getTime() - todayUtc)
            ? candidate : selected
        );
        date = formatIsoDate(nearest.getUTCFullYear(), nearest.getUTCMonth() + 1, nearest.getUTCDate());
      }
      if (amount === 0) invalidReason = 'Boleto sem valor';
    } else {
      if (!digits.startsWith('8')) {
        setWarnings(['Linha digitável inválida.']);
        return [];
      }
      const checkDigitPositions = new Set([11, 23, 35, 47]);
      let codigo = '';
      for (let index = 0; index < digits.length; index++) {
        if (!checkDigitPositions.has(index)) codigo += digits[index];
      }
      desc = 'Guia de convênio/arrecadação';
      if (codigo[2] === '6' || codigo[2] === '8') {
        amount = Number(codigo.slice(4, 15)) / 100;
      } else {
        amount = 0;
        invalidReason = 'Valor não informado no código';
      }
    }

    return [{
      date,
      desc,
      amount,
      signedAmount: -amount,
      category: autoDetectCategory(desc),
      type: 'variable',
      invalid: Boolean(invalidReason),
      invalidReason,
      raw: truncateText(digits, MAX_LINE_CHARS),
      pending: true
    }];
  }

  function isTemplateDuplicate(row, templates) {
    return templates.some(template =>
      normalize(template.desc) === normalize(row.desc) &&
      Math.abs(Math.round(Number(template.amount) * 100) - Math.round(Number(row.amount) * 100)) <= 1 &&
      template.startMonth === row.startMonth
    );
  }

  function markDuplicates(rows, existingItems = []) {
    const makeKey = item => {
      if (item.invalid || !item.date || !Number.isFinite(Number(item.amount))) return null;
      return `${item.date}|${Number(item.amount)}|${normalize(item.desc)}`;
    };
    const seen = new Set(existingItems.map(makeKey).filter(Boolean));
    return rows.map(row => {
      const key = makeKey(row);
      const duplicate = Boolean(key && seen.has(key));
      return { ...row, duplicate, selected: !row.invalid && !duplicate };
    });
  }

  function getLastWarnings() {
    return [...lastWarnings];
  }

  // ================================================================
  // CONSTRUTOR DE ENTRY
  // ================================================================

  function buildEntry(row, entryType, paid = true) {
    const type = entryType || 'variable';
    const fallbackMonth = row.date ? row.date.substring(0, 7) :
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (type === 'fixed' || type === 'debt') {
      const startMonth = row.startMonth || fallbackMonth;
      return {
        type,
        desc: truncateText(row.desc, 300),
        amount: row.amount,
        category: truncateText(row.category, 100),
        date: row.dueDay ? `${startMonth}-${String(row.dueDay).padStart(2, '0')}` : row.date,
        month: startMonth,
        startMonth,
        endMonth: row.endMonth || null
      };
    }
    return {
      type:     type,
      desc:     truncateText(row.desc, 300),
      amount:   row.amount,
      category: truncateText(row.category, 100),
      date:     row.date,
      month:    fallbackMonth,
      paid
    };
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================
  return {
    parseCSV, parseRawText, parseOFX, parsePixPayload, parseBoletoLine, groupTextItemsIntoLines,
    autoDetectCategory, buildEntry, parseMoney, parseMoneySigned,
    parseDate, markDuplicates, isTemplateDuplicate, getLastWarnings, shiftMonth, detectInstallment, detectCsvInstallment, matchDebtTemplate,
    buildInstallmentDebt, parseFile
  };

})();

window.GastoProImporter = GastoProImporter;
