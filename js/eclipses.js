// Eclipse Calendar -- the page: the next eclipse, the year's eclipses as a
// timeline and cards, and what each looks like from a chosen place.

const $e = (id) => document.getElementById(id);
const MIN_YEAR = 1900, MAX_YEAR = 2100;
let year = new Date().getFullYear();
let place = null;

// ---------------------------------------------------------------- formatting

const fmtDate = (d, tz, opts = {}) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: tz, ...opts });
const fmtTime = (d, tz, zone = true) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz, ...(zone ? { timeZoneName: "short" } : {}) });
const fmtUT = (d) => d.toISOString().slice(11, 16) + " UT";
const fmtLatLon = (w) =>
  `${Math.abs(w.lat).toFixed(1)}°${w.lat >= 0 ? "N" : "S"} ${Math.abs(w.lon).toFixed(1)}°${w.lon >= 0 ? "E" : "W"}`;
const fmtDur = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m} min ${s} s` : `${s} s`;
};
const fmtMin = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};
const pct = (x) => (x > 0.995 && x < 1 ? "99.5" : Math.round(x * 100));

const TYPE_NAMES = {
  solar: { total: "Total solar eclipse", annular: "Annular solar eclipse", hybrid: "Hybrid solar eclipse", partial: "Partial solar eclipse" },
  lunar: { total: "Total lunar eclipse", partial: "Partial lunar eclipse", penumbral: "Penumbral lunar eclipse" },
};
const typeName = (e) => TYPE_NAMES[e.kind][e.type];

const TYPE_NOTES = {
  "solar total": "The Moon covers the whole Sun: day turns to dusk and the corona appears.",
  "solar annular": "The Moon is too far to cover the whole Sun and leaves a ring of fire.",
  "solar hybrid": "Total along part of its path and annular along the rest.",
  "solar partial": "The Moon's shadow misses the Earth; only its penumbra bites the Sun.",
  "lunar total": "The whole Moon passes into the Earth's shadow and turns red.",
  "lunar partial": "Part of the Moon passes into the Earth's dark shadow.",
  "lunar penumbral": "The Moon only crosses the Earth's faint outer shadow: a subtle dimming.",
};

// ---------------------------------------------------------------- places

const dist = (a, b) => {
  const r = Math.PI / 180;
  const x = Math.sin(a[0] * r) * Math.sin(b[0] * r) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.cos((a[1] - b[1]) * r);
  return 6371 * Math.acos(Math.max(-1, Math.min(1, x)));
};

// named regions and oceans, for eclipses far from any of the cities
const REGIONS = [
  ["the North Pacific", [[30, -150], [35, 170], [15, -130], [40, -160], [10, 160], [20, -175], [45, 175], [5, -140]]],
  ["the South Pacific", [[-20, -130], [-40, -120], [-10, -100], [-30, -160], [-45, -150], [-10, -150], [-25, -95], [-5, -120]]],
  ["the North Atlantic", [[35, -40], [50, -30], [20, -50], [10, -30], [40, -60], [60, -30], [25, -30]]],
  ["the South Atlantic", [[-20, -15], [-40, -30], [-5, -20], [-30, 0], [-45, -10]]],
  ["the Indian Ocean", [[-10, 80], [-30, 70], [-20, 100], [5, 65], [-40, 90], [-15, 55], [0, 85], [-35, 110]]],
  ["the Southern Ocean", [[-58, 0], [-58, 60], [-58, 120], [-58, 180], [-58, -60], [-58, -120]]],
  ["the Arctic", [[80, 0], [80, 120], [80, -120], [75, 60], [75, -160], [72, 170]]],
  ["Antarctica", [[-75, 0], [-80, 90], [-78, -100], [-75, 160], [-85, 45], [-70, 60], [-72, -60]]],
  ["the Sahara", [[23, 10], [20, 25], [25, -5], [27, 18]]],
  ["the Sahel", [[15, 0], [14, 20]]],
  ["Central Africa", [[0, 22], [-8, 25]]],
  ["Arabia", [[22, 48], [18, 45]]],
  ["Central Asia", [[45, 65], [42, 75]]],
  ["Siberia", [[62, 100], [65, 140], [60, 70], [68, 160], [55, 115]]],
  ["Mongolia", [[46, 103]]],
  ["Tibet", [[32, 88]]],
  ["western China", [[40, 85]]],
  ["northern Canada", [[58, -100], [62, -75], [55, -120], [65, -110]]],
  ["northern Alaska", [[67, -150]]],
  ["Greenland", [[72, -40], [65, -45], [78, -55]]],
  ["the Amazon", [[-5, -60], [-3, -70]]],
  ["central Brazil", [[-12, -50]]],
  ["Patagonia", [[-45, -68]]],
  ["the Australian outback", [[-24, 134], [-22, 122], [-28, 140]]],
];

function whereName(w) {
  let best = null;
  for (const p of PLACES) {
    const d = dist([w.lat, w.lon], [p[1], p[2]]);
    if (!best || d < best.d) best = { d, name: "near " + p[0] };
  }
  if (best.d < 900) return best.name;
  best = null;
  for (const [name, pts] of REGIONS) {
    for (const pt of pts) {
      const d = dist([w.lat, w.lon], pt);
      if (!best || d < best.d) best = { d, name };
    }
  }
  let name = best.name;
  // north or south of the equator, whichever anchor was closest
  if (/(North|South) (Pacific|Atlantic)/.test(name)) name = name.replace(/North|South/, w.lat >= 0 ? "North" : "South");
  return (/^the (North|South|Arctic|Indian|Southern)/.test(name) ? "over " : "in ") + name;
}

function defaultPlace() {
  const q = new URLSearchParams(location.search).get("place");
  const byName = PLACES.find((p) => p[0] === q);
  if (byName) return byName;
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {}
  return PLACES.find((p) => p[3] === tz) || PLACES.find((p) => p[0] === "London");
}

function fillPlaces() {
  const sel = $e("place");
  sel.innerHTML = Object.entries(PLACE_GROUPS)
    .map(([g, list]) => `<optgroup label="${g}">${list.map((p) => `<option value="${p[0]}">${p[0]}</option>`).join("")}</optgroup>`)
    .join("");
  if (place && !PLACES.includes(place)) sel.insertAdjacentHTML("afterbegin", `<option value="${place[0]}">${place[0]}</option>`);
  sel.value = place[0];
}

// ---------------------------------------------------------------- what it looks like from the place

const sunAltAt = (e, min) => altitude("sun", e.jdUT + min / 1440, place[1], place[2]);

function solarText(e, r) {
  const [name, , , tz] = place;
  if (!r || r.noOverlap) return { cls: "not", text: `Not visible from ${name}: too far from the Moon's shadow.` };
  const t = (d) => fmtTime(d, tz, false);
  if (!r.seen) {
    // below the horizon at maximum: maybe seen rising or setting
    const up0 = sunAltAt(e, (r.start - e.date) / 60000), up1 = sunAltAt(e, (r.end - e.date) / 60000);
    if (up0 > 0 || up1 > 0)
      return { cls: "some", text: `From ${name}, only the ${up0 > 0 ? "start" : "end"} of it, as the Sun ${up0 > 0 ? "sets" : "rises"} (${up0 > 0 ? "from " + t(r.start) : "until " + t(r.end)}).` };
    return { cls: "not", text: `Not visible from ${name}: the Sun is below the horizon.` };
  }
  const low = r.sunAlt < 12 ? ` The Sun is low, ${Math.max(1, Math.round(r.sunAlt))}° above the horizon.` : "";
  const span = ` Eclipse from ${t(r.start)} to ${t(r.end)} ${tzName(r.max, tz)}.`;
  if (r.kind === "total" || r.kind === "annular") {
    const what = r.kind === "total" ? "Totality" : "The ring of fire";
    const edge = r.edge ? " at the very edge of the path, so check a detailed map" : "";
    return {
      cls: "yes",
      text: `${r.kind === "total" ? "Total" : "Annular"} from ${name}!${" "}${what} lasts ${fmtDur(r.duration)}${edge}, at ${t(r.max)}.${span}${low}`,
    };
  }
  return {
    cls: r.obscuration > 0.05 ? "some" : "not",
    text: `Partial from ${name}: the Moon covers ${pct(r.obscuration)}% of the Sun at ${t(r.max)}.${span}${low}`,
  };
}

