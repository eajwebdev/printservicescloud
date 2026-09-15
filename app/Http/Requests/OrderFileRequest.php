<?php

namespace App\Http\Requests;

use App\Models\OrderFile;
use Illuminate\Validation\Rule;

class OrderFileRequest extends AppRequest
{
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::in(array_keys(OrderFile::KINDS))],
            'note' => ['nullable', 'string', 'max:255'],
            'files' => ['required', 'array', 'min:1', 'max:10'],
            // Print files are big and come in shop formats (CorelDRAW, Illustrator, Photoshop).
            'files.*' => ['file', 'max:51200', 'extensions:jpg,jpeg,png,webp,gif,heic,pdf,ai,eps,psd,cdr,svg,tif,tiff,zip,rar,docx,xlsx,pptx,txt'],
        ];
    }

    public function messages(): array
    {
        return [
            'files.required' => 'Choose at least one file to attach.',
            'files.*.max' => 'Each file can be up to 50 MB. Zip large layouts or send a PDF.',
            'files.*.extensions' => 'That file type is not accepted. Use images, PDF, AI, EPS, PSD, CDR, SVG, TIFF, ZIP or Office files.',
        ];
    }
}
