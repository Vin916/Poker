# 🎰 Local Poker Website

A fully-featured poker website where you can play Texas Hold'em against AI bots locally. Built with Node.js, Express, Socket.IO, and vanilla JavaScript.

## Features

- **Real-time Texas Hold'em Poker**: Complete poker game implementation with all betting rounds
- **AI Bots**: Play against 3 AI bots with different difficulty levels:
  - **Alice** (Easy): Conservative play style, less aggressive
  - **Bob** (Medium): Balanced strategy with moderate bluffing
  - **Charlie** (Hard): Aggressive play style with strategic bluffing
- **Modern UI**: Beautiful, responsive poker table interface with animations
- **Hand Evaluation**: Accurate poker hand ranking system
- **Betting System**: Full betting mechanics with blinds, raises, calls, and all-ins
- **Local Play**: No internet required - runs entirely on your local machine

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open your browser** and go to:
   ```
   http://localhost:3001
   ```

4. **Enter your name** and start playing!

## How to Play

1. **Join the Game**: Enter your name when prompted
2. **Wait for Game Start**: The game automatically starts when you join (you'll play against 3 bots)
3. **Play Your Hand**: 
   - You'll see your two hole cards at the bottom
   - Make betting decisions when it's your turn
   - Use the slider or input field to set raise amounts
4. **Game Phases**:
   - **Pre-flop**: Betting with just your hole cards
   - **Flop**: 3 community cards revealed, betting round
   - **Turn**: 4th community card revealed, betting round  
   - **River**: 5th community card revealed, final betting round
   - **Showdown**: Best hands revealed, winner(s) determined

## Game Controls

- **Fold**: Give up your hand and forfeit any bets made
- **Check/Call**: Match the current bet (or check if no bet)
- **Raise**: Increase the bet amount using the slider/input

## Bot Personalities

- **Alice (Easy)**: Plays tight, rarely bluffs, good for beginners
- **Bob (Medium)**: Balanced play style, moderate aggression
- **Charlie (Hard)**: Aggressive player, bluffs more often, challenging opponent

## Technical Details

### Architecture
- **Backend**: Node.js with Express and Socket.IO for real-time communication
- **Frontend**: Vanilla HTML/CSS/JavaScript with responsive design
- **Game Logic**: Complete poker engine with hand evaluation and betting rounds
- **AI**: Strategic bot players with different personality traits

### Files Structure
```
poker-website/
├── server.js              # Main server file
├── game/
│   ├── PokerGame.js       # Main game logic
│   ├── Deck.js            # Card deck management
│   ├── HandEvaluator.js   # Poker hand evaluation
│   └── Bot.js             # AI bot logic
├── public/
│   ├── index.html         # Main game interface
│   ├── style.css          # Poker table styling
│   └── game.js            # Client-side game logic
└── package.json           # Dependencies and scripts
```

## Development

To run in development mode with auto-restart:
```bash
npm run dev
```

## Game Rules

This implements standard **Texas Hold'em** poker rules:
- Each player gets 2 hole cards
- 5 community cards are dealt in stages (flop, turn, river)
- Players make the best 5-card hand from their 2 hole cards + 5 community cards
- Standard poker hand rankings apply (Royal Flush > Straight Flush > Four of a Kind, etc.)
- Betting rounds occur pre-flop, post-flop, post-turn, and post-river

## Requirements

- Node.js (v14 or higher)
- Modern web browser with JavaScript enabled
- No internet connection required

## Troubleshooting

**Server won't start?**
- Make sure Node.js is installed
- Check that port 3001 is not already in use
- Run `npm install` to ensure dependencies are installed

**Game not loading?**
- Ensure JavaScript is enabled in your browser
- Check browser console for any error messages
- Try refreshing the page

**Can't connect to game?**
- Make sure the server is running (`npm start`)
- Verify you're accessing `http://localhost:3001`

Enjoy your poker game! 🎰♠️♥️♦️♣️ 