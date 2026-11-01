import type { Role, User } from "@b2b/shared";
import { db } from "../db";

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  company_id: number | null;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    companyId: row.company_id,
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

  toDomain: mapUser,
};
