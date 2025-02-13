import { App, Modal, Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, Settings, SettingTab } from "./settings";
import { Bitwarden } from "./bitwarden";

class UnlockModal extends Modal {
  bw: Bitwarden;
  afterUnlock?: () => void;
  constructor(app: App, bw: Bitwarden, afterUnlock?: () => void) {
    super(app);

    this.bw = bw;
    this.afterUnlock = afterUnlock;
  }

  onOpen() {
    let { contentEl } = this;
    contentEl.empty();

    contentEl.style.display = "flex";
    contentEl.style.flexDirection = "column";
    contentEl.style.marginTop = "-25px";

    contentEl.createEl("h2", { text: "Unlock your vault" });

    const passwordInput = contentEl.createEl("input", {
      type: "password",
      placeholder: "Enter your password",
    });

    const submitButton = contentEl.createEl("button", { text: "Unlock" });
    submitButton.className = "mod-cta";
    submitButton.style.marginTop = "10px";

    const submit = async () => {
      const password = passwordInput.value;
      if (!password) {
        new Notice("Please enter your password");
        return;
      }

      const unlock = await this.bw.client.POST("/unlock", {
        body: { password },
      });
      if (!unlock.data?.success) {
        new Notice("Failed to unlock Bitwarden");
        return;
      }

      new Notice("Bitwarden unlocked successfully");
      if (this.afterUnlock) {
        this.afterUnlock();
      }
      this.close();
    };

    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        submit();
      }
    });
    submitButton.addEventListener("click", submit);
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

type ShowItemType = "login";

class ShowItemModal extends Modal {
  bw: Bitwarden;
  itemId: string;
  type: ShowItemType;
  constructor(app: App, bw: Bitwarden, itemId: string, type: ShowItemType) {
    super(app);

    this.bw = bw;
    this.itemId = itemId;
    this.type = type;
  }

  async onOpen() {
    let { contentEl } = this;
    contentEl.empty();

    contentEl.style.display = "flex";
    contentEl.style.flexDirection = "column";
    contentEl.style.marginTop = "-25px";

    const item = await this.bw.client.GET("/object/item/{id}", {
      params: { path: { id: this.itemId } },
    });
    if (item.error) {
      new Notice("Failed to get item details");
      this.close();
      return;
    }

    if (this.type === "login") {
      const login = item.data as {
        data: {
          name: string;
          notes: string | null;
          login: {
            username: string;
            password: string;
          };
        };
      };

      contentEl.createEl("h2", { text: login.data.name });

      contentEl.createEl("label", { text: "Username" });
      contentEl.createEl("input", {
        type: "text",
        value: login.data.login.username,
        attr: { readonly: true },
      });

      contentEl.createEl("label", {
        text: "Password",
        attr: { style: "margin-top: 10px" },
      });
      contentEl.createEl("input", {
        type: "text",
        value: login.data.login.password,
        attr: { readonly: true },
      });
    }
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}

export default class BitwardenPlugin extends Plugin {
  settings: Settings;
  bw: Bitwarden;

  async onload() {
    this.bw = new Bitwarden("");
    await this.loadSettings();

    await this.bw.onload();

    this.addRibbonIcon("lock", "Unlock Bitwarden", async () => {
      if (!this.settings.cliPath) {
        new Notice("Please set the Bitwarden CLI path in the settings");
        return;
      }

      const status = await this.bw.client.GET("/status");
      if (!status.data?.success) {
        new Notice("Failed to get Bitwarden status");
        return;
      }

      if (status.data?.data?.template?.status === "locked") {
        new UnlockModal(this.app, this.bw).open();
      } else {
        new Notice("Bitwarden is already unlocked");
      }
    });

    this.addSettingTab(new SettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor(
      "bitwarden",
      this.processBitwardenCodeBlock.bind(this)
    );

    this.registerMarkdownPostProcessor((el) => {
      const codeblocks = el.querySelectorAll("code");
      codeblocks.forEach((codeblock) => {
        if (codeblock.innerText.startsWith("bitwarden")) {
          this.processBitwardenCodeBlock(codeblock.innerText, codeblock);
        }
      });
    });
  }

  async processBitwardenCodeBlock(source: string, el: HTMLElement) {
    el.empty();
    el.style.backgroundColor = "transparent";

    const [type, itemId] = source
      .replace("bitwarden ", "")
      .split(" ")
      .map((s) => s.trim());
    if (type !== "login") {
      new Notice("Unsupported item type: " + type);
      return;
    }

    const button = el.createEl("button", {
      text: `Show ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    });

    button.addEventListener("click", async () => {
      if (!this.settings.cliPath) {
        new Notice("Please set the Bitwarden CLI path in the settings");
        return;
      }

      const status = await this.bw.client.GET("/status");
      if (!status.data?.success) {
        new Notice("Failed to get Bitwarden status");
        return;
      }

      const modal = new ShowItemModal(this.app, this.bw, itemId, type);

      if (status.data?.data?.template?.status === "locked") {
        new UnlockModal(
          this.app,
          this.bw,
          // open item modal after unlocking
          () => modal.open()
        ).open();
      } else {
        modal.open();
      }
    });
  }

  async onunload() {
    await this.bw.onunload();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.bw.path = this.settings.cliPath;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
