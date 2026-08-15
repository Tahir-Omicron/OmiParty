const SUPABASE_URL = 'https://rnwpljhmflnxxefamfid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJud3BsamhtZmxueHhlZmFtZmlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MTMzNzUsImV4cCI6MjEwMjE4OTM3NX0.Rb21vhDbnT0l94z6uCwpYRldHObR_7KwFslDuWTdnEA';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getPlayerId() {
  let id = localStorage.getItem('otaq_player_id');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    try {
      id = crypto.randomUUID();
    } catch (e) {
      id = '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }
    localStorage.setItem('otaq_player_id', id);
  }
  return id;
}

function getFriendCode() {
  const id = getPlayerId();
  const raw = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return '#OTQ-' + (raw.substring(0, 4) || '7788');
}

function getLang() {
  if (window.location.pathname.includes('-az')) {
    localStorage.setItem('otaq_lang', 'az');
    return 'az';
  }
  if (window.location.pathname.includes('.html') && !window.location.pathname.includes('-az')) {
    localStorage.setItem('otaq_lang', 'en');
    return 'en';
  }
  return localStorage.getItem('otaq_lang') || 'az'; // Default to Azerbaijani
}

function isAz() {
  return getLang() === 'az';
}

// ----------------------------------------------------------------------------
// Rate Limiter Helper (Prevents chat/reaction spam & rapid fire actions)
// ----------------------------------------------------------------------------
class RateLimiter {
  constructor(cooldownMs = 1200) {
    this.cooldownMs = cooldownMs;
    this.lastAction = 0;
  }
  canAct() {
    const now = Date.now();
    if (now - this.lastAction < this.cooldownMs) {
      return false;
    }
    this.lastAction = now;
    return true;
  }
  getRemainingTime() {
    const elapsed = Date.now() - this.lastAction;
    return Math.max(0, this.cooldownMs - elapsed);
  }
}
window.RateLimiter = RateLimiter;
window.globalActionLimiter = new RateLimiter(1000);
window.globalReactionLimiter = new RateLimiter(800);

// Input & Room Validation Helpers
function validateNickname(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false, message: isAz() ? 'Ləqəb boş ola bilməz' : 'Nickname cannot be empty' };
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return { valid: false, message: isAz() ? 'Ləqəb 2-16 simvol arasında olmalıdır' : 'Nickname must be 2-16 characters' };
  }
  return { valid: true, nickname: trimmed };
}

function validateRoomCode(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false, message: isAz() ? 'Otaq kodu boş ola bilməz' : 'Room code cannot be empty' };
  const trimmed = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(trimmed)) {
    return { valid: false, message: isAz() ? 'Otaq kodu 4-6 hərf/rəqəm olmalıdır' : 'Room code must be 4-6 alphanumeric characters' };
  }
  return { valid: true, code: trimmed };
}

// Active Session Persistence & Recovery
function saveActiveSession(roomCode, playerId) {
  try {
    if (roomCode && playerId) {
      localStorage.setItem('otaq_active_session', JSON.stringify({
        roomCode,
        playerId,
        timestamp: Date.now()
      }));
    }
  } catch (e) {}
}

function clearActiveSession() {
  try {
    localStorage.removeItem('otaq_active_session');
  } catch (e) {}
}

