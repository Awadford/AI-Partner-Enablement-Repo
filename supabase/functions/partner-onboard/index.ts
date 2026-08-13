/**
 * partner-onboard Edge Function
 *
 * Triggered by a Salesforce Record-Triggered Flow HTTP callout when a
 * Partner Account is created. Orchestrates the full onboarding sequence:
 *
 *   1. Create partner record in Supabase
 *   2. Add email domain from the Partner Contact email
 *   3. Create lms_pending_registration for the Partner Contact
 *   4. Create a Slack channel: #external-{partner-slug}-partnership-core-team
 *   5. Post onboarding notification to that channel
 *   6. Cache the SF account for admin typeahead search
 *
 * Required Supabase secrets (set in Dashboard → Project Settings → Edge Functions):
 *   PARTNER_ONBOARD_SECRET    – shared token sent by SF Flow in X-Onboard-Secret header
 *   SLACK_BOT_TOKEN            – Slack bot OAuth token (xoxb-...) with scopes:
 *                                channels:manage, chat:write, chat:write.public
 *   SUPABASE_URL               – auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  – auto-injected (for DB writes bypassing RLS)
 *
 * SF Payload shape (sent as JSON body):
 * {
 *   accountId:            "001Pe...",
 *   accountName:          "Acme Corp",
 *   website:              "acme.com",
 *   partnerRegion:        "EMEA" | "NA" | "LATAM" | "ANZ/APAC" | "JPN",
 *   partnerType:          "Solution Partner",
 *   partnerSubType:       "Reseller",
 *   partnerContactName:   "Jane Doe",          // Partner_Contact_Name__c on Account
 *   partnerContactEmail:  "jane@acme.com"       // Partner_Contact_Email__c on Account
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PORTAL_URL = "https://ai-partner-enablement-repo.vercel.app";

interface OnboardPayload {
  accountId: string;
  accountName: string;
  website: string | null;
  partnerRegion: string;
  partnerType: string;
  partnerSubType: string | null;
  partnerContactName: string | null;
  partnerContactEmail: string | null;
}

function regionToEnblStage(_region: string): "pre" | "active" | "post" {
  return "pre";
}

function extractDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return parts[1].toLowerCase().trim();
}

function isPersonalDomain(domain: string): boolean {
  return ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain);
}

/**
 * Converts a partner name into a Slack-safe channel slug.
 * "Bildung Data" → "bildung-data"
 */
function toChannelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 40);
}

/**
 * Creates a Slack channel and returns its ID.
 * If the channel already exists, returns the existing channel ID.
 */
async function createSlackChannel(botToken: string, channelName: string): Promise<string | null> {
  const res = await fetch("https://slack.com/api/conversations.create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: channelName, is_private: false }),
  });
  const data = await res.json();

  if (data.ok) return data.channel.id;

  // Channel already exists — look up its ID
  if (data.error === "name_taken") {
    const listRes = await fetch(
      `https://slack.com/api/conversations.list?types=public_channel&limit=1000`,
      { headers: { Authorization: `Bearer ${botToken}` } }
    );
    const listData = await listRes.json();
    if (listData.ok) {
      const existing = listData.channels.find(
        (c: { name: string; id: string }) => c.name === channelName
      );
      return existing?.id ?? null;
    }
  }

  console.error("Slack channel creation failed:", data.error);
  return null;
}

async function postSlackMessage(
  botToken: string,
  channelId: string,
  payload: OnboardPayload,
  partnerId: string
): Promise<void> {
  const portalAdminUrl = `${PORTAL_URL}/admin/partners/${partnerId}`;
  const portalSignupUrl = `${PORTAL_URL}/signup`;

  const contactLine = payload.partnerContactName
    ? `${payload.partnerContactName}${payload.partnerContactEmail ? ` — ${payload.partnerContactEmail}` : ""}`
    : payload.partnerContactEmail ?? "Not provided";

  const body = {
    channel: channelId,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🎉 ${payload.accountName} is now onboarded!` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Region:*\n${payload.partnerRegion}` },
          {
            type: "mrkdwn",
            text: `*Type:*\n${payload.partnerType}${payload.partnerSubType ? ` · ${payload.partnerSubType}` : ""}`,
          },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Partner contact:*\n${contactLine}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Share this link with the partner team to get started:*\n<${portalSignupUrl}|${portalSignupUrl}>\n_They should sign up using their work email — their account is already pre-linked._`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in Portal (Admin)" },
            url: portalAdminUrl,
            style: "primary",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "NPU subscription created in SF ✓ · Portal account created ✓ · Domain linked ✓",
          },
        ],
      },
    ],
  };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) console.error("Slack postMessage failed:", data.error);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = req.headers.get("X-Onboard-Secret");
  const expectedSecret = Deno.env.get("PARTNER_ONBOARD_SECRET");
  if (!secret || secret !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: OnboardPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const slackBotToken = Deno.env.get("SLACK_BOT_TOKEN")!;

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Create partner record ──────────────────────────────────────────────
  const { data: partnerData, error: partnerError } = await supabase
    .from("partners")
    .insert({
      name: payload.accountName,
      enbl_stage: regionToEnblStage(payload.partnerRegion),
      category_type: payload.partnerType,
      region: payload.partnerRegion,
      salesforce_account_id: payload.accountId,
      salesforce_account_name: payload.accountName,
    })
    .select("id")
    .single();

  if (partnerError || !partnerData) {
    console.error("Partner insert error:", partnerError);
    return new Response(JSON.stringify({ error: "Failed to create partner" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const partnerId = partnerData.id as string;

  // ── 2. Add email domain ───────────────────────────────────────────────────
  if (payload.partnerContactEmail) {
    const domain = extractDomain(payload.partnerContactEmail);
    if (domain && !isPersonalDomain(domain)) {
      await supabase
        .from("lms_partner_domains")
        .insert({ partner_id: partnerId, domain });
    }
  }

  // ── 3. Create pending registration for the partner contact ────────────────
  if (payload.partnerContactEmail) {
    await supabase.from("lms_pending_registrations").insert({
      partner_id: partnerId,
      email: payload.partnerContactEmail.toLowerCase(),
      full_name: payload.partnerContactName ?? null,
      title: null,
    });
  }

  // ── 4. Create Slack channel + post notification ───────────────────────────
  if (slackBotToken) {
    try {
      const slug = toChannelSlug(payload.accountName);
      const channelName = `external-${slug}-partnership-core-team`;
      const channelId = await createSlackChannel(slackBotToken, channelName);
      if (channelId) {
        await postSlackMessage(slackBotToken, channelId, payload, partnerId);
      }
    } catch (e) {
      console.error("Slack setup failed:", e);
    }
  }

  // ── 5. Cache the SF account for admin typeahead search ───────────────────
  await supabase.from("sf_accounts_cache").upsert({
    sf_id: payload.accountId,
    name: payload.accountName,
    website: payload.website ?? null,
  });

  return new Response(
    JSON.stringify({ success: true, partnerId }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
