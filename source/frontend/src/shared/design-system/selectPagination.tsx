import { Button, type SelectProps } from 'antd';

interface SelectPagination {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: (options: { cancelRefetch: boolean }) => Promise<unknown>;
}

export function selectPaginationProps({
  hasNextPage,
  isFetching,
  fetchNextPage,
}: SelectPagination): Pick<
  SelectProps,
  'onInputKeyDown' | 'onPopupScroll' | 'popupRender'
> {
  function loadMore() {
    if (hasNextPage && !isFetching)
      void fetchNextPage({ cancelRefetch: false });
  }

  return {
    onInputKeyDown: (event) => {
      if (
        hasNextPage &&
        event.key === 'PageDown' &&
        event.target instanceof HTMLInputElement &&
        event.target.getAttribute('aria-expanded') === 'true'
      ) {
        event.preventDefault();
        loadMore();
      }
    },
    onPopupScroll: ({ currentTarget }) => {
      const { scrollTop, scrollHeight, clientHeight } = currentTarget;
      if (scrollHeight - scrollTop - clientHeight <= 24) loadMore();
    },
    popupRender: (menu) => (
      <>
        {menu}
        {hasNextPage && (
          <Button
            type="text"
            size="small"
            block
            aria-keyshortcuts="PageDown"
            loading={isFetching}
            onMouseDown={(event) => event.preventDefault()}
            onClick={loadMore}
          >
            Tải thêm lựa chọn <span aria-hidden="true">(Page Down)</span>
          </Button>
        )}
      </>
    ),
  };
}
