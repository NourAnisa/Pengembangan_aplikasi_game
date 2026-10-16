/* Penjaga Sungai — original Canvas adventure. No external runtime dependencies. */
(function (root) {
  'use strict';

  const WORLD = Object.freeze({ width: 1600, height: 900, duration: 240, capacity: 2, speed: 215 });
  const PROPERTIES = Object.freeze([
    { id: 'key', name: 'Kunci pintu air', x: 400, y: 260, weight: 1, role: 'Membuka pintu air', states: ['di gudang', 'dibawa', 'digunakan'] },
    { id: 'parcel', name: 'Paket logistik', x: 470, y: 465, weight: 2, role: 'Pilihan muatan perahu', states: ['di dermaga', 'dibawa', 'disimpan'] },
    { id: 'boat', name: 'Perahu warisan', x: 590, y: 520, capacity: 2, role: 'Menyeberangi kanal', states: ['bersandar', 'berlayar', 'tiba'] },
    { id: 'crates', name: 'Peti penghalang', x: 1165, y: 430, role: 'Menghalangi jalur menuju pintu air', states: ['menumpuk', 'dibersihkan'] },
    { id: 'gate', name: 'Pintu air', x: 1380, y: 270, role: 'Mengendalikan debit air', states: ['terkunci', 'terbuka'] }
  ]);
  const POINTS = Object.freeze({ guardian: {x: 285, y: 485}, key: {x: 400, y: 260}, parcel: {x: 470, y: 465}, westDock: {x: 590, y: 520}, eastDock: {x: 1015, y: 520}, crates: {x: 1165, y: 430}, gate: {x: 1380, y: 270} });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const ease = t => t * t * (3 - 2 * t);

  function createGameModel(options = {}) {
    let state;
    const listeners = [];
    function emit(type, detail) { listeners.forEach(fn => fn(type, detail)); }
    function reset() {
      state = { status: 'title', phase: 'title', timeRemaining: WORLD.duration, player: { x: 235, y: 530, facing: 1 }, inventory: [], pauses: new Set(), dialogue: null, dialogueAction: null, hasKey: false, parcel: 'ground', crossed: false, crateHits: 0, gateOpen: false, travel: null, soundEnabled: true, steps: 0, interactionCount: 0, elapsed: 0, tutorial: true };
    }
    reset();
    const weight = () => state.inventory.reduce((s, i) => s + i.weight, 0);
    function isPaused() { return state.pauses.size > 0 || !!state.dialogue; }
    function goal() {
      if (state.status === 'title') return 'Jadilah penjaga sungai. Selamatkan kampung sebelum air meluap.';
      if (state.status === 'won') return 'Sungai kembali tenang. Kampung terselamatkan!';
      if (state.status === 'lost') return 'Waktu habis. Coba lagi dan susun rute yang lebih baik.';
      if (!state.hasKey) return 'Ambil kunci di gudang sebelah barat.';
      if (!state.crossed) return weight() > WORLD.capacity ? 'Muatan terlalu berat. Simpan paket di dermaga, lalu naik perahu.' : 'Naik perahu di dermaga untuk menyeberang.';
      if (state.crateHits < 3) return 'Bersihkan tiga peti di jalur menuju pintu air.';
      return 'Gunakan kunci untuk membuka pintu air.';
    }
    function candidates() {
      if (state.status !== 'playing' || state.travel) return [];
      let points = [{id: 'guardian', point: POINTS.guardian, radius: 105, text: 'Bicara dengan Pak Jaga'}];
      if (!state.hasKey) points.push({id: 'key', point: POINTS.key, radius: 105, text: 'Ambil kunci dari gudang'});
      if (state.parcel === 'ground' && !state.crossed) points.push({id: 'parcel', point: POINTS.parcel, radius: 75, text: 'Ambil paket opsional · berat 2'});
      const dock = state.crossed ? POINTS.eastDock : POINTS.westDock;
      points.push({id: 'boat', point: dock, radius: 105, text: !state.crossed && weight() > WORLD.capacity ? 'Simpan paket · kurangi muatan' : state.crossed ? 'Perahu sudah bersandar' : 'Naik perahu · kapasitas 2'});
      if (state.crossed && state.crateHits < 3) points.push({id: 'crates', point: POINTS.crates, radius: 110, text: `Singkirkan peti (${state.crateHits}/3)`});
      if (state.crossed) points.push({id: 'gate', point: POINTS.gate, radius: 110, text: state.crateHits < 3 ? 'Jalur pintu air belum aman' : 'Buka pintu air dengan kunci'});
      return points;
    }
    function nearest() {
      return candidates().filter(c => dist(state.player, c.point) <= c.radius).sort((a, b) => dist(state.player, a.point) - dist(state.player, b.point))[0] || null;
    }
    function snapshot() {
      const near = nearest();
      const done = [state.hasKey, state.crossed, state.crateHits >= 3, state.gateOpen];
      const labels = ['Ambil kunci', 'Naik perahu', 'Bersihkan peti', 'Buka pintu air'];
      const step = done.filter(Boolean).length;
      const inventory = state.inventory.map(i => ({...i}));
      return {
        ready:true,renderMode:'2d',rendererMessage:'Mode2D',status: state.status, phase: state.phase, timeRemaining: Math.max(0, state.timeRemaining), objective: goal(), goal: goal(),
        hasKey: state.hasKey, cargoCount: inventory.length, cargoTotal: weight(), cargoWeight: weight(), capacity: WORLD.capacity, inventory,
        interaction: near ? near.text : '', prompt: near ? near.text : '', interactionId: near ? near.id : null,
        soundEnabled: state.soundEnabled, paused: isPaused(), pauseReason: state.dialogue ? 'dialogue' : [...state.pauses][0] || '',
        missionStep: step, progress: labels.map((label, i) => ({id: ['key', 'boat', 'crates', 'gate'][i], label, done: done[i], active: i === step})),
        player: {...state.player}, crossed: state.crossed, crateHits: state.crateHits, gateOpen: state.gateOpen, parcel: state.parcel,
        travelling: !!state.travel, dialogue: state.dialogue ? {...state.dialogue} : null, elapsed: state.elapsed,
        properties: PROPERTIES, tutorial: state.tutorial
      };
    }
    function changed() { emit('state', snapshot()); }
    function say(title, text, actionLabel = 'Lanjutkan', next = null, speaker = 'Pak Jaga') {
      state.dialogue = {title, text, speaker, actionLabel, portrait: 'assets/guardian.png'};
      state.dialogueAction = next;
      changed(); emit('dialogue', {...state.dialogue});
    }
    function acknowledgeDialogue() {
      if (!state.dialogue) return;
      const next = state.dialogueAction;
      state.dialogue = null; state.dialogueAction = null;
      if (next) next();
      changed();
    }
    function start() {
      const sound = state.soundEnabled;
      reset(); state.soundEnabled = sound; state.status = 'playing'; state.phase = 'briefing';
      say('Sungai membutuhkanmu', 'Air mulai naik! Ambil kunci di gudang, gunakan perahu warisan untuk menyeberang, lalu bersihkan peti dan buka pintu air. Perahu hanya kuat membawa 2 satuan muatan. Kita bisa menyelamatkan kampung bersama.', 'Mulai misi', () => { state.phase = 'key'; }, 'Pak Jaga · penjaga dermaga');
    }
    function finish(won) {
      state.status = won ? 'won' : 'lost'; state.phase = state.status; state.travel = null; state.dialogue = null; state.dialogueAction = null;
      changed();
      emit('ending', {won, title: won ? 'Sungai kembali bernapas' : 'Air naik, tetapi harapan belum habis', message: won ? 'Pintu air terbuka. Arus kembali lancar dan kampung terselamatkan. Setiap properti memiliki peran dalam perjalananmu.' : 'Waktu misi berakhir. Coba rute yang lebih singkat: gudang → perahu → peti → pintu air.', timeRemaining: state.timeRemaining, stats: {seconds: Math.round(state.elapsed), interactions: state.interactionCount, properties: 4}});
    }
    function interact(requested) {
      if (state.status !== 'playing' || isPaused() || state.travel) return false;
      const near = nearest();
      const target = requested ? candidates().find(c => c.id === requested && dist(state.player, c.point) <= c.radius) : near;
      if (!target) { emit('hint', {text: goal()}); return false; }
      state.interactionCount++;
      emit('effect', {type: 'interact', x: target.point.x, y: target.point.y});
      switch (target.id) {
        case 'guardian':
          say('Petunjuk Pak Jaga', !state.hasKey ? 'Kuncinya kusimpan di gudang beratap cokelat, di utara sini. Dekati pintunya lalu berinteraksi. Paket di dekat dermaga itu opsional; kunci adalah prioritas kita.' : !state.crossed ? 'Perahu ada di dermaga sebelah timur kita. Kunci berbobot 1, paket berbobot 2, sedangkan kapasitas perahu hanya 2. Bila terlalu berat, paket bisa dititipkan dengan aman.' : 'Singkirkan peti dari jalur, kemudian putar roda pintu air menggunakan kunci. Sungai membutuhkan aliran yang lancar.');
          break;
        case 'key':
          state.hasKey = true; state.inventory.push({id: 'key', label: 'Kunci pintu air', weight: 1}); state.phase = 'boat';
          say('Kunci ditemukan', 'Kunci pintu air sudah di tasmu (berat 1). Sekarang menuju dermaga. Perahu warisan bisa mengantarmu ke seberang, tetapi muatannya terbatas.', 'Menuju perahu', null, 'Raka · penjaga sungai');
          emit('effect', {type: 'collect', x: POINTS.key.x, y: POINTS.key.y});
          break;
        case 'parcel':
          state.parcel = 'carried'; state.inventory.push({id: 'parcel', label: 'Paket logistik (opsional)', weight: 2});
          say('Satu pilihan, satu konsekuensi', 'Paket logistik berbobot 2. Bersama kunci, total muatan menjadi 3—lebih besar dari kapasitas perahu (2). Kamu bisa menitipkan paket kembali di dermaga agar misi utama tetap berjalan.', 'Saya mengerti', null, 'Raka · penjaga sungai');
          break;
        case 'boat':
          if (state.crossed) say('Perahu warisan', 'Perahu sudah menambat di tepi timur. Jalur menuju pintu air ada di sebelah utara. Bersihkan semua peti terlebih dahulu.');
          else if (!state.hasKey) say('Kunci lebih dahulu', 'Pintu air di seberang masih terkunci. Ambil kunci di gudang lebih dahulu agar perjalananmu tidak sia-sia.');
          else if (weight() > WORLD.capacity) {
            state.inventory = state.inventory.filter(i => i.id !== 'parcel'); state.parcel = 'stored';
            say('Paket dititipkan dengan aman', 'Paket ditinggalkan di dermaga. Kini muatanmu 1 dari kapasitas 2, sehingga perahu aman digunakan. Berinteraksilah sekali lagi untuk menyeberang.', 'Siap berlayar');
          } else {
            state.player.x = 680; state.player.y = 545; state.travel = {t: 0, duration: 3.3};
            state.tutorial = false; emit('effect', {type: 'boat', x: 650, y: 600});
          }
          break;
        case 'crates':
          state.crateHits++;
          emit('effect', {type: 'crate', x: POINTS.crates.x, y: POINTS.crates.y});
          if (state.crateHits >= 3) { state.phase = 'gate'; say('Jalur sudah bersih', 'Ketiga peti telah disingkirkan. Lanjutkan ke roda pintu air di timur laut dan gunakan kunci. Kita hampir berhasil!', 'Menuju pintu air', null, 'Raka · penjaga sungai'); }
          break;
        case 'gate':
          if (state.crateHits < 3) say('Amankan jalur lebih dahulu', 'Masih ada peti di jalur pintu air. Singkirkan ketiganya agar air bisa mengalir tanpa membawa penghalang ke kampung.');
          else { state.gateOpen = true; emit('effect', {type: 'gate', x: POINTS.gate.x, y: POINTS.gate.y}); finish(true); }
          break;
      }
      changed(); return true;
    }
    function insidePolygon(x, y, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if (((a[1] > y) !== (b[1] > y)) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    }
    // Keep feet on the illustrated banks; the bottom of the map is open water.
    const westBank = [[100,185],[255,245],[420,245],[590,230],[610,280],[590,355],[555,455],[550,490],[650,500],[650,548],[550,550],[505,610],[330,625],[110,595],[90,440]];
    const eastBank = [[980,495],[980,550],[1100,560],[1170,600],[1510,610],[1540,520],[1535,310],[1450,245],[1260,205],[1130,245],[1070,330],[1045,440]];
    function allowed(x, y) {
      if (!insidePolygon(x, y, state.crossed ? eastBank : westBank)) return false;
      if (state.crateHits < 3 && x > 1120 && x < 1210 && y > 380 && y < 445) return false;
      return true;
    }
    function tick(dt, input = {x: 0, y: 0}) {
      if (state.status !== 'playing' || isPaused()) return;
      dt = Math.min(Math.max(dt, 0), 0.1);
      state.elapsed += dt; state.timeRemaining = Math.max(0, state.timeRemaining - dt);
      if (state.timeRemaining <= 0) { finish(false); return; }
      if (state.travel) {
        state.travel.t += dt / state.travel.duration;
        const t = clamp(state.travel.t, 0, 1);
        state.player.x = 680 + ease(t) * 250; state.player.y = 545;
        if (t >= 1) { state.crossed = true; state.travel = null; state.player.x = 1015; state.player.y = 520; state.phase = 'crates'; changed(); }
        return;
      }
      let dx = Number(input.x) || 0, dy = Number(input.y) || 0;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= Math.max(1, len); dy /= Math.max(1, len);
        const amount = WORLD.speed * dt;
        if (allowed(state.player.x + dx * amount, state.player.y)) state.player.x += dx * amount;
        if (allowed(state.player.x, state.player.y + dy * amount)) state.player.y += dy * amount;
        if (dx) state.player.facing = dx < 0 ? -1 : 1;
        state.steps += dt * 9; state.tutorial = false;
      }
    }
    function pause(reason = 'manual') { if (state.status === 'playing') { state.pauses.add(reason); changed(); } }
    function resume(reason = 'manual') { state.pauses.delete(reason); changed(); }
    function setSound(on) { state.soundEnabled = !!on; changed(); }
    const debug = options.debug ? {
      teleport(x, y) { state.player.x = clamp(Number(x), 100, 1530); state.player.y = clamp(Number(y), 170, 735); changed(); },
      time(seconds) { state.timeRemaining = Math.max(0, Number(seconds) || 0); changed(); },
      action(id) { const c = candidates().find(c => c.id === id); if (c) { state.player.x = c.point.x; state.player.y = c.point.y; return interact(id); } return false; },
      tick(seconds) { for (let t = 0; t < seconds; t += 0.05) tick(Math.min(0.05, seconds - t)); changed(); },
      raw() { return state; }
    } : undefined;
    return { start, restart: start, pause, resume, setSound, acknowledgeDialogue, interact, tick, getState: snapshot, getRaw: () => state, subscribe: fn => listeners.push(fn), nearest, candidates, debug, constants: WORLD, properties: PROPERTIES };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {createGameModel, WORLD, PROPERTIES, POINTS};
  if (!root || !root.document) return;

  function initialize() {
    const canvas = document.getElementById('gameCanvas') || document.getElementById('game-canvas') || document.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', {alpha: false});
    const testMode = new URLSearchParams(location.search).get('test') === '1';
    const model = createGameModel({debug: testMode});
    const held = new Set(), touch = {x: 0, y: 0};
    const art = {}, effects = [], leaves = [], ripples = [];
    let target = null, last = 0, now = 0, stateClock = 0, renderScale = 1, offsetX = 0, offsetY = 0, cssWidth = 1600, cssHeight = 900, moving = false, closeCamera = false;
    let audioContext = null;
    let seed = 7356;
    function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (let i = 0; i < 32; i++) leaves.push({x: random() * WORLD.width, y: random() * WORLD.height, r: 1.5 + random() * 3, speed: 5 + random() * 12, phase: random() * Math.PI * 2});
    for (let i = 0; i < 28; i++) ripples.push({x: 660 + random() * 280, y: 90 + random() * 720, width: 10 + random() * 30, speed: 7 + random() * 16, phase: random() * 6});
    ['world', 'world_open', 'hero', 'guardian', 'boat'].forEach(name => { const img = new Image(); img.onload = () => { art[name] = {image: img, crop: trimImage(img, name)}; }; img.src = 'assets/' + name + '.png'; });
    function trimImage(img, name) {
      if (name.startsWith('world')) return {x: 0, y: 0, width: img.width, height: img.height};
      try {
        const off = document.createElement('canvas'); off.width = img.width; off.height = img.height;
        const c = off.getContext('2d'); c.drawImage(img, 0, 0);
        const a = c.getImageData(0, 0, off.width, off.height).data;
        let l = off.width, t = off.height, r = 0, b = 0;
        for (let y = 0; y < off.height; y += 2) for (let x = 0; x < off.width; x += 2) if (a[(y * off.width + x) * 4 + 3] > 30) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
        return r > l && b > t ? {x: Math.max(0, l - 2), y: Math.max(0, t - 2), width: Math.min(off.width, r - l + 4), height: Math.min(off.height, b - t + 4)} : {x: 0, y: 0, width: img.width, height: img.height};
      } catch (_) { return {x: 0, y: 0, width: img.width, height: img.height}; }
    }
    function resize() {
      const box = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, box.width); cssHeight = Math.max(1, box.height);
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(cssWidth * dpr); canvas.height = Math.round(cssHeight * dpr);
      closeCamera = cssWidth < 650 || (navigator.maxTouchPoints > 0 && innerHeight < 600);
      renderScale = closeCamera ? cssWidth / 860 : Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
      updateCamera();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function updateCamera() {
      if (closeCamera) {
        const p = model.getRaw().player;
        const vw = cssWidth / renderScale, vh = cssHeight / renderScale;
        offsetX = -clamp(p.x - vw / 2, 0, WORLD.width - vw) * renderScale;
        offsetY = -clamp(p.y - vh / 2, 0, WORLD.height - vh) * renderScale;
      } else {
        offsetX = (cssWidth - WORLD.width * renderScale) / 2;
        offsetY = (cssHeight - WORLD.height * renderScale) / 2;
      }
    }
    new ResizeObserver(resize).observe(canvas);
    root.addEventListener('resize', resize);
    function emit(type, detail) { root.dispatchEvent(new CustomEvent('sungai:' + type, {detail})); }
    model.subscribe((type, detail) => {
      if (type === 'effect') { makeEffect(detail); sound(detail.type); }
      if (type === 'ending') sound(detail.won ? 'win' : 'lose');
      if (type === 'dialogue' || type === 'ending') { held.clear(); touch.x = touch.y = 0; target = null; }
      emit(type, detail);
    });
    function unlockAudio() {
      if (!model.getRaw().soundEnabled) return;
      try { if (!audioContext) audioContext = new (root.AudioContext || root.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); } catch (_) { /* audio is optional */ }
    }
    function sound(type) {
      if (!model.getRaw().soundEnabled || !audioContext) return;
      try {
        const notes = type === 'win' ? [523, 659, 784, 1046] : type === 'collect' ? [660, 880] : type === 'crate' ? [160, 110] : type === 'boat' ? [330, 440] : type === 'lose' ? [440, 330, 220] : [540];
        notes.forEach((frequency, i) => {
          const osc = audioContext.createOscillator(), gain = audioContext.createGain(), at = audioContext.currentTime + i * 0.115;
          osc.type = type === 'crate' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(frequency, at);
          gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.07, at + 0.014); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
          osc.connect(gain); gain.connect(audioContext.destination); osc.start(at); osc.stop(at + 0.23);
        });
      } catch (_) { /* audio is optional */ }
    }
    function clearInput() { held.clear(); touch.x = touch.y = 0; target = null; }
    const api = {
      start() { clearInput(); unlockAudio(); model.start(); },
      restart() { clearInput(); unlockAudio(); model.restart(); },
      pause(reason = 'manual') { clearInput(); model.pause(reason); },
      resume(reason = 'manual') { clearInput(); model.resume(reason); },
      setSound(on) { model.setSound(on); if (on) unlockAudio(); },
      interact() { unlockAudio(); target = null; return model.interact(); },
      acknowledgeDialogue() { clearInput(); unlockAudio(); model.acknowledgeDialogue(); },
      setDirection(x, y) {
        if (typeof x === 'string') { const map = {up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'}; if (map[x]) { if (y) held.add(map[x]); else held.delete(map[x]); } }
        else { touch.x = clamp(Number(x) || 0, -1, 1); touch.y = clamp(Number(y) || 0, -1, 1); }
        target = null;
      },
      getState: model.getState, constants: WORLD, properties: PROPERTIES, setQuality(){}, getRenderStats(){return {mode:'2d',ready:true};},
      ...(testMode ? {debug: model.debug} : {})
    };
    root.SungaiGame = api;
    function onKey(event) {
      if (model.getState().status !== 'playing' || document.getElementById('game-screen')?.hidden) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.closest('dialog')) return;
      const key = event.key.toLowerCase();
      const map = {w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight'};
      if (map[key]) { event.preventDefault(); if (event.type === 'keydown') { held.add(map[key]); target = null; } else held.delete(map[key]); return; }
      if (event.type !== 'keydown' || event.repeat) return;
      if (key === 'e' || key === ' ') { event.preventDefault(); if (!model.getRaw().dialogue) api.interact(); }
      if (key === 'escape') { event.preventDefault(); const s = model.getState(); if (s.status === 'playing' && !s.dialogue) { if (s.pauseReason === 'manual') api.resume(); else if (!s.paused) api.pause(); } }
    }
    root.addEventListener('keydown', onKey); root.addEventListener('keyup', onKey);
    root.addEventListener('blur', () => { clearInput(); model.pause('hidden'); });
    root.addEventListener('focus', () => { if (!document.hidden) model.resume('hidden'); });
    document.addEventListener('visibilitychange', () => { clearInput(); if (document.hidden) model.pause('hidden'); else model.resume('hidden'); });
    canvas.addEventListener('pointerdown', event => {
      const state = model.getState(); if (state.status !== 'playing' || state.paused || state.travelling) return;
      unlockAudio();
      const rect = canvas.getBoundingClientRect();
      const point = {x: (event.clientX - rect.left - offsetX) / renderScale, y: (event.clientY - rect.top - offsetY) / renderScale};
      const candidate = model.candidates().filter(c => dist(c.point, point) < 85).sort((a,b) => dist(a.point,point)-dist(b.point,point))[0];
      if (candidate && dist(state.player, candidate.point) <= candidate.radius) model.interact(candidate.id);
      else target = candidate ? {x: candidate.point.x, y: candidate.point.y + (candidate.id === 'crates' ? 65 : 0), interact: candidate.id} : point;
    });

    function rr(x, y, w, h, r = 12) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
    function line(points, color, width) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
    function shadow(x, y, rx = 30, ry = 10) { ellipse(x, y, rx, ry, 'rgba(19,61,53,.19)'); }
    function imageAt(name, x, y, height, flip = false, width) {
      const a = art[name]; if (!a) return false;
      const c = a.crop, w = width || height * c.width / c.height;
      ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1,1);
      ctx.drawImage(a.image, c.x, c.y, c.width, c.height, -w / 2, -height, w, height); ctx.restore(); return true;
    }
    function label(text, x, y, options = {}) {
      const size = options.size || 16;
      ctx.font = (options.bold === false ? '500 ' : '700 ') + size + 'px "Nunito", "Trebuchet MS", sans-serif';
      const width = ctx.measureText(text).width + 26;
      if (!options.plain) { ctx.fillStyle = options.dark ? 'rgba(20,62,60,.90)' : 'rgba(255,254,238,.93)'; rr(x - width / 2, y - 19, width, 29, 10); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = options.dark ? '#fffbea' : options.color || '#204c44'; ctx.fillText(text, x, y - 4);
    }
    function tree(x, y, size = 1) {
      ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
      shadow(12,12,42,13); ctx.fillStyle = '#7e7750'; rr(-8,-43,17,56,5); ctx.fill();
      ellipse(-22,-61,40,32,'#317a5a'); ellipse(18,-78,42,37,'#428d62'); ellipse(33,-48,32,30,'#42845c'); ellipse(-15,-89,31,28,'#62a66b'); ellipse(6,-113,26,24,'#86b879');
      line([[-18,-65],[-3,-78],[22,-74]], 'rgba(213,232,157,.35)', 5); ctx.restore();
    }
    function fallbackMap() {
      const bg = ctx.createLinearGradient(0,0,0,900); bg.addColorStop(0,'#a9d8bb'); bg.addColorStop(1,'#c5dfac'); ctx.fillStyle = bg; ctx.fillRect(0,0,1600,900);
      ctx.fillStyle = '#4fafa8'; ctx.beginPath(); ctx.moveTo(620,0); ctx.bezierCurveTo(705,270,575,510,650,900); ctx.lineTo(1000,900); ctx.bezierCurveTo(925,600,1060,300,1000,0); ctx.closePath(); ctx.fill();
      line([[620,0],[640,220],[620,450],[650,900]], '#e8e2b6', 20); line([[1000,0],[990,250],[1015,460],[1000,900]], '#e8e2b6', 22);
      line([[185,740],[240,600],[340,345]], '#e6d6a8', 70); line([[260,600],[590,600]], '#e6d6a8', 70);
      line([[1010,600],[1130,575],[1195,470],[1380,350]], '#e6d6a8', 72);
      line([[185,740],[240,600],[340,345]], 'rgba(248,235,190,.6)', 48); line([[260,600],[590,600]], 'rgba(248,235,190,.6)', 48);
      line([[1010,600],[1130,575],[1195,470],[1380,350]], 'rgba(248,235,190,.6)', 48);
      [[90,190,1.2],[140,140,.9],[510,165,1.1],[530,250,.8],[90,450,1.2],[120,725,1.2],[430,755,1.2],[530,730,.7],[1005,160,1.1],[1160,160,1],[1530,190,1.3],[1510,450,1.1],[1450,710,1.2],[1110,755,1.1]].forEach(p => tree(...p));
      ctx.fillStyle = '#b9875e'; rr(220,185,230,105,8); ctx.fill(); ctx.fillStyle = '#dbc195'; rr(233,205,205,83,4); ctx.fill();
      ctx.fillStyle = '#80594a'; ctx.beginPath(); ctx.moveTo(195,206); ctx.lineTo(330,118); ctx.lineTo(470,206); ctx.closePath(); ctx.fill(); line([[216,199],[331,128],[452,199]], '#a9795c', 9);
      ctx.fillStyle = '#665745'; rr(312,238,48,54,4); ctx.fill(); ctx.fillStyle = '#f6d883'; ctx.fillRect(258,229,30,27); ctx.fillRect(385,229,30,27);
      for (let i=0;i<7;i++) line([[205+i*38,206],[330,128]],'rgba(72,47,37,.22)',2);
      label('GUDANG',340,165,{size:17,dark:true});
    }
    function water(t, s) {
      const alpha = art.world ? 0.11 : 0.24;
      ctx.save(); ctx.beginPath(); ctx.moveTo(670,100); ctx.lineTo(936,100); ctx.lineTo(936,795); ctx.lineTo(670,795); ctx.closePath(); ctx.clip();
      const flow = ctx.createLinearGradient(650,0,950,900); flow.addColorStop(0,`rgba(81,189,177,${alpha})`); flow.addColorStop(1,`rgba(18,132,139,${alpha})`); ctx.fillStyle = flow; ctx.fillRect(650,80,310,740);
      ripples.forEach(p => { const y = 100 + ((p.y + t * p.speed * (s.gateOpen ? 2 : 1)) % 680); const a = 0.15 + 0.2 * (Math.sin(t+p.phase)*.5+.5); line([[p.x,y],[p.x+p.width,y-2],[p.x+p.width+12,y]],`rgba(238,255,242,${a})`,2.5); });
      ctx.restore();
      if (s.gateOpen) {
        // Lift the illustrated gate from its lower edge and reveal moving water.
        const lift = Math.min(68, Math.max(0, (t - (gate.openTime || t)) * 32));
        if (art.world && !art.world_open && lift > 0) {
          ctx.save(); ctx.beginPath(); ctx.moveTo(1277,183-lift); ctx.lineTo(1463,210-lift); ctx.lineTo(1463,210); ctx.lineTo(1277,183); ctx.closePath(); ctx.clip();
          const opening = ctx.createLinearGradient(0,125,0,230); opening.addColorStop(0,'#206e79'); opening.addColorStop(.6,'#52b6b1'); opening.addColorStop(1,'#b7efe0'); ctx.fillStyle=opening; ctx.fillRect(1270,110,200,110);
          for(let i=0;i<16;i++) { const x=1280+i*12,y=130+((t*85+i*13)%90); line([[x,y],[x-2,y+10],[x-9,y+20]],'rgba(225,255,248,.68)',3); }
          ctx.restore();
        }
        for(let i=0;i<8;i++) { const y=185+((t*70+i*9)%27),x=1285+i*20; line([[x,y],[x-4,y+8]],'rgba(239,255,249,.65)',2); }
      }
    }
    function dock(x, y, side) {
      const w = 102, h = 70;
      shadow(x+8,y+14,65,14); ctx.fillStyle = '#b38657'; rr(x-w/2,y-h/2,w,h,5); ctx.fill();
      for(let i=0;i<6;i++) line([[x-w/2+4,y-h/2+6+i*11],[x+w/2-4,y-h/2+6+i*11]],'#d0a46b',7);
      line([[x-w/2+3,y-h/2],[x-w/2+3,y+h/2]],'#866448',5); line([[x+w/2-3,y-h/2],[x+w/2-3,y+h/2]],'#866448',5);
      [x-w/2,x+w/2].forEach(px=>{ellipse(px,y+23,5,5,'#715d43');ctx.fillStyle='#8f704f';ctx.fillRect(px-5,y-33,10,49);ellipse(px,y-33,7,4,'#d1b88a');});
      if(side==='west') label('DERMAGA',x-45,y+58,{size:13});
    }
    function boat(x, y, t, aboard) {
      const bob=Math.sin(t*2)*2;
      shadow(x,y+5,70,13);
      if(!imageAt('boat',x,y+20+bob,105,false,165)) {
        ctx.save();ctx.translate(x,y+bob);ctx.rotate(-.06);
        ellipse(0,6,75,20,'rgba(29,93,87,.17)');
        ctx.fillStyle='#82563c';ctx.beginPath();ctx.moveTo(-82,-12);ctx.quadraticCurveTo(-50,43,58,24);ctx.lineTo(85,-18);ctx.quadraticCurveTo(0,17,-82,-12);ctx.fill();
        ctx.fillStyle='#bf8e53';ctx.beginPath();ctx.ellipse(0,-5,70,20,0,0,Math.PI*2);ctx.fill();ellipse(0,-5,53,12,'#6c6041');
        for(let i=-1;i<=1;i++)line([[i*27-8,-19],[i*27-8,8]],'#e0b978',7);
        line([[-25,-28],[65,32]],'#8b6c47',6);ellipse(68,34,16,7,'#d2b07a');
        ctx.restore();
      }
      if(aboard) hero(x,y-8,t,true);
    }
    function key(x,y,t) {
      const bob=Math.sin(t*2.6)*4;
      ellipse(x,y+6,21,6,'rgba(180,143,54,.18)');
      ctx.save();ctx.translate(x,y-24+bob);ctx.rotate(-.48);
      ctx.strokeStyle='#9f762b';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,-13,12,0,Math.PI*2);ctx.stroke();line([[0,0],[0,31],[13,31]],'#9f762b',9);line([[0,17],[10,17]],'#9f762b',6);
      ctx.strokeStyle='#ffe09a';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-13,12,0,Math.PI*2);ctx.stroke();line([[0,0],[0,31],[13,31]],'#ffd66f',5);line([[0,17],[10,17]],'#ffd66f',3);
      ctx.restore();
    }
    function crate(x,y,size=42,opacity=1) {
      ctx.save();ctx.globalAlpha=opacity; shadow(x,y+5,size*.62,9);
      ctx.fillStyle='#a87543';rr(x-size/2,y-size,size,size,4);ctx.fill();ctx.fillStyle='#ce9c61';ctx.fillRect(x-size/2+4,y-size+4,size-8,size-8);
      line([[x-size/2+5,y-5],[x+size/2-5,y-size+5]],'#91643e',5);line([[x-size/2+5,y-size+5],[x+size/2-5,y-5]],'#e8bd7f',5);line([[x-size/2+2,y-2],[x-size/2+2,y-size+2],[x+size/2-2,y-size+2]],'#e4b97a',3);ctx.restore();
    }
    function gate(x,y,t,opened) {
      shadow(x,y+16,90,18);
      ctx.fillStyle='#95a89a';rr(x-65,y-112,130,115,10);ctx.fill();ctx.fillStyle='#b9c9b1';rr(x-76,y-125,26,137,6);ctx.fill();rr(x+50,y-125,26,137,6);ctx.fill();
      ctx.fillStyle='#596d61';rr(x-48,y-94,96,96,4);ctx.fill();
      ctx.save();ctx.beginPath();ctx.rect(x-49,y-95,98,96);ctx.clip();
      ctx.fillStyle='#38988c';ctx.fillRect(x-48,y-66,96,68);
      const lift=opened?Math.min(78,(t-(gate.openTime||t))*40):0;
      ctx.fillStyle='#9f754e';ctx.fillRect(x-45,y-92-lift,90,91);
      for(let i=0;i<5;i++)line([[x-40,y-77+i*17-lift],[x+40,y-77+i*17-lift]],'#c69b64',8);
      ctx.restore();
      ctx.save();ctx.translate(x+78,y-36);ctx.rotate(opened?t*1.1:0);ctx.strokeStyle='#655f46';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3;line([[0,0],[Math.cos(a)*23,Math.sin(a)*23]],'#716a4f',4);}ellipse(0,0,6,6,'#d9bb73');ctx.restore();
      label(opened?'PINTU AIR TERBUKA':'PINTU AIR',x,y-144,{size:14,dark:true});
    }
    function personFallback(x,y,t,old=false) {
      ctx.save();ctx.translate(x,y);const bob=moving&&!old?Math.sin(t*14)*2:Math.sin(t*2)*1;
      shadow(0,0,20,7);ctx.translate(0,bob);
      line([[-9,-22],[-10,-3]],old?'#696a4b':'#3c6456',11);line([[9,-22],[10,-3]],old?'#696a4b':'#3c6456',11);
      ctx.fillStyle=old?'#f1e1bc':'#55a486';rr(-20,-57,40,40,13);ctx.fill();
      line([[-20,-48],[-26,-24]],'#ba8d65',9);line([[20,-48],[26,-28]],'#ba8d65',9);
      ellipse(0,-70,16,20,'#d7a77b');ellipse(-3,-85,24,8,old?'#c9b184':'#4c6c48');ellipse(0,-90,16,8,old?'#e8d6ad':'#5c7c50');
      if(old){ellipse(0,-59,9,10,'#ede7d1');line([[28,-44],[30,0]],'#7c6848',4);}else{line([[-14,-53],[15,-53],[25,-40]],'#d75343',7);line([[15,-50],[31,-58]],'#d75343',6);}
      ellipse(-5,-72,1.5,2,'#354a39');ellipse(6,-72,1.5,2,'#354a39');ctx.restore();
    }
    function hero(x,y,t,aboard=false) {
      shadow(x,y+2,22,7);
      const bob=moving&&!aboard?Math.sin(t*14)*2:Math.sin(t*2)*1;
      if(!imageAt('hero',x,y+5+bob,113,model.getRaw().player.facing<0))personFallback(x,y,t);
      if(moving&&!aboard&&Math.sin(t*13)>.9)effects.push({type:'dust',x:x-12,y:y+2,life:.35,max:.35,vx:-6,vy:-2,size:6});
    }
    function glow(x,y,t,active=false) {
      const r=active?42:29;
      ellipse(x,y+3,r+4,11,active?'rgba(255,219,109,.32)':'rgba(255,255,226,.15)');
      ctx.strokeStyle=active?'rgba(255,231,154,.88)':'rgba(255,254,227,.6)';ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.ellipse(x,y+2,r,12,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(active) {ctx.fillStyle='#fff5c7';ctx.beginPath();ctx.moveTo(x-7,y-90+Math.sin(t*3)*4);ctx.lineTo(x+7,y-90+Math.sin(t*3)*4);ctx.lineTo(x,y-79+Math.sin(t*3)*4);ctx.closePath();ctx.fill();}
    }
    function makeEffect(e) {
      const n=e.type==='crate'?16:e.type==='collect'?20:e.type==='gate'?45:7;
      for(let i=0;i<n;i++){const a=random()*Math.PI*2,v=30+random()*80;effects.push({type:e.type,x:e.x,y:e.y-28,life:.5+random()*.6,max:1,vx:Math.cos(a)*v,vy:Math.sin(a)*v-30,size:2+random()*4});}
      if(e.type==='gate') gate.openTime=now;
    }
    function drawEffects(dt) {
      for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;if(p.life<=0){effects.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.type==='dust'?0:55*dt;ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.type==='crate'?'#d0a26b':p.type==='dust'?'#d9cdb0':'#ffe9a1';if(p.type==='dust')ellipse(p.x,p.y,p.size,p.size*.55,ctx.fillStyle);else{ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*5);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore();}ctx.globalAlpha=1;}
    }
    function miniCompass() {
      ctx.save();ctx.translate(1490,105);ellipse(0,0,35,35,'rgba(255,252,230,.68)');line([[0,-20],[0,19]],'#66806b',2);line([[-19,0],[19,0]],'#66806b',2);ctx.fillStyle='#4c7969';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(-7,1);ctx.lineTo(0,-3);ctx.lineTo(7,1);ctx.closePath();ctx.fill();label('U',0,-41,{size:14,plain:true});ctx.restore();
    }
    function drawWorld(t,dt) {
      const s=model.getRaw();
      ctx.save();ctx.fillStyle='#dce7d8';ctx.fillRect(0,0,cssWidth,cssHeight);ctx.translate(offsetX,offsetY);ctx.scale(renderScale,renderScale);
      if(art.world)ctx.drawImage(art.world.image,0,0,1600,900);else fallbackMap();
      if (s.gateOpen && art.world_open) {
        ctx.globalAlpha = clamp((t - (gate.openTime || t)) / 1.1, 0, 1);
        ctx.drawImage(art.world_open.image,0,0,1600,900);ctx.globalAlpha=1;
      }
      water(t,s);
      // These foreground props make every interaction legible even on the illustrated map.
      if (!art.world) {dock(612,520,'west');dock(988,520,'east');}
      if(!s.hasKey) {glow(POINTS.key.x,POINTS.key.y,t,s.status==='playing');key(POINTS.key.x,POINTS.key.y,t);label('KUNCI · GUDANG',400,305,{size:14});}
      if(s.parcel==='ground') {crate(470,465,32);label('PAKET OPSIONAL · 2',470,497,{size:12});}
      if(s.parcel==='stored') {crate(540,555,30);label('DITITIPKAN',540,591,{size:11});}
      const boatX=s.travel?s.player.x: s.crossed?930:705;
      boat(boatX,545,t,!!s.travel);
      for(let i=s.crateHits;i<3;i++)crate(1135+i*31,436-(i===1?18:0),39);
      if(s.crateHits<3){label('PETI PENGHALANG',1165,479,{size:13});if(s.crossed)glow(1165,455,t,true);}else{label('JALUR BERSIH',1165,458,{size:12});}
      if (!art.world) gate(1380,270,t,s.gateOpen); else label(s.gateOpen?'PINTU AIR TERBUKA':'PINTU AIR',1380,100,{size:14,dark:true});
      if(s.phase==='gate')glow(1380,275,t,true);
      shadow(285,487,23,8);if(!imageAt('guardian',285,489,111))personFallback(285,485,t,true);
      label('PAK JAGA',285,525,{size:12});
      if(!s.travel)hero(s.player.x,s.player.y,t);
      const near=model.nearest();
      if(near&&s.status==='playing'&&!model.getState().paused) {
        const x=clamp(s.player.x,180,1420),y=Math.max(110,s.player.y-140);
        label('E / SENTUH · '+near.text,x,y,{size:15,dark:true});
      }
      if(target&&s.status==='playing'){ctx.strokeStyle='rgba(255,249,201,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(target.x,target.y,11+Math.sin(t*6)*2,5,0,0,Math.PI*2);ctx.stroke();}
      leaves.forEach(p=>{const x=(p.x+t*p.speed*.7)%1600,y=p.y+Math.sin(t*.5+p.phase)*12;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.4+p.phase));ellipse(0,0,p.r*1.5,p.r*.5,'rgba(255,244,176,.48)');ctx.restore();});
      drawEffects(dt);miniCompass();
      const vignette=ctx.createRadialGradient(800,440,310,800,440,950);vignette.addColorStop(0,'rgba(32,65,45,0)');vignette.addColorStop(1,'rgba(22,61,40,.19)');ctx.fillStyle=vignette;ctx.fillRect(0,0,1600,900);
      if(s.gateOpen){ctx.fillStyle='rgba(255,239,173,.06)';ctx.fillRect(0,0,1600,900);}
      ctx.restore();
    }
    function frame(stamp) {
      const dt=last?Math.min(.05,(stamp-last)/1000):0;last=stamp;now=stamp/1000;
      const state=model.getState();
      let x=(held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0)+touch.x;
      let y=(held.has('ArrowDown')?1:0)-(held.has('ArrowUp')?1:0)+touch.y;
      if(target&&!state.paused&&state.status==='playing'){
        const dx=target.x-state.player.x,dy=target.y-state.player.y,d=Math.hypot(dx,dy);
        if(d<14||(target.interact&&d<65)) { const id=target.interact;target=null;if(id)model.interact(id); }
        else{x=dx/d;y=dy/d;}
      }
      moving=Math.hypot(x,y)>.05&&state.status==='playing'&&!state.paused&&!state.travelling;
      model.tick(dt,{x,y});
      stateClock+=dt;if(stateClock>=.16){stateClock=0;emit('state',model.getState());}
      updateCamera();
      drawWorld(now,dt);
      root.requestAnimationFrame(frame);
    }
    resize();root.requestAnimationFrame(frame);
    emit('ready',model.getState());emit('state',model.getState());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})(typeof window !== 'undefined' ? window : null);
