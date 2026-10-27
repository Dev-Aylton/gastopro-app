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

  // ================================================================
  // MAPA DE CATEGORIZAÇÃO AUTOMÁTICA
  // Dicionário de palavras-chave → categoria.
  // A busca é case-insensitive e parcial (includes).
  // ================================================================

  /** @type {Array<{keys: string[], category: string}>} */
  const CATEGORY_RULES = [
    // Alimentação
    { keys: ['ifood', 'rappi', 'uber eat', 'delivery', 'mcdonalds', 'mc donalds', 'burguer', 'burger',
             'pizza', 'lanche', 'restaurante', 'rest.', 'padaria', 'pastelaria', 'sushi',
             'starbucks', 'cafe', 'café', 'bar ', 'boteco', 'churrascaria', 'galeto', 'refeicao',
             'refeição', 'alimentacao', 'alimentação'], category: 'Alimentação' },

    // Mercado / Supermercado
    { keys: ['mercado', 'supermercado', 'atacadao', 'atacadão', 'assai', 'assaí', 'carrefour',
             'extra', 'walmart', 'big', 'hortifruti', 'sacolão', 'sacolao', 'feira', 'minimarket',
             'pao de acucar', 'pão de açúcar', 'sams club', 'costco'], category: 'Mercado' },

    // Transporte
    { keys: ['uber', '99pop', '99 pop', 'cabify', 'taxi', 'táxi', 'onibus', 'ônibus',
             'metrô', 'metro', 'combustivel', 'combustível', 'gasolina', 'etanol',
             'posto ', 'estacionamento', 'pedagio', 'pedágio', 'autopass', 'sem parar',
             'veloe', 'bilhete único', 'bilhete unico'], category: 'Transporte' },

    // Saúde
    { keys: ['farmacia', 'farmácia', 'drogaria', 'droga', 'ultrafarma', 'drogaraia', 'raia',
             'medico', 'médico', 'consulta', 'clinica', 'clínica', 'hospital', 'exame',
             'laboratorio', 'laboratório', 'plano de saude', 'plano saude', 'amil', 'sulamerica',
             'unimed', 'hapvida', 'bradesco saude', 'porto saude', 'odonto'], category: 'Saúde' },

    // Esporte / Lazer
    { keys: ['academia', 'gym', 'smartfit', 'smart fit', 'bioritmo', 'jiu jitsu', 'jiujitsu',
             'crossfit', 'pilates', 'yoga', 'natacao', 'natação', 'esporte'], category: 'Esporte' },

    // Educação
    { keys: ['uninter', 'faculdade', 'universidade', 'escola', 'curso', 'alura', 'udemy',
             'coursera', 'mentoria', 'treinamento', 'livro', 'livraria', 'apostila',
             'mensalidade escolar', 'matricula', 'matrícula'], category: 'Educação' },

    // Streaming / Assinaturas
    { keys: ['netflix', 'spotify', 'amazon prime', 'youtube', 'disney', 'hbo', 'globoplay',
             'paramount', 'apple tv', 'deezer', 'tidal', 'crunchyroll', 'twitch',
             'microsoft 365', 'office 365', 'adobe', 'canva', 'notion', 'chatgpt',
             'assinatura', 'subscription'], category: 'Assinaturas' },

    // Moradia / Casa
    { keys: ['aluguel', 'condominio', 'condomínio', 'energia', 'light', 'cemig', 'copel',
             'enel', 'agua', 'água', 'sabesp', 'sanepar', 'embasa', 'copasa', 'gas ', 'gás ',
             'comgas', 'internet', 'tim ', 'vivo', 'claro', 'oi ', 'net ',
             'giga', 'algar', 'embratel', 'telefone', 'iptu', 'imovel',
             'imóvel', 'reforma'], category: 'Moradia' },

    // Cartão de Crédito / Financeiro
    { keys: ['cartao', 'cartão', 'fatura', 'financiamento', 'parcela', 'emprestimo', 'empréstimo',
             'cdc', 'sicredi', 'nubank', 'inter', 'c6', 'neon', 'debito automatico',
             'débito automático'], category: 'Cartão de crédito' },

    // Compras Online / E-commerce
    { keys: ['shopee', 'mercado livre', 'mercadolivre', 'americanas', 'magazine', 'magalu',
             'amazon', 'aliexpress', 'shein', 'zara', 'renner', 'riachuelo',
             'hering', 'loja', 'produto'], category: 'Compras' },

    // Salário / Receita
    { keys: ['salario', 'salário', 'pgto sal', 'folha', 'holerite',
             'adiantamento', 'pix recebido', 'ted recebido', 'doc recebido', 'deposito',
             'depósito', 'transferencia recebida', 'receita'], category: 'Receita' },

    // Lazer / Entretenimento
    { keys: ['cinema', 'teatro', 'show', 'ingresso', 'evento', 'bilheteria', 'ticketmaster',
             'ingresso.com', 'sympla', 'parque', 'clube', 'viagem', 'hotel', 'airbnb',
             'booking', 'passagem', 'decolar', 'cvc'], category: 'Lazer' },
  ];

  // ================================================================
  // FUNÇÕES PRIVADAS
  // ================================================================

  function autoDetectCategory(desc) {
    if (!desc) return 'Outros';
    const lower = String(desc).toLowerCase();
    for (const rule of CATEGORY_RULES) {
      if (rule.keys.some(k => lower.includes(k))) {
        return rule.category;
      }
    }
    return 'Outros';
  }

  function parseMoney(val) {
    if (!val) return 0;
    let s = String(val).trim();
    s = s.replace(/R\$\s?/g, '').trim();
    if (/\d+\.\d{3},\d{2}$/.test(s) || /\d+,\d{2}$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    s = s.replace(/[^\d.\-]/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? 0 : Math.abs(num);
  }

  function parseDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const brMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})$/);
    if (brMatch) {
      let [, d, m, y] = brMatch;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    }
    return new Date().toISOString().split('T')[0];
  }

  // ================================================================
  // PARSER CSV
  // ================================================================

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
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const header = lines[0];
    const sep = (header.split(';').length > header.split(',').length) ? ';' : ',';
    const headers = header.split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const idxDate = headers.findIndex(h =>
      ['data', 'date', 'dt', 'data lançamento', 'data lancamento', 'data movimento',
       'data transação', 'data transacao', 'data pgto'].some(k => h.includes(k))
    );
    const idxDesc = headers.findIndex(h =>
      ['desc', 'histórico', 'historico', 'descricao', 'descrição', 'memo',
       'estabelecimento', 'lançamento', 'lancamento', 'detalhe'].some(k => h.includes(k))
    );
    const idxAmount = headers.findIndex(h =>
      ['valor', 'value', 'amount', 'vlr', 'debito', 'débito', 'credit', 'crédito',
       'val', 'montante'].some(k => h.includes(k))
    );

    const colDate   = idxDate   >= 0 ? idxDate   : 0;
    const colDesc   = idxDesc   >= 0 ? idxDesc   : 1;
    const colAmount = idxAmount >= 0 ? idxAmount : 2;

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = splitCSVLine(line, sep);
      if (cols.length < 2) continue;

      const rawDate   = (cols[colDate]   || '').replace(/^"|"$/g, '').trim();
      const rawDesc   = (cols[colDesc]   || '').replace(/^"|"$/g, '').trim();
      const rawAmount = (cols[colAmount] || '').replace(/^"|"$/g, '').trim();

      const amount = parseMoney(rawAmount);
      if (!rawDesc && amount === 0) continue;

      result.push({
        date:     parseDate(rawDate),
        desc:     rawDesc || 'Lançamento importado',
        amount:   amount,
        category: autoDetectCategory(rawDesc),
        raw:      line
      });
    }
    return result;
  }

  // ================================================================
  // PARSER DE TEXTO BRUTO
  // ================================================================

  function parseRawText(text) {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/);
    const result = [];

    const patterns = [
      // Data no início: "15/10/2026 iFood *RESTAURANTE R$ 45,90"
      /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+R?\$?\s*([\-]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)$/i,
      // Data no início sem ano: "15/10 iFood 45,90"
      /^(\d{2}\/\d{2})\s+(.+?)\s+([\-]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)$/i,
      // Valor no início: "- R$ 45,90 iFood 15/10/2026"
      /^[\-\+]?\s*R?\$?\s*([\-]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s+(.+?)\s+(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})$/i,
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;

      let matched = false;
      for (let pi = 0; pi < patterns.length; pi++) {
        const m = trimmed.match(patterns[pi]);
        if (!m) continue;

        let dateStr, desc, amtStr;
        if (pi === 2) {
          [, amtStr, desc, dateStr] = m;
        } else {
          [, dateStr, desc, amtStr] = m;
        }

        if (dateStr && !dateStr.match(/\d{4}/)) {
          dateStr = `${dateStr}/${new Date().getFullYear()}`;
        }

        const amount = parseMoney(amtStr);
        if (!desc && amount === 0) continue;

        result.push({
          date:     parseDate(dateStr || ''),
          desc:     (desc || 'Lançamento importado').trim(),
          amount:   amount,
          category: autoDetectCategory(desc),
          raw:      trimmed
        });
        matched = true;
        break;
      }

      if (!matched) {
        const amtMatch = trimmed.match(/([\-]?\d{1,3}(?:\.\d{3})*,\d{2})/);
        if (amtMatch) {
          const amount = parseMoney(amtMatch[1]);
          const desc = trimmed.replace(amtMatch[0], '').replace(/R\$\s?/, '').trim();
          if (desc && amount > 0) {
            result.push({
              date:     new Date().toISOString().split('T')[0],
              desc:     desc,
              amount:   amount,
              category: autoDetectCategory(desc),
              raw:      trimmed
            });
          }
        }
      }
    }
    return result;
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
      desc:     row.desc,
      amount:   row.amount,
      category: row.category,
      date:     row.date,
      month:    month,
      paid:     true
    };
  }

  // ================================================================
  // API PÚBLICA
  // ================================================================
  return { parseCSV, parseRawText, autoDetectCategory, buildEntry, parseMoney, parseDate };

})();

window.GastoProImporter = GastoProImporter;
