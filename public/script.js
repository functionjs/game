let ws;
const regView = document.getElementById('registration-view');
const dashView = document.getElementById('dashboard-view');
const deadlineText = document.getElementById('deadline-timer');
const logo = document.getElementById('logo');
const currentFightText = document.getElementById('current-fight');
const matchMatrixTable = document.getElementById('match-matrix');
let playerList = [];
let matchMatrix = [];
let playerCount = 0;

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
    };

    ws.onopen = () => {
        document.getElementById('status-text').innerText = "Connected to Arena";
    };

    if (logo) {
        logo.addEventListener('mouseenter', handleLogoHover);
    }
}

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
                         
                              if (response.ok) {
                                                regView.classList.add('hidden');
                                                dashView.classList.remove('hidden');
                                               }
                              else    alert(`Registration failed. ${await response.text()}`);
                                   
}

    // 3. Handle incoming Game Events
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
                                                                                      
                                                                                       beginContest();
                                          }
                                      
                                          if (data.type === "CURRENT_FIGHT") {
                                                                              if (currentFightText) 
                                                                                  currentFightText.innerText = `Current fight: ${data.fight.playerA} vs ${data.fight.playerB} — round ${data.fight.game} of ${data.fight.totalGames}`;
                                                                              
                                                                              logEvent(`Current fight: ${data.fight.playerA} vs ${data.fight.playerB}`);
                                          }
                                      
                                          if (data.type === "MATCH_UPDATE") {
                                                                              updateLeaderboard(data);
                                                                            }
                                      
                                          if (data.type === "MOVE") {
                                                                     updatePiles(data.piles);
                                                                     logEvent(`${data.player} moves to state: ${data.piles}, bonus time: ${data.bonus}ms`);
                                          } 
                                          if (data.type === "DISQUALIFIED_FOR_INVALID_MOVE") {
                                                                     updatePiles(data.piles);
                                                                     logEvent(`${data.player} tried to make an invalid move ${data.invalidMove} and is looser!`);
                                          } 

                                          if (data.type === "DISQUALIFIED_FOR_ERROR") {
                                                                     //updatePiles(data.piles);
                                                                     logEvent(`${data.player}  made error: ${data.error} while trying to make move  and is looser!`);
                                          } 
                                          
                                          if (data.type === "NEW_PLAYER") {
                                                                            logEvent(`New Challenger: ${data.name} has joined!`);
                                          }
                                      
                                          if (data.type === "END") {
                                                                     updateLeaderboard(data)
                                                                     logEvent("🏆 TOURNAMENT OVER!");
                                          }
                                           return
    }

var countdownInterval=null;
function setDeadline(startTimeValue) {
                                      deadlineStartTime = new Date(startTimeValue);
                                       if (countdownInterval)clearInterval(countdownInterval);
                                       
                                        updateDeadlineTimer();
                                         countdownInterval = setInterval(updateDeadlineTimer, 1000);
}

    function updateDeadlineTimer() {
                                    if (!deadlineStartTime) return;
                                
                                        const msLeft = deadlineStartTime - Date.now();
                                         if (msLeft <= 0) {
                                             if (deadlineText) {
                                                 deadlineText.innerText = "Contest starting now!";
                                             }
                                              clearInterval(countdownInterval);
                                               countdownInterval = null;
                                                beginContest();
                                                 return;
                                         }
                                
                                              const minutes = String(Math.floor(msLeft / 60000)).padStart(2, '0');
                                              const seconds = String(Math.floor((msLeft % 60000) / 1000)).padStart(2, '0');
                                               if (deadlineText) 
                                                   deadlineText.innerText = `Tournament starts in ${minutes}:${seconds}`;
                                               
    }
      //----------for early contest start -----------------------------------------------------
      let consecutiveLogoEnters = 0;
      function handleLogoHover() {
                                   consecutiveLogoEnters += 1;
                                    if (consecutiveLogoEnters === 3) {
                                        consecutiveLogoEnters = 0;
                                         logEvent("🧠 Easter egg activated: requesting early tournament start!");
                                         if (ws && ws.readyState === WebSocket.OPEN) {
                                             ws.send(JSON.stringify({ type: "START_TOURNAMENT_REQUEST" }));
                                              beginContest();
                                         }
                                         else {
                                               logEvent("❌ Failed to request early tournament start.");
                                         }
                                   }
      }                         
logo.addEventListener('mouseenter', handleLogoHover);

function beginContest() {
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

function updatePiles(piles) {
    const display = document.getElementById('piles-display');
    display.innerHTML = ''; // Clear
    
    let pilesString = "";
     piles.forEach((count, index) => {
                                      let pileString = "🪙".repeat(count); 
                                       pilesString += `<div> (${count})${pileString} </div>`;
                                     }
                  );
      display.innerHTML = pilesString;    
}

    function updateLeaderboard(data) {
                                      let players = data.players;
                                      let matrix  = data.matchMatrix;
                                           updatePlayersList(data.players)
                                           renderMatchMatrix(data.matchMatrix, data.players);
    }
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
        
            function generateMatchMatrixTable(players) {
                                                        if (matchMatrixTable.innerHTML.trim() !== "") {
                                                             console.log("Match Matrix Table exists already :", matchMatrixTable);
                                                              return;           
                                                         }
    
                                                             const M = Object.keys(players).length;
                                                             const playersData = Object.values(players); 
                                                              const names = playersData    .map(p => p.name);
                                                             let cells = '<table>';
                                                              cells += '<thead>';
                                                               for (let i = 0; i < M; i++) 
                                                                     cells+= `<th>${names[i]}</th>`;
                                                                cells += '</thead>';
                                                                 cells += '<tbody>';
                                                                  for (let i = 0; i < M; i++) {    
                                                                       cells += '<tr>';
                                                                        for (let j = 0; j < M; j++) {    
                                                                             let id = `${i}*${j}`
                                                                              cells += `<td><span id=${id}>?</span></td>`;
                                                                        }
                                                                         cells += '</tr>';
                                                                  }
                                                                   cells += '</tbody>';
                                                                    cells += '</table>';  
                                                                     matchMatrixTable.innerHTML = cells;
    
            }

        

function logEvent(msg) {
    const log = document.getElementById('game-log');
    log.innerHTML = `<div>> ${msg}</div>` + log.innerHTML;
}

// Initialize ws connection when page loads
connect();
