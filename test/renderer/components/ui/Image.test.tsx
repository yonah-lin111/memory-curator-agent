/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("can drag and translate the lightbox image", () => {
    const setPointerCaptureMock = vi.fn();
    const releasePointerCaptureMock = vi.fn();

    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");
    fireEvent.load(img);

    fireEvent.click(img);

    const lightboxImg = screen.getByTestId("lightbox-img");
    lightboxImg.setPointerCapture = setPointerCaptureMock;
    lightboxImg.releasePointerCapture = releasePointerCaptureMock;

    expect(lightboxImg.style.transform).toBe("scale(1) rotate(0deg)");

    // 开始拖拽
    fireEvent.pointerDown(lightboxImg, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(setPointerCaptureMock).toHaveBeenCalledWith(1);

    // 移动指针
    fireEvent.pointerMove(lightboxImg, { clientX: 150, clientY: 180 });
    expect(lightboxImg.style.transform).toBe("translate(50px, 80px) scale(1) rotate(0deg)");

    // 结束拖拽
    fireEvent.pointerUp(lightboxImg, { pointerId: 1 });
    expect(releasePointerCaptureMock).toHaveBeenCalledWith(1);
  });

  it("can zoom the image via mouse wheel", () => {
    render(<Image src="test-pic.png" alt="Test Pic" />);
    const img = screen.getByAltText("Test Pic");
    fireEvent.load(img);

    fireEvent.click(img);

    const lightboxImg = screen.getByTestId("lightbox-img");
    expect(lightboxImg.style.transform).toBe("scale(1) rotate(0deg)");

    // 向上滚动鼠标滚轮（放大）
    fireEvent.wheel(lightboxImg.parentElement!, { deltaY: -100 });
    expect(lightboxImg.style.transform).toBe("scale(1.1) rotate(0deg)");

    // 向下滚动鼠标滚轮（缩小）
    fireEvent.wheel(lightboxImg.parentElement!, { deltaY: 100 });
    expect(lightboxImg.style.transform).toBe("scale(1) rotate(0deg)");
  });

  it("does not apply aspectRatio style when auto or not specified", () => {
    const { container } = render(<Image src="test-pic.png" alt="Test Pic" />);
    const wrapper = container.querySelector("div");
    expect(wrapper?.style.aspectRatio).toBe("");
  });

  it("applies correct aspect ratio style for predefined values", () => {
    const { container: containerSquare } = render(
      <Image src="test-pic.png" alt="Test Pic" aspectRatio="square" />
    );
    const wrapperSquare = containerSquare.querySelector("div");
    expect(wrapperSquare?.style.aspectRatio).toMatch(/^1(\s*\/\s*1)?$/);

    cleanup();

    const { container: containerVideo } = render(
      <Image src="test-pic.png" alt="Test Pic" aspectRatio="video" />
    );
    const wrapperVideo = containerVideo.querySelector("div");
    expect(wrapperVideo?.style.aspectRatio).toMatch(/^(1\.7777\d+|16\s*\/\s*9)(\s*\/\s*1)?$/);
  });

  it("applies custom numeric aspect ratio styles", () => {
    const { container } = render(
      <Image src="test-pic.png" alt="Test Pic" aspectRatio={4 / 3} />
    );
    const wrapper = container.querySelector("div");
    expect(wrapper?.style.aspectRatio).toMatch(/^1\.3333\d+(\s*\/\s*1)?$/);
  });
});
