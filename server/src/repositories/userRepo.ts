import type { Profile, Role, User } from "@b2b/shared";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";

/** Ошибка профиля (например, неверный текущий пароль) — роут отдаёт 400. */
export class ProfileError extends Error {}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  company_id: number | null;
  phone: string | null;
}

interface ProfileRow extends UserRow {
  company_name: string | null;
  contract_number: string | null;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    companyId: row.company_id,
    phone: row.phone ?? null,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone ?? null,
    company:
      row.company_id != null
        ? {
            id: row.company_id,
            name: row.company_name ?? "",
            contractNumber: row.contract_number ?? null,
          }
        : null,
  };
}

export const userRepo = {
  findByEmail(email: string): UserRow | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | UserRow
      | undefined;
  },

  findById(id: number): User | undefined {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;
    return row ? mapUser(row) : undefined;
  },

  /** Все пользователи (для админского управления ролями). */
  listAll(): User[] {
    const rows = db
      .prepare("SELECT * FROM users ORDER BY id")
      .all() as UserRow[];
    return rows.map(mapUser);
  },

  /** Сменить роль пользователя. Возвращает обновлённого или undefined, если его нет. */
  updateRole(id: number, role: Role): User | undefined {
    const info = db
      .prepare("UPDATE users SET role = ? WHERE id = ?")
      .run(role, id);
    return info.changes > 0 ? this.findById(id) : undefined;
  },

  /** Профиль пользователя с данными компании и номером договора. */
  getProfile(id: number): Profile | undefined {
    const row = db
      .prepare(
        `SELECT u.*, c.name AS company_name, c.contract_number
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = ?`,
      )
      .get(id) as ProfileRow | undefined;
    return row ? mapProfile(row) : undefined;
  },

  /** Пользователь правит свои имя/телефон. Возвращает обновлённый профиль. */
  updateProfile(
    id: number,
    changes: { name?: string; phone?: string | null },
  ): Profile | undefined {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    if (changes.name !== undefined) {
      sets.push("name = @name");
      params.name = changes.name;
    }
    if (changes.phone !== undefined) {
      sets.push("phone = @phone");
      params.phone = changes.phone;
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = @id`).run(
        params,
      );
    }
    return this.getProfile(id);
  },

  /**
   * Смена пароля: проверяем ТЕКУЩИЙ (нельзя сменить вслепую), затем хешируем
   * новый. Неверный текущий → ProfileError (роут отдаёт 400).
   */
  changePassword(id: number, current: string, next: string): void {
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(id) as { password_hash: string } | undefined;
    if (!row) throw new ProfileError("Пользователь не найден");
    if (!verifyPassword(current, row.password_hash)) {
      throw new ProfileError("Текущий пароль неверный");
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(next),
      id,
    );
  },

  toDomain: mapUser,
};
