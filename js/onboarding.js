'use strict';

(() => {
  const STORAGE_KEY = 'gastopro_tutorial_seen';
  const topics = [
    {
      title: 'Bem-vindo ao GastoPro',
      text: 'Anote o que você ganha e gasta para acompanhar se está sobrando ou faltando dinheiro.',
      icon: 'fa-solid fa-chart-pie'
    },
    {
      title: 'Anote o dinheiro',
      text: 'Use “Lançamento Rápido” na lateral para abrir o passo a passo, ou os formulários em Ganhos e Gastos. Escolha uma categoria.',
      icon: 'fa-solid fa-circle-plus'
    },
    {
      title: 'Contas que se repetem',
      text: 'Cadastre aluguel, luz ou internet como gasto fixo. Ele aparece nos meses seguintes; marque cada mês como pago.',
      icon: 'fa-solid fa-house'
    },
    {
      title: 'Dívidas',
      text: 'Cadastre a dívida ou o parcelamento como gasto fixo com data final. O Centro de Dívidas mostra parcelas restantes e previsão de término.',
      icon: 'fa-solid fa-credit-card'
    },
    {
      title: 'Metas',
      text: 'Defina um limite para uma categoria. A tela mostra quando você chega a 80% e a 100% desse valor.',
      icon: 'fa-solid fa-bullseye'
    },
    {
      title: 'Importar e relatório',
      text: 'Importe dados de um extrato ou boleto para revisar antes de salvar. Você também pode gerar um relatório em PDF.',
      icon: 'fa-solid fa-file-import'
    },
    {
      title: 'Seus dados',
      text: 'Sem conta, seus dados ficam neste aparelho. Com uma conta, o app sincroniza dados com a nuvem para você entrar em outro aparelho. Baixe um backup de vez em quando.',
      icon: 'fa-solid fa-shield-halved'
    }
  ];

  function hasSeen(storage = window.localStorage) {
    return storage.getItem(STORAGE_KEY) === 'true';
  }

  function markSeen(storage = window.localStorage) {
    storage.setItem(STORAGE_KEY, 'true');
  }

  function clearSeen(storage = window.localStorage) {
    storage.removeItem(STORAGE_KEY);
  }

  function navigate(index, action) {
    const current = Math.min(topics.length - 1, Math.max(0, Number(index) || 0));
    if (action === 'skip' || (action === 'next' && current === topics.length - 1)) {
      return { index: current, close: true };
    }
    if (action === 'back') return { index: Math.max(0, current - 1), close: false };
    if (action === 'next') return { index: Math.min(topics.length - 1, current + 1), close: false };
    return { index: current, close: false };
  }

  window.GastoProOnboarding = Object.freeze({
    STORAGE_KEY,
    getTopics: () => topics.map(topic => ({ ...topic })),
    getStartIndex: () => 0,
    hasSeen,
    shouldShowOnFirstAccess: storage => !hasSeen(storage),
    markSeen,
    clearSeen,
    navigate
  });
})();
