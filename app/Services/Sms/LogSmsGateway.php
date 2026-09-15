<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

class LogSmsGateway implements SmsGateway
{
    public function send(string $to, string $message): bool
    {
        Log::info('[sms] '.$to.': '.$message);

        return true;
    }
}
