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

                                                                        //--------- Early contest start easter egg: listen for 3 consecutive mouse enters on the logo to trigger early tournament start request to server
                          if (logo) logo.addEventListener('mouseenter', handleLogoHover);
                          
    }

let consecutiveLogoEnters = 0;
        ////----------for early contest start  by 3 consecutive mouse enters----------------------------------------------------
        function handleLogoHover() {
                                     consecutiveLogoEnters += 1;
                                      if (consecutiveLogoEnters === 3) {
                                          consecutiveLogoEnters = 0;
                                           logEvent("🧠 Easter egg activated: requesting early tournament start!");
                                           if (ws && ws.readyState === WebSocket.OPEN) {
                                               ws.send(JSON.stringify({ type: "START_TOURNAMENT_REQUEST" }));
                                                beginContestLayouts();
                                           }
                                           else {
                                                 logEvent("❌ Failed to request early tournament start.");
                                           }
                                     }
        }         

        ////------------called when user clicks "Register" button, sends registration data to server and shows dashboard on success ----------------------
        async function register() {
                                    const payload = {
                                                     email: document.getElementById('email').value,
                                                     name:  document.getElementById('avatar-name').value,
                                                     code:  document.getElementById('bot-code').value
                                                    };
        
                                            const response = await fetch('/register', {
                                                                                 method: 'POST',
                                                                                 headers: { 'Content-Type': 'application/json' },
                                                                                 body: JSON.stringify(payload)
                                                                               });
                                 
                                                if (response.ok) { // Registration successful, switch to tournament dashboard view
                                                                  regView.classList.add('hidden');
                                                                  dashView.classList.remove('hidden');
                                                                 }
                                                else    alert(`Registration failed. ${await response.text()}`);
                                           
        }

var currenConfig = null;
        // Handle incoming messages from Game server  (events by web socket protocol ), called as callback from WebSocket.onmessage handle in connect() function -----------------------------------------
        function handleServerEvent(data) {
                                          if (data.type === "START_TIME") {
                                                                           setDeadline(data.startTime);
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
    
                                                                                           beginContestLayouts();
                                              }

                                              if (data.type === "NEW_PLAYER") {
                                                                                logEvent(`New Challenger: ${data.name} has joined!`);
                                              }
                                          
                                              if (data.type === "CURRENT_FIGHT") {
                                                                                  currenConfig = data.config;
                                                                                  if (currentFightText) 
                                                                                      currentFightText.innerText = `Current fight: ${data.fight.playerA} vs ${data.fight.playerB} — round ${data.fight.game} of ${data.fight.totalGames}`;
                                                                                  
                                                                                  logEvent(`Current fight: ${data.fight.playerA} vs ${data.fight.playerB}`);
                                              }
                                          
                                              if (data.type === "MATCH_UPDATE") {
                                                                                  updateLeaderboard(data);
                                              }
                                          
                                              if (data.type === "MOVE") {
                                                                         updatePiles(data);
                                                                         logEvent(`${data.player} moves to state: ${data.piles}, bonus: ${data.bonus}ms`);
                                              } 
                                              if (data.type === "DISQUALIFIED_FOR_INVALID_MOVE") {
                                                                                                  updatePiles(data);
                                                                                                  logEvent(`${data.player} tried to make an 💥 invalid  move ${data.invalidMove} and is looser!`);
                                              } 
                                              if (data.type === "DISQUALIFIED_FOR_ERROR") {
                                                                                           //updatePiles(data.piles);
                                                                                           logEvent(`${data.player}  made ❌ error: ${data.error} while trying to make move  and is looser!`);
                                              } 
                                              
                                          
                                              if (data.type === "END") {
                                                                         updateLeaderboard(data)
                                                                         logEvent("🏆 TOURNAMENT OVER!");
                                              }

        }

// Countdown timer for tournament start
var countdownInterval=null;
            // Function to set the tournament start deadline and initialize the countdown timer
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
connect();

