import { AccessButton, AccessEvent, GridIcon, GridLayout, ShadowElement, SvgPlus } from "./squidly-utils.js";
import { ScoreBoard, ScrabbleBag, ScrabbleHistory, } from "./ui/side-panel-components.js";
import { ScrabblePlayerPanel, } from "./ui/scrabble-player-panel.js";
import { GameState } from "./scrabble-state.js";

const PICK_MSG = "Pick tiles<br/>to swap";


class ScrabbleStartOverlay extends GridLayout {
    /** @param {ScrabbleGame} game*/
    constructor(game) {
        super(4,4);
        this.class = "start-overlay";
        this.game = game;
    }

    /**
     * @param {GameState} state
     */
    set state(state) {
        this.innerHTML = "";
        let hide = true;
        if (state) {
            let winInfo = state.winInfo;
            if (winInfo.isWinner) {
                let isTie = winInfo.scores[0].score === winInfo.scores[1].score;
                let conent = ""
                if (!isTie) {
                    conent = `<h1>Game Over</h1><div><span player-tag="${winInfo.winner.playerIndex}">${winInfo.winner.name}</span> wins with ${winInfo.winner.score} points!</div>`;
                } else {
                    conent = `<h1>Game Over</h1><div>It's a tie! Both players scored ${winInfo.scores[0].score} points.</div>`;
                }

                this.add(this.createChild("div", {
                    class: "game-over-card",
                    content: conent
                }), 1, [1,2]);
                hide = false;
            }
        } else {
            hide = false;
        }

        this.addGridIcon({
            type: "noun",
            displayValue: "Cooperative Game",
            subtitle: "Both people can <br/> help each other",
            events: {
                "access-click": (e) => {
                    let e2 = new AccessEvent("start-game", e, {bubbles: true, composed: true});
                    e2.coop = true;
                    this.game.dispatchEvent(e2);
                }
            }
        }, 2, 1);

        this.addGridIcon({
            type: "normal",
            displayValue: "Competitive Game",
            subtitle: "Players can only <br/> play their own tiles",
            events: {
                "access-click": (e) => {
                    let e2 = new AccessEvent("start-game", e, {bubbles: true, composed: true});
                    e2.coop = false;
                    this.game.dispatchEvent(e2);
                }
            }
        },  2, 2);

        if (hide) {
            this.style.display = "none";
        } else {
            this.style.display = "grid";
        }
    }
}


const GridIconStyle = GridIcon.styleSheet.replace(import.meta.resolve("../src"), "https://session.squidly.com.au/main")
export class ScrabbleGame extends ShadowElement {
    #state = new GameState();
    #playerIndex = 0;

    ACTIONS_BUTTONS = [
        {
            label: "Action"
        }
    ]

    constructor(el) {
        super(el, new GridLayout(5,6));
       
        [[this.swapButton], [this.skipButton], [this.placeButton]] = this.root.addGridIcons([
            [{
                displayValue: "Swap",
                events: {
                    "access-click": () => this.swap()
                }
            }],
            [{
                displayValue: "Skip",
                events: {
                    "access-click": () => this.#call("skipTurn")
                }
            }],
            [{
                type: "lightBlue",
                displayValue: "Place",
                events: {
                    "access-click": () => this.#call("commitTiles")
                }
            }],
        ], 2, 0);
        const main = this.root.add(this.createChild("div", {class: "main"}), [0,4], [1,5]);

        this.ppanel = main.createChild(ScrabblePlayerPanel);
        const sidePanel = main.createChild("div", {class: "side-panel"});
        this.scoreBoard = sidePanel.createChild(ScoreBoard);
        this.tileBage = sidePanel.createChild(ScrabbleBag);
        this.scoreHistory = sidePanel.createChild(ScrabbleHistory);
        this.placeButton.disabled = true;
        this.ppanel.events = {
            "selection": (e) => {
                if (this.ppanel.isSwapMode) {
                    this.swapButton.displayValue = this.ppanel.selectedTiles.length > 0 ? "Confirm Swap" : PICK_MSG;
                    this.swapButton.disabled = this.ppanel.selectedTiles.length === 0;
                }
            },
            "cancel-swap": () => {
                this.swapButton.displayValue = "Swap";
                this.swapButton.disabled = false;
                this.placeButton.disabled = false;
                this.skipButton.disabled = false;
                this.ppanel.isSwapMode = false;

            },
            "state-change": (e) => {
                const results = this.#state.validateCurrentMove();
                this.placeButton.disabled = !results.valid;
                this.#dispatchChange();
            }
        }

        this.startOverlay = this.root.createChild(ScrabbleStartOverlay, {}, this);
        this.#onStateUpdate();
    }


    swap() {
        if (this.ppanel.isSwapMode) {
            this.#call("exchangeTiles", this.ppanel.selectedTiles.map(t => t.id));
            this.swapButton.displayValue = "Swap";
            this.ppanel.isSwapMode = false;
            this.swapButton.disabled = false;
            this.placeButton.disabled = false;
            this.skipButton.disabled = false;
        } else {
            this.#state.returnAllPendingTilesToRack();
            this.swapButton.displayValue = PICK_MSG;
            this.swapButton.disabled = true;
            this.ppanel.isSwapMode = true;
            this.placeButton.disabled = true;
            this.skipButton.disabled = true;
            this.#onStateUpdate();
            this.#dispatchChange();
        }
    }

    #dispatchChange() {
        this.dispatchEvent(new CustomEvent("change"))
    }

    #onStateUpdate() {
        this.ppanel.playerIndex = this.showedPlayerIndex;
        this.ppanel.state = this.#state;
        this.scoreBoard.state = this.#state;
        this.scoreHistory.state = this.#state;
        this.tileBage.state = this.#state;
        this.startOverlay.state = this.#state;
        const results = this.#state.validateCurrentMove();
        this.placeButton.disabled = !results.valid;
        this.root.setAttribute("my-turn", this.showedPlayerIndex === this.#state.currentPlayerIndex);
    }

    #call(method, ...args) {
        if (typeof this.#state[method] === "function") {
            this.#state[method](...args);
            this.#onStateUpdate();
            this.#dispatchChange();
        } else {
            console.warn(`Method ${method} does not exist on GameState`);
        }
    }

    set playerIndex(value) {
        if (typeof value !== "number" || value < 0 || value >= this.#state.players.length) {
            value = null;
        }
        this.#playerIndex = value;
        this.ppanel.playerIndex = this.showedPlayerIndex;
        this.#onStateUpdate();
    }
    get playerIndex() {
        return this.#playerIndex;
    }

    get showedPlayerIndex() {
        return this.#playerIndex == null ? this.#state.currentPlayerIndex : this.#playerIndex;
    }

    get state() {
        return this.#state.toString();
    }
    set state(value) {
        if (value == null) {
            this.#state = new GameState();
            this.startOverlay.state = null
        } else {
            value = String(value);
            if (this.#state.toString() !== value) {
                this.#state = GameState.fromString(value);
                this.#onStateUpdate();
            } 
        }

    }
    
    set players(value) {
        this.#state.players = value;
        this.#onStateUpdate();
    }

    static get usedStyleSheets() {
        return [
            import.meta.resolve("../styles/scrabble.css"),
            GridIconStyle
        ]
    }

    static async load() {
        await Promise.all([
            this.loadStyleSheets(),
            GameState.loadDictionary()
        ])

    }
}