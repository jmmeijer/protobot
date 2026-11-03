interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}
let pending: InstallPrompt | undefined;
function updateButton() {
  const button = document.querySelector<HTMLButtonElement>('[data-install]');
  if (button) button.hidden = !pending;
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pending = event as InstallPrompt;
  updateButton();
});
window.addEventListener('appinstalled', () => {
  pending = undefined;
  updateButton();
});
export function installButton(): string {
  return '<button type="button" class="btn" data-install' + (pending ? '' : ' hidden') + '>Installeer ProtoBot</button>';
}
document.addEventListener('click', async event => {
  if (!(event.target instanceof Element) || !event.target.closest('[data-install]') || !pending) return;
  const prompt = pending;
  pending = undefined;
  updateButton();
  try { await prompt.prompt(); } catch (error) { console.warn('Installeren is niet gelukt.', error); }
});
