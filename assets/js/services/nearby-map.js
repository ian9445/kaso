import { escapeAttr, escapeHtml } from "../utils.js";

const TAIWAN_CENTER = { lat: 23.6978, lon: 120.9605, zoom: 7 };
const CATEGORY_CLASSES = new Set(["food", "cafe", "essentials", "shopping", "services"]);
let libraryPromise;

export { TAIWAN_CENTER };

export function loadLeaflet({
  documentRef = globalThis.document,
  importer = (url) => import(url),
} = {}) {
  const cssUrl = new URL("../../vendor/leaflet/leaflet.css", import.meta.url).href;
  const moduleUrl = new URL("../../vendor/leaflet/leaflet-src.esm.js", import.meta.url).href;
  if (documentRef && !documentRef.querySelector("link[data-kaso-leaflet]")) {
    const link = documentRef.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.dataset.kasoLeaflet = "";
    documentRef.head.append(link);
  }
  if (!libraryPromise) {
    libraryPromise = importer(moduleUrl).catch((error) => {
      libraryPromise = null;
      throw error;
    });
  }
  return libraryPromise;
}

function googleDirectionsUrl(shop) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${shop.lat},${shop.lon}`,
    travelmode: "walking",
  });
  return url.href;
}

function markerPopup(shop) {
  return `<div class="nearby-map-popup">
    <strong>${escapeHtml(shop.name)}</strong>
    <span>${escapeHtml(shop.type)}・約 ${Math.max(1, Math.round(shop.distance)).toLocaleString("zh-TW")} 公尺</span>
    <a href="${escapeAttr(googleDirectionsUrl(shop))}" target="_blank" rel="noopener noreferrer">Google 地圖導航</a>
  </div>`;
}

export function createNearbyMap(L, element, { center = TAIWAN_CENTER, onSelect } = {}) {
  const initial = {
    lat: Number.isFinite(center?.lat) ? center.lat : TAIWAN_CENTER.lat,
    lon: Number.isFinite(center?.lon) ? center.lon : TAIWAN_CENTER.lon,
    zoom: Number.isFinite(center?.zoom) ? center.zoom : TAIWAN_CENTER.zoom,
  };
  const map = L.map(element, { zoomControl: true }).setView([initial.lat, initial.lon], initial.zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);

  const centerLayer = L.layerGroup().addTo(map);
  const shopLayer = L.layerGroup().addTo(map);
  let searchCenter = { lat: initial.lat, lon: initial.lon };

  map.on("click", (event) => {
    onSelect?.({ lat: event.latlng.lat, lon: event.latlng.lng });
  });

  return {
    setHint(nextCenter) {
      searchCenter = { lat: nextCenter.lat, lon: nextCenter.lon };
      map.setView([nextCenter.lat, nextCenter.lon], nextCenter.zoom || 12, { animate: false });
    },
    setCenter(position, label = "搜尋中心") {
      searchCenter = { lat: position.lat, lon: position.lon };
      centerLayer.clearLayers();
      L.circleMarker([position.lat, position.lon], {
        radius: 9,
        color: "#ffffff",
        weight: 4,
        fillColor: "#2f5fd0",
        fillOpacity: 1,
      }).addTo(centerLayer).bindTooltip(escapeHtml(label), {
        permanent: true,
        direction: "right",
        className: "nearby-center-label",
        offset: [9, 0],
      });
      map.setView([position.lat, position.lon], Math.max(map.getZoom(), 15), { animate: false });
    },
    setShops(shops) {
      shopLayer.clearLayers();
      const points = [[searchCenter.lat, searchCenter.lon]];
      shops.forEach((shop, index) => {
        const category = CATEGORY_CLASSES.has(shop.category) ? shop.category : "shopping";
        const marker = L.marker([shop.lat, shop.lon], {
          keyboard: true,
          title: shop.name,
          alt: `${shop.name}，${shop.type}，約 ${Math.max(1, Math.round(shop.distance))} 公尺`,
          icon: L.divIcon({
            className: "nearby-map-pin-wrap",
            html: `<span class="nearby-map-pin map-pin-${category}">${index + 1}</span>`,
            iconSize: [34, 40],
            iconAnchor: [17, 40],
            popupAnchor: [0, -36],
          }),
        });
        marker.bindPopup(markerPopup(shop), { maxWidth: 260 }).addTo(shopLayer);
        points.push([shop.lat, shop.lon]);
      });
      if (shops.length) {
        map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 16, animate: false });
      }
    },
    getCenter() {
      const value = map.getCenter();
      return { lat: value.lat, lon: value.lng };
    },
    invalidate() {
      map.invalidateSize(false);
    },
    destroy() {
      map.off();
      map.remove();
    },
  };
}
