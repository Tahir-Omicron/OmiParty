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
  
  // Cleanly toggle top action bar buttons based on auth state
  const profileBtn = $('#profile-header-btn');
  const friendsBtn = $('#friends-btn');
  const isAuth = (screenName === 'auth');
  if (profileBtn) profileBtn.style.display = isAuth ? 'none' : 'inline-flex';
  if (friendsBtn) friendsBtn.style.display = isAuth ? 'none' : 'inline-flex';
}

// Utilities moved to shared.js
// ============================================================================
// 5. IDENTITY MANAGEMENT
// ============================================================================
async function resumeGame(code) {
  state.roomCode = code;
  const { data: room, error } = await db.from('rooms').select('*').eq('code', code).single();
  if (error || !room) {
    window.location.href = isAz() ? 'index-az.html' : 'index.html';
    return;
  }
  state.room = room;
  state.isHost = (room.host_id === state.playerId);
  
  const { data: players } = await db.from('players').select('*').eq('room_code', code);
  if (players) state.players = players;
  
  subscribeToRoom(code);
  subscribeToPlayers(code);
  
  if (state.room.status === 'playing' && state.room.game_state) {
    onGameStateUpdate(state.room.game_state);
  } else {
    let indexHtml = isAz() ? 'index-az.html' : 'index.html';
    window.location.href = `${indexHtml}?code=${code}`;
  }
}

async function init() {
  bindEventListeners();

  // Start with clean initial state
  state.playerId = null;
  state.nickname = null;
  state.profile = null;

  // Pre-fill remembered email if available
  const lastEmail = localStorage.getItem('otaq_last_email');
  if (lastEmail) {
    if ($('#login-email') && !$('#login-email').value) $('#login-email').value = lastEmail;
  }

  // Subscribe to Auth state changes
  if (db && db.auth && typeof db.auth.onAuthStateChange === 'function') {
    db.auth.onAuthStateChange(async (event, session) => {
      if (session && session.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        await finishAuth(session.user);
      }
    });
  }
  
  // If explicitly joining with a room code query (?code=ABC12)
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    await resumeGame(code);
    return;
  }

  // Always start on Screen 1: Auth (Login / Register / Guest)
  showScreen('auth');
}

document.addEventListener('DOMContentLoaded', init);

// ============================================================================
// 6. SCREEN: AUTH (LOGIN / REGISTER / GUEST)
// ============================================================================
// Pixel Mascot Companion Logic
window.setMascotMsg = function(text) {
  const el = document.getElementById('pixel-companion-msg');
  if (el) el.textContent = text;
};

window.triggerMascotClick = function() {
  playSound('coin');
  const azQuotes = [
    'BEEP BOOP! XAOS BAŞLADI!', 
    'SƏNƏ GÜVƏNİRƏM, QƏHRƏMAN!', 
    '8-BIT PİKSEL GÜCÜ!', 
    'KONAMI KODUNU TAP!', 
    'KARTLARI FIRLAT!'
  ];
  const enQuotes = [
    'BEEP BOOP! CHAOS BEGINS!', 
    'I BELIEVE IN YOU, HERO!', 
    '8-BIT PIXEL POWER!', 
    'FIND THE KONAMI CODE!', 
    'FLIP THE CARDS!'
  ];
  const quotes = isAz() ? azQuotes : enQuotes;
  const rand = quotes[Math.floor(Math.random() * quotes.length)];
  window.setMascotMsg(rand);
};

// 8-Bit Pixel Character Class Presets
const PIXEL_AVATAR_PRESETS = [
  { nameAz: 'CYBER CƏNGAVƏR', nameEn: 'CYBER KNIGHT', seed: 'HeroKnight' },
  { nameAz: 'PİKSEL CADUGƏR', nameEn: 'PIXEL WIZARD', seed: 'PixelMage' },
  { nameAz: 'KÖLGƏ NİNJASI', nameEn: 'SHADOW NINJA', seed: 'ShadowShinobi' },
  { nameAz: 'BOMBA USTASI', nameEn: 'BOMB MASTER', seed: 'BombExpert' },
  { nameAz: 'GLITCH KRALİÇƏSİ', nameEn: 'GLITCH QUEEN', seed: 'GlitchQueen' },
  { nameAz: 'RETRO MECHA', nameEn: 'RETRO MECHA', seed: 'RetroMecha' }
];
let currentPixelAvatarIdx = 0;

