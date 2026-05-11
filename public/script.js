let ws;
const regView = document.getElementById('registration-view');
const dashView = document.getElementById('dashboard-view');
const deadlineText = document.getElementById('deadline-timer');
const logo = document.getElementById('logo');
const currentFightText = document.getElementById('current-fight');
const matchMatrixTable = document.getElementById('match-matrix');
const playerList = document.getElementById('player-list');

let countdownInterval = null;
let deadlineStartTime = null;
let consecutiveLogoEnters = 0;
let lastLogoEnterTime = 0;

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
        name: document.getElementById('avatar-name').value,
        code: document.getElementById('bot-code').value
    };

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        regView.classList.add('hidden');
        dashView.classList.remove('hidden');
    } else {
        alert("Registration failed. Check your code size!");
    }
}

// 3. Handle incoming Game Events
function handleServerEvent(data) {
    if (data.type === "START_TIME") {
        setDeadline(data.startTime);
        return;
    }

    if (data.type === "TOURNAMENT_STARTED") {
        if (deadlineText) {
            deadlineText.innerText = "Contest starting now!";
        }
        beginContest();
        return;
    }

    if (data.type === "CURRENT_FIGHT") {
        if (currentFightText) {
            currentFightText.innerText = `Current fight: ${data.fight.playerA} vs ${data.fight.playerB} — round ${data.fight.game}/${data.fight.totalGames}`;
        }
        logEvent(`Current fight: ${data.fight.playerA} vs ${data.fight.playerB}`);
        return;
    }

    if (data.type === "MATCH_UPDATE") {
        updateLeaderboard(data.players, data.matchMatrix);
        return;
    }

    if (data.type === "MOVE") {
        updatePiles(data.piles);
        logEvent(`${data.player} made a move.`);
    }
    
    if (data.type === "NEW_PLAYER") {
        logEvent(`New Challenger: ${data.name} has joined!`);
    }

    if (data.type === "END") {
        updateLeaderboard(data.players);
        logEvent("🏆 TOURNAMENT OVER!");
    }
}

function setDeadline(startTimeValue) {
    deadlineStartTime = new Date(startTimeValue);
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
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
    if (deadlineText) {
        deadlineText.innerText = `Tournament starts in ${minutes}:${seconds}`;
    }
}

function handleLogoHover() {
    const now = Date.now();
    if (now - lastLogoEnterTime > 2500) {
        consecutiveLogoEnters = 1;
    } else {
        consecutiveLogoEnters += 1;
    }
    lastLogoEnterTime = now;

    if (consecutiveLogoEnters === 3) {
        consecutiveLogoEnters = 0;
        logEvent("🧠 Easter egg activated: requesting early tournament start!");
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "START_TOURNAMENT_REQUEST" }));
        }
        beginContest();
    }
}

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
    
    piles.forEach((count, index) => {
        const div = document.createElement('div');
        div.className = 'pile';
        // Create a string of emojis
        div.innerText = "🪙".repeat(count);
        display.appendChild(div);
    });
}

function updateLeaderboard(players, matrix) {
    renderPlayerList(players);
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = '';
    
    Object.values(players).sort((a,b) => b.score - a.score).forEach(p => {
        body.innerHTML += `<tr><td>${p.name}</td><td>${p.score}</td><td>${p.timeBank}ms</td></tr>`;
    });

    if (matrix && Array.isArray(matrix)) {
        renderMatchMatrix(matrix, players);
    }
}

function renderPlayerList(players) {
    if (!playerList) return;
    const names = Object.values(players).map(p => p.name);
    playerList.innerText = `Contestants: ${names.join(' • ')}`;
}

function renderMatchMatrix(matrixEntries, players) {
    if (!matchMatrixTable) return;

    const names = Object.values(players).map(p => p.name);
    const header = `<tr><th></th>${names.map(name => `<th>${name}</th>`).join('')}</tr>`;
    const rows = names.map(rowName => {
        const cells = names.map(colName => {
            if (rowName === colName) return '<td class="self-cell">—</td>';
            const match = matrixEntries.find(entry =>
                (entry.playerA === rowName && entry.playerB === colName) ||
                (entry.playerA === colName && entry.playerB === rowName)
            );
            if (!match) return '<td></td>';
            const isA = match.playerA === rowName;
            const wins = isA ? match.winsA : match.winsB;
            const losses = isA ? match.winsB : match.winsA;
            const bonus = isA ? match.bonusA : match.bonusB;
            return `<td>${wins}W / ${losses}L<br>+${bonus}ms</td>`;
        });
        return `<tr><th>${rowName}</th>${cells.join('')}</tr>`;
    });

    matchMatrixTable.innerHTML = header + rows.join('');
}

function logEvent(msg) {
    const log = document.getElementById('game-log');
    log.innerHTML = `<div>> ${msg}</div>` + log.innerHTML;
}

// Initialize
connect();
