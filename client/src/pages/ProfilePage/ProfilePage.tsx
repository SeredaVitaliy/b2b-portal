import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@b2b/shared";
import { changePassword, getMe, updateProfile } from "@/api/ProfileApi";

const roleLabel: Record<Role, string> = {
  buyer: "Закупщик",
  manager: "Менеджер",
  admin: "Администратор",
};

function serverMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateProfile({ name: name.trim(), phone: phone.trim() || null }),
    onSuccess: (p) => {
      message.success("Профиль сохранён");
      queryClient.setQueryData(["me"], p);
    },
    onError: (e) => message.error(serverMessage(e, "Не удалось сохранить")),
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const pwdMut = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      message.success("Пароль изменён");
      setCurrent("");
      setNext("");
      setConfirm("");
    },
    onError: (e) =>
      message.error(serverMessage(e, "Не удалось сменить пароль")),
  });

  const submitPassword = () => {
    if (next.length < 6) {
      message.warning("Новый пароль — минимум 6 символов");
      return;
    }
    if (next !== confirm) {
      message.warning("Пароли не совпадают");
      return;
    }
    pwdMut.mutate();
  };

  if (isLoading || !profile) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Typography.Title level={2}>Профиль</Typography.Title>

      <Card title="Данные" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
          <Descriptions.Item label="Роль">
            <Tag>{roleLabel[profile.role]}</Tag>
          </Descriptions.Item>
          {profile.company && (
            <Descriptions.Item label="Компания">
              {profile.company.name}
            </Descriptions.Item>
          )}
          {profile.company && (
            <Descriptions.Item label="Номер договора">
              {profile.company.contractNumber ?? "—"}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Имя" style={{ marginBottom: 12 }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Item>
          <Form.Item label="Телефон" style={{ marginBottom: 12 }}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 ..."
            />
          </Form.Item>
          <Button
            type="primary"
            loading={saveMut.isPending}
            disabled={!name.trim()}
            onClick={() => saveMut.mutate()}
          >
            Сохранить
          </Button>
        </Form>
      </Card>

      <Card title="Смена пароля">
        <Form layout="vertical">
          <Form.Item label="Текущий пароль" style={{ marginBottom: 12 }}>
            <Input.Password
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Новый пароль" style={{ marginBottom: 12 }}>
            <Input.Password
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label="Повторите новый пароль"
            style={{ marginBottom: 12 }}
          >
            <Input.Password
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Form.Item>
          <Button
            type="primary"
            loading={pwdMut.isPending}
            disabled={!current || !next || !confirm}
            onClick={submitPassword}
          >
            Сменить пароль
          </Button>
        </Form>
      </Card>
    </div>
  );
}
