/** The meeting link in whatever they paste: a whole Zoom invitation, or just the link. */
export function linkFrom(pasted: string) {
  const m = /https:\/\/[^\s<>"']+/i.exec(pasted);
  return m ? m[0].replace(/[).,;]+$/, "") : pasted.trim();
}
