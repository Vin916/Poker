const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Import game logic
const PokerGame = require('./game/PokerGame');

// Store active games
const games = new Map();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Handle joining a game
  socket.on('joinGame', (playerName) => {
    console.log(`${playerName} (${socket.id}) joined the game`);
    
    // Create a new game or join existing one
    let game;
    if (games.size === 0 || Array.from(games.values())[0].players.length >= 4) {
      game = new PokerGame(io);
      games.set(game.id, game);
    } else {
      game = Array.from(games.values())[0];
    }

    // Add player to game
    game.addPlayer(socket.id, playerName, socket);
    socket.gameId = game.id;
    
    // Send initial game state
    socket.emit('gameState', game.getGameState());
  });

  // Handle player actions
  socket.on('playerAction', (action) => {
    const game = games.get(socket.gameId);
    if (game) {
      const player = game.players.find(p => p.socket.id === socket.id);
      if (player && !player.isBot) {
        game.processPlayerAction(player, action);
      }
    }
  });

  socket.on('togglePause', (isPaused) => {
    // Only allow the human player to pause/unpause
    const game = games.get(socket.gameId);
    if (game) {
      const player = game.players.find(p => p.socket.id === socket.id);
      if (player && !player.isBot) {
        game.togglePause();
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const game = games.get(socket.gameId);
    if (game) {
      game.removePlayer(socket.id);
      if (game.players.length === 0) {
        games.delete(socket.gameId);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎰 Poker server running on http://localhost:${PORT}`);
  console.log('🤖 Ready to play against bots!');
}); 