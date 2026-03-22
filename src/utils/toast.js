const DURATIONS = { success: 2000, warning: 3000, error: 4500 };

export function showToast(message, type = 'success') {
  const existing = document.getElementById('html-to-md-toast-host');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'html-to-md-toast-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;bottom:24px;right:24px;pointer-events:none;';

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}
    .toast{
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:14px;line-height:1.4;padding:12px 20px;border-radius:8px;
      color:#fff;pointer-events:auto;opacity:0;transform:translateY(12px);
      animation:toast-in .2s ease-out forwards;
      box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:360px;
    }
    .toast.success{background:#1a7f37}
    .toast.warning{background:#9a6700}
    .toast.error{background:#cf222e}
    .toast.dismiss{animation:toast-out .15s ease-in forwards}
    @keyframes toast-in{to{opacity:1;transform:translateY(0)}}
    @keyframes toast-out{to{opacity:0;transform:translateY(8px)}}
  `;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  shadow.appendChild(style);
  shadow.appendChild(toast);
  document.body.appendChild(host);

  setTimeout(() => {
    toast.classList.add('dismiss');
    toast.addEventListener('animationend', () => host.remove());
  }, DURATIONS[type] || 2000);
}
