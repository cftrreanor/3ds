import os
D = os.path.dirname(os.path.abspath(__file__))
SV = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{}"/></svg>'
WARN = SV.format("M12 4 2.5 20h19L12 4zM12 10v4M12 17h.01")
MAIL = SV.format("M3 6h18v12H3zM3 7l9 6 9-6")
BIN = SV.format("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")
DOWN = '<span aria-hidden="true" style="color:var(--brand);font-size:18px">&#8964;</span>'
EV = "Lone Star Marching Invitational"
APOS = "&apos;"


def page(name, title, body, scrim=False):
    head = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><link rel="stylesheet" href="base.css"></head><body>'
    app = '<header class="app"><b>FIELD COMMAND</b><nav><span>My events</span><span class="wide">Volunteer tracking</span><span class="wide">Account</span></nav></header>'
    main = f'<div class="scrim">{body}</div>' if scrim else f"<main>{body}</main>"
    open(os.path.join(D, name + ".html"), "w").write(head + app + main + "</body></html>")


def steps(items, current_line):
    out = f'<ol class="steps" style="--n:{len(items)};list-style:none;padding:0;margin-top:10px">'
    for cls, lab, note, link in items:
        mark = {"done": "✓ ", "needs": "◆ "}.get(cls, "")
        label = f"<a href=#>{lab}</a>" if link else f'<span class="{"" if cls == "now" else "plain"}">{lab}</span>'
        cur = ' aria-current="step"' if cls == "now" else ""
        out += f'<li class="{cls}"{cur}><div class="bar"></div><div class="lab">{label}</div><div class="note">{mark}{note}</div></li>'
    return out + f'</ol><p class="cur sm"><b>{current_line}</b></p>'


def shell(back, stepbar, title, intro):
    return f'<a class="back" href=#>← {back}</a>{stepbar}<h1 style="margin-top:20px">{title}</h1><p class="muted" style="margin:0">{intro}</p>'


# ---------- 01 Details
S1 = steps([("now", "Details", "Now", False), ("", "Registration", "Not yet", False), ("", "Publish", "Not yet", False)], "Step 1 of 3: Details")
page("01-new-details", "New band contest", shell("My events", S1, "Set up your band contest",
     f"3 short steps, then you can publish. Add your team, maps, and volunteer jobs whenever you{APOS}re ready. Boxes marked * are required. <a href=#>Change the kind of event</a>") + f'''
<div class="card"><h2>Event details</h2><p class="sm muted" style="margin:4px 0 0">The name, date, times, and place everyone sees.</p>
<div class="field"><label>Event name *</label><div class="input">{EV}</div></div>
<div class="field"><label>Date *</label><div class="input" style="max-width:420px">Sat, Mar 20, 2027</div><div class="row sm" style="margin-top:10px"><span class="box"></span> Lasts more than one day</div></div>
<div class="grid2"><div class="field"><label>Start time *</label><div class="input">7:00 AM</div></div><div class="field"><label>End time *</label><div class="input">10:00 PM</div></div></div>
<div class="field"><label>Venue name</label><div class="input">Cedar Ridge High School Stadium</div></div>
<div class="field"><label>Address</label><div class="input">2400 Ridge Rd, Austin, TX</div><div class="hint">Shown with a map link on your public page.</div></div>
<div class="field"><label>Event time zone *</label><div class="input">Central Time (Chicago, Dallas, Houston)</div></div>
<div class="pinbar"><div class="row between"><span class="sm muted">Next: what directors need to register</span><span class="btn main">Save and continue</span></div></div></div>''')

# ---------- Registration
S2 = steps([("done", "Details", "Done", True), ("now", "Registration", "Now", False), ("", "Publish", "Not yet", True)], "Step 2 of 3: Registration")


