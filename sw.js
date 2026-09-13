// Service Worker – Bautagesbericht PWA
// Ermöglicht Offline-Nutzung durch Caching

var CACHE_NAME = 'bautagesbericht-v1';
var ASSETS = [
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Installation: alle Assets cachen
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching assets');
      // jsPDF separat cachen (externe URL kann fehlschlagen)
      return cache.addAll(['./index.html', './manifest.json'])
        .then(function() {
          return cache.add('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
            .catch(function() { console.log('[SW] jsPDF cache failed – wird online geladen'); });
        });
    })
  );
  self.skipWaiting();
});

// Aktivierung: alte Caches löschen
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-First für eigene Dateien, Network-First für externe
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // IndexedDB-Zugriffe und API-Calls nicht abfangen
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // Im Cache gefunden – direkt liefern, im Hintergrund aktualisieren
        var fetchPromise = fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, clone);
            });
          }
          return response;
        }).catch(function() { return cached; });

        return cached; // Sofort aus Cache liefern
      }

      // Nicht im Cache – Netzwerk versuchen, bei Fehler Fallback
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
        return response;
      }).catch(function() {
        // Offline-Fallback für HTML-Seiten
        if (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
