const dns = require('dns').promises;
const busboy = require('busboy');

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DNS_TIMEOUT_MS = 5000; // 5 seconds
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_LOCAL_PART_LENGTH = 64; // RFC 5321

// Email validation status codes
const ValidationStatus = {
    // Pass statuses
    SUCCESS: 'Success',
    SERVER_IS_CATCH_ALL: 'ServerIsCatchAll',
    
    // Fail statuses
    AT_SIGN_NOT_FOUND: 'AtSignNotFound',
    DNS_CONNECTION_FAILURE: 'DnsConnectionFailure',
    DNS_QUERY_TIMEOUT: 'DnsQueryTimeout',
    DOMAIN_DOES_NOT_EXIST: 'DomainDoesNotExist',
    DOMAIN_IS_MISCONFIGURED: 'DomainIsMisconfigured',
    DOMAIN_HAS_NULL_MX: 'DomainHasNullMx',
    DOMAIN_PART_COMPLIANCY_FAILURE: 'DomainPartCompliancyFailure',
    DOUBLE_DOT_SEQUENCE: 'DoubleDotSequence',
    INVALID_ADDRESS_LENGTH: 'InvalidAddressLength',
    INVALID_CHARACTER_IN_SEQUENCE: 'InvalidCharacterInSequence',
    INVALID_LOCAL_PART_LENGTH: 'InvalidLocalPartLength',
    UNHANDLED_EXCEPTION: 'UnhandledException',
    
    // Ignore statuses
    DUPLICATE: 'Duplicate',
    CATCH_ALL_VALIDATION_TIMEOUT: 'CatchAllValidationTimeout'
};

// Parse multipart form data
async function parseFormData(req) {
    return new Promise((resolve, reject) => {
        const bb = busboy({ headers: req.headers });
        const FILE_TOO_LARGE_ERROR = 'File too large. Maximum size is 5MB';
        let csvContent = '';
        let fileReceived = false;
        let fileSize = 0;
        let fileSizeExceeded = false;

        bb.on('file', (fieldname, file, info) => {
            const { filename, encoding, mimeType } = info;

            // Check if it's a CSV file
            if (!filename.endsWith('.csv')) {
                file.resume(); // drain the file stream
                reject(new Error('Please upload a valid CSV file'));
                return;
            }

            fileReceived = true;

            file.on('data', (data) => {
                if (fileSizeExceeded) {
                    return; // Already rejected, ignore further data
                }
                
                fileSize += data.length;
                
                if (fileSize > MAX_FILE_SIZE) {
                    fileSizeExceeded = true;
                    file.resume(); // drain the file stream
                    reject(new Error(FILE_TOO_LARGE_ERROR));
                    return;
                }
                
                csvContent += data.toString('utf8');
            });

            file.on('end', () => {
                // File processing complete
            });
        });

        bb.on('finish', () => {
            if (!fileReceived || !csvContent) {
                reject(new Error('No file uploaded'));
                return;
            }
            resolve(csvContent);
        });

        bb.on('error', (error) => {
            reject(error);
        });

        req.pipe(bb);
    });
}

