export default class OpenAI {
  constructor(_opts?: any) {
    // noop constructor — options are ignored
  }

  public chat = {
    completions: {
      create: async (_opts: any) => {
        return { choices: [{ message: { content: "" } }] };
      }
    }
  };

  // Provide a minimal responses API if some files expect it
  public responses = {
    create: async (_opts: any) => ({ output: [{ content: "" }], status: "ok" }),
  };
}
