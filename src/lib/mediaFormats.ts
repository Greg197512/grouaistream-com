const AUDIO_EXTENSION_TO_TYPE: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".opus": "audio/opus",
  ".wma": "audio/x-ms-wma",
  ".weba": "audio/webm",
};

const VIDEO_EXTENSION_TO_TYPE: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".3gp": "video/3gpp",
  ".3gpp": "video/3gpp",
  ".ogv": "video/ogg",
  ".m4v": "video/x-m4v",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".ts": "video/mp2t",
  ".mts": "video/mp2t",
  ".m2ts": "video/mp2t",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".vob": "video/dvd",
  ".asf": "video/x-ms-asf",
  ".divx": "video/divx",
  ".f4v": "video/mp4",
  ".rm": "application/vnd.rn-realmedia",
  ".rmvb": "application/vnd.rn-realmedia-vbr",
  ".mxf": "application/mxf",
};

export const ALLOWED_AUDIO_TYPES = Array.from(new Set(Object.values(AUDIO_EXTENSION_TO_TYPE).concat([
  "audio/mp3",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/x-flac",
  "audio/x-aac",
  "audio/vnd.wave",
  "audio/wave",
]))) as string[];

export const ALLOWED_VIDEO_TYPES = Array.from(new Set(Object.values(VIDEO_EXTENSION_TO_TYPE).concat([
  "video/avi",
  "video/3gpp2",
  "application/octet-stream",
]))) as string[];

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const AUDIO_EXTENSIONS = Object.keys(AUDIO_EXTENSION_TO_TYPE);
export const VIDEO_EXTENSIONS = Object.keys(VIDEO_EXTENSION_TO_TYPE);
export const ALLOWED_MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];
export const MEDIA_FILE_ACCEPT = ALLOWED_MEDIA_EXTENSIONS.join(",");
export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024;

export const getFileExtension = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? `.${extension}` : "";
};

export const isVideoExtension = (extension: string) => VIDEO_EXTENSIONS.includes(extension);

export const isVideoLikeFile = (file: Pick<File, "name" | "type">) => {
  if (file.type.startsWith("audio/")) return false;
  if (file.type.startsWith("video/")) return true;
  return isVideoExtension(getFileExtension(file.name));
};

export const isAllowedMediaFile = (
  file: Pick<File, "name" | "size" | "type">,
  maxSize = MAX_UPLOAD_SIZE_BYTES,
) => {
  if (file.size > maxSize) return false;
  const extension = getFileExtension(file.name);
  if (ALLOWED_MEDIA_EXTENSIONS.includes(extension)) return true;
  return ALLOWED_AUDIO_TYPES.includes(file.type) || ALLOWED_VIDEO_TYPES.includes(file.type);
};

export const getMediaContentType = (file: Pick<File, "name" | "type">) => {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = getFileExtension(file.name);
  return AUDIO_EXTENSION_TO_TYPE[extension] ?? VIDEO_EXTENSION_TO_TYPE[extension] ?? file.type ?? "application/octet-stream";
};