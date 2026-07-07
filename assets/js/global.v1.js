/* =========================================================
   GLOBAL JS
   - Loads shared header/footer partials
   - Initializes mobile menu, sticky header, reveal animations, year
   - Initializes mortgage inquiry modal
   - Initializes privacy/cookie preference banner
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadComponent("siteHeaderMount", "/header.html"),
    loadComponent("siteFooterMount", "/footer.html"),
  ]);

  setCurrentYear();
  initStickyHeader();
  initMobileMenu();
  initRevealAnimations();
  initPathwaySwitcher();
  initMortgageInquiryForm();
  initPrivacyBanner();
});

/**
 * Loads a reusable HTML partial into a mount element.
 * This works on Netlify or a local dev server. It will not work from a direct file:// open.
 */
async function loadComponent(mountId, filePath) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  try {
    const response = await fetch(filePath, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${filePath}`);
    mount.innerHTML = await response.text();
  } catch (error) {
    console.error(error);
  }
}

/** Updates all footer year placeholders. */
function setCurrentYear() {
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });
}

/** Adds a solid header state after scrolling. */
function initStickyHeader() {
  const header = document.querySelector("[data-site-header]");
  if (!header) return;

  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

/** Handles the mobile menu and force-closes it on desktop resize. */
function initMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    menu.hidden = false;
    document.body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
  });

  menu.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 1040px)").matches) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

/** Reveals sections on scroll without relying on a third-party animation library. */
function initRevealAnimations() {
  const revealNodes = document.querySelectorAll(".reveal-up");
  if (!revealNodes.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealNodes.forEach((node) => observer.observe(node));
}

/** Updates the editorial mortgage pathway feature when a pathway row is selected. */
function initPathwaySwitcher() {
  const rows = document.querySelectorAll("[data-pathway-title]");
  const title = document.querySelector("[data-feature-title]");
  const copy = document.querySelector("[data-feature-copy]");

  if (!rows.length || !title || !copy) return;

  rows.forEach((row) => {
    row.addEventListener("click", () => {
      rows.forEach((item) => item.classList.remove("is-active"));
      row.classList.add("is-active");

      title.textContent = row.getAttribute("data-pathway-title") || "Mortgage Pathway";
      copy.textContent = row.getAttribute("data-pathway-copy") || "Clear guidance for your next step.";
    });
  });
}

/**
 * Handles the Netlify mortgage inquiry form modal.
 *
 * Important:
 * - The form itself is static HTML in index.html so Netlify can detect it at deploy time.
 * - Header links can safely point to /#mortgageInquiry from other pages.
 * - On the home page, those links open the modal instead of navigating.
 */
function initMortgageInquiryForm() {
  const modal = document.getElementById("mortgageInquiry");
  const sourceField = modal?.querySelector("[data-form-source-field]");
  const pathwayField = modal?.querySelector("[data-form-pathway-field]");
  const interestSelect = modal?.querySelector("#mortgageInterest");

  const getActivePathway = () => {
    const featureTitle = document.querySelector("[data-feature-title]");
    return featureTitle?.textContent?.trim() || "";
  };

  const syncInterestSelect = (pathway) => {
    if (!(interestSelect instanceof HTMLSelectElement) || !pathway) return;

    const matchingOption = [...interestSelect.options].find((option) => option.value === pathway);
    if (matchingOption) {
      interestSelect.value = pathway;
    }
  };

  const openModal = (trigger) => {
    if (!modal) return;

    const source = trigger?.getAttribute("data-form-source") || "Website inquiry";
    const activePathway = source.includes("Pathway") ? getActivePathway() : "";

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("form-modal-open");

    if (sourceField instanceof HTMLInputElement) {
      sourceField.value = source;
    }

    if (pathwayField instanceof HTMLInputElement) {
      pathwayField.value = activePathway;
    }

    if (activePathway) {
      syncInterestSelect(activePathway);
    }

    window.setTimeout(() => {
      const firstInput = modal.querySelector("input:not([type='hidden']):not([name='bot-field']), select, textarea, button");
      firstInput?.focus();
    }, 0);
  };

  const closeModal = () => {
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("form-modal-open");
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest("[data-open-mortgage-form]") : null;

    if (trigger) {
      if (!modal) return;

      event.preventDefault();
      openModal(trigger);
      return;
    }

    const closeTrigger = event.target instanceof Element ? event.target.closest("[data-form-close]") : null;

    if (closeTrigger) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) {
      closeModal();
    }
  });

  if (window.location.hash === "#mortgageInquiry" && modal) {
    openModal(null);
  }
}

/**
 * Lightweight privacy/cookie banner.
 *
 * Behavior:
 * - Shows when no privacy preference exists.
 * - Does not disappear on scroll.
 * - Does not use reveal animations.
 * - Does not use timeout removal.
 * - Only removes itself after Accept optional or Decline optional is clicked.
 */
function initPrivacyBanner() {
  const storageKey = "dc_privacy_preference_v1";
  const existingPreference = localStorage.getItem(storageKey);

  if (existingPreference) {
    if (existingPreference === "accepted_optional") {
      enableOptionalTracking();
    }

    return;
  }

  if (document.getElementById("privacyConsentBanner")) return;

  const banner = document.createElement("section");
  banner.id = "privacyConsentBanner";
  banner.className = "privacy-banner";
  banner.setAttribute("aria-label", "Privacy preferences");
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-live", "polite");

  banner.innerHTML = `
    <div class="privacy-banner__content">
      <p class="privacy-banner__eyebrow">Privacy preferences</p>
      <h2>We respect your privacy.</h2>
      <p>
        This site may use optional analytics and advertising tools, including Google Analytics
        and Google Ads, to measure performance and improve marketing. You can accept or decline
        optional tracking.
      </p>
      <div class="privacy-banner__actions">
        <button class="btn btn--primary" type="button" data-privacy-accept>Accept optional</button>
        <button class="btn btn--ghost" type="button" data-privacy-decline>Decline optional</button>
        <a class="text-link" href="/privacy.html">Privacy Policy</a>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  banner.querySelector("[data-privacy-accept]")?.addEventListener("click", () => {
    localStorage.setItem(storageKey, "accepted_optional");
    banner.remove();
    enableOptionalTracking();
  });

  banner.querySelector("[data-privacy-decline]")?.addEventListener("click", () => {
    localStorage.setItem(storageKey, "declined_optional");
    banner.remove();
  });
}

/**
 * Placeholder for future tracking scripts.
 * Example later:
 * - Load GA4 only after consent
 * - Load Google Ads conversion scripts only after consent
 * - Load CRM tracking only after consent
 */
function enableOptionalTracking() {
  document.documentElement.dataset.optionalTracking = "accepted";
}