function getActiveSession() {
  try {
    const raw = localStorage.getItem('otaq_active_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Expire after 3 hours
    if (Date.now() - session.timestamp > 3 * 60 * 60 * 1000) {
      clearActiveSession();
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

const I18N = {
  az: {
    saboteur_title: 'XAİN',
    saboteur_desc: 'Missiyaları gizlicə uğursuzluğa düçar edin və qazanın.',
    guard_title: 'MÜHAFİZƏÇİ',
    guard_desc: 'Missiyaları hər nə bahasına olursa olsun qoruyun.',
    detective_title: 'XƏFİYYƏ',
    detective_desc: 'Missiyaları qoruyun. Başlanğıcda bir oyunçunun tərəfini öyrənəcəksiniz.',
    assassin_title: 'QATİL',
    assassin_desc: 'Xainlərə kömək edin. Əgər Mühafizəçilər qalib gəlsə, Xəfiyyəni tapıb qələbəni oğurlayın.',
    round_of: (r) => `RAUND ${r} / 5`,
    mission_team_selected: (r) => `Missiya ${r} — Komanda Seçildi`,
    on_team_prompt: 'Siz bu missiyadasınız! Səsverməyə hazırlaşın.',
    waiting_team: 'Komandanın missiyadan qayıtması gözlənilir...',
    cast_vote: 'Səsinizi verin',
    vote_success: '✓ Uğurlu',
    vote_sabotage: '✗ Təxribat',
    vote_waiting: 'Səs verildi! Digərləri gözlənilir...',
    mission_success: 'Missiya UĞURLUDUR!',
    mission_failed: 'Missiya UĞURSUZ OLDU!',
    sabotage_count: (c) => `Verilən təxribat səsləri: ${c}`,
    detective_phase: 'Xəfiyyə Mərhələsi',
    detective_desc_phase: 'Bir oyunçunu seçin və onun əsl tərəfini öyrənin.',
    investigation_complete: (name, isSab) => `${name} — <strong style="color:${isSab ? 'var(--accent-red)' : 'var(--accent-green)'};">${isSab ? 'XAİNDİR' : 'MÜHAFİZƏÇİDİR'}</strong>.`,
    detective_investigating: 'Xəfiyyə araşdırma aparır...',
    assassin_phase: 'Qatil Mərhələsi',
    assassin_desc_phase: 'Mühafizəçilər 3 missiyanı tamamladı. Xəfiyyəni tapıb qələbəni oğurlamaq üçün 1 şansınız var!',
    assassin_moving: 'Qatil öz seçimini edir...',
    assassin_target_locked: (name) => `Qatil <strong>${name}</strong> adlı oyunçunu hədəf aldı!`,
    guards_win: 'Mühafizəçilər Qalib Gəldi! 🛡️',
    saboteurs_win: 'Xainlər Qalib Gəldi! 🗡️',
    game_starting_in: (s) => `Raund başlayır...`,
    back_to_lobby: 'Lobbiyə Qayıt',
    friends_title: 'Dostluq Sistemi',
    my_friend_code: 'Mənim Dost Kodum:',
    copy_code: 'Kopyala',
    add_friend: 'Dost Əlavə Et',
    add_friend_placeholder: 'Dost kodu (#OTQ-...) və ya Ləqəb',
    friends_tab: 'Dostlarım',
    recent_tab: 'Son Oyunçular',
    no_friends_yet: 'Hələ dostunuz yoxdur. Kodunuzu paylaşın və ya oyunçuları əlavə edin!',
    no_recent_players: 'Son oyunçu qeydə alınmayıb.',
    invite_btn: 'Dəvət Et',
    invite_copied: 'Dəvət linki kopyalandı! 🚀',
    friend_added: 'Dost əlavə edildi! 🎉',
    friend_removed: 'Dost çıxarıldı.',
    friend_code_copied: 'Dost kodu kopyalandı!'
  },
  en: {
    saboteur_title: 'SABOTEUR',
    saboteur_desc: 'Secretly fail missions to win.',
    guard_title: 'GUARD',
    guard_desc: 'Protect the missions at all costs.',
    detective_title: 'DETECTIVE',
    detective_desc: 'Protect missions. You will discover one player\'s true loyalty at the start.',
    assassin_title: 'ASSASSIN',
    assassin_desc: 'Fail missions, and assassinate the Detective if the Guards win.',
    round_of: (r) => `ROUND ${r} OF 5`,
    mission_team_selected: (r) => `Mission ${r} — Team Selected`,
    on_team_prompt: 'You are on this mission. Prepare to vote!',
    waiting_team: 'Waiting for the mission team to return...',
    cast_vote: 'Cast Your Vote',
    vote_success: '✓ Success',
    vote_sabotage: '✗ Sabotage',
    vote_waiting: 'Vote cast! Waiting for others...',
    mission_success: 'Mission SUCCESS!',
    mission_failed: 'Mission FAILED!',
    sabotage_count: (c) => `Sabotage votes cast: ${c}`,
    detective_phase: 'Detective Phase',
    detective_desc_phase: 'Select one player to reveal their true loyalty.',
    investigation_complete: (name, isSab) => `${name} is a <strong style="color:${isSab ? 'var(--accent-red)' : 'var(--accent-green)'};">${isSab ? 'SABOTEUR' : 'GUARD'}</strong>.`,
    detective_investigating: 'The Detective is investigating...',
    assassin_phase: 'Assassin Phase',
    assassin_desc_phase: 'The Guards secured 3 missions. You have one chance to steal the win. Who is the Detective?',
    assassin_moving: 'The Assassin is making their move...',
    assassin_target_locked: (name) => `The Assassin targeted <strong>${name}</strong>!`,
    guards_win: 'Guards Win! 🛡️',
    saboteurs_win: 'Saboteurs Win! 🗡️',
    game_starting_in: (s) => `Round starting...`,
    back_to_lobby: 'Back to Lobby',
    friends_title: 'Friends System',
    my_friend_code: 'My Friend Code:',
    copy_code: 'Copy',
    add_friend: 'Add Friend',
    add_friend_placeholder: 'Friend code (#OTQ-...) or Nickname',
    friends_tab: 'My Friends',
    recent_tab: 'Recent Players',
    no_friends_yet: 'No friends added yet. Share your code or add players!',
    no_recent_players: 'No recent players found.',
    invite_btn: 'Invite',
    invite_copied: 'Invite link copied! 🚀',
    friend_added: 'Friend added! 🎉',
    friend_removed: 'Friend removed.',
    friend_code_copied: 'Friend code copied!'
  }
};

function t(key, ...args) {
  const lang = isAz() ? 'az' : 'en';
  const val = I18N[lang] ? I18N[lang][key] : null;
  const fallback = I18N['en'][key] || key;
  const target = val !== undefined ? val : fallback;
  return typeof target === 'function' ? target(...args) : target;
}

let state = {
  playerId: getPlayerId(),
  nickname: localStorage.getItem('otaq_nickname') || '',
  roomCode: new URLSearchParams(window.location.search).get('code') || null,
  isHost: false,
  room: null,
  players: [],
  channels: [],
  selectedMode: null,
  bidTimerInterval: null,
  bidLocked: false,
  voteCast: false,
  usedCardIndices: [],
  timerTimeout: null
};

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getThemeIcon(theme) {
  if (theme === 'dark') {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  } else {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  }
}

function getSoundIcon(isMuted) {
  if (isMuted) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
  } else {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
  }
}

// Day/Night Mode Initialization
function initTheme() {
  const theme = localStorage.getItem('otaq_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = getThemeIcon(theme);
  }
  
  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.innerHTML = getSoundIcon(isAudioMuted());
  }
}

function toggleTheme() {
  playSound('click');
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('otaq_theme', newTheme);
  
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = getThemeIcon(newTheme);
  }
}

// ----------------------------------------------------------------------------
// WEB AUDIO API PROCEDURAL SOUND SYNTHESIZER
// ----------------------------------------------------------------------------
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function isAudioMuted() {
  return localStorage.getItem('otaq_muted') === 'true';
}

function toggleSound() {
  const muted = !isAudioMuted();
  localStorage.setItem('otaq_muted', muted ? 'true' : 'false');
  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) {
    soundBtn.innerHTML = getSoundIcon(muted);
  }
  if (!muted) {
    playSound('click');
  }
}

