import { vi } from './vi';

export type MessageKey = keyof typeof vi;

/** A full set of interface messages; each added language must provide every key. */
export type Messages = Record<MessageKey, string>;

type Vars = Record<string, string | number>;

const messages: Messages = vi;

export function interpolate(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in vars ? String(vars[name]) : placeholder
  );
}

export function t(key: MessageKey, vars?: Vars): string {
  const message = messages[key];
  return vars ? interpolate(message, vars) : message;
}
