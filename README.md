# Nim like game platform for testing gamer-bots

## Game Server  is the "Brain" of your project. 


We have written this `server.js` to be as readable as possible for pupils. It uses **Express** for the web server, **ws** for the live dashboard, and the **vm** module to run student code safely.

### 1. Prerequisites

In GitHub Codespace terminal, run:
`npm install express ws`

---

### 2. Key Explanations about Game Server 

* **`vm.Script`**: This is like a "protective bubble." It runs the student's code, but if their code has an infinite loop (`while(true)`), the `timeout` setting pops the bubble and stops it before the server crashes.
* **`players` Object**: This is our database. It stays in the server's memory. If you restart the server, the "database" wipes clean (simplest way).
* **`broadcast`**: This sends a message to everyone who has the website open. This is how the "Live Dashboard" works.
* **`await new Promise(...)`**: This creates a "pause." Without this, the server would finish 1000 games in one second, and the pupils wouldn't see the emojis moving on the dashboard!

---

## Single Page Application (SPA) for client part of Game.

 This means we have one `index.html` file that uses simple JavaScript to "switch" between the **Registration** view and the **Dashboard** view.

### 1. The Stage: `public/index.html`

This file contains both the form for the bots and the "Arena" where the game happens.

### 2. The Style: `public/style.css`

We will use a clean "Dark Mode" game aesthetic that looks professional but uses very few lines of code.

### 3. The Logic: `public/script.js`

This script handles the connection to the server and updates the screen when a "MOVE" happens.

---

## Tips

For any contender their bot code is just a **string** being sent over the internet. On the server, we use `vm.Script` to turn that string back into "living" code. This is a  way  how servers obtains bot codes from gamers.

**To run this in your Codespace** just place files index.html, style.css, script.js in a `/public` folder and server.js in the root!
