// Eclipse Calendar -- the astronomy, computed in the browser.
//
// Eclipses: Jean Meeus, "Astronomical Algorithms" (2nd ed.), chapter 54. For
// each new and full moon near a node of the Moon's orbit it gives the time of
// maximum eclipse, gamma (how far the shadow axis passes from the center of
// the Earth, in Earth radii) and u (the size of the umbra), from which the type,
// magnitude and durations follow.
// Sun and Moon positions (to place the eclipse on the Earth and to tell if it is
// visible from a place): the low-precision Sun of chapter 25 and the main terms
// of the Moon of chapter 47.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const sind = (d) => Math.sin(d * D2R);
const cosd = (d) => Math.cos(d * D2R);
const norm360 = (d) => ((d % 360) + 360) % 360;

// ---------------------------------------------------------------- time

const jdFromDate = (date) => date.getTime() / 86400000 + 2440587.5;
const dateFromJd = (jd) => new Date(Math.round((jd - 2440587.5) * 86400000));

// Delta T (TT - UT, seconds): Espenak & Meeus polynomials, 1900 to 2150
function deltaT(year) {
  let t;
  if (year < 1920) {
    t = year - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (year < 1941) {
    t = year - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3;
  }
  if (year < 1961) {
    t = year - 1950;
    return 29.07 + 0.407 * t - (t * t) / 233 + t ** 3 / 2547;
  }
  if (year < 1986) {
    t = year - 1975;
    return 45.45 + 1.067 * t - (t * t) / 260 - t ** 3 / 718;
  }
  if (year < 2005) {
    t = year - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (year < 2050) {
    t = year - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t * t;
  }
  const u = (year - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - year);
}

// ---------------------------------------------------------------- Sun and Moon

// apparent geocentric ecliptic longitude and distance of the Sun (Meeus 25)
function sunPos(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  const v = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cosd(v));
  const om = 125.04 - 1934.136 * T;
  const lon = norm360(L0 + C - 0.00569 - 0.00478 * sind(om));
  return { lon, lat: 0, dist: R * 149597870.7 };
}

// the main periodic terms of the Moon (Meeus table 47.A and 47.B):
// [D, M, M', F, coefficient] -- longitude and distance, then latitude
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];

// apparent geocentric ecliptic position of the Moon (Meeus 47)
function moonPos(jde) {
  const T = (jde - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + (T * T * T) / 538841;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + (T * T * T) / 545868;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + (T * T * T) / 69699;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T - (T * T * T) / 3526000;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of MOON_LR) {
    const a = d * D + m * M + mp * Mp + f * F;
    const k = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += cl * k * sind(a);
    sr += cr * k * cosd(a);
  }
  for (const [d, m, mp, f, cb] of MOON_B) {
    const k = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += cb * k * sind(d * D + m * M + mp * Mp + f * F);
  }
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F) + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);
  const om = 125.04 - 1934.136 * T;
  return {
    lon: norm360(Lp + sl / 1e6 - 0.00478 * sind(om)), // + nutation in longitude
    lat: sb / 1e6,
    dist: 385000.56 + sr / 1000,
  };
}

const obliquity = (jde) => {
  const T = (jde - 2451545) / 36525;
  return 23.4392911 - 0.0130042 * T + 0.00256 * cosd(125.04 - 1934.136 * T);
};

// Greenwich mean sidereal time (degrees) for a UT Julian day
const gmst = (jdUT) => {
  const T = (jdUT - 2451545) / 36525;
  return norm360(280.46061837 + 360.98564736629 * (jdUT - 2451545) + 0.000387933 * T * T);
};

// ecliptic (lon, lat, dist) -> geocentric vector in the Earth-fixed frame
// (x toward lon 0 on the equator, z toward the north pole), in km
function earthFixed(p, jde, jdUT) {
  const eps = obliquity(jde);
  const cl = cosd(p.lon), sl = sind(p.lon), cb = cosd(p.lat), sb = sind(p.lat);
  // ecliptic -> equatorial
  const x = cb * cl;
  const y = cb * sl * cosd(eps) - sb * sind(eps);
  const z = cb * sl * sind(eps) + sb * cosd(eps);
  // equatorial -> Earth-fixed: rotate by the sidereal time
  const g = gmst(jdUT);
  return [p.dist * (x * cosd(g) + y * sind(g)), p.dist * (-x * sind(g) + y * cosd(g)), p.dist * z];
}

