import os
D=os.path.dirname(os.path.abspath(__file__))
I={
 'warn':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 2.5 20h19L12 4zM12 10v4M12 17h.01"/></svg>',
 'band':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>',
 'mail':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6"/></svg>',
 'bin':'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
 'x':'<svg class="ic" style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
}
def page(name,title,body,scrim=False):
    head=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><link rel="stylesheet" href="base.css"></head><body>'
    app='<header class="app"><b>FIELD COMMAND</b><nav><span>My events</span><span class="wide">Volunteer tracking</span><span class="wide">Account</span></nav></header>'
    open(os.path.join(D,name+'.html'),'w').write(head+app+(f'<div class="scrim">{body}</div>' if scrim else f'<main>{body}</main>')+'</body></html>')

def steps(items, n=None):
    out=f'<ol class="steps" style="--n:{n or len(items)};list-style:none;padding:0;margin-top:10px">'
    for cls,lab,note in items:
        mark={'done':'✓ ','needs':'◆ '}.get(cls,'')
        out+=f'<li class="{cls}"><div class="bar"></div><div class="lab">{lab if cls=="now" else f"<a href=#>{lab}</a>"}</div><div class="note">{mark}{note}</div></li>'
    return out+'</ol>'
SETUP=lambda a,b,c: steps([a,b,c])
EV='Lone Star Marching Invitational'

# 01 details
page('01-new-details','New band contest',f'''
<a class="back" href=#>← My events</a>
<h1>Set up your band contest</h1>
<p class="sm muted" style="margin:0">Step 1 of 3. Team, emails, and maps wait in Event settings for whenever you want them. Boxes marked * are required. <a href=#>Change the kind of event</a></p>
{SETUP(("now","Details","Now"),("","Registration","Not yet"),("","Publish","Not yet"))}
<div class="card"><h2>Event details</h2><p class="sm muted" style="margin:4px 0 0">The name, date, times, and place everyone sees.</p>
<div class="field"><label>Event name *</label><div class="input">{EV}</div></div>
<div class="grid2"><div class="field"><label>Date *</label><div class="input">Sat, Mar 20, 2027</div></div><div class="field"><label>&nbsp;</label><div class="row" style="min-height:44px"><span class="box"></span> Lasts more than one day</div></div>
<div class="field"><label>Start time *</label><div class="input">7:00 AM</div></div><div class="field"><label>End time *</label><div class="input">10:00 PM</div></div></div>
<div class="field"><label>Venue name</label><div class="input">Cedar Ridge High School Stadium</div></div>
<div class="field"><label>Address</label><div class="input">2400 Ridge Rd, Austin, TX</div></div>
<div class="field"><label>Event time zone *</label><div class="input">Central Time (Chicago, Dallas, Houston)</div></div>
<div class="pinbar"><div class="row between"><span class="sm muted">Next: what directors need to register</span><span class="btn main">Save and continue</span></div></div></div>''')

