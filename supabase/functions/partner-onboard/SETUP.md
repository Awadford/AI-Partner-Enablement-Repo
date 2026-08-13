# Partner Onboarding Automation — Setup Guide

End-to-end automation triggered when a new Salesforce Partner Account is created.

**What happens automatically:**
1. Salesforce creates a Non-Production Pendo Subscription (`Subscription__c`) using the Partner Contact Email from the Account as the initial admin
2. Salesforce calls the Supabase Edge Function
3. Edge Function creates the partner in the AI Enablement Portal
4. Partner Contact email domain is added to the portal
5. Partner Contact is added as a pending learner (auto-activated when they sign up)
6. A Slack channel `#external-{partner}-partnership-core-team` is created
7. Onboarding message with the portal signup link is posted to that channel

---

## Step 1 — Deploy the Edge Function

From your Mac terminal, in the project root:

```bash
cd "/Users/andrew.wadford/Documents/Claude/Projects/Partner Enablement/partner-enablement-portal"
npx supabase functions deploy partner-onboard --project-ref nvzkmqumglqlvkrokzkn
```

Once deployed, the function URL will be:
```
https://nvzkmqumglqlvkrokzkn.supabase.co/functions/v1/partner-onboard
```

---

## Step 2 — Set Supabase Secrets

In [Supabase Dashboard → Project Settings → Edge Functions → Secrets](https://supabase.com/dashboard/project/nvzkmqumglqlvkrokzkn/settings/functions), add:

| Secret name | Value |
|---|---|
| `PARTNER_ONBOARD_SECRET` | A random string you choose — copy it, you'll also paste it into the SF Apex class. E.g. `pendo-partner-2026-secret` |
| `SLACK_BOT_TOKEN` | Your Slack bot OAuth token (starts with `xoxb-`) — see Step 3 below |

---

## Step 3 — Slack Bot Token

The automation creates a new Slack channel (`#external-{partner-name}-partnership-core-team`) and posts the onboarding message there. This requires a **Slack Bot Token**, not just a webhook.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it `Partner Onboarding Bot`, pick your workspace
3. Go to **OAuth & Permissions** → scroll to **Bot Token Scopes** → add:
   - `channels:manage` — create public channels
   - `chat:write` — post messages
   - `chat:write.public` — post to channels the bot hasn't joined
4. Click **Install to Workspace** → approve
5. Copy the **Bot User OAuth Token** (`xoxb-...`)
6. Paste it as `SLACK_BOT_TOKEN` in Supabase secrets

---

## Step 4 — Salesforce Record-Triggered Flow

Build this in **Setup → Process Automation → Flows → New Flow → Record-Triggered Flow**.

### Trigger
- **Object**: Account
- **Trigger**: A record is created
- **Condition**: `Partner_Type__c Is Not Null`
- **Optimize for**: Actions and Related Records

### Element 1 — Environment Decision
Add a **Decision** element to set the Pendo environment based on region:
- If `{!$Record.Partner_Region__c} Equals EMEA` → outcome `EU`
- Else if `{!$Record.Partner_Region__c} Equals JPN` → outcome `Japan`
- Default outcome → `US`

### Element 2 — Create NPU Subscription
- Type: **Create Records**
- Label: `Create Pendo Subscription`
- Object: `Subscription__c`

| Field | Value |
|---|---|
| `Account__c` | `{!$Record.Id}` |
| `Pendo_Subscription_Name__c` | `{!$Record.Name} Partner Sub` |
| `contactId__c` | *(leave blank — no Contact record exists yet at account creation time)* |
| `Pendo_Environment__c` | Set via the Decision element above (EU / Japan / US) |
| `Pendo_Non_Production__c` | `True` |

> **Note on Initial Admin**: The `Partner_Contact_Email__c` field is passed to the Edge Function as the initial portal admin. The `contactId__c` lookup on the Subscription can be updated manually once Contacts are added to the account.

### Element 3 — Apex Callout to Edge Function

Deploy this Apex class in your org (**Developer Console → New Apex Class**):

```apex
public class PartnerOnboardCallout {
    @InvocableMethod(label='Notify Partner Portal')
    public static void notify(List<Id> accountIds) {
        Id accountId = accountIds[0];
        Account acc = [
            SELECT Id, Name, Website, Partner_Region__c,
                   Partner_Type__c, Partner_Sub_Type__c,
                   Partner_Contact_Name__c, Partner_Contact_Email__c
            FROM Account
            WHERE Id = :accountId
            LIMIT 1
        ];

        Map<String, Object> payload = new Map<String, Object>{
            'accountId'           => acc.Id,
            'accountName'         => acc.Name,
            'website'             => acc.Website,
            'partnerRegion'       => acc.Partner_Region__c,
            'partnerType'         => acc.Partner_Type__c,
            'partnerSubType'      => acc.Partner_Sub_Type__c,
            'partnerContactName'  => acc.Partner_Contact_Name__c,
            'partnerContactEmail' => acc.Partner_Contact_Email__c
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://nvzkmqumglqlvkrokzkn.supabase.co/functions/v1/partner-onboard');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('X-Onboard-Secret', 'YOUR_PARTNER_ONBOARD_SECRET');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);
        System.debug('Partner onboard response: ' + res.getStatusCode() + ' ' + res.getBody());
    }
}
```

**Before deploying**, also add a **Remote Site Setting**:
- Setup → Security → Remote Site Settings → New
- Name: `SupabasePartnerOnboard`
- URL: `https://nvzkmqumglqlvkrokzkn.supabase.co`

**In the Flow**, add an **Action** element → search for `Notify Partner Portal` → pass `{!$Record.Id}` as the accountId input.

---

## Step 5 — Verify the full flow

Test by creating a new Account in SF with:
- Account Name: `Test Partner Co`
- Partner Type: `Solution Partner`
- Partner Region: `NA`
- Partner Contact Name: `Jane Doe`
- Partner Contact Email: `jane@testpartner.com`

Check:
- [ ] `Subscription__c` created under the account in SF
- [ ] Partner appears in the AI Enablement Portal admin
- [ ] Email domain `testpartner.com` added
- [ ] Slack channel `#external-test-partner-co-partnership-core-team` created
- [ ] Onboarding message posted in that channel with portal signup link

---

## Field API Name Reference

| Label | API Name |
|---|---|
| Partner Region | `Partner_Region__c` |
| Partner Type | `Partner_Type__c` |
| Partner Sub Type | `Partner_Sub_Type__c` |
| Partner Status | `Partner_Status__c` |
| Partner Contact Name | `Partner_Contact_Name__c` |
| Partner Contact Email | `Partner_Contact_Email__c` |
| Pendo Subscription (object) | `Subscription__c` |
| Pendo Sub Display Name | `Pendo_Subscription_Name__c` |
| Initial Pendo Admin (Contact lookup) | `contactId__c` |
| Pendo Environment | `Pendo_Environment__c` |
| Non-Production | `Pendo_Non_Production__c` |
| Account (parent) | `Account__c` |
