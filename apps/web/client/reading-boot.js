// Apply reading preferences before paint. No network, inline script or CSP exception.
try {
  if (!location.pathname.startsWith('/embed/')) {
    for (var setting of [
      ['fontSize', 'font-resize'],
      ['dyslectic', 'dyslectic-font'],
      ['textOnly', 'a11y-textonly'],
    ]) {
      if (Number(localStorage.getItem('accesibility.' + setting[0])))
        document.documentElement.classList.add(setting[1]);
    }
    if (document.documentElement.classList.contains('a11y-textonly')) {
      document.addEventListener(
        'load',
        function (event) {
          if (!document.documentElement.classList.contains('a11y-textonly')) return;
          var link = event.target;
          if (
            link instanceof HTMLLinkElement &&
            link.rel === 'stylesheet' &&
            !link.href.endsWith('/css/accessibility.css')
          )
            link.disabled = true;
        },
        true,
      );
    }
    var contrast = localStorage.getItem('accesibility.theme');
    if (['yellow', 'dark', 'blue'].includes(contrast))
      document.documentElement.classList.add('accessibility-' + contrast);
  }
} catch {
  /* Reading preferences are optional when browser storage is unavailable. */
}
