# 🔒 **EQUORIA SECURITY DOCUMENTATION**

## **Overview**

This document outlines the comprehensive security measures implemented in Equoria to prevent common exploits and vulnerabilities that have plagued horse simulation games like Horseland, Ludus Equinus, and Equus Ipsum.

---

## 🚨 **Critical Security Measures**

### **1. Authentication & Authorization**

#### **JWT Token Security**
- **Token Verification**: All tokens verified with cryptographic signatures
- **Token Fingerprinting**: Anti-tampering measures with user fingerprints
- **Expiration Enforcement**: Multiple layers of expiration checking
- **Role-Based Access**: Strict role validation for all operations
- **Resource Ownership**: Users can only access/modify their own resources

#### **Password Security**
- **Bcrypt Hashing**: Minimum 12 rounds for production
- **Password Requirements**: Minimum 8 characters with complexity rules
- **Secure Verification**: Constant-time comparison to prevent timing attacks

### **2. Game Integrity Protection**

#### **Stat Manipulation Prevention**
```javascript
// Protected stats that cannot be directly modified
const protectedStats = [
  'precision', 'strength', 'speed', 'agility', 'endurance', 
  'intelligence', 'personality', 'total_earnings', 'level'
];
```

#### **Resource Duplication Prevention**
- **Operation Tracking**: Prevents duplicate operations within 5 seconds
- **Request Fingerprinting**: Unique operation signatures
- **Memory-based Deduplication**: In-memory tracking of recent operations

#### **Training System Security**
- **Ownership Validation**: Only horse owners can train their horses
- **Age Requirements**: Horses must be 3+ years old
- **Health Checks**: Injured horses cannot train
- **Cooldown Enforcement**: Global 7-day cooldown prevents stat stacking
- **Discipline Validation**: Only valid disciplines accepted

#### **Breeding System Security**
- **Biological Validation**: Proper sex and age requirements
- **Ownership Verification**: Access control for sires and dams
- **Cooldown Management**: 30-day breeding cooldowns
- **Health Requirements**: Injured horses cannot breed
- **Self-Breeding Prevention**: Horses cannot breed with themselves

#### **Financial Transaction Security**
- **Balance Verification**: Real-time balance checking
- **Transaction Limits**: Maximum transaction amounts enforced
- **Transfer Validation**: Prevents self-transfers and invalid targets
- **Audit Logging**: All financial operations logged

### **3. Input Validation & Sanitization**

#### **Comprehensive Data Validation**
- **Horse Data**: Name, age, sex, stats, financial data validation
- **user Data**: Name, email, money, level, XP validation
- **Breeding Data**: Sire/dam validation, fee limits
- **Training Data**: Horse ID, discipline, ownership validation
- **Transaction Data**: Amount, type, description validation

#### **XSS Prevention**
```javascript
// Input sanitization removes dangerous content
sanitized = input
  .replace(/[<>]/g, '') // Remove HTML tags
  .replace(/javascript:/gi, '') // Remove javascript: protocols
  .replace(/on\w+\s*=/gi, '') // Remove event handlers
  .replace(/data:/gi, '') // Remove data: protocols
```

#### **SQL Injection Prevention**
- **Prisma ORM**: Parameterized queries prevent SQL injection
- **Input Validation**: All inputs validated before database operations
- **Type Checking**: Strict type validation for all parameters

### **4. Rate Limiting & Anti-Automation**

#### **Multi-Layer Rate Limiting**
- **Global Rate Limits**: 100 requests per 15 minutes per IP
- **Auth Rate Limits**: 5 login attempts per 15 minutes
- **Operation-Specific Limits**: Custom limits for sensitive operations
- **Anti-Automation**: Detects and blocks rapid-fire requests

#### **Suspicious Activity Detection**
```javascript
// Patterns detected:
- Excessive failures (10+ failed requests)
- Rapid-fire requests (20+ in 30 seconds)
- Multiple IP addresses (3+ IPs per user)
- Excessive sensitive operations (15+ in 5 minutes)
- Error-then-success patterns (exploit attempts)
```

### **5. Audit Logging & Monitoring**

#### **Comprehensive Audit Trail**
- **High-Sensitivity Operations**: Breeding, transactions, stat modifications
- **User Activity Tracking**: All operations logged with context
- **Suspicious Pattern Detection**: Real-time monitoring for exploits
- **Data Sanitization**: Sensitive data redacted in logs

#### **Security Alerts**
- **Automatic Detection**: Suspicious patterns trigger alerts
- **Detailed Logging**: Full context for security investigations
- **Pattern Analysis**: Multiple detection algorithms

### **6. Data Integrity**

#### **Hash Verification**
```javascript
// Data integrity verification
const dataHash = crypto.createHash('sha256')
  .update(JSON.stringify(data, Object.keys(data).sort()))
  .digest('hex');
```

