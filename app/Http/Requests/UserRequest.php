<?php

namespace App\Http\Requests;

use App\Support\Access;
use Illuminate\Validation\Rule;

class UserRequest extends AppRequest
{
    public function rules(): array
    {
        $choosesBranch = $this->user()?->canAccessAllBranches();

        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($this->route('user'))],
            'phone' => ['nullable', 'string', 'max:40'],
            'password' => [$this->route('user') ? 'nullable' : 'required', 'string', 'min:8', 'max:100'],
            'role' => ['required', 'string', 'max:40'],
            'active' => ['boolean'],
            'all_branches' => ['boolean'],
            'branch_id' => [$choosesBranch && ! $this->boolean('all_branches') && ! $this->route('user')?->is_superadmin ? 'required' : 'nullable', 'integer', Rule::exists('branches', 'id')->whereNull('deleted_at')],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::in(Access::allPermissionNames())],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Set a starting password of at least 8 characters.',
            'branch_id.required' => 'Pick the branch this person works in, or tick "All branches" for an admin.',
        ];
    }
}
