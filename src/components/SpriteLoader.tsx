'use client';

import { useEffect } from 'react';

/**
 * Fetches the SLDS utility sprite and injects it into the DOM once at
 * app start. After injection, `<use href="#iconName">` references in the
 * same document work reliably — external-file `<use xlinkHref="...svg#id">`
 * has inconsistent CSS inheritance across browsers (Safari in particular
 * refuses to let host-document CSS style paths inside an externally
 * referenced sprite), which was leaving sidebar icons invisible inside
 * white `.slds-button_icon-border-filled` buttons.
 */
export function SpriteLoader() {
  useEffect(() => {
    if (document.getElementById('slds-utility-sprite')) return;
    fetch('/assets/icons/utility-sprite/svg/symbols.svg')
      .then((res) => res.text())
      .then((text) => {
        const div = document.createElement('div');
        div.id = 'slds-utility-sprite';
        div.style.position = 'absolute';
        div.style.width = '0';
        div.style.height = '0';
        div.style.overflow = 'hidden';
        div.setAttribute('aria-hidden', 'true');
        div.innerHTML = text;
        document.body.insertBefore(div, document.body.firstChild);
      })
      .catch(() => {
        // Non-fatal: external sprite reference remains as a fallback.
      });
  }, []);

  return null;
}
