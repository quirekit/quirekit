import type { CommentsController } from "../controller/controller";

/** Editor-local storage holding the mounted controller. */
export interface CommentsStorage {
  /** Present between creation and destruction. */
  controller?: CommentsController;
}
