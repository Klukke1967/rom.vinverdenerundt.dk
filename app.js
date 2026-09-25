/**
 * Rom Bykort & Guide - App Logic
 * Håndterer Leaflet kort, data fetch, filtrering, søgning, hover preview-bokse og modal.
 */

// Konfiguration & Tilstand
const STATE = {
  places: [],
  filteredPlaces: [],
  selectedCategory: 'all',
  searchQuery: '',
  activePlaceId: null,
  markers: {},
  map: null
};

// Kategori Metadata: Navne, ikoner og badge-klasser
const CATEGORY_META = {
  rooftop: { label: 'Rooftop Bar', icon: '🍸', badgeClass: 'cat-rooftop', markerClass: 'marker-rooftop' },
  viral: { label: 'TikTok & Insta', icon: '📸', badgeClass: 'cat-viral', markerClass: 'marker-viral' },
  restaurant: { label: 'Spisested', icon: '🍝', badgeClass: 'cat-restaurant', markerClass: 'marker-restaurant' },
  winebar: { label: 'Vinbar', icon: '🍷', badgeClass: 'cat-winebar', markerClass: 'marker-winebar' },
  sight: { label: 'Seværdighed', icon: '🏛️', badgeClass: 'cat-sight', markerClass: 'marker-sight' },
  gelato: { label: 'Gelato', icon: '🍨', badgeClass: 'cat-gelato', markerClass: 'marker-gelato' },
  cafe: { label: 'Café & Bagværk', icon: '☕', badgeClass: 'cat-cafe', markerClass: 'marker-cafe' },
  hotel: { label: 'Hotel Base', icon: '🏨', badgeClass: 'cat-hotel', markerClass: 'marker-hotel' }
};

// DOM Elementer
const DOM = {
  placesList: document.getElementById('places-list'),
  searchInput: document.getElementById('search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  filterChips: document.querySelectorAll('.filter-chip'),
  totalCountPill: document.getElementById('total-count-pill'),
  mobileListCount: document.getElementById('mobile-list-count'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalBody: document.getElementById('modal-body'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  sidebar: document.getElementById('sidebar'),
  btnShowMap: document.getElementById('btn-show-map'),
  btnShowList: document.getElementById('btn-show-list'),
  resetViewBtn: document.getElementById('reset-view-btn'),
  focusHotelBtn: document.getElementById('focus-hotel-btn')
};

/**
 * Initialiserer Leaflet kort med 100% gratis fliser (ingen API-nøgle eller vandmærker)
 */
function initMap() {
  const ROME_CENTER = [41.8960, 12.4820];
  
  STATE.map = L.map('map', {
    center: ROME_CENTER,
    zoom: 13,
    zoomControl: false
  });

  // Tilføj zoom kontrol øverst til venstre
  L.control.zoom({ position: 'topleft' }).addTo(STATE.map);

  // 100% Gratis kortlag uden krav om API-nøgle eller vandmærker
  const osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bidragydere, Tiles af <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'
  });

  const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bidragydere'
  });

  const esriGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  });

  // Sæt varmt OSM Hot kort som standard
  osmHot.addTo(STATE.map);

  // Lagvælger øverst til højre
  const baseMaps = {
    "Varmt Bykort (OSM Hot)": osmHot,
    "Klassisk OpenStreetMap": osmStandard,
    "Minimalistisk Grå (Esri)": esriGray
  };
  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(STATE.map);
}

/**
 * Henter locations.json asynkront
 */
async function loadLocations() {
  try {
    const response = await fetch('locations.json');
    if (!response.ok) throw new Error(`HTTP fejl: ${response.status}`);
    const data = await response.json();
    STATE.places = data;
    STATE.filteredPlaces = [...data];

    updateCounts();
    renderMarkers();
    renderList();
  } catch (error) {
    console.error('Fejl ved indlæsning af steder:', error);
    DOM.placesList.innerHTML = `
      <div class="empty-state">
        <p>⚠️ Kunne ikke hente locations.json (${error.message}).</p>
      </div>
    `;
  }
}

