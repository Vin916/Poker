class PokerClient {
    constructor() {
        this.socket = io();
        this.gameState = null;
        this.playerName = '';
        this.timerInterval = null;
        this.isPaused = false;

        // UI Elements
        this.loginModal = document.getElementById('login-modal');
        this.playerNameInput = document.getElementById('player-name');
        this.joinGameBtn = document.getElementById('join-game-btn');
        this.gameTable = document.getElementById('game-table');
        this.autoActions = document.getElementById('auto-actions');
        this.bettingControls = document.getElementById('betting-controls');
        this.playerNameDisplay = document.getElementById('player-name-display');
        this.gamePhaseDisplay = document.getElementById('game-phase');
        this.potDisplay = document.getElementById('pot-display');
        this.potAmountDisplay = document.getElementById('pot-amount');
        this.communityCards = document.getElementById('community-cards');
        this.playerHand = document.getElementById('player-hand');
        this.handResults = document.getElementById('hand-results');
        this.handResultModal = document.getElementById('hand-result-modal');
        this.currentHandDisplay = document.getElementById('current-hand');
        this.gameMessages = document.getElementById('game-messages');
        this.pauseBtn = document.getElementById('pause-btn');
        this.gamePausedOverlay = document.getElementById('game-paused-overlay');
        this.resumeBtn = document.getElementById('resume-btn');
        
        // Find or create players container
        this.playersContainer = document.querySelector('.players-container');
        if (!this.playersContainer) {
            this.playersContainer = document.createElement('div');
            this.playersContainer.className = 'players-container';
            this.gameTable.appendChild(this.playersContainer);
        }
        
        // Player stack display
        this.playerStackDisplay = document.getElementById('player-stack');
        
        // Permanent betting panel elements
        this.permanentBettingPanel = document.getElementById('permanent-betting-panel');
        this.permanentFoldBtn = document.getElementById('permanent-fold-btn');
        this.permanentCallBtn = document.getElementById('permanent-call-btn');
        this.permanentRaiseBtn = document.getElementById('permanent-raise-btn');
        this.permanentBetSlider = document.getElementById('permanent-bet-slider');
        this.permanentBetInput = document.getElementById('permanent-bet-input');

        // Betting Controls
        this.foldBtn = document.getElementById('fold-btn');
        this.checkCallBtn = document.getElementById('check-call-btn');
        this.raiseBtn = document.getElementById('raise-btn');
        this.betSlider = document.getElementById('bet-slider');
        this.betInput = document.getElementById('bet-input');

        // Auto Actions
        this.autoFold = document.getElementById('auto-fold');
        this.autoCheckCall = document.getElementById('auto-check-call');
        this.autoCheckFold = document.getElementById('auto-check-fold');

        // Timer Elements
        this.timerOverlay = document.getElementById('timer-overlay');
        this.timerTextMain = document.getElementById('timer-text-main');
        this.timerCountdownMain = document.getElementById('timer-countdown-main');

        this.initializeEventListeners();
        this.setupSocketListeners();
    }

    initializeEventListeners() {
        this.joinGameBtn.addEventListener('click', () => this.joinGame());
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Betting Controls (old)
        if (this.foldBtn) this.foldBtn.addEventListener('click', () => this.playerAction('fold'));
        if (this.checkCallBtn) this.checkCallBtn.addEventListener('click', () => this.playerAction('call'));
        if (this.raiseBtn) this.raiseBtn.addEventListener('click', () => {
            const amount = parseInt(this.betInput.value);
            this.playerAction('raise', amount);
        });

        // Bet slider and input sync (old)
        if (this.betSlider) this.betSlider.addEventListener('input', () => {
            this.betInput.value = this.betSlider.value;
        });
        if (this.betInput) this.betInput.addEventListener('input', () => {
            this.betSlider.value = this.betInput.value;
        });

        // Permanent betting panel controls
        this.permanentFoldBtn.addEventListener('click', () => this.playerAction('fold'));
        this.permanentCallBtn.addEventListener('click', () => this.playerAction('call'));
        this.permanentRaiseBtn.addEventListener('click', () => {
            const amount = parseInt(this.permanentBetInput.value);
            this.playerAction('raise', amount);
        });

        // Permanent bet slider and input sync
        this.permanentBetSlider.addEventListener('input', () => {
            this.permanentBetInput.value = this.permanentBetSlider.value;
            this.permanentRaiseBtn.textContent = `Raise $${this.permanentBetInput.value}`;
        });
        this.permanentBetInput.addEventListener('input', () => {
            this.permanentBetSlider.value = this.permanentBetInput.value;
            this.permanentRaiseBtn.textContent = `Raise $${this.permanentBetInput.value}`;
        });

        // Auto actions - make mutually exclusive
        this.autoFold.addEventListener('change', () => {
            if (this.autoFold.checked) {
                this.autoCheckCall.checked = false;
                this.autoCheckFold.checked = false;
            }
        });

        this.autoCheckCall.addEventListener('change', () => {
            if (this.autoCheckCall.checked) {
                this.autoFold.checked = false;
                this.autoCheckFold.checked = false;
            }
        });

        this.autoCheckFold.addEventListener('change', () => {
            if (this.autoCheckFold.checked) {
                this.autoFold.checked = false;
                this.autoCheckCall.checked = false;
            }
        });

        // Continue button for hand results
        document.getElementById('continue-btn').addEventListener('click', () => {
            this.handResultModal.style.display = 'none';
        });

        // Pause button
        this.pauseBtn.addEventListener('click', () => this.togglePause());

        // Resume button in overlay
        this.resumeBtn.addEventListener('click', () => this.togglePause());
    }

    setupSocketListeners() {
        this.socket.on('gameState', (state) => {
            console.log('Received game state:', state);
            this.gameState = state;
            this.updateGameDisplay();
            // Force betting controls to be visible
            this.forceBettingControlsVisible();
        });

        this.socket.on('handComplete', (results) => {
            this.showHandResults(results);
        });

        this.socket.on('error', (message) => {
            this.showMessage(message, 'error');
        });

        this.socket.on('timerStarted', (data) => {
            console.log('Timer started event received:', data);
            this.startTimer(data.timeLimit);
            // Activate permanent betting panel when timer starts (it's our turn)
            this.activatePermanentBettingPanel();
            // Force betting controls to show when timer starts
            this.showBettingControls();
            // Check for auto actions
            this.checkAutoActions();
        });

        this.socket.on('timeoutWarning', (message) => {
            this.showMessage(message, 'error');
            this.clearTimer();
            // Deactivate betting panel when turn ends
            this.deactivatePermanentBettingPanel();
        });

        this.socket.on('gamePaused', (isPaused) => {
            this.isPaused = isPaused;
            if (isPaused) {
                this.pauseBtn.textContent = '▶️ Resume';
                this.pauseBtn.classList.add('paused');
                this.gamePausedOverlay.style.display = 'flex';
                this.clearTimer();
            } else {
                this.pauseBtn.textContent = '⏸️ Pause';
                this.pauseBtn.classList.remove('paused');
                this.gamePausedOverlay.style.display = 'none';
            }
        });
    }

    joinGame() {
        const name = this.playerNameInput.value.trim();
        if (!name) {
            alert('Please enter your name');
            return;
        }

        this.playerName = name;
        this.socket.emit('joinGame', name);
        
        this.loginModal.style.display = 'none';
        this.gameTable.style.display = 'block';
        this.autoActions.style.display = 'block';
        this.permanentBettingPanel.style.display = 'block'; // Show permanent betting panel
        this.permanentBettingPanel.classList.add('disabled'); // Start disabled
        this.pauseBtn.style.display = 'block'; // Show pause button
        this.playerNameDisplay.textContent = name;
        
        console.log('Game joined, permanent betting panel should be visible');
    }

    playerAction(type, amount = 0) {
        console.log(`🎮 Player action: ${type}${amount ? ` $${amount}` : ''}`);
        this.socket.emit('playerAction', { type, amount });
        // Deactivate betting panel after action
        this.deactivatePermanentBettingPanel();
        this.clearTimer();
    }

    updateGameDisplay() {
        if (!this.gameState) return;

        console.log('Updating game display, game state:', {
            phase: this.gameState.gamePhase,
            currentPlayerIndex: this.gameState.currentPlayerIndex,
            players: this.gameState.players.map(p => ({
                name: p.name,
                isBot: p.isBot,
                hasFolded: p.hasFolded,
                isAllIn: p.isAllIn
            }))
        });

        // Update pot
        this.potDisplay.textContent = `$${this.gameState.pot}`;
        this.potAmountDisplay.textContent = `Pot: $${this.gameState.pot}`;

        // Update game phase
        this.gamePhaseDisplay.textContent = this.getPhaseText();

        // Update community cards
        this.updateCommunityCards();

        // Update players
        this.updatePlayers();

        // Update player's hand and info
        this.updatePlayerInfo();

        // Update betting controls
        this.updateBettingControls();

        // Update hand strength display
        this.updateHandStrength();
    }

    getPhaseText() {
        const phases = {
            'waiting': 'Waiting for players...',
            'preflop': 'Pre-Flop Betting',
            'flop': 'Flop Betting',
            'turn': 'Turn Betting',
            'river': 'River Betting',
            'showdown': 'Showdown'
        };
        return phases[this.gameState.gamePhase] || this.gameState.gamePhase;
    }

    updateCommunityCards() {
        this.communityCards.innerHTML = '';
        
        this.gameState.communityCards.forEach((card, index) => {
            const cardElement = this.createCardElement(card);
            cardElement.classList.add('card-dealing');
            cardElement.style.animationDelay = `${index * 0.2}s`;
            this.communityCards.appendChild(cardElement);
        });
    }

    updatePlayers() {
        this.playersContainer.innerHTML = '';
        
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        const botPlayers = this.gameState.players.filter(p => p.isBot);
        
        botPlayers.forEach((player, index) => {
            const playerElement = this.createPlayerElement(player, index);
            this.playersContainer.appendChild(playerElement);
        });
    }

    createPlayerElement(player, index) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-seat';
        
        if (this.gameState.currentPlayerIndex === this.gameState.players.indexOf(player)) {
            playerDiv.classList.add('active');
        }
        
        if (player.hasFolded) {
            playerDiv.classList.add('folded');
        }

        playerDiv.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-stack">$${player.stack}</div>
            ${player.currentBet > 0 ? `<div class="player-bet">Bet: $${player.currentBet}</div>` : ''}
            ${player.isAllIn ? '<div class="player-status">ALL IN</div>' : ''}
        `;

        return playerDiv;
    }

    updatePlayerInfo() {
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        if (humanPlayer) {
            this.playerStackDisplay.textContent = `$${humanPlayer.stack}`;
            this.updatePlayerHand(humanPlayer.holeCards);
        }
    }

    updatePlayerHand(cards) {
        this.playerHand.innerHTML = '';
        
        if (cards && cards.length > 0) {
            cards.forEach((card, index) => {
                const cardElement = this.createCardElement(card);
                cardElement.style.animationDelay = `${index * 0.1}s`;
                cardElement.classList.add('card-dealing');
                this.playerHand.appendChild(cardElement);
            });
        }
    }

    createCardElement(card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
        cardDiv.classList.add(isRed ? 'red' : 'black');

        const suitSymbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };

        // Add value property if missing (for pre-flop evaluation)
        if (!card.value && card.rank) {
            card.value = this.getCardValue(card.rank);
        }

        cardDiv.innerHTML = `
            <div class="card-rank">${card.rank}</div>
            <div class="card-suit">${suitSymbols[card.suit]}</div>
        `;

        return cardDiv;
    }

    getCardValue(rank) {
        if (rank === 'A') return 14;
        if (rank === 'K') return 13;
        if (rank === 'Q') return 12;
        if (rank === 'J') return 11;
        return parseInt(rank);
    }

    updateBettingControls() {
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        const isPlayerTurn = humanPlayer && 
            this.gameState.currentPlayerIndex === this.gameState.players.indexOf(humanPlayer);
        
        console.log('Permanent betting panel check:', {
            hasHumanPlayer: !!humanPlayer,
            isPlayerTurn: isPlayerTurn,
            hasFolded: humanPlayer?.hasFolded,
            isAllIn: humanPlayer?.isAllIn,
            currentPlayerIndex: this.gameState.currentPlayerIndex,
            humanPlayerIndex: humanPlayer ? this.gameState.players.indexOf(humanPlayer) : -1,
            gamePhase: this.gameState.gamePhase
        });
        
        // Always show permanent betting panel if there's a human player who hasn't folded or gone all-in
        if (humanPlayer && !humanPlayer.hasFolded && !humanPlayer.isAllIn) {
            this.permanentBettingPanel.style.display = 'block';
            
            if (isPlayerTurn) {
                console.log('Enabling permanent betting panel - player turn');
                this.permanentBettingPanel.classList.remove('disabled');
                this.permanentBettingPanel.classList.add('enabled');
                this.updatePermanentBettingOptions(humanPlayer);
            } else {
                console.log('Disabling permanent betting panel - not player turn');
                this.permanentBettingPanel.classList.remove('enabled');
                this.permanentBettingPanel.classList.add('disabled');
            }
        } else {
            console.log('Hiding permanent betting panel:', {
                reason: !humanPlayer ? 'no human player' :
                       humanPlayer?.hasFolded ? 'player folded' : 
                       humanPlayer?.isAllIn ? 'player all in' : 'unknown'
            });
            this.permanentBettingPanel.style.display = 'none';
        }
        
        if (!isPlayerTurn) {
            this.clearTimer();
        }
    }

    updateBettingOptions(player) {
        if (!player || !this.gameState) {
            console.log('Cannot update betting options - missing player or game state');
            return;
        }

        const callAmount = this.gameState.currentBet - player.currentBet;
        const canCheck = callAmount === 0;
        const maxBet = player.stack;
        const minRaise = Math.max(this.gameState.bigBlind, callAmount + this.gameState.bigBlind);

        console.log('Updating betting options:', {
            callAmount,
            canCheck,
            maxBet,
            minRaise,
            currentBet: this.gameState.currentBet,
            playerCurrentBet: player.currentBet
        });

        if (this.betSlider && this.betInput && this.checkCallBtn && this.raiseBtn) {
            // Update slider and input ranges
            this.betSlider.max = maxBet;
            this.betInput.max = maxBet;
            this.betSlider.min = minRaise;
            this.betInput.min = minRaise;
            
            if (parseInt(this.betInput.value) < minRaise) {
                this.betInput.value = minRaise;
                this.betSlider.value = minRaise;
            }

            // Update button text
            this.checkCallBtn.textContent = canCheck ? 'Check' : `Call $${callAmount}`;
            this.raiseBtn.textContent = `Raise $${this.betInput.value}`;

            // Enable/disable buttons
            this.checkCallBtn.disabled = false;
            this.raiseBtn.disabled = maxBet < minRaise;
            
            if (callAmount >= player.stack) {
                this.checkCallBtn.textContent = 'All In';
            }

            console.log('Betting buttons updated:', {
                checkCallText: this.checkCallBtn.textContent,
                raiseText: this.raiseBtn.textContent,
                checkCallDisabled: this.checkCallBtn.disabled,
                raiseDisabled: this.raiseBtn.disabled
            });
        }
    }

    updatePermanentBettingOptions(player) {
        if (!player || !this.gameState) {
            console.log('Cannot update permanent betting options - missing player or game state');
            return;
        }

        const callAmount = this.gameState.currentBet - player.currentBet;
        const canCheck = callAmount === 0;
        const maxBet = player.stack;
        const minRaise = Math.max(this.gameState.bigBlind, callAmount + this.gameState.bigBlind);

        console.log('Updating permanent betting options:', {
            callAmount,
            canCheck,
            maxBet,
            minRaise,
            currentBet: this.gameState.currentBet,
            playerCurrentBet: player.currentBet
        });

        // Update slider and input ranges
        this.permanentBetSlider.max = maxBet;
        this.permanentBetInput.max = maxBet;
        this.permanentBetSlider.min = minRaise;
        this.permanentBetInput.min = minRaise;
        
        if (parseInt(this.permanentBetInput.value) < minRaise) {
            this.permanentBetInput.value = minRaise;
            this.permanentBetSlider.value = minRaise;
        }

        // Update button text
        this.permanentCallBtn.textContent = canCheck ? 'Check' : `Call $${callAmount}`;
        this.permanentRaiseBtn.textContent = `Raise $${this.permanentBetInput.value}`;

        // Enable/disable buttons
        this.permanentCallBtn.disabled = false;
        this.permanentRaiseBtn.disabled = maxBet < minRaise;
        
        if (callAmount >= player.stack) {
            this.permanentCallBtn.textContent = 'All In';
        }

        console.log('Permanent betting buttons updated:', {
            callText: this.permanentCallBtn.textContent,
            raiseText: this.permanentRaiseBtn.textContent,
            callDisabled: this.permanentCallBtn.disabled,
            raiseDisabled: this.permanentRaiseBtn.disabled
        });
    }

    showHandResults(results) {
        let resultsHTML = '';
        
        results.winners.forEach(winner => {
            resultsHTML += `
                <div class="hand-result winner">
                    <strong>${winner.name}</strong> wins $${winner.winnings}!
                </div>
            `;
        });

        if (results.allHands) {
            resultsHTML += '<hr><h3>All Hands:</h3>';
            results.allHands.forEach(playerHand => {
                const isWinner = results.winners.some(w => w.name === playerHand.player.name);
                resultsHTML += `
                    <div class="hand-result ${isWinner ? 'winner' : ''}">
                        <strong>${playerHand.player.name}:</strong> ${playerHand.hand.name}
                        ${this.formatCards(playerHand.hand.cards)}
                    </div>
                `;
            });
        }

        this.handResults.innerHTML = resultsHTML;
        this.handResultModal.style.display = 'flex';
    }

    formatCards(cards) {
        return cards.map(card => {
            const suitSymbols = {
                'hearts': '♥',
                'diamonds': '♦',
                'clubs': '♣',
                'spades': '♠'
            };
            return `${card.rank}${suitSymbols[card.suit]}`;
        }).join(' ');
    }

    updateHandStrength() {
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        if (!humanPlayer || !humanPlayer.holeCards || humanPlayer.holeCards.length === 0) {
            this.currentHandDisplay.textContent = 'Your Hand: --';
            return;
        }

        const holeCards = humanPlayer.holeCards;
        const communityCards = this.gameState.communityCards || [];
        
        if (communityCards.length === 0) {
            // Pre-flop - just show hole cards
            const handStrength = this.evaluatePreFlop(holeCards);
            this.currentHandDisplay.textContent = `Your Hand: ${handStrength}`;
        } else {
            // Post-flop - evaluate best hand
            const bestHand = this.evaluateBestHand(holeCards, communityCards);
            this.currentHandDisplay.textContent = `Your Hand: ${bestHand}`;
        }
    }

    evaluatePreFlop(holeCards) {
        if (holeCards.length !== 2) return 'Unknown';
        
        const [card1, card2] = holeCards;
        const isPair = card1.value === card2.value;
        const isSuited = card1.suit === card2.suit;
        const highCard = Math.max(card1.value, card2.value);
        const lowCard = Math.min(card1.value, card2.value);
        
        if (isPair) {
            const rankName = this.getCardRankName(highCard);
            return `Pair of ${rankName}s`;
        } else {
            const highRankName = this.getCardRankName(highCard);
            const lowRankName = this.getCardRankName(lowCard);
            const suitedText = isSuited ? ' suited' : '';
            return `${highRankName}-${lowRankName}${suitedText}`;
        }
    }

    evaluateBestHand(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];
        const bestHand = this.getBestFiveCardHand(allCards);
        return bestHand.name;
    }

    getBestFiveCardHand(cards) {
        if (cards.length < 5) {
            return { name: 'Incomplete Hand', rank: 0 };
        }

        const combinations = this.getCombinations(cards, 5);
        let bestHand = null;
        let bestRank = 0;

        for (let combo of combinations) {
            const handAnalysis = this.analyzeHand(combo);
            if (handAnalysis.rank > bestRank) {
                bestHand = handAnalysis;
                bestRank = handAnalysis.rank;
            }
        }

        return bestHand || { name: 'High Card', rank: 1 };
    }

    getCombinations(arr, k) {
        if (k === 1) return arr.map(x => [x]);
        if (k === arr.length) return [arr];
        
        const combinations = [];
        for (let i = 0; i <= arr.length - k; i++) {
            const head = arr[i];
            const tailCombos = this.getCombinations(arr.slice(i + 1), k - 1);
            for (let combo of tailCombos) {
                combinations.push([head, ...combo]);
            }
        }
        return combinations;
    }

    analyzeHand(cards) {
        const sortedCards = [...cards].sort((a, b) => b.value - a.value);
        const ranks = sortedCards.map(card => card.value);
        const suits = sortedCards.map(card => card.suit);

        // Count rank frequencies
        const rankCounts = {};
        ranks.forEach(rank => {
            rankCounts[rank] = (rankCounts[rank] || 0) + 1;
        });

        const counts = Object.values(rankCounts).sort((a, b) => b - a);
        const countKeys = Object.keys(rankCounts).map(k => parseInt(k)).sort((a, b) => {
            if (rankCounts[b] !== rankCounts[a]) {
                return rankCounts[b] - rankCounts[a];
            }
            return b - a;
        });

        const isFlush = suits.every(suit => suit === suits[0]);
        const isStraight = this.isStraight(ranks);
        const isRoyalStraight = ranks.includes(14) && ranks.includes(13) && 
                               ranks.includes(12) && ranks.includes(11) && ranks.includes(10);

        // Determine hand type
        if (isFlush && isRoyalStraight) {
            return { rank: 10, name: 'Royal Flush' };
        }

        if (isFlush && isStraight) {
            return { rank: 9, name: 'Straight Flush' };
        }

        if (counts[0] === 4) {
            const quadRank = this.getCardRankName(countKeys[0]);
            return { rank: 8, name: `Four ${quadRank}s` };
        }

        if (counts[0] === 3 && counts[1] === 2) {
            const tripRank = this.getCardRankName(countKeys[0]);
            const pairRank = this.getCardRankName(countKeys[1]);
            return { rank: 7, name: `${tripRank}s full of ${pairRank}s` };
        }

        if (isFlush) {
            const highCard = this.getCardRankName(Math.max(...ranks));
            return { rank: 6, name: `${highCard}-high Flush` };
        }

        if (isStraight) {
            const highCard = this.getCardRankName(Math.max(...ranks));
            return { rank: 5, name: `${highCard}-high Straight` };
        }

        if (counts[0] === 3) {
            const tripRank = this.getCardRankName(countKeys[0]);
            return { rank: 4, name: `Three ${tripRank}s` };
        }

        if (counts[0] === 2 && counts[1] === 2) {
            const highPair = this.getCardRankName(Math.max(countKeys[0], countKeys[1]));
            const lowPair = this.getCardRankName(Math.min(countKeys[0], countKeys[1]));
            return { rank: 3, name: `${highPair}s and ${lowPair}s` };
        }

        if (counts[0] === 2) {
            const pairRank = this.getCardRankName(countKeys[0]);
            return { rank: 2, name: `Pair of ${pairRank}s` };
        }

        const highCard = this.getCardRankName(Math.max(...ranks));
        return { rank: 1, name: `${highCard} High` };
    }

    isStraight(ranks) {
        const sortedRanks = [...new Set(ranks)].sort((a, b) => a - b);
        if (sortedRanks.length < 5) return false;

        // Check for regular straight
        for (let i = 0; i <= sortedRanks.length - 5; i++) {
            let consecutive = true;
            for (let j = 1; j < 5; j++) {
                if (sortedRanks[i + j] !== sortedRanks[i] + j) {
                    consecutive = false;
                    break;
                }
            }
            if (consecutive) return true;
        }

        // Check for A-2-3-4-5 straight (wheel)
        if (sortedRanks.includes(14) && sortedRanks.includes(2) && 
            sortedRanks.includes(3) && sortedRanks.includes(4) && sortedRanks.includes(5)) {
            return true;
        }

        return false;
    }

    getCardRankName(value) {
        const rankNames = {
            14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack',
            10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven',
            6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two'
        };
        return rankNames[value] || value.toString();
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `game-message ${type}`;
        messageDiv.textContent = message;
        
        this.gameMessages.appendChild(messageDiv);
        this.gameMessages.scrollTop = this.gameMessages.scrollHeight;

        // Remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    startTimer(timeLimit) {
        if (this.isPaused) return; // Don't start timer if paused
        
        this.clearTimer();
        let timeLeft = timeLimit / 1000; // Convert to seconds
        
        console.log('Starting timer:', timeLeft, 'seconds');
        
        // Show timer overlay
        this.timerOverlay.style.display = 'block';
        
        const updateTimer = () => {
            if (this.isPaused) return; // Don't update timer if paused
            
            this.timerCountdownMain.textContent = Math.ceil(timeLeft);
            
            // Update timer styling based on time left
            const timerDisplay = this.timerOverlay.querySelector('.timer-display-main');
            if (timeLeft <= 3) {
                timerDisplay.style.background = 'linear-gradient(145deg, rgba(220, 20, 60, 0.95), rgba(178, 34, 34, 0.95))';
                timerDisplay.style.borderColor = '#dc143c';
            } else {
                timerDisplay.style.background = 'linear-gradient(145deg, rgba(255, 69, 0, 0.95), rgba(255, 140, 0, 0.95))';
                timerDisplay.style.borderColor = '#ff4500';
            }
            
            timeLeft -= 1;
            
            if (timeLeft < 0) {
                this.clearTimer();
                // Timer expired - fold automatically happens on server side
            }
        };
        
        updateTimer(); // Initial update
        this.timerInterval = setInterval(updateTimer, 1000);
    }

    clearTimer() {
        console.log('Clearing timer display');
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Hide both timer displays
        if (this.timerDisplay) {
            this.timerDisplay.style.display = 'none';
            // Reset timer display colors
            this.timerDisplay.style.background = 'rgba(255, 69, 0, 0.2)';
            this.timerDisplay.style.borderColor = 'rgba(255, 69, 0, 0.6)';
            this.timerDisplay.style.color = '#ff4500';
        }
        
        if (this.timerOverlay) {
            this.timerOverlay.style.display = 'none';
            // Reset overlay colors
            const mainDisplay = this.timerOverlay.querySelector('.timer-display-main');
            if (mainDisplay) {
                mainDisplay.style.background = 'linear-gradient(145deg, rgba(255, 69, 0, 0.95), rgba(255, 140, 0, 0.95))';
                mainDisplay.style.borderColor = '#ff4500';
                mainDisplay.style.animation = 'timerPulse 1s infinite';
            }
        }
    }

    showBettingControls() {
        const humanPlayer = this.gameState?.players?.find(p => !p.isBot);
        if (humanPlayer && !humanPlayer.hasFolded && !humanPlayer.isAllIn) {
            console.log('Force showing betting controls');
            this.bettingControls.style.display = 'block';
            this.updateBettingOptions(humanPlayer);
        }
    }

    checkAutoActions() {
        const humanPlayer = this.gameState?.players?.find(p => !p.isBot);
        if (!humanPlayer || humanPlayer.hasFolded || humanPlayer.isAllIn) return;

        const callAmount = this.gameState.currentBet - humanPlayer.currentBet;
        const canCheck = callAmount === 0;

        // Auto fold
        if (this.autoFold.checked) {
            console.log('Auto fold activated');
            setTimeout(() => this.playerAction('fold'), 1000);
            this.clearAutoActions();
            return;
        }

        // Auto check/call
        if (this.autoCheckCall.checked) {
            console.log('Auto check/call activated');
            setTimeout(() => this.playerAction('call'), 1000);
            this.clearAutoActions();
            return;
        }

        // Auto check/fold
        if (this.autoCheckFold.checked) {
            if (canCheck) {
                console.log('Auto check activated');
                setTimeout(() => this.playerAction('check'), 1000);
            } else {
                console.log('Auto fold activated (cannot check)');
                setTimeout(() => this.playerAction('fold'), 1000);
            }
            this.clearAutoActions();
            return;
        }
    }

    clearAutoActions() {
        this.autoFold.checked = false;
        this.autoCheckCall.checked = false;
        this.autoCheckFold.checked = false;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.socket.emit('togglePause', this.isPaused);
        
        if (this.isPaused) {
            this.pauseBtn.textContent = '▶️ Resume';
            this.pauseBtn.classList.add('paused');
            this.gamePausedOverlay.style.display = 'flex';
            this.clearTimer();
        } else {
            this.pauseBtn.textContent = '⏸️ Pause';
            this.pauseBtn.classList.remove('paused');
            this.gamePausedOverlay.style.display = 'none';
        }
    }

    forceBettingControlsVisible() {
        if (!this.gameState) return;
        
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        if (humanPlayer && !humanPlayer.hasFolded && !humanPlayer.isAllIn) {
            console.log('Forcing betting controls to be visible');
            this.bettingControls.style.display = 'flex';
            this.bettingControls.style.visibility = 'visible';
            this.bettingControls.style.opacity = '1';
            this.bettingControls.style.position = 'fixed';
            this.bettingControls.style.left = '15px';
            this.bettingControls.style.top = '300px';
            this.bettingControls.style.zIndex = '9999';
            
            // Make sure all buttons are visible
            const buttons = this.bettingControls.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.display = 'block';
                button.style.visibility = 'visible';
            });
        }
    }

    activatePermanentBettingPanel() {
        if (!this.gameState) return;
        
        const humanPlayer = this.gameState.players.find(p => !p.isBot);
        if (humanPlayer && !humanPlayer.hasFolded && !humanPlayer.isAllIn) {
            console.log('🎯 ACTIVATING permanent betting panel - timer started, it\'s our turn!');
            
            // Make sure panel is visible
            this.permanentBettingPanel.style.display = 'block';
            
            // Remove disabled class and add enabled class
            this.permanentBettingPanel.classList.remove('disabled');
            this.permanentBettingPanel.classList.add('enabled');
            
            // Update betting options for the player
            this.updatePermanentBettingOptions(humanPlayer);
            
            // Force the styling to ensure it lights up
            this.permanentBettingPanel.style.borderColor = '#FFD700';
            this.permanentBettingPanel.style.boxShadow = '0 5px 20px rgba(255, 215, 0, 0.5)';
            this.permanentBettingPanel.style.opacity = '1';
            this.permanentBettingPanel.style.filter = 'none';
            this.permanentBettingPanel.style.pointerEvents = 'all';
            
            console.log('✅ Permanent betting panel should now be ACTIVE and GOLDEN!');
        }
    }

    deactivatePermanentBettingPanel() {
        console.log('🔒 DEACTIVATING permanent betting panel - turn ended');
        
        // Add disabled class and remove enabled class
        this.permanentBettingPanel.classList.remove('enabled');
        this.permanentBettingPanel.classList.add('disabled');
        
        // Force the styling to ensure it grays out
        this.permanentBettingPanel.style.opacity = '0.4';
        this.permanentBettingPanel.style.filter = 'grayscale(100%)';
        this.permanentBettingPanel.style.pointerEvents = 'none';
        this.permanentBettingPanel.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        this.permanentBettingPanel.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.5)';
        
        console.log('🔒 Permanent betting panel is now DISABLED and GRAYED OUT');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PokerClient();
}); 