window.cyclePixelAvatar = function(dir) {
  playSound('click');
  currentPixelAvatarIdx = (currentPixelAvatarIdx + dir + PIXEL_AVATAR_PRESETS.length) % PIXEL_AVATAR_PRESETS.length;
  const current = PIXEL_AVATAR_PRESETS[currentPixelAvatarIdx];
  
  const img = document.getElementById('pixel-reg-avatar-img');
  const title = document.getElementById('pixel-avatar-title');
  if (img) img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${current.seed}`;
  if (title) title.textContent = isAz() ? current.nameAz : current.nameEn;
  
  window.setMascotMsg(isAz() ? `${current.nameAz}!` : `${current.nameEn}!`);
};

window.flipToAuth = function(mode, event) {
  if (event) event.stopPropagation();
  playSound('deal');
  const card = document.getElementById('auth-flip-card');
  const frontGlider = document.getElementById('front-slider-glider');
  const backGlider = document.getElementById('back-slider-glider');
  const frontLogin = document.getElementById('front-tab-login');
  const frontReg = document.getElementById('front-tab-register');
  const backLogin = document.getElementById('back-tab-login');
  const backReg = document.getElementById('back-tab-register');

  if (mode === 'register') {
    if (card) card.classList.add('is-flipped');
    if (frontGlider) frontGlider.classList.add('is-register');
    if (backGlider) backGlider.classList.add('is-register');
    if (frontLogin) frontLogin.classList.remove('active');
    if (frontReg) frontReg.classList.add('active');
    if (backLogin) backLogin.classList.remove('active');
    if (backReg) backReg.classList.add('active');
    window.setMascotMsg(isAz() ? 'YENİ QƏHRƏMAN!' : 'CREATE HERO!');
  } else {
    if (card) card.classList.remove('is-flipped');
    if (frontGlider) frontGlider.classList.remove('is-register');
    if (backGlider) backGlider.classList.remove('is-register');
    if (frontLogin) frontLogin.classList.add('active');
    if (frontReg) frontReg.classList.remove('active');
    if (backLogin) backLogin.classList.add('active');
    if (backReg) backReg.classList.remove('active');
    window.setMascotMsg(isAz() ? 'XOŞ GƏLDİN!' : 'WELCOME BACK!');
  }
};

window.toggleAuthSlider = function(event, side) {
  const target = event.target.closest('.pixel-tab-btn');
  if (target) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  if (clickX > rect.width / 2) {
    flipToAuth('register');
  } else {
    flipToAuth('login');
  }
};

window.switchAuthTab = function(mode) {
  window.flipToAuth(mode);
};

const PIXEL_EYE_OPEN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="shape-rendering: crispEdges;"><path d="M8 6h8v2H8V6zm8 2h2v2h-2V8zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h-2v2h2v-2zm-2 2h-2v2h2v-2zm-2 2H8v-2h8v2zm-8-2H6v-2h2v2zm-2-2H4v-2h2v2zm-2-2H2v-2h2v2zm2-2h2V8H4v2zm2-2h2V6H6v2z" fill="currentColor"/><rect x="9" y="9" width="6" height="6" fill="var(--accent-cyan)"/><rect x="11" y="11" width="2" height="2" fill="#0b0e14"/></svg>`;
const PIXEL_EYE_CLOSED_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="shape-rendering: crispEdges;"><path d="M8 6h8v2H8V6zm8 2h2v2h-2V8zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h-2v2h2v-2zm-2 2h-2v2h2v-2zm-2 2H8v-2h8v2zm-8-2H6v-2h2v2zm-2-2H4v-2h2v2zm-2-2H2v-2h2v2zm2-2h2V8H4v2zm2-2h2V6H6v2z" fill="currentColor"/><path d="M4 4h3v3H4V4zm3 3h3v3H7V7zm3 3h4v4h-4v-4zm4 4h3v3h-3v-3zm3 3h3v3h-3v-3z" fill="var(--accent-red)"/></svg>`;

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  playSound('click');
  const btnEl = btn || (typeof event !== 'undefined' && event.currentTarget ? event.currentTarget : null) || document.querySelector(`[onclick*="${inputId}"]`);
  
  if (input.type === 'password') {
    input.type = 'text';
    if (btnEl) btnEl.innerHTML = PIXEL_EYE_CLOSED_SVG;
    window.setMascotMsg(isAz() ? 'ŞİFRƏ AÇIQDIR!' : 'PASSWORD VISIBLE!');
  } else {
    input.type = 'password';
    if (btnEl) btnEl.innerHTML = PIXEL_EYE_OPEN_SVG;
    window.setMascotMsg(isAz() ? 'GİZLİ ŞİFRƏ!' : 'SECRET KEY!');
  }
};

window.generateRandomRegNickname = function() {
  playSound('click');
  const azNames = ['XaosKralı', 'BombaUstası', 'Dedektiv', 'ŞənRəssam', 'GizliXain', 'CyberQəhrəman', 'QalibOyunçu', 'NeonNinja', 'PartiyaUlduzu', 'GecəBayquşu'];
  const enNames = ['ChaosKing', 'BombMaster', 'Detective', 'ArtWhiz', 'SecretFaker', 'CyberHero', 'Victor', 'NeonNinja', 'PartyStar', 'NightOwl'];
  const pool = isAz() ? azNames : enNames;
  const randPrefix = pool[Math.floor(Math.random() * pool.length)];
  const randNum = Math.floor(10 + Math.random() * 90);
  const input = $('#reg-nickname');
  if (input) {
    input.value = `${randPrefix}_${randNum}`;
    input.focus();
    window.setMascotMsg(isAz() ? 'GÖZƏL LƏQƏB!' : 'COOL NICKNAME!');
  }
};

async function handleLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  if (!email || !password) {
    return showToast(isAz() ? 'E-poçt və şifrəni daxil edin!' : 'Please enter email and password.', 'error');
  }
  
  localStorage.setItem('otaq_last_email', email);
  showToast(isAz() ? 'Daxil olunur...' : 'Logging in...', 'info');
  
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    return showToast(error.message, 'error');
  }
  
  showToast(isAz() ? 'Giriş uğurludur! Xoş gəldin!' : 'Login successful! Welcome!', 'success');
  await finishAuth(data.user);
}

async function handleRegister() {
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const nickname = $('#reg-nickname').value.trim();
  if (!email || !password || !nickname) {
    return showToast(isAz() ? 'Bütün xanaları doldurun!' : 'Please fill all fields.', 'error');
  }
  
  const selectedPreset = PIXEL_AVATAR_PRESETS[currentPixelAvatarIdx] || PIXEL_AVATAR_PRESETS[0];
  const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedPreset.seed}`;
  
  // Persist locally immediately
  localStorage.setItem('otaq_auth_email', email);
  localStorage.setItem('otaq_last_email', email);
  localStorage.setItem('otaq_nickname', nickname);
  localStorage.setItem('otaq_avatar_url', avatar_url);
  state.nickname = nickname;

  showToast(isAz() ? 'Hesab yaradılır...' : 'Creating account...', 'info');

  const { data, error } = await db.auth.signUp({
    email, password, options: { 
      data: { nickname, avatar_url },
      emailRedirectTo: 'https://omi-party.vercel.app/'
    }
  });
  
  if (error) {
    return showToast(error.message, 'error');
  }
  
  if (data && data.user) {
    // Proactively upsert into profiles table to guarantee database persistence
    try {
      await db.from('profiles').upsert({
        id: data.user.id,
        nickname: nickname,
        avatar_url: avatar_url,
        level: 1,
        xp: 0,
        coins: 100
      });
    } catch (err) {
      console.warn("Profiles upsert:", err);
    }
    
    showToast(isAz() ? 'Qeydiyyat uğurla tamamlandı! Xoş gəldin!' : 'Registration successful! Welcome!', 'success');
    await finishAuth(data.user);
    if (typeof openProfileModal === 'function') {
      setTimeout(() => openProfileModal('overview'), 300);
    }
  }
}

