# AP Food email setup

AP Food uses Supabase Auth for signup, confirmation, invitations, email changes, and password recovery. Resend provides SMTP delivery. The application does not need a Resend API key at runtime.

## Sending domain

The sending domain is `notify.keyaan.my`, created in Resend's Tokyo region with tracking disabled. DNS for `keyaan.my` uses Exabytes nameservers. All four records below were published on 11 November 2026 and confirmed through Google's public DNS resolver. Resend subsequently confirmed the domain as **Verified**. A confirmation delivery succeeded in the earlier setup session. The full recovery, invitation, email-change, and template walkthrough remains outstanding; see [verification results](VERIFICATION.md).

Use `keyaan.my` for the current setup. The app's proposed deployed hostname is `food.keyaan.my`, with sender `AP Food <hello@notify.keyaan.my>`. `conceptsquad.my` is reserved for a later migration; its Resend domain has been created, but is not the current sending domain. Keep the local app origin unchanged until deployment exists.

Open the [Resend domain setup](https://resend.com/domains/add/8595fc81-0177-4165-ab6b-04aa0befa5b3). In the existing `keyaan.my` DNS zone, add the records generated for this domain.

| Type | Name within keyaan.my | Value |
| --- | --- | --- |
| TXT | `resend._domainkey.notify` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC85Jd9q1X4G/+iOT114RETIwwLeBMZcVHrpStI9er64bf3028uWCDSNOuOmo8kkIUDR9dTedd2GM7/YjOlfPRcXT9+9eXf8z2rlTHmKLAC3+V0CfUGyGiat6S7Gyf+WPPIdGLs3gWriLXUd7E4S+cUyaOZ+dFp27ZhRfxx7jUYCwIDAQAB` |
| CNAME | `rsend.notify` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.notify` | `send.forge.rmta.net` |
| TXT | `_dmarc.notify` | `v=DMARC1; p=none;` |

Use the DNS manager's default TTL. Confirm the values against Resend before saving, then start verification from the Resend domain screen.

## Supabase SMTP

In the AP Foods Supabase project, open **Authentication → Email → SMTP Settings**.

The sender and connection fields were entered during setup, and the operator supplied the SMTP password. The following table records the required configuration for future deployment or troubleshooting.

| Setting | Value |
| --- | --- |
| Sender email | `hello@notify.keyaan.my` |
| Sender name | `AP Food` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | A Resend sending key authorised for this domain |

Set the Supabase Auth site URL to the app's actual origin. For the current local walkthrough use `http://127.0.0.1:3000`. Allow its `/auth/callback` redirect. Add the deployed origin when it exists. The proposed app hostname is `food.keyaan.my`.

Paste the checked-in templates from `supabase/templates/` into their matching Supabase email-template editors. The callback exchanges `TokenHash` on the server. Recovery and invitation hashes also authorise the one-time password setup screen. Keep confirmation enabled and turn off email click tracking.

## Verification

Run signup, resend confirmation, password recovery, email change, and staff invitation through the application using addresses controlled by the operator. Confirm delivery in Resend, then follow each link and test expiration and reuse. SMTP and DNS verification are external setup gates. Sample accounts are already confirmed and can exercise the app while email setup is pending.

The current bootstrap Resend key is kept only in ignored local configuration. Rotate it after setup.

## Later domain migration

Before switching to `conceptsquad.my`, verify its Resend DNS records and configure app hosting and TLS. Then update the Supabase sender, Site URL, allowed callback URLs, and deployed `AP_FOOD_APP_ORIGIN` together. Test confirmation, recovery, and invitations on the new origin before retiring the old callback URLs. Domain changes do not require moving the Supabase database or recreating accounts.
