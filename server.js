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
var playersNumber = 0;
var players = {};
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
                                  
                                  //else
                                   if(!players[email]){ // new player 
                                          // Try to compile the Bot code in virtual machine to catch syntax errors before registration
                                          const botCodeString=`result = (${code})(piles, forbidden, context)`
                                           try {
                                                 const  botScript = new vm.Script(botCodeString);               
                                                  let  idx= playersNumber;
                                                   playersNumber++;
                                                    players[email] = { 
                                                                      idx,
                                                                      name, 
                                                                      code, 
                                                                      timeBank: CONFIG.baseTime, 
                                                                      score: 0,
                                                                      status: "READY"
                                                                    };
                                           }
                                           catch  (err) {
                                                          let errmessage = `Syntax error in Bot code for player: ${name} (${email}): ${err.message}`;
                                                           console.log(errmessage);
                                                            delete players[email]; // Remove player from registry if their code has syntax errors
                                                             return res.status(400).send(errmessage);    
                                           }         
                                            
                                             broadcast({ type: "NEW_PLAYER", name });
                                             console.log(`     Registered!  Total players: ${playersNumber}`);
                                             res.send("Registered!");
                                   }   
                                   else { // Duplicate email registration attempt
                                          let errmessage = `Player with email ${email} is already registered.`;
                                           console.log(errmessage);
                                            res.status(400).send(errmessage);
                                        }
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
                                     startTimeout = setTimeout(startChampionship, DEFAULT_START_DELAY_MS);
                                     broadcast({ type: "START_TIME", startTime: tournamentStartTime });
                                  }
                     );        

let tournamentStarted = false;// Flag to prevent multiple tournament starts
let tournamentStartTime = null; // Timestamp for when the tournament is scheduled to start, sent to clients for countdown display
let startTimeout = null; // To allow manual start before the scheduled time if needed
let matchMatrix = {}; // Stores results of matches for the matrix display
// matchMatrix structure: { "emailA|emailB": { playerA, playerB, winsA, winsB, bonusA, bonusB } }

const DEFAULT_START_DELAY_MS = 15 * 60 * 1000; // 15 minutes after server start

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
                                                    startChampionship();// Main function to start the tournament, run matches, and broadcast results
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
               forbidden: [0], // Example: can't take 0 from any pile
               baseTime: 10,   // ms
               maxCodeSize: 2048, // bytes
               numberOfGamesPerMatch: 10 // Number of games each pair of Bots will play against each other
};



// Store players data: { email: { idx, name, code, timeBank, score } }
// idx  is a unique index assigned to each player for matrix display purposes in order of registration,
// email is used as a unique identifier for players, and also to track match results in the matchMatrix:
// name  is the display name for the player Avatar-Bot, 
// code  is their Bot js code (function play()),
// timeBank tracks their remaining time, 
// score tracks their points in the tournament.


