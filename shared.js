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
    } else if (type === 'tick') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'bomb') {
      // Cinematic deep boom
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'correct') {
      osc.type = 'sine';
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
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, now + idx * 0.1);
        g.gain.setValueAtTime(0.1, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + idx * 0.1);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.1);
        o.stop(now + 0.6 + idx * 0.1);
      });
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

// Global button sound listener
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
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
