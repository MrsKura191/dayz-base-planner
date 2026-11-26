// Small stroke icons, drawn for this app.
const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const I = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  magnet: svg('<path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/><path d="M10 3v8a2 2 0 0 0 4 0V3"/>'),
  walk: svg('<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3"/><path d="m7 12 3-4 4 1 2 4 3 1"/><path d="m11 15-1-4"/>'),
  frame: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>'),
  territory: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M12 7v10"/><path d="M12 7h5l-1 2 1 2h-5"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  share: svg('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>'),
  download: svg('<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  upload: svg('<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>'),
  logo: `<svg viewBox="0 0 32 32" width="26" height="26"><rect width="32" height="32" rx="8" fill="#1e282c"/><path d="M6 24V13l10-6 10 6v11h-7v-7h-6v7z" fill="#e9a84a"/></svg>`,
};
