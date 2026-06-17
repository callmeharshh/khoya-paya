// Back-compat shim. The real provider logic lives in lib/llm.ts (Claude default,
// Gemini dev fallback). Import from "@/lib/llm" in new code.
export { callStructured, ACTIVE_MODEL, PROVIDER } from "./llm";
export type { ImageInput, StructuredOpts, Provider } from "./llm";
