## Description

Brief description of the changes.

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Infrastructure
- [ ] Documentation

## Checklist

### Architecture
- [ ] Business logic is in the domain layer, not in n8n workflows
- [ ] No unnecessary dependencies introduced
- [ ] Adapter is isolated

### Security
- [ ] No secrets, cookies, tokens, or personal IDs in code/fixtures/logs
- [ ] All external URLs are validated
- [ ] No SSRF/open redirect risk
- [ ] Browser state is gitignored
- [ ] No increase in permissions

### Data
- [ ] Migration is reversible or has a rollback plan
- [ ] Indexes support the query
- [ ] Money uses integer cents
- [ ] Idempotency is preserved

### Quality
- [ ] Tests cover success and failure paths
- [ ] Errors are typed
- [ ] Logs include correlation ID
- [ ] Names express intent
- [ ] No dead or duplicated code

### n8n (if workflow changed)
- [ ] Workflow exported as JSON
- [ ] Credentials removed from export
- [ ] Timeout/retry defined
- [ ] Error path exists
- [ ] Execution is idempotent
