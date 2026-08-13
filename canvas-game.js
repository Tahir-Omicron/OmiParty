(function() {
    // Helper: get current game state from the room object
    function gs() { return state.room ? state.room.game_state : null; }
    
    // Helper: get the current user's player object
    function me() { return state.players.find(p => p.id === state.playerId); }
    
    // Helper: get active players
    function getActivePlayers() { return state.players; }

    // Update game state (host or client — all go through same DB update)
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

        // Set status first so Realtime picks up game_state changes
        await fastUpdateGameState(gs, {
            status: 'playing',
            game_mode: 'canvas'
        });

        await startRound(1, scores);
    };

    async function startRound(roundNum, scores) {
        const players = getActivePlayers();
        const faker = players[Math.floor(Math.random() * players.length)];
        const categories = Object.keys(window.CANVAS_WORDS);
        const categoryKey = categories[Math.floor(Math.random() * categories.length)];
        const categoryWords = window.CANVAS_WORDS[categoryKey];
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
            end_time: Date.now() + 5000
        };

        await fastUpdateGameState(newGs);

        setTimeout(() => {
            if (state.isHost && state.room && state.room.game_state && state.room.game_state.phase === 'word_reveal') {
                startDrawingTurn();
            }
        }, 5500);
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
            end_time: Date.now() + 15000
        });

        setTimeout(() => {
            const latest = gs();
            if (state.isHost && latest && latest.phase === 'drawing' && latest.current_drawer === currentDrawer) {
                nextDrawingTurn();
            }
        }, 15500);
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
            end_time: Date.now() + 20000
        });

        setTimeout(() => {
            const latest = gs();
            if (state.isHost && latest && latest.phase === 'voting') {
                processVoting();
            }
        }, 20500);
    }

    async function processVoting() {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;
        
        const tallies = {};
        const players = getActivePlayers();
        players.forEach(p => tallies[p.id] = 0);

        for (const [voterId, votedId] of Object.entries(current.votes || {})) {
            if (tallies[votedId] !== undefined) {
                tallies[votedId]++;
            }
        }

        let maxVotes = -1;
        let mostVotedIds = [];
        for (const [id, count] of Object.entries(tallies)) {
            if (count > maxVotes) {
                maxVotes = count;
                mostVotedIds = [id];
            } else if (count === maxVotes) {
                mostVotedIds.push(id);
            }
        }

        const caughtFaker = mostVotedIds.length === 1 && mostVotedIds[0] === current.faker_id;

        await updateGameState({
            phase: 'vote_result',
            tallies: tallies,
            caught_faker: caughtFaker,
            end_time: Date.now() + 5000
        });

        setTimeout(() => {
            const latest = gs();
            if (state.isHost && latest && latest.phase === 'vote_result') {
                if (caughtFaker) {
                    startFakerGuess();
                } else {
                    finishRound(false);
                }
            }
        }, 5500);
    }

    // ========================================================================
    // FAKER GUESS PHASE
    // ========================================================================
    async function startFakerGuess() {
        if (!state.isHost) return;
        await updateGameState({
            phase: 'faker_guess',
            faker_guess_word: null,
            end_time: Date.now() + 15000
        });

        setTimeout(() => {
            const latest = gs();
            if (state.isHost && latest && latest.phase === 'faker_guess') {
                finishRound(true);
            }
        }, 15500);
    }

    // ========================================================================
    // ROUND RESULT
    // ========================================================================
    async function finishRound(fakerWasCaught) {
        if (!state.isHost) return;
        const current = gs();
        if (!current) return;
        
        const newScores = { ...current.scores };
        const players = getActivePlayers();
        let roundSummary = '';

        if (!fakerWasCaught) {
            newScores[current.faker_id] = (newScores[current.faker_id] || 0) + 3;
            roundSummary = 'The Faker escaped! Faker gets 3 points.';
        } else {
            const guess = current.faker_guess_word;
            if (guess && guess.toLowerCase().trim() === current.secret_word.toLowerCase().trim()) {
                newScores[current.faker_id] = (newScores[current.faker_id] || 0) + 2;
                roundSummary = 'Faker was caught but guessed the word! Faker gets 2 points.';
            } else {
                players.forEach(p => {
                    if (p.id !== current.faker_id) {
                        newScores[p.id] = (newScores[p.id] || 0) + 2;
                    }
                });
                roundSummary = 'Faker was caught and failed to guess! Others get 2 points each.';
            }
        }

        await updateGameState({
            phase: 'round_result',
            scores: newScores,
            round_summary: roundSummary,
            end_time: Date.now() + 6000
        });

        setTimeout(() => {
            const latest = gs();
            if (state.isHost && latest && latest.phase === 'round_result') {
                if (current.round >= current.max_rounds) {
                    updateGameState({ phase: 'game_over', final_scores: newScores });
                } else {
                    startRound(current.round + 1, newScores);
                }
            }
        }, 6500);
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
    // STATE HANDLER (called on every game_state update)
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
        const roleText = isFaker ? "You are the FAKER! Blend in." : "You are an Artist. Spot the Faker!";

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h3 style="color:var(--text-secondary);margin-bottom:0.5rem;">Category: ${gs.category.toUpperCase()}</h3>
                <div class="cv-word-display">${wordDisplay}</div>
                <p class="${roleClass}">${roleText}</p>
                <div class="cv-round-badge">Round ${gs.round} of ${gs.max_rounds}</div>
            </div>
        `;
    }

    function renderDrawing(main, gs, myPlayer) {
        const drawer = state.players.find(p => p.id === gs.current_drawer);
        const isMyTurn = myPlayer.id === gs.current_drawer;
        const turnLabel = isMyTurn ? "YOUR TURN — Draw one stroke!" : `${drawer?.nickname || '???'}'s turn to draw`;
        const turnIdx = gs.turn_index + 1;
        const totalTurns = gs.play_order.length;

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h3 class="cv-turn-label">${turnLabel}</h3>
                <span class="cv-turn-counter">${turnIdx} / ${totalTurns}</span>
                <div class="cv-canvas-wrap">
                    <canvas id="drawing-canvas" width="400" height="400"></canvas>
                </div>
            </div>
        `;

        setTimeout(() => {
            const canvas = $('#drawing-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 400);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            (gs.current_round_strokes || []).forEach(stroke => drawStroke(ctx, stroke));

            if (isMyTurn) setupDrawing(canvas, ctx, gs);
        }, 50);
    }

    function drawStroke(ctx, stroke) {
        if (!stroke.points || stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color || '#000000';
        ctx.lineWidth = stroke.width || 3;
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
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.moveTo(p.x, p.y);
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
                const newStroke = { playerId: state.playerId, color: '#000000', width: 3, points };
                const currentStrokes = gameState.current_round_strokes || [];
                const newStrokes = [...currentStrokes, newStroke];
                
                await updateGameState({ current_round_strokes: newStrokes });
                
                if (state.isHost) {
                    setTimeout(() => nextDrawingTurn(), 500);
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
            playersHtml += `<button class="btn cv-vote-btn ${selected ? 'cv-voted' : ''}" data-vote-target="${p.id}">${p.nickname}</button>`;
        });

        main.innerHTML = `
            <div class="cv-phase-panel">
                <div id="cv-timer" class="cv-timer"></div>
                <h3>Who is the Faker?</h3>
                <div class="cv-canvas-wrap" style="opacity:0.7;pointer-events:none;margin-bottom:1rem;">
                    <canvas id="drawing-canvas" width="400" height="400"></canvas>
                </div>
                <div class="cv-vote-grid">${playersHtml}</div>
                ${hasVoted ? '<p class="cv-voted-msg">Vote cast! Waiting for others...</p>' : ''}
            </div>
        `;

        // Redraw canvas
        setTimeout(() => {
            const canvas = $('#drawing-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 400, 400);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            (gs.current_round_strokes || []).forEach(stroke => drawStroke(ctx, stroke));
        }, 50);

        // Bind vote buttons
        if (!hasVoted) {
            setTimeout(() => {
                $$('.cv-vote-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const target = btn.dataset.voteTarget;
                        const current = gs();
                        if (!current || current.phase !== 'voting') return;
                        const newVotes = { ...(current.votes || {}) };
                        newVotes[myPlayer.id] = target;
                        await updateGameState({ votes: newVotes });
                    });
                });
            }, 50);
        }
    }

    function renderVoteResult(main, gs) {
        let html = '<div class="cv-phase-panel"><div id="cv-timer" class="cv-timer"></div><h3>Vote Results</h3><div class="cv-results-list">';
        getActivePlayers().forEach(p => {
            const votes = (gs.tallies && gs.tallies[p.id]) || 0;
            const isFaker = p.id === gs.faker_id;
            html += `<div class="cv-result-row ${isFaker ? 'cv-faker-reveal' : ''}">${p.nickname}: ${votes} vote${votes !== 1 ? 's' : ''} ${isFaker ? '⚠️ FAKER' : ''}</div>`;
        });
        html += `</div><h2 style="margin-top:1rem;color:${gs.caught_faker ? 'var(--accent-green)' : 'var(--accent-red)'};">${gs.caught_faker ? 'Faker Caught!' : 'Faker Escaped!'}</h2></div>`;
        main.innerHTML = html;
    }

    function renderFakerGuess(main, gs, myPlayer) {
        if (myPlayer.id === gs.faker_id) {
            main.innerHTML = `
                <div class="cv-phase-panel">
                    <div id="cv-timer" class="cv-timer"></div>
                    <h3>You were caught!</h3>
                    <p style="color:var(--text-secondary);">Category: <strong>${gs.category.toUpperCase()}</strong></p>
                    <p>Guess the secret word for partial points:</p>
                    <input type="text" id="cv-guess-input" class="cv-guess-input" placeholder="Type your guess..." autocomplete="off">
                    <button id="cv-guess-btn" class="btn btn-primary" style="margin-top:0.75rem;">Submit Guess</button>
                </div>
            `;
            setTimeout(() => {
                const input = $('#cv-guess-input');
                const btn = $('#cv-guess-btn');
                if (input) input.focus();
                if (btn) {
                    btn.addEventListener('click', async () => {
                        const val = input?.value?.trim();
                        if (!val) return;
                        await updateGameState({ faker_guess_word: val });
                        btn.disabled = true;
                        btn.textContent = 'Submitted!';
                    });
                }
                if (input) {
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') btn?.click();
                    });
                }
            }, 50);
        } else {
            const faker = state.players.find(p => p.id === gs.faker_id);
            main.innerHTML = `
                <div class="cv-phase-panel">
                    <div id="cv-timer" class="cv-timer"></div>
                    <h3>Waiting for ${faker?.nickname || 'the Faker'} to guess...</h3>
                    <div class="spinner"></div>
                </div>
            `;
        }
    }

    function renderRoundResult(main, gs) {
        const faker = state.players.find(p => p.id === gs.faker_id);
        let scoresHtml = '';
        const sortedScores = Object.entries(gs.scores).sort((a, b) => b[1] - a[1]);
        sortedScores.forEach(([id, score]) => {
            const p = state.players.find(x => x.id === id);
            scoresHtml += `<div class="cv-score-row"><span>${p?.nickname || '???'}</span><span class="cv-score-val">${score} pts</span></div>`;
        });

        main.innerHTML = `
            <div class="cv-phase-panel">
                <h2>Round ${gs.round} Complete!</h2>
                <p style="margin:0.75rem 0;">The word was: <strong style="color:var(--accent-green);font-size:1.5rem;">${gs.secret_word.toUpperCase()}</strong></p>
                <p>The Faker was: <strong style="color:var(--accent-red);">${faker?.nickname || '???'}</strong></p>
                <p style="color:var(--text-secondary);margin:0.5rem 0;">${gs.round_summary}</p>
                <div class="cv-scoreboard">${scoresHtml}</div>
            </div>
        `;
    }

    // ========================================================================
    // GAME OVER
    // ========================================================================
    window.showCanvasGameOver = function(gs) {
        showScreen('gameover');
        const title = $('#gameover-title');
        const msg = $('#gameover-message');
        const details = $('#gameover-details');
        
        const sorted = Object.entries(gs.final_scores || gs.scores).sort((a, b) => b[1] - a[1]);
        const winnerId = sorted[0]?.[0];
        const winner = state.players.find(p => p.id === winnerId);
        
        title.textContent = `${winner?.nickname || 'Unknown'} Wins!`;
        msg.textContent = `Liar's Canvas — ${gs.max_rounds} Rounds Complete`;
        
        let html = '<h3>Final Scores</h3><ul class="standings-list">';
        sorted.forEach(([id, score], i) => {
            const p = state.players.find(x => x.id === id);
            const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
            html += `<li>${medal}${p?.nickname || '???'}: ${score} pts</li>`;
        });
        html += '</ul>';
        details.innerHTML = html;
        
        const lobbyBtn = $('#gameover-lobby-btn');
        if (state.isHost) lobbyBtn.style.display = 'block';
        else lobbyBtn.style.display = 'none';
    };

    // ========================================================================
    // BOT LOGIC
    // ========================================================================
    let botDrawingFlags = {};
    let botVotingFlags = {};
    let botGuessFlag = false;

    window.processCanvasBotActions = function(gameState) {
        if (!state.isHost) return;
        const bots = state.players.filter(p => p.is_bot);
        if (bots.length === 0) return;

        bots.forEach(bot => {
            // Bot drawing
            if (gameState.phase === 'drawing' && gameState.current_drawer === bot.id) {
                if (!botDrawingFlags[bot.id]) {
                    botDrawingFlags[bot.id] = true;
                    setTimeout(async () => {
                        const numPts = 5 + Math.floor(Math.random() * 10);
                        const pts = [];
                        let cx = 100 + Math.random() * 200, cy = 100 + Math.random() * 200;
                        for (let i = 0; i < numPts; i++) {
                            cx += (Math.random() - 0.5) * 80;
                            cy += (Math.random() - 0.5) * 80;
                            pts.push({ x: Math.max(10, Math.min(390, cx)), y: Math.max(10, Math.min(390, cy)) });
                        }
                        const current = gs();
                        if (!current || current.phase !== 'drawing') { botDrawingFlags[bot.id] = false; return; }
                        const strokes = [...(current.current_round_strokes || []), { playerId: bot.id, color: '#333333', width: 3, points: pts }];
                        await updateGameState({ current_round_strokes: strokes });
                        botDrawingFlags[bot.id] = false;
                        setTimeout(() => nextDrawingTurn(), 300);
                    }, 2000 + Math.random() * 2000);
                }
            }

            // Bot voting
            if (gameState.phase === 'voting') {
                if (!botVotingFlags[bot.id] && !(gameState.votes && gameState.votes[bot.id])) {
                    botVotingFlags[bot.id] = true;
                    setTimeout(async () => {
                        const current = gs();
                        if (!current || current.phase !== 'voting') { botVotingFlags[bot.id] = false; return; }
                        const others = getActivePlayers().filter(p => p.id !== bot.id);
                        if (others.length === 0) { botVotingFlags[bot.id] = false; return; }
                        const target = others[Math.floor(Math.random() * others.length)];
                        const newVotes = { ...(current.votes || {}) };
                        newVotes[bot.id] = target.id;
                        await updateGameState({ votes: newVotes });
                        botVotingFlags[bot.id] = false;
                    }, 1500 + Math.random() * 2000);
                }
            }

            // Bot faker guess
            if (gameState.phase === 'faker_guess' && gameState.faker_id === bot.id && !gameState.faker_guess_word) {
                if (!botGuessFlag) {
                    botGuessFlag = true;
                    setTimeout(async () => {
                        const current = gs();
                        if (!current || current.phase !== 'faker_guess') { botGuessFlag = false; return; }
                        const words = window.CANVAS_WORDS[current.category] || ['unknown'];
                        const guess = words[Math.floor(Math.random() * words.length)];
                        await updateGameState({ faker_guess_word: guess });
                        botGuessFlag = false;
                    }, 2000 + Math.random() * 2000);
                }
            }
        });

        // Reset flags on phase change
        if (gameState.phase !== 'drawing') botDrawingFlags = {};
        if (gameState.phase !== 'voting') botVotingFlags = {};
        if (gameState.phase !== 'faker_guess') botGuessFlag = false;
    };

    // ========================================================================
    // INJECT CSS
    // ========================================================================
    const cvStyle = document.createElement('style');
    cvStyle.textContent = `
        .cv-phase-panel {
            display: flex; flex-direction: column; align-items: center; 
            text-align: center; padding: 1.5rem; gap: 0.5rem;
        }
        .cv-timer {
            font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700;
            color: var(--accent-cyan); margin-bottom: 0.5rem;
        }
        .cv-word-display {
            font-family: var(--font-heading); font-size: 3rem; font-weight: 700;
            color: var(--accent-green); letter-spacing: 4px; margin: 1rem 0;
            padding: 1rem 2rem; background: rgba(0,200,83,0.1);
            border-radius: var(--radius-lg); border: 1px solid rgba(0,200,83,0.3);
        }
        .cv-faker-role { color: var(--accent-red); font-weight: 600; font-size: 1.1rem; }
        .cv-artist-role { color: var(--accent-cyan); font-weight: 600; font-size: 1.1rem; }
        .cv-round-badge {
            margin-top: 0.5rem; padding: 0.25rem 1rem; background: rgba(255,255,255,0.05);
            border-radius: 999px; font-size: 0.85rem; color: var(--text-muted);
        }
        .cv-turn-label { color: var(--text-primary); margin-bottom: 0.5rem; }
        .cv-turn-counter { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.75rem; }
        .cv-canvas-wrap {
            border: 2px solid var(--glass-border); border-radius: var(--radius-md);
            overflow: hidden; background: #fff; max-width: 100%;
        }
        .cv-canvas-wrap canvas { display: block; max-width: 100%; height: auto; }
        .cv-vote-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-top: 0.5rem; }
        .cv-vote-btn {
            min-width: 100px; padding: 0.6rem 1rem; border-radius: var(--radius-md);
            background: var(--bg-surface); border: 1px solid var(--glass-border);
            color: var(--text-primary); cursor: pointer; transition: all 0.2s;
        }
        .cv-vote-btn:hover { border-color: var(--accent-cyan); }
        .cv-voted { background: var(--accent-cyan) !important; color: #000 !important; border-color: var(--accent-cyan) !important; }
        .cv-voted-msg { color: var(--text-muted); margin-top: 0.75rem; font-style: italic; }
        .cv-results-list { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.5rem; }
        .cv-result-row { padding: 0.4rem 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); }
        .cv-faker-reveal { background: rgba(255,45,85,0.15) !important; color: var(--accent-red); font-weight: 600; }
        .cv-guess-input {
            padding: 0.75rem 1rem; font-size: 1.2rem; border-radius: var(--radius-md);
            border: 1px solid var(--glass-border); background: var(--bg-surface);
            color: var(--text-primary); text-align: center; width: 100%; max-width: 300px;
        }
        .cv-scoreboard { display: flex; flex-direction: column; gap: 0.25rem; width: 100%; max-width: 300px; margin-top: 1rem; }
        .cv-score-row {
            display: flex; justify-content: space-between; padding: 0.4rem 0.75rem;
            background: rgba(255,255,255,0.03); border-radius: var(--radius-sm);
        }
        .cv-score-val { font-weight: 700; color: var(--accent-gold); }
    `;
    document.head.appendChild(cvStyle);

})();
