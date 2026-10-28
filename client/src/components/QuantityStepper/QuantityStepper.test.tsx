import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuantityStepper from "./QuantityStepper";

describe("QuantityStepper", () => {
  it("показывает текущее значение", () => {
    render(<QuantityStepper value={7} min={5} onChange={() => {}} />);

    expect(screen.getByDisplayValue("7")).toBeInTheDocument();
  });

  it("минус заблокирован, когда значение равно минимуму", () => {
    render(<QuantityStepper value={5} min={5} onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "minus" })).toBeDisabled();
  });

  it("клик по плюсу зовёт onChange со значением +1", async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} min={5} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "plus" }));

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("клик по минусу выше минимума зовёт onChange со значением −1", async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={8} min={5} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "minus" }));

    expect(onChange).toHaveBeenCalledWith(7);
  });
});
