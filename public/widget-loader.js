(function () {
  var script = document.currentScript;
  var slug = script.getAttribute('data-business');
  if (!slug) {
    console.error('[Calenvo Widget] Atributo data-business não encontrado no <script>.');
    return;
  }

  var origin = new URL(script.src).origin;
  var position = script.getAttribute('data-position') === 'bottom-left' ? 'bottom-left' : 'bottom-right';

  var container = document.createElement('div');
  container.id = 'calenvo-widget-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style[position === 'bottom-left' ? 'left' : 'right'] = '20px';
  container.style.width = '64px';
  container.style.height = '64px';
  container.style.zIndex = '2147483647';
  container.style.transition = 'width 0.2s ease, height 0.2s ease';
  container.style.border = 'none';
  container.style.background = 'transparent';

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/widget/chat/' + encodeURIComponent(slug);
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.title = 'Chat de agendamento';
  iframe.setAttribute('allowtransparency', 'true');

  container.appendChild(iframe);
  document.body.appendChild(container);

  window.addEventListener('message', function (event) {
    if (event.source !== iframe.contentWindow) return;
    if (!event.data || event.data.type !== 'calenvo-widget-resize') return;

    if (event.data.open) {
      var isMobile = window.innerWidth < 640;
      container.style.width = isMobile ? '100vw' : '380px';
      container.style.height = isMobile ? '100vh' : '600px';
      if (isMobile) {
        container.style.bottom = '0';
        container.style[position === 'bottom-left' ? 'left' : 'right'] = '0';
      }
    } else {
      var closedWidth = event.data.width || 64;
      var closedHeight = event.data.height || 64;
      container.style.width = closedWidth + 'px';
      container.style.height = closedHeight + 'px';
      container.style.bottom = '20px';
      container.style[position === 'bottom-left' ? 'left' : 'right'] = '20px';
    }
  });
})();
