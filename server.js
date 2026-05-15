// version 0.1.0 
const express             = require('express'); // Express framework for handling HTTP requests and serving the dashboard
const { WebSocketServer } = require('ws'); // WebSocket library for real-time communication with the dashboard
const vm                  = require('vm'); // Node's built-in virtual machine module for safely executing untrusted Bot code in a sandboxed environment with timeouts to prevent abuse
const http                = require('http'); // Node's built-in HTTP module to create a server that can handle both Express and WebSocket connections on the same port
const fs                  = require('fs').promises; // newest File system module for reading/writing tournament data, if needed for persistence or logging
const path                = require('path');  // Node's built-in path module for handling file paths, such as where to store tournament data or logs 
 const DATA_DIR = path.join(__dirname, 'data'); // Directory to store tournament data, logs, or player registrations if needed. This keeps the project organized and allows for future features like saving tournament history or player stats. Make sure this directory exists or add code to create it if it doesn't. 
  const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json'); // File to store tournament data in JSON format. This allows for persistence of tournament results and player registrations across server restarts, and can be used for analytics or displaying past tournaments on the dashboard. Make sure to handle file read/write operations with care to avoid data corruption, especially if multiple tournaments are run in quick succession. Consider implementing a simple locking mechanism if needed to prevent concurrent writes.

const  app = express(); // Express application for handling HTTP requests and serving the dashboard
const   server = http.createServer(app); // Create an HTTP server to attach both Express and WebSocket to the same port
const    wss = new WebSocketServer({ server }); // WebSocket server for real-time communication with the dashboard

        app.use(express.json());
        app.use(express.static('public')); // Serves your index.html

         // --- ROUTES ---
         // Endpoint for players to register their Bot code. Expects { email, name, code } in the request body. Validates code size and stores player info. 
         app.post('/register', 
                              //--------------------------------------------------------------------- 
                              async (req, res) => {await tryRegisterPlayer(req, res);}        
         );
