# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Rexpo Network Inspector seriously. If you discover a security vulnerability, please follow these steps:

### Please Do:

1. **Email us directly** at: **omeremreelma@gmail.com**
2. **Include detailed information** about the vulnerability:

   - Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
   - Full paths of source file(s) related to the manifestation of the issue
   - The location of the affected source code (tag/branch/commit or direct URL)
   - Any special configuration required to reproduce the issue
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit it

3. **Allow us time to respond** - We will acknowledge receipt within 48 hours and aim to provide a detailed response within 7 days.

### Please Don't:

- **Do NOT create a public GitHub issue** for security vulnerabilities
- **Do NOT disclose the vulnerability publicly** until we've had a chance to address it
- **Do NOT attempt to access or modify data** that doesn't belong to you

## Response Process

1. **Acknowledgment**: We'll acknowledge receipt of your vulnerability report within 48 hours
2. **Investigation**: We'll investigate and validate the reported vulnerability
3. **Fix Development**: We'll develop and test a fix
4. **Disclosure**: We'll release a security update and publicly disclose the vulnerability after the fix is available
5. **Credit**: We'll acknowledge your contribution (if desired) in the security advisory

## Security Best Practices for Users

When using Rexpo Network Inspector:

1. **Development Only**: This tool is designed for development environments only
2. **Network Security**: Ensure your WebSocket connection is only accessible on trusted networks
3. **Sensitive Data**: Be aware that network traffic containing sensitive data (tokens, passwords) will be visible in the inspector
4. **Production**: Never enable the network agent in production builds
5. **Updates**: Keep the tool updated to receive security patches

## Known Security Considerations

### WebSocket Server

- The inspector runs a WebSocket server on `localhost:5051`
- By default, it only accepts connections from localhost
- Ensure your firewall is properly configured if running on a shared network

### Data Exposure

- Request and response bodies are transmitted via WebSocket
- Sensitive data (auth tokens, API keys) may be visible in the UI
- Use appropriate filters or masking if needed

### Development Environment

- This tool is intended for development and debugging only
- Always ensure `__DEV__` check is in place in your Expo app
- Remove or disable the agent before deploying to production

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible

## Contact

For any security-related questions or concerns:

- **Email**: omeremreelma@gmail.com
- **GitHub**: https://github.com/omeremreelmali/rexpo-debugger

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities. Contributors will be acknowledged in our security advisories (unless they prefer to remain anonymous).

---

**Thank you for helping keep Rexpo Network Inspector and its users safe!**
