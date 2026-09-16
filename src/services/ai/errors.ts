export class MissingApiKeyError extends Error {
  constructor() {
    super("尚未設定 API key");
    this.name = "MissingApiKeyError";
  }
}

export class RefusalError extends Error {
  constructor() {
    super("模型拒絕處理這個請求");
    this.name = "RefusalError";
  }
}