NOTE2='<p class="sm amber" style="margin:8px 0 0">◆ Add at least one classification and a deadline. Bands can&apos;t register without them.</p>'
def regform(filled):
    chips=''.join(f'<span class="chip">{c} {I["x"]}</span>' for c in ['1A','2A','3A','4A','5A','6A']) if filled else ''
    return f'''
<a class="back" href=#>← Back to {EV}</a>
<p class="sm" style="margin:14px 0 0"><b>Step 2 of 3:</b> Registration</p>
{SETUP(("done","Details","Done"),("now","Registration","Now"),(("" ,"Publish","Not yet")))}
<h1 style="margin-top:22px">Band registration</h1>
<p class="muted" style="margin:0">What directors need before they register. You can change any of it later.</p>
<div class="card">
<h2>Classifications</h2><p class="sm muted" style="margin:4px 0 0">Bands pick one when they register. Prelims are grouped by these.</p>
<div style="margin-top:6px">{chips}</div>
<div class="row" style="margin-top:10px"><div class="input {'ph' if not filled else 'ph'}" style="flex:1;margin:0">{'Add another, like Class AA' if filled else 'Add one, like 1A or Class AA'}</div><span class="btn out">Add</span></div>
<p class="xs muted" style="margin:6px 0 0">Or <a href=#>use 1A through 6A</a></p>
<div class="field"><label>Registration deadline *</label><div class="input {'' if filled else 'ph'}">{'Mon, Mar 1, 2027' if filled else 'mm/dd/yyyy'}</div><div class="hint">Registration closes at the end of this day. You can also close it by hand.</div></div>
<div class="field"><label>Information for directors</label><div class="input area {'' if filled else 'ph'}">{'Entry fee: $375 per band, by check to Cedar Ridge Band Boosters or online at the link below. Buses park in Lot C. Warm-up is on the practice field, 45 minutes before your performance.' if filled else 'Entry fee and how to pay, where buses park, and warm-up'}</div><div class="hint">Shown when bands register, and in their confirmation email.</div></div>
<div class="field"><label>Contact for directors</label><div class="grid2"><div class="input">Dana Whitfield</div><div class="input">(512) 555-0142</div></div><div class="input">dana@cedarridgeband.org</div></div>
<details class="more"><summary>More options: chaperone limit, invite last year's directors, import bands<span style="color:var(--brand)">›</span></summary></details>
<div class="pinbar">
<div class="row between"><span class="sm {'ok' if filled else 'muted'}">{'✓ Saved' if filled else 'Changes save automatically'}</span>
{'<span class="btn main">Next up: Publish your event →</span>' if filled else '<span class="btn off">Next up: Publish your event →</span>'}</div>
{'' if filled else NOTE2}
<div class="row" style="margin-top:6px"><a href=# class="sm">Preview the registration page</a></div>
</div></div>'''
page('02-registration-empty','Band registration',regform(False))
page('03-registration-ready','Band registration',regform(True))

def eventhead(status='Draft'):
    return f'''<a class="back" href=#>← My events</a>
<h1>{EV}</h1><div class="row"><span class="pill {'live' if status!='Draft' else ''}">{status}</span><span class="pill">Band contest</span></div>
<p class="muted" style="margin:6px 0 0">Sat, Mar 20, 2027 · 7:00 AM – 10:00 PM CDT · Cedar Ridge High School Stadium</p>'''

page('04-publish-not-ready','Event page',f'''
<p class="sm" style="margin:0"><b>Step 3 of 3:</b> Publish</p>
{SETUP(("done","Details","Done"),("needs","Registration","Add a deadline"),("now","Publish","Now"))}
<div style="margin-top:20px">{eventhead()}</div>
<div class="card" style="border:2px solid var(--brand)"><h2>Not ready to publish yet</h2>
<div class="note-amber"><p style="margin:0" class="amber">{I['warn']} Bands can't register without a registration deadline</p><p style="margin:4px 0 10px">Add the date registration closes. Everything else can wait.</p><span class="btn main">Add a deadline</span></div>
<p class="sm muted">Publishing puts your public page online and opens band registration.</p></div>''')

page('05-publish-ready','Event page',f'''
<p class="sm" style="margin:0"><b>Step 3 of 3:</b> Publish</p>
{SETUP(("done","Details","Done"),("done","Registration","Done"),("now","Publish","Now"))}
<div style="margin-top:20px">{eventhead()}</div>
<div class="card" style="border:2px solid var(--brand)"><h2>Ready to publish</h2>
<p class="sm" style="margin:12px 0 4px"><b>When you publish</b></p>
<ul class="sm" style="margin:0;padding-left:20px;line-height:1.8"><li>Your public page goes online with the date, place, and directions</li><li>Directors can register until Mon, Mar 1, in 6 classifications</li><li>Nobody is emailed. People find out when you share your link or invite directors</li><li>You can keep editing everything</li></ul>
<div class="row" style="margin-top:16px"><span class="btn main">Publish and open registration</span><span class="btn out">Publish, open registration later</span></div>
<p class="sm" style="margin:12px 0 0"><a href=#>Preview the registration page</a></p>
<p class="sm muted" style="margin:14px 0 0">Optional, any time: <a href=#>add a parking map</a>, <a href=#>invite your team</a>, <a href=#>add volunteer jobs</a></p></div>''')

