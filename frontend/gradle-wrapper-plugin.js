const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function gradleWrapperPlugin(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // 1. Fix gradle wrapper distributionUrl to valid 8.14.3
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

      // 2. Copy network_security_config.xml into android/app/src/main/res/xml/
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      const sourceNetConfig = path.join(
        config.modRequest.projectRoot,
        "network_security_config.xml"
      );
      const targetNetConfig = path.join(xmlDir, "network_security_config.xml");
      if (fs.existsSync(sourceNetConfig)) {
        fs.copyFileSync(sourceNetConfig, targetNetConfig);
      }

      return config;
    },
  ]);
};
