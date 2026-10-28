import { getMe, refresh } from "@/api/AuthApi";
import { tokenManager } from "@/api/tokenStorage";
import type { User } from "@b2b/shared";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
};

export const initialAuth = createAsyncThunk("auth/initial", async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const tokens = await refresh(refreshToken);
    tokenManager.setAccessToken(tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);
    const user = await getMe();
    return user;
  } catch {
    localStorage.removeItem("refreshToken");
    return null;
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initialAuth.fulfilled, (state, action) => {
        state.isInitialized = true;
        state.user = action.payload;
        state.isAuthenticated = action.payload !== null;
      })
      .addCase(initialAuth.rejected, (state) => {
        state.isInitialized = true;
      });
  },
});

export const { setUser, clearUser } = authSlice.actions;
export default authSlice.reducer;
