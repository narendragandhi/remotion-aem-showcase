# Identity and Access Model

## Trust boundaries

```text
Human user
  -> OIDC/SAML enterprise IdP
  -> application session
  -> application API authorization
  -> AEM IMS service identity
  -> AEM GraphQL/DAM
```

Human identity and AEM service identity are deliberately separate.

## Human users

The application should use OIDC for the normal web session and accept enterprise
federation through the customer’s IdP. SAML federation may be supported at the
identity broker for customers whose identity platform is SAML-first.

The application session should contain a stable subject, organization/tenant,
groups, and role claims. Email is useful for display and audit, but must not be the
primary identity key.

### Application roles

| Role | Capabilities |
|---|---|
| `campaign.viewer` | View authorized campaigns and previews |
| `campaign.editor` | Create drafts, edit overrides, request renders |
| `campaign.approver` | Approve/reject revisions and authorize production renders |
| `campaign.renderer` | Operate render jobs and publish approved outputs |
| `platform.admin` | Manage tenants, templates, policies, and integrations |

Authorization is enforced by the backend on every campaign, template, AEM tier,
render, and output operation. UI controls are not security boundaries.

## AEM service identity

The backend uses Adobe IMS OAuth Server-to-Server credentials to obtain short-lived
access tokens for AEM API calls. Credentials belong in a managed secret store or
deployment secret, never in browser code, Git, or a Content Fragment.

The AEM service identity should be least-privileged and scoped to the required
environment, GraphQL endpoint, DAM paths, and upload operations. Author and Publish
access should use separate credentials where the deployment model supports it.

## Local development

Local development may use the existing AEM Author token and a localhost-only
development bypass. The bypass must be disabled whenever the application is
reachable beyond localhost. The local provenance API is not an identity system.

## Production implementation order

1. Choose an OIDC-capable identity broker or integrate directly with the customer’s
   enterprise IdP.
2. Add callback/session middleware with secure, HTTP-only cookies.
3. Map organization groups to the application roles above.
4. Add tenant/campaign authorization checks to provenance and AEM routes.
5. Store Adobe IMS credentials in managed secrets and rotate them.
6. Emit actor and organization identifiers into review, render, and audit events.
7. Add tests for unauthenticated, unauthorized, cross-tenant, and revoked-user paths.
