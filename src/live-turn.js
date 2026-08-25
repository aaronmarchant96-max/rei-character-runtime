import { parseQuestionEnvelope } from "./question.js";
import { parseTargetEnvelope } from "./target.js";

export function bindQuestionToTarget({ question, target }) {
  const normalizedQuestion = parseQuestionEnvelope(JSON.stringify(question));
  const normalizedTarget = parseTargetEnvelope(JSON.stringify(target));
  if (normalizedQuestion.targetReferenceFormId !== normalizedTarget.referenceFormId) {
    throw new Error("question target does not match the current exported actor");
  }
  return {
    question: normalizedQuestion.question,
    target: normalizedTarget
  };
}
