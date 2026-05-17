## Plan for Admin Panel

### Files to Create/Modify:
1. **public/admin.html** - Admin interface with:
   - Password login form (SHA256 hashed)
   - Countdown timer for tournament start
   - Player registration list with: email, name, registration time, status, timebank, and code viewer
   - Tournament controls: Start/Pause/Resume/New Tournament buttons
   - Configuration editor: Modify piles and forbidden moves
   - Live updates via WebSocket

2. **public/admin.js** - Admin client logic:
   - Password authentication with SHA256 hashing
   - WebSocket connection for real-time updates
   - UI handlers for tournament controls
   - Config editor and broadcast to server

3. **server.js modifications** - Add server-side support:
   - New route `GET /admin` to serve admin.html
   - Admin WebSocket authentication handler
   - New message types: `ADMIN_AUTH`, `ADMIN_START`, `ADMIN_PAUSE`, `ADMIN_RESUME`, `ADMIN_NEW_TOURNAMENT`, `ADMIN_UPDATE_CONFIG`
   - Broadcast admin updates to authenticated admin clients

4. **style.css modifications** - Add admin-specific styles:
   - Dark themed form matching existing design
   - Player list table styling
   - Config editor textarea styling
   - Control buttons styling

### Features:
- ✅ SHA256 password hashing (password: "100" hashed)
- ✅ Real-time player list with bot code viewer (expandable)
- ✅ Live countdown timer
- ✅ Start/Pause/Resume/New Tournament controls
- ✅ Editable configuration (piles & forbidden moves)
- ✅ Real-time WebSocket updates
- ✅ Styled to match existing game UI
- ✅ Secure admin message validation

**Proceed with this plan!**