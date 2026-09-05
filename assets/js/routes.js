import homePage from "./pages/home.js";
import habitsPage from "./pages/habits.js";
import ledgerPage from "./pages/ledger.js";
import nearbyPage from "./pages/nearby.js";
import notFoundPage from "./pages/not-found.js";
import onboardingPage from "./pages/onboarding.js";
import overseasPage from "./pages/overseas.js";
import searchPage from "./pages/search.js";

export const ROUTES = {
  "/onboarding": {
    title: "初次設定",
    label: "初次設定",
    navGroup: null,
    shellVisible: false,
    requiresProfile: false,
    page: onboardingPage,
  },
  "/home": {
    title: "首頁",
    label: "首頁",
    navGroup: null,
    shellVisible: true,
    requiresProfile: true,
    page: homePage,
  },
  "/search": {
    title: "商品比價",
    label: "商品比價",
    navGroup: "search",
    shellVisible: true,
    requiresProfile: true,
    page: searchPage,
  },
  "/nearby": {
    title: "附近優惠",
    label: "附近優惠",
    navGroup: "nearby",
    shellVisible: true,
    requiresProfile: true,
    page: nearbyPage,
  },
  "/ledger": {
    title: "自動記帳",
    label: "自動記帳",
    navGroup: "ledger",
    shellVisible: true,
    requiresProfile: true,
    page: ledgerPage,
  },
  "/habits": {
    title: "消費習慣",
    label: "消費習慣",
    navGroup: "ledger",
    shellVisible: true,
    requiresProfile: true,
    page: habitsPage,
  },
  "/overseas": {
    title: "海外刷卡",
    label: "海外刷卡",
    navGroup: "ledger",
    shellVisible: true,
    requiresProfile: true,
    page: overseasPage,
  },
};

export const NOT_FOUND_ROUTE = {
  title: "找不到頁面",
  label: "找不到頁面",
  navGroup: null,
  shellVisible: true,
  requiresProfile: true,
  page: notFoundPage,
};
