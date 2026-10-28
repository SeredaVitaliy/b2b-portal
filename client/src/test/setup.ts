// Подключает дополнительные матчеры: toBeInTheDocument, toBeDisabled, toHaveTextContent и т.п.
// Импортируется один раз перед каждым тест-файлом (см. setupFiles в vite.config.ts).
import "@testing-library/jest-dom";

// jsdom не реализует часть браузерных API, которые нужны AntD-компонентам.
// Подкладываем минимальные заглушки, иначе рендер падает.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
