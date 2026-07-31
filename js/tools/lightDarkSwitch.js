import {
  getDefaultThemeMode,
  getStyleStatus,
  normalizeThemeMode,
  resolveThemeMode,
  styleStatus,
  updateStyleStatus,
} from "../state/styleStatus.js";

const mermaidSelector = ".mermaid";
const themeModes = ["auto", "light", "dark"];
const themeModeIcons = {
  auto: "fa-regular fa-display",
  light: "fa-regular fa-sun",
  dark: "fa-regular fa-moon",
};
let didInitAuto = false;

const ensureOriginalData = () => {
  document.querySelectorAll(mermaidSelector).forEach((element) => {
    if (!element.getAttribute("data-original-code")) {
      element.setAttribute("data-original-code", element.innerHTML);
    }
  });
};

const resetProcessed = () => {
  document.querySelectorAll(mermaidSelector).forEach((element) => {
    const originalCode = element.getAttribute("data-original-code");
    if (originalCode !== null) {
      element.removeAttribute("data-processed");
      element.innerHTML = originalCode;
    }
  });
};

export const ModeToggle = {
  modeToggleButton_dom: null,
  iconDom: null,
  mermaidLightTheme: null,
  mermaidDarkTheme: null,

  getThemeMode(storedStatus) {
    if (themeModes.includes(storedStatus?.themeMode)) {
      return storedStatus.themeMode;
    }

    // Preserve the user's explicit preference from versions that only stored
    // isDark. New installs use the configured default, which is usually auto.
    if (typeof storedStatus?.isDark === "boolean") {
      return storedStatus.isDark ? "dark" : "light";
    }

    return getDefaultThemeMode();
  },

  updateModeToggleButton(mode) {
    if (this.iconDom) {
      this.iconDom.className = themeModeIcons[mode];
    }

    if (!this.modeToggleButton_dom) {
      return;
    }

    const labelKey = `mode${mode[0].toUpperCase()}${mode.slice(1)}Label`;
    const label = this.modeToggleButton_dom.dataset[labelKey] || mode;
    this.modeToggleButton_dom.dataset.themeMode = mode;
    this.modeToggleButton_dom.setAttribute("aria-label", label);
    this.modeToggleButton_dom.setAttribute(
      "aria-pressed",
      mode === "auto" ? "mixed" : String(mode === "dark"),
    );
    this.modeToggleButton_dom.title = label;
  },

  setThemeMode(mode) {
    const normalizedMode = normalizeThemeMode(mode, getDefaultThemeMode());
    const isDark = resolveThemeMode(normalizedMode);
    const didResolvedThemeChange = styleStatus.isDark !== isDark;
    const resolvedTheme = isDark ? "dark" : "light";

    document.body?.classList.remove("light-mode", "dark-mode");
    document.body?.classList.add(`${resolvedTheme}-mode`);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    document.documentElement.dataset.themeMode = normalizedMode;

    this.updateModeToggleButton(normalizedMode);
    updateStyleStatus({ themeMode: normalizedMode, isDark });

    if (!didResolvedThemeChange) {
      return;
    }

    this.mermaidInit(isDark ? this.mermaidDarkTheme : this.mermaidLightTheme);
    this.setGiscusTheme();
    this.setUtterancesTheme();
  },

  mermaidInit(theme) {
    if (!window.mermaid) {
      return;
    }

    ensureOriginalData();
    resetProcessed();
    mermaid.initialize({ theme });
    mermaid.init({ theme }, document.querySelectorAll(mermaidSelector));
  },

  enableLightMode() {
    this.setThemeMode("light");
  },

  enableDarkMode() {
    this.setThemeMode("dark");
  },

  enableAutoMode() {
    this.setThemeMode("auto");
  },

  async setGiscusTheme(theme) {
    if (!document.querySelector("#giscus-container")) {
      return;
    }

    let giscusFrame = document.querySelector("iframe.giscus-frame");
    while (!giscusFrame) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      giscusFrame = document.querySelector("iframe.giscus-frame");
    }

    while (giscusFrame.classList.contains("giscus-frame--loading")) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    theme ??= styleStatus.isDark ? "dark" : "light";
    giscusFrame.contentWindow.postMessage(
      {
        giscus: {
          setConfig: {
            theme,
          },
        },
      },
      "https://giscus.app",
    );
  },

  async setUtterancesTheme(theme) {
    const container = document.querySelector("#utterances-container");
    if (!container) {
      return;
    }

    const themeLight =
      container.dataset.utterancesThemeLight || "github-light";
    const themeDark =
      container.dataset.utterancesThemeDark || "github-dark";
    theme ??= styleStatus.isDark ? themeDark : themeLight;

    const maxAttempts = 10;
    let utterancesFrame = document.querySelector("iframe.utterances-frame");

    for (let attempt = 0; attempt < maxAttempts && !utterancesFrame; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      utterancesFrame = document.querySelector("iframe.utterances-frame");
    }

    if (!utterancesFrame || !utterancesFrame.contentWindow) {
      return;
    }

    utterancesFrame.contentWindow.postMessage(
      { type: "set-theme", theme },
      "https://utteranc.es",
    );
  },

  isDarkPrefersColorScheme() {
    return (
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
    );
  },

  initModeStatus() {
    const storedStatus = getStyleStatus();
    this.setThemeMode(this.getThemeMode(storedStatus));
  },

  initModeToggleButton(signal) {
    if (!this.modeToggleButton_dom) {
      return;
    }

    const handler = () => {
      const currentMode = normalizeThemeMode(
        styleStatus.themeMode,
        getDefaultThemeMode(),
      );
      const currentIndex = themeModes.indexOf(currentMode);
      const nextMode = themeModes[(currentIndex + 1) % themeModes.length];
      this.setThemeMode(nextMode);
    };
    const keyboardHandler = (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handler();
    };

    if (signal) {
      this.modeToggleButton_dom.addEventListener("click", handler, { signal });
      this.modeToggleButton_dom.addEventListener("keydown", keyboardHandler, {
        signal,
      });
    } else {
      this.modeToggleButton_dom.addEventListener("click", handler);
      this.modeToggleButton_dom.addEventListener("keydown", keyboardHandler);
    }
  },

  initModeAutoTrigger(appSignal) {
    const isDarkMode = this.isDarkPrefersColorScheme();
    if (!isDarkMode || didInitAuto) {
      return;
    }

    didInitAuto = true;
    const handler = () => {
      if (styleStatus.themeMode === "auto") {
        this.enableAutoMode();
      }
    };

    if (appSignal) {
      isDarkMode.addEventListener("change", handler, { signal: appSignal });
    } else {
      isDarkMode.addEventListener("change", handler);
    }
  },

  init({ signal, appSignal } = {}) {
    this.modeToggleButton_dom = document.querySelector(
      ".tool-dark-light-toggle",
    );
    this.iconDom = document.querySelector(".tool-dark-light-toggle i");

    const mermaidThemeConfig =
      theme.plugins?.mermaid?.theme || theme.mermaid?.style || {};
    this.mermaidLightTheme = mermaidThemeConfig.light || "default";
    this.mermaidDarkTheme = mermaidThemeConfig.dark || "dark";

    this.initModeStatus();
    this.initModeToggleButton(signal);
    this.initModeAutoTrigger(appSignal);

    ensureOriginalData();
  },
};

export default function initModeToggle(options = {}) {
  ModeToggle.init(options);
}
