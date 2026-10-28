import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "react-redux";
import { ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import { store } from "./store/store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
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
    </Provider>
  </StrictMode>,
);