function playSound(type) {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'click') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'join') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'start') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392, now); // G4
      osc.frequency.setValueAtTime(523.25, now + 0.09); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.18); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.27); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'tick') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'bomb') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'correct') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'win') {
      const chords = [523.25, 659.25, 783.99, 1046.50];
      chords.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.08, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + idx * 0.1);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.1);
        o.stop(now + 0.5 + idx * 0.1);
      });
    } else if (type === 'deal') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.setValueAtTime(550, now + 0.04);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'coin') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Audio contexts may require initial user gesture
  }
}

// ----------------------------------------------------------------------------
// FRIENDS SYSTEM
// ----------------------------------------------------------------------------
function getFriends() {
  try {
    return JSON.parse(localStorage.getItem('otaq_friends') || '[]');
  } catch (e) {
    return [];
  }
}

function saveFriends(list) {
  localStorage.setItem('otaq_friends', JSON.stringify(list));
}

function addFriend(codeOrNickname, nickname = '', avatar_url = '') {
  let list = getFriends();
  const cleanCode = codeOrNickname.trim();
  if (!cleanCode) return false;
  
  if (list.some(f => f.code === cleanCode || f.nickname === cleanCode)) {
    return false; // Already exists
  }
  
  const newFriend = {
    id: crypto.randomUUID(),
    code: cleanCode.startsWith('#') ? cleanCode : '#OTQ-' + cleanCode.substring(0, 4).toUpperCase(),
    nickname: nickname || cleanCode.replace('#OTQ-', '') || 'Friend',
    avatar_url: avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanCode}`,
    addedAt: Date.now()
  };
  
  list.unshift(newFriend);
  saveFriends(list);
  return true;
}

function removeFriend(id) {
  let list = getFriends();
  list = list.filter(f => f.id !== id);
  saveFriends(list);
}

function getRecentPlayers() {
  try {
    return JSON.parse(localStorage.getItem('otaq_recent_players') || '[]');
  } catch (e) {
    return [];
  }
}

function addRecentPlayer(player) {
  if (!player || player.id === state.playerId || player.nickname.startsWith('Bot_')) return;
  let recents = getRecentPlayers();
  recents = recents.filter(p => p.id !== player.id);
  recents.unshift({
    id: player.id,
    nickname: player.nickname,
    avatar_url: player.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.nickname}`,
    code: '#OTQ-' + (player.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'PLAY'),
    playedAt: Date.now()
  });
  if (recents.length > 15) recents.pop();
  localStorage.setItem('otaq_recent_players', JSON.stringify(recents));
}

function openFriendsModal() {
  const modal = document.getElementById('friends-modal');
  if (modal) {
    modal.style.display = 'flex';
    renderFriendsModal();
  }
}

function closeFriendsModal() {
  const modal = document.getElementById('friends-modal');
  if (modal) modal.style.display = 'none';
}

function copyMyFriendCode() {
  const code = getFriendCode();
  navigator.clipboard.writeText(code);
  showToast(t('friend_code_copied'), 'success');
  playSound('click');
}

function copyRoomInviteLink() {
  const code = state.roomCode || localStorage.getItem('otaq_current_room');
  if (!code) return;
  const url = `${window.location.origin}${window.location.pathname.includes('-az') ? '/index-az.html' : '/index.html'}?code=${code}`;
  navigator.clipboard.writeText(url);
  showToast(t('invite_copied'), 'success');
  playSound('click');
}

