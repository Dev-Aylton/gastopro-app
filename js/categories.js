/* ================================================================
   GastoPro — Categorias compartilhadas entre os formulários
   ================================================================ */

(function () {
  'use strict';

  const EXPENSE = Object.freeze([
    'Moradia', 'Contas', 'Saúde', 'Esporte', 'Cartão de crédito',
    'Alimentação', 'Mercado', 'Transporte', 'Educação', 'Empréstimo',
    'Parcelamento', 'Assinaturas', 'Compras', 'Vestuário', 'Lazer', 'Outros'
  ]);
  const INCOME = Object.freeze([
    'Salário', 'Adiantamento', 'Extra', 'Investimentos', 'Receita', 'Outros'
  ]);

  function normalize(text) {
    return String(text == null ? '' : text)
      .trim()
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  window.GastoProCategories = Object.freeze({ EXPENSE, INCOME, normalize });
})();
