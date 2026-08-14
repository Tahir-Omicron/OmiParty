/**
 * Otaq.gg - app.js
 * Handles Supabase init, player identity, room management, realtime subscriptions,
 * and complete game logic for Sabotage and Auction Chaos.
 */

// ============================================================================
// 1. CONFIG & INIT
// ============================================================================
// Supabase init moved to shared.js

// ============================================================================
// 2. CONSTANTS
// ============================================================================
const MISSION_CONFIG = {
  3: { sizes: [2, 2, 2, 3, 3], saboteurs: 1 },
  4: { sizes: [2, 2, 2, 3, 3], saboteurs: 1 },
  5: { sizes: [2, 3, 2, 3, 3], saboteurs: 2 },
  6: { sizes: [2, 3, 4, 3, 4], saboteurs: 2 },
  7: { sizes: [2, 3, 3, 4, 4], saboteurs: 3 },
  8: { sizes: [3, 4, 4, 5, 5], saboteurs: 3 },
  9: { sizes: [3, 4, 4, 5, 5], saboteurs: 3 },
  10: { sizes: [3, 4, 4, 5, 5], saboteurs: 4 },
};

const EVENT_CARDS = [
  // Penalties (~60%)
  { type: 'penalty', value: 10, text: 'Minor Glitch', description: 'A hiccup in the system.' },
  { type: 'penalty', value: 12, text: 'Pickpocket', description: 'Sticky fingers in the crowd.' },
  { type: 'penalty', value: 15, text: 'Tax Collector', description: 'The taxman cometh.' },
  { type: 'penalty', value: 15, text: 'Bad Investment', description: 'Should have read the fine print.' },
  { type: 'penalty', value: 18, text: 'Caught Speeding', description: 'Those fines add up fast.' },
  { type: 'penalty', value: 20, text: 'System Crash', description: 'A server meltdown costs someone dearly.' },
  { type: 'penalty', value: 20, text: 'Bar Tab', description: 'Somebody ran up the tab.' },
  { type: 'penalty', value: 22, text: 'Lawsuit', description: 'See you in court. Bring your wallet.' },
  { type: 'penalty', value: 25, text: 'Hostile Takeover', description: 'Corporate raiders strike.' },
  { type: 'penalty', value: 25, text: 'Identity Theft', description: 'Your credit score just tanked.' },
  { type: 'penalty', value: 28, text: 'Market Crash', description: 'Everything just halved in value.' },
  { type: 'penalty', value: 30, text: 'Total Wipeout', description: 'Catastrophic failure.' },
  { type: 'penalty', value: 30, text: 'Ransom Note', description: 'They have your cat. Pay up.' },
  { type: 'penalty', value: 35, text: 'Armageddon', description: 'The big one. Brace yourself.' },
  { type: 'penalty', value: 15, text: 'Parking Ticket', description: 'Expired meter. Classic.' },
  { type: 'penalty', value: 20, text: 'Food Poisoning', description: 'That sushi was suspicious.' },
  // Bonuses (~30%)
  { type: 'bonus', value: 8, text: 'Loose Change', description: 'Coins in the couch cushions.' },
  { type: 'bonus', value: 10, text: 'Lucky Break', description: 'Fortune favors the bold.' },
  { type: 'bonus', value: 12, text: 'Side Hustle', description: 'Weekend gig came through.' },
  { type: 'bonus', value: 15, text: 'Inheritance', description: 'A distant relative remembered you.' },
  { type: 'bonus', value: 15, text: 'Windfall', description: 'Money from the sky.' },
  { type: 'bonus', value: 18, text: 'Stock Surge', description: 'Diamond hands paid off.' },
  { type: 'bonus', value: 20, text: 'Jackpot', description: 'Three cherries. Cha-ching.' },
  { type: 'bonus', value: 25, text: 'Golden Ticket', description: 'Once in a lifetime opportunity.' },
  { type: 'bonus', value: 10, text: 'Tax Refund', description: 'The government giveth back.' },
  // Complex Events (~10%)
  { type: 'event_switcharoo', value: 0, text: 'Switcharoo', description: 'Highest and lowest bidders swap their HP.' },
  { type: 'event_tax', value: 0, text: 'Wealth Tax', description: 'The player with the most HP loses 20% of their health.' },
  { type: 'event_vampire', value: 0, text: 'Vampire Bat', description: 'Highest bidder steals 15 HP from the lowest bidder.' }
];

const BID_TIMER_SECONDS = 15;
const RESULT_DISPLAY_MS = 5000;
const ROLE_REVEAL_MS = 8000;
const MIN_PLAYERS_SABOTAGE = 3;
const MIN_PLAYERS_AUCTION = 3;
const MIN_PLAYERS_CANVAS = 3;
const MIN_PLAYERS_WORDBOMB = 3;

// ============================================================================
// 3. APP STATE
// ============================================================================
// App state moved to shared.js

// ============================================================================
// 4. UTILITY FUNCTIONS
// ============================================================================
function generateRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excluded I, L, O, 0, 1
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function showScreen(screenName) {
  const screens = $$('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = $(`[data-screen="${screenName}"]`);
  if (target) {
    target.classList.add('active');
  }
}

// Utilities moved to shared.js
// ============================================================================
// 5. IDENTITY MANAGEMENT
// ============================================================================
async function resumeGame(code) {
  state.roomCode = code;
  const { data: room, error } = await db.from('rooms').select('*').eq('code', code).single();
  if (error || !room) {
    window.location.href = 'index.html';
    return;
  }
  state.room = room;
  state.isHost = (room.host_id === state.playerId);
  
  const { data: players } = await db.from('players').select('*').eq('room_code', code);
  if (players) state.players = players;
  
  subscribeToRoom(code);
  subscribeToPlayers(code);
  onGameStateUpdate(state.room.game_state);
}

async function init() {
  bindEventListeners();
  
  // Always fetch session first so state.playerId is populated
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user) {
    // This sets state.playerId, state.profile, etc.
    await finishAuth(session.user);
  }
  
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    // If returning via URL (e.g. sabotage.html?code=...), resume the game
    if (!state.playerId) {
      window.location.href = 'index.html'; // Must be logged in to resume
      return;
    }
    await resumeGame(code);
    return;
  }
  
  // If not resuming a game and not logged in, show auth
  if (!state.playerId) {
    showScreen('auth');
  }
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================================
// 6. SCREEN: NICKNAME
// ============================================================================
async function handleLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || !password) return showToast('Please enter email and password.', 'error');
  
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) return showToast(error.message, 'error');
  
  await finishAuth(data.user);
}

async function handleRegister() {
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const nickname = $('#reg-nickname').value.trim();
  if (!email || !password || !nickname) return showToast('Please fill all fields.', 'error');
  
  const { data, error } = await db.auth.signUp({
    email, password, options: { 
      data: { nickname },
      emailRedirectTo: 'https://omi-party.vercel.app/'
    }
  });
  if (error) return showToast(error.message, 'error');
  
  await finishAuth(data.user);
}

function handleGuestLogin() {
  let defaultName = 'Guest_' + Math.floor(Math.random() * 1000);
  const input = $('#guest-nickname-input');
  if (input) {
      input.value = defaultName;
      $('#guest-modal').style.display = 'flex';
      input.focus();
  }
}

