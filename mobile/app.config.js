const appJson = require("./app.json");

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  const profile = process.env.EAS_BUILD_PROFILE ?? "";
  const useDevClient = profile === "development";

  const plugins = appJson.expo.plugins.filter((plugin) => {
    if (plugin === "expo-dev-client") return false;
    if (plugin === "expo-build-properties") return false;
    return true;
  });

  const secureStoreIndex = plugins.indexOf("expo-secure-store");
  if (useDevClient && secureStoreIndex >= 0) {
    plugins.splice(secureStoreIndex + 1, 0, "expo-dev-client");
  }

  plugins.push([
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: 36,
        targetSdkVersion: 36,
        buildToolsVersion: "36.0.0",
        kotlinVersion: "2.1.20",
        minSdkVersion: 24
      },
      ios: {
        deploymentTarget: "15.1"
      }
    }
  ]);

  plugins.push("./plugins/withAndroidGradleFix");

  const { versionCode: _ignoredVersionCode, ...android } = appJson.expo.android ?? {};

  return {
    ...appJson.expo,
    android,
    plugins
  };
};
