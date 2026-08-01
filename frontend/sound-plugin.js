const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function soundPlugin(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const rawDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/raw");
      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
      const assetsDir = path.join(config.modRequest.projectRoot, "assets/sounds");
      if (fs.existsSync(assetsDir)) {
        for (const file of fs.readdirSync(assetsDir)) {
          if (file.endsWith(".wav") || file.endsWith(".mp3")) {
            fs.copyFileSync(path.join(assetsDir, file), path.join(rawDir, file));
          }
        }
      }
      return config;
    },
  ]);
};
