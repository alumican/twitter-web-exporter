import { EntityURL } from './index';

export interface TimelineUser {
  itemType: 'TimelineUser';
  __typename: 'TimelineUser';
  user_results: {
    result: User | UserUnavailable;
  };
  userDisplayType: string;
}

export interface UserUnavailable {
  __typename: 'UserUnavailable';
  message: string;
  reason: string;
}

export interface User {
  __typename: 'User';
  id: string;
  rest_id: string;
  affiliates_highlighted_label: unknown;
  has_graduated_access?: boolean;
  is_blue_verified: boolean;
  profile_image_shape?: 'Square' | 'Circle';
  /** This field is dropped since July 2026. */
  legacy?: {
    default_profile: boolean;
    default_profile_image: boolean;
    description: string;
    entities: UserEntities;
    fast_followers_count: number;
    favourites_count: number;
    followers_count: number;
    friends_count: number;
    has_custom_timelines: boolean;
    is_translator: boolean;
    listed_count: number;
    media_count: number;
    normal_followers_count: number;
    pinned_tweet_ids_str: string[];
    possibly_sensitive: boolean;
    profile_banner_url?: string;
    profile_interstitial_type: string;
    statuses_count: number;
    translator_type: string;
    url?: string;
    want_retweets: boolean;
    withheld_in_countries: unknown[];
  };
  action_counts?: {
    favorites_count: number; // legacy.favourites_count
  };
  avatar: {
    image_url: string;
  };
  banner?: {
    image_url: string; // legacy.profile_banner_url
  };
  core: {
    created_at?: string;
    name: string;
    screen_name: string;
  };
  dm_permissions?: {
    can_dm: boolean;
  };
  location?: {
    location: string;
  };
  media_permissions?: {
    can_media_tag: boolean;
  };
  privacy: {
    protected?: boolean;
  };
  pinned_items?: {
    tweet_ids_str?: string[]; // legacy.pinned_tweet_ids_str
  };
  profile_bio?: {
    description: string; // legacy.description
    entities: UserEntities;
  };
  profile_metadata?: {
    profile_interstitial_type: string;
  };
  profile_translation?: {
    translator_type: string;
  };
  relationship_counts?: {
    followers: number; // legacy.followers_count
    following: number; // legacy.friends_count
  };
  tweet_counts?: {
    media_tweets: number;
    tweets: number;
  };
  website?: {
    url: string; // legacy.url
  };
  verification: {
    verified: boolean;
    verified_type?: 'Business' | 'Government' | string;
  };
  relationship_perspectives: {
    following: boolean;
    followed_by?: boolean;
    blocked_by?: boolean;
    blocking?: boolean;
    live_following?: boolean;
    muting?: boolean;
  };
  parody_commentary_fan_label?: 'None' | 'Parody' | 'Commentary' | 'Fan';
  community_role?: 'Member' | 'Moderator' | 'Admin';
  tipjar_settings?: {
    is_enabled?: boolean;
    patreon_handle?: string;
  };
  is_profile_translatable?: boolean;
  has_hidden_subscriptions_on_profile?: boolean;
  verification_info?: VerificationInfo;
  highlights_info?: {
    can_highlight_tweets: boolean;
    highlighted_tweets: string;
  };
  user_seed_tweet_count?: number;
  premium_gifting_eligible?: boolean;
  business_account?: unknown;
  creator_subscriptions_count?: number;
  legacy_extended_profile?: {
    birthdate?: {
      day: number;
      month: number;
      year?: number;
      visibility: string;
      year_visibility: string;
    };
  };
  professional?: {
    rest_id: string;
    professional_type: string;
    category: {
      id: number;
      name: string;
      icon_name: string;
    }[];
  };
  about_profile?: AboutProfile;
  possibly_sensitive?: boolean;
  follow_request_sent?: boolean;
  identity_profile_labels_highlighted_label?: unknown;
  grok_translated_bio_with_availability?: {
    is_available: boolean;
  };
  notifications_settings?: {
    notifications_enabled: boolean;
  };
  profile_description_language?: string;
  profile_sort_enabled?: boolean;
  super_follow_eligible?: boolean;
  super_followed_by?: boolean;
  super_following?: boolean;
  verified_user_profiles?: {
    super_follows_user_profile?: {
      is_active: boolean;
    };
  };
  /**
   * Some extra properties added by the script when inserting to local database.
   * These are not present in the original tweet object and are used for internal purposes only.
   */
  twe_private_fields: {
    /** The UNIX timestamp representation of `legacy.created_at` in milliseconds. */
    created_at: number;
    /** The UNIX timestamp in ms when inserted or updated to local database. */
    updated_at: number;
    /** The UNIX timestamp in ms when the data record was migrated from legacy format. */
    migrated_at?: number;
  };
}

/**
 * The user type definition prior to the Twitter API's breaking changes introduced in June 2025.
 * Used for compatibility with existing legacy data and database migrations.
 */
export interface UserLegacy extends User {
  legacy: NonNullable<User['legacy']> & {
    followed_by: boolean;
    following: boolean;
    can_dm: boolean;
    can_media_tag: boolean;
    created_at: string;
    location: string;
    name: string;
    profile_image_url_https: string;
    protected?: boolean;
    screen_name: string;
    verified: boolean;
    verified_type?: string;
  };
}

export interface UserEntities {
  description: {
    urls: EntityURL[];
  };
  url?: {
    urls: EntityURL[];
  };
}

export interface AboutProfile {
  account_based_in?: string;
  affiliate_username?: string;
  created_country_accurate?: boolean;
  learn_more_url?: string;
  location_accurate?: boolean;
  source?: string;
  username_changes?: {
    count: string;
    last_changed_at_msec: string;
  };
}

export interface VerificationInfo {
  is_identity_verified: boolean;
  reason: {
    description?: {
      text: string;
      entities: {
        from_index: number;
        to_index: number;
        ref: {
          url: string;
          url_type: 'ExternalUrl';
        };
      }[];
    };
    verified_since_msec: string;
  };
}
