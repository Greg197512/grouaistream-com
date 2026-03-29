export const VIDEO_URL_EXTENSION_PATTERN = /\.(mp4|webm|mov|avi|mkv|ogv|3gp|3gpp|m4v|flv|wmv|mpg|mpeg|ts|mts|m2ts|vob|divx|f4v|asf|rm|rmvb|mxf)(\?|$|#)/i;
export const AUDIO_URL_EXTENSION_PATTERN = /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|weba)(\?|$|#)/i;

export const isNativeVideoUrl = (url?: string | null) => Boolean(url && VIDEO_URL_EXTENSION_PATTERN.test(url));

export const isLikelyAudioUrl = (url?: string | null) => Boolean(url && AUDIO_URL_EXTENSION_PATTERN.test(url));