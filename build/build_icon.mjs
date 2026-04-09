import sharp from "sharp";
import { readFileSync } from "fs";

const svg = readFileSync("icon.svg");

await sharp(svg).resize(1024, 1024).png().toFile("icon.png");

console.log("Generated icon.png (1024x1024)");
