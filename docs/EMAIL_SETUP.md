# AP Food email setup

Supabase Auth sends sign-up confirmation, invitation, email-change and password-recovery emails. Resend delivers them over SMTP. The app itself does not need a Resend key.

Configure this once per Supabase project. Until it is configured, the seeded demo accounts (already confirmed) can use the app, but new sign-ups cannot confirm their email.

## Sending domain

The sending domain is `notify.keyaan.my` in Resend (Tokyo region, tracking disabled), with sender `AP Food <hello@notify.keyaan.my>`. Its DNS records live in the `keyaan.my` zone:

| Type | Name within keyaan.my | Value |
| --- | --- | --- |
| TXT | `resend._domainkey.notify` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC85Jd9q1X4G/+iOT114RETIwwLeBMZcVHrpStI9er64bf3028uWCDSNOuOmo8kkIUDR9dTedd2GM7/YjOlfPRcXT9+9eXf8z2rlTHmKLAC3+V0CfUGyGiat6S7Gyf+WPPIdGLs3gWriLXUd7E4S+cUyaOZ+dFp27ZhRfxx7jUYCwIDAQAB` |
| CNAME | `rsend.notify` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.notify` | `send.forge.rmta.net` |
| TXT | `_dmarc.notify` | `v=DMARC1; p=none;` |

Confirm these against the domain page in Resend before changing DNS.

## Supabase SMTP

In the Supabase project, open **Authentication → Email → SMTP Settings**:

| Setting | Value |
| --- | --- |
| Sender email | `hello@notify.keyaan.my` |
| Sender name | `AP Food` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | A Resend sending key for this domain |

Keep the Resend key out of the repository.

## Auth URLs and templates

1. Set the Supabase Auth **Site URL** to the app's origin (for local development, `http://localhost:3000`) and allow its `/auth/callback` redirect. Add the deployed origin when there is one, and set `AP_FOOD_APP_ORIGIN` to match.
2. Paste the templates from `supabase/templates/` into the matching Supabase email-template editors. The callback route exchanges the token hash on the server; recovery and invitation links lead to the password setup screen.
3. Keep email confirmation enabled and click tracking off.

## Check it

Run sign-up, resend confirmation, password recovery, email change and staff invitation with addresses you control. Confirm delivery in Resend, then open each link and check that expired or reused links are rejected.

## Changing domain

To move to another domain, verify its records in Resend and set up hosting and TLS, then update the Supabase sender, Site URL, allowed callback URLs and `AP_FOOD_APP_ORIGIN` together. Test confirmation, recovery and invitations before removing the old callback URLs. Accounts and data stay as they are.
