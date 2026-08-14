// ============================================================================
// WORD BOMB — wordbomb-game.js
// Fast-paced word chain party game: type a word containing the letters or explode!
// Complete support for Azerbaijani & English with human-like bot AI and arcade visuals!
// ============================================================================

// Inject dynamic styles
const wbStyle = document.createElement('style');
wbStyle.textContent = `
  .wb-game-container { display: flex; flex-direction: column; align-items: center; gap: 1.25rem; padding: 1rem; width: 100%; max-width: 650px; margin: 0 auto; box-sizing: border-box; }
  .wb-countdown-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 320px; }
  .wb-countdown { font-size: 7rem; font-weight: 800; color: var(--accent-gold); font-family: var(--font-heading); text-shadow: 0 0 30px rgba(245, 158, 11, 0.6); animation: wb-count-pop 1s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  @keyframes wb-count-pop { 0% { transform: scale(0.6); opacity: 0.3; } 50% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

  /* Player Deck */
  .wb-players { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.85rem; width: 100%; }
  .wb-player { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0.6rem 0.85rem; border-radius: var(--radius-lg); background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); border: 2px solid rgba(255,255,255,0.08); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); min-width: 85px; position: relative; }
  .wb-player.wb-current { border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(6, 182, 212, 0.5), inset 0 0 10px rgba(6, 182, 212, 0.2); transform: translateY(-4px) scale(1.06); background: rgba(8, 51, 68, 0.85); }
  .wb-player.wb-dead { opacity: 0.35; filter: grayscale(100%); transform: scale(0.92); border-color: transparent; }
  .wb-player-avatar { width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .wb-player-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .wb-player-name { font-weight: 700; font-size: 0.85rem; max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary); }
  .wb-player-lives { font-size: 0.95rem; letter-spacing: 2px; }

  /* Center Arena */
  .wb-center-arena { display: flex; flex-direction: column; align-items: center; gap: 1.25rem; background: radial-gradient(circle at top, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%); padding: 2rem 1.5rem; border-radius: var(--radius-xl); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 40px rgba(0,0,0,0.5); width: 100%; box-sizing: border-box; }
  
  /* 3D Animated Bomb & Timer */
  .wb-bomb-stage { position: relative; width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; }
  .wb-bomb-svg { width: 100%; height: 100%; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.6)); }
  .wb-bomb-stage.ticking { animation: wb-bomb-idle 1.2s infinite ease-in-out; }
  .wb-bomb-stage.urgent { animation: wb-bomb-panic 0.25s infinite cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes wb-bomb-idle { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.04) rotate(2deg); } }
  @keyframes wb-bomb-panic { 0%, 100% { transform: translate(0, 0) scale(1.08); filter: drop-shadow(0 0 25px rgba(239, 68, 68, 0.8)); } 25% { transform: translate(-3px, 2px) scale(1.1); } 75% { transform: translate(3px, -2px) scale(1.1); } }
  
  #wb-spark { animation: wb-spark-flicker 0.15s infinite alternate; }
  @keyframes wb-spark-flicker { 0% { r: 6; fill: #fbbf24; } 100% { r: 9; fill: #ef4444; } }

  .wb-timer-overlay { position: absolute; top: 58%; left: 50%; transform: translate(-50%, -50%); text-align: center; pointer-events: none; }
  .wb-timer { font-size: 2.5rem; font-weight: 800; font-family: var(--font-heading); color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.8); line-height: 1; }
  .wb-timer.urgent { color: #f87171 !important; text-shadow: 0 0 15px rgba(239, 68, 68, 0.9); }

  /* Letter Combo Cyber Badge */
  .wb-combo-badge { background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95)); border: 2px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg); padding: 1.25rem 2rem; width: 100%; text-align: center; box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.15), 0 10px 25px rgba(0,0,0,0.3); }
  .wb-combo-subtext { font-size: 0.75rem; font-weight: 700; letter-spacing: 1.5px; color: var(--accent-cyan); text-transform: uppercase; margin-bottom: 0.35rem; }
  .wb-combo { font-size: 4rem; font-weight: 900; letter-spacing: 10px; color: #ffffff; text-transform: uppercase; font-family: var(--font-heading); text-shadow: 0 0 25px rgba(56, 189, 248, 0.7); }

  .wb-last-word { min-height: 1.6em; color: var(--text-secondary); font-size: 1.05rem; font-weight: 600; text-align: center; }
  .wb-last-word.active-word { color: var(--accent-green); text-shadow: 0 0 10px rgba(34, 197, 94, 0.4); }

  /* Input Form */
  #wb-input-form { display: flex; gap: 0.6rem; width: 100%; }
  #wb-word-input { flex: 1; padding: 1rem 1.25rem; font-size: 1.35rem; border-radius: var(--radius-md); border: 2px solid rgba(255,255,255,0.15); outline: none; background: rgba(15, 23, 42, 0.85); color: #ffffff; text-transform: uppercase; font-weight: 800; letter-spacing: 2px; transition: all 0.2s; }
  #wb-word-input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(6, 182, 212, 0.35); background: rgba(15, 23, 42, 1); }
  #wb-word-input:disabled { background: rgba(15, 23, 42, 0.4); color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.05); }
  #wb-input-form button { padding: 1rem 1.5rem; font-size: 1.15rem; border-radius: var(--radius-md); border: none; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); }
  #wb-input-form button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6); }
  #wb-input-form button:active:not(:disabled) { transform: translateY(0); }
  #wb-input-form button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

  /* Explosion Screen Effect */
  .wb-explosion-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 10rem; animation: wb-explode 1.2s ease-out forwards; }
  .wb-explosion-text { font-size: 2.5rem; font-weight: 900; color: #ef4444; font-family: var(--font-heading); text-shadow: 0 0 30px rgba(239, 68, 68, 0.9); margin-top: -2rem; }
  @keyframes wb-explode { 0% { transform: scale(0.2); opacity: 1; } 40% { transform: scale(1.4); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }

  .wb-status { font-size: 0.85rem; color: var(--text-secondary); text-align: center; }
`;
document.head.appendChild(wbStyle);