// Sanitize email by removing dangerous characters
function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return '';
    }
    
    // Remove dangerous characters: <, >, ", ', ;, backslashes, newlines, tabs
    return email
        .replace(/[<>"';\\]/g, '')
        .replace(/[\r\n\t]/g, '')
        .trim();
}

// Comprehensive email format validation with status codes
function validateEmailFormat(email) {
    if (!email || typeof email !== 'string') {
        return ValidationStatus.INVALID_CHARACTER_IN_SEQUENCE;
    }
    
    // Check for @ sign
    const atSignCount = (email.match(/@/g) || []).length;
    if (atSignCount === 0) {
        return ValidationStatus.AT_SIGN_NOT_FOUND;
    }
    if (atSignCount > 1) {
        return ValidationStatus.INVALID_CHARACTER_IN_SEQUENCE;
    }
    
    // Check total length
    if (email.length > MAX_EMAIL_LENGTH) {
        return ValidationStatus.INVALID_ADDRESS_LENGTH;
    }
    
    // Check for double dots
    if (email.includes('..')) {
        return ValidationStatus.DOUBLE_DOT_SEQUENCE;
    }
    
    // Split into local and domain parts
    const parts = email.split('@');
    if (parts.length !== 2) {
        return ValidationStatus.AT_SIGN_NOT_FOUND;
    }
    
    const localPart = parts[0];
    const domainPart = parts[1];
    
    // Validate local part
    if (!localPart || localPart.length === 0) {
        return ValidationStatus.INVALID_LOCAL_PART_LENGTH;
    }
    if (localPart.length > MAX_LOCAL_PART_LENGTH) {
        return ValidationStatus.INVALID_LOCAL_PART_LENGTH;
    }
    
    // Check for invalid characters in local part
    // Allow: alphanumeric, dots, hyphens, underscores, plus signs
    const localPartRegex = /^[a-zA-Z0-9._+-]+$/;
    if (!localPartRegex.test(localPart)) {
        return ValidationStatus.INVALID_CHARACTER_IN_SEQUENCE;
    }
    
    // Local part cannot start or end with a dot
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
        return ValidationStatus.INVALID_CHARACTER_IN_SEQUENCE;
    }
    
    // Validate domain part
    if (!domainPart || domainPart.length === 0) {
        return ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE;
    }
    
    // Domain must have at least one dot and valid format
    if (!domainPart.includes('.')) {
        return ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE;
    }
    
    // Check for invalid characters in domain
    // Allow: alphanumeric, dots, hyphens
    const domainRegex = /^[a-zA-Z0-9.-]+$/;
    if (!domainRegex.test(domainPart)) {
        return ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE;
    }
    
    // Domain cannot start or end with a dot or hyphen
    if (domainPart.startsWith('.') || domainPart.endsWith('.') || 
        domainPart.startsWith('-') || domainPart.endsWith('-')) {
        return ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE;
    }
    
    // All format checks passed
    return null; // No format error
}

// Simple email format check for backward compatibility
function isValidEmail(email) {
    return validateEmailFormat(email) === null;
}

// Check MX records for a domain with timeout protection and status codes
async function checkMXRecords(domain) {
    // Create timeout promise
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ status: ValidationStatus.DNS_QUERY_TIMEOUT }), DNS_TIMEOUT_MS);
    });
    
    // Create DNS lookup promise
    const dnsPromise = dns.resolveMx(domain)
        .then(records => {
            if (!records || records.length === 0) {
                return { status: ValidationStatus.DOMAIN_HAS_NULL_MX };
            }
            return { status: ValidationStatus.SUCCESS, hasValidMX: true };
        })
        .catch((error) => {
            // DNS lookup failed - could be ENOTFOUND (domain doesn't exist) or connection issue
            if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
                return { status: ValidationStatus.DOMAIN_DOES_NOT_EXIST };
            }
            return { status: ValidationStatus.DNS_CONNECTION_FAILURE };
        });
    
    // Race DNS lookup against timeout
    return Promise.race([dnsPromise, timeoutPromise]);
}

// Extract domain from email with validation
function getDomain(email) {
    if (!email || typeof email !== 'string') {
        return null;
    }
    
    const parts = email.split('@');
    
    // Must have exactly 2 parts (local@domain)
    if (parts.length !== 2) {
        return null;  // Missing @ or multiple @
    }
    
    const domain = parts[1];
    
    // Domain must not be empty
    if (!domain || domain.length === 0) {
        return null;
    }
    
    return domain;
}

// Process CSV and validate emails
async function processCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    const emails = [];
    const seenEmails = new Set();

    // Parse CSV and extract unique email addresses (valid AND invalid)
    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            continue;
        }

        // Sanitize input to remove dangerous characters
        const sanitized = sanitizeEmail(trimmed);
        
        // If sanitization results in empty string, skip
        if (!sanitized) {
            continue;
        }

        const normalized = sanitized.toLowerCase();
        
        // Skip duplicates
        if (seenEmails.has(normalized)) {
            continue;
        }
        
        // Add ALL sanitized emails (we'll validate format later)
        // This ensures malformed emails are counted as invalid, not skipped
        emails.push(normalized);
        seenEmails.add(normalized);
    }

    return emails;
}

