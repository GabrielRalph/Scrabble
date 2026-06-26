import { AccessButton, AccessEvent, GridLayout, SvgPlus } from "../squidly-utils.js";
import { BOARD_SIZE, GameState, PREMIUMS, TILE_STATES } from "../scrabble-state.js";
import * as OF from "./outline-finder.js" 

/**
 * @typedef {import("../scrabble-state.js").TileInfo} TileInfo
 */

const tileImageLight = import.meta.resolve("../../assets/tile-f.png");
const tileImageDark = import.meta.resolve("../../assets/tile-f-dark.png");
console.log("Tile image light:", tileImageLight, "dark:", tileImageDark);

const T_S = 1080;
const T_B = 40;

const DEFS = `<svg class = "svg-defs" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
            <clipPath id="tile-clip-path">
            <rect width="1000" height="1000" rx="100" ry="100" fill="none"/>
            </clipPath>
            <filter id = "blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="35" />
            </filter>
            <g id = "tile-background-old" clip-path = "url(#tile-clip-path)">
                <g filter="url(#blur)"> 
                    <rect x="-88.829" y="-41.93" width="1088.829" height="1121.143" style="fill: #ffda9e;"/>
                    <path d="M0,900c0,38.594,31.276,70,100.002,70h800c38.599,0,70-31.406,70-70V100c0-60.179-31.401-100-70.002-100l-.008-41.306,208.947,1.595,2.886,1121.26H-5.937L0,900Z" style="fill: #bc7c15;"/>
                    <path d="M1000,100c0-38.599-33.997-70-99.999-70H100.001C39.944,30,0,61.401,0,100V-39.789h1000V100Z" style="fill: #fff; opacity: .85;"/>
                </g>
            </g>

            <pattern id = "tile-background"
                width="100%"
                height="100%"
                patternUnits="objectBoundingBox" 
            >
                <image  xlink:href="${tileImageLight}" width="1040" height="1040"/>
            </pattern>
            <pattern id = "tile-background-locked"
                width="100%"
                height="100%"
                patternUnits="objectBoundingBox" 
            >
                <image  xlink:href="${tileImageDark}" width="1040" height="1040"/>
            </pattern>

             <g id = "icon-cancel" style="fill: none; stroke: #000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 50px;">  
                <line x1="655.531" y1="344.469" x2="344.469" y2="655.531"/>
                <line x1="344.469" y1="344.469" x2="655.531" y2="655.531"/>
            </g>

            <g id = "icon-reset" style="fill: none; stroke: #000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 50px;">  
                <path d="M333.602,242.387c0,340.856,249.404,177.858,249.404,515.225"/>
                <polyline points="499.612 670.195 583.005 757.613 666.398 670.195"/>
            </g>

            <g id = "icon-shuffle" style="fill: none; stroke: #000; stroke-linecap: round; stroke-linejoin: round; stroke-width: 50px;"> 
                <path d="M538.728,450.595c38.665-42.52,95.087-76.103,218.885-76.103"/>
                <path d="M242.387,623.896c123.553,0,180.904-32.769,219.881-74.551"/>
                <polyline points="670.195 457.885 757.613 374.492 670.195 291.099"/>
                <path d="M242.387,376.104c340.856,0,177.858,249.404,515.225,249.404"/>
                <polyline points="670.195 542.115 757.613 625.508 670.195 708.901"/>
            </g>
        </defs>
    </svg>
`

class TileLetters extends SvgPlus {
    constructor(options) {
        super("svg");
        this.class = "tile-letters";
        this.setAttribute("viewBox", "-40 -40 1080 1080");

        if (options.isTile) {
            this.createChild("rect", {
                width: 1040, height: 1040,
                x: -20, y: -20,
                fill: `url(#tile-background${(options.locked ? "-locked" : "")})`
            });
        } else {
            this.createChild("rect", {
                width: "1000", height: "1000",
                rx: "100", ry: "100",
                class: "bg"
            });
        }

        
        if (options.letter) {
            this.createChild("text", { 
                x: "500", y: "500", 
                content: options.letter, 
                fill: "currentColor",
                "text-anchor": "middle",
                "dominant-baseline": "central",
                class: "tile-letter",
                "font-size": options.letterSize ?? 400,
                "font-weight": "bold",
            });
        }
        if (options.value) {
            this.createChild("text", { 
                x: "900", y: "900", 
                content: options.value, 
                fill: "currentColor",
                "font-size": options.valueSize ?? 300,
                "font-weight": "bold",
                "text-anchor": "end",
                class: "tile-value" 
            });
        }

        if (options.icon) {
            this.createChild("use", { href: options.icon, class: "icon" });
        }

        this.createChild("rect", {
            x: "-20", y: "-20",
            "stroke-width": "40",
            width: "1040", height: "1040",
            rx: "120", ry: "120",
            class: "outline"
        })

    }
}


