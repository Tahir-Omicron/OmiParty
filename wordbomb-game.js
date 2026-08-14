// ============================================================================
// WORD BOMB — wordbomb-game.js
// Fast-paced word chain game: type a word containing the letter combo or explode!
// ============================================================================

// Inject styles
const wbStyle = document.createElement('style');
wbStyle.textContent = `
  .wb-game-container { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; padding: 1rem; width: 100%; box-sizing: border-box; }
  .wb-countdown-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; }
  .wb-countdown { font-size: 6rem; font-weight: bold; color: var(--accent-gold); font-family: var(--font-heading); }
  .wb-players { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; width: 100%; }
  .wb-player { padding: 0.5rem 0.75rem; border-radius: var(--radius-md); background: var(--bg-surface); text-align: center; border: 2px solid transparent; transition: all 0.3s var(--ease-smooth); min-width: 80px; }
  .wb-player.wb-current { border-color: var(--accent-green); box-shadow: 0 0 15px rgba(0,200,83,0.4); transform: scale(1.05); }
  .wb-player.wb-dead { opacity: 0.4; filter: grayscale(100%); }
  .wb-player-name { font-weight: 600; margin-bottom: 0.25rem; font-size: 0.95rem; }
  .wb-player-lives { font-size: 1rem; letter-spacing: 2px; }
  .wb-center-area { display: flex; flex-direction: column; align-items: center; gap: 1rem; background: var(--bg-surface); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--glass-border); width: 100%; max-width: 500px; box-sizing: border-box; }
  .wb-timer { font-size: 3.5rem; font-weight: 700; font-family: var(--font-heading); color: var(--accent-cyan); transition: color 0.2s; }
  .wb-timer.urgent { animation: wb-pulse 0.4s infinite alternate; color: var(--accent-red) !important; }
  @keyframes wb-pulse { from { transform: scale(1); } to { transform: scale(1.08); } }
  .wb-combo-box { background: rgba(0,0,0,0.4); padding: 1.5rem 2rem; border-radius: var(--radius-md); border: 2px solid var(--glass-border); width: 100%; text-align: center; }
  .wb-combo { font-size: 3.5rem; font-weight: 700; letter-spacing: 6px; color: #fff; text-transform: uppercase; font-family: var(--font-heading); }
  .wb-last-word { min-height: 1.5em; color: var(--text-muted); font-size: 1rem; }
  #wb-input-form { display: flex; gap: 0.5rem; width: 100%; }
  #wb-word-input { flex: 1; padding: 0.75rem 1rem; font-size: 1.3rem; border-radius: var(--radius-md); border: 1px solid var(--glass-border); outline: none; background: rgba(255,255,255,0.95); color: #000; text-transform: uppercase; font-weight: 700; width: 0; }
  #wb-word-input:disabled { background: rgba(200,200,200,0.3); color: var(--text-muted); }
  #wb-input-form button { padding: 0.75rem 1.25rem; font-size: 1.1rem; border-radius: var(--radius-md); border: none; background: var(--accent-green); color: #000; font-weight: 700; cursor: pointer; transition: background 0.2s; }
  #wb-input-form button:hover { background: #00a844; }
  .wb-explosion-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999; display: flex; align-items: center; justify-content: center; font-size: 12rem; animation: wb-explode 1s ease-out forwards; opacity: 0; }
  @keyframes wb-explode { 0% { transform: scale(0.3); opacity: 1; } 40% { transform: scale(1.5); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
  .wb-status { font-size: 0.9rem; color: var(--text-secondary); text-align: center; }
`;
document.head.appendChild(wbStyle);

let hostTimerInterval;
let visualTimerRAF;

