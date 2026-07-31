const KATEX_CSS_ID = "redefine-katex-css";
const KATEX_SCRIPT_ID = "redefine-katex-script";
const KATEX_AUTO_RENDER_ID = "redefine-katex-auto-render";
const KATEX_COPY_TEX_ID = "redefine-katex-copy-tex";
const DEFAULT_VERSION = "0.18.1";
const DEFAULT_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
];

let assetPromise = null;

const normalizeVersion = (value) => {
  const version = String(value || DEFAULT_VERSION).trim();
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
    ? version
    : DEFAULT_VERSION;
};

const normalizeAssetBase = (config = {}) => {
  const version = normalizeVersion(config.version);
  const configuredBase = typeof config.cdn === "string"
    ? config.cdn.trim().split("${version}").join(version)
    : "";
  const base = configuredBase || `https://cdn.jsdelivr.net/npm/katex@${version}/dist`;

  if (/^(?:https?:)?\/\//i.test(base) || base.startsWith("/")) {
    return base.replace(/\/+$/, "");
  }

  console.warn("[redefine] Invalid KaTeX CDN base; falling back to jsDelivr");
  return `https://cdn.jsdelivr.net/npm/katex@${version}/dist`;
};

const markCrossOrigin = (element, url) => {
  try {
    const target = new URL(url, window.location.href);
    if (target.origin !== window.location.origin) {
      element.crossOrigin = "anonymous";
    }
  } catch (error) {
    console.warn("[redefine] Unable to parse KaTeX asset URL:", error);
  }
};

const loadStylesheet = (url) => {
  if (document.getElementById(KATEX_CSS_ID)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = KATEX_CSS_ID;
    link.rel = "stylesheet";
    link.href = url;
    markCrossOrigin(link, url);
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener(
      "error",
      () => {
        link.remove();
        reject(new Error(`Unable to load ${url}`));
      },
      { once: true },
    );
    document.head.appendChild(link);
  });
};

const loadScript = (url, id, isReady) => {
  if (isReady()) {
    return Promise.resolve();
  }

  const existing = document.getElementById(id);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => {
          existing.remove();
          reject(new Error(`Unable to load ${url}`));
        },
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = url;
    script.defer = true;
    markCrossOrigin(script, url);
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error(`Unable to load ${url}`));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });
};

const loadKatexAssets = (config = {}) => {
  if (assetPromise) {
    return assetPromise;
  }

  const base = normalizeAssetBase(config);
  assetPromise = Promise.all([
    loadStylesheet(`${base}/katex.min.css`),
    loadScript(
      `${base}/katex.min.js`,
      KATEX_SCRIPT_ID,
      () => typeof window.katex !== "undefined",
    ),
  ])
    .then(() => loadScript(
      `${base}/contrib/auto-render.min.js`,
      KATEX_AUTO_RENDER_ID,
      () => typeof window.renderMathInElement === "function",
    ))
    .then(() => {
      if (config.copy_tex !== true) {
        return undefined;
      }
      return loadScript(
        `${base}/contrib/copy-tex.min.js`,
        KATEX_COPY_TEX_ID,
        () => document.getElementById(KATEX_COPY_TEX_ID)?.dataset.loaded === "true",
      ).then(() => {
        const copyScript = document.getElementById(KATEX_COPY_TEX_ID);
        if (copyScript) {
          copyScript.dataset.loaded = "true";
        }
      });
    })
    .catch((error) => {
      assetPromise = null;
      throw error;
    });

  return assetPromise;
};

const normalizeDelimiters = (delimiters) => {
  if (!Array.isArray(delimiters)) {
    return DEFAULT_DELIMITERS;
  }

  const normalized = delimiters
    .filter((item) => item && typeof item.left === "string" && typeof item.right === "string")
    .map((item) => ({
      left: item.left,
      right: item.right,
      display: item.display === true,
    }));

  return normalized.length ? normalized : DEFAULT_DELIMITERS;
};

const normalizeStrict = (value) => {
  return ["warn", "ignore", "error"].includes(value) ? value : "warn";
};

const normalizeMacros = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
};

const renderKatex = (root, config = {}) => {
  if (!root?.isConnected || typeof window.renderMathInElement !== "function") {
    return;
  }

  root.querySelectorAll(
    ".article-content.markdown-body, .page-template-content.markdown-body",
  ).forEach((container) => {
    window.renderMathInElement(container, {
      delimiters: normalizeDelimiters(config.delimiters),
      ignoredClasses: ["katex"],
      macros: normalizeMacros(config.macros),
      throwOnError: config.throw_on_error === true,
      strict: normalizeStrict(config.strict),
      trust: false,
    });
  });
};

const runKatex = async () => {
  const root = document.querySelector("#swup[data-katex-enabled='true']");
  const config = theme.plugins?.katex || {};

  if (!root || config.enable !== true) {
    return;
  }

  await loadKatexAssets(config);
  renderKatex(root, config);
};

export default function initKatex() {
  runKatex().catch((error) => {
    console.warn("[redefine] KaTeX rendering failed:", error);
  });
}
