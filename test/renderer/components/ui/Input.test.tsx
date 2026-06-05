/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/Input";

describe("Input Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders input element by default with correct styles", () => {
    render(<Input placeholder="Test input" />);
    const input = screen.getByPlaceholderText("Test input");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveClass("bg-[#303030]");
    expect(input).toHaveClass("text-sm");
  });

  it("renders textarea element when as='textarea' is provided", () => {
    render(<Input as="textarea" placeholder="Test textarea" />);
    const textarea = screen.getByPlaceholderText("Test textarea");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveClass("bg-[#303030]");
    expect(textarea).toHaveClass("min-h-24");
    expect(textarea).toHaveClass("resize-none");
  });

  it("applies correct xs size styles", () => {
    render(<Input size="xs" placeholder="XS input" />);
    const input = screen.getByPlaceholderText("XS input");
    expect(input).toHaveClass("text-xs");
  });

  it("propagates change events correctly", async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText("Type here") as HTMLInputElement;
    
    await user.type(input, "hello");
    expect(input.value).toBe("hello");
  });

  it("renders as a tag input layout and allows adding/removing tags", async () => {
    const user = userEvent.setup();
    const onChangeTags = vi.fn();
    const tags = ["react", "vite"];

    render(
      <Input
        as="tags"
        tags={tags}
        onChangeTags={onChangeTags}
        placeholder="Add tags..."
      />
    );

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("vite")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Add tags...") as HTMLInputElement;
    await user.type(input, "jest{enter}");

    expect(onChangeTags).toHaveBeenCalledWith(["react", "vite", "jest"]);
  });

  it("renders with prefix and suffix slots", () => {
    render(
      <Input
        placeholder="Input with slots"
        prefix={<span data-testid="prefix-slot">Pre</span>}
        suffix={<span data-testid="suffix-slot">Post</span>}
      />
    );
    expect(screen.getByTestId("prefix-slot")).toBeInTheDocument();
    expect(screen.getByTestId("suffix-slot")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Input with slots")).toBeInTheDocument();
  });

  it("renders as autosize textarea", () => {
    render(
      <Input
        as="textarea"
        autosize
        placeholder="Autosize textarea"
        value="Lines of text"
        onChange={() => {}}
      />
    );
    const textarea = screen.getByPlaceholderText("Autosize textarea") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveClass("absolute");
    expect(textarea.value).toBe("Lines of text");
  });
});
