/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SPATEX — Public API                                    ║
 * ║  A CSS/JSON-style declarative language for 3D diagrams  ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import { parse } from './parser.js';
import { render } from './renderer.js';

/**
 * The Spatex library object — parse, render, or auto-render spatex code blocks.
 *
 * @example
 * // Parse a spatex string into a JSON scene tree
 * const tree = Spatex.parse(code);
 *
 * // Render a spatex string into a DOM container
 * Spatex.render(code, document.getElementById('my-container'));
 *
 * // Auto-scan the page for ```spatex code blocks and render them all
 * Spatex.autoRender();
 */
const Spatex = {
    /**
     * Parse a spatex string and return a JSON scene tree.
     *
     * @param {string} code - Raw spatex source code
     * @returns {Object} Parsed scene tree with defaults applied
     */
    parse(code) {
        return parse(code);
    },

    /**
     * Render a spatex string into a given DOM container element.
     * Parses the code, builds a Three.js scene, and mounts it inside the container.
     *
     * @param {string} code - Raw spatex source code
     * @param {HTMLElement} container - DOM element to render into
     * @returns {{ scene: object, camera: object, renderer: object }} Three.js handles
     */
    render(code, container) {
        const sceneTree = parse(code);
        return render(sceneTree, container);
    },

    /**
     * Auto-scan the page for `<code class="language-spatex">` blocks
     * (which is what most Markdown renderers produce from triple-backtick
     * spatex blocks) and render them all in-place.
     *
     * Also scans for `<code class="language-3d">` for backwards compatibility.
     */
    autoRender() {
        const selectors = [
            'code.language-spatex',
            'code.language-3d',
        ];
        const codeBlocks = document.querySelectorAll(selectors.join(', '));

        codeBlocks.forEach((codeEl, index) => {
            const src = codeEl.textContent.trim();
            const preEl = codeEl.parentElement; // <pre>

            try {
                const sceneTree = parse(src);
                console.log(
                    `%c[SpaTeX] Scene #${index + 1} parsed:`,
                    'color: #6366f1; font-weight: bold;',
                    sceneTree
                );

                // Create container
                const container = document.createElement('div');
                container.className = 'spatex-container';
                container.id = `spatex-scene-${index}`;

                // Badge
                const badge = document.createElement('div');
                badge.className = 'spatex-badge';
                badge.textContent = 'SpaTeX';
                container.appendChild(badge);

                // Controls hint
                const hint = document.createElement('div');
                hint.className = 'spatex-controls-hint';
                hint.textContent = '🖱 Drag to orbit · Scroll to zoom · Right-drag to pan';
                container.appendChild(hint);

                // Replace <pre> with container
                preEl.replaceWith(container);

                // Render
                render(sceneTree, container);

                // Fade out hint after 4 seconds
                setTimeout(() => {
                    hint.style.opacity = '0';
                    setTimeout(() => hint.remove(), 500);
                }, 4000);

            } catch (e) {
                console.error(`[SpaTeX] Error in scene #${index + 1}:`, e);
                codeEl.style.borderColor = '#ef4444';
                codeEl.style.color = '#fca5a5';
                codeEl.textContent = `Parse Error: ${e.message}\n\n${src}`;
            }
        });
    },
};

export default Spatex;
export { parse, render };