function processGuestLogin() {
  const input = $('#guest-nickname-input');
  const nickname = input ? input.value.trim() : 'Guest';
  
  state.playerId = crypto.randomUUID();
  state.nickname = nickname.substring(0, 16) || 'Guest';
  state.profile = { level: 1, xp: 0, avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${state.playerId}` };
  
  if ($('#menu-nickname')) {
    $('#menu-nickname').textContent = state.nickname;
    $('#profile-level').textContent = '1';
    $('#profile-avatar').src = state.profile.avatar_url;
    $('#profile-xp-bar').style.width = '0%';
  }
  
  if ($('#guest-modal')) {
      $('#guest-modal').style.display = 'none';
  }
  showScreen('menu');
}

async function finishAuth(user) {
  state.playerId = user.id;
  
  // Wait a sec for the trigger to insert the profile if they just registered
  await new Promise(r => setTimeout(r, 1000));
  
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (profile) {
    state.nickname = profile.nickname;
    state.profile = profile;
    
    if ($('#menu-nickname')) {
      $('#menu-nickname').textContent = state.nickname;
      $('#profile-level').textContent = profile.level;
      $('#profile-avatar').src = profile.avatar_url;
      const progress = (profile.xp % 100) + '%';
      $('#profile-xp-bar').style.width = progress;
    }
  } else {
    // Fallback if SQL trigger failed or hasn't run yet
    state.nickname = user.user_metadata?.nickname || 'Player';
    state.profile = { level: 1, xp: 0, avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=default' };
    
    if ($('#menu-nickname')) {
      $('#menu-nickname').textContent = state.nickname;
      $('#profile-level').textContent = '1';
      $('#profile-avatar').src = state.profile.avatar_url;
      $('#profile-xp-bar').style.width = '0%';
    }
  }
  
  const path = window.location.pathname;
  if (path === '/' || path.endsWith('index.html') || path.endsWith('index-az.html')) {
    showScreen('menu');
  }
}

async function handleLogout() {
  await db.auth.signOut();
  state.playerId = null;
  state.nickname = null;
  state.profile = null;
  showScreen('auth');
}

window.updateUserAvatar = async function(src) {
    if(!state.profile) return;
    await db.from('profiles').update({ avatar_url: src }).eq('id', state.playerId);
    state.profile.avatar_url = src;
    $('#profile-avatar').src = src;
    if(state.roomCode) {
        db.from('players').update({ avatar_url: src }).eq('id', state.playerId);
    }
}

// ============================================================================
// 7. SCREEN: MENU
// ============================================================================
async function handleCreateRoom() {
  const code = generateRoomCode();
  try {
    const { error: roomError } = await db.from('rooms').insert({
      code: code,
      host_id: state.playerId,
      status: 'lobby'
    });
    
    if (roomError) throw roomError;

    const playerData = {
      id: state.playerId,
      room_code: code,
      nickname: state.nickname,
      is_host: true,
      avatar_url: state.profile?.avatar_url,
      level: state.profile?.level || 1
    };

    const { error: playerError } = await db.from('players').upsert(playerData);
    
    if (playerError) {
      console.warn("Upsert with avatar failed, trying without (SQL not updated?):", playerError);
      delete playerData.avatar_url;
      delete playerData.level;
      const { error: fallbackError } = await db.from('players').upsert(playerData);
      if (fallbackError) throw fallbackError;
    }

    state.isHost = true;
    enterLobby(code);
    
  } catch (err) {
    console.error('Error creating room:', err);
    showToast('Failed to create room. Please try again.', 'error');
  }
}

async function handleJoinRoom() {
  const input = $('#join-code-input');
  const code = input.value.toUpperCase().trim();
  
  if (code.length !== 5) {
    showToast('Room code must be 5 characters.', 'error');
    return;
  }
  
  try {
    // Check if room exists and is in lobby
    const { data: rooms, error: roomError } = await db
      .from('rooms')
      .select('*')
      .eq('code', code)
      .eq('status', 'lobby');
      
    if (roomError) throw roomError;
    
    if (!rooms || rooms.length === 0) {
      showToast('Room not found or game already started.', 'error');
      return;
    }
    
    // Attempt to insert player
    const playerData = {
      id: state.playerId,
      room_code: code,
      nickname: state.nickname,
      is_host: false,
      avatar_url: state.profile?.avatar_url,
      level: state.profile?.level || 1
    };
    
    const { error: playerError } = await db.from('players').upsert(playerData);
    
    // If it fails with a duplicate key, they are already in the room. Just proceed.
    if (playerError && playerError.code !== '23505') {
      console.warn("Upsert with avatar failed, trying without:", playerError);
      delete playerData.avatar_url;
      delete playerData.level;
      const { error: fallbackError } = await db.from('players').upsert(playerData);
      if (fallbackError && fallbackError.code !== '23505') throw fallbackError;
    }
    
    state.isHost = false;
    enterLobby(code);
    
  } catch (err) {
    console.error('Error joining room:', err);
    showToast('Failed to join room.', 'error');
  }
}

// ============================================================================
// 8. SCREEN: LOBBY
// ============================================================================
async function enterLobby(roomCode) {
  state.roomCode = roomCode;
  localStorage.setItem('otaq_current_room', roomCode);
  
  $('#lobby-code').textContent = roomCode;
  
  // Host UI setup
  const hostControls = $('#lobby-host-controls');
  if (state.isHost) {
    hostControls.style.display = 'flex';
  } else {
    hostControls.style.display = 'none';
  }

  // Initial data fetch
  await fetchRoomAndPlayers();
  
  // Setup Realtime
  subscribeToRoom(roomCode);
  subscribeToPlayers(roomCode);
  
  showScreen('lobby');
}

async function fetchRoomAndPlayers() {
  if (!state.roomCode) return;
  try {
    const { data: roomData } = await db.from('rooms').select('*').eq('code', state.roomCode).single();
    if (roomData) state.room = roomData;
    
    const { data: playersData } = await db.from('players').select('*').eq('room_code', state.roomCode);
    if (playersData) {
      state.players = playersData;
      renderLobby();
    }
  } catch (e) {
    console.error('Initial fetch failed:', e);
  }
}

function renderLobby() {
  if (!$('#lobby-players')) return; // Ensure we are on index.html
  
  const list = $('#lobby-players');
  list.innerHTML = '';
  
  // Show host-only controls
  const hardcoreContainer = document.querySelector('.hardcore-toggle-container');
  if (hardcoreContainer) {
    hardcoreContainer.style.display = state.isHost ? 'flex' : 'none';
  }
  
  state.players.forEach(player => {
    const card = document.createElement('div');
    card.className = `player-card ${player.is_host ? 'host' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    avatar.textContent = player.nickname.charAt(0).toUpperCase();
    
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.nickname;
    
    card.appendChild(avatar);
    card.appendChild(name);
    list.appendChild(card);
  });
  
  const count = state.players.length;
  let required = 0;
  let modeLabel = '';
  if (state.selectedMode === 'sabotage') { required = MIN_PLAYERS_SABOTAGE; modeLabel = 'Sabotage'; }
  else if (state.selectedMode === 'auction') { required = MIN_PLAYERS_AUCTION; modeLabel = 'Auction Chaos'; }
  else if (state.selectedMode === 'canvas') { required = MIN_PLAYERS_CANVAS; modeLabel = 'Canvas'; }
  else if (state.selectedMode === 'wordbomb') { required = MIN_PLAYERS_WORDBOMB; modeLabel = 'Wordbomb'; }
  
  let countText = `${count} Player${count !== 1 ? 's' : ''} connected`;
  if (state.isHost && state.selectedMode && count < required) {
    countText += ` — Need ${required - count} more for ${modeLabel}`;
  }
  $('#lobby-player-count').textContent = countText;
  
  const startBtn = $('#start-game-btn');
  if (startBtn) {
    startBtn.disabled = !(state.selectedMode && count >= required);
  }
}

