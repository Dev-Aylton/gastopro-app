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
      'starbucks', 'cafe', 'bar', 'boteco', 'churrascaria', 'galeto', 'refeicao', 'alimentacao'],
      category: 'Alimentação' },
    { keys: ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'extra', 'walmart',
      'hortifruti', 'sacolao', 'feira', 'minimarket', 'pao de acucar', 'sams club', 'costco'],
      category: 'Mercado' },
    { keys: ['uber', '99pop', '99 pop', 'cabify', 'taxi', 'onibus', 'combustivel', 'gasolina',
      'etanol', 'posto', 'estacionamento', 'pedagio', 'autopass', 'sem parar', 'veloe',
      'bilhete unico'], category: 'Transporte' },
    { keys: ['farmacia', 'drogaria', 'ultrafarma', 'drogaraia', 'raia', 'medico', 'consulta',
      'clinica', 'hospital', 'exame', 'laboratorio', 'plano de saude', 'plano saude', 'amil',
      'sulamerica', 'unimed', 'hapvida', 'bradesco saude', 'porto saude', 'odonto'], category: 'Saúde' },
    { keys: ['academia', 'gym', 'smartfit', 'smart fit', 'bioritmo', 'jiu jitsu', 'jiujitsu',
      'crossfit', 'pilates', 'yoga', 'natacao', 'esporte'], category: 'Esporte' },
    { keys: ['uninter', 'faculdade', 'universidade', 'escola', 'curso', 'alura', 'udemy',
      'coursera', 'mentoria', 'treinamento', 'livro', 'livraria', 'apostila',
      'mensalidade escolar', 'matricula'], category: 'Educação' },
    { keys: ['netflix', 'spotify', 'amazon prime', 'youtube', 'disney', 'hbo', 'globoplay',
      'paramount', 'apple tv', 'deezer', 'tidal', 'crunchyroll', 'twitch', 'microsoft 365',
      'office 365', 'adobe', 'canva', 'notion', 'chatgpt', 'assinatura', 'subscription'],
      category: 'Assinaturas' },
    { keys: ['aluguel', 'condominio', 'energia', 'cemig', 'copel', 'enel', 'agua', 'sabesp',
      'sanepar', 'embasa', 'copasa', 'comgas', 'internet', 'giga', 'algar', 'embratel',
      'telefone', 'iptu', 'imovel', 'reforma'], category: 'Moradia' },
    { keys: ['cartao', 'fatura', 'financiamento', 'parcela', 'emprestimo', 'cdc', 'sicredi',
      'nubank', 'c6', 'neon', 'debito automatico'], category: 'Cartão de crédito' },
    { keys: ['shopee', 'mercado livre', 'mercadolivre', 'americanas', 'magazine', 'magalu',
      'amazon', 'aliexpress', 'shein', 'zara', 'renner', 'riachuelo', 'hering'], category: 'Compras' },
    { keys: ['salario', 'pgto sal', 'folha', 'holerite', 'adiantamento', 'pix recebido',
      'ted recebido', 'doc recebido', 'deposito', 'transferencia recebida', 'receita'],
      category: 'Receita' },
    { keys: ['cinema', 'teatro', 'show', 'ingresso', 'evento', 'bilheteria', 'ticketmaster',
      'sympla', 'parque', 'clube', 'viagem', 'hotel', 'airbnb', 'booking', 'passagem',
      'decolar', 'cvc'], category: 'Lazer' }
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

  function parseCSV(text) {
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
    const idxDebit = headers.findIndex(name => /^(debito|debit)$/.test(name));
    const idxCredit = headers.findIndex(name => /^(credito|credit)$/.test(name));
    const idxAmount = headers.findIndex(name =>
      /^(valor|value|amount|vlr|montante)$/.test(name)
    );
    if (idxDebit < 0 && idxCredit < 0 && idxAmount < 0) return [];

    const rows = [];
    const warnings = [...lastWarnings];
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
      const rawDate = valueAt(idxDate);
      const rawDesc = valueAt(idxDesc);
      const debit = idxDebit >= 0 ? parseMoney(valueAt(idxDebit)) : 0;
      const credit = idxCredit >= 0 ? parseMoney(valueAt(idxCredit)) : 0;
      const signedAmount = idxDebit >= 0 || idxCredit >= 0
        ? credit - debit
        : parseMoneySigned(valueAt(idxAmount));
      if (!rawDesc && signedAmount === 0) continue;
      const date = parseDate(rawDate);
      rows.push({
        date,
        desc: truncateText(rawDesc || 'Lançamento importado', 300),
        amount: Math.abs(signedAmount),
        signedAmount,
        category: truncateText(autoDetectCategory(rawDesc), 100),
        invalid: !date,
        invalidReason: date ? '' : 'Data inválida ou ausente.',
        raw: line
      });
    }
    if (lines.length > lastLine) warnings.push('O extrato excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.');
    applyDefaultTypes(rows);
    setWarnings(warnings);
    return rows;
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

  function parseRawText(text) {
    setWarnings();
    if (!text || !text.trim()) return [];
    if (text.length > MAX_RAW_CHARS) {
      setWarnings(['O texto colado excede 200.000 caracteres.']);
      return [];
    }

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
        category: truncateText(autoDetectCategory(desc), 100),
        invalid: !date,
        invalidReason: date ? '' : 'Data inválida ou ausente.',
        raw: line
      });
    }
    if (lines.length > MAX_ROWS) warnings.push('O texto excede o limite de 2.000 linhas; as linhas excedentes foram ignoradas.');
    applyDefaultTypes(result);
    setWarnings(warnings);
    return result;
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
      if (key) seen.add(key);
      return { ...row, duplicate, selected: !row.invalid && !duplicate };
    });
  }

  function getLastWarnings() {
    return [...lastWarnings];
  }

  // ================================================================
  // CONSTRUTOR DE ENTRY
  // ================================================================

  function buildEntry(row, entryType) {
    const type = entryType || 'variable';
    const month = row.date ? row.date.substring(0, 7) :
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return {
      type:     type,
      desc:     truncateText(row.desc, 300),
      amount:   row.amount,
      category: truncateText(row.category, 100),
      date:     row.date,
      month:    month,
      paid:     true
    };
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================
  return {
    parseCSV, parseRawText, autoDetectCategory, buildEntry, parseMoney, parseMoneySigned,
    parseDate, markDuplicates, getLastWarnings
  };

})();

window.GastoProImporter = GastoProImporter;
