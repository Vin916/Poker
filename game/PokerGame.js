const Deck = require('./Deck');
const HandEvaluator = require('./HandEvaluator');
const Bot = require('./Bot');

class PokerGame {
  constructor(io) {
    this.io = io;
    this.id = Math.random().toString(36).substr(2, 9);
    this.players = [];
    this.bots = [];
    this.deck = new Deck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.gamePhase = 'waiting'; // waiting, preflop, flop, turn, river, showdown
    this.bettingRound = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.lastRaiseAmount = 0;
    this.playersInHand = [];
    this.sidePots = [];
    this.playersActedThisRound = new Set();
    this.lastPlayerToRaise = -1;
    this.playerTimer = null;
    this.timeLimit = 10000; // 10 seconds in milliseconds - ENFORCED
    this.isPaused = false;
    
    this.initializeBots();
  }

  initializeBots() {
    const botNames = ['Alice', 'Bob', 'Charlie'];
    const difficulties = ['easy', 'medium', 'hard'];
    
    for (let i = 0; i < 3; i++) {
      const bot = new Bot(botNames[i], difficulties[i]);
      this.bots.push(bot);
      this.players.push({
        id: `bot_${i}`,
        name: botNames[i],
        stack: 1000,
        currentBet: 0,
        holeCards: [],
        isBot: true,
        hasFolded: false,
        isAllIn: false,
        socket: null,
        bot: bot
      });
    }
  }

  addPlayer(socketId, playerName, socket) {
    if (this.players.filter(p => !p.isBot).length >= 1) {
      socket.emit('error', 'Game is full');
      return false;
    }

    const player = {
      id: socketId,
      name: playerName,
      stack: 1000,
      currentBet: 0,
      holeCards: [],
      isBot: false,
      hasFolded: false,
      isAllIn: false,
      socket: socket
    };

    // Insert human player at index 0
    this.players.unshift(player);
    
    // Start game if we have enough players
    if (this.players.length >= 2 && this.gamePhase === 'waiting') {
      setTimeout(() => this.startNewHand(), 2000);
    }

    this.broadcastGameState();
    return true;
  }

  removePlayer(socketId) {
    // Clear timer if the leaving player was the current player
    const leavingPlayer = this.players.find(p => p.id === socketId);
    if (leavingPlayer && this.players[this.currentPlayerIndex]?.id === socketId) {
      this.clearPlayerTimer();
    }
    
    this.players = this.players.filter(p => p.id !== socketId);
    if (this.players.filter(p => !p.isBot).length === 0) {
      this.gamePhase = 'waiting';
      this.clearPlayerTimer();
    }
  }

  startNewHand() {
    if (this.players.length < 2) return;

    // Reset for new hand
    this.deck.reset();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseAmount = 0;
    this.bettingRound = 0;
    this.sidePots = [];

    // Reset players
    this.players.forEach(player => {
      player.currentBet = 0;
      player.holeCards = [];
      player.hasFolded = false;
      player.isAllIn = false;
      if (player.isBot) {
        player.bot.reset();
      }
    });

    // Filter out broke players
    this.players = this.players.filter(p => p.stack > 0);
    this.playersInHand = [...this.players];

    // Move dealer button
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

    // Post blinds
    this.postBlinds();

    // Deal hole cards
    this.dealHoleCards();

    this.gamePhase = 'preflop';
    this.currentPlayerIndex = this.getNextPlayerIndex(this.getBigBlindIndex());
    this.playersActedThisRound = new Set();
    this.lastPlayerToRaise = this.getBigBlindIndex(); // Big blind is considered the initial "raiser"

    this.broadcastGameState();
    
    // Start betting
    setTimeout(() => this.processBetting(), 1000);
  }

  postBlinds() {
    const smallBlindIndex = (this.dealerIndex + 1) % this.players.length;
    const bigBlindIndex = (this.dealerIndex + 2) % this.players.length;

    const smallBlindPlayer = this.players[smallBlindIndex];
    const bigBlindPlayer = this.players[bigBlindIndex];

    // Post small blind
    const smallBlindAmount = Math.min(this.smallBlind, smallBlindPlayer.stack);
    smallBlindPlayer.stack -= smallBlindAmount;
    smallBlindPlayer.currentBet = smallBlindAmount;
    this.pot += smallBlindAmount;

    // Post big blind
    const bigBlindAmount = Math.min(this.bigBlind, bigBlindPlayer.stack);
    bigBlindPlayer.stack -= bigBlindAmount;
    bigBlindPlayer.currentBet = bigBlindAmount;
    this.pot += bigBlindAmount;
    this.currentBet = bigBlindAmount;

    if (bigBlindPlayer.stack === 0) bigBlindPlayer.isAllIn = true;
    if (smallBlindPlayer.stack === 0) smallBlindPlayer.isAllIn = true;
  }