let hostTimerInterval;
let visualTimerRAF;

function getRandomCombo(rotations) {
  const isAzerbaijani = isAz();
  const list = isAzerbaijani ? (window.LETTER_COMBOS_AZ || window.LETTER_COMBOS) : (window.LETTER_COMBOS_EN || window.LETTER_COMBOS);
  
  let allowed = ['easy'];
  if (rotations >= 3 && rotations <= 5) allowed = ['easy', 'medium'];
  else if (rotations >= 6) allowed = ['medium', 'hard'];
  
  const combos = list.filter(c => allowed.includes(c.difficulty));
  if (combos.length === 0) return list[0];
  return combos[Math.floor(Math.random() * combos.length)];
}

// ========================================================================
// GAME START
// ========================================================================
window.startWordBombGame = async function() {
  if (!state.isHost) return;
  
  const turn_order = shuffleArray(state.players.map(p => p.id));
  const lives = {};
  state.players.forEach(p => lives[p.id] = 3);
  
  const initialCombo = getRandomCombo(0);

  const gs = {
    phase: 'countdown',
    countdown: 3,
    start_time: Date.now() + 3000,
    turn_order,
    current_turn: 0,
    current_combo: initialCombo,
    lives,
    used_words: [],
    eliminated: [],
    last_word: null,
    turn_count: 0
  };

  await fastUpdateGameState(gs, {
    status: 'playing',
    game_mode: 'wordbomb'
  });
  
  // Host automatically transitions to playing phase after countdown
  setTimeout(async () => {
    const currentGs = state.room?.game_state || gs;
    if (currentGs.phase === 'countdown') {
      const timeLimit = currentGs.is_hardcore ? 4000 : 8000;
      const playGs = { 
        ...currentGs, 
        phase: 'playing', 
        turn_end_time: Date.now() + timeLimit 
      };
      await fastUpdateGameState(playGs);
      startHostTimer();
    }
  }, 3200);
};

// ========================================================================
// TURN MANAGEMENT
// ========================================================================
function advanceTurn(gs) {
  const alive = gs.turn_order.filter(id => !gs.eliminated.includes(id));
  if (alive.length <= 1) return;
  
  do {
    gs.current_turn = (gs.current_turn + 1) % gs.turn_order.length;
  } while (gs.eliminated.includes(gs.turn_order[gs.current_turn]));
  
  gs.turn_count = (gs.turn_count || 0) + 1;
  const rotations = Math.floor(gs.turn_count / gs.turn_order.length);
  gs.current_combo = getRandomCombo(rotations);
  
  // Gradual timer reduction for tension
  let timeLimit = gs.is_hardcore ? 3500 : 8000;
  if (rotations > 2) timeLimit = Math.max(4500, timeLimit - (rotations * 400));
  
  gs.turn_end_time = Date.now() + timeLimit;
  gs.submitted_word = null;
  
  if (window.wordbombBotTimeout) {
    clearTimeout(window.wordbombBotTimeout);
    window.wordbombBotTimeout = null;
  }
}

