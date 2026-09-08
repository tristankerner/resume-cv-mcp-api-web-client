import { ATTACHMENT_CONTENT_TYPES, ATTACHMENT_MAX_BYTES } from "@/lib/config";

export interface EncodedFile {
  filename: string;
  contentType: string;
  base64: string;
  byteSize: number;
}

// Resolved from the file extension, not `file.type` — browsers report
// `.docx` inconsistently and the API sniffs the bytes anyway, so a wrong
// declared type is a 415 the user cannot fix.
export function contentTypeFor(filename: string): string | null {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return null;
  const ext = filename.slice(dotIndex + 1).toLowerCase();
  return ATTACHMENT_CONTENT_TYPES[ext] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function encodeFile(file: File): Promise<EncodedFile> {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error(`"${file.name}" is larger than the 10 MiB limit.`);
  }
  const contentType = contentTypeFor(file.name);
  if (!contentType) {
    throw new Error(`"${file.name}" is not a .pdf or .docx file.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

  return {
    filename: file.name,
    contentType,
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
    byteSize: file.size,
  };
}

export function downloadBase64(filename: string, contentType: string, base64: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Object URLs are not blocked by the CSP the API serves /client with.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
