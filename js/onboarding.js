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
      title: 'Comece rápido com o extrato do seu banco',
      text: 'Exporte seu extrato em CSV ou PDF, importe no GastoPro e confira a prévia antes de salvar.',
      icon: 'fa-solid fa-file-arrow-down',
      action: 'open-statement-guide',
      actionLabel: 'Como pegar meu extrato'
    },
    {
      title: 'Seus dados',
      text: 'Sem conta, seus dados ficam neste aparelho. Com uma conta, o app sincroniza dados com a nuvem para você entrar em outro aparelho. Baixe um backup de vez em quando.',
      icon: 'fa-solid fa-shield-halved'
    }
  ];
  const guideContent = {
    modalId: 'statementGuideModal',
    triggerId: 'statementGuideButton',
    triggerContainerId: 'statementGuideButtonContainer',
    steps: [
      {
        text: 'Abra o app do seu banco e procure “Extrato”.',
        illustration: 'assets/statement-guide-step-1.svg',
        alt: 'Ilustração genérica de um celular com a opção Extrato'
      },
      {
        text: 'Escolha o período e toque em “Exportar” ou “Baixar”. No celular, prefira CSV ou PDF; o OFX é melhor para quem usa computador. Ao baixar, escolha “Salvar em Arquivos” para achar o arquivo depois.',
        illustration: 'assets/statement-guide-step-2.svg',
        alt: 'Ilustração genérica de um período selecionado e um arquivo sendo baixado'
      },
      {
        text: 'Volte ao GastoPro, toque em “Importar Extrato”, envie o arquivo e confira a prévia antes de confirmar.',
        illustration: 'assets/statement-guide-step-3.svg',
        alt: 'Ilustração genérica de um arquivo importado e conferido'
      }
    ],
    note: 'O nome dos botões muda de banco para banco.'
  };

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

  function getStatementGuide() {
    return {
      ...guideContent,
      steps: guideContent.steps.map(step => ({ ...step }))
    };
  }

  function mountStatementGuide(triggerContainer, doc = document, assetBaseUrl = new URL('.', doc.baseURI)) {
    if (!triggerContainer || doc.getElementById(guideContent.modalId)) return null;

    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'btn-secondary statement-guide-trigger';
    trigger.id = guideContent.triggerId;
    trigger.dataset.action = 'open-statement-guide';
    trigger.textContent = 'Como pegar meu extrato';
    triggerContainer.appendChild(trigger);

    const overlay = doc.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = guideContent.modalId;
    overlay.setAttribute('aria-hidden', 'true');

    const dialog = doc.createElement('section');
    dialog.className = 'modal-content statement-guide-content';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'statementGuideTitle');
    dialog.setAttribute('aria-describedby', 'statementGuideNote');
    dialog.tabIndex = -1;

    const header = doc.createElement('div');
    header.className = 'modal-header';
    const title = doc.createElement('h2');
    title.id = 'statementGuideTitle';
    title.textContent = 'Como pegar meu extrato';
    const closeButton = doc.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'modal-close-btn';
    closeButton.setAttribute('aria-label', 'Fechar guia');
    closeButton.dataset.action = 'close-statement-guide';
    closeButton.textContent = '×';
    header.append(title, closeButton);

    const steps = doc.createElement('ol');
    steps.className = 'statement-guide-steps';
    guideContent.steps.forEach(step => {
      const item = doc.createElement('li');
      item.className = 'statement-guide-step';
      const illustration = doc.createElement('img');
      illustration.className = 'statement-guide-illustration';
      illustration.src = new URL(step.illustration, assetBaseUrl).href;
      illustration.alt = step.alt;
      const text = doc.createElement('p');
      text.textContent = step.text;
      item.append(illustration, text);
      steps.appendChild(item);
    });

    const note = doc.createElement('p');
    note.className = 'statement-guide-note';
    note.id = 'statementGuideNote';
    note.textContent = guideContent.note;
    dialog.append(header, steps, note);
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);
    return { trigger, modal: overlay };
  }

  window.GastoProOnboarding = Object.freeze({
    STORAGE_KEY,
    getTopics: () => topics.map(topic => ({ ...topic })),
    getStatementGuide,
    mountStatementGuide,
    getStartIndex: () => 0,
    hasSeen,
    shouldShowOnFirstAccess: storage => !hasSeen(storage),
    markSeen,
    clearSeen,
    navigate
  });
})();
