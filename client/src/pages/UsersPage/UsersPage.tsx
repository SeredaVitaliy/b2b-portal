import { getUsers, updateUserRole } from "@/api/UserApi";
import { useAppSelector } from "@/store/hooks";
import { Role, User } from "@b2b/shared";
import { Empty, Select, Spin, Table, Tag, Typography, message } from "antd";
import { useEffect, useState } from "react";

const roleOptions: { value: Role; label: string }[] = [
  { value: "buyer", label: "Закупщик" },
  { value: "manager", label: "Менеджер" },
  { value: "admin", label: "Администратор" },
];

export default function UsersPage() {
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        setUsers(await getUsers());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (currentUser?.role !== "admin") {
    return (
      <Empty
        description="Доступ только для администратора"
        style={{ padding: 60 }}
      />
    );
  }

  const handleRoleChange = async (id: number, role: Role) => {
    try {
      const updated = await updateUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      message.success("Роль обновлена");
    } catch {
      message.error("Не удалось сменить роль");
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const columns = [
    { title: "Имя", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    {
      title: "Компания",
      dataIndex: "companyId",
      key: "companyId",
      render: (companyId: number | null) => (companyId ? `№${companyId}` : "—"),
    },
    {
      title: "Роль",
      key: "role",
      render: (_: unknown, user: User) =>
        user.id === currentUser?.id ? (
          <Tag color="green">
            {roleOptions.find((r) => r.value === user.role)?.label} (вы)
          </Tag>
        ) : (
          <Select
            value={user.role}
            style={{ width: 160 }}
            options={roleOptions}
            onChange={(role) => handleRoleChange(user.id, role)}
          />
        ),
    },
  ];

  return (
    <div>
      <Typography.Title level={2}>Пользователи</Typography.Title>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        pagination={false}
      />
    </div>
  );
}