def regform(state):
    filled = state != "empty"
    chips = "".join(f'<span class="chip">{c}<span class="x" role="button" aria-label="Remove {c}">×</span></span>' for c in ["1A", "2A", "3A", "4A", "5A", "6A"]) if filled else ""
    shortcuts = "" if filled else '<div class="row" style="margin-top:10px"><span class="btn out">Use 1A–6A</span><span class="btn out">Use Divisions I–III</span></div>'
    status = {
        "empty": '<span class="sm muted">Changes save automatically</span>',
        "ready": '<span class="sm ok">✓ Saved</span>',
        "failed": '<span class="sm" style="color:var(--danger);font-weight:600">Couldn' + APOS + 't save the deadline. Check your connection. <a href=# style="color:var(--danger)">Retry</a></span>',
    }[state]
    note = ""
    if state == "empty":
        note = '<p class="sm" style="margin:8px 0 0">You can leave and come back. Before you publish, add at least one classification and a deadline.</p>'
    typed = ""
    if state == "failed":
        typed = '<p class="sm amber" style="margin:8px 0 0">◆ "Class AA" is typed but not added. <a href=#>Add it</a></p>'
    addbox = "Class AA" if state == "failed" else ""
    return shell(f"Back to {EV}", S2, "Band registration", f"What directors need before they register. You can change any of it later.") + f'''
<div class="card">
<div class="field" style="margin-top:0"><label>Classifications *</label><div class="hint" style="margin-top:2px">Bands pick one when they register. The schedule is grouped by these. Add at least one.</div>
<div style="margin-top:4px">{chips}</div>
<div class="row" style="margin-top:8px"><div class="input {"" if addbox else "ph"}" style="flex:1;margin:0">{addbox or "Like 1A or Class AA"}</div><span class="btn out">Add</span></div>{shortcuts}</div>
<div class="field"><label>Registration deadline *</label><div class="input {"" if filled else "ph"}" style="max-width:420px">{"Mon, Mar 1, 2027" if filled else "mm/dd/yyyy"}</div><div class="hint">Registration stays open through this day, and closes at 11:59 PM. You can close it early or reopen it.</div></div>
<div class="field"><label>Information for directors</label><div class="hint" style="margin-top:2px">Entry fee and how to pay, where buses park, and warm-up. Shown when bands register, and in their confirmation email.</div><div class="input area">{"Entry fee: $375 per band, by check to Cedar Ridge Band Boosters or online with the payment link. Buses park in Lot C. Warm-up is on the practice field, 45 minutes before your performance." if filled else ""}</div></div>
<div class="field"><label>Payment link</label><div class="input {"" if filled else "ph"}">{"https://cedarridgeboosters.org/pay" if filled else "Optional"}</div><div class="hint">Shown as a "Pay the entry fee" button on the registration page.</div></div>
<fieldset class="field" style="border:0;padding:0;margin-top:20px"><legend style="font-size:14px;font-weight:600">Contact for directors</legend>
<div class="hint" style="margin-top:2px">Only registered directors and your team see this.</div>
<div class="grid2"><div><span class="lbl">Name</span><div class="input">Dana Whitfield</div></div><div><span class="lbl">Phone</span><div class="input">(512) 555-0142</div></div></div>
<span class="lbl">Email</span><div class="input">dana@cedarridgeband.org</div></fieldset>
<details class="more"><summary>More options: most bands you can take, chaperone limit, and importing bands{DOWN}</summary></details>
<div class="pinbar">
<div class="row between">{status}<span class="btn {"main" if filled else "out"}">Next up: Publish</span></div>
{note}{typed}</div></div>'''


page("02-registration-empty", "Band registration", regform("empty"))
page("03-registration-ready", "Band registration", regform("ready"))
page("03b-registration-save-failed", "Band registration", regform("failed"))

# ---------- Publish
def evhead(status):
    pill = '<span class="pill live">Published</span>' if status == "pub" else '<span class="pill" style="background:var(--warningsoft);border-color:transparent">Draft</span>'
    return f'<h1 style="margin-top:20px">{EV}</h1><div class="row">{pill}<span class="pill">Band contest</span></div><p class="muted" style="margin:6px 0 0">Sat, Mar 20, 2027 · 7:00 AM – 10:00 PM CDT · Cedar Ridge High School Stadium</p>'


