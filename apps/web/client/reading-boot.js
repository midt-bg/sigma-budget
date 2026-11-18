// Restore reading preferences and load their local styles before paint.
try {
  if (!location.pathname.startsWith('/embed/')) {
    var styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = '/css/accessibility.css';
    styles.setAttribute('blocking', 'render');
    document.head.append(styles);
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
            !link.href.endsWith('/css/accessibility.css') &&
            link.sheet
          )
            link.sheet.disabled = true;
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