def prep(items): return steps(items,4)
page('06-published-share','Event page — just published',f'''
{prep([("now","Registration","Open · 0 bands"),("","Schedule","After registration closes"),("","Check-in","Not yet"),("","Contest day","Sat, Mar 20")])}
<div style="margin-top:20px">{eventhead('Published')}</div>
<div class="note-info" style="font-size:15px"><b class="ok">✓ Published.</b> Band registration is open until Mon, Mar 1.</div>
<div class="card" style="border:2px solid var(--brand)"><h2>Get the word out</h2><p class="sm muted" style="margin:4px 0 0">Directors register from this link. Nobody hears about it until you share it.</p>
<div class="list"><div><span class="sm" style="font-family:ui-monospace,monospace;word-break:break-all">fieldcommandevents.com/e/lone-star-marching/register</span><span class="row"><span class="btn out">Copy link</span><span class="btn out">QR code</span></span></div></div>
<div class="note-info"><p style="margin:0"><b>{I['mail']} Invite directors by email</b></p><p style="margin:4px 0 10px">18 directors from last year's Lone Star Marching Invitational are on file. Choose who gets an invitation with the link.</p><span class="btn main">Invite directors</span></div></div>
<div class="card"><div class="row between"><h2>Bands</h2><a href=# class="sm">Band registration</a></div><p class="sm muted">No bands yet. They'll show here as they register.</p></div>''')

page('07-invite-directors','Invite directors',f'''
<dialog open><h2>Invite directors to register</h2>
<p class="sm muted" style="margin:6px 0 0">Each person gets one email with the registration link and the deadline. Nobody is added to your team.</p>
<p class="sm" style="margin:16px 0 4px"><b>From last year's Lone Star Marching Invitational</b> · <a href=#>Choose none</a></p>
<div class="list">
<div class="check"><span class="box on"></span><span><b>Cedar Park HS</b><br><span class="sm muted">Jordan Ellis · jellis@cpisd.org</span></span></div>
<div class="check"><span class="box on"></span><span><b>Leander HS</b><br><span class="sm muted">Priya Raman · praman@leanderisd.org</span></span></div>
<div class="check"><span class="box on"></span><span><b>Vista Ridge HS</b><br><span class="sm muted">Sam Ortega · sortega@leanderisd.org</span></span></div>
<div class="check"><span class="box"></span><span><b>Round Rock HS</b> <span class="pill">Already registered</span><br><span class="sm muted">Alex Kim · akim@roundrockisd.org</span></span></div>
<div class="check"><span class="sm muted">and 14 more</span></div></div>
<div class="field"><label>Anyone else?</label><div class="input area ph">Paste email addresses, one per line or separated by commas</div></div>
<div class="row" style="margin-top:18px"><span class="btn main">Send 17 invitations</span><span class="btn out">Cancel</span></div>
<p class="xs muted" style="margin:10px 0 0">Sent from Field Command Events, with replies going to dana@cedarridgeband.org.</p></dialog>''',scrim=True)

page('08-prep-registration-open','Event page — registration open',f'''
{prep([("now","Registration","Open · 12 bands · closes Mar 1"),("","Schedule","After registration closes"),("needs","Check-in","No check-in stops yet"),("","Contest day","Sat, Mar 20")])}
<div style="margin-top:20px">{eventhead('Published')}</div>
<div class="card" style="border:2px solid var(--warning)"><h2>{I['warn']} Needs attention</h2>
<div class="list"><div><span class="sm"><b>No check-in stops yet.</b> Set where bands check in on contest day, like Parking, Check-in, and the Gate.</span><a href=# class="sm">Set check-in stops</a></div>
<div><span class="sm"><b>Parking</b> (volunteer job) needs a shift, so volunteers can't sign up for it yet.</span><a href=# class="sm">Add a shift</a></div></div></div>
<div class="card"><div class="row between"><h2>Band registration</h2><span class="pill live">Open until Mar 1</span></div>
<div class="stat"><div><span class="xs muted">Bands registered</span><b>12</b></div><div><span class="xs muted">Classifications</span><b>5 of 6</b></div><div><span class="xs muted">Days left</span><b>9</b></div></div>
<p class="sm" style="margin:12px 0 0"><span class="amber">◆ No 2A bands yet.</span> <a href=#>Invite more directors</a></p>
<div class="row" style="margin-top:14px"><span class="btn out">See the bands</span><span class="btn out">Copy registration link</span></div>
<p class="sm" style="margin:12px 0 0"><a href=# style="color:var(--danger)">Close registration now</a></p></div>''')

