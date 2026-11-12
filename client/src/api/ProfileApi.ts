import {
  ChangePasswordRequest,
  Profile,
  UpdateProfileRequest,
} from "@b2b/shared";
import api from "./axiosInstance";

export async function getMe(): Promise<Profile> {
  const res = await api.get<Profile>("/me");
  return res.data;
}

export async function updateProfile(
  body: UpdateProfileRequest,
): Promise<Profile> {
  const res = await api.patch<Profile>("/me", body);
  return res.data;
}

export async function changePassword(
  body: ChangePasswordRequest,
): Promise<void> {
  await api.post("/me/password", body);
}