const tzName = (d, tz) => {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName").value;
  } catch (x) {
    return "";
  }
};

function lunarText(e, l) {
  const name = place[0];
  const up = Math.round(l.max);
  if (l.all) return { cls: "yes", text: `Visible from ${name}, from start to end: the Moon is ${up}° up at the maximum.` };
  if (l.visible) {
    const rises = l.start <= 0;
    return { cls: "some", text: `Partly visible from ${name}: the Moon ${rises ? "rises" : "sets"} during the eclipse.` };
  }
  return { cls: "not", text: `Not visible from ${name}: the Moon is below the horizon.` };
}

// ---------------------------------------------------------------- diagrams

// the Sun and the Moon as seen from the place (or from the point of greatest eclipse)
function solarSvg(e, r) {
  const W = 150, H = 150, cx = 75, cy = 75, R = 44;
  const k = r ? r.rm / r.rs : 1.0;
  const sepR = r ? r.sep / r.rs : 0.5;
  // the Moon passes north of the Sun's center for a positive gamma
  const ang = (e.gamma >= 0 ? -1 : 1) * (Math.PI / 2 - 0.5);
  const mx = cx + Math.cos(ang) * sepR * R, my = cy + Math.sin(ang) * sepR * R;
  const total = r && r.kind === "total";
  const id = "g" + e.k;
  return `<svg viewBox="0 0 ${W} ${H}" class="dia" aria-hidden="true">
    <defs>
      <radialGradient id="${id}"><stop offset="55%" stop-color="#fff8e1" stop-opacity="0.9"/><stop offset="100%" stop-color="#fff8e1" stop-opacity="0"/></radialGradient>
      <clipPath id="c${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
    </defs>
    ${total ? `<circle cx="${cx}" cy="${cy}" r="${R * 1.7}" fill="url(#${id})" class="corona"/>` : ""}
    <circle cx="${cx}" cy="${cy}" r="${R}" class="${total ? "sun-hidden" : "sun"}"/>
    ${r && r.sep < r.rs + r.rm ? `<circle cx="${mx}" cy="${my}" r="${R * k}" class="moon-disk"/>` : ""}
  </svg>`;
}