function handleGameModeSelect(mode) {
  $$('.mode-card').forEach(c => c.classList.remove('selected'));
  const card = $(`[data-mode="${mode}"]`);
  if (card) card.classList.add('selected');
  
  state.selectedMode = mode;
  renderLobby(); // re-evaluates button disabled state
}

async function handleStartGame() {
  if (!state.isHost || !state.selectedMode) return;
  const count = state.players.length;
  
  if (state.selectedMode === 'sabotage' && count < MIN_PLAYERS_SABOTAGE) {
    showToast(`Need at least ${MIN_PLAYERS_SABOTAGE} players.`, 'error');
    return;
  }
  if (state.selectedMode === 'auction' && count < MIN_PLAYERS_AUCTION) {
    showToast(`Need at least ${MIN_PLAYERS_AUCTION} players.`, 'error');
    return;
  }
  if (state.selectedMode === 'canvas' && count < MIN_PLAYERS_CANVAS) {
    showToast(`Need at least ${MIN_PLAYERS_CANVAS} players.`, 'error');
    return;
  }
  if (state.selectedMode === 'wordbomb' && count < MIN_PLAYERS_WORDBOMB) {
    showToast(`Need at least ${MIN_PLAYERS_WORDBOMB} players.`, 'error');
    return;
  }
  
  if (state.selectedMode === 'sabotage') {
    await startSabotageGame();
  } else if (state.selectedMode === 'auction') {
    await startAuctionGame();
  } else if (state.selectedMode === 'canvas') {
    await window.startCanvasGame();
  } else if (state.selectedMode === 'wordbomb') {
    await window.startWordBombGame();
  }
}

async function handleAddBot() {
  if (!state.roomCode || !state.isHost) return;
  
  const botId = crypto.randomUUID();
  const botNames = ['Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 'Bot_Echo'];
  // Pick a random name not currently in the room (or just random if all taken)
  const availableNames = botNames.filter(n => !state.players.some(p => p.nickname === n));
  const botName = availableNames.length > 0 
    ? availableNames[Math.floor(Math.random() * availableNames.length)]
    : `Bot_${Math.floor(Math.random() * 1000)}`;
    
  // AI Bot matches host's level +/- 3 for fair gameplay
  const hostLevel = state.profile?.level || 1;
  const variance = Math.floor(Math.random() * 7) - 3; // -3 to +3
  const botLevel = Math.max(1, Math.min(100, hostLevel + variance));
  
  const botAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${botName}`;
    
  try {
    const botData = {
      id: botId,
      room_code: state.roomCode,
      nickname: botName,
      is_host: false,
      avatar_url: botAvatar,
      level: botLevel
    };
    
    const { error } = await db.from('players').insert(botData);
    if (error) {
      console.warn("Bot insert with avatar failed, trying without:", error);
      delete botData.avatar_url;
      delete botData.level;
      const { error: fallbackError } = await db.from('players').insert(botData);
      if (fallbackError) throw fallbackError;
    }
  } catch (err) {
    console.error('Error adding bot:', err);
    showToast('Failed to add bot.', 'error');
  }
}

async function handleLeaveRoom() {
  if (state.roomCode && state.playerId) {
    try {
      await db.from('players').delete().eq('id', state.playerId);
    } catch (e) {
      console.error('Error leaving room', e);
    }
  }
  
  unsubscribeAll();
  state.roomCode = null;
  state.room = null;
  state.players = [];
  state.isHost = false;
  state.selectedMode = null;
  localStorage.removeItem('otaq_current_room');
  showScreen('menu');
}
// 9. REALTIME SUBSCRIPTIONS
// ============================================================================
function subscribeToRoom(roomCode) {
  state.channel = db.channel(`room:${roomCode}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` }, handleRoomChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_code=eq.${roomCode}` }, handlePlayersChange)
    .on('broadcast', { event: 'chat_message' }, (payload) => {
      if (payload.payload) {
        appendChatMessage(payload.payload.sender, payload.payload.text);
      }
    })
    .on('broadcast', { event: 'state_update' }, (payload) => {
      if (payload.payload && state.room) {
        state.room.game_state = payload.payload;
        onGameStateUpdate(payload.payload);
      }
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });
  state.channels.push(state.channel);
}

// Ultra-fast optimistic UI & broadcast update to bypass Postgres latency
window.fastUpdateGameState = async function(gs, extraUpdates = {}) {
  if (!state.room) return;
  state.room.game_state = gs;
  onGameStateUpdate(gs); // Optimistic local update
  
  const channel = state.channels.find(c => c.topic === `realtime:room-${state.roomCode}`);
  if (channel) {
    channel.send({ type: 'broadcast', event: 'state_update', payload: gs });
  }
  
  await db.from('rooms').update({ game_state: gs, ...extraUpdates }).eq('code', state.roomCode);
};

// Aliased for internal use
const fastUpdateGameState = window.fastUpdateGameState;

