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

  toDomain: mapUser,
};
