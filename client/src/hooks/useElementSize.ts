import { useCallback, useEffect, useState } from "react";

// Возвращает ref и актуальные размеры элемента. Следим за ресайзом через
// ResizeObserver: виртуальной сетке надо знать ширину/высоту в пикселях,
// а CSS-процентами её не накормить.
//
// ref — callback-ref: когда элемент появляется/исчезает (в т.ч. при условном
// рендере), эффект переобсёрвит новый узел. Если бы обсёрвер вешался один раз
// на монтировании, он не поймал бы элемент, который рендерится позже.
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, width: size.width, height: size.height };
}
