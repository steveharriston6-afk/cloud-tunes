import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualizedGridProps<T> {
  items: T[];
  itemHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  isTV?: boolean;
  cardMode?: boolean;
  metadataHeight?: number;
  overscan?: number;
}

/**
 * A lightweight virtualized grid that integrates with the nearest scrollable
 * parent. Computes responsive column count from its own width, then only
 * renders the rows (and their cells) that are visible in the viewport.
 */
export function VirtualizedGrid<T>({
  items,
  itemHeight,
  gap = 16,
  renderItem,
  isTV = false,
  cardMode = false,
  metadataHeight = 90,
  overscan = 3,
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [containerWidth, setContainerWidth] = useState(800);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

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

  // Track container width and compute columns
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
          if (isTV) {
            setColumns(6);
          } else if (width < 640) {
            setColumns(2);
          } else if (width < 768) {
            setColumns(3);
          } else if (width < 1024) {
            setColumns(4);
          } else {
            setColumns(5);
          }
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isTV]);

  const colWidth = (containerWidth - (columns - 1) * gap) / columns;
  const finalItemHeight = cardMode ? colWidth + metadataHeight : itemHeight;
  const rowHeightWithGap = finalItemHeight + gap;

  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * rowHeightWithGap;

  // Recalculate visible row range on scroll / resize
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
      const offsetInViewport = elRect.top - parentRect.top;
      const viewportHeight = scrollParent.clientHeight;

      const scrolledPast = Math.max(0, -offsetInViewport);

      const startRow = Math.max(0, Math.floor(scrolledPast / rowHeightWithGap) - overscan);
      const visibleRows = Math.ceil(viewportHeight / rowHeightWithGap) + overscan * 2;
      const endRow = Math.min(totalRows - 1, startRow + visibleRows);

      setVisibleRange((prev) => {
        if (prev.start === startRow && prev.end === endRow) return prev;
        return { start: startRow, end: endRow };
      });
    };

    recalc();
    scrollParent.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('resize', recalc, { passive: true });

    const ro = new ResizeObserver(recalc);
    ro.observe(scrollParent);

    return () => {
      scrollParent.removeEventListener('scroll', recalc);
      window.removeEventListener('resize', recalc);
      ro.disconnect();
    };
  }, [totalRows, rowHeightWithGap, overscan, getScrollParent]);

  const { start, end } = visibleRange;

  // Build only the visible rows
  const visibleRows: React.ReactNode[] = [];
  for (let rowIdx = start; rowIdx <= end && rowIdx < totalRows; rowIdx++) {
    const startItemIdx = rowIdx * columns;
    const rowCells: React.ReactNode[] = [];

    for (let col = 0; col < columns; col++) {
      const itemIdx = startItemIdx + col;
      if (itemIdx < items.length) {
        rowCells.push(
          <div
            key={`cell-${itemIdx}`}
            style={{
              width: colWidth,
              height: '100%',
              flexShrink: 0,
            }}
          >
            {renderItem(items[itemIdx], itemIdx)}
          </div>
        );
      }
    }

    visibleRows.push(
      <div
        key={`row-${rowIdx}`}
        style={{
          position: 'absolute',
          top: rowIdx * rowHeightWithGap,
          left: 0,
          right: 0,
          height: finalItemHeight,
          display: 'flex',
          gap: `${gap}px`,
        }}
      >
        {rowCells}
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
        minHeight: totalRows > 0 ? rowHeightWithGap : 0,
      }}
    >
      {visibleRows}
    </div>
  );
}
