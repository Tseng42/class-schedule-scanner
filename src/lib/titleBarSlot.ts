import { createContext } from "react";

/**
 * Where LargeTitle puts its compact bar: an element App renders outside the page
 * wrapper. The wrapper is moved with transforms while swiping between tabs, and a
 * fixed bar inside it would then scroll away with the page.
 */
export const TitleBarSlotContext = createContext<HTMLElement | null>(null);