class GroupHighlight extends SvgPlus {
   
    /**
     * @param {TileInfo[]} tiles
     */
    constructor(tiles, options) {
        super("div");
        this.class = "highlight group";
        this.styles = {
            "grid-row": `1 / ${BOARD_SIZE+1}`,
            "grid-column": `1 / ${BOARD_SIZE+1}`,
        }
        const svg = this.createChild("svg", {
            viewBox: `0 0 ${T_S * BOARD_SIZE} ${T_S * BOARD_SIZE}`,
        });
        this.toggleAttribute("valid", options.valid);
        let tposes = tiles.map((t, i) => ({
            r: t.row,
            c: t.col,
            loc: `${t.row},${t.col}`, 
            x: (t.col + 0.5) * T_S,
            y: (t.row + 0.5) * T_S,
            index: i
        }));
        const perims = OF.findPerimeterPaths(tposes, T_S);
        perims.map(({loop, tiles}) => {
            svg.createChild("path", {
                d: OF.createSVGPath(loop, 120),
                "stroke-width": "60",
                class: "outline"
            });
        })

        if (options.label) {
            let topLeftMostTile = tposes.reduce((a, b) => (b.r < a.r || (b.r === a.r && b.c < a.c)) ? b : a);
            let lX = topLeftMostTile.c;
            let lY = topLeftMostTile.r;
            let rX = 100;
        
            let w = 800;
            let h = 450;

            const g = svg.createChild("g", {class: "label"})
            g.createChild("rect", {
                x: T_S * lX + 100, y: T_S * lY - h/2,
                width: w, height: h/2,
            });

            g.createChild("rect", {
                x:  T_S * lX + 100, y: T_S * lY - h,
                width: w, height: h,
                rx: "100", ry: "100",
            });

            g.createChild("text", {
                x: T_S * lX + 100 + w/2, y: T_S * lY - h/2,
                content:  options.label,
                fill: "currentColor",
                "text-anchor": "middle",
                "dominant-baseline": "central",
                class: "tile-letter",
                "font-size": 400,
                "font-weight": "bold",
            });
        }
    }
    
}

class WordHighlight extends SvgPlus {
    constructor([rowStart, rowEnd], [colStart, colEnd], options) {
        super("div");
        options = options || {};
        this.classList.add("highlight");
        this.styles = {
            "grid-row": `${rowStart + 1} / ${rowEnd + 2}`,
            "grid-column": `${colStart + 1} / ${colEnd + 2}`,
        }
        let colSpans = colEnd - colStart + 1;
        let rowSpans = rowEnd - rowStart + 1;
        const svg = this.createChild("svg", {
            viewBox: `-40 -40 ${1080 * colSpans} ${1080 * rowSpans}`,
        })
        this.toggleAttribute("valid", options.valid);

        const p = 250;
        svg.createChild("rect", {
            x: p-20, y: p-20,
            "stroke-width": "60",
            width: 1080 * colSpans - 40 - 2 * p, height: 1080 * rowSpans - 40 - 2 * p,
            rx: (1080 - 2 * p)/2, ry: (1080 - 2 * p)/2,
            class: "outline"
        })
    }
}

class BoardSquare extends AccessButton {
    #tile = null;
    #tileEl = null;

