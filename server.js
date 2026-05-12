const express             = require('express');
const { WebSocketServer } = require('ws');
const vm                  = require('vm');
const http                = require('http');

const  app = express(); // Express app for handling HTTP requests and serving the dashboard
const   server = http.createServer(app); // Create an HTTP server to attach both Express and WebSocket to the same port
const    wss = new WebSocketServer({ server }); // WebSocket server for real-time communication with the dashboard

        app.use(express.json());
        app.use(express.static('public')); // Serves your index.html

         // --- ROUTES ---
         app.post('/register', 
                  //--------------------------------------------------------------------- 
                 // Endpoint for players to register their Bot code. Expects { email, name, code } in the request body. Validates code size and stores player info. 
                  (req, res) => {
                                 const { email, name, code } = req.body;
                                 console.log(`Registering player: ${name} (${email})`);
                                  if (code.length > CONFIG.maxCodeSize) {
                                       let errmessage = `Code too big (must be <= ${CONFIG.maxCodeSize} characters) for player: ${name} (${email})`;
                                        console.log(errmessage);
                                         return res.status(400).send(errmessage);    
                                 }
                                  
                                  //else player registration is successful, store their info in the players object, using email as a unique identifier
                                         players[email] = { 
                                                           name, 
                                                           code, 
                                                           timeBank: CONFIG.baseTime, 
                                                           score: 0,
                                                           status: "READY"
                                                         };
                                         
                                          broadcast({ type: "NEW_PLAYER", name });
                                          console.log(`     Registered!  Total players: ${Object.keys(players).length}`);
                                          res.send("Registered!");
                                }
        );
         
// Start the server
const PORT = 3000;
         server.listen(PORT, 
                            //---------------------------------------------------------------------
                            () => {
                                    console.log(`Server running at http://localhost:${PORT}`);
                                    tournamentStartTime = Date.now() + DEFAULT_START_DELAY_MS;
                                     console.log(`Tournament scheduled to start at ${new Date(tournamentStartTime).toLocaleString()}`);
                                     setTimeout(startChampionship, DEFAULT_START_DELAY_MS);
                                     broadcast({ type: "START_TIME", startTime: tournamentStartTime });
                                  }
                     );        

let tournamentStarted = false;// Flag to prevent multiple tournament starts
let tournamentStartTime = null; // Timestamp for when the tournament is scheduled to start, sent to clients for countdown display
let startTimeout = null; // To allow manual start before the scheduled time if needed
let matchMatrix = {}; // Stores results of matches for the matrix display
// matchMatrix structure: { "emailA|emailB": { playerA, playerB, winsA, winsB, bonusA, bonusB } }

          wss.on('connection', 
             //---------------------------------------------------------------------            
            // When a new game-clients connects, send them the tournament start time if ready
            ws => {
                   if (tournamentStartTime) {
                       let startTimeMessage = { type: "START_TIME", startTime: tournamentStartTime };
                        let startTimeString = JSON.stringify(startTimeMessage);
                         ws.send(startTimeString);
                   }
                   // Working with messages from clients, such as a request to start the tournament early           
                   ws.on('message', 
                          //-------------------------------------------------------------------- 
                          message => {
                                      try {
                                          let data = JSON.parse(message);
                                           //for testing purposes, allow clients to request starting the tournament immediately instead of waiting for the scheduled time
                                           if (data.type === "START_TOURNAMENT_REQUEST") {
                                               console.log("Tournament start requested by a client.");
                                               // If tournament hasn't started yet -- clear the scheduled start timeout if it exists and start startChampionship immediately
                                               if (!tournamentStarted) {
                                                   if (startTimeout) {
                                                       clearTimeout(startTimeout);
                                                        startTimeout = null;
                                                   }
                                                    startChampionship();// 
                                               }
                                           }
                                         }
                                      catch (err) {
                                                   console.warn("Received invalid WebSocket message:", err.message);
                                                  }
                                    }
                       );
                  }
          );

 ////////////////////////////////////////////////////////////////////////////////////////////////////
