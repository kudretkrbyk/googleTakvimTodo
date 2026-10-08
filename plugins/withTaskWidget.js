const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
module.exports = function withTaskWidget(config) {
  config = withAndroidManifest(config, (c) => {
    const application = c.modResults.manifest.application[0];
    application.$["android:icon"] = "@mipmap/sade_launcher";
    application.$["android:roundIcon"] = "@mipmap/sade_launcher";
    application.receiver = application.receiver || [];
    if (
      !application.receiver.some(
        (r) => r.$["android:name"] === ".widget.TaskWidget",
      )
    )
      application.receiver.push({
        $: {
          "android:name": ".widget.TaskWidget",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.appwidget.action.APPWIDGET_UPDATE",
                },
              },
              { $: { "android:name": "android.intent.action.DATE_CHANGED" } },
              { $: { "android:name": "android.intent.action.TIME_SET" } },
              {
                $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" },
              },
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              {
                $: {
                  "android:name": "android.intent.action.CONFIGURATION_CHANGED",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/task_widget_info",
            },
          },
        ],
      });
    application.activity = application.activity || [];
    if (
      !application.activity.some(
        (a) => a.$["android:name"] === ".widget.WidgetConfigurationActivity",
      )
    )
      application.activity.push({
        $: {
          "android:name": ".widget.WidgetConfigurationActivity",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.appwidget.action.APPWIDGET_CONFIGURE",
                },
              },
            ],
          },
        ],
      });
    return c;
  });
  config = withMainApplication(config, (c) => {
    if (
      !c.modResults.contents.includes(
        "add(com.sade.calendar.widget.TaskWidgetPackage())",
      )
    ) {
      const marker = "PackageList(this).packages.apply {";
      if (!c.modResults.contents.includes(marker))
        throw new Error(
          "MainApplication package registration changed; inspect widget plugin.",
        );
      c.modResults.contents = c.modResults.contents.replace(
        marker,
        `${marker}\n          add(com.sade.calendar.widget.TaskWidgetPackage())`,
      );
    }
    return c;
  });
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const source = path.join(c.modRequest.projectRoot, "native/widget");
      const app = path.join(c.modRequest.platformProjectRoot, "app/src/main");
      const target = path.join(app, "java/com/sade/calendar/widget");
      fs.mkdirSync(target, { recursive: true });
      for (const file of fs.readdirSync(source))
        if (file.endsWith(".kt"))
          fs.copyFileSync(path.join(source, file), path.join(target, file));
      fs.cpSync(path.join(source, "res"), path.join(app, "res"), {
        recursive: true,
      });
      return c;
    },
  ]);
};
