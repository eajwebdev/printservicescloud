<?php

namespace App\Http\Controllers;

use App\Http\Requests\OrderFileRequest;
use App\Http\Requests\ProofStatusRequest;
use App\Models\Order;
use App\Models\OrderFile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderFileController extends Controller
{
    public function store(OrderFileRequest $request, Order $order): RedirectResponse
    {
        $kind = $request->validated('kind');
        $files = $request->file('files', []);

        DB::transaction(function () use ($files, $order, $kind, $request) {
            foreach ($files as $upload) {
                $path = $upload->store("order-files/{$order->id}", OrderFile::DISK);
                $order->files()->create([
                    'kind' => $kind,
                    'path' => $path,
                    'original_name' => mb_substr($upload->getClientOriginalName(), 0, 250),
                    'mime' => $upload->getMimeType(),
                    'size' => $upload->getSize(),
                    'note' => $request->validated('note'),
                    'user_id' => $request->user()->id,
                ]);
            }

            // Sending a proof means the customer now has to say yes before printing.
            if ($kind === 'proof' && $order->proof_status !== 'approved') {
                $order->update(['proof_status' => 'waiting']);
            }

            activity('production')->performedOn($order)->causedBy($request->user())
                ->withProperties(['kind' => $kind, 'files' => collect($files)->map->getClientOriginalName()->all()])
                ->log('Attached '.count($files).' '.strtolower(OrderFile::KINDS[$kind]).(count($files) === 1 ? '' : 's')." to {$order->order_no}");
        });

        return back()->with('success', count($files) === 1 ? 'File attached.' : count($files).' files attached.');
    }

    public function show(Request $request, Order $order, OrderFile $file): StreamedResponse
    {
        abort_unless($file->order_id === $order->id, 404);
        abort_unless(Storage::disk(OrderFile::DISK)->exists($file->path), 404, 'That file is missing from storage.');

        $inline = $request->boolean('inline') && ($file->isImage() || $file->mime === 'application/pdf');

        return Storage::disk(OrderFile::DISK)->response($file->path, $file->original_name, [
            'Content-Type' => $file->mime ?? 'application/octet-stream',
            'Cache-Control' => 'private, max-age=3600',
        ], $inline ? 'inline' : 'attachment');
    }

    public function destroy(Request $request, Order $order, OrderFile $file): RedirectResponse
    {
        abort_unless($file->order_id === $order->id, 404);
        Storage::disk(OrderFile::DISK)->delete($file->path);
        $file->delete();

        if (! $order->files()->where('kind', 'proof')->exists() && $order->proof_status === 'waiting') {
            $order->update(['proof_status' => 'none']);
        }

        activity('production')->performedOn($order)->causedBy($request->user())->log("Removed {$file->original_name} from {$order->order_no}");

        return back()->with('success', 'File removed.');
    }

    public function proof(ProofStatusRequest $request, Order $order): RedirectResponse
    {
        $status = $request->validated('status');
        $order->update([
            'proof_status' => $status,
            'proof_approved_at' => $status === 'approved' ? now() : null,
            'proof_approved_by' => $status === 'approved' ? $request->user()->id : null,
        ]);

        activity('production')->performedOn($order)->causedBy($request->user())->log(match ($status) {
            'approved' => "Customer approved the proof for {$order->order_no}",
            'waiting' => "Waiting for proof approval on {$order->order_no}",
            default => "No proof needed for {$order->order_no}",
        });

        return back()->with('success', $status === 'approved' ? 'Proof approved. Good to print.' : 'Proof status updated.');
    }
}
