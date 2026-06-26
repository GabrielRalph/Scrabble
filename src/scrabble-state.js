import * as Dictionary from "./dictionary/cwsAPI.js";

/**
 * @typedef {Object} TileInfo
 * @property {string} id - Unique identifier for the tile (e.g., "T-A-0")
 * @property {string} letter - The letter on the tile (e.g., "A")
 * @property {number} count - The count of this letter in the distribution (e.g., 0 for the first "A", 1 for the second "A", etc.)
 * @property {number} value - The point value of the tile (e.g., 1 for "A")
 * @property {string} state - The current state of the tile ("pending", "inPlayerRack", "placed", or "inBag")
 * @property {?number} playerIndex - The index of the player who has this tile in their rack, or null if not in a player's rack
 * @property {?number} row - The row index on the board where this tile is placed or pending, or null if not on the board
 * @property {?number} col - The column index on the board where this tile is placed or pending, or null if not on the board
 * @property {?number} moveIndex - The index of the move when this tile was placed, or null if not placed
 */

/**
 * @typedef {Object} WordInfo
 * @property {TileInfo[]} tiles - Array of tile snapshots that form the word
 * @property {number} score - The total score for the word, including letter and word multipliers
 * @property {boolean} isNew - True if at least one tile in the word was placed in the current move
 * @property {string} text - The actual word formed by the tiles (e.g., "HELLO")
 * @property {boolean} isWord - True if the text is a valid word in the dictionary
 */

/**
 * @typedef {Object} MoveInfo
 * @property {number} moveIndex - The index of the move (0 for the first move, 1 for the second, etc.)
 * @property {WordInfo[]} wordInfo - Array of WordInfo objects for each word formed in this move
 * @property {number} totalScore - The total score for the move, including all words and any bingo bonus
 * @property {TileInfo[]} placedTiles - Array of tile snapshots that were placed in this move
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - True if the current move is valid, false otherwise
 * @property {string} [error] - Optional error message if the move is invalid
 * @property {MoveInfo} [moveInfo] - Optional MoveInfo object if the move is valid, containing details about the move
 */

/**
 * @typedef {Object} PlayerScoreInfo
 * @property {string} name - The name of the player
 * @property {number} score - The current score of the player
 * @property {number} playerIndex - The index of the player (0 for the first player, 1 for the second, etc.)
 */

/**
 * @typedef {Object} WinInfo 
 * @property {boolean} isWinner - True if the game has ended, false otherwise
 * @property {?PlayerScoreInfo} winner - The winer
 * @property {PlayerScoreInfo[]} scores - Array of PlayerScoreInfo objects for all players, sorted by score
 */

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_CHAR_TO_INDEX = Object.fromEntries(BASE64_ALPHABET.split("").map((char, index) => [char, index]));

export const BOARD_SIZE = 15;
export const CENTER_INDEX = 7;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;
export const LETTER_VALUES = Object.freeze({
	A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
	N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
});

export const TILE_DISTRIBUTION = Object.freeze({
	A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
	N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
});

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export const TILE_STATES = {
    pending: 0,
    inPlayerRack: 1,
    placed: 2,
    inBag: 3,
}
const TILE_STATE_NAMES = Object.fromEntries(Object.entries(TILE_STATES).map(([key, value]) => [value, key]));

export const MOVE_TYPES = {
    place: 0,
    exchange: 1,
    skip: 2,
    resign: 3,
}
const MOVE_TYPE_NAMES = Object.fromEntries(Object.entries(MOVE_TYPES).map(([key, value]) => [value, key]));

export const PREMIUMS = new Map();
function setPremium(type, coords) {
    coords.forEach(([row, col]) => PREMIUMS.set(`${row},${col}`, type));
}
setPremium("tw", [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]]);
setPremium("dw", [[1,1],[2,2],[3,3],[4,4],[7,7],[10,10],[11,11],[12,12],[13,13],[1,13],[2,12],[3,11],[4,10],[10,4],[11,3],[12,2],[13,1]]);
setPremium("tl", [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]]);
setPremium("dl", [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]]);


function tiles2board(tiles, func) {
    const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
    tiles.forEach(tile => {
        if (tile.row !== null && tile.col !== null) {
            const snap = tile.snapshot;
            board[tile.row][tile.col] = (func instanceof Function) ? func(snap) : snap;
        }
    });
    return board;
}

