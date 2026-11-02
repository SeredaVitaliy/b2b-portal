import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/slices/authSlice";
import cartReducer from "@/slices/cartSlice";
import favoritesReducer from "@/slices/favoritesSlice";
import stockReducer from "@/slices/stockSlice";
import massEditReducer from "@/slices/massEditSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    favorites: favoritesReducer,
    stock: stockReducer,
    massEdit: massEditReducer,
  },
});

store.subscribe(() => {
  try {
    localStorage.setItem("cart", JSON.stringify(store.getState().cart.items));
  } catch {}
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
