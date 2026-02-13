import { defineConfig } from 'vite'
import { resolve } from 'path' // 1. IMPORT THIS

export default defineConfig({
    // This ensures assets work even if not at the domain root
    base: './',

    build: {
        // Go up one level (..) and create/put files in a 'docs' folder
        outDir: '../docs',

        // This safely deletes old files in 'docs' before rebuilding
        emptyOutDir: true,

        // 2. ADD THIS SECTION TO INCLUDE OTHER FILES
        rollupOptions: {
            input: {
                // The main entry point
                main: resolve(__dirname, 'index.html'),
                termsandconditions: resolve(__dirname, 'termsandconditions.html'),
                privacypolicy: resolve(__dirname, 'privacypolicy.html'),
            },
        },
    }
})