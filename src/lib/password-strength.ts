// How strong a new password is, shared by the meter on the Account page and
// the check when it's saved. Length counts most (a few random words beat a
// short jumble of symbols); the hard "no" is only for passwords that are easy
// to guess: very common ones, or ones built from the person's own email or name.

export type Strength = {
  /** 0 too short, 1 weak, 2 okay, 3 strong. */
  level: 0 | 1 | 2 | 3;
  label: "Too short" | "Easy to guess" | "Weak" | "Okay" | "Strong";
  /** What would make it stronger, when something would. */
  tip?: string;
  /** Saving is refused (too short, or easy to guess). */
  blocked: boolean;
};

export const MIN_PASSWORD = 8;

// The most-used passwords, plus a few this audience would reach for.
const COMMON = new Set(
  [
    "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword",
    "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "11223344",
    "qwertyui", "qwerty123", "qwertyuiop", "asdfghjk", "asdfasdf", "zxcvbnm1", "1q2w3e4r", "1qaz2wsx",
    "iloveyou", "sunshine", "princess", "football", "baseball", "superman", "trustno1", "letmein1",
    "welcome1", "welcome123", "abcd1234", "abc12345", "monkey123", "dragon123", "changeme", "computer",
    "whatever", "starwars", "shadow123", "master123", "michael1", "jennifer", "mustang1", "liverpool",
    "marching", "marchingband", "bandcamp", "bandmom1", "banddirector", "drumline", "colorguard",
    "teacher1", "teacher123", "school123", "student1", "classroom", "fieldcommand", "fieldcommandevents",
    // The example on the Account page.
    "tubalanternmapleriver",
  ],
);

function isSequence(pw: string) {
  const s = pw.toLowerCase();
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

/** Pieces of the person's own email and name that shouldn't be the password. */
function personalBits(email?: string, name?: string) {
  const bits = [email?.split("@")[0], ...(name ?? "").split(/\s+/)]
    .flatMap((b) => (b ?? "").toLowerCase().split(/[^a-z0-9]+/))
    .filter((b) => b.length >= 4);
  return [...new Set(bits)];
}

export function passwordStrength(pw: string, about: { email?: string; name?: string } = {}): Strength {
  if (pw.length < MIN_PASSWORD) {
    return { level: 0, label: "Too short", tip: `Use at least ${MIN_PASSWORD} characters.`, blocked: true };
  }
  const lower = pw.toLowerCase();
  // "Password1!" and "password2024" are still "password".
  const core = lower.replace(/[^a-z0-9]+$/, "").replace(/\d+$/, "");
  const letters = lower.replace(/[^a-z]/g, "");
  if (COMMON.has(lower) || COMMON.has(core) || COMMON.has(letters) || /^(.)\1+$/.test(pw) || isSequence(pw)) {
    return { level: 1, label: "Easy to guess", tip: "That's one of the first passwords people try. Pick something only you would think of.", blocked: true };
  }
  if (personalBits(about.email, about.name).some((b) => lower.includes(b))) {
    return { level: 1, label: "Easy to guess", tip: "Leave out your name and email address.", blocked: true };
  }

  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const words = pw.split(/[\s\-_.,]+/).filter((w) => w.length >= 3).length;
  if (pw.length >= 15 || (pw.length >= 12 && (kinds >= 3 || words >= 3))) return { level: 3, label: "Strong", blocked: false };
  if (pw.length >= 12 || (pw.length >= 10 && kinds >= 3)) {
    return { level: 2, label: "Okay", tip: "A few more characters would make it strong.", blocked: false };
  }
  return { level: 1, label: "Weak", tip: "Longer is stronger.", blocked: false };
}
