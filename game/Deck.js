class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    for (let suit of suits) {
      for (let rank of ranks) {
        this.cards.push({
          suit,
          rank,
          value: this.getCardValue(rank)
        });
      }
    }
    
    this.shuffle();
  }

  getCardValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  dealCard() {
    if (this.cards.length === 0) {
      throw new Error('Cannot deal from empty deck');
    }
    return this.cards.pop();
  }

  dealHand(numCards = 2) {
    const hand = [];
    for (let i = 0; i < numCards; i++) {
      hand.push(this.dealCard());
    }
    return hand;
  }

  getRemainingCards() {
    return this.cards.length;
  }
}

module.exports = Deck; 