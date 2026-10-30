// The app's line icons (the shared Icons part): one stroke drawing each, drawn in the text color.
// They look the same on every phone and computer, unlike emoji, and screen readers skip them.

export const ICON_PATHS = {
  // Kinds of event.
  band: "M9 18V5l11-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  group: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M18 14.5a5 5 0 0 1 3 4.5",
  volunteer: "M12 20s-7-4.4-9-8.8A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 4.2C19 15.6 12 20 12 20z",
  school: "M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5",
  fair: "M3 20 12 4l9 16H3zM12 4v16M9 20l3-5 3 5",
  apple: "M12 7c-1.5-1.2-4-1.4-5.6 0C4.5 8.8 4.6 13 6.5 16.5 8 19.3 10 20.5 12 19.5c2 1 4-.2 5.5-3 1.9-3.5 2-7.7.1-9.5-1.6-1.4-4.1-1.2-5.6 0zM12 7c0-2 1-3.5 3-4",
  calendar: "M5 6h14v13H5zM5 10h14M9 4v4M15 4v4",
  building: "M3 21h18M4 9h16M12 3 4 7v2h16V7zM6 9v9M10 9v9M14 9v9M18 9v9",
  stadium: "M12 6c5 0 9 1.6 9 3.5v7c0 1.9-4 3.5-9 3.5s-9-1.6-9-3.5v-7C3 7.6 7 6 12 6zM3 9.5c0 1.9 4 3.5 9 3.5s9-1.6 9-3.5M12 6V2l4 1.5L12 5",
  // Notes and warnings.
  warning: "M12 4 2.5 20h19L12 4zM12 10v4M12 17h.01",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  id: "M3 6h18v12H3zM8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 15.5a3 3 0 0 1 6 0M14 10h4M14 13h4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  note: "M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5",
  // Schedules and the day.
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4",
  coffee: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5M10 2h4",
  party: "M4 20 8 8l8 8-12 4zM13 4l1 2M18 5l-2 2M20 10l-2 .5M14 9c1-1 2.5-1 3.5 0",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z",
  // Fair zones.
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  palette: "M12 3a9 9 0 0 0 0 18c1.2 0 1.5-.8 1.5-1.5 0-1.5-1-1.8-1-3S13.5 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7h.01M15 7h.01",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  masks: "M4 5h8v6a4 4 0 0 1-8 0zM6.5 8h.01M9.5 8h.01M6.5 12a2 2 0 0 0 3 0M12 9h8v6a4 4 0 0 1-8 0M14.5 12h.01M17.5 12h.01M14.5 16a2 2 0 0 1 3 0",
  popcorn: "M6 10h12l-1.5 10h-9zM6 10a2.5 2.5 0 0 1 2-4 2.5 2.5 0 0 1 4-1.5A2.5 2.5 0 0 1 16 6a2.5 2.5 0 0 1 2 4M10 10l.5 10M14 10l-.5 10",
} as const;

export type IconName = keyof typeof ICON_PATHS;