S3n = steps([("done", "Details", "Done", True), ("needs", "Registration", "Add a deadline", True), ("now", "Publish", "Now", False)], "Step 3 of 3: Publish")
S3r = steps([("done", "Details", "Done", True), ("done", "Registration", "Done", True), ("now", "Publish", "Now", False)], "Step 3 of 3: Publish")
page("04-publish-not-ready", "Event page", f'<a class="back" href=#>← My events</a>{S3n}{evhead("draft")}' + f'''
<div class="card" style="border:2px solid var(--brand)"><h2>Not ready to publish yet</h2>
<div class="note-amber"><p style="margin:0" class="amber">◆ Publishing needs a registration deadline</p><p style="margin:4px 0 10px">Add the date registration closes. Everything else can wait.</p><span class="btn main">Add a deadline</span></div></div>''')

page("05-publish-ready", "Event page", f'<a class="back" href=#>← My events</a>{S3r}{evhead("draft")}' + f'''
<div class="card" style="border:2px solid var(--brand)"><h2>Ready to publish</h2>
<p class="sm" style="margin:12px 0 4px"><b>When you publish</b></p>
<ul class="sm" style="margin:0;padding-left:20px;line-height:1.8"><li>Your public page goes online with the date and place, and a map link</li><li>Directors can register in 6 classifications, through Mon, Mar 1</li><li>Nobody is emailed. People find out when you share your link or invite directors</li><li>You can keep editing everything</li></ul>
<div class="row" style="margin-top:16px"><span class="btn main">Publish and open registration</span></div>
<p class="sm" style="margin:12px 0 0"><a href=#>Preview the public page</a> · <a href=#>Preview the registration page</a></p></div>
<div class="card"><h2 style="font-size:16px">Any time, before or after publishing</h2>
<div class="list"><div><span class="sm">Volunteer jobs: Concessions, Parking, Gate crew</span><span class="btn out">Add jobs</span></div><div><span class="sm">Check-in stops for contest day</span><span class="btn out">Set stops</span></div><div><span class="sm">Maps and documents</span><span class="btn out">Add a map</span></div><div><span class="sm">Your team</span><span class="btn out">Invite</span></div></div></div>''')

# ---------- Stage bar + sections
def prep(reg, sched, stops, day, cur):
    return steps([reg, sched, stops, day], cur)


def sections(vol="6 of 20 spots filled", stops_txt="Not set yet · due by Mar 6"):
    return f'''<h2 style="margin-top:28px;font-size:18px">Your contest</h2><nav class="sections" aria-label="Your contest">
<a href=#><b>Bands</b><span>12 registered · open through Mar 1</span></a>
<a href=#><b>Schedule</b><span>Draft any time · post times by Mar 6</span></a>
<a href=#><b>Check-in stops</b><span>{stops_txt}</span></a>
<a href=#><b>Volunteer jobs</b><span>{vol}</span></a>
<a href=#><b>Team</b><span>2 co-hosts</span></a>
<a href=#><b>Event settings</b><span>Details, emails, maps, and publishing</span></a></nav>'''


P1 = prep(("now", "Registration", "Open · 0 bands", False), ("", "Schedule", "Draft any time", True), ("", "Check-in stops", "Due by Mar 6", True), ("", "Contest day", "Sat, Mar 20", True), "Registration: open · 0 bands · through Mar 1")


