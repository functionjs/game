# Admin Panel Documentation

## Overview
The Admin Panel is a secure interface for managing the tournament. Administrators can control tournament flow, view player registrations, manage game configuration, and monitor bot code.

## Accessing the Admin Panel

1. **URL**: `http://localhost:3000/admin`
2. **Current Password for debugging**: `100` (SHA256 hashed for security)

## Features

### 1. Authentication
- Password-protected login with SHA256 hashing
- Session maintains connection until explicit logout
- Auto-reconnect on connection loss

### 2. Tournament Controls
- **Start Tournament**: Manually start the tournament immediately (overrides scheduled start)
- **Pause**: Pause ongoing tournament (pauses all active matches)
- **Resume**: Resume a paused tournament
- **New Tournament**: Reset tournament and start a new one

### 3. Countdown Timer
- Shows time until automatic tournament start
- Countdown format: `HH:MM:SS`
- Updates in real-time

### 4. Player Registration List
- Displays all registered players
- Shows player name, email, and status
- Scrollable list if many players
- Updates in real-time as players register

### 5. Bot Code Viewer
- Dropdown to select a player
- View their submitted bot code in a code editor
- Helps identify bot issues

### 6. Game Configuration Editor
- **Piles**: Initial pile configuration (comma-separated integers)
  - Example: `3,5,7` means three piles with 3, 5, and 7 items
- **Forbidden Moves**: Moves that are not allowed (comma-separated integers)
  - Example: `3,5` means players cannot take 3 or 5 items in one move
- **Base Time**: Time each bot gets per move (in milliseconds)
  - Default: `10` ms

**To update configuration:**
1. Modify the values in the input fields
2. Click "💾 Update Config" button
3. Configuration is broadcast to all clients immediately

### 7. Tournament Status
- **Status**: Current tournament state (Waiting to start, Running, Paused, Ended)
- **Total Players**: Number of registered players
- **Connection**: WebSocket connection status (Connected/Disconnected/Error)

## Real-time Updates

The admin panel receives real-time updates about:
- Player registrations
- Tournament start/pause/resume/end events
- Configuration changes
- Match updates

## Password Reset

The default admin password is `100`. To change it:
1. Edit `admin.js` file
2. Update the `ADMIN_PASSWORD_HASH` constant with a new SHA256 hash
3. Use an online SHA256 generator or Node.js to compute: `require('crypto').createHash('sha256').update('your-password').digest('hex')`

## WebSocket Messages

### Sent by Admin
```javascript
// Authenticate
{ type: "ADMIN_AUTH" }

// Tournament control
{ type: "ADMIN_START" }
{ type: "ADMIN_PAUSE" }
{ type: "ADMIN_RESUME" }
{ type: "ADMIN_NEW_TOURNAMENT" }

// Config update
{ 
  type: "ADMIN_UPDATE_CONFIG",
  config: {
    piles: [3, 5, 7],
    forbidden: [3, 5],
    baseTime: 10
  }
}
```

### Received from Server
```javascript
// Authentication success
{ 
  type: "ADMIN_AUTH_SUCCESS",
  players: { /* players object */ },
  config: { /* config object */ }
}

// Tournament events
{ type: "CONTEST_PAUSED" }
{ type: "CONTEST_RESUMED" }
{ type: "END" }
{ type: "CONFIG_UPDATED", config: { /* ... */ } }
```

## Keyboard Shortcuts

- **Enter key** in password field: Submit login

## Browser Compatibility

- Modern browsers with WebSocket support (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Uses modern Web Crypto API for SHA256 hashing (all modern browsers)

## Security Notes

1. **HTTPS Recommended**: Use HTTPS in production to protect password transmission
2. **Password Hashing**: Passwords are hashed on client-side; use HTTPS to prevent interception
3. **Admin-only Features**: Only authenticated admin clients can control tournaments
4. **No Session Persistence**: Admin session ends on browser close or manual logout

## Troubleshooting

### Connection Issues
- Check server is running on port 3000
- Verify WebSocket is supported in your browser
- Check browser console for error messages

### Password Issues
- Ensure password is exactly "100"
- Check for typos or extra spaces
- Try clearing browser cache if issues persist

### Configuration Not Updating
- Ensure values are valid comma-separated integers
- Check browser console for error messages
- Verify you're connected to the server

## Future Enhancements

- [ ] Admin user accounts with different permission levels
- [ ] Tournament history and analytics
- [ ] Export tournament results to CSV/JSON
- [ ] Live match replay and analysis
- [ ] Player statistics and rankings
- [ ] Configuration presets
