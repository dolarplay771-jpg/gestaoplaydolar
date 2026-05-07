<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1s4tUQU76aDI6BpA_AaAlq_R_N4O59Pu0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies: `npm install`
2. Configure environment in [.env.local](.env.local):
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com as chaves do seu projeto Supabase
   - `VITE_GEMINI_API_KEY` (se usar integrações Gemini)
3. Run the app: `npm run dev`

## AbacatePay (Assinatura + Webhook)

O checkout usa Supabase Edge Functions para criar uma assinatura recorrente via `POST /v2/subscriptions/create`. O backend cria ou reaproveita o cliente na AbacatePay, resolve o produto recorrente e acompanha a liberacao do acesso pelo retorno do checkout e pelo webhook.

1. Atualize o banco com o novo trecho em `db_setup.sql` (tabela `payment_sessions`).
2. Configure as variaveis de ambiente no Supabase (secrets das Edge Functions):
   - `ABACATEPAY_API_KEY`
   - `ABACATEPAY_PUBLIC_KEY` (opcional, para validar a assinatura do webhook)
   - `ABACATEPAY_WEBHOOK_SECRET` (opcional, mas recomendado)
   - `ABACATEPAY_PRODUCT_ID` (opcional; se nao informar, a funcao usa `ABACATEPAY_PLAN_EXTERNAL_ID` para localizar ou criar o produto)
   - `ABACATEPAY_PLAN_PRICE_CENTS` (ex: `1999`)
   - `ABACATEPAY_PLAN_NAME` (ex: `Plano Pro`)
   - `ABACATEPAY_PLAN_DESCRIPTION`
   - `ABACATEPAY_PLAN_EXTERNAL_ID` (ex: `plano-pro`)
   - `ABACATEPAY_PLAN_CYCLE` (ex: `MONTHLY`)
   - `ABACATEPAY_SUBSCRIPTION_METHODS` (opcional; padrao `CARD`)
   - `ABACATEPAY_RETURN_URL`
   - `ABACATEPAY_COMPLETION_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Faca deploy das funcoes no Supabase:
   - `supabase functions deploy abacate-check --no-verify-jwt`
   - `supabase functions deploy abacate-checkout --no-verify-jwt`
   - `supabase functions deploy abacate-webhook --no-verify-jwt`
4. Cadastre o webhook na AbacatePay apontando para:
   - `https://<PROJECT_REF>.functions.supabase.co/abacate-webhook?webhookSecret=SEU_SEGREDO`
5. Se optar por nao definir `ABACATEPAY_PRODUCT_ID`, garanta que a sua chave da AbacatePay tenha permissao para ler e criar produtos (`PRODUCT:READ` e `PRODUCT:CREATE`).
