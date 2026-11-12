import type {
  Company,
  PriceOverrides,
  SetPriceOverrideRequest,
  DeletePriceOverrideRequest,
} from "@b2b/shared";
import api from "./axiosInstance";

export async function getClients(): Promise<Company[]> {
  const response = await api.get<Company[]>("/clients");
  return response.data;
}

// Задать/очистить номер договора клиента (админ/менеджер).
export async function setClientContract(
  companyId: number,
  contractNumber: string | null,
): Promise<Company> {
  const response = await api.patch<Company>(
    `/clients/${companyId}/contract`,
    { contractNumber },
  );
  return response.data;
}

export async function getPriceOverrides(
  companyId: number,
): Promise<PriceOverrides> {
  const response = await api.get<PriceOverrides>(
    `/price-overrides/${companyId}`,
  );
  return response.data;
}

export async function setPriceOverride(
  body: SetPriceOverrideRequest,
): Promise<PriceOverrides> {
  const response = await api.put<PriceOverrides>("/price-overrides", body);
  return response.data;
}

export async function deletePriceOverride(
  body: DeletePriceOverrideRequest,
): Promise<PriceOverrides> {
  const response = await api.delete<PriceOverrides>("/price-overrides", {
    data: body,
  });
  return response.data;
}

export async function getMyOverrides(): Promise<PriceOverrides> {
  const response = await api.get<PriceOverrides>("/my-price-overrides");
  return response.data;
}
