import { brand } from "@/lib/brand";

/**
 * The pages for each kind of school event (/band-contests, /choir-festivals…),
 * written for the people who run them and the words they search for.
 * Every claim here must match what the product really does: no payments,
 * texting, ticketing, waitlists or exports.
 */
export type Audience = {
  path: `/${string}`;
  /** The event type (src/lib/event-types.ts) ticked on this page's pilot form. */
  eventType: string;
  icon: string;
  /** Short name, for links between the pages. */
  name: string;
  /** The browser tab and search result title (the brand is added after it). */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  intro: string;
  examples: string;
  /** What it replaces: the tools people use today. */
  replaces: string[];
  sections: { title: string; body: string; points: string[] }[];
  privacy: string[];
  faqs: { q: string; a: string }[];
};

const VOLUNTEERS_TOO =
  "Volunteers sign up for shifts on their phone without making an account, get a confirmation, a calendar invite and a reminder the day before, and are checked in at the desk with one tap.";

export const audiences = {
  bands: {
    path: "/band-contests",
    eventType: "band_contest",
    icon: "🎺",
    name: "Band contests",
    metaTitle: "Band Contest Registration, Scheduling & Check-in Software",
    metaDescription:
      "Run a marching band contest or jazz festival: online band registration with saved details, a published performance schedule with finals, a live order for spectators, and contest day check-in from parking to the gate.",
    eyebrow: "For band directors and band booster clubs",
    headline: "Band contests, from registration to the last performance.",
    intro:
      "Host a marching invitational, jazz festival or solo & ensemble without the emailed forms, spreadsheets and group texts. Directors register online, you publish the schedule, and your volunteers check every band through, from the parking lot to the gate, on their own phones.",
    examples: "Marching invitationals, jazz festivals, solo & ensemble, concert band contests",
    replaces: [
      "Registration forms emailed back and forth",
      "A schedule retyped and re-sent every time something changes",
      "Clipboards at the parking lot, check-in table and gate",
      "Group texts asking where a band is",
    ],
    sections: [
      {
        title: "Band registration that remembers",
        body: "Share one registration link. Directors enter their school, band, classification, directors, student and chaperone counts, vehicles, scheduling conflicts and any staging or accessibility needs.",
        points: [
          "Invite directors from your past contests, and their saved band details are filled in for them",
          "Set your own classifications, a chaperone limit, and a registration deadline that closes on its own",
          "Directors can update or withdraw while registration is open; after that, changes come through you",
          "Headcounts only: student names are never collected",
        ],
      },
      {
        title: "A performance schedule everyone can trust",
        body: "Build the preliminaries running order with warm-up and performance times, locations and breaks, then publish it for directors and spectators.",
        points: [
          "Directors are emailed when their time changes, and anyone with the schedule open is told it was updated",
          "Running late? Push the rest of the schedule back in one step, and affected directors are emailed",
          "Publish finals times first, then reveal the finalists when you're ready",
          "Directors add their performance and finals times to their calendar in one tap",
        ],
      },
      {
        title: "Contest day check-in, your way",
        body: "Set the stops every band moves through, like Parking, Check-in, Warm-up and the Gate. Volunteers at each stop tap a band through on any phone, tablet or laptop.",
        points: [
          "Assign parking spots for buses, equipment trucks and trailers as bands arrive",
          "See which bands are on track, running late or still to arrive",
          "Every tap records who made it and when, and can be undone",
          "Directors see their band's next step on their own phone",
        ],
      },
      {
        title: "A live order for spectators",
        body: "Families and fans follow the public schedule on their phones: who's performing now, who's next, and who has already performed.",
        points: [
          "Spectators never see contact details or headcounts",
          "Post a banner for a weather delay or schedule change",
          "Share parking maps and director packets with exactly the people who need them",
        ],
      },
      {
        title: "Volunteers for every station",
        body: `Concessions, parking, the gate and hospitality all run on the same event. ${VOLUNTEERS_TOO}`,
        points: [
          "Volunteer Leads and Section Leads see only what their role needs",
          "Walk-up volunteers can be added and checked in on the day",
        ],
      },
    ],
    privacy: [
      "Bands' contact details are seen only by your hosts and that band's own director.",
      "Section Leads see each band's name, school and progress; Volunteer Leads also see headcounts and vehicles.",
      "Directors' personal details are removed 2 years after the contest. The band, school and headcounts stay for your records.",
      "Volunteers' details are deleted 10 days after the contest.",
    ],
    faqs: [
      {
        q: "How do band directors register for our contest?",
        a: "Share one registration link. Directors sign in, register their band with its classification, directors, headcounts, chaperones and vehicles, and can update it while registration is open. They see their performance time as soon as you publish the schedule.",
      },
      {
        q: "Can returning bands reuse last year's registration?",
        a: "Yes. Invite the directors who registered at your earlier contests. Their link opens registration with their saved band details already filled in.",
      },
      {
        q: "Does it collect entry fees?",
        a: `No, ${brand.name} doesn't process payments. Add your entry fee and how to pay to the information for directors, which shows on the registration page, and collect it the way you do today. Directors never pay a platform fee.`,
      },
      {
        q: "What happens when the contest runs late?",
        a: "Push the rest of the schedule back by however many minutes you need. Affected directors are emailed their new time, and the public schedule and anyone with it open are updated.",
      },
      {
        q: "Can parents and fans follow the performance order?",
        a: "Yes. The public event page shows the schedule live on contest day: who's performing now, who's next and who has performed, with no contact details or headcounts.",
      },
    ],
  },

  groups: {
    path: "/choir-festivals",
    eventType: "group_event",
    icon: "👥",
    name: "Choir & group festivals",
    metaTitle: "Choir, Orchestra & Group Festival Scheduling Software",
    metaDescription:
      "Run a choir or orchestra festival, theater, or speech and debate event: groups register online and move through your rooms on a schedule built for you, while directors and families follow every room live.",
    eyebrow: "For choir directors and fine arts directors",
    headline: "Choir and group festivals that stay on time.",
    intro:
      "Choir and orchestra festivals, theater, speech and debate: groups register online, then move through your rooms on a schedule built for you. Your team taps each group in and out of every room, and directors and families follow along live.",
    examples: "Choir and orchestra festivals, theater, speech & debate",
    replaces: [
      "Room rotations worked out by hand in a spreadsheet",
      "Runners sent to see whether a room is ready",
      "Printed itineraries that are out of date by mid-morning",
      "A separate emailed form for every group",
    ],
    sections: [
      {
        title: "Registration for every group",
        body: "Share one registration link. Directors register their group with its directors, participant and chaperone counts, scheduling conflicts and any accessibility needs.",
        points: [
          "Invite directors from your past festivals, and their saved details are filled in for them",
          "Set a registration deadline that closes on its own",
          "Headcounts only: student names are never collected",
        ],
      },
      {
        title: "Your rooms, in order",
        body: "Add your rooms, such as warm-up, performance, sight-reading or a clinic, and the order every group moves through them, each with its own number of minutes.",
        points: [
          "Add a note to each room, like “Room 112, east hallway”",
          "List hospitality and other rooms that aren't part of the rotation",
        ],
      },
      {
        title: "A schedule built for you",
        body: "Set the start time, the minutes between groups and the passing time between rooms, and every group's itinerary is worked out for you.",
        points: [
          "Change a group's starting order, skip a room for one group, or add a lunch break",
          "Adjust any time by hand, then publish",
          "Running behind? Push the schedule back in one step",
        ],
      },
      {
        title: "Every room on time",
        body: "On the day, anyone on your team taps a group Arrived when it reaches the building and Done as it finishes each room, on any phone, tablet or laptop.",
        points: [
          "One view of all groups, plus a view for each room",
          "Taps can be taken back if someone taps the wrong group",
        ],
      },
      {
        title: "Families follow each room live",
        body: "The public event page shows what's happening now and next in every room, so families know where to be. Directors see their own group's itinerary and progress.",
        points: [
          "Post a banner when something changes",
          "Share maps and director packets with exactly the people who need them",
          VOLUNTEERS_TOO,
        ],
      },
    ],
    privacy: [
      "Groups' contact details are seen only by your hosts and that group's own director.",
      "Families see room times, never contact details or headcounts.",
      "Directors' personal details are removed 2 years after the festival. The group, school and headcounts stay for your records.",
      "Volunteers' details are deleted 10 days after the festival.",
    ],
    faqs: [
      {
        q: "How is the room schedule built?",
        a: "Add your rooms in the order groups move through them and how long each takes, then set the start time, the minutes between groups and the passing time. Every group's itinerary is worked out for you, and you can change the order, skip rooms, add breaks or adjust any time before you publish.",
      },
      {
        q: "Does it work for orchestra, theater, or speech and debate?",
        a: "Yes. Any event where groups register and move through rooms on a schedule works the same way: orchestra and choir festivals, theater, speech and debate, and more.",
      },
      {
        q: "What if a room falls behind?",
        a: "Your team taps each group Arrived and Done, so you can see where every room stands. If the day runs late, push the schedule back by however many minutes you need.",
      },
      {
        q: "Can families see where their child's group is?",
        a: "Yes. The public event page shows each room's current and next group on the day, on any phone, with no app to download.",
      },
      {
        q: "Do visiting directors pay or need an app?",
        a: `No. Visiting directors use ${brand.name} free, in their phone's web browser. Only the school or organization hosting the festival pays to use it. Any festival fee is set and collected by the host.`,
      },
    ],
  },

  fairs: {
    path: "/school-fairs",
    eventType: "fair",
    icon: "🎪",
    name: "School fairs & fundraisers",
    metaTitle: "School Fair, Carnival & Fundraiser Planning Software for PTOs",
    metaDescription:
      "Plan a fall festival, carnival or PTO fundraiser: organize booths and community partners by zone, staff every booth with volunteers, check partners in on the day, and share a public page of everything at the event.",
    eyebrow: "For PTO and PTA leaders",
    headline: "Fall festivals, carnivals and fundraisers, organized.",
    intro:
      "Keep every booth, community partner and volunteer shift for your school fair in one place. Partners are checked in as they arrive, volunteers sign up for booths on their own phones, and families see everything at the event on one public page that thanks your partners.",
    examples: "Fall festivals, carnivals, field days, PTO fundraisers",
    replaces: [
      "A booth spreadsheet that only one person can find",
      "Volunteer sign-up sheets passed around at pickup",
      "Texting partners to see if they've arrived",
      "Flyers reprinted when a booth changes",
    ],
    sections: [
      {
        title: "Booths, organized by zone",
        body: "Add every booth with its location, a short description and the partner or vendor running it, and group them into zones.",
        points: [
          "Start with Game Zone, Activity Stations, Marketplace, Showcase and Food & Drinks, or name your own zones",
          "Choose which booths are listed publicly",
          "Keep each partner's contact details private to your team",
        ],
      },
      {
        title: "Community partners checked in on the day",
        body: "As partners and vendors arrive, anyone on your team taps them Arrived on any phone, so you can see at a glance which booths are still waiting.",
        points: ["Taps can be undone if someone taps the wrong booth"],
      },
      {
        title: "Volunteers for every booth",
        body: VOLUNTEERS_TOO,
        points: [
          "Give each volunteer station a zone, and a Station Coordinator to run it",
          "Parents can sign up with their student, under one sign-up",
          "Mark stations like parking as adults only",
          "Add walk-up volunteers on the day",
        ],
      },
      {
        title: "A “What's at the event” page",
        body: "Families see everything at your fair, zone by zone, on one public page they can pull up on their phone. It's a simple way to thank the partners and sponsors who make the day happen.",
        points: [
          "Share it with a link or a QR code",
          "Post a banner for a weather change or a new start time",
          "Share a map of the grounds with everyone, or a packet with just your volunteers",
        ],
      },
    ],
    privacy: [
      "Partners' contact details never appear on the public page, and are removed 15 months after the event.",
      "Volunteers' details are deleted 10 days after the event.",
      "Student volunteers under 18 are stored by first name and last initial, with their parent's contact details.",
      "Station Coordinators see their volunteers' phone numbers only on event day.",
    ],
    faqs: [
      {
        q: "Can we make our own zones?",
        a: "Yes. Pick from the suggested zones or type any zone name you like, such as Bounce Houses or Bake Sale. Booths and volunteer stations can both have a zone.",
      },
      {
        q: "How do volunteers sign up for booths?",
        a: "Share one link or QR code. Volunteers pick a station and shift on their phone without making an account, and get a confirmation, a calendar invite and a reminder the day before.",
      },
      {
        q: "Can students volunteer at our fair?",
        a: "Yes. A parent can sign up with their student under one sign-up. Under-18 helpers are stored by first name and last initial with the parent's contact details, and you can mark any station as adults only.",
      },
      {
        q: "Does it sell tickets or take payments?",
        a: `No. ${brand.name} organizes your booths, partners and volunteers; keep selling tickets and taking payments the way you do today.`,
      },
    ],
  },

  volunteers: {
    path: "/school-volunteers",
    eventType: "volunteer",
    icon: "🙋",
    name: "School volunteers",
    metaTitle: "School Volunteer Sign-up, Scheduling & Check-in Software",
    metaDescription:
      "School volunteer management for PTOs, booster clubs and front offices: shift sign-ups with no account needed, confirmations, calendar invites and day-before reminder emails, and one-tap check-in on any device.",
    eyebrow: "For PTOs, booster clubs and front offices",
    headline: "School volunteers, signed up, reminded and checked in.",
    intro:
      "Concessions, field day, book fairs, school parking: build your stations and shifts, share one link, and volunteers sign up on their own phones. Confirmations, calendar invites and reminders go out on their own, and you always know who's coming and who's here.",
    examples: "Concessions, field day, book fairs, school parking, events of every kind",
    replaces: [
      "Paper sign-up sheets and shared spreadsheets",
      "Reminder emails sent one at a time the night before",
      "Group texts to fill a last-minute gap",
      "Guessing who actually showed up",
    ],
    sections: [
      {
        title: "Stations and shifts, built with ease",
        body: "Set up each station, its shifts and how many people each shift needs. Sign-ups stop when a shift is full, so you never end up with ten people at one table and nobody at the next.",
        points: [
          "Add where volunteers should report and who's leading each station",
          "Open and close sign-ups whenever you're ready",
          "Mark stations like parking as adults only",
        ],
      },
      {
        title: "Sign-ups without accounts",
        body: "Share one link or QR code. Volunteers pick their shifts on their phone without making an account or downloading anything.",
        points: [
          "Sign up with up to four others, such as a spouse or a student",
          "Under-18 helpers sign up with a parent's contact details",
          "A private link lets each volunteer see or cancel their shifts",
        ],
      },
      {
        title: "Reminders that go out on their own",
        body: "Every volunteer gets a confirmation email with a calendar invite, an update if their shift changes, and a reminder the day before with their station, time, where to report and who their lead is.",
        points: ["No advertisements in any email", "No extra work for you"],
      },
      {
        title: "Check-in on any device",
        body: "Check volunteers in at the desk with one tap, on any phone, tablet or laptop. Walk-ups can be added and checked in on the spot, even onto a full shift.",
        points: [
          "Release a no-show to free up their spot",
          "See who's registered, who's arrived and who's still to come",
        ],
      },
      {
        title: "Leads for every station",
        body: "Invite Volunteer Leads to run the desk and Section Leads to run a station. Each sees what their role needs, and nothing they don't.",
        points: [
          "Section Leads see their volunteers' phone numbers only on event day",
          "Volunteers see their lead's contact details, so they know who to find",
        ],
      },
    ],
    privacy: [
      "Volunteers never make an account, and their details are deleted 10 days after the event.",
      "Under-18 helpers are stored by first name and last initial, with their parent's contact details.",
      "Section Leads see their volunteers' contact details only on event day.",
      "We never sell anyone's data, and there are no ads.",
    ],
    faqs: [
      {
        q: "Do volunteers need to create an account?",
        a: "No. Volunteers sign up from a link or QR code with just their name and contact details. Their confirmation email includes a private link to see or cancel their shifts.",
      },
      {
        q: "Do volunteers get reminders?",
        a: "Yes. A confirmation email with a calendar invite when they sign up, an update if their shift changes, and a reminder the day before with their station, time, where to report and their lead.",
      },
      {
        q: "How do we keep track of who showed up?",
        a: "Check volunteers in at the desk with one tap on any device. You see who's registered, who's arrived and who's still to come, and you can add walk-ups or release no-shows on the spot.",
      },
      {
        q: "Can parents sign up with their kids?",
        a: "Yes. One person can sign up with up to four others, and the whole group takes the same shifts. Under-18 helpers use their parent's contact details, and stations can be marked adults only.",
      },
      {
        q: "Can we use it for volunteers at band contests or school fairs too?",
        a: "Yes. Volunteer sign-ups and check-in are built into every kind of event, from band contests and choir festivals to school fairs and school visitor days.",
      },
    ],
  },

  parents: {
    path: "/parent-check-in",
    eventType: "school_visit",
    icon: "🏫",
    name: "Parent & visitor check-in",
    metaTitle: "Parent & Visitor Check-in for Schools: A Google Form Alternative",
    metaDescription:
      "Parent registration and visitor check-in for family lunches, open houses, performances and award days: parents register each child, teacher and grade, get a photo ID reminder, and are checked in at the door on any device.",
    eyebrow: "For school front offices and administrators",
    headline: "Parent and visitor check-in, without the Google Form.",
    intro:
      "For family lunches, open houses, performances and award days, parents register ahead with each child's name, teacher and grade, get a reminder to bring a photo ID, and your front office checks every adult in at the door. Children's details are seen only by your team, and deleted 30 days after.",
    examples: "Family lunches, open houses, grandparents' days, performances, award days",
    replaces: [
      "A Google Form, and a spreadsheet of children's names that never gets deleted",
      "Printed lists checked off by hand at the front door",
      "Reminder emails about photo ID sent by hand",
      "Headcounts guessed for the cafeteria or gym",
    ],
    sections: [
      {
        title: "Parents register ahead",
        body: "Share one link or QR code. Parents enter their name and email, an optional mobile number, any other adults coming with them, and each child's name, teacher and grade.",
        points: [
          "Register up to eight children in one go",
          "Each adult is checked in separately at the door",
          "No account for parents to create, and nothing to download",
        ],
      },
      {
        title: "A reminder to bring photo ID",
        body: "Parents get a confirmation email with a calendar invite that reminds them to bring a government-issued photo ID, and another reminder the day before.",
        points: ["A private link lets parents see or cancel their registration"],
      },
      {
        title: "Check-in at the door",
        body: "Your team checks off each adult at the door with one tap, on any phone, tablet or laptop, and sees how many have registered and arrived.",
        points: [
          "Your staff still checks each photo ID in person",
          "Registered and arrived numbers at a glance, for planning seating or food",
        ],
      },
      {
        title: "Registration on your schedule",
        body: "Close registration by hand, or set a date and time for it to close on its own.",
        points: ["Optionally tell families that walk-ins are welcome"],
      },
    ],
    privacy: [
      "Children's names, teachers and grades are seen only by your event team, and Section Leads see them only on event day.",
      "Every registration, including children's details, is deleted 30 days after the event.",
      "Parents never make an account.",
      "We never sell anyone's data, and there are no ads.",
    ],
    faqs: [
      {
        q: "Can we use this instead of a Google Form for parent check-in?",
        a: "Yes. Parents register ahead with each child's name, teacher and grade, get a reminder to bring a photo ID, and your front office checks every adult in at the door on any device. Unlike a form spreadsheet, children's details are seen only by your event team and are deleted 30 days after the event.",
      },
      {
        q: "Do parents need an account or an app?",
        a: "No. Parents register from a link or QR code in their phone's web browser, and get a private link to see or cancel their registration.",
      },
      {
        q: "Does it check photo IDs?",
        a: "Your staff checks each photo ID at the door, as they do today. Parents are reminded to bring one in their calendar invite and in an email the day before, so fewer arrive without it.",
      },
      {
        q: "Who can see children's names?",
        a: "Only your event team. Section Leads see them only on the day of the event, and every registration is deleted 30 days after the event.",
      },
      {
        q: "Can walk-ins still come?",
        a: "That's up to you. You can show a “walk-ins welcome” notice on the registration page, and close registration by hand or at a set date and time.",
      },
    ],
  },
} satisfies Record<string, Audience>;

/** In the order of the home page's event-type cards. */
export const AUDIENCES: Audience[] = [audiences.bands, audiences.groups, audiences.fairs, audiences.volunteers, audiences.parents];
