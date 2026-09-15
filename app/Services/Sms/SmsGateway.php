<?php

namespace App\Services\Sms;

/**
 * Plug a real provider (Semaphore, Movider, a GSM modem...) in by binding
 * another implementation in AppServiceProvider. No paid gateway is hardwired.
 */
interface SmsGateway
{
    public function send(string $to, string $message): bool;
}