  getBigBlindIndex() {
    return (this.dealerIndex + 2) % this.players.length;
  }

  dealHoleCards() {
    this.players.forEach(player => {
      player.holeCards = this.deck.dealHand(2);
      if (player.isBot) {
        player.bot.setHoleCards(player.holeCards);
      }
    });
  }

  handlePlayerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.players[this.currentPlayerIndex].id) {
      return;
    }

    this.processPlayerAction(player, action);
  }

  processPlayerAction(player, action) {
    const { type, amount } = action;
    const playerIndex = this.players.indexOf(player);

    // Clear any active timer
    this.clearPlayerTimer();

    // Mark this player as having acted
    this.playersActedThisRound.add(playerIndex);

    // Prepare action display info
    let actionDisplay = '';
    let actionAmount = 0;

    switch (type) {
      case 'fold':
        player.hasFolded = true;
        this.playersInHand = this.playersInHand.filter(p => p.id !== player.id);
        actionDisplay = 'FOLD';
        break;

      case 'call':
        const callAmount = Math.min(this.currentBet - player.currentBet, player.stack);
        player.stack -= callAmount;
        player.currentBet += callAmount;
        this.pot += callAmount;
        actionAmount = callAmount;
        if (player.stack === 0) {
          player.isAllIn = true;
          actionDisplay = 'ALL IN';
        } else if (callAmount === 0) {
          actionDisplay = 'CHECK';
        } else {
          actionDisplay = 'CALL';
        }
        break;

      case 'check':
        // No money changes hands
        actionDisplay = 'CHECK';
        break;

      case 'raise':
        const totalBet = this.currentBet + amount;
        const raiseAmount = Math.min(totalBet - player.currentBet, player.stack);
        player.stack -= raiseAmount;
        player.currentBet += raiseAmount;
        this.pot += raiseAmount;
        this.currentBet = player.currentBet;
        this.lastRaiseAmount = amount;
        this.lastPlayerToRaise = playerIndex;
        actionAmount = raiseAmount;
        // Reset acted players when there's a raise (everyone needs to act again)
        this.playersActedThisRound.clear();
        this.playersActedThisRound.add(playerIndex);
        if (player.stack === 0) {
          player.isAllIn = true;
          actionDisplay = 'ALL IN';
        } else {
          actionDisplay = 'RAISE';
        }
        break;
    }

    // Broadcast the action to all players
    this.io.emit('playerAction', {
      playerName: player.name,
      action: actionDisplay,
      amount: actionAmount,
      isBot: player.isBot
    });

    this.broadcastGameState();
    this.moveToNextPlayer();
  }

  moveToNextPlayer() {
    // Clear any active timer when moving to next player
    this.clearPlayerTimer();

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      console.log(`Betting round complete for ${this.gamePhase}, moving to next phase`);
      this.completeBettingRound();
      return;
    }

    // Move to next active player
    const nextIndex = this.getNextActivePlayerIndex();
    this.currentPlayerIndex = nextIndex;
    console.log(`Moving to next player: ${this.players[nextIndex].name} (${this.gamePhase})`);
    setTimeout(() => this.processBetting(), 1000);
  }

  getNextActivePlayerIndex() {
    let nextIndex = this.currentPlayerIndex;
    let attempts = 0;
    const maxAttempts = this.players.length;
    
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
      
      // Prevent infinite loop
      if (attempts > maxAttempts) {
        console.log('Warning: Could not find next active player, breaking loop');
        break;
      }
    } while (
      this.players[nextIndex].hasFolded || 
      this.players[nextIndex].isAllIn ||
      !this.playersInHand.find(p => p.id === this.players[nextIndex].id)
    );
    return nextIndex;
  }

  getNextPlayerIndex(startIndex) {
    let nextIndex = startIndex;
    let attempts = 0;
    const maxAttempts = this.players.length;
    
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
      
      // Prevent infinite loop
      if (attempts > maxAttempts) {
        console.log('Warning: Could not find next player, breaking loop');
        break;
      }
    } while (
      this.players[nextIndex].hasFolded ||
      this.players[nextIndex].isAllIn ||
      !this.playersInHand.find(p => p.id === this.players[nextIndex].id)
    );
    return nextIndex;
  }

  isBettingRoundComplete() {
    const activePlayers = this.playersInHand.filter(p => !p.hasFolded && !p.isAllIn);
    
    if (activePlayers.length <= 1) {
      console.log('Betting round complete: only 1 or fewer active players');
      return true;
    }

    // Check if all active players have the same bet
    const bets = activePlayers.map(p => p.currentBet);
    const allBetsEqual = bets.every(bet => bet === bets[0]);
    
    if (!allBetsEqual) {
      console.log('Betting round not complete: bets not equal', bets);
      return false;
    }

    // Check if all active players have acted this round
    const activePlayerIndices = activePlayers.map(p => this.players.indexOf(p));
    const allActivePlayersActed = activePlayerIndices.every(index => this.playersActedThisRound.has(index));
    
    // Reduced logging for cleaner output
    if (!allActivePlayersActed) {
      console.log(`Still waiting for players to act in ${this.gamePhase}. Active: ${activePlayers.map(p => p.name)}`);
    }
    
    return allActivePlayersActed;
  }

  completeBettingRound() {
    // Reset current bets for next round
    this.players.forEach(player => {
      player.currentBet = 0;
    });
    this.currentBet = 0;
    this.lastRaiseAmount = 0;
    this.playersActedThisRound.clear();
    this.lastPlayerToRaise = -1;

    // Move to next phase
    switch (this.gamePhase) {
      case 'preflop':
        this.dealFlop();
        break;
      case 'flop':
        this.dealTurn();
        break;
      case 'turn':
        this.dealRiver();
        break;
      case 'river':
        this.showdown();
        return;
    }

    // Start next betting round - find first active player after dealer
    const activePlayers = this.playersInHand.filter(p => !p.hasFolded && !p.isAllIn);
    if (activePlayers.length > 1) {
      this.currentPlayerIndex = this.getNextPlayerIndex(this.dealerIndex);
      console.log(`Starting ${this.gamePhase} betting round, current player: ${this.players[this.currentPlayerIndex].name}`);
      console.log(`Active players in hand: ${activePlayers.map(p => p.name).join(', ')}`);
      setTimeout(() => this.processBetting(), 1500);
    } else {
      console.log(`Skipping ${this.gamePhase} betting - only ${activePlayers.length} active players`);
      setTimeout(() => this.completeBettingRound(), 500);
    }
  }

  dealFlop() {
    this.gamePhase = 'flop';
    this.deck.dealCard(); // Burn card
    for (let i = 0; i < 3; i++) {
      this.communityCards.push(this.deck.dealCard());
    }
    console.log('Flop dealt, community cards:', this.communityCards.length);
    this.broadcastGameState();
  }

  dealTurn() {
    this.gamePhase = 'turn';
    this.deck.dealCard(); // Burn card
    this.communityCards.push(this.deck.dealCard());
    console.log('Turn dealt, community cards:', this.communityCards.length);
    this.broadcastGameState();
  }

  dealRiver() {
    this.gamePhase = 'river';
    this.deck.dealCard(); // Burn card
    this.communityCards.push(this.deck.dealCard());
    console.log('River dealt, community cards:', this.communityCards.length);
    this.broadcastGameState();
  }

  showdown() {
    this.gamePhase = 'showdown';
    
    const remainingPlayers = this.playersInHand.filter(p => !p.hasFolded);
    
    if (remainingPlayers.length === 1) {
      // Only one player left - they win
      const winner = remainingPlayers[0];
      winner.stack += this.pot;
      this.broadcastWinner([winner], this.pot);
    } else {
      // Evaluate hands and determine winner(s)
      const playerHands = remainingPlayers.map(player => {
        const handResult = HandEvaluator.evaluateHand(player.holeCards, this.communityCards);
        return {
          player: {
            name: player.name,
            stack: player.stack,
            holeCards: player.holeCards // Include hole cards for showdown
          },
          hand: handResult
        };
      });

      // Sort by hand strength (best first)
      playerHands.sort((a, b) => HandEvaluator.compareHands(b.hand, a.hand));

      // Find all players with the best hand (ties)
      const bestHand = playerHands[0].hand;
      const winners = playerHands.filter(ph => 
        HandEvaluator.compareHands(ph.hand, bestHand) === 0
      );

      // Distribute pot among winners
      const winningsPerPlayer = Math.floor(this.pot / winners.length);
      winners.forEach(winner => {
        winner.player.stack += winningsPerPlayer;
      });

      this.broadcastWinner(winners.map(w => w.player), this.pot, playerHands);
    }

    // Start next hand after showing results
    setTimeout(() => this.startNewHand(), 5000);
  }

  processBetting() {
    if (this.gamePhase === 'showdown' || this.gamePhase === 'waiting' || this.isPaused) return;

    const currentPlayer = this.players[this.currentPlayerIndex];
    console.log(`processBetting: ${currentPlayer ? currentPlayer.name : 'undefined'} (${this.gamePhase})`);
    
    if (!currentPlayer || currentPlayer.hasFolded || currentPlayer.isAllIn) {
      console.log('Player cannot act, moving to next player');
      this.moveToNextPlayer();
      return;
    }

    if (currentPlayer.isBot) {
      // Bot decision
      setTimeout(() => {
        if (this.isPaused) return; // Don't process if game is paused
        
        console.log(`Bot ${currentPlayer.name} making decision`);
        const decision = currentPlayer.bot.makeDecision(
          this.getGameState(),
          this.pot,
          this.currentBet - currentPlayer.currentBet,
          this.lastRaiseAmount || this.bigBlind
        );

        console.log(`Bot ${currentPlayer.name} decided: ${decision.action}`);
        this.processPlayerAction(currentPlayer, {
          type: decision.action,
          amount: decision.amount || 0
        });
      }, 1000 + Math.random() * 2000); // Random delay for realism
    } else {
      console.log(`Waiting for human player ${currentPlayer.name} to act`);
      this.startPlayerTimer(currentPlayer);
    }
    // Human players will send their action via socket
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    
    if (this.isPaused) {
      this.clearPlayerTimer();
    } else {
      // Resume the game - restart timer if it's a human player's turn
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isBot && !currentPlayer.hasFolded && !currentPlayer.isAllIn) {
        this.startPlayerTimer(currentPlayer);
      }
    }
    
    // Broadcast pause state to all players
    this.io.emit('gamePaused', this.isPaused);
    
    console.log(`Game ${this.isPaused ? 'paused' : 'resumed'}`);
    
    // Continue processing if unpaused
    if (!this.isPaused) {
      this.processBetting();
    }
  }

  startPlayerTimer(player) {
    if (this.isPaused) return; // Don't start timer if paused
    
    // Clear any existing timer
    this.clearPlayerTimer();

    console.log(`⏰ Starting 10-second timer for ${player.name}`);

    // Start new timer for this player
    this.playerTimer = setTimeout(() => {
      if (this.isPaused) return; // Don't timeout if paused
      
      console.log(`⏱️ TIMEOUT: ${player.name} exceeded 10-second limit, forcing fold`);
      if (player.socket) {
        player.socket.emit('timeoutWarning', 'Time expired (10s) - automatically folding');
      }
      
      // Force fold action
      this.processPlayerAction(player, { type: 'fold' });
    }, this.timeLimit);

    // Notify player about the timer
    if (player.socket) {
      player.socket.emit('timerStarted', { timeLimit: this.timeLimit });
      console.log(`📤 Sent 10-second timer notification to ${player.name}`);
    }
  }

  clearPlayerTimer() {
    if (this.playerTimer) {
      clearTimeout(this.playerTimer);
      this.playerTimer = null;
    }
  }

  broadcastGameState() {
    const gameState = this.getGameState();
    console.log('Broadcasting game state:', {
      phase: gameState.gamePhase,
      currentPlayer: gameState.currentPlayerIndex,
      playerName: this.players[gameState.currentPlayerIndex]?.name
    });
    this.io.emit('gameState', gameState);
  }

  broadcastWinner(winners, potAmount, allHands = null) {
    // Properly serialize allHands to avoid circular references
    let serializedHands = null;
    if (allHands) {
      serializedHands = allHands.map(playerHand => ({
        player: {
          name: playerHand.player.name,
          stack: playerHand.player.stack,
          holeCards: playerHand.player.holeCards ? [...playerHand.player.holeCards] : []
        },
        hand: {
          name: playerHand.hand.name,
          cards: playerHand.hand.cards ? [...playerHand.hand.cards] : []
        }
      }));
    }

    const winnerData = {
      winners: winners.map(w => ({
        name: w.name,
        winnings: Math.floor(potAmount / winners.length)
      })),
      pot: potAmount,
      allHands: serializedHands
    };
    
    console.log('📤 Broadcasting winner data with hands:', JSON.stringify(winnerData, null, 2));
    this.io.emit('handComplete', winnerData);
  }

  getGameState() {
    return {
      gameId: this.id,
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        stack: player.stack,
        currentBet: player.currentBet,
        isBot: player.isBot,
        hasFolded: player.hasFolded,
        isAllIn: player.isAllIn,
        holeCards: player.isBot ? [] : (player.holeCards ? [...player.holeCards] : []) // Clone to prevent circular refs
      })),
      communityCards: this.communityCards ? [...this.communityCards] : [],
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      dealerIndex: this.dealerIndex,
      gamePhase: this.gamePhase,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind
    };
  }
}

module.exports = PokerGame; 