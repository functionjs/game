let ws;
const regView = document.getElementById('registration-view');
const dashView = document.getElementById('dashboard-view');

// 1. Connect to WebSocket for Live Updates
function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${window.location.host}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerEvent(data);
    };

    ws.onopen = () => document.getElementById('status-text').innerText = "Connected to Arena";
}

// 2. Register Player
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

function updateLeaderboard(players) {
    const body = document.getElementById('leaderboard-body');
    body.innerHTML = '';
    
    Object.values(players).sort((a,b) => b.score - a.score).forEach(p => {
        body.innerHTML += `<tr><td>${p.name}</td><td>${p.score}</td><td>${p.timeBank}ms</td></tr>`;
    });
}

function logEvent(msg) {
    const log = document.getElementById('game-log');
    log.innerHTML = `<div>> ${msg}</div>` + log.innerHTML;
}

// Initialize
connect();
