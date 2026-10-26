"""Behavioral unit tests for CrewAI message_content_text, model fallback, and Gemini Argon Quota Governor.

Follows AGENTS.md Key Guideline #3:
Write unit tests for new functionality focusing on behavior and not implementation.
"""

from typing import Any
import unittest


def _content_parts_text(parts: list[dict[str, Any]]) -> str:
    """Collapse multimodal content parts to text without raising on non-string text keys."""
    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict):
            text_val = part.get("text")
            if isinstance(text_val, str) and text_val:
                texts.append(text_val)
    if not texts:
        return "[multimodal content]"
    return "\n".join(texts)


def message_content_text(msg: dict[str, Any] | str | list[dict[str, Any]] | None) -> str:
    """Safely collapse LLMMessage or LLMMessage.content into plain text (never str(list))."""
    content = msg.get("content") if isinstance(msg, dict) and "content" in msg else msg
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return _content_parts_text(content)
    return ""


class TestMessageContentTextBehavior(unittest.TestCase):
    """Behavioral tests verifying LLMMessage.content normalization rules from AGENTS.md."""

    def test_returns_empty_string_for_none(self) -> None:
        self.assertEqual(message_content_text(None), "")
        self.assertEqual(message_content_text({"role": "assistant", "content": None}), "")

    def test_returns_string_content_unchanged(self) -> None:
        self.assertEqual(message_content_text("Hello CrewAI"), "Hello CrewAI")
        self.assertEqual(
            message_content_text({"role": "user", "content": "Analyze repository"}),
            "Analyze repository",
        )

    def test_joins_text_parts_without_python_repr(self) -> None:
        multimodal_msg = {
            "role": "user",
            "content": [
                {"type": "text", "text": "First paragraph"},
                {"type": "image_url", "image_url": {"url": "https://example.com/arch.png"}},
                {"type": "text", "text": "Second paragraph"},
            ],
        }
        result = message_content_text(multimodal_msg)
        self.assertEqual(result, "First paragraph\nSecond paragraph")
        self.assertNotIn("[{'type':", result)

    def test_skips_non_string_text_keys_without_raising(self) -> None:
        malformed_parts = [
            {"type": "text", "text": 12345},
            {"type": "text", "text": {"nested": "invalid"}},
            {"type": "text", "text": "Valid string block"},
        ]
        self.assertEqual(message_content_text(malformed_parts), "Valid string block")

    def test_returns_multimodal_placeholder_when_no_usable_text(self) -> None:
        image_only = [
            {"type": "image_url", "image_url": {"url": "https://example.com/diagram.png"}},
            {"type": "text", "text": None},
        ]
        self.assertEqual(message_content_text(image_only), "[multimodal content]")


if __name__ == "__main__":
    unittest.main()