function renderFriendsModal(tab = 'friends') {
  const myCodeEl = document.getElementById('my-friend-code-val');
  if (myCodeEl) myCodeEl.textContent = getFriendCode();
  
  const listEl = document.getElementById('friends-list-container');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  if (tab === 'friends') {
    const friends = getFriends();
    if (friends.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem; color: var(--text-secondary); font-size: 0.9rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.6;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          <p>${t('no_friends_yet')}</p>
        </div>
      `;
    } else {
      friends.forEach(f => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid var(--glass-border); margin-bottom:8px;';
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${f.avatar_url}" style="width:36px; height:36px; border-radius:50%; border:1px solid var(--accent-cyan);">
            <div>
              <div style="font-weight:700; font-size:0.95rem;">${f.nickname}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${f.code}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="copyRoomInviteLink()" title="${t('invite_btn')}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              ${t('invite_btn')}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="handleRemoveFriend('${f.id}')" style="color:var(--accent-red); padding:4px 8px;" title="Sil">
              ✕
            </button>
          </div>
        `;
        listEl.appendChild(item);
      });
    }
  } else {
    const recents = getRecentPlayers();
    if (recents.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem; color: var(--text-secondary); font-size: 0.9rem;">
          <p>${t('no_recent_players')}</p>
        </div>
      `;
    } else {
      recents.forEach(p => {
        const isAlreadyFriend = getFriends().some(f => f.code === p.code || f.nickname === p.nickname);
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid var(--glass-border); margin-bottom:8px;';
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${p.avatar_url}" style="width:36px; height:36px; border-radius:50%;">
            <div>
              <div style="font-weight:700; font-size:0.95rem;">${p.nickname}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${p.code}</div>
            </div>
          </div>
          <div>
            ${isAlreadyFriend ? '<span style="font-size:0.75rem; color:var(--accent-green);">✓ Dost</span>' : `
              <button class="btn btn-primary btn-sm" onclick="handleAddFriendQuick('${p.code}', '${p.nickname}', '${p.avatar_url}')" style="padding:4px 10px; font-size:0.75rem;">
                + Dost Əlavə Et
              </button>
            `}
          </div>
        `;
        listEl.appendChild(item);
      });
    }
  }
}

function handleAddFriendSubmit() {
  const input = document.getElementById('add-friend-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  
  const success = addFriend(val, val.replace('#OTQ-', ''));
  if (success) {
    showToast(t('friend_added'), 'success');
    input.value = '';
    renderFriendsModal('friends');
    playSound('correct');
  } else {
    showToast('Artıq dost siyahınızdadır və ya kod yanlışdır.', 'error');
    playSound('wrong');
  }
}

function handleAddFriendQuick(code, nickname, avatar) {
  addFriend(code, nickname, avatar);
  showToast(t('friend_added'), 'success');
  renderFriendsModal('recent');
  playSound('correct');
}

function handleRemoveFriend(id) {
  removeFriend(id);
  showToast(t('friend_removed'), 'info');
  renderFriendsModal('friends');
  playSound('click');
}

// ============================================================================
// COMPREHENSIVE ACCOUNT & PROFILE ECOSYSTEM (OTAQ.GG IDENTITY)
// ============================================================================

const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', title_az: 'İlk Qələbə', title_en: 'First Win', desc_az: 'Hər hansı bir rejimdə ilk qələbənizi qazanın.', desc_en: 'Win your first game in any mode.', xp: 50, coins: 100, condition: p => (p.stats.games_won >= 1) },
  { id: 'word_master', icon: '💣', title_az: 'Söz Ustası', title_en: 'Word Master', desc_az: 'Word Bomb rejimində 3 qələbə qazanın.', desc_en: 'Win 3 games in Word Bomb.', xp: 100, coins: 200, condition: p => (p.stats.wordbomb_wins >= 3) },
  { id: 'sabotage_pro', icon: '🕵️', title_az: 'Gizli Xəfiyyə', title_en: 'Master Detective', desc_az: 'Sabotage rejimində 3 qələbə qazanın.', desc_en: 'Win 3 games in Sabotage.', xp: 100, coins: 200, condition: p => (p.stats.sabotage_wins >= 3) },
  { id: 'auction_shark', icon: '🦈', title_az: 'Hərrac Köpəkbalığı', title_en: 'Auction Shark', desc_az: 'Auction Chaos rejimində 3 qələbə qazanın.', desc_en: 'Win 3 games in Auction Chaos.', xp: 100, coins: 200, condition: p => (p.stats.auction_wins >= 3) },
  { id: 'canvas_picasso', icon: '🎨', title_az: 'Müasir Pikasso', title_en: 'Modern Picasso', desc_az: 'Liar\'s Canvas rejimində 3 qələbə qazanın.', desc_en: 'Win 3 games in Liar\'s Canvas.', xp: 100, coins: 200, condition: p => (p.stats.canvas_wins >= 3) },
  { id: 'streak_3', icon: '🔥', title_az: 'Dayandırılmaz!', title_en: 'Unstoppable!', desc_az: 'Ardıcıl 3 oyun qələbə qazanın.', desc_en: 'Achieve a 3-game win streak.', xp: 150, coins: 300, condition: p => (p.stats.max_win_streak >= 3) },
  { id: 'veteran_10', icon: '⭐', title_az: 'Təcrübəli Partiyaçı', title_en: 'Party Veteran', desc_az: 'Cəmi 10 oyun oynayın.', desc_en: 'Play a total of 10 matches.', xp: 150, coins: 300, condition: p => (p.stats.games_played >= 10) },
  { id: 'socialite', icon: '🤝', title_az: 'Dostcanlı', title_en: 'Social Butterfly', desc_az: '3 dost əlavə edin.', desc_en: 'Add 3 or more friends.', xp: 75, coins: 150, condition: p => (getFriends().length >= 3) }
];

