import qrcode from "qrcode-generator";

// TOTP enrolment QR — rendered client-side from the otpauth:// URI the
// server returns. A data URL rather than injected SVG markup: no HTML to
// sanitize, and an <img src> needs no ref or effect to mount. Type 0 lets
// the library pick the smallest QR version that fits the URI.
export function otpauthQrDataUrl(otpauthUri: string): string {
  const qr = qrcode(0, "M");
  qr.addData(otpauthUri);
  qr.make();
  return qr.createDataURL(6, 8);
}
