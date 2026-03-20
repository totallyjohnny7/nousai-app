// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCPEpz40ixry6rdAYAmwzkGxlpKrLnXA64',
  authDomain: 'nousai-dc038.firebaseapp.com',
  projectId: 'nousai-dc038',
  storageBucket: 'nousai-dc038.firebasestorage.app',
  messagingSenderId: '1002222438616',
  appId: '1:1002222438616:web:9a8c4cc83fa7c603516fad',
});

const messaging = firebase.messaging();

// Handle background push messages (app closed or in background tab)
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'NousAI';
  const body = payload.notification?.body || '';
  const tag = payload.data?.tag || 'nousai-push';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    data: { url: 'https://studynous.com' },
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || 'https://studynous.com';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes('studynous.com') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
