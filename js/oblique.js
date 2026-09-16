/**
 * Song Analyzer - Oblique Strategies Deck Engine (js/oblique.js)
 * 100% Offline Creative Provocation Engine (Brian Eno & Peter Schmidt)
 * 
 * Features:
 * - Full deck of 133 Oblique Strategies cards stored locally
 * - Non-repeating randomized draw: guaranteed no repeats until all 133 cards are drawn
 * - Reshuffles only after all 133 cards have been drawn, or on manual reset
 * - Persistent state tracking in localStorage: drawn cards, remaining pool, and cycle count
 */

(function (window) {
  "use strict";

  const OBLIQUE_CARDS = [
  "(Organic) machinery",
  "A line has two sides",
  "A very small object. Its center",
  "Abandon normal instruments",
  "Accept advice",
  "Accretion",
  "Allow an easement (an easement is the abandonment of a stricture)",
  "Always first steps",
  "Always give yourself credit for having more than personality",
  "Are there sections? Consider transitions",
  "Ask people to work against their better judgement",
  "Ask your body",
  "Assemble some of the elements in a group and treat the group",
  "Balance the consistency principle with the inconsistency principle",
  "Be dirty",
  "Be extravagant",
  "Be less critical more often",
  "Breathe more deeply",
  "Bridges -build -burn",
  "Cascades",
  "Change instrument roles",
  "Change nothing and continue with immaculate consistency",
  "Children -speaking -singing",
  "Cluster analysis",
  "Consider different fading systems",
  "Consult other sources -promising -unpromising",
  "Convert a melodic element into a rhythmic element",
  "Courage!",
  "Cut a vital connection",
  "Decorate, decorate",
  "Define an area as `safe' and use it as an anchor",
  "Destroy -nothing -the most important thing",
  "Discard an axiom",
  "Disciplined self-indulgence",
  "Disconnect from desire",
  "Discover the recipes you are using and abandon them",
  "Distorting time",
  "Do nothing for as long as possible",
  "Do something boring",
  "Do the washing up",
  "Do the words need changing?",
  "Do we need holes?",
  "Don't be afraid of things because they're easy to do",
  "Don't be frightened of cliches",
  "Don't be frightened to display your talents",
  "Don't break the silence",
  "Don't stress one thing more than another",
  "Emphasize differences",
  "Emphasize repetitions",
  "Emphasize the flaws",
  "Faced with a choice, do both",
  "Feed the recording back out of the medium",
  "Fill every beat with something",
  "From nothing to more than nothing",
  "Get your neck massaged",
  "Ghost echoes",
  "Give the game away",
  "Give way to your worst impulse",
  "Go outside. Shut the door.",
  "Go slowly all the way round the outside",
  "Go to an extreme, move back to a more comfortable place",
  "Honor thy error as a hidden intention",
  "How would you have done it?",
  "Humanize something free of error",
  "Idiot glee (?)",
  "Imagine the piece as a set of disconnected events",
  "In total darkness, or in a very large room, very quietly",
  "Infinitesimal gradations",
  "Intentions -nobility of -humility of -credibility of",
  "Into the impossible",
  "Is it finished?",
  "Is the intonation correct?",
  "Is there something missing?",
  "It is quite possible (after all)",
  "Just carry on",
  "Left channel, right channel, centre channel",
  "Listen to the quiet voice",
  "Look at the order in which you do things",
  "Look closely at the most embarrassing details and amplify them",
  "Lost in useless territory",
  "Lowest common denominator",
  "Make a blank valuable by putting it in an exquisite frame",
  "Make a sudden, destructive unpredictable action; incorporate",
  "Make an exhaustive list of everything you might do and do the last thing on the list",
  "Mechanicalize something idiosyncratic",
  "Mute and continue",
  "Not building a wall but making a brick",
  "Once the search is in progress, something will be found",
  "Only a part, not the whole",
  "Only one element of each kind",
  "Overtly resist change",
  "Put in earplugs",
  "Question the heroic approach",
  "Remember those quiet evenings",
  "Remove ambiguities and convert to specifics",
  "Repetition is a form of change",
  "Retrace your steps",
  "Revaluation (a warm feeling)",
  "Reverse",
  "Short circuit (If eating peas improves virility, shovel them into your pants)",
  "Simple subtraction",
  "Simply a matter of work",
  "Spectrum analysis",
  "State the problem in words as clearly as possible",
  "Take a break",
  "Take away the elements in order of apparent non-importance",
  "Tape your mouth",
  "The inconsistency principle",
  "The most important thing is the thing most easily forgotten",
  "The tape is now the music",
  "Think of the radio",
  "Tidy up",
  "Towards the insignificant",
  "Trust in the you of now",
  "Turn it upside down",
  "Twist the spine",
  "Use `unqualified' people",
  "Use an old idea",
  "Use an unacceptable color",
  "Use fewer notes",
  "Use filters",
  "Water",
  "What are the sections sections of? Imagine a caterpillar moving",
  "What are you really thinking about just now?",
  "What is the reality of the situation?",
  "What mistakes did you make last time?",
  "What would your closest friend do?",
  "What wouldn't you do?",
  "Work at a different speed",
  "Would anybody want it?",
  "You can only make one dot at a time",
  "You don't have to be ashamed of using your own ideas",
  "[blank white card]"
];

  class ObliqueDeck {
    constructor() {
      this.cards = OBLIQUE_CARDS;
      this.storageKey = "song_analyzer_oblique_state";
      this.state = this.loadState();
    }

    loadState() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.remaining) && Array.isArray(parsed.drawn)) {
            // Check that remaining + drawn match card count
            if (parsed.remaining.length + parsed.drawn.length === this.cards.length) {
              return parsed;
            }
          }
        }
      } catch (e) {
        console.warn("Could not load Oblique state from localStorage:", e);
      }

      return this.resetDeck();
    }

    saveState() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
      } catch (e) {
        console.warn("Could not save Oblique state to localStorage:", e);
      }
    }

    resetDeck() {
      const allIndices = Array.from({ length: this.cards.length }, (_, i) => i);
      // Fisher-Yates shuffle
      for (let i = allIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
      }

      const prevCycles = (this.state && typeof this.state.cyclesCompleted === "number") ? this.state.cyclesCompleted : 0;
      this.state = {
        remaining: allIndices,
        drawn: [],
        currentCard: null,
        cyclesCompleted: prevCycles + (this.state && this.state.drawn && this.state.drawn.length > 0 ? 1 : 0)
      };
      this.saveState();
      return this.state;
    }

    drawCard() {
      if (!this.state.remaining || this.state.remaining.length === 0) {
        this.resetDeck();
      }

      const cardIndex = this.state.remaining.pop();
      this.state.drawn.push(cardIndex);
      const cardText = this.cards[cardIndex];

      this.state.currentCard = {
        index: cardIndex,
        text: cardText,
        drawnNumber: this.state.drawn.length,
        totalCards: this.cards.length,
        cycle: (this.state.cyclesCompleted || 0) + 1,
        isJustReshuffled: this.state.drawn.length === 1
      };

      this.saveState();
      return this.state.currentCard;
    }

    getCurrentCard() {
      if (this.state && this.state.currentCard) {
        return this.state.currentCard;
      }
      return null;
    }

    getStats() {
      const drawnCount = (this.state && this.state.drawn) ? this.state.drawn.length : 0;
      const remainingCount = (this.state && this.state.remaining) ? this.state.remaining.length : 0;
      const total = this.cards.length;
      const cycle = ((this.state && this.state.cyclesCompleted) || 0) + 1;
      return {
        drawnCount,
        remainingCount,
        total,
        cycle,
        percentDrawn: Math.round((drawnCount / total) * 100)
      };
    }
  }

  window.SongOblique = {
    OBLIQUE_CARDS,
    ObliqueDeck,
    deck: new ObliqueDeck()
  };

})(typeof window !== "undefined" ? window : globalThis);
