"use client";

import { useEffect } from "react";

export function ConceptsDocsInteractions() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-concepts-docs]");

    if (!root) {
      return;
    }

    const createdAnchors: HTMLAnchorElement[] = [];

    root.querySelectorAll<HTMLHeadingElement>("h3[id]").forEach((heading) => {
      if (heading.classList.contains("no-anchor") || heading.querySelector(".anchorjs-link")) {
        return;
      }

      const anchor = document.createElement("a");
      anchor.className = "anchorjs-link";
      anchor.href = `#${heading.id}`;
      anchor.setAttribute("aria-label", `Anchor link for: ${heading.textContent?.trim() || heading.id}`);
      anchor.textContent = "#";
      heading.insertBefore(anchor, heading.firstChild);
      createdAnchors.push(anchor);
    });

    const input = root.querySelector<HTMLInputElement>("#filter-input");
    const clearButton = root.querySelector<HTMLButtonElement>("[data-filter-clear]");
    const toc = root.querySelector<HTMLElement>("#toc");
    const tocItems = toc ? Array.from(toc.getElementsByTagName("li")) : [];

    const updateClearButton = () => {
      if (clearButton && input) {
        clearButton.hidden = input.value.length === 0;
      }
    };

    const applyFilter = () => {
      const value = input?.value.toLowerCase().trim() ?? "";

      tocItems.forEach((item) => {
        const text = item.textContent?.toLowerCase() ?? "";
        item.classList.toggle("display-none", value.length > 0 && !text.includes(value));
      });

      updateClearButton();
    };

    const handleKeyup = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const firstVisible = tocItems.find((item) => !item.classList.contains("display-none"));
        const link = firstVisible?.querySelector<HTMLAnchorElement>("a[href]");

        if (link) {
          window.location.replace(link.href);
          event.preventDefault();
          return;
        }
      }

      applyFilter();
    };

    const handleClearFilter = () => {
      if (!input) {
        return;
      }

      input.value = "";
      applyFilter();
      input.focus();
    };

    input?.addEventListener("keyup", handleKeyup);
    input?.addEventListener("input", applyFilter);
    clearButton?.addEventListener("click", handleClearFilter);
    applyFilter();

    const left = root.querySelector<HTMLElement>("#split-left");
    const right = root.querySelector<HTMLElement>("#split-right");
    const gutter = root.querySelector<HTMLElement>("#split-gutter");
    const splitParent = left?.parentElement ?? null;

    let cleanupSplit: (() => void) | undefined;

    if (left && right && gutter && splitParent) {
      const setSplit = (leftPercent: number) => {
        const parentWidth = splitParent.getBoundingClientRect().width;
        const minLeftPx = Math.min(120, Math.max(0, parentWidth - 40));
        const minLeftPercent = parentWidth > 0 ? ((minLeftPx + 10) / parentWidth) * 100 : 20;
        const clampedLeft = Math.min(80, Math.max(minLeftPercent, leftPercent));
        const clampedRight = 100 - clampedLeft;

        left.style.flexBasis = `calc(${clampedLeft}% - 10px)`;
        right.style.flexBasis = `calc(${clampedRight}% - 10px)`;
      };

      const handlePointerMove = (event: PointerEvent) => {
        const bounds = splitParent.getBoundingClientRect();

        if (bounds.width === 0) {
          return;
        }

        setSplit(((event.clientX - bounds.left) / bounds.width) * 100);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      const handlePointerDown = (event: PointerEvent) => {
        event.preventDefault();
        gutter.setPointerCapture?.(event.pointerId);
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
      };

      setSplit(33);
      gutter.addEventListener("pointerdown", handlePointerDown);

      cleanupSplit = () => {
        gutter.removeEventListener("pointerdown", handlePointerDown);
        handlePointerUp();
      };
    }

    const scrollToHash = () => {
      const targetId = window.location.hash.slice(1);

      if (!targetId) {
        return;
      }

      document.getElementById(targetId)?.scrollIntoView();
    };

    window.addEventListener("hashchange", scrollToHash);
    scrollToHash();

    return () => {
      input?.removeEventListener("keyup", handleKeyup);
      input?.removeEventListener("input", applyFilter);
      clearButton?.removeEventListener("click", handleClearFilter);
      window.removeEventListener("hashchange", scrollToHash);
      createdAnchors.forEach((anchor) => anchor.remove());
      cleanupSplit?.();
    };
  }, []);

  return null;
}
