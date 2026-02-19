/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SPATEX PARSER                                          ║
 * ║  DSL → JSON scene tree                                  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

// ──────────────────────────────────────────────────────────
//  DEFAULTS
// ──────────────────────────────────────────────────────────

const SHAPE_DEFAULTS = {
    _universal: {
        pos: [0, 0, 0],
        rotate: [0, 0, 0],
        color: '#cccccc',
        opacity: 1,
        wireframe: false,
        shadow: false,
        label: null,
    },
    cube: { size: 1 },
    cuboid: { width: 1, height: 1, depth: 1 },
    sphere: { radius: 1 },
    hemisphere: { radius: 1 },
    cylinder: { radius: 1, height: 2 },
    hollow_cylinder: { radius: 1, inner_radius: 0.5, height: 2, thickness: null },
    cone: { radius: 1, height: 2 },
    hollow_cone: { radius: 1, inner_radius: 0.5, height: 2, thickness: null },
    square: { size: 1 },
    rectangle: { width: 2, height: 1 },
    circle: { radius: 1 },
    semicircle: { radius: 1 },
    triangle: { size: 1 },
    plane: { width: 10, height: 10 },
};

const SCENE_DEFAULTS = { background: '#000000', fog: false };
const CAMERA_DEFAULTS = { angle: [45, 30], zoom: 1, target: [0, 0, 0] };

const CONNECTOR_TYPES = new Set(['arrow', 'line']);
const ALL_SHAPE_TYPES = new Set(Object.keys(SHAPE_DEFAULTS).filter(k => k !== '_universal'));

// ──────────────────────────────────────────────────────────
//  TOKENIZER
// ──────────────────────────────────────────────────────────

/**
 * Tokenizes a raw spatex source string into an array of token objects.
 * @param {string} src - Raw spatex source code
 * @returns {Array<{type: string, value: *}>} Array of tokens
 */
function tokenize(src) {
    const tokens = [];
    let i = 0;
    const len = src.length;

    while (i < len) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }

        // Block comments: /* ... */
        if (ch === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2; continue;
        }
        // Line comments: // ...
        if (ch === '/' && src[i + 1] === '/') {
            while (i < len && src[i] !== '\n') i++;
            continue;
        }

        if (ch === '{') { tokens.push({ type: 'LBRACE', value: '{' }); i++; continue; }
        if (ch === '}') { tokens.push({ type: 'RBRACE', value: '}' }); i++; continue; }
        if (ch === ':') { tokens.push({ type: 'COLON', value: ':' }); i++; continue; }
        if (ch === ';') { tokens.push({ type: 'SEMI', value: ';' }); i++; continue; }

        // String
        if (ch === '"' || ch === "'") {
            const q = ch; i++;
            let s = '';
            while (i < len && src[i] !== q) {
                if (src[i] === '\\') { i++; s += src[i] || ''; }
                else { s += src[i]; }
                i++;
            }
            i++;
            tokens.push({ type: 'STRING', value: s });
            continue;
        }

        // Hex color
        if (ch === '#') {
            let hex = '#'; i++;
            while (i < len && /[0-9a-fA-F]/.test(src[i])) { hex += src[i]; i++; }
            tokens.push({ type: 'HASH', value: hex });
            continue;
        }

        // Number
        if (/[0-9]/.test(ch) || (ch === '-' && i + 1 < len && /[0-9.]/.test(src[i + 1]))) {
            let num = '';
            if (ch === '-') { num += '-'; i++; }
            while (i < len && /[0-9.]/.test(src[i])) { num += src[i]; i++; }
            tokens.push({ type: 'NUMBER', value: parseFloat(num) });
            continue;
        }

        // Word
        if (/[a-zA-Z_]/.test(ch)) {
            let w = '';
            while (i < len && /[a-zA-Z0-9_]/.test(src[i])) { w += src[i]; i++; }
            tokens.push({ type: 'WORD', value: w });
            continue;
        }

        i++; // skip unknown
    }
    return tokens;
}

// ──────────────────────────────────────────────────────────
//  RECURSIVE DESCENT PARSER
// ──────────────────────────────────────────────────────────

/**
 * Parses a raw spatex string and returns a clean JSON scene tree
 * with all defaults applied.
 *
 * @param {string} src - Raw spatex source code
 * @returns {{
 *   type: string,
 *   background: string,
 *   fog: boolean,
 *   camera: { angle: number[], zoom: number, target: number[] },
 *   objects: Array<Object>,
 *   connectors: Array<Object>
 * }} Parsed scene tree
 */
