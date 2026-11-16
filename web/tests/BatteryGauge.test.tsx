import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BatteryGauge } from "../src/components/telemetry/BatteryGauge";

describe("BatteryGauge", () => {
  it("menampilkan persentase sisa", () => {
    render(<BatteryGauge percent={50} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
