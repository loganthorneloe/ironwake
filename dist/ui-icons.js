const paths = {
  home: 'M4 10 12 3l8 7v10h-6v-6h-4v6H4z',
  operations: 'm12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 17l9 5 9-5',
  mech: 'M9 3h6l1 4-4 2-4-2zM7 10l5-2 5 2-1 7H8zM4 10l3 1-1 7H3zm13 1 3-1 1 8h-3zM8 18h3v5H7zm5 0h3l1 5h-4z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  plus: 'M12 4v16M4 12h16',
  squad:
    'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6m8 3a2.5 2.5 0 1 0 0 5M3 21v-4a6 6 0 0 1 12 0v4m3-7a5 5 0 0 1 3 5v2',
  settings:
    'm10 3-1 3-3 1-3-1-2 4 3 2v3l-2 2 3 4 3-1 3 1 1 3h4l1-3 3-1 2 1 3-4-2-2v-3l2-2-2-4-3 1-3-1-1-3zm2 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  pilot: 'M12 3a6 6 0 0 0-6 6v3l3 4h6l3-4V9a6 6 0 0 0-6-6M6 10h12M8 21l1-5m6 0 1 5M4 22h16',
  library: 'M4 4h16v17H4zM8 4v6h8V4M8 15h8v6',
  duel: 'M4 3l12 12m-3 3 6-6m-2 5 4 4M20 3 8 15m3 3-6-6m2 5-4 4',
  controls:
    'M8 7H5L2 18c-.4 2 1 3 2 2l4-4h8l4 4c1 1 2.4 0 2-2L19 7h-3M8 7h8M5 12h6m-3-3v6m8-4h.01m3 3h.01',
  sound: 'M3 9h4l5-5v16l-5-5H3zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
  report: 'M4 4h16v12H9l-5 5zm8 3v4m0 2h.01',
  chevron: 'm8 5 7 7-7 7',
  crosshair: 'M12 2v5m0 10v5M2 12h5m10 0h5M7 7l2 2m6 6 2 2M7 17l2-2m6-6 2-2',
  exit: 'M10 4H4v16h6m4-13 5 5-5 5M9 12h11',
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zm9 2v16',
  reset: 'M4 4v6h6M4 10a8 8 0 1 1 1 8',
};
export function uiIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.arrow}"/></svg>`;
}
export function fillUiIcons(root = document) {
  for (const el of root.querySelectorAll('[data-ui-icon]'))
    el.innerHTML = uiIcon(el.dataset.uiIcon);
}