// --- TOURNAMENT LOGIC ---
    async function 
    startChampionship() {
                         if (tournamentStarted) return;

                         //else start the tournament
                             tournamentStarted = true; // Set the tournamentStarted flag to prevent multiple starts
                              if (startTimeout) {// If the tournament was started early by a client request, clear the scheduled start timeout to prevent it from firing later
                                  clearTimeout(startTimeout);
                                   startTimeout = null;
                              }
                               console.log("🤖🏆🤖 Championship Started!");
                               
                               // Create player list with indices
                               const emails = Object.keys(players);
                               const playerList = [];
                                for (let i = 0; i < emails.length; i++) 
                                     playerList.push({
                                                      idx: players[emails[i]].idx,
                                                      name: players[emails[i]].name,
                                                      email: emails[i]
                                                    });
                               
                               
                               // Generate and send initial tournament Matrix
                               generateInitialMatrix();
                                broadcast({ type: "TOURNAMENT_STARTED", players: playerList, matchMatrix: Matrix });
                               
                                // Run a round-robin tournament where each Bot plays against every other Bot
                                for (let i = 0; i < playersNumber; i++) {
                                    for (let j = i + 1; j < playersNumber; j++) {
                                         await runMatch(emails[i], emails[j]);
                                    }
                               }
                                
                                console.log("🤖🌟🤖 Championship Ended! ");
                                getMatchMatrixDisplay()
                                 console.log("Results:", Matrix);
                                 broadcast({ type: "END", players, matchMatrix: Matrix });// After all matches are done, broadcast the final results to the dashboard
                                  tournamentStarted = false;
    }
            

        async function 
        runMatch(emailA, emailB) { // Run a match of numberOfGamesPerMatch (default: 10) games between two Bots, alternating who goes first, and applying the time carry-over logic based on the tournament mode
                                      function opponentEmail(PlayerEmail){ return  (PlayerEmail === emailA) ? emailB : emailA;}
                                  const N = CONFIG.numberOfGamesPerMatch;
                                  setOfMatches:
                                   for (let game = 1; game <= N; game++) {
                                        let currentFirstPlayerEmail = (game % 2 === 1) ? emailA : emailB; // Alternate who goes first each game
                                         let botA = players[currentFirstPlayerEmail];
                                         let opponentPlayerEmail = opponentEmail(currentFirstPlayerEmail);
                                          let botB = players[opponentPlayerEmail];
                                          console.log(`Match ${game}/${N} between ${currentFirstPlayerEmail} and ${opponentPlayerEmail}`); 

                                         let state = { piles: [...CONFIG.piles], turn: currentFirstPlayerEmail};
                                           broadcast({ type: "CURRENT_FIGHT", fight: { playerA: botA.name, playerB: botB.name, game, totalGames: N } });
        
                                          // Main game loop for steps of a single game between two Bots while there are still valid moves to be made (not Game Over)
                                         let currentPlayer; 
                                         let  opponentPlayer = players[currentFirstPlayerEmail];
                                          while (!isGameOver(state.piles)) {
                                                    currentPlayer = opponentPlayer; 
                                                     opponentPlayerEmail = opponentEmail(opponentPlayerEmail);
                                                      opponentPlayer = players[opponentPlayerEmail];
                                                   //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                                                   let report = runBotSafe(currentPlayer, state.piles);
                                                   //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                                                    let move = report.result;
                                                    if (report.error) {
                                                         console.log(`${currentPlayer.name} made Error :`,report.error);
                                                         broadcast({ type: "DISQUALIFIED_FOR_ERROR", error: report.error, player: currentPlayer.name  });
                                                          currentPlayer.score -= 10;
                                                          currentPlayer.timeBank = 0; // Disqualified player loses all remaining time
                                                          opponentPlayer.score += 1;
                                                          recordMatchResult(emailA, emailB, opponentEmail(state.turn), 0);
                                                           getMatchMatrixDisplay();
                                                            broadcast({ type: "MATCH_UPDATE", players, matchMatrix: Matrix });
                                                            continue setOfMatches; 
                                                     }
                                                      // Validate currentPlayer Move 
                                                          if (!isValidMove(move, state.piles)) {
                                                              console.log(`${currentPlayer.name}(${state.turn}) try to do invalid move:`,move, " for piles: ", state.piles);
                                                              broadcast({ type: "DISQUALIFIED_FOR_INVALID_MOVE", invalidMove: move, piles: state.piles, player: currentPlayer.name  });
                                                               currentPlayer.score -= 10;
                                                               currentPlayer.timeBank = 0; // Disqualified player loses all remaining time
                                                               opponentPlayer.score += 1;
                                                               recordMatchResult(emailA, emailB, opponentEmail(state.turn), 0);
                                                                getMatchMatrixDisplay();
                                                                 broadcast({ type: "MATCH_UPDATE", players, matchMatrix: Matrix });
                                                                continue setOfMatches; 
                                                          }
                                                               //Bonus time for making a valid quick move
                                                               let bonusTime  = CONFIG.baseTime -  report.timeSpent
                                                                currentPlayer.timeBank += bonusTime ; // Time carry-over logic: player gains back the baseTime minus the time they actually spent thinking. If they spend more than baseTime, they lose time from their timeBank, if they spend less, they gain some time. This encourages efficient code.
                                                               

                                                                // Apply Valid Move
                                                                state.piles[move.pileIndex] -= move.count;
                                                                 broadcast({ type: "MOVE", piles: state.piles, player: currentPlayer.name, bonus: bonusTime });
                                                           
                                                                  await new Promise(delayresolve => setTimeout(delayresolve, 500 /*ms*/)); // Slow down for dashboard viewers
                                                     
                                                     
                                           }
                                            // Determine Winner & Time Carry-over logic
                                            let winnerEmail = (CONFIG.mode === "NORMAL") ? state.turn 
                                                                                         : (state.turn === emailA ? emailB 
                                                                                                                  : emailA);
                                             winnerEmail =  opponentEmail(opponentPlayerEmail);  // for debugging                                                                                                                  
                                             console.log(`Winner email : ${winnerEmail} `);                                                                                                                         
                                             // console.log(currentPlayer)
                                              console.log(`Winner of match : ${currentPlayer.name} `);                                                                                                                         
                                             // console.log(players)
                                             
                                             currentPlayer.score += 1;
                                              recordMatchResult(emailA, emailB, winnerEmail, 100);
                                               getMatchMatrixDisplay();
                                                broadcast({ type: "MATCH_UPDATE", players, matchMatrix: Matrix });

                                              // Switch Turn
                                                 //state.turn = opponentEmail(state.turn);

                                                  
                                   }// End loop of all games between emailA and emailB
        }

            // Bots (player) Code EXECUTION on current state (currentPiles) by the "Referee logics" 
            function runBotSafe(player, currentPiles) {
            
                     const sandbox = { // Provide the Bot with a safe, read-only view of the game state
                                      piles: [...currentPiles], // Provide a copy of the piles to prevent cheating
                                      forbidden: CONFIG.forbidden,// Provide forbidden moves for bot's logic
                                      context: { mode: CONFIG.mode, timeRemaining: player.timeBank } // Additional context for bots to make informed decisions
                                     };
            
                     // Construct the code to execute the player's Bot play() function and capture its result 
                     const botCodeString=`result = (${player.code})(piles, forbidden, context)`
                     // Compile the Bot code in virtual machine 
                      const  botScript = new vm.Script(botCodeString);
                       try {
                            //start time 
                            const startTime = Date.now();  
                             // Run with time limit
                             vm.createContext(sandbox);// Create a new context for each execution to prevent state sharing
                              // Run the Bot code with a timeout to prevent infinite loops or long execution times. The timeout is set to the player's remaining time bank. 
                              botScript.runInContext(sandbox, { timeout: (+player.timeBank+CONFIG.baseTime) }); // Add baseTime to ensure Bots have at least some time to make a move even if their timeBank is low
                               //end time
                               const endTime = Date.now();
                                const duration = endTime - startTime;
                                 let report = { result: sandbox.result, timeSpent: duration }
                                  return report; // contains the move = sandbox.result from the Bot's play() function
                         }
                     catch (err) {// If there's an error (syntax error, runtime error, timeout), we consider it an invalid move and disqualify the player for that match
                                   let report = {result: {}, error: "ABUSER", detail: err.message }
                                    return report; // move={} and error is "ABUSER" to indicate the Bot code is not compliant with the rules (syntax error, runtime error, or timeout)
                                 }
            }



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
var Matrix = [];
// Generate initial tournament matrix
function generateInitialMatrix() {
                                  for (let i = 0; i < playersNumber; i++) {
                                    Matrix[i] = [];
                                    for (let j = 0; j < playersNumber; j++) 
                                        Matrix[i][j] = { winsA: 0, winsB: 0, bonusA: 0, bonusB: 0 };
                                 }
}
function getMatchMatrixDisplay() {
                                  // Fill matrix with match results using player indices
                                  for (let key in matchMatrix) {
                                       let row = matchMatrix[key];
                                       let idxA = players[row.playerA].idx;
                                       let idxB = players[row.playerB].idx;
                                      
                                        Matrix[idxA][idxB] = {
                                                              winsA: row.winsA,
                                                              winsB: row.winsB,
                                                              bonusA: row.bonusA,
                                                              bonusB: row.bonusB
                                                            };
                                 
                                       Matrix[idxB][idxA] = {
                                                             winsA: row.winsB,
                                                             winsB: row.winsA,
                                                             bonusA: row.bonusB,
                                                             bonusB: row.bonusA
                                                            };
                                  }
                                   return Matrix;
                                  
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
                                   for (let idx = 0; idx < piles.length; idx++) {
                                       for (let i = 1; i <= piles[idx]; i++) {
                                           if (!CONFIG.forbidden.includes(i)) {
                                               moves.push({pileIndex: idx, count: i});
                                           }
                                       }
                                   }
                                     return moves;
}

function broadcast(data) {
                          wss.clients.forEach(client => client.send(JSON.stringify(data)));
}


