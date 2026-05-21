let ws=null; // used for WebSocket connection to the server for real-time updates
const logo             = document.getElementById('logo');
const deadlineText     = document.getElementById('deadline-timer');
const regView          = document.getElementById('registration-view');
const dashView         = document.getElementById('dashboard-view');
const currentFightText = document.getElementById('current-fight');
const matchMatrixTable = document.getElementById('match-matrix');

let playerList = [];
let matchMatrix = [];
let playerCount = 0;
let myBotName = null; // Store this client's bot name after registration

    ///  Establish WebSocket connection to the server . Called when this page loaded  to be ready to receive real-time updates about the tournament and game state
    function connect() {
                        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
                         ws = new WebSocket(`${protocol}://${window.location.host}`);

                                         //// -------- Listen for messages from the server ----
                          ws.onmessage = (event) => {
                                                     const data = JSON.parse(event.data);
                                                      handleServerEvent(data); // Main dispatcher for all incoming events from the server
                                         };

                                         //// -------- Display connection status ------------------------------------
                          ws.onopen    = () => {
                                              document.getElementById('status-text').innerText = "Connected to Arena";
                                         };
                          
    }

let tournamentState = "not_started"; // States: not_started, running, paused, ended         

        ////------------called when user clicks "Register" button, sends registration data to server via WebSocket and shows dashboard on success ----------------------
        function register() {
                                    const payload = {
                                                     type: 'REGISTER_PLAYER',
                                                     email: document.getElementById('email').value,
                                                     name:  document.getElementById('avatar-name').value,
                                                     code:  document.getElementById('bot-code').value
                                                    };
                                     if (ws && ws.readyState === WebSocket.OPEN) {
                                         ws.send(JSON.stringify(payload));
                                     }
                                     else {
                                           alert('WebSocket connection is not established');
                                     }
                                           
        }

var currenConfig = null;
let deadlineStartTime = null; // Will be calculated from delta when received from server
let clientRegistrationTime = null; // Client's local time when delta was received from server

        // Handle incoming messages from Game server  (events by web socket protocol ), called as callback from WebSocket.onmessage handle in connect() function -----------------------------------------
        function handleServerEvent(data) {
                                          if (data.type === "START_TIME_DELTA") {
                                                                           setDeadlineFromDelta(data.delta);
                                                                            return;
                                          }
                                          
                                          if (data.type === "REGISTRATION_SUCCESS") {
                                                                                myBotName = document.getElementById('avatar-name').value;
                                                                                logEvent(`✅ ${data.message}`);
                                                                                regView.classList.add('hidden');
                                                                                dashView.classList.remove('hidden');
                                                                                 return;
                                          }
                                          
                                          if (data.type === "REGISTRATION_ERROR") {
                                                                                     alert(`Registration failed. ${data.message}`);
                                                                                      return;
                                          }
        
                                              if (data.type === "TOURNAMENT_STARTED") {
                                                                                        playerList = data.players;
                                                                                         playerCount = playerList.length;
                                                                                         //console.log("Tournament started! Players:", playerList);
                                                                                        matchMatrix = data.matchMatrix;
                                                                                         //console.log("Initial matrix:", matchMatrix);
                                                                                         renderMatchMatrix(matchMatrix, playerList);
                                                                                          if (deadlineText) 
                                                                                              deadlineText.innerText = "Contest starting now!";
                                                                                          
                                                                                          data.config && logEvent(`Tournament configuration: ${JSON.stringify(data.config)}`);
                                                                                           currenConfig = data.config;
                                                                                           tournamentState = "running";
    
                                                                                           beginContestLayouts();
                                              }

                                              if (data.type === "NEW_PLAYER") {
                                                                                logEvent(`New Challenger: ${data.name} has joined!`);
                                              }
                                              
                                              if (data.type === "CONTEST_PAUSED") {
                                                                                  tournamentState = "paused";
                                                                                  if (deadlineText) 
                                                                                      deadlineText.innerText = "Current Contest paused";
                                                                                  logEvent("⏸️  CONTEST PAUSED");
                                              }
                                              
                                              if (data.type === "CONTEST_RESUMED") {
                                                                                  tournamentState = "running";
                                                                                  if (deadlineText) 
                                                                                      deadlineText.innerText = "Current Contest resumed";
                                                                                  logEvent("▶️  CONTEST RESUMED");
                                              }
                                              
                                              if (data.type === "END") {
                                                                         tournamentState = "ended";
                                                                         updateLeaderboard(data);
                                                                         if (deadlineText) 
                                                                             deadlineText.innerText = "Current Contest ended now";
                                                                         logEvent("🏆 TOURNAMENT OVER!");
                                              }
                                              
                                              if (data.type === "NEW_CONTEST_BEGINS") {
                                                                                  tournamentState = "not_started";
                                                                                  if (deadlineText) 
                                                                                      deadlineText.innerText = "New Contest begins";
                                                                                  playerList = data.players;
                                                                                  playerCount = playerList.length;
                                                                                  matchMatrix = data.matchMatrix;
                                                                                  renderMatchMatrix(matchMatrix, playerList);
                                                                                  currenConfig = data.config;
                                                                                  logEvent("🎊 NEW CONTEST STARTS!");
                                              }
                                              
                                              if (data.type === "CURRENT_FIGHT") {
                                                                                  const fight = data.fight;
                                                                                   currentFightText.innerHTML = `⚔️ <strong>${fight.playerA}</strong> vs <strong>${fight.playerB}</strong> (Game ${fight.game}/${fight.totalGames})`;
                                              }
                                              
                                              if (data.type === "MOVE") {
                                                                        updatePiles(data);
                                                                         logEvent(`${data.player} took ${data.count} coins, now state is ${data.piles}, (bonus: +${data.bonus}ms)`);
                                              }
                                              
                                              if (data.type === "MATCH_UPDATE") {
                                                                         updateLeaderboard(data);
                                                                         logEvent(`✅ Winner is ${data.winnerName}`);
                                              }
                                              
                                              if (data.type === "DISQUALIFIED_FOR_ERROR") {
                                                                                        logEvent(`❌ ${data.player} DISQUALIFIED for error: ${data.error}`);
                                              }
                                              
                                              if (data.type === "DISQUALIFIED_FOR_INVALID_MOVE") {
                                                                                             logEvent(`❌ ${data.player} DISQUALIFIED for invalid move: ${JSON.stringify(data.invalidMove)}`);
                                              }

                                              if (data.type === "HEARTBEAT_REQUEST") {
                                                  // Respond to server heartbeat to confirm connection
                                                  if (ws && ws.readyState === WebSocket.OPEN) {
                                                      ws.send(JSON.stringify({ type: "HEARTBEAT_RESPONSE" }));
                                                  }
                                                  let hljs = window.hljs;
                                                       hljs.highlightAll(); // Highlight any new code snippets in the log
                                                  return;
                                              }

        }

