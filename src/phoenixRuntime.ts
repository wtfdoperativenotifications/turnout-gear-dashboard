const PHOENIX_PATTERN = /phoenix.*(?:gear.*)?repair|(?:gear.*)?repair.*phoenix/i;
const DASHBOARD_TIMEOUT_MS = 15_000;

function isDashboardRequest(input: RequestInfo | URL): boolean {
  const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  return /\/api\/dashboard(?:\?|$)/.test(value);
}

function installDashboardFetchTimeout() {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isDashboardRequest(input)) return nativeFetch(input, init);

    const controller = new AbortController();
    let timedOut = false;
    const callerSignal = init.signal;
    const onCallerAbort = () => controller.abort();

    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DASHBOARD_TIMEOUT_MS);

    try {
      return await nativeFetch(input, { ...init, cache: "no-store", signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new Error("Dashboard refresh timed out after 15 seconds. The last loaded data is still shown.");
      throw error;
    } finally {
      window.clearTimeout(timer);
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  };
}

function setText(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function setRepairBadge(element: Element | null, value: string) {
  if (!element) return;
  if (element.textContent !== value) element.textContent = value;
  const wanted = value.startsWith("Out for") ? "due repair-inspection" : "location repair-inspection";
  if (element.getAttribute("class") !== wanted) element.setAttribute("class", wanted);
}

function patchPhoenixTableRows(root: ParentNode) {
  root.querySelectorAll("tr").forEach((row) => {
    if (!PHOENIX_PATTERN.test(row.textContent || "")) return;
    const cells = row.querySelectorAll("td");
    if (cells.length < 3) return;

    setRepairBadge(cells[0].querySelector(".due"), "Out for repair / inspection");
    setText(cells[2].querySelector("b"), "Out for Repair / Inspection");
    setRepairBadge(cells[2].querySelector(".location"), "Repair / Inspection");
  });
}

function patchPhoenixAssetModal(root: ParentNode) {
  root.querySelectorAll(".asset-modal:not(.supply-modal)").forEach((modal) => {
    if (!PHOENIX_PATTERN.test(modal.textContent || "")) return;

    setRepairBadge(modal.querySelector(".asset-header-badges .location"), "Repair / Inspection");
    setRepairBadge(modal.querySelector(".asset-header-badges .due"), "Out for repair / inspection");

    modal.querySelectorAll(".asset-detail-grid > div").forEach((field) => {
      const label = field.querySelector("small");
      const value = field.querySelector("strong");
      if (label?.textContent === "Assigned to" || label?.textContent === "Status / assignment") {
        setText(label, "Status / assignment");
        setText(value, "Out for Repair / Inspection");
      }
    });

    setText(
      modal.querySelector(".asset-policy-note span"),
      "This item is at Phoenix Gear Repair and is excluded from the active annual inspection workload and usable warehouse stock until it returns."
    );
  });
}

function patchPhoenixMemberCards(root: ParentNode) {
  root.querySelectorAll(".profile-assets article").forEach((card) => {
    if (!PHOENIX_PATTERN.test(card.textContent || "")) return;
    setRepairBadge(card.querySelector(".due"), "Out for repair / inspection");
  });
}

function patchPhoenixUi() {
  const root = document.getElementById("root");
  if (!root) return;
  patchPhoenixTableRows(root);
  patchPhoenixAssetModal(root);
  patchPhoenixMemberCards(root);
}

function installPhoenixUiObserver() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      patchPhoenixUi();
    });
  };

  const root = document.getElementById("root");
  if (!root) return;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
  schedule();
}

installDashboardFetchTimeout();
window.addEventListener("DOMContentLoaded", installPhoenixUiObserver, { once: true });