var playersNumber = 0;
var players = {};
                  // async registration function to allow for future enhancements like saving player data to a file or database, or performing asynchronous validation if needed. Currently, it validates the code size and checks for duplicate email registrations before storing the player info in memory. It also compiles the Bot code in a virtual machine to catch syntax errors before registration, providing immediate feedback to the player and preventing invalid Bots from entering the tournament.  
                 async function
                   tryRegisterPlayer(req, res) {//await tryToRegisterPlayer(req, res);
                                 const { email, name, code } = req.body;
                                 console.log(`beginning Registering player: ${name} (${email}) ...`);
                                  if (code.length > CONFIG.maxCodeSize) {
                                       let errmessage = `Bot Code too big (must be <= ${CONFIG.maxCodeSize} characters) for player: ${name} (${email})`;
                                        console.log(errmessage);
                                         return res.status(400).send(errmessage);    
                                 }
                                  
                                  //else
                                   if(!players[email]){ // new player 
                                               
                                          // Try to compile the Bot code in virtual machine to catch syntax errors before registration
                                          const botCodeString=code
                                           try {
                                               console.log(`Compiling Bot code for player: ${name} (${email}) to check for syntax errors...`);
                                               const  botScript = new vm.Script(botCodeString);               
                                               console.log(`Creating context`);
                                                const context = vm.createContext({});
                                                 console.log(`Running Bot code in context with timeout to check for syntax errors and validate play() function...`); 
                                                  botScript.runInContext(context, { timeout: 20 });// Run the Bot code in the sandboxed context to check for syntax errors and to ensure it defines a play() function as expected by the tournament rules. This also prevents players from registering Bots with invalid code that would cause issues during matches, and provides immediate feedback to the player about any issues with their code at the time of registration.
                                                   console.log(`Bot code executed successfully. Validating play() function...`);
                                                   const playFunction = context.play; // Check if the play function is defined and meets the requirements (not async, correct name) as part of the validation process to ensure that registered Bots are compliant with the tournament rules and can be executed properly during matches. This helps maintain a fair and functional tournament environment by preventing non-compliant Bots from being registered.
                                                    // --- TESTS ---
                                                     // Test 1: Check that the type is a function
                                                     if (typeof playFunction !== 'function') {
                                                         throw new Error('Bot code must define a function named "play"');
                                                     }
                                                         // Test 2: Check that the function name is exactly 'play'
                                                         if (playFunction.name !== 'play') {
                                                              throw new Error(`Expected function name to be "play", but got "${playFunction.name}"`);
                                                         }
                                                         // Test 3: Check that the function is not asynchronous
                                                         // Async functions return a special tag [object AsyncFunction]
                                                         const isAsync = Object.prototype.toString.call(playFunction) === '[object AsyncFunction]';
                                                         if (isAsync) {
                                                             throw new Error('The "play" function must be synchronous (no async/await allowed)');
                                                         }
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
                                                          let errmessage = `Error in Bot code for player: ${name} (${email}): ${err.message}`;
                                                           console.log(errmessage);
                                                            delete players[email]; // Remove player from registry if their code has syntax errors
                                                             return res.status(400).send(errmessage);    
                                           }         
                                            
                                             broadcast({ type: "NEW_PLAYER", name });
                                             console.log(`... Registered!  Total players: ${playersNumber}`);
                                             res.send("Registered!");
                                   }   
                                   else { // Duplicate email registration attempt
                                          let errmessage = `Player with email ${email} is already registered!!?`;
                                           console.log(errmessage);
                                            res.status(400).send(errmessage);
                                        }
                                }
         
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
               forbidden: [3, 5], // Example: can't take 3 or 5 from any pile
               baseTime: 10,   // ms
               maxCodeSize: 4096, // bytes
               numberOfGamesPerMatch: 10 // Number of games each pair of Bots will play against each other
};
Math.random = mulberry32(12345);// Seeded random number generator for reproducibility of pile configurations and forbidden moves across tournaments
   function resetConfigPiles(accountsNumber) {
                                 //let accountsNumber = Math.floor(Math.random() * 5) + 3; // Random number of accounts between 3 and 7
                                  let piles = []; 
                                     for (let i = 0; i < accountsNumber; i++) {
                                         piles.push(Math.floor(Math.random() * 10) + 1); // Random number of coins between 1 and 10
                                     }
                                      CONFIG.piles  = piles ;   
   }

    function resetConfigForbiddenMoves() {
         let maxTake = Math.max(...CONFIG.piles); // The maximum number of coins that can be taken in one move is the size of the largest pile
          let forbiddenMovesCount = Math.floor(maxTake/4) + 1; // 
           for(let i=0; i<forbiddenMovesCount; i++){
               let move = Math.floor(Math.random() * maxTake) + 1; // Random forbidden move between 1 and maxTake
                if(!CONFIG.forbidden.includes(move)){
                    CONFIG.forbidden.push(move);
                }
           }
    }


// Store players data: { email: { idx, name, code, timeBank, score } }
// idx  is a unique index assigned to each player for matrix display purposes in order of registration,
// email is used as a unique identifier for players, and also to track match results in the matchMatrix:
// name  is the display name for the player Avatar-Bot, 
// code  is their Bot js code (function play()),
// timeBank tracks their remaining time, 
// score tracks their points in the tournament.


// --- TOURNAMENT LOGIC ---
        async function 
        saveTournamentData(data) {
                                  await fs.appendFile(TOURNAMENTS_FILE, JSON.stringify(data, null, 2));
         }
