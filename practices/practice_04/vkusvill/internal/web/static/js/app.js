/**
 * VkusVill Radar — Interactive Map & Shop Explorer Logic
 *
 * Both the map and the sidebar list are fed from the same accumulated dataset
 * (`allShops`), which grows while the server warms the catalog. There is no
 * pagination: the list filters the accumulated set on the client.
 */

(function () {
  let map = null;
  let markersGroup = null;
  let userMarker = null;

  const markersById = new Map();
  const allShops = new Map(); // id -> shop point
  const renderedIds = new Set(); // ids currently shown in the list
  let shopIcon = null;
  let lastFilterKey = null;
  let warmStats = null;

  const MAX_CARDS = 500;

  // ---------------------------------------------------------------- Map -----

  function initMap() {
    const defaultCenter = [55.7558, 37.6173]; // Moscow center
    const defaultZoom = 11;

    map = L.map('map', {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: true,
      // Hide attribution control per request
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
    });
    map.addLayer(markersGroup);

    shopIcon = L.divIcon({
      className: 'custom-vv-marker',
      html: `<div class="vv-map-pin"><span class="vv-map-pin-inner">ВВ</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -32],
    });
  }

  function updateMarkerCount() {
    const countEl = document.getElementById('markers-count');
    if (countEl) {
      countEl.textContent = `Маркеров на карте: ${markersById.size}`;
    }
  }

  // Add markers without clearing existing ones, so the map grows as the
  // background warm-up fills the cache.
  function addMarkers(points, fit) {
    if (!map || !markersGroup || !Array.isArray(points)) return 0;

    let added = 0;
    points.forEach((shop) => {
      if (!shop || !shop.lat || !shop.lon) return;
      if (markersById.has(shop.id)) return;

      const marker = L.marker([shop.lat, shop.lon], { icon: shopIcon });
      marker.bindPopup(buildPopup(shop));
      marker.on('click', () => highlightShopCard(shop.id));

      markersGroup.addLayer(marker);
      markersById.set(shop.id, marker);
      added++;
    });

    if (fit && added > 0) {
      const bounds = markersGroup.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

    updateMarkerCount();
    return added;
  }

  function buildPopup(shop) {
    let subwayHtml = '';
    if (shop.subway && shop.subway.length > 0) {
      const names = shop.subway.map((s) => s.name).join(', ');
      subwayHtml = `
        <div style="font-size: 11px; color: #2563eb; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
          <span>🚇</span> <span>${names}</span>
        </div>`;
    }

    let ratingHtml = '';
    if (shop.rating && shop.rating > 0) {
      ratingHtml = `
        <div style="display: flex; align-items: center; gap: 4px; background: #fffbeb; border: 1px solid #fde68a; padding: 2px 6px; border-radius: 6px; font-weight: bold; font-size: 11px; color: #92400e;">
          ⭐ ${shop.rating.toFixed(1)}
        </div>`;
    }

    let featuresHtml = '';
    if (shop.features && shop.features.length > 0) {
      const tags = shop.features.slice(0, 4).map((f) => `<span style="background: #f1f5f9; color: #475569; padding: 2px 5px; border-radius: 4px; font-size: 10px;">${f.name}</span>`).join(' ');
      featuresHtml = `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px;">${tags}</div>`;
    }

    return `
      <div style="padding: 12px; font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 280px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="background: #008248; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">ВкусВилл</span>
          ${ratingHtml}
        </div>
        <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 6px; line-height: 1.3;">
          ${shop.address}
        </div>
        ${subwayHtml}
        <div style="font-size: 11px; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #22c55e;"></span>
          <span>${shop.schedule || 'Ежедневно'}</span>
        </div>
        ${featuresHtml}
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; gap: 6px;">
          <a href="https://yandex.ru/maps/?rtext=~${shop.lat},${shop.lon}" target="_blank" rel="noopener"
             style="flex: 1; text-align: center; background: #f0fdf4; color: #008248; border: 1px solid #bbf7d0; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none;">
            Маршрут
          </a>
        </div>
      </div>
    `;
  }

  function highlightShopCard(shopId) {
    document.querySelectorAll('.shop-card').forEach((el) => el.classList.remove('is-selected'));
    const card = document.getElementById(`shop-item-${shopId}`);
    if (card) {
      card.classList.add('is-selected');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  window.focusShop = function (shopId, lat, lon) {
    highlightShopCard(shopId);

    if (map && lat && lon) {
      map.flyTo([lat, lon], 16, { animate: true, duration: 0.8 });

      const marker = markersById.get(shopId);
      if (marker) {
        setTimeout(() => {
          markersGroup.zoomToShowLayer(marker, () => {
            marker.openPopup();
          });
        }, 400);
      }
    }
  };

  window.resetMapView = function () {
    if (markersGroup && markersGroup.getLayers().length > 0) {
      map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
    }
  };

  // --------------------------------------------------------------- List -----

  function currentFilters() {
    const city = parseInt(document.getElementById('city-select')?.value || '0', 10) || 0;
    const feature = parseInt(document.getElementById('filter-feature-id')?.value || '0', 10) || 0;
    const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    const lat = parseFloat(document.getElementById('filter-lat')?.value || '');
    const lon = parseFloat(document.getElementById('filter-lon')?.value || '');
    return { city, feature, q, lat: Number.isFinite(lat) ? lat : 0, lon: Number.isFinite(lon) ? lon : 0 };
  }

  function filterKey(f) {
    return `${f.city}|${f.feature}|${f.q}|${f.lat}|${f.lon}`;
  }

  function shopMatches(shop, f) {
    if (f.city && shop.city_id !== f.city) return false;
    if (f.feature && !(shop.features || []).some((x) => x.id === f.feature)) return false;
    if (f.q) {
      const inAddress = (shop.address || '').toLowerCase().includes(f.q);
      const inSubway = (shop.subway || []).some((s) => (s.name || '').toLowerCase().includes(f.q));
      if (!inAddress && !inSubway) return false;
    }
    return true;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km) {
    return km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`;
  }

  // Recompute the ordered list for the active filters.
  function arrangedShops(f) {
    const matched = [];
    for (const shop of allShops.values()) {
      if (shopMatches(shop, f)) matched.push(shop);
    }
    if (f.lat && f.lon) {
      matched.sort((a, b) => haversineKm(f.lat, f.lon, a.lat, a.lon) - haversineKm(f.lat, f.lon, b.lat, b.lon));
    }
    return matched;
  }

  function buildCardHtml(shop, f) {
    const price = f.lat && f.lon ? formatDistance(haversineKm(f.lat, f.lon, shop.lat, shop.lon)) : '';

    const distanceHtml = price
      ? `<span class="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">${price}</span>`
      : '';

    const subwayHtml = shop.subway && shop.subway.length
      ? `<p class="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
           <svg class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
           </svg>
           <span class="truncate">${shop.subway.map((s) => s.name).join(', ')}</span>
         </p>`
      : '';

    const ratingHtml = shop.rating > 0
      ? `<div class="flex items-center gap-1 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-lg flex-shrink-0">
           <svg class="w-3.5 h-3.5 text-amber-500 fill-amber-400" aria-hidden="true" viewBox="0 0 20 20">
             <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
           </svg>
           <span class="text-xs font-bold text-amber-900">${shop.rating.toFixed(1)}</span>
         </div>`
      : '';

    const featuresHtml = shop.features && shop.features.length
      ? `<div class="mt-2 flex flex-wrap gap-1">${shop.features
          .map((ft) => `<span class="inline-flex items-center text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${ft.name}</span>`)
          .join('')}</div>`
      : '';

    const cityName = shop.city || 'ВкусВилл';

    return `<div class="shop-card group bg-white rounded-xl p-4 border border-slate-200 hover:border-emerald-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all duration-200 cursor-pointer relative"
       id="shop-item-${shop.id}"
       data-shop-id="${shop.id}"
       onclick="window.focusShop(${shop.id}, ${shop.lat}, ${shop.lon})"
       onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.focusShop(${shop.id}, ${shop.lat}, ${shop.lon});}"
       tabindex="0"
       role="button"
       aria-label="Магазин ВкусВилл: ${shop.address}">
  <div class="flex items-start justify-between gap-3">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <svg class="w-3 h-3 text-emerald-600" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
          </svg>
          ${cityName}
        </span>
        ${distanceHtml}
      </div>
      <h3 class="mt-1.5 font-semibold text-slate-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2">${shop.address}</h3>
      ${subwayHtml}
    </div>
    ${ratingHtml}
  </div>
  <div class="mt-2.5 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
    <div class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span class="truncate">${shop.schedule || ''}</span>
    </div>
    <div class="flex items-center gap-2">
      <a href="https://yandex.ru/maps/?rtext=~${shop.lat},${shop.lon}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="Маршрут в Яндекс.Картах" class="text-slate-400 hover:text-emerald-600 transition-colors p-1" aria-label="Построить маршрут в Яндекс.Картах">
        <svg class="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
        </svg>
      </a>
    </div>
  </div>
  ${featuresHtml}
</div>`;
  }

  function emptyHtml() {
    return `<div class="py-12 text-center text-slate-500">
      <svg class="mx-auto w-12 h-12 text-slate-300 mb-3" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
      </svg>
      <p class="font-medium text-slate-700">Ничего не найдено</p>
      <p class="text-xs text-slate-400 mt-1">Измените фильтры или подождите загрузку каталога</p>
    </div>`;
  }

  function updateHeader(shown, total) {
    const countEl = document.getElementById('shops-count');
    if (countEl) countEl.textContent = String(total);

    const progressEl = document.getElementById('shops-progress');
    if (!progressEl) return;
    if (total > shown) {
      progressEl.textContent = `показано ${shown} из ${total}`;
    } else if (warmStats && !warmStats.done) {
      progressEl.textContent = 'загрузка…';
    } else {
      progressEl.textContent = '';
    }
  }

  // Full re-render for the current filter set.
  function renderListFull(f) {
    const container = document.getElementById('shops-cards');
    if (!container) return;

    const matched = arrangedShops(f);
    const shown = matched.slice(0, MAX_CARDS);

    renderedIds.clear();
    if (shown.length === 0) {
      container.innerHTML = emptyHtml();
    } else {
      container.innerHTML = shown.map((s) => buildCardHtml(s, f)).join('');
      shown.forEach((s) => renderedIds.add(s.id));
    }
    updateHeader(shown.length, matched.length);
  }

  // Append newly arrived shops without rebuilding (keeps scroll position).
  function appendNew(f) {
    const container = document.getElementById('shops-cards');
    if (!container) return;
    // Distance sorting is order-sensitive, so skip incremental appends then.
    if (f.lat && f.lon) return;

    if (!container.querySelector('.shop-card')) container.innerHTML = '';

    let added = 0;
    for (const shop of allShops.values()) {
      if (renderedIds.size >= MAX_CARDS) break;
      if (renderedIds.has(shop.id) || !shopMatches(shop, f)) continue;
      container.insertAdjacentHTML('beforeend', buildCardHtml(shop, f));
      renderedIds.add(shop.id);
      added++;
    }

    if (added > 0) {
      const matched = arrangedShops(f).length;
      updateHeader(renderedIds.size, matched);
    }
  }

  function renderList(force) {
    const f = currentFilters();
    const key = filterKey(f);
    if (force || key !== lastFilterKey) {
      lastFilterKey = key;
      renderListFull(f);
    } else {
      appendNew(f);
    }
  }

  let searchTimer = null;
  function wireFilterEvents() {
    const form = document.getElementById('filter-form');
    if (!form) return;

    const search = document.getElementById('search-input');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderList(true), 300);
      });
    }

    const city = document.getElementById('city-select');
    if (city) city.addEventListener('change', () => renderList(true));
  }

  window.toggleFeature = function (featureId) {
    const input = document.getElementById('filter-feature-id');
    if (input) input.value = String(featureId);
    renderList(true);
  };

  window.resetFilters = function () {
    const search = document.getElementById('search-input');
    const city = document.getElementById('city-select');
    const feat = document.getElementById('filter-feature-id');
    const lat = document.getElementById('filter-lat');
    const lon = document.getElementById('filter-lon');

    if (search) search.value = '';
    if (city) city.value = '0';
    if (feat) feat.value = '0';
    if (lat) lat.value = '';
    if (lon) lon.value = '';

    if (userMarker && map) {
      map.removeLayer(userMarker);
      userMarker = null;
    }

    renderList(true);
  };

  window.locateUser = function () {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    const geoBtn = document.getElementById('geo-btn');
    if (geoBtn) geoBtn.classList.add('animate-pulse');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (geoBtn) geoBtn.classList.remove('animate-pulse');
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;

        document.getElementById('filter-lat').value = userLat;
        document.getElementById('filter-lon').value = userLon;

        if (userMarker) {
          userMarker.setLatLng([userLat, userLon]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-geo-pin',
            html: '<div class="user-location-marker"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          userMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(map);
          userMarker.bindPopup('<b>Вы здесь</b>');
        }

        map.flyTo([userLat, userLon], 14);
        renderList(true);
      },
      (err) => {
        if (geoBtn) geoBtn.classList.remove('animate-pulse');
        alert('Не удалось получить ваше местоположение: ' + err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // -------------------------------------------------------- Network sync ----

  // Poll the accumulated dataset so both the map and the list grow while the
  // server warms the catalog. Stops once the server reports done.
  function startNetworkSync() {
    let fitted = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/shops/points?scope=all');
        if (!res.ok) return;

        const payload = await res.json();
        const points = Array.isArray(payload) ? payload : payload.points || [];
        warmStats = payload && payload.stats ? payload.stats : warmStats;

        const wasEmpty = markersById.size === 0;
        points.forEach((shop) => allShops.set(shop.id, shop));

        addMarkers(points, !fitted && wasEmpty);
        if (markersById.size > 0) fitted = true;

        renderList(false);

        if (warmStats && warmStats.done) clearInterval(timer);
      } catch (err) {
        // Network hiccups are non-fatal; the next tick retries.
      }
    };

    const timer = setInterval(tick, 5000);
    tick();
  }

  // --------------------------------------------------------------- Init -----

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    wireFilterEvents();
    renderList(true); // show the empty/loading state until data arrives
    startNetworkSync();
  });
})();
