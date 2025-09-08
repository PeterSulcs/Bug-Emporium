# Certificate Troubleshooting Guide

This guide helps you resolve SSL certificate issues when connecting to self-signed or internal GitLab instances.

## Quick Diagnosis

Run the certificate debug tool to identify the issue:

```bash
# Set your environment variables
export GITLAB_ENDPOINT=https://your-gitlab.com
export GITLAB_TOKEN=your-token
export GITLAB_GROUP_ID=your-group-id
export GITLAB_CA_CERT_PATH=/path/to/your/cert.pem

# Run the debug tool
node debug-cert.js
```

## Common Issues and Solutions

### 1. Certificate File Not Found

**Error**: `Certificate path provided but file not found`

**Solutions**:
- Verify the file path is correct
- Check file permissions: `ls -la /path/to/cert.pem`
- Ensure the file exists: `test -f /path/to/cert.pem && echo "exists"`

### 2. Invalid Certificate Format

**Error**: `Certificate file may not be in PEM format`

**Solutions**:
- Ensure your certificate is in PEM format (starts with `-----BEGIN CERTIFICATE-----`)
- Convert from other formats if needed:
  ```bash
  # Convert from DER to PEM
  openssl x509 -inform DER -in cert.der -out cert.pem
  
  # Convert from P12 to PEM
  openssl pkcs12 -in cert.p12 -out cert.pem -nodes
  ```

### 3. SSL Certificate Verification Errors

**Error**: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_UNTRUSTED`, or `SELF_SIGNED_CERT_IN_CHAIN`

**Solutions**:

#### Option A: Use the Full Certificate Chain
```bash
# Get the full certificate chain
openssl s_client -showcerts -connect your-gitlab.com:443 -servername your-gitlab.com < /dev/null 2>/dev/null | openssl x509 -outform PEM > full-chain.pem

# Use the full chain
export GITLAB_CA_CERT_PATH=/path/to/full-chain.pem
```

#### Option B: Get Certificate from GitLab Instance
```bash
# Download certificate directly from GitLab
echo | openssl s_client -servername your-gitlab.com -connect your-gitlab.com:443 2>/dev/null | openssl x509 -outform PEM > gitlab-cert.pem

# Use the downloaded certificate
export GITLAB_CA_CERT_PATH=/path/to/gitlab-cert.pem
```

#### Option C: Use System Certificate Store
```bash
# Add certificate to system store (Linux)
sudo cp your-cert.pem /usr/local/share/ca-certificates/
sudo update-ca-certificates

# Then remove the custom cert path to use system certificates
unset GITLAB_CA_CERT_PATH
```

### 4. DNS Resolution Issues

**Error**: `ENOTFOUND`

**Solutions**:
- Verify the GitLab endpoint URL is correct
- Check network connectivity: `ping your-gitlab.com`
- Test with curl: `curl -I https://your-gitlab.com`

### 5. Authentication Issues

**Error**: `401 Unauthorized`

**Solutions**:
- Verify your GitLab token is correct
- Check token permissions (needs `read_api` scope)
- Ensure token is not expired
- Test token with curl:
  ```bash
  curl -H "Authorization: Bearer your-token" https://your-gitlab.com/api/v4/user
  ```

## Testing Your Configuration

### 1. Test Certificate Loading
```bash
node test-cert.js /path/to/your/cert.pem
```

### 2. Test GitLab Connection
```bash
# Start the server
npm start

# Test the connection endpoint
curl http://localhost:3001/api/test-gitlab
```

### 3. Test Full Application
```bash
# Start the server
npm start

# Test the issues endpoint
curl http://localhost:3001/api/issues
```

## Docker Deployment

### Mount Certificate in Container
```bash
docker run -p 3001:3001 \
  -e GITLAB_ENDPOINT=https://your-gitlab.com \
  -e GITLAB_TOKEN=your-token \
  -e GITLAB_GROUP_ID=your-group-id \
  -e GITLAB_CA_CERT_PATH=/etc/ssl/certs/gitlab-ca.pem \
  -v /path/to/your/cert.pem:/etc/ssl/certs/gitlab-ca.pem:ro \
  bug-emporium
```

### Build Certificate into Image
```dockerfile
# Add to your Dockerfile
COPY your-cert.pem /etc/ssl/certs/gitlab-ca.pem
ENV GITLAB_CA_CERT_PATH=/etc/ssl/certs/gitlab-ca.pem
```

## Kubernetes/Helm Deployment

### Using Secrets
```bash
# Create secret with certificate
kubectl create secret generic bug-emporium-secret \
  --from-literal=GITLAB_TOKEN=your-token \
  --from-literal=GITLAB_GROUP_ID=your-group-id \
  --from-file=GITLAB_CA_CERT=your-cert.pem

# Deploy with Helm
helm install bug-emporium ./helm/bug-emporium \
  --set secret.data.GITLAB_CA_CERT="$(base64 -i your-cert.pem)"
```

## Advanced Troubleshooting

### Enable Detailed Logging
```bash
# Set debug environment variable
export DEBUG=axios
npm start
```

### Test with OpenSSL
```bash
# Test certificate validity
openssl verify -CAfile your-cert.pem your-cert.pem

# Test SSL connection
openssl s_client -connect your-gitlab.com:443 -CAfile your-cert.pem
```

### Check Certificate Details
```bash
# View certificate information
openssl x509 -in your-cert.pem -text -noout

# Check certificate chain
openssl s_client -connect your-gitlab.com:443 -showcerts
```

## Still Having Issues?

1. **Check the server logs** for detailed error messages
2. **Use the debug tool**: `node debug-cert.js`
3. **Test with curl** to isolate the issue
4. **Verify certificate format** and validity
5. **Check network connectivity** and DNS resolution

## Common Certificate Formats

### PEM Format (Recommended)
```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvD8WQOMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
...
-----END CERTIFICATE-----
```

### DER Format
Binary format, needs conversion to PEM

### P12/PKCS#12 Format
Password-protected format, needs conversion to PEM

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `GITLAB_ENDPOINT` | GitLab instance URL | `https://gitlab.company.com` |
| `GITLAB_TOKEN` | Access token | `glpat-xxxxxxxxxxxxxxxxxxxx` |
| `GITLAB_GROUP_ID` | Group ID | `123` |
| `GITLAB_CA_CERT_PATH` | Certificate file path | `/etc/ssl/certs/gitlab-ca.pem` |
