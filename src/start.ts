import './install';
import { prepareStorage } from './storage';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      .catch(error => console.warn('Offline laden is niet beschikbaar.', error));
  });
}
void prepareStorage().then(() => import('./main'));