#### **Timestamp Validation**
- **Server-Side Timestamps**: All operations use server time
- **Clock Drift Tolerance**: 5-minute tolerance for client clocks
- **Time Manipulation Detection**: Prevents time-based exploits

### **7. File Upload Security**

#### **File Validation**
- **Size Limits**: 5MB maximum file size
- **Type Validation**: Only JPEG, PNG, GIF, WebP allowed
- **Name Sanitization**: Prevents malicious file names
- **Content Verification**: MIME type validation

---

## 🛡️ **Common Exploit Prevention**

### **Stat Hacking**
- ✅ **Protected Fields**: Direct stat modification blocked
- ✅ **Range Validation**: All stats must be 0-100
- ✅ **Training Only**: Stats can only increase through legitimate training
- ✅ **Audit Logging**: All stat changes logged and monitored

### **Money Duplication**
- ✅ **Balance Verification**: Real-time balance checking
- ✅ **Transaction Limits**: Maximum amounts enforced
- ✅ **Duplicate Prevention**: Prevents rapid duplicate transactions
- ✅ **Audit Trail**: All financial operations logged

### **Resource Duplication**
- ✅ **Operation Tracking**: Prevents duplicate operations
- ✅ **Request Fingerprinting**: Unique operation signatures
- ✅ **Time-Based Blocking**: 5-second cooldown on identical operations

### **Training Exploits**
- ✅ **Global Cooldowns**: One discipline per week limit
- ✅ **Ownership Validation**: Only owners can train horses
- ✅ **Age Requirements**: Minimum age enforcement
- ✅ **Health Checks**: Injured horses cannot train

### **Breeding Exploits**
- ✅ **Biological Validation**: Proper sex and age requirements
- ✅ **Cooldown Enforcement**: 30-day breeding cooldowns
- ✅ **Ownership Verification**: Access control for breeding
- ✅ **Health Requirements**: Injured horses cannot breed

### **Time Manipulation**
- ✅ **Server Timestamps**: All operations use server time
- ✅ **Clock Validation**: Client timestamp verification
- ✅ **Cooldown Enforcement**: Server-side cooldown management

### **Account Sharing/Compromise**
- ✅ **IP Monitoring**: Multiple IP detection
- ✅ **Session Management**: Secure JWT tokens
- ✅ **Activity Patterns**: Suspicious behavior detection
- ✅ **Access Logging**: All access attempts logged

---

## 🔧 **Security Configuration**

### **Environment Variables**
```bash
# Required Security Settings
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Production Security Checklist**
- [ ] Change default JWT_SECRET
- [ ] Change default SESSION_SECRET
- [ ] Set BCRYPT_ROUNDS to 12+
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS only
- [ ] Set up monitoring and alerting
- [ ] Configure database connection limits
- [ ] Enable audit logging
- [ ] Set up backup and recovery

---

## 📊 **Security Monitoring**

### **Key Metrics to Monitor**
- Failed authentication attempts
- Rate limit violations
- Suspicious activity patterns
- Large financial transactions
- Multiple IP access per user
- Error-then-success patterns
- Rapid operation sequences

### **Alert Thresholds**
- **High Priority**: Multiple IP addresses, large transactions, stat manipulation attempts
- **Medium Priority**: Rate limit violations, excessive failures
- **Low Priority**: Invalid input attempts, 404 errors

---

## 🚀 **Security Best Practices**

### **For Developers**
1. **Never trust client input** - Validate everything server-side
2. **Use parameterized queries** - Prevent SQL injection
3. **Implement proper error handling** - Don't leak sensitive information
4. **Log security events** - Maintain audit trails
5. **Follow principle of least privilege** - Minimal required permissions
6. **Regular security reviews** - Code and configuration audits

### **For Operations**
1. **Keep dependencies updated** - Regular security patches
2. **Monitor security logs** - Real-time threat detection
3. **Backup regularly** - Secure backup procedures
4. **Network security** - Firewalls and access controls
5. **Incident response plan** - Prepared response procedures

---

## 🔍 **Security Testing**

### **Automated Testing**
- Unit tests for all validation functions
- Integration tests for security middleware
- Penetration testing for common vulnerabilities
- Load testing for rate limiting effectiveness

### **Manual Testing**
- Authentication bypass attempts
- Authorization escalation tests
- Input validation boundary testing
- Session management verification

---

## 📞 **Security Incident Response**

### **Immediate Actions**
1. **Identify the threat** - Determine scope and impact
2. **Contain the incident** - Prevent further damage
3. **Preserve evidence** - Maintain audit logs
4. **Notify stakeholders** - Internal and external communication
5. **Remediate vulnerabilities** - Fix security gaps
6. **Monitor for recurrence** - Enhanced monitoring

### **Contact Information**
- **Security Team**: security@equoria.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
- **Incident Reporting**: incidents@equoria.com

---

## 📚 **Additional Resources**

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

*Last Updated: 2025-01-XX*
*Version: 1.0* 