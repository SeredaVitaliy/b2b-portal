import { useEffect, useRef, useState } from "react";

// Возвращает ref и актуальные размеры элемента. Следим за ресайзом через
// ResizeObserver: виртуальной сетке надо знать ширину/высоту в пикселях,
// а CSS-процентами её не накормить.
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
