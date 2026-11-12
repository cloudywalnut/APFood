# FIF student chat - 12 November 2026

The local app is configured with `FIF_CHAT_PROVIDER=gemini`. Both provider integrations remain available, but explicit Gemini mode never calls OpenAI. The supplied OpenAI key and requested `gpt-6-luna` model were saved to ignored `.env.local`; OpenAI rejected the key with HTTP 401 `invalid_api_key`. Replace it locally before enabling OpenAI or auto mode. No key is included in this document or committed source.

Confirmed causes and repairs:

- The old handler always selected OpenAI when any OpenAI key existed, without trying Gemini on failure. Provider selection is now explicit and auto mode can fall back between providers.
- A menu/deals lookup could time out on the second model call under the old 13-second deadline. Chat now has one 20-second budget, bounded model requests and tool execution, beneath the client's 25-second limit.
- Gemini now receives a matching response for every requested tool call, while only four lookups execute per turn. This prevents an oversized tool batch from invalidating the follow-up request.
- Provider failures retain safe diagnostic codes. Neither credentials nor student questions/results are logged.
- Service outages can still answer a plain greeting and offer order/menu navigation, without fabricating account facts.

Live localhost API checks with an existing student account passed for `hiii`, latest order status, current meal deals and fastest pickup windows. The deals answer returned real current prices and three allowed item links; pickup advice returned available stalls, window times and cart navigation. A direct Gemini request returned HTTP 200. The invalid OpenAI credential was not retried after Gemini-only mode was selected. OpenAI transport/tool behavior is covered with controlled provider responses; successful live OpenAI authentication remains blocked by the rejected key.

Regression coverage includes explicit provider isolation, automatic fallback, owner-tool reuse, outage behavior, safe error codes, complete Gemini tool responses and the existing OpenAI tool-call loop.

Final checks: 37 unit/isolated API tests and 23 backend tests passed, as did typecheck and production build. Formatting remains blocked by the pre-existing missing local Prettier package. The local server remains available at http://localhost:3000. Nothing was pushed.

## Follow-up reliability repair

The student browser subsequently reproduced intermittent Gemini timeouts and HTTP 503 responses. The previous successful API checks did not establish consistent browser behavior.

- Common requests (greetings, active/latest orders, deals, recent history, cart and fastest pickup windows) now use the existing authenticated data tools directly. Simple supported budget questions preserve stall and strict price constraints. Extra constraints continue to the model rather than being silently discarded.
- Gemini remains the conversational provider. Its request timeout may use up to 18 seconds within the shared 20-second budget. One initial 502/503 response can be retried within that same budget; authentication failures are never retried.
- A completed authorized lookup is retained and rendered from validated data if the follow-up model call fails. Successful tool data no longer becomes a generic outage message merely because the second model call timed out.
- Menu search no longer matches every dish through the stall's broad cuisine category or silently switches an all-terms query to any-term matching. Singular/plural dish search is retained.
- The chat header includes Start new chat to clear the current tab's conversation, including older failures.

Browser verification used the actual student chat: active order status, current deals, Chinese meals strictly under RM10 and a free-form Gemini question about Chinese noodle choices all rendered with current data and item links. These checks do not guarantee Gemini's external availability. Common data requests and completed-tool fallback cover its observed failure modes without invented answers.

Follow-up final checks passed: 44 unit/isolated tests, 24 backend tests, typecheck and production build. Formatting still cannot run because Prettier is missing locally. Browser evidence is `functional-audit/student-fif-fixed.png`. No changes were pushed.
