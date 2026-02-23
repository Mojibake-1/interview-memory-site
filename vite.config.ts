import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    root: ".",
    build: {
        outDir: "dist",
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                admin: resolve(__dirname, "admin.html"),
                roadmap: resolve(__dirname, "roadmap.html"),
                lecture0: resolve(__dirname, "lecture0.html"),
                lecture1: resolve(__dirname, "lecture1.html"),
                lecture2: resolve(__dirname, "lecture2.html"),
                lecture3: resolve(__dirname, "lecture3.html"),
                lecture4: resolve(__dirname, "lecture4.html"),
                lecture5: resolve(__dirname, "lecture5.html"),
                lecture6: resolve(__dirname, "lecture6.html"),
            },
        },
    },
    server: {
        proxy: {
            "/api": "http://127.0.0.1:8080",
        },
    },
});
