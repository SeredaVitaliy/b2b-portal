import { StockStatus } from "@b2b/shared";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface LiveStock {
  stock: number;
  stockStatus: StockStatus;
  updatedAt: number;
}

interface StockState {
  byId: Record<number, LiveStock>;
}

const initialState: StockState = { byId: {} };

export const stockSlice = createSlice({
  name: "stock",
  initialState,
  reducers: {
    applyStockUpdate(
      state,
      action: PayloadAction<{
        productId: number;
        stock: number;
        stockStatus: StockStatus;
        updatedAt: number;
      }>,
    ) {
      const { productId, updatedAt } = action.payload;
      const existing = state.byId[productId];

      if (existing && existing.updatedAt >= updatedAt) return;
      state.byId[productId] = {
        stock: action.payload.stock,
        stockStatus: action.payload.stockStatus,
        updatedAt,
      };
    },
  },
});

export const { applyStockUpdate } = stockSlice.actions;
export default stockSlice.reducer;
