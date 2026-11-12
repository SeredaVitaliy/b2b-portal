import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword, verifyPassword } from "./../auth/password";

let db: (typeof import("../db"))["db"];
let userRepo: (typeof import("./userRepo"))["userRepo"];
let ProfileError: (typeof import("./userRepo"))["ProfileError"];
let priceRepo: (typeof import("./priceRepo"))["priceRepo"];

let tmpDir: string;
let companyId: number;
let userId: number;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-profile-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();
  const uMod = await import("./userRepo");
  userRepo = uMod.userRepo;
  ProfileError = uMod.ProfileError;
  priceRepo = (await import("./priceRepo")).priceRepo;

  companyId = db
    .prepare("INSERT INTO companies (name, contract_number) VALUES (?, ?)")
    .run("ООО Ромашка", "Д-2024/17").lastInsertRowid as number;
  userId = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role, company_id, phone) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("b@test", hashPassword("old123"), "Закупщик", "buyer", companyId, "+7 900 000-00-00")
    .lastInsertRowid as number;
});

afterAll(() => {
  db?.close();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("profile", () => {
  it("getProfile отдаёт данные компании и номер договора", () => {
    const p = userRepo.getProfile(userId)!;
    expect(p.name).toBe("Закупщик");
    expect(p.phone).toBe("+7 900 000-00-00");
    expect(p.company).toMatchObject({
      name: "ООО Ромашка",
      contractNumber: "Д-2024/17",
    });
  });

  it("updateProfile меняет имя и телефон", () => {
    const p = userRepo.updateProfile(userId, {
      name: "Новый",
      phone: "+7 111",
    })!;
    expect(p.name).toBe("Новый");
    expect(p.phone).toBe("+7 111");
  });

  it("changePassword требует верный текущий пароль", () => {
    expect(() =>
      userRepo.changePassword(userId, "неверный", "new123"),
    ).toThrow(ProfileError);

    userRepo.changePassword(userId, "old123", "new123");
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(userId) as { password_hash: string };
    expect(verifyPassword("new123", row.password_hash)).toBe(true);
  });

  it("setContract обновляет номер договора клиента", () => {
    const c = priceRepo.setContract(companyId, "Д-2025/01");
    expect(c.contractNumber).toBe("Д-2025/01");
    expect(userRepo.getProfile(userId)!.company!.contractNumber).toBe(
      "Д-2025/01",
    );
  });
});
