declare module 'blocksdk' {
  // The official Salesforce Marketing Cloud Block SDK is a small CJS
  // module that exposes a single constructor as its default export.
  // We only type the subset of methods we actually use from
  // `src/utils/sfmcBlock.ts`; add more here if new callers need them.
  export default class BlockSDK {
    constructor(
      config?: Record<string, unknown>,
      whitelistOverride?: string[],
      sslOverride?: boolean,
    );
    getData(cb: (data: unknown) => void): void;
    setData(data: unknown, cb?: (data: unknown) => void): void;
    getContent(cb: (html: string) => void): void;
    setContent(html: string, cb?: (html: string) => void): void;
    getView(cb: (view: string) => void): void;
    setBlockEditorWidth(width: number | string, cb?: () => void): void;
    triggerAuth(appID: string): void;
  }
}
