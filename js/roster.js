// ------------------------------------------------------------
// The Nose Pizza – staff roster (no accounts, no server)
//
// roster.html  = the manager's planner. Everything is saved in that
//                browser only (localStorage).
// shifts.html  = the staff page. Without a link it's the "send my days"
//                form; with #r=... it shows a roster and the swap helper.
//
// Information moves between people as WhatsApp messages with links:
//   staff  -> manager : roster.html#add=...   (name + days they can work)
//   manager -> staff  : shifts.html#r=...     (the week's roster)
//   staff  -> manager : roster.html#swap=...  (who's covering a shift)
// ------------------------------------------------------------
(() => {
  "use strict";

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MAX_NAME = 40;
  const BUSY_FROM = 4; // Fri, Sat, Sun count as busy shifts and are shared out evenly too

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "value") value = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    if (value !== undefined) el.value = value;
    return el;
  }

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function toB64(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64(str) {
    let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isISO = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const dateLabel = (w, day) => { const d = addDays(parseISO(w), day); return `${DAYS[day]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const weekLabel = (w) => { const d = parseISO(w); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

  const cleanName = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
  const cleanDays = (d) => (Array.isArray(d)
    ? [...new Set(d.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort()
    : []);
  const daysText = (days) => (days.length ? days.slice().sort().map((d) => DAYS[d]).join(", ") : "no days yet");
  const listJoin = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} or ${a[a.length - 1]}`);
  const plural = (n, word, many) => `${n} ${n === 1 ? word : many || `${word}s`}`;
  const sortShifts = (a, b) => a.day - b.day || a.time.localeCompare(b.time) || a.id - b.id;

  const pageUrl = (file) => new URL(file, location.href).href.split("#")[0];
  const waUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
  const shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = h("textarea", { style: "position:fixed;top:0;opacity:0", "aria-hidden": "true" });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  // Re-render and put keyboard focus back on the same control
  function paint(app, build) {
    const key = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    app.replaceChildren(...build().flat(Infinity).filter(Boolean));
    if (key) {
      const again = app.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (again) again.focus();
    }
  }

  const waButton = (label, text, extra) => h("a", Object.assign({ class: "btn", href: waUrl(text), target: "_blank", rel: "noopener" }, extra || {}), label);

  // ============================================================
  // Manager planner (roster.html)
  // ============================================================
  function manager(app) {
    const KEY = "nose-roster";

    const blank = () => ({
      v: 1,
      people: [],
      shifts: DAYS.map((_, d) => ({ id: d + 1, day: d, time: "", need: 2 })),
      nextId: 8,
      rosters: {},
    });

    function sanitize(s) {
      if (!s || !Array.isArray(s.people) || !Array.isArray(s.shifts)) return null;
      const people = [];
      s.people.forEach((p) => {
        const name = cleanName(p && p.name);
        if (!name || people.some((x) => sameName(x.name, name))) return;
        const max = Number(p.max);
        people.push({ name, days: cleanDays(p.days), max: Number.isInteger(max) && max > 0 ? Math.min(max, 14) : null });
      });
      const shifts = s.shifts
        .map((x) => ({
          id: Number(x && x.id),
          day: Number(x && x.day),
          time: String((x && x.time) || "").slice(0, 30),
          need: Math.max(0, Math.min(9, Math.round(Number(x && x.need)) || 0)),
        }))
        .filter((x) => Number.isInteger(x.id) && Number.isInteger(x.day) && x.day >= 0 && x.day <= 6);
      const rosters = {};
      Object.entries(s.rosters && typeof s.rosters === "object" ? s.rosters : {}).forEach(([w, r]) => {
        if (!isISO(w) || !r || typeof r.assign !== "object") return;
        const assign = {};
        Object.entries(r.assign).forEach(([id, names]) => {
          if (Array.isArray(names)) assign[id] = names.map(cleanName).filter(Boolean);
        });
        rosters[w] = { assign };
      });
      const nextId = Math.max(Number(s.nextId) || 1, ...shifts.map((x) => x.id + 1), 1);
      return { v: 1, people, shifts, nextId, rosters };
    }

    let state = (() => {
      try { const s = sanitize(JSON.parse(lsGet(KEY))); if (s) return s; } catch (e) { /* start fresh */ }
      return blank();
    })();
    const savedTab = lsGet(`${KEY}-tab`);
    let tab = ["roster", "team", "shifts"].includes(savedTab) ? savedTab : (state.people.length ? "roster" : "team");
    let week = (() => {
      const now = new Date();
      const day = now.getDay(); // from Thursday, plan next week
      return iso(day === 0 || day >= 4 ? addDays(mondayOf(now), 7) : mondayOf(now));
    })();
    let note = "";
    let incoming = readIncoming();

    function save() {
      if (!lsSet(KEY, JSON.stringify(state))) {
        note = "Heads up: this browser isn't letting the roster save. Use a normal (not private) window.";
      }
    }

    function readIncoming() {
      const p = new URLSearchParams(location.hash.slice(1));
      for (const type of ["add", "swap", "restore"]) {
        if (p.get(type)) {
          try { return { type, data: fromB64(p.get(type)) }; } catch (e) { return { type: "bad" }; }
        }
      }
      return null;
    }
    function clearIncoming() {
      incoming = null;
      history.replaceState(null, "", location.pathname + location.search);
    }

    const shiftsOn = (d) => state.shifts.filter((s) => s.day === d).sort(sortShifts);
    const person = (name) => state.people.find((p) => sameName(p.name, name));
    const isFree = (name, day) => { const p = person(name); return !!p && p.days.includes(day); };

    function countsFor(w) {
      const c = {};
      const r = state.rosters[w];
      if (!r) return c;
      state.shifts.forEach((s) => (r.assign[s.id] || []).forEach((n) => { c[n] = (c[n] || 0) + 1; }));
      return c;
    }
    function pastCounts(w, weeks = 4) {
      const c = {};
      for (let i = 1; i <= weeks; i++) {
        const wc = countsFor(iso(addDays(parseISO(w), -7 * i)));
        Object.keys(wc).forEach((k) => { c[k] = (c[k] || 0) + wc[k]; });
      }
      return c;
    }

    // The fair bit: hardest-to-fill shifts first, then always give the spot to
    // whoever is free and has the fewest shifts (this week, then busy shifts,
    // then the last 4 weeks). Ties are random so nobody is always first.
    function makeRoster(w) {
      const hist = pastCounts(w);
      const count = {};
      const busy = {};
      const onDay = {};
      state.people.forEach((p) => { count[p.name] = 0; busy[p.name] = 0; });
      const assign = {};
      const slots = [];
      state.shifts.forEach((s) => { assign[s.id] = []; for (let i = 0; i < s.need; i++) slots.push(s); });
      const freeFor = (s) => state.people.filter((p) => p.days.includes(s.day));
      const order = shuffle(slots).sort((a, b) => freeFor(a).length - freeFor(b).length);

      order.forEach((s) => {
        let c = freeFor(s).filter((p) => !assign[s.id].includes(p.name) && (p.max == null || count[p.name] < p.max));
        const notYetToday = c.filter((p) => !onDay[`${p.name}|${s.day}`]);
        if (notYetToday.length) c = notYetToday;
        if (!c.length) return; // stays an open spot
        const isBusy = s.day >= BUSY_FROM;
        c = shuffle(c).sort((a, b) => count[a.name] - count[b.name]
          || (isBusy ? busy[a.name] - busy[b.name] : 0)
          || (hist[a.name] || 0) - (hist[b.name] || 0));
        const pick = c[0].name;
        assign[s.id].push(pick);
        count[pick] += 1;
        if (isBusy) busy[pick] += 1;
        onDay[`${pick}|${s.day}`] = 1;
      });

      state.rosters[w] = { assign };
      // Keep about three months of rosters
      const cutoff = iso(addDays(mondayOf(new Date()), -7 * 12));
      Object.keys(state.rosters).forEach((k) => { if (k < cutoff) delete state.rosters[k]; });
    }

    function rosterLink(w, r) {
      const payload = {
        v: 1,
        w,
        s: state.shifts.slice().sort(sortShifts)
          .filter((s) => s.need > 0 || (r.assign[s.id] || []).length)
          .map((s) => [s.id, s.day, s.time, r.assign[s.id] || [], s.need]),
        a: Object.fromEntries(state.people.map((p) => [p.name, p.days.join("")])),
        m: Object.fromEntries(state.people.filter((p) => p.max).map((p) => [p.name, p.max])),
      };
      return `${pageUrl("shifts.html")}#r=${toB64(payload)}`;
    }

    function shareText(w, r) {
      const lines = [`🍕 The Nose roster – week of ${weekLabel(w)}`, ""];
      for (let d = 0; d < 7; d++) {
        shiftsOn(d).filter((s) => s.need > 0 || (r.assign[s.id] || []).length).forEach((s) => {
          const names = r.assign[s.id] || [];
          const open = s.need - names.length;
          lines.push(`*${dateLabel(w, d)}*${s.time ? ` · ${s.time}` : ""}`);
          lines.push((names.join(", ") || "Nobody yet") + (open > 0 ? ` + ${plural(open, "open spot")}` : ""));
          lines.push("");
        });
      }
      lines.push("Can't make a shift? Tap here to find someone to cover:");
      lines.push(rosterLink(w, r));
      return lines.join("\n");
    }

    const go = (t) => { tab = t; lsSet(`${KEY}-tab`, t); render(); };
    const card = (...kids) => h("div", { class: "card" }, ...kids);

    // ---------- links people sent in ----------
    function incomingCard() {
      if (!incoming) return null;
      const ignore = h("button", { class: "btn btn--ghost", type: "button", onclick: () => { clearIncoming(); render(); } }, "Ignore");
      const bad = (msg) => h("div", { class: "card card--note" }, h("p", {}, msg),
        h("button", { class: "btn btn--ghost", type: "button", onclick: () => { clearIncoming(); render(); } }, "OK"));

      if (incoming.type === "add") {
        const d = incoming.data || {};
        const name = cleanName(d.n);
        const days = cleanDays(d.d);
        const max = Number.isInteger(d.m) && d.m > 0 ? Math.min(d.m, 14) : null;
        if (!name) return bad("That availability link didn't open properly. Ask them to send it again.");
        const existing = person(name);
        return h("div", { class: "card card--note" },
          h("h2", {}, existing ? `New days from ${name}` : `${name} wants to join the roster`),
          h("p", {}, `Can work: ${daysText(days)}${max ? ` · at most ${plural(max, "shift")} a week` : ""}`),
          h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onclick: () => {
              if (existing) Object.assign(existing, { days, max });
              else state.people.push({ name, days, max });
              save();
              clearIncoming();
              note = existing ? `Updated ${name}'s days.` : `Added ${name} to the team.`;
              go("team");
            } }, existing ? `Update ${name}` : `Add ${name}`),
            ignore));
      }

      if (incoming.type === "swap") {
        const d = incoming.data || {};
        const from = cleanName(d.f);
        const to = cleanName(d.t);
        const r = isISO(d.w) ? state.rosters[d.w] : null;
        const shift = state.shifts.find((s) => s.id === Number(d.i));
        if (!from || !to || !r || !shift || !r.assign[shift.id]) {
          return bad("That swap is for a roster that isn't on this device any more. Change it by hand on the Roster tab.");
        }
        const when = `${dateLabel(d.w, shift.day)}${shift.time ? ` (${shift.time})` : ""}`;
        return h("div", { class: "card card--note" },
          h("h2", {}, "Shift swap"),
          h("p", {}, `${to} is covering ${from}'s shift on ${when}.`),
          h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onclick: () => {
              const list = r.assign[shift.id];
              const fi = list.findIndex((n) => sameName(n, from));
              if (list.some((n) => sameName(n, to))) { if (fi >= 0) list.splice(fi, 1); }
              else if (fi >= 0) list[fi] = to;
              else list.push(to);
              save();
              clearIncoming();
              week = d.w;
              note = "Roster updated. Send the new one to the team so everyone has it.";
              go("roster");
            } }, "Update the roster"),
            ignore));
      }

      if (incoming.type === "restore") {
        const s = sanitize(incoming.data);
        if (!s) return bad("That backup link didn't open properly.");
        return h("div", { class: "card card--note" },
          h("h2", {}, "Load roster backup?"),
          h("p", {}, `${plural(s.people.length, "person", "people")}, ${plural(Object.keys(s.rosters).length, "saved week")}. This replaces the roster on this device.`),
          h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onclick: () => {
              state = s;
              save();
              clearIncoming();
              note = "Backup loaded.";
              go("roster");
            } }, "Load backup"),
            ignore));
      }

      return bad("That link didn't open properly. Ask for it to be sent again.");
    }

    // ---------- Roster tab ----------
    function rosterTab() {
      const out = [];
      out.push(h("div", { class: "weeknav" },
        h("button", { class: "btn btn--ghost btn--icon", type: "button", "data-key": "prev", "aria-label": "Previous week",
          onclick: () => { week = iso(addDays(parseISO(week), -7)); render(); } }, "‹"),
        h("h2", { class: "weeknav__label", "aria-live": "polite" }, `Week of ${weekLabel(week)}`),
        h("button", { class: "btn btn--ghost btn--icon", type: "button", "data-key": "next", "aria-label": "Next week",
          onclick: () => { week = iso(addDays(parseISO(week), 7)); render(); } }, "›")));

      if (!state.people.length) {
        out.push(card(h("p", {}, "First add your team and the days they can work."),
          h("button", { class: "btn", type: "button", onclick: () => go("team") }, "Add your team")));
        return out;
      }
      if (!state.shifts.some((s) => s.need > 0)) {
        out.push(card(h("p", {}, "Set up your shifts first."),
          h("button", { class: "btn", type: "button", onclick: () => go("shifts") }, "Set up shifts")));
        return out;
      }

      const r = state.rosters[week];
      if (!r) {
        out.push(h("div", { class: "card card--center" },
          h("p", {}, "No roster for this week yet."),
          h("button", { class: "btn btn--big", type: "button", "data-key": "make", onclick: () => {
            makeRoster(week);
            save();
            note = "Done! Check it over, then send it to the team.";
            render();
          } }, "🍕 Make the roster")));
        return out;
      }

      const counts = countsFor(week);
      for (let d = 0; d < 7; d++) {
        const list = shiftsOn(d).filter((s) => s.need > 0 || (r.assign[s.id] || []).length);
        if (!list.length) continue;
        out.push(h("div", { class: "card day-card" },
          h("h3", {}, dateLabel(week, d)),
          list.map((s) => shiftRow(s, r, counts))));
      }

      const open = state.shifts.reduce((n, s) => n + Math.max(0, s.need - (r.assign[s.id] || []).length), 0);
      if (open) {
        out.push(h("div", { class: "card card--warn" },
          h("p", {}, `${plural(open, "open spot")} – nobody else is free for ${open === 1 ? "it" : "them"}. Tap an open spot to pick someone anyway, or ask around.`)));
      }

      // Fairness check
      const hist = pastCounts(week);
      const top = Math.max(1, ...state.people.map((p) => counts[p.name] || 0));
      out.push(card(
        h("h2", {}, "Who's working how much"),
        h("div", { class: "fair" },
          state.people.slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => h("div", { class: "fair__row" },
            h("span", { class: "fair__name" }, p.name),
            h("span", { class: "small muted" }, `${counts[p.name] || 0} this week · ${hist[p.name] || 0} last 4 wks`),
            h("span", { class: "bar", "aria-hidden": "true" }, h("span", { style: `width:${((counts[p.name] || 0) / top) * 100}%` })))))));

      const text = shareText(week, r);
      out.push(card(
        h("h2", {}, "Send it out"),
        h("p", { class: "muted small" }, "Sends the roster to the staff group, with a link for anyone who needs a swap."),
        h("div", { class: "row" },
          waButton("Send on WhatsApp", text),
          h("button", { class: "btn btn--ghost", type: "button", "data-key": "copy-roster", onclick: async () => {
            note = (await copyText(text)) ? "Roster copied. Paste it into the staff group." : "Couldn't copy – try the WhatsApp button.";
            render();
          } }, "Copy message"),
          h("button", { class: "btn btn--ghost", type: "button", "data-key": "remake", onclick: () => {
            if (!confirm("Make this week's roster again from scratch? Changes you made by hand will be lost.")) return;
            makeRoster(week);
            save();
            note = "New roster made.";
            render();
          } }, "Make it again"))));
      return out;
    }

    function shiftRow(s, r, counts) {
      const names = r.assign[s.id] || (r.assign[s.id] = []);
      const when = `${dateLabel(week, s.day)}${s.time ? ` ${s.time}` : ""}`;
      const chips = names.map((n, idx) => {
        const free = isFree(n, s.day);
        return h("span", { class: `chip${free ? "" : " chip--warn"}`, title: free ? null : `Not usually free on ${DAYS_LONG[s.day]}s` },
          n,
          free ? null : h("span", { class: "chip__flag" }, " (not usually free)"),
          h("button", { type: "button", "data-key": `rm-${s.id}-${idx}`, "aria-label": `Take ${n} off ${when}`,
            onclick: () => { names.splice(idx, 1); save(); render(); } }, "×"));
      });
      const spots = [];
      for (let i = names.length; i < s.need; i++) {
        const others = state.people.filter((p) => !names.includes(p.name));
        const free = others.filter((p) => p.days.includes(s.day)).sort((a, b) => (counts[a.name] || 0) - (counts[b.name] || 0));
        const notFree = others.filter((p) => !p.days.includes(s.day));
        const opt = (p) => h("option", { value: p.name }, `${p.name} (${plural(counts[p.name] || 0, "shift")})`);
        spots.push(h("select", { class: "spot", "data-key": `spot-${s.id}-${i}`, "aria-label": `Open spot on ${when}: choose someone`,
          onchange: (e) => { if (e.target.value) { names.push(e.target.value); save(); render(); } } },
          h("option", { value: "" }, "Open spot – choose…"),
          free.length ? h("optgroup", { label: "Free that day" }, free.map(opt)) : null,
          notFree.length ? h("optgroup", { label: "Not usually free" }, notFree.map(opt)) : null));
      }
      return h("div", { class: "shift" },
        h("div", { class: "shift__time" }, s.time || "Shift"),
        h("div", { class: "shift__people" }, chips, spots));
    }

    // ---------- Team tab ----------
    function teamTab() {
      const out = [];
      const availLink = pageUrl("shifts.html");
      out.push(card(
        h("h2", {}, "Get everyone's days"),
        h("p", { class: "muted" }, "Send this link to the staff group. Each person ticks the days they can work and sends it back to you on WhatsApp – tap the link in their message to add them here."),
        h("div", { class: "row" },
          waButton("Send on WhatsApp", `Hi team! 🍕 Please tap this link, tick the days you can work and send it back to me:\n${availLink}`),
          h("button", { class: "btn btn--ghost", type: "button", "data-key": "copy-avail", onclick: async () => {
            note = (await copyText(availLink)) ? "Link copied." : `Couldn't copy. The link is ${availLink}`;
            render();
          } }, "Copy link"))));

      state.people.forEach((p, i) => {
        out.push(h("div", { class: "card person" },
          h("div", { class: "person__head" },
            h("h3", {}, p.name),
            h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => {
              if (!confirm(`Remove ${p.name} from the team? They'll stay on rosters you've already made.`)) return;
              state.people.splice(i, 1);
              save();
              render();
            } }, "Remove")),
          h("p", { class: "small muted label", id: `days-${i}` }, "Days they can work"),
          h("div", { class: "days", role: "group", "aria-labelledby": `days-${i}` },
            DAYS.map((dn, d) => h("button", {
              type: "button", class: "day", "data-key": `day-${i}-${d}`, "aria-label": DAYS_LONG[d],
              "aria-pressed": String(p.days.includes(d)),
              onclick: () => {
                p.days = p.days.includes(d) ? p.days.filter((x) => x !== d) : cleanDays([...p.days, d]);
                save();
                render();
              },
            }, dn))),
          h("label", { class: "row small max" }, "Most shifts a week",
            h("select", { "data-key": `max-${i}`, value: p.max ? String(p.max) : "", onchange: (e) => {
              p.max = e.target.value ? Number(e.target.value) : null;
              save();
            } }, h("option", { value: "" }, "No limit"), [1, 2, 3, 4, 5, 6, 7].map((n) => h("option", { value: String(n) }, String(n)))))));
      });

      const input = h("input", { type: "text", id: "new-name", maxlength: String(MAX_NAME), placeholder: "First name", autocomplete: "off" });
      out.push(h("form", { class: "card", onsubmit: (e) => {
        e.preventDefault();
        const n = cleanName(input.value);
        if (!n) { input.focus(); return; }
        if (person(n)) { note = `${n} is already on the team.`; render(); return; }
        state.people.push({ name: n, days: [], max: null });
        save();
        note = `Added ${n}. Now tap the days they can work.`;
        render();
      } },
        h("h2", {}, "Add someone yourself"),
        h("label", { for: "new-name", class: "small muted label" }, "Name"),
        h("div", { class: "row" }, input, h("button", { class: "btn", type: "submit" }, "Add"))));

      out.push(card(
        h("h2", {}, "New phone?"),
        h("p", { class: "muted small" }, "The roster is saved on this device only. To move it, copy a backup link and open it on the new phone. Keep the link private – it has everyone's names and days."),
        h("button", { class: "btn btn--ghost", type: "button", "data-key": "backup", onclick: async () => {
          note = (await copyText(`${pageUrl("roster.html")}#restore=${toB64(state)}`)) ? "Backup link copied." : "Couldn't copy the backup link.";
          render();
        } }, "Copy backup link")));
      return out;
    }

    // ---------- Shifts tab ----------
    function shiftsTab() {
      const out = [card(h("p", { class: "muted" }, "Set up a normal week once and the roster uses it every week. Closed on a day? Remove its shifts."))];
      for (let d = 0; d < 7; d++) {
        const list = shiftsOn(d);
        out.push(h("div", { class: "card" },
          h("h3", {}, DAYS_LONG[d]),
          list.length ? list.map((s) => h("div", { class: "shift-edit" },
            h("input", { type: "text", value: s.time, maxlength: "30", placeholder: "Time, e.g. 16:00–21:00",
              "aria-label": `${DAYS_LONG[d]} shift time`, oninput: (e) => { s.time = e.target.value.slice(0, 30); save(); } }),
            h("div", { class: "stepper" },
              h("button", { type: "button", "data-key": `minus-${s.id}`, "aria-label": `One less person on ${DAYS_LONG[d]}`,
                onclick: () => { s.need = Math.max(0, s.need - 1); save(); render(); } }, "−"),
              h("span", { "aria-live": "polite" }, plural(s.need, "person", "people")),
              h("button", { type: "button", "data-key": `plus-${s.id}`, "aria-label": `One more person on ${DAYS_LONG[d]}`,
                onclick: () => { s.need = Math.min(9, s.need + 1); save(); render(); } }, "+")),
            h("button", { class: "btn btn--ghost btn--small", type: "button", "aria-label": `Remove this ${DAYS_LONG[d]} shift`,
              onclick: () => { state.shifts = state.shifts.filter((x) => x !== s); save(); render(); } }, "Remove")))
            : h("p", { class: "muted small" }, "Closed"),
          h("button", { class: "btn btn--ghost btn--small", type: "button", "data-key": `add-${d}`, onclick: () => {
            state.shifts.push({ id: state.nextId++, day: d, time: "", need: 1 });
            save();
            render();
          } }, "+ Add a shift")));
      }
      return out;
    }

    function render() {
      paint(app, () => {
        const parts = [
          h("h1", {}, "Staff roster"),
          h("p", { class: "lead" }, "Everyone sends their days, the roster shares shifts out fairly, and swaps get sorted on WhatsApp. Saved on this device only."),
          note ? h("div", { class: "toast", role: "status" }, note) : null,
          incomingCard(),
          h("div", { class: "tabs", role: "tablist", "aria-label": "Roster sections" },
            [["roster", "Roster"], ["team", `Team (${state.people.length})`], ["shifts", "Shifts"]].map(([id, label]) =>
              h("button", { type: "button", role: "tab", "data-key": `tab-${id}`, "aria-selected": String(tab === id), onclick: () => go(id) }, label))),
          h("section", { role: "tabpanel" }, tab === "roster" ? rosterTab() : tab === "team" ? teamTab() : shiftsTab()),
        ];
        note = "";
        return parts;
      });
    }

    window.addEventListener("hashchange", () => { incoming = readIncoming(); render(); window.scrollTo(0, 0); });
    render();
  }

  // ============================================================
  // Staff page (shifts.html)
  // ============================================================
  function staff(app) {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get("r")) {
      let data = null;
      try { data = cleanRoster(fromB64(p.get("r"))); } catch (e) { data = null; }
      if (data) { rosterView(app, data); return; }
      app.replaceChildren(h("h1", {}, "Hmm, that didn't work"),
        h("p", { class: "lead" }, "That roster link didn't open properly. Ask for it to be sent again."));
      return;
    }
    availForm(app);
  }

  function cleanRoster(r) {
    if (!r || !isISO(r.w) || !Array.isArray(r.s) || typeof r.a !== "object") return null;
    const shifts = r.s
      .filter((x) => Array.isArray(x) && x.length >= 5)
      .map(([id, day, time, names, need]) => ({
        id: Number(id),
        day: Number(day),
        time: String(time || "").slice(0, 30),
        names: Array.isArray(names) ? names.map(cleanName).filter(Boolean) : [],
        need: Math.max(0, Math.min(9, Number(need) || 0)),
      }))
      .filter((x) => Number.isInteger(x.id) && x.day >= 0 && x.day <= 6)
      .sort(sortShifts);
    const avail = {};
    Object.entries(r.a).forEach(([n, d]) => {
      const name = cleanName(n);
      if (name) avail[name] = cleanDays(String(d).split(""));
    });
    const max = {};
    Object.entries(r.m && typeof r.m === "object" ? r.m : {}).forEach(([n, m]) => {
      if (Number.isInteger(m) && m > 0) max[cleanName(n)] = m;
    });
    return { w: r.w, shifts, avail, max };
  }

  function availForm(app) {
    let name = lsGet("nose-staff-name") || "";
    let days = [];
    try { days = cleanDays(JSON.parse(lsGet("nose-staff-days") || "[]")); } catch (e) { days = []; }
    let max = "";
    let error = "";

    const message = () => {
      const n = cleanName(name);
      const link = `${pageUrl("roster.html")}#add=${toB64({ n, d: days, m: max ? Number(max) : null })}`;
      return [
        "Hi! Here are my days for the roster 🍕",
        `Name: ${n}`,
        `Days I can work: ${daysText(days)}`,
        max ? `Most shifts a week: ${max}` : null,
        "",
        "Tap to add me to the roster:",
        link,
      ].filter((x) => x !== null).join("\n");
    };

    function render() {
      paint(app, () => {
        const send = waButton("Send on WhatsApp", message(), { class: "btn btn--big", "data-key": "send", onclick: (e) => {
          if (!cleanName(name)) { e.preventDefault(); error = "Pop your name in first."; render(); app.querySelector("#staff-name").focus(); return; }
          if (!days.length) { e.preventDefault(); error = "Tick at least one day you can work."; render(); return; }
          lsSet("nose-staff-name", cleanName(name));
          lsSet("nose-staff-days", JSON.stringify(days));
        } });
        const input = h("input", { type: "text", id: "staff-name", value: name, maxlength: String(MAX_NAME), autocomplete: "given-name", placeholder: "Your first name",
          oninput: (e) => { name = e.target.value; send.href = waUrl(message()); } });
        return [
          h("div", { class: "hello" },
            h("img", { class: "hello__pizza", src: "images/pizza-toss.png", alt: "", width: "72", height: "72" }),
            h("h1", {}, "When can you work?")),
          h("p", { class: "lead" }, "Tick the days you can usually work and send them to the manager. Nothing is saved online – this just writes the WhatsApp message for you."),
          h("div", { class: "card" },
            h("label", { for: "staff-name", class: "label" }, "Your name"),
            input,
            h("p", { class: "label", id: "staff-days" }, "Days you can work"),
            h("div", { class: "days", role: "group", "aria-labelledby": "staff-days" },
              DAYS.map((dn, d) => h("button", {
                type: "button", class: "day", "data-key": `day-${d}`, "aria-label": DAYS_LONG[d], "aria-pressed": String(days.includes(d)),
                onclick: () => { days = days.includes(d) ? days.filter((x) => x !== d) : cleanDays([...days, d]); error = ""; render(); },
              }, dn))),
            h("label", { class: "label", for: "staff-max" }, "Most shifts you'd like a week"),
            h("select", { id: "staff-max", "data-key": "max", value: max, onchange: (e) => { max = e.target.value; send.href = waUrl(message()); } },
              h("option", { value: "" }, "As many as you can give me"),
              [1, 2, 3, 4, 5, 6, 7].map((n) => h("option", { value: String(n) }, String(n)))),
            error ? h("p", { class: "error", role: "alert" }, error) : null,
            h("div", { class: "row send-row" }, send)),
          h("p", { class: "small muted center" }, "Your days change? Just send it again."),
        ];
      });
    }
    render();
  }

  function rosterView(app, R) {
    const names = [...new Set([...Object.keys(R.avail), ...R.shifts.flatMap((s) => s.names)])].sort((a, b) => a.localeCompare(b));
    let me = lsGet("nose-staff-me") || "";
    if (!names.includes(me)) me = "";
    let helpFor = null;
    let cover = "";
    const counts = {};
    R.shifts.forEach((s) => s.names.forEach((n) => { counts[n] = (counts[n] || 0) + 1; }));
    const when = (s) => `${dateLabel(R.w, s.day)}${s.time ? ` (${s.time})` : ""}`;
    const isOld = addDays(parseISO(R.w), 7) < new Date();

    const full = (n) => (R.max[n] && (counts[n] || 0) >= R.max[n] ? 1 : 0);

    function helpPanel(s) {
      const working = new Set(R.shifts.filter((x) => x.day === s.day).flatMap((x) => x.names));
      const free = Object.keys(R.avail)
        .filter((n) => n !== me && R.avail[n].includes(s.day) && !working.has(n))
        .sort((a, b) => full(a) - full(b) || (counts[a] || 0) - (counts[b] || 0));
      const others = names.filter((n) => n !== me && !s.names.includes(n) && !free.includes(n));
      const ask = `Hi team 🍕 Can anyone cover my shift on ${when(s)}?${free.length ? ` ${listJoin(free)} – the roster says you're free that day 🙏` : " 🙏"}`;

      const swapText = () => [
        "Shift swap 🍕",
        `${cover} is covering my shift on ${when(s)}.`,
        `– ${me}`,
        "",
        "Tap to update the roster:",
        `${pageUrl("roster.html")}#swap=${toB64({ w: R.w, i: s.id, f: me, t: cover })}`,
      ].join("\n");
      const tell = waButton("Tell the manager", cover ? swapText() : "", { class: "btn btn--ghost", "data-key": "tell", onclick: (e) => {
        if (!cover) { e.preventDefault(); app.querySelector("#cover").focus(); }
      } });
      const opt = (n) => h("option", { value: n }, n);

      return h("div", { class: "help" },
        h("p", {}, free.length
          ? "No stress, it happens. These people are free that day and not working yet:"
          : "No stress, it happens. Nobody else is marked free that day, so let the manager know as soon as you can."),
        free.length ? h("ul", { class: "free-list" }, free.map((n) => h("li", {}, h("strong", {}, n), ` · ${plural(counts[n] || 0, "shift")} this week${full(n) ? " (asked for no more)" : ""}`))) : null,
        h("div", { class: "row" }, waButton("Ask the staff group", ask)),
        h("label", { class: "label", for: "cover" }, "Found someone to cover?"),
        h("div", { class: "row" },
          h("select", { id: "cover", "data-key": "cover", value: cover, onchange: (e) => {
            cover = e.target.value;
            tell.href = cover ? waUrl(swapText()) : waUrl("");
          } },
            h("option", { value: "" }, "Choose who's covering"),
            free.length ? h("optgroup", { label: "Free that day" }, free.map(opt)) : null,
            others.length ? h("optgroup", { label: "Everyone else" }, others.map(opt)) : null),
          tell),
        h("p", { class: "small muted" }, "The manager taps the link in your message and the roster updates."));
    }

    function render() {
      paint(app, () => {
        const mine = R.shifts.filter((s) => s.names.includes(me));
        const out = [
          h("h1", {}, "The roster"),
          h("p", { class: "lead" }, `Week of ${weekLabel(R.w)}`),
          isOld ? h("div", { class: "card card--warn" }, h("p", {}, "This roster is for a week that's over. Ask for the latest one.")) : null,
          h("div", { class: "card" },
            h("label", { class: "label", for: "me" }, "Who are you?"),
            h("select", { id: "me", "data-key": "me", value: me, onchange: (e) => {
              me = e.target.value;
              lsSet("nose-staff-me", me);
              helpFor = null;
              cover = "";
              render();
            } }, h("option", { value: "" }, "Pick your name"), names.map((n) => h("option", { value: n }, n)))),
        ];

        if (me) {
          out.push(h("div", { class: "card card--mine" },
            h("h2", {}, mine.length ? `Your shifts, ${me}` : `No shifts for you this week, ${me}`),
            mine.map((s) => h("div", { class: "mine" },
              h("div", { class: "mine__row" },
                h("strong", {}, when(s)),
                h("button", { class: "btn btn--ghost btn--small", type: "button", "data-key": `cant-${s.id}`, "aria-expanded": String(helpFor === s.id),
                  onclick: () => { helpFor = helpFor === s.id ? null : s.id; cover = ""; render(); } }, "Can't make it?")),
              helpFor === s.id ? helpPanel(s) : null))));
        }

        for (let d = 0; d < 7; d++) {
          const list = R.shifts.filter((s) => s.day === d);
          if (!list.length) continue;
          out.push(h("div", { class: "card day-card" },
            h("h3", {}, dateLabel(R.w, d)),
            list.map((s) => {
              const open = s.need - s.names.length;
              return h("div", { class: "shift" },
                h("div", { class: "shift__time" }, s.time || "Shift"),
                h("div", { class: "shift__people" },
                  s.names.map((n) => h("span", { class: `chip chip--plain${n === me ? " chip--me" : ""}` }, n)),
                  open > 0 ? h("span", { class: "chip chip--open" }, plural(open, "open spot")) : null));
            })));
        }
        return out;
      });
    }
    render();
  }

  // ---------- start ----------
  const app = document.getElementById("app");
  if (!app) return;
  if (document.body.dataset.page === "manager") manager(app);
  else staff(app);
})();
