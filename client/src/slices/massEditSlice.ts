import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type EditableField = "basePrice" | "stock";

export interface CellRef {
  id: number;
  field: EditableField;
}

interface MassEditState {
  drafts: Record<number, Partial<Record<EditableField, number>>>;
  errors: Record<number, string>;
  selected: CellRef[];
}

const initialState: MassEditState = { drafts: {}, errors: {}, selected: [] };

const massEditSlice = createSlice({
  name: "massEdit",
  initialState,
  reducers: {
    setDraft(
      state,
      action: PayloadAction<{
        id: number;
        field: EditableField;
        value: number | null;
      }>,
    ) {
      const { id, field, value } = action.payload;
      const row = state.drafts[id] ?? {};
      if (value === null) delete row[field];
      else row[field] = value;
      if (Object.keys(row).length === 0) delete state.drafts[id];
      else state.drafts[id] = row;
      delete state.errors[id];
    },

    setSelected(state, action: PayloadAction<CellRef[]>) {
      state.selected = action.payload;
    },
    clearSelection(state) {
      state.selected = [];
    },
    fillSelected(state, action: PayloadAction<number>) {
      for (const { id, field } of state.selected) {
        const row = state.drafts[id] ?? {};
        row[field] = action.payload;
        state.drafts[id] = row;
        delete state.errors[id];
      }
    },
    setErrors(state, action: PayloadAction<Record<number, string>>) {
      state.errors = action.payload;
    },
    clearDrafts(state, action: PayloadAction<number[]>) {
      for (const id of action.payload) {
        delete state.drafts[id];
        delete state.errors[id];
      }
    },

    resetAll() {
      return initialState;
    },
  },
});

export const {
  setDraft,
  setSelected,
  clearSelection,
  fillSelected,
  setErrors,
  clearDrafts,
  resetAll,
} = massEditSlice.actions;
export default massEditSlice.reducer;
