// ============================================================================
// LIAR'S CANVAS — canvas-game.js
// Social deduction drawing party game: artists draw the secret word, while the Faker bluffs!
// Full Azerbaijani & English support, neon color palette, undo, and resilient game flow.
// ============================================================================

(function() {
    function gs() { return state.room ? state.room.game_state : null; }
    function me() { return state.players.find(p => p.id === state.playerId); }
    function getActivePlayers() { return state.players; }

    async function updateGameState(params) {
        const current = gs();
        const newState = { ...current, ...params };
        await fastUpdateGameState(newState);
    }

    // ========================================================================
    // GAME START
    // ========================================================================
    window.startCanvasGame = async function() {
        if (!state.isHost) return;
        const players = getActivePlayers();
        
        const scores = {};
        players.forEach(p => scores[p.id] = 0);

        await fastUpdateGameState({}, {
            status: 'playing',
            game_mode: 'canvas'
        });

        await startRound(1, scores);
    };

    async function startRound(roundNum, scores) {
        const players = getActivePlayers();
        const faker = players[Math.floor(Math.random() * players.length)];
        
        const wordBanks = isAz() ? (window.CANVAS_WORDS_AZ || window.CANVAS_WORDS) : (window.CANVAS_WORDS_EN || window.CANVAS_WORDS);
        const categories = Object.keys(wordBanks);
        const categoryKey = categories[Math.floor(Math.random() * categories.length)];
        const categoryWords = wordBanks[categoryKey];
        const secretWord = categoryWords[Math.floor(Math.random() * categoryWords.length)];
        const playOrder = shuffleArray(players.map(p => p.id));

        const newGs = {
            phase: 'word_reveal',
            round: roundNum,
            max_rounds: 3,
            scores: scores,
            faker_id: faker.id,
            category: categoryKey,
            secret_word: secretWord,
            play_order: playOrder,
            turn_index: 0,
            current_round_strokes: [],
            votes: {},
            tallies: {},
            caught_faker: false,
            faker_guess_word: null,
            round_summary: '',
            final_scores: null,
            end_time: Date.now() + (state.room?.game_state?.is_hardcore ? 3000 : 5500)
        };

        await fastUpdateGameState(newGs);
    }

    // ========================================================================
    // DRAWING PHASE
    // ========================================================================
    async function startDrawingTurn() {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;
        
        if (current.turn_index >= current.play_order.length) {
            await startVoting();
            return;
        }

        const currentDrawer = current.play_order[current.turn_index];
        await updateGameState({
            phase: 'drawing',
            current_drawer: currentDrawer,
            end_time: Date.now() + (state.room?.game_state?.is_hardcore ? 8000 : 15000)
        });
    }

    async function nextDrawingTurn() {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;
        await updateGameState({ turn_index: current.turn_index + 1 });
        await startDrawingTurn();
    }

    // ========================================================================
    // VOTING PHASE
    // ========================================================================
    async function startVoting() {
        if (!state.isHost) return;
        await updateGameState({
            phase: 'voting',
            votes: {},
            end_time: Date.now() + (state.room?.game_state?.is_hardcore ? 10000 : 18000)
        });
    }

    async function tallyVotesAndProceed() {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;

        const tallies = {};
        getActivePlayers().forEach(p => tallies[p.id] = 0);
        Object.values(current.votes || {}).forEach(votedId => {
            if (tallies[votedId] !== undefined) tallies[votedId]++;
        });

        let maxVotes = -1;
        let mostVotedId = null;
        let isTie = false;

        Object.entries(tallies).forEach(([pid, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedId = pid;
                isTie = false;
            } else if (count === maxVotes && maxVotes > 0) {
                isTie = true;
            }
        });

        const caughtFaker = !isTie && mostVotedId === current.faker_id;

        await updateGameState({
            phase: 'vote_result',
            tallies,
            caught_faker: caughtFaker,
            most_voted_id: isTie ? null : mostVotedId,
            end_time: Date.now() + 4500
        });
    }

    // ========================================================================
    // FAKER GUESS & ROUND END
    // ========================================================================
    async function startFakerGuess() {
        if (!state.isHost) return;
        await updateGameState({
            phase: 'faker_guess',
            end_time: Date.now() + (state.room?.game_state?.is_hardcore ? 8000 : 15000)
        });
    }

    async function resolveRound(fakerWasCaught) {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;
        
        const newScores = { ...current.scores };
        const players = getActivePlayers();
        let roundSummary = '';

        if (!fakerWasCaught) {
            newScores[current.faker_id] = (newScores[current.faker_id] || 0) + 3;
            roundSummary = isAz() ? 'Xain gizlənməyi bacardı! Xainə +3 xal.' : 'The Faker escaped! Faker gets +3 points.';
        } else {
            const guess = current.faker_guess_word;
            const normGuess = window.normalizeWord ? window.normalizeWord(guess || '') : (guess || '').toLowerCase().trim();
            const normSecret = window.normalizeWord ? window.normalizeWord(current.secret_word) : current.secret_word.toLowerCase().trim();
            
            if (normGuess && normGuess === normSecret) {
                newScores[current.faker_id] = (newScores[current.faker_id] || 0) + 2;
                roundSummary = isAz() ? 'Xain tutuldu, lakin gizli sözü düz tapdı! Xainə +2 xal.' : 'Faker was caught but guessed the secret word! Faker gets +2 points.';
            } else {
                players.forEach(p => {
                    if (p.id !== current.faker_id) {
                        newScores[p.id] = (newScores[p.id] || 0) + 2;
                    }
                });
                roundSummary = isAz() ? 'Xain ifşa olundu və sözü tapa bilmədi! Digər hər kəsə +2 xal.' : 'Faker was caught and failed to guess! Artists get +2 points each.';
            }
        }

        await updateGameState({
            phase: 'round_result',
            scores: newScores,
            round_summary: roundSummary,
            end_time: Date.now() + 5500
        });
    }

    // ========================================================================
    // TIMER UI
    // ========================================================================
    let timerInterval = null;
    function startTimerUI(endTime) {
        clearInterval(timerInterval);
        const el = $('#cv-timer');
        if (!el) return;
        const tick = () => {
            const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            el.textContent = `${left}s`;
            if (left <= 3) el.style.color = 'var(--accent-red)';
            else el.style.color = 'var(--accent-cyan)';
            if (left <= 0) clearInterval(timerInterval);
        };
        tick();
        timerInterval = setInterval(tick, 250);
    }

    // ========================================================================
    // STATE HANDLER
    // ========================================================================
    window.handleCanvasState = function(gameState) {
        showScreen('canvas');
        const main = $('#canvas-main-area');
        if (!main) return;
        
        const myPlayer = me();
        if (!myPlayer) return;

        if (gameState.end_time) {
            setTimeout(() => startTimerUI(gameState.end_time), 50);
        }

        // Resilient host phase transitions across page loads
        if (state.isHost) {
            if (gameState.phase === 'word_reveal') {
                if (!state.cvWordRevealTimeout) {
                    state.cvWordRevealTimeout = setTimeout(() => {
                        state.cvWordRevealTimeout = null;
                        const cur = gs();
                        if (cur && cur.phase === 'word_reveal') startDrawingTurn();
                    }, gameState.is_hardcore ? 3200 : 5500);
                }
            } else if (gameState.phase === 'drawing') {
                if (window.cvTurnTimer) clearTimeout(window.cvTurnTimer);
                const timeLeft = Math.max(1000, (gameState.end_time || (Date.now() + 15000)) - Date.now());
                window.cvTurnTimer = setTimeout(() => {
                    const cur = gs();
                    if (cur && cur.phase === 'drawing' && cur.current_drawer === gameState.current_drawer) {
                        nextDrawingTurn();
                    }
                }, timeLeft + 300);
            } else if (gameState.phase === 'voting') {
                if (window.cvVoteCheckInterval) clearInterval(window.cvVoteCheckInterval);
                window.cvVoteCheckInterval = setInterval(() => {
                    const cur = gs();
                    if (!cur || cur.phase !== 'voting') {
                        clearInterval(window.cvVoteCheckInterval);
                        return;
                    }
                    const players = getActivePlayers();
                    const voteCount = Object.keys(cur.votes || {}).length;
                    if (voteCount >= players.length || (cur.end_time && Date.now() >= cur.end_time)) {
                        clearInterval(window.cvVoteCheckInterval);
                        tallyVotesAndProceed();
                    }
                }, 500);
            } else if (gameState.phase === 'vote_result') {
                if (!state.cvVoteResultTimeout) {
                    state.cvVoteResultTimeout = setTimeout(() => {
                        state.cvVoteResultTimeout = null;
                        const cur = gs();
                        if (cur && cur.phase === 'vote_result') {
                            if (cur.caught_faker) startFakerGuess();
                            else resolveRound(false);
                        }
                    }, 4500);
                }
            } else if (gameState.phase === 'faker_guess') {
                if (window.cvGuessTimer) clearTimeout(window.cvGuessTimer);
                const timeLeft = Math.max(1000, (gameState.end_time || (Date.now() + 15000)) - Date.now());
                window.cvGuessTimer = setTimeout(() => {
                    const cur = gs();
                    if (cur && cur.phase === 'faker_guess') resolveRound(true);
                }, timeLeft + 300);
            } else if (gameState.phase === 'round_result') {
                if (!state.cvRoundResultTimeout) {
                    state.cvRoundResultTimeout = setTimeout(() => {
                        state.cvRoundResultTimeout = null;
                        const cur = gs();
                        if (cur && cur.phase === 'round_result') {
                            if (cur.round >= cur.max_rounds) {
                                updateGameState({ phase: 'game_over', final_scores: cur.scores });
                            } else {
                                startRound(cur.round + 1, cur.scores);
                            }
                        }
                    }, 5500);
                }
            }
        }

        switch (gameState.phase) {
            case 'word_reveal': renderWordReveal(main, gameState, myPlayer); break;
            case 'drawing': renderDrawing(main, gameState, myPlayer); break;
            case 'voting': renderVoting(main, gameState, myPlayer); break;
            case 'vote_result': renderVoteResult(main, gameState); break;
            case 'faker_guess': renderFakerGuess(main, gameState, myPlayer); break;
            case 'round_result': renderRoundResult(main, gameState); break;
            case 'game_over': showGameOver(gameState); break;
        }
    };

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================
    function renderWordReveal(main, gs, myPlayer) {
        const isFaker = myPlayer.id === gs.faker_id;
        const wordDisplay = isFaker ? '???' : gs.secret_word.toUpperCase();
        const roleClass = isFaker ? 'cv-faker-role' : 'cv-artist-role';
        const roleText = isFaker 
            ? (isAz() ? "Siz XAİNSİNİZ! Bildirmədən rəssam kimi çəkin." : "You are the FAKER! Blend in with the artists.") 
            : (isAz() ? "Siz RƏSSAMSINIZ. Xaini ifşa edin!" : "You are an ARTIST. Spot the Faker!");

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <div class="cv-badge-cat">${isAz() ? 'KATEQORİYA' : 'CATEGORY'}: <strong>${gs.category.toUpperCase()}</strong></div>
                <div class="cv-word-display ${isFaker ? 'cv-faker-word' : ''}">${wordDisplay}</div>
                <p class="${roleClass}" style="font-size:1.15rem;font-weight:700;margin:0.5rem 0;">${roleText}</p>
                <div class="cv-round-badge">${isAz() ? `Raund ${gs.round} / ${gs.max_rounds}` : `Round ${gs.round} of ${gs.max_rounds}`}</div>
            </div>
        `;
    }

    let activeColor = '#06b6d4';
    let activeWidth = 4;

    function renderDrawing(main, gs, myPlayer) {
        const drawer = state.players.find(p => p.id === gs.current_drawer);
        const isMyTurn = myPlayer.id === gs.current_drawer;
        const turnLabel = isMyTurn 
            ? (isAz() ? "SİZİN NÖVBƏNİZDİR — 1 xətt çəkin!" : "YOUR TURN — Draw one stroke!") 
            : (isAz() ? `${drawer?.nickname || 'Oyunçu'} çəkir...` : `${drawer?.nickname || 'Player'}'s turn to draw`);
        const turnIdx = gs.turn_index + 1;
        const totalTurns = gs.play_order.length;

        const colors = ['#ffffff', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#090d16'];

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div style="display:flex;justify-content:space-between;width:100%;max-width:420px;align-items:center;">
                    <span class="cv-turn-counter" style="font-weight:700;color:var(--text-secondary);">${turnIdx} / ${totalTurns}</span>
                    <div id="cv-timer" class="cv-timer" style="margin:0;"></div>
                </div>
                <h3 class="cv-turn-label" style="font-size:1.2rem;font-weight:700;margin:0.25rem 0 0.75rem 0;color:${isMyTurn ? 'var(--accent-cyan)' : 'var(--text-primary)'};">${turnLabel}</h3>
                
                <div class="cv-canvas-wrap">
                    <canvas id="drawing-canvas" width="400" height="400"></canvas>
                </div>

                ${isMyTurn ? `
                <div class="cv-toolbar">
                    <div class="cv-colors">
                        ${colors.map(c => `<button class="cv-color-dot ${activeColor === c ? 'active' : ''}" data-color="${c}" style="background:${c};"></button>`).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        setTimeout(() => {
            const canvas = $('#drawing-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 400, 400);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            (gs.current_round_strokes || []).forEach(stroke => drawStroke(ctx, stroke));

            if (isMyTurn) {
                setupDrawing(canvas, ctx, gs);
                // Bind color dots
                $$('.cv-color-dot').forEach(b => {
                    b.addEventListener('click', (e) => {
                        activeColor = e.target.dataset.color;
                        $$('.cv-color-dot').forEach(d => d.classList.remove('active'));
                        e.target.classList.add('active');
                    });
                });
            }
        }, 50);
    }

    function drawStroke(ctx, stroke) {
        if (!stroke.points || stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color || '#06b6d4';
        ctx.lineWidth = stroke.width || 4;
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
    }

    function setupDrawing(canvas, ctx, gameState) {
        let drawing = false;
        let done = false;
        let points = [];

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: Math.round((cx - rect.left) * (400 / rect.width)),
                y: Math.round((cy - rect.top) * (400 / rect.height))
            };
        };

        const onStart = (e) => {
            if (done) return;
            e.preventDefault();
            drawing = true;
            const p = getPos(e);
            points = [p];
            ctx.beginPath();
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = activeWidth;
            ctx.moveTo(p.x, p.y);
            playSound('click');
        };

        const onMove = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const p = getPos(e);
            points.push(p);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        };

        const onEnd = async (e) => {
            if (!drawing) return;
            e.preventDefault();
            drawing = false;
            done = true;

            if (points.length > 0) {
                const newStroke = { playerId: state.playerId, color: activeColor, width: activeWidth, points };
                const currentStrokes = gameState.current_round_strokes || [];
                const newStrokes = [...currentStrokes, newStroke];
                
                await updateGameState({ current_round_strokes: newStrokes });
                
                if (state.isHost) {
                    setTimeout(() => nextDrawingTurn(), 400);
                }
            }
        };

        canvas.addEventListener('mousedown', onStart);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseup', onEnd);
        canvas.addEventListener('mouseleave', onEnd);
        canvas.addEventListener('touchstart', onStart, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onEnd, { passive: false });
    }

    function renderVoting(main, gs, myPlayer) {
        const hasVoted = gs.votes && gs.votes[myPlayer.id];
        
        let playersHtml = '';
        getActivePlayers().forEach(p => {
            if (p.id === myPlayer.id) return;
            const selected = gs.votes && gs.votes[myPlayer.id] === p.id;
            const avatarUrl = p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.nickname)}`;
            playersHtml += `
                <button class="cv-vote-card ${selected ? 'cv-voted' : ''}" data-vote-target="${p.id}">
                    <img src="${avatarUrl}" class="cv-vote-avatar" alt="${p.nickname}" />
                    <span>${p.nickname}</span>
                </button>
            `;
        });

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h3 style="font-weight:800;font-size:1.3rem;margin-bottom:0.75rem;">${isAz() ? 'Xain kimdir? Səs verin:' : 'Who is the Faker? Cast your vote:'}</h3>
                <div class="cv-canvas-wrap" style="opacity:0.85;pointer-events:none;margin-bottom:1rem;max-width:320px;">
                    <canvas id="drawing-canvas" width="400" height="400"></canvas>
                </div>
                <div class="cv-vote-grid">${playersHtml}</div>
                ${hasVoted ? `<p class="cv-voted-msg">${isAz() ? 'Səsiniz qeydə alındı! Digərləri gözlənilir...' : 'Vote cast! Waiting for others...'}</p>` : ''}
            </div>
        `;

        setTimeout(() => {
            const canvas = $('#drawing-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 400, 400);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            (gs.current_round_strokes || []).forEach(stroke => drawStroke(ctx, stroke));

            $$('.cv-vote-card').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetId = e.currentTarget.dataset.voteTarget;
                    if (!targetId || hasVoted) return;
                    playSound('click');
                    const newVotes = { ...(gs.votes || {}) };
                    newVotes[myPlayer.id] = targetId;
                    await updateGameState({ votes: newVotes });
                });
            });
        }, 50);
    }

    function renderVoteResult(main, gs) {
        const faker = state.players.find(p => p.id === gs.faker_id);
        const resultTitle = gs.caught_faker 
            ? (isAz() ? 'XAİN İFŞA OLUNDU! 🎯' : 'FAKER CAUGHT! 🎯') 
            : (isAz() ? 'XAİN GİZLƏNƏ BİLDİ! 🎭' : 'FAKER ESCAPED! 🎭');
        const resultColor = gs.caught_faker ? 'var(--accent-green)' : 'var(--accent-red)';

        if (gs.caught_faker) playSound('win');
        else playSound('bomb');

        let tallyHtml = '';
        getActivePlayers().forEach(p => {
            const count = gs.tallies[p.id] || 0;
            const isThisFaker = p.id === gs.faker_id;
            tallyHtml += `
                <div class="cv-result-row ${isThisFaker ? 'cv-faker-reveal' : ''}">
                    <span>${p.nickname} ${isThisFaker ? `(<strong>${isAz() ? 'ƏSL XAİN' : 'REAL FAKER'}</strong>)` : ''}</span>
                    <strong>${count} ${isAz() ? 'səs' : 'votes'}</strong>
                </div>
            `;
        });

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h2 style="color:${resultColor};font-weight:900;font-size:1.8rem;margin-bottom:0.75rem;">${resultTitle}</h2>
                <p style="color:var(--text-secondary);margin-bottom:1rem;">${isAz() ? 'Əsl Xain:' : 'The Real Faker was:'} <strong style="color:var(--accent-gold);">${faker?.nickname || '???'}</strong></p>
                <div class="cv-results-list" style="width:100%;max-width:350px;">${tallyHtml}</div>
            </div>
        `;
    }

    function renderFakerGuess(main, gs, myPlayer) {
        const isFaker = myPlayer.id === gs.faker_id;
        const faker = state.players.find(p => p.id === gs.faker_id);

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h2 style="color:var(--accent-gold);font-weight:900;margin-bottom:0.5rem;">${isAz() ? 'Xainin Son Şansı! 🎲' : 'Faker\'s Last Chance! 🎲'}</h2>
                <p style="color:var(--text-secondary);margin-bottom:1rem;">
                    ${isFaker 
                        ? (isAz() ? `Kateqoriya <strong>${gs.category.toUpperCase()}</strong>. Gizli sözü təxmin edin:` : `Category: <strong>${gs.category.toUpperCase()}</strong>. Guess the secret word:`) 
                        : (isAz() ? `${faker?.nickname} gizli sözü təxmin etməyə çalışır...` : `${faker?.nickname} is guessing the word...`)}
                </p>
                ${isFaker ? `
                    <div style="display:flex;gap:8px;width:100%;max-width:350px;">
                        <input type="text" id="cv-guess-input" class="cv-guess-input" placeholder="${isAz() ? 'Sözü yazın...' : 'Type word...'}" autocomplete="off" />
                        <button id="cv-guess-btn" class="btn btn-primary" style="font-weight:800;">${isAz() ? 'TƏXMİN ET' : 'GUESS'}</button>
                    </div>
                ` : `
                    <div class="spinner" style="margin-top:1rem;"></div>
                `}
            </div>
        `;

        if (isFaker) {
            setTimeout(() => {
                const input = $('#cv-guess-input');
                const btn = $('#cv-guess-btn');
                const submitGuess = async () => {
                    const val = input.value.trim();
                    if (!val) return;
                    playSound('click');
                    await updateGameState({ faker_guess_word: val });
                    if (state.isHost) resolveRound(true);
                };
                if (btn) btn.addEventListener('click', submitGuess);
                if (input) {
                    input.focus();
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') submitGuess();
                    });
                }
            }, 50);
        }
    }

    function renderRoundResult(main, gs) {
        let scoresHtml = '';
        getActivePlayers().forEach(p => {
            const score = gs.scores[p.id] || 0;
            scoresHtml += `
                <div class="cv-score-row">
                    <span>${p.nickname}</span>
                    <span class="cv-score-val">${score} PTS</span>
                </div>
            `;
        });

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h2 style="font-weight:900;font-size:1.6rem;color:var(--accent-cyan);">${isAz() ? 'Raundun Yekunu' : 'Round Summary'}</h2>
                <p style="color:var(--text-primary);font-size:1.1rem;margin:0.75rem 0;font-weight:600;">${gs.round_summary}</p>
                <div class="cv-scoreboard">${scoresHtml}</div>
            </div>
        `;
    }

    // ========================================================================
    // BOT AI (Natural Doodling & Realistic Voting)
    // ========================================================================
    let botDrawingFlags = {};
    let botVotingFlags = {};
    let botGuessFlag = false;

    window.processCanvasBotActions = function(gameState) {
        if (!state.isHost) return;
        const bots = getActivePlayers().filter(p => p.nickname.startsWith('Bot_'));

        bots.forEach(bot => {
            // Bot Drawing
            if (gameState.phase === 'drawing' && gameState.current_drawer === bot.id) {
                if (!botDrawingFlags[bot.id]) {
                    botDrawingFlags[bot.id] = true;
                    setTimeout(async () => {
                        const current = gs();
                        if (!current || current.phase !== 'drawing') { botDrawingFlags[bot.id] = false; return; }
                        
                        // Generate diverse procedural doodle based on random style index
                        const pts = [];
                        const patternType = Math.floor(Math.random() * 4);
                        const cx = 120 + Math.random() * 160;
                        const cy = 120 + Math.random() * 160;

                        if (patternType === 0) {
                            // Organic Circle / Ellipse
                            const steps = 16;
                            const rx = 30 + Math.random() * 45;
                            const ry = 25 + Math.random() * 40;
                            for (let i = 0; i <= steps; i++) {
                                const angle = (i / steps) * Math.PI * 2;
                                pts.push({
                                    x: Math.round(cx + Math.cos(angle) * rx + (Math.random() * 6 - 3)),
                                    y: Math.round(cy + Math.sin(angle) * ry + (Math.random() * 6 - 3))
                                });
                            }
                        } else if (patternType === 1) {
                            // Zigzag / Star Wave
                            const steps = 8;
                            for (let i = 0; i <= steps; i++) {
                                const x = cx - 60 + i * 15;
                                const y = cy + (i % 2 === 0 ? -25 : 25) + (Math.random() * 8 - 4);
                                pts.push({ x: Math.round(x), y: Math.round(y) });
                            }
                        } else if (patternType === 2) {
                            // Triangle / Roof geometry
                            pts.push({ x: Math.round(cx), y: Math.round(cy - 40) });
                            pts.push({ x: Math.round(cx + 45), y: Math.round(cy + 30) });
                            pts.push({ x: Math.round(cx - 45), y: Math.round(cy + 30) });
                            pts.push({ x: Math.round(cx), y: Math.round(cy - 40) });
                        } else {
                            // Spiral / Swirl
                            const turns = 2.5;
                            const steps = 20;
                            for (let i = 0; i <= steps; i++) {
                                const t = i / steps;
                                const angle = t * Math.PI * 2 * turns;
                                const r = t * 50;
                                pts.push({
                                    x: Math.round(cx + Math.cos(angle) * r),
                                    y: Math.round(cy + Math.sin(angle) * r)
                                });
                            }
                        }

                        const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6'];
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        const strokes = [...(current.current_round_strokes || []), { playerId: bot.id, color, width: 4, points: pts }];
                        
                        await updateGameState({ current_round_strokes: strokes });
                        botDrawingFlags[bot.id] = false;
                        setTimeout(() => nextDrawingTurn(), 400);
                    }, 1800 + Math.random() * 2200);
                }
            }

            // Bot Voting
            if (gameState.phase === 'voting') {
                if (!botVotingFlags[bot.id] && !(gameState.votes && gameState.votes[bot.id])) {
                    botVotingFlags[bot.id] = true;
                    setTimeout(async () => {
                        const current = gs();
                        if (!current || current.phase !== 'voting') { botVotingFlags[bot.id] = false; return; }
                        const others = getActivePlayers().filter(p => p.id !== bot.id);
                        if (others.length === 0) { botVotingFlags[bot.id] = false; return; }
                        
                        // Bot has 45% chance to guess real faker, 55% random
                        let target = null;
                        if (Math.random() < 0.45 && current.faker_id !== bot.id) {
                            target = others.find(p => p.id === current.faker_id) || others[0];
                        } else {
                            target = others[Math.floor(Math.random() * others.length)];
                        }

                        const newVotes = { ...(current.votes || {}) };
                        newVotes[bot.id] = target.id;
                        await updateGameState({ votes: newVotes });
                        botVotingFlags[bot.id] = false;
                    }, 1200 + Math.random() * 2500);
                }
            }

            // Bot Faker Guess
            if (gameState.phase === 'faker_guess' && gameState.faker_id === bot.id && !gameState.faker_guess_word) {
                if (!botGuessFlag) {
                    botGuessFlag = true;
                    setTimeout(async () => {
                        const current = gs();
                        if (!current || current.phase !== 'faker_guess') { botGuessFlag = false; return; }
                        const wordBanks = isAz() ? (window.CANVAS_WORDS_AZ || window.CANVAS_WORDS) : (window.CANVAS_WORDS_EN || window.CANVAS_WORDS);
                        const words = wordBanks[current.category] || ['alma'];
                        const guess = words[Math.floor(Math.random() * words.length)];
                        await updateGameState({ faker_guess_word: guess });
                        botGuessFlag = false;
                        resolveRound(true);
                    }, 2000 + Math.random() * 2000);
                }
            }
        });

        if (gameState.phase !== 'drawing') botDrawingFlags = {};
        if (gameState.phase !== 'voting') botVotingFlags = {};
        if (gameState.phase !== 'faker_guess') botGuessFlag = false;
    };

    // ========================================================================
    // INJECT STYLES
    // ========================================================================
    const cvStyle = document.createElement('style');
    cvStyle.textContent = `
        .cv-phase-panel { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1.5rem; gap: 0.75rem; width: 100%; max-width: 500px; margin: 0 auto; box-sizing: border-box; }
        .cv-timer { font-family: var(--font-heading); font-size: 1.6rem; font-weight: 800; color: var(--accent-cyan); text-shadow: 0 0 10px rgba(6, 182, 212, 0.4); }
        .cv-badge-cat { font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); padding: 4px 14px; border-radius: 20px; text-transform: uppercase; }
        .cv-word-display { font-family: var(--font-heading); font-size: 3rem; font-weight: 900; color: var(--accent-green); letter-spacing: 5px; margin: 0.75rem 0; padding: 1.25rem 2.5rem; background: rgba(16, 185, 129, 0.12); border-radius: var(--radius-xl); border: 2px solid rgba(16, 185, 129, 0.4); text-shadow: 0 0 25px rgba(16, 185, 129, 0.5); width: 100%; box-sizing: border-box; }
        .cv-faker-word { color: var(--accent-red) !important; background: rgba(239, 68, 68, 0.12) !important; border-color: rgba(239, 68, 68, 0.4) !important; text-shadow: 0 0 25px rgba(239, 68, 68, 0.5) !important; }
        .cv-faker-role { color: var(--accent-red); }
        .cv-artist-role { color: var(--accent-cyan); }
        .cv-round-badge { margin-top: 0.25rem; padding: 0.35rem 1.25rem; background: rgba(255,255,255,0.06); border-radius: 999px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; }
        
        .cv-canvas-wrap { border: 2px solid rgba(255,255,255,0.15); border-radius: var(--radius-lg); overflow: hidden; background: #0f172a; max-width: 100%; box-shadow: 0 15px 35px rgba(0,0,0,0.5); }
        .cv-canvas-wrap canvas { display: block; max-width: 100%; height: auto; touch-action: none; }
        
        .cv-toolbar { display: flex; gap: 10px; justify-content: center; align-items: center; margin-top: 0.5rem; }
        .cv-colors { display: flex; gap: 8px; background: rgba(15, 23, 42, 0.8); padding: 8px 12px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); }
        .cv-color-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: transform 0.2s; padding: 0; }
        .cv-color-dot:hover { transform: scale(1.2); }
        .cv-color-dot.active { border-color: #ffffff; transform: scale(1.25); box-shadow: 0 0 12px rgba(255,255,255,0.6); }

        .cv-vote-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; width: 100%; max-width: 380px; margin-top: 0.5rem; }
        .cv-vote-card { display: flex; align-items: center; gap: 10px; padding: 0.75rem 1rem; border-radius: var(--radius-md); background: rgba(15, 23, 42, 0.75); border: 1.5px solid rgba(255,255,255,0.1); color: var(--text-primary); cursor: pointer; transition: all 0.2s; font-weight: 700; }
        .cv-vote-card:hover { border-color: var(--accent-cyan); transform: translateY(-2px); }
        .cv-vote-card.cv-voted { background: var(--accent-cyan); color: #000; border-color: var(--accent-cyan); box-shadow: 0 0 15px rgba(6, 182, 212, 0.4); }
        .cv-vote-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); }
        .cv-voted-msg { color: var(--accent-green); margin-top: 0.75rem; font-weight: 600; }

        .cv-results-list { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
        .cv-result-row { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; background: rgba(255,255,255,0.04); border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.06); }
        .cv-faker-reveal { background: rgba(239, 68, 68, 0.15) !important; border-color: rgba(239, 68, 68, 0.4) !important; color: #f87171 !important; }
        
        .cv-guess-input { flex: 1; padding: 0.85rem 1.25rem; font-size: 1.2rem; border-radius: var(--radius-md); border: 2px solid rgba(255,255,255,0.15); background: rgba(15, 23, 42, 0.9); color: var(--text-primary); text-align: center; text-transform: uppercase; font-weight: 800; }
        .cv-guess-input:focus { border-color: var(--accent-gold); box-shadow: 0 0 15px rgba(245, 158, 11, 0.35); outline: none; }
        
        .cv-scoreboard { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 350px; margin-top: 1rem; }
        .cv-score-row { display: flex; justify-content: space-between; padding: 0.6rem 1rem; background: rgba(255,255,255,0.04); border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.06); font-weight: 600; }
        .cv-score-val { font-weight: 800; color: var(--accent-gold); }
    `;
    document.head.appendChild(cvStyle);
})();
