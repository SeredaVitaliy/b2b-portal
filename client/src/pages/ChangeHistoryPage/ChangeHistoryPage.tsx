import { useState } from "react";
import { DatePicker, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { ChangeField, ProductChange } from "@b2b/shared";
import { getPriceHistory } from "@/api/HistoryApi";
import { formatDateTime } from "@/lib/order";

const PAGE_SIZE = 20;

const fieldMeta: Record<ChangeField, { label: string; color: string }> = {
  price: { label: "Цена", color: "blue" },
  stock: { label: "Остаток", color: "gold" },
};

// Цена — с 2 знаками и ₽, остаток — целым.
function formatValue(field: ChangeField, value: number): string {
  return field === "price" ? `${value.toFixed(2)} ₽` : String(value);
}

export default function ChangeHistoryPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [field, setField] = useState<ChangeField | undefined>(undefined);
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage] = useState(1);

  const from = range ? range[0].format("YYYY-MM-DD") : undefined;
  const to = range ? range[1].format("YYYY-MM-DD") : undefined;

  const { data, isFetching } = useQuery({
    queryKey: ["price-history", "all", search, field, from, to, page],
    queryFn: () =>
      getPriceHistory({
        search: search.trim() || undefined,
        field,
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnsType<ProductChange> = [
    {
      title: "Когда",
      dataIndex: "changedAt",
      width: 150,
      render: (ts: number) => formatDateTime(ts),
    },
    {
      title: "Товар",
      key: "product",
      render: (_, r) => (
        <div style={{ minWidth: 0 }}>
          <Typography.Text>{r.productName}</Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ display: "block", fontSize: 12 }}
          >
            Арт. {r.sku}
          </Typography.Text>
        </div>
      ),
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

  return (
    <div>
      <Typography.Title level={2}>История изменений</Typography.Title>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="Поиск по артикулу или названию"
          style={{ width: 300 }}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            if (e.target.value === "") {
              setSearch("");
              setPage(1);
            }
          }}
          onSearch={(val) => {
            setSearch(val);
            setPage(1);
          }}
        />
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
    </div>
  );
}
