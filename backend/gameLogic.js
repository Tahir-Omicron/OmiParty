// backend/gameLogic.js

// This file handles the transition logic for the various game modes
// Moving the authoritative state from the client (app.js) to the server.

const MIN_PLAYERS_SABOTAGE = 5;

function startSabotageGame(room) {
    if (room.players.length < MIN_PLAYERS_SABOTAGE) {
        return { error: 'Not enough players for Sabotage.' };
    }

    const shuffled = [...room.players].sort(() => Math.random() - 0.5);
    const numSaboteurs = Math.floor(shuffled.length / 3);
    
    shuffled.forEach((p, idx) => {
        if (idx === 0) p.role = 'assassin';
        else if (idx === 1) p.role = 'detective';
        else if (idx < numSaboteurs + 1) p.role = 'saboteur';
        else p.role = 'guard';
        
        p.is_alive = true;
    });

    room.players = shuffled;
    room.game_state = {
        phase: 'role_reveal',
        round: 1,
        mission_team: [],
        votes: {},
        mission_results: [],
        leader_idx: 0,
        assassin_target: null,
        detective_used: false,
        timer: 10
    };

    return room;
}

function processSabotageVotes(room) {
    const gs = room.game_state;
    const team = gs.mission_team;
    
    // Count votes
    let sabotageCount = 0;
    room.players.forEach(p => {
        if (team.includes(p.id) && p.vote === 'sabotage') {
            sabotageCount++;
        }
        // reset vote
        p.vote = null;
    });

    const missionFailed = sabotageCount > 0;
    gs.mission_results.push(missionFailed ? 'sabotage' : 'success');

    const fails = gs.mission_results.filter(r => r === 'sabotage').length;
    const wins = gs.mission_results.filter(r => r === 'success').length;

    if (fails >= 3) {
        gs.phase = 'game_over';
        gs.winner = 'saboteurs';
    } else if (wins >= 3) {
        gs.phase = 'assassin_phase';
    } else {
        gs.round++;
        gs.leader_idx = (gs.leader_idx + 1) % room.players.length;
        gs.phase = 'mission_briefing';
        gs.mission_team = [];
    }

    return room;
}

module.exports = {
    startSabotageGame,
    processSabotageVotes
};
