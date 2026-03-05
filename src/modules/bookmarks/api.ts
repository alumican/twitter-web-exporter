import { Interceptor } from '@/core/extensions';
import { db } from '@/core/database';
import { TimelineInstructions, Tweet } from '@/types';
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

// https://twitter.com/i/api/graphql/j5KExFXtSWj8HjRui17ydA/Bookmarks
// https://twitter.com/i/api/graphql/.../BookmarkFolderTimeline
export const BookmarksInterceptor: Interceptor = (req, res, ext) => {
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
