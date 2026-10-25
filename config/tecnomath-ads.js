/* Public configuration only. Publisher ID is intended to be public in AdSense client code. */
window.TECNOMATH_ADS = Object.freeze({
  enabled: true,
  provider: 'google-adsense',
  publisherId: 'ca-pub-9426294483156864',
  showOnHome: true,
  showOnCatalog: true,
  showOnInfoPages: true,
  showOnGames: false,
  showOnVoting: false,
  showOnRanking: false,
  showOnAdmin: false,
  premiumRemovesAds: true,
  contextualOnly: true,
  requireConsentForPersonalizedAds: true
});

// Bootstrap i18n on the public home page before the service worker takes over.
(function () {
  if (document.querySelector('script[data-tecnomath-i18n]')) return;
  const script = document.createElement('script');
  script.src = '/js/i18n.js';
  script.defer = true;
  script.dataset.tecnomathI18n = 'true';
  document.head.appendChild(script);
})();
