class TokenManager {
  private accessToken: string | null = null;
  private static instance: TokenManager | null = null;
  private constructor() {}

  public static getInstance(): TokenManager {
    if (this.instance === null) {
      this.instance = new TokenManager();
    }
    return this.instance;
  }

  public getAccessToken() {
    return this.accessToken;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  public clearAccessToken() {
    this.accessToken = null;
  }
}

export const tokenManager = TokenManager.getInstance();
