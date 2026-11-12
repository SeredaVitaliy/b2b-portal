import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Space,
  Tree,
  Typography,
  message,
} from "antd";
import type { TreeProps } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@b2b/shared";
import { getCategories } from "@/api/ProductApi";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/api/CategoryApi";
import { useAppSelector } from "@/store/hooks";

const CATEGORIES_KEY = ["categories"];

// Понятный текст ошибки с сервера (например, запрет удаления непустой категории).
function serverMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

type ModalState =
  | { mode: "create"; parentId: number | null; parentName?: string }
  | { mode: "rename"; id: number }
  | null;

interface TreeNode {
  key: number;
  title: ReactNode;
  children: TreeNode[];
}

export default function CategoriesPage() {
  const user = useAppSelector((s) => s.auth.user);
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: getCategories,
  });

  const [modal, setModal] = useState<ModalState>(null);
  const [name, setName] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });

  const createMut = useMutation({
    mutationFn: (body: { name: string; parentId: number | null }) =>
      createCategory(body),
    onSuccess: () => {
      message.success("Категория создана");
      invalidate();
    },
    onError: (e) => message.error(serverMessage(e, "Не удалось создать")),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: number; name: string }) =>
      updateCategory(v.id, { name: v.name }),
    onSuccess: () => {
      message.success("Переименовано");
      invalidate();
    },
    onError: (e) => message.error(serverMessage(e, "Не удалось переименовать")),
  });

  // Перемещение: PATCH parentId. Бэк отвергает цикл — тогда показываем ошибку
  // и инвалидируем кеш (дерево вернётся к серверному состоянию).
  const moveMut = useMutation({
    mutationFn: (v: { id: number; parentId: number | null }) =>
      updateCategory(v.id, { parentId: v.parentId }),
    onSuccess: invalidate,
    onError: (e) => {
      message.error(serverMessage(e, "Не удалось переместить"));
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      message.success("Категория удалена");
      invalidate();
    },
    onError: (e) => message.error(serverMessage(e, "Не удалось удалить")),
  });

  function renderTitle(c: Category): ReactNode {
    return (
      <Space>
        <span>{c.name}</span>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          title="Добавить подкатегорию"
          onClick={(e) => {
            e.stopPropagation();
            setName("");
            setModal({ mode: "create", parentId: c.id, parentName: c.name });
          }}
        />
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          title="Переименовать"
          onClick={(e) => {
            e.stopPropagation();
            setName(c.name);
            setModal({ mode: "rename", id: c.id });
          }}
        />
        <Popconfirm
          title="Удалить категорию?"
          okText="Да"
          cancelText="Нет"
          onConfirm={() => deleteMut.mutate(c.id)}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            title="Удалить"
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      </Space>
    );
  }

  // Плоский список → дерево по parentId (бэк уже отсортировал по имени).
  const treeData = useMemo<TreeNode[]>(() => {
    const byId = new Map<number, TreeNode>();
    categories.forEach((c) =>
      byId.set(c.id, { key: c.id, title: renderTitle(c), children: [] }),
    );
    const roots: TreeNode[] = [];
    categories.forEach((c) => {
      const node = byId.get(c.id)!;
      if (c.parentId !== null && byId.has(c.parentId)) {
        byId.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
    // renderTitle стабилен по смыслу; пересобираем дерево при смене списка
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const onDrop: TreeProps["onDrop"] = (info) => {
    const dragId = Number(info.dragNode.key);
    const dropId = Number(info.node.key);
    let newParentId: number | null;
    if (!info.dropToGap) {
      // бросили НА узел → стать его ребёнком
      newParentId = dropId;
    } else {
      // бросили в зазор рядом с узлом → стать его соседом (тот же родитель)
      const dropCat = categories.find((c) => c.id === dropId);
      newParentId = dropCat ? dropCat.parentId : null;
    }
    moveMut.mutate({ id: dragId, parentId: newParentId });
  };

  const handleModalOk = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.warning("Введите название");
      return;
    }
    if (modal?.mode === "create") {
      createMut.mutate({ name: trimmed, parentId: modal.parentId });
    } else if (modal?.mode === "rename") {
      renameMut.mutate({ id: modal.id, name: trimmed });
    }
    setModal(null);
  };

  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <Empty
        description="Раздел доступен только менеджерам и администраторам"
        style={{ padding: 60 }}
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Категории
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setName("");
            setModal({ mode: "create", parentId: null });
          }}
        >
          Корневая категория
        </Button>
      </div>

      <Typography.Paragraph type="secondary">
        Перетащите категорию, чтобы сменить родителя. Удалить можно только
        пустую (без подкатегорий и товаров).
      </Typography.Paragraph>

      {isLoading ? null : categories.length === 0 ? (
        <Empty description="Категорий пока нет" style={{ padding: 60 }} />
      ) : (
        <Tree
          draggable
          blockNode
          selectable={false}
          defaultExpandAll
          treeData={treeData}
          onDrop={onDrop}
        />
      )}

      <Modal
        open={modal !== null}
        title={
          modal?.mode === "rename"
            ? "Переименовать категорию"
            : modal?.parentName
              ? `Подкатегория в «${modal.parentName}»`
              : "Новая корневая категория"
        }
        onOk={handleModalOk}
        onCancel={() => setModal(null)}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Input
          placeholder="Название категории"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleModalOk}
          autoFocus
        />
      </Modal>
    </div>
  );
}