def share(history):
    if history:
        directors = f'''<div><span class="sm"><b>{MAIL} Band directors</b><br><span class="muted">18 directors from your earlier contests. Invited directors register in one tap, with their band{APOS}s details filled in.</span></span><span class="btn main">Invite directors</span></div>'''
    else:
        directors = f'''<div><span class="sm"><b>{MAIL} Band directors</b><br><span class="muted">Have last year{APOS}s director list? Import it from a spreadsheet and invite everyone in one step.</span></span><span class="btn main">Import directors</span></div>'''
    return f'''<div class="card" style="border:2px solid var(--brand)"><h2>Get the word out</h2><p class="sm muted" style="margin:4px 0 0">Nobody hears about your contest until you share it.</p>
<div class="list">{directors}
<div><span class="sm"><b>Registration link</b><br><span class="muted" style="font-family:ui-monospace,monospace">fieldcommandevents.com/e/lone-star-marching/bands</span></span><span class="row"><span class="btn out">Copy link</span><span class="btn out">Show QR code</span></span></div>
<div><span class="sm"><b>Volunteer sign-up</b><br><span class="muted">For your band parents{APOS} group text.</span></span><span class="row"><span class="btn out">Copy link</span><span class="btn out">Show QR code</span></span></div></div></div>'''


page("06-published-share", "Just published", f'<a class="back" href=#>← My events</a>{P1}{evhead("pub")}<div class="toast"><b>✓ Published.</b> Band registration is open through Mon, Mar 1.</div>{share(True)}{sections("No jobs yet", "Not set yet · due by Mar 6")}')
page("06b-published-share-first-time", "Just published, no past directors", f'<a class="back" href=#>← My events</a>{P1}{evhead("pub")}<div class="toast"><b>✓ Published.</b> Band registration is open through Mon, Mar 1.</div>{share(False)}{sections("No jobs yet", "Not set yet · due by Mar 6")}')

# ---------- 07 invite
rows = [("Cedar Park HS", "Jordan Ellis · jellis@cpisd.org", "on", ""), ("Georgetown HS", "Lee Park · lpark@georgetownisd.org", "on", ""),
        ("Leander HS", "Priya Raman · praman@leanderisd.org", "on", ""), ("Vista Ridge HS", "Sam Ortega · sortega@leanderisd.org", "on", ""),
        ("Hutto HS", "Morgan Diaz · mdiaz@huttoisd.net", "on", ""), ("Round Rock HS", "Alex Kim · akim@roundrockisd.org", "", "inv"),
        ("Pflugerville HS", "Chris Lane · clane@pfisd.net", "on", ""), ("Westwood HS", "Taylor Brooks · tbrooks@roundrockisd.org", "", "inv")]
lis = ""
for name, who, on, tag in rows:
    tagh = '<span class="tag">Invited Oct 8</span>' if tag == "inv" else ""
    lis += f'<label class="check" style="min-height:56px;cursor:pointer"><span class="box {on}"></span><span style="flex:1"><b>{name}</b> {tagh}<br><span class="sm muted">{who}</span></span></label>'
page("07-invite-directors", "Invite directors", f'''
<dialog open><span class="close" aria-label="Close">✕</span><h2 style="padding-right:48px">Invite directors to register</h2>
<p class="sm muted" style="margin:6px 0 0">Each director gets one email with the registration link and the deadline. Their band{APOS}s details are filled in from before, and they register without a code. Nobody is added to your team.</p>
<div class="input ph" style="margin-top:14px">Search by school or name</div>
<div class="row between sm" style="margin-top:10px"><span><b>15 of 18 chosen</b> · 3 already invited</span><span><a href=#>Choose all</a> · <a href=#>Choose none</a></span></div>
<div class="list scroll">{lis}<div class="check sm muted">Registered already: Bowie HS ✓ (not shown in the count)</div></div>
<p class="sm" style="margin:12px 0 0">Someone else? <a href=#>Import a spreadsheet of directors</a></p>
<div class="row" style="margin-top:16px"><span class="btn main">Send 15 invitations</span><span class="btn out">Cancel</span></div>
<p class="xs muted" style="margin:10px 0 0"><a href=#>Preview the email</a> · Replies go to dana@cedarridgeband.org (Event settings › Emails).</p></dialog>''', scrim=True)