const RE = 6378.137; // Earth radius (km)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const toLatLon = (v) => ({ lat: Math.asin(v[2] / len(v)) * R2D, lon: ((Math.atan2(v[1], v[0]) * R2D + 540) % 360) - 180 });
const fromLatLon = (lat, lon, r = RE) => [r * cosd(lat) * cosd(lon), r * cosd(lat) * sind(lon), r * sind(lat)];

// altitude (degrees) of a body at jd (UT) seen from lat, lon
function altitude(body, jdUT, lat, lon) {
  const jde = jdUT + deltaT(2000 + (jdUT - 2451545) / 365.25) / 86400;
  const v = earthFixed(body === "sun" ? sunPos(jde) : moonPos(jde), jde, jdUT);
  const obs = fromLatLon(lat, lon);
  const d = sub(v, obs);
  return Math.asin(dot(d, obs) / (len(d) * RE)) * R2D;
}

// ---------------------------------------------------------------- eclipses

// all the eclipses of a year, in order: Meeus chapter 54
function eclipsesOfYear(year) {
  const out = [];
  const k0 = Math.floor((year - 2000.1) * 12.3685);
  for (let i = -1; i < 15; i++) {
    for (const half of [0, 0.5]) {
      const e = eclipseAt(k0 + i + half);
      if (!e) continue;
      const y = dateFromJd(e.jdUT).getUTCFullYear();
      if (y === year) out.push(e);
    }
  }
  return out.sort((a, b) => a.jdUT - b.jdUT);
}

// the eclipse at lunation k (integer: new moon, +0.5: full moon), if any
function eclipseAt(k) {
  const T = k / 1236.85;
  const solar = k === Math.floor(k);
  let F = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  if (Math.abs(sind(F)) > 0.36) return null; // too far from a node
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const M = norm360(2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3);
  const Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3);
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const F1 = F - 0.02665 * sind(Om);
  const A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
  jde +=
    (solar ? -0.4075 : -0.4065) * sind(Mp) +
    (solar ? 0.1721 : 0.1727) * E * sind(M) +
    0.0161 * sind(2 * Mp) -
    0.0097 * sind(2 * F1) +
    0.0073 * E * sind(Mp - M) -
    0.005 * E * sind(Mp + M) -
    0.0023 * sind(Mp - 2 * F1) +
    0.0021 * E * sind(2 * M) +
    0.0012 * sind(Mp + 2 * F1) +
    0.0006 * E * sind(2 * Mp + M) -
    0.0004 * sind(3 * Mp) -
    0.0003 * E * sind(M + 2 * F1) +
    0.0003 * sind(A1) -
    0.0002 * E * sind(M - 2 * F1) -
    0.0002 * E * sind(2 * Mp - M) -
    0.0002 * sind(Om);
  const P = 0.207 * E * sind(M) + 0.0024 * E * sind(2 * M) - 0.0392 * sind(Mp) + 0.0116 * sind(2 * Mp) - 0.0073 * E * sind(Mp + M) + 0.0067 * E * sind(Mp - M) + 0.0118 * sind(2 * F1);
  const Q = 5.2207 - 0.0048 * E * cosd(M) + 0.002 * E * cosd(2 * M) - 0.3299 * cosd(Mp) - 0.006 * E * cosd(Mp + M) + 0.0041 * E * cosd(Mp - M);
  const W = Math.abs(cosd(F1));
  const gamma = (P * cosd(F1) + Q * sind(F1)) * (1 - 0.0048 * W);
  const u = 0.0059 + 0.0046 * E * cosd(M) - 0.0182 * cosd(Mp) + 0.0004 * cosd(2 * Mp) - 0.0005 * cosd(M + Mp);
  const ag = Math.abs(gamma);
  const year = 2000 + k / 12.3685;
  const jdUT = jde - deltaT(year) / 86400;
  const e = { k, jde, jdUT, date: dateFromJd(jdUT), gamma, u, kind: solar ? "solar" : "lunar" };

  if (solar) {
    if (ag > 1.5433 + u) return null;
    if (ag < 0.9972) {
      if (u < 0) e.type = "total";
      else if (u > 0.0047) e.type = "annular";
      else e.type = u < 0.00464 * Math.sqrt(1 - gamma * gamma) ? "hybrid" : "annular";
      e.central = true;
    } else if (ag < 0.9972 + Math.abs(u)) {
      e.type = u < 0 ? "total" : "annular"; // the edge of the shadow grazes a pole
      e.central = false;
    } else {
      e.type = "partial";
      e.magnitude = (1.5433 + u - ag) / (0.5461 + 2 * u);
    }
    placeSolar(e);
  } else {
    const pen = (1.5573 + u - ag) / 0.545;
    const umb = (1.0128 - u - ag) / 0.545;
    if (pen <= 0) return null;
    e.penMag = pen;
    e.umbMag = umb;
    e.magnitude = umb > 0 ? umb : pen;
    e.type = umb >= 1 ? "total" : umb > 0 ? "partial" : "penumbral";
    const n = 0.5458 + 0.04 * cosd(Mp); // the Moon's speed (Earth radii an hour)
    const semi = (r) => (r > ag ? (60 / n) * Math.sqrt(r * r - gamma * gamma) : 0); // minutes
    e.semi = { pen: semi(1.5573 + u), par: semi(1.0128 - u), tot: semi(0.4678 - u) };
    placeLunar(e);
  }
  return e;
}

