import { login } from "@/api/AuthApi";
import { tokenManager } from "@/api/tokenStorage";
import { setUser } from "@/slices/authSlice";
import { useAppDispatch } from "@/store/hooks";
import { Button, Form, Input, notification } from "antd";
import type { FormProps } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type FieldType = {
  email?: string;
  password?: string;
};

export default function LoginForm() {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const onFinish: FormProps<FieldType>["onFinish"] = async (values) => {
    if (!values.email || !values.password) return;

    setLoading(true);
    try {
      const { user, tokens } = await login(values.email, values.password);
      tokenManager.setAccessToken(tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      dispatch(setUser(user));
      navigate("/");
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setErrorMessage("Неверный email или пароль");
        return;
      }
      notification.error({ message: "Ошибка. Попробуйте позже" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      name="login"
      onFinish={onFinish}
      autoComplete="off"
      layout="vertical"
      size="large"
      requiredMark={false}
    >
      <Form.Item<FieldType>
        label="Email"
        name="email"
        rules={[{ required: true, message: "Введите email" }]}
        validateStatus={errorMessage ? "error" : undefined}
        help={errorMessage || undefined}
      >
        <Input prefix={<MailOutlined />} placeholder="you@company.dev" />
      </Form.Item>

      <Form.Item<FieldType>
        label="Пароль"
        name="password"
        rules={[{ required: true, message: "Введите пароль" }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Войти
        </Button>
      </Form.Item>
    </Form>
  );
}
