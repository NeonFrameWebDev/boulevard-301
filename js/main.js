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

// ─── Nav hamburger ────────────────────────────────────────────────────────────
function initNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobilePanel = document.querySelector('.nav-mobile-panel');
  if (!hamburger || !mobilePanel) return;

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = mobilePanel.classList.toggle('open');
    hamburger.classList.toggle('open', open);
  });

  document.addEventListener('click', (e) => {
    if (!mobilePanel.contains(e.target) && !hamburger.contains(e.target)) {
      mobilePanel.classList.remove('open');
      hamburger.classList.remove('open');
    }
  });

  // Close on link tap
  mobilePanel.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobilePanel.classList.remove('open');
      hamburger.classList.remove('open');
    });
  });
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
    return Array.from(
      document.querySelectorAll('.masonry-item:not(.hidden)')
    );
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

  // Wire up gallery items
  document.querySelectorAll('.masonry-item').forEach((item, i) => {
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

// ─── Gallery filter ───────────────────────────────────────────────────────────
function initGalleryFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tag = btn.dataset.filter;
      document.querySelectorAll('.masonry-item').forEach(item => {
        if (tag === 'all' || item.dataset.cat === tag) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });
}

// ─── Gallery lazy load ────────────────────────────────────────────────────────
function initGalleryLazyReveal() {
  const items = document.querySelectorAll('.masonry-item');
  if (!items.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  items.forEach(el => obs.observe(el));
}

// ─── Menu sidebar photo rotation ─────────────────────────────────────────────
function initMenuSidebar() {
  const photos = document.querySelectorAll('.menu-sidebar-photo');
  if (!photos.length) return;

  let cur = 0;
  photos[cur].classList.add('active');

  setInterval(() => {
    photos[cur].classList.remove('active');
    cur = (cur + 1) % photos.length;
    photos[cur].classList.add('active');
  }, 4000);
}

// ─── Loader (index.html) ──────────────────────────────────────────────────────
function initLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;

  // Total: 0.4s logo + 0.6s bar + a tiny buffer = 1.2s
  setTimeout(() => {
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 250);
  }, 1150);
}

// ─── Home hero parallax (desktop only) ───────────────────────────────────────
function initParallax() {
  const heroBg = document.querySelector('.hero-parallax-bg');
  if (!heroBg) return;

  // Disable on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    heroBg.style.transform = `translateY(${y * 0.4}px)`;
  }, { passive: true });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLang();
  initNav();
  initScrollReveal();
  initLightbox();
  initGalleryFilter();
  initGalleryLazyReveal();
  initMenuSidebar();
  initLoader();
  initParallax();
});
