import { openAssistant } from "./components/assistant.js";
import { showToast } from "./components/dialogs.js";
import { NOT_FOUND_ROUTE, ROUTES } from "./routes.js";
import { state } from "./store.js";
import { $ } from "./utils.js";

const SITE_TITLE = "卡搜 KASO";
let currentCleanup = null;
let currentPath = null;
let started = false;

function normalizePath(value) {
  const withoutHash = String(value || "")
    .replace(/^#/, "")
    .split("?")[0]
    .trim();
  if (!withoutHash || withoutHash === "/") return "/";
  const withLeadingSlash = withoutHash.startsWith("/")
    ? withoutHash
    : `/${withoutHash}`;
  return withLeadingSlash.length > 1
    ? withLeadingSlash.replace(/\/+$/, "")
    : withLeadingSlash;
}

function hashPath() {
  return normalizePath(window.location.hash);
}

function defaultPath() {
  return state.profile ? "/home" : "/onboarding";
}

function replaceHash(path) {
  const normalized = normalizePath(path);
  const url = `${window.location.pathname}${window.location.search}#${normalized}`;
  window.history.replaceState(null, "", url);
}

function guardedPath(path, route) {
  if (!state.profile && route.requiresProfile) return "/onboarding";
  if (state.profile && path === "/onboarding") return "/home";
  return path;
}

function routeContext(path) {
  return {
    path,
    navigate,
    rerender,
    showToast,
    openAssistant,
  };
}

function renderCurrent({ scroll = true } = {}) {
  const app = $("#app");
  if (!app) throw new Error("找不到 #app 掛載點");

  let path = hashPath();
  if (path === "/") {
    path = defaultPath();
    replaceHash(path);
  }

  let route = ROUTES[path] || NOT_FOUND_ROUTE;
  const destination = guardedPath(path, route);
  if (destination !== path) {
    replaceHash(destination);
    path = destination;
    route = ROUTES[path];
  }

  if (typeof currentCleanup === "function") currentCleanup();
  currentCleanup = null;
  currentPath = path;

  app.innerHTML = route.page.render(routeContext(path));
  document.body.classList.toggle("onboarding-active", !route.shellVisible);
  document.title = `${route.title}｜${SITE_TITLE}`;

  window.dispatchEvent(new CustomEvent("kaso:routechange", {
    detail: {
      path,
      label: route.label,
      navGroup: route.navGroup,
      shellVisible: route.shellVisible,
    },
  }));

  const cleanup = route.page.mount?.(routeContext(path));
  if (typeof cleanup === "function") currentCleanup = cleanup;
  if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
}

export function navigate(path, { replace = false } = {}) {
  const normalized = normalizePath(path);
  if (replace) {
    replaceHash(normalized);
    renderCurrent();
    return;
  }
  if (hashPath() === normalized) {
    renderCurrent();
    return;
  }
  window.location.hash = normalized;
}

export function rerender(options = {}) {
  renderCurrent(options);
}

export function getCurrentPath() {
  return currentPath;
}

export function startRouter() {
  if (started) return;
  started = true;
  window.addEventListener("hashchange", () => renderCurrent());
  renderCurrent();
}
