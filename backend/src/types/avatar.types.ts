export interface AvatarUploadTicket {
  /** Object path inside the avatars bucket, e.g. `{userId}-{timestamp}.jpg`. */
  path: string;
  /** Signed, short-lived URL the client PUTs the JPEG bytes to. */
  uploadUrl: string;
  token: string;
  /** URL that will be persisted once the upload is committed. */
  publicUrl: string;
  contentType: string;
  maxBytes: number;
}
