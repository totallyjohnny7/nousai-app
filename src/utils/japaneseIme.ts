/**
 * Japanese IME utility — uses wanakana conversion functions with a manual
 * romaji buffer. Does NOT use bind/unbind (which crashes ProseMirror).
 */
import { toHiragana, toKatakana } from 'wanakana';

export type ImeMode = 'off' | 'hiragana' | 'katakana';

const KEY = 'nousai-ime-mode';

export const getImeMode = (): ImeMode =>
  (localStorage.getItem(KEY) as ImeMode) || 'off';

export const setImeMode = (m: ImeMode): void =>
  localStorage.setItem(KEY, m);

/** Convert a romaji buffer to kana (partial — may still have trailing romaji) */
export const convertBuffer = (buf: string, mode: 'hiragana' | 'katakana'): string =>
  !buf ? '' : mode === 'katakana' ? toKatakana(buf) : toHiragana(buf);

/**
 * Flush buffer — resolve trailing ambiguous 'n' → ん/ン before final output.
 * wanakana needs 'nn' for ん, but a single trailing 'n' at flush should convert.
 */
export const flushBuffer = (buf: string, mode: 'hiragana' | 'katakana'): string => {
  if (!buf) return '';
  let adj = buf;
  if (/n$/i.test(adj) && !/nn$/i.test(adj)) {
    adj = adj.slice(0, -1) + 'nn';
  }
  return convertBuffer(adj, mode);
};
