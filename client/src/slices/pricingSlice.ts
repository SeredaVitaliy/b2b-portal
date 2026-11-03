import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface PricingState {
  companyId: number | null;
  productDrafts: Record<number, number | null>;
  categoryDrafts: Record<number, number | null>;
}

const initialState: PricingState = {
  companyId: null,
  productDrafts: {},
  categoryDrafts: {},
};

const pricingSlice = createSlice({
  name: "pricing",
  initialState,
  reducers: {
    selectCompany(state, action: PayloadAction<number | null>) {
      state.companyId = action.payload;
      state.productDrafts = {};
      state.categoryDrafts = {};
    },
    setProductDraft(
      state,
      action: PayloadAction<{ productId: number; value: number | null }>,
    ) {
      state.productDrafts[action.payload.productId] = action.payload.value;
    },
    setCategoryDraft(
      state,
      action: PayloadAction<{ categoryId: number; value: number | null }>,
    ) {
      state.categoryDrafts[action.payload.categoryId] = action.payload.value;
    },
    clearDrafts(state) {
      state.productDrafts = {};
      state.categoryDrafts = {};
    },
  },
});

export const { selectCompany, setProductDraft, setCategoryDraft, clearDrafts } =
  pricingSlice.actions;
export default pricingSlice.reducer;
