import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the Casefolio title and tagline", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Casefolio" })).toBeInTheDocument();
    expect(
      screen.getByText("Build polished UI case studies in minutes."),
    ).toBeInTheDocument();
  });
});
