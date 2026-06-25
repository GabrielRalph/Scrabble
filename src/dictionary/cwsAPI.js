const cache = new Map();
const words = new Set();
async function getDefinition(word, isFriendly) {
    let record = null;
    if (cache.has(word)) {
        record = cache.get(word);
    } else {
        let res = await (await fetch(`https://scrabblechecker.collinsdictionary.com/check/api/index.php?key=${word}&isFriendly=${isFriendly?1:0}&nocache=${Date.now()}`)).json();
        if (res && res.success) {
            record = res.data;
            cache.set(word, record);
        }
    }
    return record;
}


function isWord(word) { 
    return words.has(word.toLowerCase());
}

async function load() {
    if (words.size > 0) return;
    const wordsList = await (await fetch(import.meta.resolve("./CSW24.txt"))).text();
    wordsList.split("\n").forEach(word => {
        words.add(word.trim().toLowerCase());
    });
}

export { getDefinition, isWord, load };