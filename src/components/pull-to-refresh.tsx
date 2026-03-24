"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 下拉刷新容器 — 包裹页面内容，下拉触发 onRefresh 回调
 * 仅在页面滚动到顶部时生效，不干扰正常滚动
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const THRESHOLD = 60; // 触发刷新的下拉距离

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 只在页面滚动到顶部时启用
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      // 阻尼效果：拉得越远阻力越大
      const distance = Math.min(diff * 0.4, 100);
      setPullDistance(distance);
      setPulling(distance >= THRESHOLD);
    } else {
      setPullDistance(0);
      setPulling(false);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!tracking.current) return;
    tracking.current = false;

    if (pulling && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    setPulling(false);
  }, [pulling, refreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉指示器 */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : "0px" }}
      >
        {refreshing ? (
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        ) : (
          <p className={`text-xs transition-colors ${pulling ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}>
            {pulling ? "松手刷新" : "继续下拉"}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
