import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

/**
 * Connect to Gmail via IMAP and fetch all UNSEEN (unread) emails
 * from the configured mailbox, then mark them as SEEN (read).
 *
 * Requires a Gmail App Password (not your regular password):
 *   1. Enable 2-Step Verification on your Google Account
 *   2. Go to https://myaccount.google.com/apppasswords
 *   3. Generate a password for "Mail" → "Other (Foster & Keys)"
 *   4. Use that 16-char password as GMAIL_APP_PASSWORD in .env.local
 *
 * @param {object}  opts
 * @param {string}  [opts.folder]   – IMAP folder to check (default: "INBOX")
 * @param {string}  [opts.filter]   – optional subject filter string
 * @param {string}  [opts.user]     – Gmail address (defaults to GMAIL_USER env)
 * @param {string}  [opts.pass]     – Gmail app password (defaults to GMAIL_APP_PASSWORD env)
 * @returns {Promise<Array<{uid: number, from: string, subject: string, textBody: string, htmlBody: string, date: Date}>>}
 */
export async function fetchUnreadEmails(opts = {}) {
  const {
    folder = "INBOX",
    filter,
    user = process.env.GMAIL_USER,
    pass = process.env.GMAIL_APP_PASSWORD,
  } = opts;

  const client = new ImapFlow({
    host: process.env.GMAIL_IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.GMAIL_IMAP_PORT) || 993,
    secure: true,
    auth: {
      user,
      pass,
    },
    logger: false, // suppress noisy IMAP logs
  });

  const emails = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      // Search for unseen messages
      const searchCriteria = { seen: false };
      const uids = [];

      for await (const msg of client.fetch(searchCriteria, {
        uid: true,
        envelope: true,
        source: true, // full raw email source for mailparser
      })) {
        uids.push(msg.uid);

        // Parse the raw email source with mailparser
        const parsed = await simpleParser(msg.source);

        const fromAddr =
          parsed.from?.value?.[0]?.address ??
          msg.envelope?.from?.[0]?.address ??
          "";
        const subject = parsed.subject ?? msg.envelope?.subject ?? "";
        const textBody = parsed.text ?? "";
        const htmlBody = parsed.html ?? "";
        const date = parsed.date ?? msg.envelope?.date ?? new Date();

        // Optional subject filter — skip emails that don't match
        if (filter && !subject.toLowerCase().includes(filter.toLowerCase())) {
          // Still mark as seen so we don't re-process on next poll
          continue;
        }

        emails.push({
          uid: msg.uid,
          from: fromAddr,
          subject,
          textBody,
          htmlBody,
          date,
        });
      }

      // Mark all fetched messages as SEEN so they aren't re-processed
      if (uids.length > 0) {
        await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return emails;
}