// Main validation function with comprehensive status codes
async function validateEmails(emails) {
    const maxEmails = 300;
    const emailsToValidate = emails.slice(0, maxEmails);

    // Map to store email validation status
    const emailStatusMap = new Map();
    
    // Group emails by domain for efficient validation
    const domainMap = new Map();
    
    // First pass: validate email format
    for (const email of emailsToValidate) {
        const formatStatus = validateEmailFormat(email);
        
        if (formatStatus !== null) {
            // Format validation failed - store the specific error status
            emailStatusMap.set(email, formatStatus);
            continue;
        }
        
        // Format is valid, extract domain for MX check
        const domain = getDomain(email);
        
        if (!domain) {
            // This shouldn't happen if format validation passed, but handle it
            emailStatusMap.set(email, ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE);
            continue;
        }
        
        // Group by domain for batch MX validation
        if (!domainMap.has(domain)) {
            domainMap.set(domain, []);
        }
        domainMap.get(domain).push(email);
    }

    // Second pass: validate MX records for each unique domain
    const domainValidation = new Map();
    const validationPromises = Array.from(domainMap.keys()).map(async (domain) => {
        const result = await checkMXRecords(domain);
        domainValidation.set(domain, result);
    });

    await Promise.all(validationPromises);

    // Third pass: assign final status to emails based on MX validation
    for (const email of emailsToValidate) {
        // Skip emails that already have a format error status
        if (emailStatusMap.has(email)) {
            continue;
        }
        
        const domain = getDomain(email);
        const mxResult = domainValidation.get(domain);
        
        if (mxResult && mxResult.status === ValidationStatus.SUCCESS) {
            emailStatusMap.set(email, ValidationStatus.SUCCESS);
        } else if (mxResult) {
            // Use the specific DNS error status
            emailStatusMap.set(email, mxResult.status);
        } else {
            // Fallback (shouldn't happen)
            emailStatusMap.set(email, ValidationStatus.UNHANDLED_EXCEPTION);
        }
    }

    // Count results based on status codes
    let validCount = 0;
    let invalidCount = 0;
    const emailResults = [];
    
    // Define which statuses are "Pass" vs "Fail"
    const passStatuses = new Set([
        ValidationStatus.SUCCESS,
        ValidationStatus.SERVER_IS_CATCH_ALL
    ]);
    
    const failStatuses = new Set([
        ValidationStatus.AT_SIGN_NOT_FOUND,
        ValidationStatus.DNS_CONNECTION_FAILURE,
        ValidationStatus.DNS_QUERY_TIMEOUT,
        ValidationStatus.DOMAIN_DOES_NOT_EXIST,
        ValidationStatus.DOMAIN_IS_MISCONFIGURED,
        ValidationStatus.DOMAIN_HAS_NULL_MX,
        ValidationStatus.DOMAIN_PART_COMPLIANCY_FAILURE,
        ValidationStatus.DOUBLE_DOT_SEQUENCE,
        ValidationStatus.INVALID_ADDRESS_LENGTH,
        ValidationStatus.INVALID_CHARACTER_IN_SEQUENCE,
        ValidationStatus.INVALID_LOCAL_PART_LENGTH,
        ValidationStatus.UNHANDLED_EXCEPTION
    ]);

    for (const email of emailsToValidate) {
        const status = emailStatusMap.get(email) || ValidationStatus.UNHANDLED_EXCEPTION;
        
        if (passStatuses.has(status)) {
            validCount++;
            emailResults.push({ email, status, valid: true });
        } else if (failStatuses.has(status)) {
            invalidCount++;
            emailResults.push({ email, status, valid: false });
        } else {
            // Ignore statuses - treat as invalid for counting
            invalidCount++;
            emailResults.push({ email, status, valid: false });
        }
    }

    const total = validCount + invalidCount;
    const percentage = total > 0 ? (validCount / total) * 100 : 0;

    return {
        total,
        valid: validCount,
        invalid: invalidCount,
        percentage,
        skipped: emails.length - emailsToValidate.length,
        emails: emailResults
    };
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Set headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse the uploaded CSV file
        const csvContent = await parseFormData(req);

        if (!csvContent) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Extract emails from CSV
        const emails = await processCSV(csvContent);

        if (emails.length === 0) {
            return res.status(400).json({ error: 'No valid email addresses found in file' });
        }

        if (emails.length > 300) {
            return res.status(400).json({ error: 'File exceeds 300 email limit' });
        }

        // Validate emails
        const result = await validateEmails(emails);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Validation error:', error);
        
        // Return 413 status for file size errors
        const FILE_TOO_LARGE_ERROR = 'File too large. Maximum size is 5MB';
        if (error.message === FILE_TOO_LARGE_ERROR) {
            return res.status(413).json({ error: error.message });
        }
        
        return res.status(500).json({ error: error.message || 'Error processing file. Please try again.' });
    }
};