    /**
     * @param {number} row
     * @param {number} col
      * @param {ScrabblePlayerPanel} board
     */
    constructor(row, col, board) {
        super("r-"+row);
        this.row = row;
        this.col = col;
        let premiumClass = PREMIUMS.get(`${row},${col}`) || "";
        this.classList.add("board-square", "tile");
        if (premiumClass) {
            this.toggleAttribute(premiumClass, true)
            premiumClass = premiumClass.toUpperCase();
        }
        this.createChild(TileLetters, {}, {letter: premiumClass});

        // Click: place selected tile onto empty square, or recall a pending tile
        this.addEventListener("access-click", () => {
            const selectedTile = board.selectedTile;
            if (selectedTile) {
                board.placeTile(selectedTile.id, row, col);
            } else if (this.tile) {
                board.returnTileToRack(this.tile.id);
            }
        });

        // Drag out: when this square has a tile, allow dragging it elsewhere.
        this.addEventListener("dragstart", (e) => {
            if (!this.tile || this.tile.state !== TILE_STATES.pending) { 
                e.preventDefault();
            } else {
                e.dataTransfer.setData("text/tile-id", this.tile.id);
                e.dataTransfer.effectAllowed = "move";
                this.classList.add("dragging");
            }
        });

        this.addEventListener("dragend", () => {
            this.classList.remove("dragging");
        });

        // Drag-and-drop: accept tiles dragged from the rack or from another square
        this.addEventListener("dragover", (e) => {
            if (!this.tile || this.tile.state === TILE_STATES.pending) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                this.classList.add("drag-over");
            }
        });
        this.addEventListener("dragleave", () => {
            this.classList.remove("drag-over");
        });


        this.addEventListener("drop", (e) => {
            e.preventDefault();
            this.classList.remove("drag-over");
            const tileId = e.dataTransfer.getData("text/tile-id");
            board.placeTile(tileId, row, col);
        });
    }

    set tile(tile) {
        if (this.#tile) {
            this.removeChild(this.#tileEl);
            this.#tileEl = null;
        }
        if (tile) {
            this.#tileEl = this.createChild(TileLetters, {class: "tile-letters placed"}, {...tile, isTile: true, locked: tile.state === TILE_STATES.placed});
        }
        this.#tile = tile || null;

        if (tile) {
            this.setAttribute("draggable", "true");
        } else {
            this.removeAttribute("draggable");
        }
    }

    get tile() {
        return this.#tile;
    }
}

export class Board extends SvgPlus {
    #grid = [];
    /** @type {((row: number, col: number, existingTile: TileInfo|null, dragTileId?: string) => void)|null} */
    _onSquareActivate = null;

    /** @param {ScrabblePlayerPanel} root */
    constructor(root) {
        super("scrabble-board");
        let isLabels = false;
        this.isLabels = isLabels;
    
        
        let relLabel = isLabels ? "0.5fr " : ""
        this.styles = {
            display: "grid",
            "grid-template-columns": `${relLabel}repeat(${BOARD_SIZE}, 1fr)`,
            "grid-template-rows": `${relLabel}repeat(${BOARD_SIZE}, 1fr)`,
        }
        this.innerHTML = "";
        // this.createChild("div", {styles: {
        //     "grid-row": 1,
        //     "grid-column": 1,
        // }});
        let GRID = []
        if (isLabels) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                this.createChild("div", {
                    class: "board-label",
                    styles: {
                        "grid-row": 1,
                        "grid-column": col + 2,
                    }
                })
                .createChild("svg", {viewBox: "0 0 100 50"}).createChild("text", {
                    x: "50", y: "25",
                    content: String.fromCharCode(65 + col),
                    fill: "currentColor",
                    "text-anchor": "middle",
                    "dominant-baseline": "central",
                    "font-size": 32,
                });
            }
        }

        for (let row = 0; row < BOARD_SIZE; row++) {
            let ROW = [];
            if (isLabels) {
                this.createChild("div", {
                    class: "board-label",
                    styles: {
                        "grid-row": row + 2,
                        "grid-column": 1,
                    }
                })
                .createChild("svg", {viewBox: "0 0 50 100"}).createChild("text", {
                    x: "25", y: "50",
                    content:  String(row + 1),
                    fill: "currentColor",
                    "text-anchor": "middle",
                    "dominant-baseline": "central",
                    "font-size": 32,
                });
            }
         
            for (let col = 0; col < BOARD_SIZE; col++) {
                ROW.push(this.createChild(BoardSquare, {styles: {
                    "grid-row": row + (isLabels ? 2 : 1),
                    "grid-column": col + (isLabels ? 2 : 1),
                }}, row, col, root))
            }
            GRID.push(ROW);
        }
        this.#grid = GRID;

        this.highlights = this.createChild("div", {style: {display: "contents"}});
    }


    /**
     * @param {import("../scrabble-state.js").ValidationResult} validation
     */
    showValidation(validation) {
        this.clearHighlights();
        if (validation.moveInfo) {

            let allTiles = validation.moveInfo.wordInfo.flatMap(w => w.tiles);
            this.highlights.createChild(
                GroupHighlight, {}, 
                allTiles, {valid: validation.valid, label: validation.moveInfo.totalScore}
            );

            if (!validation.valid && validation.moveInfo.wordInfo.some(w => w.isWord)) {
                for (let word of validation.moveInfo.wordInfo) {
                    
                    if (word.isWord) {
                        let minRow = Math.min(...word.tiles.map(t => t.row));
                        let maxRow = Math.max(...word.tiles.map(t => t.row));
                        let minCol = Math.min(...word.tiles.map(t => t.col));
                        let maxCol = Math.max(...word.tiles.map(t => t.col));
                        this.addHighlight([minRow, maxRow], [minCol, maxCol], {
                            valid: word.isWord,
                        });
                    }
                }
            }
        }
    }


    addHighlight(rowSpan, colSpan, options) {
        let highlight = this.highlights.createChild(WordHighlight, {}, rowSpan, colSpan, options);
    }

    clearHighlights() {
        this.highlights.innerHTML = "";
    }

    get tiles() {
        return this.#grid.flatMap(row => row.map(square => square.tile).filter(tile => tile !== null));
    }

    set tiles(tiles) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                this.#grid[row][col].tile = null;
            }
        }
        tiles.map(tile => {
            if (tile.state === TILE_STATES.pending || tile.state === TILE_STATES.placed) {
                let square = this.#grid[tile.row][tile.col];
                if (square) {
                    square.tile = tile;
                }
            }
        })
    }
}

