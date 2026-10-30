'use strict';

(() => {
  const STORAGE_KEY = 'gastopro_theme';

  function normalizeSavedTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function chooseTheme(savedValue) {
    return normalizeSavedTheme(savedValue);
  }

  function toggleTheme(theme) {
    return normalizeSavedTheme(theme) === 'dark' ? 'light' : 'dark';
  }

  function readTheme() {
    try {
      return chooseTheme(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return chooseTheme(null);
    }
  }

  function updateThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-body').trim();
    if (background) meta.content = background;
  }

  function updateThemeButton(theme) {
    const button = document.getElementById('themeToggleBtn');
    const icon = document.getElementById('themeToggleIcon');
    if (!button || !icon) return;
    const isDark = theme === 'dark';
    button.setAttribute('aria-label', isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
    button.setAttribute('aria-pressed', isDark ? 'false' : 'true');
    button.title = isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }

  function applyTheme(theme) {
    const selectedTheme = normalizeSavedTheme(theme);
    document.documentElement.setAttribute('data-theme', selectedTheme);
    updateThemeColor();
    updateThemeButton(selectedTheme);
    return selectedTheme;
  }

  function setTheme(theme) {
    const selectedTheme = applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, selectedTheme);
    } catch (error) {
      // Theme changes remain available for this page when storage is blocked.
    }
    document.dispatchEvent(new CustomEvent('gastopro:themechange', {
      detail: { theme: selectedTheme }
    }));
    return selectedTheme;
  }

  function toggleCurrentTheme() {
    const currentTheme = normalizeSavedTheme(document.documentElement.getAttribute('data-theme'));
    return setTheme(toggleTheme(currentTheme));
  }

  document.documentElement.setAttribute('data-theme', readTheme());
  document.addEventListener('DOMContentLoaded', () => {
    const theme = normalizeSavedTheme(document.documentElement.getAttribute('data-theme'));
    applyTheme(theme);
    const button = document.getElementById('themeToggleBtn');
    if (button) button.addEventListener('click', toggleCurrentTheme);
  });

  window.GastoProTheme = { applyTheme, readTheme, setTheme, toggleCurrentTheme };
  window.GastoProThemeHelpers = { normalizeSavedTheme, chooseTheme, toggleTheme };
})();