function parse(src) {
    const tokens = tokenize(src);
    let pos = 0;

    const peek = () => tokens[pos] || null;
    const advance = () => tokens[pos++];
    const expect = (type) => {
        const t = advance();
        if (!t || t.type !== type)
            throw new Error(`Expected ${type}, got ${t ? t.type + '(' + t.value + ')' : 'EOF'} at #${pos - 1}`);
        return t;
    };

    function isProperty() {
        return pos + 1 < tokens.length &&
            tokens[pos].type === 'WORD' &&
            tokens[pos + 1].type === 'COLON';
    }

    function isChildBlock() {
        const t = peek();
        if (!t || t.type !== 'WORD') return false;
        const t1 = tokens[pos + 1];
        if (t1 && t1.type === 'LBRACE') return true;
        if (t1 && t1.type === 'WORD' && tokens[pos + 2] && tokens[pos + 2].type === 'LBRACE') return true;
        return false;
    }

    function parseValue() {
        const t = peek();
        if (!t) throw new Error('Unexpected EOF in value');
        if (t.type === 'STRING') { advance(); return t.value; }
        if (t.type === 'HASH') { advance(); return t.value; }
        if (t.type === 'WORD' && (t.value === 'true' || t.value === 'false')) {
            advance(); return t.value === 'true';
        }
        if (t.type === 'NUMBER') {
            const nums = [];
            while (peek() && peek().type === 'NUMBER') nums.push(advance().value);
            return nums.length === 1 ? nums[0] : nums;
        }
        if (t.type === 'WORD') { advance(); return t.value; }
        throw new Error(`Unexpected token ${t.type}(${t.value}) in value`);
    }

    function parseBlock() {
        const properties = {};
        const children = [];
        while (peek() && peek().type !== 'RBRACE') {
            if (isProperty()) {
                const key = advance().value;
                expect('COLON');
                const val = parseValue();
                properties[key] = val;
                if (peek() && peek().type === 'SEMI') advance();
            } else if (isChildBlock()) {
                children.push(parseChild());
            } else {
                advance(); // skip
            }
        }
        return { properties, children };
    }

    function parseChild() {
        const shapeType = expect('WORD').value;
        let name = null;
        if (peek() && peek().type === 'WORD') name = advance().value;
        expect('LBRACE');
        const { properties, children } = parseBlock();
        expect('RBRACE');
        return { type: shapeType, name, properties, children };
    }

    // Entry: scene { ... }
    expect('WORD'); // "scene"
    expect('LBRACE');
    const { properties: sceneProps, children: sceneChildren } = parseBlock();
    expect('RBRACE');
    return buildSceneTree(sceneProps, sceneChildren);
}

// ──────────────────────────────────────────────────────────
//  SCENE TREE BUILDER  (apply defaults, resolve refs)
// ──────────────────────────────────────────────────────────

function buildSceneTree(sceneProps, rawChildren) {
    const scene = {
        type: 'scene',
        background: sceneProps.background || SCENE_DEFAULTS.background,
        fog: sceneProps.fog !== undefined ? sceneProps.fog : SCENE_DEFAULTS.fog,
        camera: { ...CAMERA_DEFAULTS },
        objects: [],
        connectors: [],
    };

    const registry = {};
    const deferredConnectors = [];

    for (const child of rawChildren) {
        if (child.type === 'camera') {
            scene.camera = buildCamera(child.properties);
        } else if (CONNECTOR_TYPES.has(child.type)) {
            deferredConnectors.push(child);
        } else if (child.type === 'group') {
            const grp = buildGroup(child, registry);
            scene.objects.push(grp);
        } else {
            scene.objects.push(buildObject(child, registry));
        }
    }

    // Resolve connectors
    scene.connectors = deferredConnectors.map(c => buildConnector(c, registry));

    return scene;
}

function buildCamera(props) {
    return {
        angle: normalizeVec(props.angle, 2, CAMERA_DEFAULTS.angle),
        zoom: props.zoom !== undefined ? props.zoom : CAMERA_DEFAULTS.zoom,
        target: normalizeVec(props.target, 3, CAMERA_DEFAULTS.target),
    };
}

function buildObject(node, registry) {
    const obj = {
        type: node.type,
        name: node.name || null,
        ...deepClone(SHAPE_DEFAULTS._universal),
    };
    if (SHAPE_DEFAULTS[node.type]) Object.assign(obj, deepClone(SHAPE_DEFAULTS[node.type]));

    for (const [k, v] of Object.entries(node.properties)) {
        if (k === 'pos') { obj.pos = normalizeVec(v, 3, [0, 0, 0]); }
        else if (k === 'rotate') { obj.rotate = normalizeVec(v, 3, [0, 0, 0]); }
        else { obj[k] = v; }
    }

    if (node.name) registry[node.name] = obj;
    return obj;
}

function buildGroup(node, registry) {
    const grp = {
        type: 'group',
        name: node.name || null,
        pos: normalizeVec(node.properties.pos, 3, [0, 0, 0]),
        rotate: normalizeVec(node.properties.rotate, 3, [0, 0, 0]),
        children: [],
        connectors: [],
    };

    for (const child of node.children) {
        if (CONNECTOR_TYPES.has(child.type)) {
            grp.connectors.push(child); // defer
        } else if (child.type === 'group') {
            grp.children.push(buildGroup(child, registry));
        } else {
            grp.children.push(buildObject(child, registry));
        }
    }

    // Resolve group-level connectors
    grp.connectors = grp.connectors.map(c => buildConnector(c, registry));

    if (node.name) registry[node.name] = grp;
    return grp;
}

function buildConnector(node, registry) {
    const p = node.properties;
    return {
        type: node.type,
        name: node.name || null,
        from: resolveRef(p.from, registry),
        to: resolveRef(p.to, registry),
        color: p.color || '#ffffff',
        thickness: p.thickness !== undefined ? p.thickness : 1,
        label: p.label || null,
    };
}

function resolveRef(val, reg) {
    if (typeof val === 'string' && reg[val])
        return { ref: val, pos: [...reg[val].pos] };
    if (Array.isArray(val))
        return { ref: null, pos: normalizeVec(val, 3, [0, 0, 0]) };
    if (typeof val === 'number')
        return { ref: null, pos: [val, 0, 0] };
    if (typeof val === 'string')
        return { ref: val, pos: [0, 0, 0] }; // unresolved
    return { ref: null, pos: [0, 0, 0] };
}

function normalizeVec(val, len, fb) {
    if (Array.isArray(val)) {
        const v = val.slice(0, len);
        while (v.length < len) v.push(0);
        return v;
    }
    if (typeof val === 'number') {
        const v = [val]; while (v.length < len) v.push(0); return v;
    }
    return fb ? [...fb] : new Array(len).fill(0);
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

// ──────────────────────────────────────────────────────────
//  EXPORTS
// ──────────────────────────────────────────────────────────

export { parse, tokenize };
export default parse;
