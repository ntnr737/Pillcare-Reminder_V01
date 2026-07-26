/**
 * health-connect-plugin.js
 * Makes PillCare appear in Android Health Connect's app permissions list.
 *
 * Required for Health Connect to recognise the app:
 * 1. <queries> package entry for Health Connect
 * 2. Intent filter ACTION_SHOW_PERMISSIONS_RATIONALE on MainActivity
 * 3. Health Connect permission declarations
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const HC_PERMISSIONS = [
  "android.permission.health.READ_STEPS",
  "android.permission.health.READ_HEART_RATE",
  "android.permission.health.READ_BLOOD_PRESSURE",
  "android.permission.health.READ_BLOOD_GLUCOSE",
  "android.permission.health.READ_WEIGHT",
  "android.permission.health.READ_SLEEP",
  "android.permission.health.WRITE_STEPS",
];

function addHealthConnect(androidManifest) {
  const manifest = androidManifest.manifest;

  // 1. Add <queries> so Android allows querying Health Connect
  if (!manifest.queries) manifest.queries = [];
  const alreadyHasQuery = manifest.queries.some(
    q => q?.package?.[0]?.["$"]?.["android:name"] === "com.google.android.apps.healthdata"
  );
  if (!alreadyHasQuery) {
    manifest.queries.push({
      package: [{ "$": { "android:name": "com.google.android.apps.healthdata" } }],
    });
  }

  // 2. Add health permissions to manifest
  if (!manifest["uses-permission"]) manifest["uses-permission"] = [];
  const existing = manifest["uses-permission"].map(p => p["$"]?.["android:name"]);
  for (const perm of HC_PERMISSIONS) {
    if (!existing.includes(perm)) {
      manifest["uses-permission"].push({ "$": { "android:name": perm } });
    }
  }

  // 3. Add intent filter to MainActivity so Health Connect lists the app
  const app = manifest.application?.[0];
  if (!app) return androidManifest;

  let mainActivity = app.activity?.find(
    a => a["$"]?.["android:name"] === ".MainActivity"
      || a["$"]?.["android:name"]?.endsWith("MainActivity")
  );

  if (mainActivity) {
    if (!mainActivity["intent-filter"]) mainActivity["intent-filter"] = [];

    const alreadyHasHCFilter = mainActivity["intent-filter"].some(
      f => f?.action?.some(
        a => a["$"]?.["android:name"] === "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"
      )
    );
    if (!alreadyHasHCFilter) {
      mainActivity["intent-filter"].push({
        action: [{ "$": { "android:name": "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" } }],
      });
    }
  }

  return androidManifest;
}

module.exports = function healthConnectPlugin(config) {
  return withAndroidManifest(config, async config => {
    config.modResults = addHealthConnect(config.modResults);
    return config;
  });
};