function subscribeToPlayers(roomCode) {
  const channel = db.channel(`players-${roomCode}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: `room_code=eq.${roomCode}`
    }, handlePlayersChange)
    .subscribe();
  state.channels.push(channel);
}

function unsubscribeAll() {
  state.channels.forEach(ch => db.removeChannel(ch));
  state.channels = [];
}

function sendChatMessage() {
  const input = $('#lobby-chat-input');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  input.value = '';
  
  if (state.channel) {
    state.channel.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: { sender: state.nickname, text: text }
    });
  }
  // Show locally immediately
  appendChatMessage(state.nickname, text);
}

function appendChatMessage(sender, text) {
  const messagesDiv = $('#lobby-chat-messages');
  if (!messagesDiv) return;
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  
  const senderSpan = document.createElement('span');
  senderSpan.className = 'sender';
  senderSpan.textContent = sender + ':';
  
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  
  msgDiv.appendChild(senderSpan);
  msgDiv.appendChild(textSpan);
  messagesDiv.appendChild(msgDiv);
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function handleRoomChange(payload) {
  if (payload.eventType === 'UPDATE') {
    state.room = payload.new;
    
    if (state.room.status === 'playing' && state.room.game_state) {
      onGameStateUpdate(state.room.game_state);
    } else if (state.room.status === 'lobby') {
      // Reset local game state
      state.voteCast = false;
      state.bidLocked = false;
      state.selectedMode = null;
      state.usedCardIndices = [];
      clearInterval(state.bidTimerInterval);
      if (state.timerTimeout) clearTimeout(state.timerTimeout);
      fetchRoomAndPlayers();
      showScreen('lobby');
    }
  }
}

async function handlePlayersChange(payload) {
  // Always fetch fresh list to avoid tricky state issues
  const { data } = await db.from('players').select('*').eq('room_code', state.roomCode);
  if (data) {
    state.players = data;
    
    const isLobby = $$('.screen.active')[0]?.dataset.screen === 'lobby';
    if (isLobby) {
      renderLobby();
    }
    
    if (state.isHost && state.room && state.room.status === 'playing' && state.room.game_state) {
      const gs = state.room.game_state;
      if (state.room.game_mode === 'sabotage' && gs.phase === 'voting') {
        checkAllVotesIn();
      } else if (state.room.game_mode === 'auction' && gs.phase === 'bidding') {
        const aliveCount = state.players.filter(p => p.is_alive).length;
        const bidCount = state.players.filter(p => p.is_alive && p.bid !== null).length;
        if (bidCount === aliveCount && aliveCount > 0) {
          processBids();
        }
      }
    }
  }
}

// ============================================================================
// 10. GAME STATE ROUTER
// ============================================================================
function processBotActions(gs) {
  if (!state.isHost || !state.room) return;
  const bots = state.players.filter(p => p.nickname.startsWith('Bot_') && p.is_alive);
  if (bots.length === 0) return;

  if (state.room.game_mode === 'sabotage') {
    if (gs.phase === 'voting') {
      bots.forEach(bot => {
        if (gs.mission_team.includes(bot.id) && !bot.vote) {
          const delay = 1000 + Math.random() * 2000; // 1-3s delay
          setTimeout(async () => {
            // Check if already voted to avoid duplicate DB calls
            const currentBot = state.players.find(p => p.id === bot.id);
            if (currentBot && currentBot.vote) return;
            
            const vote = (currentBot.role === 'saboteur' || currentBot.role === 'assassin') ? 'sabotage' : 'success';
            await db.from('players').update({ vote }).eq('id', bot.id);
          }, delay);
        }
      });
    } else if (gs.phase === 'detective_phase' && !gs.detective_used) {
      bots.forEach(bot => {
        if (bot.role === 'detective') {
          setTimeout(async () => {
            const { data } = await db.from('rooms').select('game_state').eq('code', state.roomCode).single();
            if (data && !data.game_state.detective_used) {
              fastUpdateGameState({ ...data.game_state, detective_used: true });
            }
          }, 2000);
        }
      });
    } else if (gs.phase === 'assassin_phase' && !gs.assassin_target) {
      bots.forEach(bot => {
        if (bot.role === 'assassin') {
          setTimeout(async () => {
            const guards = state.players.filter(p => p.role !== 'saboteur' && p.role !== 'assassin');
            const target = guards[Math.floor(Math.random() * guards.length)];
            if (target) {
              const { data } = await db.from('rooms').select('game_state').eq('code', state.roomCode).single();
              if (data && !data.game_state.assassin_target) {
                fastUpdateGameState({ ...data.game_state, assassin_target: target.id });
              }
            }
          }, 3000);
        }
      });
    }
  } else if (state.room.game_mode === 'auction') {
    if (gs.phase === 'bidding') {
      bots.forEach(bot => {
        if (!bot.bid && bot.bid !== 0) {
          const delay = 1500 + Math.random() * 3000;
          setTimeout(async () => {
            const currentBot = state.players.find(p => p.id === bot.id);
            if (currentBot && (currentBot.bid || currentBot.bid === 0)) return;
            const maxBid = Math.floor(currentBot.hp * 0.5);
            const bid = Math.floor(Math.random() * (maxBid + 1));
            await db.from('players').update({ bid }).eq('id', bot.id);
          }, delay);
        }
      });
    }
  } else if (state.room.game_mode === 'canvas') {
    if (window.processCanvasBotActions) window.processCanvasBotActions(gs);
  } else if (state.room.game_mode === 'wordbomb') {
    if (window.processWordBombBotActions) window.processWordBombBotActions(gs);
  }
}

function onGameStateUpdate(gs) {
  if (!gs) return;
  
  // Sync Hardcore Mode UI for everyone
  const hardcoreToggle = $('#hardcore-mode-toggle');
  if (hardcoreToggle) {
    hardcoreToggle.checked = !!gs.is_hardcore;
  }
  
  if (state.room.game_mode && state.room.status === 'playing') {
    let modeHtml = state.room.game_mode + '.html';
    if (window.location.pathname.includes('-az.html')) {
        modeHtml = state.room.game_mode + '-az.html';
    }
    if (!window.location.pathname.endsWith(modeHtml)) {
      window.location.href = `${modeHtml}?code=${state.roomCode}`;
      return;
    }
  }

  if (state.isHost) {
    processBotActions(gs);
    
    // Host-driven state transitions for new Sabotage phases
    if (state.room.game_mode === 'sabotage') {
      if (gs.phase === 'detective_phase' && gs.detective_used) {
        if (!state.detectiveTimeout) {
          state.detectiveTimeout = setTimeout(() => {
            startMissionBriefing();
            state.detectiveTimeout = null;
          }, 4000);
        }
      }
      if (gs.phase === 'assassin_phase' && gs.assassin_target) {
        if (!state.assassinTimeout) {
          state.assassinTimeout = setTimeout(() => {
            const target = state.players.find(p => p.id === gs.assassin_target);
            const winner = (target && target.role === 'detective') ? 'saboteurs' : 'guards';
            fastUpdateGameState({ ...gs, phase: 'game_over', winner });
            const winnerIds = state.players.filter(p => (winner === 'guards' && p.role !== 'saboteur' && p.role !== 'assassin') || (winner === 'saboteurs' && (p.role === 'saboteur' || p.role === 'assassin'))).map(p => p.id);
            window.distributeXP(winnerIds);
            state.assassinTimeout = null;
          }, 3000);
        }
      }
    }
  }
  
  if (state.room.game_mode === 'sabotage') {
    handleSabotageState(gs);
  } else if (state.room.game_mode === 'auction') {
    handleAuctionState(gs);
  } else if (state.room.game_mode === 'canvas') {
    window.handleCanvasState(gs);
  } else if (state.room.game_mode === 'wordbomb') {
    window.handleWordBombState(gs);
  }
}

// ============================================================================
// 11. SABOTAGE GAME LOGIC
// ============================================================================
async function startSabotageGame() {
  const count = Math.min(state.players.length, 10);
  const config = MISSION_CONFIG[count] || MISSION_CONFIG[4];
  
  const shuffled = shuffleArray(state.players);
  const sabsCount = config.saboteurs;
  
  // Assign roles
  let hasAssassin = false;
  let hasDetective = false;
  for (let i = 0; i < shuffled.length; i++) {
    let role = 'guard';
    if (i < sabsCount) {
      role = !hasAssassin ? 'assassin' : 'saboteur';
      hasAssassin = true;
    } else {
      role = !hasDetective ? 'detective' : 'guard';
      hasDetective = true;
    }
    await db.from('players').update({ role }).eq('id', shuffled[i].id);
  }
  
  const gs = {
    phase: 'role_reveal',
    round: 1,
    guards_score: 0,
    saboteurs_score: 0,
    mission_team: [],
    mission_sizes: config.sizes,
    history: [],
    winner: null,
    detective_used: false,
    assassin_target: null
  };
  
  await fastUpdateGameState(gs, {
    status: 'playing',
    game_mode: 'sabotage'
  });
  
  setTimeout(() => {
    if (state.isHost && state.room.status === 'playing') {
      const gsPhase2 = { ...gs, phase: 'detective_phase' };
      fastUpdateGameState(gsPhase2);
    }
  }, gs.is_hardcore ? 3000 : ROLE_REVEAL_MS);
}

function handleSabotageState(gs) {
  switch (gs.phase) {
    case 'role_reveal':
      showScreen('sabotage');
      renderRoleReveal();
      break;
    case 'detective_phase':
      showScreen('sabotage');
      const detMe = state.players.find(p => p.id === state.playerId);
      if (detMe && detMe.role === 'detective' && !gs.detective_used) {
        const others = state.players.filter(p => p.id !== state.playerId);
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel">
            <h3 style="text-align:center;">Detective Phase</h3>
            <p style="text-align:center;">Select one player to reveal their true loyalty.</p>
            <div class="player-grid" style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;flex-wrap:wrap;">
              ${others.map(p => `<button class="btn btn-secondary btn-peek" data-id="${p.id}">${p.nickname}</button>`).join('')}
            </div>
          </div>
        `;
        $$('.btn-peek').forEach(b => {
          b.addEventListener('click', async (e) => {
            const targetId = e.target.dataset.id;
            const target = state.players.find(p => p.id === targetId);
            const isSab = target.role === 'saboteur' || target.role === 'assassin';
            $('#sabotage-main-area').innerHTML = `
              <div class="phase-panel" style="text-align:center;">
                <h3>Investigation Complete</h3>
                <p style="font-size:1.5rem;margin-top:1rem;">${target.nickname} is a <strong style="color:${isSab ? 'var(--accent-red)' : 'var(--accent-green)'};">${isSab ? 'SABOTEUR' : 'GUARD'}</strong>.</p>
              </div>
            `;
            fastUpdateGameState({ ...gs, detective_used: true });
          });
        });
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg">
            <div class="spinner"></div>
            <p>The Detective is investigating...</p>
          </div>
        `;
      }
      break;
    case 'assassin_phase':
      showScreen('sabotage');
      const assMe = state.players.find(p => p.id === state.playerId);
      if (assMe && assMe.role === 'assassin' && !gs.assassin_target) {
        const guards = state.players.filter(p => p.role !== 'saboteur' && p.role !== 'assassin');
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel">
            <h3 style="text-align:center;color:var(--accent-red);">Assassin Phase</h3>
            <p style="text-align:center;margin-bottom:1rem;">The Guards secured 3 missions. You have one chance to steal the win. Who is the Detective?</p>
            <div class="player-grid" style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
              ${guards.map(p => `<button class="btn btn-danger btn-assassinate" data-id="${p.id}">${p.nickname}</button>`).join('')}
            </div>
          </div>
        `;
        $$('.btn-assassinate').forEach(b => {
          b.addEventListener('click', async (e) => {
            const targetId = e.target.dataset.id;
            $('#sabotage-main-area').innerHTML = `
              <div class="waiting-msg">
                <div class="spinner"></div>
                <p>Assassination order placed. Resolving...</p>
              </div>
            `;
            fastUpdateGameState({ ...gs, assassin_target: targetId });
          });
        });
      } else if (gs.assassin_target) {
        const target = state.players.find(p => p.id === gs.assassin_target);
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel" style="text-align:center;">
            <h3 style="color:var(--accent-red);">Assassination Target Locked</h3>
            <p style="font-size:1.5rem;margin-top:1rem;">The Assassin targeted <strong>${target ? target.nickname : 'Someone'}</strong>!</p>
          </div>
        `;
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg">
            <div class="spinner"></div>
            <p>The Assassin is making their move...</p>
          </div>
        `;
      }
      break;
    case 'mission_briefing':
      showScreen('sabotage');
      renderSabotageScoreboard(gs);
      $('#sabotage-round-info').textContent = `ROUND ${gs.round} OF 5`;
      const mTeam = state.players.filter(p => gs.mission_team.includes(p.id));
      const isOnTeam = gs.mission_team.includes(state.playerId);
      $('#sabotage-main-area').innerHTML = `
        <div class="phase-panel">
          <h3 style="text-align:center;">Mission ${gs.round} — Team Selected</h3>
          <div class="mission-team">
            ${mTeam.map(p => `<div class="mission-player ${p.id === state.playerId ? 'you' : ''}">${p.nickname}</div>`).join('')}
          </div>
          <p class="mission-instruction">${isOnTeam ? 'You are on this mission. Prepare to vote!' : 'Waiting for the mission team to return...'}</p>
        </div>
      `;
      break;
    case 'voting':
      state.voteCast = false;
      renderSabotageScoreboard(gs);
      if (gs.mission_team.includes(state.playerId)) {
        const me = state.players.find(p => p.id === state.playerId);
        const canSabotage = me?.role === 'saboteur' || me?.role === 'assassin';
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel">
            <h3 style="text-align:center;">Cast Your Vote</h3>
            <div class="vote-area">
              <button id="vote-success-btn" class="btn btn-success btn-vote">✓ Success</button>
              ${canSabotage ? '<button id="vote-sabotage-btn" class="btn btn-danger btn-vote">✗ Sabotage</button>' : ''}
            </div>
          </div>
        `;
        $('#vote-success-btn').addEventListener('click', () => handleVote('success'));
        if (canSabotage) {
          $('#vote-sabotage-btn').addEventListener('click', () => handleVote('sabotage'));
        }
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg">
            <div class="spinner"></div>
            <p>The team is on a mission...</p>
          </div>
        `;
      }
      break;
    case 'result':
      renderSabotageScoreboard(gs);
      const lastResult = gs.history[gs.history.length - 1];
      const sabs = lastResult.sabotage_count;
      const resultColor = lastResult.result === 'success' ? 'var(--accent-green)' : 'var(--accent-red)';
      $('#sabotage-main-area').innerHTML = `
        <div class="phase-panel" style="text-align:center;">
          <div class="result-card">
            <h2 style="color:${resultColor};font-size:2rem;">Mission ${lastResult.result === 'success' ? 'SUCCESS' : 'FAILED'}!</h2>
            <p style="color:var(--text-secondary);margin-top:1rem;">Sabotage votes cast: ${sabs}</p>
          </div>
        </div>
      `;
      break;
    case 'game_over':
      showGameOver(gs);
      break;
  }
}

