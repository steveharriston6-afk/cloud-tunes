import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
}

/**
 * A lightweight virtualized list that integrates with the nearest scrollable
 * parent (typically <main>). Only the visible items (plus overscan) are
 * rendered, keeping DOM node count constant regardless of list size.
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  gap = 0,
  renderItem,
  overscan = 5,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  const itemHeightWithGap = itemHeight + gap;
  const totalHeight = items.length * itemHeightWithGap;

  // Find the nearest scrollable ancestor
  const getScrollParent = useCallback((node: HTMLElement | null): HTMLElement | null => {
    if (!node) return null;
    let parent = node.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (
        parent.tagName === 'MAIN' ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll'
      ) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollParent =
      getScrollParent(el) ||
      (document.querySelector('main') as HTMLElement);
    if (!scrollParent) return;

    const recalc = () => {
      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // How far the top of our container is from the top of the scroll viewport
      const offsetInViewport = elRect.top - parentRect.top;
      const viewportHeight = scrollParent.clientHeight;

      // The first visible pixel of our container (relative to container top)
      const scrolledPast = Math.max(0, -offsetInViewport);

      const startIndex = Math.max(0, Math.floor(scrolledPast / itemHeightWithGap) - overscan);
      const visibleCount = Math.ceil(viewportHeight / itemHeightWithGap) + overscan * 2;
      const endIndex = Math.min(items.length - 1, startIndex + visibleCount);

      setVisibleRange((prev) => {
        if (prev.start === startIndex && prev.end === endIndex) return prev;
        return { start: startIndex, end: endIndex };
      });
    };

    recalc();
    scrollParent.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });

    // Also recalc if the container itself resizes (e.g. sidebar toggle)
    const ro = new ResizeObserver(recalc);
    ro.observe(scrollParent);

    return () => {
      scrollParent.removeEventListener('scroll', recalc);
      window.removeEventListener('resize', recalc);
      ro.disconnect();
    };
  }, [items.length, itemHeightWithGap, overscan, getScrollParent]);

  const { start, end } = visibleRange;

  // Build only the visible slice
  const visibleItems: React.ReactNode[] = [];
  for (let i = start; i <= end && i < items.length; i++) {
    visibleItems.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: i * itemHeightWithGap,
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      >
        {renderItem(items[i], i)}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: totalHeight,
      }}
    >
      {visibleItems}
    </div>
  );
}
