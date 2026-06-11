/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewableImage } from "@/components/ui/PreviewableImage";

describe("PreviewableImage", () => {
  it("renders a thumbnail and opens preview", () => {
    render(
      <PreviewableImage
        alt="diagram.png"
        src="mc-img://chat/diagram.png"
        variant="thumbnail"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "预览图片 diagram.png" }));

    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
    expect(screen.getAllByAltText("diagram.png").length).toBeGreaterThanOrEqual(1);
  });

  it("calls remove when delete is clicked", () => {
    const onRemove = vi.fn();
    render(
      <PreviewableImage
        alt="shot.png"
        src="mc-img://chat/shot.png"
        variant="thumbnail"
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "移除图片 shot.png" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
