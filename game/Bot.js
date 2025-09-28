const HandEvaluator = require('./HandEvaluator');

class Bot {
  constructor(name, difficulty = 'medium') {
    this.name = name;
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
    this.stack = 1000;
    this.holeCards = [];
    this.isBot = true;
    this.personalityTraits = this.generatePersonality();
  }

  generatePersonality() {
    const personalities = {
      easy: {
        aggression: 0.2,
        bluffFrequency: 0.1,
        tightness: 0.8,
        callThreshold: 0.3
      },
      medium: {
        aggression: 0.4,
        bluffFrequency: 0.2,
        tightness: 0.6,
        callThreshold: 0.5
      },
      hard: {
        aggression: 0.6,
        bluffFrequency: 0.3,
        tightness: 0.4,
        callThreshold: 0.7
      }
    };

    return personalities[this.difficulty] || personalities.medium;
  }

  makeDecision(gameState, potSize, currentBet, minimumRaise) {
    const handStrength = this.evaluateHandStrength(gameState);
    const potOdds = this.calculatePotOdds(potSize, currentBet);
    const position = this.getPosition(gameState);
    
    // Add some randomness based on personality
    const randomFactor = Math.random();
    const shouldBluff = randomFactor < this.personalityTraits.bluffFrequency;
    const isAggressive = randomFactor < this.personalityTraits.aggression;

    // IMPORTANT: Never fold when you can check for free!
    if (currentBet === 0) {
      // No bet to call - we can check for free
      if (handStrength >= 0.8 || shouldBluff) {
        // Strong hand or bluffing - be aggressive
        if (isAggressive && this.stack > minimumRaise * 2) {
          return {
            action: 'raise',
            amount: Math.min(
              Math.floor(potSize * (0.5 + Math.random() * 0.5)),
              this.stack
            )
          };
        } else {
          return { action: 'check' };
        }
      } else {
        // Any hand - just check since it's free
        return { action: 'check' };
      }
    }

    // There is a bet to call - normal decision logic
    if (handStrength >= 0.8 || shouldBluff) {
      // Strong hand or bluffing - be aggressive
      if (isAggressive && this.stack > minimumRaise * 2) {
        return {
          action: 'raise',
          amount: Math.min(
            Math.floor(potSize * (0.5 + Math.random() * 0.5)),
            this.stack
          )
        };
      } else {
        return { action: 'call' };
      }
    } else if (handStrength >= 0.5) {
      // Decent hand
      if (potOdds > 0.3) {
        return { action: 'call' };
      } else {
        return { action: 'fold' };
      }
    } else if (handStrength >= this.personalityTraits.callThreshold) {
      // Marginal hand
      if (potOdds > 0.5) {
        return { action: 'call' };
      } else {
        return { action: 'fold' };
      }
    } else {
      // Weak hand - fold when there's a bet
      return { action: 'fold' };
    }
  }

  evaluateHandStrength(gameState) {
    if (!this.holeCards || this.holeCards.length === 0) {
      return 0;
    }

    const communityCards = gameState.communityCards || [];
    
    // Pre-flop evaluation
    if (communityCards.length === 0) {
      return this.evaluatePreFlop();
    }

    // Post-flop evaluation using hand evaluator
    try {
      const handResult = HandEvaluator.evaluateHand(this.holeCards, communityCards);
      
      // Convert hand rank to strength (0-1 scale)
      const maxRank = HandEvaluator.HAND_RANKINGS.ROYAL_FLUSH;
      const baseStrength = handResult.rank / maxRank;
      
      // Adjust based on kickers and community cards
      let adjustedStrength = baseStrength;
      
      if (handResult.rank <= HandEvaluator.HAND_RANKINGS.PAIR) {
        // Lower hands are more dependent on kickers
        const highCard = Math.max(...this.holeCards.map(c => c.value));
        adjustedStrength += (highCard / 14) * 0.2;
      }

      return Math.min(adjustedStrength, 1);
    } catch (error) {
      console.error('Error evaluating hand:', error);
      return 0.3; // Default conservative strength
    }
  }

  evaluatePreFlop() {
    if (!this.holeCards || this.holeCards.length !== 2) return 0;

    const [card1, card2] = this.holeCards;
    const isPair = card1.value === card2.value;
    const isSuited = card1.suit === card2.suit;
    const highCard = Math.max(card1.value, card2.value);
    const lowCard = Math.min(card1.value, card2.value);
    const gap = highCard - lowCard;

    let strength = 0;

    // Pairs
    if (isPair) {
      if (highCard >= 10) strength = 0.8 + (highCard - 10) * 0.05; // High pairs
      else if (highCard >= 7) strength = 0.6 + (highCard - 7) * 0.05; // Medium pairs
      else strength = 0.4 + (highCard - 2) * 0.02; // Low pairs
    } else {
      // High cards
      if (highCard >= 12) {
        strength = 0.5 + (highCard - 12) * 0.1;
        if (lowCard >= 10) strength += 0.2; // Both cards high
      } else if (highCard >= 10) {
        strength = 0.3 + (highCard - 10) * 0.1;
      } else {
        strength = 0.1 + (highCard - 2) * 0.02;
      }

      // Suited bonus
      if (isSuited) {
        strength += 0.1;
      }

      // Connected cards bonus
      if (gap <= 1) {
        strength += 0.05;
      } else if (gap <= 3) {
        strength += 0.02;
      }
    }

    return Math.min(strength, 1);
  }

  calculatePotOdds(potSize, currentBet) {
    if (currentBet === 0) return 1;
    return potSize / (potSize + currentBet);
  }

  getPosition(gameState) {
    // Simplified position calculation
    const playerIndex = gameState.players.findIndex(p => p.name === this.name);
    const totalPlayers = gameState.players.length;
    
    if (playerIndex === totalPlayers - 1 || playerIndex === totalPlayers - 2) {
      return 'late'; // Button and cutoff
    } else if (playerIndex <= 2) {
      return 'early'; // Blinds and UTG
    } else {
      return 'middle';
    }
  }

  setHoleCards(cards) {
    this.holeCards = cards;
  }

  bet(amount) {
    const betAmount = Math.min(amount, this.stack);
    this.stack -= betAmount;
    return betAmount;
  }

  addChips(amount) {
    this.stack += amount;
  }

  canBet(amount) {
    return this.stack >= amount;
  }

  isAllIn() {
    return this.stack === 0;
  }

  reset() {
    this.holeCards = [];
  }
}

module.exports = Bot; 
