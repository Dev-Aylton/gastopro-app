/* Atualiza a interface quando a suite termina e publica o resumo dos testes. */
window.addEventListener('load', () => {
  setTimeout(() => {
    const results = window.GastoProTestResults;
    if (!results) return;

    document.getElementById('numTotal').textContent = results.total;
    document.getElementById('numPass').textContent = results.passed;
    document.getElementById('numFail').textContent = results.failed;

    const banner = document.getElementById('statusBanner');
    banner.style.display = 'block';

    if (results.failed === 0) {
      banner.className = 'status-banner all-pass';
      banner.textContent = '🎉 Todos os testes passaram! App está 100% funcional.';
    } else {
      banner.className = 'status-banner has-fail';
      banner.textContent = `⚠️ ${results.failed} teste(s) reprovado(s). Veja abaixo.`;
    }

    if (results.errors && results.errors.length > 0) {
      const failSection = document.getElementById('failSection');
      const failList = document.getElementById('failList');
      failSection.style.display = 'block';

      results.errors.forEach(err => {
        const card = document.createElement('div');
        card.className = 'fail-card';
        card.innerHTML = `
          <div class="fail-test">❌ ${err.test}</div>
          <div class="fail-error">→ ${err.error}</div>
        `;
        failList.appendChild(card);
      });
    }

    const loadMsg = document.getElementById('loadingMsg');
    if (loadMsg) loadMsg.remove();
  }, 100);
});
