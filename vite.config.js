import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: 'src/index.js',
            name: 'Spatex',
            formats: ['es', 'umd'],
            fileName: (format) => `spatex.${format}.js`
        },
        rollupOptions: {
            external: ['three'],
            output: {
                globals: {
                    three: 'THREE'
                },
                exports: 'named'
            }
        }
    }
});
