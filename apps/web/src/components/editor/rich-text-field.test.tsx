import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextField } from "./rich-text-field";
import { RichTextView } from "@/components/sections/rich-text-view";
import {
  isSafeRichTextHref,
  sanitizeRichTextHtml,
  type TipTapDocJson,
} from "@/lib/template/rich-text";
import { richTextValueSchema } from "@/lib/template/schema";

describe("TipTap RichTextField & sanitization (C-403)", () => {
  it("sanitizes pasted HTML by stripping scripts, styles, images, inline attributes, and unsafe links", () => {
    const dirtyHtml = `
      <script>window.__hacked = true;</script>
      <style>body { background: red; }</style>
      <h1 style="font-size: 99px" onclick="evil()">Project Overview</h1>
      <p class="mso-normal" style="color: purple">
        We redesigned <b>onboarding</b> and <i>checkout</i> for
        <a href="https://casefolio.app/orbit" onclick="steal()">Orbit</a>
        and blocked <a href="javascript:alert(1)">malicious link</a>.
        <img src="https://evil.example/tracker.png" onerror="alert(1)" />
      </p>
      <ul>
        <li>Reduced drop-off by <strong>42%</strong></li>
      </ul>
    `;

    const cleaned = sanitizeRichTextHtml(dirtyHtml);

    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("<style");
    expect(cleaned).not.toContain("<img");
    expect(cleaned).not.toContain("<h1");
    expect(cleaned).not.toContain("onclick");
    expect(cleaned).not.toContain("style=");
    expect(cleaned).not.toContain("javascript:");
    expect(cleaned).toContain("<p>Project Overview</p>");
    expect(cleaned).toContain("<strong>onboarding</strong>");
    expect(cleaned).toContain("<em>checkout</em>");
    expect(cleaned).toContain('href="https://casefolio.app/orbit"');
    expect(cleaned).toContain("malicious link");
    expect(cleaned).toContain("<ul><li>Reduced drop-off by <strong>42%</strong></li></ul>");

    expect(isSafeRichTextHref("https://casefolio.app")).toBe(true);
    expect(isSafeRichTextHref("mailto:hello@casefolio.app")).toBe(true);
    expect(isSafeRichTextHref("javascript:alert(1)")).toBe(false);
    expect(isSafeRichTextHref("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("outputs TipTap JSON with limited marks (bold, italic, link, lists) and rejects unsafe link URLs", async () => {
    const onChange = vi.fn<(doc: TipTapDocJson) => void>();
    let editorInstance: Editor | null = null;

    render(
      <RichTextField
        label="Summary"
        value="Initial plain summary"
        onChange={onChange}
        onEditorReady={(ed) => {
          editorInstance = ed;
        }}
      />,
    );

    await waitFor(() => {
      expect(editorInstance).not.toBeNull();
    });

    // Simulate pasting dirty HTML via TipTap's configured transformPastedHTML + insertContent
    act(() => {
      const sanitizedPaste = editorInstance!.view.someProp("transformPastedHTML", (fn) =>
        fn(
          `<h2>Key outcomes</h2><script>alert(1)</script><p>Delivered <b>fast</b> and <i>clear</i> flows</p><ul><li>Step one</li></ul>`,
          editorInstance!.view,
        ),
      );
      expect(sanitizedPaste).toBe(
        "<p>Key outcomes</p><p>Delivered <strong>fast</strong> and <em>clear</em> flows</p><ul><li>Step one</li></ul>",
      );
      editorInstance!.commands.setContent(sanitizedPaste!);
      editorInstance!.chain().focus().selectAll().run();
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });

    const latestJson = onChange.mock.calls.at(-1)?.[0];
    expect(latestJson).toBeDefined();
    expect(latestJson?.type).toBe("doc");
    expect(richTextValueSchema.safeParse(latestJson).success).toBe(true);
    expect(JSON.stringify(latestJson)).toContain('"type":"bold"');
    expect(JSON.stringify(latestJson)).toContain('"type":"italic"');
    expect(JSON.stringify(latestJson)).toContain('"type":"bulletList"');
    expect(JSON.stringify(latestJson)).not.toContain("heading");
    expect(JSON.stringify(latestJson)).not.toContain("script");

    // Verify toolbar Link bar rejects javascript: URLs and accepts https:// URLs
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const urlInput = screen.getByLabelText("Link URL");
    fireEvent.change(urlInput, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    expect(
      screen.getByText(/Enter a valid https:\/\/, http:\/\/, or mailto: link\./i),
    ).toBeInTheDocument();

    fireEvent.change(urlInput, { target: { value: "https://casefolio.app/case-study" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply link" }));

    await waitFor(() => {
      const withLink = onChange.mock.calls.at(-1)?.[0];
      expect(JSON.stringify(withLink)).toContain("https://casefolio.app/case-study");
    });

    // Verify RichTextView renders the stored JSON marks & lists cleanly via React elements
    const finalDoc = onChange.mock.calls.at(-1)![0];
    const { container } = render(<RichTextView value={finalDoc} idPrefix="test-rt" />);
    expect(container.querySelector("strong")?.textContent).toBe("fast");
    expect(container.querySelector("em")?.textContent).toBe("clear");
    expect(container.querySelector("ul li")?.textContent).toBe("Step one");
    expect(container.querySelector('a[href="https://casefolio.app/case-study"]')).not.toBeNull();
  });
});
