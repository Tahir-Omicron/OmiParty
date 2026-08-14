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
    back_to_lobby: 'Lobbiyə Qayıt'
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
    back_to_lobby: 'Back to Lobby'
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

// Day/Night Mode Initialization
function initTheme() {
  const theme = localStorage.getItem('otaq_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = getThemeIcon(theme);
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
initTheme();
document.addEventListener('DOMContentLoaded', initTheme);

// ----------------------------------------------------------------------------
// WEB AUDIO API SYNTHESIZER
// ----------------------------------------------------------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  if (type === 'hover') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } else if (type === 'click') {
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } else if (type === 'start') {
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'error') {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  } else if (type === 'success') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.4);
  }
}

// Bind sounds to buttons globally
document.addEventListener('DOMContentLoaded', () => {
  // Hover sound removed because it is annoying
  // document.body.addEventListener('mouseover', (e) => {
  //   if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.classList.contains('btn')) {
  //     playSound('hover');
  //   }
  // });
  document.body.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.classList.contains('btn')) {
      if (e.target.id === 'start-game-btn') {
        playSound('start');
      } else {
        playSound('click');
      }
    }
  });
});
