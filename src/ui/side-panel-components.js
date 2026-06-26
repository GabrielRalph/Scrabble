import { GridIcon, GridLayout, SvgPlus } from "../squidly-utils.js";
import { GameState, MOVE_TYPES, PREMIUMS } from "../scrabble-state.js";

export class ScoreBoard extends SvgPlus{
    constructor() {
        super("div");
        this.class = "score-board";
    }

    /**
     * @param {GameState} state
     */
    set state(state) {
        this.innerHTML = "";
        let winInfo = state.winInfo;
        console.log("scoreboard state", winInfo)
        let currentPlayerIndex = state.currentPlayerIndex;
        state.winInfo.scores.forEach(({name, score}, player) => {
            const ps = this.createChild("div", {class: "player-score", "player": player});
            ps.toggleAttribute("current", player === currentPlayerIndex);
            ps.createChild("div", {class: "player-name", content: `<i player-tag="${player}"></i>` + name});
            ps.createChild("div", {class: "player-score-value", content: score || 0});
        })
    }
}


export class ScrabbleBag extends SvgPlus {
    constructor() {
        super("section");
        this.props = {
             class: "panel-card bag-card", 
             "aria-label": "Tile bag"
        }
        const heading = this.createChild("div", { class: "panel-heading compact" });
        this.bagTitle = heading.createChild("h2", {
            content: `<span class="bag-icon" aria-hidden="true"></span> Tile Bag&nbsp;`
        });
        this.bagCount = this.bagTitle.createChild("span", { class: "bag-count", content: "98" });
        
        this.bagStats = heading.createChild("span", { 
            class: "bag-stats",
            content: `Vowels : <span class="vowels">0</span><br/> Consonants : <span class="consonants">0</span>`
         });
        this.vowelCount = this.bagStats.querySelector(".vowels");
        this.consonantCount = this.bagStats.querySelector(".consonants");

        this.bagLetters = this.createChild("div", { class: "bag-letters", "aria-label": "Tiles left in bag" });
    }

    /**
     * @param {GameState} state
     */
    set state(state) {
        const tiles = state.bagTiles;
        const counts = {};
        tiles.forEach(tile => {
            counts[tile.letter] = (counts[tile.letter] || 0) + 1;
        });

        const vowels = "AEIOU";
        let vowelCount = 0;
        let consonantCount = 0;
        Object.keys(counts).forEach(letter => {
            if (vowels.includes(letter)) {
                vowelCount += counts[letter];
            } else {
                consonantCount += counts[letter];
            }
        });
        this.vowelCount.textContent = vowelCount;
        this.consonantCount.textContent = consonantCount;
        this.bagCount.textContent = tiles.length;

        this.bagLetters.innerHTML = "";
        Object.keys(counts).sort((a, b) => a.localeCompare(b)).forEach((letter) => {
            let n = counts[letter] || 0;
            this.bagLetters.createChild("span", { class: "bag-letter", content: `${n}×<b>${letter}</b>` });
        });
    }
}


export class ScrabbleHistory extends SvgPlus {
  constructor() {
    super("section");
    this.class = "panel-card history-card";
    this.setAttribute("aria-label", "Turn history");
    const heading = this.createChild("div", { class: "panel-heading history-heading" });
    heading.createChild("h2", { innerHTML: `<span class="history-icon" aria-hidden="true"></span> Turn History` });
    this.lastMove = heading.createChild("span", { content: "" });
    const listWrap = this.createChild("div", { class: "history-list-wrap" });
    this.historyList = listWrap.createChild("div", { class: "history-list" });
  }

  /**
   * @param {GameState} state
   */
  set state(state) {
    this.historyList.innerHTML = "";
    if (history.length === 0) {
    //   this.lastMove.textContent = "No moves yet";
      this.historyList.createChild("div", { class: "history-empty", content: "Moves, swaps, passes, and end-game scoring will appear here." });
    } else {
        let history = state.history;
        let moves = state.moves;
        let n = state.players.length;

        /** @type {Object<string, import("../scrabble-state.js").MoveInfo>} */
        let historyByMoveIndex = {};
        history.forEach((move) => {
            if (move.moveIndex === Infinity) return;
            historyByMoveIndex[move.moveIndex] = move;
        });
        moves = moves.map((m, i) => [m, i]).reverse();
        moves.forEach(([moveType, moveIndex]) => {
            const playerIndex = moveIndex % n;
    
            const item = this.historyList.createChild("article", { 
                class: `history-item current-player-${playerIndex ?? 0}` 
            });

            const playerName = state.players[playerIndex]?.name || "Unknown Player";
            const meta = item.createChild("div", { 
                class: "history-meta" ,
                content: `<span> <i player-tag="${playerIndex}"></i> ${playerName}</span><span>Turn ${moveIndex+ 1}</span>`
            })

            if (moveType === MOVE_TYPES.place) {
                const move = historyByMoveIndex[moveIndex];
                const words = move.wordInfo.map(w => 
                    w.tiles.map(tile => {
                        let isNew = tile.moveIndex == moveIndex;
                        let rc = `${tile.row},${tile.col}`;
                        let premium = isNew && PREMIUMS.has(rc) ? (" " + PREMIUMS.get(`${tile.row},${tile.col}`)) : "";
                        return `<i ${isNew ? "" : "use"}${premium}>${tile.letter}</i>`
                    }
                ).join("")).join(" + ");
               
               
                const title = item.createChild("div", { 
                    class: "history-title",
                    content:  `<span>${words}</span><strong>${move.totalScore > 0 ? "+" : ""}${move.totalScore} pts</strong>`
                })
            } else {
                let text = (moveType === MOVE_TYPES.exchange) ? "Swapped" : (
                    (moveType === MOVE_TYPES.skip) ? "Skipped" : "resigned"
                );
                const title = item.createChild("div", { 
                    class: "history-title",
                    content:  `<span>${text}</span><strong>0 pts</strong>`
                })
            }
        });
    }
  }
}

