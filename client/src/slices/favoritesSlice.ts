import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface FavoritesState {
  ids: number[];
}

const initialState: FavoritesState = { ids: [] };

export const favoritesSlice = createSlice({
  name: "favorites",
  initialState,
  reducers: {
    setFavorites(state, action: PayloadAction<number[]>) {
      state.ids = action.payload;
    },
    addFavorite(state, action: PayloadAction<number>) {
      if (!state.ids.includes(action.payload)) state.ids.push(action.payload);
    },
    removeFavorite(state, action: PayloadAction<number>) {
      state.ids = state.ids.filter((id) => id !== action.payload);
    },
  },
});

export const { setFavorites, addFavorite, removeFavorite } =
  favoritesSlice.actions;
export default favoritesSlice.reducer;
