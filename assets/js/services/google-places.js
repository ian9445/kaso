import { distanceMeters, NEARBY_RADIUS_METERS } from "./nearby.js";

export const GOOGLE_PLACE_CATEGORIES = [
  {
    id: "food",
    label: "餐廳／小吃",
    shortLabel: "餐飲",
    icon: "food",
    types: ["restaurant", "meal_takeaway", "fast_food_restaurant", "food_court"],
  },
  {
    id: "cafe",
    label: "咖啡／飲料／甜點",
    shortLabel: "咖啡甜點",
    icon: "food",
    types: ["cafe", "bakery", "dessert_shop", "ice_cream_shop", "tea_house"],
  },
  {
    id: "essentials",
    label: "便利商店／超市／藥局",
    shortLabel: "日常採買",
    icon: "cart",
    types: ["convenience_store", "supermarket", "grocery_store", "pharmacy", "drugstore"],
  },
  {
    id: "shopping",
    label: "百貨／服飾／3C／書店",
    shortLabel: "購物",
    icon: "cart",
    types: ["shopping_mall", "department_store", "clothing_store", "electronics_store", "book_store"],
  },
  {
    id: "services",
    label: "美容美髮／銀行／生活服務",
    shortLabel: "生活服務",
    icon: "cart",
    types: ["hair_care", "beauty_salon", "bank", "atm", "laundry"],
  },
];

export const MAX_GOOGLE_RESULTS = 20;

const CATEGORY_BY_ID = new Map(GOOGLE_PLACE_CATEGORIES.map((category) => [category.id, category]));
const CATEGORY_BY_TYPE = new Map(GOOGLE_PLACE_CATEGORIES.flatMap((category) => (
  category.types.map((type) => [type, category])
)));
let googleMapsPromise;

function failure(code, cause) {
  return Object.assign(new Error(code, cause ? { cause } : undefined), { code });
}

function textValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value?.text === "string") return value.text.trim();
  return "";
}

function coordinate(value, method) {
  const result = typeof value?.[method] === "function" ? value[method]() : value?.[method];
  return Number(result);
}

function httpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function placeCategory(place, selectedCategories) {
  const primaryType = typeof place.primaryType === "string" ? place.primaryType : "";
  if (CATEGORY_BY_TYPE.has(primaryType)) return CATEGORY_BY_TYPE.get(primaryType);
  for (const type of Array.isArray(place.types) ? place.types : []) {
    if (CATEGORY_BY_TYPE.has(type)) return CATEGORY_BY_TYPE.get(type);
  }
  return selectedCategories[0] || CATEGORY_BY_ID.get("shopping");
}

function photoDetails(place) {
  const photo = Array.isArray(place.photos) ? place.photos[0] : null;
  if (!photo || typeof photo.getURI !== "function") return { photoUrl: "", photoAttributions: [] };
  let photoUrl = "";
  try {
    photoUrl = httpsUrl(photo.getURI({ maxWidth: 640, maxHeight: 420 }));
  } catch {
    return { photoUrl: "", photoAttributions: [] };
  }
  const photoAttributions = (Array.isArray(photo.authorAttributions) ? photo.authorAttributions : [])
    .map((author) => ({
      displayName: textValue(author?.displayName) || "Google Maps 使用者",
      uri: httpsUrl(author?.uri),
    }))
    .slice(0, 3);
  return { photoUrl, photoAttributions };
}

export async function getGoogleMapsConfig({ fetcher = globalThis.fetch, signal } = {}) {
  try {
    const response = await fetcher("/api/maps-config", {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.available || typeof data.apiKey !== "string" || data.apiKey.length < 20) return null;
    return {
      apiKey: data.apiKey,
      mapId: typeof data.mapId === "string" ? data.mapId.slice(0, 120) : "",
    };
  } catch {
    return null;
  }
}

export function loadGoogleMaps({
  apiKey,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
} = {}) {
  if (windowRef?.google?.maps?.importLibrary) return Promise.resolve(windowRef.google.maps);
  if (!apiKey || !documentRef || !windowRef) return Promise.reject(failure("google_maps_unavailable"));
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = `__kasoGoogleMapsReady_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = documentRef.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      libraries: "maps,marker,places",
      language: "zh-TW",
      region: "TW",
      callback: callbackName,
    });
    const cleanup = () => {
      try { delete windowRef[callbackName]; } catch { windowRef[callbackName] = undefined; }
      script.onerror = null;
    };
    windowRef[callbackName] = () => {
      cleanup();
      if (windowRef.google?.maps?.importLibrary) resolve(windowRef.google.maps);
      else reject(failure("google_maps_unavailable"));
    };
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.dataset.kasoGoogleMaps = "";
    script.onerror = () => {
      cleanup();
      googleMapsPromise = null;
      reject(failure("google_maps_unavailable"));
    };
    documentRef.head.append(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });

  return googleMapsPromise;
}

export async function findGoogleNearbyShops(position, {
  maps = globalThis.google?.maps,
  categories = ["food", "cafe"],
  signal,
} = {}) {
  const lat = Number(position?.lat);
  const lon = Number(position?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw failure("invalid_coordinates");
  if (signal?.aborted) throw failure("cancelled");
  if (!maps?.importLibrary) throw failure("google_maps_unavailable");

  const selectedCategories = [...new Set(categories)]
    .map((id) => CATEGORY_BY_ID.get(id))
    .filter(Boolean);
  if (!selectedCategories.length) throw failure("category_required");
  const includedPrimaryTypes = [...new Set(selectedCategories.flatMap((category) => category.types))];
  const { Place, SearchNearbyRankPreference } = await maps.importLibrary("places");
  if (signal?.aborted) throw failure("cancelled");

  let result;
  try {
    result = await Place.searchNearby({
      fields: [
        "id",
        "displayName",
        "location",
        "formattedAddress",
        "googleMapsURI",
        "primaryType",
        "primaryTypeDisplayName",
        "types",
        "photos",
      ],
      locationRestriction: {
        center: { lat, lng: lon },
        radius: NEARBY_RADIUS_METERS,
      },
      includedPrimaryTypes,
      maxResultCount: MAX_GOOGLE_RESULTS,
      rankPreference: SearchNearbyRankPreference.POPULARITY,
      language: "zh-TW",
      region: "TW",
    });
  } catch (error) {
    throw failure("google_places_failed", error);
  }
  if (signal?.aborted) throw failure("cancelled");

  return (Array.isArray(result?.places) ? result.places : []).flatMap((place, sourceRank) => {
    const placeLat = coordinate(place.location, "lat");
    const placeLon = coordinate(place.location, "lng");
    const name = textValue(place.displayName);
    if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLon)) return [];
    const category = placeCategory(place, selectedCategories);
    const distance = distanceMeters({ lat, lon }, { lat: placeLat, lon: placeLon });
    if (distance > NEARBY_RADIUS_METERS * 1.1) return [];
    return [{
      id: `google/${String(place.id || `${placeLat},${placeLon}`)}`,
      name,
      lat: placeLat,
      lon: placeLon,
      distance,
      type: textValue(place.primaryTypeDisplayName) || category.label,
      category: category.id,
      icon: category.icon,
      address: textValue(place.formattedAddress),
      hours: "",
      googleMapsUrl: httpsUrl(place.googleMapsURI),
      sourceRank,
      provider: "google",
      ...photoDetails(place),
    }];
  });
}

