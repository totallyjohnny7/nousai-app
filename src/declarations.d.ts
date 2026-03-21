// Ambient module declarations for packages that lack TypeScript types

declare module '@elgato-stream-deck/webhid' {
  export function requestStreamDecks(options?: any): Promise<any[]>
  export function getStreamDecks(options?: any): Promise<any[]>
}
