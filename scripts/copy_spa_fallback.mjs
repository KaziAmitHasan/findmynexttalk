import { copyFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
console.log("Copied dist/index.html to dist/404.html for GitHub Pages route fallback.");