/**
 * Opretter tilpassede HTML markører og interaktive hover-bokse
 */
function renderMarkers() {
  // Ryd eksisterende markører
  Object.values(STATE.markers).forEach(m => STATE.map.removeLayer(m));
  STATE.markers = {};

  STATE.filteredPlaces.forEach(place => {
    const meta = CATEGORY_META[place.category] || { icon: '📍', markerClass: 'marker-winebar' };
    const isHotel = place.isHotel;

    // Custom Leaflet DivIcon
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="custom-marker ${meta.markerClass} ${isHotel ? 'marker-hotel' : ''}" id="marker-${place.id}">
          <span>${meta.icon}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });

    const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(STATE.map);

    // Dybde-links til navigation apps
    const googleMapsNav = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    const appleMapsNav = `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`;

    // Interaktiv Hover Boks (Leaflet Tooltip)
    const hoverHtml = `
      <div class="hover-card">
        <div class="hover-header">
          <span class="cat-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
          ${isHotel ? '<span class="cat-badge cat-hotel">⭐ Hovedbase</span>' : ''}
        </div>
        <h3 class="hover-title">${place.name}</h3>
        <p class="hover-desc">${place.shortDesc}</p>
        ${place.tiktokNote ? `<div class="hover-viral">🔥 ${place.tiktokNote}</div>` : ''}
        <div class="hover-actions">
          <a href="${googleMapsNav}" target="_blank" rel="noopener noreferrer" class="hover-btn hover-btn-google" onclick="event.stopPropagation()">
            <span>🗺️ Google Maps</span>
          </a>
          <a href="${appleMapsNav}" target="_blank" rel="noopener noreferrer" class="hover-btn hover-btn-apple" onclick="event.stopPropagation()">
            <span>🧭 Apple Maps</span>
          </a>
        </div>
      </div>
    `;

    marker.bindTooltip(hoverHtml, {
      direction: 'top',
      offset: [0, -18],
      className: 'custom-hover-tooltip',
      interactive: true,
      opacity: 1
    });

    // Klik på markør åbner fuld detaljemodal
    marker.on('click', () => {
      openModal(place);
      highlightCard(place.id);
    });

    STATE.markers[place.id] = marker;
  });
}

/**
 * Viser listen af steder i sidebaren
 */
