import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart } from "../src/components/charts/BarChart";
import { LineChart } from "../src/components/charts/LineChart";

describe("BarChart", () => {
  it("menampilkan bar untuk setiap data", () => {
    const { container } = render(
      <BarChart
        data={[
          { label: "Dimuat", value: 100 },
          { label: "Sudah ditebar", value: 25 },
          { label: "Sisa", value: 75 },
        ]}
        format={(value) => `${value}%`}
      />,
    );
    expect(container.querySelectorAll(".barchart-col")).toHaveLength(3);
    expect(screen.getByText("Dimuat")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("menampilkan pesan kosong bila semua nilai nol", () => {
    render(<BarChart data={[{ label: "Sisa", value: 0 }]} emptyText="Belum ada benih" />);
    expect(screen.getByText("Belum ada benih")).toBeInTheDocument();
  });
});

describe("LineChart", () => {
  it("menggambar garis dari data telemetri", () => {
    const { container } = render(
      <LineChart
        series={[{ label: "Baterai", values: [90, 85, 80], color: "#0af" }]}
        labels={["10:00", "10:01", "10:02"]}
        height={100}
      />,
    );
    expect(container.querySelectorAll(".chart-svg path")).toHaveLength(1);
    expect(container.querySelector(".chart-svg")).toBeTruthy();
  });

  it("menampilkan pesan kosong bila data kurang dari dua", () => {
    render(<LineChart series={[{ label: "Baterai", values: [90], color: "#0af" }]} />);
    expect(screen.getByText("Belum ada data")).toBeInTheDocument();
  });
});
