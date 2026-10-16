/* Penjaga Sungai — shared quest model and 3D browser adapter. */
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
        status: state.status, phase: state.phase, timeRemaining: Math.max(0, state.timeRemaining), objective: goal(), goal: goal(),
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
  root.SungaiModel = {createGameModel, WORLD, PROPERTIES, POINTS};


  async function initialize() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === '2d') {
      const script = document.createElement('script');script.src = 'game-2d.js';
      script.onerror=()=>root.dispatchEvent(new CustomEvent('sungai:state',{detail:{ready:false,renderMode:'unavailable',rendererMessage:'Mode2D belum termuat. Muat ulang halaman.'}}));
      document.head.appendChild(script);return;
    }
    const testMode = params.get('test') === '1';
    const model = createGameModel({debug:testMode});
    const held = new Set(), touch = {x:0,y:0};
    let renderer = null, ready = false, failed = false, quality = 'auto', message = 'Menyiapkan dunia 3D…';
    let target = null, last = 0, stateClock = 0, audioContext = null, frames = 0;
    const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
    const emit=(type,detail)=>root.dispatchEvent(new CustomEvent('sungai:'+type,{detail}));
    function snapshot(){return {...model.getState(),ready,renderMode:failed?'unavailable':'3d',rendererMessage:message,quality};}
    function changed(){emit('state',snapshot());}
    function clearInput(){held.clear();touch.x=touch.y=0;target=null;}
    function unlockAudio(){
      if(!model.getState().soundEnabled)return;
      try{if(!audioContext)audioContext=new(root.AudioContext||root.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();}catch{}
    }
    function sound(type){
      if(!model.getState().soundEnabled||!audioContext)return;
      try{
        const notes=type==='win'?[523,659,784,1046]:type==='collect'?[660,880]:type==='crate'?[160,110]:type==='boat'?[330,440]:type==='lose'?[440,330,220]:[540];
        for(const [i,f]of notes.entries()){
          const osc=audioContext.createOscillator(),gain=audioContext.createGain(),at=audioContext.currentTime+i*.115;
          osc.type=type==='crate'?'triangle':'sine';osc.frequency.setValueAtTime(f,at);
          gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.055,at+.014);gain.gain.exponentialRampToValueAtTime(.001,at+.22);
          osc.connect(gain);gain.connect(audioContext.destination);osc.start(at);osc.stop(at+.23);
        }
      }catch{}
    }
    const api={
      start(){if(!ready)return false;clearInput();unlockAudio();model.start();return true;},
      restart(){if(!ready)return false;clearInput();unlockAudio();model.restart();return true;},
      pause(reason='manual'){clearInput();model.pause(reason);},
      resume(reason='manual'){clearInput();model.resume(reason);},
      setSound(on){model.setSound(on);if(on)unlockAudio();},
      setQuality(value){quality=['low','medium','high','auto'].includes(value)?value:'auto';renderer?.setQuality(quality);changed();},
      interact(){if(!ready)return false;target=null;unlockAudio();return model.interact();},
      acknowledgeDialogue(){clearInput();unlockAudio();model.acknowledgeDialogue();},
      setDirection(x,y){
        if(typeof x==='string'){const map={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};if(map[x]){if(y)held.add(map[x]);else held.delete(map[x]);}}
        else{touch.x=clamp(Number(x)||0,-1,1);touch.y=clamp(Number(y)||0,-1,1);}
        target=null;
      },
      getState:snapshot, constants:WORLD, properties:PROPERTIES,
      getRenderStats(){const stats=renderer?.getStats()||{};return {...stats,mode:failed?'unavailable':'3d',ready,frames:stats.frames??frames};},
      ...(testMode?{debug:{...model.debug,project(x,y){return renderer?.projectPoint?.({x,y})||null;}}}:{})
    };
    root.SungaiGame=api;
    model.subscribe((type,detail)=>{
      if(type==='state'){changed();return;}
      if(type==='effect')sound(detail.type);
      if(type==='ending')sound(detail.won?'win':'lose');
      if(type==='dialogue'||type==='ending')clearInput();
      emit(type,detail);
    });
    function pointClicked(point){
      const s=snapshot();if(!ready||s.status!=='playing'||s.paused||s.travelling)return;
      unlockAudio();
      const candidate=model.candidates().filter(c=>Math.hypot(c.point.x-point.x,c.point.y-point.y)<85).sort((a,b)=>Math.hypot(a.point.x-point.x,a.point.y-point.y)-Math.hypot(b.point.x-point.x,b.point.y-point.y))[0];
      if(candidate&&Math.hypot(s.player.x-candidate.point.x,s.player.y-candidate.point.y)<=candidate.radius)model.interact(candidate.id);
      else target=candidate?{x:candidate.point.x,y:candidate.point.y+(candidate.id==='crates'?65:0),interact:candidate.id}:point;
    }
    function onKey(event){
      if(!ready||model.getState().status!=='playing'||document.getElementById('game-screen')?.hidden)return;
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.closest('dialog'))return;
      const key=event.key.toLowerCase(),map={w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight',arrowup:'ArrowUp',arrowdown:'ArrowDown',arrowleft:'ArrowLeft',arrowright:'ArrowRight'};
      if(map[key]){event.preventDefault();if(event.type==='keydown'){held.add(map[key]);target=null;}else held.delete(map[key]);return;}
      if(event.type!=='keydown'||event.repeat)return;
      if(key==='e'||key===' '){event.preventDefault();api.interact();}
      if(key==='escape'){event.preventDefault();const s=model.getState();if(!s.dialogue){if(s.pauseReason==='manual')api.resume();else if(!s.paused)api.pause();}}
    }
    root.addEventListener('keydown',onKey);root.addEventListener('keyup',onKey);
    root.addEventListener('blur',()=>{clearInput();model.pause('hidden');});
    root.addEventListener('focus',()=>{if(!document.hidden){model.resume('hidden');last=0;}});
    document.addEventListener('visibilitychange',()=>{clearInput();last=0;if(document.hidden)model.pause('hidden');else model.resume('hidden');});
    function reportFailure(error){
      failed=true;ready=false;message='Dunia3D tidak dapat dibuka. Aktifkan akselerasi grafis browser atau gunakan mode2D.';
      clearInput();model.pause('renderer');changed();emit('renderer-error',{message,reason:error?.message||String(error||'WebGL unavailable')});
    }
    changed();
    try{
      const module=await import('./renderer3d.js');
      renderer=new module.RiverRenderer({canvas,onPoint:pointClicked,onReady(){},onError:reportFailure});
      renderer.resize();
      renderer.setQuality(quality);
      if(failed)return;
      ready=true;message='';changed();emit('ready',snapshot());
      if(testMode)root.addEventListener('sungai:test-point',e=>pointClicked(e.detail));
    }catch(error){reportFailure(error);return;}
    function frame(stamp){
      if(failed)return;
      const elapsed=last?Math.min(1,(stamp-last)/1000):0;last=stamp;
      const state=model.getState();
      let x=(held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0)+touch.x;
      let y=(held.has('ArrowDown')?1:0)-(held.has('ArrowUp')?1:0)+touch.y;
      if(target&&!state.paused&&state.status==='playing'){
        const dx=target.x-state.player.x,dy=target.y-state.player.y,d=Math.hypot(dx,dy);
        if(d<14||(target.interact&&d<65)){const id=target.interact;target=null;if(id)model.interact(id);}else{x=dx/d;y=dy/d;}
      }
      // Integrate elapsed active time in small steps even if rendering is slow.
      for(let t=0;t<elapsed;t+=.05)model.tick(Math.min(.05,elapsed-t),{x,y});
      stateClock+=elapsed;if(stateClock>=.15){stateClock=0;changed();}
      try{renderer.render(snapshot(),Math.min(elapsed,.1),stamp/1000);frames++;}catch(error){reportFailure(error);return;}
      root.requestAnimationFrame(frame);
    }
    new ResizeObserver(()=>renderer?.resize()).observe(canvas);
    root.addEventListener('resize',()=>renderer?.resize());
    root.requestAnimationFrame(frame);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})(typeof window !== 'undefined' ? window : null);
