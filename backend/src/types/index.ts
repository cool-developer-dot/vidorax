export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
};

export type {
  AuthResponse,
  AuthenticatedRequest,
  JwtPayload,
  LoginRequest,
  PublicUser,
  RefreshRequest,
  RefreshResponse,
  RegisterRequest,
  User,
} from './auth.types.js';

export type { AvatarUploadTicket } from './avatar.types.js';

export type {
  BookmarkItem,
  BrowserHistoryItem,
  CreateBookmarkInput,
  CreateHistoryInput,
  RecentUrlItem,
  UpdateBookmarkInput,
  UpdateProfileInput,
  UpdateSettingsInput,
  UserProfile,
  UserSettingsResponse,
} from './user.types.js';

export {
  DOWNLOAD_STATUSES,
  type CreateDownloadInput,
  type DownloadItem,
  type DownloadListFilters,
  type DownloadSort,
  type UpdateDownloadInput,
} from './download.types.js';

export {
  ANALYSIS_UNSUPPORTED_REASONS,
  DOWNLOAD_STREAM_TYPES,
  MEDIA_CONTAINERS,
  MEDIA_TYPES,
  type AnalysisUnsupportedReason,
  type AnalyzeDownloadResponse,
  type AnalyzeUrlInput,
  type DownloadStreamType,
  type MediaAnalysisResult,
  type MediaAnalysisVariant,
  type MediaContainer,
  type MediaType,
} from './media-analysis.types.js';

export {
  FAVORITE_PLATFORMS,
  type CreateFavoriteInput,
  type FavoriteItem,
  type FavoriteListFilters,
} from './favorite.types.js';
