/**
 * Boulevard 301 — Shared JS
 * NeonFrame Web Design
 *
 * Handles: language toggle (EN/ES), nav (hamburger), scroll-reveal,
 *          gallery lightbox, menu sidebar rotation.
 */

// ─── Language ────────────────────────────────────────────────────────────────
const LANG_KEY = 'blvd301_lang';

function getLang() {
  return localStorage.getItem(LANG_KEY) || 'es';
}

function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}

// Apply language strings to all [data-es] / [data-en] elements,
// update html[lang], update title + meta description.
function applyLang(lang, animate) {
  const root = document.documentElement;

  const run = () => {
    document.querySelectorAll('[data-es],[data-en]').forEach(el => {
      const val = lang === 'es' ? el.dataset.es : el.dataset.en;
      if (val !== undefined) el.textContent = val;
    });

    // Placeholder attributes (inputs)
    document.querySelectorAll('[data-placeholder-es],[data-placeholder-en]').forEach(el => {
      const val = lang === 'es' ? el.dataset.placeholderEs : el.dataset.placeholderEn;
      if (val !== undefined) el.placeholder = val;
    });

    root.lang = lang;

    // Swap title / meta description
    const titleEs = document.querySelector('meta[name="title-es"]');
    const titleEn = document.querySelector('meta[name="title-en"]');
    const descEs  = document.querySelector('meta[name="description-es"]');
    const descEn  = document.querySelector('meta[name="description-en"]');

    if (lang === 'es') {
      if (titleEs) document.title = titleEs.content;
      const descMeta = document.querySelector('meta[name="description"]');
      if (descEs && descMeta) descMeta.content = descEs.content;
    } else {
      if (titleEn) document.title = titleEn.content;
      const descMeta = document.querySelector('meta[name="description"]');
      if (descEn && descMeta) descMeta.content = descEn.content;
    }

    // Update toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  };

  if (animate) {
    document.body.classList.add('lang-fade');
    setTimeout(() => {
      run();
      document.body.classList.remove('lang-fade');
    }, 80);
  } else {
    run();
  }
}

// Inline lang apply happens before paint (via inline script in <head>).
// This module sets up the toggle listeners only.
function initLang() {
  const lang = getLang();
  applyLang(lang, false);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang;
      setLang(next);
      applyLang(next, true);
    });
  });
}

// ─── Nav hamburger (full-screen overlay) ──────────────────────────────────────
function initNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const panel = document.querySelector('.nav-mobile-panel');
  if (!hamburger || !panel) return;

  function setOpen(open) {
    panel.classList.toggle('open', open);
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    const es = getLang() === 'es';
    hamburger.setAttribute('aria-label',
      open ? (es ? 'Cerrar menú' : 'Close menu') : (es ? 'Abrir menú' : 'Open menu'));
    document.body.classList.toggle('menu-open', open);
    if (open) {
      const first = panel.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!panel.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') &&
        !panel.contains(e.target) && !hamburger.contains(e.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      setOpen(false);
      hamburger.focus();
    }
  });

  // Close on link tap
  panel.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setOpen(false));
  });
}

// ─── Nav scroll state (transparent over hero -> solid on scroll) ───────────────
function initNavScroll() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  let ticking = false;
  const update = () => { nav.classList.toggle('scrolled', window.scrollY > 40); ticking = false; };
  update();
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
}

// ─── Scroll reveal ────────────────────────────────────────────────────────────
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  items.forEach(el => obs.observe(el));
}

