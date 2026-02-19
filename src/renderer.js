/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SPATEX RENDERER                                        ║
 * ║  JSON scene tree → Three.js interactive scene           ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import * as THREE from 'three';

/**
 * Renders a parsed scene tree into a Three.js scene inside the given container.
 * Sets up camera, lighting, orbit controls (mouse + touch), labels, arrows,
 * lines, groups, shadows, and wireframe. Returns the Three.js scene, camera,
 * and renderer for advanced use.
 *
 * @param {Object} sceneTree - The parsed scene JSON (output of `parse()`)
 * @param {HTMLElement} container - DOM element to render into
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer }}
 */
function render(sceneTree, container) {
    // ── Setup ──────────────────────────────────────────────
    const width = container.clientWidth || 900;
    const height = 500;

    const scene = new THREE.Scene();
    const threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    threeRenderer.setSize(width, height);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.shadowMap.enabled = true;
    threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeRenderer.outputEncoding = THREE.sRGBEncoding;
    threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    threeRenderer.toneMappingExposure = 1.0;

    container.appendChild(threeRenderer.domElement);

    // Background
    scene.background = new THREE.Color(sceneTree.background);

    // Fog
    if (sceneTree.fog) {
        const bgColor = new THREE.Color(sceneTree.background);
        scene.fog = new THREE.FogExp2(bgColor, 0.05);
    }

    // ── Camera ─────────────────────────────────────────────
    const cam = sceneTree.camera;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

    // Convert spherical angles to camera position
    const hAngle = THREE.MathUtils.degToRad(cam.angle[0]);
    const vAngle = THREE.MathUtils.degToRad(cam.angle[1]);
    const dist = 10 / cam.zoom;

    camera.position.set(
        dist * Math.cos(vAngle) * Math.sin(hAngle),
        dist * Math.sin(vAngle),
        dist * Math.cos(vAngle) * Math.cos(hAngle)
    );
    camera.lookAt(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]));

    // ── Lighting ───────────────────────────────────────────
    // Ambient for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    // Hemisphere light for natural sky-ground gradient
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Main directional light with shadows
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(8, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
    fillLight.position.set(-5, 6, -5);
    scene.add(fillLight);

    // ── Label collection (sprite-based) ────────────────────
    const labels = [];

    // ── Add objects ────────────────────────────────────────
    function addObjectsToParent(objects, parent, groupOffset) {
        for (const obj of objects) {
            if (obj.type === 'group') {
                const group = new THREE.Group();
                group.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);
                if (obj.rotate) {
                    group.rotation.set(
                        THREE.MathUtils.degToRad(obj.rotate[0]),
                        THREE.MathUtils.degToRad(obj.rotate[1]),
                        THREE.MathUtils.degToRad(obj.rotate[2])
                    );
                }
                parent.add(group);

                addObjectsToParent(obj.children, group, [
                    groupOffset[0] + obj.pos[0],
                    groupOffset[1] + obj.pos[1],
                    groupOffset[2] + obj.pos[2],
                ]);

                // Group connectors — use [0,0,0] offset because the THREE.Group
                // already applies the group transform, so connector positions
                // should be in the group's local coordinate space.
                if (obj.connectors) {
                    for (const conn of obj.connectors) {
                        addConnector(conn, group, [0, 0, 0]);
                    }
                }
            } else {
                const mesh = createMesh(obj);
                if (mesh) {
                    parent.add(mesh);
                }
            }
        }
    }

    function createMesh(obj) {
        let geometry = null;
        let material = null;
        let mesh = null;

        const color = new THREE.Color(obj.color);

        // ── Material ─────────────────────────────────────────
        const matOpts = {
            color,
            wireframe: obj.wireframe,
            transparent: obj.opacity < 1,
            opacity: obj.opacity,
            side: THREE.DoubleSide, // needed for 2D shapes
        };

        material = new THREE.MeshStandardMaterial(matOpts);

        // ── Geometry by type ─────────────────────────────────
        switch (obj.type) {
            case 'cube':
                geometry = new THREE.BoxGeometry(obj.size, obj.size, obj.size);
                break;

            case 'cuboid':
                geometry = new THREE.BoxGeometry(obj.width, obj.height, obj.depth);
                break;

            case 'sphere':
                geometry = new THREE.SphereGeometry(obj.radius, 32, 32);
                break;

            case 'hemisphere':
                // SphereGeometry with phi range for half sphere
                geometry = new THREE.SphereGeometry(obj.radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
                break;

            case 'cylinder':
                geometry = new THREE.CylinderGeometry(obj.radius, obj.radius, obj.height, 32);
                break;

            case 'hollow_cylinder': {
                // Lathe geometry: cross-section rectangle rotated around Y axis
                const outerR = obj.radius;
                const innerR = obj.inner_radius !== undefined ? obj.inner_radius : outerR * 0.6;
                const h = obj.height;
                // Create shape as cross-section, then lathe it
                const shape = new THREE.Shape();
                shape.moveTo(innerR, -h / 2);
                shape.lineTo(outerR, -h / 2);
                shape.lineTo(outerR, h / 2);
                shape.lineTo(innerR, h / 2);
                shape.lineTo(innerR, -h / 2);

                geometry = new THREE.LatheGeometry(
                    shape.getPoints(1),
                    32
                );
                break;
            }

            case 'cone':
                geometry = new THREE.ConeGeometry(obj.radius, obj.height, 32);
                break;

            case 'hollow_cone': {
                const outerR = obj.radius;
                const innerR = obj.inner_radius !== undefined ? obj.inner_radius : outerR * 0.4;
                const h = obj.height;

                // Build as a lathe of a trapezoidal cross section
                const points = [
                    new THREE.Vector2(innerR * 0.3, h / 2),    // inner top (narrower)
                    new THREE.Vector2(innerR, -h / 2),          // inner bottom
                    new THREE.Vector2(outerR, -h / 2),          // outer bottom
                    new THREE.Vector2(outerR * 0.3, h / 2),    // outer top (narrower)
                ];
                geometry = new THREE.LatheGeometry(points, 32);
                break;
            }

            // ── 2D Shapes (rendered as flat geometry in 3D space) ──
            case 'square':
                geometry = new THREE.PlaneGeometry(obj.size, obj.size);
                break;

            case 'rectangle':
                geometry = new THREE.PlaneGeometry(obj.width, obj.height);
                break;

            case 'circle':
                geometry = new THREE.CircleGeometry(obj.radius, 32);
                break;

            case 'semicircle':
                geometry = new THREE.CircleGeometry(obj.radius, 32, 0, Math.PI);
                break;

            case 'triangle': {
                const s = obj.size;
                const triShape = new THREE.Shape();
                triShape.moveTo(0, s * 0.866 / 2);
                triShape.lineTo(-s / 2, -s * 0.866 / 2);
                triShape.lineTo(s / 2, -s * 0.866 / 2);
                triShape.lineTo(0, s * 0.866 / 2);
                geometry = new THREE.ShapeGeometry(triShape);
                break;
            }

            case 'plane':
                geometry = new THREE.PlaneGeometry(obj.width, obj.height);
                break;

            case 'label': {
                // Standalone label — no geometry, just a sprite
                const sprite = createLabelSprite(obj.label || obj.name || 'label', obj.color);
                sprite.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);
                sprite.scale.set(2, 1, 1);
                return sprite;
            }

            default:
                console.warn(`[SpaTeX] Unknown shape type: "${obj.type}"`);
                return null;
        }

        mesh = new THREE.Mesh(geometry, material);

        // Position
        mesh.position.set(obj.pos[0], obj.pos[1], obj.pos[2]);

        // Rotation (degrees → radians)
        mesh.rotation.set(
            THREE.MathUtils.degToRad(obj.rotate[0]),
            THREE.MathUtils.degToRad(obj.rotate[1]),
            THREE.MathUtils.degToRad(obj.rotate[2])
        );

        // Shadows
        if (obj.shadow) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }

        // Label — sprite above the mesh
        if (obj.label) {
            const sprite = createLabelSprite(obj.label, '#ffffff');
            // Position label above the object
            const bbox = new THREE.Box3().setFromObject(mesh);
            const topY = bbox.max.y - obj.pos[1] + 0.4;
            sprite.position.set(0, topY, 0);
            sprite.scale.set(2.5, 0.6, 1);
            mesh.add(sprite);
        }

        return mesh;
    }

    // ── Create a text sprite label ─────────────────────────
    function createLabelSprite(text, color) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background pill
        const padding = 20;
        ctx.font = 'bold 48px Inter, Arial, sans-serif';
        const metrics = ctx.measureText(text);
        const textW = metrics.width;
        const pillW = Math.min(textW + padding * 2, canvas.width);
        const pillH = 72;
        const pillX = (canvas.width - pillW) / 2;
        const pillY = (canvas.height - pillH) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        roundRect(ctx, pillX, pillY, pillW, pillH, 16);
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        roundRect(ctx, pillX, pillY, pillW, pillH, 16);
        ctx.stroke();

        // Text
        ctx.fillStyle = color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 44px Inter, Arial, sans-serif';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        return new THREE.Sprite(spriteMat);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── Add connectors (arrows & lines) ───────────────────
    function addConnector(conn, parent, groupOffset) {
        const gx = groupOffset[0], gy = groupOffset[1], gz = groupOffset[2];
        const from = new THREE.Vector3(
            conn.from.pos[0] + gx,
            conn.from.pos[1] + gy,
            conn.from.pos[2] + gz
        );
        const to = new THREE.Vector3(
            conn.to.pos[0] + gx,
            conn.to.pos[1] + gy,
            conn.to.pos[2] + gz
        );

        const dir = new THREE.Vector3().subVectors(to, from);
        const length = dir.length();

        if (length < 0.001) return; // skip zero-length

        const connColor = new THREE.Color(conn.color);

        if (conn.type === 'arrow') {
            // ── Arrow: tube body + cone head ───────────────────
            const headLength = Math.min(length * 0.2, 0.5);
            const headWidth = 0.15;
            const bodyLength = length - headLength;

            // Body (tube along Y, then oriented)
            const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, bodyLength, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: connColor });
            const body = new THREE.Mesh(bodyGeo, bodyMat);

            // Head (cone)
            const headGeo = new THREE.ConeGeometry(headWidth, headLength, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: connColor });
            const head = new THREE.Mesh(headGeo, headMat);

            // Group them
            const arrowGroup = new THREE.Group();

            // Body centered along local Y
            body.position.set(0, bodyLength / 2, 0);
            arrowGroup.add(body);

            // Head at the tip
            head.position.set(0, bodyLength + headLength / 2, 0);
            arrowGroup.add(head);

            // Position at 'from'
            arrowGroup.position.copy(from);

            // Orient to point from → to
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
            arrowGroup.setRotationFromQuaternion(quat);

            parent.add(arrowGroup);

            // Label at midpoint
            if (conn.label) {
                const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
                const label = createLabelSprite(conn.label, '#ffffff');
                label.position.copy(mid);
                label.position.x += 0.5;
                label.scale.set(2, 0.5, 1);
                parent.add(label);
            }

        } else if (conn.type === 'line') {
            // ── Line: simple line geometry ─────────────────────
            const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
            const mat = new THREE.LineBasicMaterial({ color: connColor, linewidth: conn.thickness });
            const line = new THREE.Line(geo, mat);
            parent.add(line);

            // Label at midpoint
            if (conn.label) {
                const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
                const label = createLabelSprite(conn.label, '#ffffff');
                label.position.copy(mid);
                label.position.y += 0.3;
                label.scale.set(2, 0.5, 1);
                parent.add(label);
            }
        }
    }

    // ── Build the scene ────────────────────────────────────
    addObjectsToParent(sceneTree.objects, scene, [0, 0, 0]);

    // Scene-level connectors
    for (const conn of sceneTree.connectors) {
        addConnector(conn, scene, [0, 0, 0]);
    }

    // ── Orbit Controls (inline implementation) ─────────────
    // Since OrbitControls isn't bundled with Three.js r128 core,
    // we implement a lightweight version here.
    const orbitState = {
        target: new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]),
        spherical: new THREE.Spherical().setFromVector3(
            camera.position.clone().sub(new THREE.Vector3(cam.target[0], cam.target[1], cam.target[2]))
        ),
        isDragging: false,
        isPanning: false,
        prevMouse: { x: 0, y: 0 },
        rotateSpeed: 0.005,
        panSpeed: 0.01,
        zoomSpeed: 0.1,
        dampingFactor: 0.05,
        // Velocity for damping
        rotVel: { theta: 0, phi: 0 },
    };

    // Clamp phi to avoid flipping
    function clampPhi(phi) {
        return Math.max(0.05, Math.min(Math.PI - 0.05, phi));
    }

    const canvasEl = threeRenderer.domElement;

    canvasEl.addEventListener('mousedown', (e) => {
        if (e.button === 0) { orbitState.isDragging = true; }
        if (e.button === 2 || e.button === 1) { orbitState.isPanning = true; }
        orbitState.prevMouse = { x: e.clientX, y: e.clientY };
    });

    canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mouseup', () => {
        orbitState.isDragging = false;
        orbitState.isPanning = false;
    });

    window.addEventListener('mousemove', (e) => {
        const dx = e.clientX - orbitState.prevMouse.x;
        const dy = e.clientY - orbitState.prevMouse.y;
        orbitState.prevMouse = { x: e.clientX, y: e.clientY };

        if (orbitState.isDragging) {
            orbitState.spherical.theta -= dx * orbitState.rotateSpeed;
            orbitState.spherical.phi -= dy * orbitState.rotateSpeed;
            orbitState.spherical.phi = clampPhi(orbitState.spherical.phi);
        }

        if (orbitState.isPanning) {
            // Pan along camera's local right and up vectors
            const right = new THREE.Vector3();
            const up = new THREE.Vector3();
            camera.matrix.extractBasis(right, up, new THREE.Vector3());
            orbitState.target.addScaledVector(right, -dx * orbitState.panSpeed);
            orbitState.target.addScaledVector(up, dy * orbitState.panSpeed);
        }
    });

    canvasEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = 1 + e.deltaY * 0.001;
        orbitState.spherical.radius *= factor;
        orbitState.spherical.radius = Math.max(1, Math.min(100, orbitState.spherical.radius));
    }, { passive: false });

    // ── Touch support ──────────────────────────────────────
    let touchStartDist = 0;
    let touchPrevPos = null;

    canvasEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            orbitState.isDragging = true;
            orbitState.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            orbitState.isDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
            touchPrevPos = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
        }
    }, { passive: false });

    canvasEl.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && orbitState.isDragging) {
            const dx = e.touches[0].clientX - orbitState.prevMouse.x;
            const dy = e.touches[0].clientY - orbitState.prevMouse.y;
            orbitState.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            orbitState.spherical.theta -= dx * orbitState.rotateSpeed;
            orbitState.spherical.phi -= dy * orbitState.rotateSpeed;
            orbitState.spherical.phi = clampPhi(orbitState.spherical.phi);
        } else if (e.touches.length === 2) {
            // Pinch zoom
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (touchStartDist > 0) {
                const factor = touchStartDist / dist;
                orbitState.spherical.radius *= factor;
                orbitState.spherical.radius = Math.max(1, Math.min(100, orbitState.spherical.radius));
            }
            touchStartDist = dist;

            // Pan
            const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            if (touchPrevPos) {
                const pdx = cx - touchPrevPos.x;
                const pdy = cy - touchPrevPos.y;
                const right = new THREE.Vector3();
                const up = new THREE.Vector3();
                camera.matrix.extractBasis(right, up, new THREE.Vector3());
                orbitState.target.addScaledVector(right, -pdx * orbitState.panSpeed);
                orbitState.target.addScaledVector(up, pdy * orbitState.panSpeed);
            }
            touchPrevPos = { x: cx, y: cy };
        }
    }, { passive: false });

    canvasEl.addEventListener('touchend', () => {
        orbitState.isDragging = false;
        touchStartDist = 0;
        touchPrevPos = null;
    });

    // ── Animation Loop ─────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);

        // Update camera from spherical
        const offset = new THREE.Vector3().setFromSpherical(orbitState.spherical);
        camera.position.copy(orbitState.target).add(offset);
        camera.lookAt(orbitState.target);

        threeRenderer.render(scene, camera);
    }
    animate();

    // ── Resize handling ────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = 500;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        threeRenderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return { scene, camera, renderer: threeRenderer };
}

export { render };
export default render;