function handleGuestLogin() {
  const azNames = ['XaosKralı', 'BombaUstası', 'Dedektiv', 'ŞənRəssam', 'GizliXain', 'CyberQəhrəman', 'QalibOyunçu', 'Partiyaçı', 'NeonNinja'];
  const enNames = ['ChaosKing', 'BombMaster', 'Detective', 'ArtWhiz', 'SecretFaker', 'CyberHero', 'Victor', 'PartyPro', 'NeonNinja'];
  const pool = isAz() ? azNames : enNames;
  const randPrefix = pool[Math.floor(Math.random() * pool.length)];
  const randNum = Math.floor(10 + Math.random() * 90);
  const defaultName = `${randPrefix}_${randNum}`;

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
  localStorage.setItem('otaq_player_id', state.playerId);
  localStorage.setItem('otaq_nickname', state.nickname);
  
  const savedAvatar = localStorage.getItem('otaq_avatar_url') || `https://api.dicebear.com/7.x/bottts/svg?seed=${state.playerId}`;
  state.profile = { level: 1, xp: 0, avatar_url: savedAvatar, coins: 100 };
  localStorage.setItem('otaq_avatar_url', savedAvatar);
  
  if (typeof getUserProfile === 'function' && typeof saveUserProfile === 'function') {
    const p = getUserProfile();
    p.nickname = state.nickname;
    p.avatar_url = savedAvatar;
    saveUserProfile(p);
  }
  
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
  if (!user) return;
  state.playerId = user.id;
  localStorage.setItem('otaq_player_id', user.id);
  localStorage.setItem('otaq_auth_email', user.email || '');

  // Wait briefly for trigger/network if needed
  await new Promise(r => setTimeout(r, 600));
  
  const savedLocalAvatar = localStorage.getItem('otaq_avatar_url');
  const savedLocalNick = localStorage.getItem('otaq_nickname');
  
  let { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  
  if (!profile) {
    // Upsert default profile if not present
    const initialProfile = {
      id: user.id,
      nickname: user.user_metadata?.nickname || savedLocalNick || 'Hero',
      avatar_url: user.user_metadata?.avatar_url || savedLocalAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`,
      level: 1,
      xp: 0,
      coins: 100
    };
    try {
      await db.from('profiles').upsert(initialProfile);
      profile = initialProfile;
    } catch (err) {
      profile = initialProfile;
    }
  } else {
    if (savedLocalAvatar && !profile.avatar_url) {
      profile.avatar_url = savedLocalAvatar;
      db.from('profiles').update({ avatar_url: savedLocalAvatar }).eq('id', user.id);
    }
  }
  
  state.nickname = profile.nickname || 'Hero';
  state.profile = profile;
  localStorage.setItem('otaq_nickname', state.nickname);
  localStorage.setItem('otaq_avatar_url', profile.avatar_url);
  
  if (typeof getUserProfile === 'function' && typeof saveUserProfile === 'function') {
    const p = getUserProfile();
    p.id = user.id;
    p.email = user.email;
    p.nickname = state.nickname;
    p.avatar_url = profile.avatar_url;
    p.is_guest = false;
    saveUserProfile(p);
  }
  
  if ($('#menu-nickname')) {
    $('#menu-nickname').textContent = state.nickname;
    $('#profile-level').textContent = profile.level || 1;
    $('#profile-avatar').src = profile.avatar_url;
    const progress = ((profile.xp || 0) % 100) + '%';
    $('#profile-xp-bar').style.width = progress;
  }
  if ($('#profile-coins-val')) {
    $('#profile-coins-val').textContent = profile.coins || 100;
  }
  
  const path = window.location.pathname;
  if (path === '/' || path.endsWith('index.html') || path.endsWith('index-az.html')) {
    showScreen('menu');
  }
}

async function handleLogout() {
  try {
    await db.auth.signOut();
  } catch (e) {
    console.warn("Sign out err:", e);
  }
  state.playerId = null;
  state.nickname = null;
  state.profile = null;
  localStorage.removeItem('otaq_player_id');
  localStorage.removeItem('otaq_nickname');
  localStorage.removeItem('otaq_account_profile');
  showToast(isAz() ? 'Hesabdan çıxış edildi.' : 'Signed out successfully.', 'info');
  showScreen('auth');
}

window.updateUserAvatar = async function(src) {
    state.profile = state.profile || { level: 1, xp: 0 };
    state.profile.avatar_url = src;
    localStorage.setItem('otaq_avatar_url', src);
    
    if ($('#profile-avatar')) {
      $('#profile-avatar').src = src;
    }
    
    // Update profiles table if authenticated
    try {
      const { data: { session } } = await db.auth.getSession();
      if (session && session.user && state.playerId === session.user.id) {
        await db.from('profiles').update({ avatar_url: src }).eq('id', state.playerId);
      }
    } catch(e) {
      console.warn("Profile update ignored:", e);
    }
    
    // Update players table if in a room
    if (state.roomCode && state.playerId) {
      await db.from('players').update({ avatar_url: src }).eq('id', state.playerId).eq('room_code', state.roomCode);
      if (state.players) {
        const me = state.players.find(p => p.id === state.playerId);
        if (me) {
          me.avatar_url = src;
          renderLobby();
        }
      }
    }
    
    showToast(isAz() ? 'Profil şəkli yadda saxlanıldı!' : 'Profile avatar saved!', 'success');
}

// ============================================================================
// 7. SCREEN: MENU
// ============================================================================
async function handleCreateRoom() {
  const code = generateRoomCode();
  state.playerId = state.playerId || getPlayerId();
  state.nickname = state.nickname || localStorage.getItem('otaq_nickname') || ('Player_' + Math.floor(Math.random() * 1000));
  
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
      avatar_url: state.profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${state.playerId}`,
      level: state.profile?.level || 1
    };

    const { error: playerError } = await db.from('players').upsert(playerData);
    
    if (playerError) {
      console.warn("Upsert with avatar failed, trying without:", playerError);
      delete playerData.avatar_url;
      delete playerData.level;
      const { error: fallbackError } = await db.from('players').upsert(playerData);
      if (fallbackError) throw fallbackError;
    }

    state.isHost = true;
    if (typeof saveActiveSession === 'function') saveActiveSession(code, state.playerId);
    await enterLobby(code);
    
  } catch (err) {
    console.error('Error creating room:', err);
    showToast(isAz() ? 'Otaq yaradılmadı. Zəhmət olmasa yenidən cəhd edin.' : 'Failed to create room. Please try again.', 'error');
  }
}

async function handleJoinRoom() {
  const input = $('#join-code-input');
  const code = input ? input.value.toUpperCase().trim() : '';
  
  if (code.length !== 5) {
    showToast(isAz() ? 'Otaq kodu 5 simvol olmalıdır.' : 'Room code must be 5 characters.', 'error');
    return;
  }
  
  try {
    const { data: rooms, error: roomError } = await db
      .from('rooms')
      .select('*')
      .eq('code', code)
      .eq('status', 'lobby');
      
    if (roomError) throw roomError;
    
    if (!rooms || rooms.length === 0) {
      showToast(isAz() ? 'Otaq tapılmadı və ya oyun artıq başlayıb.' : 'Room not found or game already started.', 'error');
      return;
    }

    // Capacity limit: max 8 players
    const { data: existingPlayers } = await db.from('players').select('id').eq('room_code', code);
    if (existingPlayers && existingPlayers.length >= 8) {
      showToast(isAz() ? 'Otaq doludur! (Maksimum 8 oyunçu)' : 'Room is full! (Max 8 players)', 'warning');
      return;
    }
    
    state.playerId = state.playerId || getPlayerId();
    state.nickname = state.nickname || localStorage.getItem('otaq_nickname') || ('Player_' + Math.floor(Math.random() * 1000));
    
    const playerData = {
      id: state.playerId,
      room_code: code,
      nickname: state.nickname,
      is_host: false,
      avatar_url: state.profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${state.playerId}`,
      level: state.profile?.level || 1
    };
    
    const { error: playerError } = await db.from('players').upsert(playerData);
    if (playerError) {
      delete playerData.avatar_url;
      delete playerData.level;
      await db.from('players').upsert(playerData);
    }
    
    state.isHost = false;
    if (typeof saveActiveSession === 'function') saveActiveSession(code, state.playerId);
    await enterLobby(code);
    
  } catch (err) {
    console.error('Error joining room:', err);
    showToast(isAz() ? 'Otağa qoşulmaq mümkün olmadı.' : 'Failed to join room.', 'error');
  }
}

// ============================================================================
// 8. SCREEN: LOBBY
// ============================================================================
async function enterLobby(roomCode) {
  state.roomCode = roomCode;
  localStorage.setItem('otaq_current_room', roomCode);
  
  const roomCodeBadge = $('#lobby-room-code') || $('#lobby-code');
  if (roomCodeBadge) {
    roomCodeBadge.textContent = roomCode;
  }
  
  // Host UI setup
  const addBotBtn = $('#add-bot-btn');
  const startGameBtn = $('#start-game-btn');
  const hardcoreContainer = $('#hardcore-container') || document.querySelector('.hardcore-toggle-container');
  
  if (state.isHost) {
    if (addBotBtn) addBotBtn.style.display = 'inline-flex';
    if (startGameBtn) startGameBtn.style.display = 'block';
    if (hardcoreContainer) hardcoreContainer.style.display = 'flex';
  } else {
    if (addBotBtn) addBotBtn.style.display = 'none';
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (hardcoreContainer) hardcoreContainer.style.display = 'none';
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
      state.players = playersData.map(p => {
        if (p.id === state.playerId) {
          const myAvatar = state.profile?.avatar_url || localStorage.getItem('otaq_avatar_url');
          if (myAvatar) p.avatar_url = myAvatar;
        }
        return p;
      });
      renderLobby();
    }
  } catch (e) {
    console.error('Initial fetch failed:', e);
  }
}

function renderLobby() {
  const list = $('#lobby-players-list') || $('#lobby-players');
  if (!list) return;
  
  list.innerHTML = '';
  
  // Show host-only controls
  const addBotBtn = $('#add-bot-btn');
  const startGameBtn = $('#start-game-btn');
  const hardcoreContainer = $('#hardcore-container') || document.querySelector('.hardcore-toggle-container');
  
  if (state.isHost) {
    if (addBotBtn) addBotBtn.style.display = 'inline-flex';
    if (startGameBtn) startGameBtn.style.display = 'block';
    if (hardcoreContainer) hardcoreContainer.style.display = 'flex';
  } else {
    if (addBotBtn) addBotBtn.style.display = 'none';
    if (startGameBtn) startGameBtn.style.display = 'none';
    if (hardcoreContainer) hardcoreContainer.style.display = 'none';
  }
  
  state.players.forEach(player => {
    const card = document.createElement('div');
    card.className = `player-card ${player.is_host ? 'host' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'player-avatar';
    
    const resolvedAvatar = (player.id === state.playerId 
      ? (state.profile?.avatar_url || localStorage.getItem('otaq_avatar_url')) 
      : player.avatar_url) || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(player.nickname || 'Player')}`;
      
    const img = document.createElement('img');
    img.src = resolvedAvatar;
    img.alt = player.nickname;
    avatar.appendChild(img);
    
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = player.nickname;
    
    if (player.id === state.playerId) {
      avatar.style.cursor = 'pointer';
      avatar.title = isAz() ? 'Avatarı dəyişmək üçün klikləyin' : 'Click to change avatar';
      avatar.onclick = () => {
        if (typeof showAvatarModal === 'function') showAvatarModal();
      };
    }
    
    card.appendChild(avatar);
    card.appendChild(name);
    
    // Host can kick other players or bots
    if (state.isHost && player.id !== state.playerId) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'kick-player-btn';
      kickBtn.innerHTML = '✕';
      kickBtn.title = 'Kick Player / Oyunçunu çıxar';
      kickBtn.onclick = (e) => {
        e.stopPropagation();
        handleKickPlayer(player.id, player.nickname);
      };
      card.appendChild(kickBtn);
    }
    
    list.appendChild(card);
  });
  
  const count = state.players.length;
  let required = 0;
  let modeLabel = '';
  if (state.selectedMode === 'sabotage') { required = MIN_PLAYERS_SABOTAGE; modeLabel = 'Sabotage'; }
  else if (state.selectedMode === 'auction') { required = MIN_PLAYERS_AUCTION; modeLabel = 'Auction Chaos'; }
  else if (state.selectedMode === 'canvas') { required = MIN_PLAYERS_CANVAS; modeLabel = 'Canvas'; }
  else if (state.selectedMode === 'wordbomb') { required = MIN_PLAYERS_WORDBOMB; modeLabel = 'Wordbomb'; }
  
  const playerCountEl = $('#lobby-player-count');
  if (playerCountEl) {
    let countText = isAz() ? `${count} Oyunçu qoşuldu` : `${count} Player${count !== 1 ? 's' : ''} connected`;
    if (state.isHost && state.selectedMode && count < required) {
      countText += isAz() ? ` — ${modeLabel} üçün daha ${required - count} oyunçu lazımdır` : ` — Need ${required - count} more for ${modeLabel}`;
    }
    playerCountEl.textContent = countText;
  }
  
  // Highlight active mode card
  $$('.mode-card').forEach(c => {
    if (state.selectedMode && c.dataset.mode === state.selectedMode) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
  
  const startBtn = $('#start-game-btn');
  if (startBtn) {
    startBtn.disabled = !(state.selectedMode && count >= required);
    if (!state.selectedMode) {
      startBtn.textContent = isAz() ? 'Rejim Seçin' : 'Select Game Mode';
    } else if (count < required) {
      startBtn.textContent = isAz() ? `Daha ${required - count} oyunçu lazımdır` : `Need ${required - count} more player${required - count > 1 ? 's' : ''}`;
    } else {
      startBtn.textContent = isAz() ? 'Oyuna Başla' : 'Start Game';
    }
  }
}

window.handleGameModeSelect = function(mode) {
  if (!mode) return;
  state.selectedMode = mode;
  $$('.mode-card').forEach(c => {
    if (c.dataset.mode === mode) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
  playSound('click');
  renderLobby();
};

function handleGameModeSelect(mode) {
  window.handleGameModeSelect(mode);
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
  if (state.players.length >= 8) {
    showToast(isAz() ? 'Maksimum 8 oyunçu ola bilər!' : 'Maximum 8 players allowed!', 'warning');
    return;
  }
  
  const botId = crypto.randomUUID();
  const botNames = ['Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 'Bot_Echo', 'Bot_Apex', 'Bot_Titan', 'Bot_Nova'];
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

async function handleKickPlayer(playerId, nickname) {
  if (!state.isHost || !state.roomCode) return;
  try {
    // Optimistic UI update
    state.players = state.players.filter(p => p.id !== playerId);
    renderLobby();
    
    const { error } = await db.from('players').delete().eq('id', playerId).eq('room_code', state.roomCode);
    if (error) throw error;
    showToast(`${nickname || 'Player'} otaqdan çıxarıldı 🚫`, 'info');
  } catch (err) {
    console.error('Error kicking player:', err);
    showToast('Failed to kick player', 'error');
    // Refetch to recover accurate state
    fetchRoomAndPlayers();
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
  if (typeof clearActiveSession === 'function') clearActiveSession();
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
    .on('broadcast', { event: 'reaction_emote' }, (payload) => {
      if (payload.payload) {
        showFloatingEmote(payload.payload.emoji, payload.payload.sender);
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

window.sendReactionEmote = function(emoji) {
  if (!state.roomCode) return;
  if (window.globalReactionLimiter && !window.globalReactionLimiter.canAct()) {
    return; // Silently debounce rapid spam
  }
  playSound('click');
  showFloatingEmote(emoji, state.nickname || 'You');
  
  if (state.channel) {
    try {
      state.channel.send({
        type: 'broadcast',
        event: 'reaction_emote',
        payload: { emoji, sender: state.nickname || 'Player' }
      });
    } catch (e) {
      console.warn("Emote broadcast error:", e);
    }
  }
};

function showFloatingEmote(emoji, sender) {
  let container = document.querySelector('.floating-emote-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'floating-emote-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = 'floating-emote';
  const randomX = 15 + Math.random() * 70; // 15% to 85% width
  el.style.left = `${randomX}%`;
  
  el.innerHTML = `
    <span>${emoji}</span>
    ${sender ? `<span class="floating-emote-sender">${sender}</span>` : ''}
  `;
  
  container.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// Ultra-fast optimistic UI & broadcast update to bypass Postgres latency
window.fastUpdateGameState = async function(gs, extraUpdates = {}) {
  if (!state.room) {
    state.room = { code: state.roomCode, game_state: gs };
  }
  state.room.game_state = gs;
  if (extraUpdates.status) state.room.status = extraUpdates.status;
  if (extraUpdates.game_mode) state.room.game_mode = extraUpdates.game_mode;
  
  onGameStateUpdate(gs); // Optimistic local update
  
  const channel = state.channels.find(c => c.topic === `realtime:room-${state.roomCode}` || c.topic === `room-${state.roomCode}`);
  if (channel) {
    try {
      channel.send({ type: 'broadcast', event: 'state_update', payload: gs });
    } catch (e) {
      console.warn("Channel broadcast error:", e);
    }
  }
  
  if (state.roomCode) {
    try {
      await db.from('rooms').update({ game_state: gs, ...extraUpdates }).eq('code', state.roomCode);
    } catch (e) {
      console.error('Room update error:', e);
    }
  }
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
      
      showScreen('lobby');
      fetchRoomAndPlayers();
    }
  }
}

async function handlePlayersChange(payload) {
  // Always fetch fresh list to avoid tricky state issues
  const { data } = await db.from('players').select('*').eq('room_code', state.roomCode);
  if (data) {
    state.players = data;

    // Automatic Host Migration if room host left/disconnected
    const hasHost = state.players.some(p => p.is_host);
    if (!hasHost && state.players.length > 0) {
      const newHost = state.players[0];
      newHost.is_host = true;
      if (newHost.id === state.playerId) {
        state.isHost = true;
        showToast(isAz() ? 'Siz yeni otaq lideri oldunuz! 👑' : 'You are now the room host! 👑', 'success');
        db.from('players').update({ is_host: true }).eq('id', newHost.id).eq('room_code', state.roomCode);
        db.from('rooms').update({ host_id: newHost.id }).eq('code', state.roomCode);
      }
    }
    
    // If we are currently in a room and our player is not in the player list, we were kicked!
    if (state.roomCode && state.playerId && !state.isHost) {
      const me = state.players.find(p => p.id === state.playerId);
      if (!me) {
        showToast(isAz() ? 'Siz otaqdan çıxarıldınız' : 'You were kicked from the room', 'error');
        handleLeaveRoom();
        return;
      }
    }
    
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
// 10. GAME STATE ROUTER & SMART BOT AI 2.0
// ============================================================================
function processBotActions(gs) {
  if (!state.isHost || !state.room) return;
  const bots = state.players.filter(p => p.nickname.startsWith('Bot_') && p.is_alive);
  if (bots.length === 0) return;

  if (state.room.game_mode === 'sabotage') {
    if (gs.phase === 'voting') {
      bots.forEach(bot => {
        if (gs.mission_team.includes(bot.id) && !bot.vote) {
          const delay = 1000 + Math.random() * 1800; // 1-2.8s natural hesitation
          setTimeout(async () => {
            const currentBot = state.players.find(p => p.id === bot.id);
            if (currentBot && currentBot.vote) return;
            
            let vote = 'success';
            if (currentBot.role === 'saboteur' || currentBot.role === 'assassin') {
              // Smart bluffing: In Round 1 with only 2 team members, 30% chance to vote 'success' to gain trust
              const isRound1 = (gs.current_mission === 1 || gs.mission_history?.length === 0);
              if (isRound1 && Math.random() < 0.30) {
                vote = 'success'; // Bluff!
              } else {
                vote = 'sabotage';
              }
            } else {
              vote = 'success';
            }
            await db.from('players').update({ vote }).eq('id', bot.id);
          }, delay);
        }
      });
    } else if (gs.phase === 'detective_phase' && !gs.detective_used) {
      bots.forEach(bot => {
        if (bot.role === 'detective') {
          setTimeout(async () => {
            const { data } = await db.from('rooms').select('game_state').eq('code', state.roomCode).single();
            if (data && data.game_state && !data.game_state.detective_used) {
              fastUpdateGameState({ ...data.game_state, detective_used: true });
            }
          }, 1800);
        }
      });
    } else if (gs.phase === 'assassin_phase' && !gs.assassin_target) {
      bots.forEach(bot => {
        if (bot.role === 'assassin') {
          setTimeout(async () => {
            const { data } = await db.from('rooms').select('game_state').eq('code', state.roomCode).single();
            if (data && data.game_state && !data.game_state.assassin_target) {
              const guards = state.players.filter(p => p.role !== 'saboteur' && p.role !== 'assassin');
              if (guards.length > 0) {
                const target = guards[Math.floor(Math.random() * guards.length)];
                fastUpdateGameState({ ...data.game_state, assassin_target: target.id });
              }
            }
          }, 2400);
        }
      });
    }
  } else if (state.room.game_mode === 'auction') {
    if (gs.phase === 'bidding') {
      bots.forEach(bot => {
        if (!bot.bid && bot.bid !== 0) {
          const delay = 1200 + Math.random() * 2200;
          setTimeout(async () => {
            const currentBot = state.players.find(p => p.id === bot.id);
            if (currentBot && (currentBot.bid || currentBot.bid === 0)) return;
            
            const currentItem = AUCTION_ITEMS[gs.current_item_index] || {};
            const isDanger = currentItem.type === 'danger' || (currentItem.effect && currentItem.effect.includes('-'));
            const isMedkit = currentItem.type === 'heal' || (currentItem.effect && currentItem.effect.includes('+'));
            
            let bid = 0;
            if (currentBot.hp <= 20) {
              // Survival mode: low HP bots bid strictly 0 on danger, 1-5 on medkit
              bid = isDanger ? 0 : Math.min(currentBot.hp - 1, Math.floor(Math.random() * 6) + 1);
            } else if (isDanger) {
              // Danger card: 70% bid 0, 30% bid small bait (1-4)
              bid = Math.random() < 0.70 ? 0 : Math.floor(Math.random() * 5);
            } else if (isMedkit) {
              // Valuable heal: bid 15% to 35% of current HP
              const maxBid = Math.floor(currentBot.hp * 0.35);
              bid = Math.max(5, Math.floor(Math.random() * maxBid) + 5);
            } else {
              // Standard item: bid 10% to 25% of current HP
              const maxBid = Math.floor(currentBot.hp * 0.25);
              bid = Math.floor(Math.random() * (maxBid + 1));
            }
            
            bid = Math.max(0, Math.min(currentBot.hp, bid));
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
  
  if (state.room && state.room.game_mode && state.room.status === 'playing') {
    showScreen(state.room.game_mode);
  }

  if (state.isHost) {
    processBotActions(gs);
    
    // Host-driven state transitions for new Sabotage phases
    if (state.room && state.room.game_mode === 'sabotage') {
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
            window.distributeXP(winnerIds, 'sabotage');
            state.assassinTimeout = null;
          }, 3000);
        }
      }
    }
  }
  
  if (state.room && state.room.game_mode === 'sabotage') {
    handleSabotageState(gs);
  } else if (state.room && state.room.game_mode === 'auction') {
    handleAuctionState(gs);
  } else if (state.room && state.room.game_mode === 'canvas') {
    if (window.handleCanvasState) window.handleCanvasState(gs);
  } else if (state.room && state.room.game_mode === 'wordbomb') {
    if (window.handleWordBombState) window.handleWordBombState(gs);
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
  const rolesMap = {};
  for (let i = 0; i < shuffled.length; i++) {
    let role = 'guard';
    if (i < sabsCount) {
      role = !hasAssassin ? 'assassin' : 'saboteur';
      hasAssassin = true;
    } else {
      role = !hasDetective ? 'detective' : 'guard';
      hasDetective = true;
    }
    shuffled[i].role = role;
    rolesMap[shuffled[i].id] = role;
    db.from('players').update({ role }).eq('id', shuffled[i].id);
  }
  state.players = shuffled;
  
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
    assassin_target: null,
    roles: rolesMap
  };
  
  await fastUpdateGameState(gs, {
    status: 'playing',
    game_mode: 'sabotage'
  });
  
  setTimeout(() => {
    if (state.isHost && state.room && state.room.status === 'playing') {
      const gsPhase2 = { ...gs, phase: 'detective_phase' };
      fastUpdateGameState(gsPhase2);
    }
  }, gs.is_hardcore ? 3000 : ROLE_REVEAL_MS);
}

function handleSabotageState(gs) {
  switch (gs.phase) {
    case 'role_reveal':
      showScreen('sabotage');
      renderRoleReveal(gs);
      if (state.isHost && !state.sabotageRoleTimeout) {
        state.sabotageRoleTimeout = setTimeout(() => {
          state.sabotageRoleTimeout = null;
          const currentGs = state.room?.game_state;
          if (currentGs && currentGs.phase === 'role_reveal') {
            const hasDetective = state.players.some(p => p.role === 'detective');
            if (hasDetective && !currentGs.detective_used) {
              fastUpdateGameState({ ...currentGs, phase: 'detective_phase' });
            } else {
              startMissionBriefing(currentGs);
            }
          }
        }, gs.is_hardcore ? 2500 : 3800);
      }
      break;
    case 'detective_phase':
      showScreen('sabotage');
      if (state.isHost && !state.sabotageDetectiveTimeout) {
        state.sabotageDetectiveTimeout = setTimeout(() => {
          state.sabotageDetectiveTimeout = null;
          const currentGs = state.room?.game_state;
          if (currentGs && currentGs.phase === 'detective_phase') {
            startMissionBriefing(currentGs);
          }
        }, 4500);
      }
      const detMe = state.players.find(p => p.id === state.playerId);
      if (detMe && detMe.role === 'detective' && !gs.detective_used) {
        const others = state.players.filter(p => p.id !== state.playerId);
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel" style="text-align:center;">
            <h3 style="margin-bottom:0.5rem;color:var(--accent-cyan);">${t('detective_phase')}</h3>
            <p style="color:var(--text-secondary);margin-bottom:1.5rem;">${t('detective_desc_phase')}</p>
            <div class="player-grid" style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
              ${others.map(p => `<button class="btn btn-secondary btn-peek" data-id="${p.id}" style="padding:10px 18px;">${p.nickname}</button>`).join('')}
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
                <h3 style="color:var(--accent-cyan);">${t('detective_phase')}</h3>
                <p style="font-size:1.3rem;margin-top:1rem;">${t('investigation_complete', target.nickname, isSab)}</p>
              </div>
            `;
            fastUpdateGameState({ ...gs, detective_used: true });
          });
        });
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div class="spinner"></div>
            <p style="color:var(--text-secondary);">${t('detective_investigating')}</p>
          </div>
        `;
      }
      break;
    case 'assassin_phase':
      showScreen('sabotage');
      if (state.isHost && !state.sabotageAssassinTimeout) {
        state.sabotageAssassinTimeout = setTimeout(() => {
          state.sabotageAssassinTimeout = null;
          const currentGs = state.room?.game_state;
          if (currentGs && currentGs.phase === 'assassin_phase') {
            const winner = 'saboteurs';
            fastUpdateGameState({ ...currentGs, phase: 'game_over', winner });
          }
        }, 8000);
      }
      const assMe = state.players.find(p => p.id === state.playerId);
      if (assMe && assMe.role === 'assassin' && !gs.assassin_target) {
        const guards = state.players.filter(p => p.role !== 'saboteur' && p.role !== 'assassin');
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel" style="text-align:center;">
            <h3 style="color:var(--accent-red);margin-bottom:0.5rem;">${t('assassin_phase')}</h3>
            <p style="color:var(--text-secondary);margin-bottom:1.5rem;">${t('assassin_desc_phase')}</p>
            <div class="player-grid" style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;">
              ${guards.map(p => `<button class="btn btn-danger btn-assassinate" data-id="${p.id}" style="padding:10px 18px;">${p.nickname}</button>`).join('')}
            </div>
          </div>
        `;
        $$('.btn-assassinate').forEach(b => {
          b.addEventListener('click', async (e) => {
            const targetId = e.target.dataset.id;
            $('#sabotage-main-area').innerHTML = `
              <div class="waiting-msg" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
                <div class="spinner"></div>
                <p style="color:var(--text-secondary);">${t('assassin_moving')}</p>
              </div>
            `;
            fastUpdateGameState({ ...gs, assassin_target: targetId });
          });
        });
      } else if (gs.assassin_target) {
        const target = state.players.find(p => p.id === gs.assassin_target);
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel" style="text-align:center;">
            <h3 style="color:var(--accent-red);">${t('assassin_phase')}</h3>
            <p style="font-size:1.3rem;margin-top:1rem;">${t('assassin_target_locked', target ? target.nickname : 'Someone')}</p>
          </div>
        `;
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div class="spinner"></div>
            <p style="color:var(--text-secondary);">${t('assassin_moving')}</p>
          </div>
        `;
      }
      break;
    case 'mission_briefing':
      showScreen('sabotage');
      renderSabotageScoreboard(gs);
      $('#sabotage-round-info').textContent = t('round_of', gs.round);
      const mTeam = state.players.filter(p => gs.mission_team.includes(p.id));
      const isOnTeam = gs.mission_team.includes(state.playerId);
      $('#sabotage-main-area').innerHTML = `
        <div class="phase-panel" style="text-align:center;">
          <h3 style="margin-bottom:1rem;">${t('mission_team_selected', gs.round)}</h3>
          <div class="mission-team" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:1rem 0;">
            ${mTeam.map(p => `<div class="mission-player ${p.id === state.playerId ? 'you' : ''}" style="background:var(--bg-secondary);padding:8px 16px;border-radius:20px;border:1px solid var(--glass-border);font-weight:600;">${p.nickname}</div>`).join('')}
          </div>
          <p class="mission-instruction" style="color:var(--text-secondary);margin-top:1rem;">${isOnTeam ? t('on_team_prompt') : t('waiting_team')}</p>
        </div>
      `;
      if (state.isHost && !state.sabotageBriefingTimeout) {
        state.sabotageBriefingTimeout = setTimeout(() => {
          state.sabotageBriefingTimeout = null;
          const currentGs = state.room?.game_state;
          if (currentGs && currentGs.phase === 'mission_briefing') {
            fastUpdateGameState({ ...currentGs, phase: 'voting' });
          }
        }, gs.is_hardcore ? 2000 : 3500);
      }
      break;
    case 'voting':
      state.voteCast = false;
      renderSabotageScoreboard(gs);
      $('#sabotage-round-info').textContent = t('round_of', gs.round);
      if (gs.mission_team.includes(state.playerId)) {
        const me = state.players.find(p => p.id === state.playerId);
        const canSabotage = me?.role === 'saboteur' || me?.role === 'assassin';
        $('#sabotage-main-area').innerHTML = `
          <div class="phase-panel" style="text-align:center;">
            <h3 style="margin-bottom:1.5rem;">${t('cast_vote')}</h3>
            <div class="vote-area" style="display:flex;gap:15px;justify-content:center;max-width:400px;margin:0 auto;">
              <button id="vote-success-btn" class="btn btn-success btn-vote" style="flex:1;min-height:60px;font-size:1.1rem;">${t('vote_success')}</button>
              ${canSabotage ? `<button id="vote-sabotage-btn" class="btn btn-danger btn-vote" style="flex:1;min-height:60px;font-size:1.1rem;">${t('vote_sabotage')}</button>` : ''}
            </div>
          </div>
        `;
        $('#vote-success-btn').addEventListener('click', () => handleVote('success'));
        if (canSabotage) {
          $('#vote-sabotage-btn').addEventListener('click', () => handleVote('sabotage'));
        }
      } else {
        $('#sabotage-main-area').innerHTML = `
          <div class="waiting-msg" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div class="spinner"></div>
            <p style="color:var(--text-secondary);">${t('waiting_team')}</p>
          </div>
        `;
      }
      if (state.isHost) {
        if (state.sabotageVoteCheckInterval) clearInterval(state.sabotageVoteCheckInterval);
        state.sabotageVoteCheckInterval = setInterval(async () => {
          const currentGs = state.room?.game_state;
          if (!currentGs || currentGs.phase !== 'voting') {
            clearInterval(state.sabotageVoteCheckInterval);
            state.sabotageVoteCheckInterval = null;
            return;
          }
          const { data: players } = await db.from('players').select('*').eq('room_code', state.roomCode);
          if (players) {
            state.players = players;
            const team = players.filter(p => currentGs.mission_team.includes(p.id));
            const missing = team.filter(p => p.vote === null);
            if (missing.length === 0 && team.length > 0) {
              clearInterval(state.sabotageVoteCheckInterval);
              state.sabotageVoteCheckInterval = null;
              calculateMissionResult();
            }
          }
        }, 600);
      }
      break;
    case 'result':
      renderSabotageScoreboard(gs);
      const lastResult = gs.history[gs.history.length - 1];
      const sabs = lastResult ? lastResult.sabotage_count : 0;
      const isSuccess = lastResult && lastResult.result === 'success';
      const resultColor = isSuccess ? 'var(--accent-green)' : 'var(--accent-red)';
      if (isSuccess) playSound('win');
      else playSound('bomb');
      $('#sabotage-main-area').innerHTML = `
        <div class="phase-panel" style="text-align:center;">
          <div class="result-card" style="background:var(--bg-surface);padding:2rem;border-radius:var(--radius-lg);border:1px solid var(--glass-border);max-width:400px;margin:0 auto;">
            <h2 style="color:${resultColor};font-size:1.8rem;margin-bottom:0.5rem;">${isSuccess ? t('mission_success') : t('mission_failed')}</h2>
            <p style="color:var(--text-secondary);">${t('sabotage_count', sabs)}</p>
          </div>
        </div>
      `;
      break;
    case 'game_over':
      showGameOver(gs);
      break;
  }
}

