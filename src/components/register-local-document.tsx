"use client";

import { useState, type ChangeEvent } from "react";
import { LOCAL_FILE_DISCLOSURE, formatFileSize } from "@/lib/assets";

// Above this size the checksum is skipped (SubtleCrypto needs the whole file
// in memory; the bytes still never leave the device either way).
const MAX_HASH_BYTES = 256 * 1024 * 1024; // 256 MB

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900";

type Meta = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  lastModifiedISO: string;
  checksum: string;
  checksumSkipped: boolean;
  assetType: "image" | "document";
};

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function RegisterLocalDocument({
  islandId,
  placeId,
  action,
}: {
  islandId: string;
  placeId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [reading, setReading] = useState(false);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setMeta(null);
      return;
    }
    setReading(true);
    // Everything here is computed locally. The bytes are read only to hash
    // them and are never sent anywhere.
    let checksum = "";
    let checksumSkipped = false;
    if (file.size <= MAX_HASH_BYTES) {
      try {
        checksum = await sha256Hex(file);
      } catch {
        checksumSkipped = true;
      }
    } else {
      checksumSkipped = true;
    }
    setMeta({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "",
      lastModifiedISO: new Date(file.lastModified).toISOString(),
      checksum,
      checksumSkipped,
      assetType: file.type.startsWith("image/") ? "image" : "document",
    });
    setReading(false);
  }

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div>
        <h2 className="text-lg font-medium">Register a local document</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add an existing file as an asset without uploading it.
        </p>
      </div>

      {/* Name-less on purpose: this input's bytes are NEVER submitted. Only
          the hidden metadata fields below are sent to Bridges. */}
      <input
        type="file"
        onChange={onPick}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm dark:file:border-gray-700 dark:file:bg-gray-900"
      />

      {reading && <p className="text-sm text-gray-500">Reading file…</p>}

      {meta && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="island_id" value={islandId} />
          <input type="hidden" name="place_id" value={placeId} />
          <input type="hidden" name="asset_type" value={meta.assetType} />
          <input type="hidden" name="file_name" value={meta.fileName} />
          <input type="hidden" name="file_size" value={meta.fileSize} />
          <input type="hidden" name="mime_type" value={meta.mimeType} />
          <input type="hidden" name="checksum_sha256" value={meta.checksum} />
          <input
            type="hidden"
            name="source_last_modified"
            value={meta.lastModifiedISO}
          />

          <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            <p className="font-medium text-gray-800 dark:text-gray-200">
              📄 {meta.fileName}
            </p>
            <p>
              {formatFileSize(meta.fileSize)} ·{" "}
              {meta.mimeType || "unknown type"}
            </p>
            <p>
              {meta.checksumSkipped
                ? "checksum not computed (large file)"
                : `sha-256 ${meta.checksum.slice(0, 12)}…`}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="local-title" className="block text-sm font-medium">
              Title
            </label>
            <input
              id="local-title"
              name="title"
              required
              defaultValue={meta.fileName}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="local-desc" className="block text-sm font-medium">
              Description{" "}
              <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="local-desc"
              name="description"
              maxLength={1000}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="local-visibility"
                className="block text-sm font-medium"
              >
                Visibility
              </label>
              <select
                id="local-visibility"
                name="visibility"
                defaultValue="private"
                className={inputClass}
              >
                <option value="private">private</option>
                <option value="bridged">bridged</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="local-path" className="block text-sm font-medium">
                Where you keep it{" "}
                <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                id="local-path"
                name="local_path_note"
                maxLength={1024}
                placeholder="e.g. external drive / Projects"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            A note for you — Bridges can&rsquo;t open this path. It stays
            private to you.
          </p>

          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {LOCAL_FILE_DISCLOSURE}
          </p>

          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Register document
          </button>
        </form>
      )}
    </section>
  );
}
