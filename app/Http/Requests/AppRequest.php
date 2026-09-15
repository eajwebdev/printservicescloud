<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Access is enforced by the `page:` route middleware, so requests only validate. */
abstract class AppRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }
}
