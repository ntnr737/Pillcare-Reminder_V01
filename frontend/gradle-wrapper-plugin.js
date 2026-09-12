const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function gradleWrapperPlugin(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle/wrapper/gradle-wrapper.properties"
      );
      if (fs.existsSync(wrapperPath)) {
        let content = fs.readFileSync(wrapperPath, "utf8");
        content = content.replace(
          /distributionUrl=.*/g,
          "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip"
        );
        fs.writeFileSync(wrapperPath, content, "utf8");
      }
      return config;
    },
  ]);
};