class RackTile extends AccessButton {
    #tile;
    /**
     * @param {TileInfo} tile
      * @param {Rack} rack
     */
    constructor(tile, rack) {
        super("rack");
        this.#tile = tile;
        this.classList.add("tile");
        this.classList.add("rack");
        this.letters = this.createChild(TileLetters, {}, {...tile, isTile: true});

        // Enable HTML5 drag-and-drop
        this.setAttribute("draggable", "true");
        this.addEventListener("dragstart", (e) => {
            if (this.placed || rack.isSwapMode) {
                e.preventDefault();
            } else {
                e.dataTransfer.setData("text/tile-id", tile.id);
                e.dataTransfer.effectAllowed = "move";
                // e.dataTransfer.setDragImage(IMAGE, 50,50);
            }
        });

        this.placed = tile.state === TILE_STATES.pending;
    }

    get selected() { return this.hasAttribute("selected"); }
    set selected(value) { this.toggleAttribute("selected", value); }

    get placed() { return this.hasAttribute("placed"); }
    set placed(value) { this.toggleAttribute("placed", value); }

    get tile() {
        return this.#tile;
    }
}

export class Rack extends SvgPlus {
    #selectedTile = null;
    #selectedTiles = new Set();
    #isSwapMode = false;

    constructor(board) {
        super("scrabble-rack");

        this.createChild(AccessButton, {
            class: "tile btn",
            styles: { "grid-column": "1" },
            events: {"access-click": () => this.shuffle()},
        }, "rack").createChild(TileLetters, {}, {icon: "#icon-shuffle"});

        this.rack = this.createChild("div", {styles: {display: "contents"}});

        let cancel = (e) => {
            let e2 = new AccessEvent("cancel-swap", e, {bubbles: true});
            this.dispatchEvent(e2);
        }
        this.recallButton = this.createChild(AccessButton, {
            class: "tile btn",
            styles: { "grid-column": "9" },
            events: {"access-click": (e) => 
                this.#isSwapMode ? cancel(e) : board.returnAllTilesToRack()
            },
        }, "rack")
        this.isSwapMode = false;
    }

    shuffle() {
        let rackTiles = [...this.rack.children].sort(() => Math.random() - 0.5);
        this.rack.innerHTML = "";
        rackTiles.forEach(tile => this.rack.appendChild(tile));
    }


    removeSelection() {
        this.#selectedTile = null;
        this.#selectedTiles.clear();
        for (let child of this.rack.children) {
            child.selected = false;
        }
    }

    /** @returns {TileInfo|null} */
    get selectedTile() {
        return this.#selectedTile;
    }