function renderList() {
  if (STATE.filteredPlaces.length === 0) {
    DOM.placesList.innerHTML = `
      <div class="empty-state">
        <span style="font-size: 32px;">🔍</span>
        <p>Ingen steder matchede din filtrering eller søgning.</p>
        <button class="fab-btn" onclick="resetFilters()" style="margin-top: 8px;">Nulstil filtre</button>
      </div>
    `;
    return;
  }

  DOM.placesList.innerHTML = STATE.filteredPlaces.map(place => {
    const meta = CATEGORY_META[place.category] || { label: place.category, icon: '📍', badgeClass: 'cat-winebar' };
    const pillsHtml = (place.pills || []).map(p => `<span class="pill">${p}</span>`).join('');
    const googleMapsNav = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

    return `
      <article class="place-card ${place.isHotel ? 'hotel-card' : ''}" id="card-${place.id}" 
               onclick="selectPlace('${place.id}')"
               onmouseenter="previewMarker('${place.id}')"
               onmouseleave="unpreviewMarker('${place.id}')">
        <div class="card-top">
          <h2 class="card-title">${place.name}</h2>
          <span class="cat-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
        </div>
        <p class="card-desc">${place.shortDesc}</p>
        ${place.tiktokNote ? `<div class="hover-viral" style="margin-top: 4px;">🔥 ${place.tiktokNote}</div>` : ''}
        ${pillsHtml ? `<div class="card-pills">${pillsHtml}</div>` : ''}
        <div class="card-footer">
          <span>📍 ${place.address || 'Rom, Italien'}</span>
          <span class="card-action-link">Se detaljer & rute →</span>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Åbner hover tooltip på kortet når man peger på et kort i sidebaren
 */
function previewMarker(placeId) {
  const marker = STATE.markers[placeId];
  if (marker) {
    marker.openTooltip();
  }
}

function unpreviewMarker(placeId) {
  const marker = STATE.markers[placeId];
  if (marker) {
    marker.closeTooltip();
  }
}

/**
 * Opdaterer tællere i filterchips og topbar
 */
function updateCounts() {
  const counts = { all: STATE.places.length };
  Object.keys(CATEGORY_META).forEach(cat => {
    counts[cat] = STATE.places.filter(p => p.category === cat).length;
  });

  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = counts.all;

  Object.keys(CATEGORY_META).forEach(cat => {
    const el = document.getElementById(`count-${cat}`);
    if (el) el.textContent = counts[cat] || 0;
  });

  const activeCount = STATE.filteredPlaces.length;
  DOM.totalCountPill.textContent = `${activeCount} af ${STATE.places.length} steder`;
  DOM.mobileListCount.textContent = activeCount;
}

/**
 * Filtrerer steder baseret på aktiv kategori og søgetekst
 */
function applyFilters() {
  const query = STATE.searchQuery.toLowerCase().trim();

  STATE.filteredPlaces = STATE.places.filter(place => {
    // Kategori filter
    const matchesCat = (STATE.selectedCategory === 'all') || (place.category === STATE.selectedCategory);
    if (!matchesCat) return false;

    // Søgefilter
    if (!query) return true;

    const nameMatch = place.name.toLowerCase().includes(query);
    const descMatch = (place.shortDesc || '').toLowerCase().includes(query);
    const tipsMatch = (place.tips || '').toLowerCase().includes(query);
    const addrMatch = (place.address || '').toLowerCase().includes(query);
    const viralMatch = (place.tiktokNote || '').toLowerCase().includes(query);
    const pillsMatch = (place.pills || []).some(p => p.toLowerCase().includes(query));

    return nameMatch || descMatch || tipsMatch || addrMatch || viralMatch || pillsMatch;
  });

  updateCounts();
  renderMarkers();
  renderList();
}

/**
 * Vælger et sted (fra listen eller kortet)
 */
function selectPlace(placeId) {
  const place = STATE.places.find(p => p.id === placeId);
  if (!place) return;

  STATE.activePlaceId = placeId;

  // Zoom og centrer på kortet
  STATE.map.flyTo([place.lat, place.lng], 16, {
    animate: true,
    duration: 0.8
  });

  highlightCard(placeId);
  openModal(place);

  // Luk sidebar på mobil så kortet/modalen ses
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove('mobile-open');
    DOM.btnShowMap.classList.add('active');
    DOM.btnShowList.classList.remove('active');
  }
}

/**
 * Fremhæver det aktive kort i listen
 */
function highlightCard(placeId) {
  document.querySelectorAll('.place-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`card-${placeId}`);
  if (card) {
    card.classList.add('active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Åbner detaljemodal med rig information, tips og dybe links til navigation
 */
function openModal(place) {
  const meta = CATEGORY_META[place.category] || { label: place.category, icon: '📍', badgeClass: 'cat-winebar' };
  const googleMapsNav = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const appleMapsNav = `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w`;
  const pillsHtml = (place.pills || []).map(p => `<span class="pill">${p}</span>`).join('');

  DOM.modalBody.innerHTML = `
    <div class="modal-header-meta">
      <span class="cat-badge ${meta.badgeClass}">${meta.icon} ${meta.label}</span>
      ${place.isHotel ? '<span class="cat-badge cat-hotel">⭐ Hovedbase</span>' : ''}
    </div>

    <h2 class="modal-title">${place.name}</h2>
    
    <div class="modal-address">
      <span>📍</span>
      <span>${place.address || 'Rom, Italien'}</span>
    </div>

    <p class="modal-desc">${place.shortDesc}</p>

    ${place.tiktokNote ? `
      <div class="hover-viral" style="margin-bottom: 16px; font-size: 0.85rem; padding: 8px 12px;">
        📸 <strong>TikTok / Insta Hotspot:</strong> ${place.tiktokNote}
      </div>
    ` : ''}

    ${place.tips ? `
      <div class="modal-tips-box ${place.isHotel ? 'hotel-tip' : ''}">
        <div class="tips-title">💡 Insidertip</div>
        <div class="tips-body">${place.tips}</div>
      </div>
    ` : ''}

    <div class="modal-info-grid">
      ${place.hours ? `
        <div class="info-row">
          <span class="info-label">🕒 Åbningstider:</span>
          <span class="info-value">${place.hours}</span>
        </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">📌 Kategori:</span>
        <span class="info-value">${meta.label}</span>
      </div>
    </div>

    ${pillsHtml ? `<div class="card-pills" style="margin-bottom: 24px;">${pillsHtml}</div>` : ''}

    <div class="modal-actions" style="flex-wrap: wrap;">
      <a href="${googleMapsNav}" target="_blank" rel="noopener noreferrer" class="btn-primary">
        <span>🗺️ Rute i Google Maps</span>
      </a>
      <a href="${appleMapsNav}" target="_blank" rel="noopener noreferrer" class="btn-secondary">
        <span>🧭 Rute i Apple Maps</span>
      </a>
    </div>
  `;

  DOM.modalBackdrop.classList.add('open');
}

/**
 * Lukker modal
 */
function closeModal() {
  DOM.modalBackdrop.classList.remove('open');
}

/**
 * Nulstiller alle filtre og søgning
 */
function resetFilters() {
  STATE.selectedCategory = 'all';
  STATE.searchQuery = '';
  DOM.searchInput.value = '';
  DOM.clearSearchBtn.style.display = 'none';

  DOM.filterChips.forEach(chip => {
    chip.classList.toggle('active', chip.dataset.category === 'all');
  });

  applyFilters();
}

/**
 * Event Listeners Opsætning
 */
function setupEventListeners() {
  // Filter chips klik
  DOM.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      DOM.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      STATE.selectedCategory = chip.dataset.category;
      applyFilters();
    });
  });

  // Søgefelt input
  DOM.searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    DOM.clearSearchBtn.style.display = STATE.searchQuery ? 'block' : 'none';
    applyFilters();
  });

  // Ryd søgning knap
  DOM.clearSearchBtn.addEventListener('click', () => {
    STATE.searchQuery = '';
    DOM.searchInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    applyFilters();
  });

  // Modal lukning
  DOM.modalCloseBtn.addEventListener('click', closeModal);
  DOM.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === DOM.modalBackdrop) closeModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Flydende knapper
  DOM.resetViewBtn.addEventListener('click', () => {
    STATE.map.flyTo([41.8960, 12.4820], 13);
  });

  DOM.focusHotelBtn.addEventListener('click', () => {
    const hotel = STATE.places.find(p => p.isHotel);
    if (hotel) {
      selectPlace(hotel.id);
    }
  });

  // Mobilnavigation
  DOM.btnShowMap.addEventListener('click', () => {
    DOM.btnShowMap.classList.add('active');
    DOM.btnShowList.classList.remove('active');
    DOM.sidebar.classList.remove('mobile-open');
    setTimeout(() => STATE.map.invalidateSize(), 200);
  });

  DOM.btnShowList.addEventListener('click', () => {
    DOM.btnShowList.classList.add('active');
    DOM.btnShowMap.classList.remove('active');
    DOM.sidebar.classList.add('mobile-open');
  });
}

// Opstart når DOM er klar
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  loadLocations();
});
