 /**
     * @typedef {Object} TPos
     * @property {number} r
     * @property {number} c
     * @property {string} loc
     * @property {number} x
     * @property {number} y
     * @property {number} index
     * 
     * @typedef {Object} LoopCorner
     * @property {number} x
     * @property {number} y
     * @property {boolean} internal
     * @property {number} angle
     */

import { Vector } from "../squidly-utils.js";


/**
 * @param {TPos[]} tiles
 */
function findConnectedComponents(tiles) {
    const map = new Map();

    for (const tile of tiles) {
        map.set(tile.loc, tile);
    }

    const visited = new Set();
    const components = [];

    for (const tile of tiles) {
        if (visited.has(tile.loc))
            continue;

        const component = [];
        const queue = [tile];

        visited.add(tile.loc);

        while (queue.length) {
            const current = queue.pop();
            component.push(current);

            const neighbors = [
                [current.r - 1, current.c],
                [current.r + 1, current.c],
                [current.r, current.c - 1],
                [current.r, current.c + 1]
            ];

            for (const [r, c] of neighbors) {
                const k = `${r},${c}`;
                if (!map.has(k) || visited.has(k))
                    continue;
                visited.add(k);
                queue.push(map.get(k));
            }
        }
        components.push(component);
    }
    return components;
}

function extractBoundaryEdges(component, S) {
    const tileSet = new Set(component.map(t => t.loc));
    const has = (r, c) => tileSet.has(`${r},${c}`);
    const edges = [];
    for (const tile of component) {
        const { x, y, r, c } = tile;
        const h = S * 0.5;
        const TL = [x - h, y - h];
        const TR = [x + h, y - h];
        const BR = [x + h, y + h];
        const BL = [x - h, y + h];
        if (!has(r - 1, c)) edges.push([TL, TR]); // top
        if (!has(r, c + 1)) edges.push([TR, BR]); // right
        if (!has(r + 1, c)) edges.push([BR, BL]); // bottom
        if (!has(r, c - 1)) edges.push([BL, TL]);; // left
    }
    return edges;
}

function traceBoundaryLoop(edges) {
    const key = (v) => `${v[0]},${v[1]}`;
    const sameVertex = (a, b) => a[0] === b[0] && a[1] === b[1];

    let visited = new Map();
    let loop = [edges[0][0], edges[0][1]];
    visited.set(edges[0], true);
    for (let i = 0; i < edges.length-1; i++) {
        const start = loop[0]
        for (let edge of edges) {
            if (!visited.has(edge)) {
                if (sameVertex(edge[0], start)) {
                    loop.unshift(edge[1]);
                    visited.set(edge, true);
                    break;
                } else if (sameVertex(edge[1], start)) {
                    loop.unshift(edge[0]);
                    visited.set(edge, true);
                    break;
                }
            }
        }
    }

    return loop;
}


/**
 * @param {Array<[number, number]>} poly
 * @return {LoopCorner[]}
 */
function classifyCorners(poly) {
    const corners = [];

    const n = poly.length;

    for (let i = 0; i < n; i++) {
        const prev = poly[(i - 1 + n) % n];
        const curr = poly[i];
        const next = poly[(i + 1) % n];

        const ax = curr[0] - prev[0];
        const ay = curr[1] - prev[1];

        const bx = next[0] - curr[0];
        const by = next[1] - curr[1];

        const cross = ax * by - ay * bx;

        // if (cross === 0)
        //     continue;

        corners.push({
            x: curr[0],
            y: curr[1],
            internal: cross > 0,
            angle: cross > 0
                ? 90
                : 270
        });
    }

    return corners;
}

function signedArea(poly) {
    let area = 0;

    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];

        area += a[0] * b[1];
        area -= b[0] * a[1];
    }

    return area * 0.5;
}

function ensureCCW(poly) {
    if (signedArea(poly) < 0)
        poly.reverse();
}




/**
 * @param {TPos[]} tiles
 * @param {number} S
 * @returns {Array<{tiles: TPos[], loop: LoopCorner[]}>}
 */
function findPerimeterPaths(tiles, S) {
    let times = {
        cc: 0,
        edges: 0,
        loop: 0,
        poly: 0
    }
    let tic = (key) => {
        let now = performance.now();
        return () => {
            times[key] += performance.now() - now;
        }
    }

    let toc = tic("cc");
    const components = findConnectedComponents(tiles);
    toc();

    return components.map(component => {
        toc = tic("edges");
        const edges = extractBoundaryEdges(component, S);
        toc();
        
        toc = tic("loop");
        const poly = traceBoundaryLoop(edges);
        toc();

        toc = tic("poly");
        ensureCCW(poly);
        toc();

        return {
            tiles: component,
            loop: classifyCorners(poly),
        };
    });
}


function createSVGPath(loop, cornerRadius) {
    loop = loop.map(p => new Vector(p));
    loop.pop();
    let n = loop.length;

    /** @type {(number) => Vector} */
    let get = (i) => loop[(i + n) % n];

   
    let path = "";
    if (cornerRadius === 0) {
        path = "M" + loop.map(({x,y}) => `${x},${y}`).join("L") + "Z";
    } else {
        let center = get(0).add(get(-1)).div(2);
        loop.unshift(center);
        n += 1;
        path = `M${get(0).x},${get(0).y}`;
        for (let i = 0; i < n; i++) {
            const prev = get(i - 1);
            const curr = get(i);
            const next = get(i + 1);

            const l1 = curr.sub(prev).norm();
            const l2 = next.sub(curr).norm();
            const v1 = curr.sub(prev).dir();
            const v2 = next.sub(curr).dir();

            const angleBetween = Math.acos(v1.dot(v2));
            const delta = Math.tan((Math.PI - angleBetween) * 0.5) * cornerRadius;
            if (delta > l1 || delta > l2) {
                path += `L${curr.x},${curr.y}`;
            } else {
                const p1 = curr.sub(v1.mul(delta));
                const p2 = curr.add(v2.mul(delta));
                const cross = v1.x * v2.y - v1.y * v2.x;
                const sweepFlag = cross > 0 ? 1 : 0;
                path += `L${p1.x},${p1.y}A${cornerRadius},${cornerRadius} 0 0,${sweepFlag} ${p2.x},${p2.y}`;
            }
        }
        path += "Z";
    }
    return path;
}

export {
    findConnectedComponents,
    extractBoundaryEdges,
    traceBoundaryLoop,
    classifyCorners,
    signedArea,
    ensureCCW,
    findPerimeterPaths,
    createSVGPath
}