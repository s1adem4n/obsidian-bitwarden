import { ChildProcess, exec } from "child_process";
import createClient, { Client } from "openapi-fetch";
import { paths } from "./api/schema";
import { request, requestUrl } from "obsidian";

export class Bitwarden {
  path: string;
  process: ChildProcess;
  client: Client<paths>;

  constructor(path: string) {
    this.path = path;
  }

  async onload(): Promise<void> {
    const port = Math.floor(Math.random() * 16383) + 49152;
    this.process = exec(`${this.path} serve --port ${port}`);
    this.client = createClient<paths>({
      baseUrl: `http://localhost:${port}`,

      fetch: async (req) => {
        const body = await req.text();

        const response = await requestUrl({
          url: req.url,
          method: req.method,
          body: body,
          contentType: req.headers.get("Content-Type") || "",
          throw: false,
        });

        return {
          status: response.status,
          headers: new Headers(response.headers),
          text: async () => response.text,
          json: async () => response.json,
          ok: response.status >= 200 && response.status < 300,
        } as Response;
      },
    });
  }

  async onunload(): Promise<void> {
    this.process.kill();
  }
}