async function handleTimeout(gs) {
  const pid = gs.turn_order[gs.current_turn];
  if (!pid) return;

  gs.lives[pid] = (gs.lives[pid] || 1) - 1;
  const victim = state.players.find(p => p.id === pid);
  gs.explosion = { playerId: pid, nickname: victim?.nickname || 'Player', time: Date.now() };
  
  if (gs.lives[pid] <= 0) {
    gs.eliminated.push(pid);
  }
  
  const alive = gs.turn_order.filter(id => !gs.eliminated.includes(id));
  if (alive.length <= 1) {
    gs.phase = 'game_over';
    gs.winner = alive[0] || null;
    await fastUpdateGameState(gs);
    clearInterval(hostTimerInterval);
    hostTimerInterval = null;
    return;
  }
  
  advanceTurn(gs);
  await fastUpdateGameState(gs);
}

function startHostTimer() {
  if (!state.isHost) return;
  if (hostTimerInterval) clearInterval(hostTimerInterval);
  
  hostTimerInterval = setInterval(async () => {
    const gs = state.room?.game_state;
    if (!gs || gs.phase !== 'playing') {
      clearInterval(hostTimerInterval);
      hostTimerInterval = null;
      return;
    }
    
    if (Date.now() >= gs.turn_end_time) {
      gs.turn_end_time = Date.now() + 999999; // Prevent double trigger
      await handleTimeout(gs);
    }
  }, 100);
}

async function processSubmittedWord(gs) {
  const sub = gs.submitted_word;
  gs.processed_word_time = sub.time;
  
  if (gs.turn_order[gs.current_turn] !== sub.playerId) {
    await fastUpdateGameState(gs);
    return;
  }
  
  const word = sub.word.trim().toLowerCase();
  const combo = (gs.current_combo?.combo || '').trim().toLowerCase();
  
  const valid = window.isValidWord ? window.isValidWord(word, combo) : (word.includes(combo) && !gs.used_words.includes(word));
  
  if (valid && !gs.used_words.includes(word)) {
    gs.used_words.push(word);
    gs.last_word = word;
    advanceTurn(gs);
  }
  
  await fastUpdateGameState(gs);
}

// ========================================================================
// STATE HANDLER
// ========================================================================
window.handleWordBombState = function(gs) {
  showScreen('wordbomb');
  
  // Host processes submitted words and manages timer
  if (state.isHost && gs.phase === 'playing') {
    if (!hostTimerInterval) startHostTimer();
    
    if (gs.submitted_word && (!gs.processed_word_time || gs.processed_word_time !== gs.submitted_word.time)) {
      processSubmittedWord(gs);
    }
  }

  // Trigger Bot Actions if host
  if (state.isHost && gs.phase === 'playing') {
    window.processWordBombBotActions(gs);
  }

  const container = $('#wordbomb-main-area');
  if (!container) return;

  if (gs.phase === 'countdown') {
    if (!container.querySelector('.wb-live-box')) {
      container.innerHTML = `
        <div class="wb-countdown-container wb-live-box">
          <h2 style="color:var(--text-secondary);margin-bottom:1rem;font-weight:700;">${isAz() ? 'HAZIR OLUN!' : 'GET READY!'}</h2>
          <div class="wb-countdown" id="wb-live-countdown">3</div>
        </div>
      `;
      let count = 3;
      playSound('tick');
      const cdEl = document.getElementById('wb-live-countdown');
      const cdInt = setInterval(() => {
        count--;
        if (count > 0) {
          if (cdEl) cdEl.textContent = count;
          playSound('tick');
        } else {
          if (cdEl) cdEl.textContent = isAz() ? 'BAŞLA!' : 'GO!';
          playSound('start');
          clearInterval(cdInt);
          setTimeout(() => {
            const cur = state.room?.game_state;
            if (cur && cur.phase === 'countdown') {
              cur.phase = 'playing';
              renderPlaying(container, cur);
            }
          }, 500);
        }
      }, 1000);
    }
    return;
  }
  
  if (gs.phase === 'game_over') {
    showWordBombGameOver(gs);
    return;
  }

  renderPlaying(container, gs);
};

