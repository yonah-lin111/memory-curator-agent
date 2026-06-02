import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
  SendHorizonal,
} from "lucide-react";

// Ask 选项。
export type AiAskOption = {
  // 选项标签。
  label: string;
  // 选项说明。
  description: string;
};

// Ask 问题。
export type AiAskQuestion = {
  // 问题短标题。
  header: string;
  // 需要用户回答的问题。
  question: string;
  // 预设选项列表。
  options: AiAskOption[];
  // 是否允许多选。
  multiple?: boolean;
  // 是否允许自定义输入。
  custom?: boolean;
};

// Ask 请求。
export type AiAskRequest = {
  // 工具数据类型。
  kind: "ask_request";
  // Ask 请求唯一标识。
  id: string;
  // 问题列表。
  questions: AiAskQuestion[];
};

// Ask 回答映射。
type AiAskAnswerMap = Record<string, string[]>;

// Ask 自定义输入映射。
type AiAskCustomInputMap = Record<string, string>;

// Ask 请求面板组件属性类型。
type AiAskRequestPanelProps = {
  // Ask 请求数据。
  request: AiAskRequest;
  // 提交回答回调。
  onSubmit: (content: string) => void;
};

// 已提交 Ask 本地存储键前缀。
const SUBMITTED_ASK_STORAGE_KEY_PREFIX = "memory-curator-agent:submitted-ask:";

/**
 * 判断值是否为普通对象。
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * 判断值是否为 Ask 选项。
 */
const isAskOption = (value: unknown): value is AiAskOption =>
  isRecord(value) &&
  typeof value.label === "string" &&
  typeof value.description === "string";

/**
 * 判断值是否为 Ask 问题。
 */
const isAskQuestion = (value: unknown): value is AiAskQuestion =>
  isRecord(value) &&
  typeof value.header === "string" &&
  typeof value.question === "string" &&
  Array.isArray(value.options) &&
  value.options.every(isAskOption) &&
  (value.multiple === undefined || typeof value.multiple === "boolean") &&
  (value.custom === undefined || typeof value.custom === "boolean");

/**
 * 判断工具数据是否为 Ask 请求。
 */
export const isAiAskRequest = (value: unknown): value is AiAskRequest =>
  isRecord(value) &&
  value.kind === "ask_request" &&
  typeof value.id === "string" &&
  Array.isArray(value.questions) &&
  value.questions.every(isAskQuestion);

/**
 * 生成答案键。
 */
const createAnswerKey = (requestId: string, index: number): string =>
  `${requestId}:${index}`;

/**
 * 创建已提交 Ask 存储键。
 */
const createSubmittedAskStorageKey = (requestId: string): string =>
  `${SUBMITTED_ASK_STORAGE_KEY_PREFIX}${requestId}`;

/**
 * 读取 Ask 是否已经提交过。
 */
const hasStoredAskSubmission = (requestId: string): boolean => {
  try {
    return window.localStorage.getItem(createSubmittedAskStorageKey(requestId)) === "1";
  } catch {
    return false;
  }
};

/**
 * 标记 Ask 已经提交。
 */
const storeAskSubmission = (requestId: string): void => {
  try {
    window.localStorage.setItem(createSubmittedAskStorageKey(requestId), "1");
  } catch {
    // localStorage 不可用时仍依赖当前组件状态阻止重复提交。
  }
};

/**
 * 格式化用户回答为下一轮消息。
 */
const formatAskAnswerMessage = (
  request: AiAskRequest,
  answers: AiAskAnswerMap,
): string => {
  const lines = request.questions.map((question, index) => {
    const key = createAnswerKey(request.id, index);
    const values = answers[key] ?? [];
    const answer = values.length > 0 ? values.join("、") : "未回答";

    return `- ${question.question}\n  回答：${answer}`;
  });

  return [
    "我已回答你的澄清问题，请基于这些答案继续：",
    ...lines,
  ].join("\n");
};

/**
 * 判断全部问题是否已回答。
 */
const hasAnsweredAllQuestions = (
  request: AiAskRequest,
  answers: AiAskAnswerMap,
): boolean =>
  request.questions.every(
    (_, index) => (answers[createAnswerKey(request.id, index)] ?? []).length > 0,
  );

/**
 * AiAskRequestPanel - 渲染 ask_user 结构化澄清交互。
 */
