const { createRunOncePlugin, withGradleProperties } = require("@expo/config-plugins");

function withAndroidGradleFix(config) {
  config = withGradleProperties(config, (gradleConfig) => {
    const props = gradleConfig.modResults;
    const existing = props.find((item) => item.type === "property" && item.key === "org.gradle.jvmargs");
    if (existing) {
      existing.value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError";
    } else {
      props.push({
        type: "property",
        key: "org.gradle.jvmargs",
        value: "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError"
      });
    }
    return gradleConfig;
  });

  return config;
}

module.exports = createRunOncePlugin(withAndroidGradleFix, "with-android-gradle-fix", "1.0.1");