// where on the Earth: for a solar eclipse, the point where the shadow axis
// comes closest (greatest eclipse); for a lunar one, where the Moon is overhead
function placeSolar(e) {
  const jde = e.jde, jdUT = e.jdUT;
  const sun = earthFixed(sunPos(jde), jde, jdUT);
  const moon = earthFixed(moonPos(jde), jde, jdUT);
  const axis = scale(sub(moon, sun), 1 / len(sub(moon, sun))); // Sun -> Moon, the shadow's way
  // the component of the Moon's position across the axis gives the direction
  // of the closest approach; gamma (Meeus) gives the distance, more precisely
  const across = sub(moon, scale(axis, dot(moon, axis)));
  const dir = scale(across, 1 / len(across));
  const g = Math.abs(e.gamma);
  let p;
  if (g < 1) {
    // where the axis meets the surface, on the Sun's side
    const r = scale(dir, g * RE);
    p = sub(r, scale(axis, Math.sqrt(1 - g * g) * RE));
  } else p = dir; // partial: the edge of the Earth closest to the axis
  e.where = toLatLon(p);
  e.sunAlt = g < 1 ? Math.acos(g) * R2D : 0;
}

function placeLunar(e) {
  const moon = earthFixed(moonPos(e.jde), e.jde, e.jdUT);
  e.where = toLatLon(moon);
}

// ---------------------------------------------------------------- local views

// a lunar eclipse from a place: the Moon's altitude at each contact
function lunarLocal(e, lat, lon) {
  const at = (min) => altitude("moon", e.jdUT + min / 1440, lat, lon);
  const s = e.semi;
  const main = s.par > 0 ? s.par : s.pen;
  const alts = { max: at(0), start: at(-main), end: at(main) };
  alts.visible = alts.max > 0 || alts.start > 0 || alts.end > 0;
  alts.all = alts.max > 0 && alts.start > 0 && alts.end > 0;
  return alts;
}