function renderRoleReveal() {
  const me = state.players.find(p => p.id === state.playerId);
  if (!me) return;
  const isSab = me.role === 'saboteur' || me.role === 'assassin';
  
  let icon = '🛡️';
  let title = 'GUARD';
  let desc = 'Protect the missions at all costs.';
  if (me.role === 'saboteur') {
    icon = '🗡️'; title = 'SABOTEUR'; desc = 'Secretly fail missions to win.';
  } else if (me.role === 'assassin') {
    icon = '☠️'; title = 'ASSASSIN'; desc = 'Fail missions, and assassinate the Detective if the Guards win.';
  } else if (me.role === 'detective') {
    icon = '🔍'; title = 'DETECTIVE'; desc = 'Protect missions. You will discover one player\'s true loyalty at the start.';
  }
  
  $('#sabotage-main-area').innerHTML = `
    <div class="phase-panel" style="display:flex;justify-content:center;padding:2rem 0;">
      <div id="sabotage-role-card" class="role-card ${isSab ? 'saboteur' : 'guard'}">
        <div class="role-card-inner">
          <div class="role-card-front">?</div>
          <div class="role-card-back">
            <span class="role-icon">${icon}</span>
            <span class="role-name">${title}</span>
            <span class="role-desc">${desc}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const rc = $('#sabotage-role-card');
    if (rc) rc.classList.add('revealed');
  }, 1000);
}

function renderSabotageScoreboard(gs) {
  // Use history to render dots
  const sb = $('#sabotage-scoreboard');
  if (!sb) return;
  sb.innerHTML = '';
  
  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('div');
    dot.className = 'score-dot';
    if (i < gs.history.length) {
      dot.classList.add(gs.history[i].result); // 'success' or 'fail'
    }
    sb.appendChild(dot);
  }
}

async function startMissionBriefing(overrideGs = null) {
  const gs = overrideGs || state.room.game_state;
  const size = gs.mission_sizes[gs.round - 1];
  
  const shuffled = shuffleArray(state.players);
  const team = shuffled.slice(0, size).map(p => p.id);
  
  await db.from('players').update({ vote: null }).eq('room_code', state.roomCode);
  
  const newGs = { ...gs, phase: 'mission_briefing', mission_team: team };
  await fastUpdateGameState(newGs);
  
  setTimeout(() => {
    if (state.isHost && state.room.game_state.phase === 'mission_briefing') {
      const gState = { ...state.room.game_state, phase: 'voting' };
      fastUpdateGameState(gState);
    }
  }, 4000);
}

async function handleVote(voteValue) {
  if (state.voteCast) return;
  state.voteCast = true;
  
  $('#sabotage-main-area').innerHTML = `
    <div class="waiting-msg">
      <div class="spinner"></div>
      <p>Vote cast! Waiting for others...</p>
    </div>
  `;
  
  await db.from('players').update({ vote: voteValue }).eq('id', state.playerId);
}

async function checkAllVotesIn() {
  const gs = state.room.game_state;
  const team = state.players.filter(p => gs.mission_team.includes(p.id));
  const missing = team.filter(p => p.vote === null);
  
  if (missing.length === 0) {
    calculateMissionResult();
  }
}

async function calculateMissionResult() {
  const gs = state.room.game_state;
  const team = state.players.filter(p => gs.mission_team.includes(p.id));
  
  let sabotageCount = 0;
  team.forEach(p => {
    if (p.vote === 'sabotage') sabotageCount++;
  });
  
  const result = sabotageCount > 0 ? 'fail' : 'success';
  let gScore = gs.guards_score;
  let sScore = gs.saboteurs_score;
  
  if (result === 'success') gScore++;
  else sScore++;
  
  const historyItem = { round: gs.round, result, sabotage_count: sabotageCount };
  const newGs = { 
    ...gs, 
    phase: 'result', 
    guards_score: gScore, 
    saboteurs_score: sScore,
    history: [...gs.history, historyItem]
  };
  
  await fastUpdateGameState(newGs);
  
  setTimeout(() => {
    if (!state.isHost) return;
    if (gScore >= 3) {
      fastUpdateGameState({ ...newGs, phase: 'assassin_phase' });
    } else if (sScore >= 3) {
      fastUpdateGameState({ ...newGs, phase: 'game_over', winner: 'saboteurs' });
      const saboteurIds = state.players.filter(p => p.role === 'saboteur' || p.role === 'assassin').map(p => p.id);
      window.distributeXP(saboteurIds);
    } else {
      newGs.round++;
      fastUpdateGameState(newGs).then(() => {
        startMissionBriefing(newGs);
      });
    }
  }, gs.is_hardcore ? 2000 : RESULT_DISPLAY_MS);
}

// ============================================================================
// 12. AUCTION CHAOS GAME LOGIC
// ============================================================================
async function startAuctionGame() {
  await db.from('players').update({ hp: 100, is_alive: true, bid: null }).eq('room_code', state.roomCode);
  state.usedCardIndices = [];
  
  const eventCard = drawEventCard();
  
  const gs = {
    phase: 'event_reveal',
    round: 1,
    current_event: eventCard,
    bid_deadline: null,
    history: [],
    winner: null,
    results_summary: null
  };
  
  await fastUpdateGameState(gs, {
    status: 'playing',
    game_mode: 'auction'
  });
  
  setTimeout(() => {
    if (state.isHost && state.room.status === 'playing') {
      startBiddingPhase();
    }
  }, 4000);
}

function drawEventCard() {
  if (state.usedCardIndices.length >= EVENT_CARDS.length) {
    state.usedCardIndices = [];
  }
  let index;
  do {
    index = Math.floor(Math.random() * EVENT_CARDS.length);
  } while (state.usedCardIndices.includes(index));
  
  state.usedCardIndices.push(index);
  return EVENT_CARDS[index];
}

function handleAuctionState(gs) {
  showScreen('auction');
  const main = $('#auction-main-area');
  
  switch (gs.phase) {
    case 'event_reveal':
      state.bidLocked = false;
      main.innerHTML = `<div id="event-card-container"></div>`;
      renderEventCard(gs.current_event);
      renderHPBars();
      $('#auction-round-info').textContent = `ROUND ${gs.round}`;
      break;
    case 'bidding':
      renderHPBars();
      const me = state.players.find(p => p.id === state.playerId);
      if (!me.is_alive) {
        main.innerHTML = `<div class="waiting-msg"><p>You have been eliminated. Spectating...</p></div>`;
      } else if (me.bid !== null || state.bidLocked) {
        main.innerHTML = `<div class="waiting-msg"><div class="spinner"></div><p>Bid locked! Waiting for others...</p></div>`;
      } else {
        main.innerHTML = `
          <div class="phase-panel">
            <div class="timer-container">
              <div class="timer-bar"><div id="timer-fill" class="timer-fill"></div></div>
              <span id="timer-seconds"></span>
            </div>
            <div class="bid-controls">
              <input type="range" id="auction-bid-slider" class="bid-slider" min="0" max="${me.hp}" value="0">
              <div class="bid-display">Your bid: <span id="bid-value" class="bid-value">0</span> HP</div>
              <button id="auction-bid-btn" class="btn btn-gold">Lock In Bid</button>
            </div>
          </div>
        `;
        $('#auction-bid-slider').addEventListener('input', (e) => {
          $('#bid-value').textContent = `${e.target.value}`;
        });
        $('#auction-bid-btn').addEventListener('click', handleBidSubmit);
        startBidTimer(gs.bid_deadline);
      }
      break;
    case 'results':
      clearInterval(state.bidTimerInterval);
      renderAuctionResults(gs);
      break;
    case 'game_over':
      showGameOver(gs);
      break;
  }
}

function renderEventCard(event) {
  const container = $('#event-card-container');
  if (!container) return;
  const sign = event.type === 'penalty' ? '-' : '+';
  const cClass = event.type === 'penalty' ? 'penalty' : 'bonus';
  container.innerHTML = `
    <div class="event-card ${cClass}">
      <span class="event-type">${event.type.replace('event_', '').toUpperCase()}</span>
      <div class="event-value">${event.value ? sign + event.value + ' HP' : 'SPECIAL'}</div>
      <div class="event-text">${event.text}</div>
      <div class="event-description">${event.description}</div>
    </div>
  `;
}

function renderHPBars() {
  const container = $('#auction-hp-bars');
  if (!container) return;
  container.innerHTML = '';
  
  const sorted = [...state.players].sort((a, b) => b.hp - a.hp);
  
  sorted.forEach(p => {
    const row = document.createElement('div');
    row.className = `hp-bar-row ${!p.is_alive ? 'eliminated' : ''}`;
    
    let pct = Math.min(Math.max((p.hp / 100) * 100, 0), 100);
    
    let barColor = 'var(--accent-green)';
    if (pct <= 30) barColor = 'var(--accent-red)';
    else if (pct <= 60) barColor = 'var(--accent-gold)';
    
    row.innerHTML = `
      <div class="hp-bar-name">${p.nickname}</div>
      <div class="hp-bar">
        <div class="hp-bar-fill" style="width:${pct}%;background-color:${barColor};"></div>
      </div>
      <div class="hp-bar-value">${p.hp}</div>
    `;
    container.appendChild(row);
  });
}

async function startBiddingPhase() {
  await db.from('players').update({ bid: null }).eq('room_code', state.roomCode).eq('is_alive', true);
  
  const deadline = new Date(Date.now() + BID_TIMER_SECONDS * 1000).toISOString();
  const gs = state.room.game_state;
  
  const newGs = { ...gs, phase: 'bidding', bid_deadline: deadline };
  await fastUpdateGameState(newGs);
}

function startBidTimer(deadlineISO) {
  clearInterval(state.bidTimerInterval);
  const deadline = new Date(deadlineISO).getTime();
  
  state.bidTimerInterval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, deadline - now);
    const secs = Math.ceil(remaining / 1000);
    
    const txt = $('#timer-seconds');
    const fill = $('#timer-fill');
    if (txt) txt.textContent = `${secs}s`;
    if (fill) {
      const pct = (remaining / (BID_TIMER_SECONDS * 1000)) * 100;
      fill.style.width = `${pct}%`;
      if (secs <= 5) {
        fill.classList.add('danger');
      } else {
        fill.classList.remove('danger');
      }
    }
    
    if (remaining <= 0) {
      clearInterval(state.bidTimerInterval);
      if (state.isHost) {
        processBids();
      }
    }
  }, 100);
}

async function handleBidSubmit() {
  if (state.bidLocked) return;
  const slider = $('#auction-bid-slider');
  if (!slider) return;
  const val = parseInt(slider.value, 10);
  
  state.bidLocked = true;
  await db.from('players').update({ bid: val }).eq('id', state.playerId);
  
  const main = $('#auction-main-area');
  if (main) main.innerHTML = `<div class="waiting-msg"><div class="spinner"></div><p>Bid locked! Waiting...</p></div>`;
}

async function processBids() {
  // Prevent double processing
  if (state.timerTimeout) clearTimeout(state.timerTimeout);

  const gs = state.room.game_state;
  const alivePlayers = state.players.filter(p => p.is_alive);
  
  // Fill in missing bids
  const updates = [];
  alivePlayers.forEach(p => {
    if (p.bid === null) {
      p.bid = 0;
      updates.push({ id: p.id, bid: 0 });
    }
  });
  
  if (updates.length > 0) {
    for (const u of updates) {
      await db.from('players').update({ bid: u.bid }).eq('id', u.id);
    }
  }
  
  const event = gs.current_event;
  const resultsData = [];
  
  if (event.type === 'penalty') {
    let minBid = Infinity;
    alivePlayers.forEach(p => { if (p.bid < minBid) minBid = p.bid; });
    const losers = alivePlayers.filter(p => p.bid === minBid);
    
    alivePlayers.forEach(p => {
      let newHp = p.hp;
      let hpChange = 0;
      let status = 'safe';
      
      if (losers.includes(p)) {
        hpChange = -(p.bid + event.value);
        newHp += hpChange;
        status = 'hit';
      } else {
        hpChange = -p.bid;
        newHp += hpChange;
      }
      
      resultsData.push({ id: p.id, nickname: p.nickname, bid: p.bid, hpChange, newHp, status });
    });
  } else if (event.type === 'bonus') {
    let maxBid = -1;
    alivePlayers.forEach(p => { if (p.bid > maxBid) maxBid = p.bid; });
    const winners = alivePlayers.filter(p => p.bid === maxBid);
    const splitBonus = Math.floor(event.value / winners.length);
    
    alivePlayers.forEach(p => {
      let newHp = p.hp;
      let hpChange = 0;
      let status = 'miss';
      
      if (winners.includes(p)) {
        hpChange = -p.bid + splitBonus;
        newHp += hpChange;
        status = 'reward';
      } else {
        hpChange = -p.bid;
        newHp += hpChange;
      }
      
      resultsData.push({ id: p.id, nickname: p.nickname, bid: p.bid, hpChange, newHp, status });
    });
  } else if (event.type === 'event_switcharoo') {
    let maxBid = -1;
    let minBid = Infinity;
    alivePlayers.forEach(p => {
      if (p.bid > maxBid) maxBid = p.bid;
      if (p.bid < minBid) minBid = p.bid;
    });
    
    const highestBidders = alivePlayers.filter(p => p.bid === maxBid);
    const lowestBidders = alivePlayers.filter(p => p.bid === minBid);
    
    // Pick first if multiple
    const highest = highestBidders[0];
    const lowest = lowestBidders[0];
    
    alivePlayers.forEach(p => {
      let newHp = p.hp;
      let hpChange = 0;
      let status = 'safe';
      
      if (highest && lowest && highest.id !== lowest.id) {
        if (p.id === highest.id) {
          newHp = lowest.hp;
          hpChange = newHp - p.hp;
          status = hpChange > 0 ? 'reward' : 'hit';
        } else if (p.id === lowest.id) {
          newHp = highest.hp;
          hpChange = newHp - p.hp;
          status = hpChange > 0 ? 'reward' : 'hit';
        }
      } else {
        hpChange = -p.bid;
        newHp += hpChange;
      }
      
      resultsData.push({ id: p.id, nickname: p.nickname, bid: p.bid, hpChange, newHp, status });
    });
  } else if (event.type === 'event_tax') {
    let maxHp = -1;
    alivePlayers.forEach(p => { if (p.hp > maxHp) maxHp = p.hp; });
    const richest = alivePlayers.filter(p => p.hp === maxHp);
    
    alivePlayers.forEach(p => {
      let newHp = p.hp;
      let hpChange = 0;
      let status = 'safe';
      
      if (richest.includes(p)) {
        hpChange = -Math.floor(p.hp * 0.2); // lose 20%
        newHp += hpChange;
        status = 'hit';
      } else {
        hpChange = -p.bid; // pay bid anyway
        newHp += hpChange;
      }
      
      resultsData.push({ id: p.id, nickname: p.nickname, bid: p.bid, hpChange, newHp, status });
    });
  } else if (event.type === 'event_vampire') {
    let maxBid = -1;
    let minBid = Infinity;
    alivePlayers.forEach(p => {
      if (p.bid > maxBid) maxBid = p.bid;
      if (p.bid < minBid) minBid = p.bid;
    });
    const highest = alivePlayers.find(p => p.bid === maxBid);
    const lowest = alivePlayers.find(p => p.bid === minBid);
    
    alivePlayers.forEach(p => {
      let newHp = p.hp;
      let hpChange = 0;
      let status = 'safe';
      
      if (highest && lowest && highest.id !== lowest.id) {
        if (p.id === highest.id) {
          hpChange = 15;
          newHp += hpChange;
          status = 'reward';
        } else if (p.id === lowest.id) {
          hpChange = -15;
          newHp += hpChange;
          status = 'hit';
        } else {
          hpChange = -p.bid;
          newHp += hpChange;
        }
      } else {
        hpChange = -p.bid;
        newHp += hpChange;
      }
      
      resultsData.push({ id: p.id, nickname: p.nickname, bid: p.bid, hpChange, newHp, status });
    });
  }
  
  // Apply HP updates and eliminations
  for (const r of resultsData) {
    const finalHp = Math.max(0, r.newHp);
    const alive = finalHp > 0;
    await db.from('players').update({ hp: finalHp, is_alive: alive }).eq('id', r.id);
  }
  
  const newGs = { ...gs, phase: 'results', results_summary: resultsData };
  await fastUpdateGameState(newGs);
  
  state.timerTimeout = setTimeout(async () => {
    const { data: freshPlayers } = await db.from('players').select('*').eq('room_code', state.roomCode);
    const stillAlive = freshPlayers.filter(p => p.is_alive);
    
    if (stillAlive.length <= 1) {
      let winnerId = null;
      if (stillAlive.length === 1) {
        winnerId = stillAlive[0].id;
      } else {
        // all died, find max hp among dead as fallback
        const sorted = [...freshPlayers].sort((a,b) => b.hp - a.hp);
        winnerId = sorted[0]?.id;
      }
      fastUpdateGameState({ ...newGs, phase: 'game_over', winner: winnerId });
      if (winnerId) window.distributeXP([winnerId]);
    } else {
      newGs.round++;
      newGs.current_event = drawEventCard();
      newGs.phase = 'event_reveal';
      fastUpdateGameState(newGs).then(() => {
        setTimeout(() => {
          if (state.isHost) startBiddingPhase();
        }, 4000);
      });
    }
  }, gs.is_hardcore ? 2000 : RESULT_DISPLAY_MS);
}

function renderAuctionResults(gs) {
  const main = $('#auction-main-area');
  main.innerHTML = `<div id="event-card-container"></div>`;
  renderEventCard(gs.current_event);
  
  const summary = gs.results_summary || [];
  let html = '<div class="auction-results" style="margin-top:1.5rem;">';
  
  summary.forEach(r => {
    let rowClass = 'result-row';
    if (r.status === 'hit') rowClass += ' loser';
    if (r.status === 'reward') rowClass += ' winner';
    
    const sign = r.hpChange > 0 ? '+' : (r.hpChange === 0 ? '' : '');
    const changeColor = r.hpChange < 0 ? 'var(--accent-red)' : (r.hpChange > 0 ? 'var(--accent-green)' : 'var(--text-muted)');
    
    html += `
      <div class="${rowClass}">
        <span>${r.nickname} <span style="color:var(--text-muted);">(Bid: ${r.bid})</span></span>
        <span style="font-weight:700;color:${changeColor};">${sign}${r.hpChange} HP</span>
      </div>
    `;
  });
  html += '</div>';
  main.insertAdjacentHTML('beforeend', html);
  renderHPBars();
}

// ============================================================================
// 13. GAME OVER
// ============================================================================
function showGameOver(gs) {
  showScreen('gameover');
  const title = $('#gameover-title');
  const msg = $('#gameover-message');
  const details = $('#gameover-details');
  
  details.innerHTML = '';
  
  if (state.room.game_mode === 'sabotage') {
    if (gs.winner === 'guards') {
      title.textContent = 'Guards Win!';
      msg.textContent = 'The missions were successfully protected.';
    } else {
      title.textContent = 'Saboteurs Win!';
      msg.textContent = 'Chaos reigns supreme.';
    }
    
    const sabs = state.players.filter(p => p.role === 'saboteur' || p.role === 'assassin').map(p => p.nickname).join(', ');
    details.innerHTML = `<p>The Saboteurs were: <strong>${sabs}</strong></p>`;
    
  } else if (state.room.game_mode === 'auction') {
    const winner = state.players.find(p => p.id === gs.winner);
    title.textContent = winner ? `${winner.nickname} Wins!` : 'Everyone Died!';
    msg.textContent = 'The auction has concluded.';
    
    let standings = '<h3>Final Standings</h3><ul class="standings-list">';
    const sorted = [...state.players].sort((a,b) => b.hp - a.hp);
    sorted.forEach(p => {
      standings += `<li>${p.nickname}: ${p.hp} HP</li>`;
    });
    standings += '</ul>';
    details.innerHTML = standings;
  } else if (state.room.game_mode === 'canvas') {
    if (window.showCanvasGameOver) {
      window.showCanvasGameOver(gs);
      return;
    }
    title.textContent = 'Game Over!';
    msg.textContent = 'The canvas has spoken.';
  } else if (state.room.game_mode === 'wordbomb') {
    if (window.showWordBombGameOver) {
      window.showWordBombGameOver(gs);
      return;
    }
    title.textContent = 'Game Over!';
    msg.textContent = 'The bombs have been defused.';
  }
  
  const lobbyBtn = $('#gameover-lobby-btn');
  if (state.isHost) {
    lobbyBtn.style.display = 'block';
  } else {
    lobbyBtn.style.display = 'none';
  }
}

async function handlePlayAgain() {
  if (!state.isHost) return;
  
  await db.from('players').update({ 
    role: null, 
    hp: 100, 
    is_alive: true, 
    vote: null, 
    bid: null 
  }).eq('room_code', state.roomCode);
  
  await db.from('rooms').update({ 
    status: 'lobby', 
    game_mode: null, 
    game_state: null 
  }).eq('code', state.roomCode);
}

// ============================================================================
// 14. EVENT LISTENERS
// ============================================================================
function bindEventListeners() {
  // Auth
  $('#login-btn')?.addEventListener('click', handleLogin);
  $('#register-btn')?.addEventListener('click', handleRegister);
  $$('#guest-btn').forEach(btn => btn.addEventListener('click', handleGuestLogin));
  
  // Guest Modal
  $$('#guest-modal-submit').forEach(btn => btn.addEventListener('click', processGuestLogin));
  $$('#guest-nickname-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') processGuestLogin();
      });
  });
  
  // Menu
  $('#create-room-btn')?.addEventListener('click', handleCreateRoom);
  $('#join-submit-btn')?.addEventListener('click', handleJoinRoom);
  $('#logout-btn')?.addEventListener('click', handleLogout);
  $('#join-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleJoinRoom();
  });
  
  // Lobby Chat
  $('#lobby-chat-send')?.addEventListener('click', sendChatMessage);
  $('#lobby-chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMessage();
  });
  
  // Lobby
  $('#copy-code-btn')?.addEventListener('click', () => {
    if (state.roomCode) {
      navigator.clipboard.writeText(state.roomCode);
      showToast('Room code copied to clipboard!', 'success');
    }
  });
  
  $$('.mode-card').forEach(card => {
    card.addEventListener('click', () => handleGameModeSelect(card.dataset.mode));
  });
  
  $('#add-bot-btn')?.addEventListener('click', handleAddBot);
  $('#hardcore-mode-toggle')?.addEventListener('change', async (e) => {
    if (state.isHost && state.roomCode) {
      const isHardcore = e.target.checked;
      const gs = state.room.game_state || {};
      await fastUpdateGameState({ ...gs, is_hardcore: isHardcore });
    }
  });
  $('#start-game-btn')?.addEventListener('click', handleStartGame);
  $('#leave-room-btn')?.addEventListener('click', handleLeaveRoom);
  
  // Game Over
  $('#gameover-lobby-btn')?.addEventListener('click', handlePlayAgain);
}

window.distributeXP = async function(winnersList) {
  if (!state.isHost) return;
  if (!winnersList || winnersList.length === 0) return;
  
  for (const id of winnersList) {
    const { data: profile } = await db.from('profiles').select('xp, level').eq('id', id).single();
    if (profile) {
      const newXp = profile.xp + 50;
      const newLevel = Math.min(100, Math.floor(Math.sqrt(newXp / 100)) + 1);
      await db.from('profiles').update({ xp: newXp, level: newLevel }).eq('id', id);
    }
  }
}
