<?php

// Map IMAP folders scaffolded via GreenMail preload (deploy/dev-mail/greenmail-preload).
$config['drafts_mbox'] = 'Drafts';
$config['sent_mbox'] = 'Sent';
$config['junk_mbox'] = 'Spam';
$config['trash_mbox'] = 'Trash';
$config['archive_mbox'] = 'Archive';

// Folders are created at GreenMail startup; do not prompt to create them.
$config['create_default_folders'] = false;

// Dev mailboxes use the RFC 2606 .test TLD so Roundcube accepts addresses (single-label
// domains like @localhost are rejected by client and server validation).
$config['mail_domain'] = 'mail.test';
$config['email_dns_check'] = false;

// GreenMail IMAP/SMTP auth uses local-part logins (support, customer). The greenmail_login
// plugin strips @mail.test before auth when users enter a full address.
$config['plugins'][] = 'greenmail_login';

$config['smtp_host'] = 'greenmail:3025';
$config['smtp_helo_host'] = 'mail.test';
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
