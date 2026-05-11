const express = require('express');
const { WebSocketServer } = require('ws');
const vm = require('vm');
const http = require('http');

const  app = express();
const   server = http.createServer(app);
const    wss = new WebSocketServer({ server });

let tournamentStarted = false;
let tournamentStartTime = null;
let startTimeout = null;
const matchMatrix = {};

wss.on('connection', ws => {
    if (tournamentStartTime) {
        ws.send(JSON.stringify({ type: "START_TIME", startTime: tournamentStartTime }));
    }

    ws.on('message', message => {
        try {
            const data = JSON.parse(message);
            if (data.type === "START_TOURNAMENT_REQUEST") {
                console.log("Tournament start requested by a client.");
                if (!tournamentStarted) {
                    if (startTimeout) {
                        clearTimeout(startTimeout);
                        startTimeout = null;
                    }
                    startChampionship();
                }
            }
        } catch (err) {
            console.warn("Received invalid WS message:", err.message);
        }
    });
});

        app.use(express.json());
        app.use(express.static('public')); // Serves your index.html

// --- GAME CONFIGURATION ---
var CONFIG = {
               mode: "GIVEAWAY", // "NORMAL" or "GIVEAWAY"
               piles: [3, 5, 7], // Initial piles
               forbidden: [2], // Example: can't take 2 from any pile
               baseTime: 1000,   // ms
               maxCodeSize: 2048 // bytes
};

const DEFAULT_START_DELAY_MS = 15 * 60 * 1000; // 15 minutes after server start

var players = {}; // Stores: { email: { name, code, timeBank, score } }

function recordMatchResult(emailA, emailB, winnerEmail, bonus) {
    const key = [emailA, emailB].sort().join('|');
    if (!matchMatrix[key]) {
        matchMatrix[key] = {
            playerA: emailA,
            playerB: emailB,
            winsA: 0,
            winsB: 0,
            bonusA: 0,
            bonusB: 0
        };
    }

    const row = matchMatrix[key];
    if (winnerEmail === emailA) {
        row.winsA += 1;
        row.bonusA += bonus;
    } else {
        row.winsB += 1;
        row.bonusB += bonus;
    }
}

function getMatchMatrixDisplay() {
    return Object.values(matchMatrix).map(row => ({
        playerA: row.playerA,
        playerB: row.playerB,
        winsA: row.winsA,
        winsB: row.winsB,
        bonusA: row.bonusA,
        bonusB: row.bonusB
    }));
}

// --- BOT EXECUTION (The Referee) ---
function runBotSafe(player, currentPiles) {
         const sandbox = { 
                          piles: [...currentPiles], // Provide a copy of the piles to prevent cheating
                          forbidden: CONFIG.forbidden,// Provide forbidden moves for bot's logic
                          context: { mode: CONFIG.mode, timeRemaining: player.timeBank } // Additional context for bots to make informed decisions
         };

        try {
              const botCodeString=`result = (${player.code})(piles, forbidden, context)`
              const  botScript = new vm.Script(botCodeString);

              const startTime = Date.now(); //start time
              // Run with time limit
              vm.createContext(sandbox);// Create a new context for each execution to prevent state sharing
               botScript.runInContext(sandbox, { timeout: player.timeBank });
               const endTime = Date.now(); //end time
                const duration = endTime - startTime;
                 player.timeBank -= duration; // Deduct time spent
        
                  return sandbox.result; 
        } catch (err) {
                        return { error: "ABUSER", detail: err.message };
                      }
}

// --- TOURNAMENT LOGIC ---
async function startChampionship() {
    if (tournamentStarted) return;
    tournamentStarted = true;
    if (startTimeout) {
        clearTimeout(startTimeout);
        startTimeout = null;
    }
    console.log("🏆 Championship Started!");
    broadcast({ type: "TOURNAMENT_STARTED" });
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
        broadcast({ type: "CURRENT_FIGHT", fight: { playerA: botA.name, playerB: botB.name, game, totalGames: 10 } });
        
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
        recordMatchResult(emailA, emailB, winnerEmail, 100);
        broadcast({ type: "MATCH_UPDATE", players, matchMatrix: getMatchMatrixDisplay() });
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
    tournamentStartTime = Date.now() + DEFAULT_START_DELAY_MS;
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Tournament scheduled to start at ${new Date(tournamentStartTime).toLocaleString()}`);
    setTimeout(startChampionship, DEFAULT_START_DELAY_MS);
    broadcast({ type: "START_TIME", startTime: tournamentStartTime });
});
