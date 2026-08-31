/** Focus trap and Escape-to-close for modal dialogs. */

const wiredModals = new Set();

/**
 * @param {{
 *   modalId: string,
 *   cardSelector?: string,
 *   isOpen: () => boolean,
 *   close: () => void,
 * }} config
 */
export function wireModalAccessibility({ modalId, cardSelector = ".upgrade-modal-card", isOpen, close }) {
  if (wiredModals.has(modalId)) return;
  wiredModals.add(modalId);

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key !== "Tab") return;
    const card = modal.querySelector(cardSelector);
    if (!card) return;

    const focusables = [...card.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((node) => !node.hasAttribute("disabled") && node.offsetParent !== null);

    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/**
 * @param {string} modalId
 * @param {string} [focusSelector]
 */
export function focusModalOnOpen(modalId, focusSelector) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const target =
    (focusSelector && modal.querySelector(focusSelector))
    || modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (target && typeof target.focus === "function") {
    try {
      target.focus();
    } catch (_) {
      /* ignore */
    }
  }
}