// ========================================================================
// RENDER
// ========================================================================
function renderPlaying(container, gs) {
  if (!container.querySelector('.wb-game-container')) {
    container.innerHTML = `
      <div class="wb-game-container">
        <div class="wb-players"></div>
        
        <div class="wb-center-arena">
          <!-- Animated 3D Bomb -->
          <div class="wb-bomb-stage ticking">
            <svg class="wb-bomb-svg" viewBox="0 0 160 160">
              <defs>
                <radialGradient id="bombGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#475569" />
                  <stop offset="50%" stop-color="#1e293b" />
                  <stop offset="100%" stop-color="#090d16" />
                </radialGradient>
                <filter id="glowFuse" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <!-- Fuse -->
              <path d="M 80 42 C 80 20 112 28 116 12" stroke="#f59e0b" stroke-width="4" fill="none" stroke-linecap="round" />
              <!-- Fuse Spark -->
              <circle id="wb-spark" cx="116" cy="12" r="7" fill="#ef4444" filter="url(#glowFuse)" />
              <!-- Bomb Sphere -->
              <circle cx="80" cy="94" r="54" fill="url(#bombGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
              <!-- Bomb Neck -->
              <rect x="68" y="36" width="24" height="10" rx="3" fill="#475569"/>
              <!-- Glossy Sheen -->
              <ellipse cx="60" cy="74" rx="16" ry="9" transform="rotate(-30 60 74)" fill="rgba(255,255,255,0.22)" />
            </svg>
            <div class="wb-timer-overlay">
              <div class="wb-timer">8.0</div>
            </div>
          </div>

          <!-- Letter Combo Cyber Display -->
          <div class="wb-combo-badge">
            <div class="wb-combo-subtext">${isAz() ? 'DAXİLİNDƏ BU HƏRFLƏR OLAN SÖZ YAZIN:' : 'TYPE A WORD CONTAINING THESE LETTERS:'}</div>
            <div class="wb-combo">--</div>
          </div>

          <div class="wb-last-word"></div>

          <!-- Futuristic Input Field -->
          <form id="wb-input-form">
            <input type="text" id="wb-word-input" autocomplete="off" placeholder="${isAz() ? 'Sözü daxil edin...' : 'Type a word...'}" />
            <button type="submit" id="wb-submit-btn">
              <span>${isAz() ? 'TƏSDİQ' : 'SUBMIT'}</span>
              <span style="font-size:0.8em;opacity:0.8;">↵</span>
            </button>
          </form>

          <div class="wb-status"></div>
        </div>
      </div>
    `;
    
    // Bind form submit
    const form = $('#wb-input-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitWord();
      });
    }

    const input = $('#wb-word-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitWord();
        }
      });
    }
    
    startVisualTimer();
  }
  
  updatePlayerDisplay(gs);
  
  const comboEl = $('.wb-combo');
  if (comboEl && gs.current_combo) {
    comboEl.textContent = gs.current_combo.combo.toUpperCase();
  }
  
  const lastWordEl = $('.wb-last-word');
  if (lastWordEl) {
    if (gs.last_word) {
      lastWordEl.textContent = `✓ ${gs.last_word.toUpperCase()}`;
      lastWordEl.classList.add('active-word');
    } else {
      lastWordEl.textContent = '';
      lastWordEl.classList.remove('active-word');
    }
  }
  
  const input = $('#wb-word-input');
  const submitBtn = $('#wb-submit-btn');
  const isMyTurn = gs.turn_order[gs.current_turn] === state.playerId;
  
  if (input && submitBtn) {
    if (isMyTurn && !gs.eliminated.includes(state.playerId)) {
      if (input.disabled) {
        input.disabled = false;
        submitBtn.disabled = false;
        input.value = '';
        input.placeholder = isAz() ? 'Sözü daxil edin və Enter basın...' : 'Type word and hit Enter...';
        setTimeout(() => input.focus(), 60);
      }
    } else {
      input.disabled = true;
      submitBtn.disabled = true;
      input.value = '';
      const currentP = state.players.find(p => p.id === gs.turn_order[gs.current_turn]);
      input.placeholder = currentP ? (isAz() ? `${currentP.nickname} düşünür...` : `${currentP.nickname}'s turn...`) : (isAz() ? 'Gözlənilir...' : 'Waiting...');
    }
  }
  
  const statusEl = $('.wb-status');
  if (statusEl) {
    statusEl.textContent = isAz() ? `${gs.used_words.length} söz istifadə olunub` : `${gs.used_words.length} words used`;
  }

  // Explosion animation
  if (gs.explosion && window._lastExplosionTime !== gs.explosion.time) {
    window._lastExplosionTime = gs.explosion.time;
    showExplosion(gs.explosion.nickname);
  }
}

