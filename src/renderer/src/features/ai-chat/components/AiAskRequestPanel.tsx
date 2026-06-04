import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, SendHorizonal } from "lucide-react";

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

// 工具确认请求。
export type AiToolConfirmationRequest = {
  // 工具数据类型。
  kind: "tool_confirmation_request";
  // 确认请求唯一标识。
  id: string;
  // 待确认工具名称。
  tool: string;
  // 待确认工具输入。
  input: unknown;
  // 确认问题列表。
  questions: AiAskQuestion[];
};

// 可复用问答请求。
type AiQuestionRequest = {
  // 请求唯一标识。
  id: string;
  // 问题列表。
  questions: AiAskQuestion[];
};

// Ask 回答。
export type AiAskAnswer = {
  // 问题文本。
  question: string;
  // 回答列表。
  answers: string[];
};

// Ask 回答数据。
export type AiAskAnswerData = {
  // 工具数据类型。
  kind: "ask_answer";
  // Ask 请求唯一标识。
  id: string;
  // 回答列表。
  answers: AiAskAnswer[];
};

// Ask 回答提交载荷。
export type AiAskAnswerSubmitPayload = {
  // Ask 请求唯一标识。
  requestId: string;
  // 每个问题对应的答案列表。
  answers: string[][];
};

// 工具确认回答提交载荷。
export type AiToolConfirmationAnswerSubmitPayload = {
  // 工具确认请求唯一标识。
  requestId: string;
  // 用户确认动作。
  action: "confirm" | "cancel";
};

// Ask 回答映射。
type AiAskAnswerMap = Record<string, string[]>;

// Ask 自定义输入映射。
type AiAskCustomInputMap = Record<string, string>;

// Ask 自定义选中映射。
type AiAskCustomSelectionMap = Record<string, boolean>;

// Ask 请求面板组件属性类型。
type AiAskRequestPanelProps = {
  // Ask 请求数据。
  request: AiAskRequest | AiToolConfirmationRequest;
  // 提交回答回调。
  onSubmit: (payload: AiAskAnswerSubmitPayload) => void | Promise<void>;
};

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
 * 判断工具数据是否为工具确认请求。
 */
export const isAiToolConfirmationRequest = (
  value: unknown,
): value is AiToolConfirmationRequest =>
  isRecord(value) &&
  value.kind === "tool_confirmation_request" &&
  typeof value.id === "string" &&
  typeof value.tool === "string" &&
  Array.isArray(value.questions) &&
  value.questions.every(isAskQuestion);

/**
 * 判断工具数据是否为 Ask 回答。
 */
export const isAiAskAnswer = (value: unknown): value is AiAskAnswerData =>
  isRecord(value) &&
  value.kind === "ask_answer" &&
  typeof value.id === "string" &&
  Array.isArray(value.answers) &&
  value.answers.every(
    (item) =>
      isRecord(item) &&
      typeof item.question === "string" &&
      Array.isArray(item.answers) &&
      item.answers.every((answer) => typeof answer === "string"),
  );

/**
 * 生成答案键。
 */
const createAnswerKey = (requestId: string, index: number): string =>
  `${requestId}:${index}`;

/**
 * 解析问题当前答案。
 */
const resolveQuestionAnswers = (
  request: AiQuestionRequest,
  questionIndex: number,
  answers: AiAskAnswerMap,
  customInputs: AiAskCustomInputMap,
  customSelections: AiAskCustomSelectionMap,
): string[] => {
  const question = request.questions[questionIndex];
  const key = createAnswerKey(request.id, questionIndex);
  const selectedValues = answers[key] ?? [];
  const isCustomSelected = question?.custom !== false && customSelections[key];
  const customValue = isCustomSelected ? (customInputs[key] ?? "").trim() : "";

  if (!customValue) {
    return selectedValues;
  }

  if (!question?.multiple) {
    return [customValue];
  }

  return selectedValues.includes(customValue)
    ? selectedValues
    : [...selectedValues, customValue];
};

/**
 * 判断全部问题是否已回答。
 */
const hasAnsweredAllQuestions = (
  request: AiQuestionRequest,
  answers: AiAskAnswerMap,
  customInputs: AiAskCustomInputMap,
  customSelections: AiAskCustomSelectionMap,
): boolean =>
  request.questions.every(
    (_, index) =>
      resolveQuestionAnswers(
        request,
        index,
        answers,
        customInputs,
        customSelections,
      ).length > 0,
  );