/**
 * Computes the score of a word based on its tiles and the move index when it was placed.
 * Premium squares only apply to tiles newly placed in this move (tile.moveIndex === moveIndex).
 * The bingo bonus (+50) is a move-level concern and is not included here.
 * @param {TileInfo[]} wordTiles - Array of tile snapshots that form the word
 * @param {number} moveIndex - The index of the move when the word was placed
 * @return {number} The total score for the word
 */
function computeWordScore(wordTiles, moveIndex) {
    let letterTotal = 0;
    let wordMultiplier = 1;

    for (const tile of wordTiles) {
        let value = tile.value;
        // Premiums only activate for tiles laid down in this exact move
        if (tile.moveIndex === moveIndex) {
            const premium = PREMIUMS.get(`${tile.row},${tile.col}`);
            if (premium === "dl") value *= 2;
            if (premium === "tl") value *= 3;
            if (premium === "dw") wordMultiplier *= 2;
            if (premium === "tw") wordMultiplier *= 3;
        }
        letterTotal += value;
    }

    return letterTotal * wordMultiplier;
}


/**
 * @type {<T>(obj: T) => T}
 */
function deepCopy(obj) {
    let res = obj;
    if (Array.isArray(obj)) {
        res = obj.map(item => deepCopy(item));
    } else if (obj && typeof obj === "object") {
        res = {};
        for (let k in obj) res[k] = deepCopy(obj[k]);
    } 
    return res;
}

/**
 * Formats an array of tile snapshots that form a word into a WordInfo object
 * @param {TileInfo[]} wordTiles - Array of tile snapshots that form the word
 * @param {number} moveIndex - The index of the move when the word was placed
 * @return {WordInfo} An object containing details about the word, including its score and validity
 */
function formatWordInfo(wordTiles, moveIndex) {
    const score = computeWordScore(wordTiles, moveIndex);
    const isNew = wordTiles.some(tile => tile.moveIndex === moveIndex);
    const text = wordTiles.map(tile => tile.letter).join("").toLowerCase();
    return {
        tiles: wordTiles,
        score,
        isNew,
        text,
        isWord: Dictionary.isWord(text),
    };
}

/**
 * Converts move history to word history by grouping tiles placed in the same move
 * into words based on their adjacency on the board. This is a complex function that requires
 * careful handling of tile positions, move indices, and word formation rules in Scrabble.
 * @param {{moveIndex: number, tiles: TileInfo[]}[]} moveHistory 
 * 
 * @return {MoveInfo[]}
 */