// --- GAME CONFIGURATION ---
var CONFIG = {
               mode: "NORMAL", // "" or "GIVEAWAY"
               piles: [3, 5, 7], // Initial piles
               forbidden: [2], // Example: can't take 2 from any pile
               baseTime: 1000,   // ms
               maxCodeSize: 2048, // bytes
               numberOfGamesPerMatch: 10 // Number of games each pair of Bots will play against each other
};

const DEFAULT_START_DELAY_MS = 15 * 60 * 1000; // 15 minutes after server start

// Store players data: { email: { name, code, timeBank, score } }
var players = {}; 
// email is used as a unique identifier for players, and also to track match results in the matchMatrix:
// name  is the display name for the player Avatar-Bot, 
// code  is their Bot js code (function play()),
// timeBank tracks their remaining time, 
// score tracks their points in the tournament.

function recordMatchResult(emailA, emailB, winnerEmail, bonus) {
                           const key = [emailA, emailB].sort().join('|');
                           // matchMatrix structure: { "emailA|emailB": { playerA, playerB, winsA, winsB, bonusA, bonusB } }
                            if (!matchMatrix[key]) 
                                 matchMatrix[key] = {
                                                     playerA: emailA,
                                                     playerB: emailB,
                                                     winsA: 0,
                                                     winsB: 0,
                                                     bonusA: 0,
                                                     bonusB: 0
                                                    };
                             
                       
                             let row = matchMatrix[key]; // find the correct row for the match of emailA against emailB, regardless of player order
                              if (winnerEmail === emailA) {
                                                           row.winsA += 1;
                                                           row.bonusA += bonus;
                                                          }
                               else {// winner is emailB
                                                           row.winsB += 1;
                                                           row.bonusB += bonus;
                                    }
}                       

function getMatchMatrixDisplay() {
                                  let allResults = Object.values(matchMatrix);
                                   let allResultsCopy = allResults.map(row => ({
                                                                                 playerA: row.playerA,
                                                                                 playerB: row.playerB,
                                                                                 winsA: row.winsA,
                                                                                 winsB: row.winsB,
                                                                                 bonusA: row.bonusA,
                                                                                 bonusB: row.bonusB
                                                                               }))
                                    return allResultsCopy;
}

// --- BOT EXECUTION (The Referee) ---
function runBotSafe(player, currentPiles) {

         const sandbox = { // Provide the Bot with a safe, read-only view of the game state
                          piles: [...currentPiles], // Provide a copy of the piles to prevent cheating
                          forbidden: CONFIG.forbidden,// Provide forbidden moves for bot's logic
                          context: { mode: CONFIG.mode, timeRemaining: player.timeBank } // Additional context for bots to make informed decisions
                         };

         try {
              // Construct the code to execute the player's Bot play() function and capture its result 
              const botCodeString=`result = (${player.code})(piles, forbidden, context)`
               // Compile the Bot code in virtual machine to catch syntax errors before execution 
               const  botScript = new vm.Script(botCodeString);
                //start time 
                const startTime = Date.now();  
                 // Run with time limit
                 vm.createContext(sandbox);// Create a new context for each execution to prevent state sharing
                  // Run the Bot code with a timeout to prevent infinite loops or long execution times. The timeout is set to the player's remaining time bank. 
                  botScript.runInContext(sandbox, { timeout: player.timeBank });
                   //end time
                   const endTime = Date.now();
                    const duration = endTime - startTime;
                     player.timeBank -= duration; // Deduct time spent
        
                     return sandbox.result; // Return the move result from the Bot's play() function
             }
         catch (err) {// If there's an error (syntax error, runtime error, timeout), we consider it an invalid move and disqualify the player for that match
                        return { error: "ABUSER", detail: err.message };
                      }
}

// --- TOURNAMENT LOGIC ---
async function 
startChampionship() {
                     if (tournamentStarted) return;
                     //else start the tournament
                         tournamentStarted = true;
                          if (startTimeout) {// If the tournament was started early by a client request, clear the scheduled start timeout to prevent it from firing later
                              clearTimeout(startTimeout);
                               startTimeout = null;
                          }
                           console.log("🤖🏆🤖 Championship Started!");
                           broadcast({ type: "TOURNAMENT_STARTED" });
                           // Run a round-robin tournament where each Bot plays against every other Bot
                           const emails = Object.keys(players);
                            for (let i = 0; i < emails.length; i++) 
                                for (let j = i + 1; j < emails.length; j++) 
                                     await runMatch(emails[i], emails[j]);
                            
                            console.log("🤖🌟🤖 Championship Ended! ");
                            console.log("Results:", getMatchMatrixDisplay());
                             broadcast({ type: "END", players });// After all matches are done, broadcast the final results to the dashboard
}

