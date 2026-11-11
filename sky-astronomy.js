/* Small deterministic astronomy core. No DOM, dependencies, random stars or cache. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.SkyAstronomy = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEG = Math.PI / 180;
  const DAY_MS = 86400000;
  const CHINA_OFFSET_MS = 8 * 3600000;
  const J2000 = 2451545;
  const OBSERVER = Object.freeze({ lat: 38.4177, lon: 112.7335 });
  const TARGET = Object.freeze({ lat: 41.8057, lon: 123.4315 });
  const PROJECTION = Object.freeze({ altitude: 35, focalRatio: 0.5, longSideFov: 90 });
  const TWILIGHT = Object.freeze({ dawn: -12, vesper: -6 });
  const wrap = value => ((value % 360) + 360) % 360;
  const clamp = value => Math.max(-1, Math.min(1, value));

  function finite(value, name) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(name + ' must be a finite number');
    }
    return value;
  }

  function asDate(value) {
    if (value === null || value === undefined) throw new TypeError('A date is required');
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
    return date;
  }

  function julian(date) {
    return date.getTime() / DAY_MS + 2440587.5;
  }

  // Date strings denote China's civil day, never the host computer's timezone.
  function chinaDate(now) {
    const date = now === undefined ? new Date() : asDate(now);
    return new Date(date.getTime() + CHINA_OFFSET_MS).toISOString().slice(0, 10);
  }

  function dayStart(dateKey) {
    if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new RangeError('dateKey must be YYYY-MM-DD');
    }
    const date = asDate(dateKey + 'T00:00:00+08:00');
    if (chinaDate(date) !== dateKey) throw new RangeError('Invalid civil date');
    return date.getTime();
  }

  function themeKey(theme) {
    if (theme === 'dawn' || theme === 'morning') return 'dawn';
    if (theme === 'vesper' || theme === 'dusk') return 'vesper';
    throw new RangeError('theme must be dawn/morning or vesper/dusk');
  }

  // Initial great-circle bearing, true north = 0 degrees, clockwise positive.
  function initialBearing(from, to) {
    const p1 = from.lat * DEG;
    const p2 = to.lat * DEG;
    const delta = (to.lon - from.lon) * DEG;
    return wrap(Math.atan2(Math.sin(delta) * Math.cos(p2),
      Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(delta)) / DEG);
  }
  const BEARING = initialBearing(OBSERVER, TARGET);

  // IAU 1976 precession, equatorial J2000 mean coordinates -> mean date.
  // RA is in hours; all other angular input/output is in degrees.
  function precess(raHours, decDeg, date) {
    finite(raHours, 'raHours');
    finite(decDeg, 'decDeg');
    if (Math.abs(decDeg) > 90) throw new RangeError('decDeg must be within [-90, 90]');
    const t = (julian(asDate(date)) - J2000) / 36525;
    const t2 = t * t;
    const t3 = t2 * t;
    const zeta = (2306.2181 * t + 0.30188 * t2 + 0.017998 * t3) / 3600 * DEG;
    const z = (2306.2181 * t + 1.09468 * t2 + 0.018203 * t3) / 3600 * DEG;
    const theta = (2004.3109 * t - 0.42665 * t2 - 0.041833 * t3) / 3600 * DEG;
    const a = raHours * 15 * DEG + zeta;
    const d = decDeg * DEG;
    const A = Math.cos(d) * Math.sin(a);
    const B = Math.cos(theta) * Math.cos(d) * Math.cos(a) - Math.sin(theta) * Math.sin(d);
    const C = Math.sin(theta) * Math.cos(d) * Math.cos(a) + Math.cos(theta) * Math.sin(d);
    return { ra: wrap((Math.atan2(A, B) + z) / DEG) / 15,
      dec: Math.atan2(C, Math.hypot(A, B)) / DEG };
  }

  function sidereal(jd) {
    const t = (jd - J2000) / 36525;
    return wrap(280.46061837 + 360.98564736629 * (jd - J2000)
      + 0.000387933 * t * t - t * t * t / 38710000);
  }

  function horizontalAt(jd, raDateHours, decDateDeg) {
    const h = (sidereal(jd) + OBSERVER.lon - raDateHours * 15) * DEG;
    const d = decDateDeg * DEG;
    const p = OBSERVER.lat * DEG;
    // East/north/up basis avoids azimuth quadrant ambiguity, including due north.
    const east = -Math.cos(d) * Math.sin(h);
    const north = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(h) * Math.sin(p);
    const up = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(h) * Math.cos(p);
    return { alt: Math.asin(clamp(up)) / DEG, az: wrap(Math.atan2(east, north) / DEG) };
  }

  function horizontal(date, raDateHours, decDateDeg) {
    finite(raDateHours, 'raDateHours');
    finite(decDateDeg, 'decDateDeg');
    if (Math.abs(decDateDeg) > 90) throw new RangeError('decDateDeg must be within [-90, 90]');
    return horizontalAt(julian(asDate(date)), raDateHours, decDateDeg);
  }

  // Low-precision Meeus/NOAA Sun of date; apparent ecliptic longitude and obliquity.
  // UTC substitutes for UT1/TT here; the resulting timing error is far below 3 min.
  function solarEquatorial(jd) {
    const t = (jd - J2000) / 36525;
    const L = wrap(280.46646 + t * (36000.76983 + 0.0003032 * t));
    const M = wrap(357.52911 + t * (35999.05029 - 0.0001537 * t)) * DEG;
    const C = Math.sin(M) * (1.914602 - t * (0.004817 + 0.000014 * t))
      + Math.sin(2 * M) * (0.019993 - 0.000101 * t) + Math.sin(3 * M) * 0.000289;
    const omega = (125.04 - 1934.136 * t) * DEG;
    const lambda = (L + C - 0.00569 - 0.00478 * Math.sin(omega)) * DEG;
    const epsilon = (23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - 0.001813 * t))) / 60) / 60
      + 0.00256 * Math.cos(omega)) * DEG;
    return { ra: wrap(Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) / DEG) / 15,
      dec: Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / DEG };
  }

  function solarAltitude(time) {
    const jd = time / DAY_MS + 2440587.5;
    const sun = solarEquatorial(jd);
    return horizontalAt(jd, sun.ra, sun.dec).alt;
  }

  // Scan only this UTC+8 civil day in 10-minute steps; bisect the chosen crossing
  // to a <=1-second bracket. Thresholds refer to the solar centre, no refraction.
  function twilight(dateKey, theme) {
    const key = themeKey(theme);
    const altitude = TWILIGHT[key];
    const rising = key === 'dawn';
    const start = dayStart(dateKey);
    const end = start + DAY_MS;
    const step = 10 * 60000;
    let left = start;
    let before = solarAltitude(left) - altitude;
    for (let right = start + step; right <= end; right += step) {
      const after = solarAltitude(right) - altitude;
      const crosses = rising ? before <= 0 && after > 0 : before >= 0 && after < 0;
      if (crosses) {
        let lo = left;
        let hi = right;
        while (hi - lo > 1000) {
          const mid = (lo + hi) / 2;
          const above = solarAltitude(mid) >= altitude;
          if (above === rising) hi = mid;
          else lo = mid;
        }
        const time = Math.round((lo + hi) / 2000) * 1000;
        return new Date(Math.max(start, Math.min(end - 1000, time)));
      }
      left = right;
      before = after;
    }
    return null; // Explicit no-event result, rather than inventing an observation time.
  }

  function sky(dateKey, theme, catalog) {
    if (!Array.isArray(catalog)) throw new TypeError('catalog must be an array');
    const time = twilight(dateKey, theme);
    if (!time) return { time: null, bearing: BEARING, stars: [] };
    const stars = catalog.map(function (row) {
      if (!Array.isArray(row) || row.length < 4 || row[0] == null) {
        throw new TypeError('catalog row must be [id, raHours, decDeg, mag, ci]');
      }
      finite(row[3], 'mag');
      const ci = row[4] == null ? null : finite(row[4], 'ci');
      // Catalog is J2000. Unverified proper-motion columns (if any) are NOT used.
      const equatorial = precess(row[1], row[2], time);
      const position = horizontal(time, equatorial.ra, equatorial.dec);
      return { id: row[0], ra: equatorial.ra, dec: equatorial.dec, mag: row[3],
        alt: position.alt, az: position.az, ci: ci };
    });
    return { time: time.toISOString(), bearing: BEARING, stars: stars };
  }

  // Gnomonic camera, north-clockwise azimuth; screen-right is increasing azimuth.
  // A single focal length gives a 90-degree long-side FOV. Narrow phone screens
  // crop the same virtual square; neither axis stretches nor changes star angles.
  function project(star, width, height, bearing) {
    finite(width, 'width');
    finite(height, 'height');
    if (width <= 0 || height <= 0) return null;
    if (!star || !Number.isFinite(star.alt) || !Number.isFinite(star.az) || star.alt < 0) return null;
    const axis = bearing === undefined ? BEARING : finite(bearing, 'bearing');
    const a = star.alt * DEG;
    const delta = (star.az - axis) * DEG;
    const tilt = PROJECTION.altitude * DEG;
    const depth = Math.sin(a) * Math.sin(tilt) + Math.cos(a) * Math.cos(tilt) * Math.cos(delta);
    if (depth <= 1e-12) return null;
    const right = Math.cos(a) * Math.sin(delta);
    const up = Math.sin(a) * Math.cos(tilt) - Math.cos(a) * Math.sin(tilt) * Math.cos(delta);
    const focal = Math.max(width, height) * PROJECTION.focalRatio;
    const x = width / 2 + focal * right / depth;
    const y = height / 2 - focal * up / depth;
    if (x < 0 || x > width || y < 0 || y > height) return null;
    return { x: x, y: y };
  }

  const constants = Object.freeze({ OBSERVER: OBSERVER, TARGET: TARGET, BEARING: BEARING,
    PROJECTION: PROJECTION, TWILIGHT: TWILIGHT, CHINA_OFFSET_MS: CHINA_OFFSET_MS, J2000: J2000 });
  const explain = Object.freeze({
    coordinates: 'J2000 catalog -> IAU 1976 mean equator/equinox of date -> GMST + east longitude; RA hours, other angles degrees.',
    azimuth: 'True north 0 degrees, east 90 degrees; geometric altitude, no atmospheric refraction.',
    twilight: 'UTC+8 civil day; dawn rising solar centre -12 degrees, vesper falling -6 degrees; Date or null.',
    projection: 'Gnomonic, bearing toward Shenyang, axis altitude 35 degrees; shared focal length = max(width,height)/2; long-side FOV 90 degrees.',
    accuracy: 'Low-precision Meeus/NOAA Sun intended for contemporary twilight within about 3 minutes, not precision ephemerides. UTC approximates UT1/TT; no parallax, proper motion or stellar nutation/aberration.',
    catalog: 'Rows [id,raHours,decDeg,mag,ci]; ci may be null. Any extra unverified proper-motion fields are ignored. Output ra/dec are of date.',
    caching: 'No internal cache or animation; caller owns observation-time caching and drawing.'
  });

  return Object.freeze({ chinaDate: chinaDate, twilight: twilight, precess: precess,
    horizontal: horizontal, sky: sky, project: project, OBSERVER: OBSERVER, TARGET: TARGET,
    BEARING: BEARING, PROJECTION: PROJECTION, TWILIGHT: TWILIGHT, constants: constants, explain: explain });
}));
