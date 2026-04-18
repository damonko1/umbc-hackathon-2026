export const THEME_STORAGE_KEY = "realityfork:theme";
export const DEFAULT_THEME: ThemeName = "dark";

export type ThemeName = "light" | "dark";

export function isThemeName(value: unknown): value is ThemeName {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeName | null {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(savedTheme) ? savedTheme : null;
  } catch {
    return null;
  }
}

export function getPreferredTheme(): ThemeName {
  return getStoredTheme() ?? DEFAULT_THEME;
}

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export const themeInitScript = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const isThemeName = (value) => value === "light" || value === "dark";
  const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};
  const root = document.documentElement;

  let nextTheme = defaultTheme;

  try {
    const savedTheme = window.localStorage.getItem(storageKey);
    if (isThemeName(savedTheme)) {
      nextTheme = savedTheme;
    }
  } catch {}

  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;
})();`;