/**
 * AiAskRequestPanel - 渲染 common_tool.ask 结构化澄清交互。
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
  // 自定义回答选中状态。
  const [customAnswerSelections, setCustomAnswerSelections] =
    useState<AiAskCustomSelectionMap>({});
  // 当前 Ask 是否已提交。
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  // 当前是否正在提交。
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const questionCount = request.questions.length;
  const currentQuestion = request.questions[currentIndex] ?? request.questions[0];
  const canSubmit = useMemo(
    () =>
      hasAnsweredAllQuestions(
        request,
        answers,
        customInputs,
        customAnswerSelections,
      ) &&
      !isSubmitted &&
      !isSubmitting,
    [
      answers,
      customInputs,
      customAnswerSelections,
      request,
      isSubmitted,
      isSubmitting,
    ],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers({});
    setCustomInputs({});
    setCustomAnswerSelections({});
    setIsSubmitted(false);
    setIsSubmitting(false);
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
    if (!question.multiple) {
      setCustomAnswerSelections({
        ...customAnswerSelections,
        [key]: false,
      });
    }
  };

  /**
   * 选中自定义回答。
   */
  const handleSelectCustomAnswer = (
    question: AiAskQuestion,
    questionIndex: number,
  ): void => {
    if (isSubmitted) {
      return;
    }

    const key = createAnswerKey(request.id, questionIndex);
    setCustomAnswerSelections({
      ...customAnswerSelections,
      [key]: true,
    });

    if (!question.multiple) {
      setAnswers({
        ...answers,
        [key]: [],
      });
    }
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
   * 提交回答并续写会话。
   */
  const handleSubmit = (): void => {
    if (!canSubmit) {
      return;
    }

    const payload = {
      requestId: request.id,
      answers: request.questions.map(
        (_, index) =>
          resolveQuestionAnswers(
            request,
            index,
            answers,
            customInputs,
            customAnswerSelections,
          ),
      ),
    };

    setIsSubmitting(true);
    void Promise.resolve(onSubmit(payload))
      .then(() => {
        setIsSubmitted(true);
      })
      .catch(() => {
        setIsSubmitted(false);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <div className="w-full max-w-[28rem] py-1 text-xs text-white/70">
      {currentQuestion ? (
        <div className="flex flex-col gap-2">
          <section className="flex flex-col gap-1.5">
            <div>
              <div className="min-w-0 text-left">
                <div className="text-[12px] font-semibold text-white/85">
                  {currentQuestion.header}
                </div>
                <div className="mt-0.5 leading-relaxed text-white/55">
                  {currentQuestion.question}
                </div>
              </div>
            </div>

            <div className="grid gap-1">
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
                    className={`flex w-full items-start justify-start gap-1.5 py-1 text-left transition ${
                      isSelected
                        ? "text-white"
                        : "text-white/55 hover:text-white/80"
                    } disabled:cursor-default disabled:opacity-70`}
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center ${
                        isSelected ? "text-white" : "text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-left font-medium leading-snug">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-left leading-relaxed text-white/35">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {currentQuestion.custom !== false ? (
              <div
                role="button"
                tabIndex={isSubmitted ? -1 : 0}
                onClick={() =>
                  handleSelectCustomAnswer(currentQuestion, currentIndex)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelectCustomAnswer(currentQuestion, currentIndex);
                  }
                }}
                className="flex w-full items-start justify-start gap-1.5 py-1 text-left"
              >
                <span
                  className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center ${
                    customAnswerSelections[
                      createAnswerKey(request.id, currentIndex)
                    ]
                      ? "text-white"
                      : "text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div
                    className={`text-left font-medium leading-snug ${
                      customAnswerSelections[
                        createAnswerKey(request.id, currentIndex)
                      ]
                        ? "text-white"
                        : "text-white/55"
                    }`}
                  >
                    自定义回答
                  </div>
                  <input
                    value={
                      customInputs[createAnswerKey(request.id, currentIndex)] ??
                      ""
                    }
                    disabled={isSubmitted}
                    onFocus={() =>
                      handleSelectCustomAnswer(currentQuestion, currentIndex)
                    }
                    onChange={(event) =>
                      handleCustomInputChange(currentIndex, event.target.value)
                    }
                    placeholder="输入回答"
                    className="mt-0.5 w-full min-w-0 rounded-[6px] bg-white/10 px-2 py-1 text-xs text-white outline-none transition placeholder:text-white/25 focus:bg-white/15 disabled:opacity-60"
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {isSubmitted || isSubmitting ? (
          <div className="min-w-0 text-[12px] text-white/35">
            {isSubmitted ? "已提交，不能重复使用。" : "正在提交回答..."}
          </div>
        ) : null}
        {questionCount > 1 ? (
          <>
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => handleQuestionSwitch(currentIndex - 1)}
              className="rounded-[6px] px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentIndex === questionCount - 1}
              onClick={() => handleQuestionSwitch(currentIndex + 1)}
              className="rounded-[6px] px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-white px-2 py-1 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
        >
          <SendHorizonal className="h-3.5 w-3.5" />
          Submit
        </button>
      </div>
    </div>
  );
};