async function 
runMatch(emailA, emailB) { // Run a match of numberOfGamesPerMatch (default: 10) games between two Bots, alternating who goes first, and applying the time carry-over logic based on the tournament mode
                          let botA = players[emailA];
                          let botB = players[emailB];
                          const N = CONFIG.numberOfGamesPerMatch;
                           for (let game = 1; game <= N; game++) {
                                let currentFirstPlayer = (game % 2 === 1) ? emailA : emailB; // Alternate who goes first each game
                                 let state = { piles: [...CONFIG.piles], turn: currentFirstPlayer};
                                  broadcast({ type: "CURRENT_FIGHT", fight: { playerA: botA.name, playerB: botB.name, game, totalGames: N } });

                                  // Main game loop for a single game between two Bots while there are still valid moves to be made (not Game Over)
                                  while (!isGameOver(state.piles)) {
                                          let currentPlayer = players[state.turn];
                                           let move = runBotSafe(currentPlayer, state.piles);
                                            // Validate currentPlayer Move 
                                            if (move.error || !isValidMove(move, state.piles)) {
                                                console.log(`${currentPlayer.name}(${state.turn}) disqualified for invalid move:`,move, " for piles: ", state.piles);
                                                broadcast({ type: "DISQUALIFIED_FOR_INVALID_MOVE", piles: state.piles, player: currentPlayer.name });
                                                 currentPlayer.score -= 10;``
                                                  break; 
                                            }
                                             // Apply Valid Move
                                             state.piles[move.pileIndex] -= move.count;
                                              broadcast({ type: "MOVE", piles: state.piles, player: currentPlayer.name });
                                      
                                              // Switch Turn
                                              state.turn = (state.turn === emailA ? emailB : emailA);
                                               await new Promise(delayresolve => setTimeout(delayresolve, 500 /*ms*/)); // Slow down for dashboard viewers
                                  }
                              
                                    // Determine Winner & Time Carry-over logic
                                    let winnerEmail = (CONFIG.mode === "NORMAL") ? state.turn 
                                                                                 : (state.turn === emailA ? emailB 
                                                                                                          : emailA);
                                     players[winnerEmail].score += 1;
                                     players[winnerEmail].timeBank += 100; // Small bonus for winning
                                      recordMatchResult(emailA, emailB, winnerEmail, 100);
                                       const Matrix = getMatchMatrixDisplay();
                                        broadcast({ type: "MATCH_UPDATE", players, matchMatrix: Matrix });
                           }// End loop of all games between emailA and emailB
}

// --- HELPER FUNCTIONS ---
function isValidMove(move, piles) {
                                    if (!move || move.pileIndex === undefined) return false; // move must exists and specify a existing pile index
                                    if (CONFIG.forbidden.includes(move.count)) return false; // Check if the move count is in the forbidden list
                                    // negative moves forbidden and gamer must take at least 1 from a pile, and cannot take more than what's available in the chosen pile
                                    if (move.count <= 0 || move.count > piles[move.pileIndex]) return false;

                                    // else move is valid if it passes all checks
                                       return true;
}

function isGameOver(piles) {
                            // Game is over if all piles are empty (a player took the last item) or if there are no valid moves left for the next player (all remaining moves are forbidden)
                            return piles.every(p => p === 0) || getAvailableMoves(piles).length === 0;
}

function getAvailableMoves(piles) {
                                    // Used by the "Ideal Opponent" or to check if a bot is stuck
                                   let moves = [];
                                    piles.forEach((count, idx) => {
                                                                   for (let i = 1; i <= count; i++) 
                                                                        if (!CONFIG.forbidden.includes(i)) 
                                                                            moves.push({idx, i});
                                                                   
                                                                  });
                                     return moves;
}

function broadcast(data) {
                          wss.clients.forEach(client => client.send(JSON.stringify(data)));
}


