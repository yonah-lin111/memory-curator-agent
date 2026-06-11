/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Image } from "@/components/ui/Image";

describe("Image Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a loading skeleton initially", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    expect(screen.getByTestId("image-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("image-error")).not.toBeInTheDocument();
  });

  it("removes skeleton on successful image load", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");
    expect(screen.getByTestId("image-skeleton")).toBeInTheDocument();

    fireEvent.load(img);
    expect(screen.queryByTestId("image-skeleton")).not.toBeInTheDocument();
  });

  it("renders error state when image fails to load", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");

    fireEvent.error(img);
    expect(screen.queryByTestId("image-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("image-error")).toBeInTheDocument();
  });

  it("opens premium lightbox preview when image is clicked and preview is enabled", () => {
    render(<Image src="test-pic.png" alt="Test Pic" preview={true} />);
    const img = screen.getByAltText("Test Pic");

    // 加载完成
    fireEvent.load(img);

    // 未开启前预览 lightbox 不应存在
    expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();

    // 点击图片
    fireEvent.click(img);

    // Lightbox 被渲染
    expect(screen.getByTestId("image-lightbox")).toBeInTheDocument();
  });

  it("does not open preview when clicked if preview is disabled", () => {
    render(<Image src="test-pic.png" alt="Test Pic" preview={false} />);
    const img = screen.getByAltText("Test Pic");
    fireEvent.load(img);

    fireEvent.click(img);
    expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();
  });

  it("can close lightbox preview via Close button and Escape key", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");
    fireEvent.load(img);

    fireEvent.click(img);
    expect(screen.getByTestId("image-lightbox")).toBeInTheDocument();

    // 点击关闭按钮
    const closeBtn = screen.getByLabelText("Close preview");
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();

    // 重新打开并按下 Esc 键
    fireEvent.click(img);
    expect(screen.getByTestId("image-lightbox")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("image-lightbox")).not.toBeInTheDocument();
  });

  it("can control scaling and rotation via premium toolbar buttons", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");
    fireEvent.load(img);

    fireEvent.click(img);

    const lightboxImg = screen.getByTestId("lightbox-img");
    expect(lightboxImg.style.transform).toBe("scale(1) rotate(0deg)");

    // 点击放大
    const zoomInBtn = screen.getByLabelText("Zoom in");
    fireEvent.click(zoomInBtn);
    expect(lightboxImg.style.transform).toBe("scale(1.25) rotate(0deg)");

    // 点击缩小
    const zoomOutBtn = screen.getByLabelText("Zoom out");
    fireEvent.click(zoomOutBtn);
    expect(lightboxImg.style.transform).toBe("scale(1) rotate(0deg)");

    // 点击旋转
    const rotateBtn = screen.getByLabelText("Rotate");
    fireEvent.click(rotateBtn);
    expect(lightboxImg.style.transform).toBe("scale(1) rotate(90deg)");
  });
});