    get selectedTiles() {
        return [...this.#selectedTiles];
    }

    set isSwapMode(value) {
        this.removeSelection();
        this.recallButton.innerHTML = "";
        this.recallButton.createChild(TileLetters, {}, {icon: value ? "#icon-cancel" : "#icon-reset"});
        this.#isSwapMode = value;
    }
    get isSwapMode() {
        return this.#isSwapMode;
    }
    
    /**
     * Select a tile. Clicking the same tile deselects it.
     * Placed (semi-transparent) tiles cannot be selected.
     * @param {TileInfo|null} tile
     */
    selectTile(tile, toggleSelect = true) {
        if (this.#isSwapMode && tile && tile.state === TILE_STATES.inPlayerRack) {
            if (this.#selectedTiles.has(tile)) {
                this.#selectedTiles.delete(tile);
            } else {
                this.#selectedTiles.add(tile);
            }
            for (let child of this.rack.children) {
                child.selected = child.tile && this.#selectedTiles.has(child.tile);
            }
        } else if (!tile || tile.state === TILE_STATES.inPlayerRack) {
            let tileId = tile?.id || null;

            // Toggle off if same tile clicked again
            if (toggleSelect && this.#selectedTile?.id === tileId && tile !== null) {
                tile = null;
                tileId = null;
            }

            this.#selectedTile = tile;
            for (let child of this.rack.children) {
                child.selected = child.tile.id === tileId;
            }
        }
    }
 

    set tiles(tiles) {
        this.rack.innerHTML = "";
        let reselect = false;
        tiles.forEach(tile => {
            this.rack.createChild(RackTile, {events: {
                "access-click": (e) => {
                    this.selectTile(tile);
                    this.dispatchEvent(
                        new AccessEvent("selection", e, {bubbles: true})
                    );
                }
            }}, tile, this);
            if (this.#selectedTile && tile.id === this.#selectedTile.id) {
                reselect = tile.state === TILE_STATES.inPlayerRack;
            }
        });

        if (!this.#isSwapMode) {
            if (reselect) {
                this.selectTile(this.#selectedTile, false);
            } else {
                this.selectTile(null, false);
            }
        } else {
            let newSelectedTiles = new Set();
            for (let child of this.rack.children) {
                if (child.tile && this.#selectedTiles.has(child.tile)) {
                    newSelectedTiles.add(child.tile);
                }
                child.selected = child.tile && this.#selectedTiles.has(child.tile);
            }
        }
    }

    get tiles() {
        return [...this.rack.children].map(child => child.tile);
    }
}

export class ScrabblePlayerPanel extends SvgPlus {
    #gameState = null;
    #playerIndex = 0;
    constructor() {
        super("scrabble-player-panel");
        this.innerHTML = DEFS;
        const boardContainer = this.createChild("div", {class: "board-container"});
        this.boardEl = boardContainer.createChild(Board, {}, this);
        this.rackEl = this.createChild(Rack, {}, this);
    }

    set playerIndex(index) {
        if (this.#playerIndex !== index) {
            this.#playerIndex = index;
            this.setAttribute("player", index);
            this.#update(false);
        }
    }

    get selectedTile() {
        return this.rackEl.selectedTile;
    }

    get selectedTiles() {
        return this.rackEl.selectedTiles;
    }

    set isSwapMode(value) {
        this.rackEl.isSwapMode = value;
    }
    get isSwapMode() {
        return this.rackEl.isSwapMode;
    }

    placeTile(tileId, row, col) {
        const tile = this.getTileById(tileId);
        if (tile) {
            let oldTile = this.getTileByPosition(row, col);
            if (oldTile) {
                this.state.returnTileToRack(oldTile.id);
            }
            this.state.moveToPendingPosition(tile.id, row, col);
            this.#update();
        }
    }

    returnTileToRack(tileId) {
        const tile = this.getTileById(tileId);
        if (tile) {
            this.state.returnTileToRack(tileId);
            this.#update();
        }
    }

    returnAllTilesToRack() {
        this.state.returnAllPendingTilesToRack();
        this.#update();
    }
    
    getTileByPosition(row, col) {
        return this.state.tiles.find(t => t.row === row && t.col === col) || null;
    }

    getTileById(id) {
        return this.state.tiles.find(t => t.id === id) || null;
    }

    #update(dispatch = true) {
        const rackTiles = this.state.getPlayerRack(this.#playerIndex);
        const tilesOnBoard = this.state.tilesOnBoard;

        this.rackEl.tiles = rackTiles;
        this.boardEl.tiles = tilesOnBoard;
        this.boardEl.showValidation(this.state.validateCurrentMove());
       
        if (dispatch) {
            this.dispatchEvent(new CustomEvent("state-change"));
        }
    }

    /**
     * @param {GameState} state
     */
    set state(state) {
        this.#gameState = state;
        this.#update(false);
    }

    get state() {
        return this.#gameState
    }
}

