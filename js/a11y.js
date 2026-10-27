'use strict';

(() => {
  const previousFocus = new WeakMap();
  const modalSelector = '.modal-overlay';
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function getActiveModal() {
    return [...document.querySelectorAll(`${modalSelector}.active`)].pop() || null;
  }

  function getDialog(overlay) {
    return overlay.querySelector('[role="dialog"]') || overlay;
  }

  function getFocusableElements(dialog) {
    return [...dialog.querySelectorAll(focusableSelector)].filter(element => {
      const style = window.getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    });
  }

  function activateModal(overlay) {
    previousFocus.set(overlay, document.activeElement);
    const dialog = getDialog(overlay);
    const focusable = getFocusableElements(dialog);
    const firstField = focusable.find(element => /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName));
    (firstField || focusable[0] || dialog).focus();
  }

  function deactivateModal(overlay) {
    const element = previousFocus.get(overlay);
    if (element && element.isConnected && typeof element.focus === 'function') element.focus();
    previousFocus.delete(overlay);
  }

  function handleModalKeydown(event) {
    const overlay = getActiveModal();
    if (!overlay) return;
    const dialog = getDialog(overlay);

    if (event.key === 'Escape') {
      event.preventDefault();
      const closeButton = overlay.querySelector('.modal-close-btn:not([disabled])')
        || overlay.querySelector('#confirmCancelBtn:not([disabled])')
        || overlay.querySelector('[data-modal-cancel]:not([disabled])');
      if (closeButton) closeButton.click();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = getFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      const overlay = record.target;
      const wasActive = record.oldValue ? record.oldValue.split(/\s+/).includes('active') : false;
      const isActive = overlay.classList.contains('active');
      if (!wasActive && isActive) activateModal(overlay);
      if (wasActive && !isActive) deactivateModal(overlay);
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true
  });
  document.addEventListener('keydown', handleModalKeydown);

  document.querySelectorAll(`${modalSelector}.active`).forEach(activateModal);
})();
