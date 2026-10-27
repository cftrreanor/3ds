/** The meeting link in whatever they paste: a whole Zoom invitation, or just the link. */
export function linkFrom(pasted: string) {
  const m = /https:\/\/[^\s<>"']+/i.exec(pasted);
  return m ? m[0].replace(/[).,;]+$/, "") : pasted.trim();
}

/** The passcode in a pasted Zoom (or Teams) invitation ("Passcode: 123456"), if there is one. */
export function passcodeFrom(pasted: string) {
  const m = /\b(?:passcode|password|pass code)\s*[:=]\s*(\S{1,50})/i.exec(pasted);
  return m ? m[1] : null;
}