// a solar eclipse from a place: the most of the Sun covered, and when.
// The Moon's position relative to the Sun, from the series above, is shifted
// so that the shadow axis passes the Earth's center at Meeus's gamma.
function solarLocal(e, lat, lon) {
  const obs0 = fromLatLon(lat, lon);
  const fix = solarFix(e);
  let best = null;
  const step = (t0, t1, dt) => {
    for (let m = t0; m <= t1; m += dt) {
      const r = solarAt(e, obs0, m, fix);
      if (r && (!best || r.sep - r.rs - r.rm < best.sep - best.rs - best.rm)) best = { ...r, min: m };
    }
  };
  step(-200, 200, 4);
  if (!best) return null;
  const b0 = best.min;
  step(b0 - 5, b0 + 5, 0.25);
  const r = best;
  if (r.sep >= r.rs + r.rm) return { seen: false, sunUp: r.sunAlt > 0 };
  // fraction of the Sun's disk covered (obscuration) and magnitude
  // magnitude: the fraction of the Sun's diameter covered; in totality or
  // annularity, by convention, the ratio of the Moon's diameter to the Sun's
  let magnitude = (r.rs + r.rm - r.sep) / (2 * r.rs);
  const obsc = overlap(r.rs, r.rm, r.sep) / (Math.PI * r.rs * r.rs);
  let kind = "partial";
  if (r.sep <= r.rm - r.rs) kind = "total";
  else if (r.sep <= r.rs - r.rm) kind = "annular";
  if (kind !== "partial") magnitude = r.rm / r.rs;
  // the start and end of the eclipse
  const edge = (dir) => {
    let lo = r.min, hi = r.min + dir * 200;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const x = solarAt(e, obs0, mid, fix);
      if (x.sep < x.rs + x.rm) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  // totality or annularity: while one disk is inside the other
  let dur = 0;
  if (kind !== "partial") {
    const inside = (m) => {
      const x = solarAt(e, obs0, m, fix);
      return x.sep <= Math.abs(x.rm - x.rs);
    };
    const bound = (dir) => {
      let lo = r.min, hi = r.min + dir * 10;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (inside(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    dur = (bound(1) - bound(-1)) * 60; // seconds
  }
  return {
    sep: r.sep,
    rs: r.rs,
    rm: r.rm,
    duration: dur,
    edge: kind !== "partial" && dur < 20,
    seen: r.sunAlt > -0.5,
    sunUp: r.sunAlt > 0,
    sunAlt: r.sunAlt,
    kind,
    magnitude,
    obscuration: Math.min(1, obsc),
    max: dateFromJd(e.jdUT + r.min / 1440),
    start: dateFromJd(e.jdUT + edge(-1) / 1440),
    end: dateFromJd(e.jdUT + edge(1) / 1440),
  };
}

// the shift that brings the computed shadow axis to Meeus's gamma
function solarFix(e) {
  const sun = earthFixed(sunPos(e.jde), e.jde, e.jdUT);
  const moon = earthFixed(moonPos(e.jde), e.jde, e.jdUT);
  const axis = scale(sub(moon, sun), 1 / len(sub(moon, sun)));
  const across = sub(moon, scale(axis, dot(moon, axis)));
  const d = len(across);
  // the Moon moved across the axis so its distance from the Earth's center is gamma
  return scale(across, (Math.abs(e.gamma) * RE) / d - 1);
}

function solarAt(e, obs0, min, fix) {
  const jdUT = e.jdUT + min / 1440, jde = e.jde + min / 1440;
  const sun = earthFixed(sunPos(jde), jde, jdUT);
  let moon = earthFixed(moonPos(jde), jde, jdUT);
  moon = [moon[0] + fix[0], moon[1] + fix[1], moon[2] + fix[2]];
  const s = sub(sun, obs0), m = sub(moon, obs0);
  const ls = len(s), lm = len(m);
  const sep = Math.acos(Math.min(1, dot(s, m) / (ls * lm))) * R2D;
  const rs = Math.asin(696000 / ls) * R2D;
  const rm = Math.asin(1737.4 / lm) * R2D;
  const sunAlt = Math.asin(dot(s, obs0) / (ls * RE)) * R2D;
  return { sep, rs, rm, sunAlt };
}

// area of the overlap of two disks of radii a and b, centers d apart
function overlap(a, b, d) {
  if (d >= a + b) return 0;
  if (d <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
  const x = (d * d + a * a - b * b) / (2 * d);
  const y = (d * d + b * b - a * a) / (2 * d);
  return a * a * Math.acos(x / a) - x * Math.sqrt(a * a - x * x) + b * b * Math.acos(y / b) - y * Math.sqrt(b * b - y * y);
}

// the Saros series of an eclipse. Eclipses 223 lunations apart (a Saros) are
// in the same series; 358 lunations (an inex) is the step to the next series.
// So k - k0 = 223 a + 358 b, and the series is s0 + b, from a known eclipse:
// the total solar eclipse of 2024-04-08 (Saros 139) and the total lunar
// eclipse of 2025-03-14 (Saros 123).
const SAROS_REF = { solar: [null, 139, "2024-04-08"], lunar: [null, 123, "2025-03-14"] };
function saros(e) {
  const ref = SAROS_REF[e.kind];
  if (ref[0] === null) {
    // the lunation number of the reference eclipse
    const d = new Date(ref[2] + "T12:00:00Z");
    const k = Math.round(((d.getUTCFullYear() + d.getUTCMonth() / 12 + d.getUTCDate() / 365 - 2000) * 12.3685) * 2) / 2;
    for (const kk of [k - 1, k - 0.5, k, k + 0.5, k + 1]) {
      const x = eclipseAt(kk);
      if (x && x.kind === e.kind && x.date.toISOString().startsWith(ref[2])) ref[0] = kk;
    }
  }
  const dk = e.k - ref[0];
  // b is defined up to a multiple of 223: keep the one giving a series number
  // in 1 to 223 (all the series active from 1900 to 2100 are in that range)
  for (let b = -250; b <= 250; b++) {
    const s = ref[1] + b;
    if (s >= 1 && s <= 223 && (((dk - 358 * b) % 223) + 223) % 223 === 0) return s;
  }
  return null;
}

if (typeof module !== "undefined") {
  module.exports = { eclipsesOfYear, eclipseAt, moonPos, sunPos, lunarLocal, solarLocal, altitude, deltaT, jdFromDate, dateFromJd, saros };
}
