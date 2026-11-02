import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "./store/store";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          locale={ruRU}
          theme={{
            token: {
              colorPrimary: "#16a34a",
              borderRadius: 8,
            },
          }}
        >
          <App />
        </ConfigProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
);