page('09-prep-schedule','Event page — build the schedule',f'''
{prep([("done","Registration","Closed · 24 bands"),("now","Schedule","Build prelims"),("needs","Check-in","No check-in stops yet"),("","Contest day","Sat, Mar 20 · 9 days")])}
<div style="margin-top:20px">{eventhead('Published')}</div>
<div class="card" style="border:2px solid var(--brand)"><h2>Next: build the prelims schedule</h2>
<p class="sm muted" style="margin:4px 0 0">24 bands in 6 classifications. Pick a start time and how long each band gets, and the order is filled in for you. Nothing is shared until you post it.</p>
<div class="row" style="margin-top:14px"><span class="btn main">Build prelims</span></div>
<p class="sm muted" style="margin:12px 0 0">When you post the schedule, each director is emailed their times.</p></div>
<div class="card" style="border:2px solid var(--warning)"><h2>{I['warn']} Before contest day</h2>
<div class="list"><div><span class="sm"><b>No check-in stops yet.</b> Bands won't have a check-in path.</span><a href=# class="sm">Set check-in stops</a></div>
<div><span class="sm"><b>Volunteers:</b> 6 of 20 spots filled</span><a href=# class="sm">Volunteer jobs</a></div></div></div>''')

page('10-volunteer-jobs','Volunteer jobs — band contest',f'''
<a class="back" href=#>← Back to {EV}</a>
<div class="row between" style="margin-top:10px"><h1 style="margin:0">Volunteer jobs</h1><span class="btn out">+ Add a job</span></div>
<p class="muted sm" style="margin:4px 0 0">Optional. People sign up from your event page. Changes reach volunteers as soon as they save.</p>
<div class="row" style="margin-top:18px;gap:4px;border-bottom:2px solid var(--field);align-items:flex-end">
<span style="border:1.5px solid var(--field);border-bottom:0;border-radius:10px 10px 0 0;padding:8px 14px;font-size:14px;background:var(--surface)"><b>Parking</b><br><span class="amber xs">◆ Needs a shift</span></span>
<span style="border:2px solid var(--field);border-bottom:3px solid var(--brand);border-radius:10px 10px 0 0;padding:10px 14px;font-size:14px;background:var(--brandsoft);margin-bottom:-2px"><b style="color:var(--brand)">Concessions</b><br><span class="xs">2 of 8 filled</span></span>
<span style="border:1.5px solid var(--field);border-bottom:0;border-radius:10px 10px 0 0;padding:8px 14px;font-size:14px;background:var(--surface)"><b>Gate crew</b><br><span class="xs muted">4 of 6 filled</span></span></div>
<div class="card" style="margin-top:0;border-top-left-radius:0">
<p class="sm" style="margin:0"><b>What do volunteers sign up for?</b></p>
<div class="row" style="margin-top:8px"><span class="btn out" style="border:2px solid var(--brand);background:var(--brandsoft)">✓ Shifts</span><span class="sm muted">To switch to things to bring, first delete this job's shifts.</span></div>
<div class="field"><label>Job name *</label><div class="input">Concessions</div></div>
<h3 style="margin-top:20px">Shifts</h3>
<div class="list"><div><span><b class="sm">8:00 – 11:00 AM</b></span><span class="row sm"><span class="muted">2 / 4 filled</span></span></div>
<div><span><b class="sm">11:00 AM – 2:00 PM</b></span><span class="row sm"><span class="muted">0 / 4 filled</span><span class="btn del">{I['bin']} Delete</span></span></div></div>
<p class="sm" style="margin:8px 0 0"><a href=#>+ Add more shifts</a></p>
<details class="more"><summary>More options: Coordinators, instructions, and adults only<span style="color:var(--brand)">›</span></summary></details>
<div class="pinbar"><div class="row between"><span class="sm ok">✓ Saved</span><span class="row"><span class="btn del" style="border:1.5px solid var(--danger);border-radius:8px;padding:0 14px">{I['bin']} Delete job</span><span class="btn main">Add another job</span></span></div>
<div class="row between" style="margin-top:6px"><a href=# class="sm">Preview the volunteer page</a><a href=# class="sm">Back to the event →</a></div></div></div>''')
print('ok')