export const AiAskRequestPanel = ({
  request,
  onSubmit,
}: AiAskRequestPanelProps): React.JSX.Element => {
  // 当前问题序号。
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // 当前选中的答案。
  const [answers, setAnswers] = useState<AiAskAnswerMap>({});
  // 自定义输入值。
  const [customInputs, setCustomInputs] = useState<AiAskCustomInputMap>({});
  // 当前 Ask 是否已提交。
  const [isSubmitted, setIsSubmitted] = useState<boolean>(() =>
    hasStoredAskSubmission(request.id),
  );
  const questionCount = request.questions.length;
  const currentQuestion = request.questions[currentIndex] ?? request.questions[0];
  const canSubmit = useMemo(
    () => hasAnsweredAllQuestions(request, answers) && !isSubmitted,
    [answers, request, isSubmitted],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setCustomInputs({});
    setIsSubmitted(hasStoredAskSubmission(request.id));
  }, [request.id]);

  /**
   * 切换当前问题。
   */
  const handleQuestionSwitch = (nextIndex: number): void => {
    setCurrentIndex(Math.max(0, Math.min(questionCount - 1, nextIndex)));
  };

  /**
   * 切换预设选项。
   */
  const handleToggleOption = (
    question: AiAskQuestion,
    questionIndex: number,
    label: string,
  ): void => {
    if (isSubmitted) {
      return;
    }

    const key = createAnswerKey(request.id, questionIndex);
    const current = answers[key] ?? [];
    const nextValues = question.multiple
      ? current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
      : [label];

    setAnswers({
      ...answers,
      [key]: nextValues,
    });
  };

  /**
   * 写入自定义输入。
   */
  const handleCustomInputChange = (
    questionIndex: number,
    value: string,
  ): void => {
    if (isSubmitted) {
      return;
    }

    setCustomInputs({
      ...customInputs,
      [createAnswerKey(request.id, questionIndex)]: value,
    });
  };

  /**
   * 确认自定义输入。
   */
  const handleAddCustomAnswer = (
    question: AiAskQuestion,
    questionIndex: number,
  ): void => {
    if (isSubmitted) {
      return;
    }

    const key = createAnswerKey(request.id, questionIndex);
    const value = (customInputs[key] ?? "").trim();
    if (!value) {
      return;
    }

    const current = answers[key] ?? [];
    const nextValues = question.multiple
      ? current.includes(value)
        ? current
        : [...current, value]
      : [value];

    setAnswers({
      ...answers,
      [key]: nextValues,
    });
    setCustomInputs({
      ...customInputs,
      [key]: "",
    });
  };

  /**
   * 提交回答并续写会话。
   */
  const handleSubmit = (): void => {
    if (!canSubmit) {
      return;
    }

    const content = formatAskAnswerMessage(request, answers);
    storeAskSubmission(request.id);
    setIsSubmitted(true);
    onSubmit(content);
  };

  return (
    <div className="w-full max-w-[34rem] rounded-[6px] border border-white/10 bg-black/35 p-3 text-xs text-white/70">
      <div className="mb-3 flex items-center gap-2 text-white/90">
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-white/10 bg-[#212121]">
          <MessageSquareText className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold">需要你确认</span>
      </div>

      {currentQuestion ? (
        <div className="flex flex-col gap-3">
          {questionCount > 1 ? (
            <div className="flex items-center justify-between gap-2 text-white/45">
              <button
                type="button"
                aria-label="上一个问题"
                disabled={currentIndex === 0}
                onClick={() => handleQuestionSwitch(currentIndex - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 bg-[#212121] transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="text-[12px]">
                {currentIndex + 1} / {questionCount}
              </div>
              <button
                type="button"
                aria-label="下一个问题"
                disabled={currentIndex === questionCount - 1}
                onClick={() => handleQuestionSwitch(currentIndex + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-white/10 bg-[#212121] transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <section className="flex flex-col gap-2">
            <div>
              <div className="text-[12px] font-semibold text-white/85">
                {currentQuestion.header}
              </div>
              <div className="mt-0.5 leading-relaxed text-white/55">
                {currentQuestion.question}
              </div>
            </div>

            <div className="grid gap-1.5">
              {currentQuestion.options.map((option) => {
                const key = createAnswerKey(request.id, currentIndex);
                const selectedValues = answers[key] ?? [];
                const isSelected = selectedValues.includes(option.label);

                return (
                  <button
                    key={option.label}
                    type="button"
                    disabled={isSubmitted}
                    onClick={() =>
                      handleToggleOption(
                        currentQuestion,
                        currentIndex,
                        option.label,
                      )
                    }
                    className={`flex w-full items-start gap-2 rounded-[6px] border px-2.5 py-2 text-left transition ${
                      isSelected
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/10 bg-[#212121] text-white/65 hover:border-white/20 hover:text-white/85"
                    } disabled:cursor-default disabled:opacity-70`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[6px] border ${
                        isSelected
                          ? "border-white/40 bg-white text-black"
                          : "border-white/15"
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block leading-relaxed text-white/40">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {currentQuestion.custom !== false ? (
              <div className="flex gap-1.5">
                <input
                  value={
                    customInputs[createAnswerKey(request.id, currentIndex)] ??
                    ""
                  }
                  disabled={isSubmitted}
                  onChange={(event) =>
                    handleCustomInputChange(currentIndex, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddCustomAnswer(currentQuestion, currentIndex);
                    }
                  }}
                  placeholder="自定义回答"
                  className="min-w-0 flex-1 rounded-[6px] border border-white/10 bg-black px-2 py-1.5 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-white/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={
                    isSubmitted ||
                    !(
                      customInputs[
                        createAnswerKey(request.id, currentIndex)
                      ] ?? ""
                    ).trim()
                  }
                  onClick={() =>
                    handleAddCustomAnswer(currentQuestion, currentIndex)
                  }
                  className="rounded-[6px] border border-white/10 bg-[#212121] px-2 py-1.5 text-xs text-white/70 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  添加
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {questionCount > 1 ? (
        <div className="mt-3 flex gap-1.5">
          {request.questions.map((question, index) => {
            const isAnswered =
              (answers[createAnswerKey(request.id, index)] ?? []).length > 0;
            const isCurrent = index === currentIndex;

            return (
              <button
                key={createAnswerKey(request.id, index)}
                type="button"
                aria-label={`切换到问题 ${index + 1}`}
                onClick={() => handleQuestionSwitch(index)}
                className={`h-1.5 flex-1 rounded-full transition ${
                  isCurrent
                    ? "bg-white"
                    : isAnswered
                      ? "bg-white/45"
                      : "bg-white/12"
                }`}
                title={question.header}
              />
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="min-w-0 text-[12px] text-white/35">
          {isSubmitted
            ? "已提交，不能重复使用。"
            : "选择后提交给 AI 继续。"}
        </div>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-white/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
        >
          <SendHorizonal className="h-3.5 w-3.5" />
          提交
        </button>
      </div>
    </div>
  );
};
