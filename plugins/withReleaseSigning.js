const { withAppBuildGradle } = require("expo/config-plugins");
// Only paths/variable names are generated. Signing passwords never enter Git.
module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    const marker = "// SADE_RELEASE_SIGNING";
    if (!c.modResults.contents.includes(marker)) {
      const snippet = `
${marker}
def sadeStore = System.getenv('SADE_KEYSTORE_PATH')
def sadeStorePassword = System.getenv('SADE_KEYSTORE_PASSWORD')
def sadeAlias = System.getenv('SADE_KEY_ALIAS')
def sadeKeyPassword = System.getenv('SADE_KEY_PASSWORD')
if (sadeStore && sadeStorePassword && sadeAlias && sadeKeyPassword) {
    android.signingConfigs.create('sadeRelease') {
        storeFile file(sadeStore)
        storePassword sadeStorePassword
        keyAlias sadeAlias
        keyPassword sadeKeyPassword
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.sadeRelease
} else if (!System.getenv('EAS_BUILD')) {
    android.buildTypes.release.signingConfig = null
}
`;
      c.modResults.contents += snippet;
    }
    return c;
  });
