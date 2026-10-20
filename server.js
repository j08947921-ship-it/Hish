import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InferenceClient } from '@huggingface/inference';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const CHAT_MODEL = process.env.HF_CHAT_MODEL || 'Qwen/Qwen3-4B-Thinking-2507';
const IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'Qwen/Qwen-Image';

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getClient() {
  const token = process.env.HF_TOKEN;
  if (!token || token === 'hf_replace_with_your_token') {
    const err = new Error('Kolli’s Flow needs a Hugging Face token before it can connect to AI. Open the Setup guide to connect one.');
    err.status = 503;
    throw err;
  }
  return new InferenceClient(token);
}

app.get('/api/status', (_req, res) => {
  const token = process.env.HF_TOKEN;
  res.json({
    configured: Boolean(token && token !== 'hf_replace_with_your_token'),
    chatModel: CHAT_MODEL,
    imageModel: IMAGE_MODEL
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'Add a message to start chatting.' });
    if (messages.length > 30) return res.status(400).json({ error: 'This chat is too long. Start a new chat and try again.' });
    const safeMessages = messages.map((message) => {
      const role = message?.role === 'assistant' ? 'assistant' : 'user';
      if (typeof message?.content !== 'string' || message.content.length > 18000) throw new Error('One of those messages is empty or too long.');
      return { role, content: message.content };
    });
    const client = getClient();
    const result = await client.chatCompletion({
      model: CHAT_MODEL,
      provider: 'auto',
      messages: [
        { role: 'system', content: 'You are Kolli’s Flow, a helpful, friendly AI assistant. Give clear, accurate answers. Match the user’s language when helpful. For schoolwork, explain simply. Be honest when uncertain.' },
        ...safeMessages
      ],
      max_tokens: 1200,
      temperature: 0.7
    });
    const answer = result?.choices?.[0]?.message?.content;
    if (!answer || typeof answer !== 'string') return res.status(502).json({ error: 'The AI returned an empty answer. Please try again.' });
    res.json({ answer, model: CHAT_MODEL });
  } catch (error) {
    console.error('Chat API error:', error?.message || error);
    const status = Number(error?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: friendlyError(error) });
  }
});

app.post('/api/image', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ error: 'Describe the image you want to create.' });
    if (prompt.length > 2000) return res.status(400).json({ error: 'Please keep your image prompt under 2,000 characters.' });
    const client = getClient();
    const imageBlob = await client.textToImage({
      model: IMAGE_MODEL,
      inputs: prompt,
      parameters: { width: 1024, height: 1024 }
    });
    const mimeType = imageBlob.type?.startsWith('image/') ? imageBlob.type : 'image/png';
    const bytes = Buffer.from(await imageBlob.arrayBuffer());
    res.json({ image: `data:${mimeType};base64,${bytes.toString('base64')}`, prompt, model: IMAGE_MODEL });
  } catch (error) {
    console.error('Image API error:', error?.message || error);
    const status = Number(error?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: friendlyError(error, true) });
  }
});

function friendlyError(error, isImage = false) {
  const message = String(error?.message || 'Unknown error');
  if (message.includes('needs a Hugging Face token')) return message;
  if (/401|unauthorized|invalid.*token|token.*invalid/i.test(message)) return 'Your Hugging Face token was rejected. Check HF_TOKEN in your .env file and restart the app.';
  if (/402|payment|required|credits|billing/i.test(message)) return 'This model/provider may need available inference credits or billing. Check your Hugging Face account and try a supported model/provider.';
  if (/429|rate.?limit|too many/i.test(message)) return 'The AI service is busy or rate-limited. Please wait a moment and try again.';
  if (/404|model.*not found|not supported/i.test(message)) return `The selected ${isImage ? 'image' : 'chat'} model may not be available with your account/provider. Change ${isImage ? 'HF_IMAGE_MODEL' : 'HF_CHAT_MODEL'} in .env to a currently supported model.`;
  if (/fetch failed|ECONN|timeout|network/i.test(message)) return 'Could not reach the AI service. Check your internet connection and try again.';
  return `${isImage ? 'Image generation' : 'Chat'} failed: ${message.slice(0, 220)}`;
}

app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Kolli’s Flow is running at http://localhost:${PORT}`));
