class HandEvaluator {
  static HAND_RANKINGS = {
    'HIGH_CARD': 1,
    'PAIR': 2,
    'TWO_PAIR': 3,
    'THREE_OF_A_KIND': 4,
    'STRAIGHT': 5,
    'FLUSH': 6,
    'FULL_HOUSE': 7,
    'FOUR_OF_A_KIND': 8,
    'STRAIGHT_FLUSH': 9,
    'ROYAL_FLUSH': 10
  };

  static evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    return this.getBestFiveCardHand(allCards);
  }

  static getBestFiveCardHand(cards) {
    // Generate all possible 5-card combinations
    const combinations = this.getCombinations(cards, 5);
    let bestHand = null;
    let bestRank = 0;

    for (let combo of combinations) {
      const analysis = this.analyzeHand(combo);
      if (analysis.rank > bestRank || 
          (analysis.rank === bestRank && this.compareKickers(analysis, bestHand) > 0)) {
        bestHand = analysis;
        bestRank = analysis.rank;
      }
    }

    return bestHand;
  }

  static getCombinations(arr, k) {
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

  static analyzeHand(cards) {
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
      return {
        rank: this.HAND_RANKINGS.ROYAL_FLUSH,
        name: 'Royal Flush',
        cards: sortedCards,
        kickers: []
      };
    }

    if (isFlush && isStraight) {
      return {
        rank: this.HAND_RANKINGS.STRAIGHT_FLUSH,
        name: 'Straight Flush',
        cards: sortedCards,
        kickers: [Math.max(...ranks)]
      };
    }

    if (counts[0] === 4) {
      return {
        rank: this.HAND_RANKINGS.FOUR_OF_A_KIND,
        name: 'Four of a Kind',
        cards: sortedCards,
        kickers: countKeys
      };
    }

    if (counts[0] === 3 && counts[1] === 2) {
      return {
        rank: this.HAND_RANKINGS.FULL_HOUSE,
        name: 'Full House',
        cards: sortedCards,
        kickers: countKeys
      };
    }

    if (isFlush) {
      return {
        rank: this.HAND_RANKINGS.FLUSH,
        name: 'Flush',
        cards: sortedCards,
        kickers: ranks
      };
    }

    if (isStraight) {
      return {
        rank: this.HAND_RANKINGS.STRAIGHT,
        name: 'Straight',
        cards: sortedCards,
        kickers: [Math.max(...ranks)]
      };
    }

    if (counts[0] === 3) {
      return {
        rank: this.HAND_RANKINGS.THREE_OF_A_KIND,
        name: 'Three of a Kind',
        cards: sortedCards,
        kickers: countKeys
      };
    }

    if (counts[0] === 2 && counts[1] === 2) {
      return {
        rank: this.HAND_RANKINGS.TWO_PAIR,
        name: 'Two Pair',
        cards: sortedCards,
        kickers: countKeys
      };
    }

    if (counts[0] === 2) {
      return {
        rank: this.HAND_RANKINGS.PAIR,
        name: 'Pair',
        cards: sortedCards,
        kickers: countKeys
      };
    }

    return {
      rank: this.HAND_RANKINGS.HIGH_CARD,
      name: 'High Card',
      cards: sortedCards,
      kickers: ranks
    };
  }

  static isStraight(ranks) {
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

  static compareKickers(hand1, hand2) {
    if (!hand2) return 1;
    
    for (let i = 0; i < Math.min(hand1.kickers.length, hand2.kickers.length); i++) {
      if (hand1.kickers[i] > hand2.kickers[i]) return 1;
      if (hand1.kickers[i] < hand2.kickers[i]) return -1;
    }
    return 0;
  }

  static compareHands(hand1, hand2) {
    if (hand1.rank > hand2.rank) return 1;
    if (hand1.rank < hand2.rank) return -1;
    return this.compareKickers(hand1, hand2);
  }
}

module.exports = HandEvaluator; 
