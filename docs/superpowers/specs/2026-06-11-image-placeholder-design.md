# Image 预占位容器设计规范 (Image Placeholder Container Design Spec)

本文档定义了在 Memory Curator Agent 项目中为公共 UI 组件 Image 添加预占位（Aspect Ratio & Skeleton）容器的设计方案与实现路径。

## 1. 业务背景与目的
在 AI 对话和微缩图片预览等业务场景中，图片文件的拉取与加载通常需要一定的时间。如果外层容器仅指定了宽度（如 `w-14` / `w-16` / `w-full`），而在图片尚未完全载入时高度变为 `0`，则在图片最终渲染的一瞬间，会导致界面产生明显的向下跳变和闪烁（Layout Shift / 布局抖动）。

为了提升应用的交互质感，我们为公共 UI 组件 `Image` 设计了支持自适应纵横比的预占位包裹容器（Placeholder Wrapper）。该包裹容器根据设定的 `aspectRatio` 在图片加载前精确撑开其对应的高宽，实现 0 抖动的淡入过渡加载。

## 2. 核心架构与功能设计

### 2.1 Image 组件接口 (ImageProps)
组件位于 `@/components/ui/Image.tsx`。我们将扩展 `ImageProps` 接口：

```typescript
export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  // 图片地址
  src: string;
  // 图片描述占位
  alt?: string;
  // 是否支持点击全屏预览
  preview?: boolean;
  // 预设纵横比，支持 "square" (1:1) | "video" (16:9) | "auto" | 自定义数字比例（如 4/3）
  aspectRatio?: "square" | "video" | "auto" | number;
}
```

### 2.2 纵横比渲染计算与包裹机制
在 `Image.tsx` 中，我们通过一个专用的辅助函数解析并获取 CSS `aspectRatio`：

```typescript
const getAspectRatioStyle = (): React.CSSProperties => {
  if (!aspectRatio || aspectRatio === "auto") return {};
  if (aspectRatio === "square") return { aspectRatio: 1 };
  if (aspectRatio === "video") return { aspectRatio: 16 / 9 };
  return { aspectRatio };
};
```

包裹容器 `div` 的结构：
```tsx
<div
  className={`relative overflow-hidden rounded-[6px] bg-white/[0.02] border border-white/5 group/img-box ${className}`}
  style={getAspectRatioStyle()}
>
  {loading && (
    <div
      data-testid="image-skeleton"
      className="absolute inset-0 bg-white/[0.05] animate-pulse rounded-[6px]"
    />
  )}
  <img
    src={src}
    alt={alt}
    onLoad={() => setLoading(false)}
    onError={() => {
      setLoading(false);
      setError(true);
    }}
    onClick={handleImageClick}
    className={`h-full w-full object-cover transition-all duration-300 ${
      loading ? "opacity-0" : "opacity-100"
    } ${error ? "hidden" : ""} ${
      preview && !error ? "cursor-zoom-in hover:scale-105" : ""
    }`}
    {...props}
  />
  ...
</div>
```

通过这一层样式控制，骨架屏（Skeleton）作为 `absolute inset-0` 的子元素，会立刻填满具有明确宽高比或确定尺寸的外层 `div`，彻底杜绝布局跳变。

## 3. 业务文件集成与验证

1. **`AiChatInput.tsx`** (微缩预览)
   预览图片目前使用了 `className="w-full h-full rounded-[6px] object-cover"`，其父级包裹框已经限定了 `w-14 h-14`，属于天然固定的正方形容器。我们将验证其过渡和渐显效果。
2. **`AiChatMessageBubble.tsx`** (气泡图)
   消息图片的 `Image` 传入了 `className="w-16 h-16 rounded-[6px] border border-white/5 shadow-md shrink-0 object-cover"`。通过将其 `className` 的宽和高约束传达给外层包裹容器，无需做额外改动即可实现无缝的 `1:1` 预占位骨架屏。

## 4. 单元测试更新 (`Image.test.tsx`)
我们需要在 `test/renderer/components/ui/Image.test.tsx` 中补充相关测试用例，涵盖：
* 验证默认渲染和 `aspectRatio="square"` 时的 `style` 控制；
* 验证 `aspectRatio="video"` 和自定义数字时的 `style` 控制；
* 保证既有全屏预览、缩放旋转等交互测试全部持续通过。
