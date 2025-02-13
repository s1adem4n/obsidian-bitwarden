import { App, PluginSettingTab, Setting } from "obsidian";
import BitwardenPlugin from "./main";

export const DEFAULT_SETTINGS: Settings = {
  cliPath: "",
};

export interface Settings {
  cliPath: string;
}

export class SettingTab extends PluginSettingTab {
  plugin: BitwardenPlugin;

  constructor(app: App, plugin: BitwardenPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl).setName("Bitwarden CLI Path").addText((text) =>
      text
        .setPlaceholder("/usr/local/bin/bw")
        .setValue(this.plugin.settings.cliPath)
        .onChange(async (value) => {
          this.plugin.settings.cliPath = value;
          this.plugin.bw.path = value;
          await this.plugin.saveSettings();
        })
    );
  }
}
