# Security Policy

## Supported versions

Security fixes target the latest version on `main` and the latest published
release. Older versions may not receive fixes.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private
security advisories when enabled for the repository, or contact the maintainers
through the private channel configured in the repository settings.

Include the affected version/commit, reproducible steps, impact, exploitation
path, and suggested mitigation if known.

## Security boundaries

- Never commit AEM tokens, IMS secrets, private keys, or `.env` files.
- Browser code must not receive AEM author credentials.
- Treat AEM GraphQL responses and authored asset URLs as untrusted input.
- Production provenance APIs require authentication and authorization; the local
  Vite API is a development adapter only.
- Review dependency and generated-artifact changes before merging.
