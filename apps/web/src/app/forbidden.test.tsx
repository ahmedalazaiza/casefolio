import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForbiddenPage from "@/app/forbidden";

describe("Forbidden 403 boundary page (C-202)", () => {
  it("renders token-styled 403 Access restricted message and recovery links", () => {
    render(<ForbiddenPage />);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Access restricted" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Help center" })).toHaveAttribute("href", "/help");
  });
});
