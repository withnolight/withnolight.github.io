const localStorageKey = "REDEFINE-THEME-STATUS";
const themeModeValues = ["auto", "light", "dark"];

export const normalizeThemeMode = (mode, fallback = "auto") => {
  return themeModeValues.includes(mode) ? mode : fallback;
};

export const getDefaultThemeMode = () => {
  return normalizeThemeMode(theme.colors?.default_mode);
};

export const isSystemDark = () => {
  return Boolean(
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
};

export const resolveThemeMode = (mode) => {
  const normalizedMode = normalizeThemeMode(mode, getDefaultThemeMode());
  return normalizedMode === "dark" || (normalizedMode === "auto" && isSystemDark());
};

const defaultThemeMode = getDefaultThemeMode();

const defaultStyleStatus = {
  isExpandPageWidth: false,
  themeMode: defaultThemeMode,
  isDark: resolveThemeMode(defaultThemeMode),
  fontSizeLevel: 0,
  isOpenPageAside: true,
};

export const styleStatus = {
  ...defaultStyleStatus,
};

const readStoredStatus = () => {
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("Failed to read style status:", error);
    return null;
  }
};

export const getStyleStatus = () => {
  const stored = readStoredStatus();
  if (!stored) {
    return null;
  }

  Object.keys(styleStatus).forEach((key) => {
    if (stored[key] !== undefined) {
      styleStatus[key] = stored[key];
    }
  });

  return stored;
};

export const setStyleStatus = () => {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(styleStatus));
  } catch (error) {
    console.error("Failed to save style status:", error);
  }
};

export const updateStyleStatus = (updates = {}) => {
  Object.assign(styleStatus, updates);
  setStyleStatus();
};

export const resetStyleStatus = () => {
  Object.assign(styleStatus, defaultStyleStatus);
  setStyleStatus();
};
