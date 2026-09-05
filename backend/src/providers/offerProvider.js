// 優惠資料來源 — 依已決議：先做「政府活動」+「文化幣」，信用卡官網之後再擴充。
// 介面設計成可插拔：之後要接信用卡官網，只要在 OFFER_POOL 之外再加一個 source，
// 並在 fetchOffers() 裡合併回傳即可，其餘 service（classifyOffer / checkBudget）完全不用改。
//
// category 用跟 profile.expenses 一樣的六個 key（food/clothing/housing/transport/education/entertainment），
// 這樣 checkBudget(amount, category) 才能直接拿它跟「該分類剩餘預算」比。

const OFFER_POOL = [
  { id: "o1", title: "夜市消費券折抵 100 元", source: "government", category: "food", type: "paid", value: 100 },
  { id: "o2", title: "文化幣：獨立書店買書折抵", source: "culture_voucher", category: "education", type: "paid", value: 200 },
  { id: "o3", title: "市府節電家電補助", source: "government", category: "housing", type: "paid", value: 1000 },
  { id: "o4", title: "社區公園免費瑜珈課", source: "government", category: "entertainment", type: "free", value: 0 },
  { id: "o5", title: "文化幣：獨立電影院優惠票", source: "culture_voucher", category: "entertainment", type: "paid", value: 280 },
  { id: "o6", title: "市集在地小吃買一送一", source: "government", category: "food", type: "paid", value: 150 },
  { id: "o7", title: "圖書館免費借閱活動", source: "government", category: "education", type: "free", value: 0 },
  { id: "o8", title: "公共自行車首 30 分免費", source: "government", category: "transport", type: "free", value: 0 },
  { id: "o9", title: "在地服飾工作室折扣日", source: "government", category: "clothing", type: "paid", value: 300 },
  { id: "o10", title: "社區免費健檢日", source: "government", category: "housing", type: "free", value: 0 },
];

// 店家 tag → 六大分類（food/clothing/housing/transport/education/entertainment）的對應表。
// 架構定案裡沒有規定確切規則，這裡採「店家資料本來就自帶分類，直接拿來用」的精神做一個合理對應，
// 之後有更準確的來源時只要換這張表即可。
const OSM_TAG_TO_CATEGORY = {
  restaurant: "food", cafe: "food", fast_food: "food", bar: "food", food_court: "food",
  clothes: "clothing", shoes: "clothing", boutique: "clothing",
  supermarket: "housing", convenience: "housing", pharmacy: "housing", chemist: "housing", department_store: "housing",
  fuel: "transport", bicycle: "transport", car_repair: "transport",
  books: "education", stationery: "education", library: "education",
  cinema: "entertainment", karaoke_box: "entertainment", theatre: "entertainment", games: "entertainment",
};

function fetchOffers() {
  return OFFER_POOL;
}

function mapTagToCategory(tag) {
  return OSM_TAG_TO_CATEGORY[tag] || "housing";
}

module.exports = { fetchOffers, mapTagToCategory, OSM_TAG_TO_CATEGORY };
