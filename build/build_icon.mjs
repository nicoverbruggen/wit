import sharp from "sharp";
import { copyFileSync, existsSync, readFileSync } from "fs";

const macosIconPath = "icon_macos.png";

if (existsSync(macosIconPath)) {
  copyFileSync(macosIconPath, "icon.png");
  console.log("Copied icon_macos.png to icon.png for macOS packaging");
} else {
  const svg = readFileSync("icon.svg");
  await sharp(svg).resize(1024, 1024).png().toFile("icon.png");
  console.log("Generated icon.png (1024x1024) from icon.svg");
}
