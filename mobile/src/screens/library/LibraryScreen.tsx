import { memo, useCallback, useMemo } from 'react';

import { Box } from '@/components/base/Box';
import { Text } from '@/components/base/Text';
import { SafeAreaScreen } from '@/components/common/SafeAreaScreen';
import { ScreenHeader } from '@/components/headers/ScreenHeader';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/localization';

import {
  ContinueWatchingSection,
  LibraryEmptyState,
  LibraryErrorState,
  LibraryHeaderControls,
  LibraryList,
  LibrarySkeleton,
} from './components';
import { useLibraryScreen } from './hooks/useLibraryScreen';
import { ActionSheetModal } from '@/components/bottom-sheets/ActionSheetModal';
import type { ActionSheetItem } from '@/components/bottom-sheets/ActionSheet';
import { UNFILED_FOLDER_SELECTION_ID } from '@/library/constants';
import { useFoldersStore } from '@/store/organization/folders';
import { EmptyState } from '@/components/common/EmptyState';

export const LibraryScreen = memo(function LibraryScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const {
    visibleItems,
    continueWatchingItems,
    playableCount,
    searchDraft,
    filter,
    folderId,
    sort,
    viewMode,
    quality,
    qualities,
    controlsDirty,
    filterSheetVisible,
    folderSelectionSheetVisible,
    sortSheetVisible,
    qualitySheetVisible,
    refreshing,
    remoteUnavailable,
    status,
    error,
    onChangeSearch,
    openFilterSheet,
    closeFilterSheet,
    closeFolderSelection,
    onSelectFolderSelection,
    openSortSheet,
    closeSortSheet,
    openQualitySheet,
    closeQualitySheet,
    onSelectFilter,
    onSelectSort,
    onSelectQuality,
    onToggleViewMode,
    onReset,
    refresh,
    openDetails,
    openDownloads,
    openWatchHistory,
  } = useLibraryScreen();

  const foldersById = useFoldersStore((s) => s.itemsById);
  const folderOrderedIds = useFoldersStore((s) => s.orderedIds);

  const folderSelectionActions = useMemo<ActionSheetItem[]>(
    () => {
      const actions: ActionSheetItem[] = [
        {
          id: UNFILED_FOLDER_SELECTION_ID,
          label:
            filter === 'folder' && folderId === UNFILED_FOLDER_SELECTION_ID
              ? 'Unfiled / Downloads ✓'
              : 'Unfiled / Downloads',
          onPress: () => onSelectFolderSelection(UNFILED_FOLDER_SELECTION_ID),
        },
      ];

      for (const id of folderOrderedIds) {
        const folder = foldersById[id];
        if (!folder) continue;
        const selected = filter === 'folder' && folderId === id;
        actions.push({
          id,
          label: selected ? `${folder.name} ✓` : folder.name,
          onPress: () => onSelectFolderSelection(id),
        });
      }

      return actions;
    },
    [filter, folderId, folderOrderedIds, foldersById, onSelectFolderSelection],
  );

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const subtitle =
    playableCount > 0
      ? `${playableCount} video${playableCount === 1 ? '' : 's'}`
      : undefined;

  return (
    <SafeAreaScreen
      testID="library-screen"
      padded={false}
      edges={['top', 'left', 'right', 'bottom']}
      style={{ backgroundColor: theme.colors.background }}>
      <ScreenHeader
        title={t('library.title')}
        subtitle={subtitle}
        testID="library-header"
      />

      <Box py={12} gap={4}>
        <LibraryHeaderControls
          searchDraft={searchDraft}
          filter={filter}
          sort={sort}
          viewMode={viewMode}
          quality={quality}
          qualities={qualities}
          controlsDirty={controlsDirty}
          filterSheetVisible={filterSheetVisible}
          sortSheetVisible={sortSheetVisible}
          qualitySheetVisible={qualitySheetVisible}
          onChangeSearch={onChangeSearch}
          onOpenFilter={openFilterSheet}
          onCloseFilter={closeFilterSheet}
          onOpenSort={openSortSheet}
          onCloseSort={closeSortSheet}
          onOpenQuality={openQualitySheet}
          onCloseQuality={closeQualitySheet}
          onSelectFilter={onSelectFilter}
          onSelectSort={onSelectSort}
          onSelectQuality={onSelectQuality}
          onToggleViewMode={onToggleViewMode}
          onReset={onReset}
        />
      </Box>

      <ActionSheetModal
        visible={folderSelectionSheetVisible}
        onClose={closeFolderSelection}
        title="Folders"
        subtitle="Show videos from one folder"
        actions={folderSelectionActions}
        testID="library-folder-selection"
      />

      {remoteUnavailable && status === 'ready' ? (
        <Box px={16} pb={8}>
          <Text variant="caption" color="textSecondary" accessibilityLiveRegion="polite">
            {t('library.offlineHint')}
          </Text>
        </Box>
      ) : null}

      {status === 'loading' ? (
        <LibrarySkeleton />
      ) : status === 'error' ? (
        <LibraryErrorState
          message={error ?? 'Something went wrong while loading your library.'}
          onRetry={handleRefresh}
          refreshing={refreshing}
        />
      ) : status === 'empty' ? (
        <LibraryEmptyState
          variant="default"
          onActionPress={openDownloads}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : status === 'empty-search' ? (
        <LibraryEmptyState
          variant="search"
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : status === 'empty-filter' ? (
        filter === 'recently_watched' ? (
          <EmptyState
            icon="history"
            title={t('library.emptyRecentlyWatchedTitle')}
            description={t('library.emptyRecentlyWatchedDescription')}
          />
        ) : filter === 'favorites' ? (
          <EmptyState
            icon="heart-outline"
            title={t('library.emptyFavoritesTitle')}
            description={t('library.emptyFavoritesDescription')}
          />
        ) : filter === 'folder' ? (
          <EmptyState
            icon="folder-outline"
            title={t('library.emptyFolderTitle')}
            description={t('library.emptyFolderDescription')}
          />
        ) : (
          <LibraryEmptyState
            variant="filter"
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )
      ) : (
        <Box style={{ flex: 1 }}>
          {filter === 'all' && !searchDraft.trim() ? (
            <ContinueWatchingSection
              items={continueWatchingItems}
              onSeeAll={openWatchHistory}
            />
          ) : null}
          <LibraryList
            items={visibleItems}
            viewMode={viewMode}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onPressItem={openDetails}
          />
        </Box>
      )}
    </SafeAreaScreen>
  );
});