function renderRoleReveal(gs) {
  const me = state.players.find(p => p.id === state.playerId);
  const myRole = (gs && gs.roles && gs.roles[state.playerId]) || me?.role || 'guard';
  const isSab = myRole === 'saboteur' || myRole === 'assassin';
  
  let iconSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
  let title = t('guard_title');
  let desc = t('guard_desc');
  
  if (myRole === 'saboteur') {
    iconSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 13-7.5 7.5c-.8.8-2 .8-2.8 0l-.2-.2c-.8-.8-.8-2 0-2.8L11 10"></path><path d="m16 16 6-6"></path><path d="m8 8 6-6"></path><path d="m9 7 8 8"></path><path d="m21 11-8-8"></path></svg>`;
    title = t('saboteur_title');
    desc = t('saboteur_desc');
  } else if (myRole === 'assassin') {
    iconSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M8 20v2h8v-2"></path><path d="m12.5 17-.5-1-.5 1h1z"></path><path d="M16 20a4 4 0 0 0 4-4V9a8 8 0 0 0-16 0v7a4 4 0 0 0 4 4z"></path></svg>`;
    title = t('assassin_title');
    desc = t('assassin_desc');
  } else if (myRole === 'detective') {
    iconSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    title = t('detective_title');
    desc = t('detective_desc');
  }
  
  const roundInfo = $('#sabotage-round-info');
  if (roundInfo) roundInfo.textContent = t('round_of', (gs && gs.round) || 1);
  
  const mainArea = $('#sabotage-main-area');
  if (mainArea) {
    mainArea.innerHTML = `
      <div class="phase-panel" style="display:flex;flex-direction:column;align-items:center;padding:1.5rem 1rem;gap:1.25rem;">
        <div style="background:rgba(255,255,255,0.05);padding:6px 16px;border-radius:20px;border:1px solid var(--glass-border);font-size:0.85rem;font-weight:600;color:var(--accent-cyan);display:flex;align-items:center;gap:8px;">
          <span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>
          <span id="role-countdown-txt">${t('game_starting_in', 3)}</span>
        </div>
        
        <div id="sabotage-role-card" class="role-card ${myRole}">
          <div class="role-icon" style="color:${isSab ? 'var(--accent-red)' : 'var(--accent-cyan)'};">
            ${iconSvg}
          </div>
          <div class="role-name" style="color:${isSab ? 'var(--accent-red)' : 'var(--accent-cyan)'};">${title}</div>
          <div class="role-desc">${desc}</div>
        </div>
      </div>
    `;
    
    let countdown = 3;
    const cdTxt = document.getElementById('role-countdown-txt');
    const cdInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        if (cdTxt) cdTxt.textContent = t('game_starting_in', countdown);
      } else {
        if (cdTxt) cdTxt.textContent = isAz() ? 'Missiya başlayır...' : 'Starting mission...';
        clearInterval(cdInterval);
      }
    }, 1000);
  }
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
  const gs = overrideGs || state.room?.game_state;
  if (!gs) return;
  const size = gs.mission_sizes[gs.round - 1] || 2;
  
  const shuffled = shuffleArray(state.players);
  const team = shuffled.slice(0, size).map(p => p.id);
  
  await db.from('players').update({ vote: null }).eq('room_code', state.roomCode);
  
  const newGs = { ...gs, phase: 'mission_briefing', mission_team: team };
  await fastUpdateGameState(newGs);
}