# ---------- 08 registration open
P2 = prep(("now", "Registration", "Open · 12 bands · through Mar 1", False), ("", "Schedule", "Post times by Mar 6", True), ("needs", "Check-in stops", "Not set · due Mar 6", True), ("", "Contest day", "Sat, Mar 20", True), "Registration: open · 12 bands · through Mar 1")
page("08-prep-registration-open", "Registration open", f'''<a class="back" href=#>← My events</a>{P2}{evhead("pub")}
<div class="toast"><b>✓ Sent to 15 directors.</b> They{APOS}ll show as "Invited Oct 30" if you invite more.</div>
<div class="card" style="border:2px solid var(--brand)"><div class="row between"><h2>Band registration</h2><span class="tag ok">Open through Mon, Mar 1</span></div>
<div class="stat"><div><span class="xs muted">Bands registered</span><b>12</b></div><div><span class="xs muted">Classifications with bands</span><b>5 of 6</b></div><div><span class="xs muted">Days until it closes</span><b>9</b></div></div>
<p class="sm" style="margin:12px 0 0"><b>9 of 15 invited directors</b> have registered. <a href=#>See who hasn{APOS}t</a></p>
<p class="sm" style="margin:6px 0 0"><span class="amber">◆ No 2A bands yet.</span> <a href=#>Invite 2A directors</a></p>
<div class="row" style="margin-top:14px"><span class="btn out">See the bands</span><span class="btn out">Invite more directors</span><span class="btn out">Copy registration link</span></div>
<div class="row" style="margin-top:6px"><span class="btn del">Close registration early</span></div></div>
<div class="card"><h2 style="font-size:16px">Before contest day</h2>
<div class="list"><div><span class="sm"><b>Check-in stops:</b> not set yet. Due by Fri, Mar 6.</span><span class="btn out">Set check-in stops</span></div>
<div><span class="sm"><b>Volunteers:</b> Parking has no shifts yet, so nobody can sign up for it.</span><span class="btn out">Add shifts</span></div></div></div>
{sections()}''')

page("08b-close-registration", "Close registration early", f'''
<dialog open><span class="close" aria-label="Close">✕</span><h2 style="padding-right:48px">Close registration early?</h2>
<p class="sm" style="margin:10px 0 0">12 bands are registered. Directors who open the link will see "Registration is closed." Registered bands aren{APOS}t emailed.</p>
<p class="sm" style="margin:8px 0 0">You can reopen it with a new deadline.</p>
<div class="row" style="margin-top:18px"><span class="btn" style="background:var(--danger);color:#fff">Close registration</span><span class="btn out">Keep it open</span></div></dialog>''', scrim=True)

# ---------- 09 schedule
P3 = prep(("done", "Registration", "Closed · 24 bands", True), ("now", "Schedule", "Post times by Mar 6", False), ("needs", "Check-in stops", "Not set · due Mar 6", True), ("", "Contest day", "Sat, Mar 20 · 18 days", True), "Schedule: post times by Fri, Mar 6")
page("09-prep-schedule", "Build the schedule", f'''<a class="back" href=#>← My events</a>{P3}{evhead("pub")}
<div class="card" style="border:2px solid var(--brand)"><h2>Next: post the schedule by Fri, Mar 6</h2>
<p class="sm muted" style="margin:4px 0 0">24 bands in 6 classifications. Pick a start time and how long each band gets, and the times are filled in for you. You set the order, by classification. Nothing is shared until you post it.</p>
<div class="row" style="margin-top:14px"><span class="btn main">Build the schedule</span></div>
<p class="sm muted" style="margin:12px 0 0">When you post it, each director is emailed their times. Directors need about two weeks to book buses.</p></div>
<div class="card"><div class="row between"><h2 style="font-size:16px">Band registration</h2><span class="tag">Closed Mar 1 · 24 bands</span></div>
<div class="row" style="margin-top:10px"><span class="btn out">See the bands</span><span class="btn out">Reopen registration</span></div></div>
<div class="card"><h2 style="font-size:16px">Before contest day</h2>
<div class="list"><div><span class="sm"><b>Check-in stops:</b> not set yet. Due by Fri, Mar 6.</span><span class="btn out">Set check-in stops</span></div></div></div>
{sections("14 of 20 spots filled", "Not set yet · due by Mar 6")}''')

