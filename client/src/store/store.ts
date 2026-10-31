import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/slices/authSlice";
import cartReducer from "@/slices/cartSlice";
import favoritesReducer from "@/slices/favoritesSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    favorites: favoritesReducer,
  },
});

store.subscribe(() => {
  try {
    localStorage.setItem("cart", JSON.stringify(store.getState().cart.items));
  } catch {}
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
