---
name: GitHub blob publishing
description: Safe workspace-to-GitHub Git Data API transfers for large or special-character paths.
---

When publishing workspace files through the Git Data API, read file contents directly and encode them in memory; do not pipe large files through shell output, and quote paths containing shell metacharacters.

**Why:** The shell-output bridge can truncate payloads above its observation limit, while unquoted parentheses can turn a valid path into shell syntax. Both failures can create a commit that exists remotely but cannot be parsed by Vercel.

**How to apply:** For files larger than roughly 40 KB or paths containing parentheses, use the direct file-read callback, verify the UTF-8 byte count and remote blob size, then inspect the resulting deployment logs.