async function handleVote(voteValue) {
  if (state.voteCast) return;
  state.voteCast = true;
  
  $('#sabotage-main-area').innerHTML = `
    <div class="waiting-msg">
      <div class="spinner"></div>
      <p>${isAz() ? 'Səsiniz qeydə alındı! Digərləri gözlənilir...' : 'Vote cast! Waiting for others...'}</p>
    </div>
  `;
  
  await db.from('players').update({ vote: voteValue }).eq('id', state.playerId);
}

async function checkAllVotesIn() {
  const gs = state.room?.game_state;
  if (!gs || gs.phase !== 'voting') return;
  const team = state.players.filter(p => gs.mission_team.includes(p.id));
  const missing = team.filter(p => p.vote === null);
  
  if (missing.length === 0 && team.length > 0) {
    calculateMissionResult();
  }
}

async function calculateMissionResult() {
  const gs = state.room?.game_state;
  if (!gs) return;
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
      const hasAssassin = state.players.some(p => p.role === 'assassin');
      if (hasAssassin) {
        fastUpdateGameState({ ...newGs, phase: 'assassin_phase' });
      } else {
        fastUpdateGameState({ ...newGs, phase: 'game_over', winner: 'guards' });
        const guardIds = state.players.filter(p => p.role !== 'saboteur' && p.role !== 'assassin').map(p => p.id);
        window.distributeXP(guardIds);
      }
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
      if (state.isHost && !state.auctionEventTimeout) {
        state.auctionEventTimeout = setTimeout(() => {
          state.auctionEventTimeout = null;
          const currentGs = state.room?.game_state;
          if (currentGs && currentGs.phase === 'event_reveal') {
            startBiddingPhase();
          }
        }, 3800);
      }
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
              <div class="bid-display">${isAz() ? 'Təklifiniz:' : 'Your bid:'} <strong id="bid-value" class="bid-value" style="font-size:1.4rem; color:var(--accent-gold);">0</strong> HP / ${me.hp} HP</div>
              <div style="display:flex; gap:6px; justify-content:center; margin:12px 0; flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm quick-bid-btn" data-val="0">0 HP</button>
                <button class="btn btn-ghost btn-sm quick-bid-btn" data-pct="0.25">25%</button>
                <button class="btn btn-ghost btn-sm quick-bid-btn" data-pct="0.5">50%</button>
                <button class="btn btn-ghost btn-sm quick-bid-btn" data-pct="0.75">75%</button>
                <button class="btn btn-ghost btn-sm quick-bid-btn" data-val="${me.hp}" style="color:var(--accent-red); font-weight:700;">All-in! 🔥</button>
              </div>
              <button id="auction-bid-btn" class="btn btn-gold" style="width:100%; font-weight:700; font-size:1.1rem; box-shadow: 0 4px 15px rgba(245,158,11,0.25);">${isAz() ? 'Təklifi Təsdiqlə' : 'Lock In Bid'}</button>
            </div>
          </div>
        `;
        const slider = $('#auction-bid-slider');
        slider.addEventListener('input', (e) => {
          $('#bid-value').textContent = `${e.target.value}`;
        });
        $$('.quick-bid-btn').forEach(b => {
          b.onclick = () => {
            let val = b.dataset.val !== undefined ? parseInt(b.dataset.val) : Math.round(me.hp * parseFloat(b.dataset.pct));
            slider.value = val;
            $('#bid-value').textContent = `${val}`;
            playSound('click');
          };
        });
        $('#auction-bid-btn').addEventListener('click', () => {
          playSound('click');
          handleBidSubmit();
        });
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
      title.textContent = isAz() ? 'Mühafizəçilər Qalib Gəldi! 🛡️' : 'Guards Win!';
      msg.textContent = isAz() ? 'Missiyalar uğurla qorundu.' : 'The missions were successfully protected.';
    } else {
      title.textContent = isAz() ? 'Xainlər Qalib Gəldi! 🗡️' : 'Saboteurs Win!';
      msg.textContent = isAz() ? 'Xaos qalib gəldi.' : 'Chaos reigns supreme.';
    }
    
    const sabs = state.players.filter(p => p.role === 'saboteur' || p.role === 'assassin').map(p => p.nickname).join(', ');
    details.innerHTML = `<p style="margin-top:1rem;color:var(--text-secondary);">${isAz() ? 'Xainlər bunlar idi:' : 'The Saboteurs were:'} <strong style="color:var(--accent-red);">${sabs}</strong></p>`;
    
  } else if (state.room.game_mode === 'auction') {
    const winner = state.players.find(p => p.id === gs.winner);
    title.textContent = winner ? `${winner.nickname} ${isAz() ? 'Qalib Gəldi!' : 'Wins!'}` : (isAz() ? 'Hamı Məğlub Oldu!' : 'Everyone Died!');
    msg.textContent = isAz() ? 'Auksion başa çatdı.' : 'The auction has concluded.';
    
    let standings = `<h3>${isAz() ? 'Yekun Nəticələr' : 'Final Standings'}</h3><ul class="standings-list">`;
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
    title.textContent = isAz() ? 'Oyun Başa Çatdı!' : 'Game Over!';
    msg.textContent = isAz() ? 'Rəsm tamamlandı.' : 'The canvas has spoken.';
  } else if (state.room.game_mode === 'wordbomb') {
    if (window.showWordBombGameOver) {
      window.showWordBombGameOver(gs);
      return;
    }
    title.textContent = isAz() ? 'Oyun Başa Çatdı!' : 'Game Over!';
    msg.textContent = isAz() ? 'Bombalar zərərsizləşdirildi.' : 'The bombs have been defused.';
  }
  
  const lobbyBtn = $('#gameover-lobby-btn');
  if (lobbyBtn) {
    lobbyBtn.textContent = t('back_to_lobby');
    if (state.isHost) {
      lobbyBtn.style.display = 'inline-block';
    } else {
      lobbyBtn.style.display = 'none';
    }
  }
}

async function handlePlayAgain() {
  if (!state.isHost) return;
  playSound('click');
  showScreen('lobby');
  
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
  
  fetchRoomAndPlayers();
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
  
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (card && card.dataset.mode) {
      window.handleGameModeSelect(card.dataset.mode);
    }
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

window.distributeXP = async function(winnersList, mode = 'party') {
  const isMeWinner = Array.isArray(winnersList) ? winnersList.includes(state.playerId) : (winnersList === state.playerId);
  const xpEarned = isMeWinner ? 150 : 50;
  const coinsEarned = isMeWinner ? 50 : 15;
  
  if (typeof window.recordGameResult === 'function') {
    window.recordGameResult(mode, isMeWinner, xpEarned, coinsEarned);
  }
  
  if (state.isHost && winnersList && winnersList.length > 0) {
    for (const id of winnersList) {
      try {
        const { data: profile } = await db.from('profiles').select('xp, level').eq('id', id).single();
        if (profile) {
          const newXp = (profile.xp || 0) + 150;
          const newLevel = Math.floor(Math.sqrt(newXp / 75)) + 1;
          await db.from('profiles').update({ xp: newXp, level: newLevel }).eq('id', id);
        }
      } catch (err) {
        console.warn("Could not sync profile XP with Supabase:", err);
      }
    }
  }
};
