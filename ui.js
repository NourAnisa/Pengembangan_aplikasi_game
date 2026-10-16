/* Presentation and accessible controls. Gameplay lives in game.js. */
(() => {
  'use strict';
  document.documentElement.classList.toggle('has-touch', navigator.maxTouchPoints > 0);
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const landing = $('#landing');
  const gameScreen = $('#game-screen');
  const canvas = $('#gameCanvas');
  const helpDialog = $('#help-dialog');
  const dialogueDialog = $('#dialogue-dialog');
  const pauseDialog = $('#pause-dialog');
  const endingDialog = $('#ending-dialog');
  const engine = () => window.SungaiGame;
  let inGame = false;
  let helpPausesGame = false;
  let currentState = null;
  let previousObjective = '';
  let lastFocusedControl = null;
  const pressedPointers = new Map();
  const activeDirections = new Map();

  function announce(text) { $('#announcement').textContent = text; }
  function openDialog(dialog) {
    if (!dialog.open) {
      lastFocusedControl = document.activeElement;
      dialog.showModal();
    }
  }
  function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  function closeAllDialogs() { $$('dialog[open]').forEach(closeDialog); }
  function focusCanvas() { if (inGame && !document.querySelector('dialog[open]')) canvas.focus({ preventScroll: true }); }
  function formatTime(value) {
    const total = Math.max(0, Math.ceil(Number(value) || 0));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  function startGame(restart = false) {
    if (!engine()) { announce('Permainan belum selesai dimuat. Muat ulang halaman, lalu coba lagi.'); return; }
    releaseDirections();
    closeAllDialogs();
    landing.hidden = true;
    gameScreen.hidden = false;
    inGame = true;
    helpPausesGame = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (restart) engine().restart(); else engine().start();
    updateState(engine().getState());
    requestAnimationFrame(focusCanvas);
  }
  function returnHome() {
    releaseDirections();
    engine()?.pause('home');
    inGame = false;
    closeAllDialogs();
    gameScreen.hidden = true;
    landing.hidden = false;
    helpPausesGame = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#start-game').focus({ preventScroll: true });
  }
  function showHelp() {
    helpPausesGame = inGame;
    releaseDirections();
    if (helpPausesGame) engine()?.pause('help');
    openDialog(helpDialog);
  }
  function hideHelp() {
    closeDialog(helpDialog);
    if (helpPausesGame) { engine()?.resume('help'); helpPausesGame = false; focusCanvas(); }
    else if (lastFocusedControl?.isConnected) lastFocusedControl.focus({ preventScroll: true });
  }
  function showPause() {
    if (!inGame) return;
    const state = engine()?.getState();
    if (state && ['won', 'lost'].includes(state.status)) {
      showEnding({won:state.status === 'won',timeRemaining:state.timeRemaining});
      return;
    }
    releaseDirections();
    engine()?.pause('manual');
    if (!document.querySelector('dialog[open]')) openDialog(pauseDialog);
  }
  function resumeGame() {
    closeDialog(pauseDialog);
    engine()?.resume('manual');
    focusCanvas();
  }
  function updateState(state) {
    if (!state) return;
    currentState = state;
    const ended = ['won', 'lost'].includes(state.status);
    $('#pause-button').setAttribute('aria-label', ended ? 'Lihat hasil misi' : 'Jeda permainan');
    $('#pause-button span').textContent = ended ? 'Hasil misi' : 'Jeda';
    const objective = state.objective || state.goal || 'Temui penjaga desa';
    if (objective !== previousObjective) {
      $('#objective').textContent = objective;
      previousObjective = objective;
    }
    const step = Math.max(0, Math.min(4, Number(state.missionStep) || 0));
    $('#mission-counter').textContent = `${String(Math.min(4, step + 1)).padStart(2, '0')} / 04`;
    $('#timer').textContent = formatTime(state.timeRemaining);
    $('#timer-stat').classList.toggle('is-urgent', state.timeRemaining <= 45);
    const keyFound = state.hasKey || (Array.isArray(state.inventory) && state.inventory.some(item => item.id === 'key'));
    $('#key-label').textContent = state.status === 'won' ? 'Sudah digunakan' : keyFound ? 'Sudah ditemukan' : 'Belum ditemukan';
    $('#key-stat').classList.toggle('is-found', !!keyFound);
    $('#cargo-count').textContent = state.cargoWeight ?? state.cargoCount ?? 0;
    $('#cargo-capacity').textContent = state.capacity ?? state.cargoTotal ?? 2;
    $('#sound-button').setAttribute('aria-pressed', String(!!state.soundEnabled));
    $('#sound-button').setAttribute('aria-label', state.soundEnabled ? 'Matikan suara' : 'Aktifkan suara');
    $('#sound-icon').setAttribute('href', state.soundEnabled ? '#i-volume' : '#i-muted');
    $('#location-label').textContent = state.location || 'Desa Tepian';
    const interaction = typeof state.interaction === 'string' ? state.interaction : typeof state.prompt === 'string' ? state.prompt : state.prompt?.text || '';
    $('#interaction-hint').textContent = interaction || 'Dekati objek untuk berinteraksi';
    $('#interact-button').disabled = !interaction || !!state.paused || ['won', 'lost', 'title'].includes(state.status);
    $('#interact-label').textContent = interaction && interaction.length < 24 ? interaction.replace(/^(?:\[?E\]?\s*[:—–-]?\s*)/i, '') : 'Interaksi';
    $$('.stage-dot').forEach((dot, index) => {
      const progress = state.progress?.[index];
      dot.classList.toggle('is-done', progress ? !!progress.done : index < step || state.status === 'won');
      dot.classList.toggle('is-active', progress ? !!progress.active : index === step && state.status !== 'won');
    });
    if (inGame && state.paused && state.pauseReason === 'manual' && !document.querySelector('dialog[open]')) openDialog(pauseDialog);
    if (!state.paused && pauseDialog.open) closeDialog(pauseDialog);
  }
  function showDialogue(detail = {}) {
    if (!inGame) return;
    releaseDirections();
    $('#dialogue-title').textContent = detail.title || 'Kabar dari tepian sungai';
    $('#dialogue-speaker').textContent = detail.speaker || 'PENJAGA DESA';
    $('#dialogue-portrait').src = /^Raka/i.test(detail.speaker || '') ? 'assets/hero.png' : 'assets/guardian.png';
    $('#dialogue-text').textContent = detail.text || '';
    $('#dialogue-continue span').textContent = detail.continueLabel || detail.actionLabel || 'Lanjutkan';
    openDialog(dialogueDialog);
    $('#dialogue-continue').focus({ preventScroll: true });
  }
  function continueDialogue() {
    closeDialog(dialogueDialog);
    engine()?.acknowledgeDialogue();
    focusCanvas();
  }
  function addEndingStat(label, value) {
    const item = document.createElement('div'); item.className = 'ending-stat';
    const strong = document.createElement('strong'); strong.textContent = value;
    const span = document.createElement('span'); span.textContent = label;
    item.append(strong, span); $('#ending-stats').append(item);
  }
  function showEnding(detail = {}) {
    if (!inGame) return;
    releaseDirections();
    closeDialog(pauseDialog); closeDialog(dialogueDialog); closeDialog(helpDialog);
    const won = !!detail.won;
    endingDialog.classList.toggle('is-lost', !won);
    $('#view-world-button').hidden = !won;
    $('#ending-emblem').innerHTML = `<svg aria-hidden="true"><use href="${won ? '#i-wave' : '#i-clock'}"/></svg>`;
    $('#ending-eyebrow').textContent = won ? 'MISI SELESAI · DESA KEMBALI HIDUP' : 'SETIAP PERJALANAN MENGAJARKAN SESUATU';
    $('#ending-title').textContent = detail.title || (won ? 'Sungai kembali mengalir.' : 'Waktu telah habis.');
    $('#ending-text').textContent = detail.text || detail.message || (won ? 'Kunci ditemukan, hambatan disingkirkan, dan pintu air kembali terbuka. Terima kasih telah menjaga desa.' : 'Pintu air belum terbuka. Ingat jalurnya, atur muatanmu, lalu coba kembali.');
    $('#ending-stats').replaceChildren();
    if (won) {
      addEndingStat('Sisa waktu', formatTime(detail.timeRemaining ?? detail.stats?.timeRemaining ?? currentState?.timeRemaining));
      addEndingStat('Misi selesai', '4 / 4');
    } else {
      addEndingStat('Langkah tercapai', `${Math.min(4, Number(currentState?.missionStep) || 0)} / 4`);
      addEndingStat('Kesempatan', 'Lagi!');
    }
    openDialog(endingDialog);
    $('#play-again-button').focus({ preventScroll: true });
  }

  function updateDirection(direction) { engine()?.setDirection(direction, (activeDirections.get(direction)?.size || 0) > 0); }
  function pressDirection(event) {
    event.preventDefault();
    if (!inGame || document.querySelector('dialog[open]')) return;
    const button = event.currentTarget, direction = button.dataset.direction;
    if (pressedPointers.has(event.pointerId)) return;
    pressedPointers.set(event.pointerId, { button, direction });
    if (!activeDirections.has(direction)) activeDirections.set(direction, new Set());
    activeDirections.get(direction).add(event.pointerId);
    button.classList.add('is-pressed');
    button.setPointerCapture(event.pointerId);
    updateDirection(direction);
  }
  function releasePointer(event) {
    const entry = pressedPointers.get(event.pointerId);
    if (!entry) return;
    pressedPointers.delete(event.pointerId);
    activeDirections.get(entry.direction)?.delete(event.pointerId);
    if (!activeDirections.get(entry.direction)?.size) entry.button.classList.remove('is-pressed');
    updateDirection(entry.direction);
    if (entry.button.hasPointerCapture(event.pointerId)) entry.button.releasePointerCapture(event.pointerId);
  }
  function releaseDirections() {
    pressedPointers.clear();
    activeDirections.clear();
    $$('.direction').forEach(button => { button.classList.remove('is-pressed'); engine()?.setDirection(button.dataset.direction, false); });
  }

  $('#start-game').addEventListener('click', () => startGame(false));
  $$('[data-open-help]').forEach(button => button.addEventListener('click', showHelp));
  $$('[data-close-help]').forEach(button => button.addEventListener('click', hideHelp));
  helpDialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); hideHelp(); });
  pauseDialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); resumeGame(); });
  dialogueDialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); continueDialogue(); });
  endingDialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); });
  $('#dialogue-continue').addEventListener('click', continueDialogue);
  $('#pause-button').addEventListener('click', showPause);
  $('#menu-button').addEventListener('click', showPause);
  $('#resume-button').addEventListener('click', resumeGame);
  $('#restart-button').addEventListener('click', () => startGame(true));
  $('#return-home-button').addEventListener('click', returnHome);
  $('#ending-home-button').addEventListener('click', returnHome);
  $('#view-world-button').addEventListener('click', () => { closeDialog(endingDialog); canvas.focus({preventScroll:true}); });
  $('#play-again-button').addEventListener('click', () => startGame(true));
  $('#sound-button').addEventListener('click', () => { engine()?.setSound(!currentState?.soundEnabled); updateState(engine()?.getState()); });
  $('#interact-button').addEventListener('click', () => { engine()?.interact(); focusCanvas(); });
  $('#fullscreen-button').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (gameScreen.requestFullscreen) await gameScreen.requestFullscreen(); }
    catch { announce('Browser ini belum mendukung layar penuh.'); }
  });
  document.addEventListener('fullscreenchange', () => { $('#fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Keluar dari layar penuh' : 'Perbesar permainan'); });
  $$('.direction').forEach(button => {
    button.addEventListener('pointerdown', pressDirection);
    button.addEventListener('pointerup', releasePointer);
    button.addEventListener('pointercancel', releasePointer);
    button.addEventListener('lostpointercapture', releasePointer);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
  window.addEventListener('blur', releaseDirections);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseDirections(); });
  window.addEventListener('sungai:state', event => updateState(event.detail));
  window.addEventListener('sungai:dialogue', event => showDialogue(event.detail));
  window.addEventListener('sungai:ending', event => showEnding(event.detail));
  updateState(engine()?.getState());
})();