let currentTournamentId = null;
let isPaused = false;
   async function 
    startChampionship(manual=false) { // Main function to start the tournament, run matches, and broadcast results. The manual parameter indicates whether the tournament was started manually by a client request or automatically by the scheduled timeout. This allows for different handling if needed, such as resetting piles and forbidden moves only for automatic starts to allow for consistent conditions across scheduled tournaments, while manual starts could be used for testing with specific configurations.
                         if (tournamentStarted) return { success: false, reason: "Tournament Already running" };;
                         //else start the tournament
                             tournamentStarted = true; // Set the tournamentStarted flag to prevent multiple starts
                             isPaused = false;
                             currentTournamentId = `t_${Date.now()}`;
                              if (startTimeout) {// If the tournament was started early by a client request, clear the scheduled start timeout to prevent it from firing later
                                  clearTimeout(startTimeout);
                                   startTimeout = null;
                              }

                               try {
                                    await runRounRobinMatches(); // Main function to run the round-robin matches between all registered players, with the current configuration of piles, forbidden moves, and time limits. This function handles the entire flow of the tournament, including broadcasting updates to the dashboard and saving tournament data for record-keeping. It iterates through all pairs of players, runs matches between them using the runMatch function, and updates the matchMatrix with results for display on the dashboard. After all matches are completed, it broadcasts the final results and resets the tournament state for potential future tournaments.
                               }
                                finally {
                                         tournamentStarted = false;
                                          await saveTournamentData({ players, currentTournamentId, Matrix, CONFIG });
                                }
    }
        async function 
         runRounRobinMatches() { // Run a round-robin tournament where each Bot plays against every other Bot. This function can be used for future enhancements, such as allowing for different tournament formats (e.g., double elimination, Swiss system) or for running multiple rounds of the tournament with different configurations. Currently, it simply iterates through all pairs of players and runs matches between them using the runMatch function.    
                                           // Create player list with indices
                               console.log("🤡🏆🤖 Championship Started!");            
                               const emails = Object.keys(players);
                               const playerList = [];
                                for (let i = 0; i < emails.length; i++) 
                                     playerList.push({
                                                      idx: players[emails[i]].idx,
                                                      name: players[emails[i]].name,
                                                      email: emails[i]
                                                    });
                                
                                // Save a snapshot of the current new tournament state, including player information and registration time, to a file for record-keeping and potential future features like displaying past tournaments or analytics. This snapshot can be used to track the history of tournaments and player participation over time.
                                const snapshot = { id: currentTournamentId, date: new Date().toISOString(), players: {...players} };
                                 await saveTournamentData(snapshot);
                               
                               // Generate and send initial tournament Matrix
                               generateInitialMatrix();
                                broadcast({ type: "TOURNAMENT_STARTED", players: playerList, matchMatrix: Matrix, config: CONFIG });
                               
                                // Run a round-robin tournament where each Bot plays against every other Bot
                                for (let i = 0; i < playersNumber; i++) {
                                    for (let j = i + 1; j < playersNumber; j++) {
                                        if(isPaused)delay(100000); // If the tournament is paused, wait before starting the next match. This allows for manual pausing and resuming of the tournament if needed, such as for breaks or to address any issues that arise during the tournament. The isPaused flag can be toggled by a client request or an admin command, and the delay will ensure that matches do not start while the tournament is paused.

                                         await runMatch(emails[i], emails[j]);
                                    }
                               }
                                
                                console.log("🤖🌟🤡 Championship Ended! ");
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
                                        if(game%2===0)resetConfigPiles(game);
                                        let currentFirstPlayerEmail = (game % 2 === 1) ? emailA : emailB; // Alternate who goes first each game
                                         let botA = players[currentFirstPlayerEmail];
                                         let opponentPlayerEmail = opponentEmail(currentFirstPlayerEmail);
                                          let botB = players[opponentPlayerEmail];
                                          console.log(`Match ${game}/${N} between ${currentFirstPlayerEmail} and ${opponentPlayerEmail}`); 

                                         let state = { piles: [...CONFIG.piles], turn: currentFirstPlayerEmail};
                                           broadcast({ type: "CURRENT_FIGHT", fight: { playerA: botA.name, playerB: botB.name, game, totalGames: N }, config: CONFIG });
        
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
                                                          //currentPlayer.score -= 10;
                                                          currentPlayer.timeBank -= CONFIG.baseTime ;
                                                           if(currentPlayer.timeBank<0)currentPlayer.timeBank=0; // Disqualified player loses all remaining time
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
                                                              // currentPlayer.score -= 10;
                                                               currentPlayer.timeBank -= CONFIG.baseTime ;
                                                                if(currentPlayer.timeBank<0)currentPlayer.timeBank=0; // Disqualified player loses all remaining time
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
                                                                 broadcast({ type: "MOVE", piles: state.piles, player: currentPlayer.name, bonus: bonusTime, movedFrom: move.pileIndex });
                                                                 await delay(100);
                                                                  //await new Promise(delayresolve => setTimeout(delayresolve, 500 /*ms*/)); // Slow down for dashboard viewers
                                                     
                                                     
                                           }
                                            // Determine Winner & Time Carry-over logic
                                            //if(CONFIG.mode === "NORMAL")                             
                                            let  winnerEmail =  opponentEmail(opponentPlayerEmail);  // after normal exit from while loop  in NORMAL game the opponent of  the opponent is winner
                                             console.log(`Winner email : ${winnerEmail} `);                                                                                                                         
                                              console.log(`Winner of match : ${currentPlayer.name} `);                                                                                                                         
                                             currentPlayer.score += 1;
                                             //opponentPlayer.timeBank = 0; // The loser of the match loses all remaining time for the next matches, while the winner keeps their remaining time as carry-over for their next matches. This rewards players who win quickly and penalizes those who lose or play inefficiently.
                                              recordMatchResult(emailA, emailB, winnerEmail, 0);
                                               getMatchMatrixDisplay();
                                                broadcast({ type: "MATCH_UPDATE", players, matchMatrix: Matrix });
                                                 await delay(2000);

                                                  
                                   }// End loop of all games between emailA and emailB
        }

            // Bots (player) Code EXECUTION on current state (currentPiles) by the "Referee logics" 
            function runBotSafe(player, currentPiles) {
            
                     const sandbox = { // Provide the Bot with a safe, read-only view of the game state
                                      piles: [...currentPiles], // Provide a copy of the piles to prevent cheating
                                      forbidden: CONFIG.forbidden,// Provide forbidden moves for bot's logic
                                      context: { mode: CONFIG.mode, timeRemaining: player.timeBank }, // Additional context for bots to make informed decisions
                                      result: null // This will hold the Bot's move after executing their play() function
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
                              botScript.runInContext(sandbox, { timeout: Math.min(50, +player.timeBank+CONFIG.baseTime) }); // Add baseTime to ensure Bots have at least some time to make a move even if their timeBank is low
                               //end time
                               const endTime = Date.now();
                                const duration = endTime - startTime;
                                 let report = { result: sandbox.result, timeSpent: duration }
                                  return report; // contains the move = sandbox.result from the Bot's play() function
                         }
                        catch (err) {// If there's an error (syntax error, runtime error, timeout), we consider it an invalid move and disqualify the player for that match
                                   let report = {result: sandbox.result, error: "ABUSER", detail: err.message }
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

// tournament matrix to store and display the results of matches in a structured way for the dashboard. The matrix is indexed by player indices and contains the number of wins and bonus points for each player against every other player. This allows the dashboard to easily display a comprehensive view of the tournament results.                              
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
                async function delay(time) {
                                            await new Promise(delayresolve => setTimeout(delayresolve, time /*ms*/)); // Slow down for dashboard viewers
                } 
                function mulberry32(seed) {
                                            return function () {
                                                                let t = seed += 0x6D2B79F5;
                                                                 t = Math.imul(t ^ (t >>> 15), t | 1);
                                                                  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                                                                   return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
                                            };
                }



