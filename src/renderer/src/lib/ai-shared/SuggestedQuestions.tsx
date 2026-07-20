import type React from "react";
import { Lightbulb } from "lucide-react";

// 推荐问题组件属性。
type SuggestedQuestionsProps = {
  questions: string[];
  isLoading?: boolean;
  onSelect: (question: string) => void;
};

/**
 * SuggestedQuestions - 展示可直接发送的后续问题。
 */
export const SuggestedQuestions = ({ questions, isLoading = false, onSelect }: SuggestedQuestionsProps): React.JSX.Element | null => {
  if (!isLoading && questions.length === 0) return null;

  return (
    <div className="my-1.5 flex w-full max-w-full gap-2.5 pl-1">
      <div className="flex w-6 shrink-0 items-start justify-center pt-0.5">
        <Lightbulb className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-xs font-mono font-bold text-lime-100">Suggested questions</div>
        {isLoading ? <div className="h-5 w-36 animate-pulse rounded-[6px] bg-white/5" /> : (
          <div className="flex flex-col items-start gap-1">
            {questions.map((question) => (
              <div key={question} className="flex max-w-full items-start gap-1.5">
                <span className="mt-1 inline-flex h-[1.625em] w-3 shrink-0 items-center justify-center select-none text-white/45">
                  <svg className="h-3 w-3 stroke-current" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 1v5h7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <button type="button" onClick={() => onSelect(question)} className="max-w-full rounded-[6px] border border-white/10 px-2 py-1 text-left text-xs leading-relaxed text-white/65 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50">
                  {question}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
