import { quireProseComponents } from "./native";
import { QuireProseImage } from "../image";
import { QuireProseSource } from "../source";

/** QuireKit reading defaults: interactive images and full code display, with every other native element retained. */
// A spread counts as a side effect for bundlers, so it sits inside a pure call that can be dropped when unused.
export const quireRichProseComponents = /* @__PURE__ */ (() => Object.freeze({ ...quireProseComponents, img: QuireProseImage, pre: QuireProseSource }))();
