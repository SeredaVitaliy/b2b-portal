import { createTemplate } from "@/api/TemplateApi";
import { CreateOrderTemplateItem } from "@b2b/shared";
import { Button, Input, Modal, message } from "antd";
import { useState, type MouseEvent } from "react";

interface Props {
  // Позиции, которые уйдут в шаблон (например, order.items). Бэку нужны только
  // id товара и количество — цену и имя он проставит/снимет сам.
  items: CreateOrderTemplateItem[];
  // Подставить в поле имени при открытии (например, «Заказ №12»).
  defaultName?: string;
  // Текст кнопки.
  label?: string;
  size?: "small" | "middle" | "large";
  type?: "default" | "primary" | "dashed" | "link" | "text";
  // Кнопка может стоять внутри кликабельной карточки-ссылки (список заказов):
  // тогда гасим всплытие, чтобы клик открывал модалку, а не переходил по ссылке.
  stopPropagation?: boolean;
  style?: React.CSSProperties;
}

// Переиспользуемая кнопка «Сохранить как шаблон»: открывает модалку с именем и
// сохраняет переданные позиции через готовый createTemplate. Используется там,
// где состав уже готов (детали заказа, список заказов) — бэкенд не трогаем.
export default function SaveAsTemplateButton({
  items,
  defaultName = "",
  label = "Сохранить как шаблон",
  size = "middle",
  type = "default",
  stopPropagation = false,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [isSaving, setIsSaving] = useState(false);

  const openModal = (e: MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    setName(defaultName);
    setOpen(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.warning("Введите название шаблона");
      return;
    }
    if (items.length === 0) {
      message.warning("Нет позиций для шаблона");
      return;
    }
    setIsSaving(true);
    try {
      await createTemplate(trimmed, items);
      message.success("Шаблон сохранён");
      setOpen(false);
    } catch {
      message.error("Не удалось сохранить шаблон");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button size={size} type={type} onClick={openModal} style={style}>
        {label}
      </Button>
      <Modal
        title="Новый шаблон закупки"
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        confirmLoading={isSaving}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Input
          placeholder="Например: Еженедельная закупка"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleSave}
        />
      </Modal>
    </>
  );
}
