const { withDangerousMod, withAndroidManifest } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function gradleWrapperPlugin(config) {
  // 1. Add android:networkSecurityConfig="@xml/network_security_config" to AndroidManifest.xml application
  config = withAndroidManifest(config, (config) => {
    const mainApp = config.modResults.manifest.application?.[0];
    if (mainApp) {
      if (!mainApp.$) mainApp.$ = {};
      mainApp.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    }
    return config;
  });

  // 2. Modify gradle-wrapper.properties and copy network_security_config.xml
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // Set gradle wrapper distributionUrl to standard gradle-8.10.2-bin.zip
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle/wrapper/gradle-wrapper.properties"
      );
      if (fs.existsSync(wrapperPath)) {
        let content = fs.readFileSync(wrapperPath, "utf8");
        content = content.replace(
          /distributionUrl=.*/g,
          "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-bin.zip"
        );
        fs.writeFileSync(wrapperPath, content, "utf8");
      }

      // Copy network_security_config.xml into android/app/src/main/res/xml/
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
