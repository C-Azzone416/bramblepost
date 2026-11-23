declare module "virtual:local-feedback-sdk" {
  export const prepareLocalFeedback: undefined | ((input: {
    blob: Blob;
    notes: string;
    captureContext: {
      gameId: "bramblepost-preview";
      capturedAt: string;
      scene: "stand-in-preview";
      platform: "browser";
      input: "unknown";
      buildSha: null;
    };
  }) => Promise<{ metadata: Blob; report: { media: { sha256: string } | null } }>);
}
