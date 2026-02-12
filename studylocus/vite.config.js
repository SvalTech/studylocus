import { defineConfig } from 'vite'

export default defineConfig({
    // This ensures assets work even if not at the domain root
    base: './',

    build: {
        // 1. Go up one level (..) and create/put files in a 'docs' folder
        outDir: '../docs',

        // 2. This safely deletes old files in 'docs' before rebuilding
        emptyOutDir: true,
    }
})