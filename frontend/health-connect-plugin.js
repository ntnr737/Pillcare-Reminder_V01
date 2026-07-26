/**
 * health-connect-plugin.js
 * Expo config plugin to make PillCare appear in Health Connect's app list.
 *
 * Health Connect requires two things in AndroidManifest.xml:
 * 1. <queries> block to query Health Connect app
 * 2. Intent filter on the main activity for permissions rationale screen
 */
const { withAndroidManifest } = require("@expo/config-plugins");

function addHealthConnectToManifest(androidManifest) {
  const manifest = androidManifest.manifest;

  // 1. Add <queries> block so app can discover Health Connect
  if (!manifest.queries) manifest.queries = [];
  const hasHCQuery = manifest.queries.some(
    q => q?.package?.[0]?.['$']?.['android:name'] === 'com.google.android.apps.healthdata'
  );
  if (!hasHCQuery) {
    manifest.queries.push({
      package: [{ '$': { 'android:name': 'com.google.android.apps.healthdata' } }]
    });
  }

  // 2. Add intent filter to main activity for Health Connect permission rationale
  const mainActivity = manifest.application?.[0]?.activity?.find(
    a => a['$']?.['android:name'] === '.MainActivity'
  );
  if (mainActivity) {
    if (!mainActivity['intent-filter']) mainActivity['intent-filter'] = [];
    const hasHCFilter = mainActivity['intent-filter'].some(
      f => f?.action?.[0]?.['$']?.['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
    );
    if (!hasHCFilter) {
      mainActivity['intent-filter'].push({
        action: [{ '$': { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }]
      });
    }
  }

  return androidManifest;
}

module.exports = function healthConnectPlugin(config) {
  return withAndroidManifest(config, async config => {
    config.modResults = addHealthConnectToManifest(config.modResults);
    return config;
  });
};