function updatePlayerDisplay(gs) {
  const el = $('.wb-players');
  if (!el) return;
  
  let html = '';
  gs.turn_order.forEach((id, idx) => {
    const p = state.players.find(x => x.id === id);
    if (!p) return;
    
    const current = idx === gs.current_turn;
    const dead = gs.eliminated.includes(id);
    const lives = gs.lives[id] || 0;
    
    let hearts = '';
    if (dead) {
      hearts = '💀';
    } else {
      for (let i = 0; i < 3; i++) hearts += i < lives ? '❤️' : '🖤';
    }

    const avatarUrl = p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.nickname)}`;
    
    html += `
      <div class="wb-player ${current ? 'wb-current' : ''} ${dead ? 'wb-dead' : ''}">
        <div class="wb-player-avatar">
          <img src="${avatarUrl}" alt="${p.nickname}" onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${p.nickname}'" />
        </div>
        <div class="wb-player-name" title="${p.nickname}">${p.nickname}</div>
        <div class="wb-player-lives">${hearts}</div>
      </div>
    `;
  });
  
  el.innerHTML = html;
}

function startVisualTimer() {
  if (visualTimerRAF) cancelAnimationFrame(visualTimerRAF);
  
  function tick() {
    const gs = state.room?.game_state;
    if (gs && gs.phase === 'playing' && gs.turn_end_time) {
      const left = Math.max(0, gs.turn_end_time - Date.now());
      const el = $('.wb-timer');
      const bombStage = $('.wb-bomb-stage');
      
      if (el) {
        el.textContent = (left / 1000).toFixed(1);
        if (left < 3000 && left > 0) {
          el.classList.add('urgent');
          if (bombStage) bombStage.classList.add('urgent');
        } else {
          el.classList.remove('urgent');
          if (bombStage) bombStage.classList.remove('urgent');
        }
      }
    }
    visualTimerRAF = requestAnimationFrame(tick);
  }
  visualTimerRAF = requestAnimationFrame(tick);
}

function showExplosion(nickname) {
  playSound('bomb');
  const el = document.createElement('div');
  el.className = 'wb-explosion-overlay';
  el.innerHTML = `
    <div>💥</div>
    <div class="wb-explosion-text">${nickname ? nickname + ' BOOM!' : 'BOOM!'}</div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ========================================================================
// WORD SUBMISSION
// ========================================================================
async function submitWord() {
  const input = $('#wb-word-input');
  if (!input) return;
  
  const word = input.value.trim().toLowerCase();
  if (!word) return;
  
  const gs = state.room?.game_state;
  if (!gs || gs.phase !== 'playing') return;
  if (gs.turn_order[gs.current_turn] !== state.playerId) {
    showToast(isAz() ? "Sizin növbəniz deyil!" : "Not your turn!", 'error');
    return;
  }
  
  const combo = (gs.current_combo?.combo || '').trim().toLowerCase();
  
  // 1. Check if word contains combo (with Azerbaijani letter normalization)
  const normWord = window.normalizeWord ? window.normalizeWord(word) : word;
  const normCombo = window.normalizeWord ? window.normalizeWord(combo) : combo;
  const containsCombo = word.includes(combo) || normWord.includes(normCombo) || word.includes(normCombo);

  if (!containsCombo) {
    playSound('wrong');
    showToast(isAz() ? `Sözdə "${combo.toUpperCase()}" hərfləri olmalıdır!` : `Must contain "${combo.toUpperCase()}"`, 'error');
    input.focus();
    return;
  }

  // 2. Check if valid word in dictionary
  const valid = window.isValidWord ? window.isValidWord(word, combo) : (window.WORD_DICTIONARY && window.WORD_DICTIONARY.has(word));
  if (!valid) {
    playSound('wrong');
    showToast(isAz() ? 'Lüğətdə belə bir söz tapılmadı!' : 'Not in dictionary!', 'error');
    input.focus();
    return;
  }

  // 3. Check if already used
  if (gs.used_words.includes(word) || gs.used_words.includes(normWord)) {
    playSound('wrong');
    showToast(isAz() ? 'Bu söz artıq istifadə olunub!' : 'Already used!', 'error');
    input.focus();
    return;
  }
  
  playSound('correct');
  input.value = '';
  
  // Submit word for host to process
  const updatedGs = { ...gs, submitted_word: { word, playerId: state.playerId, time: Date.now() } };
  await fastUpdateGameState(updatedGs);
}

// ========================================================================
// BOT AI (With human-like mistakes, panics, and vocabulary)
// ========================================================================
window.processWordBombBotActions = function(gs) {
  if (gs.phase !== 'playing') return;
  
  const pid = gs.turn_order[gs.current_turn];
  const bot = state.players.find(p => p.id === pid);
  
  if (bot && bot.nickname.startsWith('Bot_')) {
    if (window.wordbombBotTimeout) return;
    
    const timeLeft = gs.turn_end_time - Date.now();
    if (timeLeft <= 0) return;

    // BOT MISTAKE LOGIC:
    // 35% chance bot panics/fails to find word and lets the timer expire!
    const willFail = Math.random() < 0.35;
    
    if (willFail) {
      // Bot fails: does not submit any word and lets timer naturally expire
      return;
    }

    // Thinking delay: 2.0s to 4.8s
    const delay = 1800 + Math.random() * 3000;
    
    window.wordbombBotTimeout = setTimeout(async () => {
      const currentGs = state.room?.game_state;
      if (!currentGs || currentGs.phase !== 'playing' || currentGs.turn_order[currentGs.current_turn] !== pid) {
        window.wordbombBotTimeout = null;
        return;
      }
      
      const combo = (currentGs.current_combo?.combo || '').trim().toLowerCase();
      const normCombo = window.normalizeWord ? window.normalizeWord(combo) : combo;
      
      // Search dictionary for valid matching word
      let candidateWords = [];
      if (window.WORD_DICTIONARY) {
        for (const w of window.WORD_DICTIONARY) {
          const nw = window.normalizeWord ? window.normalizeWord(w) : w;
          if ((w.includes(combo) || nw.includes(normCombo)) && !currentGs.used_words.includes(w)) {
            candidateWords.push(w);
            if (candidateWords.length > 20) break;
          }
        }
      }
      
      if (candidateWords.length > 0) {
        const chosenWord = candidateWords[Math.floor(Math.random() * candidateWords.length)];
        const updatedGs = { ...currentGs, submitted_word: { word: chosenWord, playerId: pid, time: Date.now() } };
        await fastUpdateGameState(updatedGs);
      }
      
      window.wordbombBotTimeout = null;
    }, delay);
  } else {
    if (window.wordbombBotTimeout) {
      clearTimeout(window.wordbombBotTimeout);
      window.wordbombBotTimeout = null;
    }
  }
};

// ========================================================================
// GAME OVER
// ========================================================================
window.showWordBombGameOver = function(gs) {
  showScreen('gameover');
  const title = $('#gameover-title');
  const msg = $('#gameover-message');
  const details = $('#gameover-details');
  
  const winner = state.players.find(p => p.id === gs.winner);
  
  if (isAz()) {
    title.textContent = winner ? `🏆 ${winner.nickname} Qalib Gəldi!` : 'Hamı Partladı!';
    msg.textContent = `Word Bomb — Cəmi ${gs.used_words.length} söz oynandı`;
  } else {
    title.textContent = winner ? `🏆 ${winner.nickname} Survives!` : 'Everyone Exploded!';
    msg.textContent = `Word Bomb — ${gs.used_words.length} words played`;
  }
  
  let html = `<h3>${isAz() ? 'Yekun Nəticələr' : 'Final Standing'}</h3><ul class="standings-list">`;
  
  const alive = gs.turn_order.filter(id => !gs.eliminated.includes(id));
  const elim = [...gs.eliminated].reverse();
  const ranking = [...alive, ...elim];
  
  ranking.forEach((id, i) => {
    const p = state.players.find(x => x.id === id);
    const medal = i === 0 ? '👑 ' : `${i + 1}. `;
    const lives = gs.lives[id] || 0;
    const status = gs.eliminated.includes(id) ? '💀' : `${lives} ❤️`;
    html += `<li>${medal}<strong>${p?.nickname || 'Player'}</strong>: ${status}</li>`;
  });
  html += '</ul>';
  details.innerHTML = html;
  
  const lobbyBtn = $('#gameover-lobby-btn');
  if (lobbyBtn) {
    if (state.isHost) {
      lobbyBtn.style.display = 'block';
      lobbyBtn.textContent = isAz() ? 'Lobbiyə Qayıt' : 'Back to Lobby';
    } else {
      lobbyBtn.style.display = 'none';
    }
  }
};
