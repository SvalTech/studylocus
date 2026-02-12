/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // Your custom fonts from the project
            fontFamily: {
                inter: ["'Inter'", "sans-serif"],
                roboto: ["'Roboto Slab'", "serif"],
                fira: ["'Fira Code'", "monospace"],
                comic: ["'Comic Neue'", "cursive"],
                poppins: ["'Poppins'", "sans-serif"],
                oswald: ["'Oswald'", "sans-serif"],
                space: ["'Space Grotesk'", "sans-serif"],
                jetbrains: ["'JetBrains Mono'", "monospace"],
            }
        },
    },
    plugins: [],
}