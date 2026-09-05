export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

export function money(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function monthParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function monthValueFromOffset(months = 0, now = new Date()) {
  const date = new Date(
    now.getFullYear(),
    now.getMonth() + Number(months || 0),
    1,
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthValue(value) {
  const parts = monthParts(value);
  return parts ? `${parts.year} 年 ${parts.month} 月` : "—";
}

export function monthsUntil(value, now = new Date()) {
  const parts = monthParts(value);
  if (!parts) return 1;
  const distance = (
    (parts.year - now.getFullYear()) * 12
    + parts.month
    - (now.getMonth() + 1)
  );
  return Math.max(1, distance);
}

export function shiftMonthValue(value, offset = 1) {
  const parts = monthParts(value);
  if (!parts) return monthValueFromOffset(offset);
  const date = new Date(parts.year, parts.month - 1 + Number(offset || 0), 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(now = new Date()) {
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
}

export function remainingDaysInMonth(now = new Date()) {
  return Math.max(1, daysInMonth(now) - now.getDate() + 1);
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

export function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${escapeAttr(name)}"></use></svg>`;
}

export function pageTitle(title, detail, label) {
  return `
    <div class="page-title">
      <div>
        <p class="eyebrow">${icon("grid")} ${escapeHtml(label)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </div>
      <span class="demo-pill">HTML 互動稿</span>
    </div>
  `;
}

export function valuesToPercentages(values) {
  const numericValues = values.map((value) => Math.max(0, Number(value) || 0));
  const total = numericValues.reduce((sum, value) => sum + value, 0) || 1;
  const percentages = numericValues.map((value, index) => (
    index < numericValues.length - 1 ? Math.round((value / total) * 100) : 0
  ));
  percentages[percentages.length - 1] = 100
    - percentages.slice(0, -1).reduce((sum, value) => sum + value, 0);
  return percentages;
}

export function nextFrame(callback) {
  return window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}