function moveHistoryToWordHistory(moveHistory) {
    // Cumulative board built move-by-move so cross-words can reference prior tiles.
    /** @type {Map<string, TileInfo>} */
    const boardByPos = new Map();

    /** @param {number} r @param {number} c @returns {TileInfo|null} */
    const getTile = (r, c) => boardByPos.get(`${r},${c}`) ?? null;

    /**
     * Walk from (startR, startC) in direction (dr, dc), extending backward to the
     * beginning of the word then forward to its end.
     * Returns the cells array only if it is 2+ tiles long.
     * @param {number} startR @param {number} startC
     * @param {number} dr @param {number} dc
     * @returns {TileInfo[]|null}
     */
    const getWord = (startR, startC, dr, dc) => {
        let r = startR, c = startC;
        // Walk to the start of the word
        while (getTile(r - dr, c - dc)) { r -= dr; c -= dc; }
        // Collect the full word
        const cells = [];
        while (getTile(r, c)) { cells.push(getTile(r, c)); r += dr; c += dc; }
        return cells.length >= 2 ? cells : null;
    };

    const scoreHistory = moveHistory.map(({ moveIndex, tiles: newTiles }) => {
        // Extend the cumulative board with this move's tiles
        newTiles.forEach(tile => boardByPos.set(`${tile.row},${tile.col}`, tile));

        const words = [];
        const seenKeys = new Set();

        for (const tile of newTiles) {
            // Check both axes for every newly placed tile
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const word = getWord(tile.row, tile.col, dr, dc);
                if (!word) continue;
                // De-duplicate by direction + start position
                const key = `${dr},${dc}:${word[0].row},${word[0].col}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);
                words.push(word);
            }
        }
        const wordInfo = words.map(wordTiles => formatWordInfo(wordTiles, moveIndex));
        const totalScore = wordInfo.map(i=>i.score).reduce((a, b) => a + b, 0) + (newTiles.length === RACK_SIZE ? BINGO_BONUS : 0);
        return { moveIndex, wordInfo, totalScore, placedTiles: newTiles };
    });

    return scoreHistory;
}

/**
 * Check if the given array of tiles forms a straight line 
 * (either all in the same row or all in the same column).
 * This is a necessary condition for a valid Scrabble move, 
 * but not sufficient on its own.
 */
function isStraightLine(word) {
    const allSameRow = word.every(tile => tile.row === word[0].row);
    const allSameCol = word.every(tile => tile.col === word[0].col);
    return allSameRow || allSameCol;
}

/**
 * @param {TileInfo[]} tiles - Array of tile snapshots to analyze
 * @return {{valid: boolean, itterator?: Function, length?: number}}
 */
function orientationInfo(tiles) {
    const rows = new Set(tiles.map(tile => tile.row));
    const cols = new Set(tiles.map(tile => tile.col));
    let res = {valid: true}
    if (rows.size === 1) {
        const row = tiles[0].row;
        const minCol = Math.min(...tiles.map(tile => tile.col));
        const maxCol = Math.max(...tiles.map(tile => tile.col));
        const length = maxCol - minCol + 1;
        const func = (i) => [row, minCol + i];
        res.itterator = func;
        res.length = length;
    } else if (cols.size === 1) {
        const col = tiles[0].col;
        const minRow = Math.min(...tiles.map(tile => tile.row));
        const maxRow = Math.max(...tiles.map(tile => tile.row));
        const length = maxRow - minRow + 1;
        const func = (i) => [minRow + i, col];
        res.itterator = func;
        res.length = length;
    } else {
        res.valid = false;
    }
    return res;
}


class TileState {
    #letter = null;
    #count = null;
    #id = null;
    #playerIndex = null;
    #row = null
    #col = null;
    #moveIndex = null;
    #state = TILE_STATES.inBag;
    #changeFlag = false;

    constructor(letter, count) {
        if (typeof letter !== "string" || !LETTER_VALUES[letter]) {
            throw new Error(`Invalid letter: ${letter}`);
        }
        this.#letter = letter;
        this.#count = count;
        this.#id = `${letter}-${count}`;
    }

    /** @param {number} newState */
    set state(newState) {
        if (!(newState in TILE_STATE_NAMES)) {
            throw new Error(`Invalid tile state: ${newState}`);
        }
        this.#changeFlag ||= this.#state !== newState;
        this.#state = newState;
    }

    /** @returns {number} */
    get state() {return this.#state; }


    /** @param {number} index */
    set moveIndex(index) {
        if (typeof index !== "number" || index < 0) {
            throw new Error(`Invalid move index: ${index}`);
        }
        this.#changeFlag ||= this.#moveIndex !== index;
        this.#moveIndex = index;
    }
    /** @returns {number} */
    get moveIndex() { 
        let moveIndex = null;
        if (this.state === TILE_STATES.placed) {
            moveIndex = this.#moveIndex;
        } else if (this.state === TILE_STATES.pending) {
            moveIndex = Infinity;
        }
        return moveIndex;
    }

    /** @param {number} row */
    set row(row) {
        if (typeof row !== "number" || row < 0 || row >= BOARD_SIZE) {
            row = null; // Allow null for unplaced tiles
        }
        if (this.onBoard && row === null) {
            throw new Error(`Cannot set row to null for a tile that is on the board`);
        }
        this.#changeFlag ||= this.#row !== row;
        this.#row = row;
    }
    /** @returns {number} */
    get row() { return this.#row; }


    /** @param {number} col */
    set col(col) {
        if (typeof col !== "number" || col < 0 || col >= BOARD_SIZE) {
            col = null; // Allow null for unplaced tiles
        }
        if (this.onBoard && col === null) {
            throw new Error(`Cannot set row to null for a tile that is on the board`);
        }
        this.#changeFlag ||= this.#col !== col;
        this.#col = col;
    }
    /** @returns {?number} */
    get col() { return this.#col; }

    /**
     * @returns {TileInfo}
     */
    get snapshot() {
        return {
            id: this.id,
            letter: this.letter,
            count: this.count,
            value: this.value,
            state: this.state,
            playerIndex: this.playerIndex,
            row: this.row,
            col: this.col,
            moveIndex: this.moveIndex,
        };
    }

    get onBoard() { return this.state === TILE_STATES.placed || this.state === TILE_STATES.pending; }
    get letter() { return this.#letter; }
    get count() { return this.#count; }
    get id() { return this.#id; }
    get value() { return LETTER_VALUES[this.letter]; }
    get playerIndex() { return this.#playerIndex; }

    assignToPlayer(playerIndex) {
        if (typeof playerIndex !== "number") {
            throw new Error(`Invalid player Index: ${playerIndex}`);
        }
        this.state = TILE_STATES.inPlayerRack;
        this.#playerIndex = playerIndex;
        this.row = null;
        this.col = null;
    }

    moveToPendingPosition(row, col) {
        if (this.#playerIndex === null) {
            throw new Error(`Cannot move tile to pending position without a player assignment`);
        }
        this.state = TILE_STATES.pending;
        this.row = row;
        this.col = col;
    }

    placeOnBoard(moveIndex, row = this.row, col = this.col) {
        if (this.#playerIndex === null) {
            throw new Error(`Cannot place tile on board without a player assignment`);
        }
        this.moveIndex = moveIndex;
        this.state = TILE_STATES.placed;
        this.row = row;
        this.col = col;
    }

    returnToBag() {
        this.state = TILE_STATES.inBag;
        this.#playerIndex = null;
        this.row = null;
        this.col = null;
    }

    returnToPlayerRack() {
        if (this.#playerIndex === null) {
            throw new Error(`Cannot return tile to player rack without a player assignment`);
        }
        this.state = TILE_STATES.inPlayerRack;
        this.row = null;
        this.col = null;
    }

    toString_v0() {
        let str = `${this.state},${this.letter},${this.count}`;

        const [inRack, isPending, isPlaced] = 
            [TILE_STATES.inPlayerRack, TILE_STATES.pending, TILE_STATES.placed]
            .map(state => this.state === state);

        if (inRack || isPending || isPlaced) {
            str += `,${this.playerIndex}`;
        }

        if (isPending || isPlaced) {
            str += `,${this.row},${this.col}`;
        }

        if (isPlaced) {
            str += `,${this.moveIndex}`;
        }
     
        return str;
    }

    toString_v1() {
        let state = BASE64_ALPHABET[this.state];
        let letter = this.letter;
        let count = BASE64_ALPHABET[this.count];
        let str = `${state}${letter}${count}`;

        const inRack = this.state === TILE_STATES.inPlayerRack;
        const isPending = this.state === TILE_STATES.pending;
        const isPlaced = this.state === TILE_STATES.placed;

        if (inRack || isPending || isPlaced) {
            str += BASE64_ALPHABET[this.playerIndex];
        }

        if (isPending || isPlaced) {
            str += BASE64_ALPHABET[this.row] + BASE64_ALPHABET[this.col];
        }

        if (isPlaced) {
            let b8 = this.moveIndex;
            let c1 = b8 & 0b111111;
            let c2 = (b8 >> 6) & 0b111111;
            str += BASE64_ALPHABET[c1] + BASE64_ALPHABET[c2];
        }

        return str;
    }

    toString() {
        return this.toString_v1();
    }

    get hasChanged() { return this.#changeFlag; }
    clearChangeFlag() { this.#changeFlag = false; }

    /** @return {TileState} */
    static fromString(str, version = 0) {
        const tile = version === 0 ? TileState.fromString_v0(str) : TileState.fromString_v1(str);
        return tile;
    }

    static fromString_v0(str) {
         const [state, letter, count, ...rest] = String(str).split(",");
        if (!LETTER_VALUES[letter]) return null;
        const tile = new TileState(letter, count);
        tile.state = Number(state);

        const inRack = tile.state === TILE_STATES.inPlayerRack;
        const isPending = tile.state === TILE_STATES.pending;
        const isPlaced = tile.state === TILE_STATES.placed;

        if (inRack || isPending || isPlaced) {
            tile.assignToPlayer(Number(rest[0]));
        }

        if (isPending || isPlaced) {
            tile.moveToPendingPosition(Number(rest[1]), Number(rest[2]));
        }

        if (isPlaced) {
            tile.placeOnBoard(Number(rest[3]));
        }

        return tile;
    }

    static fromString_v1(str) {
        const stateChar = str[0];
        const letter = str[1];
        const countChar = str[2];

        const state = BASE64_CHAR_TO_INDEX[stateChar];
        const count = BASE64_CHAR_TO_INDEX[countChar];

        if (!LETTER_VALUES[letter]) return null;
        const tile = new TileState(letter, count);
        tile.state = state;

        const inRack = tile.state === TILE_STATES.inPlayerRack;
        const isPending = tile.state === TILE_STATES.pending;
        const isPlaced = tile.state === TILE_STATES.placed;

        if (inRack || isPending || isPlaced) {
            tile.assignToPlayer(BASE64_CHAR_TO_INDEX[str[3]]);
        }

        if (isPending || isPlaced) {
            tile.moveToPendingPosition(BASE64_CHAR_TO_INDEX[str[4]], BASE64_CHAR_TO_INDEX[str[5]]);
        }

        if (isPlaced) {
            const c1 = BASE64_CHAR_TO_INDEX[str[6]];
            const c2 = BASE64_CHAR_TO_INDEX[str[7]];
            const moveIndex = (c2 << 6) | c1;
            tile.placeOnBoard(moveIndex);
        }

        return tile;
    }

    /** @returns {TileState[]} */
    static createTileBag() {
        const tiles = [];
        Object.entries(TILE_DISTRIBUTION).forEach(([letter, count]) => {
            for (let index = 0; index < count; index += 1) {
                tiles.push(new TileState(letter, index));
            }
        });
        return tiles;
    }
}


class GameState {
    /** @type {TileState[]} */
    #tiles = [];

    /** @type {number[]} */
    #moves = [];

    /** @type {Object<string, TileState>} */
    #tilesByID = {};

    /** @type {MoveInfo[]} */
    #historyCache = null;

    /** @type {} */
    #validationResults = null;

    #players = [];

    constructor(moves = null, tiles = null) {
        this.version = 20;
        const allTiles = TileState.createTileBag();
        const tilesByID = Object.fromEntries(allTiles.map(tile => [tile.id, tile]));

        if (tiles && Array.isArray(tiles) && tiles.every(tile => tile instanceof TileState)) {
            tiles.forEach(tile => {
                if (!tilesByID[tile.id]) {
                    throw new Error(`Invalid tile ID in provided tiles: ${tile.id}`);
                }
                tilesByID[tile.id] = tile;
            });
        }

        if (!moves || !Array.isArray(moves) || !moves.every(move => move in MOVE_TYPE_NAMES)) {
            moves = null;
        }
        this.#tiles = Object.values(tilesByID);
        this.#moves = moves ? moves : [];

        this.#tilesByID = tilesByID;

        this.players = [
            {id: "p1", name: "Player 1"},
            {id: "p2", name: "Player 2"},
        ]
        this.#fillAllPlayerRacks();
    }

     /**
     * @param {number} row
     * @param {number} col
      * @return {TileState|null}
     */
    #getTileAt(row, col) {
        return this.#tiles.find(tile => tile.onBoard && tile.row === row && tile.col === col) || null;
    }


    /** @return {TileState[]} */
    #getBagTiles() {
        return this.#tiles.filter(tile => tile.state === TILE_STATES.inBag);
    }

    /**
     * @return {TileState | null}
     */
    #getRandomTileFromBag() {
        const bagTiles = this.#getBagTiles();
        let randomTile = null;
        if (bagTiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * bagTiles.length);
            randomTile = bagTiles[randomIndex];
        }
        return randomTile;
    }


     /**
     * @param {number} playerIndex
     * @return {TileState[]}
     */
    #getPlayerRack(playerIndex) {
        return this.#tiles.filter(tile => (
            tile.state === TILE_STATES.inPlayerRack || tile.state === TILE_STATES.pending
         ) && tile.playerIndex === playerIndex);
    }

    /**
     * @param {number} playerIndex
     */
    #fillPlayerRack(playerIndex) {
        let numInRacks = this.getPlayerRack(playerIndex).length
        while (numInRacks < RACK_SIZE) {
            const tile = this.#getRandomTileFromBag();
            if (!tile) break;
            tile.assignToPlayer(playerIndex);
            numInRacks += 1;
        }
    }


    #fillAllPlayerRacks() {
        this.players.forEach((_, playerIndex) => this.#fillPlayerRack(playerIndex));
    }


    #makeMove(moveType) {
        this.#moves.push(moveType);
    }



     /**
     * Clears the change flags on all tiles.
     */
    #clearChangeFlags() {
        this.#tiles.forEach(tile => tile.clearChangeFlag());
    }

     /**
     * @param {MoveInfo[]} history - The move history to validate against
     * @return {}
     */
    #validateCurrentMove(history) {
        let result = { valid: false }

        if (history.length === 0) {
            result.error = "No move history available to validate against.";
            return result;
        }

        const move = history.pop();
        if (move.moveIndex !== Infinity) {
            result.error = "No pending move to validate.";
            return result;
        }
        result.moveInfo = move;


        // Check that the placed tiles form a straight line.
        const placedTiles = move.placedTiles;
        const orientation = orientationInfo(placedTiles);
        if (!orientation.valid) {
            result.error = "Tiles must be in a straight line.";
            return result;
        }


        // Check that the placed tiles are contiguous with no gaps.
        let containesPlacedPeice = false;
        let continuous = true;
        let str = ""
        for (let i = 0; i < orientation.length; i++) {
            const tile = this.#getTileAt(...orientation.itterator(i));
            if (tile) {
                let placed = tile.state === TILE_STATES.placed
                containesPlacedPeice ||= placed;
                str += placed ?  ` (${tile.letter})` : ` [${tile.letter}]`;
            } else {
                continuous = false;
                str += " { }"
            }
        }
        if (!continuous) {
            result.error = "Tiles must be placed in a continuous line with no gaps.";
            return result;
        }

        // If this is the first move, we need to check that 
        // it includes the center tile.
        if (history.length === 0) {
            if (placedTiles.find(tile => tile.row === CENTER_INDEX && tile.col === CENTER_INDEX)) {
                if (placedTiles.length === 1) {
                    result.error = "The first move must place more than one tile.";
                    return result;
                } else {
                    result.valid = true;
                }
            } else {
                result.error = "The first move must include a tile on the center square.";
                return result;
            }

        // Otherwise we need to check if it hasn't already
        // connected to existing tiles on the board. We need
        // that it starts or ends adjacent to an existing tile.
        } else  if (!containesPlacedPeice) {
            if (move.wordInfo.some(word => word.tiles.some(tile => tile.state === TILE_STATES.placed))) {
                result.valid = true;
            }else {
                result.error = "New tiles must connect to existing tiles on the board.";
                return result;
            }
        
        // it wasn't the first move and it does connect to existing tiles, 
        // so it's valid as far as we can tell here.
        } else {
            result.valid = true;
        }

        // Finally, check that all words formed are valid.
        if (move.wordInfo.some(word => !word.isWord)) {
            result.error = `The following words are not valid: ${move.wordInfo.filter(word => !word.isWord).map(word => word.text).join(", ")}`;
            result.valid = false;
        }

        return result;
    }


    #computeHistory() {
        if (this.hasChanged || !this.#historyCache) {
            const history = {};
            this.#tiles.forEach(tile => {
                if (tile.state === TILE_STATES.placed || tile.state === TILE_STATES.pending) {
                    if (!history[tile.moveIndex]) {
                        history[tile.moveIndex] = [];
                    }
                    history[tile.moveIndex].push(tile.snapshot);
                }
            });
            let historyArr = Object.entries(history);
            historyArr = historyArr.map(([moveIndex, tiles]) => {
                return {
                    moveIndex: Number(moveIndex),
                    tiles,
                }
            });
            historyArr.sort(({moveIndex: a}, {moveIndex: b}) => Number(a) - Number(b))
            const historyResult = moveHistoryToWordHistory(historyArr);
            this.#historyCache = historyResult;
            this.#validationResults = this.#validateCurrentMove([...historyResult]);
            this.#clearChangeFlags();
        } else {
        }
    
    }


    set players(players) {
        if (!Array.isArray(players) || players.length < 2) {
            throw new Error("Players must be an array of at least two player objects.");
        }
        this.#players = players.map((player, index) => {
            if (typeof player === "string") {
                player = { id: player, name: player };
            }
            if (!player || typeof player !== "object") {
                throw new Error(`Player at index ${index} is not a valid object or string.`);
            }
            if (!player.name) {
                throw new Error(`Player at index ${index} is missing 'name' property.`);
            }
            return Object.freeze({ id: player.id, name: player.name });
        });

        this.#fillAllPlayerRacks();
        this.#historyCache = null;
        this.#computeHistory();
    }

    get players() {
        return [...this.#players]
    }
   
    /**
     * @return {number} The index of the next move to be made
     */
    get moveIndex() { return this.#moves.length; }

    /**
     * @return {number} The index of the current player in the players array
     */
    get currentPlayerIndex() {
        if (this.#moves.length === 0) return 0;
        return this.#moves.length % this.players.length;
    }

    /**
     * @return {TileInfo[]}
     */
    get bagTiles() {
        return this.#getBagTiles().map(tile => tile.snapshot);
    }

    /**
     * @return {MoveInfo[]}
     */
    get history() {
        let pnow = performance.now();
        this.#computeHistory();
        const result = deepCopy(this.#historyCache);
        return result;
    }

     /**
     * @return {TileInfo[]}
     */
    get tilesOnBoard() {
        return this.#tiles.filter(tile => tile.onBoard).map(tile => tile.snapshot);
    }

    /**
     * @return {TileInfo[][]}
     */
    get boardLayout() {
        const layout = tiles2board(this.#tiles);
        return layout;
    }

    /**
     * @param {string} layoutStr
     */
    get boardString() {
        return this.boardLayout.map(r => r.map(c => c ? c.letter : "-").join(" ")).join("\n");
    }


    /**
     * @return {WinInfo}
     */
    get winInfo() {
        this.#computeHistory();
        let tally = {};

        if (this.#historyCache && this.#historyCache.length > 0) {
            this.#historyCache.forEach(move => {
                if (move.moveIndex !== Infinity)  {
                    const player = move.moveIndex % this.players.length;
                    if (!tally[player]) tally[player] = 0;
                    tally[player] += move.totalScore
                }
            });
        }
        
        const playerScores = this.players.map((player, index) => ({
            ...player,
            playerIndex: index,
            score: tally[index] || 0,
        }));

        let winner = null;
        let isWinner = false;

        const indecies = this.players.map((_, index) => index);
        const emptyRackPlayer = indecies.find(index => this.getPlayerRack(index).length === 0);
        if (this.bagTiles.length === 0 && emptyRackPlayer !== undefined) {
            for (let index of indecies) {
                if (index !== emptyRackPlayer) {
                    const penalty = this.getPlayerRack(index).reduce((sum, tile) => sum + tile.value, 0);
                    playerScores[index].score -= penalty;
                    playerScores[emptyRackPlayer].score += penalty;
                }
            }
            isWinner = true;
        } 

        // If both players have consecutively skipped their turns, 
        // the game is over and the player with the highest score wins.
        if (this.#moves.join("").match(new RegExp(`${MOVE_TYPES.skip}{2,}`, "g"))) {
            isWinner = true;
        }

        let possible = playerScores;
        let movesByPlayer = this.#moves.map((move, index) => [move, index % this.players.length]);
        let resign = movesByPlayer.find(([move]) => move === MOVE_TYPES.resign);
        if (resign) {
            isWinner = true;
            let possible = playerScores.filter(player => player.playerIndex !== resign[1]);
        } 

        if (isWinner) {
            winner = possible.reduce((max, player) => player.score > max.score ? player : max, {score: -Infinity});
        }

        return {
            isWinner,
            winner,
            scores: playerScores,
        }
    }

    /**
     * True if any tile has changed since the 
     * last time change flags were cleared
     * @return {boolean} 
     */
    get hasChanged() {
        return this.#tiles.some(tile => tile.hasChanged);
    }


    /** @return {TileInfo[]} */
    get tiles() {
        return this.#tiles.map(tile => tile.snapshot);
    }


    get moves() {
        return [...this.#moves];
    }



    /**
     * @param {number} playerIndex
     * @return {TileInfo[]} Array of tile IDs in the player's rack
     */
    getPlayerRack(playerIndex) {
        return this.#getPlayerRack(playerIndex).map(tile => tile.snapshot);
    }
  
    /**
     * @param {string} tileId
     * @param {number} row
     * @param {number} col
     */
    moveToPendingPosition(tileId, row, col) {
        if (this.#tilesByID[tileId]) {
            const tile = this.#tilesByID[tileId];
            const heldByPlayer = tile.state === TILE_STATES.inPlayerRack || tile.state === TILE_STATES.pending;
            const isCurrentPlayers = tile.playerIndex === this.currentPlayerIndex;
            const occupied = this.isCellOccupied(row, col);

            if ( heldByPlayer && isCurrentPlayers && !occupied) {
                tile.moveToPendingPosition(row, col);
            } else if (occupied) {
                console.warn(`Cannot move tile ${tileId} to (${row}, ${col}): Cell is already occupied.`);
            } else if (!heldByPlayer) {
                console.warn(`Cannot move tile ${tileId} to (${row}, ${col}): Tile is not in the current player's rack.`);
            } else if (!isCurrentPlayers) {
                console.warn(`Cannot move tile ${tileId} to (${row}, ${col}): Tile belongs to another player.`);
            }
        } else {
            console.warn(`Invalid tile ID: ${tileId}`);
        }
       
    }

    /**
     * @param {string} tileId
     */
    returnTileToRack(tileId) {
        if (!this.#tilesByID[tileId]) {
            throw new Error(`Invalid tile ID: ${tileId}`);
        }
        const tile = this.#tilesByID[tileId];
        if (tile.state === TILE_STATES.pending) {
            tile.returnToPlayerRack();
        }
    }


    returnAllPendingTilesToRack() {
        this.#tiles.forEach(tile => {
            if (tile.state === TILE_STATES.pending) {
                tile.returnToPlayerRack();
            }
        });
    }


    commitTiles() {
        this.#computeHistory();
        if (this.#validationResults) {
            const currentMove = this.#validationResults.moveInfo;
            if (currentMove) {
                currentMove.placedTiles.forEach(tile => 
                    this.#tilesByID[tile.id]?.placeOnBoard(this.moveIndex)
                );
                this.#fillPlayerRack(this.currentPlayerIndex);
                this.#makeMove(MOVE_TYPES.place);
            }
        } else {
            console.warn(`Cannot commit move: ${valid.error}`);
        }
    }

    /**
     * @return {ValidationResult}
     */
    validateCurrentMove() {
        this.#computeHistory();
        const res = deepCopy(this.#validationResults);
        return res;
    }


    exchangeTiles(tileIds) {
        tileIds.forEach(tileId => {
            if (this.#tilesByID[tileId]) {
                this.#tilesByID[tileId].returnToBag();
            }
        });
        this.#fillPlayerRack(this.currentPlayerIndex);
        this.#makeMove(MOVE_TYPES.exchange);
    }


    skipTurn() {
        this.returnAllPendingTilesToRack();
        this.#makeMove(MOVE_TYPES.skip);
    }

    resign() {
        this.#makeMove(MOVE_TYPES.resign);
    }


    /** 
     * @param {number} row
     * @param {number} col
     */
    isCellOccupied(row, col) {
        return this.#getTileAt(row, col) !== null;
    }

    
    toString_v0() {
        const tilesOutofBag = this.#tiles.filter(tile => tile.state !== TILE_STATES.inBag);
        const tilesStr = tilesOutofBag.map(tile => tile.toString_v0()).join("\n");
        return JSON.stringify({
            tiles: tilesStr,
            moves: this.#moves,
        });
    }

    toString_v1() {
        const tilesOutofBag = this.#tiles.filter(tile => tile.state !== TILE_STATES.inBag);
        const tilesStr = tilesOutofBag.map(tile => tile.toString_v1()).join("_");
        return JSON.stringify({
            t: tilesStr,
            m: this.#moves.join(""),
            v: 1,
        });
    }

    toString() {
        return this.toString_v1();
    }
    
    static _fromObj_v1(obj) {
        const tiles = obj.t.split("_").map(tileStr => TileState.fromString_v1(tileStr));
        const moves = [...obj.m].map(c => Number(c));
        const gameState = new GameState(moves, tiles);
        return gameState;
    }
    static _fromObj_v0(obj) {
        const tiles = obj.tiles.split("\n").map(tileStr => TileState.fromString_v0(tileStr));
        const moves = obj.moves;
        const gameState = new GameState(moves, tiles);
        return gameState;
    }

    static fromString(str) {
        try {
            const obj = JSON.parse(str);
            const version = obj.v || 0;
            return version === 1 ? GameState._fromObj_v1(obj) : GameState._fromObj_v0(obj); 
        } catch (e) {
            console.error("Failed to parse game state string:", e);
            return new GameState();
        }
    }

    static async loadDictionary() {
        await Dictionary.load();
    }
}

export { GameState }