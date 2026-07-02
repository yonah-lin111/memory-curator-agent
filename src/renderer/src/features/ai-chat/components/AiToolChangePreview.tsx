import React, { useState, useRef } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Tag } from "@/components/ui/Tag";

type OperationType =
  | "add"
  | "update"
  | "delete"
  | "batch_add"
  | "batch_update"
  | "batch_delete"
  | "unknown";

export type AiToolChangePreviewProps = {
  toolName: string;
  input: unknown;
  isGenerating?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseOperationType = (toolName: string): OperationType => {
  if (toolName.endsWith("_batch_add")) return "batch_add";
  if (toolName.endsWith("_batch_update")) return "batch_update";
  if (toolName.endsWith("_batch_delete")) return "batch_delete";
  if (toolName.endsWith("_add")) return "add";
  if (toolName.endsWith("_update")) return "update";
  if (toolName.endsWith("_delete")) return "delete";
  return "unknown";
};

const extractDomain = (toolName: string): string => {
  const parts = toolName.split("_tool_");
  return parts.length > 1 ? parts[0] : "";
};

const getBriefSummary = (input: unknown): string => {
  if (!isRecord(input) || typeof input.confirmationSummary !== "string") {
    return "";
  }
  // 取第一行，保持简短
  let text = input.confirmationSummary.split("\n")[0];
  // 移除 markdown 格式 (如 **, *, _, ` 等)
  text = text.replace(/[*_~`]/g, "");
  // 移除结尾的句号
  text = text.trim().replace(/[。.]*$/, "");
  return text;
};

const DOMAIN_FIELD_LABELS: Record<string, Record<string, string>> = {
  common: {
    id: "编号",
    title: "标题",
    content: "内容",
    text: "事项",
    tags: "标签",
    entryDate: "日期",
    priority: "优先级",
    completed: "已完成",
    name: "姓名",
    gender: "性别",
    relationship: "关系",
    status: "状态",
    birthday: "生日",
    contact: "联系方式",
    avatar: "头像",
    details: "详情",
    amount: "金额",
    category: "类别",
    billType: "收支类型",
    note: "备注",
    sortOrder: "排序",
    categoryId: "分类编号",
    billDate: "账单日期",
  },
};

const getFieldLabel = (domain: string, field: string): string => {
  const domainLabels = DOMAIN_FIELD_LABELS[domain] || {};
  if (domainLabels[field]) return domainLabels[field];
  if (DOMAIN_FIELD_LABELS.common[field]) return DOMAIN_FIELD_LABELS.common[field];
  return field.charAt(0).toUpperCase() + field.slice(1);
};

const TruncatedText = ({ text, maxLength = 100 }: { text: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }

  if (expanded) {
    return (
      <div className="flex flex-col items-start">
        <span>{text}</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-white/45 hover:text-white mt-0.5 text-[11px] underline underline-offset-2"
        >
          收起
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start">
      <span>{text.slice(0, maxLength)}...</span>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-white/45 hover:text-white mt-0.5 text-[11px] underline underline-offset-2"
      >
        展开全部
      </button>
    </div>
  );
};

const formatValue = (key: string, value: unknown): React.ReactNode => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") {
    return (
      <Tag
        size="small"
        color={value ? "emerald" : "amber"}
        bgClass={value ? "bg-emerald-500/10" : "bg-amber-500/10"}
      >
        {value ? "是" : "否"}
      </Tag>
    );
  }
  if (typeof value === "number") {
    if (key === "amount") return `${(value / 100).toFixed(2)} 元`;
    return String(value);
  }
  if (typeof value === "string") {
    if (value.length === 0) return null;
    if (key === "billType") {
      return value === "expense" ? "支出" : value === "income" ? "收入" : value;
    }
    return <TruncatedText text={value} maxLength={100} />;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-white/25">无</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <Tag key={i} size="small" color="default" bgClass="border-white/10 bg-white/5 text-white/60">
            {String(v)}
          </Tag>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return <span className="text-white/45 italic">{'<Object>'}</span>;
  }
  return String(value);
};

export const AiToolChangePreview = ({ toolName, input, isGenerating = false }: AiToolChangePreviewProps): React.JSX.Element | null => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!input) return null;

  const operationType = parseOperationType(toolName);
  const domain = extractDomain(toolName);

  const getOperationBadge = (type: OperationType) => {
    switch (type) {
      case "add":
      case "batch_add":
        return <span className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400">新增</span>;
      case "update":
      case "batch_update":
        return <span className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-400">编辑</span>;
      case "delete":
      case "batch_delete":
        return <span className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-400">删除</span>;
      default:
        return null;
    }
  };

  const renderSingleItem = (itemInput: Record<string, unknown>) => {
    const fields = Object.entries(itemInput).filter(([k, v]) => k !== "confirmationSummary" && v !== null && v !== undefined && v !== "");
    if (fields.length === 0) return <div className="text-white/35 text-[12px]">无可用字段数据</div>;

    const topFields = fields.slice(0, 6);
    const hasMore = fields.length > 6;

    return (
      <div className="flex flex-col gap-1.5">
        {topFields.map(([key, val]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="text-[12px] text-white/35 font-medium flex-shrink-0 min-w-[64px]">
              {getFieldLabel(domain, key)}
            </span>
            <div className="text-[12px] text-white/60 leading-relaxed break-all min-w-0 flex-1">
              {key === "id" ? <span className="font-mono text-white/50">{String(val)}</span> : formatValue(key, val)}
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="text-[11px] text-white/35 italic mt-1">
            还有 {fields.length - 6} 个字段...
          </div>
        )}
      </div>
    );
  };

  const renderBatchItems = (items: unknown[], type: OperationType) => {
    if (!items || items.length === 0) return <div className="text-white/35 text-[12px]">空列表</div>;

    return (
      <div className="flex flex-col">
        {items.slice(0, 10).map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1 py-2 border-b border-white/[0.05] last:border-b-0 last:pb-0 first:pt-0">
            {type === "batch_delete" || typeof item !== "object" ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-white/35 font-medium flex-shrink-0 min-w-[64px]">编号</span>
                <span className="font-mono text-[12px] text-white/50">{String(item)}</span>
              </div>
            ) : (
              renderSingleItem(item as Record<string, unknown>)
            )}
          </div>
        ))}
        {items.length > 10 && (
          <div className="text-[11px] text-white/35 italic pt-2 text-center border-t border-white/[0.05]">
            及另外 {items.length - 10} 项...
          </div>
        )}
      </div>
    );
  };

  let content: React.ReactNode = null;
  let batchCount = 0;

  if (isRecord(input)) {
    if (operationType.startsWith("batch_")) {
      const items = Array.isArray(input.items) ? input.items : Array.isArray(input.ids) ? input.ids : [];
      batchCount = items.length;
      content = renderBatchItems(items, operationType);
    } else {
      content = renderSingleItem(input);
    }
  } else {
    content = <pre className="text-[11px] text-white/45 font-mono overflow-x-auto">{JSON.stringify(input, null, 2)}</pre>;
  }

  const summaryText = getBriefSummary(input);

  return (
    <div className="flex flex-col min-w-0">
      {/* 头部 */}
      <div
        className="flex items-start gap-1 text-xs leading-relaxed text-white/45 cursor-pointer hover:text-white/60 transition-colors select-none group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="inline-flex items-center justify-center w-3 h-[1.625em] flex-shrink-0 select-none">
          <svg className="w-3 h-3 stroke-current" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 1v5h7"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 mt-[1px]" data-testid="tool-operation-summary">
          {summaryText ? (
            <span className="text-[12px] font-medium text-white/70 truncate">{summaryText}</span>
          ) : (
            <>
              {getOperationBadge(operationType)}
              {domain && <span className="text-[12px] font-medium text-white/70">{domain}</span>}
              {operationType.startsWith("batch_") && batchCount > 0 && (
                <span className="text-[11px] text-white/45 bg-white/5 px-1.5 py-0.5 rounded-[4px]">{batchCount} 项</span>
              )}
            </>
          )}
          {isGenerating && (
            <span className="relative flex h-1.5 w-1.5 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white/50"></span>
            </span>
          )}
          <div className="flex items-center justify-center text-white/35 ml-1 group-hover:text-white/60 transition-colors">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        </div>
      </div>

      {/* 内容 */}
      <div
        style={{
          maxHeight: isExpanded ? "40vh" : "0px",
          opacity: isExpanded ? 1 : 0,
          transition: "max-height 0.25s cubic-bezier(0.2, 0.85, 0.2, 1), opacity 0.25s cubic-bezier(0.2, 0.85, 0.2, 1)",
        }}
        className="overflow-hidden flex"
      >
        <div ref={containerRef} className="pl-4 pt-1 pb-1 flex-1 min-w-0">
          <div className="rounded-[4px] py-1 inline-block min-w-0 max-w-full">
            <div className="max-h-[calc(40vh-16px)] overflow-y-scroll overflow-x-hidden custom-scrollbar pr-2 min-w-0 break-words">
              {content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
