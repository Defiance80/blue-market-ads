import Anthropic from '@anthropic-ai/sdk';
import { requireSession } from '@/lib/auth';
import { env, agentConfigured } from '@/lib/env';
import { isDemo } from '@/lib/ads';
import { PLAYBOOK } from '@/lib/agent/playbook';
import { TOOLS, runTool } from '@/lib/agent/tools';
import { getProfile } from '@/lib/store';
import { refFrom, bad } from '@/lib/api';
import { todayIn } from '@/lib/dates';

// Long conversations with several tool calls can take a while.
export const maxDuration = 300;

const MAX_STEPS = 14;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// ---------------------------------------------------------------
// THE AGENT LOOP
// 1. Send the conversation + tools to Claude.
// 2. Stream its words to the browser as they arrive.
// 3. If it asks to use tools, run them, send the results back, repeat.
// 4. Stop when it answers without asking for a tool.
// Events go to the browser as Server-Sent Events (one JSON per line).
// ---------------------------------------------------------------
export async function POST(req: Request) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!agentConfigured()) return bad('The agent needs an ANTHROPIC_API_KEY in Vercel environment variables.', 503);

  const body = await req.json().catch(() => null);
  const ref = refFrom(body || {});
  if (!ref) return bad('Pick an account first.');
  const accountName = String(body.accountName || ref.customerId).slice(0, 120);
  const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-30)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 20_000) }));
  if (!history.length || history[history.length - 1].role !== 'user') return bad('Send a message.');

  const profile = await getProfile(ref.customerId);
  const context = [
    `Today is ${todayIn()}.`,
    `Account: ${accountName} (customer ID ${ref.customerId}${ref.loginCustomerId !== ref.customerId ? `, via manager ${ref.loginCustomerId}` : ''}).`,
    isDemo() ? 'DEMO MODE: this is a sample account with generated data. Changes are only validated, never sent. Say so if the user asks about applying.' : '',
    profile ? `Strategy profile for this account:\n${JSON.stringify(profile, null, 2)}` : 'No strategy profile saved for this account yet.',
    `User: ${session!.name} (${session!.email}).`,
  ].filter(Boolean).join('\n');

  const client = new Anthropic({ apiKey: env.anthropic.apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const turn = client.messages.stream({
            model: env.anthropic.model,
            max_tokens: 16_000,
            // The playbook is cached between requests: faster and cheaper.
            system: [
              { type: 'text', text: PLAYBOOK, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: context },
            ],
            tools: TOOLS,
            messages,
          });
          turn.on('text', (delta) => emit({ type: 'text', delta }));
          const msg = await turn.finalMessage();
          // Keep the assistant turn exactly as returned (including any
          // thinking blocks) — the API requires it alongside tool results.
          messages.push({ role: 'assistant', content: msg.content });

          const calls = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
          if (msg.stop_reason !== 'tool_use' || !calls.length) break;

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const call of calls) {
            emit({ type: 'tool', name: call.name, status: 'running' });
            try {
              const out = await runTool(call.name, call.input, { ref, accountName, user: session!.email, emit });
              const text = JSON.stringify(out);
              results.push({ type: 'tool_result', tool_use_id: call.id, content: text.length > 60_000 ? text.slice(0, 60_000) + '…(truncated)' : text });
              emit({ type: 'tool', name: call.name, status: 'done' });
            } catch (e: any) {
              results.push({ type: 'tool_result', tool_use_id: call.id, content: String(e?.message || e), is_error: true });
              emit({ type: 'tool', name: call.name, status: 'error', message: String(e?.message || e).slice(0, 300) });
            }
          }
          messages.push({ role: 'user', content: results });
          emit({ type: 'text', delta: '\n\n' });
        }
        emit({ type: 'done' });
      } catch (e: any) {
        emit({ type: 'error', message: e?.message || 'The agent stopped unexpectedly.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
