(() => {
  'use strict';

  if (window.boykovInstructionCopyProtection) return;
  window.boykovInstructionCopyProtection = true;

  const protectedSelector = '[data-copy-protected="true"]';
  const editableSelector =
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

  function selectionContainsProtectedText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;

    const protectedElements = document.querySelectorAll(protectedSelector);
    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index);
      for (const element of protectedElements) {
        if (range.intersectsNode(element)) return true;
      }
    }
    return false;
  }

  function preventProtectedCopy(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest(editableSelector)) return;
    if (event.type === 'dragstart' && target?.closest('a, button')) return;

    if (target?.closest(protectedSelector) || selectionContainsProtectedText()) {
      event.preventDefault();
    }
  }

  for (const eventName of ['copy', 'cut', 'dragstart']) {
    document.addEventListener(eventName, preventProtectedCopy, true);
  }
})();