// the Moon's path through the Earth's shadow, north up
function lunarSvg(e) {
  const W = 220, H = 150, cx = 110, cy = 75;
  const s = 40; // px per Earth radius
  const pen = (1.2848 + e.u) * s, umb = (0.7403 - e.u) * s, mr = 0.2725 * s;
  const y = cy - e.gamma * s;
  const x0 = (min) => cx + ((min * 0.5458) / 60) * s; // approximate speed
  const half = e.semi.pen;
  const dots = [-half, 0, half].map(
    (m, i) => `<circle cx="${x0(m)}" cy="${y}" r="${mr}" class="${i === 1 ? "moon-max " + e.type : "moon-ghost"}"/>`,
  );
  return `<svg viewBox="0 0 ${W} ${H}" class="dia" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${pen}" class="penumbra"/>
    <circle cx="${cx}" cy="${cy}" r="${umb}" class="umbra"/>
    <line x1="${x0(-half) - mr - 6}" y1="${y}" x2="${x0(half) + mr + 6}" y2="${y}" class="moon-path"/>
    ${dots.join("")}
  </svg>`;
}

// ---------------------------------------------------------------- the year

function yearStrip(list) {
  const W = 720, H = 70, L = 10, Rr = 10, top = 28;
  const t0 = Date.UTC(year, 0, 1), t1 = Date.UTC(year + 1, 0, 1);
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - Rr);
  let s = "";
  // eclipse seasons: the Sun near one of the Moon's nodes (about 35 days)
  const seasons = [];
  for (const e of list) {
    const last = seasons[seasons.length - 1];
    if (last && e.date - last.to < 40 * 864e5) last.to = e.date;
    else seasons.push({ from: e.date, to: e.date });
  }
  for (const se of seasons) {
    const mid = (se.from.getTime() + se.to.getTime()) / 2;
    const a = Math.max(L, x(mid - 17.5 * 864e5)), b = Math.min(W - Rr, x(mid + 17.5 * 864e5));
    s += `<rect x="${a}" y="${top - 16}" width="${b - a}" height="32" rx="6" class="season"/>`;
  }
  s += `<line x1="${L}" y1="${top}" x2="${W - Rr}" y2="${top}" class="axis"/>`;
  for (let m = 0; m <= 12; m++) {
    const xm = x(Date.UTC(year, m, 1));
    s += `<line x1="${xm}" y1="${top - 4}" x2="${xm}" y2="${top + 4}" class="axis"/>`;
    if (m < 12) {
      const lbl = new Date(Date.UTC(year, m, 15)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
      s += `<text x="${x(Date.UTC(year, m, 15))}" y="${H - 6}" text-anchor="middle" class="month">${lbl}</text>`;
    }
  }
  const now = Date.now();
  if (now > t0 && now < t1) s += `<line x1="${x(now)}" y1="${top - 18}" x2="${x(now)}" y2="${top + 18}" class="now"/>`;
  for (const e of list) {
    const xe = x(e.date.getTime());
    const cls = e.kind === "solar" ? "mk-sun" : "mk-moon " + e.type;
    s += `<a href="#ec-${e.k}"><title>${typeName(e)}, ${fmtDate(e.date, place[3])}</title><circle cx="${xe}" cy="${top}" r="8" class="${cls}"/>${
      e.kind === "solar" ? `<circle cx="${xe + 4}" cy="${top - 3}" r="7" class="mk-bite"/>` : ""
    }</a>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Eclipses of ${year} on a timeline">${s}</svg>`;
}

function card(e) {
  const tz = place[3];
  const facts = [];
  let local, dia, caption;
  const when = `${fmtTime(e.date, tz)} (${fmtUT(e.date)})`;
  if (e.kind === "solar") {
    const g = e.type !== "partial" ? solarLocal(e, e.where.lat, e.where.lon) : null;
    facts.push(["Greatest eclipse", when]);
    facts.push([e.type === "partial" ? "Seen best" : "Where", `${whereName(e.where)} (${fmtLatLon(e.where)})`]);
    if (g && g.duration) facts.push([e.type === "total" ? "Longest totality" : e.type === "annular" ? "Longest ring" : "Longest", fmtDur(g.duration)]);
    facts.push(["Magnitude", (g ? g.magnitude : e.magnitude).toFixed(3)]);
    const r = solarLocal(e, place[1], place[2]);
    local = solarText(e, r && r.sep < r.rs + r.rm ? r : { noOverlap: true });
    const seenHere = r && r.seen && r.sep < r.rs + r.rm;
    const view = seenHere ? r : g || solarLocal(e, e.where.lat, e.where.lon);
    dia = solarSvg(e, view);
    caption = seenHere ? `From ${place[0]}` : e.type === "partial" ? "Where seen best" : "At greatest eclipse";
  } else {
    facts.push(["Maximum", when]);
    const s = e.semi;
    const l = lunarLocal(e, place[1], place[2]);
    local = lunarText(e, l);
    // durations, with the local times when the Moon is up
    const at = (m) => fmtTime(new Date(e.date.getTime() + m * 60000), tz, false);
    const span = (semi) => fmtMin(2 * semi) + (l.visible ? ` · ${at(-semi)} to ${at(semi)}` : "");
    facts.push(["Moon overhead", `${whereName(e.where)} (${fmtLatLon(e.where)})`]);
    if (s.tot) facts.push(["Totality", span(s.tot)]);
    if (s.par) facts.push([s.tot ? "In the umbra" : "Partial phase", span(s.par)]);
    facts.push(["Penumbral", span(s.pen)]);
    facts.push(["Magnitude", e.type === "penumbral" ? `${e.penMag.toFixed(3)} (penumbral)` : e.umbMag.toFixed(3)]);
    dia = lunarSvg(e);
    caption = "The Moon's path through the Earth's shadow";
  }
  const sa = saros(e);
  if (sa) facts.push(["Saros", sa]);
  return `<article class="ec-card ${e.kind} ${e.type}" id="ec-${e.k}">
    <figure>${dia}<figcaption>${caption}</figcaption></figure>
    <div class="ec-body">
      <h4>${typeName(e)}</h4>
      <p class="ec-date">${fmtDate(e.date, tz, { weekday: "long", month: "long" })}</p>
      <p class="ec-note">${TYPE_NOTES[e.kind + " " + e.type]}</p>
      <p class="ec-local ${local.cls}">${local.text}</p>
      <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- the next eclipse

function renderNext() {
  const now = new Date();
  let next = null;
  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 1 && !next; y++) {
    next = eclipsesOfYear(y).find((e) => e.date > now);
  }
  if (!next) return;
  const days = Math.ceil((next.date - now) / 864e5);
  const r = next.kind === "solar" ? solarLocal(next, place[1], place[2]) : null;
  const local = next.kind === "solar" ? solarText(next, r && r.sep < r.rs + r.rm ? r : { noOverlap: true }) : lunarText(next, lunarLocal(next, place[1], place[2]));
  $e("next").innerHTML = `<p class="next-label">Next eclipse, ${days <= 1 ? "today" : `in ${days} days`}</p>
    <p class="next-type ${next.kind}">${typeName(next)}</p>
    <p class="next-date">${fmtDate(next.date, place[3], { weekday: "long", month: "long" })} · <a href="?year=${next.date.getUTCFullYear()}${placeParam()}#ec-${next.k}">details</a></p>
    <p class="ec-local ${local.cls}">${local.text}</p>`;
}

// ---------------------------------------------------------------- page

const placeParam = () => (PLACES.includes(place) ? "&place=" + encodeURIComponent(place[0]) : "");

function render() {
  const list = eclipsesOfYear(year);
  $e("year-label").textContent = year;
  $e("year-title").textContent = `Eclipses of ${year}`;
  $e("year-prev").disabled = year <= MIN_YEAR;
  $e("year-next").disabled = year >= MAX_YEAR;
  const nSol = list.filter((e) => e.kind === "solar").length;
  $e("year-sum").textContent = `${list.length} eclipses: ${nSol} solar and ${list.length - nSol} lunar. Times are for ${place[0]}.`;
  $e("year-strip").innerHTML = yearStrip(list);
  $e("cards").innerHTML = list.map(card).join("");
  renderNext();
  const url = new URL(location.href);
  if (year === new Date().getFullYear()) url.searchParams.delete("year");
  else url.searchParams.set("year", year);
  if (PLACES.includes(place)) url.searchParams.set("place", place[0]);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function setYear(y) {
  year = Math.max(MIN_YEAR, Math.min(MAX_YEAR, y));
  render();
}

function initEclipses() {
  const q = parseInt(new URLSearchParams(location.search).get("year"), 10);
  if (q >= MIN_YEAR && q <= MAX_YEAR) year = q;
  place = defaultPlace();
  fillPlaces();
  $e("place").addEventListener("change", (ev) => {
    place = PLACES.find((p) => p[0] === ev.target.value) || place;
    render();
  });
  $e("my-location").addEventListener("click", (ev) => {
    ev.preventDefault();
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      let tz = "UTC";
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (x) {}
      place = ["your location", +pos.coords.latitude.toFixed(2), +pos.coords.longitude.toFixed(2), tz];
      fillPlaces();
      render();
    });
  });
  $e("year-prev").addEventListener("click", () => setYear(year - 1));
  $e("year-next").addEventListener("click", () => setYear(year + 1));
  $e("this-year").addEventListener("click", (ev) => {
    ev.preventDefault();
    setYear(new Date().getFullYear());
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.closest("input, select, textarea")) return;
    if (ev.key === "ArrowLeft") setYear(year - 1);
    if (ev.key === "ArrowRight") setYear(year + 1);
  });
  render();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
