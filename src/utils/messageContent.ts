/**
 * TypeScript implementation mirroring `crewai.utilities.agent_utils.message_content_text`
 * as mandated by AGENTS.md:
 *
 * `LLMMessage.content` is `str | list[dict[str, Any]] | None`; the list form is
 * multimodal content parts. Never `str()` it — that puts a Python repr
 * (`[{'type': 'text', 'text': 'hi'}]`) in front of the model and into memory.
 * Collapse a message to text with `message_content_text(msg)` instead.
 *
 * Parts arrive from a model and are typed `dict[str, Any]`, so a `text` key that
 * is not a string is possible. `_content_parts_text` skips those blocks rather
 * than raising, and names a list with no usable text `[multimodal content]`.
 */

export type ContentPart = Record<string, unknown>;
export type LLMMessageContent = string | ContentPart[] | null | undefined;

export interface LLMMessageLike {
  role?: string;
  content?: LLMMessageContent;
}

export function _content_parts_text(parts: ContentPart[]): string {
  const usableTexts: string[] = [];

  for (const part of parts) {
    if (part && typeof part === 'object' && typeof part.text === 'string') {
      if (part.text.length > 0) {
        usableTexts.push(part.text);
      }
    }
  }

  if (usableTexts.length === 0) {
    return '[multimodal content]';
  }

  return usableTexts.join('\n');
}

export function message_content_text(
  msgOrContent: LLMMessageLike | LLMMessageContent
): string {
  const content: LLMMessageContent =
    msgOrContent !== null &&
    typeof msgOrContent === 'object' &&
    !Array.isArray(msgOrContent) &&
    'content' in msgOrContent
      ? (msgOrContent as LLMMessageLike).content
      : (msgOrContent as LLMMessageContent);

  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return _content_parts_text(content);
  }

  return '';
}