// ─── Gallery lightbox ─────────────────────────────────────────────────────────
function initLightbox() {
  const lb         = document.getElementById('lightbox');
  if (!lb) return;

  const lbImg      = lb.querySelector('#lb-img');
  const lbCaption  = lb.querySelector('.lb-caption');
  const lbClose    = lb.querySelector('.lb-close');
  const lbPrev     = lb.querySelector('.lb-prev');
  const lbNext     = lb.querySelector('.lb-next');

  let items = [];
  let cur   = 0;

  function getItems() {
    return Array.from(document.querySelectorAll('.scroll-card'));
  }

  function show(index) {
    items = getItems();
    cur = (index + items.length) % items.length;
    const item = items[cur];
    const img  = item.querySelector('img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    // Caption: use data-es or data-en based on current lang
    const lang = getLang();
    const capEl = item.querySelector('[data-es]');
    if (capEl) {
      lbCaption.textContent = lang === 'es' ? (capEl.dataset.es || '') : (capEl.dataset.en || '');
    } else {
      lbCaption.textContent = img.alt || '';
    }
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Wire up gallery cards
  document.querySelectorAll('.scroll-card').forEach((item) => {
    item.addEventListener('click', () => {
      items = getItems();
      const visibleIndex = items.indexOf(item);
      show(visibleIndex >= 0 ? visibleIndex : 0);
    });
  });

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', () => show(cur - 1));
  lbNext.addEventListener('click', () => show(cur + 1));

  lb.addEventListener('click', (e) => {
    if (e.target === lb) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });

  // Touch swipe
  let touchStartX = 0;
  lb.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { dx < 0 ? show(cur + 1) : show(cur - 1); }
  });
}

// ─── Gallery scroll strips (arrow nav + drag) ─────────────────────────────────
function initScrollStrips() {
  document.querySelectorAll('.scroll-section').forEach(section => {
    const strip = section.querySelector('.scroll-strip');
    const prevBtn = section.querySelector('.scroll-nav-btn.prev');
    const nextBtn = section.querySelector('.scroll-nav-btn.next');
    if (!strip) return;

    const cardWidth = () => {
      const card = strip.querySelector('.scroll-card');
      return card ? card.offsetWidth + 10 : 270;
    };

    if (nextBtn) nextBtn.addEventListener('click', () => {
      strip.scrollBy({ left: cardWidth() * 2, behavior: 'smooth' });
    });
    if (prevBtn) prevBtn.addEventListener('click', () => {
      strip.scrollBy({ left: -cardWidth() * 2, behavior: 'smooth' });
    });

    // Drag to scroll
    let isDown = false, startX, scrollLeft;
    strip.addEventListener('mousedown', e => {
      isDown = true;
      strip.classList.add('dragging');
      startX = e.pageX - strip.offsetLeft;
      scrollLeft = strip.scrollLeft;
    });
    strip.addEventListener('mouseleave', () => { isDown = false; strip.classList.remove('dragging'); });
    strip.addEventListener('mouseup', () => { isDown = false; strip.classList.remove('dragging'); });
    strip.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - strip.offsetLeft;
      strip.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
  });
}

// ─── Menu sidebar photo rotation ─────────────────────────────────────────────
function initMenuSidebar() {
  const photos = document.querySelectorAll('.menu-sidebar-photo');
  if (!photos.length) return;

  const captionEl = document.querySelector('.menu-sidebar-caption-text');
  let cur = 0;
  photos[cur].classList.add('active');
  if (captionEl) captionEl.textContent = photos[cur].dataset.caption || photos[cur].alt;

  setInterval(() => {
    photos[cur].classList.remove('active');
    cur = (cur + 1) % photos.length;
    photos[cur].classList.add('active');
    if (captionEl) captionEl.textContent = photos[cur].dataset.caption || photos[cur].alt;
  }, 4000);
}

// ─── Loader (index.html) ──────────────────────────────────────────────────────
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 250);
  };

  // Dismiss as soon as the page is ready (brief brand beat), with a safety cap.
  if (document.readyState === 'complete') {
    setTimeout(dismiss, 250);
  } else {
    window.addEventListener('load', () => setTimeout(dismiss, 250));
  }
  setTimeout(dismiss, 1100);
}

// ─── Home hero parallax (desktop only, rAF-throttled) ─────────────────────────
function initParallax() {
  const heroBg = document.querySelector('.hero-parallax-bg');
  if (!heroBg) return;

  // Skip on touch and for reduced-motion users.
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      heroBg.style.transform = `translateY(${window.scrollY * 0.4}px)`;
      ticking = false;
    });
  }, { passive: true });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLang();
  initNav();
  initNavScroll();
  initScrollReveal();
  initLightbox();
  initScrollStrips();
  initMenuSidebar();
  initLoader();
  initParallax();
});
