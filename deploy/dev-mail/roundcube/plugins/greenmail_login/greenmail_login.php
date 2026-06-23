<?php

/**
 * Strip @mail.test from login usernames before IMAP/SMTP auth.
 * GreenMail authenticates with local-part logins (support, customer).
 */
class greenmail_login extends rcube_plugin
{
    public $task = 'login';

    #[\Override]
    public function init()
    {
        $this->add_hook('authenticate', [$this, 'strip_mail_domain']);
    }

    public function strip_mail_domain(array $args): array
    {
        $mailDomain = rcube::get_instance()->config->get('mail_domain');
        if (!$mailDomain || !str_contains($args['user'], '@')) {
            return $args;
        }

        $suffix = '@' . $mailDomain;
        if (str_ends_with(strtolower($args['user']), strtolower($suffix))) {
            $args['user'] = substr($args['user'], 0, -strlen($suffix));
        }

        return $args;
    }
}
