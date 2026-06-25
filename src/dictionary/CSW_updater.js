const fs = require("fs");
let w19 = fs.readFileSync("./src/dictionary/CSW19.txt", "utf-8");
w19 = w19.split("\n").map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
let w24 = new Set(w19);

let w24_add = fs.readFileSync("./src/dictionary/CSW24_added.txt", "utf-8");
let w24_remove = fs.readFileSync("./src/dictionary/CSW24_removed.txt", "utf-8");
w24_add = w24_add.split("\n").map(w => w.trim().toUpperCase()).filter(w => w.length > 0).forEach(w => w24.add(w));
w24_remove = w24_remove.split("\n").map(w => w.trim().toUpperCase()).filter(w => w.length > 0).forEach(w => w24.delete(w));

let w24_list = Array.from(w24).sort((a,b) => a.localeCompare(b)).join("\n");
fs.writeFileSync("./src/dictionary/CSW24.txt", w24_list, "utf-8");