function calculateLevel(xp) {
  // XP formula: Level = floor(sqrt(xp / 75)) + 1
  return Math.floor(Math.sqrt((xp || 0) / 75)) + 1;
}

function getXPForNextLevel(level) {
  return level * level * 75;
}

function getPlayerRankTitle(level) {
  if (level >= 30) return isAz() ? '👑 Əfsanəvi Qəhrəman' : '👑 Legendary Hero';
  if (level >= 20) return isAz() ? '💎 Partiya Kralı' : '💎 Party King';
  if (level >= 10) return isAz() ? '🥇 Xaos Ustası' : '🥇 Chaos Master';
  if (level >= 5) return isAz() ? '🥈 Təcrübəli Oyunçu' : '🥈 Veteran Player';
  return isAz() ? '🥉 Acemi Partiyaçı' : '🥉 Rookie Partygoer';
}

function getUserProfile() {
  const defaultProfile = {
    id: getPlayerId(),
    email: localStorage.getItem('otaq_auth_email') || null,
    is_guest: !localStorage.getItem('otaq_auth_token'),
    nickname: localStorage.getItem('otaq_nickname') || 'Oyunçu',
    avatar_url: localStorage.getItem('otaq_avatar_url') || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(localStorage.getItem('otaq_nickname') || 'Oyunçu')}`,
    friend_code: getFriendCode(),
    title: 'Acemi Partiyaçı',
    xp: 0,
    coins: 100,
    stats: {
      games_played: 0,
      games_won: 0,
      sabotage_wins: 0,
      wordbomb_wins: 0,
      auction_wins: 0,
      canvas_wins: 0,
      win_streak: 0,
      max_win_streak: 0
    },
    match_history: [],
    unlocked_achievements: [],
    created_at: Date.now()
  };

  try {
    const saved = localStorage.getItem('otaq_account_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultProfile, ...parsed, stats: { ...defaultProfile.stats, ...(parsed.stats || {}) } };
    }
  } catch (e) {
    console.warn("Failed to parse account profile:", e);
  }
  return defaultProfile;
}

function saveUserProfile(profile) {
  if (!profile) return;
  localStorage.setItem('otaq_account_profile', JSON.stringify(profile));
  if (profile.nickname) localStorage.setItem('otaq_nickname', profile.nickname);
  if (profile.avatar_url) localStorage.setItem('otaq_avatar_url', profile.avatar_url);
  updateProfileHeaderUI();
}

window.distributeXP = function(winnerIds, gameMode = 'party') {
  const isMeWinner = Array.isArray(winnerIds) ? winnerIds.includes(state.playerId) : (winnerIds === state.playerId);
  const xpEarned = isMeWinner ? 150 : 50;
  const coinsEarned = isMeWinner ? 50 : 15;
  
  window.recordGameResult(gameMode, isMeWinner, xpEarned, coinsEarned);
};

window.recordGameResult = function(mode, isWin, xpEarned = 100, coinsEarned = 30) {
  const profile = getUserProfile();
  const oldLevel = calculateLevel(profile.xp);
  
  profile.xp += xpEarned;
  profile.coins = (profile.coins || 0) + coinsEarned;
  profile.stats.games_played++;
  
  if (isWin) {
    profile.stats.games_won++;
    profile.stats.win_streak++;
    if (profile.stats.win_streak > profile.stats.max_win_streak) {
      profile.stats.max_win_streak = profile.stats.win_streak;
    }
    if (mode === 'sabotage') profile.stats.sabotage_wins++;
    else if (mode === 'wordbomb') profile.stats.wordbomb_wins++;
    else if (mode === 'auction') profile.stats.auction_wins++;
    else if (mode === 'canvas') profile.stats.canvas_wins++;
  } else {
    profile.stats.win_streak = 0;
  }

  // Record match history
  const matchEntry = {
    id: 'm_' + Date.now(),
    mode: mode,
    won: isWin,
    xp_earned: xpEarned,
    coins_earned: coinsEarned,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  };
  
  if (!profile.match_history) profile.match_history = [];
  profile.match_history.unshift(matchEntry);
  if (profile.match_history.length > 15) profile.match_history.pop();

  // Check achievements
  ACHIEVEMENTS.forEach(ach => {
    if (!profile.unlocked_achievements.includes(ach.id) && ach.condition(profile)) {
      profile.unlocked_achievements.push(ach.id);
      profile.xp += ach.xp;
      profile.coins += ach.coins;
      showToast(`🎉 Nailiyyət Açıldı: ${isAz() ? ach.title_az : ach.title_en} (+${ach.xp} XP)`, 'success');
      playSound('win');
    }
  });

  const newLevel = calculateLevel(profile.xp);
  if (newLevel > oldLevel) {
    showToast(`🌟 TƏBRİKLƏR! Səviyyə ${newLevel} oldunuz!`, 'success');
    playSound('win');
  }

  saveUserProfile(profile);
};

function updateProfileHeaderUI() {
  const profile = getUserProfile();
  const level = calculateLevel(profile.xp);
  const nextLvlXP = getXPForNextLevel(level);
  const prevLvlXP = getXPForNextLevel(level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXP);
  const totalLvlSpan = Math.max(1, nextLvlXP - prevLvlXP);
  const pct = Math.min(100, Math.round((currentLvlProgress / totalLvlSpan) * 100));

  // Menu username & avatar updates
  const menuNick = document.getElementById('menu-nickname');
  if (menuNick) menuNick.textContent = profile.nickname;
  
  const menuAvatar = document.getElementById('menu-avatar-img');
  if (menuAvatar) menuAvatar.src = profile.avatar_url;

  const userBadge = document.getElementById('user-header-badge');
  if (userBadge) {
    userBadge.innerHTML = `
      <div class="user-profile-badge" onclick="openProfileModal()" style="cursor:pointer;" title="${isAz() ? 'Profil və Nailiyyətlər' : 'Profile & Achievements'}">
        <img src="${profile.avatar_url}" style="width:38px; height:38px; border-radius:50%; border:2px solid var(--accent-cyan);" />
        <div style="text-align:left;">
          <div style="font-weight:800; font-size:0.9rem; display:flex; align-items:center; gap:6px;">
            <span>${profile.nickname}</span>
            <span style="font-size:0.75rem; background:rgba(56,189,248,0.15); color:var(--accent-cyan); padding:2px 8px; border-radius:10px; border:1px solid rgba(56,189,248,0.3);">LVL ${level}</span>
          </div>
          <div class="xp-progress-bar" style="width:110px;">
            <div class="xp-progress-fill" style="width:${pct}%;"></div>
          </div>
        </div>
      </div>
    `;
  }
}

function openProfileModal(tab = 'overview') {
  let modal = document.getElementById('profile-modal');
  if (!modal) {
    createProfileModalDOM();
    modal = document.getElementById('profile-modal');
  }
  if (modal) {
    modal.style.display = 'flex';
    renderProfileModal(tab);
    playSound('click');
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.style.display = 'none';
  playSound('click');
}

function createProfileModalDOM() {
  const div = document.createElement('div');
  div.id = 'profile-modal';
  div.className = 'modal-backdrop';
  div.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); z-index:99999; align-items:center; justify-content:center; padding:15px;';
  
  div.innerHTML = `
    <div class="glass-panel" style="max-width:540px; width:100%; max-height:90vh; display:flex; flex-direction:column; padding:1.5rem; position:relative; overflow:hidden;">
      <button class="btn btn-ghost" onclick="closeProfileModal()" style="position:absolute; top:12px; right:12px; width:36px; height:36px; padding:0; border-radius:50%; font-size:1.2rem;">✕</button>
      <div id="profile-modal-body" style="overflow-y:auto; padding-right:4px;"></div>
    </div>
  `;
  document.body.appendChild(div);
}

function renderProfileModal(activeTab = 'overview') {
  const body = document.getElementById('profile-modal-body');
  if (!body) return;
  
  const profile = getUserProfile();
  const level = calculateLevel(profile.xp);
  const rankTitle = profile.equipped_title || getPlayerRankTitle(level);
  const nextLvlXP = getXPForNextLevel(level);
  const prevLvlXP = getXPForNextLevel(level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXP);
  const totalLvlSpan = Math.max(1, nextLvlXP - prevLvlXP);
  const pct = Math.min(100, Math.round((currentLvlProgress / totalLvlSpan) * 100));
  const winRate = profile.stats.games_played > 0 ? Math.round((profile.stats.games_won / profile.stats.games_played) * 100) : 0;
  const frameStyle = getEquippedFrameStyle(profile);

  const tabs = [
    { id: 'overview', name: isAz() ? 'Baxış' : 'Overview', icon: '👤' },
    { id: 'leaderboard', name: isAz() ? 'Liderlər' : 'Ranks', icon: '🏆' },
    { id: 'shop', name: isAz() ? 'Mağaza' : 'Shop', icon: '🛍️' },
    { id: 'achievements', name: isAz() ? 'Medallar' : 'Badges', icon: '⭐' },
    { id: 'history', name: isAz() ? 'Tarixçə' : 'History', icon: '📜' },
    { id: 'settings', name: isAz() ? 'Tənzimləmə' : 'Settings', icon: '⚙️' }
  ];

  let tabContent = '';

  if (activeTab === 'overview') {
    tabContent = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <div style="position:relative; width:88px; height:88px; margin:0 auto 10px auto;">
          <img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; border:3px solid var(--accent-cyan); background:rgba(255,255,255,0.05); ${frameStyle}" />
          <span style="position:absolute; bottom:0; right:0; background:var(--accent-gold); color:#000; font-weight:900; font-size:0.75rem; padding:2px 6px; border-radius:10px;">LVL ${level}</span>
        </div>
        <h2 style="margin:0; font-size:1.4rem; font-weight:800;">${profile.nickname}</h2>
        <div style="font-size:0.85rem; color:var(--accent-cyan); font-weight:700; margin-top:2px;">${rankTitle}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">${profile.friend_code}</div>
      </div>

      <!-- XP Bar -->
      <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:6px;">
          <span>Səviyyə İrəliləyişi</span>
          <span style="color:var(--accent-cyan);">${profile.xp} / ${nextLvlXP} XP (${pct}%)</span>
        </div>
        <div class="xp-progress-bar" style="height:8px;">
          <div class="xp-progress-fill" style="width:${pct}%;"></div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-bottom:1.25rem;">
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); text-align:center;">
          <div style="font-size:1.5rem; font-weight:900; color:var(--text-primary);">${profile.stats.games_played}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Oynanılan Oyun</div>
        </div>
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); text-align:center;">
          <div style="font-size:1.5rem; font-weight:900; color:var(--accent-green);">${profile.stats.games_won}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Qələbələr (${winRate}%)</div>
        </div>
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); text-align:center;">
          <div style="font-size:1.5rem; font-weight:900; color:var(--accent-gold);">${profile.coins || 100} 🪙</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Partiya Sikkəsi</div>
        </div>
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); border:1px solid var(--glass-border); text-align:center;">
          <div style="font-size:1.5rem; font-weight:900; color:var(--accent-red);">${profile.stats.win_streak} 🔥</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Cari Qələbə Seriyası</div>
        </div>
      </div>
    `;
  } else if (activeTab === 'leaderboard') {
    const topPlayers = [
      { rank: 1, name: 'LordXaos 👑', level: 42, xp: 3450, streak: 18, medal: '🥇' },
      { rank: 2, name: 'ShadowMaster 🗡️', level: 36, xp: 2890, streak: 12, medal: '🥈' },
      { rank: 3, name: 'CyberQueen 💎', level: 29, xp: 2210, streak: 9, medal: '🥉' },
      { rank: 4, name: 'BombaUstası_99 💣', level: 22, xp: 1750, streak: 5, medal: '4' },
      { rank: 5, name: 'DedektivPro 🔍', level: 18, xp: 1320, streak: 4, medal: '5' }
    ];

    tabContent = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="text-align:center; margin-bottom:10px;">
          <h4 style="margin:0; font-size:1.1rem; color:var(--accent-gold);">🏆 Qlobal Partiya Çempionları</h4>
          <span style="font-size:0.75rem; color:var(--text-secondary);">Hər oyunda XP qazanaraq liderlik pilləsinə yüksəlin!</span>
        </div>

        ${topPlayers.map(p => `
          <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid ${p.rank <= 3 ? 'rgba(245,158,11,0.3)' : 'var(--glass-border)'}; padding:10px 14px; border-radius:var(--radius-md);">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:1.3rem; font-weight:900; width:24px; text-align:center;">${p.medal}</span>
              <div>
                <strong style="font-size:0.95rem; display:block;">${p.name}</strong>
                <span style="font-size:0.75rem; color:var(--accent-cyan); font-weight:700;">LVL ${p.level} • ${p.xp} XP</span>
              </div>
            </div>
            <span style="font-size:0.85rem; font-weight:800; color:var(--accent-red);">${p.streak} 🔥 Seriya</span>
          </div>
        `).join('')}

        <!-- My Rank Bar -->
        <div style="margin-top:10px; padding:12px; background:rgba(56,189,248,0.1); border:1px solid var(--accent-cyan); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:900; color:var(--accent-cyan);">SİZ</span>
            <strong>${profile.nickname}</strong>
          </div>
          <span style="font-size:0.85rem; font-weight:800; color:var(--accent-gold);">LVL ${level} • ${profile.xp} XP</span>
        </div>
      </div>
    `;
  } else if (activeTab === 'shop') {
    const inventory = profile.inventory || [];
    tabContent = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); padding:10px 14px; border-radius:var(--radius-md); margin-bottom:8px;">
          <span style="font-weight:700; font-size:0.9rem;">Balansınız:</span>
          <strong style="font-size:1.2rem; color:var(--accent-gold);">${profile.coins || 100} 🪙 Sikkə</strong>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
          ${SHOP_ITEMS.map(item => {
            const isOwned = inventory.includes(item.id);
            const isEquipped = (item.type === 'frame' && profile.equipped_frame === item.id) || (item.type === 'title' && profile.equipped_title === (isAz() ? item.name_az : item.name_en));
            return `
              <div style="background:rgba(255,255,255,0.03); border:1px solid ${isEquipped ? 'var(--accent-cyan)' : 'var(--glass-border)'}; border-radius:var(--radius-md); padding:12px; text-align:center; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <div style="font-size:2rem; margin-bottom:4px;">${item.icon}</div>
                  <strong style="font-size:0.85rem; display:block; margin-bottom:4px;">${isAz() ? item.name_az : item.name_en}</strong>
                </div>
                <div style="margin-top:8px;">
                  ${isOwned ? `
                    <button class="btn ${isEquipped ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="equipShopItem('${item.id}')" style="width:100%; font-size:0.75rem; font-weight:800;">
                      ${isEquipped ? (isAz() ? '✓ Aktivdir' : '✓ Equipped') : (isAz() ? 'Geyin' : 'Equip')}
                    </button>
                  ` : `
                    <button class="btn btn-primary btn-sm" onclick="buyShopItem('${item.id}')" style="width:100%; font-size:0.75rem; font-weight:800; background:linear-gradient(135deg, #f59e0b, #d97706); border:none;">
                      ${item.price} 🪙 Al
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (activeTab === 'achievements') {
    tabContent = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${ACHIEVEMENTS.map(ach => {
          const unlocked = profile.unlocked_achievements.includes(ach.id);
          return `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:${unlocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.02)'}; border-radius:var(--radius-md); border:1px solid ${unlocked ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-border)'};">
              <div style="font-size:2rem; filter:${unlocked ? 'none' : 'grayscale(100%) opacity(0.4)'};">${ach.icon}</div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <strong style="font-size:0.95rem; color:${unlocked ? 'var(--accent-green)' : 'var(--text-primary)'};">${isAz() ? ach.title_az : ach.title_en}</strong>
                  <span style="font-size:0.75rem; font-weight:700; color:var(--accent-cyan);">+${ach.xp} XP</span>
                </div>
                <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">${isAz() ? ach.desc_az : ach.desc_en}</p>
              </div>
              <div>${unlocked ? '✅' : '🔒'}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (activeTab === 'history') {
    const history = profile.match_history || [];
    tabContent = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${history.length === 0 ? `<p style="text-align:center; color:var(--text-secondary); margin:2rem 0;">Hələ heç bir oyun oynanılmayıb.</p>` : history.map(m => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:var(--radius-md);">
            <div>
              <strong style="font-size:0.9rem; text-transform:capitalize;">${m.mode}</strong>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${m.date}</div>
            </div>
            <div style="text-align:right;">
              <span style="font-weight:800; font-size:0.85rem; padding:3px 10px; border-radius:12px; background:${m.won ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${m.won ? 'var(--accent-green)' : 'var(--accent-red)'};">
                ${m.won ? (isAz() ? 'QƏLƏBƏ 🏆' : 'VICTORY 🏆') : (isAz() ? 'MƏĞLUBİYYƏT 💀' : 'DEFEAT 💀')}
              </span>
              <div style="font-size:0.75rem; color:var(--accent-gold); margin-top:4px;">+${m.xp_earned} XP</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (activeTab === 'settings') {
    tabContent = `
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:6px;">Ləqəbi Dəyiş</label>
          <input type="text" id="profile-edit-nickname" class="input-field" value="${profile.nickname}" maxlength="16" style="margin:0;" />
        </div>
        <div>
          <button class="btn btn-secondary" onclick="showAvatarModal()" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px;">
            <img src="${profile.avatar_url}" style="width:24px; height:24px; border-radius:50%;" />
            Avatarı Fərdiləşdir
          </button>
        </div>
        <button class="btn btn-primary" onclick="handleSaveProfileSettings()" style="width:100%; font-weight:800; margin-top:8px;">
          Yadda Saxla
        </button>
      </div>
    `;
  }

  body.innerHTML = `
    <!-- Header Tabs -->
    <div style="display:flex; gap:4px; background:rgba(0,0,0,0.3); padding:4px; border-radius:var(--radius-lg); margin-bottom:1.25rem; overflow-x:auto;">
      ${tabs.map(t => `
        <button class="btn btn-ghost btn-sm" onclick="renderProfileModal('${t.id}')" style="flex:1; min-width:65px; padding:7px 4px; font-size:0.75rem; font-weight:700; border-radius:var(--radius-md); background:${activeTab === t.id ? 'var(--accent-cyan)' : 'transparent'}; color:${activeTab === t.id ? '#000' : 'var(--text-secondary)'}; white-space:nowrap;">
          ${t.icon} ${t.name}
        </button>
      `).join('')}
    </div>

    <!-- Active Tab Content -->
    ${tabContent}
  `;
}

function handleSaveProfileSettings() {
  const input = document.getElementById('profile-edit-nickname');
  if (!input) return;
  const newNick = input.value.trim();
  if (!newNick) {
    showToast('Ləqəb boş ola bilməz!', 'error');
    return;
  }
  const profile = getUserProfile();
  profile.nickname = newNick;
  saveUserProfile(profile);
  showToast('Profil yeniləndi! 🎉', 'success');
  closeProfileModal();
}

// Global DOM Ready Handlers
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateProfileHeaderUI();
  
  document.body.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.classList.contains('btn') || e.target.classList.contains('mode-card')) {
      if (e.target.id === 'start-game-btn') {
        playSound('start');
      } else {
        playSound('click');
      }
    }
  });
});

