# Kolli's Flow — AI Chat + Image Studio

A mobile-friendly web app inspired by modern AI assistants, branded as **Kolli's Flow**. It supports text chat, text-to-image generation, a recent-conversations sidebar, responsive layout, and an installable web-app manifest.

## AI models and API

- Chat: `Qwen/Qwen3-4B-Thinking-2507` through Hugging Face Inference Providers.
- Images: `Qwen/Qwen-Image` through Hugging Face Inference Providers.
- API client: the official `@huggingface/inference` JavaScript SDK.

Inference access and image creation may consume account credits or require billing depending on the model/provider and your account. No API token is bundled in this ZIP.

## Run locally

You need Node.js 20 or newer.

1. Create a Hugging Face access token at <https://huggingface.co/settings/tokens>. Give it **Inference Providers** permission.
2. Copy `.env.example` to a new file named `.env`.
3. Open `.env` and replace `hf_replace_with_your_token` with your token:

   ```env
   HF_TOKEN=hf_your_real_token_here
   PORT=3000
   ```

4. In a terminal in this folder, run:

   ```bash
   npm install
   npm start
   ```

5. Open <http://localhost:3000> in your browser. Tap **Setup guide → Check connection** if the app still shows Setup needed.

Keep `.env` private. Do not publish it, upload it to GitHub, or paste your token into frontend JavaScript.

## Deploy online

You need a Node.js host that supports server environment variables; the website alone is not enough because the API token must stay server-side. For example, deploy this folder to a Node web-service host with:

- Build command: `npm install`
- Start command: `npm start`
- Environment variable/secret: `HF_TOKEN` = your Hugging Face access token

The included `render.yaml` provides a basic Render service blueprint. After deploying, add `HF_TOKEN` in the host's environment settings and redeploy. If you use a different host, apply the same build/start commands and secret.

## Optional model changes

You can override the default models in `.env`:

```env
HF_CHAT_MODEL=Qwen/Qwen3-4B-Thinking-2507
HF_IMAGE_MODEL=Qwen/Qwen-Image
```

Choose a model currently available to your Hugging Face account with an Inference Provider. If an API request fails, check the host logs and the model/provider access for your account.

## Current limitations

- Chat history is stored in the current browser's local storage; it is not synced across devices.
- Generated images can be downloaded while visible in the current session. To keep browser history light, image bytes are not saved into long-term local history, so an image may need to be regenerated after reloading the page.
- This starter does not include user login, database-backed sync, or per-user usage controls. Add those before making a public service for many users.
