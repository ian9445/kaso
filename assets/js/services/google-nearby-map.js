const PIN_COLORS = {
  food: { background: "#e1ff00", border: "#111111", glyph: "#111111" },
  cafe: { background: "#ff9f1c", border: "#111111", glyph: "#111111" },
  essentials: { background: "#2f5fd0", border: "#111111", glyph: "#ffffff" },
  shopping: { background: "#7656c9", border: "#111111", glyph: "#ffffff" },
  services: { background: "#15845b", border: "#111111", glyph: "#ffffff" },
};

function directionsUrl(shop) {
  if (shop.googleMapsUrl) return shop.googleMapsUrl;
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    destination: `${shop.lat},${shop.lon}`,
    travelmode: "walking",
  });
  return url.href;
}

function infoContent(shop, documentRef) {
  const container = documentRef.createElement("div");
  container.className = "nearby-map-popup nearby-google-popup";
  if (shop.photoUrl) {
    const image = documentRef.createElement("img");
    image.src = shop.photoUrl;
    image.alt = `${shop.name}的 Google Maps 店家照片`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer-when-downgrade";
    image.addEventListener("error", () => image.remove(), { once: true });
    container.append(image);
    const credit = documentRef.createElement("small");
    credit.className = "nearby-google-photo-credit";
    credit.append("相片：");
    const authors = Array.isArray(shop.photoAttributions) ? shop.photoAttributions : [];
    if (!authors.length) credit.append("Google Maps 使用者");
    authors.forEach((author, index) => {
      if (index) credit.append("、");
      if (author.uri) {
        const authorLink = documentRef.createElement("a");
        authorLink.href = author.uri;
        authorLink.target = "_blank";
        authorLink.rel = "noopener noreferrer";
        authorLink.textContent = author.displayName;
        credit.append(authorLink);
      } else {
        credit.append(author.displayName);
      }
    });
    container.append(credit);
  }
  const title = documentRef.createElement("strong");
  title.textContent = shop.name;
  const detail = documentRef.createElement("span");
  detail.textContent = `${shop.type}・約 ${Math.max(1, Math.round(shop.distance)).toLocaleString("zh-TW")} 公尺`;
  const link = documentRef.createElement("a");
  link.href = directionsUrl(shop);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "在 Google 地圖查看";
  container.append(title, detail, link);
  return container;
}

export async function createGoogleNearbyMap(maps, element, {
  center,
  mapId,
  onSelect,
  documentRef = globalThis.document,
} = {}) {
  const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }, { LatLngBounds }] = await Promise.all([
    maps.importLibrary("maps"),
    maps.importLibrary("marker"),
    maps.importLibrary("core"),
  ]);
  const initial = {
    lat: Number.isFinite(center?.lat) ? center.lat : 23.6978,
    lng: Number.isFinite(center?.lon) ? center.lon : 120.9605,
  };
  const map = new Map(element, {
    center: initial,
    zoom: Number.isFinite(center?.zoom) ? center.zoom : 7,
    mapId: mapId || "DEMO_MAP_ID",
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    clickableIcons: false,
    gestureHandling: "cooperative",
  });
  const infoWindow = new InfoWindow();
  const mapListeners = [];
  let markers = [];
  let centerMarker = null;
  let searchCenter = { lat: initial.lat, lon: initial.lng };

  mapListeners.push(map.addListener("click", (event) => {
    const lat = event.latLng?.lat();
    const lon = event.latLng?.lng();
    if (Number.isFinite(lat) && Number.isFinite(lon)) onSelect?.({ lat, lon });
  }));

  function detachMarkers() {
    for (const marker of markers) marker.map = null;
    markers = [];
  }

  return {
    setHint(nextCenter) {
      searchCenter = { lat: nextCenter.lat, lon: nextCenter.lon };
      map.setCenter({ lat: nextCenter.lat, lng: nextCenter.lon });
      map.setZoom(nextCenter.zoom || 12);
    },
    setCenter(position, label = "搜尋中心") {
      searchCenter = { lat: position.lat, lon: position.lon };
      if (centerMarker) centerMarker.map = null;
      const pin = new PinElement({
        glyph: "●",
        background: "#2f5fd0",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.15,
      });
      centerMarker = new AdvancedMarkerElement({
        map,
        position: { lat: position.lat, lng: position.lon },
        title: label,
        content: pin.element,
        zIndex: 1000,
      });
      map.setCenter({ lat: position.lat, lng: position.lon });
      map.setZoom(Math.max(Number(map.getZoom()) || 0, 15));
    },
    setShops(shops) {
      infoWindow.close();
      detachMarkers();
      const bounds = new LatLngBounds();
      bounds.extend({ lat: searchCenter.lat, lng: searchCenter.lon });
      shops.forEach((shop, index) => {
        const colors = PIN_COLORS[shop.category] || PIN_COLORS.shopping;
        const pin = new PinElement({
          glyph: String(index + 1),
          background: colors.background,
          borderColor: colors.border,
          glyphColor: colors.glyph,
          scale: 1.05,
        });
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: shop.lat, lng: shop.lon },
          title: `${shop.name}，${shop.type}，約 ${Math.max(1, Math.round(shop.distance))} 公尺`,
          content: pin.element,
          gmpClickable: true,
        });
        const openDetails = () => {
          infoWindow.setContent(infoContent(shop, documentRef));
          infoWindow.open({ map, anchor: marker });
        };
        if (typeof marker.addEventListener === "function") marker.addEventListener("gmp-click", openDetails);
        else marker.addListener("click", openDetails);
        markers.push(marker);
        bounds.extend({ lat: shop.lat, lng: shop.lon });
      });
      if (shops.length) map.fitBounds(bounds, 48);
    },
    getCenter() {
      const value = map.getCenter();
      return { lat: value.lat(), lon: value.lng() };
    },
    invalidate() {},
    destroy() {
      infoWindow.close();
      detachMarkers();
      if (centerMarker) centerMarker.map = null;
      for (const listener of mapListeners) listener.remove?.();
      maps.event?.clearInstanceListeners?.(map);
    },
  };
}