# ---------- 10 volunteer jobs
page("10-volunteer-jobs", "Volunteer jobs", f'''<a class="back" href=#>← Back to {EV}</a>
<div class="row between" style="margin-top:10px"><h1 style="margin:0">Volunteer jobs</h1><span class="row"><span class="btn out">Copy volunteer link</span><span class="btn out">+ Add a job</span></span></div>
<p class="muted sm" style="margin:4px 0 0">Parents sign up for these from your event page, and see changes right away.</p>
<div class="list joblist" style="margin-top:16px">
<a href=#><span><b>Parking</b><br><span class="xs muted">Check-in stop: Parking</span></span><span class="amber xs">◆ Needs a shift</span></a>
<a href=# class="on" aria-current="page"><span><b>Concessions</b></span><span class="xs">2 of 8 filled</span></a>
<a href=#><span><b>Gate crew</b><br><span class="xs muted">Check-in stop: Gate</span></span><span class="xs muted">4 of 6 filled</span></a></div>
<div class="card">
<h2>Concessions</h2>
<p class="sm" style="margin:12px 0 0"><b>What do volunteers sign up for?</b></p>
<div class="row" style="margin-top:8px"><span class="btn out" style="border:2px solid var(--brand);background:var(--brandsoft)">✓ Shifts</span><span class="btn off">Things to bring</span></div>
<p class="xs muted" style="margin:6px 0 0">To switch to things to bring, first delete this job{APOS}s shifts.</p>
<div class="field"><label>Job name *</label><div class="input">Concessions</div></div>
<h3 style="margin-top:20px">Shifts</h3>
<div class="list"><div><b class="sm">8:00 – 11:00 AM</b><span class="row sm"><span class="muted">2 of 4 filled</span><a href=# class="sm">Edit</a></span></div>
<div><b class="sm">11:00 AM – 2:00 PM</b><span class="row sm"><span class="muted">0 of 4 filled</span><a href=# class="sm">Edit</a><span class="btn del">{BIN} Delete</span></span></div></div>
<p class="sm" style="margin:8px 0 0"><a href=#>+ Add more shifts</a></p>
<details class="more" open><summary>More options: check-in stop, Coordinators, instructions, adults only, and deleting this job{DOWN}</summary>
<div style="padding:0 12px 12px"><div class="field"><label>Check-in stop</label><div class="input">None</div><div class="hint">Make this job a contest-day stop, like Parking or the Gate. Bands are checked in here in order.</div></div>
<p class="sm muted" style="margin:16px 0 0">2 people signed up, so this job can{APOS}t be deleted. <a href=#>See who{APOS}s signed up</a></p></div></details>
<div class="pinbar"><div class="row between"><span class="sm ok">✓ Saved</span><span class="btn main">Back to the event</span></div></div></div>''')

# ---------- 11 classification in use
page("11-classification-in-use", "Classification in use", shell(f"Back to {EV}", "", "Band registration", "Registration is open through Mon, Mar 1.") + f'''
<div class="card"><div class="field" style="margin-top:0"><label>Classifications *</label><div class="hint" style="margin-top:2px">Bands pick one when they register. The schedule is grouped by these.</div>
<div style="margin-top:4px"><span class="chip">1A · 2 bands</span><span class="chip">2A · 0 bands<span class="x" role="button" aria-label="Remove 2A">×</span></span><span class="chip">3A · 3 bands</span><span class="chip">4A · 4 bands</span><span class="chip">5A · 2 bands</span><span class="chip">6A · 1 band</span></div>
<p class="sm muted" style="margin:10px 0 0">A classification with bands in it can{APOS}t be removed. <a href=#>Move bands to another classification</a></p></div>
<div class="pinbar"><div class="row between"><span class="sm ok">✓ Saved</span><span class="btn main">Back to the event</span></div></div></div>''')
print("ok")
