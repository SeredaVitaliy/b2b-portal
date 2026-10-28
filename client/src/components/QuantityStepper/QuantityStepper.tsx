import { Button, InputNumber, Space } from "antd";
import { MinusOutlined, PlusOutlined } from "@ant-design/icons";

interface Props {
  value: number;
  min: number;
  step?: number;
  onChange: (value: number) => void;
}

export default function QuantityStepper({
  value,
  min,
  step = 1,
  onChange,
}: Props) {
  const clamp = (v: number | null) => Math.max(min, Math.round(v ?? min));

  return (
    <Space.Compact>
      <Button
        icon={<MinusOutlined />}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      />
      <InputNumber
        min={min}
        step={step}
        precision={0}
        controls={false}
        value={value}
        onChange={(v) => onChange(clamp(v))}
        style={{ width: 56 }}
      />
      <Button icon={<PlusOutlined />} onClick={() => onChange(value + step)} />
    </Space.Compact>
  );
}
