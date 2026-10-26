import { Interceptor } from '@/core/extensions';
import { db } from '@/core/database';
import { BookmarkFolder, TimelineInstructions, Tweet } from '@/types';
import { extractDataFromResponse, extractTimelineTweet } from '@/utils/api';
import logger from '@/utils/logger';

interface BookmarksResponse {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: TimelineInstructions;
        responseObjects: unknown;
      };
    };
  };
}

interface BookmarkFolderTimelineResponse {
  data: {
    bookmark_collection_timeline: {
      timeline: {
        instructions: TimelineInstructions;
        responseObjects: unknown;
      };
    };
  };
}

// Folder list and folder create/edit operations. They carry folder IDs together with names.
// https://x.com/i/api/graphql/.../BookmarkFoldersSlice
// https://x.com/i/api/graphql/.../createBookmarkFolder
// https://x.com/i/api/graphql/.../EditBookmarkFolder
const BOOKMARK_FOLDER_LIST_URL_PATTERN =
  /\/graphql\/[^/]+\/(BookmarkFoldersSlice|createBookmarkFolder|EditBookmarkFolder)(\?|$)/i;

/**
 * Extract bookmark folders (id + name) from a folder list or folder create/edit response.
 *
 * Known shapes:
 * - BookmarkFoldersSlice: `data.viewer.user_results.result.bookmark_collections_slice.items[]`
 * - createBookmarkFolder: `data.bookmark_collection_create`
 * - EditBookmarkFolder: `data.bookmark_collection_update`
 *
 * To tolerate API changes, we look for objects with string `id` and `name` anywhere under keys
 * starting with `bookmark_collection` instead of relying on the exact path.
 */
export function extractBookmarkFolders(
  json: unknown,
): Pick<BookmarkFolder, 'id' | 'name' | 'media'>[] {
  const folders = new Map<string, Pick<BookmarkFolder, 'id' | 'name' | 'media'>>();

  const collect = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }

    const obj = node as Record<string, unknown>;
    const id = typeof obj.id === 'number' ? String(obj.id) : obj.id;
    if (typeof id === 'string' && id && typeof obj.name === 'string') {
      folders.set(id, { id, name: obj.name, media: obj.media ?? undefined });
      return;
    }

    Object.values(obj).forEach(collect);
  };

  const search = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(search);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key.startsWith('bookmark_collection') && key !== 'bookmark_collection_timeline') {
        collect(value);
      } else {
        search(value);
      }
    }
  };

  search(json);
  return [...folders.values()];
}

// https://twitter.com/i/api/graphql/j5KExFXtSWj8HjRui17ydA/Bookmarks
// https://twitter.com/i/api/graphql/.../BookmarkFolderTimeline
export const BookmarksInterceptor: Interceptor = (req, res, ext) => {
  if (BOOKMARK_FOLDER_LIST_URL_PATTERN.test(req.url)) {
    try {
      const folders = extractBookmarkFolders(JSON.parse(res.responseText));
      db.upsertBookmarkFolders(folders);
      logger.info(`Bookmarks: ${folders.length} folders received`);
    } catch (err) {
      logger.debug(req.method, req.url, res.status, res.responseText);
      logger.errorWithBanner('Bookmarks: Failed to parse bookmark folders', err as Error);
    }
    return;
  }

  const isBookmarks = /\/graphql\/.+\/Bookmarks/.test(req.url);
  const isBookmarkFolder = /\/graphql\/.+\/BookmarkFolderTimeline/.test(req.url);

  if (!isBookmarks && !isBookmarkFolder) {
    return;
  }

  try {
    let bookmarkCollectionId: string | undefined;

    if (isBookmarkFolder) {
      const url = new URL(req.url);
      const variables = JSON.parse(url.searchParams.get('variables') || '{}');
      bookmarkCollectionId = variables.bookmark_collection_id;
    }

    const newData = extractDataFromResponse<
      BookmarksResponse | BookmarkFolderTimelineResponse,
      Tweet
    >(
      res,
      (json) => {
        if (isBookmarkFolder) {
          return (json as BookmarkFolderTimelineResponse).data.bookmark_collection_timeline.timeline
            .instructions;
        }
        return (json as BookmarksResponse).data.bookmark_timeline_v2.timeline.instructions;
      },
      (entry) => extractTimelineTweet(entry.content.itemContent),
    );

    // Add captured data to the database.
    db.extAddTweets(ext.name, newData, bookmarkCollectionId);

    logger.info(`Bookmarks: ${newData.length} items received`);
  } catch (err) {
    logger.debug(req.method, req.url, res.status, res.responseText);
    logger.errorWithBanner('Bookmarks: Failed to parse API response', err as Error);
  }
};
