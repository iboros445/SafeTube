import crypto from "crypto";

// ─── AES-256-GCM Encryption for API Keys ────────────────────────────
// Uses a randomly generated key file stored in the data directory.
// The key is created once on first use and persisted for subsequent runs.
// This module uses Node.js 'fs' and must only be imported from server code.
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_PREFIX = "enc:";

function getDerivedKey(): Buffer {
    const fs = require("fs");
    const path = require("path");
    const keyPath = path.join(process.cwd(), "data", ".encryption-key");
    let secret: string;
    if (fs.existsSync(keyPath)) {
        secret = fs.readFileSync(keyPath, "utf-8").trim();
    } else {
        secret = crypto.randomBytes(32).toString("hex");
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
        fs.writeFileSync(keyPath, secret, { mode: 0o600 });
    }
    return crypto.scryptSync(secret, "safetube-salt", 32);
}

export function encryptApiKey(plaintext: string): string {
    if (!plaintext || plaintext.startsWith(ENCRYPTION_PREFIX)) return plaintext;
    const key = getDerivedKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${ENCRYPTION_PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptApiKey(ciphertext: string): string {
    if (!ciphertext || !ciphertext.startsWith(ENCRYPTION_PREFIX)) return ciphertext;
    const key = getDerivedKey();
    const parts = ciphertext.slice(ENCRYPTION_PREFIX.length).split(":");
    if (parts.length !== 3) return ciphertext; // malformed, return as-is
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}
