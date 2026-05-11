const express = require('express');
const { WebSocketServer } = require('ws');
const vm = require('vm');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static('public')); // Serves your index.html

// --- GAME CONFIGURATION ---
const CONFIG = {
    mode: "GIVEAWAY", // "NORMAL" or "GIVEAWAY"
    piles: [3, 5, 7],
    forbidden: [2],
    baseTime: 1000,   // ms
    maxCodeSize: 2048 // bytes
};

let players = {}; // Stores: { email: { name, code, timeBank, score } }

// --- BOT EXECUTION (The Referee) ---
function runBotSafe(player, currentPiles) {
    const sandbox = { 
        piles: [...currentPiles], 
        forbidden: CONFIG.forbidden,
        context: { mode: CONFIG.mode, timeRemaining: player.timeBank }
    };

    try {
        const script = new vm.Script(`result = (${player.code})(piles, forbidden, context)`);
        const start = Date.now();
        
        // Run with time limit
        vm.createContext(sandbox);
        script.runInContext(sandbox, { timeout: player.timeBank });
        
        const duration = Date.now() - start;
        player.timeBank -= duration; // Deduct time spent
        
        return sandbox.result; 
    } catch (err) {
        return { error: "ABUSER", detail: err.message };
    }
}

// --- TOURNAMENT LOGIC ---
async function startChampionship() {
    console.log("🏆 Championship Started!");
    const emails = Object.keys(players);

    for (let i = 0; i < emails.length; i++) {
        for (let j = i + 1; j < emails.length; j++) {
            await runMatch(emails[i], emails[j]);
        }
    }
    broadcast({ type: "END", players });
}

async function runMatch(emailA, emailB) {
    let botA = players[emailA];
    let botB = players[emailB];

    for (let game = 1; game <= 10; game++) {
        let state = { piles: [...CONFIG.piles], turn: (game % 2 === 0 ? emailA : emailB) };
        
        while (!isGameOver(state.piles)) {
            let currentPlayer = players[state.turn];
            let move = runBotSafe(currentPlayer, state.piles);

            if (move.error || !isValidMove(move, state.piles)) {
                console.log(`${state.turn} disqualified!`);
                currentPlayer.score -= 10;
                break; 
            }

            // Apply Move
            state.piles[move.pileIndex] -= move.count;
            broadcast({ type: "MOVE", piles: state.piles, player: currentPlayer.name });
            
            // Switch Turn
            state.turn = (state.turn === emailA ? emailB : emailA);
            await new Promise(r => setTimeout(r, 500)); // Slow down for dashboard viewers
        }
        
        // Determine Winner & Time Carry-over logic
        let winnerEmail = (CONFIG.mode === "NORMAL") ? state.turn : (state.turn === emailA ? emailB : emailA);
        players[winnerEmail].score += 1;
        players[winnerEmail].timeBank += 100; // Small bonus for winning
    }
}

// --- HELPER FUNCTIONS ---
function isValidMove(move, piles) {
    if (!move || move.pileIndex === undefined) return false;
    if (CONFIG.forbidden.includes(move.count)) return false;
    if (move.count <= 0 || move.count > piles[move.pileIndex]) return false;
    return true;
}

function isGameOver(piles) {
    return piles.every(p => p === 0) || getAvailableMoves(piles).length === 0;
}

function getAvailableMoves(piles) {
    // Used by the "Ideal Opponent" or to check if a bot is stuck
    let moves = [];
    piles.forEach((count, idx) => {
        for (let i = 1; i <= count; i++) {
            if (!CONFIG.forbidden.includes(i)) moves.push({idx, i});
        }
    });
    return moves;
}

function broadcast(data) {
    wss.clients.forEach(client => client.send(JSON.stringify(data)));
}

// --- ROUTES ---
app.post('/register', (req, res) => {
    const { email, name, code } = req.body;
    if (code.length > CONFIG.maxCodeSize) return res.status(400).send("Code too big!");
    
    players[email] = { 
        name, 
        code, 
        timeBank: CONFIG.baseTime, 
        score: 0,
        status: "READY"
    };
    
    broadcast({ type: "NEW_PLAYER", name });
    res.send("Registered!");
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // For testing: set a timer to start the championship
    // setTimeout(startChampionship, 60000); 
});
