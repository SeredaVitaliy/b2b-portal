import { ChangeField, ProductChange } from "@b2b/shared";
import { useState } from "react";
import dayjs from "dayjs";
import { DatePicker, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { ColumnsType } from "antd/es/table";
import { getPriceHistory } from "@/api/HistoryApi";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/order";

interface Props {
  productId: number | null;
  productName?: string;
  onClose: () => void;
}

const PAGE_SIZE = 10;

const fieldMeta: Record<ChangeField, { label: string; color: string }> = {
  price: { label: "Цена", color: "blue" },
  stock: { label: "Остаток", color: "gold" },
};

function formatValue(field: ChangeField, value: number): string {
  return field === "price" ? `${value.toFixed(2)} ₽` : String(value);
}

export default function ChangeHistoryModal({
  productId,
  productName,
  onClose,
}: Props) {
  const [field, setField] = useState<ChangeField | undefined>(undefined);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);
  const open = productId !== null;
  const from = range ? range[0].format("YYYY-MM-DD") : undefined;
  const to = range ? range[1].format("YYYY-MM-DD") : undefined;

  const { data, isFetching } = useQuery({
    queryKey: ["price-history", productId, field, from, to, page],
    queryFn: () =>
      getPriceHistory({
        productId: productId!,
        field,
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const columns: ColumnsType<ProductChange> = [
    {
      title: "Когда",
      dataIndex: "changedAt",
      width: 150,
      render: (ts: number) => formatDateTime(ts),
    },
    { title: "Кто", dataIndex: "userName", width: 150 },
    {
      title: "Тип",
      dataIndex: "field",
      width: 100,
      render: (f: ChangeField) => (
        <Tag color={fieldMeta[f].color}>{fieldMeta[f].label}</Tag>
      ),
    },
    {
      title: "Было → Стало",
      key: "diff",
      render: (_, r) => {
        const up = r.newValue > r.oldValue;
        return (
          <Space size={4}>
            <Typography.Text delete type="secondary">
              {formatValue(r.field, r.oldValue)}
            </Typography.Text>
            <Typography.Text type="secondary">{up ? "↑" : "↓"}</Typography.Text>
            <Typography.Text
              strong
              style={{
                background: "#fffbe6",
                padding: "0 4px",
                borderRadius: 4,
              }}
            >
              {formatValue(r.field, r.newValue)}
            </Typography.Text>
          </Space>
        );
      },
    },
  ];

  const handleClose = () => {
    setField(undefined);
    setRange(null);
    setPage(1);
    onClose();
  };

  return (
    <Modal
      title={`История изменений — ${productName ?? ""}`}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={760}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear
          placeholder="Тип изменения"
          style={{ width: 170 }}
          value={field}
          onChange={(v) => {
            setField(v);
            setPage(1);
          }}
          options={[
            { value: "price", label: "Цена" },
            { value: "stock", label: "Остаток" },
          ]}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null);
            setPage(1);
          }}
        />
      </Space>

      <Table<ProductChange>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isFetching}
        locale={{ emptyText: "Изменений нет" }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onChange: setPage,
          showSizeChanger: false,
        }}
      />
    </Modal>
  );
}
