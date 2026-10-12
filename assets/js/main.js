/* His Word Christian Centre — homepage behaviour (no dependencies) */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header: transparent over the hero, solid once scrolled */
  var header = document.querySelector('[data-header]');
  function onScroll() {
    if (header) header.classList.toggle('is-solid', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var menu = document.getElementById('mobile-menu');
  var openBtn = document.querySelector('[data-menu-open]');
  var closeBtn = document.querySelector('[data-menu-close]');
  function openMenu() {
    menu.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function closeMenu() {
    menu.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (menu && openBtn && closeBtn) {
    openBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', function () { closeMenu(); openBtn.focus(); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); openBtn.focus(); } });
  }

  /* Reveal on scroll */
  var items = document.querySelectorAll('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { (en.target._reveal || en.target).classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) {
      // Line reveals sit inside an overflow:hidden wrapper, so watch the wrapper instead
      if (el.getAttribute('data-reveal') === 'line') { el.parentElement._reveal = el; io.observe(el.parentElement); }
      else io.observe(el);
    });
    // Safety net: never leave content hidden (e.g. print, odd browsers)
    window.addEventListener('beforeprint', function () { items.forEach(function (el) { el.classList.add('is-in'); }); });
  }

  /* Hero image: gentle zoom-out while scrolling */
  var heroImg = document.querySelector('[data-hero-img]');
  if (heroImg && !reduce) {
    var ticking = false;
    var zoom = function () {
      var p = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      heroImg.style.transform = 'scale(' + (1.05 - p * 0.05).toFixed(4) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(zoom); } }, { passive: true });
    zoom();
  }

  /* Ministries: hovering a ministry updates the side panel */
  var list = document.querySelector('[data-ministries]');
  if (list) {
    var rows = list.querySelectorAll('li');
    var frame = document.querySelector('[data-min-frame]');
    var img = document.querySelector('[data-min-img]');
    var fb = document.querySelector('[data-min-fallback]');
    var setActive = function (i) {
      rows.forEach(function (r, j) { r.classList.toggle('is-active', i === j); });
      var row = rows[i], src = row.getAttribute('data-img');
      if (src) { img.src = src; img.hidden = false; fb.hidden = true; }
      else {
        img.hidden = true; fb.hidden = false;
        fb.querySelector('.min-fb-n').textContent = String(i + 1).padStart(2, '0');
        fb.querySelector('.min-fb-t').textContent = row.getAttribute('data-name');
      }
      if (!reduce && frame) { frame.classList.remove('min-swap'); void frame.offsetWidth; frame.classList.add('min-swap'); }
    };
    rows.forEach(function (r, i) { r.addEventListener('mouseenter', function () { setActive(i); }); });
    setActive(0);
  }

  /* "Watch live": red dot + "Watch live" only during service times, "Watch online" otherwise.
     Service times come from _data/church.yml (written into the page as window.HWCC_SERVICES).
     Times are South African time (SAST, UTC+2, no daylight saving).
     The label switches on EARLY_MINUTES before a service starts. */
  var DAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  var SERVICE_TIMES = (window.HWCC_SERVICES || []).map(function (s) {
    return { day: DAYS[String(s.day).toLowerCase()], start: s.start, end: s.end };
  }).filter(function (s) { return s.day !== undefined && s.start && s.end; });
  var EARLY_MINUTES = 15;
  var liveLinks = document.querySelectorAll('[data-live]');
  function toMin(t) { var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function isServiceTime() {
    var sast = new Date(Date.now() + 2 * 60 * 60 * 1000); // read with getUTC* = SAST
    var day = sast.getUTCDay(), now = sast.getUTCHours() * 60 + sast.getUTCMinutes();
    return SERVICE_TIMES.some(function (s) {
      return s.day === day && now >= toMin(s.start) - EARLY_MINUTES && now < toMin(s.end);
    });
  }
  function updateLive() {
    var live = isServiceTime();
    liveLinks.forEach(function (a) {
      a.classList.toggle('is-live', live);
      var label = a.querySelector('[data-live-label]');
      if (label) label.textContent = live ? 'Watch live' : 'Watch online';
      // Live stream is on Facebook; outside service times send people to the YouTube channel
      var href = a.getAttribute(live ? 'data-live-href' : 'data-online-href');
      if (href) a.setAttribute('href', href);
    });
  }
  if (liveLinks.length) { updateLive(); setInterval(updateLive, 60 * 1000); }

  /* Latest sermon: show a cover image until clicked, then load the YouTube player in place.
     Opened as a local file (file://) YouTube refuses to play embeds, so open YouTube in a new tab instead. */
  document.querySelectorAll('.video-facade').forEach(function (box) {
    function play() {
      if (box.classList.contains('is-playing')) return;
      if (location.protocol === 'file:') { window.open(box.getAttribute('data-watch'), '_blank', 'noopener'); return; }
      var f = document.createElement('iframe');
      f.src = box.getAttribute('data-embed');
      f.title = 'Christ Above Culture sermon series';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.classList.add('is-playing');
      box.innerHTML = '';
      box.appendChild(f);
    }
    box.addEventListener('click', play);
  });

  /* Events: hide any whose date has passed (the site is rebuilt on each update,
     but this keeps it right between updates). */
  var evList = document.querySelector('[data-events]');
  if (evList) {
    var sastNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    var todayStr = sastNow.toISOString().slice(0, 10);
    var visible = 0;
    evList.querySelectorAll('li[data-date]').forEach(function (li) {
      if (li.getAttribute('data-date') < todayStr) li.hidden = true; else visible++;
    });
    var empty = document.querySelector('[data-events-empty]');
    if (empty) empty.hidden = visible > 0;
  }

  /* Footer year */
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
