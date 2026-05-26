import demoOld from "../samples/demo-old.tex?raw";
import demoNew from "../samples/demo-new.tex?raw";

export const DEMO_OLD_LABEL = "samples/demo-old.tex";
export const DEMO_NEW_LABEL = "samples/demo-new.tex";

export function getDemoOld(): string {
  return demoOld;
}

export function getDemoNew(): string {
  return demoNew;
}
