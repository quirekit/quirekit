import type { MdEditorLocale } from "@quirekit/md-editor/vue";

/** Labels of the comment workspace. */
export interface MdCommentsMessages {
  /** List title and point-marker label. */ readonly comments: string;
  /** List hint when no thread exists. */ readonly noComments: string;
  /** Group of threads whose text is gone. */ readonly orphanedComments: string;
  /** Group of closed threads. */ readonly resolvedComments: string;
  /** Title of comments on the whole document. */ readonly documentComments: string;
  /** Quote label of a comment on the whole document. */ readonly documentCommentQuote: string;
  /** Placeholder of the document comment field. */ readonly documentCommentPlaceholder: string;
  /** Button that starts a comment on the whole document. */ readonly addDocumentComment: string;
}

/** Comment workspace labels by product language. */
export const mdCommentsMessages: Readonly<Record<MdEditorLocale, MdCommentsMessages>> = {
  "zh-CN": { comments: "评论", noComments: "选中文字后添加评论", orphanedComments: "找不到原文", resolvedComments: "已解决",
    documentComments: "全文评论", documentCommentQuote: "全文评论", documentCommentPlaceholder: "输入评论", addDocumentComment: "添加全文评论" },
  en: { comments: "Comments", noComments: "Select text to add a comment", orphanedComments: "Original text not found", resolvedComments: "Resolved",
    documentComments: "Document comments", documentCommentQuote: "Whole document", documentCommentPlaceholder: "Add a comment", addDocumentComment: "Comment on document" },
};
