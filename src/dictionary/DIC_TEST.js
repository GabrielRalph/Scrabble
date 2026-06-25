const SCRABBLE_DICTIONARY = [
    "aa",
    "aah",
    "aahed",
    "aahing",
    "aahs",
    "aal",
    "aalii",
    "aaliis",
    "aals",
    "aardvark",
    "aardvarks"
];

const wordSet = new Set(words);

async function load(){}

async function getDefinition(word) {
    return fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
}

function isWord(word) {
    return wordSet.has(word);
}

export { getDefinition, isWord, load };
