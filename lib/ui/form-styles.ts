/** Shared form control styles — readable in light and dark mode. */
export const FORM_INPUT_CLASS =
  "rounded-lg border border-app-border bg-app-accent-soft/50 px-3 py-2 text-sm text-app-fg outline-none ring-app-accent transition placeholder:text-app-subtle focus:bg-panel focus:ring-2";

export const FORM_INPUT_CLASS_BLOCK = `w-full ${FORM_INPUT_CLASS}`;

export const FORM_PRIMARY_BUTTON_CLASS =
  "rounded-lg bg-app-accent px-3 py-2 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export const FORM_SECONDARY_BUTTON_CLASS =
  "rounded-lg border border-app-border bg-panel px-3 py-2 text-sm font-medium text-app-fg transition hover:bg-app-muted";
