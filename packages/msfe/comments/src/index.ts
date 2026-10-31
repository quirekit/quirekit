export { validateCommentsExchange } from "./protocol/index";
export type {
  CommentAnchor, CommentMention, CommentMessage, CommentPerson, CommentQuote, CommentRange, CommentRelativeAnchor,
  CommentsExchange, CommentsFormat, CommentsIssue, CommentsIssueCode, CommentsSource, CommentsValidation, CommentsVersion,
  CommentThread,
} from "./protocol/index";
export { createCommentAnchor, createCommentQuote, hashCommentSource, resolveCommentAnchor } from "./anchoring/index";
export type { AnchorCandidate, AnchorFailure, AnchorMethod, AnchorResolution } from "./anchoring/index";
export type {} from "./ai/types";
export type { AgentCommentInput } from "./ai/commands";
export { Comments } from "./extension/comments";
export { getComments } from "./extension/access";
export { nativeCommentMarker } from "./extension/marker";
export type { CommentsStorage } from "./extension/types";
export type { CommentsController } from "./controller/controller";
export type {
  CommentChange, CommentChangeKind, CommentFailure, CommentInput, CommentMarkerProps, CommentPlacementStatus, CommentResult,
  CommentsImport, CommentsOptions, CommentThreadView,
} from "./controller/types";
export { commentsState } from "./state/slot";
export type { CommentsState } from "./state/types";