// Countdown timer for tournament start
var countdownInterval=null;
            // Function to set the tournament start deadline from time delta (milliseconds until tournament starts)
            function setDeadlineFromDelta(delta) {
                                                  clientRegistrationTime = Date.now(); // Record client's local time when delta was received
                                                  deadlineStartTime = clientRegistrationTime + delta; // Calculate tournament start time based on delta
                                                   if (countdownInterval)clearInterval(countdownInterval);
                                                   
                                                    updateDeadlineTimer();
                                                     countdownInterval = setInterval(updateDeadlineTimer, 1000);
            }
            
            // Legacy function for backwards compatibility (if needed)
            function setDeadline(startTimeValue) {
                                                  deadlineStartTime = new Date(startTimeValue);
                                                   if (countdownInterval)clearInterval(countdownInterval);
                                                   
                                                    updateDeadlineTimer();
                                                     countdownInterval = setInterval(updateDeadlineTimer, 1000);
            }
                // Function to update the countdown timer display and handle the transition to the tournament dashboard when the deadline is reached
                function updateDeadlineTimer() {
                                                if (!deadlineStartTime) return;
                                            
                                                    const msLeft = deadlineStartTime - Date.now();
                                                     if (msLeft <= 0) {
                                                         if (deadlineText) {
                                                             deadlineText.innerText = "Contest starting now!";
                                                         }
                                                          clearInterval(countdownInterval);
                                                           countdownInterval = null;
                                                            beginContestLayouts();
                                                             return;
                                                     }
                                            
                                                          const minutes = String(Math.floor(msLeft / 60000)).padStart(2, '0');
                                                          const seconds = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');
                                                           if (deadlineText) 
                                                               deadlineText.innerText = `Tournament starts in ${minutes}:${seconds}`;
                                                           
                }
                    // Function to transition the UI from the registration view to the tournament dashboard when the contest begins
                    function beginContestLayouts() {
                        if (countdownInterval) {
                                                clearInterval(countdownInterval);
                                                 countdownInterval = null;
                        } 
                        if (regView && dashView) {
                                                   regView.classList.add('hidden');
                                                   dashView.classList.remove('hidden');
                        }
                        if (deadlineText) {
                                           deadlineText.innerText = "Contest starting now!";
                        }
                        // Update "Live Battle" header with client's bot name
                        const liveBattleHeader = document.querySelector('.arena h2');
                        if (liveBattleHeader && myBotName) {
                            liveBattleHeader.innerHTML = `Live Battle - You are <strong>${myBotName}</strong>`;
                        }
                        logEvent("🏁 Contest begins!");
                    }



            // Function to update the piles display based on the current game state
            function updatePiles(data) {
                let forb = currenConfig.forbidden ;
                let piles = data.piles;
                let player = data.player.trim();
                let pilesString = "";
                 piles.forEach((count, index) => {
                                                  let pile = "🪙".repeat(count); 
                                                   let P = [...pile];
                                                    for(let k = 0; k < forb.length; k++){ 
                                                        let i=count-forb[k];
                                                         if(i>=0) P[i] = `💥`; //'❌';
                                                    }    
                                                    //console.log(P)  
                                                     pile = P.join('');     
                                                      if(index === data.movedFrom) {
                                                         pile +=  player;
                                                      }
                                                       pilesString +=  String(count).padStart(2) + ": " + pile + "\n";  
                                                 }
                              );
                const display = document.getElementById('piles-display');
                  display.innerHTML = pilesString;    
            }


            // Function to update the leaderboard and match matrix based on the latest tournament state
            function updateLeaderboard(data) {
                                              let players = data.players;
                                              let matrix  = data.matchMatrix;
                                                   updatePlayersList(data.players)
                                                   renderMatchMatrix(data.matchMatrix, data.players);
            }
                // Function to update the players list in the leaderboard table
                function updatePlayersList(players) {
                                                     const body = document.getElementById('leaderboard-body');
                                                      body.innerHTML = '';
                                                       Object.values(players)
                                                           .sort((a,b) => b.score - a.score)
                                                                .forEach(p => {
                                                                               //console.log("Updating leaderboard with player:", p); 
                                                                               body.innerHTML += `<tr><td>${p.name}</td><td>${p.score}</td><td>${p.timeBank}ms</td></tr>`;
                                                                              }
                                                                        );
                }
                // Function to render the match matrix table showing wins between players 
                function renderMatchMatrix(matrixEntries, players) {
                                                                    if (matchMatrixTable.innerHTML.trim() == "") generateMatchMatrixTable(players);
        
                                                                       const playersData = Object.values(players); 
                                                                        const M = playersData.length;
                                                                         for (let i = 0; i < M; i++) 
                                                                              for (let j = 0; j < M; j++) {    
                                                                                   let id = `${i}*${j}`
                                                                                    let cell = document.getElementById(id);
                                                                                    let winsA = matrixEntries[i][j].winsA;
                                                                                      cell.innerHTML = `${winsA}`;
                                                                              }        
                }
                    // Function to generate the initial empty match matrix table with given player names as headers               
                    function generateMatchMatrixTable(players) {
                                                                if (matchMatrixTable.innerHTML.trim() !== "") {
                                                                     console.log("Match Matrix Table exists already :", matchMatrixTable);
                                                                      return;           
                                                                 }
            
                                                                     const M = Object.keys(players).length;
                                                                     const playersData = Object.values(players); 
                                                                      const names = playersData    .map(p => p.name);
                                                                     let cells = '<center><table id="match-matrix-table">';
        
                                                                      cells += '<thead>';
                                                                       cells+= `<th> ⚡️ </th>`;
                                                                       for (let i = 0; i < M; i++) 
                                                                             cells+= `<th>${names[i]}</th>`;
                                                                        cells += '</thead>';
        
                                                                         cells += '<tbody>';
                                                                          for (let i = 0; i < M; i++) {    
                                                                               cells += '<tr>';
                                                                                cells += `<th>${names[i]}</th>`;
                                                                                 for (let j = 0; j < M; j++) {    
                                                                                      let id = `${i}*${j}`
                                                                                       cells += `<td><span id=${id}>?</span></td>`;
                                                                                 }
                                                                                  cells += '</tr>';
                                                                          }
                                                                           cells += '</tbody>';
        
                                                                            cells += '</table></center>';  
        
                                                                             matchMatrixTable.innerHTML = cells;
            
                    }
        

            // Utility function to log events in the game log  
            function logEvent(msg) {
                                    const log = document.getElementById('game-log');
                                     log.innerHTML = `<div>> ${msg}</div>` + log.innerHTML;
            }





// Initialize ws connection when page loads
// Initialize code syntax highlighting for bot code textarea
function initializeCodeHighlighting() {
    const botCodeInput = document.getElementById('bot-code');
    if (!botCodeInput) return;

    // Create a hidden pre/code element for highlighting
    const highlightContainer = document.createElement('div');
    highlightContainer.id = 'code-highlight-container';
    highlightContainer.style.position = 'absolute';
    highlightContainer.style.visibility = 'hidden';
    highlightContainer.style.height = '0';
    highlightContainer.style.overflow = 'hidden';
    document.body.appendChild(highlightContainer);

    // Create pre and code elements for highlighting
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = 'language-javascript';
    pre.appendChild(code);
    highlightContainer.appendChild(pre);

    // Update highlighting function
    function updateHighlighting() {
        const text = botCodeInput.value;
        code.textContent = text;
        
        // Apply highlight.js if available
        if (window.hljs) {
            delete code.dataset.highlighted;
            hljs.highlightElement(code);
        }
    }

    // Listen for input changes
    botCodeInput.addEventListener('input', updateHighlighting);
    botCodeInput.addEventListener('change', updateHighlighting);

    // Initial highlighting
    updateHighlighting();
}

// Call initialization when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeCodeHighlighting();
});

connect();