function getRandomCombo(rotations) {
  let allowed = ['easy'];
  if (rotations >= 3 && rotations <= 5) allowed = ['easy', 'medium'];
  else if (rotations >= 6) allowed = ['medium', 'hard'];
  
  const combos = window.LETTER_COMBOS.filter(c => allowed.includes(c.difficulty));
  if (combos.length === 0) return window.LETTER_COMBOS[0];
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
  
  let count = 3;
  const interval = setInterval(async () => {
    count--;
    if (count <= 0) {
      clearInterval(interval);
      const timeLimit = gs.is_hardcore ? 3500 : 8000;
      const playGs = { ...gs, phase: 'playing', turn_end_time: Date.now() + timeLimit };
      await fastUpdateGameState(playGs);
      startHostTimer();
    } else {
      await fastUpdateGameState({ ...gs, countdown: count });
    }
  }, 1000);
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
  const timeLimit = gs.is_hardcore ? 3000 : 8000;
  gs.turn_end_time = Date.now() + timeLimit;
  gs.submitted_word = null;
  
  if (window.wordbombBotTimeout) {
    clearTimeout(window.wordbombBotTimeout);
    window.wordbombBotTimeout = null;
  }
}

async function handleTimeout(gs) {
  const pid = gs.turn_order[gs.current_turn];
  gs.lives[pid]--;
  gs.explosion = { playerId: pid, time: Date.now() };
  
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
  
  const word = sub.word.toLowerCase();
  const combo = gs.current_combo.combo.toLowerCase();
  
  if (word.includes(combo) && window.WORD_DICTIONARY.has(word) && !gs.used_words.includes(word)) {
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

  const container = $('#wordbomb-main-area');
  if (!container) return;

  if (gs.phase === 'countdown') {
    container.innerHTML = `
      <div class="wb-countdown-container">
        <h2 style="color:var(--text-secondary);margin-bottom:1rem;">GET READY!</h2>
        <div class="wb-countdown">${gs.countdown}</div>
      </div>
    `;
    return;
  }
  
  if (gs.phase === 'game_over') {
    showGameOver(gs);
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
        <div class="wb-center-area">
           <div class="wb-timer">8.0</div>
           <div class="wb-combo-box">
             <div class="wb-combo"></div>
           </div>
           <div class="wb-last-word"></div>
           <form id="wb-input-form">
             <input type="text" id="wb-word-input" autocomplete="off" placeholder="Type a word..." />
             <button type="submit">GO</button>
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
    
    startVisualTimer();
  }
  
  updatePlayerDisplay(gs);
  
  const comboEl = $('.wb-combo');
  if (comboEl) comboEl.textContent = gs.current_combo.combo.toUpperCase();
  
  const lastWordEl = $('.wb-last-word');
  if (lastWordEl) {
    lastWordEl.textContent = gs.last_word ? `✓ ${gs.last_word.toUpperCase()}` : '';
  }
  
  const input = $('#wb-word-input');
  const isMyTurn = gs.turn_order[gs.current_turn] === state.playerId;
  if (input) {
    if (isMyTurn && !gs.eliminated.includes(state.playerId)) {
      if (input.disabled) {
        input.disabled = false;
        input.value = '';
        input.placeholder = 'Type a word...';
        setTimeout(() => input.focus(), 50);
      }
    } else {
      input.disabled = true;
      input.value = '';
      const currentP = state.players.find(p => p.id === gs.turn_order[gs.current_turn]);
      input.placeholder = currentP ? `${currentP.nickname}'s turn...` : 'Waiting...';
    }
  }
  
  const statusEl = $('.wb-status');
  if (statusEl) {
    statusEl.textContent = `${gs.used_words.length} words used`;
  }

  // Explosion animation
  if (gs.explosion && window._lastExplosionTime !== gs.explosion.time) {
    window._lastExplosionTime = gs.explosion.time;
    showExplosion();
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
    
    html += `
      <div class="wb-player ${current ? 'wb-current' : ''} ${dead ? 'wb-dead' : ''}">
        <div class="wb-player-name">${p.nickname}</div>
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
      if (el) {
        el.textContent = (left / 1000).toFixed(1);
        if (left < 3000 && left > 0) el.classList.add('urgent');
        else el.classList.remove('urgent');
      }
    }
    visualTimerRAF = requestAnimationFrame(tick);
  }
  visualTimerRAF = requestAnimationFrame(tick);
}

function showExplosion() {
  playSound('bomb');
  const el = document.createElement('div');
  el.className = 'wb-explosion-overlay';
  el.textContent = '💥';
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
    showToast("Not your turn!", 'error');
    return;
  }
  
  const combo = gs.current_combo.combo.toLowerCase();
  
  if (!word.includes(combo)) {
    playSound('wrong');
    showToast(isAz() ? `"${combo.toUpperCase()}" hərflərini ehtiva etməlidir!` : `Must contain "${combo.toUpperCase()}"`, 'error');
    input.value = '';
    input.focus();
    return;
  }
  if (!window.WORD_DICTIONARY.has(word)) {
    playSound('wrong');
    showToast(isAz() ? 'Lüğətdə tapılmadı!' : 'Not in dictionary!', 'error');
    input.value = '';
    input.focus();
    return;
  }
  if (gs.used_words.includes(word)) {
    playSound('wrong');
    showToast(isAz() ? 'Artıq istifadə olunub!' : 'Already used!', 'error');
    input.value = '';
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
// BOT AI
// ========================================================================
window.processWordBombBotActions = function(gs) {
  if (gs.phase !== 'playing') return;
  
  const pid = gs.turn_order[gs.current_turn];
  const bot = state.players.find(p => p.id === pid);
  
  if (bot && bot.nickname.startsWith('Bot_')) {
    if (window.wordbombBotTimeout) return;
    
    const timeLeft = gs.turn_end_time - Date.now();
    if (timeLeft <= 0) return;

    const delay = 2000 + Math.random() * 3000;
    
    window.wordbombBotTimeout = setTimeout(async () => {
      const currentGs = state.room?.game_state;
      if (!currentGs || currentGs.phase !== 'playing' || currentGs.turn_order[currentGs.current_turn] !== pid) {
        window.wordbombBotTimeout = null;
        return;
      }
      
      const combo = currentGs.current_combo.combo.toLowerCase();
      // Search dictionary for valid words
      let validWord = null;
      for (const w of window.WORD_DICTIONARY) {
        if (w.includes(combo) && !currentGs.used_words.includes(w)) {
          validWord = w;
          break;
        }
      }
      
      if (validWord) {
        const updatedGs = { ...currentGs, submitted_word: { word: validWord, playerId: pid, time: Date.now() } };
        await fastUpdateGameState(updatedGs);
      }
      // If no valid word found, bot just lets the timer expire
      
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
  
  title.textContent = winner ? `${winner.nickname} Survives!` : 'Everyone Exploded!';
  msg.textContent = `Word Bomb — ${gs.used_words.length} words played`;
  
  let html = '<h3>Final Standing</h3><ul class="standings-list">';
  
  // Show elimination order (last eliminated = 2nd place, etc.)
  const alive = gs.turn_order.filter(id => !gs.eliminated.includes(id));
  const elim = [...gs.eliminated].reverse();
  const ranking = [...alive, ...elim];
  
  ranking.forEach((id, i) => {
    const p = state.players.find(x => x.id === id);
    const medal = i === 0 ? '🏆 ' : '';
    const lives = gs.lives[id] || 0;
    const status = gs.eliminated.includes(id) ? '💀' : `${lives} ❤️`;
    html += `<li>${medal}${p?.nickname || '???'}: ${status}</li>`;
  });
  html += '</ul>';
  details.innerHTML = html;
  
  const lobbyBtn = $('#gameover-lobby-btn');
  if (state.isHost) lobbyBtn.style.display = 'block';
  else lobbyBtn.style.display = 'none';
};
