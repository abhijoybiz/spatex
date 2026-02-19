import * as o from "three";
const _ = {
  _universal: {
    pos: [0, 0, 0],
    rotate: [0, 0, 0],
    color: "#cccccc",
    opacity: 1,
    wireframe: !1,
    shadow: !1,
    label: null
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
  plane: { width: 10, height: 10 }
}, Z = { background: "#000000", fog: !1 }, U = { angle: [45, 30], zoom: 1, target: [0, 0, 0] }, te = /* @__PURE__ */ new Set(["arrow", "line"]);
new Set(Object.keys(_).filter((n) => n !== "_universal"));
function ue(n) {
  const u = [];
  let t = 0;
  const r = n.length;
  for (; t < r; ) {
    const a = n[t];
    if (/\s/.test(a)) {
      t++;
      continue;
    }
    if (a === "/" && n[t + 1] === "*") {
      for (t += 2; t < r && !(n[t] === "*" && n[t + 1] === "/"); ) t++;
      t += 2;
      continue;
    }
    if (a === "/" && n[t + 1] === "/") {
      for (; t < r && n[t] !== `
`; ) t++;
      continue;
    }
    if (a === "{") {
      u.push({ type: "LBRACE", value: "{" }), t++;
      continue;
    }
    if (a === "}") {
      u.push({ type: "RBRACE", value: "}" }), t++;
      continue;
    }
    if (a === ":") {
      u.push({ type: "COLON", value: ":" }), t++;
      continue;
    }
    if (a === ";") {
      u.push({ type: "SEMI", value: ";" }), t++;
      continue;
    }
    if (a === '"' || a === "'") {
      const p = a;
      t++;
      let g = "";
      for (; t < r && n[t] !== p; )
        n[t] === "\\" ? (t++, g += n[t] || "") : g += n[t], t++;
      t++, u.push({ type: "STRING", value: g });
      continue;
    }
    if (a === "#") {
      let p = "#";
      for (t++; t < r && /[0-9a-fA-F]/.test(n[t]); )
        p += n[t], t++;
      u.push({ type: "HASH", value: p });
      continue;
    }
    if (/[0-9]/.test(a) || a === "-" && t + 1 < r && /[0-9.]/.test(n[t + 1])) {
      let p = "";
      for (a === "-" && (p += "-", t++); t < r && /[0-9.]/.test(n[t]); )
        p += n[t], t++;
      u.push({ type: "NUMBER", value: parseFloat(p) });
      continue;
    }
    if (/[a-zA-Z_]/.test(a)) {
      let p = "";
      for (; t < r && /[a-zA-Z0-9_]/.test(n[t]); )
        p += n[t], t++;
      u.push({ type: "WORD", value: p });
      continue;
    }
    t++;
  }
  return u;
}
function N(n) {
  const u = ue(n);
  let t = 0;
  const r = () => u[t] || null, a = () => u[t++], p = (h) => {
    const m = a();
    if (!m || m.type !== h)
      throw new Error(`Expected ${h}, got ${m ? m.type + "(" + m.value + ")" : "EOF"} at #${t - 1}`);
    return m;
  };
  function g() {
    return t + 1 < u.length && u[t].type === "WORD" && u[t + 1].type === "COLON";
  }
  function S() {
    const h = r();
    if (!h || h.type !== "WORD") return !1;
    const m = u[t + 1];
    return !!(m && m.type === "LBRACE" || m && m.type === "WORD" && u[t + 2] && u[t + 2].type === "LBRACE");
  }
  function E() {
    const h = r();
    if (!h) throw new Error("Unexpected EOF in value");
    if (h.type === "STRING" || h.type === "HASH")
      return a(), h.value;
    if (h.type === "WORD" && (h.value === "true" || h.value === "false"))
      return a(), h.value === "true";
    if (h.type === "NUMBER") {
      const m = [];
      for (; r() && r().type === "NUMBER"; ) m.push(a().value);
      return m.length === 1 ? m[0] : m;
    }
    if (h.type === "WORD")
      return a(), h.value;
    throw new Error(`Unexpected token ${h.type}(${h.value}) in value`);
  }
  function R() {
    const h = {}, m = [];
    for (; r() && r().type !== "RBRACE"; )
      if (g()) {
        const k = a().value;
        p("COLON");
        const z = E();
        h[k] = z, r() && r().type === "SEMI" && a();
      } else S() ? m.push(V()) : a();
    return { properties: h, children: m };
  }
  function V() {
    const h = p("WORD").value;
    let m = null;
    r() && r().type === "WORD" && (m = a().value), p("LBRACE");
    const { properties: k, children: z } = R();
    return p("RBRACE"), { type: h, name: m, properties: k, children: z };
  }
  p("WORD"), p("LBRACE");
  const { properties: W, children: B } = R();
  return p("RBRACE"), pe(W, B);
}
function pe(n, u) {
  const t = {
    type: "scene",
    background: n.background || Z.background,
    fog: n.fog !== void 0 ? n.fog : Z.fog,
    camera: { ...U },
    objects: [],
    connectors: []
  }, r = {}, a = [];
  for (const p of u)
    if (p.type === "camera")
      t.camera = he(p.properties);
    else if (te.has(p.type))
      a.push(p);
    else if (p.type === "group") {
      const g = oe(p, r);
      t.objects.push(g);
    } else
      t.objects.push(ne(p, r));
  return t.connectors = a.map((p) => se(p, r)), t;
}
function he(n) {
  return {
    angle: T(n.angle, 2, U.angle),
    zoom: n.zoom !== void 0 ? n.zoom : U.zoom,
    target: T(n.target, 3, U.target)
  };
}
function ne(n, u) {
  const t = {
    type: n.type,
    name: n.name || null,
    ...j(_._universal)
  };
  _[n.type] && Object.assign(t, j(_[n.type]));
  for (const [r, a] of Object.entries(n.properties))
    r === "pos" ? t.pos = T(a, 3, [0, 0, 0]) : r === "rotate" ? t.rotate = T(a, 3, [0, 0, 0]) : t[r] = a;
  return n.name && (u[n.name] = t), t;
}
function oe(n, u) {
  const t = {
    type: "group",
    name: n.name || null,
    pos: T(n.properties.pos, 3, [0, 0, 0]),
    rotate: T(n.properties.rotate, 3, [0, 0, 0]),
    children: [],
    connectors: []
  };
  for (const r of n.children)
    te.has(r.type) ? t.connectors.push(r) : r.type === "group" ? t.children.push(oe(r, u)) : t.children.push(ne(r, u));
  return t.connectors = t.connectors.map((r) => se(r, u)), n.name && (u[n.name] = t), t;
}
function se(n, u) {
  const t = n.properties;
  return {
    type: n.type,
    name: n.name || null,
    from: K(t.from, u),
    to: K(t.to, u),
    color: t.color || "#ffffff",
    thickness: t.thickness !== void 0 ? t.thickness : 1,
    label: t.label || null
  };
}
function K(n, u) {
  return typeof n == "string" && u[n] ? { ref: n, pos: [...u[n].pos] } : Array.isArray(n) ? { ref: null, pos: T(n, 3, [0, 0, 0]) } : typeof n == "number" ? { ref: null, pos: [n, 0, 0] } : typeof n == "string" ? { ref: n, pos: [0, 0, 0] } : { ref: null, pos: [0, 0, 0] };
}
function T(n, u, t) {
  if (Array.isArray(n)) {
    const r = n.slice(0, u);
    for (; r.length < u; ) r.push(0);
    return r;
  }
  if (typeof n == "number") {
    const r = [n];
    for (; r.length < u; ) r.push(0);
    return r;
  }
  return t ? [...t] : new Array(u).fill(0);
}
function j(n) {
  return JSON.parse(JSON.stringify(n));
}
function ee(n, u) {
  const t = u.clientWidth || 900, r = 500, a = new o.Scene(), p = new o.WebGLRenderer({ antialias: !0, alpha: !1 });
  if (p.setSize(t, r), p.setPixelRatio(Math.min(window.devicePixelRatio, 2)), p.shadowMap.enabled = !0, p.shadowMap.type = o.PCFSoftShadowMap, p.outputEncoding = o.sRGBEncoding, p.toneMapping = o.ACESFilmicToneMapping, p.toneMappingExposure = 1, u.appendChild(p.domElement), a.background = new o.Color(n.background), n.fog) {
    const e = new o.Color(n.background);
    a.fog = new o.FogExp2(e, 0.05);
  }
  const g = n.camera, S = new o.PerspectiveCamera(50, t / r, 0.1, 1e3), E = o.MathUtils.degToRad(g.angle[0]), R = o.MathUtils.degToRad(g.angle[1]), V = 10 / g.zoom;
  S.position.set(
    V * Math.cos(R) * Math.sin(E),
    V * Math.sin(R),
    V * Math.cos(R) * Math.cos(E)
  ), S.lookAt(new o.Vector3(g.target[0], g.target[1], g.target[2]));
  const W = new o.AmbientLight(16777215, 0.5);
  a.add(W);
  const B = new o.HemisphereLight(16777215, 4473924, 0.4);
  B.position.set(0, 20, 0), a.add(B);
  const h = new o.DirectionalLight(16777215, 0.8);
  h.position.set(8, 12, 8), h.castShadow = !0, h.shadow.mapSize.width = 2048, h.shadow.mapSize.height = 2048, h.shadow.camera.near = 0.5, h.shadow.camera.far = 50, h.shadow.camera.left = -15, h.shadow.camera.right = 15, h.shadow.camera.top = 15, h.shadow.camera.bottom = -15, h.shadow.bias = -1e-3, a.add(h);
  const m = new o.DirectionalLight(16777215, 0.25);
  m.position.set(-5, 6, -5), a.add(m);
  function k(e, i, l) {
    for (const s of e)
      if (s.type === "group") {
        const f = new o.Group();
        if (f.position.set(s.pos[0], s.pos[1], s.pos[2]), s.rotate && f.rotation.set(
          o.MathUtils.degToRad(s.rotate[0]),
          o.MathUtils.degToRad(s.rotate[1]),
          o.MathUtils.degToRad(s.rotate[2])
        ), i.add(f), k(s.children, f, [
          l[0] + s.pos[0],
          l[1] + s.pos[1],
          l[2] + s.pos[2]
        ]), s.connectors)
          for (const v of s.connectors)
            $(v, f, [0, 0, 0]);
      } else {
        const f = z(s);
        f && i.add(f);
      }
  }
  function z(e) {
    let i = null, l = null, s = null;
    const v = {
      color: new o.Color(e.color),
      wireframe: e.wireframe,
      transparent: e.opacity < 1,
      opacity: e.opacity,
      side: o.DoubleSide
      // needed for 2D shapes
    };
    switch (l = new o.MeshStandardMaterial(v), e.type) {
      case "cube":
        i = new o.BoxGeometry(e.size, e.size, e.size);
        break;
      case "cuboid":
        i = new o.BoxGeometry(e.width, e.height, e.depth);
        break;
      case "sphere":
        i = new o.SphereGeometry(e.radius, 32, 32);
        break;
      case "hemisphere":
        i = new o.SphereGeometry(e.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        break;
      case "cylinder":
        i = new o.CylinderGeometry(e.radius, e.radius, e.height, 32);
        break;
      case "hollow_cylinder": {
        const d = e.radius, w = e.inner_radius !== void 0 ? e.inner_radius : d * 0.6, y = e.height, M = new o.Shape();
        M.moveTo(w, -y / 2), M.lineTo(d, -y / 2), M.lineTo(d, y / 2), M.lineTo(w, y / 2), M.lineTo(w, -y / 2), i = new o.LatheGeometry(
          M.getPoints(1),
          32
        );
        break;
      }
      case "cone":
        i = new o.ConeGeometry(e.radius, e.height, 32);
        break;
      case "hollow_cone": {
        const d = e.radius, w = e.inner_radius !== void 0 ? e.inner_radius : d * 0.4, y = e.height, M = [
          new o.Vector2(w * 0.3, y / 2),
          // inner top (narrower)
          new o.Vector2(w, -y / 2),
          // inner bottom
          new o.Vector2(d, -y / 2),
          // outer bottom
          new o.Vector2(d * 0.3, y / 2)
          // outer top (narrower)
        ];
        i = new o.LatheGeometry(M, 32);
        break;
      }
      case "square":
        i = new o.PlaneGeometry(e.size, e.size);
        break;
      case "rectangle":
        i = new o.PlaneGeometry(e.width, e.height);
        break;
      case "circle":
        i = new o.CircleGeometry(e.radius, 32);
        break;
      case "semicircle":
        i = new o.CircleGeometry(e.radius, 32, 0, Math.PI);
        break;
      case "triangle": {
        const d = e.size, w = new o.Shape();
        w.moveTo(0, d * 0.866 / 2), w.lineTo(-d / 2, -d * 0.866 / 2), w.lineTo(d / 2, -d * 0.866 / 2), w.lineTo(0, d * 0.866 / 2), i = new o.ShapeGeometry(w);
        break;
      }
      case "plane":
        i = new o.PlaneGeometry(e.width, e.height);
        break;
      case "label": {
        const d = F(e.label || e.name || "label", e.color);
        return d.position.set(e.pos[0], e.pos[1], e.pos[2]), d.scale.set(2, 1, 1), d;
      }
      default:
        return console.warn(`[SpaTeX] Unknown shape type: "${e.type}"`), null;
    }
    if (s = new o.Mesh(i, l), s.position.set(e.pos[0], e.pos[1], e.pos[2]), s.rotation.set(
      o.MathUtils.degToRad(e.rotate[0]),
      o.MathUtils.degToRad(e.rotate[1]),
      o.MathUtils.degToRad(e.rotate[2])
    ), e.shadow && (s.castShadow = !0, s.receiveShadow = !0), e.label) {
      const d = F(e.label, "#ffffff"), y = new o.Box3().setFromObject(s).max.y - e.pos[1] + 0.4;
      d.position.set(0, y, 0), d.scale.set(2.5, 0.6, 1), s.add(d);
    }
    return s;
  }
  function F(e, i) {
    const l = document.createElement("canvas"), s = l.getContext("2d");
    l.width = 512, l.height = 128, s.clearRect(0, 0, l.width, l.height);
    const f = 20;
    s.font = "bold 48px Inter, Arial, sans-serif";
    const d = s.measureText(e).width, w = Math.min(d + f * 2, l.width), y = 72, M = (l.width - w) / 2, A = (l.height - y) / 2;
    s.fillStyle = "rgba(0, 0, 0, 0.55)", q(s, M, A, w, y, 16), s.fill(), s.strokeStyle = "rgba(255, 255, 255, 0.15)", s.lineWidth = 2, q(s, M, A, w, y, 16), s.stroke(), s.fillStyle = i || "#ffffff", s.textAlign = "center", s.textBaseline = "middle", s.font = "bold 44px Inter, Arial, sans-serif", s.fillText(e, l.width / 2, l.height / 2);
    const C = new o.CanvasTexture(l);
    C.minFilter = o.LinearFilter, C.magFilter = o.LinearFilter;
    const G = new o.SpriteMaterial({
      map: C,
      transparent: !0,
      depthTest: !1,
      depthWrite: !1
    });
    return new o.Sprite(G);
  }
  function q(e, i, l, s, f, v) {
    e.beginPath(), e.moveTo(i + v, l), e.lineTo(i + s - v, l), e.quadraticCurveTo(i + s, l, i + s, l + v), e.lineTo(i + s, l + f - v), e.quadraticCurveTo(i + s, l + f, i + s - v, l + f), e.lineTo(i + v, l + f), e.quadraticCurveTo(i, l + f, i, l + f - v), e.lineTo(i, l + v), e.quadraticCurveTo(i, l, i + v, l), e.closePath();
  }
  function $(e, i, l) {
    const s = l[0], f = l[1], v = l[2], d = new o.Vector3(
      e.from.pos[0] + s,
      e.from.pos[1] + f,
      e.from.pos[2] + v
    ), w = new o.Vector3(
      e.to.pos[0] + s,
      e.to.pos[1] + f,
      e.to.pos[2] + v
    ), y = new o.Vector3().subVectors(w, d), M = y.length();
    if (M < 1e-3) return;
    const A = new o.Color(e.color);
    if (e.type === "arrow") {
      const C = Math.min(M * 0.2, 0.5), G = 0.15, O = M - C, Y = new o.CylinderGeometry(0.04, 0.04, O, 8), L = new o.MeshStandardMaterial({ color: A }), J = new o.Mesh(Y, L), ie = new o.ConeGeometry(G, C, 8), re = new o.MeshStandardMaterial({ color: A }), Q = new o.Mesh(ie, re), P = new o.Group();
      J.position.set(0, O / 2, 0), P.add(J), Q.position.set(0, O + C / 2, 0), P.add(Q), P.position.copy(d);
      const ae = new o.Vector3(0, 1, 0), ce = new o.Quaternion().setFromUnitVectors(ae, y.clone().normalize());
      if (P.setRotationFromQuaternion(ce), i.add(P), e.label) {
        const le = new o.Vector3().addVectors(d, w).multiplyScalar(0.5), X = F(e.label, "#ffffff");
        X.position.copy(le), X.position.x += 0.5, X.scale.set(2, 0.5, 1), i.add(X);
      }
    } else if (e.type === "line") {
      const C = new o.BufferGeometry().setFromPoints([d, w]), G = new o.LineBasicMaterial({ color: A, linewidth: e.thickness }), O = new o.Line(C, G);
      if (i.add(O), e.label) {
        const Y = new o.Vector3().addVectors(d, w).multiplyScalar(0.5), L = F(e.label, "#ffffff");
        L.position.copy(Y), L.position.y += 0.3, L.scale.set(2, 0.5, 1), i.add(L);
      }
    }
  }
  k(n.objects, a, [0, 0, 0]);
  for (const e of n.connectors)
    $(e, a, [0, 0, 0]);
  const c = {
    target: new o.Vector3(g.target[0], g.target[1], g.target[2]),
    spherical: new o.Spherical().setFromVector3(
      S.position.clone().sub(new o.Vector3(g.target[0], g.target[1], g.target[2]))
    ),
    isDragging: !1,
    isPanning: !1,
    prevMouse: { x: 0, y: 0 },
    rotateSpeed: 5e-3,
    panSpeed: 0.01
  };
  function I(e) {
    return Math.max(0.05, Math.min(Math.PI - 0.05, e));
  }
  const x = p.domElement;
  x.addEventListener("mousedown", (e) => {
    e.button === 0 && (c.isDragging = !0), (e.button === 2 || e.button === 1) && (c.isPanning = !0), c.prevMouse = { x: e.clientX, y: e.clientY };
  }), x.addEventListener("contextmenu", (e) => e.preventDefault()), window.addEventListener("mouseup", () => {
    c.isDragging = !1, c.isPanning = !1;
  }), window.addEventListener("mousemove", (e) => {
    const i = e.clientX - c.prevMouse.x, l = e.clientY - c.prevMouse.y;
    if (c.prevMouse = { x: e.clientX, y: e.clientY }, c.isDragging && (c.spherical.theta -= i * c.rotateSpeed, c.spherical.phi -= l * c.rotateSpeed, c.spherical.phi = I(c.spherical.phi)), c.isPanning) {
      const s = new o.Vector3(), f = new o.Vector3();
      S.matrix.extractBasis(s, f, new o.Vector3()), c.target.addScaledVector(s, -i * c.panSpeed), c.target.addScaledVector(f, l * c.panSpeed);
    }
  }), x.addEventListener("wheel", (e) => {
    e.preventDefault();
    const i = 1 + e.deltaY * 1e-3;
    c.spherical.radius *= i, c.spherical.radius = Math.max(1, Math.min(100, c.spherical.radius));
  }, { passive: !1 });
  let D = 0, b = null;
  x.addEventListener("touchstart", (e) => {
    if (e.preventDefault(), e.touches.length === 1)
      c.isDragging = !0, c.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    else if (e.touches.length === 2) {
      c.isDragging = !1;
      const i = e.touches[0].clientX - e.touches[1].clientX, l = e.touches[0].clientY - e.touches[1].clientY;
      D = Math.sqrt(i * i + l * l), b = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    }
  }, { passive: !1 }), x.addEventListener("touchmove", (e) => {
    if (e.preventDefault(), e.touches.length === 1 && c.isDragging) {
      const i = e.touches[0].clientX - c.prevMouse.x, l = e.touches[0].clientY - c.prevMouse.y;
      c.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }, c.spherical.theta -= i * c.rotateSpeed, c.spherical.phi -= l * c.rotateSpeed, c.spherical.phi = I(c.spherical.phi);
    } else if (e.touches.length === 2) {
      const i = e.touches[0].clientX - e.touches[1].clientX, l = e.touches[0].clientY - e.touches[1].clientY, s = Math.sqrt(i * i + l * l);
      if (D > 0) {
        const d = D / s;
        c.spherical.radius *= d, c.spherical.radius = Math.max(1, Math.min(100, c.spherical.radius));
      }
      D = s;
      const f = (e.touches[0].clientX + e.touches[1].clientX) / 2, v = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (b) {
        const d = f - b.x, w = v - b.y, y = new o.Vector3(), M = new o.Vector3();
        S.matrix.extractBasis(y, M, new o.Vector3()), c.target.addScaledVector(y, -d * c.panSpeed), c.target.addScaledVector(M, w * c.panSpeed);
      }
      b = { x: f, y: v };
    }
  }, { passive: !1 }), x.addEventListener("touchend", () => {
    c.isDragging = !1, D = 0, b = null;
  });
  function H() {
    requestAnimationFrame(H);
    const e = new o.Vector3().setFromSpherical(c.spherical);
    S.position.copy(c.target).add(e), S.lookAt(c.target), p.render(a, S);
  }
  return H(), new ResizeObserver(() => {
    const e = u.clientWidth, i = 500;
    S.aspect = e / i, S.updateProjectionMatrix(), p.setSize(e, i);
  }).observe(u), { scene: a, camera: S, renderer: p };
}
const fe = {
  /**
   * Parse a spatex string and return a JSON scene tree.
   *
   * @param {string} code - Raw spatex source code
   * @returns {Object} Parsed scene tree with defaults applied
   */
  parse(n) {
    return N(n);
  },
  /**
   * Render a spatex string into a given DOM container element.
   * Parses the code, builds a Three.js scene, and mounts it inside the container.
   *
   * @param {string} code - Raw spatex source code
   * @param {HTMLElement} container - DOM element to render into
   * @returns {{ scene: object, camera: object, renderer: object }} Three.js handles
   */
  render(n, u) {
    const t = N(n);
    return ee(t, u);
  },
  /**
   * Auto-scan the page for `<code class="language-spatex">` blocks
   * (which is what most Markdown renderers produce from triple-backtick
   * spatex blocks) and render them all in-place.
   *
   * Also scans for `<code class="language-3d">` for backwards compatibility.
   */
  autoRender() {
    const n = [
      "code.language-spatex",
      "code.language-3d"
    ];
    document.querySelectorAll(n.join(", ")).forEach((t, r) => {
      const a = t.textContent.trim(), p = t.parentElement;
      try {
        const g = N(a);
        console.log(
          `%c[SpaTeX] Scene #${r + 1} parsed:`,
          "color: #6366f1; font-weight: bold;",
          g
        );
        const S = document.createElement("div");
        S.className = "spatex-container", S.id = `spatex-scene-${r}`;
        const E = document.createElement("div");
        E.className = "spatex-badge", E.textContent = "SpaTeX", S.appendChild(E);
        const R = document.createElement("div");
        R.className = "spatex-controls-hint", R.textContent = "🖱 Drag to orbit · Scroll to zoom · Right-drag to pan", S.appendChild(R), p.replaceWith(S), ee(g, S), setTimeout(() => {
          R.style.opacity = "0", setTimeout(() => R.remove(), 500);
        }, 4e3);
      } catch (g) {
        console.error(`[SpaTeX] Error in scene #${r + 1}:`, g), t.style.borderColor = "#ef4444", t.style.color = "#fca5a5", t.textContent = `Parse Error: ${g.message}

${a}`;
      }
    });
  }
};
export {
  fe as default,
  N as parse,
  ee as render
};
