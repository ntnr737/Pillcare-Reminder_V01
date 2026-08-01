/**
 * sound-plugin.js
 * Copies custom notification sound files to Android's res/raw directory.
 * Files in res/raw/ are referenced by name in notification channels.
 */
const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function soundPlugin(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const rawDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/raw");
      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }
      const assetsDir = path.join(config.modRequest.projectRoot, "assets/sounds");
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        for (const file of files) {
          if (file.endsWith(".wav") || file.endsWith(".mp3")) {
            const dest = path.join(rawDir, file);
            fs.copyFileSync(path.join(assetsDir, file), dest);
            console.log(`Copied sound: ${file} → ${dest}`);
          }
        }
      }
      return config;
    },
  ]);
};
